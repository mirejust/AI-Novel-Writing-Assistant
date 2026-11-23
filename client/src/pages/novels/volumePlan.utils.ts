import type {
  VolumeBeatSheet,
  VolumeChapterPlan,
  VolumeCritiqueReport,
  VolumePlan,
  VolumePlanningReadiness,
  VolumeStrategyPlan,
  VolumeSyncPreview,
} from "@ai-novel/shared/types/novel";

export interface ExistingOutlineChapter {
  id: string;
  order: number;
  title: string;
  content?: string | null;
  expectation?: string | null;
  targetWordCount?: number | null;
  conflictLevel?: number | null;
  revealLevel?: number | null;
  mustAvoid?: string | null;
  taskSheet?: string | null;
}

export interface VolumeSyncOptions {
  preserveContent: boolean;
  applyDeletes: boolean;
}

export function buildVolumePlanningReadiness(params: {
  volumes: VolumePlan[];
  strategyPlan: VolumeStrategyPlan | null;
  critiqueReport?: VolumeCritiqueReport | null;
  beatSheets: VolumeBeatSheet[];
}): VolumePlanningReadiness {
  const { volumes, strategyPlan, critiqueReport, beatSheets } = params;
  const blockingReasons: string[] = [];
  if (!strategyPlan) {
    blockingReasons.push("Primero haga sugerencias estratégicas sobre cómo crear un volumen y luego confirme el esqueleto del volumen.");
  }
  const hasHighRiskCritique = critiqueReport?.overallRisk === "high";
  if (hasHighRiskCritique) {
    blockingReasons.push("La revisión de la estrategia de volumen actual es de alto riesgo; primero regenere o revise la estrategia de volumen.");
  }
  if (volumes.length === 0) {
    blockingReasons.push("Actualmente no existe un esqueleto de volumen.");
  }
  if (!beatSheets.some((sheet) => sheet.beats.length > 0)) {
    blockingReasons.push("No hay un tablero de ritmo en el volumen actual, por lo que la lista de capítulos no se puede abrir directamente de forma predeterminada.");
  }
  return {
    canGenerateStrategy: true,
    canGenerateSkeleton: Boolean(strategyPlan) && !hasHighRiskCritique,
    canGenerateBeatSheet: Boolean(strategyPlan) && volumes.length > 0,
    canGenerateChapterList: Boolean(strategyPlan) && beatSheets.some((sheet) => sheet.beats.length > 0),
    blockingReasons,
  };
}

export function findBeatSheet(beatSheets: VolumeBeatSheet[], volumeId: string): VolumeBeatSheet | null {
  return beatSheets.find((sheet) => sheet.volumeId === volumeId && sheet.beats.length > 0) ?? null;
}

function createLocalId(prefix: string): string {
  return `${prefix}-${globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)}`;
}

export function createEmptyVolume(sortOrder: number): VolumePlan {
  return {
    id: createLocalId("volume"),
    novelId: "",
    sortOrder,
    title: `Cap.${sortOrder}Rollo`,
    summary: "",
    openingHook: "",
    mainPromise: "",
    primaryPressureSource: "",
    coreSellingPoint: "",
    escalationMode: "",
    protagonistChange: "",
    midVolumeRisk: "",
    climax: "",
    payoffType: "",
    nextVolumeHook: "",
    resetPoint: "",
    openPayoffs: [],
    status: "active",
    sourceVersionId: null,
    chapters: [],
    createdAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString(),
  };
}

export function createEmptyChapter(chapterOrder: number): VolumeChapterPlan {
  return {
    id: createLocalId("chapter"),
    volumeId: "",
    chapterOrder,
    beatKey: null,
    title: `Cap.${chapterOrder}Cap.`,
    summary: "",
    purpose: "",
    conflictLevel: null,
    conflictLevelSource: null,
    revealLevel: null,
    targetWordCount: null,
    mustAvoid: "",
    taskSheet: "",
    payoffRefs: [],
    createdAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString(),
  };
}

export function buildTaskSheetFromVolumeChapter(chapter: VolumeChapterPlan): string {
  const lines = [
    `Objetivos del capítulo:${chapter.purpose || chapter.summary || "Avanzar la línea principal"}`,
    typeof chapter.conflictLevel === "number" ? `Nivel de conflicto:${chapter.conflictLevel}` : "",
    typeof chapter.revealLevel === "number" ? `Nivel de divulgación:${chapter.revealLevel}` : "",
    typeof chapter.targetWordCount === "number" ? `Recuento de palabras objetivo:${chapter.targetWordCount}` : "",
    chapter.mustAvoid?.trim() ? `Asuntos prohibidos:${chapter.mustAvoid.trim()}` : "",
    chapter.payoffRefs.length > 0 ? `Canjear asociación:${chapter.payoffRefs.join(",")}` : "",
  ].filter(Boolean);
  return lines.join("\n");
}

export function normalizeVolumeDraft(volumes: VolumePlan[]): VolumePlan[] {
  let chapterOrder = 1;
  return volumes
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((volume, volumeIndex) => {
      const volumeId = volume.id || createLocalId("volume");
      const chapters = (volume.chapters ?? [])
        .slice()
        .sort((a, b) => a.chapterOrder - b.chapterOrder)
        .map((chapter) => {
          const normalizedChapter = {
            ...chapter,
            id: chapter.id || createLocalId("chapter"),
            volumeId,
            chapterOrder,
          };
          chapterOrder += 1;
          return normalizedChapter;
        });
      return {
        ...volume,
        id: volumeId,
        sortOrder: volumeIndex + 1,
        openPayoffs: (volume.openPayoffs ?? []).filter((item) => item.trim()),
        openingHook: volume.openingHook ?? "",
        primaryPressureSource: volume.primaryPressureSource ?? "",
        coreSellingPoint: volume.coreSellingPoint ?? "",
        midVolumeRisk: volume.midVolumeRisk ?? "",
        payoffType: volume.payoffType ?? "",
        chapters,
      };
    });
}

export function buildOutlinePreviewFromVolumes(volumes: VolumePlan[]): string {
  return normalizeVolumeDraft(volumes)
    .map((volume) => {
      const chapterSpan = volume.chapters.length > 0
        ? `${volume.chapters[0]?.chapterOrder ?? "-"}-${volume.chapters[volume.chapters.length - 1]?.chapterOrder ?? "-"}`
        : "sin abrir";
      return [
        `[No.${volume.sortOrder}Rollo]${volume.title}`,
        volume.summary?.trim() ? `Resumen del volumen:${volume.summary.trim()}` : "",
        volume.openingHook?.trim() ? `Mango desenrollador:${volume.openingHook.trim()}` : "",
        volume.mainPromise?.trim() ? `Promesa principal:${volume.mainPromise.trim()}` : "",
        volume.primaryPressureSource?.trim() ? `Principal fuente de opresión:${volume.primaryPressureSource.trim()}` : "",
        volume.coreSellingPoint?.trim() ? `Puntos de venta principales:${volume.coreSellingPoint.trim()}` : "",
        volume.escalationMode?.trim() ? `Método de actualización:${volume.escalationMode.trim()}` : "",
        volume.protagonistChange?.trim() ? `Cambios de protagonista:${volume.protagonistChange.trim()}` : "",
        volume.midVolumeRisk?.trim() ? `Riesgos a medio plazo:${volume.midVolumeRisk.trim()}` : "",
        volume.climax?.trim() ? `Clímax al final del volumen:${volume.climax.trim()}` : "",
        volume.payoffType?.trim() ? `Tipo de canje:${volume.payoffType.trim()}` : "",
        volume.nextVolumeHook?.trim() ? `Gancho de rollo inferior:${volume.nextVolumeHook.trim()}` : "",
        volume.resetPoint?.trim() ? `Punto de reinicio:${volume.resetPoint.trim()}` : "",
        volume.openPayoffs.length > 0 ? `Artículos no cumplidos:${volume.openPayoffs.join(";")}` : "",
        `Alcance del capítulo:${chapterSpan}`,
      ].filter(Boolean).join("\n");
    })
    .join("\n\n");
}

export function buildStructuredPreviewFromVolumes(volumes: VolumePlan[]): string {
  return JSON.stringify({
    volumes: normalizeVolumeDraft(volumes).map((volume) => ({
      volumeTitle: volume.title,
      summary: volume.summary || undefined,
      openingHook: volume.openingHook || undefined,
      mainPromise: volume.mainPromise || undefined,
      primaryPressureSource: volume.primaryPressureSource || undefined,
      coreSellingPoint: volume.coreSellingPoint || undefined,
      escalationMode: volume.escalationMode || undefined,
      protagonistChange: volume.protagonistChange || undefined,
      midVolumeRisk: volume.midVolumeRisk || undefined,
      climax: volume.climax || undefined,
      payoffType: volume.payoffType || undefined,
      nextVolumeHook: volume.nextVolumeHook || undefined,
      resetPoint: volume.resetPoint || undefined,
      openPayoffs: volume.openPayoffs,
      chapters: volume.chapters.map((chapter) => ({
        chapter_id: chapter.chapterId ?? undefined,
        order: chapter.chapterOrder,
        beat_key: chapter.beatKey ?? undefined,
        title: chapter.title,
        summary: chapter.summary,
        purpose: chapter.purpose || undefined,
        conflict_level: chapter.conflictLevel ?? undefined,
        reveal_level: chapter.revealLevel ?? undefined,
        target_word_count: chapter.targetWordCount ?? undefined,
        must_avoid: chapter.mustAvoid || undefined,
        task_sheet: chapter.taskSheet || undefined,
        payoff_refs: chapter.payoffRefs,
      })),
    })),
  }, null, 2);
}

export function applyVolumeChapterBatch(
  volumes: VolumePlan[],
  patch: {
    conflictLevel?: number;
    targetWordCount?: number;
    generateTaskSheet?: boolean;
  },
): VolumePlan[] {
  return normalizeVolumeDraft(volumes).map((volume) => ({
    ...volume,
    chapters: volume.chapters.map((chapter) => {
      const nextChapter: VolumeChapterPlan = { ...chapter };
      if (typeof patch.conflictLevel === "number") {
        nextChapter.conflictLevel = Math.max(0, Math.min(100, Math.round(patch.conflictLevel)));
      }
      if (typeof patch.targetWordCount === "number") {
        nextChapter.targetWordCount = Math.max(200, Math.round(patch.targetWordCount));
      }
      if (patch.generateTaskSheet) {
        nextChapter.taskSheet = buildTaskSheetFromVolumeChapter(nextChapter);
      }
      return nextChapter;
    }),
  }));
}

function compareText(a: string | null | undefined, b: string | null | undefined): boolean {
  return (a ?? "").trim() === (b ?? "").trim();
}

function compareNumber(a: number | null | undefined, b: number | null | undefined): boolean {
  return (typeof a === "number" ? a : null) === (typeof b === "number" ? b : null);
}

function getChangedFields(existing: ExistingOutlineChapter, chapter: VolumeChapterPlan, action: "update" | "move"): string[] {
  const changed: string[] = action === "move" ? ["Orden de capítulos"] : [];
  if (!compareText(existing.title, chapter.title)) changed.push("Título");
  if (!compareText(existing.expectation, chapter.summary)) changed.push("Resumen");
  if (!compareNumber(existing.targetWordCount, chapter.targetWordCount)) changed.push("Palabras objetivo");
  if (!compareNumber(existing.conflictLevel, chapter.conflictLevel)) changed.push("Nivel de conflicto");
  if (!compareNumber(existing.revealLevel, chapter.revealLevel)) changed.push("Revelar nivel");
  if (!compareText(existing.mustAvoid, chapter.mustAvoid)) changed.push("Asuntos prohibidos");
  if (!compareText(existing.taskSheet, chapter.taskSheet)) changed.push("Hoja de tareas");
  return changed;
}

export function buildVolumeSyncPreview(
  volumes: VolumePlan[],
  existingChapters: ExistingOutlineChapter[],
  options: VolumeSyncOptions,
): VolumeSyncPreview {
  const normalizedVolumes = normalizeVolumeDraft(volumes);
  const flattened = normalizedVolumes.flatMap((volume) => volume.chapters.map((chapter) => ({ volume, chapter })));
  const existingById = new Map(existingChapters.map((chapter) => [chapter.id, chapter]));
  const existingByOrder = new Map(existingChapters.map((chapter) => [chapter.order, chapter]));
  const existingByTitle = new Map(existingChapters.map((chapter) => [chapter.title.trim().toLowerCase(), chapter]));
  const matchedChapterIds = new Set<string>();
  const items: VolumeSyncPreview["items"] = [];
  let createCount = 0;
  let updateCount = 0;
  let keepCount = 0;
  let moveCount = 0;
  let deleteCount = 0;
  let deleteCandidateCount = 0;
  let affectedGeneratedCount = 0;
  let clearContentCount = 0;

  for (const entry of flattened) {
    const linkedChapterId = entry.chapter.chapterId?.trim();
    const matchedById = linkedChapterId ? existingById.get(linkedChapterId) : undefined;
    const existing = matchedById && !matchedChapterIds.has(matchedById.id)
      ? matchedById
      : (() => {
        if (linkedChapterId) {
          return undefined;
        }
        const existingBySameOrder = existingByOrder.get(entry.chapter.chapterOrder);
        const matchedByOrder = existingBySameOrder && !matchedChapterIds.has(existingBySameOrder.id)
          ? existingBySameOrder
          : undefined;
        const matchedByTitle = existingByTitle.get(entry.chapter.title.trim().toLowerCase());
        return matchedByOrder ?? (
          matchedByTitle && !matchedChapterIds.has(matchedByTitle.id)
            ? matchedByTitle
            : undefined
        );
      })();

    if (!existing) {
      createCount += 1;
      items.push({
        action: "create",
        volumeTitle: entry.volume.title,
        chapterOrder: entry.chapter.chapterOrder,
        nextTitle: entry.chapter.title,
        hasContent: false,
        changedFields: ["Nuevo capitulo"],
      });
      continue;
    }

    matchedChapterIds.add(existing.id);
    const action = existing.order === entry.chapter.chapterOrder ? "update" : "move";
    const changedFields = getChangedFields(existing, entry.chapter, action);
    const hasContent = Boolean(existing.content?.trim());
    if (changedFields.length === 0) {
      keepCount += 1;
      items.push({
        action: "keep",
        volumeTitle: entry.volume.title,
        chapterOrder: entry.chapter.chapterOrder,
        nextTitle: entry.chapter.title,
        previousTitle: existing.title,
        hasContent,
        changedFields: [],
      });
      continue;
    }

    if (action === "move") {
      moveCount += 1;
    } else {
      updateCount += 1;
    }
    if (hasContent) {
      affectedGeneratedCount += 1;
      if (!options.preserveContent) {
        clearContentCount += 1;
      }
    }
    items.push({
      action,
      volumeTitle: entry.volume.title,
      chapterOrder: entry.chapter.chapterOrder,
      nextTitle: entry.chapter.title,
      previousTitle: existing.title,
      hasContent,
      changedFields,
    });
  }

  for (const chapter of existingChapters.slice().sort((a, b) => a.order - b.order)) {
    if (matchedChapterIds.has(chapter.id)) {
      continue;
    }
    const hasContent = Boolean(chapter.content?.trim());
    if (options.applyDeletes) {
      deleteCount += 1;
      items.push({
        action: "delete",
        volumeTitle: "No coincidente",
        chapterOrder: chapter.order,
        nextTitle: chapter.title,
        previousTitle: chapter.title,
        hasContent,
        changedFields: ["Eliminado del programa de estudios"],
      });
    } else {
      deleteCandidateCount += 1;
      items.push({
        action: "delete_candidate",
        volumeTitle: "No coincidente",
        chapterOrder: chapter.order,
        nextTitle: chapter.title,
        previousTitle: chapter.title,
        hasContent,
        changedFields: ["Pendiente de confirmación de eliminación"],
      });
    }
  }

  return {
    createCount,
    updateCount,
    keepCount,
    moveCount,
    deleteCount,
    deleteCandidateCount,
    affectedGeneratedCount,
    clearContentCount,
    affectedVolumeCount: new Set(items.filter((item) => item.action !== "keep").map((item) => item.volumeTitle)).size,
    items,
  };
}
