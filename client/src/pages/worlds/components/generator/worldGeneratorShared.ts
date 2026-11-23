import type {
  WorldOptionRefinementLevel,
  WorldPropertyOption,
  WorldReferenceMode,
  WorldReferenceSeedBundle,
  WorldReferenceSeedSelection,
} from "@ai-novel/shared/types/worldWizard";

export type InspirationMode = "free" | "reference" | "random";

export interface WorldGeneratorConceptCard {
  worldType: string;
  templateKey: string;
  coreImagery: string[];
  tone: string;
  keywords: string[];
  summary: string;
}

export interface GeneratorGenreOption {
  id: string;
  name: string;
  path: string;
  description?: string | null;
  template?: string | null;
}

export interface WorldGeneratorTemplateOption {
  key: string;
  name: string;
  description: string;
  worldType: string;
  classicElements: string[];
  pitfalls: string[];
}

export const REFERENCE_MODE_OPTIONS: Array<{
  value: WorldReferenceMode;
  label: string;
  description: string;
}> = [
  {
    value: "adapt_world",
    label: "Una transformación aérea basada en el trabajo original.",
    description: "Mantén la base del mundo original y luego decide qué reglas, fuerzas y estructuras de ubicación se pueden modificar.",
  },
  {
    value: "extract_base",
    label: "Extrae la base mundial original.",
    description: "Primero, extraiga constantemente el esqueleto del mundo original y luego intente expandir el trabajo en torno a los hechos del trabajo original.",
  },
  {
    value: "tone_rebuild",
    label: "Reconstruir utilizando únicamente el temperamento y la estructura de la obra original.",
    description: "Se conservan la atmósfera, la estructura de las relaciones y la sensación de vida, pero se permite reconstruir en mayor medida los hechos del mundo.",
  },
];

export const DEFAULT_DIMENSIONS: Record<string, boolean> = {
  foundation: true,
  power: true,
  society: true,
  culture: true,
  history: true,
  conflict: true,
};

const DIMENSION_LABELS: Record<string, string> = {
  foundation: "Capa base",
  power: "Capa de fuerza",
  society: "Capa social",
  culture: "Nivel cultural",
  history: "Capa histórica",
  conflict: "Capa de conflicto",
};

export const REFERENCE_SEED_SELECTION_KEYS: Record<
  keyof WorldReferenceSeedBundle,
  keyof WorldReferenceSeedSelection
> = {
  rules: "ruleIds",
  factions: "factionIds",
  forces: "forceIds",
  locations: "locationIds",
};

export function getDimensionLabel(key: string): string {
  return DIMENSION_LABELS[key] ?? key;
}

export function normalizeAxiomTexts(items: unknown): string[] {
  if (!Array.isArray(items)) {
    return [];
  }
  return items
    .map((item) => (typeof item === "string" ? item.trim() : String(item ?? "").trim()))
    .filter(Boolean);
}

export function clampOptionsCount(value: number): number {
  return Math.max(4, Math.min(8, Math.floor(value)));
}

export function parseReferenceControlText(value: string): string[] {
  return Array.from(
    new Set(
      value
        .split(/[\n,，;；]/)
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  );
}

export function getReferenceModeLabel(mode: WorldReferenceMode): string {
  return REFERENCE_MODE_OPTIONS.find((item) => item.value === mode)?.label ?? "Una transformación aérea basada en el trabajo original.";
}

export function buildDefaultPropertySelectionState(options: WorldPropertyOption[]) {
  return {
    selectedIds: options.map((option) => option.id),
    selectedChoiceIds: options.reduce<Record<string, string>>((acc, option) => {
      const firstChoiceId = option.choices?.[0]?.id;
      if (firstChoiceId) {
        acc[option.id] = firstChoiceId;
      }
      return acc;
    }, {}),
  };
}

export function buildDefaultReferenceSeedSelection(seeds: WorldReferenceSeedBundle): WorldReferenceSeedSelection {
  return {
    ruleIds: seeds.rules.map((item) => item.id),
    factionIds: seeds.factions.map((item) => item.id),
    forceIds: seeds.forces.map((item) => item.id),
    locationIds: seeds.locations.map((item) => item.id),
  };
}

export function isWorldGeneratorTemplateOption(
  value: unknown,
): value is WorldGeneratorTemplateOption {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const record = value as Record<string, unknown>;
  return typeof record.key === "string" && typeof record.name === "string";
}

export type GeneratorOptionRefinementLevel = WorldOptionRefinementLevel;
