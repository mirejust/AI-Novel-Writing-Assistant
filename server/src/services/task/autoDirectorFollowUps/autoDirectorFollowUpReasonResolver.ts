import type {
  AutoDirectorAction,
  AutoDirectorActionCode,
  AutoDirectorFollowUpReason,
  AutoDirectorFollowUpResolverInput,
  AutoDirectorMutationActionCode,
  AutoDirectorResolvedFollowUpReason,
} from "@ai-novel/shared/types/autoDirectorFollowUp";
import { buildWorkflowResumeAction } from "../novelWorkflowExplainability";

const CHANNEL_ACTION_CODES = new Set<AutoDirectorActionCode>([
  "continue_auto_execution",
  "retry_with_task_model",
  "open_detail",
  "open_follow_up_center",
]);

const REASON_LABELS: Record<AutoDirectorFollowUpReason, string> = {
  manual_recovery_required: "Recuperación manual pendiente",
  runtime_failed: "No se pudo volver a intentar",
  candidate_selection_required: "Dirección del nivel del libro por confirmar.",
  replan_required: "Pendiente de replanificación",
  runtime_cancelled: "Cancelado pendiente de restauración",
  chapter_batch_execution_pending: "La ejecución automática continuará",
  quality_repair_pending: "Las correcciones de calidad continuarán",
  auto_progress_running: "Avanzando automáticamente",
  auto_approval_completed: "Aprobado recientemente automáticamente",
  runtime_replaced: "La tarea ha sido reemplazada",
  validation_required: "Necesito volver a comprobar",
};

function mutationAction(input: {
  code: AutoDirectorMutationActionCode;
  label: string;
  riskLevel: AutoDirectorAction["riskLevel"];
  requiresConfirm: boolean;
}): AutoDirectorAction {
  return {
    code: input.code,
    kind: "mutation",
    label: input.label,
    riskLevel: input.riskLevel,
    requiresConfirm: input.requiresConfirm,
  };
}

function navigationAction(input: {
  code: Extract<AutoDirectorActionCode, "go_replan" | "go_candidate_selection" | "open_detail" | "open_follow_up_center">;
  label: string;
  riskLevel?: AutoDirectorAction["riskLevel"];
  requiresConfirm?: boolean;
}): AutoDirectorAction {
  return {
    code: input.code,
    kind: "navigation",
    label: input.label,
    riskLevel: input.riskLevel ?? "low",
    requiresConfirm: input.requiresConfirm ?? false,
  };
}

function getContinueLabel(input: AutoDirectorFollowUpResolverInput, fallback: string): string {
  return buildWorkflowResumeAction(input.status, input.checkpointType ?? null, input.executionScopeLabel) ?? fallback;
}

function finalizeResolvedReason(input: {
  reason: AutoDirectorFollowUpReason;
  priority: AutoDirectorResolvedFollowUpReason["priority"];
  availableActions: AutoDirectorAction[];
  batchActionCodes?: AutoDirectorMutationActionCode[];
}): AutoDirectorResolvedFollowUpReason {
  const batchActionCodes = input.batchActionCodes ?? [];
  const hasChannelAction = input.availableActions.some((item) => CHANNEL_ACTION_CODES.has(item.code));

  return {
    reason: input.reason,
    reasonLabel: REASON_LABELS[input.reason],
    priority: input.priority,
    availableActions: input.availableActions,
    batchActionCodes,
    supportsBatch: batchActionCodes.length > 0,
    channelCapabilities: {
      dingtalk: hasChannelAction,
      wecom: hasChannelAction,
      feishu: hasChannelAction,
    },
  };
}

export function resolveAutoDirectorFollowUpReason(
  input: AutoDirectorFollowUpResolverInput,
): AutoDirectorResolvedFollowUpReason | null {
  if (input.validationResult && !input.validationResult.allowed) {
    const hasStructuredBackfill = input.validationResult.requiredActions.some((action) => (
      action.code === "auto_backfill_structured_outline"
      && action.safeToAutoFix === true
      && action.riskLevel === "low"
    ));
    const hasSafeFix = input.validationResult.requiredActions.some((action) => (
      action.code !== "auto_backfill_structured_outline"
      && action.safeToAutoFix === true
      && action.riskLevel === "low"
    ));
    return finalizeResolvedReason({
      reason: "validation_required",
      priority: "P0",
      availableActions: [
        navigationAction({
          code: "open_detail",
          label: "Ver resultados de verificación",
        }),
        ...(hasStructuredBackfill
          ? [
            mutationAction({
              code: "auto_backfill_structured_outline",
              label: "Deje que AI complete las divisiones de capítulo antes de continuar.",
              riskLevel: "low",
              requiresConfirm: false,
            }),
          ]
          : []),
        ...(hasSafeFix
          ? [
            mutationAction({
              code: "safe_fix_validation",
              label: "Reparación de seguridad con un clic",
              riskLevel: "low",
              requiresConfirm: true,
            }),
          ]
          : []),
      ],
    });
  }

  if (input.replacementTaskId?.trim() && input.status !== "failed" && input.status !== "waiting_approval" && input.status !== "running" && input.status !== "queued") {
    return finalizeResolvedReason({
      reason: "runtime_replaced",
      priority: "P2",
      availableActions: [
        navigationAction({
          code: "open_detail",
          label: "Ver detalles alternativos",
        }),
      ],
    });
  }

  if (input.pendingManualRecovery) {
    return finalizeResolvedReason({
      reason: "manual_recovery_required",
      priority: "P0",
      availableActions: [
        mutationAction({
          code: "continue_generic",
          label: "tarea de recuperación",
          riskLevel: "low",
          requiresConfirm: false,
        }),
        navigationAction({
          code: "open_detail",
          label: "comprobar los detalles",
        }),
      ],
    });
  }

  if (input.status === "queued" || input.status === "running") {
    return finalizeResolvedReason({
      reason: "auto_progress_running",
      priority: "P2",
      availableActions: [
        navigationAction({
          code: "open_detail",
          label: "Ver detalles de avance",
        }),
      ],
    });
  }

  if (input.status === "failed") {
    return finalizeResolvedReason({
      reason: "runtime_failed",
      priority: "P0",
      availableActions: [
        mutationAction({
          code: "retry_with_task_model",
          label: "Reintentar por modelo de tarea",
          riskLevel: "low",
          requiresConfirm: false,
        }),
        mutationAction({
          code: "retry_with_route_model",
          label: "Reintentar por modelo de enrutamiento",
          riskLevel: "medium",
          requiresConfirm: true,
        }),
        navigationAction({
          code: "open_detail",
          label: "comprobar los detalles",
        }),
      ],
      batchActionCodes: ["retry_with_task_model"],
    });
  }

  if (input.status === "cancelled") {
    return finalizeResolvedReason({
      reason: "runtime_cancelled",
      priority: "P1",
      availableActions: [
        mutationAction({
          code: "retry_with_task_model",
          label: getContinueLabel(input, "Restaurar desde el último punto de control"),
          riskLevel: "low",
          requiresConfirm: false,
        }),
        mutationAction({
          code: "retry_with_route_model",
          label: "Reintentar por modelo de enrutamiento",
          riskLevel: "medium",
          requiresConfirm: true,
        }),
        navigationAction({
          code: "open_detail",
          label: "comprobar los detalles",
        }),
      ],
      batchActionCodes: ["retry_with_task_model"],
    });
  }

  if (input.status !== "waiting_approval") {
    return null;
  }

  if (input.checkpointType === "candidate_selection_required") {
    return finalizeResolvedReason({
      reason: "candidate_selection_required",
      priority: "P1",
      availableActions: [
        navigationAction({
          code: "go_candidate_selection",
          label: getContinueLabel(input, "Ir a confirmar la dirección del nivel del libro"),
        }),
        navigationAction({
          code: "open_detail",
          label: "comprobar los detalles",
        }),
      ],
    });
  }

  if (input.checkpointType === "replan_required") {
    return finalizeResolvedReason({
      reason: "replan_required",
      priority: "P1",
      availableActions: [
        navigationAction({
          code: "go_replan",
          label: getContinueLabel(input, "Manejar una planificación pesada"),
        }),
        navigationAction({
          code: "open_detail",
          label: "comprobar los detalles",
        }),
      ],
    });
  }

  if (input.checkpointType === "chapter_batch_ready" && input.status === "waiting_approval") {
    return finalizeResolvedReason({
      reason: "chapter_batch_execution_pending",
      priority: "P2",
      availableActions: [
        mutationAction({
          code: "continue_auto_execution",
          label: getContinueLabel(input, "Continuar ejecutando automáticamente el alcance actual"),
          riskLevel: "low",
          requiresConfirm: false,
        }),
        navigationAction({
          code: "open_detail",
          label: "comprobar los detalles",
        }),
      ],
      batchActionCodes: ["continue_auto_execution"],
    });
  }

  if (input.checkpointType === "chapter_batch_ready") {
    return finalizeResolvedReason({
      reason: "quality_repair_pending",
      priority: "P2",
      availableActions: [
        mutationAction({
          code: "continue_auto_execution",
          label: getContinueLabel(input, "Continuar ejecutando automáticamente el alcance actual"),
          riskLevel: "low",
          requiresConfirm: false,
        }),
        navigationAction({
          code: "open_detail",
          label: "comprobar los detalles",
        }),
      ],
      batchActionCodes: ["continue_auto_execution"],
    });
  }

  return null;
}
