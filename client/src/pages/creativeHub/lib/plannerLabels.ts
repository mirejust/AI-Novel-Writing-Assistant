const INTENT_LABELS: Record<string, string> = {
  social_opening: "Apertura de luz",
  list_novels: "Lista de novelas",
  list_worlds: "Lista de cosmovisión",
  query_task_status: "Consultar el estado de la tarea",
  create_novel: "Crear una novela",
  select_novel_workspace: "Cambiar espacio de trabajo novedoso",
  bind_world_to_novel: "Vincular la cosmovisión a la novela.",
  unbind_world_from_novel: "Desvincular la cosmovisión de la novela.",
  produce_novel: "Toda la producción",
  query_novel_production_status: "Consulta todo el estado de producción.",
  query_novel_title: "Consultar título de novela",
  query_chapter_content: "Consultar contenido del capítulo.",
  query_progress: "Verificar el progreso de la creación",
  inspect_failure_reason: "Motivo del error de diagnóstico",
  write_chapter: "Escribir capítulos",
  rewrite_chapter: "Reescribir el capítulo",
  save_chapter_draft: "Guardar borrador de capítulo",
  start_pipeline: "Iniciar el oleoducto",
  inspect_characters: "Ver planificación de roles",
  inspect_timeline: "Ver línea de tiempo",
  inspect_world: "Ver visión del mundo",
  search_knowledge: "Buscar base de conocimientos",
  ideate_novel_setup: "Generar alternativas de configuración",
  general_chat: "Conversación general",
  unknown: "Intención no reconocida",
};

const PLANNER_SOURCE_LABELS: Record<string, string> = {
  llm: "Reconocimiento de modelos grandes",
  unknown: "Fuente desconocida",
};

function formatBilingualLabel(label: string, rawValue: string) {
  return `${label}(${rawValue})`;
}

export function getIntentDisplayLabel(intent: unknown): string {
  const rawValue = typeof intent === "string" && intent.trim() ? intent.trim() : "unknown";
  const label = INTENT_LABELS[rawValue] ?? "Intención no asignada";
  return formatBilingualLabel(label, rawValue);
}

export function getPlannerSourceDisplayLabel(source: unknown): string {
  const rawValue = typeof source === "string" && source.trim() ? source.trim() : "unknown";
  const label = PLANNER_SOURCE_LABELS[rawValue] ?? "Fuente no asignada";
  return formatBilingualLabel(label, rawValue);
}
