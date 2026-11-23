import type {
  VolumeBeatSheet,
  VolumeChapterListGenerationMode,
  VolumeGenerationScopeInput,
  VolumePlan,
  VolumePlanDocument,
} from "@ai-novel/shared/types/novel";
import { findBeatSheet } from "../volumePlan.utils";
import type { ChapterDetailMode } from "../chapterDetailPlanning.shared";

export interface ChapterListGenerationRequest {
  generationMode?: VolumeChapterListGenerationMode;
  targetBeatKey?: string;
}

export interface VolumeGenerationPayload {
  scope: VolumeGenerationScopeInput;
  generationMode?: VolumeChapterListGenerationMode;
  targetVolumeId?: string;
  targetBeatKey?: string;
  targetChapterId?: string;
  detailMode?: ChapterDetailMode;
  draftVolumesOverride?: VolumePlan[];
  suppressSuccessMessage?: boolean;
}

export function startStrategyGenerationAction(params: {
  ensureCharacterGuard: () => boolean;
  userPreferredVolumeCount: number | null;
  forceSystemRecommendedVolumeCount: boolean;
  volumeCountGuidance: {
    systemRecommendedVolumeCount: number;
    allowedVolumeCountRange: { min: number; max: number };
    decisionVolumeCountRange: { min: number; max: number };
    respectedExistingVolumeCount?: number | null;
  };
  hasUnsavedVolumeDraft: boolean;
  generate: (payload: VolumeGenerationPayload) => void;
}): void {
  if (!params.ensureCharacterGuard()) {
    return;
  }
  const confirmed = window.confirm([
    "Se generarán recomendaciones de estrategias de volumen para ayudar a determinar la cantidad de volúmenes recomendados, la cantidad de volúmenes planificados cuidadosamente y la función de cada volumen.",
    "Este paso no generará directamente el esqueleto del volumen ni dividirá capítulos.",
    params.userPreferredVolumeCount != null
      ? `Esta vez se arreglará como ${params.userPreferredVolumeCount} Estrategia de generación y división de volúmenes.`
      : params.forceSystemRecommendedVolumeCount
        ? `Esta vez se generará según la cantidad de volúmenes recomendados por el sistema (recomendado actualmente ${params.volumeCountGuidance.systemRecommendedVolumeCount} volumen), no se utilizará el número de volumen borrador existente.`
        : params.volumeCountGuidance.respectedExistingVolumeCount != null
          ? `Esta vez, se utilizará primero el borrador actual. ${params.volumeCountGuidance.respectedExistingVolumeCount} estructura de volumen mientras permanece dentro del rango permitido ${params.volumeCountGuidance.allowedVolumeCountRange.min}-${params.volumeCountGuidance.allowedVolumeCountRange.max} Adentro.`
          : `Recomendaciones actuales del sistema ${params.volumeCountGuidance.systemRecommendedVolumeCount} Volumen, intervalo de sugerencia de estructura. ${params.volumeCountGuidance.decisionVolumeCountRange.min}-${params.volumeCountGuidance.decisionVolumeCountRange.max} rollo.`,
    params.hasUnsavedVolumeDraft ? "Esta vez, el borrador no guardado de la página actual se utilizará directamente como referencia." : "Esta vez las sugerencias se generarán en función del estado actual del espacio de trabajo.",
  ].join("\n\n"));
  if (!confirmed) {
    return;
  }
  params.generate({ scope: "strategy" });
}

export function startStrategyCritiqueAction(params: {
  ensureCharacterGuard: () => boolean;
  generate: (payload: VolumeGenerationPayload) => void;
}): void {
  if (!params.ensureCharacterGuard()) {
    return;
  }
  params.generate({ scope: "strategy_critique" });
}

export function startSkeletonGenerationAction(params: {
  ensureCharacterGuard: () => boolean;
  hasUnsavedVolumeDraft: boolean;
  generate: (payload: VolumeGenerationPayload) => void;
}): void {
  if (!params.ensureCharacterGuard()) {
    return;
  }
  const confirmed = window.confirm([
    "Se generará o regenerará un esqueleto de volumen completo según las recomendaciones de estrategia de volumen actuales.",
    "Este paso borrará el tablero de ritmo existente y las sugerencias de reequilibrio de volumen adyacentes, pero no eliminará directamente el texto del capítulo.",
    params.hasUnsavedVolumeDraft ? "Esta vez, el borrador de la página actual se utilizará directamente como contexto del esqueleto del volumen." : "Esta vez continuaremos avanzando en función del espacio de trabajo del volumen actual.",
  ].join("\n\n"));
  if (!confirmed) {
    return;
  }
  params.generate({ scope: "skeleton" });
}

export function startBeatSheetGenerationAction(params: {
  volumeId: string;
  normalizedVolumeDraft: VolumePlan[];
  strategyPlan: object | null;
  beatSheets: VolumeBeatSheet[];
  ensureCharacterGuard: () => boolean;
  setStructuredMessage: (value: string) => void;
  generate: (payload: VolumeGenerationPayload) => void;
}): void {
  const targetVolume = params.normalizedVolumeDraft.find((volume) => volume.id === params.volumeId);
  if (!targetVolume) {
    params.setStructuredMessage("El volumen actual no existe y no se puede generar el tablero de ritmo.");
    return;
  }
  if (!params.strategyPlan) {
    params.setStructuredMessage("Primero genere sugerencias de estrategia de volumen y luego genere el tablero de ritmo de volumen actual.");
    return;
  }
  if (!params.ensureCharacterGuard()) {
    return;
  }
  const existingBeatSheet = findBeatSheet(params.beatSheets, params.volumeId);
  if (existingBeatSheet) {
    const confirmed = window.confirm([
      `se regenerará "${targetVolume.title?.trim() || `Cap.${targetVolume.sortOrder}Rollo`}”tabla de ritmo.`,
      "Este paso sobrescribirá las secciones de ritmo existentes y los entregables para el volumen actual.",
      "Las listas de capítulos existentes y los recursos de refinamiento de capítulos no se eliminarán directamente, pero si el nuevo intervalo de ritmo cambia, se recomienda verificar más tarde para ver si las listas de capítulos aún coinciden.",
    ].join("\n\n"));
    if (!confirmed) {
      return;
    }
  }
  params.generate({
    scope: "beat_sheet",
    targetVolumeId: params.volumeId,
  });
}

export function startChapterListGenerationAction(params: {
  volumeId: string;
  request?: ChapterListGenerationRequest;
  normalizedVolumeDraft: VolumePlan[];
  beatSheets: VolumeBeatSheet[];
  ensureCharacterGuard: () => boolean;
  setStructuredMessage: (value: string) => void;
  generate: (payload: VolumeGenerationPayload) => void;
}): void {
  const targetVolume = params.normalizedVolumeDraft.find((volume) => volume.id === params.volumeId);
  if (!targetVolume) {
    params.setStructuredMessage("El volumen actual no existe y no se puede generar la lista de capítulos.");
    return;
  }
  if (!findBeatSheet(params.beatSheets, params.volumeId)) {
    params.setStructuredMessage("No hay un tablero de ritmo en el volumen actual, por lo que la lista de capítulos no se puede abrir directamente de forma predeterminada.");
    return;
  }
  if (!params.ensureCharacterGuard()) {
    return;
  }
  const generationMode = params.request?.generationMode ?? "full_volume";
  const targetBeatKey = params.request?.targetBeatKey?.trim();
  if (generationMode === "single_beat" && !targetBeatKey) {
    params.setStructuredMessage("La sección rítmica actual no existe y el título del capítulo de esta sección no puede volver a aparecer.");
    return;
  }
  params.generate({
    scope: "chapter_list",
    generationMode,
    targetVolumeId: params.volumeId,
    targetBeatKey,
  });
}

export function buildChapterListSuccessMessage(params: {
  document: VolumePlanDocument;
  targetVolumeId?: string;
  generationMode?: VolumeChapterListGenerationMode;
  targetBeatKey?: string;
  autoSyncedToChapterExecution?: boolean;
}): string {
  const updatedVolume = params.targetVolumeId
    ? params.document.volumes.find((volume) => volume.id === params.targetVolumeId)
    : undefined;
  const updatedChapterCount = updatedVolume?.chapters.length ?? 0;
  const syncSuffix = params.autoSyncedToChapterExecution ? "y conectarse al área de ejecución del capítulo" : "";
  if (params.generationMode === "single_beat" && params.targetVolumeId && params.targetBeatKey) {
    const targetBeat = findBeatSheet(params.document.beatSheets, params.targetVolumeId)?.beats
      .find((beat) => beat.key === params.targetBeatKey);
    return updatedChapterCount > 0
      ? `Sección de ritmo de volumen actual "${targetBeat ? `${targetBeat.label}${targetBeat.title ? ` · ${targetBeat.title}` : ""}` : params.targetBeatKey}"Generado y guardado automáticamente${syncSuffix}, este volumen actualmente tiene ${updatedChapterCount} capítulo.`
      : `Sección de ritmo de volumen actual "${targetBeat ? `${targetBeat.label}${targetBeat.title ? ` · ${targetBeat.title}` : ""}` : params.targetBeatKey}"Generado y guardado automáticamente${syncSuffix}.`;
  }
  return updatedChapterCount > 0
    ? `La lista de capítulos del volumen actual se ha generado y guardado automáticamente.${syncSuffix}, ha sido actualizado a ${updatedChapterCount} El capítulo, las recomendaciones de reequilibrio de volumen adyacente también se han actualizado simultáneamente.`
    : `La lista de capítulos del volumen actual se ha generado y guardado automáticamente.${syncSuffix}, las recomendaciones de reequilibrio de volumen adyacente también se actualizaron simultáneamente.`;
}
