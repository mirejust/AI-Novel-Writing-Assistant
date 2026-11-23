import type {
  StoryWorldSlice,
  StoryWorldSliceForce,
  StoryWorldSliceLocation,
  StoryWorldSliceRule,
} from "@ai-novel/shared/types/storyWorldSlice";

export interface LegacyWorldContextSource {
  name: string;
  worldType?: string | null;
  description?: string | null;
  axioms?: string | null;
  background?: string | null;
  geography?: string | null;
  magicSystem?: string | null;
  politics?: string | null;
  races?: string | null;
  religions?: string | null;
  technology?: string | null;
  conflicts?: string | null;
  history?: string | null;
  economy?: string | null;
  factions?: string | null;
}

function formatRule(rule: StoryWorldSliceRule): string {
  return [
    rule.name,
    rule.summary && `ilustrar: ${rule.summary}`,
    rule.whyItMatters && `efecto: ${rule.whyItMatters}`,
  ].filter(Boolean).join(" | ");
}

function formatForce(force: StoryWorldSliceForce): string {
  return [
    force.name,
    force.summary && `Descripción general: ${force.summary}`,
    force.roleInStory && `Papel en este libro: ${force.roleInStory}`,
    force.pressure && `La presión que traerá: ${force.pressure}`,
  ].filter(Boolean).join(" | ");
}

function formatLocation(location: StoryWorldSliceLocation): string {
  return [
    location.name,
    location.summary && `Descripción general: ${location.summary}`,
    location.storyUse && `Trama adecuada: ${location.storyUse}`,
    location.risk && `riesgo: ${location.risk}`,
  ].filter(Boolean).join(" | ");
}

export function formatStoryWorldSlicePromptBlock(slice: StoryWorldSlice): string {
  return [
    "El entorno mundial utilizado en este libro:",
    slice.coreWorldFrame ? `Etapa central:${slice.coreWorldFrame}` : "",
    slice.appliedRules.length > 0
      ? `Normas actuales que se deben seguir: \\n${slice.appliedRules.map((item) => `- ${formatRule(item)}`).join("\n")}`
      : "",
    slice.activeForces.length > 0
      ? `Organizaciones y fuerzas actualmente involucradas en la historia: \\n${slice.activeForces.map((item) => `- ${formatForce(item)}`).join("\n")}`
      : "",
    slice.activeLocations.length > 0
      ? `La ubicación actual que realmente se utilizará: \\n${slice.activeLocations.map((item) => `- ${formatLocation(item)}`).join("\n")}`
      : "",
    slice.conflictCandidates.length > 0
      ? `Dirección de conflicto directamente ampliable: \\n${slice.conflictCandidates.map((item) => `- ${item}`).join("\n")}`
      : "",
    slice.pressureSources.length > 0
      ? `Fuente principal de presión: \\n${slice.pressureSources.map((item) => `- ${item}`).join("\n")}`
      : "",
    slice.mysterySources.length > 0
      ? `Preguntas que mantienen el interés de los lectores: \\n${slice.mysterySources.map((item) => `- ${item}`).join("\n")}`
      : "",
    slice.suggestedStoryAxes.length > 0
      ? `Eje de historia prioritaria: \\n${slice.suggestedStoryAxes.map((item) => `- ${item}`).join("\n")}`
      : "",
    slice.recommendedEntryPoints.length > 0
      ? `Punto de entrada adecuado para la apertura: \\n${slice.recommendedEntryPoints.map((item) => `- ${item}`).join("\n")}`
      : "",
    slice.forbiddenCombinations.length > 0
      ? `No cruces la línea con: \\n${slice.forbiddenCombinations.map((item) => `- ${item}`).join("\n")}`
      : "",
    slice.storyScopeBoundary ? `Límites del libro:${slice.storyScopeBoundary}` : "",
  ].filter(Boolean).join("\n\n");
}

export function buildLegacyWorldContextFromWorld(world: LegacyWorldContextSource | null | undefined): string {
  if (!world) {
    return "Contexto mundial: Ninguno";
  }

  let axiomsText = "";
  if (world.axioms) {
    try {
      const parsed = JSON.parse(world.axioms) as string[];
      axiomsText = Array.isArray(parsed) && parsed.length > 0
        ? parsed.map((item) => `- ${item}`).join("\n")
        : world.axioms;
    } catch {
      axiomsText = world.axioms;
    }
  }

  return [
    "Contexto mundial:",
    `Nombre mundial:${world.name}`,
    `Tipo de mundo:${world.worldType ?? "No especificado"}`,
    `Introducción al mundo:${world.description ?? ""}`,
    "Axiomas centrales:",
    axiomsText,
    `fondo:${world.background ?? ""}`,
    `geografía:${world.geography ?? ""}`,
    `Sistema de energía:${world.magicSystem ?? ""}`,
    `Sociopolítico:${world.politics ?? ""}`,
    `Carrera:${world.races ?? ""}`,
    `religión:${world.religions ?? ""}`,
    `ciencia y tecnología:${world.technology ?? ""}`,
    `historia:${world.history ?? ""}`,
    `economía:${world.economy ?? ""}`,
    `Relaciones de poder:${world.factions ?? ""}`,
    `Conflicto central:${world.conflicts ?? ""}`,
  ].join("\n");
}
