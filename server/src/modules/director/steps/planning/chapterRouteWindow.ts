import type {StepHandler, StepContext} from "../../application";
import {latestArtifact} from "../../domain";

interface RouteChapter {chapterOrder: number}
interface RouteWorkspace<Chapter extends RouteChapter> {
  novelId: string;
  volumes: readonly {id: string; chapters: readonly Chapter[]}[];
}
interface RouteInput<Provider extends string> {
  targetVolumeId: string;
  provider?: Provider;
  model?: string;
  temperature?: number;
}
interface RouteWindowDependencies<Provider extends string, Chapter extends RouteChapter> {
  inputProvider: (context: StepContext) => Promise<RouteInput<Provider>>;
  routeService: {ensureRouteWindow(novelId: string, from: number, options: {
    min: number; target: number; provider?: Provider; model?: string; temperature?: number; taskId: string;
  }): Promise<{availableRouteCount: number; extended: boolean}>};
  volumeService: {getVolumes(novelId: string, options?: {hydrateCanonical?: boolean}): Promise<RouteWorkspace<Chapter>>};
  contentHash: (content: unknown) => string;
}

/** Production needs a saved opening window, not a complete target volume. */
export function createChapterRouteWindowStepHandler<Provider extends string, Chapter extends RouteChapter>(
  dependencies: RouteWindowDependencies<Provider, Chapter>,
): StepHandler {
  return async context => {
    const range = context.contract.chapterRange;
    if (!range || !Number.isInteger(range.from) || !Number.isInteger(range.to) || range.from < 1 || range.to < range.from) {
      throw new Error("La preparación de la ruta del texto requiere rangos de capítulos claros y válidos.");
    }
    const input = await dependencies.inputProvider(context);
    const novelId = context.contract.novelId;
    const remaining = range.to-range.from+1;
    const min = Math.min(3, remaining), target = Math.min(5, remaining);
    await dependencies.routeService.ensureRouteWindow(novelId, range.from, {
      min, target, provider: input.provider, model: input.model, temperature: input.temperature, taskId: context.runId,
    });
    const saved = await dependencies.volumeService.getVolumes(novelId, {hydrateCanonical: false});
    if (saved.novelId !== novelId) throw new Error("La ruta del capítulo guardado no pertenece a la novela actual.");
    const selected = saved.volumes.find(volume => volume.id === input.targetVolumeId);
    if (!selected?.chapters.some(chapter => chapter.chapterOrder === range.from)) throw new Error("Al capítulo inicial autorizado le falta la ruta del volumen objetivo.");
    const candidates = saved.volumes.flatMap(volume => [...volume.chapters])
      .filter(chapter => chapter.chapterOrder >= range.from && chapter.chapterOrder < range.from+target)
      .sort((a,b) => a.chapterOrder-b.chapterOrder);
    const routes: Chapter[] = [];
    for (let order = range.from; order < range.from+target; order++) {
      const matches = candidates.filter(chapter => chapter.chapterOrder === order);
      if (matches.length > 1) throw new Error("Hay secuencias de capítulos duplicadas en la ruta del capítulo; consulte el plan del libro.");
      if (!matches.length) break;
      routes.push(matches[0]);
    }
    if (routes.length < min) throw new Error("Al alcance de la autorización le falta una ruta de capítulo guardada contigua.");
    return {artifact: {scope: context.contract.scope, status: "draft",
      protectedUserContent: Boolean(latestArtifact(context.facts, "volume_chapter_list", context.contract.scope)?.protectedUserContent),
      contentRef: 'volume_chapter_list:'+novelId+':'+input.targetVolumeId,
      contentHash: dependencies.contentHash(routes)}};
  };
}
