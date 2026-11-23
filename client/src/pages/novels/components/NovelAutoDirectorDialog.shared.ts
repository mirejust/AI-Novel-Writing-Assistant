import type { LLMProvider } from "@ai-novel/shared/types/llm";
import { normalizeCommercialTags } from "@ai-novel/shared/types/novelFraming";
import type { DirectorRunMode, DirectorWorldSetupMode } from "@ai-novel/shared/types/novelDirector";
import { authorEstimatedChapterCount, type NovelBasicFormState } from "../novelBasicInfo.shared.ts";

export interface DirectorRunModeOption {
  value: DirectorRunMode;
  label: string;
  description: string;
  recommended?: boolean;
  recommendation?: string;
}

export const RUN_MODE_OPTIONS: DirectorRunModeOption[] = [
  {
    value: "stage_review",
    label: "Confirmar paso a paso",
    description: "Discuta los resultados de cada etapa con la IA y confírmelo antes de continuar.",
  },
  {
    value: "auto_to_ready",
    label: "Primero, complete la preparación del director.",
    description: "La IA preparará la planificación a nivel de libro, los personajes, la disposición de los capítulos y los recursos de ejecución de los capítulos, y luego podrá elegir entre producción simple o producción profesional.",
    recommended: true,
    recommendation: "El texto no se generará de antemano y la decisión sobre cómo producir el libro completo se tomará una vez que se complete la preparación.",
  },
];

export const DEFAULT_VISIBLE_RUN_MODE: DirectorRunMode = "auto_to_ready";

export interface AutoDirectorRequestLlmOptions {
  provider: LLMProvider;
  model: string;
  temperature?: number;
}

export function buildInitialIdea(basicForm: NovelBasicFormState): string {
  const lines = [
    basicForm.description.trim(),
    basicForm.title.trim() ? `Quiero escribir un libro titulado provisionalmente "${basicForm.title.trim()}" novedoso.` : "",
    basicForm.styleTone.trim() ? `Es de esperar que el estilo de escritura sea parcial. ${basicForm.styleTone.trim()}.` : "",
  ].filter(Boolean);
  return lines.join("\n");
}

export function buildAutoDirectorRequestPayload(
  basicForm: NovelBasicFormState,
  idea: string,
  llm: AutoDirectorRequestLlmOptions,
  runMode: DirectorRunMode,
  workflowTaskId?: string,
  options?: {
    styleProfileId?: string;
    worldSetupMode?: DirectorWorldSetupMode;
    marketBriefId?: string;
  },
) {
  const commercialTags = normalizeCommercialTags(basicForm.commercialTagsText);
  return {
    idea: idea.trim(),
    workflowTaskId: workflowTaskId || undefined,
    marketBriefId: options?.marketBriefId?.trim() || undefined,
    title: basicForm.title.trim() || undefined,
    description: basicForm.description.trim() || undefined,
    targetAudience: basicForm.targetAudience.trim() || undefined,
    bookSellingPoint: basicForm.bookSellingPoint.trim() || undefined,
    competingFeel: basicForm.competingFeel.trim() || undefined,
    first30ChapterPromise: basicForm.first30ChapterPromise.trim() || undefined,
    commercialTags: commercialTags.length > 0 ? commercialTags : undefined,
    genreId: basicForm.genreId || undefined,
    primaryStoryModeId: basicForm.primaryStoryModeId || undefined,
    secondaryStoryModeId: basicForm.secondaryStoryModeId || undefined,
    worldId: basicForm.worldId || undefined,
    worldSetupMode: basicForm.worldId ? undefined : options?.worldSetupMode ?? "auto_generate",
    writingMode: basicForm.writingMode,
    projectMode: basicForm.projectMode,
    readerChannelPreference: basicForm.readerChannelPreference,
    powerSystemPreference: basicForm.powerSystemPreference,
    writingPlatformPreference: basicForm.writingPlatformPreference,
    narrativePov: basicForm.narrativePov,
    pacePreference: basicForm.pacePreference,
    styleTone: basicForm.styleTone.trim() || undefined,
    styleProfileId: options?.styleProfileId?.trim() || undefined,
    emotionIntensity: basicForm.emotionIntensity,
    aiFreedom: basicForm.aiFreedom,
    postGenerationStyleReviewEnabled: basicForm.postGenerationStyleReviewEnabled,
    defaultChapterLength: basicForm.defaultChapterLength,
    userPreferredVolumeCount: basicForm.userPreferredVolumeCount,
    estimatedChapterCount: authorEstimatedChapterCount(basicForm),
    projectStatus: basicForm.projectStatus,
    storylineStatus: basicForm.storylineStatus,
    outlineStatus: basicForm.outlineStatus,
    resourceReadyScore: basicForm.resourceReadyScore,
    sourceNovelId: basicForm.sourceNovelId || undefined,
    sourceKnowledgeDocumentId: basicForm.sourceKnowledgeDocumentId || undefined,
    continuationBookAnalysisId: basicForm.continuationBookAnalysisId || undefined,
    continuationBookAnalysisSections: basicForm.continuationBookAnalysisSections.length > 0
      ? basicForm.continuationBookAnalysisSections
      : undefined,
    referenceBookAnalysisId: basicForm.referenceBookAnalysisId || undefined,
    referenceBookAnalysisSections: basicForm.referenceBookAnalysisSections.length > 0
      ? basicForm.referenceBookAnalysisSections
      : undefined,
    provider: llm.provider,
    model: llm.model,
    temperature: llm.temperature,
    runMode,
  };
}
