import { z } from "zod";
import type { NovelStoryMode, StoryModeConflictCeiling, StoryModeProfile } from "@ai-novel/shared/types/storyMode";

export const storyModeConflictCeilingSchema = z.enum(["low", "medium", "high"]);

export const storyModeProfileSchema = z.object({
  coreDrive: z.string().trim().min(1).max(300),
  readerReward: z.string().trim().min(1).max(300),
  progressionUnits: z.array(z.string().trim().min(1).max(120)).min(1).max(8),
  allowedConflictForms: z.array(z.string().trim().min(1).max(120)).min(1).max(8),
  forbiddenConflictForms: z.array(z.string().trim().min(1).max(120)).min(1).max(8),
  conflictCeiling: storyModeConflictCeilingSchema,
  resolutionStyle: z.string().trim().min(1).max(300),
  chapterUnit: z.string().trim().min(1).max(300),
  volumeReward: z.string().trim().min(1).max(300),
  mandatorySignals: z.array(z.string().trim().min(1).max(120)).min(1).max(8),
  antiSignals: z.array(z.string().trim().min(1).max(120)).min(1).max(8),
}).strict();

const DEFAULT_STORY_MODE_PROFILE: StoryModeProfile = {
  coreDrive: "Promueva la experiencia de serialización cumpliendo de manera estable las expectativas de lectura básicas.",
  readerReward: "Hay una sensación clara y palpable de satisfacción cada pocos capítulos.",
  progressionUnits: ["Avance clave en las relaciones", "Cumplir objetivos escalonados"],
  allowedConflictForms: ["Conflicto de intensidad baja a media consistente con el impulso primario"],
  forbiddenConflictForms: ["Conflicto sangriento de alta presión no relacionado"],
  conflictCeiling: "medium",
  resolutionStyle: "Priorice el uso de métodos consistentes con este patrón para resolver problemas en lugar de forzar actualizaciones.",
  chapterUnit: "Cada capítulo está organizado en torno a una unidad clara de avance.",
  volumeReward: "Al final del volumen, se proporcionan reembolsos escalonados de acuerdo con el patrón.",
  mandatorySignals: ["La unidad principal sigue apareciendo", "Los lectores esperan una confirmación repetida"],
  antiSignals: ["Desviación a largo plazo del accionamiento principal", "La intensidad del conflicto está fuera de control"],
};

function normalizeText(value: unknown, fallback: string): string {
  const trimmed = typeof value === "string" ? value.trim() : "";
  return trimmed || fallback;
}

function normalizeList(value: unknown, fallback: string[]): string[] {
  if (!Array.isArray(value)) {
    return fallback;
  }
  const normalized = value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean)
    .slice(0, 8);
  return normalized.length > 0 ? normalized : fallback;
}

function normalizeConflictCeiling(value: unknown): StoryModeConflictCeiling {
  return value === "low" || value === "medium" || value === "high"
    ? value
    : DEFAULT_STORY_MODE_PROFILE.conflictCeiling;
}

export function sanitizeStoryModeProfile(value: unknown): StoryModeProfile {
  if (!value || typeof value !== "object") {
    return DEFAULT_STORY_MODE_PROFILE;
  }
  const record = value as Partial<StoryModeProfile>;
  return storyModeProfileSchema.parse({
    coreDrive: normalizeText(record.coreDrive, DEFAULT_STORY_MODE_PROFILE.coreDrive),
    readerReward: normalizeText(record.readerReward, DEFAULT_STORY_MODE_PROFILE.readerReward),
    progressionUnits: normalizeList(record.progressionUnits, DEFAULT_STORY_MODE_PROFILE.progressionUnits),
    allowedConflictForms: normalizeList(record.allowedConflictForms, DEFAULT_STORY_MODE_PROFILE.allowedConflictForms),
    forbiddenConflictForms: normalizeList(record.forbiddenConflictForms, DEFAULT_STORY_MODE_PROFILE.forbiddenConflictForms),
    conflictCeiling: normalizeConflictCeiling(record.conflictCeiling),
    resolutionStyle: normalizeText(record.resolutionStyle, DEFAULT_STORY_MODE_PROFILE.resolutionStyle),
    chapterUnit: normalizeText(record.chapterUnit, DEFAULT_STORY_MODE_PROFILE.chapterUnit),
    volumeReward: normalizeText(record.volumeReward, DEFAULT_STORY_MODE_PROFILE.volumeReward),
    mandatorySignals: normalizeList(record.mandatorySignals, DEFAULT_STORY_MODE_PROFILE.mandatorySignals),
    antiSignals: normalizeList(record.antiSignals, DEFAULT_STORY_MODE_PROFILE.antiSignals),
  });
}

export function parseStoryModeProfileJson(profileJson: string | null | undefined): StoryModeProfile {
  if (!profileJson?.trim()) {
    return DEFAULT_STORY_MODE_PROFILE;
  }
  try {
    return sanitizeStoryModeProfile(JSON.parse(profileJson));
  } catch {
    return DEFAULT_STORY_MODE_PROFILE;
  }
}

export function serializeStoryModeProfile(profile: unknown): string {
  return JSON.stringify(sanitizeStoryModeProfile(profile));
}

type StoryModeRow = {
  id: string;
  name: string;
  description?: string | null;
  template?: string | null;
  parentId?: string | null;
  profileJson?: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
};

export function normalizeStoryModeOutput<T extends StoryModeRow>(
  storyMode: T,
): Omit<T, "profileJson" | "createdAt" | "updatedAt"> & NovelStoryMode {
  const { profileJson, createdAt, updatedAt, ...rest } = storyMode;
  return {
    ...rest,
    profile: parseStoryModeProfileJson(profileJson),
    createdAt: typeof createdAt === "string" ? createdAt : createdAt.toISOString(),
    updatedAt: typeof updatedAt === "string" ? updatedAt : updatedAt.toISOString(),
  };
}

export function buildStoryModePromptBlock(input: {
  primary?: (Pick<NovelStoryMode, "id" | "name" | "description" | "template" | "profile">) | null;
  secondary?: (Pick<NovelStoryMode, "id" | "name" | "description" | "template" | "profile">) | null;
}): string {
  const sections: string[] = [];
  if (input.primary) {
    sections.push(formatSingleStoryModeBlock("modelo convencional", input.primary, true));
  }
  if (input.secondary) {
    sections.push(formatSingleStoryModeBlock("modo subgénero", input.secondary, false));
  }
  if (sections.length === 0) {
    return "";
  }
  return [
    "Restricciones del modo de género: el modo de género principal es una restricción estricta. El modo de subgénero solo puede complementar el sabor y no puede cubrir el límite superior del conflicto y la señal de prohibición del modo principal.",
    ...sections,
  ].join("\n\n");
}

function formatSingleStoryModeBlock(
  label: string,
  storyMode: Pick<NovelStoryMode, "name" | "description" | "template" | "profile">,
  isPrimary: boolean,
): string {
  const profile = storyMode.profile;
  return [
    `${label}:${storyMode.name}`,
    storyMode.description ? `ilustrar:${storyMode.description}` : "",
    storyMode.template ? `Plantilla complementaria:${storyMode.template}` : "",
    `Controlador principal:${profile.coreDrive}`,
    `Recompensas del lector:${profile.readerReward}`,
    `Unidad de promoción del capítulo:${profile.chapterUnit}`,
    `Retiro al final del volumen:${profile.volumeReward}`,
    `Formas de conflicto permitidas:${profile.allowedConflictForms.join(",")}`,
    `Formas prohibidas de conflicto:${profile.forbiddenConflictForms.join(",")}`,
    `Límite de conflicto:${profile.conflictCeiling}`,
    `Solución:${profile.resolutionStyle}`,
    `Señales que deben aparecer repetidamente:${profile.mandatorySignals.join(",")}`,
    `Señales de desviación que deben evitarse:${profile.antiSignals.join(",")}`,
    `Las principales unidades impulsoras de la trama:${profile.progressionUnits.join(",")}`,
    isPrimary
      ? "Requisitos de uso: La planificación y generación posterior debe dar prioridad a este modo."
      : "Requisitos de uso: solo se puede utilizar como versión complementaria y no debe destruir los límites del modo principal.",
  ].filter(Boolean).join("\n");
}
