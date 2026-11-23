import {
  Component,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ErrorInfo,
  type ReactNode,
} from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import type { UnifiedTaskDetail } from "@ai-novel/shared/types/task";
import { useIsMutating, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { flattenGenreTreeOptions, getGenreTree } from "@/api/genre";
import { flattenStoryModeTreeOptions, getStoryModeTree } from "@/api/storyMode";
import { bootstrapNovelWorkflow } from "@/api/novelWorkflow";
import { getTaskDetail } from "@/api/tasks";
import { setNovelCreationExperience } from "@/api/novel";
import { queryKeys } from "@/api/queryKeys";
import { getWorldList } from "@/api/world";
import { getMarketCreativeBrief } from "@/api/marketRadar";
import { createStyleProfileFromBookAnalysis, getStyleProfiles } from "@/api/styleEngine";
import { generateCreativeCarryoverContract } from "@/api/creativeCarryoverContract";
import { Button } from "@/components/ui/button";
import { AppDialogContent, Dialog, DialogClose, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "@/components/ui/toast";
import { stripLegacyTaskUrlParams } from "@/lib/legacyTaskUrlParams";
import { buildCandidateTaskHref, readCandidateTaskId } from "@/lib/novelRoutes";
import { getCandidateTaskNovelHref, isProductionExperienceChoicePending } from "@/lib/novelRoutes";
import { useLLMStore } from "@/store/llmStore";
import type { CreativeCarryoverContract } from "@ai-novel/shared/types/creativeCarryoverContract";
import {
  buildOpeningIdeaFromCarryoverContract,
  matchesCreativeCarryoverSource,
} from "@ai-novel/shared/types/creativeCarryoverContract";
import ReferenceNovelStartDialog from "../components/ReferenceNovelStartDialog";
import CreativeCarryoverContractPanel, {
  type CreativeCarryoverPanelState,
} from "./CreativeCarryoverContractPanel";
import {
  createDefaultNovelBasicFormState,
  patchNovelBasicForm,
  type NovelBasicFormState,
} from "../novelBasicInfo.shared";
import StageBasicSetup from "./StageBasicSetup";
import StageCandidates from "./StageCandidates";
import { CandidateReviewWorkspace } from "./candidateReview/CandidateReviewWorkspace";
import { candidateAnchor } from "./candidateReview/candidateScope";
import { useCandidateSelection } from "./candidateReview/useCandidateSelection";
import StageIdea from "./StageIdea";
import StageModelRun from "./StageModelRun";
import StageSummaryCard from "./StageSummaryCard";
import StageWorldStyle from "./StageWorldStyle";
import {
  fillMissingCreationFoundation,
  fillMissingMarketCreativeFraming,
  resolveMarketOpeningIdea,
} from "./creationFoundationPickerState";
import {
  AUTO_DIRECTOR_CREATE_STAGES,
  type AutoDirectorCreateStageKey,
  summarizeBasicStage,
  summarizeIdea,
  summarizeModelRunStage,
  summarizeWorldStyleStage,
} from "./directorCreateStages";
import {
  buildAutoDirectorCreateDraftScope,
  clearAutoDirectorCreateDraft,
  loadAutoDirectorCreateDraft,
  saveAutoDirectorCreateDraft,
} from "./draft/autoDirectorCreateDraft";
import { useAutoDirectorCreateController } from "./useAutoDirectorCreateController";

const STAGE_ORDER: AutoDirectorCreateStageKey[] = ["idea", "basic", "world_style", "model_run", "candidates"];
const ALL_BOOK_ANALYSIS_SECTIONS = [
  "overview",
  "plot_structure",
  "timeline",
  "character_system",
  "worldbuilding",
  "themes",
  "style_technique",
  "market_highlights",
] as const;
const TRANSFERABLE_BOOK_ANALYSIS_SECTIONS = [
  "plot_structure",
  "themes",
  "style_technique",
  "market_highlights",
] as const;

function buildAutoDirectorCreateLink(taskId?: string, marketBriefId?: string): string {
  if (!taskId && !marketBriefId) {
    return "/novels/auto-director";
  }
  const searchParams = new URLSearchParams();
  if (marketBriefId) searchParams.set("marketBriefId", marketBriefId);
  return taskId
    ? buildCandidateTaskHref(taskId, searchParams)
    : `/novels/auto-director?${searchParams.toString()}`;
}

function completedThrough(stage: AutoDirectorCreateStageKey): Set<AutoDirectorCreateStageKey> {
  const index = STAGE_ORDER.indexOf(stage);
  return new Set(STAGE_ORDER.slice(0, Math.max(0, index + 1)));
}

function getDraftStorage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

function AutoDirectorCreatePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const reducedMotion = useReducedMotion();
  const queryClient = useQueryClient();
  const llm = useLLMStore();
  const taskIdFromQuery = readCandidateTaskId(searchParams)?.trim() ?? "";
  const legacyTaskIdFromQuery = searchParams.get("workflowTaskId")?.trim() ?? "";
  const normalizedTaskId = taskIdFromQuery || legacyTaskIdFromQuery;
  const marketBriefId = searchParams.get("marketBriefId")?.trim() ?? "";
  const referenceMode = searchParams.get("referenceMode") === "continuation" ? "continuation"
    : searchParams.get("referenceMode") === "adaptation" ? "adaptation"
      : "";
  const referenceBookAnalysisId = searchParams.get("bookAnalysisId")?.trim() ?? "";
  const referenceDocumentId = searchParams.get("sourceDocumentId")?.trim() ?? "";
  const referenceTitle = searchParams.get("referenceTitle")?.trim() ?? "";
  const initialStyleProfileId = searchParams.get("styleProfileId")?.trim() ?? "";
  const hasLegacyParams = Boolean(legacyTaskIdFromQuery || searchParams.get("mode"));
  const draftScopeKey = useMemo(() => buildAutoDirectorCreateDraftScope({
    marketBriefId,
    referenceMode,
    referenceBookAnalysisId,
    referenceDocumentId,
    initialStyleProfileId,
  }), [
    initialStyleProfileId,
    marketBriefId,
    referenceBookAnalysisId,
    referenceDocumentId,
    referenceMode,
  ]);
  const initialDraft = useMemo(() => {
    const storage = getDraftStorage();
    return !normalizedTaskId && storage
      ? loadAutoDirectorCreateDraft(storage, draftScopeKey)
      : null;
  }, [draftScopeKey, normalizedTaskId]);
  const [basicForm, setBasicForm] = useState(() => patchNovelBasicForm(
    createDefaultNovelBasicFormState(),
    initialDraft?.basicForm ?? {},
  ));
  const [referenceStartOpen, setReferenceStartOpen] = useState(searchParams.get("start") === "reference");
  const [carryoverDialogOpen, setCarryoverDialogOpen] = useState(false);
  const [restoredWorkflowTask, setRestoredWorkflowTask] = useState<UnifiedTaskDetail | null>(null);
  const [activeStage, setActiveStage] = useState<AutoDirectorCreateStageKey>(
    initialDraft?.activeStage ?? "idea",
  );
  const [completedStages, setCompletedStages] = useState<Set<AutoDirectorCreateStageKey>>(
    () => new Set(initialDraft?.completedStages ?? []),
  );
  const [carryoverContract, setCarryoverContract] = useState<CreativeCarryoverContract | null>(
    () => initialDraft?.creativeCarryoverContract ?? null,
  );
  const [carryoverPanelState, setCarryoverPanelState] = useState<CreativeCarryoverPanelState>(() => (
    initialDraft?.creativeCarryoverContract
      ? { kind: "ready", contract: initialDraft.creativeCarryoverContract }
      : { kind: "idle" }
  ));
  const carryoverRequestedRef = useRef<string | null>(null);
  const carryoverSelectionRef = useRef<string | null>(null);
  const carryoverGenerationIdRef = useRef(0);
  const [carryoverGeneratingKey, setCarryoverGeneratingKey] = useState<string | null>(null);
  const [isCarryoverAdopting, setIsCarryoverAdopting] = useState(false);
  const restoreHandledRef = useRef<string | null>(null);
  const marketBriefFormAppliedRef = useRef<string | null>(null);
  const marketBriefIdeaAppliedRef = useRef<string | null>(null);
  const referenceAppliedRef = useRef<string | null>(null);
  const resolvedCarryoverMode = referenceMode
    || (basicForm.writingMode === "continuation" && basicForm.continuationBookAnalysisId
      ? "continuation" as const
      : basicForm.referenceBookAnalysisId
        ? "adaptation" as const
        : "");
  const resolvedCarryoverAnalysisId = referenceBookAnalysisId
    || (resolvedCarryoverMode === "continuation"
      ? basicForm.continuationBookAnalysisId
      : basicForm.referenceBookAnalysisId)
    || "";
  const showCarryoverPanel = Boolean(resolvedCarryoverMode && resolvedCarryoverAnalysisId);
  const activeCarryoverContract = matchesCreativeCarryoverSource(
    carryoverContract,
    resolvedCarryoverMode,
    resolvedCarryoverAnalysisId,
  ) ? carryoverContract : null;
  const handleCreativeCarryoverContractChange = useCallback((contract: CreativeCarryoverContract | null) => {
    setCarryoverContract(contract);
    if (contract) {
      setCarryoverPanelState({ kind: "ready", contract });
    }
  }, []);

  const worldListQuery = useQuery({
    queryKey: queryKeys.worlds.all,
    queryFn: getWorldList,
  });
  const genreTreeQuery = useQuery({
    queryKey: queryKeys.genres.all,
    queryFn: getGenreTree,
  });
  const storyModeTreeQuery = useQuery({
    queryKey: queryKeys.storyModes.all,
    queryFn: getStoryModeTree,
  });
  const marketBriefQuery = useQuery({
    queryKey: queryKeys.marketRadar.brief(marketBriefId || "none"),
    queryFn: () => getMarketCreativeBrief(marketBriefId),
    enabled: Boolean(marketBriefId),
  });
  const referenceStyleProfileQuery = useQuery({
    queryKey: [
      "reference-novel-style-profile",
      referenceBookAnalysisId || "none",
      llm.provider,
      llm.model,
    ],
    queryFn: async () => {
      const profileList = await getStyleProfiles();
      const existingProfile = (profileList.data ?? []).find((profile) => (
        profile.sourceType === "from_book_analysis"
        && profile.sourceRefId === referenceBookAnalysisId
        && profile.status === "active"
      ));
      if (existingProfile) {
        return existingProfile;
      }
      const created = await createStyleProfileFromBookAnalysis({
        bookAnalysisId: referenceBookAnalysisId,
        name: `${referenceTitle || "Novela de referencia"}Método de escritura de referencia`,
        provider: llm.provider || undefined,
        model: llm.model || undefined,
        temperature: llm.temperature,
      });
      if (!created.data) {
        throw new Error("La preparación de la redacción de referencias falló.");
      }
      return created.data;
    },
    enabled: Boolean(referenceMode && referenceBookAnalysisId && !initialStyleProfileId),
    retry: false,
  });
  const resolvedInitialStyleProfileId = initialStyleProfileId || referenceStyleProfileQuery.data?.id || "";
  const genreTree = genreTreeQuery.data?.data ?? [];
  const storyModeTree = storyModeTreeQuery.data?.data ?? [];
  const genreOptions = flattenGenreTreeOptions(genreTree);
  const storyModeOptions = flattenStoryModeTreeOptions(storyModeTree);
  const worldOptions = worldListQuery.data?.data ?? [];

  useEffect(() => {
    const referenceKey = `${referenceMode}:${referenceBookAnalysisId}:${referenceDocumentId}`;
    if (!referenceMode || !referenceBookAnalysisId || referenceAppliedRef.current === referenceKey) {
      return;
    }
    referenceAppliedRef.current = referenceKey;
    const sourceLabel = referenceTitle ? `«${referenceTitle}»` : "este libro abierto";
    setBasicForm((current) => patchNovelBasicForm(current, referenceMode === "continuation"
      ? {
        writingMode: "continuation",
        continuationSourceType: "knowledge_document",
        sourceKnowledgeDocumentId: referenceDocumentId,
        continuationBookAnalysisId: referenceBookAnalysisId,
        continuationBookAnalysisSections: [...ALL_BOOK_ANALYSIS_SECTIONS],
        description: current.description || `Residencia en${sourceLabel}Continúe creando historias posteriores utilizando personajes existentes, reglas mundiales, estados finales y pistas sin terminar.`,
      }
      : {
        writingMode: "original",
        referenceBookAnalysisId,
        referenceBookAnalysisSections: [...TRANSFERABLE_BOOK_ANALYSIS_SECTIONS],
        description: current.description || `Referencia${sourceLabel}El mecanismo estructural, el ritmo y el estilo de escritura de la novela crean una novela independiente con nuevos personajes, mundo y trama.`,
      }));
  }, [referenceBookAnalysisId, referenceDocumentId, referenceMode, referenceTitle]);

  useEffect(() => {
    if (!referenceStyleProfileQuery.data?.id) {
      return;
    }
    void queryClient.invalidateQueries({ queryKey: queryKeys.styleEngine.profiles });
  }, [queryClient, referenceStyleProfileQuery.data?.id]);

  useEffect(() => {
    const brief = marketBriefQuery.data?.data;
    if (!marketBriefId || !brief || marketBriefFormAppliedRef.current === marketBriefId) {
      return;
    }
    marketBriefFormAppliedRef.current = marketBriefId;
    setBasicForm((current) => patchNovelBasicForm(current, {
      ...(brief.productionFoundation ? fillMissingCreationFoundation(current, {
        genreId: brief.productionFoundation.genre.id,
        primaryStoryModeId: brief.productionFoundation.primaryStoryMode.id,
        secondaryStoryModeId: brief.productionFoundation.secondaryStoryMode?.id,
      }) : {}),
      ...fillMissingMarketCreativeFraming(current, brief.creativeSeed),
    }));
  }, [marketBriefId, marketBriefQuery.data?.data]);

  useEffect(() => {
    if (!hasLegacyParams) {
      return;
    }
    navigate(buildAutoDirectorCreateLink(normalizedTaskId, marketBriefId), { replace: true });
  }, [hasLegacyParams, marketBriefId, navigate, normalizedTaskId]);

  const replaceTaskId = (taskId: string) => {
    const storage = getDraftStorage();
    if (storage) {
      clearAutoDirectorCreateDraft(storage, draftScopeKey);
    }
    const nextSearchParams = stripLegacyTaskUrlParams(searchParams);
    nextSearchParams.delete("workflowTaskId");
    nextSearchParams.delete("mode");
    navigate(buildCandidateTaskHref(taskId, nextSearchParams), { replace: true });
  };

  const restoreWorkflowMutation = useMutation({
    mutationFn: () => getTaskDetail("novel_workflow", normalizedTaskId),
    onSuccess: (response) => {
      const task = response.data ?? null;
      setRestoredWorkflowTask(task);
      if (!task) {
        return;
      }
      const novelHref = getCandidateTaskNovelHref(task);
      if (novelHref) {
        navigate(novelHref, { replace: true });
        return;
      }
      const seedPayload = (task.meta.seedPayload ?? null) as { basicForm?: Partial<NovelBasicFormState> } | null;
      if (seedPayload?.basicForm) {
        setBasicForm((prev) => patchNovelBasicForm(prev, seedPayload.basicForm ?? {}));
      }
      if (task.id && task.id !== normalizedTaskId) {
        replaceTaskId(task.id);
      }
      if (task.id && restoreHandledRef.current !== task.id) {
        restoreHandledRef.current = task.id;
        setCompletedStages(completedThrough("model_run"));
        setActiveStage("candidates");
      }
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "No se pudo reanudar la tarea del director automático.");
    },
  });

  useEffect(() => {
    if (!normalizedTaskId || hasLegacyParams) {
      if (!normalizedTaskId) {
        setRestoredWorkflowTask(null);
      }
      return;
    }
    restoreWorkflowMutation.mutate();
  }, [hasLegacyParams, normalizedTaskId]);

  const controller = useAutoDirectorCreateController({
    marketBriefId,
    initialStyleProfileId: resolvedInitialStyleProfileId,
    basicForm,
    genreOptions,
    storyModeOptions,
    worldOptions,
    initialDraft,
    workflowTaskId: normalizedTaskId,
    restoredTask: restoredWorkflowTask,
    creativeCarryoverContract: activeCarryoverContract,
    requireCreativeCarryoverAdopted: showCarryoverPanel,
    onCreativeCarryoverContractChange: handleCreativeCarryoverContractChange,
    onWorkflowTaskChange: replaceTaskId,
    onBasicFormChange: (patch) => setBasicForm((prev) => patchNovelBasicForm(prev, patch)),
  });
  const applyingCandidate = useIsMutating({ mutationKey: ["apply-opening-candidate", controller.workflowTaskId] }) > 0;
  const candidateSelection = useCandidateSelection(controller.batches);
  useEffect(() => {
    const seed = marketBriefQuery.data?.data?.creativeSeed;
    if (!marketBriefId || !seed || marketBriefIdeaAppliedRef.current === marketBriefId) {
      return;
    }
    marketBriefIdeaAppliedRef.current = marketBriefId;
    controller.setIdea(resolveMarketOpeningIdea(controller.idea, seed));
  }, [controller.idea, controller.setIdea, marketBriefId, marketBriefQuery.data?.data?.creativeSeed]);
  useEffect(() => {
    const storage = getDraftStorage();
    if (!storage) {
      return;
    }
    if (normalizedTaskId || controller.workflowTaskId) {
      clearAutoDirectorCreateDraft(storage, draftScopeKey);
      return;
    }
    saveAutoDirectorCreateDraft(storage, draftScopeKey, {
      idea: controller.idea,
      basicForm,
      activeStage,
      completedStages,
      runMode: controller.runMode,
      directorVersion: controller.directorVersion,
      worldSetupMode: controller.worldSetupMode,
      selectedStyleProfileId: controller.selectedStyleProfileId,
      creativeCarryoverContract: activeCarryoverContract,
      issuePolicy: controller.issuePolicy,
    });
  }, [
    activeStage,
    basicForm,
    activeCarryoverContract,
    completedStages,
    controller.idea,
    controller.issuePolicy,
    controller.runMode,
    controller.directorVersion,
    controller.selectedStyleProfileId,
    controller.workflowTaskId,
    controller.worldSetupMode,
    draftScopeKey,
    normalizedTaskId,
  ]);
  const createdNovelId = controller.directorTask?.resumeTarget?.novelId?.trim() ?? "";
  useEffect(() => {
    const novelHref = getCandidateTaskNovelHref(controller.directorTask ?? restoredWorkflowTask);
    if (novelHref) {
      navigate(novelHref, { replace: true });
    }
  }, [controller.directorTask, navigate, restoredWorkflowTask]);
  const enterSimpleMutation = useMutation({
    mutationFn: () => setNovelCreationExperience(createdNovelId, "simple"),
    onSuccess: () => navigate(`/novels/${createdNovelId}/simple`, { replace: true }),
    onError: (error) => toast.error(error instanceof Error ? error.message : "No se pudo ingresar al modo fácil, inténtelo nuevamente."),
  });
  const enterProfessionalMutation = useMutation({
    mutationFn: () => setNovelCreationExperience(createdNovelId, "professional"),
    onSuccess: () => navigate(`/novels/${createdNovelId}/edit`, { replace: true }),
    onError: (error) => toast.error(error instanceof Error ? error.message : "No se pudo ingresar al modo profesional, inténtelo nuevamente."),
  });

  useEffect(() => {
    if (controller.batches.length === 0 && !controller.hasActiveDirectorTask) {
      return;
    }
    setCompletedStages((prev) => new Set([...prev, ...completedThrough("model_run")]));
  }, [controller.batches.length, controller.hasActiveDirectorTask]);

  const latestProductionFoundation = controller.batches.at(-1)?.candidates[0]?.productionFoundation ?? null;
  const marketProductionFoundation = marketBriefQuery.data?.data?.productionFoundation ?? null;
  const selectedGenre = genreOptions.find((option) => option.id === controller.directorBasicForm.genreId) ?? null;
  const selectedStoryMode = storyModeOptions.find(
    (option) => option.id === controller.directorBasicForm.primaryStoryModeId,
  ) ?? null;
  const latestGenreFoundation = latestProductionFoundation?.genre;
  const latestPrimaryStoryModeFoundation = latestProductionFoundation?.primaryStoryMode;
  const selectedGenreSource = latestGenreFoundation?.id === selectedGenre?.id
    ? latestGenreFoundation?.source
    : marketProductionFoundation?.genre.id === selectedGenre?.id
      ? marketProductionFoundation?.genre.source
    : selectedGenre ? "user_selected" as const : undefined;
  const selectedStoryModeSource = latestPrimaryStoryModeFoundation?.id === selectedStoryMode?.id
    ? latestPrimaryStoryModeFoundation?.source
    : marketProductionFoundation?.primaryStoryMode.id === selectedStoryMode?.id
      ? marketProductionFoundation?.primaryStoryMode.source
    : selectedStoryMode ? "user_selected" as const : undefined;

  const summaries = useMemo(() => ({
    idea: summarizeIdea(controller.idea, {
      genre: selectedGenre?.path,
      storyMode: selectedStoryMode?.path,
    }),
    basic: summarizeBasicStage(controller.directorBasicForm),
    world_style: summarizeWorldStyleStage({
      basicForm: controller.directorBasicForm,
      worldOptions,
      worldSetupMode: controller.worldSetupMode,
      styleProfileId: controller.selectedStyleProfileId,
      styleProfiles: controller.styleProfiles,
      selectedStyleSummary: controller.selectedStyleSummary,
    }),
    model_run: summarizeModelRunStage({
      runMode: controller.runMode,
      runModeOptions: controller.runModeOptions,
      postGenerationStyleReviewEnabled: controller.directorBasicForm.postGenerationStyleReviewEnabled,
    }),
    candidates: controller.batches.length > 0
      ? `Generado ${controller.batches.length} candidatos de dirección por lotes`
      : controller.hasActiveDirectorTask
        ? "Asignación de director en curso"
        : "Esperando generar candidatos de dirección",
  }), [
    controller.batches.length,
    controller.directorBasicForm,
    controller.hasActiveDirectorTask,
    controller.idea,
    controller.runMode,
    controller.runModeOptions,
    controller.selectedStyleProfileId,
    controller.selectedStyleSummary,
    controller.styleProfiles,
    controller.worldSetupMode,
    selectedGenre?.path,
    selectedStoryMode?.path,
    worldOptions,
  ]);

  const markStageCompleted = (stage: AutoDirectorCreateStageKey) => {
    setCompletedStages((prev) => new Set([...prev, stage]));
  };

  // Effect-started mutations can lose their observer during StrictMode's subscription replay.
  // Keep this request's lifecycle with its result so completion always unlocks adoption.
  const generateCarryoverContract = useCallback(async (
    selection: { mode: "continuation" | "adaptation"; bookAnalysisId: string; key: string },
  ) => {
    const requestId = ++carryoverGenerationIdRef.current;
    const isCurrentRequest = () => carryoverSelectionRef.current === selection.key
      && carryoverGenerationIdRef.current === requestId;
    setCarryoverGeneratingKey(selection.key);
    setCarryoverPanelState((prev) => (
      prev.kind === "ready" && matchesCreativeCarryoverSource(prev.contract, selection.mode, selection.bookAnalysisId)
        ? prev
        : { kind: "loading" }
    ));
    try {
      const response = await generateCreativeCarryoverContract({
        mode: selection.mode,
        bookAnalysisId: selection.bookAnalysisId,
        provider: llm.provider || undefined,
        model: llm.model || undefined,
        temperature: llm.temperature,
      });
      if (!response.data) {
        throw new Error(response.error || "La generación del plan de emprendimiento creativo fracasó.");
      }
      if (!isCurrentRequest()) return;
      const result = response.data;
      if (result.status === "insufficient_material") {
        setCarryoverPanelState({
          kind: "insufficient",
          bookAnalysisId: result.bookAnalysisId,
          analysisTitle: result.analysisTitle,
          missingSectionTitles: result.missingSectionTitles,
        });
        return;
      }
      if (!matchesCreativeCarryoverSource(result.contract, selection.mode, selection.bookAnalysisId)) {
        setCarryoverPanelState({ kind: "error", message: "El plan de empresa no coincide con el trabajo de referencia actual; generelo nuevamente.", hasPrevious: Boolean(activeCarryoverContract) });
        return;
      }
      setCarryoverContract(result.contract);
      setCarryoverPanelState({ kind: "ready", contract: result.contract });
    } catch (error) {
      if (!isCurrentRequest()) return;
      const message = error instanceof Error ? error.message : "La generación del plan de emprendimiento creativo fracasó.";
      setCarryoverPanelState({
        kind: "error",
        message,
        hasPrevious: Boolean(activeCarryoverContract),
      });
    } finally {
      if (isCurrentRequest()) setCarryoverGeneratingKey(null);
    }
  }, [activeCarryoverContract, llm.model, llm.provider, llm.temperature]);

  useEffect(() => {
    if (!showCarryoverPanel || !resolvedCarryoverMode || !resolvedCarryoverAnalysisId) {
      carryoverSelectionRef.current = null;
      return;
    }
    const requestKey = `${resolvedCarryoverMode}:${resolvedCarryoverAnalysisId}`;
    carryoverSelectionRef.current = requestKey;
    if (carryoverRequestedRef.current === requestKey) {
      return;
    }
    if (activeCarryoverContract) {
      carryoverRequestedRef.current = requestKey;
      setCarryoverPanelState({ kind: "ready", contract: activeCarryoverContract });
      return;
    }
    carryoverRequestedRef.current = requestKey;
    setCarryoverPanelState({ kind: "loading" });
    void generateCarryoverContract({ mode: resolvedCarryoverMode, bookAnalysisId: resolvedCarryoverAnalysisId, key: requestKey });
  }, [activeCarryoverContract, generateCarryoverContract, resolvedCarryoverAnalysisId, resolvedCarryoverMode, showCarryoverPanel]);

  const adoptCarryoverContract = async () => {
    if (!activeCarryoverContract
      || carryoverGeneratingKey === `${resolvedCarryoverMode}:${resolvedCarryoverAnalysisId}`
      || isCarryoverAdopting) {
      return;
    }
    const adopted = { ...activeCarryoverContract, adopted: true };
    const selectionKey = carryoverSelectionRef.current;
    setIsCarryoverAdopting(true);
    try {
      if (controller.workflowTaskId) {
        const response = await bootstrapNovelWorkflow({
          workflowTaskId: controller.workflowTaskId,
          lane: "auto_director",
          seedPayload: {
            creativeCarryoverContract: adopted,
          },
        });
        if (!response.data) {
          throw new Error(response.error || "No se pudo guardar el plan de empresa.");
        }
      }
      if (carryoverSelectionRef.current !== selectionKey) return;
      setCarryoverContract(adopted);
      setCarryoverPanelState({ kind: "ready", contract: adopted });
      if (!controller.idea.trim()) {
        controller.setIdea(buildOpeningIdeaFromCarryoverContract(adopted));
      }
      setCarryoverDialogOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo guardar el plan de empresa.");
    } finally {
      setIsCarryoverAdopting(false);
    }
  };

  const startGenerate = () => {
    if (showCarryoverPanel && !activeCarryoverContract?.adopted) {
      setCarryoverDialogOpen(true);
      return;
    }
    if (!controller.canGenerate) {
      return;
    }
    setCompletedStages(completedThrough("model_run"));
    setActiveStage("candidates");
    controller.generateMutation.mutate();
  };
  const currentCarryoverKey = `${resolvedCarryoverMode}:${resolvedCarryoverAnalysisId}`;
  const panelBelongsToCurrentSource = !carryoverRequestedRef.current
    || carryoverRequestedRef.current === currentCarryoverKey;
  const readyPanelHasCurrentContract = carryoverPanelState.kind !== "ready"
    || matchesCreativeCarryoverSource(
      carryoverPanelState.contract,
      resolvedCarryoverMode,
      resolvedCarryoverAnalysisId,
    );
  const visibleCarryoverPanelState: CreativeCarryoverPanelState =
    !panelBelongsToCurrentSource || !readyPanelHasCurrentContract || carryoverPanelState.kind === "idle"
      ? { kind: "loading" }
      : carryoverPanelState;
  const isCarryoverGenerating = carryoverGeneratingKey === currentCarryoverKey;
  const carryoverModeLabel = resolvedCarryoverMode === "continuation" ? "Continuación del trabajo original." : "Creación de referencia nuevo libro.";
  const carryoverTitle = referenceTitle || activeCarryoverContract?.documentTitle || "Obras de referencia";
  const carryoverStatus = isCarryoverGenerating || visibleCarryoverPanelState.kind === "loading"
    ? "La IA está ordenando el plan, para que usted pueda refinar primero sus ideas para la apertura de su libro."
    : visibleCarryoverPanelState.kind === "insufficient"
      ? "No hay material suficiente para abrir el libro, verifique la conclusión que debe completarse."
      : visibleCarryoverPanelState.kind === "error"
        ? activeCarryoverContract ? "La generación de la nueva solución fracasó. Puede ver y adoptar la solución retenida." : "La generación del plan falló. Puedes abrirlo e intentarlo de nuevo."
        : activeCarryoverContract?.adopted
          ? "El plan ha sido adoptado y se utilizará para la planificación de la historia posterior."
          : "El plan está listo. Una vez revisado y adoptado, se puede generar la dirección para todo el libro.";
  const regenerateCarryoverContract = () => {
    if (!resolvedCarryoverMode || !resolvedCarryoverAnalysisId || isCarryoverGenerating || isCarryoverAdopting) return;
    void generateCarryoverContract({
      mode: resolvedCarryoverMode,
      bookAnalysisId: resolvedCarryoverAnalysisId,
      key: currentCarryoverKey,
    });
  };
  const carryoverEntry = showCarryoverPanel ? (
    <div className="flex flex-col gap-3 rounded-lg bg-muted/35 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-foreground" title={carryoverTitle}>
          {carryoverModeLabel} · {carryoverTitle}
        </p>
        <p role="status" className="mt-1 text-xs leading-5 text-muted-foreground">{carryoverStatus}</p>
      </div>
      <DialogTrigger asChild>
        <Button type="button" variant="secondary" size="sm" className="shrink-0 self-start sm:self-auto">
          {activeCarryoverContract?.adopted ? "Ver planes adoptados" : "Ver plan creativo"}
        </Button>
      </DialogTrigger>
    </div>
  ) : null;

  const renderStage = () => {
    if (activeStage === "idea") {
      return (
        <StageIdea
          referenceContext={carryoverEntry}
          idea={controller.idea}
          onIdeaChange={controller.setIdea}
          ideaInspirations={controller.ideaInspirations}
          isGeneratingIdeaInspirations={controller.isGeneratingIdeaInspirations}
          onGenerateIdeaInspirations={controller.generateIdeaInspirations}
          ideaConstellationOptions={controller.ideaConstellationOptions}
          isGeneratingIdeaConstellationOptions={controller.isGeneratingIdeaConstellationOptions}
          isComposingIdeaConstellation={controller.isComposingIdeaConstellation}
          onGenerateIdeaConstellationOptions={controller.generateIdeaConstellationOptions}
          onComposeIdeaConstellation={controller.composeIdeaConstellation}
          onContinue={() => {
            markStageCompleted("idea");
            setActiveStage("basic");
          }}
          onQuickGenerate={startGenerate}
          canContinue={controller.idea.trim().length > 0}
          isGenerating={controller.generateMutation.isPending}
          genreTree={genreTree}
          storyModeTree={storyModeTree}
          selectedGenreId={controller.directorBasicForm.genreId}
          selectedGenreLabel={selectedGenre
            ? `Tipo de historia:${selectedGenre.path}`
            : controller.directorBasicForm.genreId ? "Tipo de historia: Selección vencida" : ""}
          selectedGenreSource={selectedGenreSource}
          selectedStoryModeId={controller.directorBasicForm.primaryStoryModeId}
          selectedStoryModeLabel={selectedStoryMode
            ? `Método de promoción:${selectedStoryMode.path}`
            : controller.directorBasicForm.primaryStoryModeId ? "Método de avance: la selección ha caducado" : ""}
          selectedStoryModeSource={selectedStoryModeSource}
          genreLoading={genreTreeQuery.isPending}
          genreError={genreTreeQuery.isError}
          storyModeLoading={storyModeTreeQuery.isPending}
          storyModeError={storyModeTreeQuery.isError}
          isUpdatingFoundation={controller.isUpdatingFoundation}
          onRetryGenres={() => void genreTreeQuery.refetch()}
          onRetryStoryModes={() => void storyModeTreeQuery.refetch()}
          onFoundationChange={controller.updateProductionFoundation}
        />
      );
    }
    if (activeStage === "basic") {
      return (
        <StageBasicSetup
          basicForm={controller.directorBasicForm}
          genreOptions={genreOptions}
          idea={controller.idea}
          onBasicFormChange={(patch) => {
            if (patch.powerSystemPreference !== undefined) {
              void controller.updateProductionFoundation({
                powerSystemPreference: patch.powerSystemPreference,
              });
              return;
            }
            controller.onBasicFormChange(patch);
          }}
          onBack={() => setActiveStage("idea")}
          onConfirm={() => {
            markStageCompleted("basic");
            setActiveStage("world_style");
          }}
        />
      );
    }
    if (activeStage === "world_style") {
      return (
        <StageWorldStyle
          basicForm={controller.directorBasicForm}
          worldOptions={worldOptions}
          styleProfileOptions={controller.styleProfiles.map((profile) => ({ id: profile.id, name: profile.name }))}
          selectedStyleProfileId={controller.selectedStyleProfileId}
          selectedStyleSummary={controller.selectedStyleSummary}
          onStyleProfileChange={controller.setSelectedStyleProfileId}
          onBasicFormChange={controller.onBasicFormChange}
          onBack={() => setActiveStage("basic")}
          onConfirm={() => {
            markStageCompleted("world_style");
            setActiveStage("model_run");
          }}
        />
      );
    }
    if (activeStage === "model_run") {
      return (
        <StageModelRun
          directorVersion={controller.directorVersion}
          availableDirectorVersions={controller.availableDirectorVersions}
          onDirectorVersionChange={controller.setDirectorVersion}
          versionLocked={Boolean(controller.workflowTaskId)}
          basicForm={controller.directorBasicForm}
          onBasicFormChange={controller.onBasicFormChange}
          canGenerate={controller.canGenerate}
          generationDisabledReasons={controller.generationDisabledReasons}
          directorVersionsError={controller.directorVersionsError}
          onRetryDirectorVersions={controller.retryDirectorVersions}
          isGenerating={controller.generateMutation.isPending}
          onBack={() => setActiveStage("world_style")}
          onGenerate={startGenerate}
          issuePolicy={controller.issuePolicy}
          issuePolicyLoading={controller.issuePolicyLoading}
          onIssuePolicyChange={controller.setIssuePolicy}
        />
      );
    }
    return (
      <StageCandidates
        controller={controller}
        selection={candidateSelection}
        isApplying={applyingCandidate}
        onRegenerateSettings={() => setActiveStage("model_run")}
      />
    );
  };

  const showSummaryBar = activeStage !== "idea" || completedStages.size > 0 || controller.workflowTaskId;
  const showCandidateWorkspace = activeStage === "candidates" && controller.dialogMode === "candidate_selection"
    && controller.batches.length > 0
    && !(isProductionExperienceChoicePending(controller.directorTask) && controller.directorTask?.resumeTarget?.novelId);

  const creationContent = (
    <div className={`mx-auto space-y-4 px-3 py-4 sm:px-4 ${showCandidateWorkspace ? "w-full lg:pl-0" : "max-w-6xl lg:px-0"}`}>
      <ReferenceNovelStartDialog open={referenceStartOpen} onOpenChange={setReferenceStartOpen} />
      {showCarryoverPanel ? (
        <AppDialogContent
          title="Plan de emprendimiento creativo."
          description="Vea cómo el trabajo de referencia continúa en su historia, luego adoptelo y continúe completando la configuración de apertura del libro."
          className="max-w-5xl"
          footerClassName="flex-row flex-wrap items-center gap-2 sm:space-x-0"
          footer={(
            <>
              <DialogClose asChild>
                <Button type="button" variant="secondary" className="mr-auto">Volver a la configuración de apertura de libros</Button>
              </DialogClose>
              {visibleCarryoverPanelState.kind === "ready" ? (
                <Button type="button" variant="ghost" onClick={regenerateCarryoverContract} disabled={isCarryoverGenerating || isCarryoverAdopting}>
                  {isCarryoverGenerating ? "Generando…" : "Regenerar"}
                </Button>
              ) : null}
              {activeCarryoverContract && !activeCarryoverContract.adopted
                && (visibleCarryoverPanelState.kind === "ready" || visibleCarryoverPanelState.kind === "error") ? (
                <Button type="button" onClick={() => void adoptCarryoverContract()} disabled={isCarryoverGenerating || isCarryoverAdopting}>
                  {isCarryoverAdopting ? "Adoptando…" : "Utilice las soluciones recomendadas"}
                </Button>
              ) : null}
            </>
          )}
        >
        <CreativeCarryoverContractPanel
          modeLabel={carryoverModeLabel}
          referenceTitle={carryoverTitle}
          state={visibleCarryoverPanelState}
          previousContract={activeCarryoverContract}
          onRegenerate={regenerateCarryoverContract}
          isGenerating={isCarryoverGenerating}
          isAdopting={isCarryoverAdopting}
        />
        <div className="mt-5 border-t border-border/60 pt-4 text-xs leading-5 text-muted-foreground">
          {referenceStyleProfileQuery.isFetching
            ? "El método de escritura de referencia se está preparando en segundo plano y no afectará la configuración continua."
            : referenceStyleProfileQuery.isError
              ? "Se ha introducido la conclusión de abrir el libro; el método de escritura de referencia aún no se ha completado, puede continuar abriendo el libro y agregarlo más tarde."
              : resolvedInitialStyleProfileId
                ? "El método de escritura de referencia se generará a medida que el proyecto ingrese al texto posterior."
                : "Se ha incorporado la conclusión de abrir el libro y puede continuar configurándolo."}
        </div>
        </AppDialogContent>
      ) : null}
      {showSummaryBar ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="text-2xl font-semibold tracking-normal text-foreground">Creación automática de director de IA</div>
            <div className="mt-1 text-sm leading-6 text-muted-foreground">
              Partiendo de una idea inicial, la IA seguirá preparando recursos creativos; Una vez establecido el proyecto, se puede abrir para ver los resultados completos.
            </div>
          </div>
          <div className="flex flex-wrap items-end gap-3 sm:justify-end">
              {createdNovelId && isProductionExperienceChoicePending(controller.directorTask) ? (
                <div className="space-y-1.5">
                  <div className="text-xs font-medium text-muted-foreground">Seleccionar interfaz de creación</div>
                  <div className="flex items-center gap-1 rounded-lg bg-muted/55 p-1" role="group" aria-label="Seleccione el modo creativo">
                    <Button type="button" size="sm" variant="secondary" disabled={enterSimpleMutation.isPending} onClick={() => enterSimpleMutation.mutate()}>
                      {enterSimpleMutation.isPending ? "Abriendo…" : "Modo fácil"}
                    </Button>
                    <Button type="button" size="sm" variant="secondary" disabled={enterProfessionalMutation.isPending} onClick={() => enterProfessionalMutation.mutate()}>
                      {enterProfessionalMutation.isPending ? "Abriendo…" : "Modo profesional"}
                    </Button>
                  </div>
              </div>
            ) : null}
            <Button type="button" size="sm" variant="ghost" asChild>
              <Link to="/novels/create">Crear manualmente</Link>
            </Button>
          </div>
        </div>
      ) : null}

      {showSummaryBar ? (
        <div className="flex min-w-0 flex-wrap gap-2">
          {AUTO_DIRECTOR_CREATE_STAGES.map((stage) => {
            const active = activeStage === stage.key;
            const completed = completedStages.has(stage.key) || stage.key === "candidates" && controller.batches.length > 0;
            const canOpen = active || completed || stage.key === "candidates" && Boolean(controller.workflowTaskId || controller.batches.length > 0);
            return (
              <StageSummaryCard
                key={stage.key}
                order={stage.order}
                label={stage.label}
                stageKey={stage.key}
                summary={summaries[stage.key]}
                active={active}
                completed={completed}
                disabled={!canOpen}
                onClick={setActiveStage}
              />
            );
          })}
        </div>
      ) : null}

      {activeStage !== "idea" ? carryoverEntry : null}

      {restoreWorkflowMutation.isPending && normalizedTaskId ? (
        <div className="rounded-lg bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
          Reanudando la escena automática del director.
        </div>
      ) : null}

      {marketBriefId ? (
        <section className="border-y border-border/60 py-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <span className="h-2 w-2 rounded-full bg-primary" aria-hidden="true" />
                Referencia del libro de radares
                {marketBriefQuery.data?.data?.selectedSignals.length ? (
                  <span className="font-normal text-muted-foreground">
                    {marketBriefQuery.data.data.selectedSignals.length} señal de artículo
                  </span>
                ) : null}
              </div>
              <p className="mt-1 max-w-4xl text-sm leading-6 text-muted-foreground">
                {marketBriefQuery.data?.data?.summary || (marketBriefQuery.isPending ? "Lectura del informe de creación de mercado." : "El informe de mercado no se puede leer temporalmente, pero aún puedes seguir abriendo el libro según tus ideas.")}
              </p>
            </div>
            <Button type="button" variant="ghost" size="sm" className="shrink-0" asChild>
              <Link to="/market-radar">Ajustar la señal del radar</Link>
            </Button>
          </div>

          {marketBriefQuery.data?.data?.selectedSignals.length ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {marketBriefQuery.data.data.selectedSignals.map((signal) => (
                <span key={signal.id} className="rounded-full bg-muted/70 px-2.5 py-1 text-xs text-foreground">
                  {signal.label}
                </span>
              ))}
            </div>
          ) : null}

          {marketBriefQuery.data?.data?.creativeSeed ? (
            <div className="mt-4 grid gap-4 border-t border-border/50 pt-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.35fr)]">
              <div className="min-w-0">
                <div className="text-xs font-medium text-muted-foreground">Ventaja del dedo dorado/núcleo</div>
                <p className="mt-1 line-clamp-2 text-sm leading-6 text-foreground">
                  {marketBriefQuery.data.data.creativeSeed.coreAdvantage}
                </p>
              </div>
              <div className="min-w-0">
                <div className="text-xs font-medium text-muted-foreground">Ideas para abrir un libro</div>
                <p className="mt-1 line-clamp-2 text-sm leading-6 text-foreground">
                  {marketBriefQuery.data.data.creativeSeed.openingIdea}
                </p>
              </div>
              <details className="lg:col-span-2">
                <summary className="w-fit cursor-pointer list-none text-xs font-medium text-muted-foreground hover:text-foreground [&::-webkit-details-marker]:hidden">
                  Ver configuración completa del radar
                </summary>
                <div className="mt-3 grid gap-4 text-sm leading-6 sm:grid-cols-2">
                  <div>
                    <div className="text-xs text-muted-foreground">Ventajas principales completas</div>
                    <p className="mt-1 text-foreground">{marketBriefQuery.data.data.creativeSeed.coreAdvantage}</p>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Ideas completas para abrir libros</div>
                    <p className="mt-1 text-foreground">{marketBriefQuery.data.data.creativeSeed.openingIdea}</p>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Punto de venta principal</div>
                    <p className="mt-1 text-foreground">{marketBriefQuery.data.data.creativeSeed.bookSellingPoint}</p>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Promesa de los primeros 30 capítulos</div>
                    <p className="mt-1 text-foreground">{marketBriefQuery.data.data.creativeSeed.first30ChapterPromise}</p>
                  </div>
                </div>
              </details>
            </div>
          ) : marketBriefQuery.data?.data ? (
            <div className="mt-3 text-sm leading-6 text-amber-700 dark:text-amber-300">
              Este informe carece de una idea completa para abrir el libro. Por favor regrese al radar para reconfirmar la señal.
            </div>
          ) : null}

          {marketProductionFoundation ? (
            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">
              <span><span className="text-foreground">Base temática</span> {marketProductionFoundation.genre.path}</span>
              <span><span className="text-foreground">Promoción principal</span> {marketProductionFoundation.primaryStoryMode.path}</span>
              {marketProductionFoundation.secondaryStoryMode ? (
                <span><span className="text-foreground">Propulsión auxiliar</span> {marketProductionFoundation.secondaryStoryMode.path}</span>
              ) : null}
            </div>
          ) : null}
        </section>
      ) : activeStage === "idea" && !showCarryoverPanel ? (
        <div className="flex flex-col gap-3 rounded-xl bg-muted/35 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
          <span className="text-muted-foreground">También puedes empezar con una novela de referencia o una tendencia reciente.</span>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={() => setReferenceStartOpen(true)}>Escribir según un libro</Button>
            <Button type="button" variant="outline" size="sm" asChild><Link to="/market-radar">Consulte temas populares</Link></Button>
          </div>
        </div>
      ) : null}

      <AnimatePresence mode="wait">
        <motion.div
          key={activeStage}
          initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: -8 }}
          transition={{ duration: reducedMotion ? 0 : 0.18 }}
        >
          {renderStage()}
        </motion.div>
      </AnimatePresence>
    </div>
  );
  return <Dialog open={carryoverDialogOpen} onOpenChange={setCarryoverDialogOpen}>
    {showCandidateWorkspace ? <CandidateReviewWorkspace key={controller.workflowTaskId} taskId={controller.workflowTaskId}
      selection={candidateSelection} onApplied={controller.onReviewedCandidate}
      nextRound={{
        selectedPresets: controller.selectedPresets, feedback: controller.feedback,
        onTogglePreset: controller.togglePreset, onFeedbackChange: controller.setFeedback,
        onGenerate: () => controller.generateMutation.mutate(undefined, {
          onSuccess: ({ batch }) => {
            const first = batch?.candidates[0];
            if (batch && first) candidateSelection.select(candidateAnchor(batch.id, first.id));
          },
        }),
      }}
      disabled={applyingCandidate || controller.generateMutation.isPending || controller.refineTitleMutation.isPending || controller.confirmMutation.isPending}>
      {creationContent}
    </CandidateReviewWorkspace> : creationContent}
  </Dialog>;
}

interface AutoDirectorCreateErrorBoundaryState {
  failed: boolean;
}

class AutoDirectorCreateErrorBoundary extends Component<
  { children: ReactNode },
  AutoDirectorCreateErrorBoundaryState
> {
  state: AutoDirectorCreateErrorBoundaryState = { failed: false };

  static getDerivedStateFromError(): AutoDirectorCreateErrorBoundaryState {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Auto-director creation page crashed", error, info);
  }

  render() {
    if (!this.state.failed) {
      return this.props.children;
    }

    return (
      <div className="flex min-h-[60vh] items-center justify-center px-4 py-12">
        <div className="w-full max-w-lg text-center">
          <h1 className="text-2xl font-semibold text-foreground">Problema al crear la página</h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            Después de recargar, el sistema intentará restaurar el borrador del libro guardado en la máquina local; las tareas y novelas que se hayan creado no se verán afectadas.
          </p>
          <Button type="button" className="mt-6" onClick={() => window.location.reload()}>
            Recargar página de creación
          </Button>
        </div>
      </div>
    );
  }
}

export default function AutoDirectorCreateRoute() {
  const [searchParams] = useSearchParams();
  const scopeKey = buildAutoDirectorCreateDraftScope({
    marketBriefId: searchParams.get("marketBriefId") ?? "",
    referenceMode: searchParams.get("referenceMode") ?? "",
    referenceBookAnalysisId: searchParams.get("bookAnalysisId") ?? "",
    referenceDocumentId: searchParams.get("sourceDocumentId") ?? "",
    initialStyleProfileId: searchParams.get("styleProfileId") ?? "",
  });
  return (
    <AutoDirectorCreateErrorBoundary>
      <AutoDirectorCreatePage key={`${scopeKey}:${readCandidateTaskId(searchParams) || searchParams.get("workflowTaskId") || "draft"}`} />
    </AutoDirectorCreateErrorBoundary>
  );
}
