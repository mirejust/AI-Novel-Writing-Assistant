import type { NovelAutoDirectorTaskSummary } from "@ai-novel/shared/types/novel";
import type { NovelWorkflowCheckpoint } from "@ai-novel/shared/types/novelWorkflow";
import type { TaskStatus } from "@ai-novel/shared/types/task";
import { buildCandidateTaskHref } from "./novelRoutes.ts";

export type WorkflowBadgeVariant = "default" | "outline" | "secondary" | "destructive";

type WorkflowTaskLike = {
  id: string;
  status: TaskStatus;
  checkpointType?: NovelWorkflowCheckpoint | null;
  executionScopeLabel?: string | null;
  pendingManualRecovery?: boolean | null;
};

export const LIVE_TASK_STATUSES = new Set<TaskStatus>(["queued", "running", "waiting_approval"]);
export const BACKGROUND_RUNNING_TASK_STATUSES = new Set<TaskStatus>(["running"]);

function getExecutionScopeLabel(scopeLabel?: string | null, fallback = "Capítulo 1-10"): string {
  return scopeLabel?.trim() || fallback;
}

function buildAutoExecutionRunningLabel(scopeLabel?: string | null): string {
  return `${getExecutionScopeLabel(scopeLabel)}Ejecutando automáticamente`;
}

function buildAutoExecutionPausedLabel(scopeLabel?: string | null): string {
  return `${getExecutionScopeLabel(scopeLabel)}La ejecución automatizada está en pausa`;
}

function buildAutoExecutionCancelledLabel(scopeLabel?: string | null): string {
  return `${getExecutionScopeLabel(scopeLabel)}Ejecución automática cancelada`;
}

export function formatWorkflowCheckpoint(checkpoint?: NovelWorkflowCheckpoint | null, scopeLabel?: string | null): string {
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
    return "Estrategia de volumen pendiente de revisión";
  }
  if (checkpoint === "chapter_batch_ready") {
    return buildAutoExecutionPausedLabel(scopeLabel);
  }
  if (checkpoint === "replan_required") {
    return "Esperando una nueva planificación";
  }
  if (checkpoint === "workflow_completed") {
    return "Autodirector completado";
  }
  return "Director automático";
}

export function getWorkflowBadge(task?: NovelAutoDirectorTaskSummary | null): {
  label: string;
  variant: WorkflowBadgeVariant;
} | null {
  if (!task) {
    return null;
  }
  const displayStatus = task.displayStatus?.trim() || null;
  if (
    (task.status === "queued" || task.status === "running")
    && task.checkpointType === "chapter_batch_ready"
  ) {
    return {
      label: displayStatus ?? buildAutoExecutionRunningLabel(task.executionScopeLabel),
      variant: "default",
    };
  }
  if ((task.status === "failed" || task.status === "cancelled") && task.checkpointType === "chapter_batch_ready") {
    return {
      label: displayStatus ?? (task.status === "failed"
        ? buildAutoExecutionPausedLabel(task.executionScopeLabel)
        : buildAutoExecutionCancelledLabel(task.executionScopeLabel)),
      variant: task.status === "failed" ? "destructive" : "outline",
    };
  }
  if (task.status === "waiting_approval") {
    return {
      label: displayStatus ?? formatWorkflowCheckpoint(task.checkpointType, task.executionScopeLabel),
      variant: "secondary",
    };
  }
  if (task.status === "running") {
    return {
      label: displayStatus ?? "Director automático en progreso",
      variant: "default",
    };
  }
  if (task.status === "queued") {
    return {
      label: displayStatus ?? "Director automático en cola",
      variant: "secondary",
    };
  }
  if (task.status === "failed") {
    return {
      label: displayStatus ?? "El director automático falló",
      variant: "destructive",
    };
  }
  if (task.status === "cancelled") {
    return {
      label: displayStatus ?? "Director automático cancelado",
      variant: "outline",
    };
  }
  return {
    label: displayStatus ?? (task.checkpointType === "workflow_completed"
      ? "Autodirector completado"
      : formatWorkflowCheckpoint(task.checkpointType, task.executionScopeLabel)),
    variant: "outline",
  };
}

export function getWorkflowDescription(task?: NovelAutoDirectorTaskSummary | null): string | null {
  if (!task) {
    return null;
  }
  if (
    (task.status === "queued" || task.status === "running")
    && task.checkpointType === "chapter_batch_ready"
  ) {
    return `La IA continúa ejecutándose en segundo plano${getExecutionScopeLabel(task.executionScopeLabel)}, progreso actual ${Math.round(task.progress * 100)}%.`;
  }
  if ((task.status === "failed" || task.status === "cancelled") && task.checkpointType === "chapter_batch_ready") {
    return `${getExecutionScopeLabel(task.executionScopeLabel)}La ejecución automática se ha suspendido durante la fase por lotes. Se recomienda revisar las tareas antes de decidir si continuar con la ejecución automática.`;
  }
  if (task.blockingReason?.trim()) {
    return task.blockingReason.trim();
  }
  if (task.checkpointSummary?.trim()) {
    return task.checkpointSummary.trim();
  }
  if (task.currentItemLabel?.trim()) {
    return task.currentItemLabel.trim();
  }
  if (task.resumeAction?.trim()) {
    return `Las recomendaciones continúan:${task.resumeAction.trim()}`;
  }
  if (task.nextActionLabel?.trim()) {
    return `Siguiente paso:${task.nextActionLabel.trim()}`;
  }
  return null;
}

export function canContinueDirector(task?: NovelAutoDirectorTaskSummary | null): boolean {
  return Boolean(
    task
      && task.status === "waiting_approval"
      && task.checkpointType !== "candidate_selection_required"
      && task.checkpointType !== "chapter_batch_ready",
  );
}

export function canCancelDirectorTask(
  task?: Pick<WorkflowTaskLike, "status" | "pendingManualRecovery"> | null,
): boolean {
  if (!task) {
    return false;
  }
  if (task.pendingManualRecovery) {
    return true;
  }
  return task.status === "queued"
    || task.status === "running"
    || task.status === "waiting_approval"
    || task.status === "failed";
}

export function requiresCandidateSelection(task?: Pick<WorkflowTaskLike, "status" | "checkpointType"> | null): boolean {
  return Boolean(task && task.status === "waiting_approval" && task.checkpointType === "candidate_selection_required");
}

export function canContinueChapterBatchAutoExecution(task?: NovelAutoDirectorTaskSummary | null): boolean {
  if (!task) {
    return false;
  }
  return (task.status === "failed" || task.status === "cancelled") && task.checkpointType === "chapter_batch_ready";
}

export function canEnterChapterExecution(task?: NovelAutoDirectorTaskSummary | null): boolean {
  return Boolean(
    task
      && (task.checkpointType === "chapter_batch_ready"
        || task.checkpointType === "workflow_completed"),
  );
}

export function isLiveWorkflowTask(task?: NovelAutoDirectorTaskSummary | null): boolean {
  return Boolean(task && LIVE_TASK_STATUSES.has(task.status));
}

export function isWorkflowRunningInBackground(task?: NovelAutoDirectorTaskSummary | null): boolean {
  return Boolean(task && BACKGROUND_RUNNING_TASK_STATUSES.has(task.status));
}

export function isWorkflowActionRequired(task?: NovelAutoDirectorTaskSummary | null): boolean {
  return Boolean(
    task
      && (task.status === "waiting_approval"
        || task.status === "failed"
        || task.status === "cancelled"),
  );
}

export function getTaskCenterLink(taskId: string): string {
  return `/tasks?kind=novel_workflow&id=${taskId}`;
}

export function getCandidateSelectionLink(taskId: string): string {
  return buildCandidateTaskHref(taskId);
}
