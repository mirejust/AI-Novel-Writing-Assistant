import { currentOutlinePlanning } from "../../../modules/planning/outline/constraints";
import { ensureOutlineRouteWindow } from "../volume/routeWindow/outlineSlots";
import type { LLMProvider } from "@ai-novel/shared/types/llm";
import type { DirectorCompletionProfile } from "@ai-novel/shared/types/directorCompletion";
import type { VolumePlanDocument } from "@ai-novel/shared/types/novel";
import { prisma } from "../../../db/prisma";
import { NovelVolumeService } from "../volume/NovelVolumeService";
import {
  getBeatExpectedChapterCount,
  resolveVolumeChapterBeatKey,
} from "../volume/volumeGenerationHelpers";

export interface ChapterRouteWindowOptions {
  min?: number;
  target?: number;
  provider?: LLMProvider;
  model?: string;
  temperature?: number;
  completionProfile?: DirectorCompletionProfile;
  /** Keeps JIT planning owned by the same auto-director task as chapter execution. */
  taskId?: string;
}

export interface ChapterRouteWindowResult {
  availableRouteCount: number;
  extended: boolean;
}

const routeWindowLocks = new Map<string, Promise<ChapterRouteWindowResult>>();

export class ChapterRouteWindowService {
  constructor(private readonly volumeService = new NovelVolumeService()) {}

  async ensureRouteWindow(
    novelId: string,
    fromChapterOrder: number,
    options: ChapterRouteWindowOptions = {},
  ): Promise<ChapterRouteWindowResult> {
    const active = routeWindowLocks.get(novelId);
    if (active) {
      return active;
    }
    const task = this.ensureRouteWindowUnlocked(novelId, fromChapterOrder, options)
      .finally(() => routeWindowLocks.delete(novelId));
    routeWindowLocks.set(novelId, task);
    return task;
  }

  private async ensureRouteWindowUnlocked(
    novelId: string,
    fromChapterOrder: number,
    options: ChapterRouteWindowOptions,
  ): Promise<ChapterRouteWindowResult> {
    const adopted = currentOutlinePlanning();
    if (adopted?.novelId === novelId) return ensureOutlineRouteWindow(novelId, fromChapterOrder, options, this.volumeService, adopted);
    const minimum = Math.max(1, options.min ?? 3);
    const target = Math.max(minimum, options.target ?? 5);
    const compactTarget = options.completionProfile?.mode === "compact_book"
      ? options.completionProfile.targetChapterCount
      : null;
    const remaining = compactTarget == null ? null : Math.max(0, compactTarget - fromChapterOrder + 1);
    const closingGuidance = remaining != null && remaining <= 3
      ? `Cuenta atrás compacta para el último capítulo del libro: quedan aprox. ${remaining} capítulo. Solo genere las rutas de cierre necesarias para el contrato final, no cree nuevas líneas principales ni ganchos de la siguiente etapa.`
      : remaining != null && remaining <= 8
        ? `Plan de cierre de libros compacto: restante aprox. ${remaining} capítulo. Priorice completar el conflicto principal, los cambios en las relaciones y las recompensas no obtenidas, sin expandir el mundo futuro ni una nueva historia principal.`
        : undefined;
    let workspace = await this.volumeService.getVolumes(novelId, {hydrateCanonical: false});
    let availableRouteCount = await this.countAvailableRoute(novelId, fromChapterOrder, workspace);
    if (availableRouteCount >= minimum) {
      return { availableRouteCount, extended: false };
    }

    // Saved planning can outlive missing execution rows; rebuild only the absent empty rows, without AI.
    if (countPlannedRoutes(workspace, fromChapterOrder) >= minimum) {
      workspace = await this.volumeService.appendMissingRoutes(novelId, workspace);
      availableRouteCount = await this.countAvailableRoute(novelId, fromChapterOrder, workspace);
      if (availableRouteCount >= minimum) return {availableRouteCount, extended: false};
    }
    let extended = false;
    while (availableRouteCount < target) {
      const next = this.findNextRouteTarget(workspace);
      if (!next) {
        const expandedWorkspace = await this.extendFutureVolumeSkeleton(
          novelId,
          workspace,
          options,
        );
        if (!expandedWorkspace) {
          break;
        }
        workspace = expandedWorkspace;
        extended = true;
        continue;
      }
      if (!next.beatKey) {
        workspace = await this.volumeService.generateVolumes(novelId, {
          scope: "beat_sheet",
          targetVolumeId: next.volumeId,
          draftWorkspace: workspace,
          provider: options.provider,
          model: options.model,
          temperature: options.temperature,
          taskId: options.taskId,
          guidance: closingGuidance,
          entrypoint: "jit_route_window",
          persistIntermediateDocuments: false,
        });
        workspace = await this.volumeService.appendMissingRoutes(novelId, workspace);
        if (!workspace.beatSheets.some(sheet => sheet.volumeId === next.volumeId && sheet.beats.length)) {
          throw new Error("El tablero de ritmo disponible no se ha guardado. Se ha mantenido el plan original. Inténtelo de nuevo desde el progreso guardado.");
        }
        availableRouteCount = await this.countAvailableRoute(novelId, fromChapterOrder, workspace);
        continue;
      }

      workspace = await this.volumeService.generateVolumes(novelId, {
        scope: "chapter_list",
        targetVolumeId: next.volumeId,
        generationMode: "single_beat",
        targetBeatKey: next.beatKey,
        draftWorkspace: workspace,
        provider: options.provider,
        model: options.model,
        temperature: options.temperature,
        taskId: options.taskId,
        guidance: closingGuidance,
        entrypoint: "jit_route_window",
        persistIntermediateDocuments: false,
      });
      workspace = await this.volumeService.appendMissingRoutes(novelId, workspace);
      extended = true;
      const previousCount = availableRouteCount;
      availableRouteCount = await this.countAvailableRoute(novelId, fromChapterOrder, workspace);
      if (availableRouteCount <= previousCount) throw new Error("La ruta de capítulo continuo requerida no se ha complementado. Se ha mantenido el plan original. Inténtalo de nuevo desde el progreso guardado.");
    }
    return { availableRouteCount, extended };
  }

  private async extendFutureVolumeSkeleton(
    novelId: string,
    workspace: VolumePlanDocument,
    options: ChapterRouteWindowOptions,
  ): Promise<VolumePlanDocument | null> {
    const targetChapterCount = options.completionProfile?.targetChapterCount ?? 0;
    const plannedChapterEnd = Math.max(
      0,
      ...workspace.volumes.flatMap((volume) => volume.chapters.map((chapter) => chapter.chapterOrder)),
    );
    if (!workspace.strategyPlan || targetChapterCount <= plannedChapterEnd) {
      return null;
    }

    const skeletonVolumeCount = Math.max(
      workspace.volumes.length + 1,
      workspace.strategyPlan.recommendedVolumeCount,
    );
    const generatedSkeleton = await this.volumeService.generateVolumes(novelId, {
      scope: "skeleton",
      skeletonVolumeCount,
      draftWorkspace: workspace,
      provider: options.provider,
      model: options.model,
      temperature: options.temperature,
      taskId: options.taskId,
      entrypoint: "jit_route_window",
      guidance: [
        "La producción de laminación requiere la finalización de esqueletos de laminación posteriores.",
        "Los volúmenes existentes y sus capítulos han entrado en producción y deben considerarse como hechos fijos; sólo se organizan acuerdos para emprender, actualizar y cobrar los volúmenes posteriores que aún no se han creado.",
        `objetivo del libro ${targetChapterCount} Capítulo; Actualmente, solo se está complementando el esqueleto a nivel de volumen y no se eliminarán capítulos futuros.`,
      ].join("\n"),
    });
    const futureVolumes = generatedSkeleton.volumes.slice(workspace.volumes.length);
    if (futureVolumes.length === 0) {
      return null;
    }
    const saved = await this.volumeService.appendMissingRoutes(novelId, {...workspace, volumes: [...workspace.volumes, ...futureVolumes]});
    return saved.volumes.length > workspace.volumes.length ? saved : null;
  }

  private async countAvailableRoute(novelId: string, fromChapterOrder: number, workspace: VolumePlanDocument): Promise<number> {
    const chapters = await prisma.chapter.findMany({
      where: {novelId, order: {gte: fromChapterOrder}},
      orderBy: {order: "asc"}, select: {order: true},
    });
    const orders = new Set(chapters.map(chapter => chapter.order));
    if (orders.size !== chapters.length) throw new Error("Hay secuencias de capítulos repetidas en la novela y la ruta no se puede completar automáticamente.");
    return countPlannedRoutes(workspace, fromChapterOrder, orders);
  }

  private findNextRouteTarget(workspace: VolumePlanDocument): { volumeId: string; beatKey: string | null } | null {
    const volumes = workspace.volumes.slice().sort((left, right) => left.sortOrder - right.sortOrder);
    for (const volume of volumes) {
      const beatSheet = workspace.beatSheets.find((sheet) => sheet.volumeId === volume.id);
      if (!beatSheet || beatSheet.beats.length === 0) {
        return { volumeId: volume.id, beatKey: null };
      }
      for (const beat of beatSheet.beats) {
        const generatedCount = volume.chapters.filter((chapter) => (
          resolveVolumeChapterBeatKey({ chapter, volume, beatSheet }) === beat.key
        )).length;
        if (generatedCount < Math.max(1, getBeatExpectedChapterCount(beat))) {
          return { volumeId: volume.id, beatKey: beat.key };
        }
      }
    }
    return null;
  }
}

function countPlannedRoutes(workspace: VolumePlanDocument, from: number, savedOrders?: Set<number>): number {
  const counts = new Map<number, number>();
  for (const chapter of workspace.volumes.flatMap(volume => volume.chapters)) {
    counts.set(chapter.chapterOrder, (counts.get(chapter.chapterOrder) ?? 0)+1);
  }
  let end = from;
  while (counts.get(end) === 1 && (!savedOrders || savedOrders.has(end))) end++;
  return end-from;
}
