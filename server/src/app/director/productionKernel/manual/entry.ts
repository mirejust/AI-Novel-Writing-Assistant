import {randomUUID} from "node:crypto";
import {setTimeout as wait} from "node:timers/promises";
import type {PrismaClient} from "@prisma/client";
import type {DirectorNextServices} from "../../../../modules/director";
import {readNovelDirectorIdentity} from "../../../../modules/novel/director-routing";
import {hashProductionContent} from "../../../../modules/production";
import type {PreparedChapter} from "../../../../modules/production";
import type {RunContract} from "../../../../modules/director";
import type {AuditReport} from "@ai-novel/shared/types/novel";
import {AppError} from "../../../../middleware/errorHandler";
import {resolveLLMClientOptions} from "../../../../llm/factory";
import {chapterRuntimeRequestSchema} from "../../../../services/novel/runtime/chapterRuntimeSchema";
import type {ChapterAcceptanceAssessmentResult} from "../../../../services/novel/runtime/ChapterAcceptanceAssessmentService";
import {resolveDirectorChapterBudget} from "../../../../services/settings/chapterBudget";
import {buildRuntimePackage} from "../../../../services/novel/runtime/chapterRuntimePackageBuilders";
import {openConflictService} from "../../../../services/state/OpenConflictService";
import {PlannerService} from "../../../../services/planner/PlannerService";
import {productionBatchOwnerKey} from "../execution/ownership";
import {productionKernelV2ChaptersEnabled} from "../batch/router";
import {readKernelPausedUnknownClaims} from "../readModel/unknownClaims";
import type {ManualChapterOperation, ManualChapterLaunchInput} from "./contract";
import {readManualChapterRequest} from "./contract";

interface ManualChapterEntryDependencies {
  db: PrismaClient;
  commands(): DirectorNextServices["http"]["commandService"];
  wake(): void;
  enabled?: () => boolean;
  readTokenLimit?: () => Promise<number>;
  resolveModel?: typeof resolveLLMClientOptions;
}

type SavedPause = {kind: "manual_recovery" | "replan" | "safety"; reason: string};

export function createManualChapterEntry(deps: ManualChapterEntryDependencies) {
  const source = (novelId: string) => `/lab/director/${encodeURIComponent(novelId)}`;
  async function handles(novelId: string): Promise<boolean> {
    if (!(deps.enabled ?? productionKernelV2ChaptersEnabled)()) return false;
    return (await readNovelDirectorIdentity(novelId, deps.db)).version === "v2";
  }
  async function start(novelId: string, chapterId: string, operation: ManualChapterOperation,
    input: Record<string, unknown>): Promise<string> {
    const identity = await readNovelDirectorIdentity(novelId, deps.db);
    if (identity.version !== "v2") throw new AppError("Opere desde la página de texto de la versión correspondiente de este libro.", 409);
    const [novel, chapter] = await Promise.all([
      deps.db.novel.findUniqueOrThrow({where: {id: novelId}, select: {title: true, description: true, estimatedChapterCount: true}}),
      deps.db.chapter.findFirst({where: {id: chapterId, novelId}, select: {id: true, order: true, content: true, updatedAt: true}}),
    ]);
    if (!chapter) throw new AppError("No se puede encontrar el capítulo correspondiente de este libro.", 404);
    if (operation === "write" && chapter.content?.trim()) throw new AppError("El texto principal de este capítulo ya existe; utilice la revisión o la reedición.", 409);
    if (operation !== "write" && !chapter.content?.trim()) throw new AppError("Guarde el texto de este capítulo antes de revisarlo o revisarlo.", 400);
    if (typeof input.content === "string" && input.content !== (chapter.content ?? "")) {
      throw new AppError("Guarde primero el texto actual y luego revíselo nuevamente.", 409);
    }
    if (Array.isArray(input.auditIssueIds) && input.auditIssueIds.length) {
      const count = await deps.db.auditIssue.count({where: {id: {in: [...new Set(input.auditIssueIds as string[])]}, report: {novelId, chapterId}, status: "open"}});
      if (count !== new Set(input.auditIssueIds).size) throw new AppError("La pregunta seleccionada ha cambiado; actualice los resultados de la revisión de este capítulo.", 409);
    }
    const {workflowTaskId: _oldTask, ...options} = chapterRuntimeRequestSchema.parse(input);
    const model = await (deps.resolveModel ?? resolveLLMClientOptions)(options.provider,
      {model: options.model, temperature: options.temperature, taskType: "writer"});
    const budget = deps.readTokenLimit
      ? { tokenLimit: await deps.readTokenLimit(), automatic: false }
      : await resolveDirectorChapterBudget();
    const launchInput: ManualChapterLaunchInput = {storyInput: novel.description?.trim() || novel.title,
      estimatedChapterCount: Math.max(novel.estimatedChapterCount ?? 1, chapter.order), worldMode: "skip", targetMode: "opening",
      executionRange: {from: chapter.order, to: chapter.order}, chapterTokenLimit: budget.tokenLimit,
      ...(budget.automatic ? { chapterBudgetAutomatic: true } : {}),
      provider: model.provider, model: model.model, temperature: options.temperature,
      manualChapter: {operation, chapterId, baseline: {content: chapter.content, updatedAt: chapter.updatedAt.toISOString()}, options}};
    const result = await deps.commands().execute({type: "open_run", novelId, driver: "auto", stepIdsInScope: ["chapter_batch"],
      launchInput, idempotencyKey: `manual-chapter:${randomUUID()}`});
    deps.wake();
    return result.runId;
  }
  async function result(novelId: string, chapterId: string, runId: string) {
    const row = await deps.db.productionUnitRun.findUnique({where: {ownerKey_chapterId: {ownerKey: productionBatchOwnerKey(runId), chapterId}}});
    if (!row || row.novelId !== novelId) throw new AppError("Los resultados de este capítulo aún no se han guardado. Verifique el progreso de la creación desde la página de texto.", 409);
    const progress = JSON.parse(row.progressJson), artifacts = JSON.parse(row.stageArtifactsJson);
    const chapter = await deps.db.chapter.findFirstOrThrow({where: {id: chapterId, novelId}, select: {content: true, generationState: true}});
    if (!progress.completed.includes("reconcile") || !progress.committedContentHash
      || hashProductionContent(chapter.content ?? "") !== progress.committedContentHash) {
      throw new AppError("El texto de este capítulo ha cambiado; revise la versión guardada actualmente.", 409);
    }
    const review = artifacts.stageData?.[progress.selected === "candidate" ? "verify" : "accept"] as ChapterAcceptanceAssessmentResult;
    const auditReports = JSON.parse(JSON.stringify(await deps.db.auditReport.findMany({where: {novelId, chapterId}, include: {issues: true}, orderBy: {createdAt: "desc"}}))) as AuditReport[];
    const savedRun = await deps.db.directorNextRun.findUniqueOrThrow({where: {id: runId}, select: {contractJson: true}});
    const contract = JSON.parse(savedRun.contractJson) as RunContract, manual = readManualChapterRequest(contract)!;
    const prepared = artifacts.prepared as PreparedChapter;
    const runtimePackage = buildRuntimePackage({novelId, chapterId, request: {...manual.options,
      provider: contract.launchInput!.provider as ManualChapterLaunchInput["manualChapter"]["options"]["provider"], model: contract.launchInput!.model},
      contextPackage: prepared.contextPackage, finalContent: chapter.content ?? "", auditResult: {score: review.score, auditReports},
      activeOpenConflicts: await openConflictService.listOpenConflicts(novelId, {beforeChapterOrder: progress.unit.order, includeCurrentChapter: true, limit: 8}),
      styleReview: {report: review.styleReviewReport ?? null, signalScan: review.styleSignalScan, autoRewritten: false, originalContent: null, finalContent: chapter.content ?? ""},
      acceptance: review.assessment, runId, plannerService: new PlannerService()});
    runtimePackage.draft.generationState = progress.selected === "candidate" ? "repaired" : "drafted";
    return {content: chapter.content ?? "", review: {...review, auditReports}, progress, prepared, runtimePackage};
  }
  async function waitForResult(novelId: string, chapterId: string, runId: string, signal?: AbortSignal) {
    for (;;) {
      signal?.throwIfAborted();
      const control = await deps.db.directorNextRunControl.findUniqueOrThrow({where: {runId}});
      if (control.status === "completed") return result(novelId, chapterId, runId);
      if (!["queued", "running"].includes(control.status)) {
        const pause = control.pauseJson ? JSON.parse(control.pauseJson) as SavedPause : null;
        const unknownClaims = pause?.kind === "manual_recovery" ? await readUnknownClaims(runId, novelId, pause) : null;
        const message = unknownClaims
          ? `Cap. ${unknownClaims.chapterOrder} Es necesario confirmar el resultado de un paso del capítulo. Dirígete al escritorio del director y confirma el paso antes de continuar.`
          : pause?.reason ?? control.failureReason ?? "La creación de este capítulo necesita procesamiento; regrese al banco de trabajo del libro para verificar.";
        throw new AppError(message, 409, {
          runId, pauseKind: pause?.kind ?? null, pause, unknownClaims,
          sourceRoute: source(novelId), sourceActionLabel: unknownClaims ? "Dirígete al escritorio del director y confirma según el capítulo." : "Abre el escritorio del director del libro."});
      }
      await wait(1000, undefined, {signal});
    }
  }
  async function readUnknownClaims(runId: string, novelId: string, pause: SavedPause) {
    try {
      const saved = await deps.db.directorNextRun.findUniqueOrThrow({where: {id: runId}, select: {contractJson: true}});
      const contract = JSON.parse(saved.contractJson) as RunContract;
      if (contract.novelId !== novelId) return null;
      return await readKernelPausedUnknownClaims(deps.db, contract, {status: "paused", pause});
    } catch {
      // The pause reason stays actionable even when saved progress cannot be projected.
      return null;
    }
  }
  return {handles, start, result, waitForResult};
}
