import type { ChapterRepairContext, ChapterRuntimePackage } from "@ai-novel/shared/types/chapterRuntime";
import type { LLMProvider } from "@ai-novel/shared/types/llm";
import type { ReviewIssue } from "@ai-novel/shared/types/novel";
import type { StyleRewriteGuard, StyleRewriteBaseline } from "@ai-novel/shared/types/styleEngine";
import { runTextPrompt } from "../../../../prompting/core/promptRunner";
import { buildChapterRepairContextBlocks } from "../../../../prompting/prompts/novel/chapterLayeredContext";
import { chapterRepairPrompt } from "../../../../prompting/prompts/novel/review.prompts";
import {
  ChapterPatchRepairService,
  type PatchRepairMode,
} from "../../chapterPatchRepairService";

export interface ChapterRepairExecutionOptions {
  provider?: LLMProvider;
  model?: string;
  temperature?: number;
  repairMode?: PatchRepairMode;
}

export interface PrepareChapterRepairExecutionInput {
  novelId: string;
  chapterId: string;
  novelTitle: string;
  chapterTitle: string;
  content: string;
  issues: ReviewIssue[];
  runtimePackage?: ChapterRuntimePackage | null;
  repairContext?: ChapterRepairContext | null;
  bibleContent?: string | null;
  options: ChapterRepairExecutionOptions;
}

export interface ChapterHeavyRepairPromptRequest {
  promptInput: {
    novelTitle: string;
    bibleContent: string;
    chapterTitle: string;
    chapterContent: string;
    issuesJson: string;
    ragContext: string;
    modeHint: string;
  };
  contextBlocks?: ReturnType<typeof buildChapterRepairContextBlocks>;
  options: {
    provider?: LLMProvider;
    model?: string;
    temperature: number;
    novelId: string;
    chapterId: string;
    stage: "chapter_repair";
    triggerReason: PatchRepairMode;
  };
  fallbackContent: string;
}

export type PreparedChapterRepairExecution =
  | {
      kind: "patched";
      content: string;
      issues: ReviewIssue[];
      finalRepairMode: PatchRepairMode;
      modeHint: string;
      rewriteGuard?: StyleRewriteGuard;
      styleRewriteBaseline?: StyleRewriteBaseline;
    }
  | {
      kind: "heavy_repair";
      issues: ReviewIssue[];
      finalRepairMode: "heavy_repair";
      modeHint: string;
      prompt: ChapterHeavyRepairPromptRequest;
    };

export interface ExecutedChapterRepair {
  content: string;
  finalRepairMode: PatchRepairMode;
  rewriteGuard?: StyleRewriteGuard;
  styleRewriteBaseline?: StyleRewriteBaseline;
}

function normalizeRepairIssues(issues: ReviewIssue[]): ReviewIssue[] {
  return issues.length > 0
    ? issues
    : [{
        severity: "medium",
        category: "coherence",
        evidence: "Pipeline quality threshold not met.",
        fixSuggestion: "Tighten continuity, sharpen conflict progression, and improve readability.",
      }];
}

function resolveIssueCodes(runtimePackage: ChapterRuntimePackage | null | undefined): string[] {
  return runtimePackage?.audit.openIssues
    ?.map((issue) => issue.code)
    .filter((code): code is string => typeof code === "string" && code.trim().length > 0)
    ?? [];
}

/**
 * 构建修复 prompt 所用的结构化 issuesJson。
 *
 * Root A 修复：在 ReviewIssue 列表之外，额外透传：
 *  - missingObligations：本章未兑现的义务（kind/summary/evidence），修复器可据此定向补写
 *  - blockingIssueCodes：审计层给出的精确 code（如 OBLIGATION_UNMET / LENGTH_OVER_HARD_MAX），
 *    避免修复器只看压扁文本猜问题类型
 */
function buildRepairIssuesPayload(
  issues: ReviewIssue[],
  runtimePackage: ChapterRuntimePackage | null | undefined,
): string {
  const missingObligations = runtimePackage?.obligationCoverage?.missing ?? [];
  const blockingIssueCodes = resolveIssueCodes(runtimePackage);
  const repairDirectives = runtimePackage?.meta?.repairDirectives ?? [];

  if (missingObligations.length === 0 && blockingIssueCodes.length === 0 && repairDirectives.length === 0) {
    return JSON.stringify(issues);
  }

  return JSON.stringify(
    {
      issues,
      missingObligations: missingObligations.map((o) => ({
        kind: o.kind,
        summary: o.summary,
        ...(o.evidence ? { evidence: o.evidence } : {}),
      })),
      blockingIssueCodes,
      repairDirectives,
    },
  );
}

function resolveRepairContext(input: {
  repairContext?: ChapterRepairContext | null;
  runtimePackage?: ChapterRuntimePackage | null;
}): ChapterRepairContext | null {
  return input.repairContext ?? input.runtimePackage?.context.chapterRepairContext ?? null;
}

function resolveBibleContent(input: {
  bibleContent?: string | null;
  runtimePackage?: ChapterRuntimePackage | null;
}): string {
  const explicitBible = input.bibleContent?.trim();
  if (explicitBible) {
    return explicitBible;
  }
  return buildRepairBibleFallback(input.runtimePackage);
}

function buildRepairRagContext(input: {
  repairContext?: ChapterRepairContext | null;
  runtimePackage?: ChapterRuntimePackage | null;
}): string {
  const repairContext = resolveRepairContext(input);
  const writeContext = repairContext?.writeContext ?? input.runtimePackage?.context.chapterWriteContext ?? null;
  if (!writeContext) {
    return "none";
  }
  const fragments = [
    writeContext.previousChapterTail
      ? `El final del capítulo anterior:${writeContext.previousChapterTail}`
      : "",
    writeContext.recentChapterSummaries?.length
      ? `Resumen de capítulos recientes: \\n${writeContext.recentChapterSummaries.slice(0, 3).map((item) => `- ${item}`).join("\n")}`
      : "",
    writeContext.openConflictSummaries?.length
      ? `Conflicto a reciclar: \\n${writeContext.openConflictSummaries.slice(0, 5).map((item) => `- ${item}`).join("\n")}`
      : "",
    writeContext.characterHardFacts?.length
      ? `Datos concretos del personaje: \\n${writeContext.characterHardFacts.slice(0, 6).map((item) => [
          item.name,
          item.currentState ? `estado =${item.currentState}` : "",
          item.currentGoal ? `objetivo =${item.currentGoal}` : "",
          item.currentLocation ? `ubicación =${item.currentLocation}` : "",
          item.locationState?.sourceChapterOrder !== null && item.locationState?.sourceChapterOrder !== undefined
            ? `Fuente de ubicación = No.${item.locationState.sourceChapterOrder}capítulo; evidencia =${item.locationState.evidence}` : "",
          item.locationState?.concern ? `Ubicación a verificar =${item.locationState.concern}` : "",
          item.prohibitions?.length ? `Prohibido =${item.prohibitions.join(" / ")}` : "",
        ].filter(Boolean).join(" | ")).join("\n")}`
      : "",
    writeContext.characterResourceContext
      ? [
          "Datos de recursos:",
          ...writeContext.characterResourceContext.availableItems.slice(0, 4).map((item) => `- Disponible:${item.name} / ${item.summary}`),
          ...writeContext.characterResourceContext.blockedItems.slice(0, 4).map((item) => `- No disponible para uso directo:${item.name} / ${item.status} / ${item.summary}`),
          ...writeContext.characterResourceContext.highRiskCommittedItems.slice(0, 3).map((item) => `- Se ha contabilizado riesgo alto:${item.name} / ${item.summary}`),
          ...writeContext.characterResourceContext.pendingProposalItems.slice(0, 3).map((item) => `- Cambios no confirmados:${item.summary};No lo escribas como un hecho ocurrido antes de confirmar`),
        ].join("\n")
      : "",
  ].filter((item) => item.trim().length > 0);
  return fragments.join("\n\n") || "none";
}

export async function prepareChapterRepairExecution(
  input: PrepareChapterRepairExecutionInput,
): Promise<PreparedChapterRepairExecution> {
  const issues = normalizeRepairIssues(input.issues);
  const issueCodes = resolveIssueCodes(input.runtimePackage);
  // Expression cleanup never grants a full-chapter rewrite permission.
  const hasStyleIssues = Boolean(input.runtimePackage?.styleReview?.report?.violations.length);
  const activeRepairMode = hasStyleIssues && input.options.repairMode === "heavy_repair"
    ? "light_repair" : input.options.repairMode ?? "light_repair";
  const modeHint = getRepairModeHint(activeRepairMode, issueCodes);

  if (activeRepairMode !== "heavy_repair") {
    const patchRepairService = new ChapterPatchRepairService();
    const patched = await patchRepairService.repair({
      novelId: input.novelId,
      chapterId: input.chapterId,
      novelTitle: input.novelTitle,
      chapterTitle: input.chapterTitle,
      content: input.content,
      issues,
      issuesJson: buildRepairIssuesPayload(issues, input.runtimePackage),
      runtimePackage: input.runtimePackage,
      repairContext: input.repairContext,
      provider: input.options.provider,
      model: input.options.model,
      temperature: input.options.temperature,
      repairMode: activeRepairMode,
      modeHint,
    });
    return {
      kind: "patched",
      content: patched.content,
      issues,
      finalRepairMode: activeRepairMode,
      modeHint,
      rewriteGuard: patched.rewriteGuard,
      styleRewriteBaseline: patched.styleRewriteBaseline,
    };
  }

  return {
    kind: "heavy_repair",
    issues,
    finalRepairMode: "heavy_repair",
    modeHint,
    prompt: {
      promptInput: {
        novelTitle: input.novelTitle,
        bibleContent: resolveBibleContent(input),
        chapterTitle: input.chapterTitle,
        chapterContent: input.content,
        issuesJson: buildRepairIssuesPayload(issues, input.runtimePackage),
        ragContext: buildRepairRagContext(input),
        modeHint,
      },
      contextBlocks: resolveRepairContext(input)
        ? buildChapterRepairContextBlocks(resolveRepairContext(input) as ChapterRepairContext)
        : undefined,
      options: {
        provider: input.options.provider,
        model: input.options.model,
        temperature: Math.min(input.options.temperature ?? 0.55, 0.65),
        novelId: input.novelId,
        chapterId: input.chapterId,
        stage: "chapter_repair",
        triggerReason: activeRepairMode,
      },
      fallbackContent: input.content,
    },
  };
}

export function createHeavyRepairPromptExecution(
  plan: Extract<PreparedChapterRepairExecution, { kind: "heavy_repair" }>,
): {
  asset: typeof chapterRepairPrompt;
  promptInput: ChapterHeavyRepairPromptRequest["promptInput"];
  contextBlocks?: ChapterHeavyRepairPromptRequest["contextBlocks"];
  options: ChapterHeavyRepairPromptRequest["options"];
} {
  return {
    asset: chapterRepairPrompt,
    promptInput: plan.prompt.promptInput,
    contextBlocks: plan.prompt.contextBlocks,
    options: plan.prompt.options,
  };
}

export async function runChapterRepairText(
  input: PrepareChapterRepairExecutionInput,
): Promise<ExecutedChapterRepair> {
  const prepared = await prepareChapterRepairExecution(input);
  if (prepared.kind === "patched") {
    return {
      content: prepared.content,
      finalRepairMode: prepared.finalRepairMode,
      rewriteGuard: prepared.rewriteGuard,
      styleRewriteBaseline: prepared.styleRewriteBaseline,
    };
  }

  const repaired = await runTextPrompt(createHeavyRepairPromptExecution(prepared));
  return {
    content: repaired.output.trim() || prepared.prompt.fallbackContent,
    finalRepairMode: prepared.finalRepairMode,
  };
}

function buildRepairBibleFallback(runtimePackage: ChapterRuntimePackage | null | undefined): string {
  const context = runtimePackage?.context;
  if (!context) {
    return "none";
  }
  const fragments = [
    context.bookContract?.sellingPoint ? `Puntos de venta principales:${context.bookContract.sellingPoint}` : "",
    context.bookContract?.first30ChapterPromise ? `Los primeros 30 capítulos prometen:${context.bookContract.first30ChapterPromise}` : "",
    context.macroConstraints?.coreConflict ? `Conflicto central:${context.macroConstraints.coreConflict}` : "",
    context.macroConstraints?.progressionLoop ? `Circuito de propulsión:${context.macroConstraints.progressionLoop}` : "",
    context.volumeWindow?.missionSummary ? `Misión de volumen actual:${context.volumeWindow.missionSummary}` : "",
  ].filter(Boolean);
  return fragments.join("\n") || "none";
}

export function getRepairModeHint(
  repairMode: PatchRepairMode | undefined,
  issueCodes: string[] = [],
): string {
  if (issueCodes.includes("LENGTH_OVER_HARD_MAX")) {
    return "compress_chapter_for_length: comprime expresiones repetidas, párrafos explicativos y giros no válidos a lo largo del capítulo, conservando el avance central y la presión final.";
  }
  if (issueCodes.includes("LENGTH_OVER_SOFT_MAX")) {
    return "compress_tail_for_length: prioriza la expansión redundante del segmento de cola y conserva los conflictos de gancho final y clave.";
  }
  if (issueCodes.includes("LENGTH_UNDER_SOFT_MIN")) {
    return "extend_for_length: agregue solo la escena de la misión final o el gancho final para aumentar el avance efectivo. No recupere el recuento de palabras retrospectivamente.";
  }
  switch (repairMode) {
    case "continuity_only":
      return "Priorice las reparaciones de continuidad, cronograma y continuidad de eventos, y no realice reescrituras de estilo importantes.";
    case "character_only":
      return "Priorice la coherencia de las palabras y los hechos de los personajes, las motivaciones y el desempeño de las relaciones sin cambiar la misión principal.";
    case "ending_only":
      return "Priorice el cierre del capítulo, el gancho y la sensación de decisión al final para que el final del capítulo sea más atractivo.";
    case "heavy_repair":
      return "Se permite una reescritura mayor de segmentos siempre que la dirección de la trama permanezca sin cambios.";
    case "light_repair":
    default:
      return "Principalmente reparaciones ligeras, dando prioridad al mantenimiento del marco de contenidos original y la secuencia de eventos.";
  }
}
