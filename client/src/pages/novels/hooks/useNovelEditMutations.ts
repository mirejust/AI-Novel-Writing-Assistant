import { useMutation, type QueryClient } from "@tanstack/react-query";
import type { Chapter, PipelineRepairMode, PipelineRunMode, VolumePlanDocument } from "@ai-novel/shared/types/novel";
import type { LLMProvider } from "@ai-novel/shared/types/llm";
import {
  createNovelChapter,
  deleteNovelChapter,
  generateChapterHook,
  optimizeNovelOutlinePreview,
  optimizeNovelStructuredOutlinePreview,
  reviewNovelChapter,
  runNovelPipeline,
  updateNovel,
  syncNovelVolumeChapters,
  updateNovelVolumes,
  recommendNovelWritingPlatform,
  updateNovelWritingPlatform,
} from "@/api/novel";
import { queryKeys } from "@/api/queryKeys";
import { buildNovelUpdatePayload, type NovelBasicFormState } from "../novelBasicInfo.shared";
import type { ChapterReviewResult } from "../chapterPlanning.shared";
import type { StructuredSyncOptions } from "../novelEdit.utils";
import { syncNovelWorkflowStageSilently } from "../novelWorkflow.client";

interface LlmSettings {
  provider?: LLMProvider;
  model?: string;
  temperature?: number;
}

interface PipelineFormState {
  startOrder: number;
  endOrder: number;
  maxRetries: number;
  runMode: PipelineRunMode;
  autoReview: boolean;
  autoRepair: boolean;
  skipCompleted: boolean;
  qualityThreshold: number;
  repairMode: PipelineRepairMode;
}

interface UseNovelEditMutationsArgs {
  id: string;
  basicForm: NovelBasicFormState;
  hasCharacters: boolean;
  outlineText: string;
  outlineOptimizeInstruction: string;
  setOutlineOptimizePreview: (value: string) => void;
  setOutlineOptimizeMode: (value: "full" | "selection") => void;
  setOutlineOptimizeSourceText: (value: string) => void;
  structuredDraftText: string;
  structuredOptimizeInstruction: string;
  setStructuredOptimizePreview: (value: string) => void;
  setStructuredOptimizeMode: (value: "full" | "selection") => void;
  setStructuredOptimizeSourceText: (value: string) => void;
  volumeDocument: VolumePlanDocument;
  llm: LlmSettings;
  pipelineForm: PipelineFormState;
  selectedChapterId: string;
  chapterCount: number;
  chapters: Chapter[];
  setActiveTab: (value: string) => void;
  setSelectedChapterId: (value: string) => void;
  setCurrentJobId: (value: string) => void;
  setPipelineMessage: (value: string) => void;
  setStructuredMessage: (value: string) => void;
  setReviewResult: (value: ChapterReviewResult | null) => void;
  queryClient: QueryClient;
  invalidateNovelDetail: () => Promise<void>;
}

export function useNovelEditMutations({
  id,
  basicForm,
  hasCharacters,
  outlineText,
  outlineOptimizeInstruction,
  setOutlineOptimizePreview,
  setOutlineOptimizeMode,
  setOutlineOptimizeSourceText,
  structuredDraftText,
  structuredOptimizeInstruction,
  setStructuredOptimizePreview,
  setStructuredOptimizeMode,
  setStructuredOptimizeSourceText,
  volumeDocument,
  llm,
  pipelineForm,
  selectedChapterId,
  chapterCount,
  chapters,
  setActiveTab,
  setSelectedChapterId,
  setCurrentJobId,
  setPipelineMessage,
  setStructuredMessage,
  setReviewResult,
  queryClient,
  invalidateNovelDetail,
}: UseNovelEditMutationsArgs) {
  const saveBasicMutation = useMutation({
    mutationFn: async () => {
      const updated = await updateNovel(id, buildNovelUpdatePayload(basicForm));
      const platform = basicForm.writingPlatformPreference === "ai_recommend"
        ? (await recommendNovelWritingPlatform(id)).data?.platform
        : basicForm.writingPlatformPreference;
      if (!platform) throw new Error("AI no devolvió sugerencias de plataformas utilizables. Inténtelo de nuevo.");
      await updateNovelWritingPlatform(id, platform);
      return updated;
    },
    onSuccess: async () => {
      await syncNovelWorkflowStageSilently({
        novelId: id,
        stage: "project_setup",
        itemLabel: "Configuración del proyecto guardada",
        status: "waiting_approval",
      });
      await invalidateNovelDetail();
      if (!hasCharacters) {
        setActiveTab("character");
      }
    },
  });

  const saveOutlineMutation = useMutation({
    mutationFn: () => updateNovelVolumes(id, volumeDocument),
    onSuccess: async () => {
      await syncNovelWorkflowStageSilently({
        novelId: id,
        stage: "volume_strategy",
        itemLabel: "Estrategia de volumen/esqueleto de volumen guardado",
        checkpointType: "volume_strategy_ready",
        checkpointSummary: "La estrategia de volumen actual y el esqueleto de volumen se guardan en el espacio de trabajo.",
        status: "waiting_approval",
      });
      await invalidateNovelDetail();
    },
  });

  const saveStructuredMutation = useMutation({
    mutationFn: () => updateNovelVolumes(id, {
      ...volumeDocument,
      syncToChapterExecution: true,
    }),
    onSuccess: async () => {
      setStructuredMessage("Los capítulos de división de ritmo se han guardado y el área de ejecución del capítulo utilizará directamente el mismo lote de capítulos.");
      await syncNovelWorkflowStageSilently({
        novelId: id,
        stage: "structured_outline",
        itemLabel: "Ruptura de ritmo/capítulo guardado",
        status: "waiting_approval",
      });
      await invalidateNovelDetail();
    },
  });

  const optimizeOutlineMutation = useMutation({
    mutationFn: (payload: { mode: "full" | "selection"; selectedText?: string }) =>
      optimizeNovelOutlinePreview(id, {
        currentDraft: outlineText,
        instruction: outlineOptimizeInstruction,
        mode: payload.mode,
        selectedText: payload.selectedText,
        provider: llm.provider,
        model: llm.model,
        temperature: llm.temperature,
      }),
    onSuccess: (response) => {
      setOutlineOptimizePreview(response.data?.optimizedDraft ?? "");
      setOutlineOptimizeMode(response.data?.mode ?? "full");
      setOutlineOptimizeSourceText(response.data?.selectedText ?? "");
    },
  });

  const optimizeStructuredMutation = useMutation({
    mutationFn: (payload: { mode: "full" | "selection"; selectedText?: string }) =>
      optimizeNovelStructuredOutlinePreview(id, {
        currentDraft: structuredDraftText,
        instruction: structuredOptimizeInstruction,
        mode: payload.mode,
        selectedText: payload.selectedText,
        provider: llm.provider,
        model: llm.model,
        temperature: llm.temperature,
      }),
    onSuccess: (response) => {
      setStructuredOptimizePreview(response.data?.optimizedDraft ?? "");
      setStructuredOptimizeMode(response.data?.mode ?? "full");
      setStructuredOptimizeSourceText(response.data?.selectedText ?? "");
    },
  });

  const syncStructuredChaptersMutation = useMutation({
    mutationFn: (options: StructuredSyncOptions) => syncNovelVolumeChapters(id, {
      volumes: volumeDocument.volumes,
      preserveContent: options.preserveContent,
      applyDeletes: options.applyDeletes,
    }),
    onSuccess: async (response) => {
      const preview = response.data;
      setStructuredMessage(
        `Reparación de conexión completada: Nuevo ${preview?.createCount ?? 0},renovar ${preview?.updateCount ?? 0},borrar ${preview?.deleteCount ?? 0}.`,
      );
      await syncNovelWorkflowStageSilently({
        novelId: id,
        stage: "structured_outline",
        itemLabel: "La división de capítulos a nivel de volumen está conectada a la ejecución del capítulo",
        checkpointType: "chapter_batch_ready",
        checkpointSummary: "La lista de capítulos, la lista de tareas y la entrada de ejecución están listas y puede continuar ingresando a la ejecución del capítulo.",
        status: "waiting_approval",
      });
      await invalidateNovelDetail();
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : "La sincronización del capítulo falló.";
      setStructuredMessage(message);
    },
  });

  const createChapterMutation = useMutation({
    mutationFn: () =>
      createNovelChapter(id, {
        title: `New Chapter ${chapterCount + 1}`,
        order: chapterCount + 1,
        content: "",
      }),
    onSuccess: async (response) => {
      if (response.data?.id) {
        setSelectedChapterId(response.data.id);
      }
      await syncNovelWorkflowStageSilently({
        novelId: id,
        stage: "chapter_execution",
        itemLabel: "Nuevo elemento de ejecución de capítulo creado",
        chapterId: response.data?.id,
        status: "waiting_approval",
      });
      await invalidateNovelDetail();
    },
  });

  const deleteManualChapterMutation = useMutation({
    mutationFn: (chapterId: string) => deleteNovelChapter(id, chapterId),
    onSuccess: async (_response, chapterId) => {
      const deletedIndex = chapters.findIndex((chapter) => chapter.id === chapterId);
      const fallbackChapter = chapters[deletedIndex + 1] ?? chapters[deletedIndex - 1] ?? null;
      if (selectedChapterId === chapterId) {
        setSelectedChapterId(fallbackChapter?.id ?? "");
      }
      setPipelineMessage("Se han eliminado los capítulos en blanco no iniciados.");
      await invalidateNovelDetail();
    },
    onError: (error) => {
      setPipelineMessage(error instanceof Error ? error.message : "No se pudo eliminar el capítulo, inténtelo nuevamente más tarde.");
    },
  });

  const runPipelineMutation = useMutation({
    mutationFn: (override?: Partial<PipelineFormState>) =>
      runNovelPipeline(id, {
        startOrder: override?.startOrder ?? pipelineForm.startOrder,
        endOrder: override?.endOrder ?? pipelineForm.endOrder,
        maxRetries: override?.maxRetries ?? pipelineForm.maxRetries,
        runMode: override?.runMode ?? pipelineForm.runMode,
        autoReview: override?.autoReview ?? pipelineForm.autoReview,
        autoRepair: override?.autoRepair ?? pipelineForm.autoRepair,
        skipCompleted: override?.skipCompleted ?? pipelineForm.skipCompleted,
        qualityThreshold: override?.qualityThreshold ?? pipelineForm.qualityThreshold,
        repairMode: override?.repairMode ?? pipelineForm.repairMode,
        provider: llm.provider,
        model: llm.model,
        temperature: llm.temperature,
      }),
    onSuccess: async (response) => {
      if (response.data?.id) {
        setCurrentJobId(response.data.id);
      }
      setPipelineMessage(response.message ?? "Pipeline started.");
      await syncNovelWorkflowStageSilently({
        novelId: id,
        stage: "quality_repair",
        itemLabel: "La canalización del capítulo se está ejecutando",
        status: "running",
      });
      await queryClient.invalidateQueries({ queryKey: queryKeys.novels.pipelineJob(id, response.data?.id ?? "none") });
    },
  });

  const reviewMutation = useMutation({
    mutationFn: () =>
      reviewNovelChapter(id, selectedChapterId, {
        provider: llm.provider,
        model: llm.model,
        temperature: 0.1,
      }),
    onSuccess: async (response) => {
      setReviewResult(response.data ?? null);
      setPipelineMessage("Chapter reviewed.");
      await syncNovelWorkflowStageSilently({
        novelId: id,
        stage: "quality_repair",
        itemLabel: "Revisión del capítulo completada",
        status: "waiting_approval",
      });
      await queryClient.invalidateQueries({ queryKey: queryKeys.novels.qualityReport(id) });
    },
  });

  const hookMutation = useMutation({
    mutationFn: () =>
      generateChapterHook(id, {
        chapterId: selectedChapterId || undefined,
        provider: llm.provider,
        model: llm.model,
        temperature: llm.temperature,
      }),
    onSuccess: async () => {
      setPipelineMessage("Chapter hook generated.");
      await syncNovelWorkflowStageSilently({
        novelId: id,
        stage: "chapter_execution",
        itemLabel: "Se ha generado el gancho del capítulo.",
        chapterId: selectedChapterId || undefined,
        status: "waiting_approval",
      });
      await invalidateNovelDetail();
    },
  });

  return {
    saveBasicMutation,
    saveOutlineMutation,
    saveStructuredMutation,
    optimizeOutlineMutation,
    optimizeStructuredMutation,
    syncStructuredChaptersMutation,
    createChapterMutation,
    deleteManualChapterMutation,
    runPipelineMutation,
    reviewMutation,
    hookMutation,
  };
}
