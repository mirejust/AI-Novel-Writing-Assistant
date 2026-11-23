import type {
  AutoDirectorAction,
  AutoDirectorFollowUpItem,
  AutoDirectorFollowUpOverview,
  AutoDirectorFollowUpPriority,
  AutoDirectorFollowUpReason,
} from "@ai-novel/shared/types/autoDirectorFollowUp";
import type { AutoDirectorFollowUpSection } from "@ai-novel/shared/types/autoDirectorValidation";
import type { WorkspaceTone } from "@/components/workspace";
import type { TaskQueueSeverity } from "@/components/taskQueue";

export function resolveFollowUpOverviewPresentation(
  overview: AutoDirectorFollowUpOverview | null,
): {
  criticalCount: number;
  pendingActionCount: number;
  progressCount: number;
  replanCount: number;
  recommendedSection: AutoDirectorFollowUpSection | "";
} {
  const needsValidationCount = overview?.countersBySection.needs_validation ?? 0;
  const manualRecoveryCount = overview?.countersByReason.manual_recovery_required ?? 0;
  const runtimeFailedCount = overview?.countersByReason.runtime_failed ?? 0;
  const blockingExceptionCount = manualRecoveryCount + runtimeFailedCount;
  const replanCount = overview?.countersByReason.replan_required ?? 0;
  const criticalCount = needsValidationCount + blockingExceptionCount + replanCount;
  const pendingCount = overview?.countersBySection.pending ?? 0;
  const pendingActionCount = Math.max(0, pendingCount - replanCount);
  const progressCount = overview?.countersBySection.auto_progress ?? 0;
  const recommendedSection: AutoDirectorFollowUpSection | "" = replanCount > 0
    ? "pending"
    : needsValidationCount > 0
      ? "needs_validation"
      : blockingExceptionCount > 0
        ? "exception"
        : pendingActionCount > 0
          ? "pending"
          : progressCount > 0
            ? "auto_progress"
            : "";
  return {
    criticalCount,
    pendingActionCount,
    progressCount,
    replanCount,
    recommendedSection,
  };
}

export function getFollowUpTone(item: Pick<
  AutoDirectorFollowUpItem,
  "section" | "reason" | "priority" | "itemType" | "pendingManualRecovery"
>): WorkspaceTone {
  if (item.reason === "quality_repair_pending") {
    return "warning";
  }
  if (
    item.pendingManualRecovery
    || item.reason === "manual_recovery_required"
    || item.reason === "runtime_failed"
    || item.reason === "replan_required"
    || item.reason === "validation_required"
  ) {
    return "danger";
  }
  if (item.reason === "runtime_cancelled" || item.reason === "runtime_replaced") {
    return "neutral";
  }
  if (item.reason === "auto_approval_completed") {
    return "success";
  }
  if (item.priority === "P0") {
    return "danger";
  }
  if (
    item.reason === "candidate_selection_required"
    || item.reason === "chapter_batch_execution_pending"
    || item.reason === "auto_progress_running"
  ) {
    return "info";
  }
  if (item.section === "auto_progress") {
    return item.itemType === "auto_approval_record" ? "success" : "info";
  }
  return item.section === "needs_validation" ? "danger" : "neutral";
}

export function getFollowUpLevelLabel(item: Pick<
  AutoDirectorFollowUpItem,
  "section" | "reason" | "priority" | "itemType" | "pendingManualRecovery"
>): string {
  const tone = getFollowUpTone(item);
  if (item.reason === "replan_required") return "Requiere replanificación";
  if (item.pendingManualRecovery || item.reason === "manual_recovery_required") return "Necesidad de restaurar";
  if (item.reason === "runtime_failed") return "Tarea fallida";
  if (item.reason === "validation_required") return "Necesito verificar";
  if (item.reason === "runtime_cancelled") return "Cancelado";
  if (item.reason === "runtime_replaced") return "Reemplazado";
  if (tone === "danger") return "Bloquear";
  if (item.reason === "quality_repair_pending") return "Aviso de calidad";
  if (item.reason === "candidate_selection_required" || item.reason === "chapter_batch_execution_pending") return "para ser operado";
  if (tone === "info") return "Avance automático";
  if (tone === "success") return "Aprobado automáticamente";
  return "Registros ordinarios";
}

export function getFollowUpSeverity(item: Pick<
  AutoDirectorFollowUpItem,
  "section" | "reason" | "priority" | "itemType" | "pendingManualRecovery"
>): TaskQueueSeverity {
  const tone = getFollowUpTone(item);
  if (tone === "danger") return "blocking";
  if (item.reason === "quality_repair_pending") return "quality";
  return "normal";
}

export function getFollowUpPriorityLabel(
  priority: AutoDirectorFollowUpPriority,
  reason?: AutoDirectorFollowUpReason,
): string {
  if (reason === "replan_required") return "Procesar inmediatamente";
  if (reason === "runtime_cancelled") return "Se puede restaurar a pedido";
  if (reason === "runtime_replaced") return "Historia";
  if (reason === "quality_repair_pending") return "Se puede procesar más tarde";
  if (priority === "P0") return "Procesar inmediatamente";
  if (priority === "P1") return "Procesar lo antes posible";
  return "Se puede procesar más tarde";
}

export function getFollowUpActionConsequence(action: AutoDirectorAction): string {
  if (action.kind === "navigation") {
    return "Solo se abrirá la página de procesamiento correspondiente y no se cambiará el estado actual de la tarea del director.";
  }
  if (action.code === "continue_auto_execution") {
    return "Envía un comando de continuación a la tarea del director actual y avanza el alcance de la ejecución automática desde el punto de control existente.";
  }
  if (action.code === "continue_generic") {
    return "Envía un comando de reanudación a la tarea de director actual y continúa desde una posición reanudable.";
  }
  if (action.code === "retry_with_task_model") {
    return "Vuelva a poner en cola utilizando el modelo guardado por la tarea y otras tareas del espacio de trabajo no se considerarán la tarea del director actual.";
  }
  if (action.code === "retry_with_route_model") {
    return "Vuelva a ejecutar utilizando el enrutamiento del modelo actual; la operación requiere confirmación nuevamente.";
  }
  if (action.code === "auto_backfill_structured_outline") {
    return "Complete los activos del capítulo faltantes verificados mediante verificación y luego continúe con la tarea actual del director.";
  }
  return "Solo realiza reparaciones estatales declaradas de bajo riesgo por la verificación, sin confirmar candidatos ni reescribir el texto para el usuario.";
}

export function getFollowUpActionTone(action: AutoDirectorAction): WorkspaceTone {
  if (action.riskLevel === "high") return "danger";
  if (action.riskLevel === "medium" || action.requiresConfirm) return "warning";
  return action.kind === "mutation" ? "info" : "neutral";
}

export function getFollowUpActionRiskDescription(action: AutoDirectorAction): string {
  if (action.riskLevel === "high") {
    return "Superior, verifique el alcance del impacto antes de ejecutar.";
  }
  if (action.riskLevel === "medium" || action.requiresConfirm) {
    return "Se requiere confirmación; verifique la tarea y el alcance de la escritura antes de enviarla.";
  }
  return action.kind === "navigation"
    ? "Bajo riesgo, simplemente abra la página de procesamiento."
    : "Riesgo bajo, solo realice acciones seguras indicadas en la misión actual.";
}
