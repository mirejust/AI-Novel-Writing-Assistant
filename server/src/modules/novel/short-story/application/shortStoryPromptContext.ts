import type { ShortStoryReferenceContract } from "@ai-novel/shared/types/shortStoryReference";
import type { PromptContextBlock } from "../../../../prompting/core/promptTypes";
import type { WritingPlatformSnapshot } from "@ai-novel/shared/types/writingPlatform";
import type { CreationDirection, ShortStoryPlanContract, ShortStoryPlanSegment } from "@ai-novel/shared/types/creationStudio";
import { buildStoryModePromptBlock, parseStoryModeProfileJson } from "../../../../services/storyMode/storyModeProfile";
import { shortStoryProseBudget } from "../../../../prompting/prompts/shortStory/shortStory.prompts";

interface ShortStoryFoundationNovel {
  genre?: { name: string; description?: string | null; template?: string | null } | null;
  primaryStoryMode?: { id: string; name: string; description?: string | null; template?: string | null; profileJson?: string | null } | null;
  secondaryStoryMode?: { id: string; name: string; description?: string | null; template?: string | null; profileJson?: string | null } | null;
}

export function shortStoryProductionFoundationText(novel: ShortStoryFoundationNovel): string {
  const toMode = (mode: ShortStoryFoundationNovel["primaryStoryMode"]) => mode
    ? {
      id: mode.id,
      name: mode.name,
      description: mode.description ?? null,
      template: mode.template ?? null,
      profile: parseStoryModeProfileJson(mode.profileJson),
    }
    : null;
  return [
    novel.genre?.name ? `Base temática:${novel.genre.name}` : "",
    novel.genre?.description ? `Posicionamiento del tema:${novel.genre.description}` : "",
    novel.genre?.template ? `Tendencia de uso del tema:${novel.genre.template}` : "",
    buildStoryModePromptBlock({
      primary: toMode(novel.primaryStoryMode),
      secondary: toMode(novel.secondaryStoryMode),
    }),
  ].filter(Boolean).join("\n\n");
}

export function parseWritingPlatformSnapshot(raw: string | null | undefined): WritingPlatformSnapshot | null {
  if (!raw) return null;
  try { return JSON.parse(raw) as WritingPlatformSnapshot; } catch { return null; }
}

export function shortStoryPlatformText(snapshot: WritingPlatformSnapshot | null, stage: "planning" | "drafting" | "auditing" | "repairing"): string {
  if (!snapshot) return "Siguiendo el método general de redacción web empresarial china, se da prioridad a garantizar el avance de los acontecimientos, una causa y efecto claros, caracteres activos y un final completo.";
  return `${snapshot.label}(Versión de configuración ${snapshot.profileVersion}):${snapshot.guidance[stage]}`;
}

export function buildShortStoryWriterContextBlocks(input: {
  revisionInstruction?: string;
  reference?: ShortStoryReferenceContract;
  originalIdea: string;
  understanding: string;
  direction: CreationDirection;
  plan: ShortStoryPlanContract;
  segment: ShortStoryPlanSegment;
  previousContinuity: string;
  previousContentTail: string;
  platform: WritingPlatformSnapshot | null;
  bookStyle?: string | null;
  productionFoundation: string;
}): PromptContextBlock[] {
  const block = (id: string, group: string, content: string, priority: number): PromptContextBlock => ({
    id, group, content, priority, required: true, estimatedTokens: Math.max(1, Math.ceil(content.length / 2)),
  });
  return [
    ...(input.reference ? [block("short-story:reference", "creation_reference", JSON.stringify(input.reference), 101)] : []),
    block("short-story:intent", "creation_intent", JSON.stringify({ originalIdea: input.originalIdea, understanding: input.understanding, direction: input.direction, revisionInstruction: input.revisionInstruction }, null, 2), 100),
    block("short-story:plan", "short_story_plan", `[La extensión de este artículo]Escribe solo el primer capítulo.${input.segment.order}segmento, objetivo aprox.${input.segment.targetWordCount}palabra; artículo completo${input.plan.targetWordCount}Personaje.${shortStoryProseBudget(input.segment.targetWordCount)}Recuento de palabras: el texto principal carece de espacios en blanco, incluida la puntuación, y no incluye JSON ni resúmenes de continuidad. zx0zx${JSON.stringify({ plan: input.plan, currentSegment: input.segment }, null, 2)}`, 100),
    block("short-story:continuity", "short_story_continuity", JSON.stringify({ previousContinuity: input.previousContinuity, previousContentTail: input.previousContentTail }, null, 2), 96),
    block("short-story:platform", "writing_platform", shortStoryPlatformText(input.platform, "drafting"), 104),
    block("short-story:production-foundation", "production_foundation", input.productionFoundation, 103),
    block("short-story:book-style", "book_style", input.bookStyle?.trim() || input.direction.styleKeywords.join(","), 80),
  ];
}
