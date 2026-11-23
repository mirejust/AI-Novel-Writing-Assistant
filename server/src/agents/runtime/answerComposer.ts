import { runTextPrompt } from "../../prompting/core/promptRunner";
import { runtimeFallbackAnswerPrompt } from "../../prompting/prompts/agent/runtime.prompts";
import { listAgentToolDefinitions } from "../toolRegistry";
import type { StructuredIntent, ToolCall, ToolExecutionContext } from "../types";
import { isRecord, safeJson, type ToolExecutionResult } from "./runtimeHelpers";
import { composeCreateNovelSetupAnswer, composeMissingNovelKickoffAnswer, composeSelectNovelWorkspaceSetupAnswer } from "./novelSetupGuidanceComposer";
import { composeNovelSetupIdeationAnswer } from "./novelSetupIdeationComposer";

const COLLABORATION_FIRST_INTENTS = new Set<StructuredIntent["intent"]>([
  "create_novel",
  "produce_novel",
  "write_chapter",
  "rewrite_chapter",
  "save_chapter_draft",
  "start_pipeline",
  "ideate_novel_setup",
  "general_chat",
  "unknown",
]);

function composeWorkflowHandoffAnswer(
  structuredIntent: StructuredIntent,
  context: Omit<ToolExecutionContext, "runId" | "agentName">,
): string {
  const note = structuredIntent.note?.trim();
  const target = note?.includes("centro de misión") ? ["Abrir centro de tareas", "/tasks"]
    : note?.includes("Modelo") ? ["Abrir configuración del modelo", "/settings/models"]
      : note?.includes("Director automático") ? ["Activar el director automático de IA", "/novels/auto-director"]
        : ["Abra el banco de trabajo novedoso", context.novelId ? `/novels/${context.novelId}/edit` : "/novels"];
  return `Esta operación debe realizarse en el banco de trabajo formal, donde el sistema guarda el producto y mantiene el estado completo de la tarea. \\n\\n[${target[0]}](${target[1]})`;
}

function truncateText(value: string, max = 320): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return "";
  }
  return normalized.length > max ? `${normalized.slice(0, max)}...` : normalized;
}
function getSuccessfulOutputs(results: ToolExecutionResult[], tool: ToolCall["tool"]): Record<string, unknown>[] {
  return results
    .filter((item) => item.success && item.tool === tool && item.output)
    .map((item) => item.output as Record<string, unknown>);
}
function getFailedResult(results: ToolExecutionResult[], tool: ToolCall["tool"]): ToolExecutionResult | null {
  return results.find((item) => !item.success && item.tool === tool) ?? null;
}
function buildGroundingFacts(results: ToolExecutionResult[]): string {
  return safeJson(results.map((item) => ({
    tool: item.tool,
    success: item.success,
    summary: item.summary,
    output: item.output
      ? Object.fromEntries(
        Object.entries(item.output).map(([key, value]) => {
          if (typeof value === "string") {
            return [key, truncateText(value, 400)];
          }
          if (Array.isArray(value)) {
            return [key, value.slice(0, 6)];
          }
          return [key, value];
        }),
      )
      : undefined,
  })));
}

function formatMissingInfo(structuredIntent?: StructuredIntent): string[] {
  return (structuredIntent?.missingInfo ?? [])
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 4);
}

function buildCollaborativeQuestion(structuredIntent?: StructuredIntent): string {
  switch (structuredIntent?.intent) {
    case "produce_novel":
    case "create_novel":
      return "¿Quieres concretar una frase primero o quieres que te dé tres opciones?";
    case "write_chapter":
    case "rewrite_chapter":
      return "¿Qué es lo que más deseas resolver en este capítulo: el avance de la trama, las emociones de los personajes o el estilo y ritmo de escritura?";
    case "ideate_novel_setup":
      return "¿Preferirías ver primero el escenario central, la promesa de la historia o las alternativas temáticas y estilísticas?";
    default:
      return "¿Qué problema creativo es el que más deseas resolver en este momento?";
  }
}

function buildCollaborativeOptions(structuredIntent?: StructuredIntent): string[] {
  switch (structuredIntent?.intent) {
    case "produce_novel":
    case "create_novel":
      return [
        "Comenzaré brindándole 3 conjuntos de instrucciones de configuración básicas basadas en la información actual.",
        "Agrega el protagonista, el conflicto y el objetivo, y yo te ayudaré a condensarlo en configuraciones ejecutables.",
        "Si ya lo ha pensado detenidamente, también puede simplemente decir \"Empiece toda la producción ahora\".",
      ];
    case "write_chapter":
    case "rewrite_chapter":
      return [
        "Primero déjame ayudarte a decidir si el problema de este capítulo es la trama, los personajes o el ritmo.",
        "Dígame los objetivos de este capítulo y las partes que desea conservar, y le daré un plan de reescritura.",
        "Si ha determinado el alcance, también puede decir directamente qué capítulo desea cambiar y en qué dirección.",
      ];
    case "ideate_novel_setup":
      return [
        "Primero, le ofrecemos 3 conjuntos de configuraciones principales para elegir.",
        "Primero, le brindamos 3 conjuntos de promesas de historias e instrucciones de puntos de venta.",
        "Primero, les daré 3 conjuntos de estilos temáticos y combinaciones de configuraciones narrativas.",
      ];
    default:
      return [
        "Déjame ayudarte a resolver este problema primero.",
        "Primero déjame darte algunas opciones.",
        "Añade las limitaciones más críticas y seguiré adelante.",
      ];
  }
}

function composeCollaborativeAnswer(goal: string, structuredIntent?: StructuredIntent): string {
  const missingInfo = formatMissingInfo(structuredIntent);
  const lead = structuredIntent?.intent === "general_chat" || structuredIntent?.intent === "unknown"
    ? `No lo trataré como un comando para ejecutar, pero primero aclaremos el problema:${goal}`
    : `Entiendo que lo que quieres impulsar ahora es:${goal}`;
  const collaborationLead = structuredIntent?.interactionMode === "review"
    ? "Esta ronda es más adecuada para diagnosticar y juzgar juntos primero."
    : "Esta ronda es más adecuada para co-crear primero una aclaración y luego decidir si se continúa con la ejecución.";

  if ((structuredIntent?.assistantResponse ?? "explain") === "offer_options") {
    const options = buildCollaborativeOptions(structuredIntent)
      .map((item, index) => `${index + 1}. ${item}`)
      .join("\n");
    const missingLine = missingInfo.length > 0
      ? `Antes de continuar, me gustaría aclarar algunos puntos:${missingInfo.join(",")}. \\n`
      : "";
    return `${lead}\n${collaborationLead}\n${missingLine}Puedes elegir directamente una dirección para continuar: \\n${options}`;
  }

  const missingLine = missingInfo.length > 0
    ? `Antes de continuar, todavía me faltan algunos datos clave:${missingInfo.join(",")}.`
    : "";
  return [lead, collaborationLead, missingLine, buildCollaborativeQuestion(structuredIntent)]
    .filter(Boolean)
    .join("\n");
}

function composeSocialOpeningAnswer(context: Omit<ToolExecutionContext, "runId" | "agentName">): string {
  if (context.novelId) {
    return "Hola. Puedo continuar acompañándote para pulir el escenario, el esquema, los personajes y los capítulos de este libro, o ayudarte a determinar primero el punto de estancamiento actual. ¿Con cuál quieres seguir adelante ahora?";
  }
  return "Hola. Puedo ayudarte a pulir la ambientación, el esquema, los personajes y los capítulos, o ayudarte a diagnosticar los puntos estancados actuales. ¿Con cuál quieres seguir adelante ahora?";
}

function composeTitleAnswer(results: ToolExecutionResult[]): string {
  const title = getSuccessfulOutputs(results, "get_novel_context")
    .map((item) => (typeof item.title === "string" ? item.title.trim() : ""))
    .find(Boolean);
  return title ? `«${title}»` : "Título no obtenido";
}

function composeNovelListAnswer(results: ToolExecutionResult[]): string {
  const list = getSuccessfulOutputs(results, "list_novels")[0];
  const items = Array.isArray(list?.items) ? list.items : [];
  const total = typeof list?.total === "number" ? list.total : items.length;
  if (items.length === 0) {
    return "Actualmente no hay novelas.";
  }
  const lines = items.slice(0, 8).map((item, index) => {
    const title = typeof item?.title === "string" && item.title.trim() ? item.title.trim() : "Novela sin título";
    const chapterCount = typeof item?.chapterCount === "number" ? item.chapterCount : null;
    return `${index + 1}. «${title}»${chapterCount != null ? `(${chapterCount}capítulo)` : ""}`;
  });
  return `Actualmente hay ${total} Esta novela: \\n${lines.join("\n")}`;
}

function composeBaseCharacterListAnswer(results: ToolExecutionResult[]): string {
  const list = getSuccessfulOutputs(results, "list_base_characters")[0];
  const items = Array.isArray(list?.items) ? list.items : [];
  if (items.length === 0) {
    return "La biblioteca de personajes básicos actual todavía está vacía.";
  }
  const lines = items.slice(0, 8).map((item, index) => {
    const name = typeof item?.name === "string" && item.name.trim() ? item.name.trim() : "rol sin nombre";
    const role = typeof item?.role === "string" && item.role.trim() ? item.role.trim() : null;
    const category = typeof item?.category === "string" && item.category.trim() ? item.category.trim() : null;
    const tags = typeof item?.tags === "string" && item.tags.trim() ? item.tags.trim() : null;
    const suffix = [role, category, tags].filter(Boolean).join(" / ");
    return `${index + 1}. ${name}${suffix ? `(${suffix})` : ""}`;
  });
  return `La biblioteca de personajes base actual tiene un total de ${items.length} Plantilla de personaje: \\n${lines.join("\n")}`;
}

function composeWorldListAnswer(results: ToolExecutionResult[]): string {
  const list = getSuccessfulOutputs(results, "list_worlds")[0];
  const items = Array.isArray(list?.items) ? list.items : [];
  if (items.length === 0) {
    return "Actualmente no existe una cosmovisión.";
  }
  const lines = items.slice(0, 8).map((item, index) => {
    const name = typeof item?.name === "string" && item.name.trim() ? item.name.trim() : "Visión del mundo sin nombre";
    const status = typeof item?.status === "string" && item.status.trim() ? item.status.trim() : null;
    return `${index + 1}. ${name}${status ? `(${status})` : ""}`;
  });
  return `Actualmente hay ${items.length} Una visión del mundo: \\n${lines.join("\n")}`;
}

function composeTaskListAnswer(results: ToolExecutionResult[]): string {
  const list = getSuccessfulOutputs(results, "list_tasks")[0];
  const items = Array.isArray(list?.items) ? list.items : [];
  if (items.length === 0) {
    return "Actualmente no hay tareas del sistema.";
  }
  const lines = items.slice(0, 8).map((item, index) => {
    const title = typeof item?.title === "string" && item.title.trim() ? item.title.trim() : "Tarea sin nombre";
    const status = typeof item?.status === "string" && item.status.trim() ? item.status.trim() : "unknown";
    const kind = typeof item?.kind === "string" && item.kind.trim() ? item.kind.trim() : null;
    return `${index + 1}. ${title}${kind ? `(${kind})` : ""} - ${status}`;
  });
  return `Actualmente hay ${items.length} Tareas del sistema: \\n${lines.join("\n")}`;
}

function getFirstSuccessfulOutput(results: ToolExecutionResult[], tool: ToolCall["tool"]): Record<string, unknown> | null {
  return getSuccessfulOutputs(results, tool)[0] ?? null;
}

function composeBindWorldAnswer(
  results: ToolExecutionResult[],
  context: Omit<ToolExecutionContext, "runId" | "agentName">,
): string {
  const bound = getSuccessfulOutputs(results, "bind_world_to_novel")[0];
  if (bound) {
    const summary = typeof bound.summary === "string" ? bound.summary.trim() : "";
    if (summary) {
      return summary;
    }
    const worldName = typeof bound.worldName === "string" ? bound.worldName.trim() : "";
    const novelTitle = typeof bound.novelTitle === "string" ? bound.novelTitle.trim() : "";
    if (worldName && novelTitle) {
      return `La visión del mundo ha sido${worldName}"Unido a la novela"${novelTitle}».`;
    }
    return "Se ha completado la vinculación de la visión del mundo.";
  }
  if (!context.novelId) {
    return "No hay manera de establecer una visión del mundo sin el contexto de la novela actual.";
  }
  const failed = getFailedResult(results, "bind_world_to_novel");
  if (failed?.errorCode === "NOT_FOUND") {
    return "No se ha encontrado ninguna cosmovisión que esté ligada.";
  }
  if (failed?.summary) {
    return failed.summary;
  }
  return "La vinculación de la cosmovisión no se ha completado.";
}

function composeUnbindWorldAnswer(
  results: ToolExecutionResult[],
  context: Omit<ToolExecutionContext, "runId" | "agentName">,
): string {
  const unbound = getSuccessfulOutputs(results, "unbind_world_from_novel")[0];
  if (unbound) {
    const summary = typeof unbound.summary === "string" ? unbound.summary.trim() : "";
    if (summary) {
      return summary;
    }
    const novelTitle = typeof unbound.novelTitle === "string" ? unbound.novelTitle.trim() : "";
    const previousWorldName = typeof unbound.previousWorldName === "string" ? unbound.previousWorldName.trim() : "";
    if (novelTitle && previousWorldName) {
      return `La visión del mundo ha sido${previousWorldName}"De la novela"${novelTitle}"Desatar.`;
    }
    if (novelTitle) {
      return `La novela ha sido actualizada.${novelTitle}»El estado vinculante de la visión del mundo.`;
    }
    return "La visión del mundo se ha desagregado.";
  }
  if (!context.novelId) {
    return "Sin el contexto de la novela actual, es imposible desvincular la cosmovisión.";
  }
  const failed = getFailedResult(results, "unbind_world_from_novel");
  if (failed?.summary) {
    return failed.summary;
  }
  return "La desagregación de la cosmovisión no se ha completado.";
}

function composeFactProductionStatusText(status: Record<string, unknown>, fallbackTitle = "novela actual"): string {
  const title = typeof status.title === "string" && status.title.trim() ? status.title.trim() : fallbackTitle;
  const currentStage = typeof status.currentStage === "string" && status.currentStage.trim()
    ? status.currentStage.trim()
    : "etapa desconocida";
  const factProgress = isRecord(status.factProgress) ? status.factProgress : null;
  const targetChapterCount = typeof status.targetChapterCount === "number" ? status.targetChapterCount : null;
  const chapterCount = typeof status.chapterCount === "number" ? status.chapterCount : 0;
  const runtimeStatus = isRecord(status.runtimeStatus) ? status.runtimeStatus : null;
  const runtimeLabel = typeof runtimeStatus?.label === "string" && runtimeStatus.label.trim()
    ? runtimeStatus.label.trim()
    : null;
  const runtimeState = typeof runtimeStatus?.state === "string" ? runtimeStatus.state : null;
  const pipelineStatus = typeof status.pipelineStatus === "string" ? status.pipelineStatus.trim() : null;
  const failureSummary = typeof status.failureSummary === "string" ? status.failureSummary.trim() : "";
  const recoveryHint = typeof status.recoveryHint === "string" ? status.recoveryHint.trim() : "";

  const parts = [`«${title}»Progreso fáctico:${currentStage}.`];
  if (factProgress) {
    const planningCompleted = typeof factProgress.planningCompleted === "number" ? factProgress.planningCompleted : null;
    const planningTotal = typeof factProgress.planningTotal === "number" ? factProgress.planningTotal : null;
    const draftedChapterCount = typeof factProgress.draftedChapterCount === "number" ? factProgress.draftedChapterCount : null;
    const reviewedChapterCount = typeof factProgress.reviewedChapterCount === "number" ? factProgress.reviewedChapterCount : null;
    const committedChapterCount = typeof factProgress.committedChapterCount === "number" ? factProgress.committedChapterCount : null;
    const needsRepairChapters = typeof factProgress.needsRepairChapters === "number" ? factProgress.needsRepairChapters : 0;
    if (planningCompleted != null && planningTotal != null) {
      parts.push(`planificación:${planningCompleted}/${planningTotal} artículo.`);
    }
    if (draftedChapterCount != null) {
      parts.push(targetChapterCount != null
        ? `texto:${draftedChapterCount}/${targetChapterCount} capítulo.`
        : `texto:${draftedChapterCount} capítulo.`);
    } else {
      parts.push(targetChapterCount != null ? `Índice del capítulo:${chapterCount}/${targetChapterCount} capítulo.` : `Índice del capítulo:${chapterCount} capítulo.`);
    }
    if (reviewedChapterCount != null && reviewedChapterCount > 0) {
      parts.push(`Crítico:${reviewedChapterCount} capítulo.`);
    }
    if (committedChapterCount != null && committedChapterCount > 0) {
      parts.push(`Estado de envío:${committedChapterCount} capítulo.`);
    }
    if (needsRepairChapters > 0) {
      parts.push(`${needsRepairChapters} Capítulo a reparar.`);
    }
  } else {
    parts.push(targetChapterCount != null ? `Índice del capítulo:${chapterCount}/${targetChapterCount} capítulo.` : `Índice del capítulo:${chapterCount} capítulo.`);
  }
  if (runtimeLabel && runtimeState !== "idle") {
    parts.push(`Suplemento de backend:${runtimeLabel}.`);
  } else if (pipelineStatus) {
    parts.push(`Suplemento de backend:${pipelineStatus}.`);
  }
  if (failureSummary) {
    parts.push(`Motivo del error en segundo plano:${failureSummary}`);
    parts.push("El contenido factual que se ha producido puede seguir utilizándose.");
  }
  if (recoveryHint) {
    parts.push(`sugerencia:${recoveryHint}`);
  }
  return parts.join("");
}

function composeProgressAnswer(results: ToolExecutionResult[]): string {
  const productionStatus = getFirstSuccessfulOutput(results, "get_novel_production_status");
  if (productionStatus) {
    return composeFactProductionStatusText(productionStatus);
  }
  const context = getSuccessfulOutputs(results, "get_novel_context")[0];
  if (!context) {
    return "Actualmente no hay información suficiente para continuar.";
  }
  const completedChapterCount = typeof context.completedChapterCount === "number"
    ? context.completedChapterCount
    : null;
  const chapterCount = typeof context.chapterCount === "number" ? context.chapterCount : null;
  const latestCompletedChapterOrder = typeof context.latestCompletedChapterOrder === "number"
    ? context.latestCompletedChapterOrder
    : null;
  if (completedChapterCount == null) {
    return "Actualmente no hay información suficiente para continuar.";
  }
  const parts = [
    chapterCount != null
      ? `texto:${completedChapterCount}/${chapterCount} capítulo.`
      : `texto:${completedChapterCount} capítulo.`,
  ];
  if (latestCompletedChapterOrder != null) {
    parts.push(`Recientemente completado${latestCompletedChapterOrder}capítulo.`);
  }
  if (completedChapterCount === 0) {
    parts.push("No se detectaron capítulos escritos en el texto.");
  }
  return parts.join("");
}

function composeCharacterAnswer(results: ToolExecutionResult[]): string {
  const characterState = getSuccessfulOutputs(results, "get_character_states")[0];
  if (!characterState) {
    return "Información del estado del personaje no obtenida";
  }
  const count = typeof characterState.count === "number" ? characterState.count : 0;
  const items = Array.isArray(characterState.items) ? characterState.items : [];
  if (count === 0 || items.length === 0) {
    return "Actualmente no hay personajes planeados para la novela.";
  }
  const lines = items.slice(0, 6).map((item, index) => {
    const name = typeof item?.name === "string" && item.name.trim() ? item.name.trim() : "rol sin nombre";
    const role = typeof item?.role === "string" && item.role.trim() ? item.role.trim() : null;
    return `${index + 1}. ${name}${role ? `(${role})` : ""}`;
  });
  return `La novela actual está planeada. ${count} Personajes: \\n${lines.join("\n")}`;
}

function composeChapterAnswer(results: ToolExecutionResult[]): string | null {
  const contentOutputs = [
    ...getSuccessfulOutputs(results, "get_chapter_content_by_order"),
    ...getSuccessfulOutputs(results, "get_chapter_content"),
  ]
    .filter((item) => typeof item.order === "number")
    .sort((left, right) => Number(left.order) - Number(right.order));
  if (contentOutputs.length > 0) {
    return contentOutputs.map((item) => {
      const order = Number(item.order);
      const title = typeof item.title === "string" ? item.title.trim() : "";
      const content = typeof item.content === "string" ? item.content : "";
      return `Cap.${order}cap.${title ? `«${title}»` : ""}:${truncateText(content, 360) || "El texto está vacío."}`;
    }).join("\n\n");
  }

  const rangeSummary = getSuccessfulOutputs(results, "summarize_chapter_range")[0];
  if (rangeSummary && typeof rangeSummary.summary === "string" && rangeSummary.summary.trim()) {
    return rangeSummary.summary.trim();
  }
  return null;
}

function composeWriteAnswer(results: ToolExecutionResult[], waitingForApproval: boolean): string | null {
  const preview = getSuccessfulOutputs(results, "preview_pipeline_run")[0];
  const queue = getSuccessfulOutputs(results, "queue_pipeline_run")[0];
  const draft = getSuccessfulOutputs(results, "save_chapter_draft")[0];
  const patch = getSuccessfulOutputs(results, "apply_chapter_patch")[0];

  if (draft && typeof draft.summary === "string") {
    return draft.summary;
  }
  if (patch && typeof patch.summary === "string") {
    return patch.summary;
  }
  if (waitingForApproval && preview) {
    const start = typeof preview.startOrder === "number" ? preview.startOrder : null;
    const end = typeof preview.endOrder === "number" ? preview.endOrder : null;
    if (start != null && end != null) {
      return start === end
        ? `Terminado${start}Vista previa de la ejecución del capítulo, actualmente en espera de aprobación.`
        : `Terminado${start}al tercero${end}Vista previa de la ejecución del capítulo, actualmente en espera de aprobación.`;
    }
  }
  if (queue) {
    const start = typeof queue.startOrder === "number" ? queue.startOrder : null;
    const end = typeof queue.endOrder === "number" ? queue.endOrder : null;
    const jobId = typeof queue.jobId === "string" ? queue.jobId : "";
    if (start != null && end != null) {
      const scope = start === end ? `Cap.${start}cap.` : `Cap.${start}al tercero${end}cap.`;
      return `Creado ${scope} tareas de escritura${jobId ? `(Tarea ${jobId})` : ""}.`;
    }
  }
  return null;
}

function composeProductionStatusAnswer(
  results: ToolExecutionResult[],
  context: Omit<ToolExecutionContext, "runId" | "agentName">,
): string {
  const status = getFirstSuccessfulOutput(results, "get_novel_production_status");
  if (!status) {
    return context.novelId
      ? "No se ha obtenido el estado de producción completo."
      : "El estado completo de la producción no se puede leer sin el contexto novedoso actual.";
  }
  const title = typeof status.title === "string" ? status.title.trim() : "novela actual";
  return composeFactProductionStatusText(status, title);
}

async function composeProduceNovelAnswer(
  results: ToolExecutionResult[],
  waitingForApproval: boolean,
  context: Omit<ToolExecutionContext, "runId" | "agentName">,
  goal: string,
  structuredIntent?: StructuredIntent,
): Promise<string> {
  const created = getFirstSuccessfulOutput(results, "create_novel");
  const world = getFirstSuccessfulOutput(results, "generate_world_for_novel");
  const characters = getFirstSuccessfulOutput(results, "generate_novel_characters");
  const bible = getFirstSuccessfulOutput(results, "generate_story_bible");
  const outline = getFirstSuccessfulOutput(results, "generate_novel_outline");
  const structured = getFirstSuccessfulOutput(results, "generate_structured_outline");
  const synced = getFirstSuccessfulOutput(results, "sync_chapters_from_structured_outline");
  const preview = getFirstSuccessfulOutput(results, "preview_pipeline_run");
  const queued = getFirstSuccessfulOutput(results, "queue_pipeline_run");
  const productionStatus = getFirstSuccessfulOutput(results, "get_novel_production_status");

  if (!created && !context.novelId) {
    return composeMissingNovelKickoffAnswer(goal, context, structuredIntent, "produce_missing_title");
  }

  const title = typeof created?.title === "string" && created.title.trim()
    ? created.title.trim()
    : typeof productionStatus?.title === "string" && productionStatus.title.trim()
      ? productionStatus.title.trim()
      : "novela actual";
  const assetParts: string[] = [];
  if (world) {
    const worldName = typeof world.worldName === "string" ? world.worldName.trim() : "";
    assetParts.push(worldName ? `Cosmovisión "${worldName}»` : "visión del mundo");
  }
  if (characters) {
    const characterCount = typeof characters.characterCount === "number" ? characters.characterCount : 0;
    assetParts.push(`${characterCount} rol central`);
  }
  if (bible) {
    assetParts.push("novela biblia");
  }
  if (outline) {
    assetParts.push("Tendencia de desarrollo");
  }
  if (structured) {
    const targetChapterCount = typeof structured.targetChapterCount === "number" ? structured.targetChapterCount : null;
    assetParts.push(targetChapterCount != null ? `${targetChapterCount} Esquema estructurado del capítulo` : "esquema estructurado");
  }
  if (synced) {
    const chapterCount = typeof synced.chapterCount === "number" ? synced.chapterCount : null;
    assetParts.push(chapterCount != null ? `${chapterCount} Tabla de contenido` : "Índice del capítulo");
  }

  if (waitingForApproval && preview) {
    return `«${title}»Se han generado los activos principales${assetParts.length > 0 ? `:${assetParts.join(",")}.` : "."}Se completó la vista previa completa de la escritura y actualmente está pendiente de aprobación.`;
  }
  if (queued) {
    const jobId = typeof queued.jobId === "string" && queued.jobId.trim() ? `(Tarea ${queued.jobId})` : "";
    return `«${title}»Se han generado los activos principales${assetParts.length > 0 ? `:${assetParts.join(",")}.` : "."}Toda la tarea de escritura ha comenzado.${jobId}.`;
  }
  if (preview) {
    return `«${title}»Se han generado los activos principales${assetParts.length > 0 ? `:${assetParts.join(",")}.` : "."}Todo el proceso de escritura no ha comenzado.`;
  }
  return `«${title}»Se han generado los activos principales${assetParts.length > 0 ? `:${assetParts.join(",")}.` : "."}`
}

function composeFailureDiagnosisAnswer(results: ToolExecutionResult[]): string {
  const candidates = [
    ...getSuccessfulOutputs(results, "get_run_failure_reason"),
    ...getSuccessfulOutputs(results, "explain_generation_blocker"),
    ...getSuccessfulOutputs(results, "get_task_failure_reason"),
    ...getSuccessfulOutputs(results, "get_index_failure_reason"),
    ...getSuccessfulOutputs(results, "get_book_analysis_failure_reason"),
  ];
  const first = candidates.find((item) => typeof item.failureSummary === "string" && item.failureSummary.trim());
  if (!first) {
    return "Actualmente no hay información de diagnóstico de fallas disponible";
  }
  const parts = [String(first.failureSummary).trim()];
  if (typeof first.failureDetails === "string" && first.failureDetails.trim() && first.failureDetails.trim() !== parts[0]) {
    parts.push(`Detalles:${first.failureDetails.trim()}`);
  }
  if (typeof first.recoveryHint === "string" && first.recoveryHint.trim()) {
    parts.push(`sugerencia:${first.recoveryHint.trim()}`);
  }
  if (typeof first.lastFailedStep === "string" && first.lastFailedStep.trim()) {
    parts.push(`Pasos del fracaso:${first.lastFailedStep.trim()}`);
  }
  return parts.join("\n");
}

async function composeFallbackAnswer(
  goal: string,
  summary: string,
  results: ToolExecutionResult[],
  context: Omit<ToolExecutionContext, "runId" | "agentName">,
  structuredIntent?: StructuredIntent,
): Promise<string> {
  try {
    const toolList = listAgentToolDefinitions()
      .map((item) => `- ${item.name}: ${item.description}`)
      .join("\n");
    const result = await runTextPrompt({
      asset: runtimeFallbackAnswerPrompt,
      promptInput: {
        toolList,
        goal,
        structuredIntentJson: safeJson(structuredIntent ?? { intent: "unknown" }),
        summary,
        groundingFacts: buildGroundingFacts(results),
      },
      options: {
        provider: context.provider ?? "deepseek",
        model: context.model,
        temperature: 0.2,
        maxTokens: context.maxTokens,
      },
    });
    return result.output.trim() || "Actualmente no hay información suficiente para continuar.";
  } catch {
    return summary || "Actualmente no hay información suficiente para continuar.";
  }
  return "Actualmente no hay información suficiente para continuar.";
}

export async function composeAssistantMessage(
  goal: string,
  summary: string,
  results: ToolExecutionResult[],
  waitingForApproval: boolean,
  context: Omit<ToolExecutionContext, "runId" | "agentName">,
  structuredIntent?: StructuredIntent,
): Promise<string> {
  if (structuredIntent?.intent === "social_opening") {
    return composeSocialOpeningAnswer(context);
  }

  if (context.plannerProfile === "creative_hub_readonly"
    && (structuredIntent?.intent === "workflow_handoff" || structuredIntent?.intent === "out_of_scope")) {
    return composeWorkflowHandoffAnswer(structuredIntent, context);
  }

  if (context.plannerProfile === "creative_hub_readonly"
    && structuredIntent
    && ["create_novel", "bind_world_to_novel", "unbind_world_from_novel", "produce_novel", "run_director_next_step", "run_director_until_gate", "switch_director_policy", "write_chapter", "rewrite_chapter", "save_chapter_draft", "start_pipeline", "ideate_novel_setup"].includes(structuredIntent.intent)) {
    return composeWorkflowHandoffAnswer({ ...structuredIntent, note: structuredIntent.note ?? "Director automático" }, context);
  }

  if (
    !waitingForApproval
    && structuredIntent
    && COLLABORATION_FIRST_INTENTS.has(structuredIntent.intent)
    && (
      structuredIntent.shouldAskFollowup
      || ((structuredIntent.interactionMode ?? "execute") !== "execute" && results.length === 0)
    )
  ) {
    return composeCollaborativeAnswer(goal, structuredIntent);
  }

  switch (structuredIntent?.intent) {
    case "list_novels":
      return composeNovelListAnswer(results);
    case "list_base_characters":
      return composeBaseCharacterListAnswer(results);
    case "list_worlds":
      return composeWorldListAnswer(results);
    case "query_task_status":
      return composeTaskListAnswer(results);
    case "create_novel":
      return composeCreateNovelSetupAnswer(goal, results, context, structuredIntent);
    case "select_novel_workspace":
      return composeSelectNovelWorkspaceSetupAnswer(goal, results, context, structuredIntent);
    case "bind_world_to_novel":
      return composeBindWorldAnswer(results, context);
    case "unbind_world_from_novel":
      return composeUnbindWorldAnswer(results, context);
    case "produce_novel":
      return composeProduceNovelAnswer(results, waitingForApproval, context, goal, structuredIntent);
    case "query_novel_production_status":
      return composeProductionStatusAnswer(results, context);
    case "query_novel_title":
      return composeTitleAnswer(results);
    case "query_progress":
      return composeProgressAnswer(results);
    case "query_chapter_content":
      return composeChapterAnswer(results) ?? "Texto del capítulo no obtenido";
    case "inspect_failure_reason":
      return composeFailureDiagnosisAnswer(results);
    case "ideate_novel_setup":
      return composeNovelSetupIdeationAnswer(goal, results, context, structuredIntent);
    case "write_chapter":
    case "rewrite_chapter":
    case "save_chapter_draft":
    case "start_pipeline":
      return composeWriteAnswer(results, waitingForApproval) ?? "Alcance ejecutable no obtenido";
    default:
      break;
  }

  if (waitingForApproval) {
    return summary;
  }
  return composeFallbackAnswer(goal, summary, results, context, structuredIntent);
}

export function hasUsableStructuredIntent(value: unknown): value is StructuredIntent {
  if (!isRecord(value)) {
    return false;
  }
  return typeof value.goal === "string"
    && typeof value.intent === "string"
    && typeof value.confidence === "number"
    && isRecord(value.chapterSelectors);
}
