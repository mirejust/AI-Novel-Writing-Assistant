import {
  characterLocationProjectionSchema,
  type CharacterLocationDelta,
  type CharacterLocationState,
} from "@ai-novel/shared/types/characterLocation";
import { prisma } from "../../../../db/prisma";
import { authorizeManualRevision, buildChapterArtifactContentHash, ChapterArtifactContentVersionError, type ManualRevisionProof } from "../../runtime/artifactSync/contracts";
import { projectLocationDeltas } from "./locationProjection";

export const CHARACTER_LOCATION_ARTIFACT_TYPE = "character_location_projection:v1";
const SYNC_MODE = "director_v2";
const PAGE_SIZE = 50;

export class CharacterLocationService {
  async applyFinalChapter(input: ManualRevisionProof & {
    novelId: string; chapterId: string; content: string; contentHash: string;
    deltas: CharacterLocationDelta[];
    contentProvenance?: "confirmed" | "debt";
  }): Promise<void> {
    if (buildChapterArtifactContentHash(input.content) !== input.contentHash) throw new ChapterArtifactContentVersionError();
    await prisma.$transaction(async tx => {
      await authorizeManualRevision(tx, input);
      const chapter = await tx.chapter.findFirst({
        where: { id: input.chapterId, novelId: input.novelId, content: input.content },
        select: { id: true, order: true, novel: { select: { directorVersion: true } } },
      });
      if (!chapter) throw new ChapterArtifactContentVersionError();
      if (chapter.novel.directorVersion !== "v2") throw new Error("El reemplazo de posiciones de personajes solo está disponible en Director V2.");
      const characters = await tx.character.findMany({
        where: { novelId: input.novelId }, select: { id: true, name: true },
      });
      const projection = characterLocationProjectionSchema.parse({
        schemaVersion: 1, novelId: input.novelId, chapterId: input.chapterId,
        chapterOrder: chapter.order, contentHash: input.contentHash,
        contentProvenance: input.contentProvenance ?? "confirmed",
        records: projectLocationDeltas({ content: input.content, characters, deltas: input.deltas, contentProvenance: input.contentProvenance }),
      });
      const identity = {
        novelId: input.novelId, chapterId: input.chapterId, contentHash: input.contentHash,
        artifactType: CHARACTER_LOCATION_ARTIFACT_TYPE, syncMode: SYNC_MODE,
      };
      const data = { status: "succeeded", metadataJson: JSON.stringify(projection) };
      await tx.chapterArtifactSyncCheckpoint.upsert({
        where: { novelId_chapterId_contentHash_artifactType_syncMode: identity },
        create: { ...identity, ...data, sourceType: "chapter_artifact_delta", sourceStage: "chapter_execution" },
        update: data,
      });
    });
  }

  async readBeforeChapter(input: {
    novelId: string; chapterOrder: number;
    characters: Array<{ id: string; name: string; currentLocation?: string | null }>;
  }): Promise<Map<string, CharacterLocationState>> {
    const result = new Map<string, CharacterLocationState>(input.characters.map(character => [character.id, {
      currentLocation: character.currentLocation?.trim() || null,
      source: character.currentLocation?.trim() ? "profile" : "unknown",
      sourceChapterId: null, sourceChapterOrder: null, contentHash: null, evidence: null, concern: null,
    }]));
    const resolved = new Set<string>();
    for (let skip = 0; result.size > resolved.size; skip += PAGE_SIZE) {
      const rows = await prisma.chapterArtifactSyncCheckpoint.findMany({
        where: {
          novelId: input.novelId, artifactType: CHARACTER_LOCATION_ARTIFACT_TYPE,
          syncMode: SYNC_MODE, status: "succeeded",
          chapter: { novelId: input.novelId, order: { lt: input.chapterOrder } },
        },
        orderBy: [{ chapter: { order: "desc" } }, { updatedAt: "desc" }, { id: "asc" }],
        skip, take: PAGE_SIZE,
        select: {
          novelId: true, chapterId: true, contentHash: true, metadataJson: true,
          chapter: { select: { id: true, novelId: true, order: true, content: true } },
        },
      });
      for (const row of rows) {
        if (row.novelId !== input.novelId || row.chapter.novelId !== input.novelId
          || row.chapter.order >= input.chapterOrder || row.chapter.id !== row.chapterId
          || !row.chapter.content || buildChapterArtifactContentHash(row.chapter.content) !== row.contentHash) continue;
        const projection = characterLocationProjectionSchema.parse(JSON.parse(row.metadataJson || "null"));
        if (projection.novelId !== row.novelId || projection.chapterId !== row.chapterId
          || projection.chapterOrder !== row.chapter.order || projection.contentHash !== row.contentHash) {
          throw new Error("El registro de ubicación del personaje no coincide con la fuente del texto; verifíquelo antes de continuar.");
        }
        for (const record of projection.records) {
          const previous = result.get(record.characterId);
          if (!previous || resolved.has(record.characterId)) continue;
          if (record.concern || projection.contentProvenance === "debt") {
            if (!previous.concern) previous.concern = `Cap. ${row.chapter.order} capítulo:${record.concern || "Es necesario comprobar la calidad de los capítulos de donde provienen los cambios de ubicación."}`;
            continue;
          }
          if (!record.locationName || !record.evidence
            || !row.chapter.content.replace(/\s+/g, " ").includes(record.evidence.replace(/\s+/g, " ").trim())) continue;
          result.set(record.characterId, {
            currentLocation: record.locationName, source: "chapter", sourceChapterId: row.chapterId,
            sourceChapterOrder: row.chapter.order, contentHash: row.contentHash,
            evidence: record.evidence, concern: previous.concern,
          });
          resolved.add(record.characterId);
        }
      }
      if (rows.length < PAGE_SIZE) break;
    }
    return result;
  }
}

export const characterLocationService = new CharacterLocationService();

export function formatCharacterLocationContext(
  characters: Array<{ id: string; name: string }>, states: Map<string, CharacterLocationState>,
): string {
  return characters.map(character => {
    const state = states.get(character.id);
    if (!state) return "";
    return [
      `${character.id} | ${character.name} | Última ubicación confirmada=${state.currentLocation || "Desconocido"}`,
      state.sourceChapterOrder !== null ? `Fuente = No.${state.sourceChapterOrder}cap.` : "Fuente = configuración básica, aún no hay registro de ubicación de texto",
      state.evidence ? `evidencia =${state.evidence}` : "",
      state.concern ? `Por verificar =${state.concern}` : "",
    ].filter(Boolean).join(" | ");
  }).filter(Boolean).join("\n");
}
