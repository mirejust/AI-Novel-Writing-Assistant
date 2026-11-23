import {verifyReviewedProse} from "./revisions/proseReview";
import {MANUAL_CHAPTER_SYNC_TYPE} from "../../services/novel/chapterEditor/synchronization";
import {buildChapterArtifactContentHash} from "../../services/novel/runtime/artifactSync/ChapterArtifactContentVersion";
import {directorCharacterCandidates} from "../../services/novel/characters/candidates";
import type {Prisma} from "@prisma/client";
import {artifactContentHash, readExecutionContracts, type RunContract} from "../../modules/director";
import {parsePipelinePayload, stringifyPipelinePayload} from "../../services/novel/pipelineJobState";
import {AppError} from "../../middleware/errorHandler";
import {isCurrentV2ChapterProductionCompleted as isCurrentChapterProductionCompleted} from "../../services/novel/production/completion";
import {CHAPTER_ARTIFACT_BOUNDARY_TYPE} from "../../services/novel/runtime/artifactSync";
import {revalidateSavedPlanning} from "./recovery/missingPlanning";
import {saveReviewAssetEdit} from "./revisions/reviewAssets";
import type {ReviewAssetEdit} from "@ai-novel/shared/types/director/revision";
import {chapterReviewForm} from "@ai-novel/shared/types/director/chapterReview/discussion";
import {readChapterReviewPlans} from "./revisions/chapterReview";
import {saveChapterPlanEdit} from "./revisions/chapterPlan";
import {authorizeChapterBudget, readPausedChapterBudget, readChapterUsageCounters, observeChapterUsage} from "../../services/novel/production/usage";
import type {DirectorChapterBudgetGrant} from "@ai-novel/shared/types/director/chapterBudget";
import {readProductionBatchImplementation,readKernelUnitOutcome,resumeKernelProduction,cancelKernelProduction} from "./productionKernel";

/** Reads saved business assets in the same transaction as gate confirmation. */
export async function readEditedArtifact(input: {contract: RunContract; type: string; contentRef: string; expectedVolumePlanVersionId?: string; proseReview?: import("@ai-novel/shared/types/director/proseReview/discussion").BatchProseReview; assetEdit?: ReviewAssetEdit; chapterPlanEdit?: import("@ai-novel/shared/types/director/revision").ChapterPlanRevision}, tx: Prisma.TransactionClient) {
  if (input.assetEdit) {
    if (input.assetEdit.type !== input.type) throw new AppError("El contenido modificado es inconsistente con esta etapa de confirmación.", 400);
    await saveReviewAssetEdit(input.contract.novelId, input.assetEdit, tx);
  }
  let approvedChapterFingerprint: string | undefined;
  if (input.chapterPlanEdit) {
    if (input.type !== "chapter_task_sheet") throw new AppError("Solo se pueden editar las tareas y escenas del capítulo actual.", 400);
    approvedChapterFingerprint = await saveChapterPlanEdit(input.contract, input.chapterPlanEdit, tx);
  }
  const novelId = input.contract.novelId;
  let content: unknown;
  let protectedUserContent = false;
  switch (input.type) {
    case "character_cast":
      content = {characters: await tx.character.findMany({where: {novelId}, orderBy: {id: "asc"}}), relations: await tx.characterRelation.findMany({where: {novelId}, orderBy: {id: "asc"}})};
      break;
    case "volume_strategy": {
      const version = await tx.volumePlanVersion.findFirst({where: {novelId, status: "active"}, orderBy: {version: "desc"}});
      if (!version || (input.expectedVolumePlanVersionId && version.id !== input.expectedVolumePlanVersionId)) {
        throw new AppError("La versión del programa de estudios ha cambiado; vuelva a abrir la página de confirmación del programa de estudios.", 409);
      }
      content = JSON.parse(version.contentJson) as unknown;
      break;
    }
    case "chapter_task_sheet": {
      const chapters = await readChapterReviewPlans(tx, input.contract);
      for (const chapter of chapters) {
        const missing = [!chapter.taskSheet?.trim() && "Tareas del capítulo", !chapter.sceneCards?.trim() && "arreglo de escena"].filter(Boolean);
        if (missing.length) throw new AppError(`Cap. ${chapter.chapterOrder} Falta el capitulo guardado${missing.join("y")}, procese primero la etapa actual.`, 409);
      }
      if (approvedChapterFingerprint && chapters.some(chapter => !chapterReviewForm(chapter).scenePlan)) {
        throw new AppError("Este lote contiene escenas que no se pueden comprobar una por una. Primero regenere las tareas y escenas del capítulo.", 409);
      }
      content = chapters;
      break;
    }
    case "chapter_execution_contract": {
      content = await readExecutionContracts(tx, input.contract);
      break;
    }
    case "chapter_batch_closed": {
      const range = input.contract.chapterRange;
      if (!range) throw new Error("Falta alcance de autorización de texto.");
      const chapters = await tx.chapter.findMany({where: {novelId, order: {gte: range.from, lte: range.to}}, orderBy: {order: "asc"}, select: {id: true, order: true, content: true, updatedAt: true, generationState: true, chapterStatus: true, riskFlags: true,
        artifactSyncCheckpoints: {where: {OR: [{artifactType: CHAPTER_ARTIFACT_BOUNDARY_TYPE, status: "succeeded"}, {artifactType: MANUAL_CHAPTER_SYNC_TYPE}]},
          select: {contentHash: true, metadataJson: true, artifactType: true}, orderBy: {updatedAt: "desc"}}}});
      if (chapters.length !== range.to-range.from+1 || chapters.some(chapter => !chapter.content?.trim())) throw new Error("Primero guarde el texto del capítulo de este lote.");
      if (input.proseReview) await verifyReviewedProse(tx,input.contract,chapters,input.proseReview);
      const kernel = await readProductionBatchImplementation(tx,input.contract) === "kernel";
      const closed = kernel ? (await Promise.all(chapters.map(chapter=>readKernelUnitOutcome(tx,input.contract,{...chapter,novelId},{allowSynchronizedRevision:true}))))
        .every(outcome=>outcome?.status === "completed") : chapters.every(isCurrentChapterProductionCompleted);
      if (!closed) throw new AppError("La modificación del texto aún no se ha sincronizado. Confirme después de terminar la página del capítulo.", 400);
      for (const chapter of chapters) {
        const locked = await tx.chapter.updateMany({where: {id: chapter.id, novelId, content: chapter.content}, data: {updatedAt: chapter.updatedAt}});
        if (!locked.count) throw new AppError("El texto ha cambiado durante el período de confirmación, verifique la revisión antes de continuar.", 409);
      }
      protectedUserContent = chapters.some(chapter => chapter.artifactSyncCheckpoints.some(row =>
        row.artifactType === MANUAL_CHAPTER_SYNC_TYPE && row.contentHash === buildChapterArtifactContentHash(chapter.content ?? "")));
      content = chapters.map(({id, order, content}) => ({id, order, content}));
      break;
    }
    default: throw new Error("Utilice los resultados de confirmación en esta etapa o verifique las modificaciones en la página de activos correspondiente.");
  }
  return {contentRef: input.contentRef, contentHash: artifactContentHash(content), protectedUserContent, approvedChapterFingerprint};
}

export async function resumeBusiness(contract: RunContract, tx: Prisma.TransactionClient, chapterBudget?: DirectorChapterBudgetGrant, resolveUnknownClaims?: {chapterId: string}) {
  if (await readProductionBatchImplementation(tx,contract) === "kernel") return resumeKernelProduction(contract,tx,chapterBudget,resolveUnknownClaims);
  if ((await tx.directorNextRunControl.findUniqueOrThrow({where: {runId: contract.runId}})).status === "failed") {
    throw new AppError("No hay pasos de texto recuperables para este error. Consulte el alcance de la creación en el contenido de este libro.",400);
  }
  if (resolveUnknownClaims) throw new AppError("No hay pasos pendientes identificables para esta creación.",400);
  const event = await tx.directorNextEvent.findFirst({where: {runId: contract.runId, type: "chapter_batch_job"}, orderBy: {seq: "desc"}});
  if (!event) {
    if (chapterBudget) throw new AppError("No hay un presupuesto de capítulo ajustable para esta producción.",400);
    await revalidateSavedPlanning(contract,tx);return;
  }
  const binding = JSON.parse(event.payloadJson) as {jobId?: unknown};
  if (typeof binding.jobId !== "string") throw new Error("El enlace de recuperación de texto no es válido.");
  const job = await tx.generationJob.findUniqueOrThrow({where: {id: binding.jobId}});
  const payload = parsePipelinePayload(job.payload);
  if (job.novelId !== contract.novelId || payload.directorNext?.runId !== contract.runId) throw new Error("El trabajo de texto no pertenece a esta ejecución.");
  if (chapterBudget && (!job.pendingManualRecovery || !["queued","running"].includes(job.status) || job.cancelRequestedAt)) {
    throw new AppError("El estado de pausa ha cambiado. Actualice e inténtelo de nuevo.",400);
  }
  if (job.pendingManualRecovery) {
    const pausedBudget = readPausedChapterBudget(payload.directorNext, job.id);
    if (chapterBudget) {
      const range = contract.chapterRange;
      const chapter = await tx.chapter.findFirst({where: {id: chapterBudget.chapterId, novelId: contract.novelId},select: {order: true}});
      if (!range || !chapter || chapter.order < range.from || chapter.order > range.to) throw new AppError("La autorización presupuestaria está fuera del alcance de este capítulo.",400);
      try {
        const usage = await readChapterUsageCounters(job.id,tx);
        observeChapterUsage(payload.directorNext,chapterBudget.chapterId,usage.job,usage.batch);
        authorizeChapterBudget(payload.directorNext, job.id, chapterBudget);
      }
      catch (error) {throw new AppError(error instanceof Error ? error.message : "La cuota de este capítulo no es válida.",400);}
    } else if (pausedBudget) {
      throw new AppError("Confirme la nueva cuota para este capítulo en el escritorio del director y luego continúe desde el progreso guardado.",400);
    }
    if (payload.directorNext.pendingCharacterReviewId) {
      await directorCharacterCandidates.assertResolved(contract.runId, payload.directorNext.pendingCharacterReviewId, tx);
      delete payload.directorNext.pendingCharacterReviewId;
    }
    if (payload.replanAlertDetails?.length || payload.directorNext.decisions.slice(payload.directorNext.resolvedDecisionCount ?? 0).some(decision => decision.issueCode === "quality.replan_required")) {
      const plan = await tx.volumePlanVersion.findFirst({where: {novelId: contract.novelId, status: "active"}, orderBy: {version: "desc"}, select: {updatedAt: true}});
      if (!plan || plan.updatedAt <= job.updatedAt) throw new AppError("Guarde la ruta del capítulo ajustada desde la página de planificación del libro antes de continuar con la creación.", 400);
    }
    payload.directorNext.resolvedDecisionCount = payload.directorNext.decisions.length;
    payload.replanAlertDetails = [];
    const data = {pendingManualRecovery: false, payload: stringifyPipelinePayload(payload)};
    if (chapterBudget) {
      const changed = await tx.generationJob.updateMany({where: {id: job.id, pendingManualRecovery: true, payload: job.payload},data});
      if (changed.count !== 1) throw new AppError("El estado de pausa ha cambiado. Actualice e inténtelo de nuevo.",409);
    } else await tx.generationJob.update({where: {id: job.id}, data});
  }
}

export async function cancelBusiness(contract: RunContract, tx: Prisma.TransactionClient) {
  if (await readProductionBatchImplementation(tx,contract) === "kernel") return cancelKernelProduction(contract,tx);
  const jobs = await tx.generationJob.findMany({where: {novelId: contract.novelId, status: {in: ["queued","running"]}}});
  for (const job of jobs) {
    if (parsePipelinePayload(job.payload).directorNext?.runId !== contract.runId) continue;
    await tx.generationJob.update({where: {id: job.id}, data: {cancelRequestedAt: new Date(), ...(job.status === "queued" ? {status: "cancelled", pendingManualRecovery: false} : {})}});
  }
}
