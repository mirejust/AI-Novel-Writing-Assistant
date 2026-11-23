import type {
  AutoDirectorAction,
} from "@ai-novel/shared/types/autoDirectorFollowUp";
import type { TaskKind, TaskStatus, UnifiedTaskSummary } from "@ai-novel/shared/types/task";
import type {
  NovelWorkflowMilestoneType,
  NovelWorkflowResumeTarget,
} from "@ai-novel/shared/types/novelWorkflow";
import type { WorkspaceTone } from "@/components/workspace";
import type { TaskQueueSeverity } from "@/components/taskQueue";

export const ACTIVE_STATUSES = new Set<TaskStatus>(["queued", "running", "waiting_approval"]);

export type TaskSortMode = "default" | "updated_desc" | "updated_asc" | "heartbeat_desc" | "heartbeat_asc";

type TaskQueuePresentationInput = Pick<
  UnifiedTaskSummary,
  | "status"
  | "pendingManualRecovery"
  | "checkpointType"
  | "noticeCode"
  | "noticeSummary"
  | "failureCode"
  | "failureSummary"
  | "lastError"
>;

const PIPELINE_QUALITY_REVIEW_CODE = "PIPELINE_QUALITY_REVIEW";
const PIPELINE_REPLAN_REQUIRED_CODE = "PIPELINE_REPLAN_REQUIRED";
const CHAPTER_TITLE_DIVERSITY_CODE = "CHAPTER_TITLE_DIVERSITY";

export function isTaskReplanRequired(task: TaskQueuePresentationInput): boolean {
  return task.checkpointType === "replan_required"
    || task.noticeCode === PIPELINE_REPLAN_REQUIRED_CODE
    || task.failureCode === PIPELINE_REPLAN_REQUIRED_CODE;
}

export function isTaskFailureQualityReminder(task: TaskQueuePresentationInput): boolean {
  return task.failureCode === PIPELINE_QUALITY_REVIEW_CODE
    || task.failureCode === CHAPTER_TITLE_DIVERSITY_CODE;
}

export function isTaskQueueQualityReminder(task: TaskQueuePresentationInput): boolean {
  return task.noticeCode === PIPELINE_QUALITY_REVIEW_CODE
    || task.noticeCode === CHAPTER_TITLE_DIVERSITY_CODE
    || isTaskFailureQualityReminder(task);
}

export function getTaskNoticeSeverity(task: TaskQueuePresentationInput): TaskQueueSeverity {
  if (isTaskReplanRequired(task)) return "blocking";
  if (isTaskQueueQualityReminder(task)) return "quality";
  return "normal";
}

export function getTaskNoticeTitle(task: TaskQueuePresentationInput): string {
  if (isTaskReplanRequired(task)) return "Requiere replanificación";
  if (isTaskQueueQualityReminder(task)) return "Aviso de calidad";
  return "Recordatorio de tarea";
}

export function getTaskListPriority(task: TaskQueuePresentationInput): number {
  const tone = getTaskQueueTone(task);
  if (tone === "danger") return 0;
  if (tone === "warning") return 1;
  if (tone === "info") return 2;
  return 3;
}

export function isTaskMustHandle(task: TaskQueuePresentationInput): boolean {
  return getTaskQueueTone(task) === "danger";
}

export function getTaskQueueTone(task: TaskQueuePresentationInput): WorkspaceTone {
  if (task.pendingManualRecovery || isTaskReplanRequired(task)) {
    return "danger";
  }
  if (task.status === "failed" && !isTaskFailureQualityReminder(task)) {
    return "danger";
  }
  if (isTaskQueueQualityReminder(task)) {
    return "warning";
  }
  if (task.status === "failed") {
    return "danger";
  }
  if (task.failureCode || task.failureSummary) {
    return "warning";
  }
  if (task.status === "waiting_approval" || task.status === "running" || task.noticeCode || task.noticeSummary) {
    return "info";
  }
  if (task.status === "succeeded") {
    return "success";
  }
  return "neutral";
}

export function getTaskQueueLevelLabel(task: TaskQueuePresentationInput): string {
  const tone = getTaskQueueTone(task);
  if (isTaskReplanRequired(task)) return "Requiere replanificación";
  if (task.pendingManualRecovery) return "Necesidad de restaurar";
  if (tone === "danger") return task.status === "failed" ? "Tarea fallida" : "Bloquear";
  if (tone === "warning" && isTaskQueueQualityReminder(task)) return "Aviso de calidad";
  if (tone === "warning") return "para ser operado";
  if (tone === "info") return task.status === "waiting_approval" ? "para ser operado" : "En curso";
  if (tone === "success") return "Completado";
  return "Tareas comunes";
}

export function getTaskQueueSeverity(task: TaskQueuePresentationInput): TaskQueueSeverity {
  const tone = getTaskQueueTone(task);
  if (tone === "danger") return "blocking";
  if (isTaskQueueQualityReminder(task)) return "quality";
  return "normal";
}

export function getTimestamp(value: string | null | undefined): number {
  if (!value) {
    return Number.NaN;
  }
  return new Date(value).getTime();
}

export function formatDate(value: string | null | undefined): string {
  if (!value) {
    return "Sin datos";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Sin datos";
  }
  return date.toLocaleString();
}

export function formatTokenCount(value: number | null | undefined): string {
  return new Intl.NumberFormat("zh-CN").format(Math.max(0, Math.round(value ?? 0)));
}

export function formatKind(kind: TaskKind): string {
  if (kind === "book_analysis") {
    return "Análisis de división de libros";
  }
  if (kind === "novel_workflow") {
    return "Creación novedosa";
  }
  if (kind === "novel_pipeline") {
    return "Nueva línea de montaje";
  }
  if (kind === "knowledge_document") {
    return "Índice de la base de conocimientos";
  }
  if (kind === "style_extraction") {
    return "Extracción de escritura";
  }
  if (kind === "agent_run") {
    return "Agente en ejecución";
  }
  return "Generación de imágenes";
}

export function formatCheckpoint(checkpoint: NovelWorkflowMilestoneType | null | undefined, scopeLabel?: string | null): string {
  const resolvedScopeLabel = scopeLabel?.trim() || "Primeros 10 capitulos";
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
  if (checkpoint === "chapter_batch_ready") {
    return `${resolvedScopeLabel}La ejecución automatizada está en pausa`;
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

export function formatResumeTarget(target: NovelWorkflowResumeTarget | null | undefined): string {
  if (!target) {
    return "Sin datos";
  }
  if (target.route === "/novels/create") {
    return target.mode === "director" ? "Crear página/director automático AI" : "Crear página";
  }
  if (target.stage === "story_macro") {
    return "Página de edición de novelas/planificación macro de historias";
  }
  if (target.stage === "character") {
    return "Página de edición de novela/Preparación de personajes";
  }
  if (target.stage === "outline") {
    return "Página del editor novedoso/estrategia de volumen";
  }
  if (target.stage === "structured") {
    return "Página de edición novedosa/capítulo para romper el ritmo";
  }
  if (target.stage === "chapter") {
    return "Ejecución de página/capítulo de edición novedosa";
  }
  if (target.stage === "pipeline") {
    return "Página de edición novedosa/reparación de calidad.";
  }
  return "Nueva página de edición/configuración del proyecto";
}

export function formatStatus(status: TaskStatus): string {
  if (status === "queued") {
    return "En cola";
  }
  if (status === "running") {
    return "En ejecución";
  }
  if (status === "waiting_approval") {
    return "Esperando aprobación";
  }
  if (status === "succeeded") {
    return "Completado";
  }
  if (status === "failed") {
    return "Error";
  }
  return "Cancelado";
}

export function toStatusVariant(status: TaskStatus): "default" | "outline" | "secondary" | "destructive" {
  if (status === "running") {
    return "default";
  }
  if (status === "waiting_approval") {
    return "secondary";
  }
  if (status === "queued") {
    return "secondary";
  }
  if (status === "failed") {
    return "destructive";
  }
  return "outline";
}

export function serializeListParams(input: {
  kind: TaskKind | "";
  status: TaskStatus | "";
  keyword: string;
}): string {
  return JSON.stringify({
    kind: input.kind || null,
    status: input.status || null,
    keyword: input.keyword.trim() || null,
  });
}

export function createIdempotencyKey(taskId: string, actionCode: string): string {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return `${taskId}:${actionCode}:${globalThis.crypto.randomUUID()}`;
  }
  return `${taskId}:${actionCode}:${Date.now()}:${Math.random().toString(36).slice(2)}`;
}

export function formatFollowUpPriority(priority: "P0" | "P1" | "P2"): string {
  if (priority === "P0") {
    return "P0 Procesar inmediatamente";
  }
  if (priority === "P1") {
    return "P1 Procesar lo más pronto posible";
  }
  return "P2 se puede procesar más tarde";
}

export function followUpActionVariant(action: AutoDirectorAction): "default" | "outline" {
  return action.kind === "navigation" || action.riskLevel !== "low" ? "outline" : "default";
}
