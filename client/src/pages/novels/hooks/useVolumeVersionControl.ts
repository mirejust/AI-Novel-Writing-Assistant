import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, type QueryClient } from "@tanstack/react-query";
import type {
  VolumeBeatSheet,
  VolumeCritiqueReport,
  VolumeImpactResult,
  VolumePlan,
  VolumePlanDocument,
  VolumePlanDiff,
  VolumePlanVersionSummary,
  VolumeRebalanceDecision,
  VolumeStrategyPlan,
} from "@ai-novel/shared/types/novel";
import {
  activateVolumeVersion,
  analyzeVolumeImpact,
  createVolumeDraft,
  freezeVolumeVersion,
  getVolumeDiff,
  getVolumeVersion,
  listVolumeVersions,
} from "@/api/novel";
import { queryKeys } from "@/api/queryKeys";

interface UseVolumeVersionControlArgs {
  novelId: string;
  draftDocument: VolumePlanDocument;
  setDraftVolumes: (value: VolumePlan[]) => void;
  setStrategyPlan: (value: VolumeStrategyPlan | null) => void;
  setCritiqueReport: (value: VolumeCritiqueReport | null) => void;
  setBeatSheets: (value: VolumeBeatSheet[]) => void;
  setRebalanceDecisions: (value: VolumeRebalanceDecision[]) => void;
  queryClient: QueryClient;
  invalidateNovelDetail: () => Promise<void>;
}

export function useVolumeVersionControl({
  novelId,
  draftDocument,
  setDraftVolumes,
  setStrategyPlan,
  setCritiqueReport,
  setBeatSheets,
  setRebalanceDecisions,
  queryClient,
  invalidateNovelDetail,
}: UseVolumeVersionControlArgs) {
  const [selectedVersionId, setSelectedVersionId] = useState("");
  const [message, setMessage] = useState("");
  const [diffResult, setDiffResult] = useState<VolumePlanDiff | null>(null);
  const [impactResult, setImpactResult] = useState<VolumeImpactResult | null>(null);

  const volumeVersionsQuery = useQuery({
    queryKey: queryKeys.novels.volumeVersions(novelId),
    queryFn: () => listVolumeVersions(novelId),
    enabled: Boolean(novelId),
  });

  const versions = volumeVersionsQuery.data?.data ?? [];
  const selectedVersion = useMemo(
    () => versions.find((item) => item.id === selectedVersionId),
    [selectedVersionId, versions],
  );

  useEffect(() => {
    if (!selectedVersionId && versions.length > 0) {
      setSelectedVersionId(versions[0].id);
    }
  }, [selectedVersionId, versions]);

  const invalidateVersionList = async () => {
    await queryClient.invalidateQueries({ queryKey: queryKeys.novels.volumeVersions(novelId) });
  };

  const createDraftVersionMutation = useMutation({
    mutationFn: () => createVolumeDraft(novelId, {
      ...draftDocument,
      baseVersion: selectedVersion?.version,
    }),
    onSuccess: async (response) => {
      const nextVersionId = response.data?.id;
      if (nextVersionId) {
        setSelectedVersionId(nextVersionId);
      }
      setMessage(response.message ?? "Se crea una versión borrador a nivel de volumen.");
      await invalidateVersionList();
    },
    onError: (error) => {
      setMessage(error instanceof Error ? error.message : "No se pudo crear la versión borrador del nivel de volumen.");
    },
  });

  const activateVersionMutation = useMutation({
    mutationFn: () => {
      if (!selectedVersionId) {
        throw new Error("Primero seleccione una versión a nivel de volumen.");
      }
      return activateVolumeVersion(novelId, selectedVersionId);
    },
    onSuccess: async (response) => {
      setMessage(response.message ?? "La versión de nivel de volumen se ha configurado como efectiva.");
      await invalidateVersionList();
      await invalidateNovelDetail();
    },
    onError: (error) => {
      setMessage(error instanceof Error ? error.message : "No se pudo establecer la versión efectiva.");
    },
  });

  const freezeVersionMutation = useMutation({
    mutationFn: () => {
      if (!selectedVersionId) {
        throw new Error("Primero seleccione una versión a nivel de volumen.");
      }
      return freezeVolumeVersion(novelId, selectedVersionId);
    },
    onSuccess: async (response) => {
      setMessage(response.message ?? "Versión de nivel de volumen congelada.");
      await invalidateVersionList();
    },
    onError: (error) => {
      setMessage(error instanceof Error ? error.message : "Error al congelar la versión del nivel de volumen.");
    },
  });

  const diffMutation = useMutation({
    mutationFn: () => {
      if (!selectedVersionId) {
        throw new Error("Primero seleccione una versión a nivel de volumen.");
      }
      return getVolumeDiff(novelId, selectedVersionId);
    },
    onSuccess: (response) => {
      setDiffResult(response.data ?? null);
      setMessage(response.message ?? "Diferencias de versión de nivel de volumen actualizadas.");
    },
    onError: (error) => {
      setMessage(error instanceof Error ? error.message : "No se pudieron cargar las diferencias de versión de nivel de volumen.");
    },
  });

  const analyzeDraftImpactMutation = useMutation({
    mutationFn: () => analyzeVolumeImpact(novelId, { volumes: draftDocument.volumes }),
    onSuccess: (response) => {
      setImpactResult(response.data ?? null);
      setMessage(response.message ?? "Se completó el análisis de impacto del borrador a nivel de volumen.");
    },
    onError: (error) => {
      setMessage(error instanceof Error ? error.message : "El análisis de impacto del borrador a nivel de volumen falló.");
    },
  });

  const analyzeVersionImpactMutation = useMutation({
    mutationFn: () => {
      if (!selectedVersionId) {
        throw new Error("Primero seleccione una versión a nivel de volumen.");
      }
      return analyzeVolumeImpact(novelId, { versionId: selectedVersionId });
    },
    onSuccess: (response) => {
      setImpactResult(response.data ?? null);
      setMessage(response.message ?? "Se completó el análisis del impacto de la versión a nivel de volumen.");
    },
    onError: (error) => {
      setMessage(error instanceof Error ? error.message : "Error en el análisis del impacto de la versión a nivel de volumen.");
    },
  });

  const loadSelectedVersionMutation = useMutation({
    mutationFn: () => {
      if (!selectedVersionId) {
        throw new Error("Primero seleccione una versión a nivel de volumen.");
      }
      return getVolumeVersion(novelId, selectedVersionId);
    },
    onSuccess: (response) => {
      const version = response.data;
      if (!version) {
        setMessage("No se pudo leer el contenido de la versión del nivel de volumen.");
        return;
      }
      try {
        const parsed = JSON.parse(version.contentJson) as Partial<VolumePlanDocument>;
        setDraftVolumes(parsed.volumes ?? []);
        setStrategyPlan(parsed.strategyPlan ?? null);
        setCritiqueReport(parsed.critiqueReport ?? null);
        setBeatSheets(parsed.beatSheets ?? []);
        setRebalanceDecisions(parsed.rebalanceDecisions ?? []);
        setMessage(`V cargado${version.version} al borrador del nivel de volumen actual.`);
      } catch {
        setMessage("No se pudo leer el contenido de la versión del nivel de volumen.");
      }
    },
    onError: (error) => {
      setMessage(error instanceof Error ? error.message : "No se pudo leer el contenido de la versión del nivel de volumen.");
    },
  });

  const loadSelectedVersionToDraft = () => {
    loadSelectedVersionMutation.mutate();
  };

  return {
    volumeMessage: message,
    volumeVersions: versions,
    selectedVersionId,
    setSelectedVersionId,
    selectedVersion: selectedVersion as VolumePlanVersionSummary | undefined,
    diffResult,
    impactResult,
    isLoadingVersions: volumeVersionsQuery.isLoading,
    createDraftVersionMutation,
    activateVersionMutation,
    freezeVersionMutation,
    diffMutation,
    analyzeDraftImpactMutation,
    analyzeVersionImpactMutation,
    loadSelectedVersionToDraft,
  };
}
