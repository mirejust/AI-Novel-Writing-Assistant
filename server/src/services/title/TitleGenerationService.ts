import type { LLMProvider } from "@ai-novel/shared/types/llm";
import type { TitleFactorySuggestion } from "@ai-novel/shared/types/title";
import { prisma } from "../../db/prisma";
import { resolveLLMClientOptions } from "../../llm/factory";
import { selectStructuredOutputStrategy } from "../../llm/structuredOutput";
import { runStructuredPrompt } from "../../prompting/core/promptRunner";
import { titleGenerationPrompt } from "../../prompting/prompts/helper/titleGeneration.prompt";
import { openingCandidateTitlesPrompt } from "../../prompting/prompts/novel/opening/candidateTitles.prompt";
import {
  collectUniqueSuggestions,
  DEFAULT_TITLE_COUNT,
  detectTitleSurfaceFrame,
  hasEnoughStructuralVariety,
  hasEnoughStyleVariety,
  normalizeRequestedCount,
  toTrimmedString,
  type TitlePromptContext,
} from "./titleGeneration.shared";

export interface TitleGenerationLLMOptions {
  provider?: LLMProvider;
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface GenerateTitleIdeasInput extends TitleGenerationLLMOptions {
  mode: "brief" | "adapt";
  selectionMode?: "pool" | "primary";
  brief?: string;
  referenceTitle?: string;
  genreId?: string | null;
  count?: number;
}

export interface GenerateNovelTitlesInput extends TitleGenerationLLMOptions {
  count?: number;
}

async function shouldForceTitleJsonOutput(input: TitleGenerationLLMOptions): Promise<boolean> {
  const resolved = await resolveLLMClientOptions(input.provider ?? "deepseek", {
    model: input.model,
    temperature: input.temperature ?? 0.85,
    maxTokens: input.maxTokens,
    taskType: titleGenerationPrompt.taskType,
    executionMode: "structured",
  });
  const profile = resolved.structuredProfile;
  if (!profile || !titleGenerationPrompt.outputSchema) {
    return false;
  }
  return selectStructuredOutputStrategy(profile, titleGenerationPrompt.outputSchema) !== "prompt_json";
}

function resolveRetryReason(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  return fallback;
}

function extractRawTitlesFromPayload(payload: unknown): unknown[] {
  if (Array.isArray(payload)) {
    return payload;
  }
  if (payload && typeof payload === "object" && Array.isArray((payload as { titles?: unknown }).titles)) {
    return (payload as { titles: unknown[] }).titles;
  }
  throw new Error("A la salida del modelo le falta la matriz de títulos.");
}

function buildNovelBrief(novel: {
  title: string;
  description: string | null;
  genre?: { name: string; description: string | null } | null;
}): string {
  const parts = [
    novel.description?.trim() ? `Introducción a la obra:${novel.description.trim()}` : "",
    novel.genre?.name ? `Base temática:${novel.genre.name}` : "",
    novel.genre?.description?.trim() ? `Suplemento temático:${novel.genre.description.trim()}` : "",
  ].filter(Boolean);

  if (parts.length > 0) {
    return parts.join("\n");
  }
  return `Título del proyecto:${novel.title}`;
}

function batchScore(titles: TitleFactorySuggestion[]): number {
  if (titles.length === 0) {
    return 0;
  }

  const styleCount = new Set(titles.map((item) => item.style)).size;
  const frameCount = new Set(titles.map((item) => detectTitleSurfaceFrame(item.title))).size;
  const totalClickRate = titles.reduce((sum, item) => sum + item.clickRate, 0);

  return titles.length * 1000 + styleCount * 100 + frameCount * 100 + totalClickRate;
}

function isBetterBatch(current: TitleFactorySuggestion[], challenger: TitleFactorySuggestion[]): boolean {
  return batchScore(challenger) > batchScore(current);
}

function ensureGenerationQuality(titles: TitleFactorySuggestion[], targetCount: number): void {
  if (titles.length < targetCount) {
    throw new Error(`Número insuficiente de títulos, objetivo ${targetCount} , en realidad sólo ${titles.length} títulos disponibles.`);
  }
  if (!hasEnoughStyleVariety(titles, targetCount)) {
    throw new Error("La distribución de estilos del título es demasiado estrecha y no cumple con los requisitos mínimos de cobertura de estilo.");
  }
  if (!hasEnoughStructuralVariety(titles, targetCount)) {
    throw new Error("La estructura oracional del título está demasiado concentrada y carece de suficiente diversidad estructural.");
  }
}

export class TitleGenerationService {
  async generateTitleIdeas(input: GenerateTitleIdeasInput): Promise<{ titles: TitleFactorySuggestion[] }> {
    const mode = input.mode;
    const brief = toTrimmedString(input.brief);
    const referenceTitle = toTrimmedString(input.referenceTitle);
    const count = normalizeRequestedCount(input.count, DEFAULT_TITLE_COUNT);

    if (mode === "brief" && !brief) {
      throw new Error("El Taller de títulos independiente requiere un resumen creativo.");
    }
    if (mode === "adapt" && !referenceTitle) {
      throw new Error("El modo de reescritura del título de referencia requiere un título de referencia.");
    }

    const genre = input.genreId
      ? await prisma.novelGenre.findUnique({
        where: { id: input.genreId },
        select: { id: true, name: true, description: true },
      })
      : null;

    return this.runGeneration({
      mode,
      selectionMode: input.selectionMode ?? "pool",
      count,
      brief: brief || `Consulte el título "${referenceTitle}»Realizar reescritura de estilo de aprendizaje estructural para producir títulos originales.`,
      referenceTitle,
      novelTitle: "",
      currentTitle: "",
      genreName: genre?.name ?? "",
      genreDescription: genre?.description ?? "",
    }, {
      provider: input.provider,
      model: input.model,
      temperature: input.temperature,
      maxTokens: input.maxTokens,
    });
  }

  async generateNovelTitles(
    novelId: string,
    input: GenerateNovelTitlesInput = {},
  ): Promise<{ titles: TitleFactorySuggestion[] }> {
    const novel = await prisma.novel.findUnique({
      where: { id: novelId },
      select: {
        id: true,
        title: true,
        description: true,
        genre: {
          select: {
            id: true,
            name: true,
            description: true,
          },
        },
      },
    });

    if (!novel) {
      throw new Error("La novela no existe.");
    }

    const brief = buildNovelBrief(novel);

    return this.runGeneration({
      mode: "novel",
      selectionMode: "pool",
      count: normalizeRequestedCount(input.count, DEFAULT_TITLE_COUNT),
      brief,
      referenceTitle: "",
      novelTitle: novel.title,
      currentTitle: novel.title,
      genreName: novel.genre?.name ?? "",
      genreDescription: novel.genre?.description ?? "",
    }, input, novel.title ? [novel.title] : []);
  }

  private async runGeneration(
    promptContext: TitlePromptContext,
    llmOptions: TitleGenerationLLMOptions,
    blockedTitles: string[] = [],
  ): Promise<{ titles: TitleFactorySuggestion[] }> {
    const provider = llmOptions.provider ?? "deepseek";
    const count = normalizeRequestedCount(promptContext.count, DEFAULT_TITLE_COUNT);
    const primarySelection = promptContext.selectionMode === "primary";
    const forceJson = !primarySelection && await shouldForceTitleJsonOutput(llmOptions);

    let lastError: unknown;
    let bestEffortTitles: TitleFactorySuggestion[] = [];
    let retryReason: string | null = null;

    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const request = {
          promptInput: {
            context: {
              ...promptContext,
              count,
            },
            forceJson,
            retryReason,
          },
          options: {
            provider,
            model: llmOptions.model,
            temperature: llmOptions.temperature ?? 0.85,
            maxTokens: llmOptions.maxTokens,
          },
        };
        const payload = primarySelection
          ? await runStructuredPrompt({ ...request, asset: openingCandidateTitlesPrompt })
          : await runStructuredPrompt({ ...request, asset: titleGenerationPrompt });

        const rawTitles = extractRawTitlesFromPayload(payload.output);
        const titles = collectUniqueSuggestions(rawTitles, count, blockedTitles, {
          preserveOrder: primarySelection,
          enforceFrameDiversity: !primarySelection,
          minTitleLength: primarySelection ? 2 : 4,
        });

        if (isBetterBatch(bestEffortTitles, titles)) {
          bestEffortTitles = titles;
        }

        if (primarySelection) {
          if (titles.length < count) {
            throw new Error(`Número insuficiente de títulos, objetivo ${count} , en realidad sólo ${titles.length} títulos disponibles.`);
          }
        } else {
          ensureGenerationQuality(titles, count);
        }
        return { titles };
      } catch (error) {
        lastError = error;
        retryReason = resolveRetryReason(error, "La salida no cumple con los requisitos de calidad JSON o del encabezado.");
      }
    }

    const minimumAcceptableCount = Math.max(5, Math.floor(count * 0.8));
    if (
      bestEffortTitles.length >= minimumAcceptableCount
      && hasEnoughStyleVariety(bestEffortTitles, bestEffortTitles.length)
      && hasEnoughStructuralVariety(bestEffortTitles, bestEffortTitles.length)
    ) {
      return { titles: bestEffortTitles };
    }

    if (lastError instanceof Error) {
      throw new Error(`Error al generar el título:${lastError.message}`);
    }
    throw new Error("Error al generar el título.");
  }
}

export const titleGenerationService = new TitleGenerationService();
