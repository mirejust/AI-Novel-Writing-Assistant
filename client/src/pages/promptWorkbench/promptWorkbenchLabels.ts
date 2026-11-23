import type { NovelMaterialImportance, PromptCatalogItem } from "@/api/promptWorkbench";

export const LOCKED_FIELD_LABELS: Record<string, string> = {
  outputSchema: "Formato de salida",
  postValidate: "Verificación de salida",
  postValidateFailureRecovery: "Recuperación de un error de verificación",
  semanticRetryPolicy: "Estrategia de reintento semántico",
  taskType: "Tipo de tarea",
  mode: "Modo de salida",
  contextPolicy: "Estrategia contextual",
  toolCatalog: "Catálogo de herramientas",
  approvalBoundary: "Límites de aprobación",
};

export const SLOT_KIND_LABELS: Record<string, string> = {
  replace: "Reescribir",
  append: "Agregar restricciones",
  choice: "Opciones",
  toggle: "Cambiar",
  token: "Valor en línea",
};

export const CONTEXT_GROUP_LABELS: Record<string, string> = {
  book_contract: "Contrato de libro completo",
  chapter_boundary: "Límites del capítulo",
  chapter_mission: "Tareas en este capítulo",
  character_dynamics: "Dinámica de la relación de roles",
  character_hard_facts: "Hechos concretos del personaje",
  character_resource_context: "Estado del recurso de rol",
  continuation_constraints: "Restricciones de continuación",
  custom_slot: "Restricciones personalizadas",
  historical_issues: "Problemas de revisión histórica",
  incremental_round_context: "Rondas de generación incremental",
  local_state: "Situación actual",
  narrative_progress_hint: "Indicaciones de progreso narrativo",
  obligation_contract: "Contrato de obligacion",
  open_conflicts: "Conflicto abierto",
  opening_constraints: "Restricciones de apertura",
  participant_subset: "Rol de participación",
  payoff_directives: "Instrucciones de operación de presagio",
  payoff_ledger: "Cuenta de presagio",
  previous_chapter_hook: "Gancho del capítulo",
  previous_chapter_tail: "Fin del último capítulo.",
  rag_context: "Suplemento de búsqueda",
  recent_chapters: "Resumen de capítulos recientes",
  repair_boundaries: "Restricciones del alcance de la revisión",
  repair_issues: "Lista de preguntas de revisión",
  state_goal: "Estado y objetivos",
  story_macro: "estructura macro de la historia",
  structure_obligations: "Obligaciones estructurales",
  style_contract: "Contrato de estilo",
  timeline_context: "Línea de tiempo",
  volume_window: "Progreso del nivel de volumen",
  world_rules: "Reglas del mundo",
  world_slice: "Fragmento del mundo",
};

export const SOURCE_TYPE_LABELS: Record<string, string> = {
  novel: "Novela",
  chapter: "Capítulos",
  plan: "Planear",
  state: "Estado",
  character: "Personaje",
  world: "Ambientación del mundo",
  style: "Estilo",
  audit: "Revisión",
  task: "Tarea",
};

export const MESSAGE_ROLE_LABELS: Record<string, string> = {
  system: "Sistema",
  human: "Usuario",
  assistant: "Modelo",
  ai: "Modelo",
};

export const TASK_TYPE_LABELS: Record<string, string> = {
  writer: "Escribiendo",
  light_review: "Corrección ligera",
  critical_review: "Revisión completa",
  repair: "Revisar el artículo.",
  summary: "Resumen",
  planning: "Planificación",
  translation: "Traducir",
  analysis: "Analizar",
  classification: "Clasificación",
};

export const OUTPUT_TYPE_LABELS: Record<string, string> = {
  structured: "Salida estructurada",
  text: "Salida de texto",
};

export const ENTRYPOINT_OPTIONS = [
  { value: "creative_hub", label: "Centro creativo" },
  { value: "auto_director", label: "Director automático" },
  { value: "chapter_pipeline", label: "Canalización de capítulos" },
  { value: "manual_test", label: "Pruebas manuales" },
];

export const MANAGEMENT_STATUS_LABELS: Record<PromptCatalogItem["managementStatus"], string> = {
  complete: "Los metadatos están completos.",
  missing_context_requirements: "Requisitos contextuales faltantes",
  missing_slots: "Declaración de espacio faltante",
  missing_advanced_template: "Faltan plantillas avanzadas",
};

export const MATERIAL_IMPORTANCE_LABELS: Record<NovelMaterialImportance, string> = {
  must: "Requerido",
  high: "Importante",
  medium: "Auxiliar",
  low: "Referencia",
};

export const CONTEXT_STATUS_LABELS = {
  selected: "Inyectado",
  dropped: "Recortado",
  summarized: "Resumen",
  available: "Candidato",
} as const;

export const LOCKED_CONTEXT_GROUPS = new Set([
  "chapter_mission",
  "character_hard_facts",
  "obligation_contract",
  "style_contract",
  "local_state",
  "timeline_context",
  "previous_chapter_hook",
  "volume_window",
  "participant_subset",
]);

export function statusBadgeVariant(status: PromptCatalogItem["managementStatus"]) {
  return status === "complete" ? "default" : "secondary";
}

export function capabilityLabels(prompt: PromptCatalogItem): string[] {
  return [
    prompt.capabilities.hasOutputSchema ? "Schema" : null,
    prompt.capabilities.hasPostValidate ? "PostValidate" : null,
    prompt.capabilities.hasSemanticRetryPolicy ? "SemanticRetry" : null,
    prompt.capabilities.hasRepairPolicy ? "Repair" : null,
    prompt.capabilities.hasStructuredOutputHint ? "OutputHint" : null,
    prompt.capabilities.supportsAdvancedTemplate ? "Plantilla avanzada" : null,
  ].filter(Boolean) as string[];
}
