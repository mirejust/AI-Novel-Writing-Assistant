import type { BookAnalysisSectionKey } from "@ai-novel/shared/types/bookAnalysis";
import { analysisSignal } from "../generation/lifecycle";
import type { LLMProvider } from "@ai-novel/shared/types/llm";
import { AppError } from "../../../middleware/errorHandler";
import { runStructuredPrompt } from "../../../prompting/core/promptRunner";
import {
  bookAnalysisOptimizedDraftPrompt,
  bookAnalysisSectionPrompt,
} from "../../../prompting/prompts/bookAnalysis/bookAnalysis.prompts";
import type { LlmTokenUsageSnapshot } from "../../../llm/usageTracking";
import { SECTION_PROMPTS } from "../shared/bookAnalysis.constants";
import type { BookAnalysisOverviewContext, SectionGenerationResult, SourceNote } from "../shared/bookAnalysis.types";
import {
  getSectionTitle,
  normalizeBookAnalysisEvidence,
  normalizeBookAnalysisStructuredDataWithWarnings,
  normalizeMaxTokens,
  normalizeTemperature,
  renderNotesForPrompt,
  selectNotesForBookAnalysisSection,
} from "../shared/bookAnalysis.utils";

export interface GenerateBookAnalysisSectionOptions {
  overviewContext?: BookAnalysisOverviewContext | null;
  userFocusInstruction?: string | null;
  sectionFocusInstruction?: string | null;
}

export class BookAnalysisSectionWriter {
  async generateSection(
    sectionKey: BookAnalysisSectionKey,
    notes: SourceNote[],
    provider: LLMProvider,
    model?: string,
    temperature?: number,
    maxTokens?: number,
    options: GenerateBookAnalysisSectionOptions = {},
  ): Promise<SectionGenerationResult> {
    const prompt = SECTION_PROMPTS[sectionKey];
    const notesText = renderNotesForPrompt(selectNotesForBookAnalysisSection(sectionKey, notes), sectionKey);
    const overviewContextText = sectionKey === "overview" || !options.overviewContext
      ? ""
      : renderOverviewContextForPrompt(options.overviewContext);
    const result = await runStructuredPrompt({
      asset: bookAnalysisSectionPrompt,
      promptInput: {
        sectionKey,
        sectionTitle: getSectionTitle(sectionKey),
        promptFocus: prompt,
        overviewContextText,
        userFocusInstructionText: normalizeInstructionForPrompt(options.userFocusInstruction),
        sectionFocusInstructionText: normalizeInstructionForPrompt(options.sectionFocusInstruction),
        notesText,
      },
      options: {
        signal: analysisSignal(),
        provider,
        model,
        temperature: normalizeTemperature(temperature),
        maxTokens: normalizeMaxTokens(maxTokens),
      },
    });
    const parsed = result.output;
    const markdown = typeof (parsed as any).markdown === "string" ? (parsed as any).markdown.trim() : "";
    if (!markdown) {
      throw new AppError("AI no devolvió el texto visualizable del libro abierto. Verifique la configuración del modelo e inténtelo nuevamente.", 502);
    }
    const normalizedStructuredData =
      (parsed as any).structuredData && typeof (parsed as any).structuredData === "object"
        ? normalizeBookAnalysisStructuredDataWithWarnings(sectionKey, (parsed as any).structuredData as Record<string, unknown>)
        : normalizeBookAnalysisStructuredDataWithWarnings(sectionKey, null);
    const evidence = normalizeBookAnalysisEvidence(
      sectionKey,
      (parsed as any).evidence,
      normalizedStructuredData.structuredData,
    );
    return {
      markdown,
      structuredData: normalizedStructuredData.structuredData,
      normalizationWarnings: normalizedStructuredData.normalizationWarnings,
      evidence,
      tokenUsage: buildSectionTokenUsage(result.meta.tokenUsage, result.context.estimatedInputTokens, markdown),
    };
  }

  async generateOptimizedDraft(input: {
    sectionKey: BookAnalysisSectionKey;
    currentDraft: string;
    instruction: string;
    notes: SourceNote[];
    provider: LLMProvider;
    model?: string;
    temperature?: number;
    maxTokens?: number;
    onTokenUsage?: (usage: LlmTokenUsageSnapshot | null | undefined) => Promise<void>;
  }): Promise<string> {
    const notesText = renderNotesForPrompt(
      selectNotesForBookAnalysisSection(input.sectionKey, input.notes),
      input.sectionKey,
    );
    const result = await runStructuredPrompt({
      asset: bookAnalysisOptimizedDraftPrompt,
      promptInput: {
        sectionKey: input.sectionKey,
        sectionTitle: getSectionTitle(input.sectionKey),
        instruction: input.instruction,
        currentDraft: input.currentDraft,
        notesText,
      },
      options: {
        signal: analysisSignal(),
        provider: input.provider,
        model: input.model,
        temperature: normalizeTemperature(input.temperature),
        maxTokens: normalizeMaxTokens(input.maxTokens),
      },
    });
    await input.onTokenUsage?.(result.meta?.tokenUsage);
    const parsed = result.output;
    const optimizedDraft = typeof (parsed as any).optimizedDraft === "string"
      ? (parsed as any).optimizedDraft.trim()
      : "";
    if (!optimizedDraft) {
      throw new AppError("AI no devolvió un borrador de optimización utilizable; verifique la configuración del modelo e inténtelo nuevamente.", 502);
    }
    return optimizedDraft;
  }
}

function normalizeInstructionForPrompt(value: string | null | undefined): string {
  return value?.trim() || "";
}

function buildSectionTokenUsage(
  usage: LlmTokenUsageSnapshot | null | undefined,
  estimatedInputTokens: number,
  markdown: string,
): LlmTokenUsageSnapshot | null {
  if (usage && usage.totalTokens > 0) {
    return usage;
  }
  const promptTokens = Math.max(0, Math.round(estimatedInputTokens));
  const completionTokens = Math.max(0, Math.ceil(markdown.length / 4));
  const totalTokens = promptTokens + completionTokens;
  return totalTokens > 0 ? { promptTokens, completionTokens, totalTokens } : null;
}

function renderOverviewContextForPrompt(context: BookAnalysisOverviewContext): string {
  const lines = [
    context.markdownSummary ? `Resumen general:${context.markdownSummary}` : "",
    context.oneLinePositioning ? `Posicionamiento en una frase:${context.oneLinePositioning}` : "",
    context.genreTags.length > 0 ? `Etiquetas de asunto:${context.genreTags.join(",")}` : "",
    context.sellingPointTags.length > 0 ? `Etiqueta de punto de venta:${context.sellingPointTags.join(",")}` : "",
    context.targetReaders.length > 0 ? `Lectores objetivo:${context.targetReaders.join(",")}` : "",
    context.strengths.length > 0 ? `Ventajas generales:${context.strengths.join(",")}` : "",
    context.weaknesses.length > 0 ? `Deficiencias generales:${context.weaknesses.join(",")}` : "",
  ].filter(Boolean);

  return lines.length > 0
    ? ["## Posicionamiento de todo el libro (de la sección de descripción general)", ...lines].join("\n")
    : "";
}
