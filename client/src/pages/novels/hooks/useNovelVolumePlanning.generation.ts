import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, type Dispatch, type SetStateAction } from "react";
import type { VolumeChapterListProgress } from "@ai-novel/shared/types/volumePlanning";
import { isInitializationPlaceholderVolumeWorkspace } from "@ai-novel/shared/types/volumePlanning";
import type { ApiResponse } from "@ai-novel/shared/types/api";
import type {
  VolumeBeatSheet,
  VolumeCritiqueReport,
  VolumePlan,
  VolumePlanDocument,
  VolumePlanningReadiness,
  VolumeRebalanceDecision,
  VolumeStrategyPlan,
} from "@ai-novel/shared/types/novel";
import type { LLMProvider } from "@ai-novel/shared/types/llm";
import {
  generateNovelVolumes,
  getNovelVolumeWorkspace,
  updateNovelVolumes,
  type NovelDetailResponse,
} from "@/api/novel";
import { queryKeys } from "@/api/queryKeys";
import { syncNovelWorkflowStageSilently } from "../novelWorkflow.client";
import { normalizeVolumeDraft } from "../volumePlan.utils";
import { detailModeLabel } from "../chapterDetailPlanning.shared";
import {
  buildChapterListSuccessMessage,
  type VolumeGenerationPayload,
} from "./useNovelVolumePlanning.actions";
import { serializeVolumeWorkspaceSnapshot } from "./useNovelVolumePlanning.utils";

interface LlmSettings {
  provider?: LLMProvider;
  model?: string;
  temperature?: number;
}

interface UseVolumeGenerationMutationArgs {
  novelId: string;
  llm: LlmSettings;
  estimatedChapterCount?: number | null;
  normalizedVolumeDraft: VolumePlan[];
  strategyPlan: VolumeStrategyPlan | null;
  critiqueReport: VolumeCritiqueReport | null;
  beatSheets: VolumeBeatSheet[];
  rebalanceDecisions: VolumeRebalanceDecision[];
  savedWorkspace?: VolumePlanDocument | null;
  readiness: VolumePlanningReadiness;
  userPreferredVolumeCount: number | null;
  forceSystemRecommendedVolumeCount: boolean;
  setVolumeDraft: Dispatch<SetStateAction<VolumePlan[]>>;
  setStrategyPlan: Dispatch<SetStateAction<VolumeStrategyPlan | null>>;
  setCritiqueReport: Dispatch<SetStateAction<VolumeCritiqueReport | null>>;
  setBeatSheets: Dispatch<SetStateAction<VolumeBeatSheet[]>>;
  setRebalanceDecisions: Dispatch<SetStateAction<VolumeRebalanceDecision[]>>;
  setVolumeGenerationMessage: (value: string) => void;
  setStructuredMessage: (value: string) => void;
}

export interface GeneratedVolumeMutationResult {
  generatedResponse: Awaited<ReturnType<typeof generateNovelVolumes>>;
  persistedResponse: Awaited<ReturnType<typeof updateNovelVolumes>>;
  nextDocument: VolumePlanDocument;
  autoSyncedToChapterExecution: boolean;
}

interface VolumeGenerationMutationContext {
  persistedWorkspaceSnapshotBefore: string;
}

class VolumeGenerationAutoSaveError extends Error {
  nextDocument: VolumePlanDocument;

  constructor(message: string, nextDocument: VolumePlanDocument) {
    super(message);
    this.name = "VolumeGenerationAutoSaveError";
    this.nextDocument = nextDocument;
  }
}

function shouldAutoSyncGeneratedScope(scope: VolumeGenerationPayload["scope"]): boolean {
  return scope === "chapter_list" || scope === "volume" || scope === "chapter_detail";
}

function shouldRequestSlimVolumeGenerationResponse(scope: VolumeGenerationPayload["scope"]): boolean {
  return scope === "beat_sheet"
    || scope === "chapter_list"
    || scope === "volume"
    || scope === "rebalance"
    || scope === "chapter_detail";
}

function mergeSavedVolumeDocumentIntoNovelDetail(
  previous: ApiResponse<NovelDetailResponse> | undefined,
  document: VolumePlanDocument,
): ApiResponse<NovelDetailResponse> | undefined {
  if (!previous?.data) {
    return previous;
  }
  return {
    ...previous,
    data: {
      ...previous.data,
      outline: document.derivedOutline,
      structuredOutline: document.derivedStructuredOutline,
      volumes: document.volumes,
      volumeSource: document.source,
      activeVolumeVersionId: document.activeVersionId,
    },
  };
}

function isSlimVolumeGenerationResponse(
  document: Awaited<ReturnType<typeof generateNovelVolumes>>["data"],
): document is VolumePlanDocument & { slimmed: true } {
  return Boolean(document && "slimmed" in document && document.slimmed === true);
}

export function useVolumeGenerationMutation({
  novelId,
  llm,
  estimatedChapterCount,
  normalizedVolumeDraft,
  strategyPlan,
  critiqueReport,
  beatSheets,
  rebalanceDecisions,
  savedWorkspace,
  readiness,
  userPreferredVolumeCount,
  forceSystemRecommendedVolumeCount,
  setVolumeDraft,
  setStrategyPlan,
  setCritiqueReport,
  setBeatSheets,
  setRebalanceDecisions,
  setVolumeGenerationMessage,
  setStructuredMessage,
}: UseVolumeGenerationMutationArgs) {
  const queryClient = useQueryClient();
  const [chapterListProgress, setChapterListProgress] = useState<VolumeChapterListProgress | null>(null);

  const applyWorkspaceDocument = (document: VolumePlanDocument) => {
    setVolumeDraft(document.volumes);
    setStrategyPlan(document.strategyPlan);
    setCritiqueReport(document.critiqueReport);
    setBeatSheets(document.beatSheets);
    setRebalanceDecisions(document.rebalanceDecisions);
  };

  const syncSavedVolumeDocumentToCache = (document: VolumePlanDocument) => {
    queryClient.setQueryData<ApiResponse<NovelDetailResponse> | undefined>(
      queryKeys.novels.detail(novelId),
      (previous) => mergeSavedVolumeDocumentIntoNovelDetail(previous, document),
    );
    queryClient.setQueryData<ApiResponse<VolumePlanDocument>>(
      queryKeys.novels.volumeWorkspace(novelId),
      () => ({
        success: true,
        message: "Volume workspace updated.",
        data: document,
      }),
    );
  };

  const hydratePersistedWorkspace = (document: VolumePlanDocument) => {
    applyWorkspaceDocument(document);
    syncSavedVolumeDocumentToCache(document);
  };

  const mutation = useMutation<
    GeneratedVolumeMutationResult,
    Error,
    VolumeGenerationPayload,
    VolumeGenerationMutationContext
  >({
    onMutate: (): VolumeGenerationMutationContext => {
      setChapterListProgress(null);
      return {
        persistedWorkspaceSnapshotBefore: serializeVolumeWorkspaceSnapshot(
          queryClient.getQueryData<ApiResponse<VolumePlanDocument>>(queryKeys.novels.volumeWorkspace(novelId))?.data
          ?? savedWorkspace
          ?? null,
        ),
      };
    },
    mutationFn: async (payload: VolumeGenerationPayload): Promise<GeneratedVolumeMutationResult> => {
      const requestDraft = normalizeVolumeDraft(payload.draftVolumesOverride ?? normalizedVolumeDraft);
      const autoSyncedToChapterExecution = shouldAutoSyncGeneratedScope(payload.scope);
      const generatedResponse = await generateNovelVolumes(novelId, {
        provider: llm.provider,
        model: llm.model,
        temperature: llm.temperature,
        scope: payload.scope,
        generationMode: payload.generationMode,
        targetVolumeId: payload.targetVolumeId,
        targetBeatKey: payload.targetBeatKey,
        targetChapterId: payload.targetChapterId,
        detailMode: payload.detailMode,
        draftVolumes: requestDraft.length > 0 ? requestDraft : undefined,
        draftWorkspace: {
          novelId,
          workspaceVersion: "v2",
          volumes: requestDraft,
          strategyPlan,
          critiqueReport,
          beatSheets,
          rebalanceDecisions,
          readiness,
          derivedOutline: "",
          derivedStructuredOutline: "",
          source: savedWorkspace?.source ?? "volume",
          activeVersionId: savedWorkspace?.activeVersionId ?? null,
        },
        estimatedChapterCount: typeof estimatedChapterCount === "number" && estimatedChapterCount > 0
          ? estimatedChapterCount
          : undefined,
        userPreferredVolumeCount: userPreferredVolumeCount ?? undefined,
        respectExistingVolumeCount: !isInitializationPlaceholderVolumeWorkspace(requestDraft) && !forceSystemRecommendedVolumeCount && requestDraft.length > 0,
        slimResponse: shouldRequestSlimVolumeGenerationResponse(payload.scope),
      }, payload.scope === "chapter_list" || payload.scope === "volume" ? setChapterListProgress : undefined);
      let nextDocument = generatedResponse.data;
      if (!nextDocument) {
        throw new Error("La IA no arrojó resultados del espacio de trabajo de volumen.");
      }
      if (isSlimVolumeGenerationResponse(nextDocument)) {
        const latestWorkspaceResponse = await getNovelVolumeWorkspace(novelId);
        if (!latestWorkspaceResponse.data) {
          throw new Error("Se ha generado IA, pero el espacio de trabajo del último volumen no se puede leer temporalmente. Actualice el plan de volumen antes de continuar.");
        }
        nextDocument = latestWorkspaceResponse.data;
        // 精简响应已由服务端保存，并在需要时连接章节执行；重读后不再二次保存。
        return {
          generatedResponse,
          persistedResponse: latestWorkspaceResponse,
          nextDocument,
          autoSyncedToChapterExecution,
        };
      }

      try {
        const persistedResponse = await updateNovelVolumes(novelId, {
          ...nextDocument,
          syncToChapterExecution: autoSyncedToChapterExecution,
        });
        return {
          generatedResponse,
          persistedResponse,
          nextDocument: persistedResponse.data ?? nextDocument,
          autoSyncedToChapterExecution,
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : "Se completó la generación de IA, pero no se pudo guardar el espacio de trabajo del volumen actual.";
        throw new VolumeGenerationAutoSaveError(message, nextDocument);
      }
    },
    onSuccess: async (result, payload) => {
      applyWorkspaceDocument(result.nextDocument);
      if (result.persistedResponse.data) {
        syncSavedVolumeDocumentToCache(result.persistedResponse.data);
      }
      if (result.autoSyncedToChapterExecution) {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: queryKeys.novels.detail(novelId) }),
          queryClient.invalidateQueries({ queryKey: queryKeys.novels.chapters(novelId) }),
        ]);
      }

      void syncNovelWorkflowStageSilently({
        novelId,
        stage: payload.scope === "strategy" || payload.scope === "strategy_critique" || payload.scope === "skeleton" || payload.scope === "book"
          ? "volume_strategy"
          : "structured_outline",
        itemLabel: payload.scope === "strategy"
          ? "Consejos de estrategia de volumen actualizados"
          : payload.scope === "strategy_critique"
            ? "Se ha actualizado la revisión de la estrategia de volumen."
            : payload.scope === "skeleton" || payload.scope === "book"
              ? "Esqueleto de volumen actualizado"
              : payload.scope === "beat_sheet"
                ? "El tablero de ritmo de volumen actual ha sido actualizado."
                : payload.scope === "chapter_list" || payload.scope === "volume"
                  ? payload.generationMode === "single_beat"
                    ? "El capítulo de la sección de ritmo de volumen actual se ha actualizado y conectado a la ejecución del capítulo."
                    : "La lista de capítulos del volumen actual se genera y se conecta a la ejecución del capítulo."
                  : payload.scope === "rebalance"
                    ? "Recomendaciones de reequilibrio de volumen adyacente actualizadas"
                    : result.autoSyncedToChapterExecution
                      ? "Refinamiento del capítulo actualizado y conectado a la ejecución del capítulo."
                      : "Refinamiento del capítulo actualizado",
        checkpointType: payload.scope === "skeleton" || payload.scope === "book"
          ? "volume_strategy_ready"
          : payload.scope === "chapter_list" || payload.scope === "volume"
            ? "chapter_batch_ready"
            : null,
        checkpointSummary: payload.scope === "skeleton" || payload.scope === "book"
          ? "La estrategia de volumen y el esqueleto de volumen se han actualizado y puedes continuar ingresando al ritmo de los capítulos iniciales."
          : payload.scope === "chapter_list" || payload.scope === "volume"
            ? payload.generationMode === "single_beat"
              ? "El capítulo del segmento de ritmo del volumen actual se ha actualizado y puede continuar refinándolo o ingresar directamente a la ejecución del capítulo."
              : "La lista de capítulos del volumen actual se ha preparado y se puede refinar aún más o ingresar directamente en la ejecución del capítulo."
            : undefined,
        volumeId: payload.targetVolumeId,
        chapterId: payload.targetChapterId,
        status: "waiting_approval",
      });

      if (payload.suppressSuccessMessage) {
        return;
      }

      if (payload.scope === "strategy") {
        const message = "Las recomendaciones de estrategias de volumen se generan y guardan automáticamente. En el siguiente paso, revise primero y luego confirme el esqueleto del volumen.";
        setVolumeGenerationMessage(message);
        setStructuredMessage(message);
        return;
      }
      if (payload.scope === "strategy_critique") {
        const message = "Se completó la revisión de la estrategia del volumen y se escribieron preguntas y sugerencias en el área de revisión a la derecha.";
        setVolumeGenerationMessage(message);
        return;
      }
      if (payload.scope === "skeleton" || payload.scope === "book") {
        const message = "El esqueleto de volumen se genera y guarda automáticamente. El sistema ha borrado el antiguo tablero de ritmo. A continuación, genere un tablero de ritmo para el volumen actual.";
        setVolumeGenerationMessage(message);
        setStructuredMessage(message);
        return;
      }
      if (payload.scope === "beat_sheet") {
        setStructuredMessage("El tablero de ritmo de volumen actual se actualiza y guarda automáticamente. En el siguiente paso, puede continuar descomprimiendo la lista de capítulos del volumen actual.");
        return;
      }
      if (payload.scope === "chapter_list" || payload.scope === "volume") {
        setStructuredMessage(buildChapterListSuccessMessage({
          document: result.nextDocument,
          targetVolumeId: payload.targetVolumeId,
          generationMode: payload.generationMode,
          targetBeatKey: payload.targetBeatKey,
          autoSyncedToChapterExecution: result.autoSyncedToChapterExecution,
        }));
        return;
      }
      if (payload.scope === "rebalance") {
        setStructuredMessage("Se han actualizado las recomendaciones de reequilibrio de volúmenes adyacentes.");
        return;
      }

      const label = detailModeLabel(payload.detailMode ?? "purpose");
      setStructuredMessage(
        result.autoSyncedToChapterExecution
          ? `${label}La corrección de IA se completó y guardó automáticamente, y el área de ejecución del capítulo también se sincronizó automáticamente con el contenido más reciente.`
          : `${label}Correcciones de IA completadas y guardadas automáticamente.`,
      );
    },
    onError: async (error, payload, context) => {
      if (error instanceof VolumeGenerationAutoSaveError) {
        applyWorkspaceDocument(error.nextDocument);
      }
      const fallbackMessage = error instanceof VolumeGenerationAutoSaveError
        ? error.message
        : error instanceof Error
          ? error.message
          : "Error al generar el plan de nivel de volumen.";
      const shouldTryRecoverPersistedWorkspace = !(error instanceof VolumeGenerationAutoSaveError)
        && shouldRequestSlimVolumeGenerationResponse(payload.scope);
      let recoveredMessage: string | null = null;

      if (shouldTryRecoverPersistedWorkspace) {
        try {
          const latestWorkspaceResponse = await getNovelVolumeWorkspace(novelId);
          const latestWorkspace = latestWorkspaceResponse.data ?? null;
          if (latestWorkspace) {
            const persistedWorkspaceSnapshotAfter = serializeVolumeWorkspaceSnapshot(latestWorkspace);
            if (persistedWorkspaceSnapshotAfter !== context?.persistedWorkspaceSnapshotBefore) {
              hydratePersistedWorkspace(latestWorkspace);
              recoveredMessage = payload.scope === "chapter_list" || payload.scope === "volume"
                ? "Se ha restaurado el progreso guardado automáticamente más reciente y puedes continuar avanzando desde secciones de ritmo sin terminar."
                : "Se ha restaurado el progreso de guardado automático más reciente y se puede continuar con la generación de volumen actual.";
            }
          }
        } catch {
          // Ignore recovery fetch failures and keep the original local draft untouched.
        }
      }

      const message = recoveredMessage ?? fallbackMessage;
      if (payload.scope === "strategy" || payload.scope === "strategy_critique" || payload.scope === "skeleton" || payload.scope === "book") {
        setVolumeGenerationMessage(message);
      }
      setStructuredMessage(message);
    },
  });
  return { ...mutation, chapterListProgress };
}
