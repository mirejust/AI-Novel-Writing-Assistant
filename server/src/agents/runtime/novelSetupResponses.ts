import type { CreativeHubNovelSetupStatus } from "@ai-novel/shared/types/creativeHub";

function stageLabel(stage: CreativeHubNovelSetupStatus["stage"]): string {
  switch (stage) {
    case "ready_for_production":
      return "Las bases para iniciar toda la producción ya están sentadas";
    case "ready_for_planning":
      return "Ya tengo la base para entrar en el esquema de planificación.";
    default:
      return "Aún en etapa de inicialización";
  }
}

export function parseNovelSetupStatus(value: unknown): CreativeHubNovelSetupStatus | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const record = value as Record<string, unknown>;
  if (
    typeof record.novelId !== "string"
    || typeof record.title !== "string"
    || typeof record.stage !== "string"
    || typeof record.nextQuestion !== "string"
    || typeof record.recommendedAction !== "string"
    || !Array.isArray(record.missingItems)
  ) {
    return null;
  }
  return record as unknown as CreativeHubNovelSetupStatus;
}

export function buildNovelSetupGuidanceFacts(setup: CreativeHubNovelSetupStatus): string {
  const missing = setup.missingItems.slice(0, 5).join(",");
  const priorityItem = setup.checklist
    .find((item) => item.requiredForProduction && item.status !== "ready")
    ?? setup.checklist.find((item) => item.status !== "ready");
  const currentValue = priorityItem?.currentValue?.trim();
  const lines = [
    `Título de la novela:${setup.title}`,
    `Etapa actual:${stageLabel(setup.stage)}`,
    `Lo completo:${setup.completedCount}/${setup.totalCount}(${setup.completionRatio}%)`,
    `Elementos a llenar:${missing || "Sin datos"}`,
    `Priorizar la adición:${priorityItem?.label ?? "Sin datos"}`,
    `El sistema sugiere hacer preguntas:${setup.nextQuestion}`,
    `Acciones recomendadas por el sistema:${setup.recommendedAction}`,
  ];

  if (currentValue) {
    lines.push(`Este artículo actualmente tiene información:${currentValue}`);
  }

  return lines.join("\n");
}

export function formatNovelSetupGuidance(prefix: string, setup: CreativeHubNovelSetupStatus): string {
  const missing = setup.missingItems.slice(0, 3).join(",");
  const lines = [prefix];

  lines.push(`Estado actual:${stageLabel(setup.stage)}(${setup.completedCount}/${setup.totalCount} el artículo está listo).`);
  if (missing) {
    lines.push(`Todavía debe completarse el próximo ${missing}${setup.missingItems.length > 3 ? " esperar" : ""}.`);
  }
  lines.push(`Hablemos de esto primero:${setup.nextQuestion}`);
  lines.push(`Si aún no lo has decidido, primero puedo darte algunas direcciones alternativas.`);

  return lines.join("\n");
}
