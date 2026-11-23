import type {
  BookSpec,
  DirectorCandidate,
  DirectorConfirmRequest,
  DirectorProjectContextInput,
  DirectorRunMode,
  DirectorTakeoverEntryReadiness,
  DirectorTakeoverEntryStep,
  DirectorTakeoverExecutableRangeSnapshot,
  DirectorTakeoverPipelineJobSnapshot,
  DirectorTakeoverPreview,
  DirectorTakeoverReadinessResponse,
  DirectorTakeoverStageReadiness,
  DirectorTakeoverStartPhase,
  DirectorTakeoverStrategy,
  DirectorTakeoverCheckpointSnapshot,
} from "@ai-novel/shared/types/novelDirector";
import type { NovelWorkflowStage, BookContract } from "@ai-novel/shared/types/novelWorkflow";
import type { StoryMacroPlan } from "@ai-novel/shared/types/storyMacro";
import { DIRECTOR_TAKEOVER_ENTRY_STEPS } from "@ai-novel/shared/types/novelDirector";
import { normalizeDirectorTargetChapterCount } from "./novelDirectorHelpers";

export interface DirectorTakeoverNovelContext extends Omit<DirectorProjectContextInput, "description"> {
  id: string;
  title: string;
  description?: string | null;
  commercialTags: string[];
}

export interface DirectorTakeoverAssetSnapshot {
  hasStoryMacroPlan: boolean;
  hasBookContract: boolean;
  hasWorldSetupPrepared: boolean;
  characterCount: number;
  chapterCount: number;
  plannedChapterCount?: number | null;
  volumeCount: number;
  hasVolumeStrategyPlan?: boolean;
  firstVolumeId: string | null;
  firstVolumeChapterCount: number;
  volumeChapterRanges?: Array<{
    volumeOrder: number;
    startOrder: number;
    endOrder: number;
  }>;
  structuredOutlineChapterOrders?: number[];
  firstVolumeBeatSheetReady?: boolean;
  firstVolumePreparedChapterCount?: number;
  structuredOutlineRecoveryStep?: "beat_sheet" | "chapter_list" | "chapter_detail_bundle" | "chapter_sync" | "completed" | null;
  generatedChapterCount?: number;
  approvedChapterCount?: number;
  pendingRepairChapterCount?: number;
  /**
   * 目标自动执行范围内是否仍有「未处理且缺少完整章节细化」的章节。
   * 为真时，继续模式应先回到节奏 / 拆章补齐细化，而非直接进入章节执行
   * （否则 runFromReady 会抛「缺少完整章节细化」并卡死）。
   */
  hasUnpreparedChaptersInRange?: boolean;
  /** 缺少完整细化的章节序（调试/展示用）。 */
  missingExecutionContractOrders?: number[];
}

export interface DirectorTakeoverDecisionInput {
  entryStep: DirectorTakeoverEntryStep;
  strategy: DirectorTakeoverStrategy;
  snapshot: DirectorTakeoverAssetSnapshot;
  activePipelineJob?: DirectorTakeoverPipelineJobSnapshot | null;
  latestCheckpoint?: DirectorTakeoverCheckpointSnapshot | null;
  executableRange?: DirectorTakeoverExecutableRangeSnapshot | null;
}

export interface DirectorTakeoverResolvedPlan {
  entryStep: DirectorTakeoverEntryStep;
  strategy: DirectorTakeoverStrategy;
  effectiveStep: DirectorTakeoverEntryStep;
  effectiveStage: NovelWorkflowStage;
  startPhase: DirectorTakeoverStartPhase;
  resumeStage: "basic" | "story_macro" | "world" | "character" | "outline" | "structured" | "chapter" | "pipeline";
  skipSteps: DirectorTakeoverEntryStep[];
  summary: string;
  effectSummary: string;
  impactNotes: string[];
  usesCurrentBatch: boolean;
  currentStep?: DirectorTakeoverEntryStep | null;
  restartStep?: DirectorTakeoverEntryStep | null;
  executionMode: "phase" | "auto_execution";
  phase?: DirectorTakeoverStartPhase;
  resumeCheckpointType?: "chapter_batch_ready" | "step_review_required" | "replan_required" | null;
}

const DIRECTOR_TAKEOVER_STAGE_META: Record<
  DirectorTakeoverStartPhase,
  Pick<DirectorTakeoverStageReadiness, "label" | "description">
> = {
  story_macro: {
    label: "Comience con el plan de la gran historia",
    description: "Primero complete la macro de la historia y el contrato del libro, luego pase a los personajes, la estrategia del volumen y los capítulos.",
  },
  world_setup: {
    label: "Comience con la preparación para la cosmovisión",
    description: "Siguiendo el plan macro de la historia, primero completa la visión del mundo del libro, para luego continuar con los personajes y la posterior planificación.",
  },
  character_setup: {
    label: "Comience con la preparación del personaje.",
    description: "Siga la dirección existente a nivel de libro y solo deje que la IA se haga cargo de la alineación de personajes y la planificación posterior.",
  },
  volume_strategy: {
    label: "Comience con la estrategia de volumen",
    description: "Continúe generando estrategias de volumen y esqueletos de volumen utilizando instrucciones y roles existentes a nivel de libro.",
  },
  structured_outline: {
    label: "Comience con capítulos de ritmo/ruptura",
    description: "Utilice el plan de volumen existente y continúe generando tableros de ritmo, listas de capítulos y mejoras de capítulos.",
  },
};

const TAKEOVER_ENTRY_META: Record<
  DirectorTakeoverEntryStep,
  {
    label: string;
    description: string;
  }
> = {
  basic: {
    label: "Configuración del proyecto",
    description: "Continúe tomando el control de la información básica del proyecto existente, dando prioridad a los preactivos del director que faltan más temprano.",
  },
  story_macro: {
    label: "gran plan de historia",
    description: "Continúe o vuelva a ejecutar la planificación a nivel de libro en torno a Story Macro y Book Contract.",
  },
  world: {
    label: "preparación de la cosmovisión",
    description: "Continúe o vuelva a ejecutar los pasos actuales en torno a las reglas, fuerzas y limitaciones del mundo de este libro.",
  },
  character: {
    label: "Preparación de personajes",
    description: "Continúe o vuelva a ejecutar el paso actual en torno al elenco de personajes y aplicaciones.",
  },
  outline: {
    label: "estrategia de volumen",
    description: "Continúe o vuelva a ejecutar el paso actual sobre estrategias de volumen y esqueletos de volumen.",
  },
  structured: {
    label: "Ritmo / Capítulo de ruptura",
    description: "Continúe o vuelva a ejecutar el paso actual alrededor del tablero de ritmo de volumen actual, la lista de capítulos y los recursos de refinamiento.",
  },
  chapter: {
    label: "Ejecución del capítulo",
    description: "Se da prioridad a restaurar el lote de capítulos actual o continuar la ejecución desde el rango preparado.",
  },
  pipeline: {
    label: "arreglo de calidad",
    description: "Se dará prioridad a restaurar el lote actual de reparaciones o continuar avanzando en los capítulos en reparación.",
  },
};

function hasMeaningfulSeedMaterial(novel: DirectorTakeoverNovelContext): boolean {
  return Boolean(
    novel.description?.trim()
    || novel.targetAudience?.trim()
    || novel.bookSellingPoint?.trim()
    || novel.competingFeel?.trim()
    || novel.first30ChapterPromise?.trim()
    || novel.commercialTags.length > 0
    || novel.genreId?.trim()
    || novel.worldId?.trim(),
  );
}

function splitToneKeywords(novel: DirectorTakeoverNovelContext): string[] {
  const raw = [
    novel.styleTone?.trim() ?? "",
    novel.competingFeel?.trim() ?? "",
    ...novel.commercialTags,
  ]
    .filter(Boolean)
    .join(",");
  return Array.from(
    new Set(
      raw
        .split(/[，、|/]/)
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  ).slice(0, 4);
}

function buildTakeoverIdea(novel: DirectorTakeoverNovelContext): string {
  const lines = [
    novel.description?.trim() ? `Resumen de la historia:${novel.description.trim()}` : "",
    novel.title.trim() ? `Título del proyecto: "${novel.title.trim()}»` : "",
    novel.targetAudience?.trim() ? `Lectores objetivo:${novel.targetAudience.trim()}` : "",
    novel.bookSellingPoint?.trim() ? `Puntos de venta a nivel de libro:${novel.bookSellingPoint.trim()}` : "",
    novel.competingFeel?.trim() ? `Temperamento objetivo:${novel.competingFeel.trim()}` : "",
    novel.first30ChapterPromise?.trim() ? `Los primeros 30 capítulos prometen:${novel.first30ChapterPromise.trim()}` : "",
    novel.commercialTags.length > 0 ? `Etiquetas comerciales:${novel.commercialTags.join(",")}` : "",
  ].filter(Boolean);
  return lines.join("\n") || `Título del proyecto: "${novel.title.trim() || "Proyecto actual"}»`;
}

function buildTakeoverCandidate(input: {
  novel: DirectorTakeoverNovelContext;
  storyMacroPlan: StoryMacroPlan | null;
  bookContract: BookContract | null;
}): DirectorCandidate {
  const { novel, storyMacroPlan, bookContract } = input;
  const decomposition = storyMacroPlan?.decomposition ?? null;
  const expansion = storyMacroPlan?.expansion ?? null;
  const workingTitle = novel.title.trim() || "Proyecto actual";
  const sellingPoint = bookContract?.coreSellingPoint?.trim()
    || novel.bookSellingPoint?.trim()
    || decomposition?.selling_point?.trim()
    || "Ofrezca continuamente retornos a los lectores en torno a los principales puntos de venta de los proyectos actuales.";
  const coreConflict = decomposition?.core_conflict?.trim()
    || novel.description?.trim()
    || bookContract?.readingPromise?.trim()
    || "Continúe avanzando en torno a los conflictos de líneas principales del proyecto actual.";
  const protagonistPath = decomposition?.growth_path?.trim()
    || expansion?.protagonist_core?.trim()
    || bookContract?.protagonistFantasy?.trim()
    || "El protagonista sigue creciendo y completando cambios de escenario bajo la presión de la línea principal.";
  const hookStrategy = decomposition?.main_hook?.trim()
    || bookContract?.chapter3Payoff?.trim()
    || novel.first30ChapterPromise?.trim()
    || "Construya ganchos tempranos y prepare retornos en torno a los puntos de venta actuales.";
  const progressionLoop = decomposition?.progression_loop?.trim()
    || bookContract?.escalationLadder?.trim()
    || "Avance de objetivos -> Escalada de resistencia -> Recompensas de etapa -> Nuevos problemas.";
  const endingDirection = decomposition?.ending_flavor?.trim()
    || bookContract?.relationshipMainline?.trim()
    || "Concluir siguiendo el temperamento establecido y la dirección principal del proyecto actual.";

  return {
    id: `takeover-${novel.id}`,
    workingTitle,
    logline: novel.description?.trim() || coreConflict,
    positioning: novel.targetAudience?.trim() || sellingPoint,
    sellingPoint,
    coreConflict,
    protagonistPath,
    endingDirection,
    hookStrategy,
    progressionLoop,
    whyItFits: "Continúe con la dirección automática heredando la información guardada a nivel de libro y los activos existentes del proyecto actual.",
    toneKeywords: splitToneKeywords(novel),
    targetChapterCount: normalizeDirectorTargetChapterCount(novel.estimatedChapterCount),
  };
}

export function buildDirectorTakeoverInput(input: {
  novel: DirectorTakeoverNovelContext;
  storyMacroPlan: StoryMacroPlan | null;
  bookContract: BookContract | null;
  runMode?: DirectorRunMode;
}): DirectorConfirmRequest {
  return {
    title: input.novel.title.trim(),
    description: input.novel.description?.trim() || undefined,
    targetAudience: input.novel.targetAudience?.trim() || undefined,
    bookSellingPoint: input.novel.bookSellingPoint?.trim() || undefined,
    competingFeel: input.novel.competingFeel?.trim() || undefined,
    first30ChapterPromise: input.novel.first30ChapterPromise?.trim() || undefined,
    commercialTags: input.novel.commercialTags.length > 0 ? input.novel.commercialTags : undefined,
    genreId: input.novel.genreId?.trim() || undefined,
    primaryStoryModeId: input.novel.primaryStoryModeId?.trim() || undefined,
    secondaryStoryModeId: input.novel.secondaryStoryModeId?.trim() || undefined,
    worldId: input.novel.worldId?.trim() || undefined,
    writingMode: input.novel.writingMode,
    projectMode: input.novel.projectMode,
    narrativePov: input.novel.narrativePov,
    pacePreference: input.novel.pacePreference,
    styleTone: input.novel.styleTone?.trim() || undefined,
    emotionIntensity: input.novel.emotionIntensity,
    aiFreedom: input.novel.aiFreedom,
    postGenerationStyleReviewEnabled: input.novel.postGenerationStyleReviewEnabled,
    defaultChapterLength: input.novel.defaultChapterLength,
    estimatedChapterCount: input.novel.estimatedChapterCount ?? undefined,
    projectStatus: input.novel.projectStatus,
    storylineStatus: input.novel.storylineStatus,
    outlineStatus: input.novel.outlineStatus,
    resourceReadyScore: input.novel.resourceReadyScore,
    sourceNovelId: input.novel.sourceNovelId ?? undefined,
    sourceKnowledgeDocumentId: input.novel.sourceKnowledgeDocumentId ?? undefined,
    continuationBookAnalysisId: input.novel.continuationBookAnalysisId ?? undefined,
    continuationBookAnalysisSections: input.novel.continuationBookAnalysisSections ?? undefined,
    idea: buildTakeoverIdea(input.novel),
    candidate: buildTakeoverCandidate({
      novel: input.novel,
      storyMacroPlan: input.storyMacroPlan,
      bookContract: input.bookContract,
    }),
    runMode: input.runMode,
  };
}

function isStoryMacroReady(snapshot: DirectorTakeoverAssetSnapshot): boolean {
  return snapshot.hasStoryMacroPlan && snapshot.hasBookContract;
}

function isCharacterReady(snapshot: DirectorTakeoverAssetSnapshot): boolean {
  return snapshot.characterCount > 0;
}

function isOutlineReady(snapshot: DirectorTakeoverAssetSnapshot): boolean {
  return snapshot.volumeCount > 0 && Boolean(snapshot.hasVolumeStrategyPlan);
}

export function isTakeoverStructuredOutlineReadyForValidation(snapshot: Pick<DirectorTakeoverAssetSnapshot, "structuredOutlineRecoveryStep">): boolean {
  return snapshot.structuredOutlineRecoveryStep === "chapter_sync"
    || snapshot.structuredOutlineRecoveryStep === "completed";
}

function isStructuredReady(snapshot: DirectorTakeoverAssetSnapshot): boolean {
  return isTakeoverStructuredOutlineReadyForValidation(snapshot);
}

function isStructuredSyncPending(snapshot: DirectorTakeoverAssetSnapshot): boolean {
  return snapshot.structuredOutlineRecoveryStep === "chapter_sync";
}

function hasAnyStructuredAsset(snapshot: DirectorTakeoverAssetSnapshot): boolean {
  return Boolean(snapshot.firstVolumeBeatSheetReady)
    || snapshot.firstVolumeChapterCount > 0
    || (snapshot.firstVolumePreparedChapterCount ?? 0) > 0;
}

function hasExecutableRange(input: {
  snapshot: DirectorTakeoverAssetSnapshot;
  executableRange?: DirectorTakeoverExecutableRangeSnapshot | null;
  latestCheckpoint?: DirectorTakeoverCheckpointSnapshot | null;
  activePipelineJob?: DirectorTakeoverPipelineJobSnapshot | null;
}): boolean {
  return Boolean(
    input.executableRange
    || input.activePipelineJob,
  );
}

function isRepairingPipelineJob(job: DirectorTakeoverPipelineJobSnapshot | null | undefined): boolean {
  if (!job?.currentStage) {
    return false;
  }
  return job.currentStage === "reviewing" || job.currentStage === "repairing";
}

function hasPendingRepairContext(input: {
  snapshot: DirectorTakeoverAssetSnapshot;
  activePipelineJob?: DirectorTakeoverPipelineJobSnapshot | null;
  latestCheckpoint?: DirectorTakeoverCheckpointSnapshot | null;
}): boolean {
  return Boolean(
    isRepairingPipelineJob(input.activePipelineJob)
    || input.latestCheckpoint?.checkpointType === "chapter_batch_ready"
    || input.latestCheckpoint?.checkpointType === "replan_required"
    || (input.snapshot.pendingRepairChapterCount ?? 0) > 0,
  );
}

const TAKEOVER_PHASE_TO_ENTRY_STEP: Record<DirectorTakeoverStartPhase, DirectorTakeoverEntryStep> = {
  story_macro: "story_macro",
  world_setup: "world",
  character_setup: "character",
  volume_strategy: "outline",
  structured_outline: "structured",
};

const TAKEOVER_ENTRY_STEP_TO_LEGACY_START_PHASE: Record<DirectorTakeoverEntryStep, DirectorTakeoverStartPhase> = {
  basic: "story_macro",
  story_macro: "story_macro",
  world: "world_setup",
  character: "character_setup",
  outline: "volume_strategy",
  structured: "structured_outline",
  chapter: "structured_outline",
  pipeline: "structured_outline",
};

const TAKEOVER_ENTRY_STEP_TO_WORKFLOW_STAGE: Record<DirectorTakeoverEntryStep, NovelWorkflowStage> = {
  basic: "story_macro",
  story_macro: "story_macro",
  world: "world_setup",
  character: "character_setup",
  outline: "volume_strategy",
  structured: "structured_outline",
  chapter: "chapter_execution",
  pipeline: "quality_repair",
};

export function phaseToEntryStep(phase: DirectorTakeoverStartPhase): DirectorTakeoverEntryStep {
  return TAKEOVER_PHASE_TO_ENTRY_STEP[phase];
}

export function entryStepToLegacyStartPhase(step: DirectorTakeoverEntryStep): DirectorTakeoverStartPhase {
  return TAKEOVER_ENTRY_STEP_TO_LEGACY_START_PHASE[step];
}

export function entryStepToWorkflowStage(step: DirectorTakeoverEntryStep): NovelWorkflowStage {
  return TAKEOVER_ENTRY_STEP_TO_WORKFLOW_STAGE[step];
}

export function buildSkipSteps(from: DirectorTakeoverEntryStep, to: DirectorTakeoverEntryStep): DirectorTakeoverEntryStep[] {
  const fromIndex = DIRECTOR_TAKEOVER_ENTRY_STEPS.indexOf(from);
  const toIndex = DIRECTOR_TAKEOVER_ENTRY_STEPS.indexOf(to);
  if (fromIndex < 0 || toIndex < 0 || toIndex <= fromIndex) {
    return [];
  }
  return DIRECTOR_TAKEOVER_ENTRY_STEPS.slice(fromIndex, toIndex);
}

function resolveExecutionContinuationStep(input: {
  snapshot: DirectorTakeoverAssetSnapshot;
  activePipelineJob?: DirectorTakeoverPipelineJobSnapshot | null;
  latestCheckpoint?: DirectorTakeoverCheckpointSnapshot | null;
  executableRange?: DirectorTakeoverExecutableRangeSnapshot | null;
  preferPipeline: boolean;
}): DirectorTakeoverEntryStep | null {
  const executable = hasExecutableRange(input);
  if (!executable) {
    return null;
  }
  const pendingRepair = hasPendingRepairContext(input);
  if (pendingRepair) {
    return "pipeline";
  }
  // 目标范围内仍有未细化章节、且当前没有进行中的批次时，先回到节奏 / 拆章补齐细化，
  // 而不是直接进入章节执行——否则会因「缺少完整章节细化」抛错卡死，且无法自动补齐。
  if (input.snapshot.hasUnpreparedChaptersInRange && !input.activePipelineJob) {
    return null;
  }
  if (input.preferPipeline) {
    return "chapter";
  }
  return "chapter";
}

function resolveContinueTargetStep(input: {
  entryStep: DirectorTakeoverEntryStep;
  selectedEntryStep?: DirectorTakeoverEntryStep;
  snapshot: DirectorTakeoverAssetSnapshot;
  activePipelineJob?: DirectorTakeoverPipelineJobSnapshot | null;
  latestCheckpoint?: DirectorTakeoverCheckpointSnapshot | null;
  executableRange?: DirectorTakeoverExecutableRangeSnapshot | null;
}): DirectorTakeoverEntryStep {
  const storyReady = isStoryMacroReady(input.snapshot);
  const worldReady = input.snapshot.hasWorldSetupPrepared;
  const characterReady = isCharacterReady(input.snapshot);
  const outlineReady = isOutlineReady(input.snapshot);
  const structuredExecutionReady = hasExecutableRange(input);

  if (input.entryStep === "basic") {
    if (!storyReady) return "story_macro";
    if (!worldReady) return "world";
    if (!characterReady) return "character";
    if (!outlineReady) return "outline";
    if (!structuredExecutionReady) return "structured";
    return resolveExecutionContinuationStep({
      ...input,
      preferPipeline: false,
    }) ?? "structured";
  }
  if (input.entryStep === "story_macro") {
    if (!storyReady) return "story_macro";
    return resolveContinueTargetStep({ ...input, selectedEntryStep: input.selectedEntryStep ?? input.entryStep, entryStep: "world" });
  }
  if (input.entryStep === "world") {
    if (!storyReady) return "story_macro";
    if (!worldReady) return "world";
    return resolveContinueTargetStep({ ...input, selectedEntryStep: input.selectedEntryStep ?? input.entryStep, entryStep: "character" });
  }
  if (input.entryStep === "character") {
    if (!worldReady) return "world";
    if (!characterReady) return "character";
    return resolveContinueTargetStep({ ...input, selectedEntryStep: input.selectedEntryStep ?? input.entryStep, entryStep: "outline" });
  }
  if (input.entryStep === "outline") {
    if (!outlineReady) return "outline";
    return resolveContinueTargetStep({ ...input, selectedEntryStep: input.selectedEntryStep ?? input.entryStep, entryStep: "structured" });
  }
  if (input.entryStep === "structured") {
    if ((input.selectedEntryStep ?? input.entryStep) === "structured") return "structured";
    if (!structuredExecutionReady) return "structured";
    return resolveExecutionContinuationStep({
      ...input,
      preferPipeline: false,
    }) ?? "structured";
  }
  if (input.entryStep === "chapter") {
    return resolveExecutionContinuationStep({
      ...input,
      preferPipeline: false,
    }) ?? "structured";
  }
  return resolveExecutionContinuationStep({
    ...input,
    preferPipeline: true,
  }) ?? "structured";
}

function buildPhasePlan(input: {
  entryStep: DirectorTakeoverEntryStep;
  strategy: DirectorTakeoverStrategy;
  effectiveStep: Extract<DirectorTakeoverEntryStep, "story_macro" | "world" | "character" | "outline" | "structured">;
  summary: string;
  effectSummary: string;
  impactNotes: string[];
}): DirectorTakeoverResolvedPlan {
  const startPhase = entryStepToLegacyStartPhase(input.effectiveStep);
  return {
    entryStep: input.entryStep,
    strategy: input.strategy,
    effectiveStep: input.effectiveStep,
    effectiveStage: entryStepToWorkflowStage(input.effectiveStep),
    startPhase,
    phase: startPhase,
    resumeStage: input.effectiveStep,
    skipSteps: buildSkipSteps(input.entryStep, input.effectiveStep),
    summary: input.summary,
    effectSummary: input.effectSummary,
    impactNotes: input.impactNotes,
    usesCurrentBatch: false,
    currentStep: input.strategy === "continue_existing" ? input.effectiveStep : null,
    restartStep: input.strategy === "restart_current_step" ? input.effectiveStep : null,
    executionMode: "phase",
    resumeCheckpointType: null,
  };
}

function buildAutoExecutionPlan(input: {
  entryStep: DirectorTakeoverEntryStep;
  strategy: DirectorTakeoverStrategy;
  effectiveStep: "chapter" | "pipeline";
  usesCurrentBatch: boolean;
  summary: string;
  effectSummary: string;
  impactNotes: string[];
  latestCheckpoint?: DirectorTakeoverCheckpointSnapshot | null;
}): DirectorTakeoverResolvedPlan {
  const effectiveStage = input.effectiveStep === "pipeline" ? "quality_repair" : "chapter_execution";
  return {
    entryStep: input.entryStep,
    strategy: input.strategy,
    effectiveStep: input.effectiveStep,
    effectiveStage,
    startPhase: "structured_outline",
    resumeStage: input.effectiveStep,
    skipSteps: buildSkipSteps(input.entryStep, input.effectiveStep),
    summary: input.summary,
    effectSummary: input.effectSummary,
    impactNotes: input.impactNotes,
    usesCurrentBatch: input.usesCurrentBatch,
    currentStep: input.strategy === "continue_existing" ? input.effectiveStep : null,
    restartStep: input.strategy === "restart_current_step" ? input.entryStep : null,
    executionMode: "auto_execution",
    resumeCheckpointType: input.latestCheckpoint?.checkpointType ?? null,
  };
}

export function resolveDirectorTakeoverPlan(input: DirectorTakeoverDecisionInput): DirectorTakeoverResolvedPlan {
  const storyReady = isStoryMacroReady(input.snapshot);
  const worldReady = input.snapshot.hasWorldSetupPrepared;
  const characterReady = isCharacterReady(input.snapshot);
  const outlineReady = isOutlineReady(input.snapshot);
  const executable = hasExecutableRange(input);
  const pendingRepair = hasPendingRepairContext(input);

  if (input.strategy === "continue_existing") {
    const effectiveStep = resolveContinueTargetStep(input);
    if (effectiveStep === "story_macro") {
      return buildPhasePlan({
        entryStep: input.entryStep,
        strategy: input.strategy,
        effectiveStep,
        summary: "Continúe el progreso y primero complete el plan general de la historia.",
        effectSummary: "La información básica actual se reutilizará y solo se completará la macro de la historia y el contrato del libro que faltan.",
        impactNotes: ["Los capítulos y textos existentes no se borrarán."],
      });
    }
    if (effectiveStep === "character") {
      return buildPhasePlan({
        entryStep: input.entryStep,
        strategy: input.strategy,
        effectiveStep,
        summary: "Continúe con el progreso existente y luego recupere la preparación del personaje.",
        effectSummary: "Se reutilizará la planificación completa a nivel de libro y solo se complementarán la alineación de personajes y las aplicaciones de personajes.",
        impactNotes: ["El contrato de libro/macro de historia existente no se volverá a ejecutar."],
      });
    }
    if (effectiveStep === "world") {
      return buildPhasePlan({
        entryStep: input.entryStep,
        strategy: input.strategy,
        effectiveStep,
        summary: "Continuar con el progreso existente y luego preparar la visión del mundo.",
        effectSummary: "Reutilizará Story Macro y Book Contract para generar o vincular los activos de visión del mundo utilizados en este libro.",
        impactNotes: ["Los planos y textos existentes a nivel de libro no se borrarán."],
      });
    }
    if (effectiveStep === "outline") {
      return buildPhasePlan({
        entryStep: input.entryStep,
        strategy: input.strategy,
        effectiveStep,
        summary: "Continúe con los avances realizados y luego siga la estrategia de recuperación de los trabajos.",
        effectSummary: "Se reutilizarán la planificación a nivel de libro y los recursos de personajes existentes, y solo se complementarán la estrategia de volumen y el esqueleto de volumen.",
        impactNotes: ["Los caracteres y textos existentes no se borrarán."],
      });
    }
    if (effectiveStep === "structured") {
      return buildPhasePlan({
        entryStep: input.entryStep,
        strategy: input.strategy,
        effectiveStep,
        summary: "Continúe con el progreso existente y luego agregue capítulos de ritmo/pausa.",
        effectSummary: "La estrategia de volumen completa se reutilizará y solo se complementarán el tablero de ritmo de volumen actual, la lista de capítulos, el refinamiento de capítulos o los pasos de sincronización.",
        impactNotes: ["El texto existente se conservará y los capítulos no se eliminarán en lotes."],
      });
    }
    if (!executable) {
      throw new Error("Actualmente no hay un alcance de ejecución de capítulos que pueda continuar; primero complete los recursos de ruptura de ritmo/capítulo.");
    }
    if (effectiveStep === "pipeline") {
      return buildAutoExecutionPlan({
        entryStep: input.entryStep,
        strategy: input.strategy,
        effectiveStep,
        usesCurrentBatch: true,
        latestCheckpoint: input.latestCheckpoint,
        summary: "Continúe el progreso existente y restaure primero el lote de reparación de calidad actual.",
        effectSummary: "Se dará prioridad a restaurar los lotes o capítulos que se están reparando actualmente o los capítulos por reparar, y no se abrirán nuevas tareas duplicadas.",
        impactNotes: ["Preservar el texto existente y los activos de planificación.", "Sólo se omitirán los capítulos que hayan sido aprobados oficialmente."],
      });
    }
    return buildAutoExecutionPlan({
      entryStep: input.entryStep,
      strategy: input.strategy,
      effectiveStep: "chapter",
      usesCurrentBatch: executable,
      latestCheckpoint: input.latestCheckpoint,
      summary: "Continúe con el progreso existente y restaure primero el lote de capítulos actual.",
      effectSummary: "Se dará prioridad a reanudar lotes activos, puntos de control o rangos de capítulos preparados para continuar con la ejecución.",
      impactNotes: ["El texto existente no se borrará.", "Sólo se omitirán los capítulos aprobados/publicados."],
    });
  }

  if (input.entryStep === "basic" || input.entryStep === "story_macro") {
    return buildPhasePlan({
      entryStep: input.entryStep,
      strategy: input.strategy,
      effectiveStep: "story_macro",
      summary: "Regenere el paso actual y vuelva a ejecutarlo desde el plan macro de la historia.",
      effectSummary: "La macro de la historia y el contrato del libro se borrarán primero y luego se volverá a ejecutar el plan de la macro de la historia.",
      impactNotes: ["Se actualizarán los activos de planificación actuales a nivel de libro.", "El texto escrito no será eliminado."],
    });
  }
  if (input.entryStep === "world") {
    if (!storyReady) {
      throw new Error("Actualmente, no existe una macro de historia ni un contrato de libro, por lo que no puedes prepararte para una repetición directamente desde la vista del mundo.");
    }
    return buildPhasePlan({
      entryStep: input.entryStep,
      strategy: input.strategy,
      effectiveStep: "world",
      summary: "Regenera el paso actual y prepárate para correr nuevamente desde la visión del mundo.",
      effectSummary: "Los activos de la visión del mundo de este libro se regenerarán o reemplazarán, y los personajes posteriores estarán preparados para utilizar las nuevas limitaciones del mundo.",
      impactNotes: ["Mantener macro de historia y contrato de libro.", "El texto existente no se eliminará."],
    });
  }
  if (input.entryStep === "character") {
    if (!storyReady || !worldReady) {
      throw new Error("Actualmente, falta una planificación macro de la historia o recursos de visión del mundo, y no podemos preparar una repetición directamente a partir de los personajes.");
    }
    return buildPhasePlan({
      entryStep: input.entryStep,
      strategy: input.strategy,
      effectiveStep: "character",
      summary: "Regenera el paso actual y prepárate para huir nuevamente del personaje.",
      effectSummary: "La alineación de personajes actual, las relaciones y los candidatos a la preparación de personajes se borrarán primero y luego se ejecutará nuevamente la preparación de personajes.",
      impactNotes: ["Preservar la planificación a nivel de libro.", "El texto existente no se borrará."],
    });
  }
  if (input.entryStep === "outline") {
    if (!storyReady || !worldReady || !characterReady) {
      throw new Error("Actualmente no hay suficientes activos preposicionados y no se pueden volver a ejecutar directamente desde la estrategia de volumen.");
    }
    return buildPhasePlan({
      entryStep: input.entryStep,
      strategy: input.strategy,
      effectiveStep: "outline",
      summary: "Regenere el paso actual y vuelva a ejecutar desde la estrategia de lanzamiento.",
      effectSummary: "La estrategia de volumen actual y el esqueleto de volumen se borrarán primero y luego se reiniciará la ejecución desde la estrategia de volumen.",
      impactNotes: ["Se conservan la planificación y los personajes a nivel anterior al libro.", "El texto existente no se borrará."],
    });
  }
  if (input.entryStep === "structured") {
    if (!storyReady || !worldReady || !characterReady || !outlineReady) {
      throw new Error("Actualmente no hay recursos preexistentes suficientes y no se puede volver a ejecutar directamente desde el ritmo/capítulo.");
    }
    return buildPhasePlan({
      entryStep: input.entryStep,
      strategy: input.strategy,
      effectiveStep: "structured",
      summary: "Regenere el paso actual y reinicie desde el ritmo/capítulo.",
      effectSummary: "El tablero de ritmo, la lista de capítulos y los recursos de refinamiento de capítulos del volumen actual se borrarán primero y luego se volverá a ejecutar esta etapa.",
      impactNotes: ["Se borrarán los productos de capítulos no escritos del volumen actual.", "El texto escrito no será eliminado."],
    });
  }
  if (!executable) {
    throw new Error("Actualmente no existe un rango de capítulos ejecutables y no se pueden abrir nuevos lotes de capítulos directamente.");
  }
  if (input.entryStep === "pipeline" && !pendingRepair && !executable) {
    throw new Error("Actualmente no existe un contexto de reparación de calidad para continuar.");
  }
  return buildAutoExecutionPlan({
    entryStep: input.entryStep,
    strategy: input.strategy,
    effectiveStep: input.entryStep === "pipeline" ? "pipeline" : "chapter",
    usesCurrentBatch: false,
    latestCheckpoint: input.latestCheckpoint,
    summary: input.entryStep === "pipeline" ? "Regenere el paso actual, borre los resultados de reparación de calidad actuales y luego ejecútelo nuevamente." : "Vuelva a generar el paso actual, borre el lote de capítulos actual y luego ejecútelo nuevamente.",
    effectSummary: input.entryStep === "pipeline"
      ? "Los resultados actuales de la reparación de calidad y el estado de aprobación se borrarán primero y luego se volverá a revisar/reparar el texto existente."
      : "Primero se borrarán el borrador del texto, el estado de revisión y el resumen derivado del alcance de ejecución del capítulo actual y luego se volverá a generar este lote.",
    impactNotes: input.entryStep === "pipeline"
      ? ["Mantenga el texto del capítulo actual.", "Volverá a entrar en revisión y reparación automática."]
      : ["Se borrará el borrador de texto del lote actual.", "Preservar la planificación previa y la estructura de capítulos."],
  });
}

function buildStoryMacroReadiness(
  novel: DirectorTakeoverNovelContext,
): Pick<DirectorTakeoverStageReadiness, "available" | "reason"> {
  if (hasMeaningfulSeedMaterial(novel)) {
    return {
      available: true,
      reason: "La información a nivel de libro ahora está disponible y se puede obtener de la planificación macro de la historia.",
    };
  }
  return {
    available: false,
    reason: "Agregue al menos una oración de resumen de la historia, los puntos de venta a nivel de libro, las cualidades de evaluación comparativa o los compromisos en los primeros 30 capítulos antes de comenzar la adquisición automática.",
  };
}

function buildCharacterSetupReadiness(
  snapshot: DirectorTakeoverAssetSnapshot,
): Pick<DirectorTakeoverStageReadiness, "available" | "reason"> {
  if (!isStoryMacroReady(snapshot)) {
    return {
      available: false,
      reason: "Antes de omitir la planificación macro de la historia, debe tener la macro de la historia y el contrato del libro.",
    };
  }
  if (!snapshot.hasWorldSetupPrepared) {
    return {
      available: false,
      reason: "Debes completar la preparación de la visión del mundo antes de poder asumir directamente la preparación del personaje.",
    };
  }
  return {
    available: true,
    reason: "Los recursos de planificación y visión del mundo a nivel de libro están listos y puedes continuar haciéndote cargo de la preparación del personaje.",
  };
}

function buildWorldSetupReadiness(
  snapshot: DirectorTakeoverAssetSnapshot,
): Pick<DirectorTakeoverStageReadiness, "available" | "reason"> {
  if (!isStoryMacroReady(snapshot)) {
    return {
      available: false,
      reason: "Antes de omitir la planificación macro de la historia, debe tener la macro de la historia y el contrato del libro.",
    };
  }
  return {
    available: true,
    reason: snapshot.hasWorldSetupPrepared
      ? "Este libro contiene una visión del mundo que puede examinarse, refinarse o regenerarse."
      : "La planificación a nivel de libro está completa y usted puede preparar la visión del mundo de este libro.",
  };
}

function buildVolumeStrategyReadiness(
  snapshot: DirectorTakeoverAssetSnapshot,
): Pick<DirectorTakeoverStageReadiness, "available" | "reason"> {
  if (!isStoryMacroReady(snapshot)) {
    return {
      available: false,
      reason: "Antes de saltarse la etapa de preproducción, es necesario tener una macro de historia y un contrato de libro.",
    };
  }
  if (!snapshot.hasWorldSetupPrepared) {
    return {
      available: false,
      reason: "Antes de comenzar con la estrategia de volumen, es necesario completar la preparación de la visión del mundo.",
    };
  }
  if (!isCharacterReady(snapshot)) {
    return {
      available: false,
      reason: "Se requiere al menos 1 personaje confirmado antes de comenzar con la estrategia de volumen.",
    };
  }
  return {
    available: true,
    reason: "La planificación a nivel de libro y los recursos de los personajes están completos y puedes continuar desde la estrategia de volumen.",
  };
}

function buildStructuredOutlineReadiness(
  snapshot: DirectorTakeoverAssetSnapshot,
): Pick<DirectorTakeoverStageReadiness, "available" | "reason"> {
  if (!isStoryMacroReady(snapshot)) {
    return {
      available: false,
      reason: "Antes de saltarse la etapa de preproducción, es necesario tener una macro de historia y un contrato de libro.",
    };
  }
  if (!snapshot.hasWorldSetupPrepared) {
    return {
      available: false,
      reason: "Antes de comenzar con el ritmo o la división de capítulos, es necesario completar la preparación de la visión del mundo.",
    };
  }
  if (!isCharacterReady(snapshot)) {
    return {
      available: false,
      reason: "Se requiere al menos 1 personaje confirmado antes de que pueda comenzar el ritmo/división.",
    };
  }
  if (!isOutlineReady(snapshot)) {
    return {
      available: false,
      reason: "Antes de comenzar con el ritmo/desempaquetado de los capítulos, es necesario tener una estrategia de volumen/esqueleto de volumen.",
    };
  }
  return {
    available: true,
    reason: "Los recursos a nivel de volumen ya existen y se pueden continuar directamente desde el inicio del tiempo/capítulo.",
  };
}

function resolveRecommendedTakeoverPhase(snapshot: DirectorTakeoverAssetSnapshot): DirectorTakeoverStartPhase {
  if (!isStoryMacroReady(snapshot)) {
    return "story_macro";
  }
  if (!snapshot.hasWorldSetupPrepared) {
    return "world_setup";
  }
  if (!isCharacterReady(snapshot)) {
    return "character_setup";
  }
  if (!isOutlineReady(snapshot)) {
    return "volume_strategy";
  }
  return "structured_outline";
}

function buildPreviewOrFallback(input: {
  entryStep: DirectorTakeoverEntryStep;
  strategy: DirectorTakeoverStrategy;
  snapshot: DirectorTakeoverAssetSnapshot;
  activePipelineJob?: DirectorTakeoverPipelineJobSnapshot | null;
  latestCheckpoint?: DirectorTakeoverCheckpointSnapshot | null;
  executableRange?: DirectorTakeoverExecutableRangeSnapshot | null;
}): DirectorTakeoverPreview {
  try {
    const plan = resolveDirectorTakeoverPlan(input);
    return {
      strategy: input.strategy,
      summary: plan.summary,
      effectSummary: plan.effectSummary,
      effectiveStep: plan.effectiveStep,
      effectiveStage: plan.effectiveStage,
      skipSteps: plan.skipSteps,
      continueStep: plan.currentStep ?? null,
      restartStep: plan.restartStep ?? null,
      usesCurrentBatch: plan.usesCurrentBatch,
      impactNotes: plan.impactNotes,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "En las condiciones actuales, no es posible continuar con este paso.";
    return {
      strategy: input.strategy,
      summary: input.strategy === "continue_existing" ? "El progreso no puede continuar en este momento." : "No es posible rehacer este paso todavía.",
      effectSummary: message,
      effectiveStep: input.entryStep,
      effectiveStage: entryStepToWorkflowStage(input.entryStep),
      skipSteps: [],
      continueStep: input.strategy === "continue_existing" ? input.entryStep : null,
      restartStep: input.strategy === "restart_current_step" ? input.entryStep : null,
      usesCurrentBatch: false,
      impactNotes: [message],
    };
  }
}

function buildEntryStepStatus(input: {
  step: DirectorTakeoverEntryStep;
  novel: DirectorTakeoverNovelContext;
  snapshot: DirectorTakeoverAssetSnapshot;
  activePipelineJob?: DirectorTakeoverPipelineJobSnapshot | null;
  latestCheckpoint?: DirectorTakeoverCheckpointSnapshot | null;
  executableRange?: DirectorTakeoverExecutableRangeSnapshot | null;
}): DirectorTakeoverEntryReadiness["status"] {
  const { snapshot } = input;
  if (input.step === "basic") {
    return hasMeaningfulSeedMaterial(input.novel) ? "ready" : "missing";
  }
  if (input.step === "story_macro") {
    if (snapshot.hasStoryMacroPlan && snapshot.hasBookContract) return "complete";
    if (snapshot.hasStoryMacroPlan || snapshot.hasBookContract) return "partial";
    return "missing";
  }
  if (input.step === "world") {
    if (!isStoryMacroReady(snapshot)) return "blocked";
    return snapshot.hasWorldSetupPrepared ? "complete" : "missing";
  }
  if (input.step === "character") {
    if (!isStoryMacroReady(snapshot) || !snapshot.hasWorldSetupPrepared) return "blocked";
    return isCharacterReady(snapshot) ? "complete" : "missing";
  }
  if (input.step === "outline") {
    if (!isStoryMacroReady(snapshot) || !snapshot.hasWorldSetupPrepared || !isCharacterReady(snapshot)) return "blocked";
    return isOutlineReady(snapshot) ? "complete" : "missing";
  }
  if (input.step === "structured") {
    if (!isStoryMacroReady(snapshot) || !snapshot.hasWorldSetupPrepared || !isCharacterReady(snapshot) || !isOutlineReady(snapshot)) return "blocked";
    if (snapshot.hasUnpreparedChaptersInRange) return "partial";
    if (hasExecutableRange(input)) return "complete";
    if (isStructuredSyncPending(snapshot)) return "partial";
    if (isStructuredReady(snapshot)) return "partial";
    if (hasAnyStructuredAsset(snapshot)) return "partial";
    return "missing";
  }
  if (input.step === "chapter") {
    if (!hasExecutableRange(input)) return "blocked";
    if (input.activePipelineJob) return "partial";
    if (hasExecutableRange(input)) return "ready";
    return "missing";
  }
  if (
    !hasExecutableRange(input)
    && !hasPendingRepairContext(input)
    && (snapshot.approvedChapterCount ?? 0) <= 0
  ) {
    return "blocked";
  }
  if (input.activePipelineJob || hasPendingRepairContext(input)) return "ready";
  if ((snapshot.approvedChapterCount ?? 0) > 0) return "complete";
  return "missing";
}

function buildEntryReason(input: {
  step: DirectorTakeoverEntryStep;
  status: DirectorTakeoverEntryReadiness["status"];
  snapshot: DirectorTakeoverAssetSnapshot;
  latestCheckpoint?: DirectorTakeoverCheckpointSnapshot | null;
  activePipelineJob?: DirectorTakeoverPipelineJobSnapshot | null;
  executableRange?: DirectorTakeoverExecutableRangeSnapshot | null;
}): string {
  if (input.step === "basic") {
    return "Se dará prioridad a comprobar los activos existentes del proyecto actual, empezando por el primer paso que falta.";
  }
  if (input.step === "story_macro") {
    return input.status === "complete"
      ? "Story Macro y Book Contract están presentes y el modo de continuación avanzará automáticamente al siguiente paso que falta."
      : "La corriente se puede tomar a partir del macroplan de la historia.";
  }
  if (input.step === "world") {
    return input.status === "blocked"
      ? "Debe tener Story Macro y Book Contract antes de poder prepararse para tomar el control directamente desde la visión del mundo."
      : input.status === "complete"
        ? "Los recursos de la visión del mundo ahora están disponibles y el modo de continuación avanzará automáticamente al siguiente paso que falta."
        : "Ahora puedes continuar desde la preparación de la cosmovisión.";
  }
  if (input.step === "character") {
    return input.status === "blocked"
      ? "Necesitas tener la planificación general de la historia y los recursos de la visión del mundo antes de poder asumir directamente la preparación del personaje."
      : input.status === "complete"
        ? "Los recursos del personaje están disponibles y el modo de continuación avanzará automáticamente al siguiente paso que falta."
        : "Actualmente puedes continuar desde la preparación del personaje.";
  }
  if (input.step === "outline") {
    return input.status === "blocked"
      ? "Debes tener el plan general de la historia y los recursos de los personajes antes de poder asumir directamente la estrategia de volumen."
      : input.status === "complete"
        ? "El activo estratégico de volumen está disponible y el modo de continuación avanzará automáticamente al siguiente paso faltante."
        : "Actualmente puedes continuar desde la estrategia de volumen.";
  }
  if (input.step === "structured") {
    return input.status === "blocked"
      ? "Debe tener una estrategia de volumen antes de poder tomar el control directamente de los capítulos de ritmo/ruptura."
      : input.snapshot.hasUnpreparedChaptersInRange
        ? "Todavía hay capítulos dentro del rango objetivo que carecen de un refinamiento completo. El modo de continuación volverá al ritmo/dividirá los capítulos y los completará antes de continuar. Se conservará el texto redactado."
        : hasExecutableRange(input)
          ? "El tablero de ritmo de volumen actual, el refinamiento de capítulos y los recursos del área de ejecución ya están disponibles, y el modo de continuación se transferirá directamente a la ejecución de capítulos."
          : input.snapshot.structuredOutlineRecoveryStep === "chapter_sync"
          ? "El tablero de ritmo y el refinamiento de capítulos del volumen actual están disponibles, pero aún no se han sincronizado con el área de ejecución de capítulos. El modo Continuar completará la sincronización primero."
          : input.snapshot.structuredOutlineRecoveryStep === "chapter_detail_bundle"
            ? "El volumen actual ya tiene algunos recursos de refinamiento de capítulos, y el modo de continuación continuará desde el refinamiento de capítulos inacabados."
            : input.snapshot.firstVolumeBeatSheetReady
              ? "El volumen actual ya tiene un tablero de ritmo o una lista de capítulos, y el modo de continuación completará los pasos de división de capítulos restantes."
              : "Actualmente puedes continuar desde Rhythm/Chapter Break.";
  }
  if (input.step === "chapter") {
    if (!hasExecutableRange(input)) {
      return "Primero debe completar la sincronización de ritmo/capítulo y escribir los recursos del capítulo en el área de ejecución antes de poder tomar el control de la ejecución del capítulo.";
    }
    if (input.activePipelineJob) {
      return "Cuando se detecta un lote de capítulos activo, el modo continuar restaurará primero el lote actual.";
    }
    if (input.latestCheckpoint?.checkpointType === "chapter_batch_ready" || input.executableRange) {
      return "Cuando se detecta el rango de capítulos ejecutables, el modo de continuación se reanudará o continuará ejecutándose según el rango actual.";
    }
    return "Actualmente es posible ejecutar adquisiciones de capítulos.";
  }
  if (input.activePipelineJob) {
    return "Se detecta un lote de reparación de calidad activo y el modo continuar restaurará primero el lote actual.";
  }
  if (input.latestCheckpoint?.checkpointType === "chapter_batch_ready" || input.latestCheckpoint?.checkpointType === "replan_required") {
    return input.latestCheckpoint.checkpointType === "replan_required"
      ? "Cuando se detecta el punto de control de replanificación más reciente, el modo de continuación dará prioridad a la reanudación de la replanificación pendiente y los lotes posteriores."
      : "Cuando se detecta el último punto de control del lote de capítulos, el modo de continuación dará prioridad a la restauración de los capítulos que se van a revisar.";
  }
  return "Actualmente es posible sustituir una reparación de calidad.";
}

export function buildDirectorTakeoverReadiness(input: {
  novel: DirectorTakeoverNovelContext;
  snapshot: DirectorTakeoverAssetSnapshot;
  hasActiveTask: boolean;
  activeTaskId?: string | null;
  activePipelineJob?: DirectorTakeoverPipelineJobSnapshot | null;
  latestCheckpoint?: DirectorTakeoverCheckpointSnapshot | null;
  executableRange?: DirectorTakeoverExecutableRangeSnapshot | null;
}): DirectorTakeoverReadinessResponse {
  const recommendedPhase = resolveRecommendedTakeoverPhase(input.snapshot);
  const recommendedStep = phaseToEntryStep(recommendedPhase);
  const storyMacroReadiness = buildStoryMacroReadiness(input.novel);
  const worldSetupReadiness = buildWorldSetupReadiness(input.snapshot);
  const characterSetupReadiness = buildCharacterSetupReadiness(input.snapshot);
  const volumeStrategyReadiness = buildVolumeStrategyReadiness(input.snapshot);
  const structuredOutlineReadiness = buildStructuredOutlineReadiness(input.snapshot);

  const entrySteps: DirectorTakeoverEntryReadiness[] = DIRECTOR_TAKEOVER_ENTRY_STEPS.map((step) => {
    const status = buildEntryStepStatus({
      step,
      novel: input.novel,
      snapshot: input.snapshot,
      activePipelineJob: input.activePipelineJob,
      latestCheckpoint: input.latestCheckpoint,
      executableRange: input.executableRange,
    });
    const available = status !== "blocked";
    return {
      step,
      label: TAKEOVER_ENTRY_META[step].label,
      description: TAKEOVER_ENTRY_META[step].description,
      available,
      recommended: step === recommendedStep
        || (
          step === "chapter"
          && recommendedStep === "structured"
          && Boolean(input.executableRange)
          && !input.snapshot.hasUnpreparedChaptersInRange
        ),
      status,
      reason: buildEntryReason({
        step,
        status,
        snapshot: input.snapshot,
        activePipelineJob: input.activePipelineJob,
        latestCheckpoint: input.latestCheckpoint,
        executableRange: input.executableRange,
      }),
      previews: [
        buildPreviewOrFallback({
          entryStep: step,
          strategy: "continue_existing",
          snapshot: input.snapshot,
          activePipelineJob: input.activePipelineJob,
          latestCheckpoint: input.latestCheckpoint,
          executableRange: input.executableRange,
        }),
        buildPreviewOrFallback({
          entryStep: step,
          strategy: "restart_current_step",
          snapshot: input.snapshot,
          activePipelineJob: input.activePipelineJob,
          latestCheckpoint: input.latestCheckpoint,
          executableRange: input.executableRange,
        }),
      ],
    };
  });

  return {
    novelId: input.novel.id,
    novelTitle: input.novel.title.trim() || "Proyecto actual",
    hasActiveTask: input.hasActiveTask,
    activeTaskId: input.activeTaskId ?? null,
    snapshot: {
      ...input.snapshot,
    },
    stages: ([
      ["story_macro", storyMacroReadiness],
      ["world_setup", worldSetupReadiness],
      ["character_setup", characterSetupReadiness],
      ["volume_strategy", volumeStrategyReadiness],
      ["structured_outline", structuredOutlineReadiness],
    ] as const).map(([phase, readiness]) => ({
      phase,
      label: DIRECTOR_TAKEOVER_STAGE_META[phase].label,
      description: DIRECTOR_TAKEOVER_STAGE_META[phase].description,
      available: readiness.available,
      recommended: readiness.available && phase === recommendedPhase,
      reason: readiness.reason,
    })),
    entrySteps,
    activePipelineJob: input.activePipelineJob ?? null,
    latestCheckpoint: input.latestCheckpoint ?? null,
    executableRange: input.executableRange ?? null,
  };
}

export function assertDirectorTakeoverPhaseAvailable(
  readiness: DirectorTakeoverReadinessResponse,
  phase: DirectorTakeoverStartPhase,
): void {
  const targetStage = readiness.stages.find((item) => item.phase === phase);
  if (!targetStage) {
    throw new Error("La actual fase automática de toma de posesión del director no existe.");
  }
  if (!targetStage.available) {
    throw new Error(targetStage.reason || "El proyecto actual aún no es apto para la dirección automática desde esta etapa.");
  }
}

export function buildTakeoverBookSpec(input: {
  novel: DirectorTakeoverNovelContext;
  storyMacroPlan: StoryMacroPlan | null;
  bookContract: BookContract | null;
}): BookSpec {
  const candidate = buildTakeoverCandidate(input);
  const idea = buildTakeoverIdea(input.novel);
  return {
    storyInput: idea,
    positioning: candidate.positioning,
    sellingPoint: candidate.sellingPoint,
    coreConflict: candidate.coreConflict,
    protagonistPath: candidate.protagonistPath,
    endingDirection: candidate.endingDirection,
    hookStrategy: candidate.hookStrategy,
    progressionLoop: candidate.progressionLoop,
    targetChapterCount: candidate.targetChapterCount,
  };
}
