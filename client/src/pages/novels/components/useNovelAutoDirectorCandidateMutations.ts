import { useEffect, useRef, type Dispatch, type SetStateAction } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  type DirectorCandidate,
  type DirectorCandidateBatch,
  type DirectorCorrectionPreset,
  mergeDirectorCandidateBatches,
} from "@ai-novel/shared/types/novelDirector";
import {
  generateDirectorCandidates,
  getDirectorCommandResult,
  refineDirectorCandidateTitles,
  refineDirectorCandidates,
} from "@/api/novelDirector";
import { waitForCandidateResult } from "../autoDirector/domain/waitForCandidateResult";
import { toast } from "@/components/ui/toast";
import type { buildAutoDirectorRequestPayload } from "./NovelAutoDirectorDialog.shared";
import type { DirectorExecutionViewMode } from "./NovelAutoDirector.types";

type DirectorRequestPayload = ReturnType<typeof buildAutoDirectorRequestPayload>;

interface UseNovelAutoDirectorCandidateMutationsInput {
  batches: DirectorCandidateBatch[];
  selectedPresets: DirectorCorrectionPreset[];
  feedback: string;
  workflowTaskId: string;
  pausePolling: boolean;
  ensureWorkflowTask: () => Promise<string>;
  buildRequestPayload: (workflowTaskId: string) => DirectorRequestPayload;
  applyUpdatedBatch: (batch: DirectorCandidateBatch, nextWorkflowTaskId?: string) => void;
  onWorkflowTaskChange?: (workflowTaskId: string) => void;
  setWorkflowTaskId: Dispatch<SetStateAction<string>>;
  setBatches: Dispatch<SetStateAction<DirectorCandidateBatch[]>>;
  setFeedback: Dispatch<SetStateAction<string>>;
  setSelectedPresets: Dispatch<SetStateAction<DirectorCorrectionPreset[]>>;
  setTitlePatchFeedbacks: Dispatch<SetStateAction<Record<string, string>>>;
  setDialogMode: Dispatch<SetStateAction<DirectorExecutionViewMode>>;
  setCandidateDialogOpen: Dispatch<SetStateAction<boolean>>;
  setExecutionRequested: Dispatch<SetStateAction<boolean>>;
  setExecutionError: Dispatch<SetStateAction<string>>;
}

export function useNovelAutoDirectorCandidateMutations({
  batches,
  selectedPresets,
  feedback,
  workflowTaskId,
  pausePolling,
  ensureWorkflowTask,
  buildRequestPayload,
  applyUpdatedBatch,
  onWorkflowTaskChange,
  setWorkflowTaskId,
  setBatches,
  setFeedback,
  setSelectedPresets,
  setTitlePatchFeedbacks,
  setDialogMode,
  setCandidateDialogOpen,
  setExecutionRequested,
  setExecutionError,
}: UseNovelAutoDirectorCandidateMutationsInput) {
  const polling = useRef<AbortController | null>(null);
  useEffect(() => () => polling.current?.abort(), []);
  useEffect(() => {
    if (pausePolling) polling.current?.abort();
  }, [pausePolling]);

  const beginPolling = () => {
    polling.current?.abort();
    polling.current = new AbortController();
    return polling.current.signal;
  };
  const onCandidateCommandStart = () => {
    setCandidateDialogOpen(false);
    setDialogMode("execution_progress");
    setExecutionError("");
  };

  const generateMutation = useMutation({
    onMutate: onCandidateCommandStart,
    mutationFn: async () => {
      const signal = beginPolling();
      const currentWorkflowTaskId = await ensureWorkflowTask();
      const payload = buildRequestPayload(currentWorkflowTaskId);
      const response = batches.length === 0
        ? await generateDirectorCandidates(payload)
        : await refineDirectorCandidates({
          ...payload,
          previousBatches: batches,
          presets: selectedPresets,
          feedback: feedback.trim() || undefined,
        });
      const command = response.data;
      if (!command?.commandId) {
        throw new Error("Director candidate command was not accepted.");
      }
      if (command.taskId && command.taskId !== currentWorkflowTaskId) {
        setWorkflowTaskId(command.taskId);
        onWorkflowTaskChange?.(command.taskId);
      }
      const result = await waitForCandidateResult(
        () => getDirectorCommandResult<{ batch: DirectorCandidateBatch; workflowTaskId?: string }>(command.commandId, signal), signal,
      );
      return {
        batch: result.batch ?? null,
        workflowTaskId: result.workflowTaskId ?? command.taskId ?? currentWorkflowTaskId,
      };
    },
    onSuccess: ({ batch, workflowTaskId: nextWorkflowTaskId }) => {
      if (!batch) {
        toast.error("Auto Director no devolvió opciones disponibles.");
        return;
      }
      if (nextWorkflowTaskId && nextWorkflowTaskId !== workflowTaskId) {
        setWorkflowTaskId(nextWorkflowTaskId);
        onWorkflowTaskChange?.(nextWorkflowTaskId);
      }
      setBatches((prev) => mergeDirectorCandidateBatches(prev, [batch]));
      setFeedback("");
      setSelectedPresets([]);
      setDialogMode("candidate_selection");
      setCandidateDialogOpen(true);
      setExecutionRequested(false);
      setExecutionError("");
      toast.success(`${batch.roundLabel} Generado ${batch.candidates.length} conjunto de planos.`);
    },
    onError: (error) => {
      if (error.name === "AbortError") return;
      setDialogMode("execution_failed");
      setExecutionError(error instanceof Error ? error.message : "La generación de candidatos a director fracasó.");
    },
  });

  const refineTitleMutation = useMutation({
    onMutate: onCandidateCommandStart,
    mutationFn: async (payload: { batchId: string; candidate: DirectorCandidate; feedback: string }) => {
      const signal = beginPolling();
      const currentWorkflowTaskId = await ensureWorkflowTask();
      const response = await refineDirectorCandidateTitles({
        ...buildRequestPayload(currentWorkflowTaskId),
        previousBatches: batches,
        batchId: payload.batchId,
        candidateId: payload.candidate.id,
        feedback: payload.feedback.trim(),
      });
      const command = response.data;
      if (!command?.commandId) {
        throw new Error("Director title refinement command was not accepted.");
      }
      const result = await waitForCandidateResult(
        () => getDirectorCommandResult<{ batch: DirectorCandidateBatch; candidate: DirectorCandidate; workflowTaskId?: string }>(command.commandId, signal), signal,
      );
      return {
        batch: result.batch ?? null,
        workflowTaskId: result.workflowTaskId ?? command.taskId ?? currentWorkflowTaskId,
        candidateId: payload.candidate.id,
      };
    },
    onSuccess: ({ batch, workflowTaskId: nextWorkflowTaskId, candidateId }) => {
      if (!batch) {
        toast.error("La modificación del grupo de títulos falló y no se devolvió el grupo de títulos actualizado.");
        return;
      }
      applyUpdatedBatch(batch, nextWorkflowTaskId);
      setTitlePatchFeedbacks((prev) => ({ ...prev, [candidateId]: "" }));
      setDialogMode("candidate_selection");
      setCandidateDialogOpen(true);
      toast.success("Se ha rehecho el grupo de títulos de este esquema.");
    },
    onError: (error) => {
      if (error.name === "AbortError") return;
      setDialogMode("execution_failed");
      setExecutionError(error instanceof Error ? error.message : "Error en la corrección del grupo de títulos.");
    },
  });

  return {
    generateMutation,
    refineTitleMutation,
  };
}
