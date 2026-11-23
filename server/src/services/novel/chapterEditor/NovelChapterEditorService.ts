import { randomUUID } from "node:crypto";
import type {
  ChapterEditorAiRevisionIntent,
  ChapterEditorMacroContext,
  ChapterEditorAiRevisionRequest,
  ChapterEditorAiRevisionResponse,
  ChapterEditorCandidate,
  ChapterEditorCursorContinuationRequest,
  ChapterEditorCursorContinuationResponse,
  ChapterEditorCursorOperation,
  ChapterEditorOperation,
  ChapterEditorRewritePreviewRequest,
  ChapterEditorRewritePreviewResponse,
  ChapterEditorTargetRange,
} from "@ai-novel/shared/types/novel";
import { runStructuredPrompt } from "../../../prompting/core/promptRunner";
import {
  chapterEditorRewriteCandidatesPrompt,
  type ChapterEditorRewriteCandidatesPromptInput,
} from "../../../prompting/prompts/novel/chapterEditor/rewriteCandidates.prompts";
import {
  chapterEditorUserIntentPrompt,
  type ChapterEditorUserIntentPromptInput,
} from "../../../prompting/prompts/novel/chapterEditor/userIntent.prompts";
import {
  chapterEditorContinuationPreviewPrompt,
  type ChapterEditorContinuationPromptInput,
} from "../../../prompting/prompts/novel/chapterEditor/continuePreview.prompts";
import { buildChapterEditorDiffChunks } from "./chapterEditorDiff";
import { ChapterEditorWorkspaceService } from "./ChapterEditorWorkspaceService";
import {
  buildCharacterStateSummary,
  buildMacroContextSummary,
  buildParagraphWindow,
  buildPresetIntent,
  countEditorWords,
  createTargetRangeForWholeChapter,
  normalizeChapterContent,
  normalizeEditorText,
} from "./context";

const FULL_CHAPTER_REVISION_LIMIT = 8000;

const OPERATION_LABELS: Record<ChapterEditorOperation, string> = {
  polish: "Optimizar la expresión",
  expand: "Ampliar detalles",
  compress: "Compresión fina",
  emotion: "Fortalecer el estado de ánimo",
  conflict: "intensificar el conflicto",
  custom: "Reescritura de instrucciones personalizadas",
};

const CURSOR_OPERATION_LABELS: Record<ChapterEditorCursorOperation, string> = {
  continue: "Continuar escribiendo un párrafo",
  transition: "Generar segmentos de transición",
  dialogue: "Agregar diálogo",
  description: "Agregar descripción del entorno",
  inner_thought: "Agregar descripción psicológica",
  conflict: "Avanzando el conflicto",
};

function buildConstraintsText(input: ChapterEditorAiRevisionRequest["constraints"]): string {
  const lines = [
    input.keepFacts ? "- Preservar los hechos de la trama existentes." : "- Hechos parciales ajustables",
    input.keepPov ? "- Mantener la persona actual y la perspectiva narrativa." : "- Perspectiva narrativa ajustable",
    input.noUnauthorizedSetting ? "- No agregue configuraciones no autorizadas" : "- Se pueden introducir configuraciones suplementarias",
    input.preserveCoreInfo ? "- Intente conservar la información central del párrafo original." : "- Información central reorganizable",
  ];
  return lines.join("\n");
}

function dedupeCandidates(candidates: ChapterEditorCandidate[]): ChapterEditorCandidate[] {
  const seen = new Set<string>();
  const deduped: ChapterEditorCandidate[] = [];
  for (const candidate of candidates) {
    const key = candidate.content.trim();
    if (!key || seen.has(key)) {
      continue;
    }
    seen.add(key);
    deduped.push(candidate);
  }
  return deduped;
}

function buildIntentSummary(intent: ChapterEditorAiRevisionIntent): string {
  return [
    `Objetivo:${intent.editGoal}`,
    `Tono:${intent.toneShift}`,
    `Ritmo:${intent.paceAdjustment}`,
    `conflicto:${intent.conflictAdjustment}`,
    `ánimo:${intent.emotionAdjustment}`,
    `fortaleza:${intent.strength}`,
    `Artículos reservados:${intent.mustPreserve.join(";") || "Mantener los hechos centrales y la continuidad."}`,
    `Cosas que se deben evitar:${intent.mustAvoid.join(";") || "No rompas la sucesión de capítulos"}`,
    `ilustrar:${intent.reasoningSummary}`,
  ].join("\n");
}

function resolveSelectionTargetRange(content: string, targetRange?: ChapterEditorTargetRange, preserveExact=false): ChapterEditorTargetRange {
  if (!targetRange) {
    throw new Error("La corrección de fragmentos requiere seleccionar primero el contenido del texto.");
  }
  if (
    typeof targetRange.from !== "number"
    || typeof targetRange.to !== "number"
    || targetRange.from < 0
    || targetRange.to <= targetRange.from
    || targetRange.to > content.length
  ) {
    throw new Error("El rango de selección no es válido, seleccione nuevamente e inténtelo nuevamente.");
  }
  const selectedText = content.slice(targetRange.from, targetRange.to);
  if (!selectedText.trim()) {
    throw new Error("El texto seleccionado no puede estar vacío.");
  }
  if ((preserveExact ? targetRange.text : normalizeEditorText(targetRange.text)) !== selectedText) {
    throw new Error("El texto seleccionado ha cambiado, selecciónelo nuevamente e inténtelo nuevamente.");
  }
  return {
    from: targetRange.from,
    to: targetRange.to,
    text: selectedText,
  };
}

export class NovelChapterEditorService {
  constructor(
    private readonly workspaceService: ChapterEditorWorkspaceService = new ChapterEditorWorkspaceService(),
    private readonly promptRunner: typeof runStructuredPrompt = runStructuredPrompt,
  ) {}

  async previewAiRevision(
    novelId: string,
    chapterId: string,
    input: ChapterEditorAiRevisionRequest,
    manuscriptContext?: import("@ai-novel/shared/types/manuscript").ManuscriptChapterRevisionContext,
  ): Promise<ChapterEditorAiRevisionResponse> {
    const context = await this.workspaceService.loadContext(novelId, chapterId);
    const rawContent = input.contentSnapshot ?? context.chapter.content ?? "";
    const content = manuscriptContext ? rawContent : normalizeChapterContent(rawContent);
    if (!content.trim()) {
      throw new Error("El texto del capítulo actual está vacío y no se puede iniciar la corrección de IA.");
    }

    if (input.scope === "chapter" && countEditorWords(content) > FULL_CHAPTER_REVISION_LIMIT) {
      throw new Error(`Las revisiones de capítulos completos están actualmente limitadas a ${FULL_CHAPTER_REVISION_LIMIT} Dentro de los caracteres que no sean espacios en blanco, modifíquelo como un fragmento.`);
    }

    const targetRange = input.scope === "chapter"
      ? (manuscriptContext ? {from:0,to:content.length,text:content} : createTargetRangeForWholeChapter(content))
      : resolveSelectionTargetRange(content, input.selection, !!manuscriptContext);

    const resolvedIntent = manuscriptContext ? buildPresetIntent(input.presetOperation??"polish",["Conservar los hechos ocurridos, identidad de los personajes, causa y efecto, perspectiva y final original; El plan de todo el libro no iguala los hechos de este capítulo."],input.instruction) : await this.resolveRevisionIntent(input, context.macroContext, targetRange.text);
    const contextWindow = input.scope === "selection"
      ? input.context ?? buildParagraphWindow(content, targetRange)
      : { beforeParagraphs: [], afterParagraphs: [] };

    const result = await this.promptRunner({
      asset: chapterEditorRewriteCandidatesPrompt,
      promptInput: {
        manuscriptContext,
        operation: input.presetOperation ?? (input.source === "freeform" ? "custom" : "polish"),
        operationLabel: input.presetOperation ? OPERATION_LABELS[input.presetOperation] : "Modificado según los requisitos del usuario.",
        scope: input.scope,
        customInstruction: input.instruction?.trim() || undefined,
        repairBrief: input.repairBrief,
        selectedText: targetRange.text,
        beforeParagraphs: contextWindow.beforeParagraphs,
        afterParagraphs: contextWindow.afterParagraphs,
        goalSummary: manuscriptContext ? null : context.chapterPlan?.objective?.trim() || context.chapter.expectation?.trim() || null,
        chapterSummary: manuscriptContext ? null : context.chapterSummary,
        styleSummary: context.styleSummary || null,
        characterStateSummary: manuscriptContext ? null : buildCharacterStateSummary(context.latestStateSnapshot),
        worldConstraintSummary: manuscriptContext ? null : context.macroContext.worldConstraintSummary,
        macroContextSummary: manuscriptContext ? "Las limitaciones a lo largo del libro se distinguen de lo que ya sucedió en el contexto del manuscrito original." : buildMacroContextSummary(context.macroContext),
        resolvedIntentSummary: buildIntentSummary(resolvedIntent),
        constraintsText: buildConstraintsText(input.constraints),
      } satisfies ChapterEditorRewriteCandidatesPromptInput,
      options: {
        provider: input.provider ?? "deepseek",
        model: input.model,
        temperature: input.temperature ?? 0.45,
      },
    });

    const candidates = dedupeCandidates(
      result.output.candidates.slice(0, 3).map((candidate, index) => ({
        id: randomUUID(),
        label: candidate.label?.trim() || `plan ${index + 1}`,
        content: candidate.content.trim(),
        summary: candidate.summary?.trim() || null,
        rationale: candidate.rationale?.trim() || null,
        riskNotes: candidate.riskNotes?.filter((item) => item.trim().length > 0) ?? [],
        semanticTags: candidate.semanticTags?.filter((tag) => tag.trim().length > 0) ?? [],
        diffChunks: buildChapterEditorDiffChunks(targetRange.text, candidate.content.trim()),
      })),
    );

    if (candidates.length < 2) {
      throw new Error("AI no devolvió suficientes versiones candidatas. Inténtelo de nuevo.");
    }

    return {
      sessionId: randomUUID(),
      scope: input.scope,
      resolvedIntent,
      targetRange,
      macroAlignmentNote: result.output.macroAlignmentNote?.trim() || null,
      candidates,
      activeCandidateId: candidates[0]?.id ?? null,
    };
  }

  async previewRewrite(
    novelId: string,
    chapterId: string,
    input: ChapterEditorRewritePreviewRequest,
  ): Promise<ChapterEditorRewritePreviewResponse> {
    const response = await this.previewAiRevision(novelId, chapterId, {
      source: "preset",
      scope: "selection",
      presetOperation: input.operation,
      instruction: input.customInstruction,
      contentSnapshot: input.contentSnapshot,
      selection: input.targetRange,
      context: input.context,
      constraints: input.constraints,
      provider: input.provider,
      model: input.model,
      temperature: input.temperature,
    });

    return {
      sessionId: response.sessionId,
      operation: input.operation,
      targetRange: response.targetRange,
      candidates: response.candidates,
      activeCandidateId: response.activeCandidateId,
    };
  }

  async previewCursorContinuation(
    novelId: string,
    chapterId: string,
    input: ChapterEditorCursorContinuationRequest,
  ): Promise<ChapterEditorCursorContinuationResponse> {
    const context = await this.workspaceService.loadContext(novelId, chapterId);
    const content = normalizeChapterContent(input.contentSnapshot ?? context.chapter.content ?? "");
    if (!content.trim()) {
      throw new Error("El texto del capítulo actual está vacío y no se puede iniciar la continuación de la IA. Primero escriba al menos un párrafo de texto.");
    }
    if (!Number.isInteger(input.cursorOffset) || input.cursorOffset < 0 || input.cursorOffset > content.length) {
      throw new Error("La posición del cursor de texto ha cambiado. Vuelva a colocar el cursor e inténtelo de nuevo.");
    }

    const result = await this.promptRunner({
      asset: chapterEditorContinuationPreviewPrompt,
      promptInput: {
        operation: input.operation,
        operationLabel: CURSOR_OPERATION_LABELS[input.operation],
        instruction: input.instruction?.trim() || undefined,
        beforeParagraphs: input.context.beforeParagraphs,
        afterParagraphs: input.context.afterParagraphs,
        goalSummary: context.chapterPlan?.objective?.trim() || context.chapter.expectation?.trim() || null,
        chapterSummary: context.chapterSummary,
        styleSummary: context.styleSummary || null,
        characterStateSummary: buildCharacterStateSummary(context.latestStateSnapshot),
        worldConstraintSummary: context.macroContext.worldConstraintSummary,
        macroContextSummary: buildMacroContextSummary(context.macroContext),
      } satisfies ChapterEditorContinuationPromptInput,
      options: {
        provider: input.provider ?? "deepseek",
        model: input.model,
        temperature: input.temperature ?? 0.55,
      },
    });

    const targetRange: ChapterEditorTargetRange = {
      from: input.cursorOffset,
      to: input.cursorOffset,
      text: "",
    };
    const candidates = dedupeCandidates(
      result.output.candidates.slice(0, 3).map((candidate, index) => ({
        id: randomUUID(),
        label: candidate.label?.trim() || `Plan de continuación ${index + 1}`,
        content: candidate.content.trim(),
        summary: candidate.summary?.trim() || null,
        rationale: candidate.rationale?.trim() || null,
        riskNotes: candidate.riskNotes?.filter((item) => item.trim().length > 0) ?? [],
        semanticTags: candidate.semanticTags?.filter((tag) => tag.trim().length > 0) ?? [],
        diffChunks: buildChapterEditorDiffChunks("", candidate.content.trim()),
      })),
    );

    if (candidates.length < 2) {
      throw new Error("AI no devolvió suficientes candidatos de continuación. Inténtelo de nuevo.");
    }

    return {
      sessionId: randomUUID(),
      operation: input.operation,
      targetRange,
      macroAlignmentNote: result.output.macroAlignmentNote?.trim() || null,
      candidates,
      activeCandidateId: candidates[0]?.id ?? null,
    };
  }

  private async resolveRevisionIntent(
    input: ChapterEditorAiRevisionRequest,
    macroContext: ChapterEditorMacroContext,
    selectedText: string,
  ): Promise<ChapterEditorAiRevisionIntent> {
    if (input.source === "preset") {
      const intent = buildPresetIntent(
        input.presetOperation ?? "polish",
        macroContext.mustKeepConstraints,
        input.instruction,
      );
      return input.repairBrief ? {
        ...intent,
        editGoal: input.repairBrief.repairGoal || input.repairBrief.problemSummary,
        mustPreserve: Array.from(new Set([...intent.mustPreserve, ...(input.repairBrief.mustPreserve ?? [])])),
        reasoningSummary: input.repairBrief.whyItMatters,
      } : intent;
    }

    if (!input.instruction?.trim()) {
      throw new Error("Empiece por escribir cómo desea que se modifique la IA.");
    }

    const result = await this.promptRunner({
      asset: chapterEditorUserIntentPrompt,
      promptInput: {
        scope: input.scope,
        instruction: input.instruction.trim(),
        selectedText: input.scope === "selection" ? selectedText.slice(0, 800) : null,
        macroContextSummary: buildMacroContextSummary(macroContext),
        mustKeepConstraints: macroContext.mustKeepConstraints,
      } satisfies ChapterEditorUserIntentPromptInput,
      options: {
        provider: input.provider ?? "deepseek",
        model: input.model,
        temperature: 0.2,
      },
    });

    return result.output;
  }
}
