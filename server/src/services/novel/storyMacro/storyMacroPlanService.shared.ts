import type { StoryMacroField, StoryMacroFieldValue, StoryMacroPlan } from "@ai-novel/shared/types/storyMacro";
import type { NovelStoryMode } from "@ai-novel/shared/types/storyMode";
import { buildBookFramingSummary } from "../bookFraming";
import { buildStoryModePromptBlock } from "../../storyMode/storyModeProfile";
import {
  EMPTY_DECOMPOSITION,
  EMPTY_EXPANSION,
  type StoryMacroEditablePlan,
  normalizeConflictLayers,
  normalizeConstraints,
  normalizeDecomposition,
  normalizeExpansion,
} from "./storyMacroPlanUtils";

export interface StoryMacroNovelContext {
  id: string;
  title: string;
  targetAudience: string | null;
  bookSellingPoint: string | null;
  competingFeel: string | null;
  first30ChapterPromise: string | null;
  commercialTagsJson: string | null;
  styleTone: string | null;
  narrativePov: string | null;
  pacePreference: string | null;
  emotionIntensity: string | null;
  estimatedChapterCount: number | null;
  genre: { name: string } | null;
  primaryStoryMode: NovelStoryMode | null;
  secondaryStoryMode: NovelStoryMode | null;
}

export function formatProjectContext(novel: StoryMacroNovelContext, worldSliceContext = ""): string {
  const bookFramingSummary = buildBookFramingSummary(novel);
  const storyModeBlock = buildStoryModePromptBlock({
    primary: novel.primaryStoryMode,
    secondary: novel.secondaryStoryMode,
  });

  return [
    novel.title ? `Título del proyecto:${novel.title}` : "",
    novel.genre?.name ? `Tema predeterminado:${novel.genre.name}` : "",
    bookFramingSummary ? `Encuadre a nivel de libro: \\n${bookFramingSummary}` : "",
    storyModeBlock,
    novel.styleTone ? `Tendencias de estilo:${novel.styleTone}` : "",
    novel.narrativePov ? `Narrador:${novel.narrativePov}` : "",
    novel.pacePreference ? `Preferencia de ritmo:${novel.pacePreference}` : "",
    novel.emotionIntensity ? `Intensidad emocional:${novel.emotionIntensity}` : "",
    novel.estimatedChapterCount ? `Número estimado de capítulos:${novel.estimatedChapterCount}` : "",
    worldSliceContext.trim(),
  ].filter(Boolean).join("\n");
}

export function toEditablePlan(plan: StoryMacroPlan | null | undefined): StoryMacroEditablePlan {
  return {
    expansion: normalizeExpansion(plan?.expansion ?? EMPTY_EXPANSION),
    decomposition: normalizeDecomposition(plan?.decomposition ?? EMPTY_DECOMPOSITION),
    constraints: normalizeConstraints(plan?.constraints ?? []),
  };
}

function normalizeStringList(value: unknown, maxItems: number): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean)
    .slice(0, maxItems);
}

export function normalizeRegeneratedFieldValue(field: StoryMacroField, value: unknown): StoryMacroFieldValue {
  if (field === "conflict_layers") {
    const layers = normalizeConflictLayers(value);
    if (!layers.external || !layers.internal || !layers.relational) {
      throw new Error("La IA no devuelve la capa de conflicto completa.");
    }
    return layers;
  }
  if (field === "major_payoffs" || field === "setpiece_seeds" || field === "constraints") {
    const arrayValue = field === "constraints"
      ? normalizeConstraints(value)
      : normalizeStringList(value, field === "setpiece_seeds" ? 3 : 5);
    if (arrayValue.length === 0) {
      throw new Error(`AI no devolvió un válido ${field} lista.`);
    }
    return arrayValue;
  }
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`AI no devolvió un válido ${field}.`);
  }
  return value.trim();
}
