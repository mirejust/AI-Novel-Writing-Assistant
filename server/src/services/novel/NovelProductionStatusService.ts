import { prisma } from "../../db/prisma";
import {
  DirectorFactSummaryService,
  type DirectorFactBaseSummary,
} from "./director/projections/DirectorFactSummaryService";
import {
  ChapterExecutionProgressInspector,
  type ChapterExecutionProgressSummary,
} from "./director/runtime/ChapterExecutionProgressInspector";
import { parseStructuredOutline } from "./novelProductionHelpers";

export interface ProductionStatusStage {
  key: string;
  label: string;
  status: "pending" | "completed" | "running" | "blocked";
  detail: string | null;
}

export interface ProductionFactProgress {
  planningCompleted: number;
  planningTotal: number;
  planningPercent: number;
  plannedChapterCount: number;
  chapterCount: number;
  draftedChapterCount: number;
  reviewedChapterCount: number;
  approvedChapterCount: number;
  committedChapterCount: number;
  completedChapters: number;
  needsRepairChapters: number;
  currentChapterOrder: number | null;
  activeChapterOrder: number | null;
  chapterExecutionPercent: number;
  qualityRepairPercent: number;
  totalPercent: number;
  facts: {
    hasWorld: boolean;
    hasStoryMacro: boolean;
    hasBookContract: boolean;
    hasStoryBible: boolean;
    hasCharacters: boolean;
    characterCount: number;
    hasVolumeStrategy: boolean;
    volumeCount: number;
    hasChapterTaskSheets: boolean;
    syncedChapterCount: number;
  };
}

export interface ProductionRuntimeStatus {
  jobId: string | null;
  status: string | null;
  state: "idle" | "queued" | "running" | "succeeded" | "failed" | "cancelled" | "unknown";
  label: string;
  failureSummary: string | null;
  isActive: boolean;
  blocksFactProgress: false;
}

type ProductionChapterProgress = DirectorFactBaseSummary["chapterExecution"] | ChapterExecutionProgressSummary | null;

interface ProductionNovelWorldState {
  id: string;
  title: string | null;
  coverSummary: string | null;
  sourceWorldId: string | null;
  hasStructuredData: boolean;
  hasStorySlice: boolean;
}

export interface ProductionStatusResult {
  novelId: string;
  title: string;
  worldId: string | null;
  worldName: string | null;
  chapterCount: number;
  targetChapterCount: number;
  assetStages: ProductionStatusStage[];
  assetsReady: boolean;
  pipelineReady: boolean;
  pipelineJobId: string | null;
  pipelineStatus: string | null;
  failureSummary: string | null;
  recoveryHint: string | null;
  currentStage: string;
  summary: string;
  progressBasis: "facts";
  factProgress: ProductionFactProgress;
  runtimeStatus: ProductionRuntimeStatus;
}

export class NovelProductionStatusService {
  private readonly db: Pick<typeof prisma, "novel">;
  private readonly factSummaryService: Pick<DirectorFactSummaryService, "getBaseSummary"> | null;
  private readonly chapterInspector: Pick<ChapterExecutionProgressInspector, "inspectNovel"> | null;
  private readonly novelWorldReader: ((novelId: string) => Promise<ProductionNovelWorldState | null>) | null;

  constructor(input: {
    db?: Pick<typeof prisma, "novel">;
    factSummaryService?: Pick<DirectorFactSummaryService, "getBaseSummary">;
    chapterInspector?: Pick<ChapterExecutionProgressInspector, "inspectNovel">;
    novelWorldReader?: (novelId: string) => Promise<ProductionNovelWorldState | null>;
  } = {}) {
    this.db = input.db ?? prisma;
    this.factSummaryService = input.factSummaryService ?? null;
    this.chapterInspector = input.chapterInspector ?? null;
    this.novelWorldReader = input.novelWorldReader ?? null;
  }

  async getNovelProductionStatus(input: {
    novelId?: string;
    title?: string;
    targetChapterCount?: number;
  }): Promise<ProductionStatusResult> {
    const novel = input.novelId
      ? await this.db.novel.findUnique({
          where: { id: input.novelId },
          include: {
            world: { select: { id: true, name: true } },
            bible: true,
            characters: { select: { id: true } },
            chapters: { select: { id: true, order: true }, orderBy: { order: "asc" } },
            generationJobs: { orderBy: { createdAt: "desc" }, take: 1 },
          },
        })
      : await this.db.novel.findFirst({
          where: {
            title: {
              contains: input.title?.trim() ?? "",
            },
          },
          include: {
            world: { select: { id: true, name: true } },
            bible: true,
            characters: { select: { id: true } },
            chapters: { select: { id: true, order: true }, orderBy: { order: "asc" } },
            generationJobs: { orderBy: { createdAt: "desc" }, take: 1 },
          },
          orderBy: { updatedAt: "desc" },
        });
    if (!novel) {
      throw new Error("Novela actual no encontrada.");
    }

    const [factSummary, inspectedChapterProgress] = await Promise.all([
      this.loadDirectorFactSummary(novel.id),
      this.inspectChapterProgress(novel.id),
    ]);
    const novelWorldState = await this.loadNovelWorldState(novel.id);
    const worldState = resolveProductionWorldState(novel, novelWorldState);
    const chapterProgress = factSummary?.chapterExecution ?? inspectedChapterProgress;
    const structuredOutlineChapters = novel.structuredOutline?.trim()
      ? parseStructuredOutline(novel.structuredOutline).length
      : 0;
    const plannedChapterCount = factSummary?.outline.plannedChapterCount
      && factSummary.outline.plannedChapterCount > 0
      ? factSummary.outline.plannedChapterCount
      : structuredOutlineChapters;
    const targetChapterCount = input.targetChapterCount
      ?? (plannedChapterCount > 0 ? plannedChapterCount : null)
      ?? (novel.chapters.length > 0 ? novel.chapters.length : null)
      ?? 20;
    const latestJob = novel.generationJobs[0] ?? null;
    const chapterCount = novel.chapters.length;
    const runtimeStatus = buildRuntimeStatus(latestJob);
    const factProgress = buildFactProgress({
      novel,
      factSummary,
      chapterProgress,
      targetChapterCount,
      structuredOutlineChapters,
      hasActiveWorld: worldState.hasWorld,
    });

    const assetStages: ProductionStatusStage[] = [
      { key: "novel_workspace", label: "Nuevo espacio de trabajo", status: "completed", detail: `«${novel.title}»` },
      { key: "world", label: "mundo del libro", status: factProgress.facts.hasWorld ? "completed" : "pending", detail: worldState.worldName },
      { key: "story_macro", label: "gran plan de historia", status: factProgress.facts.hasStoryMacro ? "completed" : "pending", detail: factProgress.facts.hasStoryMacro ? "Planificación macro disponible" : null },
      { key: "book_contract", label: "Book Contract", status: factProgress.facts.hasBookContract ? "completed" : "pending", detail: factProgress.facts.hasBookContract ? "Las convenciones de escritura a nivel de libro están disponibles" : null },
      { key: "characters", label: "rol central", status: factProgress.facts.hasCharacters ? "completed" : "pending", detail: factProgress.facts.characterCount > 0 ? `${factProgress.facts.characterCount} role` : null },
      { key: "story_bible", label: "novela biblia", status: factProgress.facts.hasStoryBible || factProgress.facts.hasBookContract ? "completed" : "pending", detail: novel.bible?.mainPromise ?? novel.bible?.coreSetting ?? (factProgress.facts.hasBookContract ? "Datos disponibles a nivel de libro" : null) },
      { key: "volume_strategy", label: "Planificación de volumen", status: factProgress.facts.hasVolumeStrategy ? "completed" : "pending", detail: factProgress.facts.volumeCount > 0 ? `${factProgress.facts.volumeCount} rollo` : null },
      { key: "outline", label: "Tendencia de desarrollo", status: novel.outline?.trim() || factProgress.facts.hasVolumeStrategy ? "completed" : "pending", detail: novel.outline?.trim() ? "Se han generado tendencias de desarrollo." : (factProgress.facts.hasVolumeStrategy ? "Planificación de volumen disponible" : null) },
      { key: "structured_outline", label: "esquema estructurado", status: novel.structuredOutline?.trim() || factProgress.plannedChapterCount > 0 ? "completed" : "pending", detail: factProgress.plannedChapterCount > 0 ? `${factProgress.plannedChapterCount} planificación del capítulo` : null },
      { key: "chapters", label: "Hoja de tareas del capítulo", status: factProgress.facts.hasChapterTaskSheets ? "completed" : "pending", detail: chapterCount > 0 ? `${chapterCount}/${targetChapterCount}` : null },
      {
        key: "chapter_drafts",
        label: "Texto del capítulo",
        status: factProgress.draftedChapterCount >= targetChapterCount && targetChapterCount > 0
          ? "completed"
          : factProgress.draftedChapterCount > 0
            ? "running"
            : "pending",
        detail: `${factProgress.draftedChapterCount}/${targetChapterCount}`,
      },
      {
        key: "quality_repair",
        label: "Revisión y reparación",
        status: factProgress.needsRepairChapters > 0
          ? "blocked"
          : factProgress.reviewedChapterCount > 0
            ? "completed"
            : factProgress.draftedChapterCount > 0
              ? "running"
              : "pending",
        detail: factProgress.needsRepairChapters > 0
          ? `${factProgress.needsRepairChapters} Capítulo a reparar`
          : factProgress.reviewedChapterCount > 0
            ? `${factProgress.reviewedChapterCount} Revisión del capítulo completado`
            : null,
      },
      {
        key: "state_commit",
        label: "compromiso de estado",
        status: factProgress.committedChapterCount >= targetChapterCount && targetChapterCount > 0
          ? "completed"
          : factProgress.committedChapterCount > 0
            ? "running"
            : "pending",
        detail: factProgress.committedChapterCount > 0 ? `${factProgress.committedChapterCount}/${targetChapterCount}` : null,
      },
      {
        key: "pipeline",
        label: "Tareas en segundo plano",
        status: runtimeStatus.state === "running" || runtimeStatus.state === "queued"
          ? "running"
          : runtimeStatus.state === "succeeded"
            ? "completed"
            : runtimeStatus.state === "failed" || runtimeStatus.state === "cancelled"
              ? "blocked"
              : "pending",
        detail: runtimeStatus.status ? `Estado de fondo:${runtimeStatus.status}` : null,
      },
    ];

    const planningAssetKeys = new Set([
      "novel_workspace",
      "world",
      "story_macro",
      "book_contract",
      "characters",
      "story_bible",
      "volume_strategy",
      "outline",
      "structured_outline",
      "chapters",
    ]);
    const assetsReady = assetStages
      .filter((stage) => planningAssetKeys.has(stage.key))
      .every((stage) => stage.status === "completed");
    const pipelineReady = assetsReady && factProgress.facts.hasChapterTaskSheets;

    const currentStage = resolveFactCurrentStage(factProgress, targetChapterCount);

    const failureSummary = runtimeStatus.failureSummary;
    const recoveryHint = buildRecoveryHint(factProgress, targetChapterCount, runtimeStatus, pipelineReady);
    const summary = buildSummary(novel.title, currentStage, factProgress, targetChapterCount, runtimeStatus);

    return {
      novelId: novel.id,
      title: novel.title,
      worldId: worldState.worldId,
      worldName: worldState.worldName,
      chapterCount,
      targetChapterCount,
      assetStages,
      assetsReady,
      pipelineReady,
      pipelineJobId: latestJob?.id ?? null,
      pipelineStatus: latestJob?.status ?? null,
      failureSummary,
      recoveryHint,
      currentStage,
      summary,
      progressBasis: "facts",
      factProgress,
      runtimeStatus,
    };
  }

  private async loadDirectorFactSummary(novelId: string): Promise<DirectorFactBaseSummary | null> {
    try {
      const factSummaryService = this.factSummaryService ?? new DirectorFactSummaryService();
      return await factSummaryService.getBaseSummary({
        taskId: "__novel_production_status__",
        novelId,
      });
    } catch {
      return null;
    }
  }

  private async inspectChapterProgress(novelId: string): Promise<ChapterExecutionProgressSummary | null> {
    try {
      const inspector = this.chapterInspector ?? new ChapterExecutionProgressInspector();
      return await inspector.inspectNovel(novelId);
    } catch {
      return null;
    }
  }

  private async loadNovelWorldState(novelId: string): Promise<ProductionNovelWorldState | null> {
    if (this.novelWorldReader) {
      return this.novelWorldReader(novelId);
    }
    const [row = null] = await prisma.$queryRaw<ProductionNovelWorldState[]>`
      SELECT
        "id",
        "title",
        "coverSummary",
        "sourceWorldId",
        CASE WHEN "structuredDataJson" IS NOT NULL AND length(trim("structuredDataJson")) > 0 THEN true ELSE false END AS "hasStructuredData",
        CASE WHEN "storySliceJson" IS NOT NULL AND length(trim("storySliceJson")) > 0 THEN true ELSE false END AS "hasStorySlice"
      FROM "NovelWorld"
      WHERE "novelId" = ${novelId}
      LIMIT 1
    `;
    return row;
  }
}

export const novelProductionStatusService = new NovelProductionStatusService();

function percent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value * 100)));
}

function buildRuntimeStatus(job: {
  id: string;
  status: string;
  error?: string | null;
} | null): ProductionRuntimeStatus {
  const status = job?.status ?? null;
  const state = status === "queued"
    ? "queued"
    : status === "running"
      ? "running"
      : status === "succeeded"
        ? "succeeded"
        : status === "failed"
          ? "failed"
          : status === "cancelled"
            ? "cancelled"
            : status
              ? "unknown"
              : "idle";
  const label = state === "idle"
    ? "Tarea en segundo plano no iniciada"
    : state === "queued"
      ? "Tareas en segundo plano en cola"
      : state === "running"
        ? "Tarea en segundo plano ejecutándose"
        : state === "succeeded"
          ? "Ejecución de tarea en segundo plano completada"
          : state === "failed"
            ? "Error en la tarea en segundo plano"
            : state === "cancelled"
              ? "Tarea en segundo plano cancelada"
              : `Estado de fondo:${status}`;
  return {
    jobId: job?.id ?? null,
    status,
    state,
    label,
    failureSummary: state === "failed" ? job?.error ?? "La tarea en segundo plano falló." : null,
    isActive: state === "queued" || state === "running",
    blocksFactProgress: false,
  };
}

function buildFactProgress(input: {
  novel: {
    world: { id: string; name: string } | null;
    bible: { mainPromise?: string | null; coreSetting?: string | null } | null;
    characters: Array<{ id: string }>;
    chapters: Array<{ id: string; order: number }>;
  };
  factSummary: DirectorFactBaseSummary | null;
  chapterProgress: ProductionChapterProgress;
  targetChapterCount: number;
  structuredOutlineChapters: number;
  hasActiveWorld: boolean;
}): ProductionFactProgress {
  const factSummary = input.factSummary;
  const chapterProgress = input.chapterProgress;
  const characterCount = Math.max(input.novel.characters.length, factSummary?.book.characterCount ?? 0);
  const syncedChapterCount = Math.max(input.novel.chapters.length, factSummary?.outline.syncedChapterCount ?? 0);
  const plannedChapterCount = factSummary?.outline.plannedChapterCount
    && factSummary.outline.plannedChapterCount > 0
    ? factSummary.outline.plannedChapterCount
    : input.structuredOutlineChapters;
  const reviewedChapterCount = factSummary?.repair.reviewedChapterCount
    ?? chapterProgress?.chapters?.filter((chapter) => chapter.completedStages.includes("audit_completed")).length
    ?? 0;
  const committedChapterCount = factSummary?.repair.committedChapterCount
    ?? chapterProgress?.chapters?.filter((chapter) => chapter.completedStages.includes("chapter_state_committed")).length
    ?? 0;
  const facts = {
    hasWorld: input.hasActiveWorld,
    hasStoryMacro: Boolean(factSummary?.book.hasStoryMacro),
    hasBookContract: Boolean(factSummary?.book.hasBookContract),
    hasStoryBible: Boolean(input.novel.bible),
    hasCharacters: characterCount > 0,
    characterCount,
    hasVolumeStrategy: Boolean(factSummary?.outline.hasVolumeStrategy),
    volumeCount: factSummary?.outline.volumeCount ?? 0,
    hasChapterTaskSheets: syncedChapterCount > 0 && (
      Boolean(factSummary?.outline.chapterListReady)
      || Boolean(factSummary?.outline.chapterDetailReady)
      || input.novel.chapters.length > 0
    ),
    syncedChapterCount,
  };
  const planningChecks = [
    facts.hasWorld,
    facts.hasStoryMacro,
    facts.hasBookContract || facts.hasStoryBible,
    facts.hasCharacters,
    facts.hasVolumeStrategy || plannedChapterCount > 0,
    facts.hasChapterTaskSheets,
  ];
  const draftedChapterCount = chapterProgress?.draftedChapterCount ?? 0;
  const approvedChapterCount = chapterProgress?.approvedChapterCount ?? 0;
  const completedChapters = chapterProgress?.completedChapters ?? approvedChapterCount;
  const needsRepairChapters = chapterProgress?.needsRepairChapters ?? factSummary?.repair.needsRepairChapterCount ?? 0;
  const planningCompleted = planningChecks.filter(Boolean).length;
  const planningPercent = percent(planningCompleted / planningChecks.length);
  const chapterExecutionPercent = percent(chapterProgress?.ratio ?? (
    input.targetChapterCount > 0 ? draftedChapterCount / input.targetChapterCount : 0
  ));
  const qualityRepairPercent = draftedChapterCount === 0
    ? 0
    : percent((draftedChapterCount - needsRepairChapters) / draftedChapterCount);
  return {
    planningCompleted,
    planningTotal: planningChecks.length,
    planningPercent,
    plannedChapterCount,
    chapterCount: input.novel.chapters.length,
    draftedChapterCount,
    reviewedChapterCount,
    approvedChapterCount,
    committedChapterCount,
    completedChapters,
    needsRepairChapters,
    currentChapterOrder: chapterProgress?.currentChapterOrder ?? null,
    activeChapterOrder: chapterProgress?.activeChapterOrder ?? null,
    chapterExecutionPercent,
    qualityRepairPercent,
    totalPercent: Math.round((planningPercent * 0.35) + (chapterExecutionPercent * 0.5) + (qualityRepairPercent * 0.15)),
    facts,
  };
}

function resolveProductionWorldState(
  novel: { world: { id: string; name: string } | null },
  novelWorld: ProductionNovelWorldState | null,
): { hasWorld: boolean; worldId: string | null; worldName: string | null } {
  if (novelWorld && (novelWorld.hasStructuredData || novelWorld.hasStorySlice || novelWorld.title || novelWorld.coverSummary)) {
    return {
      hasWorld: true,
      worldId: novelWorld.sourceWorldId ?? novel.world?.id ?? null,
      worldName: novelWorld.title ?? novel.world?.name ?? novelWorld.coverSummary ?? "mundo del libro",
    };
  }
  return {
    hasWorld: Boolean(novel.world),
    worldId: novel.world?.id ?? null,
    worldName: novel.world?.name ?? null,
  };
}

function resolveFactCurrentStage(progress: ProductionFactProgress, targetChapterCount: number): string {
  if (!progress.facts.hasWorld) return "Esperando generar una visión del mundo";
  if (!progress.facts.hasStoryMacro) return "Esperando generar macroplan de historia.";
  if (!progress.facts.hasBookContract && !progress.facts.hasStoryBible) return "Esperando la generación de una convención de autoría a nivel de libro";
  if (!progress.facts.hasCharacters) return "Esperando generar personajes principales.";
  if (!progress.facts.hasVolumeStrategy && progress.plannedChapterCount === 0) return "Esperando la generación del plan de volumen";
  if (!progress.facts.hasChapterTaskSheets) return "Esperando que se genere el orden de las tareas del capítulo";
  if (progress.draftedChapterCount === 0) return "Esperando comenzar a escribir el capítulo.";
  if (progress.needsRepairChapters > 0) return "Corrección de calidad pendiente";
  if (targetChapterCount > 0 && progress.draftedChapterCount < targetChapterCount) return "Se está escribiendo el texto del capítulo.";
  if (targetChapterCount > 0 && progress.committedChapterCount < targetChapterCount) return "Estado enviado para completarse";
  return "Entregable del progreso de los hechos de ficción";
}

function buildRecoveryHint(
  progress: ProductionFactProgress,
  targetChapterCount: number,
  runtimeStatus: ProductionRuntimeStatus,
  pipelineReady: boolean,
): string | null {
  if (!progress.facts.hasWorld) return "Primero desarrolle una visión del mundo y luego continúe con la planificación a nivel de libro.";
  if (!progress.facts.hasStoryMacro) return "Primero, cree un plan macro para la historia para aclarar la línea principal y el compromiso de todo el libro.";
  if (!progress.facts.hasBookContract && !progress.facts.hasStoryBible) return "Primero, formule un acuerdo creativo a nivel de libro para fijar el compromiso del lector y los límites de la escritura.";
  if (!progress.facts.hasCharacters) return "Primero genere los personajes principales y luego avance en la planificación del volumen y las listas de tareas de los capítulos.";
  if (!progress.facts.hasChapterTaskSheets) return "Primero genere una lista de tareas del capítulo y luego comience a escribir el texto del capítulo.";
  if (progress.needsRepairChapters > 0) return `Priorizar el procesamiento ${progress.needsRepairChapters} La calidad del capítulo se ha corregido antes de continuar con los capítulos siguientes.`;
  if (targetChapterCount > 0 && progress.draftedChapterCount < targetChapterCount) return `Continuar desde el capítulo ${progress.currentChapterOrder ?? progress.draftedChapterCount + 1} El capítulo avanza el texto.`;
  if (runtimeStatus.state === "failed") return "El fracaso de la tarea en segundo plano no afecta el contenido del hecho que se ha producido y puede continuar desde el progreso del hecho actual.";
  return pipelineReady ? null : "Complete los activos de planificación y las órdenes de tareas de los capítulos antes de continuar con la producción completa.";
}

function buildSummary(
  title: string,
  currentStage: string,
  progress: ProductionFactProgress,
  targetChapterCount: number,
  runtimeStatus: ProductionRuntimeStatus,
): string {
  const parts = [
    `«${title}»Progreso fáctico:${currentStage}.`,
    `planificación ${progress.planningCompleted}/${progress.planningTotal} artículo, texto ${progress.draftedChapterCount}/${targetChapterCount} capítulo.`,
  ];
  if (progress.needsRepairChapters > 0) {
    parts.push(`${progress.needsRepairChapters} Capítulo a reparar.`);
  }
  if (runtimeStatus.state !== "idle") {
    parts.push(`${runtimeStatus.label}.`);
  }
  if (runtimeStatus.failureSummary) {
    parts.push("Los productos terminados no se perderán.");
  }
  return parts.join("");
}
