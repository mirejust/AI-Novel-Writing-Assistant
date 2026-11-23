import { randomUUID } from "node:crypto";
import type { CreativeCarryoverContract } from "@ai-novel/shared/types/creativeCarryoverContract";
import type {
  DirectorAutoExecutionPlan,
  DirectorAutoExecutionState,
  BookSpec,
  DirectorCandidate,
  DirectorCandidateBatch,
  DirectorCandidatesRequest,
  DirectorConfirmRequest,
  DirectorCorrectionPreset,
  DirectorLLMOptions,
  DirectorLockScope,
  DirectorProjectContextInput,
  DirectorRunMode,
  DirectorSessionState,
  DirectorTaskNotice,
} from "@ai-novel/shared/types/novelDirector";
import type { DirectorRuntimeSnapshot } from "@ai-novel/shared/types/directorRuntime";
import type { DirectorIssuePolicy } from "@ai-novel/shared/types/directorIssue";
import {
  DIRECTOR_CORRECTION_PRESETS,
  DIRECTOR_MAX_TARGET_CHAPTER_COUNT,
  DIRECTOR_MIN_TARGET_CHAPTER_COUNT,
  buildFullBookAutopilotExecutionPlan,
  isDirectorAutoExecutionRunMode,
  isFullBookAutopilotRunMode,
} from "@ai-novel/shared/types/novelDirector";
import {
  buildFullDirectorAutoApprovalConfig,
  normalizeDirectorAutoApprovalConfig,
  type DirectorAutoApprovalConfig,
} from "@ai-novel/shared/types/autoDirectorApproval";
import type { TitleFactorySuggestion } from "@ai-novel/shared/types/title";
import { titleGenerationService } from "../../../title/TitleGenerationService";
import { isNearDuplicateTitle } from "../../../title/titleGeneration.shared";
import type { NovelWorkflowResumeTarget } from "@ai-novel/shared/types/novelWorkflow";
export { normalizeBookContract } from "../../bookContract";
import type { DirectorCompletionProfile } from "@ai-novel/shared/types/directorCompletion";
import { buildDirectorCompletionProfile } from "@ai-novel/shared/types/directorCompletion";

export type LLMOptions = Pick<DirectorCandidatesRequest, "provider" | "model" | "temperature">;

export type DirectorCandidateStageMode =
  | "generate"
  | "refine"
  | "patch_candidate"
  | "refine_titles";

export interface DirectorCandidateStageState {
  mode: DirectorCandidateStageMode;
  presets?: DirectorCorrectionPreset[];
  feedback?: string | null;
  batchId?: string | null;
  candidateId?: string | null;
}

export interface DirectorWorkflowSeedPayload extends Record<string, unknown> {
  productionExperience?: "simple" | "professional";
  startupPreparation?: DirectorConfirmRequest["startupPreparation"];
  completionProfile?: DirectorCompletionProfile;
  novelId?: string | null;
  provider?: DirectorLLMOptions["provider"] | null;
  model?: string | null;
  temperature?: number | null;
  runMode?: DirectorRunMode;
  issueGovernanceVersion?: 1;
  issuePolicy?: DirectorIssuePolicy;
  issuePolicySource?: "global" | "novel";
  autoExecutionPlan?: DirectorAutoExecutionPlan;
  autoApproval?: DirectorAutoApprovalConfig | null;
  batches?: DirectorCandidateBatch[];
  candidateStage?: DirectorCandidateStageState | null;
  candidate?: DirectorCandidate;
  batch?: {
    id?: string;
    round?: number;
  };
  directorInput?: DirectorConfirmRequest;
  directorSession?: DirectorSessionState;
  resumeTarget?: NovelWorkflowResumeTarget | null;
  autoExecution?: DirectorAutoExecutionState;
  taskNotice?: DirectorTaskNotice | null;
  directorRuntime?: DirectorRuntimeSnapshot | null;
  stepReview?: {
    stepId: string;
    nodeKey: string;
    label: string;
    targetType: string;
    targetId?: string | null;
    completedAt: string;
  } | null;
  creativeCarryoverContract?: CreativeCarryoverContract | null;
}

export interface CandidateGenerationContext {
  idea: string;
  count: number;
  batches: DirectorCandidateBatch[];
  presets: DirectorCorrectionPreset[];
  feedback?: string;
  request: DirectorProjectContextInput;
  options: LLMOptions;
}

const DIRECTOR_ALL_MUTATING_SCOPES: DirectorLockScope[] = [
  "basic",
  "story_macro",
  "character",
  "outline",
  "structured",
  "chapter",
  "pipeline",
];

export function normalizeDirectorRunMode(runMode: DirectorRunMode | undefined): DirectorRunMode {
  if (runMode === "full_book_autopilot") {
    return "full_book_autopilot";
  }
  if (runMode === "stage_review") {
    return "stage_review";
  }
  if (runMode === "auto_to_execution") {
    return "auto_to_execution";
  }
  return "auto_to_ready";
}

export function applyDirectorRunModeContract<T extends {
  runMode?: DirectorRunMode;
  autoExecutionPlan?: DirectorAutoExecutionPlan;
  autoApproval?: DirectorAutoApprovalConfig;
}>(input: T): T & { runMode: DirectorRunMode } {
  const runMode = normalizeDirectorRunMode(input.runMode);
  if (!isFullBookAutopilotRunMode(runMode)) {
    return {
      ...input,
      runMode,
    };
  }
  return {
    ...input,
    runMode,
    autoExecutionPlan: input.autoExecutionPlan?.mode === "chapter_range"
      ? input.autoExecutionPlan
      : buildFullBookAutopilotExecutionPlan(),
    autoApproval: buildFullDirectorAutoApprovalConfig(),
  };
}
export function normalizeDirectorTargetChapterCount(value: number | null | undefined, fallback = 80): number {
  const numericValue = typeof value === "number" && Number.isFinite(value) ? value : fallback;
  return Math.max(
    DIRECTOR_MIN_TARGET_CHAPTER_COUNT,
    Math.min(DIRECTOR_MAX_TARGET_CHAPTER_COUNT, Math.round(numericValue)),
  );
}

export function buildDirectorSessionState(input: {
  runMode?: DirectorRunMode;
  phase: DirectorSessionState["phase"];
  isBackgroundRunning: boolean;
}): DirectorSessionState {
  const runMode = normalizeDirectorRunMode(input.runMode);
  const lockedScopes = resolveDirectorLockedScopes({
    runMode,
    phase: input.phase,
    isBackgroundRunning: input.isBackgroundRunning,
  });
  return {
    runMode,
    phase: input.phase,
    isBackgroundRunning: input.isBackgroundRunning,
    lockedScopes,
    reviewScope: input.isBackgroundRunning ? null : resolveDirectorReviewScope(input.phase),
  };
}

function resolveDirectorLockedScopes(input: {
  runMode: DirectorRunMode;
  phase: DirectorSessionState["phase"];
  isBackgroundRunning: boolean;
}): DirectorLockScope[] {
  if (input.isBackgroundRunning) {
    if (input.phase === "candidate_selection") {
      return ["basic"];
    }
    if (
      input.phase === "story_macro"
      || input.phase === "character_setup"
      || input.phase === "volume_strategy"
      || input.phase === "structured_outline"
    ) {
      return DIRECTOR_ALL_MUTATING_SCOPES;
    }
    if (input.phase === "chapter_execution") {
      if (isDirectorAutoExecutionRunMode(input.runMode)) {
        return ["chapter", "pipeline"];
      }
      return [];
    }
    return DIRECTOR_ALL_MUTATING_SCOPES;
  }

  if (input.runMode === "auto_to_ready") {
    return [];
  }

  if (input.phase === "character_setup") {
    return ["outline", "structured", "chapter", "pipeline"];
  }
  if (input.phase === "volume_strategy") {
    return ["structured", "chapter", "pipeline"];
  }
  if (input.phase === "chapter_execution") {
    return [];
  }
  if (input.phase === "story_macro") {
    return ["character", "outline", "structured", "chapter"];
  }
  return [];
}

function resolveDirectorReviewScope(phase: DirectorSessionState["phase"]): DirectorLockScope | null {
  if (phase === "story_macro") {
    return "story_macro";
  }
  if (phase === "character_setup") {
    return "character";
  }
  if (phase === "volume_strategy") {
    return "outline";
  }
  if (phase === "chapter_execution") {
    return "chapter";
  }
  return null;
}

export function normalizeCandidate(
  candidate: Omit<DirectorCandidate, "id"> & { id?: string },
  index: number,
): DirectorCandidate {
  return {
    id: randomUUID(),
    workingTitle: candidate.workingTitle.trim() || `plan ${index + 1}`,
    titleOptions: [],
    logline: candidate.logline.trim(),
    positioning: candidate.positioning.trim(),
    sellingPoint: candidate.sellingPoint.trim(),
    coreConflict: candidate.coreConflict.trim(),
    protagonistPath: candidate.protagonistPath.trim(),
    endingDirection: candidate.endingDirection.trim(),
    hookStrategy: candidate.hookStrategy.trim(),
    progressionLoop: candidate.progressionLoop.trim(),
    whyItFits: candidate.whyItFits.trim(),
    recommendedWritingPlatform: candidate.recommendedWritingPlatform,
    writingPlatformReason: candidate.writingPlatformReason?.trim(),
    toneKeywords: Array.from(
      new Set(candidate.toneKeywords.map((item) => item.trim()).filter(Boolean)),
    ).slice(0, 4),
    targetChapterCount: normalizeDirectorTargetChapterCount(candidate.targetChapterCount),
  };
}

interface CandidateTitleContext {
  roundCandidates?: DirectorCandidate[];
  excludedTitles?: string[];
}

export async function enhanceCandidateTitles(
  candidate: DirectorCandidate,
  context: CandidateGenerationContext,
  options: CandidateTitleContext = {},
): Promise<DirectorCandidate> {
  const excludedTitles = options.excludedTitles ?? [];
  const fallbackOptions = mergeTitleOptions([], candidate, excludedTitles);

  try {
    const response = await titleGenerationService.generateTitleIdeas({
      mode: "brief",
      selectionMode: "primary",
      brief: buildCandidateTitleBrief(candidate, context, options),
      genreId: context.request.genreId ?? null,
      count: 4,
      provider: context.options.provider,
      model: context.options.model,
    });
    const mergedOptions = mergeTitleOptions(response.titles, candidate, excludedTitles);
    const primaryTitle = mergedOptions[0]?.title?.trim();
    return {
      ...candidate,
      workingTitle: primaryTitle || candidate.workingTitle,
      titleOptions: mergedOptions,
    };
  } catch {
    return {
      ...candidate,
      titleOptions: fallbackOptions,
    };
  }
}

export function buildCandidateTitleBrief(
  candidate: DirectorCandidate,
  context: Pick<CandidateGenerationContext, "idea" | "request">,
  { roundCandidates = [], excludedTitles = [] }: CandidateTitleContext = {},
): string {
  const lines = [
    `Inspiración de la historia:${context.idea.trim()}`,
    candidate.plannedDirection && `Dirección de este caso:${candidate.plannedDirection}`,
    `Resumen de la historia:${candidate.logline}`,
    `Posicionamiento del programa:${candidate.positioning}`,
    `Puntos de venta principales:${candidate.sellingPoint}`,
    `Conflicto principal:${candidate.coreConflict}`,
    `Camino protagonista:${candidate.protagonistPath}`,
    `Gancho de apertura:${candidate.hookStrategy}`,
    `Ciclo de avance:${candidate.progressionLoop}`,
    `Dirección final:${candidate.endingDirection}`,
    candidate.recommendedWritingPlatform && `Plataforma de publicación recomendada:${candidate.recommendedWritingPlatform === "qidian_male"
      ? "canal masculino qidian"
      : candidate.recommendedWritingPlatform === "jinjiang_female"
        ? "canal femenino de jinjiang"
        : "Artículos web sin tomate"}`,
    candidate.writingPlatformReason?.trim() ? `Razones para juzgar la plataforma:${candidate.writingPlatformReason.trim()}` : "",
    context.request.readerChannelPreference === "male_oriented" ? "Canal de lectura: canal masculino" : "",
    context.request.readerChannelPreference === "female_oriented" ? "Canal de lectura: Canal femenino" : "",
    context.request.readerChannelPreference === "general" ? "Canal de lectura: Lector general" : "",
    context.request.targetAudience?.trim() ? `Lectores objetivo:${context.request.targetAudience.trim()}` : "",
    context.request.competingFeel?.trim() ? `Temperamento objetivo:${context.request.competingFeel.trim()}` : "",
    context.request.marketBriefPrompt?.trim() ? `Informe del mercado del libro abierto: \\n${context.request.marketBriefPrompt.trim()}` : "",
    candidate.toneKeywords.length > 0 ? `Palabras clave de temperamento:${candidate.toneKeywords.join(",")}` : "",
    context.request.title?.trim() ? `Título del usuario actualmente redactando:${context.request.title.trim()}` : "",
    ...roundCandidates.filter((other) => other.id !== candidate.id)
      .map((other) => `Otro plan en la misma ronda (solo a modo de comparación):${other.plannedDirection || other.logline}`),
    excludedTitles.length > 0 ? `Títulos ya ocupados por otros proyectos:${excludedTitles.join(",")}` : "",
  ].filter(Boolean);
  return lines.join("\n");
}

export function mergeTitleOptions(
  generatedTitles: TitleFactorySuggestion[],
  candidate: DirectorCandidate,
  excludedTitles: string[] = [],
): TitleFactorySuggestion[] {
  const merged: TitleFactorySuggestion[] = [];
  for (const option of generatedTitles) {
    const conflictsWithExcluded = excludedTitles.some((title) => isNearDuplicateTitle(title, option.title));
    if (!conflictsWithExcluded && !merged.some((existing) => isNearDuplicateTitle(existing.title, option.title))) {
      merged.push(option);
    }
  }

  const originalOption = buildFallbackTitleOption(candidate);
  const originalConflictsWithExcluded = excludedTitles.some((title) => (
    isNearDuplicateTitle(title, originalOption.title)
  ));
  if (
    !originalConflictsWithExcluded
    && !merged.some((existing) => isNearDuplicateTitle(existing.title, originalOption.title))
  ) {
    merged.push(originalOption);
  }

  return merged.slice(0, 4);
}

export function selectDistinctCandidateTitle(
  candidate: DirectorCandidate,
  excludedTitles: string[],
): DirectorCandidate | null {
  const availableOptions: TitleFactorySuggestion[] = [];
  for (const option of candidate.titleOptions ?? []) {
    const conflictsWithExcluded = excludedTitles.some((title) => isNearDuplicateTitle(title, option.title));
    if (
      !conflictsWithExcluded
      && !availableOptions.some((existing) => isNearDuplicateTitle(existing.title, option.title))
    ) {
      availableOptions.push(option);
    }
  }

  const currentTitleAvailable = !excludedTitles.some((title) => (
    isNearDuplicateTitle(title, candidate.workingTitle)
  ));
  const selectedOption = currentTitleAvailable
    ? availableOptions.find((option) => isNearDuplicateTitle(option.title, candidate.workingTitle))
      ?? buildFallbackTitleOption(candidate)
    : availableOptions[0];
  if (!selectedOption) {
    return null;
  }

  return {
    ...candidate,
    workingTitle: selectedOption.title.trim(),
    titleOptions: [
      selectedOption,
      ...availableOptions.filter((option) => !isNearDuplicateTitle(option.title, selectedOption.title)),
    ].slice(0, 4),
  };
}

function buildFallbackTitleOption(candidate: DirectorCandidate): TitleFactorySuggestion {
  return {
    title: candidate.workingTitle,
    clickRate: 60,
    style: "high_concept",
    angle: "Título del libro de propuesta original.",
    reason: "Se utilizará el nombre original del candidato a director.",
  };
}

export function toBookSpec(
  candidate: DirectorCandidate,
  idea: string,
  overrideTargetChapterCount?: number,
): BookSpec {
  return {
    storyInput: idea.trim(),
    positioning: candidate.positioning.trim(),
    sellingPoint: candidate.sellingPoint.trim(),
    coreConflict: candidate.coreConflict.trim(),
    protagonistPath: candidate.protagonistPath.trim(),
    endingDirection: candidate.endingDirection.trim(),
    hookStrategy: candidate.hookStrategy.trim(),
    progressionLoop: candidate.progressionLoop.trim(),
    targetChapterCount: normalizeDirectorTargetChapterCount(overrideTargetChapterCount ?? candidate.targetChapterCount),
    completionProfile: buildDirectorCompletionProfile(
      normalizeDirectorTargetChapterCount(overrideTargetChapterCount ?? candidate.targetChapterCount),
    ),
  };
}

export function buildRefinementSummary(
  presets: DirectorCorrectionPreset[],
  feedback: string | undefined,
  round: number,
): string | null {
  if (round === 1 && presets.length === 0 && !feedback?.trim()) {
    return null;
  }

  const presetSummary = presets.map((preset) => (
    DIRECTOR_CORRECTION_PRESETS.find((item) => item.value === preset)?.label ?? preset
  ));
  const fragments = [
    presetSummary.length > 0 ? `Corrección predeterminada:${presetSummary.join(",")}` : "",
    feedback?.trim() ? `Instrucciones adicionales:${feedback.trim()}` : "",
  ].filter(Boolean);
  return fragments.join(";") || "Regenerarse según la ronda de opiniones anterior.";
}

export function buildStoryInput(input: DirectorConfirmRequest, bookSpec: BookSpec): string {
  const powerSystem = input.candidate.productionFoundation?.powerSystem;
  const powerSystemMode = powerSystem?.mode
    ?? (input.powerSystemPreference && input.powerSystemPreference !== "ai_recommend"
      ? input.powerSystemPreference
      : null);
  const lines = [
    input.idea.trim(),
    input.description?.trim() ? `Descripción general adicional:${input.description.trim()}` : "",
    input.targetAudience?.trim() ? `Lectores objetivo:${input.targetAudience.trim()}` : "",
    input.bookSellingPoint?.trim() ? `Puntos de venta a nivel de libro:${input.bookSellingPoint.trim()}` : "",
    input.competingFeel?.trim() ? `Temperamento objetivo:${input.competingFeel.trim()}` : "",
    input.first30ChapterPromise?.trim() ? `Los primeros 30 capítulos prometen:${input.first30ChapterPromise.trim()}` : "",
    input.commercialTags && input.commercialTags.length > 0 ? `Etiquetas comerciales:${input.commercialTags.join(",")}` : "",
    input.genreId?.trim() ? `Base temática:${input.genreId.trim()}` : "",
    input.primaryStoryModeId?.trim() ? `Modo de propulsión principal:${input.primaryStoryModeId.trim()}` : "",
    input.secondaryStoryModeId?.trim() ? `Modo de propulsión secundaria:${input.secondaryStoryModeId.trim()}` : "",
    powerSystemMode ? `Modo de sistema de energía de combate:${powerSystemMode}` : "",
    powerSystem?.reason ? `Descripción del sistema de energía de combate:${powerSystem.reason}` : "",
    `Confirmar plan:${input.candidate.workingTitle}`,
    `Posicionamiento de la obra:${bookSpec.positioning}`,
    `Puntos de venta principales:${bookSpec.sellingPoint}`,
    `Conflicto principal:${bookSpec.coreConflict}`,
    `Camino protagonista:${bookSpec.protagonistPath}`,
    `Gancho principal:${bookSpec.hookStrategy}`,
    `Ciclo de avance:${bookSpec.progressionLoop}`,
    `Dirección final:${bookSpec.endingDirection}`,
    input.stepCalibrationInstruction?.trim()
      ? `Requisitos actuales de calibración de pasos:${input.stepCalibrationInstruction.trim()}`
      : "",
  ].filter(Boolean);
  return lines.join("\n");
}

export function buildWorkflowSeedPayload(
  input: DirectorProjectContextInput & Pick<DirectorLLMOptions, "provider" | "model" | "temperature" | "runMode"> & {
    idea: string;
    autoExecutionPlan?: DirectorAutoExecutionPlan;
    autoApproval?: DirectorAutoApprovalConfig;
    completionProfile?: DirectorCompletionProfile;
  },
  extra?: Record<string, unknown>,
): Record<string, unknown> {
  const basicForm = {
    title: input.title?.trim() || "",
    description: input.description?.trim() || "",
    targetAudience: input.targetAudience?.trim() || "",
    bookSellingPoint: input.bookSellingPoint?.trim() || "",
    competingFeel: input.competingFeel?.trim() || "",
    first30ChapterPromise: input.first30ChapterPromise?.trim() || "",
    commercialTagsText: input.commercialTags?.join(",") || "",
    genreId: input.genreId ?? "",
    primaryStoryModeId: input.primaryStoryModeId ?? "",
    secondaryStoryModeId: input.secondaryStoryModeId ?? "",
    worldId: input.worldId ?? "",
    worldSetupMode: input.worldId ? "auto_generate" : input.worldSetupMode ?? "auto_generate",
    writingMode: input.writingMode ?? "original",
    projectMode: input.projectMode ?? "co_pilot",
    readerChannelPreference: input.readerChannelPreference ?? "ai_judge",
    powerSystemPreference: input.powerSystemPreference ?? "ai_recommend",
    writingPlatformPreference: input.writingPlatformPreference ?? "ai_recommend",
    narrativePov: input.narrativePov ?? "third_person",
    pacePreference: input.pacePreference ?? "balanced",
    styleTone: input.styleTone?.trim() || "",
    emotionIntensity: input.emotionIntensity ?? "medium",
    aiFreedom: input.aiFreedom ?? "medium",
    postGenerationStyleReviewEnabled: input.postGenerationStyleReviewEnabled ?? true,
    defaultChapterLength: input.defaultChapterLength ?? 2800,
    estimatedChapterCount: input.estimatedChapterCount ?? null,
    estimatedChapterCountSource: input.estimatedChapterCount == null ? "default" : "user",
    userPreferredVolumeCount: input.userPreferredVolumeCount,
    projectStatus: input.projectStatus ?? "not_started",
    storylineStatus: input.storylineStatus ?? "not_started",
    outlineStatus: input.outlineStatus ?? "not_started",
    resourceReadyScore: input.resourceReadyScore ?? 0,
    sourceNovelId: input.sourceNovelId ?? "",
    sourceKnowledgeDocumentId: input.sourceKnowledgeDocumentId ?? "",
    continuationBookAnalysisId: input.continuationBookAnalysisId ?? "",
    continuationBookAnalysisSections: input.continuationBookAnalysisSections ?? [],
    referenceBookAnalysisId: input.referenceBookAnalysisId ?? "",
    referenceBookAnalysisSections: input.referenceBookAnalysisSections ?? [],
  };
  const autoApproval = Object.prototype.hasOwnProperty.call(input, "autoApproval")
    ? normalizeDirectorAutoApprovalConfig(input.autoApproval)
    : null;
  const completionProfile = input.completionProfile
    ?? buildDirectorCompletionProfile(basicForm.estimatedChapterCount ?? 80);
  return {
    title: basicForm.title || null,
    description: basicForm.description || null,
    targetAudience: basicForm.targetAudience || null,
    bookSellingPoint: basicForm.bookSellingPoint || null,
    competingFeel: basicForm.competingFeel || null,
    first30ChapterPromise: basicForm.first30ChapterPromise || null,
    commercialTags: input.commercialTags ?? [],
    genreId: basicForm.genreId || null,
    primaryStoryModeId: basicForm.primaryStoryModeId || null,
    secondaryStoryModeId: basicForm.secondaryStoryModeId || null,
    worldId: basicForm.worldId || null,
    worldSetupMode: basicForm.worldId ? undefined : basicForm.worldSetupMode,
    writingMode: basicForm.writingMode,
    projectMode: basicForm.projectMode,
    readerChannelPreference: basicForm.readerChannelPreference,
    powerSystemPreference: basicForm.powerSystemPreference,
    writingPlatformPreference: basicForm.writingPlatformPreference,
    narrativePov: basicForm.narrativePov,
    pacePreference: basicForm.pacePreference,
    styleTone: basicForm.styleTone || null,
    styleProfileId: input.styleProfileId?.trim() || null,
    styleIntentSummary: input.styleIntentSummary ?? null,
    emotionIntensity: basicForm.emotionIntensity,
    aiFreedom: basicForm.aiFreedom,
    postGenerationStyleReviewEnabled: basicForm.postGenerationStyleReviewEnabled,
    provider: input.provider ?? null,
    model: input.model?.trim() || null,
    temperature: typeof input.temperature === "number" ? input.temperature : null,
    runMode: input.runMode ?? "auto_to_ready",
    ...("issueGovernanceVersion" in input && input.issueGovernanceVersion === 1
      ? { issueGovernanceVersion: input.issueGovernanceVersion }
      : {}),
    ...("issuePolicy" in input && input.issuePolicy
      ? { issuePolicy: input.issuePolicy }
      : {}),
    ...("issuePolicySource" in input && (input.issuePolicySource === "global" || input.issuePolicySource === "novel")
      ? { issuePolicySource: input.issuePolicySource }
      : {}),
    ...(input.autoExecutionPlan ? { autoExecutionPlan: input.autoExecutionPlan } : {}),
    ...(autoApproval ? { autoApproval } : {}),
    estimatedChapterCount: basicForm.estimatedChapterCount,
    userPreferredVolumeCount: basicForm.userPreferredVolumeCount,
    completionProfile,
    idea: input.idea.trim(),
    basicForm,
    ...extra,
  };
}

export function buildDirectorWorkflowSeedPayload(
  input: DirectorConfirmRequest,
  novelId: string | null,
  extra?: Record<string, unknown>,
): Record<string, unknown> {
  const directorSessionPhase = extra?.directorSession
    && typeof extra.directorSession === "object"
    && "phase" in extra.directorSession
    ? (extra.directorSession as { phase?: unknown }).phase
    : null;
  const shouldClearCandidateStage = Boolean(novelId)
    || (
      typeof directorSessionPhase === "string"
      && directorSessionPhase !== "candidate_selection"
    );
  const nextCandidateStage = shouldClearCandidateStage
    ? null
    : (Object.prototype.hasOwnProperty.call(extra ?? {}, "candidateStage")
        ? (extra as { candidateStage?: unknown }).candidateStage
        : undefined);

  return buildWorkflowSeedPayload(input, {
    novelId,
    candidate: input.candidate,
    batch: {
      id: input.batchId,
      round: input.round,
    },
    directorInput: input,
    ...extra,
    candidateStage: nextCandidateStage,
  });
}

export function getDirectorInputFromSeedPayload(
  directorTaskData: DirectorWorkflowSeedPayload | null | undefined,
): DirectorConfirmRequest | null {
  const directorInput = directorTaskData?.directorInput;
  if (!directorInput || typeof directorInput !== "object") {
    return null;
  }
  return directorInput as DirectorConfirmRequest;
}

export function getDirectorLlmOptionsFromSeedPayload(
  directorTaskData: DirectorWorkflowSeedPayload | null | undefined,
): Pick<DirectorLLMOptions, "provider" | "model" | "temperature"> | null {
  if (!directorTaskData) {
    return null;
  }
  const directorInput = getDirectorInputFromSeedPayload(directorTaskData);
  const provider = directorTaskData.provider ?? directorInput?.provider ?? undefined;
  const model = typeof directorTaskData.model === "string"
    ? (directorTaskData.model.trim() || undefined)
    : (directorInput?.model?.trim() || undefined);
  const temperature = typeof directorTaskData.temperature === "number"
    ? directorTaskData.temperature
    : directorInput?.temperature;
  if (!provider && !model && typeof temperature !== "number") {
    return null;
  }
  return {
    provider,
    model,
    temperature,
  };
}
