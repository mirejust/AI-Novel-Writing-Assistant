import { useState } from "react";
import { useMutation, type QueryClient } from "@tanstack/react-query";
import type { ReviewIssue, Chapter, StoryStateSnapshot, StoryPlan } from "@ai-novel/shared/types/novel";
import type { LLMProvider } from "@ai-novel/shared/types/llm";
import { generateChapterPlan, replanNovel, reviewNovelChapter } from "@/api/novel";
import { queryKeys } from "@/api/queryKeys";
import type { ChapterExecutionStrategy } from "../chapterExecution.utils";
import type { ChapterReviewResult } from "../chapterPlanning.shared";
import { useChapterExecutionActions } from "./useChapterExecutionActions";

interface StreamHandle {
  start: (path: string, payload: Record<string, unknown>) => Promise<void> | void;
  abort: () => void;
  isStreaming: boolean;
  content: string;
}

interface UseNovelEditChapterRuntimeArgs {
  novelId: string;
  llm: {
    provider?: LLMProvider;
    model?: string;
    temperature?: number;
  };
  selectedChapterId: string;
  selectedChapter?: Chapter;
  chapterStrategy: ChapterExecutionStrategy;
  reviewResult: ChapterReviewResult | null;
  openAuditIssueIds: string[];
  queryClient: QueryClient;
  invalidateNovelDetail: () => Promise<void>;
  setChapterOperationMessage: (value: string) => void;
  setReviewResult: (value: ChapterReviewResult | null) => void;
  setRepairBeforeContent: (value: string) => void;
  setRepairAfterContent: (value: string) => void;
  setActiveChapterStream: (value: { chapterId: string; chapterLabel: string } | null) => void;
  setActiveRepairStream: (value: { chapterId: string; chapterLabel: string } | null) => void;
  chapterSSE: StreamHandle;
  repairSSE: StreamHandle;
}

export type ChapterReviewActionKind =
  | "full_audit"
  | "continuity"
  | "character_consistency"
  | "pacing"
  | null;

export function useNovelEditChapterRuntime({
  novelId,
  llm,
  selectedChapterId,
  selectedChapter,
  chapterStrategy,
  reviewResult,
  openAuditIssueIds,
  queryClient,
  invalidateNovelDetail,
  setChapterOperationMessage,
  setReviewResult,
  setRepairBeforeContent,
  setRepairAfterContent,
  setActiveChapterStream,
  setActiveRepairStream,
  chapterSSE,
  repairSSE,
}: UseNovelEditChapterRuntimeArgs) {
  const [reviewActionKind, setReviewActionKind] = useState<ChapterReviewActionKind>(null);

  const generateChapterPlanMutation = useMutation({
    mutationFn: () => generateChapterPlan(novelId, selectedChapterId, {
      provider: llm.provider,
      model: llm.model,
      temperature: llm.temperature,
    }),
    onSuccess: async () => {
      setChapterOperationMessage("Se ha generado el plan de ejecución del capítulo y puede comenzar a escribir este capítulo directamente.");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.novels.chapterPlan(novelId, selectedChapterId) }),
        invalidateNovelDetail(),
      ]);
    },
  });

  const replanChapterMutation = useMutation({
    mutationFn: () => replanNovel(novelId, {
      chapterId: selectedChapterId,
      reason: "manual_replan_from_chapter_tab",
      triggerType: "manual",
      sourceIssueIds: openAuditIssueIds,
      windowSize: 3,
      provider: llm.provider,
      model: llm.model,
      temperature: llm.temperature,
    }),
    onSuccess: async (response) => {
      const affectedOrders = response.data?.affectedChapterOrders ?? [];
      const affectedChapterIds = response.data?.affectedChapterIds ?? [];
      setChapterOperationMessage(
        affectedOrders.length > 0
          ? `Replanificado ${affectedOrders.join(",")} capítulo.`
          : "El capítulo ha sido replanificado.",
      );
      await queryClient.invalidateQueries({ queryKey: queryKeys.novels.detail(novelId) });
      await queryClient.invalidateQueries({ queryKey: queryKeys.novels.qualityReport(novelId) });
      await Promise.all(
        affectedChapterIds.map((chapterId) =>
          queryClient.invalidateQueries({ queryKey: queryKeys.novels.chapterPlan(novelId, chapterId) })),
      );
      if (selectedChapterId) {
        await queryClient.invalidateQueries({ queryKey: queryKeys.novels.chapterPlan(novelId, selectedChapterId) });
      }
    },
  });

  const fullAuditMutation = useMutation({
    mutationFn: () => reviewNovelChapter(novelId, selectedChapterId, {
      provider: llm.provider,
      model: llm.model,
      temperature: 0.1,
    }),
    onSuccess: async (response) => {
      setReviewResult(response.data ?? null);
      setChapterOperationMessage("Revisión completa completada.");
      await Promise.all([
        invalidateNovelDetail(),
        queryClient.invalidateQueries({ queryKey: queryKeys.novels.simpleShelf(novelId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.novels.chapterEditorWorkspace(novelId, selectedChapterId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.novels.chapterAuditReports(novelId, selectedChapterId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.novels.qualityReport(novelId) }),
      ]);
    },
    onSettled: () => {
      setReviewActionKind(null);
    },
  });

  const runChapterReview = (kind: Exclude<ChapterReviewActionKind, null>) => {
    setReviewActionKind(kind);
    fullAuditMutation.mutate();
  };

  const handleGenerateSelectedChapter = () => {
    if (!selectedChapter) {
      return;
    }
    setChapterOperationMessage("Generando el texto de este capítulo...");
    setActiveChapterStream({
      chapterId: selectedChapter.id,
      chapterLabel: `Cap.${selectedChapter.order}capitulo ${selectedChapter.title || "Capítulo sin título"}`,
    });
    void chapterSSE.start(`/novels/${novelId}/chapters/${selectedChapter.id}/generate`, {
      provider: llm.provider,
      model: llm.model,
      previousChaptersSummary: [],
    });
  };

  const handleAbortChapterStream = () => {
    chapterSSE.abort();
    setChapterOperationMessage("La generación de capítulos actual se ha detenido. Puede conservar el resultado actual y continuar viéndolo, o reiniciar la escritura de este capítulo.");
  };

  const handleAbortRepair = () => {
    repairSSE.abort();
    setActiveRepairStream(null);
    setChapterOperationMessage("La reparación del capítulo actual se ha detenido. Puede comprobar los resultados de la reparación actual antes de decidir si desea continuar.");
  };

  const startChapterRepair = (issues: ReviewIssue[]) => {
    if (!selectedChapterId) {
      setChapterOperationMessage("Por favor seleccione un capítulo primero.");
      return;
    }
    setChapterOperationMessage("Generando borrador de reparación...");
    setRepairBeforeContent(selectedChapter?.content ?? "");
    setRepairAfterContent("");
    setActiveRepairStream({
      chapterId: selectedChapterId,
      chapterLabel: selectedChapter ? `Cap.${selectedChapter.order}capitulo ${selectedChapter.title || "Capítulo sin título"}` : "Capítulo actual",
    });
    void repairSSE.start(`/novels/${novelId}/chapters/${selectedChapterId}/repair`, {
      provider: llm.provider,
      model: llm.model,
      reviewIssues: issues,
      auditIssueIds: openAuditIssueIds,
    });
  };

  const chapterExecutionActions = useChapterExecutionActions({
    novelId,
    selectedChapterId,
    selectedChapter,
    strategy: chapterStrategy,
    reviewIssues: reviewResult?.issues ?? [],
    onGenerateChapter: handleGenerateSelectedChapter,
    onReviewChapter: runChapterReview,
    onStartRepair: startChapterRepair,
    onMessage: setChapterOperationMessage,
    isGeneratingChapter: chapterSSE.isStreaming,
    isRepairingChapter: repairSSE.isStreaming,
    invalidateNovelDetail,
  });

  return {
    generateChapterPlanMutation,
    replanChapterMutation,
    fullAuditMutation,
    reviewActionKind,
    runChapterReview,
    handleGenerateSelectedChapter,
    handleAbortChapterStream,
    handleAbortRepair,
    startChapterRepair,
    chapterExecutionActions,
  };
}
