import type { World as PrismaWorld } from "@prisma/client";
import type { WorldLayerKey } from "@ai-novel/shared/types/world";
import {
  parseWorldGenerationBlueprint,
  type WorldGenerationBlueprint,
} from "@ai-novel/shared/types/worldWizard";

type WorldTextField =
  | "description"
  | "background"
  | "geography"
  | "cultures"
  | "magicSystem"
  | "politics"
  | "races"
  | "religions"
  | "technology"
  | "conflicts"
  | "history"
  | "economy"
  | "factions";

const WORLD_LAYER_LABELS: Record<WorldLayerKey, string> = {
  foundation: "capa base",
  power: "capa de fuerza",
  society: "capa social",
  culture: "nivel cultural",
  history: "capa histórica",
  conflict: "capa de conflicto",
};

const STORED_DIMENSION_LABELS: Record<string, string> = {
  foundation: "capa base",
  power: "capa de fuerza",
  society: "capa social",
  culture: "nivel cultural",
  history: "capa histórica",
  conflict: "capa de conflicto",
  geography: "entorno geográfico",
  magicSystem: "sistema de energía",
  technology: "Sistema técnico",
};

const WORLD_REFERENCE_MODE_LABELS = {
  extract_base: "Extrae la base mundial original.",
  adapt_world: "Una transformación aérea basada en el trabajo original.",
  tone_rebuild: "Reconstruir utilizando únicamente el temperamento y la estructura de la obra original.",
} as const;

function parseStoredDimensionLabels(raw: string | null | undefined): string[] {
  if (!raw?.trim()) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (!parsed || typeof parsed !== "object") {
      return [];
    }

    return Object.entries(parsed)
      .filter(([, value]) => value === true)
      .map(([key]) => STORED_DIMENSION_LABELS[key] ?? key)
      .filter(Boolean);
  } catch {
    return [];
  }
}

export function parseWorldBlueprintFromWorld(world: Pick<PrismaWorld, "selectedElements">): WorldGenerationBlueprint {
  return parseWorldGenerationBlueprint(world.selectedElements);
}

export function buildWorldBlueprintPromptBlock(
  world: Pick<PrismaWorld, "selectedDimensions" | "selectedElements">,
): string {
  const blueprint = parseWorldBlueprintFromWorld(world);
  const enabledDimensions = parseStoredDimensionLabels(world.selectedDimensions);

  const sections: string[] = [];

  if (enabledDimensions.length > 0) {
    sections.push(`Dimensiones generadas seleccionadas por el usuario:${enabledDimensions.join(",")}`);
  }

  if (blueprint.classicElements.length > 0) {
    sections.push(`Elementos clásicos retenidos por los usuarios:${blueprint.classicElements.join(",")}`);
  }

  if (blueprint.propertySelections.length > 0) {
    const propertyLines = blueprint.propertySelections.map((selection) => {
      const choice = selection.choiceLabel?.trim()
        ? `;Seleccione dirección:${selection.choiceLabel.trim()}${selection.choiceSummary?.trim() ? `(${selection.choiceSummary.trim()})` : ""}`
        : "";
      const detail = selection.detail?.trim() ? `;Usuario añadido:${selection.detail.trim()}` : "";
      return `- [${WORLD_LAYER_LABELS[selection.targetLayer]}] ${selection.name}:${selection.description}${choice}${detail}`;
    });
    sections.push(`Atributos del mundo seleccionados por el usuario: \\n${propertyLines.join("\n")}`);
  }

  if (blueprint.referenceContext) {
    sections.push(`Cómo manejar obras de referencia:${WORLD_REFERENCE_MODE_LABELS[blueprint.referenceContext.mode]}`);

    if (blueprint.referenceContext.anchors.length > 0) {
      sections.push(
        `Ancla mundial del trabajo de referencia: \\n${blueprint.referenceContext.anchors.map((item) => `- ${item.label}:${item.content}`).join("\n")}`,
      );
    }

    if (blueprint.referenceContext.preserveElements.length > 0) {
      sections.push(`Debe conservarse:${blueprint.referenceContext.preserveElements.join(",")}`);
    }

    if (blueprint.referenceContext.allowedChanges.length > 0) {
      sections.push(`Modificaciones permitidas:${blueprint.referenceContext.allowedChanges.join(",")}`);
    }

    if (blueprint.referenceContext.forbiddenElements.length > 0) {
      sections.push(`Desviaciones prohibidas de:${blueprint.referenceContext.forbiddenElements.join(",")}`);
    }

    const selectedRuleNames = (blueprint.referenceContext.referenceSeeds?.rules ?? [])
      .filter((item) => blueprint.referenceContext?.selectedSeedIds?.ruleIds.includes(item.id))
      .map((item) => item.name);
    if (selectedRuleNames.length > 0) {
      sections.push(`Reglas originales seguidas directamente:${selectedRuleNames.join(",")}`);
    }

    const selectedFactionNames = (blueprint.referenceContext.referenceSeeds?.factions ?? [])
      .filter((item) => blueprint.referenceContext?.selectedSeedIds?.factionIds.includes(item.id))
      .map((item) => item.name);
    if (selectedFactionNames.length > 0) {
      sections.push(`El campamento original utilizó directamente:${selectedFactionNames.join(",")}`);
    }

    const selectedForceNames = (blueprint.referenceContext.referenceSeeds?.forces ?? [])
      .filter((item) => blueprint.referenceContext?.selectedSeedIds?.forceIds.includes(item.id))
      .map((item) => item.name);
    if (selectedForceNames.length > 0) {
      sections.push(`Las fuerzas originales utilizadas directamente:${selectedForceNames.join(",")}`);
    }

    const selectedLocationNames = (blueprint.referenceContext.referenceSeeds?.locations ?? [])
      .filter((item) => blueprint.referenceContext?.selectedSeedIds?.locationIds.includes(item.id))
      .map((item) => item.name);
    if (selectedLocationNames.length > 0) {
      sections.push(`Ubicaciones originales utilizadas directamente:${selectedLocationNames.join(",")}`);
    }
  }

  return sections.length > 0 ? sections.join("\n\n") : "No hay restricciones de planos mundiales adicionales.";
}

export function applyGeneratedWorldFields<T extends Pick<PrismaWorld, WorldTextField>>(
  world: T,
  generated: Partial<Record<WorldTextField, string>>,
): T {
  return {
    ...world,
    ...generated,
  };
}
