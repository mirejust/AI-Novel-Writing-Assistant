import type {
  NovelWorkflowMilestone,
  NovelWorkflowMilestoneType,
} from "@ai-novel/shared/types/novelWorkflow";
import type {
  DirectorDashboardAction,
  DirectorDashboardMode,
  DirectorDisplayStepStatus,
} from "@ai-novel/shared/types/directorRuntime";
import type { LLMProvider } from "@ai-novel/shared/types/llm";
import {
  DIRECTOR_CANDIDATE_SETUP_STEPS,
  extractDirectorTaskSeedPayloadFromMeta,
} from "@ai-novel/shared/types/novelDirector";
import type { UnifiedTaskDetail } from "@ai-novel/shared/types/task";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown } from "lucide-react";
import {
  getDirectorTaskSnapshot,
} from "@/api/novelDirector";
import { queryKeys } from "@/api/queryKeys";
import DirectorRuntimeProjectionCard from "@/components/autoDirector/DirectorRuntimeProjectionCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import AITakeoverContainer, { type AITakeoverMode } from "@/components/workflow/AITakeoverContainer";
import {
  isChapterTitleDiversitySummary,
  resolveChapterTitleWarning,
} from "@/lib/directorTaskNotice";
import { extractWorkflowActivityTags } from "@/lib/novelWorkflowActivityTags";
import { useDirectorChapterTitleRepair } from "@/hooks/useDirectorChapterTitleRepair";
import { useDirectorBudgetRecovery } from "@/hooks/useDirectorBudgetRecovery";
import NovelDirectorPreparationJourney, {
  type DirectorPreparationStepStatus,
} from "./NovelDirectorPreparationJourney";

type DirectorExecutionViewMode = "execution_progress" | "execution_failed";

interface NovelAutoDirectorProgressPanelProps {
  mode: DirectorExecutionViewMode;
  task: UnifiedTaskDetail | null;
  taskId: string;
  titleHint?: string;
  fallbackError?: string | null;
  onConfirmAndContinue?: () => void;
  isConfirmingAndContinuing?: boolean;
  quickRetryLabel?: string;
}

type DirectorStepVisualStatus = DirectorPreparationStepStatus;
type DirectorStepDefinition = {
  key: string;
  label: string;
};

const DIRECTOR_EXECUTION_STEPS: DirectorStepDefinition[] = [
  { key: "novel_create", label: "Crear proyecto" },
  { key: "book_contract", label: "Contrato de libro + Macroplanificación de historias" },
  { key: "character_setup", label: "Preparación de personajes" },
  { key: "volume_strategy", label: "Estrategia de volumen + esqueleto de volumen" },
  { key: "beat_sheet", label: "Volumen 1 Tablero de ritmo + Lista de capítulos" },
  { key: "chapter_detail_bundle", label: "Refinamiento por lotes de capítulos" },
];

const DIRECTOR_CANDIDATE_SETUP_STEP_KEYS = new Set<string>(
  DIRECTOR_CANDIDATE_SETUP_STEPS.map((step) => step.key),
);

const AUTO_DIRECTOR_PLACEHOLDER_TITLES = new Set([
  "La IA dirige automáticamente las novelas",
  "Tareas de proceso novedosas",
]);

function formatDate(value: string | null | undefined): string {
  if (!value) {
    return "Sin datos";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Sin datos";
  }
  return date.toLocaleString();
}

function formatTokenCount(value: number | null | undefined): string {
  return new Intl.NumberFormat("zh-CN").format(Math.max(0, Math.round(value ?? 0)));
}

function resolveAutoExecutionScopeLabel(task: UnifiedTaskDetail | null): string {
  const seedPayload = extractDirectorTaskSeedPayloadFromMeta(task?.meta) as {
    autoExecution?: {
      scopeLabel?: string | null;
      totalChapterCount?: number | null;
    } | null;
  } | null;
  const scopeLabel = seedPayload?.autoExecution?.scopeLabel?.trim();
  if (scopeLabel) {
    return scopeLabel;
  }
  const fallbackCount = Math.max(1, Math.round(seedPayload?.autoExecution?.totalChapterCount ?? 10));
  return `adelante ${fallbackCount}`;
}

function resolveDirectorStyleSeed(task: UnifiedTaskDetail | null): {
  title: string;
  summaryLines: string[];
} | null {
  const seedPayload = extractDirectorTaskSeedPayloadFromMeta(task?.meta);
  const styleIntentSummary = seedPayload?.styleIntentSummary;
  if (styleIntentSummary?.headline?.trim()) {
    return {
      title: styleIntentSummary.styleProfileName?.trim() || styleIntentSummary.headline.trim(),
      summaryLines: styleIntentSummary.stageSummaryLines ?? [],
    };
  }
  const fallbackTone = typeof (seedPayload as { styleTone?: unknown } | null)?.styleTone === "string"
    ? (((seedPayload as { styleTone?: string }).styleTone ?? "").trim())
    : "";
  if (!fallbackTone) {
    return null;
  }
  return {
    title: fallbackTone,
    summaryLines: [`Palabras clave para el estilo de escritura:${fallbackTone}`],
  };
}

function formatCheckpoint(
  checkpoint: NovelWorkflowMilestoneType | null | undefined,
  task: UnifiedTaskDetail | null,
): string {
  if (checkpoint === "rewrite_snapshot_created") {
    return "Copia de seguridad creada antes de reescribir";
  }
  if (checkpoint === "candidate_selection_required") {
    return "Esperando confirmación de la dirección del libro";
  }
  if (checkpoint === "book_contract_ready") {
    return "El contrato del libro está listo";
  }
  if (checkpoint === "character_setup_required") {
    return "Preparación de personajes pendiente de revisión";
  }
  if (checkpoint === "volume_strategy_ready") {
    return "La estrategia de volumen está lista";
  }
  if (checkpoint === "production_experience_required") {
    return "Listo para empezar a escribir, esperando seleccionar el método de producción.";
  }
  if (checkpoint === "chapter_batch_ready") {
    return `${resolveAutoExecutionScopeLabel(task)}La ejecución automatizada está en pausa`;
  }
  if (checkpoint === "step_review_required") {
    return "Paso actual a comprobar";
  }
  if (checkpoint === "replan_required") {
    return "Requiere replanificación";
  }
  if (checkpoint === "workflow_completed") {
    return "Proceso principal completado";
  }
  return "Sin datos";
}

function isCandidateSetupFlow(task: UnifiedTaskDetail | null): boolean {
  return DIRECTOR_CANDIDATE_SETUP_STEP_KEYS.has(task?.currentItemKey ?? "");
}

function resolveDirectorExecutionStepIndex(task: UnifiedTaskDetail | null): number {
  const itemKey = task?.currentItemKey ?? "";
  const chapterExecutionKeys = new Set([
    "chapter_execution",
    "chapter_execution_node",
    "chapter.draft.write",
    "chapter.write",
  ]);
  const qualityRepairKeys = new Set([
    "reviewing",
    "repairing",
    "quality_repair",
    "chapter_quality_review_node",
    "chapter.quality.review",
    "chapter_state_commit_node",
    "chapter.state.commit",
  ]);
  if (qualityRepairKeys.has(itemKey)) {
    return 5;
  }
  if (
    (task?.status === "running" && task?.checkpointType === "chapter_batch_ready")
    || itemKey === "chapter_detail_bundle"
    || chapterExecutionKeys.has(itemKey)
  ) {
    return 5;
  }
  if (itemKey === "beat_sheet" || itemKey === "chapter_list" || itemKey === "chapter_sync") {
    return 4;
  }
  if (
    task?.checkpointType === "character_setup_required"
    || itemKey === "character_setup"
    || itemKey === "character_cast_apply"
  ) {
    return 2;
  }
  if (
    task?.checkpointType === "volume_strategy_ready"
    || itemKey === "volume_strategy"
    || itemKey === "volume_skeleton"
  ) {
    return 3;
  }
  if (
    task?.checkpointType === "book_contract_ready"
    || itemKey === "book_contract"
    || itemKey === "story_macro"
    || itemKey === "constraint_engine"
  ) {
    return 1;
  }
  return 0;
}

function resolveCandidateSetupStepIndex(task: UnifiedTaskDetail | null): number {
  const itemKey = task?.currentItemKey ?? "";
  const foundIndex = DIRECTOR_CANDIDATE_SETUP_STEPS.findIndex((step) => step.key === itemKey);
  return foundIndex >= 0 ? foundIndex : 0;
}

function resolveDirectorStepStatuses(
  task: UnifiedTaskDetail | null,
  mode: DirectorExecutionViewMode,
  steps: ReadonlyArray<DirectorStepDefinition>,
): DirectorStepVisualStatus[] {
  if (task?.status === "succeeded") {
    return steps.map(() => "completed");
  }

  const currentIndex = isCandidateSetupFlow(task)
    ? resolveCandidateSetupStepIndex(task)
    : resolveDirectorExecutionStepIndex(task);
  return steps.map((_, index) => {
    if (index < currentIndex) {
      return "completed";
    }
    if (index === currentIndex) {
      return mode === "execution_failed" || task?.pendingManualRecovery ? "failed" : "running";
    }
    return "pending";
  });
}

function mapDisplayStepStatus(status: DirectorDisplayStepStatus | null | undefined): DirectorStepVisualStatus {
  if (status === "completed") {
    return "completed";
  }
  if (status === "running") {
    return "running";
  }
  if (status === "attention") {
    return "failed";
  }
  return "pending";
}

function mapDashboardModeToContainerMode(mode: DirectorDashboardMode | null | undefined): AITakeoverMode {
  switch (mode) {
    case "failed":
      return "failed";
    case "recovering":
      return "action_required";
    case "waiting_user":
      return "waiting";
    case "idle":
      return "loading";
    case "queued":
    case "completed":
    case "running":
    default:
      return "running";
  }
}

export default function NovelAutoDirectorProgressPanel({
  mode,
  task,
  taskId,
  titleHint,
  fallbackError,
  onConfirmAndContinue,
  isConfirmingAndContinuing = false,
  quickRetryLabel,
}: NovelAutoDirectorProgressPanelProps) {
  const taskChapterTitleWarning = resolveChapterTitleWarning(task);
  const chapterTitleRepairMutation = useDirectorChapterTitleRepair();
  const runtimeTaskId = task?.id ?? taskId;
  const snapshotQuery = useQuery({
    queryKey: queryKeys.tasks.directorTaskSnapshot(runtimeTaskId || "none"),
    queryFn: () => getDirectorTaskSnapshot(runtimeTaskId),
    enabled: Boolean(runtimeTaskId),
    retry: false,
    placeholderData: (previousData) => previousData,
    refetchInterval: () => (
      task && (task.status === "queued" || task.status === "running" || task.status === "waiting_approval") ? 4000 : false
    ),
  });
  const snapshot = snapshotQuery.data?.data?.snapshot ?? null;
  const dashboardView = snapshot?.dashboardView ?? null;
  const displayState = snapshot?.displayState ?? null;
  const runtimeProjection = snapshot?.projection ?? null;
  const taskHasTerminalFailure = task?.status === "failed" || task?.status === "cancelled";
  const dashboardViewForDisplay = taskHasTerminalFailure ? null : dashboardView;
  const displayStateForDisplay = taskHasTerminalFailure ? null : displayState;
  const staleActionProjection = Boolean(
    dashboardViewForDisplay?.mode === "running"
    && (
      runtimeProjection?.requiresUserAction
      || runtimeProjection?.status === "blocked"
      || runtimeProjection?.status === "waiting_approval"
    ),
  );
  const runtimeProjectionForDisplay = dashboardViewForDisplay?.mode === "recovering" || staleActionProjection ? null : runtimeProjection;
  const chapterFacts = snapshot?.factSummary?.chapterExecutionFacts
    ?? runtimeProjectionForDisplay?.factSummary?.chapterExecutionFacts
    ?? null;
  const chapterProductionStarted = resolveDirectorExecutionStepIndex(task) >= 5;
  const chapterProgress = chapterFacts && chapterFacts.totalChapters > 0 && (
    chapterProductionStarted || chapterFacts.completedChapters > 0
  )
    ? {
      completed: chapterFacts.completedChapters,
      total: chapterFacts.expectedChapterCount ?? chapterFacts.totalChapters,
    }
    : null;
  const onboardingNovelId = task?.resumeTarget?.novelId?.trim() || runtimeTaskId;
  const historyEvents = snapshot?.recentEvents ?? [];
  const displayProgress = dashboardViewForDisplay?.progressPercent ?? displayStateForDisplay?.progressPercent ?? task?.progress ?? null;
  const fallbackChapterTitleWarning = !taskChapterTitleWarning && isChapterTitleDiversitySummary(fallbackError)
    ? {
      summary: fallbackError?.trim() ?? "",
      route: null,
      label: "Arreglar rápidamente los títulos de los capítulos",
    }
    : null;
  const rawChapterTitleWarning = taskChapterTitleWarning ?? fallbackChapterTitleWarning;
  const chapterTitleWarning = dashboardViewForDisplay?.mode === "running" || dashboardViewForDisplay?.mode === "queued"
    ? null
    : rawChapterTitleWarning;
  const visualMode: DirectorExecutionViewMode = mode === "execution_failed" && !chapterTitleWarning
    ? "execution_failed"
    : "execution_progress";
  const currentAction = dashboardViewForDisplay?.currentAction
    || displayStateForDisplay?.currentAction
    || runtimeProjectionForDisplay?.currentLabel?.trim()
    || task?.currentItemLabel?.trim()
    || (visualMode === "execution_failed"
      ? "Ejecución de la tarea del director interrumpida"
      : (chapterTitleWarning ? "Se ha generado la lista de capítulos, esperando que se arregle la estructura del título." : "Preparándose para una tarea de dirección"));
  const activityTags = extractWorkflowActivityTags(displayStateForDisplay?.currentFactStepLabel || task?.currentItemLabel);
  const workflowTitle = task?.title?.trim() || "";
  const hintedTitle = titleHint?.trim() || "";
  const taskTitle = (
    hintedTitle && (!workflowTitle || AUTO_DIRECTOR_PLACEHOLDER_TITLES.has(workflowTitle))
      ? hintedTitle
      : workflowTitle || hintedTitle || "Nuevo proyecto novedoso"
  );
  const milestones = Array.isArray(task?.meta.milestones)
    ? task.meta.milestones as NovelWorkflowMilestone[]
    : [];
  const candidateSetupFlow = isCandidateSetupFlow(task);
  const displaySteps = dashboardViewForDisplay?.steps ?? displayStateForDisplay?.steps ?? [];
  const stepDefinitions = candidateSetupFlow
    ? DIRECTOR_CANDIDATE_SETUP_STEPS
    : displaySteps.map((step) => ({ key: step.key, label: step.label }));
  const steps = candidateSetupFlow
    ? resolveDirectorStepStatuses(task, visualMode, stepDefinitions)
    : displaySteps.map((step) => mapDisplayStepStatus(step.status));
  const failureMessage = task?.lastError?.trim()
    || task?.checkpointSummary?.trim()
    || fallbackError?.trim()
    || "La ejecución de la tarea del director falló, pero no se registró ningún error claro.";
  const isHighMemoryConflict = /高内存卷规划生成正在处理同一范围|高内存.*同一范围|已有自动导演任务正在处理同一范围/.test(failureMessage);
  const isBudgetExhaustedFailure = /\[STRUCTURED_OUTPUT:(reasoning_budget_exhausted|output_budget_exhausted)\]/i.test(failureMessage);
  const seedPayload = extractDirectorTaskSeedPayloadFromMeta(task?.meta) as {
    provider?: unknown;
  } | null;
  const seedProvider = typeof seedPayload?.provider === "string" && seedPayload.provider.trim()
    ? (seedPayload.provider as LLMProvider)
    : null;
  const showBudgetRecovery = visualMode === "execution_failed"
    && candidateSetupFlow
    && isBudgetExhaustedFailure
    && Boolean(onConfirmAndContinue);
  const budgetRecovery = useDirectorBudgetRecovery({
    enabled: showBudgetRecovery,
    provider: seedProvider,
    onRetry: onConfirmAndContinue,
  });
  const tokenUsage = task?.tokenUsage ?? null;
  const styleSeed = resolveDirectorStyleSeed(task);
  const containerMode: AITakeoverMode = visualMode === "execution_failed"
    ? "failed"
    : !task
      ? "loading"
      : chapterTitleWarning
        ? "waiting"
        : mapDashboardModeToContainerMode(dashboardViewForDisplay?.mode ?? null);
  const description = candidateSetupFlow
    ? (
      visualMode === "execution_failed"
        ? "La cadena de generación de direcciones candidatas se ha interrumpido y se puede volver a intentar desde el progreso actual."
        : "El sistema primero organizará la configuración del proyecto, alineará el marco a nivel de libro y luego generará dos conjuntos de planos a nivel de libro y los grupos de títulos correspondientes."
    )
    : (
      dashboardViewForDisplay?.description
      || displayStateForDisplay?.description
      || (visualMode === "execution_failed"
        ? "La tarea se detuvo en el paso más reciente y se puede reanudar desde el progreso actual."
        : chapterTitleWarning
          ? "Se ha conservado la lista de capítulos, un recordatorio estructural que se puede abordar directamente. Puede corregir rápidamente el título antes de decidir si continúa con el proceso de dirección."
          : task?.status === "waiting_approval"
            ? "El proceso director actual se ha detenido en el punto de revisión. Puede verificar el producto primero y luego decidir si continúa avanzando automáticamente."
            : "Puede salir de la página actual y la tarea seguirá ejecutándose; Puedes comprobar el progreso en la cabina de IA cuando regreses.")
    );
  const resolveDashboardAction = (dashboardAction: DirectorDashboardAction) => {
    if (dashboardAction.type === "confirm_and_continue" && onConfirmAndContinue) {
      return {
        label: isConfirmingAndContinuing ? "Continuando..." : dashboardAction.label,
        onClick: onConfirmAndContinue,
        variant: "default" as const,
        disabled: isConfirmingAndContinuing,
      };
    }
    if (dashboardAction.type === "background_continue" || dashboardAction.type === "open_task_center") return null;
    if ((dashboardAction.type === "resume_from_checkpoint" || dashboardAction.type === "retry") && onConfirmAndContinue) {
      return {
        label: isConfirmingAndContinuing ? "Recuperando..." : (isHighMemoryConflict ? "Inténtalo de nuevo desde el punto de control." : dashboardAction.label),
        onClick: onConfirmAndContinue,
        variant: "default" as const,
        disabled: isConfirmingAndContinuing,
      };
    }
    return null;
  };
  const dashboardActions = dashboardViewForDisplay
    ? [
      dashboardViewForDisplay.primaryAction,
      ...dashboardViewForDisplay.secondaryActions,
    ].filter((item): item is DirectorDashboardAction => Boolean(item))
      .map(resolveDashboardAction)
      .filter((item): item is NonNullable<ReturnType<typeof resolveDashboardAction>> => Boolean(item))
    : [];
  const quickRetryAction = quickRetryLabel
    && onConfirmAndContinue
    && (visualMode === "execution_failed" || task?.pendingManualRecovery)
    ? {
        label: isConfirmingAndContinuing ? "Intentando de nuevo..." : quickRetryLabel,
        onClick: onConfirmAndContinue,
        variant: "default" as const,
        disabled: isConfirmingAndContinuing,
      }
    : null;
  const actions = dashboardActions.length > 0 || !quickRetryAction
    ? dashboardActions
    : [quickRetryAction];

  return (
    <div className="space-y-4">
      <AITakeoverContainer
        mode={containerMode}
        title={visualMode === "execution_failed"
          ? (candidateSetupFlow ? "\u5019\u9009\u65b9\u6848\u751f\u6210\u5931\u8d25" : "\u5bfc\u6f14\u6267\u884c\u5931\u8d25")
          : dashboardViewForDisplay?.mode === "recovering"
            ? `\u300a${taskTitle}\u300b\u7b49\u5f85\u6062\u590d`
            : candidateSetupFlow
              ? "\u6b63\u5728\u751f\u6210\u5bfc\u6f14\u5019\u9009\u65b9\u6848"
              : `\u300a${taskTitle}\u300b\u6b63\u5728\u81ea\u52a8\u5bfc\u6f14`}
        description={description}
        progress={displayProgress}
        currentAction={currentAction}
        checkpointLabel={displayStateForDisplay?.checkpointLabel || formatCheckpoint(task?.checkpointType, task)}
        taskId={task?.id || taskId}
        actions={actions}
      >
        <NovelDirectorPreparationJourney
          steps={candidateSetupFlow
            ? stepDefinitions
            : displaySteps.map((step) => ({ key: step.key, label: step.label }))}
          statuses={steps}
          onboardingStorageKey={`director-preparation-${onboardingNovelId}`}
          chapterProgress={chapterProgress}
        />

        {activityTags.length > 0 ? (
          <div className="mt-4">
            <div className="text-xs font-medium text-muted-foreground">{"\u540e\u53f0\u9644\u5c5e\u5206\u6790"}</div>
            <div className="mt-2 flex flex-wrap gap-2">
              {activityTags.map((tag) => (
                <Badge key={tag} variant="secondary">{tag}</Badge>
              ))}
            </div>
          </div>
        ) : null}

        <details className="group mt-4 overflow-hidden rounded-2xl border border-border/70 bg-muted/[0.12]">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-4 py-3.5">
            <div>
              <div className="text-sm font-medium text-foreground">Detalles de ejecución</div>
              <div className="mt-0.5 text-xs text-muted-foreground">Vea métricas en tiempo real, registros de eventos, escritura y uso de IA bajo demanda</div>
            </div>
            <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition group-open:rotate-180" />
          </summary>
          <div className="border-t border-border/60 px-4 pb-4">
            <DirectorRuntimeProjectionCard
              projection={runtimeProjectionForDisplay}
              compact
              className="mt-4"
            />

        <div className="mt-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-sm font-medium text-foreground">{"\u5168\u90e8\u8fdb\u5c55"}</div>
              <div className="mt-1 text-xs text-muted-foreground">
                {historyEvents.length > 0 ? `\u663e\u793a ${historyEvents.length} \u6761\u6700\u8fd1\u8fdb\u5c55` : "\u6b63\u5728\u8bfb\u53d6\u8fdb\u5c55\u8bb0\u5f55"}
              </div>
            </div>
          </div>

          {snapshotQuery.isLoading ? (
            <div className="mt-3 text-sm text-muted-foreground">
              {"\u6b63\u5728\u8bfb\u53d6\u8fdb\u5c55\u8bb0\u5f55\u3002"}
            </div>
          ) : historyEvents.length > 0 ? (
            <div className="mt-3 max-h-80 space-y-3 overflow-y-auto border-l border-border/60 pl-3 pr-1">
              {historyEvents.map((event) => (
                <div key={event.eventId} className="text-sm">
                  <div className="font-medium text-foreground">{event.summary}</div>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                    <span>{"\u8bb0\u5f55\u65f6\u95f4\uff1a"}{formatDate(event.occurredAt)}</span>
                    {event.nodeKey ? <span>{"\u6b65\u9aa4\uff1a"}{event.nodeKey}</span> : null}
                    {event.artifactType ? <span>{"\u4ea7\u7269\uff1a"}{event.artifactType}</span> : null}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-3 text-sm text-muted-foreground">
              {"\u4efb\u52a1\u8fd0\u884c\u540e\u4f1a\u5728\u8fd9\u91cc\u5199\u5165\u8fdb\u5c55\u8bb0\u5f55\u3002"}
            </div>
          )}
        </div>

        {styleSeed ? (
          <div className="mt-5">
            <div className="text-sm font-medium text-foreground">Escritura de éxito actual</div>
            <div className="mt-2 text-sm text-foreground">{styleSeed.title}</div>
            {styleSeed.summaryLines.length > 0 ? (
              <div className="mt-3 space-y-2">
                <div className="text-xs font-medium text-muted-foreground">Sólo el resumen escrito que esté vigente en esta etapa</div>
                {styleSeed.summaryLines.map((line) => (
                  <div key={line} className="text-xs leading-6 text-muted-foreground">
                    {line}
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}

        {tokenUsage ? (
          <div className="mt-4 grid gap-3 md:grid-cols-4">
            <div className="rounded-lg bg-muted/15 p-3">
              <div className="text-xs text-muted-foreground">Llamadas acumuladas</div>
              <div className="mt-1 text-sm font-medium text-foreground">{formatTokenCount(tokenUsage.llmCallCount)}</div>
            </div>
            <div className="rounded-lg bg-muted/15 p-3">
              <div className="text-xs text-muted-foreground">Introducir fichas</div>
              <div className="mt-1 text-sm font-medium text-foreground">{formatTokenCount(tokenUsage.promptTokens)}</div>
            </div>
            <div className="rounded-lg bg-muted/15 p-3">
              <div className="text-xs text-muted-foreground">Fichas de salida</div>
              <div className="mt-1 text-sm font-medium text-foreground">{formatTokenCount(tokenUsage.completionTokens)}</div>
            </div>
            <div className="rounded-lg bg-muted/15 p-3">
              <div className="text-xs text-muted-foreground">Total acumulado de tokens</div>
              <div className="mt-1 text-sm font-medium text-foreground">{formatTokenCount(tokenUsage.totalTokens)}</div>
              <div className="mt-1 text-[11px] text-muted-foreground">Registros recientes:{formatDate(tokenUsage.lastRecordedAt)}</div>
            </div>
          </div>
        ) : null}
          </div>
        </details>

        {chapterTitleWarning ? (
          <div className="mt-4 rounded-xl border border-amber-300/60 bg-amber-50/80 p-4 text-sm text-amber-950">
            <div className="font-medium">Recordatorio actual</div>
            <div className="mt-1">{chapterTitleWarning.summary}</div>
            <div className="mt-3 flex flex-wrap gap-2">
              {task && chapterTitleWarning ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    chapterTitleRepairMutation.startRepair(task);
                  }}
                  disabled={chapterTitleRepairMutation.isPending}
                >
                  {chapterTitleRepairMutation.isPending && chapterTitleRepairMutation.pendingTaskId === task.id
                    ? "Reparación de IA en progreso..."
                    : chapterTitleWarning.label}
                </Button>
              ) : null}
            </div>
          </div>
        ) : visualMode === "execution_failed" ? (
          <div className="mt-4 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            <div className="font-medium">Resumen de fallas</div>
            <div className="mt-1">{failureMessage}</div>
            {isHighMemoryConflict ? (
              <div className="mt-3 rounded-lg border border-destructive/20 bg-background/60 p-3 text-xs leading-5 text-destructive/90">
                Este es un conflicto de recursos recuperables y las configuraciones y planes de capítulos completos no se perderán. Una vez liberados los recursos, puede continuar desde el punto de control de seguridad actual sin tener que empezar de nuevo.
              </div>
            ) : null}
            {task?.recoveryHint ? (
              <div className="mt-2 text-xs text-destructive/80">Sugerencias de recuperación:{task.recoveryHint}</div>
            ) : null}
            {showBudgetRecovery ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {seedProvider ? (
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => budgetRecovery.recover("disable_thinking")}
                    disabled={budgetRecovery.isPending}
                  >
                    {budgetRecovery.isPending && budgetRecovery.pendingAction === "disable_thinking"
                      ? "Cerrando y volviendo a intentar..."
                      : "Desactiva el pensamiento profundo y vuelve a intentarlo."}
                  </Button>
                ) : null}
                {budgetRecovery.canRaiseBudget ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => budgetRecovery.recover("raise_budget")}
                    disabled={budgetRecovery.isPending}
                  >
                    {budgetRecovery.isPending && budgetRecovery.pendingAction === "raise_budget"
                      ? "Subiendo el límite y volviendo a intentarlo..."
                      : "Aumente el límite de salida y vuelva a intentarlo."}
                  </Button>
                ) : null}
              </div>
            ) : null}
            {isHighMemoryConflict && onConfirmAndContinue ? (
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  onClick={onConfirmAndContinue}
                  disabled={isConfirmingAndContinuing}
                >
                  {isConfirmingAndContinuing ? "Recuperando..." : "Inténtalo de nuevo desde el punto de control."}
                </Button>
              </div>
            ) : null}
          </div>
        ) : null}
      </AITakeoverContainer>

      <details className="group rounded-2xl border border-border/70 bg-background">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3.5">
          <div>
            <div className="text-sm font-medium text-foreground">Historia de hitos</div>
            <div className="mt-0.5 text-xs text-muted-foreground">Ver puntos de control recuperables y registros de finalización</div>
          </div>
          <ChevronDown className="h-4 w-4 text-muted-foreground transition group-open:rotate-180" />
        </summary>
        <div className="border-t border-border/60 px-4 pb-4 pt-1">
        {milestones.length > 0 ? (
          <div className="mt-3 space-y-3 border-l border-border/60 pl-3">
            {milestones
              .slice()
              .reverse()
              .map((item) => (
                <div key={`${item.checkpointType}:${item.createdAt}`} className="text-sm">
                  <div className="font-medium text-foreground">{formatCheckpoint(item.checkpointType, task)}</div>
                  <div className="mt-1 text-sm text-muted-foreground">{item.summary}</div>
                  <div className="mt-1 text-xs text-muted-foreground">Tiempo de grabación:{formatDate(item.createdAt)}</div>
                </div>
              ))}
          </div>
        ) : (
          <div className="mt-3 text-sm text-muted-foreground">
            La tarea ha sido creada y está esperando que se escriba el primer hito estable.
          </div>
        )}
        </div>
      </details>
    </div>
  );
}
