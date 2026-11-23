import { z } from "zod";
import { getPermissionMatrixSummary } from "../approvalPolicy";
import { listAgentToolDefinitions, listPlannerSemanticDefinitions } from "../toolRegistry";
import type { PlannerInput, StructuredIntent } from "../types";

export const INTENT_NAMES = [
  "social_opening",
  "list_novels",
  "list_base_characters",
  "list_worlds",
  "query_task_status",
  "create_novel",
  "select_novel_workspace",
  "bind_world_to_novel",
  "unbind_world_from_novel",
  "produce_novel",
  "query_novel_production_status",
  "analyze_director_workspace",
  "query_director_status",
  "explain_director_next_action",
  "run_director_next_step",
  "run_director_until_gate",
  "switch_director_policy",
  "evaluate_manual_edit_impact",
  "query_novel_title",
  "query_chapter_content",
  "query_progress",
  "inspect_failure_reason",
  "write_chapter",
  "rewrite_chapter",
  "save_chapter_draft",
  "start_pipeline",
  "inspect_characters",
  "inspect_timeline",
  "inspect_world",
  "search_knowledge",
  "ideate_novel_setup",
  "workflow_handoff",
  "out_of_scope",
  "general_chat",
  "unknown",
] as const satisfies readonly StructuredIntent["intent"][];

const WORKFLOW_RECIPES = [
  {
    intent: "produce_novel",
    when: "El usuario solicita crear e iniciar la producción en volumen completo, o continuar/completar la producción en volumen completo de la novela actual.",
    examples: [
      "Crea una novela de 20 capítulos \"La leyenda de los héroes antijaponeses\" y comienza a generar el libro completo.",
      "Continuar generando la novela actual.",
      "terminar esta novela",
      "terminar este libro",
    ],
  },
  {
    intent: "query_novel_production_status",
    when: "El usuario puede ver la situación general de la novela encuadernada o preguntar en qué paso está estancada toda la generación del libro, si se ha iniciado y si los activos están listos para completarse.",
    examples: [
      "Mira esta novela",
      "¿Cuál es la situación general de este libro?",
      "Estado de la generación del libro",
      "¿Por qué no se inicia toda la compilación?",
      "¿Se han completado los preparativos de los activos actuales?",
    ],
  },
  {
    intent: "query_director_status",
    when: "El usuario pregunta dónde se está ejecutando AutoDirector, si debe esperar la confirmación, el nodo actual o el evento más reciente.",
    examples: [
      "¿Dónde está ahora el director automático?",
      "¿Está estancada la tarea del director actual?",
      "¿Cuál es el estado de esta tarea automática del director?",
    ],
  },
  {
    intent: "explain_director_next_action",
    when: "El usuario pregunta qué hacer a continuación en la novela actual, por qué avanza de esta manera y si puede continuar dirigiéndose automáticamente.",
    examples: [
      "¿Qué hacer ahora con este libro?",
      "Cómo proceder a continuación",
      "AutoDirector sugiere lo que debo hacer a continuación",
    ],
  },
  {
    intent: "evaluate_manual_edit_impact",
    when: "Los usuarios dicen que han cambiado el texto, la motivación, el presagio o la configuración y quieren determinar el impacto posterior.",
    examples: [
      "Cambié el Capítulo 3 para ver cuál es el impacto.",
      "Cambié la motivación del protagonista, ¿tengo que volver a calcularla más tarde?",
      "Eliminé un presagio, ¿qué capítulos se verán afectados?",
    ],
  },
  {
    intent: "run_director_next_step",
    when: "El usuario solicita explícitamente al centro creativo que continúe dirigiendo automáticamente el siguiente paso.",
    examples: [
      "Continuar para dirigir automáticamente el siguiente paso.",
      "Que el director siga avanzando.",
    ],
  },
  {
    intent: "run_director_until_gate",
    when: "El usuario solicita explícitamente al AutoDirector que continúe avanzando hasta el siguiente punto de control o punto de confirmación.",
    examples: [
      "Continuar con la dirección automática hasta el punto de control",
      "Deja que el director avance al lugar donde necesito confirmar.",
    ],
  },
  {
    intent: "switch_director_policy",
    when: "El usuario solicitó explícitamente ajustes en el avance de AutoDirector o la intensidad de la automatización.",
    examples: [
      "Cambiar el director automático para dar solo sugerencias",
      "Cambiar para avanzar al punto de control",
      "Permitir que los límites seguros avancen automáticamente",
    ],
  },
  {
    intent: "query_chapter_content",
    when: "El usuario desea ver el texto/resumen de un determinado capítulo o de un determinado rango de capítulos.",
    examples: [
      "Devuélveme el contenido del Capítulo 1.",
      "¿Qué se escribió en los dos primeros capítulos?",
    ],
  },
  {
    intent: "inspect_failure_reason",
    when: "Los usuarios preguntan sobre los motivos del error de generación, del capítulo o del bloqueo.",
    examples: [
      "Capítulo 3 ¿Por qué falló?",
      "¿Cuál es el motivo por el que no se pudo generar el Capítulo 3?",
    ],
  },
  {
    intent: "write_chapter",
    when: "Las solicitudes de los usuarios adelantan la redacción de un determinado capítulo.",
    examples: [
      "Escribe el capítulo 3.",
      "Continuar escribiendo el Capítulo 5",
    ],
  },
  {
    intent: "rewrite_chapter",
    when: "El usuario solicitó explícitamente que se reescribiera o reescribiera un determinado capítulo.",
    examples: [
      "Reescribir el capítulo 3",
      "Reescribir el capítulo 6",
    ],
  },
  {
    intent: "query_progress",
    when: "El usuario pregunta cuántos capítulos se han escrito y dónde está el progreso.",
    examples: [
      "¿Cuántos capítulos se han escrito hasta ahora?",
      "¿Dónde está el progreso ahora?",
    ],
  },
];

export const intentSchema: z.ZodType<StructuredIntent> = z.object({
  goal: z.string().min(1),
  intent: z.enum(INTENT_NAMES),
  confidence: z.number().min(0).max(1).default(0.5),
  requiresNovelContext: z.boolean().default(false),
  interactionMode: z.enum(["co_create", "review", "query", "plan", "execute"]).default("execute"),
  assistantResponse: z.enum(["ask_followup", "offer_options", "explain", "execute"]).default("explain"),
  shouldAskFollowup: z.boolean().default(false).describe("Se le pregunta solo si falta la información necesaria para completar la solicitud; Las consultas de descripción general de novelas encuadernadas se pueden consultar directamente."),
  missingInfo: z.array(z.string().trim().min(1)).max(4).default([]).describe("Información faltante específica que debe ser completada por el usuario; La descripción general de la novela actual no requiere que el usuario seleccione una dimensión de visualización."),
  novelTitle: z.string().trim().min(1).optional(),
  worldName: z.string().trim().min(1).optional(),
  description: z.string().trim().min(1).optional(),
  targetChapterCount: z.number().int().min(1).max(200).optional(),
  genre: z.string().trim().min(1).optional(),
  worldType: z.string().trim().min(1).optional(),
  styleTone: z.string().trim().min(1).optional(),
  projectMode: z.enum(["ai_led", "co_pilot", "draft_mode", "auto_pipeline"]).optional(),
  pacePreference: z.enum(["fast", "balanced", "slow"]).optional(),
  narrativePov: z.enum(["first_person", "third_person", "mixed"]).optional(),
  emotionIntensity: z.enum(["low", "medium", "high"]).optional(),
  aiFreedom: z.enum(["low", "medium", "high"]).optional(),
  defaultChapterLength: z.number().int().min(500).max(10000).optional(),
  directorPolicyMode: z.enum(["suggest_only", "run_next_step", "run_until_gate", "auto_safe_scope"]).optional(),
  mayOverwriteUserContent: z.boolean().optional(),
  allowExpensiveReview: z.boolean().optional(),
  modelTier: z.enum(["cheap_fast", "balanced", "high_quality"]).optional(),
  chapterSelectors: z.object({
    chapterId: z.string().trim().min(1).optional(),
    orders: z.array(z.number().int().min(1)).max(8).optional(),
    range: z.object({
      startOrder: z.number().int().min(1),
      endOrder: z.number().int().min(1),
    }).optional(),
    relative: z.object({
      type: z.enum(["first_n"]),
      count: z.number().int().min(1).max(20),
    }).optional(),
  }).default({}),
  content: z.string().trim().optional(),
  note: z.string().trim().optional(),
});

function buildSemanticCatalog(): string {
  const items = listPlannerSemanticDefinitions();
  if (items.length === 0) {
    return "none";
  }
  return items.map((item) => [
    `- intent=${item.intent}; tool=${item.toolName}; requiresNovelContext=${item.requiresNovelContext}`,
    `  title=${item.title}`,
    `  description=${item.description}`,
    `  aliases=${item.aliases.join(", ") || "none"}`,
    `  phrases=${item.phrases.join(" | ") || "none"}`,
    `  when=${item.whenToUse ?? "none"}`,
    `  avoid=${item.whenNotToUse ?? "none"}`,
    `  inputs=${item.inputSchemaSummary.join(", ") || "none"}`,
  ].join("\n")).join("\n");
}

function buildWorkflowRecipeCatalog(): string {
  return WORKFLOW_RECIPES.map((item) => [
    `- intent=${item.intent}`,
    `  when=${item.when}`,
    `  examples=${item.examples.join(" | ")}`,
  ].join("\n")).join("\n");
}

function buildToolCatalog(): string {
  return listAgentToolDefinitions()
    .map((item) => `- ${item.name}: ${item.description}`)
    .join("\n");
}

export function summarizeIntentValidationFailure(
  payload: Record<string, unknown>,
  issues: z.ZodIssue[],
): string {
  const details = issues.slice(0, 3).map((issue) => {
    const path = issue.path.length > 0 ? issue.path.join(".") : "root";
    if (path === "intent") {
      const rawIntent = typeof payload.intent === "string" && payload.intent.trim()
        ? payload.intent.trim()
        : "unknown";
      return `La intención no es compatible: ${rawIntent}`;
    }
    if (issue.code === "invalid_type") {
      return `Campo ${path} tipo incorrecto`;
    }
    if (issue.code === "invalid_value") {
      return `Campo ${path} El valor no está dentro del rango permitido.`;
    }
    if (issue.code === "too_small") {
      return `Campo ${path} Falta contenido válido`;
    }
    if (issue.code === "too_big") {
      return `Campo ${path} más allá del rango permitido`;
    }
    return `Campo ${path} No cumple con los requisitos`;
  });
  return `El intent JSON devuelto por LLM no es válido: ${details.join(";")}`;
}

export function buildPlannerIntentPromptParts(input: PlannerInput): { systemPrompt: string; userPrompt: string } {
  const permissionSummary = getPermissionMatrixSummary();
  const recentMessages = input.messages.slice(-12).map((item) => `${item.role}: ${item.content}`).join("\n");
  const readonly = input.profile === "creative_hub_readonly";
  const semanticCatalog = buildSemanticCatalog();
  const workflowRecipes = readonly ? "Solo proporciona consultas, diagnósticos, explicaciones y navegación, pero no proporciona un flujo de trabajo de producción." : buildWorkflowRecipeCatalog();
  const toolCatalog = readonly
    ? listAgentToolDefinitions()
      .filter((item) => ["read", "inspect"].includes(item.category) && !["preview_pipeline_run", "diff_chapter_patch"].includes(item.name))
      .map((item) => `- ${item.name}: ${item.description}`)
      .join("\n")
    : buildToolCatalog();

  return {
    systemPrompt: [
      readonly
        ? "Actualmente, el centro de creación está en modo de solo lectura: solo puede consultar el estado de la novela, diagnosticar problemas, ver registros de ejecución, explicar el siguiente paso y recomendar la entrada oficial. No se pueden crear, generar, escribir, guardar, modificar, restaurar, reintentar, cancelar o iniciar tareas."
        : "El centro de creación es un socio de creación colaborativo de forma predeterminada, no un enrutador de comandos.",
      "Debe devolver el modo de interacción, la respuesta del asistente, la respuesta del asistente y la información faltante de forma explícita en JSON.",
      "Si el usuario todavía está explorando direcciones, comparando opciones, expresando insatisfacción y buscando un diagnóstico, configure el modo de interacción para co_crear o revisar primero; establezca mustAskFollowup en verdadero solo cuando falte la información necesaria para completar la solicitud.",
      "Configure el modo de interacción para que se ejecute solo cuando el usuario solicite explícitamente crear, vincular, guardar, iniciar una tarea o escribir contenido directamente de inmediato.",
      "Cuando el siguiente paso es más adecuado para pedir una aclaración, AssistantResponse utiliza Ask_followup; cuando el siguiente paso es más adecuado para dar opciones, asistenteResponse usa oferta_opciones.",
      "Si el usuario simplemente está chateando, saludando o simplemente saludando y aún no ha ingresado a una tarea creativa específica, la intención debe dar prioridad a social_opening en lugar de general_chat.",
      "Usted es el analizador de intenciones del agente de creación de novelas y solo puede devolver un objeto JSON.",
      "Su tarea no es planificar todas las herramientas directamente, sino identificar primero las intenciones reales del usuario y los espacios para capítulos.",
      `La intención debe ser una de las siguientes enumeraciones:${(readonly ? INTENT_NAMES.filter((intent) => !["create_novel", "select_novel_workspace", "bind_world_to_novel", "unbind_world_from_novel", "produce_novel", "run_director_next_step", "run_director_until_gate", "switch_director_policy", "write_chapter", "rewrite_chapter", "save_chapter_draft", "start_pipeline", "ideate_novel_setup"].includes(intent)) : INTENT_NAMES).join(", ")}.`,
      ...(readonly ? [
        "Cuando el usuario solicita crear, generar, escribir, modificar, guardar, iniciar, continuar, reanudar, reintentar, cancelar o aprobar, el flujo de trabajo_handoff se devolverá uniformemente y una nota indicará que se debe ingresar el correspondiente banco de trabajo novedoso formal, director automático, página de capítulo o configuración del modelo; el centro de tareas solo se utiliza para consultar registros en ejecución y no realiza operaciones.",
        "No utilice vista previa_pipeline_run ni ninguna herramienta de solo lectura como sustituto de la ejecución formal.",
      ] : []),
      "Priorice el uso de catálogos semánticos de intenciones atómicas para identificar intenciones únicas, como listas, consultas, recuperaciones y enlaces.",
      "Utilice la intención del flujo de trabajo solo cuando la solicitud del usuario pertenece claramente a un proceso compuesto, como producción completa, redacción de capítulos, diagnóstico de fallas, etc.",
      "Si la expresión del usuario encuentra alias o frases en el directorio, devuelva la intención canónica correspondiente, no el alias o el nombre de la herramienta.",
      "Si el usuario mencionó explícitamente el título de la novela, puedes poner novelTitle.",
      "Si el usuario menciona explícitamente el nombre de la visión del mundo, puede poner worldName.",
      "Si el usuario describe la tarea de producción de un libro nuevo completo, utilice produce_novel e intente extraer descripción, targetChapterCount, género, worldType, styleTone, projectMode, pacePreference, narrativaPov,emotionIntensity, aiFreedom, defaultChapterLength.",
      "Cuando el modo contextual es novela y el ID de novela ha sido vinculado, y el usuario generalmente pregunta sobre la novela y quiere ver una descripción general del trabajo, use query_novel_production_status, requireNovelContext=true, interactMode=query, asistenteResponse=execute, deberíaAskFollowup=false, missInfo=[]; la descripción general en sí es una consulta completa y no requiere que el usuario especifique dimensiones como el progreso o los capítulos.",
      "Comprender omisiones y cuestionamientos basados ​​en conversaciones recientes; Si el usuario realmente está comparando planes, buscando un diagnóstico determinado o la referencia no está clara, se debe conservar la intención correspondiente y solicitar sólo la información necesaria. No lo cambies a una descripción general sólo porque la novela actual se menciona en la oración. Si no se puede determinar la intención, se puede devolver y preguntar lo desconocido.",
      "Si el usuario pregunta sobre el estado actual, el siguiente paso, continuar con el avance, avanzar al punto de control, cambiar el modo de avance o modificar manualmente el texto alrededor del director automático, primero se debe usar la intención del director correspondiente en lugar del estado normal de la tarea o el estado de producción completo.",
      "Al cambiar la política de director automático, si el usuario especifica solo dar sugerencias, avanzar al siguiente paso, avanzar al punto de control o avanzar automáticamente en un rango seguro, directorPolicyMode debe completarse como sugerencia_solo, ejecutar_siguiente_paso, ejecutar_until_gate y auto_safe_scope respectivamente.",
      "mayOverwriteUserContent se puede establecer en verdadero si el usuario permite explícitamente que se sobrescriba la escritura a mano; De lo contrario, no lo adivines.",
      "Si el usuario pregunta si existe una determinada palabra clave, patrón de relación, tema, escenario o prototipo de visión del mundo en la base de conocimientos, materiales de libros abiertos indexados o visión del mundo, o quiere encontrar un escenario o caso de referencia similar a X, use search_knowledge primero y no juzgue mal general_chat.",
      "Si el usuario cancela o desvincula la visión del mundo de la novela actual, por ejemplo, no desea esta visión del mundo, cancela la vinculación de la visión del mundo o no usa una determinada visión del mundo primero, use unbind_world_from_novel primero y no lo juzgue erróneamente como bind_world_to_novel.",
      "Si el usuario desea generar varios conjuntos de alternativas en función del título actual, la configuración existente o la información del espacio de trabajo actual, como darme alternativas, dar varias direcciones, proporcionar 3 conjuntos de configuraciones principales o compromisos de historia o planes de estilo de tema, use ideate_novel_setup primero y no juzgue mal general_chat.",
      "projectMode solo puede ser ai_led, co_pilot, draft_mode, auto_pipeline; pacePreference sólo puede ser rápido, equilibrado y lento; NarrativaPov solo puede ser primera_persona, tercera_persona o mixta.",
      "La intensidad de la emoción y la libertad de ai solo pueden ser bajas, medias y altas; defaultChapterLength es un número entero de 500 a 10000.",
      "Los selectores de capítulos pueden contener: ID de capítulo, pedidos, rango {orden inicial, orden final}, relativo {tipo, recuento}.",
      "Si no hay información suficiente, no adivine un ID de capítulo inexistente y simplemente devuelva pedidos, rango o relativo.",
      "Si el usuario pregunta sobre la biblioteca de plantillas de caracteres básicos, debería preferir list_base_characters; Si el usuario pregunta sobre el estado del personaje en la novela actual, debería preferir inspect_characters y preguntar por el contexto de la novela.",
      "La confianza debe evaluarse de forma conservadora y oscila entre 0 y 1.",
      "Simplemente devuelva JSON, no lo interprete.",
    ].join("\n"),
    userPrompt: [
      `Objetivos actuales: ${input.goal}`,
      `Modo contexto: ${input.contextMode}`,
      `novelId: ${input.novelId ?? "none"}`,
      `currentRunId: ${input.currentRunId ?? "none"}`,
      `Estado de ejecución actual: ${input.currentRunStatus ?? "queued"}`,
      `Pasos de ejecución actuales: ${input.currentStep ?? "planning"}`,
      `Últimas noticias:\\n${recentMessages || "none"}`,
      `Catálogo semántico de intención atómica:\\n${semanticCatalog}`,
      `Recetas de flujo de trabajo compuesto:\\n${workflowRecipes}`,
      `Descripción general de las herramientas disponibles:\\n${toolCatalog}`,
      `Resumen de permisos:\\n${permissionSummary}`,
      "Genere un objeto JSON válido.",
    ].join("\n\n"),
  };
}
