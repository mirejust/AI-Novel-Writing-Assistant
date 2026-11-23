import type { CharacterMindSnapshot, CharacterMindSnapshotSource } from "@ai-novel/shared/types/characterMind";
import { prisma } from "../../../db/prisma";
import { ChapterArtifactContentVersionError } from "../runtime/artifactSync/contracts";
import { runStructuredPrompt } from "../../../prompting/core/promptRunner";
import {
  buildCharacterMindContextBlocks,
  characterMindSnapshotPrompt,
} from "../../../prompting/prompts/novel/characterMind.prompts";
import type { CharacterMindDelta, CharacterMindSnapshotItem } from "../../../prompting/prompts/novel/characterMind.promptSchemas";
import type {Prisma} from "@prisma/client";

type MindGenerationOptions = {
  provider?: any;
  model?: string;
  temperature?: number;
  onlyMissing?: boolean;
  assertWriteOwnership?: (db: Prisma.TransactionClient) => Promise<void>;
};

type CharacterRow = {
  id: string;
  name: string;
  role: string;
  storyFunction: string | null;
  personality: string | null;
  background: string | null;
  development: string | null;
  currentState: string | null;
  currentGoal: string | null;
  identityLabel: string | null;
  factionLabel: string | null;
  stanceLabel: string | null;
  availability: string | null;
  outerGoal: string | null;
  innerNeed: string | null;
  fear: string | null;
  wound: string | null;
  misbelief: string | null;
  secret: string | null;
  moralLine: string | null;
};

function compact(value: string | null | undefined, fallback = ""): string {
  return String(value ?? "").replace(/\s+/g, " ").trim() || fallback;
}

function parseStringArray(raw: string | null | undefined): string[] {
  try {
    const parsed = JSON.parse(raw ?? "[]");
    return Array.isArray(parsed)
      ? parsed.map((item) => compact(String(item))).filter(Boolean).slice(0, 4)
      : [];
  } catch {
    return [];
  }
}

function serialize(row: {
  id: string;
  novelId: string;
  characterId: string;
  sourceChapterId: string | null;
  sourceChapter?: { order: number; title: string } | null;
  sourceType: string;
  currentInterpretation: string;
  privateIntent: string | null;
  activePlan: string | null;
  emotionalStance: string | null;
  actionTendency: string | null;
  decisionTrigger: string | null;
  beliefsJson: string;
  misbeliefsJson: string;
  evidenceJson: string;
  confidence: number | null;
  isCurrent: boolean;
  createdAt: Date;
  updatedAt: Date;
}): CharacterMindSnapshot {
  return {
    id: row.id,
    novelId: row.novelId,
    characterId: row.characterId,
    sourceChapterId: row.sourceChapterId,
    sourceChapterOrder: row.sourceChapter?.order ?? null,
    sourceChapterTitle: row.sourceChapter?.title ?? null,
    sourceType: row.sourceType as CharacterMindSnapshotSource,
    currentInterpretation: row.currentInterpretation,
    privateIntent: row.privateIntent,
    activePlan: row.activePlan,
    emotionalStance: row.emotionalStance,
    actionTendency: row.actionTendency,
    decisionTrigger: row.decisionTrigger,
    beliefs: parseStringArray(row.beliefsJson),
    misbeliefs: parseStringArray(row.misbeliefsJson),
    evidence: parseStringArray(row.evidenceJson),
    confidence: row.confidence,
    isCurrent: row.isCurrent,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toOptional(value: string | null | undefined): string | null {
  const normalized = compact(value);
  return normalized || null;
}

export class CharacterMindService {
  async getCurrentMindState(novelId: string, characterId: string): Promise<CharacterMindSnapshot | null> {
    const row = await prisma.characterMindSnapshot.findFirst({
      where: { novelId, characterId, isCurrent: true },
      orderBy: { updatedAt: "desc" },
      include: { sourceChapter: { select: { order: true, title: true } } },
    });
    return row ? serialize(row) : null;
  }

  async refreshMindState(
    novelId: string,
    characterId: string,
    options: MindGenerationOptions = {},
  ): Promise<CharacterMindSnapshot> {
    const snapshots = await this.generateSnapshots(novelId, [characterId], "manual_refresh", options);
    if (snapshots.length === 0) {
      throw new Error("La IA no logró organizar la línea de pensamiento del personaje actual. Inténtelo de nuevo más tarde.");
    }
    return snapshots[0];
  }

  async bootstrapMindStates(
    novelId: string,
    characterIds: string[],
    options: MindGenerationOptions = {},
  ): Promise<CharacterMindSnapshot[]> {
    return this.generateSnapshots(novelId, characterIds, "bootstrap", options);
  }

  async applyChapterMindDeltas(input: {
    novelId: string;
    chapterId: string;
    expectedChapterContent?: string;
    deltas: CharacterMindDelta[];
  }): Promise<number> {
    if (input.deltas.length === 0) {
      return 0;
    }
    const characters = await prisma.character.findMany({
      where: { novelId: input.novelId },
      select: { id: true, name: true },
    });
    const byName = new Map(characters.map((character) => [compact(character.name).replace(/\s+/g, "").toLowerCase(), character]));
    const normalized = input.deltas.flatMap((delta) => {
      const character = byName.get(compact(delta.characterName).replace(/\s+/g, "").toLowerCase());
      return character ? [{ characterId: character.id, snapshot: delta }] : [];
    });
    await this.persistSnapshots(input.novelId, normalized.map((item) => ({
      characterId: item.characterId,
      sourceChapterId: input.chapterId,
      sourceType: "artifact_delta" as const,
      expectedChapterContent: input.expectedChapterContent,
      snapshot: item.snapshot,
    })));
    return normalized.length;
  }

  private async generateSnapshots(
    novelId: string,
    requestedCharacterIds: string[],
    sourceType: "bootstrap" | "manual_refresh",
    options: MindGenerationOptions,
  ): Promise<CharacterMindSnapshot[]> {
    await options.assertWriteOwnership?.(prisma);
    let characterIds = Array.from(new Set(requestedCharacterIds.filter(Boolean)));
    if (options.onlyMissing) {
      const existing = await prisma.characterMindSnapshot.findMany({where: {novelId,
        characterId: {in: characterIds}, isCurrent: true}, select: {characterId: true}});
      const present = new Set(existing.map(item => item.characterId));
      characterIds = characterIds.filter(id => !present.has(id));
    }
    characterIds = characterIds.slice(0, 6);
    if (characterIds.length === 0) {
      return [];
    }
    const context = await this.loadContext(novelId, characterIds);
    const result = await runStructuredPrompt({
      asset: characterMindSnapshotPrompt,
      promptInput: { mode: sourceType === "bootstrap" ? "bootstrap" : "refresh" },
      contextBlocks: buildCharacterMindContextBlocks(context),
      options: {
        provider: options.provider,
        model: options.model,
        temperature: options.temperature ?? 0.35,
        novelId,
        stage: "character_mind",
        entrypoint: sourceType,
      },
    });
    const byName = new Map(context.characters.map((character) => [compact(character.name).replace(/\s+/g, "").toLowerCase(), character]));
    const accepted = result.output.snapshots.flatMap((snapshot) => {
      const character = byName.get(compact(snapshot.characterName).replace(/\s+/g, "").toLowerCase());
      return character ? [{ characterId: character.id, snapshot }] : [];
    });
    if (accepted.length === 0) {
      throw new Error("La línea de pensamiento del personaje no coincide con el personaje de la novela actual.");
    }
    return this.persistSnapshots(novelId, accepted.map((item) => ({
      characterId: item.characterId,
      sourceChapterId: null,
      sourceType,
      snapshot: item.snapshot,
    })), options);
  }

  private async persistSnapshots(inputNovelId: string, items: Array<{
    characterId: string;
    sourceChapterId: string | null;
    sourceType: CharacterMindSnapshotSource;
    expectedChapterContent?: string;
    snapshot: CharacterMindSnapshotItem | CharacterMindDelta;
  }>, options: Pick<MindGenerationOptions, "onlyMissing" | "assertWriteOwnership"> = {}): Promise<CharacterMindSnapshot[]> {
    if (items.length === 0) {
      return [];
    }
    const rows = await prisma.$transaction(async (tx) => {
      await options.assertWriteOwnership?.(tx);
      const created = [];
      const chapterArtifactIntegrity = items.find((item) => (
        item.sourceType === "artifact_delta" && item.sourceChapterId && item.expectedChapterContent !== undefined
      ));
      if (chapterArtifactIntegrity?.sourceChapterId) {
        const chapter = await tx.chapter.findFirst({
          where: {
            id: chapterArtifactIntegrity.sourceChapterId,
            novelId: inputNovelId,
            content: chapterArtifactIntegrity.expectedChapterContent,
          },
          select: { id: true },
        });
        if (!chapter) {
          throw new ChapterArtifactContentVersionError("La versión de texto del capítulo ha cambiado y se ha rechazado escribir la instantánea mental del personaje obsoleta.");
        }
      }
      const chapterArtifactCharacterIds = items
        .filter((item) => item.sourceType === "artifact_delta" && item.sourceChapterId)
        .map((item) => item.characterId);
      const chapterArtifactSourceChapterId = items.find((item) => (
        item.sourceType === "artifact_delta" && item.sourceChapterId
      ))?.sourceChapterId;
      if (chapterArtifactCharacterIds.length > 0 && chapterArtifactSourceChapterId) {
        await tx.characterMindSnapshot.deleteMany({
          where: {
            novelId: inputNovelId,
            sourceType: "artifact_delta",
            sourceChapterId: chapterArtifactSourceChapterId,
            characterId: { in: chapterArtifactCharacterIds },
          },
        });
      }
      for (const item of items) {
        if (options.onlyMissing && await tx.characterMindSnapshot.findFirst({where: {
          novelId: inputNovelId, characterId: item.characterId, isCurrent: true,
        }})) continue;
        await tx.characterMindSnapshot.updateMany({
          where: { novelId: inputNovelId, characterId: item.characterId, isCurrent: true },
          data: { isCurrent: false },
        });
        created.push(await tx.characterMindSnapshot.create({
          data: {
            novelId: inputNovelId,
            characterId: item.characterId,
            sourceChapterId: item.sourceChapterId,
            sourceType: item.sourceType,
            currentInterpretation: item.snapshot.currentInterpretation,
            privateIntent: toOptional(item.snapshot.privateIntent),
            activePlan: toOptional(item.snapshot.activePlan),
            emotionalStance: toOptional(item.snapshot.emotionalStance),
            actionTendency: toOptional(item.snapshot.actionTendency),
            decisionTrigger: toOptional(item.snapshot.decisionTrigger),
            beliefsJson: JSON.stringify(item.snapshot.beliefs ?? []),
            misbeliefsJson: JSON.stringify(item.snapshot.misbeliefs ?? []),
            evidenceJson: JSON.stringify(item.snapshot.evidence),
            confidence: item.snapshot.confidence,
            isCurrent: true,
          },
        }));
      }
      return created;
    });
    return rows.map(serialize);
  }

  private async loadContext(novelId: string, characterIds: string[]) {
    const [novel, resources, latestState, relationStages] = await Promise.all([
      prisma.novel.findUnique({
        where: { id: novelId },
        include: {
        bible: { select: { coreSetting: true, mainPromise: true } },
        storyMacroPlan: { select: { decompositionJson: true, constraintEngineJson: true } },
        bookContract: { select: { coreSellingPoint: true, relationshipMainline: true, escalationLadder: true } },
        characters: {
          where: { id: { in: characterIds } },
          select: {
            id: true, name: true, role: true, storyFunction: true, personality: true, background: true, development: true,
            currentState: true, currentGoal: true, identityLabel: true, factionLabel: true, stanceLabel: true, availability: true,
            outerGoal: true, innerNeed: true, fear: true, wound: true, misbelief: true, secret: true, moralLine: true,
          },
        },
        characterRelations: {
          where: { OR: [{ sourceCharacterId: { in: characterIds } }, { targetCharacterId: { in: characterIds } }] },
          include: { sourceCharacter: { select: { name: true } }, targetCharacter: { select: { name: true } } },
        },
        chapters: { where: { content: { not: "" } }, orderBy: { order: "desc" }, take: 2, select: { order: true, title: true, content: true } },
        },
      }),
      prisma.characterResourceLedgerItem.findMany({
        where: {
          novelId,
          OR: [
            { ownerCharacterId: { in: characterIds } },
            { holderCharacterId: { in: characterIds } },
          ],
        },
        orderBy: { updatedAt: "desc" },
        take: 12,
        select: {
          name: true, summary: true, status: true, holderCharacterId: true,
          holderCharacterName: true, ownerCharacterId: true, ownerName: true,
          readerKnows: true, holderKnows: true, knownByCharacterIdsJson: true, constraintsJson: true,
        },
      }),
      prisma.storyStateSnapshot.findFirst({
        where: { novelId },
        orderBy: { updatedAt: "desc" },
        select: {
          summary: true,
          characterStates: {
            where: { characterId: { in: characterIds } },
            select: { characterId: true, currentGoal: true, emotion: true, summary: true, knownFactsJson: true, misbeliefsJson: true },
          },
          informationStates: {
            where: {
              OR: [
                { holderType: "reader" },
                { holderRefId: { in: characterIds } },
              ],
            },
            select: { holderType: true, holderRefId: true, fact: true, status: true, summary: true },
            take: 12,
          },
        },
      }),
      prisma.characterRelationStage.findMany({
        where: {
          novelId,
          isCurrent: true,
          OR: [
            { sourceCharacterId: { in: characterIds } },
            { targetCharacterId: { in: characterIds } },
          ],
        },
        orderBy: { updatedAt: "desc" },
        take: 12,
        include: { sourceCharacter: { select: { name: true } }, targetCharacter: { select: { name: true } } },
      }),
    ]);
    if (!novel || novel.characters.length === 0) {
      throw new Error("La novela actual no tiene personajes cuyos pensamientos puedan ordenarse.");
    }
    const characters = novel.characters as CharacterRow[];
    const roster = characters.map((character) => [
      `Role:${character.name}(${character.role})`,
      `Características dramáticas:${compact(character.storyFunction, "No especificado")}`,
      `Personalidad/Antecedentes/Crecimiento:${compact(character.personality, "Pendiente")}|${compact(character.background, "Pendiente")}|${compact(character.development, "Pendiente")}`,
      `Metas y situación:${compact(character.currentGoal, "Por aclarar")}|${compact(character.currentState, "Por aclarar")}`,
      `Unidad interna:${compact(character.outerGoal, "")}|${compact(character.innerNeed, "")}|Miedo/herida=${compact(character.fear || character.wound, "")}`,
      `Errores de juicio/secretos/conclusión existentes:${compact(character.misbelief, "")}|${compact(character.secret, "")}|${compact(character.moralLine, "")}`,
    ].join("\n")).join("\n\n");
    const stateByCharacterId = new Map(latestState?.characterStates.map((state) => [state.characterId, state]) ?? []);
    const facts = [
      `novedoso:${novel.title}`,
      `Puntos de venta a nivel de libro:${compact(novel.bookContract?.coreSellingPoint || novel.bible?.mainPromise, "Pendiente")}`,
      `Restricciones de la línea principal:${compact(novel.storyMacroPlan?.decompositionJson, "Pendiente")}`,
      `Mundo y reglas:${compact(novel.bible?.coreSetting, "Pendiente")}`,
      latestState?.summary ? `Último estado de la historia oficial:${compact(latestState.summary)}` : "",
      ...characters.map((character) => {
        const state = stateByCharacterId.get(character.id);
        return state
          ? `Estado del personaje canónico:${character.name}|Objetivo=${compact(state.currentGoal, "No actualizado")}|Emoción=${compact(state.emotion, "No actualizado")}|Resumen=${compact(state.summary, "No actualizado")}`
          : "";
      }),
    ].join("\n");
    const relations = [
      ...relationStages.map((stage) => (
        `${stage.sourceCharacter.name} -> ${stage.targetCharacter.name}: etapa actual =${stage.stageLabel};${stage.stageSummary}${stage.nextTurnPoint ? `;Próximo giro=${stage.nextTurnPoint}` : ""}`
      )),
      ...novel.characterRelations.map((relation) => (
      `${relation.sourceCharacter.name} -> ${relation.targetCharacter.name}:${relation.surfaceRelation};ocultar tensión =${compact(relation.hiddenTension, "Ninguno")}`
      )),
    ].filter(Boolean).slice(0, 12).join("\n");
    const recentEvents = novel.chapters.map((chapter) => (
      `Cap.${chapter.order}capítulo"${chapter.title}»:${compact(chapter.content, "").slice(0, 900)}`
    )).join("\n\n");
    const resourcesText = resources.map((resource) => (
      `${resource.holderCharacterName || resource.ownerName || "Personaje"}Mantener/Asociar${resource.name}(${resource.status}):${compact(resource.summary)};Restricción=${compact(resource.constraintsJson, "Ninguno")}`
    )).join("\n");
    const informationBoundaries = [
      ...(latestState?.informationStates.map((state) => (
        `${state.holderType}${state.holderRefId ? `:${state.holderRefId}` : ""}|${state.status}|${state.fact}${state.summary ? `(${state.summary})` : ""}`
      )) ?? []),
      ...characters.flatMap((character) => {
        const state = stateByCharacterId.get(character.id);
        return state
          ? [
            ...parseStringArray(state.knownFactsJson).map((fact) => `${character.name}Conocido:${fact}`),
            ...parseStringArray(state.misbeliefsJson).map((fact) => `${character.name}Ha habido errores de juicio:${fact}`),
          ]
          : [];
      }),
    ].filter(Boolean).slice(0, 14).join("\n");
    return { characters, roster, facts, relations, recentEvents, resources: resourcesText, informationBoundaries };
  }
}

export const characterMindService = new CharacterMindService();
