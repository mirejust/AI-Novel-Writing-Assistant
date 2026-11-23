import type {
  AgentRunStartInput,
  PlannedAction,
  StructuredIntent,
  ToolCall,
  ToolExecutionContext,
} from "../types";
import type { AgentToolError } from "../types";
import type { AgentToolErrorCode } from "@ai-novel/shared/types/agent";

export interface ToolExecutionResult {
  tool: ToolCall["tool"];
  success: boolean;
  summary: string;
  output?: Record<string, unknown>;
  errorCode?: AgentToolErrorCode;
  stepId?: string;
}

export interface SerializedContinuationPayload {
  goal: string;
  structuredIntent?: StructuredIntent;
  context: Omit<ToolExecutionContext, "runId" | "agentName">;
  plannedActions: PlannedAction[];
}

export interface RunMetadata {
  contextMode: AgentRunStartInput["contextMode"];
  worldId?: string;
  provider?: AgentRunStartInput["provider"];
  model?: string;
  temperature?: number;
  maxTokens?: number;
  messages?: AgentRunStartInput["messages"];
  parentRunId?: string;
  replayFromStepId?: string;
  plannerIntent?: StructuredIntent;
}

export const APPROVAL_TTL_MS = 1000 * 60 * 30;
export const MAX_TOOL_RETRIES = 1;
export const TERMINAL_STATUSES = new Set(["succeeded", "failed", "cancelled"]);

export function safeJson(value: unknown): string {
  try {
    return JSON.stringify(value ?? {});
  } catch {
    return JSON.stringify({ error: "serialize_failed" });
  }
}

export function asObject(value: string | null | undefined): Record<string, unknown> {
  if (!value?.trim()) {
    return {};
  }
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }
    return parsed as Record<string, unknown>;
  } catch {
    return {};
  }
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

export function extractErrorCode(error: unknown): AgentToolErrorCode {
  if ((error as AgentToolError)?.name === "AgentToolError" && typeof (error as AgentToolError).code === "string") {
    return (error as AgentToolError).code;
  }
  return "INTERNAL";
}

export function canRetry(errorCode: AgentToolErrorCode): boolean {
  return errorCode === "TIMEOUT" || errorCode === "INTERNAL";
}

export function summarizeOutput(tool: string, output: Record<string, unknown>): string {
  if (typeof output.summary === "string" && output.summary.trim()) {
    return output.summary;
  }
  if (tool === "list_novels") {
    const items = Array.isArray(output.items) ? output.items : [];
    return `Leer ${items.length} Esta novela.`;
  }
  if (tool === "create_novel") {
    const title = typeof output.title === "string" ? output.title : "";
    const stage = typeof (output.setup as Record<string, unknown> | undefined)?.stage === "string"
      ? String((output.setup as Record<string, unknown>).stage)
      : "";
    if (title && stage === "ready_for_production") {
      return `La novela "${title}», se completa la inicialización.`;
    }
    return title ? `La novela "${title}» e ingrese al arranque de inicialización.` : "Novela creada.";
  }
  if (tool === "select_novel_workspace") {
    const title = typeof output.title === "string" ? output.title : "";
    const stage = typeof (output.setup as Record<string, unknown> | undefined)?.stage === "string"
      ? String((output.setup as Record<string, unknown>).stage)
      : "";
    if (title && stage !== "ready_for_production") {
      return `Cambiado a la novela "${title}», la inicialización actual continúa.`;
    }
    return title ? `Cambiado a la novela "${title}».` : "Cambiado a novela de destino.";
  }
  if (tool === "bind_world_to_novel") {
    const worldName = typeof output.worldName === "string" ? output.worldName.trim() : "";
    const novelTitle = typeof output.novelTitle === "string" ? output.novelTitle.trim() : "";
    if (worldName && novelTitle) {
      return `La visión del mundo ha sido${worldName}"Unido a la novela"${novelTitle}».`;
    }
    if (worldName) {
      return `Visión del mundo limitada«${worldName}».`;
    }
    return "Se ha completado la vinculación de la visión del mundo.";
  }
  if (tool === "unbind_world_from_novel") {
    const previousWorldName = typeof output.previousWorldName === "string" ? output.previousWorldName.trim() : "";
    const novelTitle = typeof output.novelTitle === "string" ? output.novelTitle.trim() : "";
    if (previousWorldName && novelTitle) {
      return `La visión del mundo ha sido${previousWorldName}"De la novela"${novelTitle}"Desatar.`;
    }
    if (novelTitle) {
      return `novedoso"${novelTitle}»Actualmente no existe ninguna visión del mundo limitada.`;
    }
    return "Se ha procesado la desagregación de la visión del mundo.";
  }
  if (tool === "generate_world_for_novel") {
    const worldName = typeof output.worldName === "string" ? output.worldName.trim() : "";
    return worldName ? `Se ha generado una cosmovisión${worldName}».` : "Se ha generado la visión del mundo de la novela.";
  }
  if (tool === "generate_novel_characters") {
    return `Generado ${String(output.characterCount ?? 0)} un papel central.`;
  }
  if (tool === "generate_story_bible") {
    return "Se ha generado una biblia novedosa.";
  }
  if (tool === "generate_novel_outline") {
    return "La tendencia de desarrollo de las novelas generadas.";
  }
  if (tool === "generate_structured_outline") {
    return `Generado ${String(output.targetChapterCount ?? output.chapterCount ?? 0)} Esquema estructurado del capítulo.`;
  }
  if (tool === "sync_chapters_from_structured_outline") {
    return `Sincronizado ${String(output.chapterCount ?? 0)} Tabla de contenido.`;
  }
  if (tool === "start_full_novel_pipeline" || tool === "get_novel_production_status") {
    return typeof output.summary === "string" ? output.summary : `${tool} Ejecución completa.`;
  }
  if (
    tool === "analyze_director_workspace"
    || tool === "get_director_run_status"
    || tool === "explain_director_next_action"
    || tool === "evaluate_manual_edit_impact"
    || tool === "run_director_next_step"
    || tool === "run_director_until_gate"
    || tool === "switch_director_policy"
  ) {
    return typeof output.summary === "string" ? output.summary : `${tool} Ejecución completa.`;
  }
  if (tool === "get_novel_context") {
    const title = typeof output.title === "string" ? output.title.trim() : "";
    const chapterCount = typeof output.chapterCount === "number" ? output.chapterCount : null;
    return title
      ? `${title}${chapterCount != null ? `(común ${chapterCount} capítulo)` : ""}`
      : "Resumen de novelas leídas.";
  }
  if (tool === "get_story_bible") {
    const exists = output.exists === true;
    return exists ? "Se ha leído el escenario de la novela Biblia." : "No hay biblias novedosas guardadas para la novela actual.";
  }
  if (tool === "get_world_constraints") {
    const worldName = typeof output.worldName === "string" ? output.worldName.trim() : "";
    return worldName ? `Se han leído las limitaciones de la cosmovisión:${worldName}.` : "Actualmente, la novela no está sujeta a limitaciones de cosmovisión.";
  }
  if (tool === "list_chapters") {
    const items = Array.isArray(output.items) ? output.items : [];
    return `Leer ${items.length} Metainformación del capítulo.`;
  }
  if (tool === "get_chapter_by_order" || tool === "get_chapter_content_by_order" || tool === "get_chapter_content") {
    const order = typeof output.order === "number" ? output.order : null;
    const title = typeof output.title === "string" ? output.title.trim() : "";
    return order != null ? `Lea el${order}cap.${title ? `«${title}»` : ""}.` : "Se ha leído el contenido del capítulo.";
  }
  if (tool === "summarize_chapter_range") {
    const start = typeof output.startOrder === "number" ? output.startOrder : null;
    const end = typeof output.endOrder === "number" ? output.endOrder : null;
    return start != null && end != null
      ? `ha sido resumido${start}al tercero${end}capítulo.`
      : "Resumen del alcance del capítulo completado.";
  }
  if (tool === "search_knowledge") {
    const hitCount = typeof output.hitCount === "number" ? output.hitCount : 0;
    return `golpear ${hitCount} Piezas de conocimiento.`;
  }
  if (tool === "list_book_analyses") {
    const items = Array.isArray(output.items) ? output.items : [];
    return `Leer ${items.length} Una tarea de apertura de libros.`;
  }
  if (tool === "get_book_analysis_detail") {
    return typeof output.title === "string" ? `Lea los detalles del libro de apertura:${output.title}.` : "Se han leído los detalles de la apertura del libro.";
  }
  if (tool === "get_book_analysis_failure_reason" || tool === "get_index_failure_reason" || tool === "get_task_failure_reason" || tool === "get_run_failure_reason") {
    return typeof output.failureSummary === "string" ? output.failureSummary : `${tool} Se ha devuelto información de diagnóstico.`;
  }
  if (tool === "list_knowledge_documents") {
    const items = Array.isArray(output.items) ? output.items : [];
    return `Leer ${items.length} documento de conocimiento.`;
  }
  if (tool === "get_knowledge_document_detail") {
    return typeof output.title === "string" ? `Lea el documento de conocimientos "${output.title}».` : "Se han leído los detalles del documento de conocimiento.";
  }
  if (tool === "list_worlds") {
    const items = Array.isArray(output.items) ? output.items : [];
    return `Leer ${items.length} una cosmovisión.`;
  }
  if (tool === "get_world_detail") {
    return typeof output.name === "string" ? `Leer la cosmovisión "${output.name}».` : "Se han leído los detalles de la visión del mundo.";
  }
  if (tool === "explain_world_conflict" || tool === "explain_generation_blocker") {
    return typeof output.failureSummary === "string" ? output.failureSummary : `${tool} Se ha devuelto una descripción de conflicto/bloqueo.`;
  }
  if (tool === "list_writing_formulas") {
    const items = Array.isArray(output.items) ? output.items : [];
    return `Leer ${items.length} Fórmula de redacción del artículo.`;
  }
  if (tool === "get_writing_formula_detail") {
    return typeof output.name === "string" ? `Leyendo la fórmula de escritura "${output.name}».` : "Se han leído los detalles de la fórmula de escritura.";
  }
  if (tool === "explain_formula_match") {
    return typeof output.summary === "string" ? output.summary : "Se ha completado el análisis de adaptación de la fórmula de escritura.";
  }
  if (tool === "list_base_characters") {
    const items = Array.isArray(output.items) ? output.items : [];
    return `Leer ${items.length} Una plantilla de rol básica.`;
  }
  if (tool === "get_base_character_detail") {
    return typeof output.name === "string" ? `Se ha leído la plantilla de roles.${output.name}».` : "Se han leído los detalles de la plantilla de personajes.";
  }
  if (tool === "list_tasks") {
    const items = Array.isArray(output.items) ? output.items : [];
    return `Leer ${items.length} tareas del sistema.`;
  }
  if (tool === "get_task_detail") {
    return typeof output.title === "string" ? `Los detalles de la tarea leen:${output.title}.` : "Se han leído los detalles de la tarea.";
  }
  if (tool === "retry_task" || tool === "cancel_task") {
    return typeof output.summary === "string" ? output.summary : `${tool} Ejecución completa.`;
  }
  if (tool === "preview_pipeline_run") {
    return `Vista previa ${String(output.chapterCount ?? 0)} capítulos.`;
  }
  if (tool === "queue_pipeline_run") {
    return `Tareas de canalización procesadas:${String(output.jobId ?? output.status ?? "unknown")}`;
  }
  if (tool === "apply_chapter_patch" || tool === "save_chapter_draft") {
    return `Se ha procesado la redacción del capítulo, recuento de palabras. ${String(output.contentLength ?? 0)}.`;
  }
  return `${tool} Ejecución completa.`;
}

export function summarizeFailure(tool: string, error: unknown): string {
  return `${tool} La ejecución falló:${error instanceof Error ? error.message : "unknown error"}`;
}

export function buildFinalMessage(results: ToolExecutionResult[], waitingForApproval: boolean): string {
  const lines: string[] = [];
  if (results.length > 0) {
    lines.push("Completó los siguientes pasos:");
    for (const item of results) {
      lines.push(`- ${item.summary}`);
    }
  }
  if (waitingForApproval) {
    lines.push("Actualmente hay una escritura de alto impacto que se ha pausado pendiente de aprobación.");
  } else if (results.length > 0) {
    lines.push("Ejecución completa.");
  } else {
    lines.push("No hay pasos de herramientas para realizar.");
  }
  return lines.join("\n");
}

function isWriteTool(tool: ToolCall["tool"]): boolean {
  return tool === "save_chapter_draft"
    || tool === "apply_chapter_patch"
    || tool === "queue_pipeline_run"
    || tool === "run_director_next_step"
    || tool === "run_director_until_gate"
    || tool === "switch_director_policy";
}

export function shouldUseDryRunPreview(toolCall: ToolCall): boolean {
  return isWriteTool(toolCall.tool) && toolCall.input.dryRun !== true;
}

export function normalizeAgent(value: unknown): PlannedAction["agent"] {
  if (value === "Writer" || value === "Reviewer" || value === "Continuity" || value === "Repair") {
    return value;
  }
  return "Planner";
}

function isStructuredIntent(value: unknown): value is StructuredIntent {
  if (!isRecord(value)) {
    return false;
  }
  return typeof value.goal === "string"
    && typeof value.intent === "string"
    && typeof value.confidence === "number"
    && isRecord(value.chapterSelectors);
}

export function parseApprovalPayload(payloadJson: string | null | undefined): SerializedContinuationPayload | null {
  const raw = asObject(payloadJson);
  if (!Array.isArray(raw.plannedActions) || typeof raw.goal !== "string" || !isRecord(raw.context)) {
    return null;
  }
  const contextRecord = raw.context;
  const context: SerializedContinuationPayload["context"] = {
    contextMode: contextRecord.contextMode === "novel" ? "novel" : "global",
    novelId: typeof contextRecord.novelId === "string" ? contextRecord.novelId : undefined,
    worldId: typeof contextRecord.worldId === "string" ? contextRecord.worldId : undefined,
    provider: typeof contextRecord.provider === "string"
      ? contextRecord.provider as AgentRunStartInput["provider"]
      : undefined,
    model: typeof contextRecord.model === "string" ? contextRecord.model : undefined,
    temperature: typeof contextRecord.temperature === "number" ? contextRecord.temperature : undefined,
    maxTokens: typeof contextRecord.maxTokens === "number" ? contextRecord.maxTokens : undefined,
  };
  const plannedActions: PlannedAction[] = raw.plannedActions
    .filter((item): item is Record<string, unknown> => isRecord(item))
    .map((item) => {
      const callsRaw = Array.isArray(item.calls) ? item.calls : [];
      const calls: ToolCall[] = callsRaw
        .filter((call): call is Record<string, unknown> => isRecord(call))
        .map((call) => ({
          tool: call.tool as ToolCall["tool"],
          reason: typeof call.reason === "string" ? call.reason : "llamada de herramienta",
          idempotencyKey: typeof call.idempotencyKey === "string" ? call.idempotencyKey : `k_${Date.now()}`,
          input: isRecord(call.input) ? call.input : {},
          dryRun: call.dryRun === true,
          approvalSatisfied: call.approvalSatisfied === true,
        }));
      return {
        agent: normalizeAgent(item.agent),
        reasoning: typeof item.reasoning === "string" ? item.reasoning : "Continuar la ejecución",
        calls,
      };
    })
    .filter((item) => item.calls.length > 0);

  if (plannedActions.length === 0) {
    return null;
  }
  return {
    goal: raw.goal,
    structuredIntent: isStructuredIntent(raw.structuredIntent) ? raw.structuredIntent : undefined,
    context,
    plannedActions,
  };
}

export function buildAlternativePathFromRejectedApproval(
  approvalPayload: SerializedContinuationPayload | null,
  note?: string,
): PlannedAction[] {
  if (!approvalPayload) {
    return [];
  }
  const firstCall = approvalPayload.plannedActions[0]?.calls[0];
  if (!firstCall) {
    return [];
  }

  if (firstCall.tool === "apply_chapter_patch") {
    const novelId = typeof firstCall.input.novelId === "string" ? firstCall.input.novelId : undefined;
    const chapterId = typeof firstCall.input.chapterId === "string" ? firstCall.input.chapterId : undefined;
    const content = typeof firstCall.input.content === "string" ? firstCall.input.content : "";
    if (novelId && chapterId && content.trim()) {
      return [{
        agent: "Writer",
        reasoning: "Después de la aprobación y el rechazo, se guardará como borrador para evitar sobrescribir directamente el texto principal.",
        calls: [{
          tool: "save_chapter_draft",
          reason: `Aprobación rechazada, transferida a borrador y guardada.${note ? `Observación: ${note}` : ""}`.trim(),
          idempotencyKey: `fallback_draft_${chapterId}_${Date.now()}`,
          input: {
            novelId,
            chapterId,
            content,
            dryRun: false,
          },
        }],
      }];
    }
  }

  if (firstCall.tool === "queue_pipeline_run") {
    const novelId = typeof firstCall.input.novelId === "string" ? firstCall.input.novelId : undefined;
    const startOrder = typeof firstCall.input.startOrder === "number" ? firstCall.input.startOrder : undefined;
    const endOrder = typeof firstCall.input.endOrder === "number" ? firstCall.input.endOrder : undefined;
    if (novelId && typeof startOrder === "number" && typeof endOrder === "number") {
      return [{
        agent: "Planner",
        reasoning: "Una vez rechazada la aprobación, se conserva la vista previa y la canalización no se inicia realmente.",
        calls: [{
          tool: "preview_pipeline_run",
          reason: "Aprobación rechazada, cambiada a vista previa del alcance.",
          idempotencyKey: `fallback_preview_${startOrder}_${endOrder}_${Date.now()}`,
          input: {
            novelId,
            startOrder,
            endOrder,
          },
        }],
      }];
    }
  }

  return [];
}

export function parseRunMetadata(metadataJson: string | null | undefined): RunMetadata {
  const raw = asObject(metadataJson);
  const metadata: RunMetadata = {
    contextMode: raw.contextMode === "novel" ? "novel" : "global",
  };
  if (typeof raw.provider === "string") {
    metadata.provider = raw.provider as AgentRunStartInput["provider"];
  }
  if (typeof raw.worldId === "string") {
    metadata.worldId = raw.worldId;
  }
  if (typeof raw.model === "string") {
    metadata.model = raw.model;
  }
  if (typeof raw.temperature === "number") {
    metadata.temperature = raw.temperature;
  }
  if (typeof raw.maxTokens === "number") {
    metadata.maxTokens = raw.maxTokens;
  }
  if (Array.isArray(raw.messages)) {
    metadata.messages = raw.messages
      .filter((item): item is { role: "user" | "assistant" | "system"; content: string } =>
        isRecord(item)
        && (item.role === "user" || item.role === "assistant" || item.role === "system")
        && typeof item.content === "string")
      .slice(-30);
  }
  if (typeof raw.parentRunId === "string") {
    metadata.parentRunId = raw.parentRunId;
  }
  if (typeof raw.replayFromStepId === "string") {
    metadata.replayFromStepId = raw.replayFromStepId;
  }
  if (isStructuredIntent(raw.plannerIntent)) {
    metadata.plannerIntent = raw.plannerIntent;
  }
  return metadata;
}
