const WORKFLOW_ACTIVITY_TAGS = [
  "Se están reintroduciendo activos",
  "Desarrollo del personaje",
  "Sincronización de estado",
  "Sincronización del libro mayor de recursos en curso",
  "El libro mayor de presagios se está sincronizando.",
  "Calibración del libro mayor en progreso",
  "El presagio se está rellenando",
] as const;

export function extractWorkflowActivityTags(value: string | null | undefined): string[] {
  const source = value?.trim() ?? "";
  if (!source) {
    return [];
  }
  return WORKFLOW_ACTIVITY_TAGS.filter((label) => source.includes(label));
}
