import { prisma } from "../../db/prisma";
import { compactText, safeJsonParse } from "./utils/json";

interface BeatLite {
  order: number;
  summary: string;
}

export class DramaContextAssembler {
  async buildEpisodeContext(projectId: string, episodeOrder: number) {
    const project = await prisma.dramaProject.findUnique({
      where: { id: projectId },
      include: {
        sourceBundle: true,
        characters: true,
        facts: { orderBy: [{ episodeOrder: "asc" }, { createdAt: "asc" }] },
        episodes: { orderBy: { order: "asc" } },
      },
    });
    if (!project) {
      throw new Error(`Elementos dramáticos cortos no encontrados:${projectId}`);
    }
    // 防御：即使调用方传入字符串型 order 也能正确匹配
    const targetOrder = Number(episodeOrder);
    const episode = project.episodes.find((item) => item.order === targetOrder);
    if (!episode) {
      throw new Error(`Número de drama corto no encontrado ${episodeOrder} Establecer contorno.`);
    }
    const beats = safeJsonParse<BeatLite[]>(project.sourceBundle?.beats, []);
    const sourceMap = safeJsonParse<{ beatRefs?: number[] }>(episode.sourceMap, {});
    const relatedBeats = sourceMap.beatRefs?.length
      ? beats.filter((beat) => sourceMap.beatRefs?.includes(beat.order))
      : beats.slice(Math.max(0, episodeOrder - 2), episodeOrder + 2);

    return {
      project,
      episode,
      strategyJson: project.strategy ?? "{}",
      episodeJson: JSON.stringify({
        order: episode.order,
        title: episode.title,
        hookOpening: episode.hookOpening,
        hookType: episode.hookType,
        cliffhanger: episode.cliffhanger,
        emotionNet: episode.emotionNet,
        isPaywall: episode.isPaywall,
        beatSheet: safeJsonParse(episode.beatSheet, {}),
      }, null, 2),
      charactersDigest: project.characters.map((character) => {
        // 提取角色参考图 URL（形象图 + 三视图）
        const refImageUrls: string[] = [];
        if (character.portraitData) {
          try {
            const pd = JSON.parse(character.portraitData) as { status?: string; url?: string };
            if (pd.status === "done" && pd.url) refImageUrls.push(`Diagrama de imagen:${pd.url}`);
          } catch { /* skip */ }
        }
        if (character.threeViewData) {
          try {
            const tvd = JSON.parse(character.threeViewData) as Array<{ view?: string; status?: string; url?: string }>;
            for (const item of tvd) {
              if (item.status === "done" && item.url) refImageUrls.push(`${item.view}Ver:${item.url}`);
            }
          } catch { /* skip */ }
        }

        return [
          character.name,
          character.archetype ? `prototipo:${character.archetype}` : "",
          character.persona ? `Personaje:${character.persona}` : "",
          character.speechStyle ? `Tono:${character.speechStyle}` : "",
          character.visualAnchor ? `Visión:${compactText(character.visualAnchor, 160)}` : "",
          refImageUrls.length > 0 ? `Imagen de referencia: [${refImageUrls.join(",")}] (Por favor mantenga la coherencia visual del personaje)` : "",
          character.relations ? `relación:${compactText(character.relations, 160)}` : "",
        ].filter(Boolean).join(";");
      }).join("\n") || "Aún no hay recursos de personajes",
      factsDigest: project.facts.map((fact) => `E${fact.episodeOrder} ${fact.category}:${fact.text}`).join("\n") || "Aún no hay hechos",
      previousDigest: project.episodes
        .filter((item) => item.order < episodeOrder && item.content)
        .slice(-3)
        .map((item) => `Cap.${item.order}colocar"${item.title}»:${compactText(item.content, 260)}`)
        .join("\n") || "Aún no hay guión de reserva",
      sourceDigest: relatedBeats.map((beat) => `${beat.order}:${beat.summary}`).join("\n") || compactText(project.sourceBundle?.synopsis, 1000),
    };
  }
}

export const dramaContextAssembler = new DramaContextAssembler();
