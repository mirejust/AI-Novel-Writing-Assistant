import type {
  DirectorChapterExecutionProgressSummary,
  DirectorDisplayMode,
  DirectorDisplayStageKey,
  DirectorDisplayState,
  DirectorDisplayStep,
  DirectorRuntimeProjection,
  DirectorTaskFactSummary,
} from "@ai-novel/shared/types/directorRuntime";
import {
  getWorkflowCheckpointLabel,
  resolveWorkflowDisplayStage,
  WORKFLOW_DISPLAY_STAGES,
} from "@ai-novel/shared/types/directorWorkflowStepCatalog";
import type { WorkflowStepProgress } from "../workflowStepRuntime/WorkflowStepModule";

type FactStepStateLike = {
  module: {
    id: string;
    label: string;
  };
  facts: {
    nextAction?: string | null;
  };
  progress: WorkflowStepProgress;
} | null;

type SnapshotTaskLike = {
  status: string;
  currentStage?: string | null;
  currentItemKey?: string | null;
  currentItemLabel?: string | null;
  progress?: number | null;
  checkpointType?: string | null;
  checkpointSummary?: string | null;
  lastError?: string | null;
  pendingManualRecovery?: boolean | null;
};

const DISPLAY_STAGES: Array<{ key: DirectorDisplayStageKey; label: string }> = WORKFLOW_DISPLAY_STAGES.map((stage) => ({
  key: stage.key,
  label: stage.label,
}));

function clampPercent(value: number | null | undefined): number {
  if (!Number.isFinite(value ?? NaN)) {
    return 0;
  }
  return Math.max(0, Math.min(100, Math.round(value ?? 0)));
}

function buildCheckpointLabel(task: SnapshotTaskLike): string {
  return getWorkflowCheckpointLabel({
    checkpointType: task.checkpointType,
    status: task.status,
    fallback: task.checkpointSummary,
  });
}

function hasLiveRuntimeProgress(task: SnapshotTaskLike, projection: DirectorRuntimeProjection | null): boolean {
  return Boolean(
    task.status === "running"
    && (
      projection?.status === "running"
      || task.currentItemLabel?.trim()
      || task.currentItemKey?.trim()
      || task.currentStage?.trim()
      || projection?.currentLabel?.trim()
      || typeof projection?.progressBreakdown?.activeJobProgress === "number"
      || typeof projection?.progressBreakdown?.totalPercent === "number"
    ),
  );
}

function buildMode(input: {
  task: SnapshotTaskLike;
  projection: DirectorRuntimeProjection | null;
  factSummary?: DirectorTaskFactSummary | null;
  showPendingManualRecovery: boolean;
  isLiveRunning: boolean;
}): DirectorDisplayMode {
  if (input.showPendingManualRecovery) {
    return "needs_recovery";
  }
  if (
    input.projection?.status === "failed"
    || input.task.status === "failed"
    || input.task.status === "cancelled"
  ) {
    return "failed";
  }
  if (
    input.task.status === "waiting_approval"
    || (!input.isLiveRunning && (
      input.projection?.status === "waiting_approval"
      || input.projection?.status === "blocked"
      || input.projection?.requiresUserAction
    ))
  ) {
    return "waiting";
  }
  if (
    input.projection?.status === "running"
    || input.task.status === "running"
    || input.task.status === "queued"
  ) {
    return "running";
  }
  if (input.factSummary) {
    return input.factSummary.allStepsCompleted ? "completed" : "idle";
  }
  if (input.task.checkpointType === "workflow_completed") {
    return "completed";
  }
  return "idle";
}

function buildDescription(mode: DirectorDisplayMode): string {
  switch (mode) {
    case "needs_recovery":
      return "La conexión del ejecutor en segundo plano se está restaurando después de haber sido interrumpida y el sistema dará prioridad a continuar desde el último progreso.";
    case "waiting":
      return "El proceso actual del director está estancado en un punto en el que se requiere confirmación. Puede revisar los resultados antes de decidir si desea continuar.";
    case "failed":
      return "El proceso director actual está estancado en el último paso. Puede verificar los detalles de la ejecución antes de decidir si volver a intentarlo o continuar.";
    case "completed":
      return "Esta ronda del proceso de dirección ha terminado. Puede continuar avanzando capítulos, comprobar los resultados o iniciar la siguiente ronda de dirección automática.";
    case "running":
      return "La IA se hace cargo del proceso de apertura del libro en segundo plano. Puede continuar operando manualmente el proyecto actual; si el mismo contenido se modifica al mismo tiempo que el director automático, prevalecerá el último resultado escrito.";
    default:
      return "Actualmente no hay asignaciones de dirección en curso.";
  }
}

function buildHeadline(mode: DirectorDisplayMode): string {
  switch (mode) {
    case "needs_recovery":
      return "Esperando la recuperación";
    case "waiting":
      return "Esperando confirmación";
    case "failed":
      return "Ejecución bloqueada";
    case "completed":
      return "El director ha completado";
    case "running":
      return "Dirigiendo automáticamente";
    default:
      return "Aún no iniciado";
  }
}

function buildCurrentAction(input: {
  mode: DirectorDisplayMode;
  projection: DirectorRuntimeProjection | null;
  factStep: FactStepStateLike;
  task: SnapshotTaskLike;
  isLiveRunning: boolean;
}): string {
  if (input.mode === "completed") {
    return (
      input.task.currentItemLabel?.trim()
      || input.task.checkpointSummary?.trim()
      || input.factStep?.progress.label?.trim()
      || "Esta ronda de director automático se ha completado."
    );
  }
  if (input.mode === "needs_recovery") {
    return (
      input.task.lastError?.trim()
      || input.projection?.blockingReason?.trim()
      || input.projection?.lastEventSummary?.trim()
      || "El sistema reanudará la recuperación desde el progreso más reciente."
    );
  }
  if (
    input.isLiveRunning
    && input.task.status === "running"
    && (
      input.projection?.status === "waiting_approval"
      || input.projection?.status === "blocked"
      || input.projection?.requiresUserAction
    )
  ) {
    return (
      input.factStep?.progress.label?.trim()
      || input.task.currentItemLabel?.trim()
      || input.projection?.currentAction?.trim()
      || input.projection?.currentLabel?.trim()
      || input.projection?.lastEventSummary?.trim()
      || "Esperando sincronización del estado de avance actual"
    );
  }
  return (
    input.projection?.currentLabel?.trim()
    || input.projection?.currentAction?.trim()
    || input.factStep?.progress.label?.trim()
    || input.task.currentItemLabel?.trim()
    || input.projection?.lastEventSummary?.trim()
    || "Esperando sincronización del estado de avance actual"
  );
}

function buildNextActionLabel(input: {
  projection: DirectorRuntimeProjection | null;
  factStep: FactStepStateLike;
}): string | null {
  const raw = input.projection?.nextActionLabel?.trim()
    || input.factStep?.progress.nextAction?.trim()
    || input.factStep?.facts.nextAction?.trim()
    || null;
  if (!raw) {
    return null;
  }
  switch (raw) {
    case "continue":
      return "Continuar dirigiendo automáticamente";
    case "continue_chapter_execution":
      return "Continuar la ejecución del capítulo";
    case "resume_from_checkpoint":
      return "Reanudar desde el progreso reciente";
    case "approve_gate":
      return "Confirmar y continuar";
    case "repair_chapter":
      return "Reparar el capítulo actual";
    case "run_quality_review":
      return "Ir a control de calidad";
    case "run_chapter_execution":
      return "Iniciar ejecución del capítulo";
    case "sync_execution_contracts":
      return "Sincronizar el contexto de ejecución del capítulo formal";
    default:
      return raw;
  }
}

function buildProgressPercent(input: {
  task: SnapshotTaskLike;
  projection: DirectorRuntimeProjection | null;
  chapterProgress: DirectorChapterExecutionProgressSummary | null | undefined;
}): number {
  if (typeof input.projection?.progressBreakdown?.totalPercent === "number") {
    return clampPercent(input.projection.progressBreakdown.totalPercent);
  }
  if (typeof input.task.progress === "number") {
    return clampPercent(input.task.progress);
  }
  if (typeof input.chapterProgress?.ratio === "number") {
    return clampPercent(input.chapterProgress.ratio * 100);
  }
  return 0;
}

function buildSteps(currentStageKey: DirectorDisplayStageKey, mode: DirectorDisplayMode): DirectorDisplayStep[] {
  const currentIndex = DISPLAY_STAGES.findIndex((stage) => stage.key === currentStageKey);
  return DISPLAY_STAGES.map((stage, index) => {
    let status: DirectorDisplayStep["status"] = "pending";
    if (mode === "completed") {
      status = "completed";
    } else if (index < currentIndex) {
      status = "completed";
    } else if (index === currentIndex) {
      status = mode === "waiting" || mode === "needs_recovery" || mode === "failed"
        ? "attention"
        : "running";
    }
    return {
      key: stage.key,
      label: stage.label,
      status,
      isCurrent: index === currentIndex,
    };
  });
}

export function buildDirectorDisplayState(input: {
  task: SnapshotTaskLike;
  projection: DirectorRuntimeProjection | null;
  factSummary?: DirectorTaskFactSummary | null;
  activeStepNodeKey?: string | null;
  currentFactStepId?: string | null;
  currentFactStepLabel?: string | null;
  factStep: FactStepStateLike;
  chapterProgress?: DirectorChapterExecutionProgressSummary | null;
}): DirectorDisplayState {
  const isLiveRunning = hasLiveRuntimeProgress(input.task, input.projection);
  const needsRecovery = Boolean(input.task.pendingManualRecovery) && !isLiveRunning;
  const stageKey = resolveWorkflowDisplayStage({
    factStepId: input.currentFactStepId ?? input.projection?.currentFactStepId ?? null,
    currentNodeKey: input.projection?.currentNodeKey ?? null,
    activeNodeKey: input.activeStepNodeKey ?? null,
    taskCurrentItemKey: input.task.currentItemKey ?? null,
    checkpointType: input.task.checkpointType ?? null,
    taskStatus: input.task.status ?? null,
    currentStage: input.task.currentStage ?? null,
  });
  const stage = DISPLAY_STAGES.find((item) => item.key === stageKey) ?? DISPLAY_STAGES[0];
  const mode = buildMode({
    task: input.task,
    projection: input.projection,
    factSummary: input.factSummary ?? null,
    showPendingManualRecovery: needsRecovery,
    isLiveRunning,
  });
  const stepIndex = Math.max(0, DISPLAY_STAGES.findIndex((item) => item.key === stage.key));
  return {
    stageKey: stage.key,
    stageLabel: stage.label,
    stepIndex,
    totalSteps: DISPLAY_STAGES.length,
    mode,
    headline: buildHeadline(mode),
    description: buildDescription(mode),
    currentAction: buildCurrentAction({
      mode,
      projection: input.projection,
      factStep: input.factStep,
      task: input.task,
      isLiveRunning,
    }),
    checkpointLabel: buildCheckpointLabel(input.task),
    progressPercent: buildProgressPercent({
      task: input.task,
      projection: input.projection,
      chapterProgress: input.chapterProgress ?? null,
    }),
    nextActionLabel: buildNextActionLabel({
      projection: input.projection,
      factStep: input.factStep,
    }),
    currentFactStepId: input.currentFactStepId ?? input.projection?.currentFactStepId ?? null,
    currentFactStepLabel: input.currentFactStepLabel ?? input.projection?.currentFactStepLabel ?? null,
    currentFactDescription: input.factStep?.progress.label ?? input.projection?.currentLabel ?? null,
    requiresUserAction: Boolean(
      !isLiveRunning
      && (
        input.projection?.requiresUserAction
        || input.projection?.status === "blocked"
        || input.projection?.status === "waiting_approval"
      ),
    ),
    isLiveRunning,
    needsRecovery,
    steps: buildSteps(stage.key, mode),
  };
}
