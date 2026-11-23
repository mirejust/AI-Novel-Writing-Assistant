import type { VolumePlan, VolumePlanDocument } from "@ai-novel/shared/types/novel";
import {
  CHAPTER_DETAIL_MODES,
  hasAnyChapterDetailDraft,
  hasChapterDetailDraft,
  type ChapterDetailBundleRequest,
  type ChapterDetailMode,
} from "../chapterDetailPlanning.shared";

export interface ChapterDetailTarget {
  chapterId: string;
  chapterOrder: number;
  title: string;
}

export interface ChapterDetailBatchFailure {
  targetVolumeId: string;
  targets: ChapterDetailTarget[];
  chapterId: string;
  chapterOrder: number;
  chapterTitle: string;
  mode: ChapterDetailMode;
  message: string;
}

interface ResolvedChapterDetailBatch {
  label: string;
  missingCount: number;
  targets: ChapterDetailTarget[];
  hasExistingDrafts: boolean;
}

interface ChapterDetailMutationPayload {
  targetVolumeId: string;
  targetChapterId: string;
  detailMode: ChapterDetailMode;
  draftVolumesOverride: VolumePlan[];
  suppressSuccessMessage: true;
}

interface ChapterDetailMutationResult {
  nextDocument: VolumePlanDocument;
}

interface RunChapterDetailBatchGenerationArgs {
  initialDraft: VolumePlan[];
  label: string;
  targetVolumeId: string;
  targets: ChapterDetailTarget[];
  setIsGenerating: (value: boolean) => void;
  setCurrentChapterId: (value: string) => void;
  setCurrentMode: (value: ChapterDetailMode | "") => void;
  setFailure: (failure: ChapterDetailBatchFailure | null) => void;
  setStructuredMessage: (value: string) => void;
  generateChapterDetail: (
    payload: ChapterDetailMutationPayload,
  ) => Promise<ChapterDetailMutationResult>;
}

function describeChapterTarget(target: ChapterDetailTarget): string {
  return `Cap.${target.chapterOrder}Capítulo"${target.title || "Capítulo sin título"}»`;
}

function buildFallbackLabel(targets: ChapterDetailTarget[]): string {
  if (targets.length === 1) {
    return describeChapterTarget(targets[0]);
  }
  const first = targets[0];
  const last = targets[targets.length - 1];
  if (!first || !last) {
    return "Alcance del capítulo actual";
  }
  return `Cap.${first.chapterOrder}-${last.chapterOrder}capítulos (total ${targets.length} capítulo)`;
}

function resolveMissingChapterDetailModes(
  draft: VolumePlan[],
  targetVolumeId: string,
  targetChapterId: string,
): ChapterDetailMode[] {
  const chapter = draft
    .find((volume) => volume.id === targetVolumeId)
    ?.chapters.find((item) => item.id === targetChapterId);
  if (!chapter) {
    return [];
  }
  return CHAPTER_DETAIL_MODES.filter((mode) => !hasChapterDetailDraft(chapter, mode));
}

export function resolveChapterDetailBatch(
  volume: VolumePlan | undefined,
  request: ChapterDetailBundleRequest,
): ResolvedChapterDetailBatch {
  const requestedIds = typeof request === "string"
    ? [request]
    : Array.from(new Set(request.chapterIds.map((id) => id.trim()).filter(Boolean)));
  const matchedChapters = requestedIds
    .map((chapterId) => volume?.chapters.find((chapter) => chapter.id === chapterId))
    .filter((chapter): chapter is VolumePlan["chapters"][number] => Boolean(chapter));

  return {
    label: typeof request === "string"
      ? buildFallbackLabel(matchedChapters.map((chapter) => ({
        chapterId: chapter.id,
        chapterOrder: chapter.chapterOrder,
        title: chapter.title,
      })))
      : request.label?.trim() || buildFallbackLabel(matchedChapters.map((chapter) => ({
        chapterId: chapter.id,
        chapterOrder: chapter.chapterOrder,
        title: chapter.title,
      }))),
    missingCount: Math.max(requestedIds.length - matchedChapters.length, 0),
    targets: matchedChapters.map((chapter) => ({
      chapterId: chapter.id,
      chapterOrder: chapter.chapterOrder,
      title: chapter.title,
    })),
    hasExistingDrafts: matchedChapters.some((chapter) => hasAnyChapterDetailDraft(chapter)),
  };
}

export function buildChapterDetailBatchConfirmationMessage(
  batch: ResolvedChapterDetailBatch,
): string {
  return [
    batch.targets.length === 1
      ? `se basará en el contenido actual como${batch.label} La IA completa los objetivos de los capítulos, los límites de ejecución y las órdenes de tareas.`
      : `se basará en el contenido actual como${batch.label}Complete continuamente los objetivos del capítulo, los límites de ejecución y las listas de tareas.`,
    batch.hasExistingDrafts
      ? "Se dará prioridad al uso de los resultados cumplimentados de cada capítulo, y sólo se corregirán las partes en blanco, vagas e insuficientemente ejecutables."
      : "Actualmente, estos capítulos todavía están en blanco. AI primero creará la primera edición y luego la completará capítulo por capítulo de acuerdo con los títulos y resúmenes existentes.",
    "Los títulos de los capítulos y los resúmenes no se modificarán.",
    batch.missingCount > 0 ? `tener ${batch.missingCount} El capítulo ya no está en el borrador del volumen actual y se omitirá automáticamente.` : "",
  ].filter(Boolean).join("\n\n");
}

export async function runChapterDetailBatchGeneration({
  initialDraft,
  label,
  targetVolumeId,
  targets,
  setIsGenerating,
  setCurrentChapterId,
  setCurrentMode,
  setFailure,
  setStructuredMessage,
  generateChapterDetail,
}: RunChapterDetailBatchGenerationArgs): Promise<void> {
  let workingDraft = initialDraft;
  let processedModeCount = 0;
  setIsGenerating(true);
  setFailure(null);
  setCurrentMode("");
  setCurrentChapterId(targets[0]?.chapterId ?? "");
  setStructuredMessage(`Trabajando en${label}Completar los objetivos de los capítulos faltantes, los límites de ejecución y las órdenes de tareas...`);

  try {
    for (const [targetIndex, target] of targets.entries()) {
      const missingModes = resolveMissingChapterDetailModes(workingDraft, targetVolumeId, target.chapterId);
      if (missingModes.length === 0) {
        continue;
      }
      setCurrentChapterId(target.chapterId);
      for (const mode of missingModes) {
        setCurrentMode(mode);
        try {
          const result = await generateChapterDetail({
            targetVolumeId,
            targetChapterId: target.chapterId,
            detailMode: mode,
            draftVolumesOverride: workingDraft,
            suppressSuccessMessage: true,
          });
          workingDraft = result.nextDocument.volumes;
          processedModeCount += 1;
        } catch (error) {
          const message = error instanceof Error ? error.message : "La IA aún no ha completado este refinamiento.";
          setFailure({
            targetVolumeId,
            targets: targets.slice(targetIndex),
            chapterId: target.chapterId,
            chapterOrder: target.chapterOrder,
            chapterTitle: target.title,
            mode,
            message,
          });
          setStructuredMessage(`Cap.${target.chapterOrder}Capítulo${mode === "purpose" ? "Objetivo del capítulo" : mode === "boundary" ? "Límite de ejecución" : "Hoja de tareas"}Aún no está completo, puedes continuar perfeccionándolo desde aquí.`);
          return;
        }
      }
    }
    setStructuredMessage(
      processedModeCount > 0
        ? `${label}Los objetivos del capítulo, los límites de ejecución y las órdenes de tareas se han completado y guardado automáticamente.`
        : `${label}Ahora está completo y no es necesario generar refinamientos de capítulos repetidamente.`,
    );
  } finally {
    setIsGenerating(false);
    setCurrentChapterId("");
    setCurrentMode("");
  }
}
