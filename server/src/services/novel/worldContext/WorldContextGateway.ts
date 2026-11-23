import type { LLMProvider } from "@ai-novel/shared/types/llm";
import type { NovelWorldGenerateInput } from "@ai-novel/shared/types/novelWorld";
import type {
  StoryWorldSlice,
  StoryWorldSliceBuilderMode,
  StoryWorldSliceForce,
  StoryWorldSliceLocation,
} from "@ai-novel/shared/types/storyWorldSlice";
import { NovelWorldSliceService } from "../storyWorldSlice/NovelWorldSliceService";
import { NovelWorldInstanceService } from "./NovelWorldInstanceService";

export type WorldContextPurpose = "outline" | "character" | "chapter" | "bible" | "optimize";
export type WorldContextStrength = "light" | "normal" | "strict";

export interface WorldContextBlock {
  novelWorldId: string;
  sourceType: "story_slice";
  purpose: WorldContextPurpose;
  strength: WorldContextStrength;
  summaryText: string;
  promptBlock: string;
  worldRulesText: string;
  worldStageText: string;
  hardRules: string[];
  softRules: string[];
  activeForces: Array<{
    id: string;
    name: string;
    roleInStory: string;
    pressure: string;
  }>;
  activeLocations: Array<{
    id: string;
    name: string;
    storyUse: string;
  }>;
  forbiddenCombinations: string[];
  expansionHints: string[];
  rawSlice: StoryWorldSlice;
}

export interface WorldContextGatewayOptions {
  purpose: WorldContextPurpose;
  strength?: WorldContextStrength;
  forceRefresh?: boolean;
  storyInput?: string;
  provider?: LLMProvider;
  model?: string;
  temperature?: number;
}

export interface WorldContextGatewayGenerateOptions extends NovelWorldGenerateInput {
  storyMacroContext?: string;
  bookContractContext?: string;
  openingOnly?: boolean;
}

function compactList(items: string[], fallback = "Sin datos"): string {
  const normalized = items.map((item) => item.trim()).filter(Boolean);
  return normalized.length > 0 ? normalized.map((item) => `- ${item}`).join("\n") : fallback;
}

function mapPurposeToBuilderMode(purpose: WorldContextPurpose): StoryWorldSliceBuilderMode {
  switch (purpose) {
    case "outline":
      return "outline";
    case "bible":
      return "bible";
    case "character":
    case "chapter":
    case "optimize":
      return "runtime";
    default:
      return "runtime";
  }
}

function formatRule(rule: StoryWorldSlice["appliedRules"][number]): string {
  return [
    rule.name,
    rule.summary ? `ilustrar:${rule.summary}` : "",
    rule.whyItMatters ? `Influencia:${rule.whyItMatters}` : "",
  ].filter(Boolean).join(" | ");
}

function formatForce(force: StoryWorldSlice["activeForces"][number]): string {
  return [
    force.name,
    force.roleInStory ? `Función de este libro:${force.roleInStory}` : "",
    force.pressure ? `Método de presión:${force.pressure}` : "",
    force.summary ? `Descripción general:${force.summary}` : "",
  ].filter(Boolean).join(" | ");
}

function formatLocation(location: StoryWorldSlice["activeLocations"][number]): string {
  return [
    location.name,
    location.storyUse ? `Uso de la trama:${location.storyUse}` : "",
    location.risk ? `riesgo:${location.risk}` : "",
    location.summary ? `Descripción general:${location.summary}` : "",
  ].filter(Boolean).join(" | ");
}

function buildPurposeLead(purpose: WorldContextPurpose): string {
  switch (purpose) {
    case "character":
      return "La generación de personajes debe adaptarse al mundo de este libro: dar prioridad al uso de fuerzas activas, límites de identidad, presión de ubicación y combinaciones prohibidas, y no generar personajes que se desvíen de las reglas del mundo.";
    case "outline":
      return "La planificación de la historia debe utilizar el mundo de este libro: priorizar el diseño de la línea principal en torno a reglas centrales, fuentes de presión, entradas abiertas y límites de expansión.";
    case "chapter":
      return "La generación de capítulos debe adherirse al mundo del libro: utilizar únicamente las reglas, ubicaciones, fuerzas y factores estresantes permitidos por la porción actual.";
    case "bible":
      return "La Biblia sólo puede resumir este manual mundial, no puede reescribir las reglas del mundo en otro conjunto de fuentes autorizadas.";
    case "optimize":
      return "Los optimizadores y revisores deben comprobar si el texto traspasa los límites del mundo del libro, las reglas estrictas y las colocaciones prohibidas.";
    default:
      return "La generación debe respetar las fronteras del mundo del libro.";
  }
}

export function buildWorldContextBlockFromSlice(input: {
  slice: StoryWorldSlice;
  purpose: WorldContextPurpose;
  strength?: WorldContextStrength;
  novelWorldId?: string;
}): WorldContextBlock {
  const { slice, purpose } = input;
  const strength = input.strength ?? "normal";
  const hardRules = slice.appliedRules.map(formatRule).filter(Boolean);
  const activeForces = slice.activeForces.map((force: StoryWorldSliceForce) => ({
    id: force.id,
    name: force.name,
    roleInStory: force.roleInStory,
    pressure: force.pressure,
  }));
  const activeLocations = slice.activeLocations.map((location: StoryWorldSliceLocation) => ({
    id: location.id,
    name: location.name,
    storyUse: location.storyUse,
  }));

  const worldRulesText = [
    slice.coreWorldFrame ? `Antecedentes mundiales:${slice.coreWorldFrame}` : "",
    hardRules.length > 0 ? `Reglas estrictas: \\n${compactList(hardRules)}` : "",
    slice.forbiddenCombinations.length > 0
      ? `Combinación prohibida: \\n${compactList(slice.forbiddenCombinations)}`
      : "",
    slice.storyScopeBoundary ? `Límites del libro:${slice.storyScopeBoundary}` : "",
  ].filter(Boolean).join("\n\n");

  const worldStageText = [
    slice.coreWorldFrame ? `Etapa central:${slice.coreWorldFrame}` : "",
    slice.activeForces.length > 0
      ? `Fuerzas activas: \\n${slice.activeForces.map((force: StoryWorldSliceForce) => `- ${formatForce(force)}`).join("\n")}`
      : "",
    slice.activeLocations.length > 0
      ? `Etapa del libro: \\n${slice.activeLocations.map((location: StoryWorldSliceLocation) => `- ${formatLocation(location)}`).join("\n")}`
      : "",
    slice.pressureSources.length > 0 ? `Fuente de presión: \\n${compactList(slice.pressureSources)}` : "",
    slice.conflictCandidates.length > 0 ? `Conflictos ampliables: \\n${compactList(slice.conflictCandidates)}` : "",
    slice.recommendedEntryPoints.length > 0 ? `Adecuado para incisión: \\n${compactList(slice.recommendedEntryPoints)}` : "",
  ].filter(Boolean).join("\n\n");

  const promptBlock = [
    `[Contexto mundial de este libro | Objetivo:${purpose}|Fuerza:${strength}]`,
    buildPurposeLead(purpose),
    worldRulesText,
    worldStageText,
    slice.mysterySources.length > 0 ? `Fuente de suspenso: \\n${compactList(slice.mysterySources)}` : "",
    slice.suggestedStoryAxes.length > 0 ? `Sugerencia de historia: \\n${compactList(slice.suggestedStoryAxes)}` : "",
  ].filter(Boolean).join("\n\n");

  return {
    novelWorldId: input.novelWorldId ?? slice.worldId,
    sourceType: "story_slice",
    purpose,
    strength,
    summaryText: slice.coreWorldFrame,
    promptBlock,
    worldRulesText,
    worldStageText,
    hardRules,
    softRules: [],
    activeForces,
    activeLocations,
    forbiddenCombinations: slice.forbiddenCombinations,
    expansionHints: [
      ...slice.recommendedEntryPoints,
      ...slice.suggestedStoryAxes,
    ],
    rawSlice: slice,
  };
}

export class WorldContextGateway {
  constructor(
    private readonly worldSliceService = new NovelWorldSliceService(),
    private readonly novelWorldService = new NovelWorldInstanceService(),
  ) {}

  async hasActiveWorld(novelId: string): Promise<boolean> {
    const novelWorld = await this.novelWorldService.ensureFromLegacyNovel(novelId);
    if (novelWorld) {
      return true;
    }
    const view = await this.worldSliceService.getWorldSliceView(novelId);
    return view.hasWorld;
  }

  async getWorldContextBlock(
    novelId: string,
    options: WorldContextGatewayOptions,
  ): Promise<WorldContextBlock | null> {
    const novelWorld = await this.novelWorldService.ensureFromLegacyNovel(novelId);
    const builderMode = mapPurposeToBuilderMode(options.purpose);
    const slice = options.forceRefresh
      ? (await this.worldSliceService.refreshWorldSlice(novelId, {
        builderMode,
        storyInput: options.storyInput,
        provider: options.provider,
        model: options.model,
        temperature: options.temperature,
      })).slice
      : await this.worldSliceService.ensureStoryWorldSlice(novelId, {
        builderMode,
        storyInput: options.storyInput,
        provider: options.provider,
        model: options.model,
        temperature: options.temperature,
      });

    if (!slice) {
      return null;
    }
    await this.novelWorldService.persistStorySlice(novelId, slice);
    const persistedNovelWorld = novelWorld ?? await this.novelWorldService.getByNovelId(novelId);

    return buildWorldContextBlockFromSlice({
      slice,
      purpose: options.purpose,
      strength: options.strength,
      novelWorldId: persistedNovelWorld?.id,
    });
  }

  async generateWorldFromNovelTheme(
    novelId: string,
    options: WorldContextGatewayGenerateOptions = {},
  ) {
    return this.novelWorldService.generateFromNovelTheme({
      novelId,
      saveToLibrary: options.saveToLibrary,
      provider: options.provider,
      model: options.model,
      temperature: options.temperature,
      storyMacroContext: options.storyMacroContext,
      bookContractContext: options.bookContractContext,
      openingOnly: options.openingOnly,
    });
  }
}
