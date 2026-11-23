import type { DirectorCommandAcceptedResponse } from "@ai-novel/shared/types/directorRuntime";
import type { DirectorContinuationMode } from "@ai-novel/shared/types/novelDirector";
import type { UnifiedTaskDetail } from "@ai-novel/shared/types/task";

export function resolveWorkflowContinuationFeedback(
  task: UnifiedTaskDetail | DirectorCommandAcceptedResponse | null | undefined,
  options?: {
    mode?: DirectorContinuationMode;
    scopeLabel?: string | null;
  },
): {
  tone: "success" | "error";
  message: string;
} {
  const requestedScopeLabel = options?.scopeLabel?.trim();
  const taskScopeLabel = task && "executionScopeLabel" in task ? task.executionScopeLabel?.trim() : undefined;
  const scopeLabel = requestedScopeLabel || taskScopeLabel || "Alcance del capítulo actual";

  if (task && "kind" in task && task.status === "failed") {
    return {
      tone: "error",
      message: task.failureSummary?.trim()
        || task.blockingReason?.trim()
        || task.lastError?.trim()
        || (options?.mode === "auto_execute_range"
          ? `Continuar la ejecución automática${scopeLabel}falló.`
          : "No se pudo reanudar el director automático."),
    };
  }

  return {
    tone: "success",
    message: options?.mode === "skip_quality_repair"
      ? `Esta recomendación de calidad se ha omitido y el director automático seguirá ejecutándola.${scopeLabel}.`
      : options?.mode === "auto_execute_range"
          ? `La ejecución automática ha continuado.${scopeLabel}.`
          : "Autodirector ha seguido adelante.",
  };
}

export function resolveDirectorContinueMode(task: Pick<
  UnifiedTaskDetail,
  "checkpointType" | "currentItemKey" | "currentStage" | "pendingManualRecovery"
> | null | undefined): DirectorContinuationMode {
  if (task?.pendingManualRecovery) {
    return "resume";
  }
  if (task?.checkpointType === "replan_required") {
    return "auto_execute_range";
  }
  if (
    task?.currentItemKey === "quality_repair"
    || task?.currentStage?.includes("Calidad")
  ) {
    return "skip_quality_repair";
  }
  if (task?.checkpointType === "chapter_batch_ready") {
    return "auto_execute_range";
  }
  return "resume";
}
