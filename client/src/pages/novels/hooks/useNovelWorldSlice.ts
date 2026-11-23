import { useState } from "react";
import { useMutation, useQuery, type QueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import type { StoryWorldSliceOverrides } from "@ai-novel/shared/types/storyWorldSlice";
import type {
  NovelWorldGenerateInput,
  NovelWorldImportInput,
  NovelWorldManualInput,
  NovelWorldSaveToLibraryInput,
  NovelWorldSyncInput,
} from "@ai-novel/shared/types/novelWorld";
import type { LLMProvider } from "@ai-novel/shared/types/llm";
import type { ApiHttpError } from "@/api/client";
import { queryKeys } from "@/api/queryKeys";
import { toast } from "@/components/ui/toast";
import {
  getNovelWorld,
  getNovelWorldSlice,
  getNovelWorldSyncDiff,
  createManualNovelWorld,
  generateNovelWorldFromTheme,
  importNovelWorldFromLibrary,
  refreshNovelWorldSlice,
  saveNovelWorldToLibrary,
  syncNovelWorldWithLibrary,
  updateNovelWorldSliceOverrides,
} from "@/api/novelWorldSlice";

interface UseNovelWorldSliceOptions {
  novelId: string;
  enabled?: boolean;
  llm: {
    provider: LLMProvider;
    model: string;
    temperature: number;
  };
  queryClient: QueryClient;
  onNovelWorldImported?: (worldId: string) => void;
}

export function useNovelWorldSlice({
  novelId,
  enabled = true,
  llm,
  queryClient,
  onNovelWorldImported,
}: UseNovelWorldSliceOptions) {
  const [worldSliceMessage, setWorldSliceMessage] = useState("");
  const navigate = useNavigate();

  const novelWorldQuery = useQuery({
    queryKey: queryKeys.novels.novelWorld(novelId),
    queryFn: () => getNovelWorld(novelId),
    enabled: Boolean(novelId && enabled),
  });

  const worldSliceQuery = useQuery({
    queryKey: queryKeys.novels.worldSlice(novelId),
    queryFn: () => getNovelWorldSlice(novelId),
    enabled: Boolean(novelId && enabled),
  });

  const refreshWorldSliceMutation = useMutation({
    mutationFn: () => refreshNovelWorldSlice(novelId, {
      builderMode: "manual_refresh",
      provider: llm.provider,
      model: llm.model,
      temperature: llm.temperature,
    }),
    onSuccess: async () => {
      setWorldSliceMessage("Se han reorganizado los escenarios mundiales utilizados en este libro.");
      await queryClient.invalidateQueries({ queryKey: queryKeys.novels.worldSlice(novelId) });
      await queryClient.invalidateQueries({ queryKey: queryKeys.novels.detail(novelId) });
    },
  });

  const saveWorldSliceOverridesMutation = useMutation({
    mutationFn: (payload: StoryWorldSliceOverrides) => updateNovelWorldSliceOverrides(novelId, payload),
    onSuccess: async () => {
      setWorldSliceMessage("La reserva de configuración mundial de este libro se ha guardado.");
      await queryClient.invalidateQueries({ queryKey: queryKeys.novels.worldSlice(novelId) });
    },
  });

  const syncDiffQuery = useQuery({
    queryKey: queryKeys.novels.novelWorldSyncDiff(novelId),
    queryFn: () => getNovelWorldSyncDiff(novelId),
    enabled: Boolean(
      novelId
      && enabled
      && novelWorldQuery.data?.data?.novelWorld?.sourceWorldId,
    ),
  });

  const importNovelWorldMutation = useMutation({
    mutationFn: (payload: NovelWorldImportInput) => importNovelWorldFromLibrary(novelId, payload),
    onSuccess: async (_response, payload) => {
      onNovelWorldImported?.(payload.worldId);
      setWorldSliceMessage("El mundo ha sido importado como este libro y las configuraciones disponibles se reorganizarán de acuerdo con el contenido de este libro.");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.novels.novelWorld(novelId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.novels.worldSlice(novelId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.novels.detail(novelId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.novels.all }),
      ]);
    },
  });

  const generateNovelWorldMutation = useMutation({
    mutationFn: (payload: NovelWorldGenerateInput) =>
      generateNovelWorldFromTheme(novelId, {
        ...payload,
        provider: llm.provider,
        model: llm.model,
        temperature: llm.temperature,
      }),
    onError: (error) => {
      const details = (error as ApiHttpError).details as { sourceRoute?: unknown } | undefined;
      const route = details?.sourceRoute;
      toast.error(error.message, route === "/settings/models" || route === "/settings/model-routes"
        ? { action: { label: "Abrir configuración del modelo", onClick: () => { void navigate(route); } } }
        : undefined);
    },
    onSuccess: async () => {
      setWorldSliceMessage("El mundo se generó según el tema de este libro y se guardó en la biblioteca mundial para su posterior reutilización.");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.novels.novelWorld(novelId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.novels.worldSlice(novelId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.novels.detail(novelId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.novels.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.worlds.all }),
      ]);
    },
  });

  const createManualNovelWorldMutation = useMutation({
    mutationFn: (payload: NovelWorldManualInput) => createManualNovelWorld(novelId, payload),
    onSuccess: async () => {
      setWorldSliceMessage("El mundo personalizado de este libro se creó y guardó en la biblioteca mundial, y se pueden seguir agregando reglas, fuerzas y etapas de la historia.");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.novels.novelWorld(novelId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.novels.worldSlice(novelId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.novels.detail(novelId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.novels.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.worlds.all }),
      ]);
    },
  });

  const saveNovelWorldToLibraryMutation = useMutation({
    mutationFn: (payload: NovelWorldSaveToLibraryInput) => saveNovelWorldToLibrary(novelId, payload),
    onSuccess: async () => {
      setWorldSliceMessage("El mundo de este libro se ha guardado en la base de datos mundial.");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.novels.novelWorld(novelId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.novels.novelWorldSyncDiff(novelId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.novels.detail(novelId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.novels.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.worlds.all }),
      ]);
    },
  });

  const syncNovelWorldMutation = useMutation({
    mutationFn: (payload: NovelWorldSyncInput) => syncNovelWorldWithLibrary(novelId, payload),
    onSuccess: async (_response, payload) => {
      setWorldSliceMessage(
        payload.direction === "none"
          ? "El mundo de este libro permanecerá como una copia separada."
          : payload.direction === "push"
            ? "El mundo de este libro ha sido llevado a la biblioteca mundial."
            : "El mundo de este libro ha sido actualizado desde la biblioteca mundial.",
      );
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.novels.novelWorld(novelId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.novels.novelWorldSyncDiff(novelId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.novels.worldSlice(novelId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.novels.detail(novelId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.novels.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.worlds.all }),
      ]);
    },
  });

  return {
    worldSliceMessage,
    setWorldSliceMessage,
    novelWorldView: novelWorldQuery.data?.data ?? null,
    novelWorldSyncDiff: novelWorldQuery.data?.data?.novelWorld?.sourceWorldId ? syncDiffQuery.data?.data ?? null : null,
    worldSliceView: worldSliceQuery.data?.data ?? null,
    isLoadingNovelWorld: novelWorldQuery.isFetching,
    isImportingNovelWorld: importNovelWorldMutation.isPending,
    isGeneratingNovelWorld: generateNovelWorldMutation.isPending,
    isCreatingManualNovelWorld: createManualNovelWorldMutation.isPending,
    isSavingNovelWorldToLibrary: saveNovelWorldToLibraryMutation.isPending,
    isLoadingNovelWorldSyncDiff: syncDiffQuery.isFetching,
    isSyncingNovelWorld: syncNovelWorldMutation.isPending,
    isRefreshingWorldSlice: refreshWorldSliceMutation.isPending || worldSliceQuery.isFetching,
    isSavingWorldSliceOverrides: saveWorldSliceOverridesMutation.isPending,
    importNovelWorld: (payload: NovelWorldImportInput) => importNovelWorldMutation.mutate(payload),
    createManualNovelWorld: (payload: NovelWorldManualInput = {}) => createManualNovelWorldMutation.mutate(payload),
    generateNovelWorld: (payload: NovelWorldGenerateInput) => generateNovelWorldMutation.mutate(payload),
    saveNovelWorldToLibrary: (payload: NovelWorldSaveToLibraryInput = {}) => saveNovelWorldToLibraryMutation.mutate(payload),
    syncNovelWorld: (payload: NovelWorldSyncInput) => syncNovelWorldMutation.mutate(payload),
    refreshWorldSlice: () => refreshWorldSliceMutation.mutate(),
    saveWorldSliceOverrides: (patch: StoryWorldSliceOverrides) => saveWorldSliceOverridesMutation.mutate(patch),
  };
}
