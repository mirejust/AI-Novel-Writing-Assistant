import type {
  NovelWorkflowCheckpoint,
  NovelWorkflowStage,
} from "@ai-novel/shared/types/novelWorkflow";
import type { TaskStatus } from "@ai-novel/shared/types/task";
import { isAutoDirectorRecoveryInProgress } from "../novel/workflow/novelWorkflowRecoveryHeuristics";
import { normalizeFailureSummary } from "./taskSupport";
import { NOVEL_WORKFLOW_STAGE_LABELS } from "../novel/workflow/novelWorkflow.shared";

interface WorkflowExplainabilityInput {
  status: TaskStatus;
  pendingManualRecovery?: boolean | null;
  currentStage?: string | null;
  currentItemKey?: string | null;
  checkpointType?: NovelWorkflowCheckpoint | null;
  lastError?: string | null;
  executionScopeLabel?: string | null;
}

export interface WorkflowExplainabilitySummary {
  displayStatus: string | null;
  blockingReason: string | null;
  resumeAction: string | null;
  lastHealthyStage: string | null;
}

const WORKFLOW_ITEM_STAGE_MAP: Partial<Record<string, NovelWorkflowStage>> = {
  project_setup: "project_setup",
  auto_director: "auto_director",
  candidate_seed_alignment: "auto_director",
  candidate_project_framing: "auto_director",
  candidate_direction_batch: "auto_director",
  candidate_title_pack: "auto_director",
  novel_create: "project_setup",
  book_contract: "story_macro",
  story_macro: "story_macro",
  constraint_engine: "story_macro",
  character_setup: "character_setup",
  character_cast_apply: "character_setup",
  volume_strategy: "volume_strategy",
  volume_skeleton: "volume_strategy",
  beat_sheet: "structured_outline",
  chapter_list: "structured_outline",
  chapter_sync: "structured_outline",
  chapter_detail_bundle: "structured_outline",
  structured_outline: "structured_outline",
  chapter_execution: "chapter_execution",
  quality_repair: "quality_repair",
};

const CHECKPOINT_DISPLAY_STATUS: Record<NovelWorkflowCheckpoint, string> = {
  candidate_selection_required: "Esperando confirmación de la dirección del libro",
  book_contract_ready: "El contrato del libro está listo",
  character_setup_required: "Preparación de personajes pendiente de revisión",
  volume_strategy_ready: "Estrategia de volumen pendiente de revisión",
  production_experience_required: "Listo para empezar a escribir, esperando seleccionar el método de producción.",
  chapter_batch_ready: "Los capítulos han sido preparados y se pueden ejecutar.",
  step_review_required: "Paso actual a comprobar",
  replan_required: "Esperando replanificación",
  workflow_completed: "Autodirector completado",
};

const CHECKPOINT_BLOCKING_REASON: Record<NovelWorkflowCheckpoint, string> = {
  candidate_selection_required: "La dirección a nivel de libro debe confirmarse primero antes de que el director automático pueda continuar avanzando en la cadena principal posterior.",
  book_contract_ready: "Se ha generado el Contrato de Libro y es necesario confirmar los compromisos principales antes de continuar con la planificación posterior.",
  character_setup_required: "Se ha generado la preparación de los personajes y es necesario revisar la alineación de los personajes antes de continuar.",
  volume_strategy_ready: "La estrategia de volumen y el esqueleto de volumen están listos y es necesario confirmar el plan de promoción de volumen antes de continuar.",
  production_experience_required: "El director automático ha completado los preparativos para la producción de texto y debe elegir entre creación simple o creación profesional.",
  chapter_batch_ready: "Se han preparado los recursos de apertura y ejecución del capítulo para todo el capítulo, y puede ingresar a la ejecución del capítulo o continuar ejecutando automáticamente el alcance actual.",
  step_review_required: "El paso director actual se ha generado y debe verificarse o confirmarse antes de continuar con el siguiente paso.",
  replan_required: "Los resultados de la auditoría requieren una gran planificación antes de poder continuar con los capítulos siguientes.",
  workflow_completed: "De forma predeterminada, el proceso principal se ha ejecutado y puede ingresar directamente a la ejecución del capítulo para continuar escribiendo.",
};

const CHECKPOINT_LAST_HEALTHY_STAGE: Record<NovelWorkflowCheckpoint, NovelWorkflowStage> = {
  candidate_selection_required: "auto_director",
  book_contract_ready: "story_macro",
  character_setup_required: "character_setup",
  volume_strategy_ready: "volume_strategy",
  production_experience_required: "structured_outline",
  chapter_batch_ready: "structured_outline",
  step_review_required: "auto_director",
  replan_required: "quality_repair",
  workflow_completed: "quality_repair",
};

function getExecutionScopeLabel(input: WorkflowExplainabilityInput, fallback = "Capítulo 1-10"): string {
  return input.executionScopeLabel?.trim() || fallback;
}

function buildAutoExecutionPreparedStatus(input: WorkflowExplainabilityInput): string {
  return `${getExecutionScopeLabel(input)}Se puede ingresar la ejecución del capítulo.`;
}

function buildAutoExecutionRunningStatus(input: WorkflowExplainabilityInput): string {
  return `${getExecutionScopeLabel(input)}Ejecutando automáticamente`;
}

function buildAutoExecutionPausedStatus(input: WorkflowExplainabilityInput): string {
  return `${getExecutionScopeLabel(input)}La ejecución automatizada está en pausa`;
}

function buildAutoExecutionCancelledStatus(input: WorkflowExplainabilityInput): string {
  return `${getExecutionScopeLabel(input)}Ejecución automática cancelada`;
}

function buildAutoExecutionResumeAction(input: WorkflowExplainabilityInput): string {
  return `Continuar la ejecución automática${getExecutionScopeLabel(input)}`;
}

function buildAutoExecutionPreparedReason(input: WorkflowExplainabilityInput): string {
  const scopeLabel = getExecutionScopeLabel(input);
  return `${scopeLabel}El refinamiento está listo. Puede ingresar al capítulo para ejecutar o continuar dejando que el sistema lo ejecute automáticamente.${scopeLabel}.`;
}

function buildAutoExecutionPausedReason(input: WorkflowExplainabilityInput): string {
  return `${getExecutionScopeLabel(input)}La ejecución automática se ha suspendido durante la fase por lotes. Se recomienda verificar los resultados antes de decidir si continuar ejecutando automáticamente el rango actual.`;
}

function isPreparedChapterBatchCheckpoint(input: WorkflowExplainabilityInput): boolean {
  return input.checkpointType === "chapter_batch_ready" && input.status === "waiting_approval";
}

function isPausedChapterBatchCheckpoint(input: WorkflowExplainabilityInput): boolean {
  return input.checkpointType === "chapter_batch_ready"
    && (input.status === "failed" || input.status === "cancelled");
}

function getStageLabel(stage: NovelWorkflowStage | null | undefined): string | null {
  return stage ? (NOVEL_WORKFLOW_STAGE_LABELS[stage] ?? stage) : null;
}

function getLastHealthyStage(input: WorkflowExplainabilityInput): string | null {
  if (isPreparedChapterBatchCheckpoint(input)) {
    return getStageLabel("structured_outline");
  }
  if (isPausedChapterBatchCheckpoint(input)) {
    return getStageLabel("chapter_execution");
  }
  if (input.checkpointType) {
    return getStageLabel(CHECKPOINT_LAST_HEALTHY_STAGE[input.checkpointType]);
  }
  const mappedStage = input.currentItemKey ? WORKFLOW_ITEM_STAGE_MAP[input.currentItemKey] : null;
  if (mappedStage) {
    return getStageLabel(mappedStage);
  }
  return input.currentStage?.trim() || null;
}

function getCurrentStageLabel(input: WorkflowExplainabilityInput): string | null {
  const mappedStage = input.currentItemKey ? WORKFLOW_ITEM_STAGE_MAP[input.currentItemKey] : null;
  if (mappedStage) {
    return getStageLabel(mappedStage);
  }
  if (input.currentStage && input.currentStage in NOVEL_WORKFLOW_STAGE_LABELS) {
    return getStageLabel(input.currentStage as NovelWorkflowStage);
  }
  return input.currentStage?.trim() || null;
}

export function buildWorkflowResumeAction(
  status: TaskStatus,
  checkpointType: NovelWorkflowCheckpoint | null,
  executionScopeLabel?: string | null,
  pendingManualRecovery?: boolean | null,
): string | null {
  const explainabilityInput = {
    status,
    checkpointType,
    executionScopeLabel,
    pendingManualRecovery,
  } satisfies WorkflowExplainabilityInput;
  if (status === "waiting_approval") {
    if (checkpointType === "candidate_selection_required") {
      return "Continúe confirmando la dirección a nivel de libro.";
    }
    if (checkpointType === "book_contract_ready") {
      return "Ver contrato de reserva";
    }
    if (checkpointType === "character_setup_required") {
      return "Ir a revisar la preparación del rol";
    }
    if (checkpointType === "volume_strategy_ready") {
      return "Ver estrategia de volumen";
    }
    if (checkpointType === "chapter_batch_ready") {
      return buildAutoExecutionResumeAction(explainabilityInput);
    }
    if (checkpointType === "replan_required") {
      return "Manejar una planificación pesada";
    }
    if (checkpointType === "workflow_completed") {
      return "Ir a la ejecución del capítulo";
    }
    return "Continúa el flujo principal de la novela.";
  }
  if (explainabilityInput.pendingManualRecovery) {
    return "Restaurar desde el último punto de control";
  }
  if (status === "failed" || status === "cancelled") {
    if (checkpointType === "chapter_batch_ready") {
      return buildAutoExecutionResumeAction(explainabilityInput);
    }
    if (checkpointType === "workflow_completed") {
      return "Ir a la ejecución del capítulo";
    }
    return "Restaurar desde el último punto de control";
  }
  if (status === "running" || status === "queued") {
    return "Ver el progreso actual";
  }
  if (status === "succeeded" && checkpointType === "workflow_completed") {
    return "Ir a la ejecución del capítulo";
  }
  return null;
}

function buildDisplayStatus(input: WorkflowExplainabilityInput): string | null {
  if (input.pendingManualRecovery) {
    return "Esperando recuperación manual";
  }
  if (isAutoDirectorRecoveryInProgress(input)) {
    const currentStageLabel = getCurrentStageLabel(input);
    return currentStageLabel
      ? `${currentStageLabel}Recuperante`
      : "Recuperación automática del director en curso";
  }
  if (
    (input.status === "queued" || input.status === "running")
    && input.checkpointType === "chapter_batch_ready"
  ) {
    return buildAutoExecutionRunningStatus(input);
  }
  if (input.status === "waiting_approval") {
    if (input.checkpointType === "chapter_batch_ready") {
      return buildAutoExecutionPreparedStatus(input);
    }
    return input.checkpointType
      ? CHECKPOINT_DISPLAY_STATUS[input.checkpointType]
      : "Esperando continuar el flujo principal de la novela.";
  }
  if (input.status === "running") {
    const currentStageLabel = getCurrentStageLabel(input);
    return currentStageLabel
      ? `${currentStageLabel}En curso`
      : "Director automático en progreso";
  }
  if (input.status === "queued") {
    return "Director automático en cola";
  }
  if (input.status === "failed") {
    if (input.checkpointType === "chapter_batch_ready") {
      return buildAutoExecutionPausedStatus(input);
    }
    return "La ejecución automática del director falló";
  }
  if (input.status === "cancelled") {
    if (input.checkpointType === "chapter_batch_ready") {
      return buildAutoExecutionCancelledStatus(input);
    }
    return "Director automático cancelado";
  }
  if (input.checkpointType === "workflow_completed") {
    return "Autodirector completado";
  }
  return input.status === "succeeded" ? "El flujo principal de la novela se ha completado." : null;
}

function buildBlockingReason(input: WorkflowExplainabilityInput): string | null {
  if (input.pendingManualRecovery) {
    return input.lastError?.trim() || "Una vez reiniciado el servicio, la tarea se suspendió y está esperando la recuperación manual.";
  }
  if (isAutoDirectorRecoveryInProgress(input)) {
    return input.lastError?.trim() || "Las tareas automáticas del director se reanudan tras el reinicio del servicio.";
  }
  if (input.status === "running" || input.status === "succeeded") {
    return null;
  }
  if (input.status === "queued") {
    return "La tarea se ha puesto en cola y está esperando que los subprocesos de trabajo y los recursos del modelo estén disponibles.";
  }
  if (input.status === "waiting_approval") {
    if (input.checkpointType === "chapter_batch_ready") {
      return buildAutoExecutionPreparedReason(input);
    }
    return input.checkpointType
      ? CHECKPOINT_BLOCKING_REASON[input.checkpointType]
      : "El proceso actual se detuvo en un punto de control de seguridad y no puede continuar hasta que se procese la etapa actual.";
  }
  if (input.status === "failed") {
    if (input.checkpointType === "chapter_batch_ready") {
      return `${getExecutionScopeLabel(input)}La ejecución automática se interrumpió durante la fase por lotes y se recomienda reanudar la recuperación desde la fase saludable más reciente.`;
    }
    return normalizeFailureSummary(input.lastError, "La ejecución de la etapa actual falló; se recomienda restaurar desde el último punto de control.");
  }
  if (input.status === "cancelled") {
    if (input.checkpointType === "chapter_batch_ready") {
      return `${getExecutionScopeLabel(input)}La ejecución automática ha sido cancelada. Si necesita continuar, puede reanudar desde la etapa de salud más reciente.`;
    }
    return "La tarea ha sido cancelada. Si aún necesita continuar, puede continuar desde el último punto de control.";
  }
  return null;
}

export function buildWorkflowExplainability(input: WorkflowExplainabilityInput): WorkflowExplainabilitySummary {
  return {
    displayStatus: buildDisplayStatus(input),
    blockingReason: buildBlockingReason(input),
    resumeAction: buildWorkflowResumeAction(
      input.status,
      input.checkpointType ?? null,
      input.executionScopeLabel,
      input.pendingManualRecovery,
    ),
    lastHealthyStage: getLastHealthyStage(input),
  };
}
