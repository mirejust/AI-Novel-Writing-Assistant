import type { Prisma } from "@prisma/client";
import type { RunContract } from "../../../../modules/director";
import { hashProductionContent, applyUnitAction, parseProductionUnitRun } from "../../../../modules/production";
import { canonicalProductionJson } from "../../../../modules/production/common";
import { directorChapterBudgetGrantSchema, directorChapterTokenLimitSchema, type DirectorChapterBudgetGrant } from "@ai-novel/shared/types/director/chapterBudget";
import { AppError } from "../../../../middleware/errorHandler";
import { readKernelPausedChapterBudget } from "../readModel/budget";
import { isOrphanPrepareClaim, isUnconfirmedActiveStage, UNKNOWN_MODEL_CLAIM_FILTER } from "../readModel/unknownClaims";
import { BLOCKED, kernelBudgetMode } from "../execution/budgetReader";
import { productionBatchOwnerKey } from "../execution/ownership";
import { resetReplannedUnit } from "./replan";
import { assertKernelCharacterReviewsResolved } from "./characterReviews";
import {assertKernelStartReadiness} from "../readiness";
import {retryUnusableDraft} from "./unusableDraft";

async function lockSourceCommand(tx: Prisma.TransactionClient, contract: RunContract) {
  const book = await tx.novel.updateMany({where:{id:contract.novelId,directorEpoch:contract.executionEpoch ?? 0,
    narrativeForm:{not:"short_story"},OR:[{directorVersion:"v2"},{directorVersion:null}]},data:{directorEpoch:{increment:0}}});
  if (book.count !== 1) throw new AppError("La propiedad de ejecución de este libro ha cambiado. Actualice e inténtelo de nuevo.",409);
  const control = await tx.directorNextRunControl.findUniqueOrThrow({where:{runId:contract.runId}});
  if (control.novelId !== contract.novelId || !["paused", "failed"].includes(control.status)) throw new AppError("El estado de pausa ha cambiado. Actualice e inténtelo de nuevo.",409);
  const locked = await tx.directorNextRunControl.updateMany({where:{runId:contract.runId,novelId:contract.novelId,
    version:control.version,status:control.status},data:{version:{increment:0}}});
  if (locked.count !== 1) throw new AppError("El estado de ejecución ha cambiado. Actualice e inténtelo de nuevo.",409);
  const saved = await tx.directorNextRun.findUniqueOrThrow({where:{id:contract.runId},select:{novelId:true,contractJson:true}});
  if (saved.novelId !== contract.novelId || canonicalProductionJson(JSON.parse(saved.contractJson)) !== canonicalProductionJson(contract)) {
    throw new AppError("El alcance de la autorización operativa ha cambiado; actualice e inténtelo nuevamente.",409);
  }
  return control;
}

/** Called only by the explicit source-page command, within its existing control/command/event transaction. */
export async function resumeKernelProduction(contract: RunContract, tx: Prisma.TransactionClient, grant?: DirectorChapterBudgetGrant, resolveUnknownClaims?: {chapterId: string}) {
  await assertKernelStartReadiness(tx,contract);
  const control = await lockSourceCommand(tx,contract), pause = JSON.parse(control.pauseJson ?? "null");
  await assertKernelCharacterReviewsResolved(tx,contract);
  const budget = await readKernelPausedChapterBudget(tx,contract,{status:"paused",pause});
  if (budget) {
    if (!grant) throw new AppError("Confirme la nueva cuota para este capítulo en el escritorio del director y luego continúe desde el progreso guardado.",400);
    const valid = directorChapterBudgetGrantSchema.safeParse(grant);
    if (!valid.success || grant.jobId !== budget.jobId || grant.chapterId !== budget.chapterId) throw new AppError("La autorización presupuestaria es incompatible con la suspensión de capítulos.",400);
    if (grant.metric !== budget.metric) throw new AppError("El calibre de medición del presupuesto ha cambiado; actualice e inténtelo nuevamente.",400);
    if (grant.tokenLimit <= budget.tokenLimit || grant.tokenLimit <= budget.usedTokens + budget.reserveTokens
      || grant.applyToRemaining && !directorChapterTokenLimitSchema.safeParse(grant.tokenLimit).success) throw new AppError("El monto de este capítulo debe ser superior al monto utilizado, a la próxima reserva y al límite superior actual.",400);
    await tx.chapterArtifactSyncCheckpoint.updateMany({where:{novelId:contract.novelId,chapterId:budget.chapterId,
      syncMode:kernelBudgetMode(contract.runId),artifactType:BLOCKED,status:"blocked"},data:{status:"authorized"}});
    // The command repository appends the immutable chapter_budget_granted event before committing.
  } else if (grant) throw new AppError("No hay presupuestos de capítulos que ajustar para esta pausa.",400);
  const rows = await tx.productionUnitRun.findMany({where:{ownerKey:productionBatchOwnerKey(contract.runId)}});
  const runs=rows.map(parseProductionUnitRun);
  const retried = await retryUnusableDraft(tx,contract,runs);
  if (control.status === "failed" && retried !== 1) throw new AppError("No hay pasos de cuerpo vacío para volver a intentar debido a este error.",409);
  await resetReplannedUnit(tx,contract,control.updatedAt,runs);
  const stylePaused = runs.filter(run=>run.progress.styleReviewPause && !run.progress.styleReviewPause.acknowledged);
  if (stylePaused.length > 1) throw new AppError("El capítulo donde se pausa la revisión escrita no es único; verifique el registro actual.",409);
  for (const run of stylePaused) {
    const unit = run.progress.unit, range = contract.chapterRange;
    const selected = run.progress.selected === "candidate" ? run.artifacts.candidate : run.artifacts.original;
    if (!range || unit.novelId !== contract.novelId || unit.order < range.from || unit.order > range.to || run.activeStage
      || run.progress.committedContentHash || !run.progress.selectedContentHash || !selected?.trim()
      || hashProductionContent(selected) !== run.progress.selectedContentHash
      || run.progress.styleReviewPause!.contentHash !== run.progress.selectedContentHash) {
      throw new AppError("El rango de capítulos donde se pausa la revisión escrita no es válido.",409);
    }
    // Explicit source-page recovery only: the user accepts this manuscript so the
    // commit stage may run again. A rejected attempt never commits on its own.
    const progress = applyUnitAction(run.progress,{kind:"acknowledge_style_review_pause",contentHash:run.progress.selectedContentHash});
    const changed = await tx.productionUnitRun.updateMany({where:{id:run.id,ownerKey:run.ownerKey,novelId:unit.novelId,chapterId:unit.chapterId,
      version:run.version,activeStage:null,activeRequestKey:null},data:{progressJson:canonicalProductionJson(progress),version:{increment:1}}});
    if (changed.count !== 1) throw new AppError("El estado de pausa de revisión de escritura cambia.",409);
  }
  const paused = runs.filter(run=>run.progress.qualityPause && !run.progress.qualityPause.acknowledged);
  if (paused.length > 1) throw new AppError("El capítulo en pausa de calidad no es único; verifique el registro en ejecución.",409);
  for (const run of paused) {
    const unit = run.progress.unit, range = contract.chapterRange;
    if (!range || unit.novelId !== contract.novelId || unit.order < range.from || unit.order > range.to || run.activeStage) throw new AppError("El rango de capítulos en pausa de calidad no es válido.",409);
    const chapter = await tx.chapter.findFirst({where:{id:unit.chapterId,novelId:contract.novelId,order:unit.order},select:{content:true,updatedAt:true}});
    if (!chapter?.content || hashProductionContent(chapter.content) !== run.progress.committedContentHash) throw new AppError("El texto ha sido modificado, consulte primero desde la página del capítulo.",409);
    const locked = await tx.chapter.updateMany({where:{id:unit.chapterId,novelId:contract.novelId,content:chapter.content,updatedAt:chapter.updatedAt},data:{updatedAt:chapter.updatedAt}});
    if (locked.count !== 1) throw new AppError("El texto cambia durante la recuperación.",409);
    const progress = applyUnitAction(run.progress,{kind:"acknowledge_quality_pause",contentHash:run.progress.committedContentHash!});
    const changed = await tx.productionUnitRun.updateMany({where:{id:run.id,ownerKey:run.ownerKey,novelId:unit.novelId,chapterId:unit.chapterId,
      version:run.version,activeStage:null,activeRequestKey:null},data:{progressJson:canonicalProductionJson(progress),version:{increment:1}}});
    if (changed.count !== 1) throw new AppError("El estado de pausa de calidad cambia.",409);
  }
  if (resolveUnknownClaims) {
    // A separate, explicit confirmation — never part of a plain resume. The user has
    // checked the chapter on its source page; only model-step claims of that chapter
    // are released, and only when the saved manuscript still matches what was committed.
    const target = runs.find(run=>run.progress.unit.chapterId === resolveUnknownClaims.chapterId);
    if (!target) throw new AppError("Los capítulos por confirmar no pertenecen a esta creación.",400);
    const unit = target.progress.unit, range = contract.chapterRange;
    if (!range || unit.novelId !== contract.novelId || unit.order < range.from || unit.order > range.to) throw new AppError("El rango de capítulos a confirmar no es válido.",409);
    if (target.progress.committedContentHash) {
      const chapter = await tx.chapter.findFirst({where:{id:unit.chapterId,novelId:contract.novelId,order:unit.order},select:{content:true}});
      if (!chapter?.content || hashProductionContent(chapter.content) !== target.progress.committedContentHash) throw new AppError("El texto ha sido modificado, consulte la página del capítulo antes de confirmar.",409);
    }
    const released = await tx.chapterArtifactSyncCheckpoint.updateMany({
      where:{novelId:contract.novelId,chapterId:unit.chapterId,status:"running",sourceType:"production_kernel",
        ...UNKNOWN_MODEL_CLAIM_FILTER},
      data:{status:"ready"}});
    // Writing/review stages keep only the unit's activeStage (no durable model
    // checkpoint), so the chapter's own pending claim is the thing to confirm. A
    // prepare claim qualifies only when it left no prepare/reconcile checkpoint.
    const orphanPrepare = target.activeStage === "prepare" && released.count === 0
      && await isOrphanPrepareClaim(tx, contract.novelId, unit.chapterId);
    if (!released.count && !isUnconfirmedActiveStage(target.activeStage) && !orphanPrepare) {
      throw new AppError("Este capítulo no tiene pasos pendientes por confirmar.",400);
    }
    if (target.activeStage) {
      // The interrupted stage is re-entered from scratch, so its stale claim on the
      // unit goes with the released model claims; the stage result was never saved.
      const cleared = await tx.productionUnitRun.updateMany({where:{id:target.id,ownerKey:target.ownerKey,version:target.version},
        data:{activeStage:null,activeRequestKey:null,version:{increment:1}}});
      if (cleared.count !== 1) throw new AppError("El estado de recuperación del capítulo ha cambiado; actualice e inténtelo nuevamente.",409);
    }
  }
  // Unknown active requests are retained. A plain resume can only recover a durable
  // result, never clear a claim or retry it; releasing one requires the explicit
  // per-chapter confirmation handled above.
}

export async function cancelKernelProduction(contract: RunContract, tx: Prisma.TransactionClient) {
  const run = await tx.directorNextRun.findUniqueOrThrow({where:{id:contract.runId},select:{novelId:true}});
  if (run.novelId !== contract.novelId) throw new AppError("Las ejecuciones canceladas no pertenecen a este libro.",409);
  // The surrounding command transaction changes control status/version; all captured worker identities then fail.
  // A replaced book epoch cannot prevent cancellation of this old run; the newer run and manuscript remain untouched.
}
