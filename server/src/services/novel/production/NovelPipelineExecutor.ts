import { manualChapterSyncService, MANUAL_CHAPTER_SYNC_TYPE } from "../chapterEditor/synchronization";
import { buildChapterArtifactContentHash } from "../runtime/artifactSync/ChapterArtifactContentVersion";
import { AsyncLocalStorage } from "node:async_hooks";
import {
  DIRECTOR_ISSUE_GOVERNANCE_VERSION,
  resolveChapterReviewRetryPolicy,
  type DirectorIssueAction,
  type DirectorIssueCode,
} from "@ai-novel/shared/types/directorIssue";
import { prisma } from "../../../db/prisma";
import { novelEventBus } from "../../../events/publisher";
import { runWithLlmUsageTracking } from "../../../llm/usageTracking";
import { hasConfirmedExecutionContract } from "./preparation";
import { buildDirectorCompletionProfile } from "@ai-novel/shared/types/directorCompletion";
import { ChapterRouteWindowService } from "../planning/ChapterRouteWindowService";
import { ChapterRuntimeCoordinator } from "../runtime/ChapterRuntimeCoordinator";
import { createPersistedChapterReviewRetryBudget, withChapterReviewRetryBudget, ReviewRetryPersistenceError } from "../runtime/acceptance";
import { CHAPTER_ARTIFACT_BOUNDARY_TYPE, ChapterArtifactSyncBoundaryError } from "../runtime/artifactSync";
import { isChapterEmptyContentError } from "../runtime/chapterEmptyContentError";
import { ChapterContentPersistenceError } from "../runtime/lifecycle";
import {
  logPipelineError,
  logPipelineInfo,
  logPipelineWarn,
  type PipelinePayload,
  type PipelineRunOptions,
} from "../novelCoreShared";
import { plannerService } from "../../planner/PlannerService";
import { applyChapterQualityClosure } from "./qualityClosure/ChapterQualityClosure";
import { recoverSavedChapterQuality, SavedChapterQualityRecoveryError } from "./qualityClosure/SavedChapterQualityRecovery";
import {assertDirectorPipelineOwner} from "../../../modules/novel/director-routing";
import { ChapterAutomaticAttemptService } from "./attempts";
import { isCurrentChapterProductionCompleted, isCurrentV2ChapterProductionCompleted } from "./completion";
import {
  beginChapterUsage,
  DIRECTOR_CHAPTER_PREFLIGHT_RESERVE_TOKENS,
  readChapterUsageCounters,
  pauseChapterBudget,
  chapterBudgetView,
  observeChapterUsage,
  finalizeChapterUsage,
} from "./usage";
import type {DirectorChapterBudgetStage} from "@ai-novel/shared/types/director/chapterBudget";
import {
  loadDirectorIssueTaskContext,
} from "../director/issues";
import {
  reportPipelineIssue,
  resolvePipelineRuntimeIssueCode,
} from "./issueGovernance/PipelineIssueGovernance";
import {
  buildPipelineCurrentItemLabel,
  buildPipelineStageProgress,
  parsePipelinePayload as parsePipelineJobPayload,
  stringifyPipelinePayload as stringifyPipelineJobPayload,
  type PipelineActiveStage,
} from "../pipelineJobState";

const PIPELINE_HEARTBEAT_INTERVAL_MS = 15000;

class PipelineIssueAppliedError extends Error {
  constructor(
    message: string,
    readonly action: Exclude<DirectorIssueAction, "auto_retry">,
  ) {
    super(message);
    this.name = "PipelineIssueAppliedError";
  }
}

class PipelineIssueFailure extends Error {
  constructor(
    message: string,
    readonly issueCode: DirectorIssueCode,
    readonly stage: string,
    readonly chapterId?: string,
    readonly chapterOrder?: number,
  ) {
    super(message);
    this.name = "PipelineIssueFailure";
  }
}

class PipelineExecutionLeaseLostError extends Error {
  constructor() {
    super("PIPELINE_EXECUTION_LEASE_LOST");
    this.name = "PipelineExecutionLeaseLostError";
  }
}

function clampPipelineMaxRetries(value: number | null | undefined): number {
  return Math.max(0, Math.min(value ?? 1, 1));
}

function buildEmptyChapterDetail(chapter: { order: number; title: string }): string {
  return `Cap.${chapter.order}capítulo"${chapter.title}"Error al generar texto: el modelo no ha regresado para guardar el texto y se ha pausado para continuar.`;
}

export class NovelPipelineExecutor {
  private readonly executionOwnerStore = new AsyncLocalStorage<string | null>();

  constructor(
    private readonly chapterRuntimeCoordinator = new ChapterRuntimeCoordinator(),
    private readonly automaticAttempts = new ChapterAutomaticAttemptService(),
    private readonly assertOwner = assertDirectorPipelineOwner,
  ) {}

  private async ensurePipelineNotCancelled(jobId: string): Promise<void> {
    const executionOwner = this.executionOwnerStore.getStore();
    const job = await prisma.generationJob.findUnique({
      where: { id: jobId },
      select: {
        status: true,
        pendingManualRecovery: true,
        cancelRequestedAt: true,
        executionOwner: true,
        executionLeaseExpiresAt: true,
      },
    });
    if (!job || job.status === "cancelled" || job.cancelRequestedAt) {
      throw new Error("PIPELINE_CANCELLED");
    }
    if (
      executionOwner
      && (
        job.pendingManualRecovery
        || job.executionOwner !== executionOwner
        || !job.executionLeaseExpiresAt
        || job.executionLeaseExpiresAt.getTime() <= Date.now()
      )
    ) {
      throw new PipelineExecutionLeaseLostError();
    }
  }

  private async updateJobSafe(jobId: string, data: {
    status?: "queued" | "running" | "succeeded" | "failed" | "cancelled";
    progress?: number;
    completedCount?: number;
    totalCount?: number;
    endOrder?: number;
    retryCount?: number;
    pendingManualRecovery?: boolean;
    heartbeatAt?: Date | null;
    currentStage?: string | null;
    currentItemKey?: string | null;
    currentItemLabel?: string | null;
    cancelRequestedAt?: Date | null;
    error?: string | null;
    startedAt?: Date | null;
    finishedAt?: Date | null;
    payload?: string | null;
  }, writeMode: "runnable" | "cancelled" = "runnable") {
    const executionOwner = this.executionOwnerStore.getStore();
    try {
      if (executionOwner) {
        const updated = await prisma.generationJob.updateMany({
          where: {
            id: jobId,
            executionOwner,
            executionLeaseExpiresAt: { gt: new Date() },
            ...(writeMode === "runnable"
              ? {
                  status: { in: ["queued", "running"] as const },
                  pendingManualRecovery: false,
                  cancelRequestedAt: null,
                }
              : {
                  OR: [
                    { status: "cancelled" as const },
                    { cancelRequestedAt: { not: null } },
                  ],
                }),
          },
          data,
        });
        if (updated.count !== 1) throw new PipelineExecutionLeaseLostError();
      } else {
        await prisma.generationJob.update({ where: { id: jobId }, data });
      }
    } catch (error) {
      if (error instanceof PipelineExecutionLeaseLostError) throw error;
      // 后台任务状态更新失败不应影响主服务稳定
    }
  }

  private async updateJobRequired(
    jobId: string,
    data: Parameters<NovelPipelineExecutor["updateJobSafe"]>[1],
  ): Promise<void> {
    const executionOwner = this.executionOwnerStore.getStore();
    if (!executionOwner) {
      await prisma.generationJob.update({ where: { id: jobId }, data });
      return;
    }
    const updated = await prisma.generationJob.updateMany({
      where: {
        id: jobId,
        executionOwner,
        executionLeaseExpiresAt: { gt: new Date() },
        status: { in: ["queued", "running"] },
        pendingManualRecovery: false,
        cancelRequestedAt: null,
      },
      data,
    });
    if (updated.count !== 1) throw new PipelineExecutionLeaseLostError();
  }

  private stringifyPipelinePayload(input: PipelinePayload) {
    return stringifyPipelineJobPayload(input);
  }

  private parsePipelinePayload(payload: string | null | undefined) {
    return parsePipelineJobPayload(payload);
  }

  execute(jobId: string, novelId: string, options: PipelineRunOptions, executionOwner?: string): Promise<void> {
    return this.executionOwnerStore.run(
      executionOwner?.trim() || null,
      () => this.executeWithOwnership(jobId, novelId, options),
    );
  }

  private async executeWithOwnership(jobId: string, novelId: string, options: PipelineRunOptions) {
    const maxRetries = clampPipelineMaxRetries(options.maxRetries);
    const qualityThreshold = options.qualityThreshold ?? 75;
    const existingJob = await prisma.generationJob.findUnique({
      where: { id: jobId },
      select: {
        startedAt: true,
        completedCount: true,
        totalCount: true,
        retryCount: true,
        payload: true,
      },
    });
    const persistedPayload = this.parsePipelinePayload(existingJob?.payload);
    const runtimePayload: PipelinePayload = {
      provider: persistedPayload.provider ?? options.provider ?? "deepseek",
      model: persistedPayload.model ?? options.model ?? "",
      temperature: persistedPayload.temperature ?? options.temperature ?? 0.8,
      controlPolicy: persistedPayload.controlPolicy ?? options.controlPolicy,
      issueGovernanceVersion: persistedPayload.issueGovernanceVersion ?? options.issueGovernanceVersion,
      issuePolicySnapshot: persistedPayload.issuePolicySnapshot ?? options.issuePolicySnapshot,
      workflowTaskId: persistedPayload.workflowTaskId ?? options.workflowTaskId,
      directorNext: persistedPayload.directorNext ?? options.directorNext,
      taskStyleProfileId: persistedPayload.taskStyleProfileId ?? options.taskStyleProfileId,
      // Missing historical snapshots stay missing; never read new defaults on resume.
      styleSignalPolicy: persistedPayload.styleSignalPolicy,
      maxRetries: clampPipelineMaxRetries(persistedPayload.maxRetries ?? options.maxRetries),
      runMode: persistedPayload.runMode ?? options.runMode ?? "fast",
      autoReview: persistedPayload.autoReview ?? options.autoReview ?? true,
      autoRepair: persistedPayload.autoRepair ?? options.autoRepair ?? true,
      skipCompleted: persistedPayload.skipCompleted ?? options.skipCompleted ?? true,
      qualityThreshold: persistedPayload.qualityThreshold ?? options.qualityThreshold,
      repairMode: persistedPayload.repairMode ?? options.repairMode ?? "light_repair",
      artifactSyncMode: persistedPayload.artifactSyncMode ?? options.artifactSyncMode ?? "adaptive",
    };
    await this.assertOwner(novelId, runtimePayload);
    const checkCancelled = async () => {
      await this.ensurePipelineNotCancelled(jobId);
      await this.assertOwner(novelId, runtimePayload);
    };
    const directorTelemetryTask = runtimePayload.workflowTaskId
      ? await prisma.novelWorkflowTask.findUnique({
        where: { id: runtimePayload.workflowTaskId },
        select: {
          lane: true,
          directorRun: {
            select: { id: true },
          },
        },
      }).catch(() => null)
      : null;
    const shouldRecordDirectorTelemetry = directorTelemetryTask?.lane === "auto_director";
    const snapshottedIssueGovernance = runtimePayload.issueGovernanceVersion === DIRECTOR_ISSUE_GOVERNANCE_VERSION
      && runtimePayload.issuePolicySnapshot
      ? {
        novelId,
        issueGovernanceVersion: DIRECTOR_ISSUE_GOVERNANCE_VERSION,
        policy: runtimePayload.issuePolicySnapshot,
        runMode: runtimePayload.controlPolicy?.advanceMode ?? runtimePayload.runMode,
        policySource: "task_snapshot" as const,
      }
      : null;
    const issueGovernance = snapshottedIssueGovernance ?? (shouldRecordDirectorTelemetry
      ? await loadDirectorIssueTaskContext(runtimePayload.workflowTaskId)
      : null);
    let totalRetryCount = Math.max(existingJob?.retryCount ?? 0, 0);
    const qualityAlertDetails = [...(persistedPayload.qualityAlertDetails ?? [])];
    const replanAlertDetails = [...(persistedPayload.replanAlertDetails ?? [])];
    const recoverableRepairDetails = [...(persistedPayload.recoverableRepairDetails ?? [])];
    const applyGovernedIssue = async (input: {
      issueCode: DirectorIssueCode;
      stage: string;
      summary: string;
      evidence?: string;
      chapterId?: string;
      chapterOrder?: number;
      attempt: number;
      onRetry?: () => Promise<void>;
    }): Promise<DirectorIssueAction | null> => {
      let appliedAction: DirectorIssueAction | null = null;
      const result = await reportPipelineIssue({
        governance: issueGovernance,
        workflowTaskId: runtimePayload.workflowTaskId,
        novelId,
        jobId,
        issueCode: input.issueCode,
        stage: input.stage,
        summary: input.summary,
        evidence: input.evidence,
        chapterId: input.chapterId,
        chapterOrder: input.chapterOrder,
        attempt: input.attempt,
        hasUsableOutput: false,
        provider: runtimePayload.provider,
        model: runtimePayload.model,
        temperature: runtimePayload.temperature,
        applyAction: async (decision) => {
          runtimePayload.directorNext?.decisions.push({...decision, ...(input.chapterOrder ? {chapterOrder: input.chapterOrder} : {})});
          appliedAction = decision.action;
          if (decision.action === "auto_retry") {
            if (!input.onRetry) {
              throw new Error("La política de problemas requiere un reintento automático, pero el límite de ejecución actual no tiene una entrada de reintento segura.");
            }
            await input.onRetry();
            return;
          }
          const payload = this.stringifyPipelinePayload({
            ...runtimePayload,
            qualityAlertDetails,
            replanAlertDetails,
            recoverableRepairDetails,
          });
          if (decision.action === "pause_for_manual") {
            await this.updateJobRequired(jobId, {
              status: "queued",
              pendingManualRecovery: true,
              error: input.summary,
              heartbeatAt: null,
              currentStage: "queued",
              currentItemKey: null,
              currentItemLabel: null,
              cancelRequestedAt: null,
              finishedAt: null,
              payload,
            });
            return;
          }
          await this.updateJobRequired(jobId, {
            status: "failed",
            pendingManualRecovery: false,
            error: input.summary,
            heartbeatAt: null,
            currentStage: null,
            currentItemKey: null,
            currentItemLabel: null,
            cancelRequestedAt: null,
            finishedAt: new Date(),
            payload,
          });
        },
      });
      return result ? appliedAction ?? result.decision.action : null;
    };

    try {
      await runWithLlmUsageTracking({
        generationJobId: jobId,
        workflowTaskId: runtimePayload.workflowTaskId,
        directorTelemetry: shouldRecordDirectorTelemetry,
        novelId,
        directorNextRunId: runtimePayload.directorNext?.runId ?? null,
        directorRunId: shouldRecordDirectorTelemetry
          ? directorTelemetryTask?.directorRun?.id ?? runtimePayload.workflowTaskId ?? null
          : null,
      }, async () => {
        await checkCancelled();
        await this.updateJobSafe(jobId, {
          status: "running",
          pendingManualRecovery: false,
          startedAt: existingJob?.startedAt ?? new Date(),
          heartbeatAt: new Date(),
          currentStage: "generating_chapters",
        });
        logPipelineInfo("La tarea comienza a ejecutarse", {
          jobId,
          novelId,
          range: `${options.startOrder}-${options.endOrder}`,
          maxRetries,
        });

        if (options.startOrder > 1) await manualChapterSyncService.ensurePrevious(novelId, options.startOrder, checkCancelled);
        const [novel, chapterCandidates] = await Promise.all([
          prisma.novel.findUnique({ where: { id: novelId } }),
          prisma.chapter.findMany({
            where: {
              novelId,
              order: { gte: options.startOrder, lte: options.endOrder },
            },
            orderBy: { order: "asc" },
            include: {
              artifactSyncCheckpoints: {
                where: { OR: [{artifactType: CHAPTER_ARTIFACT_BOUNDARY_TYPE, status: "succeeded"}, {artifactType: MANUAL_CHAPTER_SYNC_TYPE}] },
                select: { contentHash: true, metadataJson: true, artifactType: true },
                orderBy: { updatedAt: "desc" },
              },
            },
          }),
        ]);
        const manuallyEditedChapterIds = new Set<string>();
        for (const chapter of chapterCandidates) {
          const edited = chapter.artifactSyncCheckpoints.some(row => row.artifactType === MANUAL_CHAPTER_SYNC_TYPE
            && row.contentHash === buildChapterArtifactContentHash(chapter.content ?? ""));
          if (edited) manuallyEditedChapterIds.add(chapter.id);
          const terminal = chapter.generationState === "approved" || chapter.generationState === "published" || chapter.chapterStatus === "completed";
          if (!chapter.content?.trim() || isCurrentV2ChapterProductionCompleted(chapter) || (!edited && !terminal)) continue;
          await checkCancelled();
          await this.updateJobSafe(jobId, {currentStage: "reviewing", currentItemKey: chapter.id,
            currentItemLabel: "Sincronizando el" + chapter.order + "Información revisada del capítulo"});
          try { await manualChapterSyncService.ensureCurrent(novelId, chapter.id, checkCancelled); }
          catch (error) {
            if (error instanceof PipelineExecutionLeaseLostError || (error instanceof Error && error.message === "PIPELINE_CANCELLED")) throw error;
            if (runtimePayload.directorNext && error instanceof ChapterArtifactSyncBoundaryError && error.result.characterReviewId) {
              runtimePayload.directorNext.pendingCharacterReviewId = error.result.characterReviewId;
              await this.updateJobRequired(jobId, {status: "queued", pendingManualRecovery: true,
                error: error.message, payload: this.stringifyPipelinePayload(runtimePayload)});
              throw new PipelineIssueAppliedError(error.message, "pause_for_manual");
            }
            throw new PipelineIssueFailure(error instanceof Error ? error.message : "Error al sincronizar los datos del texto revisado.",
              "runtime.data_integrity", "chapter_artifact_sync", chapter.id, chapter.order);
          }
          const refreshed = await prisma.chapter.findFirstOrThrow({where: {id: chapter.id, novelId}, include: {
            artifactSyncCheckpoints: {where: {artifactType: CHAPTER_ARTIFACT_BOUNDARY_TYPE, status: "succeeded"},
              select: {contentHash: true, metadataJson: true, artifactType: true}, orderBy: {updatedAt: "desc"}, take: 6},
          }});
          Object.assign(chapter, refreshed);
        }
        const chapters = options.skipCompleted
          ? chapterCandidates.filter((chapter) => !(runtimePayload.directorNext ? isCurrentV2ChapterProductionCompleted(chapter) : isCurrentChapterProductionCompleted(chapter)))
          : chapterCandidates;
        if (!novel) {
          throw new Error("Error en la ejecución de la tarea: la novela o el capítulo no existe");
        }

        logPipelineInfo("Carga de tarea completada", {
          jobId,
          novelId,
          title: novel.title,
          chapterCount: chapters.length,
        });

        const isAutopilotMode = Boolean(runtimePayload.directorNext)
          || runtimePayload.controlPolicy?.advanceMode === "full_book_autopilot";
        const autopilotTargetEndOrder = isAutopilotMode
          ? runtimePayload.directorNext ? options.endOrder : Math.max(options.endOrder, novel.estimatedChapterCount ?? options.endOrder)
          : options.endOrder;
        let totalCount = runtimePayload.directorNext
          ? options.endOrder - options.startOrder + 1
          : isAutopilotMode
          ? Math.max(1, autopilotTargetEndOrder - options.startOrder + 1)
          : Math.max(existingJob?.totalCount ?? 0, chapterCandidates.length, 1);
        const storedCompleted = runtimePayload.directorNext && runtimePayload.skipCompleted
          ? 0
          : Math.min(Math.max(existingJob?.completedCount ?? 0, 0), totalCount);
        const filteredCompletedCount = runtimePayload.skipCompleted
          ? chapterCandidates.length - chapters.length
          : 0;
        const remainingStartIndex = Math.min(
          Math.max(0, storedCompleted - filteredCompletedCount),
          chapters.length,
        );
        let completed = Math.max(storedCompleted, filteredCompletedCount);
        const chaptersToProcess = chapters.slice(remainingStartIndex);
        const closedOrders = new Set(chapterCandidates.filter(chapter => runtimePayload.directorNext ? isCurrentV2ChapterProductionCompleted(chapter) : isCurrentChapterProductionCompleted(chapter)).map(chapter => chapter.order));
        let pendingManualRecovery = false;
        let pendingManualRecoveryReason = "Los capítulos requieren confirmación manual y la generación posterior se ha suspendido.";

        if (runtimePayload.directorNext) {
          await this.updateJobRequired(jobId, {
            totalCount, completedCount: completed,
            progress: Number((completed / totalCount).toFixed(4)),
          });
        }

        const routeWindowService = new ChapterRouteWindowService();
        const prepareRollingChapter = async (order: number, previous?: { id: string; order: number }, cached?: (typeof chapterCandidates)[number]) => {
          await checkCancelled();
          try {
            await routeWindowService.ensureRouteWindow(novelId, order, {
              min: 3, target: 5,
              provider: runtimePayload.provider, model: runtimePayload.model, temperature: runtimePayload.temperature,
              taskId: runtimePayload.workflowTaskId ?? jobId,
              completionProfile: buildDirectorCompletionProfile(novel.estimatedChapterCount ?? autopilotTargetEndOrder),
            });
          } catch (error) {
            throw new PipelineIssueFailure(`La planificación continua no logró preparar el primer ${order} Capítulo, el texto guardado se conservará; compruébelo antes de continuar.`,
              "planning.route_window_unavailable", "route_window", previous?.id, previous?.order);
          }
          if (cached) return cached;
          const prepared = await prisma.chapter.findFirst({
            where: { novelId, order }, orderBy: { order: "asc" },
            include: { artifactSyncCheckpoints: {
              where: { artifactType: CHAPTER_ARTIFACT_BOUNDARY_TYPE, status: "succeeded" },
              select: { contentHash: true, metadataJson: true, artifactType: true }, orderBy: { updatedAt: "desc" }, take: 6,
            } },
          });
          if (!prepared) {
            throw new PipelineIssueFailure(`La planificación continua no logró preparar el primer ${order} Capítulo, el texto guardado se conservará; compruébelo antes de continuar.`,
              "planning.route_window_unavailable", "route_window", previous?.id, previous?.order);
          }
          return prepared;
        };
        if (isAutopilotMode && runtimePayload.directorNext) {
          let nextOrder = options.startOrder;
          while (closedOrders.has(nextOrder)) nextOrder++;
          if (nextOrder <= autopilotTargetEndOrder && chaptersToProcess[0]?.order !== nextOrder) {
            chaptersToProcess.unshift(await prepareRollingChapter(nextOrder));
          }
        }
        if (isAutopilotMode) {
          await this.updateJobSafe(jobId, {
            endOrder: autopilotTargetEndOrder,
            totalCount,
          });
        }

        for (let chapterIndex = 0; chapterIndex < chaptersToProcess.length; chapterIndex++) {
          const chapter = chaptersToProcess[chapterIndex];
          await checkCancelled();

          let chapterResult: Awaited<ReturnType<ChapterRuntimeCoordinator["runPipelineChapter"]>> | null = null;
          const savedUsage = runtimePayload.directorNext?.chapterUsage?.find(row => row.chapterId === chapter.id);
          const manualRevision = manuallyEditedChapterIds.has(chapter.id);
          const recoveringSavedQuality = savedUsage?.endJobTokens !== undefined || manualRevision;
          if (recoveringSavedQuality) {
            try {
              if (savedUsage?.endJobTokens !== undefined) {
                if (savedUsage.chapterOrder !== chapter.order) throw new Error("La identidad del punto de control de uso del capítulo es inconsistente.");
                const usage = await prisma.generationJob.findUniqueOrThrow({ where: { id: jobId }, select: { totalTokens: true } });
                observeChapterUsage(runtimePayload.directorNext!, chapter.id, usage.totalTokens);
              }
              chapterResult = await recoverSavedChapterQuality(novelId, chapter, {manualRevision, provider: runtimePayload.provider, model: runtimePayload.model, temperature: runtimePayload.temperature});
            } catch (error) {
              throw new PipelineIssueFailure(error instanceof Error ? error.message : "No se puede verificar el progreso al guardar el capítulo.",
                error instanceof SavedChapterQualityRecoveryError ? error.issueCode : "runtime.data_integrity",
                "chapter_usage", chapter.id, chapter.order);
            }
          }

          const checkChapterBudget = async (closed = false, reserveTokens = 0, stage: DirectorChapterBudgetStage | null = null) => {
            if (!runtimePayload.directorNext) return;
            const usage = await readChapterUsageCounters(jobId);
            let initialized: boolean;
            let observed: ReturnType<typeof observeChapterUsage>;
            try {
              initialized = beginChapterUsage(runtimePayload.directorNext, chapter.id, chapter.order, usage.job, usage.batch);
              observed = closed
                ? finalizeChapterUsage(runtimePayload.directorNext, chapter.id, usage.job, usage.batch)
                : observeChapterUsage(runtimePayload.directorNext, chapter.id, usage.job, usage.batch);
            } catch (error) {
              throw new PipelineIssueFailure(error instanceof Error ? error.message : "El registro de uso del capítulo es anormal y no se puede seguir generando.",
                "runtime.data_integrity", "chapter_usage", chapter.id, chapter.order);
            }
            const row = runtimePayload.directorNext.chapterUsage!.find(item => item.chapterId === chapter.id)!;
            const normalizedReserve = Math.max(0, Math.floor(reserveTokens));
            const previousTopUp = row.automaticTopUpTokens;
            const paused = pauseChapterBudget(row, normalizedReserve, stage,
              runtimePayload.directorNext.chapterBudgetAutomatic === true && row.tokenLimit === runtimePayload.directorNext.chapterTokenLimit);
            if (initialized || closed || paused || row.automaticTopUpTokens !== previousTopUp) {
              try {
                await this.updateJobRequired(jobId, {
                  ...(closed ? { completedCount: completed + 1, progress: Number(((completed + 1) / totalCount).toFixed(4)) } : {}),
                  payload: this.stringifyPipelinePayload({ ...runtimePayload, qualityAlertDetails, replanAlertDetails, recoverableRepairDetails }),
                });
              } catch (error) {
                if (error instanceof PipelineExecutionLeaseLostError) throw error;
                throw new PipelineIssueFailure("El punto de control de uso del capítulo no pudo confirmar que se guardó, la generación se detuvo.",
                  "runtime.persistence_failed", "chapter_usage", chapter.id, chapter.order);
              }
            }
            if (paused) {
              const budget = chapterBudgetView(jobId, row);
              const unit = budget.metric === "uncached_tokens_v1" ? "Fichas válidas" : "Tokens";
              const message = observed.exceeded
                ? `Cap.${chapter.order}El uso acumulado de IA en este capítulo alcanza ${budget.usedTokens} ${unit}, el límite superior de este capítulo ${budget.tokenLimit},${closed ? "El texto ha sido guardado," : ""}Ajuste la cantidad de este capítulo desde el escritorio del director antes de continuar.`
                : `Cap.${chapter.order}El capítulo se utiliza actualmente. ${budget.usedTokens} ${unit}, reservado para el siguiente paso ${normalizedReserve} Después de los Tokens, estará cerca del límite superior de este capítulo. ${budget.tokenLimit},${closed ? "El texto ha sido guardado," : ""}Ajuste la cantidad de este capítulo desde el escritorio del director antes de continuar.`;
              throw new PipelineIssueFailure(message,
                "runtime.token_budget_exceeded", "chapter_usage", chapter.id, chapter.order);
            }
          };
          if (!recoveringSavedQuality) await checkChapterBudget();

          let shouldStopAfterCurrentChapter = false;
          let chapterStopAction: "pause_for_manual" | "fail_task" | null = null;
          const currentItemLabel = buildPipelineCurrentItemLabel({
            completedCount: completed,
            totalCount,
            chapterOrder: chapter.order,
            title: chapter.title,
          });
          let activeStage: PipelineActiveStage = "generating_chapters";
          const applyChapterStage = async (stage: PipelineActiveStage) => {
            activeStage = stage;
            await this.updateJobSafe(jobId, {
              heartbeatAt: new Date(),
              currentStage: stage,
              currentItemKey: chapter.id,
              currentItemLabel,
              progress: buildPipelineStageProgress({
                completedCount: completed,
                totalCount,
                stage,
              }),
            });
          };

          await applyChapterStage(recoveringSavedQuality ? "reviewing" : "generating_chapters");
          logPipelineInfo("Empezar a trabajar en un capítulo.", {
            jobId,
            chapterId: chapter.id,
            order: chapter.order,
            hasDraft: Boolean((chapter.content ?? "").trim()),
          });

          const heartbeatTimer = setInterval(() => {
            void this.updateJobSafe(jobId, {
              heartbeatAt: new Date(),
              currentStage: activeStage,
              currentItemKey: chapter.id,
              currentItemLabel,
              progress: buildPipelineStageProgress({
                completedCount: completed,
                totalCount,
                stage: activeStage,
              }),
            }).catch(() => undefined);
          }, PIPELINE_HEARTBEAT_INTERVAL_MS);
          heartbeatTimer.unref?.();

          const chapterRetryBudget = Math.min(runtimePayload.maxRetries ?? maxRetries,
            issueGovernance?.policy.maxAutomaticRetries ?? maxRetries);
          let chapterRetryCountUsed = 0;
          let previouslyConsumed = 0;
          const claimAttempt = async (kind: "quality_repair" | "runtime_retry") => {
            await checkCancelled();
            if (chapterRetryCountUsed >= chapterRetryBudget) return false;
            const claimed = await this.automaticAttempts.claim(jobId, chapter.id, kind);
            chapterRetryCountUsed = 1;
            if (claimed) {
              await this.updateJobRequired(jobId, { retryCount: totalRetryCount + 1 });
            }
            return claimed;
          };
          try {
            previouslyConsumed = chapterRetryCountUsed = await this.automaticAttempts.used(jobId, chapter.id);
            const reviewRetryBudget = createPersistedChapterReviewRetryBudget({ novelId, chapterId: chapter.id,
              executionId: jobId, policy: resolveChapterReviewRetryPolicy(issueGovernance?.policy),
              beforeRequest: async () => { await checkCancelled(); await checkChapterBudget(false, DIRECTOR_CHAPTER_PREFLIGHT_RESERVE_TOKENS, "review"); } });
            while (!chapterResult) {
              try {
                await checkCancelled();
                await checkChapterBudget();
                chapterResult = await withChapterReviewRetryBudget(reviewRetryBudget, () => this.chapterRuntimeCoordinator.runPipelineChapter(
                  novelId,
                  chapter.id,
                  {
                    provider: runtimePayload.provider,
                    model: runtimePayload.model,
                    temperature: runtimePayload.temperature,
                    workflowTaskId: runtimePayload.workflowTaskId,
                    taskStyleProfileId: runtimePayload.taskStyleProfileId,
                    styleSignalPolicy: runtimePayload.styleSignalPolicy,
                    controlPolicy: runtimePayload.controlPolicy,
                    maxRetries: Math.max(0, chapterRetryBudget - chapterRetryCountUsed),
                    autoReview: runtimePayload.autoReview,
                    autoRepair: runtimePayload.autoRepair,
                    qualityThreshold,
                    repairMode: runtimePayload.repairMode,
                    artifactSyncMode: runtimePayload.artifactSyncMode,
                    ...(runtimePayload.directorNext ? {artifactSyncPolicy: "director_v2" as const, finalizedResultScope: jobId, directorRunId: runtimePayload.directorNext.runId} : {}),
                  },
                  {
                  onCheckCancelled: checkCancelled,
                  onCheckBudget: (reserveTokens = DIRECTOR_CHAPTER_PREFLIGHT_RESERVE_TOKENS, stage) => checkChapterBudget(false, reserveTokens, stage),
                  onStageChange: async (stage) => {
                    await applyChapterStage(stage);
                  },
                  onRetryConsumed: () => claimAttempt("quality_repair"),
                  onEmptyContent: async (event) => {
                    const willRetry = event.willRetry || (isAutopilotMode && chapterRetryCountUsed < chapterRetryBudget);
                    const detail = buildEmptyChapterDetail(chapter);
                    const meta = {
                      jobId,
                      workflowTaskId: runtimePayload.workflowTaskId,
                      novelId,
                      chapterId: chapter.id,
                      chapterOrder: chapter.order,
                      provider: runtimePayload.provider,
                      model: runtimePayload.model,
                      runMode: runtimePayload.runMode,
                      emptyAttempt: event.attempt,
                      willRetry,
                      contentLength: event.contentLength,
                      rawContentLength: event.rawContentLength,
                      source: event.error.details.source,
                    };
                    if (willRetry) {
                      logPipelineWarn("La generación del capítulo no devolvió el texto, reintentando el capítulo actual", meta);
                      return;
                    }
                    if (!qualityAlertDetails.includes(detail)) {
                      qualityAlertDetails.push(detail);
                    }
                    logPipelineError("La generación de capítulos continúa sin volver al texto. Prepárese para volver a intentar automáticamente el capítulo actual.", meta);
                  },
                  },
                ));
                break;
              } catch (error) {
                if (error instanceof ReviewRetryPersistenceError) {
                  throw new PipelineIssueFailure(error.message, "runtime.data_integrity", "chapter_review", chapter.id, chapter.order);
                }
                if (runtimePayload.directorNext && error instanceof ChapterArtifactSyncBoundaryError && error.result.characterReviewId) {
                  await checkCancelled();
                  runtimePayload.directorNext.pendingCharacterReviewId = error.result.characterReviewId;
                  await this.updateJobRequired(jobId, {status: "queued", pendingManualRecovery: true,
                    error: error.message, payload: this.stringifyPipelinePayload(runtimePayload)});
                  throw new PipelineIssueAppliedError(error.message, "pause_for_manual");
                }
                if (runtimePayload.directorNext && error instanceof ChapterArtifactSyncBoundaryError) {
                  throw new PipelineIssueFailure(error.message, "runtime.data_integrity", "chapter_artifact_sync", chapter.id, chapter.order);
                }
                if (error instanceof PipelineIssueFailure && error.stage === "chapter_usage") throw error;
                if (error instanceof PipelineExecutionLeaseLostError) {
                  throw error;
                }
                if (error instanceof Error && error.message === "PIPELINE_CANCELLED") {
                  throw error;
                }
                const message = error instanceof Error ? error.message : `Cap.${chapter.order}Error al ejecutar el capítulo.`;
                const canOfferGovernedRetry = !(error instanceof ChapterContentPersistenceError)
                  && isAutopilotMode
                  && chapterRetryCountUsed < chapterRetryBudget;
                const action = await applyGovernedIssue({
                  issueCode: error instanceof ChapterContentPersistenceError
                    ? "runtime.persistence_failed"
                    : isChapterEmptyContentError(error)
                      ? "generation.empty_content"
                      : resolvePipelineRuntimeIssueCode(error),
                  stage: error instanceof ChapterContentPersistenceError
                    ? "chapter_persistence"
                    : "chapter_generation",
                  summary: error instanceof ChapterContentPersistenceError
                    ? `Cap.${chapter.order}No se puede confirmar que el texto del capítulo se haya guardado y se ha detenido el reintento automático.`
                    : message,
                  evidence: error instanceof Error ? error.stack : undefined,
                  chapterId: chapter.id,
                  chapterOrder: chapter.order,
                  attempt: canOfferGovernedRetry
                    ? chapterRetryCountUsed
                    : issueGovernance?.policy.maxAutomaticRetries ?? chapterRetryCountUsed,
                  onRetry: canOfferGovernedRetry
                    ? async () => {
                        if (!(await claimAttempt("runtime_retry"))) {
                          throw new Error("Se ha utilizado la cuota de procesamiento automático para este capítulo. Continúe el procesamiento desde la ubicación guardada.");
                        }
                        const retryLabel = `Cap.${chapter.order}El capítulo encontró un problema temporal, la IA lo soluciona automáticamente y lo intenta nuevamente (${chapterRetryCountUsed}/${chapterRetryBudget})`;
                        await this.updateJobRequired(jobId, {
                          heartbeatAt: new Date(),
                          currentStage: "generating_chapters",
                          currentItemKey: chapter.id,
                          currentItemLabel: retryLabel,
                        });
                      }
                    : undefined,
                });
                if (action && action !== "auto_retry") {
                  throw new PipelineIssueAppliedError(message, action);
                }
                const canRetry = action === "auto_retry"
                  || (
                    !issueGovernance
                    && !(error instanceof ChapterContentPersistenceError)
                    && isAutopilotMode
                    && chapterRetryCountUsed < chapterRetryBudget
                  );
                if (!canRetry) {
                  throw error;
                }
                if (!action) {
                  if (!(await claimAttempt("runtime_retry"))) throw error;
                }
                const retryLabel = `Cap.${chapter.order}El capítulo encontró un problema temporal, la IA lo soluciona automáticamente y lo intenta nuevamente (${chapterRetryCountUsed}/${chapterRetryBudget})`;
                if (!action) {
                  await this.updateJobSafe(jobId, {
                    heartbeatAt: new Date(),
                    currentStage: "generating_chapters",
                    currentItemKey: chapter.id,
                    currentItemLabel: retryLabel,
                  });
                }
                logPipelineWarn("No se pudo ejecutar el capítulo, vuelva a intentar automáticamente el capítulo actual", {
                  jobId,
                  novelId,
                  chapterId: chapter.id,
                  chapterOrder: chapter.order,
                  retry: chapterRetryCountUsed,
                  error: error instanceof Error ? error.message : String(error),
                });
              }
            }
          } finally {
            clearInterval(heartbeatTimer);
          }
          if (!chapterResult) {
            throw new Error(`Cap.${chapter.order}El capítulo no pudo producir resultados utilizables después de los reintentos automáticos.`);
          }

          totalRetryCount += Math.max(0, chapterRetryCountUsed - previouslyConsumed);
          const closure = await applyChapterQualityClosure({
            governance: issueGovernance,
            workflowTaskId: runtimePayload.workflowTaskId,
            novelId,
            jobId,
            chapter: { id: chapter.id, order: chapter.order },
            chapterResult,
            authorRevision: manualRevision,
            qualityThreshold,
            runtimePayload,
            qualityAlertDetails,
            replanAlertDetails,
            recoverableRepairDetails,
            runLocalReplan: async (replan) => plannerService.replan(novelId, {
              ...replan,
              ...(runtimePayload.directorNext && await hasConfirmedExecutionContract(prisma, novelId, runtimePayload.directorNext.runId, chapter.id)
                ? {preserveExecutionContractRange: {startOrder: options.startOrder, endOrder: options.endOrder}} : {}),
              provider: runtimePayload.provider,
              model: runtimePayload.model,
              temperature: runtimePayload.temperature,
            }),
            onIssueDecision: decision => {runtimePayload.directorNext?.decisions.push({...decision, chapterOrder: chapter.order});},
            // Persist local quality facts before freezing/pausing, while future
            // planning remains outside the saved chapter's token boundary.
            beforeFuturePlanning: recoveringSavedQuality ? undefined : () => checkChapterBudget(true),
          });
          shouldStopAfterCurrentChapter = closure.shouldStopAfterCurrentChapter;
          chapterStopAction = closure.stopAction;

          // Phase 3：同步补齐下一段章节路线；正文执行合同仍由下一章 JIT 独立生成。
          if (!shouldStopAfterCurrentChapter && isAutopilotMode && chapter.order < autopilotTargetEndOrder) {
            let nextOrder = chapter.order + 1;
            if (runtimePayload.skipCompleted) while (closedOrders.has(nextOrder)) nextOrder++;
            if (nextOrder <= autopilotTargetEndOrder) {
              const cached = chaptersToProcess[chapterIndex + 1];
              const prepared = await prepareRollingChapter(nextOrder, chapter, cached?.order === nextOrder ? cached : undefined);
              if (cached?.order !== prepared.order) {
                chaptersToProcess.splice(chapterIndex + 1, 0, prepared);
              }
            }
          }

          completed += 1;
          await this.updateJobSafe(jobId, {
            completedCount: completed,
            progress: Number((completed / totalCount).toFixed(4)),
            retryCount: totalRetryCount,
            heartbeatAt: new Date(),
            payload: this.stringifyPipelinePayload({
              ...runtimePayload,
              qualityAlertDetails,
              replanAlertDetails,
              recoverableRepairDetails,
            }),
          });
          logPipelineInfo("Actualizaciones del progreso de la tarea", {
            jobId,
            completed,
            total: totalCount,
            progress: Number((completed / totalCount).toFixed(4)),
            retryCount: totalRetryCount,
          });
          if (chapterStopAction === "fail_task") {
            const failureMessage = `Cap.${chapter.order}Los problemas de calidad del capítulo han puesto fin a esta línea de montaje de acuerdo con las reglas de la tarea.`;
            await this.updateJobRequired(jobId, {
              status: "failed",
              pendingManualRecovery: false,
              error: failureMessage,
              heartbeatAt: null,
              currentStage: null,
              currentItemKey: chapter.id,
              currentItemLabel: currentItemLabel,
              cancelRequestedAt: null,
              finishedAt: new Date(),
              payload: this.stringifyPipelinePayload({
                ...runtimePayload,
                qualityAlertDetails,
                replanAlertDetails,
                recoverableRepairDetails,
              }),
            });
            throw new PipelineIssueAppliedError(failureMessage, "fail_task");
          }
          if (shouldStopAfterCurrentChapter) {
            pendingManualRecovery = true;
            if (chapterResult.reviewRetries?.exhausted) pendingManualRecoveryReason = `Cap.${chapter.order}Reintento de verificación de capítulo utilizado ${chapterResult.reviewRetries.used}/${chapterResult.reviewRetries.maxRetries} veces, el texto principal ha sido reservado, confírmelo desde el banco de trabajo novedoso antes de continuar.`;
            logPipelineWarn("Los capítulos requieren procesamiento manual y la tramitación de capítulos posteriores se ha suspendido.", {
              jobId,
              order: chapter.order,
              remaining: Math.max(0, totalCount - completed),
            });
            break;
          }
        }

        if (pendingManualRecovery) {
          await this.updateJobSafe(jobId, {
            status: "queued",
            pendingManualRecovery: true,
            error: pendingManualRecoveryReason,
            heartbeatAt: null,
            currentStage: "queued",
            currentItemKey: null,
            currentItemLabel: null,
            cancelRequestedAt: null,
            finishedAt: null,
            payload: this.stringifyPipelinePayload({
              ...runtimePayload,
              qualityAlertDetails,
              replanAlertDetails,
              recoverableRepairDetails,
            }),
          });
          return;
        }

        const finalStatus: "succeeded" = "succeeded";
        await this.updateJobSafe(jobId, {
          heartbeatAt: new Date(),
          currentStage: "finalizing",
          currentItemKey: null,
          currentItemLabel: "Finalizando las tareas del canal de capítulos",
          progress: buildPipelineStageProgress({
            completedCount: completed,
            totalCount,
            stage: "finalizing",
          }),
        });
        await this.updateJobSafe(jobId, {
          status: finalStatus,
          progress: 1,
          error: null,
          heartbeatAt: null,
          currentStage: null,
          currentItemKey: null,
          currentItemLabel: null,
          cancelRequestedAt: null,
          finishedAt: new Date(),
          payload: this.stringifyPipelinePayload({
            ...runtimePayload,
            qualityAlertDetails,
            replanAlertDetails,
            recoverableRepairDetails,
          }),
        });
        logPipelineInfo("Finaliza la ejecución de la tarea", {
          jobId,
          status: finalStatus,
          qualityAlertCount: qualityAlertDetails.length,
        });
        void novelEventBus.emit({
          type: "pipeline:completed",
          payload: { novelId, jobId, status: finalStatus },
        }).catch(() => {});
      });
    } catch (error) {
      if (error instanceof PipelineExecutionLeaseLostError) {
        logPipelineWarn("El contrato de arrendamiento de ejecución de tareas se transfirió y el antiguo ejecutor dejó de escribir", { jobId, novelId });
        return;
      }
      if (error instanceof PipelineIssueAppliedError) {
        const log = runtimePayload.directorNext?.pendingCharacterReviewId ? logPipelineInfo : logPipelineError;
        log(runtimePayload.directorNext?.pendingCharacterReviewId ? "Esperando que el usuario confirme el personaje en este capítulo." : "La tarea ha finalizado su ejecución actual según la política del problema.", {
          jobId,
          novelId,
          action: error.action,
          message: error.message,
        });
        if (error.action === "fail_task") {
          void novelEventBus.emit({
            type: "pipeline:completed",
            payload: { novelId, jobId, status: "failed" },
          }).catch(() => {});
        }
        return;
      }
      if (error instanceof Error && error.message === "PIPELINE_CANCELLED") {
        await this.updateJobSafe(jobId, {
          status: "cancelled",
          heartbeatAt: null,
          currentStage: null,
          currentItemKey: null,
          currentItemLabel: null,
          cancelRequestedAt: null,
          finishedAt: new Date(),
          payload: this.stringifyPipelinePayload({
            ...runtimePayload,
            qualityAlertDetails,
            replanAlertDetails,
            recoverableRepairDetails,
          }),
        }, "cancelled");
        void novelEventBus.emit({
          type: "pipeline:completed",
          payload: { novelId, jobId, status: "cancelled" },
        }).catch(() => {});
        return;
      }

      if (runtimePayload.directorNext && error instanceof ChapterArtifactSyncBoundaryError && error.result.characterReviewId) {
        runtimePayload.directorNext.pendingCharacterReviewId = error.result.characterReviewId;
        await this.updateJobRequired(jobId, {status: "queued", pendingManualRecovery: true,
          error: error.message, payload: this.stringifyPipelinePayload(runtimePayload)});
        return;
      }
      const message = error instanceof Error ? error.message : "La ejecución de la canalización falló";
      if (isChapterEmptyContentError(error)) {
        logPipelineError("La misión falló debido al texto del capítulo vacío", {
          jobId,
          novelId,
          provider: runtimePayload.provider,
          model: runtimePayload.model,
          runMode: runtimePayload.runMode,
          workflowTaskId: runtimePayload.workflowTaskId,
          source: error.details.source,
          contentLength: error.details.trimmedLength,
          rawContentLength: error.details.rawLength,
        });
      }
      const governedAction = await applyGovernedIssue({
        issueCode: error instanceof PipelineIssueFailure
          ? error.issueCode
          : error instanceof ChapterArtifactSyncBoundaryError
            ? "runtime.data_integrity"
          : error instanceof ChapterContentPersistenceError
            ? "runtime.persistence_failed"
            : isChapterEmptyContentError(error)
              ? "generation.empty_content"
              : resolvePipelineRuntimeIssueCode(error),
        stage: error instanceof PipelineIssueFailure
          ? error.stage
          : error instanceof ChapterContentPersistenceError
            ? "chapter_persistence"
            : "chapter_execution",
        summary: message,
        evidence: error instanceof Error ? error.stack : undefined,
        chapterId: error instanceof PipelineIssueFailure ? error.chapterId : undefined,
        chapterOrder: error instanceof PipelineIssueFailure ? error.chapterOrder : undefined,
        attempt: issueGovernance?.policy.maxAutomaticRetries ?? maxRetries,
      });
      if (governedAction) {
        logPipelineError("La tarea se ha completado de acuerdo con la estrategia del problema.", {
          jobId,
          novelId,
          action: governedAction,
          message,
        });
        if (governedAction === "fail_task") {
          void novelEventBus.emit({
            type: "pipeline:completed",
            payload: { novelId, jobId, status: "failed" },
          }).catch(() => {});
        }
        return;
      }
      await this.updateJobSafe(jobId, {
        status: "failed",
        error: message,
        finishedAt: new Date(),
        payload: this.stringifyPipelinePayload({
          ...runtimePayload,
          qualityAlertDetails,
          replanAlertDetails,
          recoverableRepairDetails,
        }),
      });
      logPipelineError("Excepción de ejecución de tarea", {
        jobId,
        novelId,
        message,
      });
      void novelEventBus.emit({
        type: "pipeline:completed",
        payload: { novelId, jobId, status: "failed" },
      }).catch(() => {});
    }
  }
}
