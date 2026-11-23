import { prisma } from "../../db/prisma";
import { runStructuredPrompt } from "../../prompting/core/promptRunner";
import {
  characterEvolutionPrompt,
  characterWorldCheckPrompt,
} from "../../prompting/prompts/novel/coreCharacter.prompts";
import { ragServices } from "../rag";
import { queueRagDelete, queueRagUpsert } from "./novelCoreSupport";
import { WorldContextGateway } from "./worldContext/WorldContextGateway";
import {
  CharacterInput,
  CharacterTimelineSyncOptions,
  extractCharacterEventLines,
  LLMGenerateOptions,
} from "./novelCoreShared";
import { serializeCharacterProhibitions } from "./characters/characterHardFacts";

export class NovelCoreCharacterService {
  private readonly worldContextGateway = new WorldContextGateway();

  async listCharacters(novelId: string) {
    return prisma.character.findMany({ where: { novelId }, orderBy: { createdAt: "asc" } });
  }

  async createCharacter(novelId: string, input: CharacterInput) {
    let payload: CharacterInput = { ...input };
    if (input.baseCharacterId) {
      const baseCharacter = await prisma.baseCharacter.findUnique({
        where: { id: input.baseCharacterId },
      });
      if (!baseCharacter) {
        throw new Error("El rol básico no existe.");
      }
      payload = {
        ...payload,
        personality: input.personality ?? baseCharacter.personality,
        background: input.background ?? baseCharacter.background,
        development: input.development ?? baseCharacter.development,
        appearance: input.appearance ?? baseCharacter.appearance ?? undefined,
      };
    }

    const { prohibitions, ...data } = payload;
    const created = await prisma.character.create({
      data: {
        novelId,
        ...data,
        ...(prohibitions ? { prohibitionsJson: serializeCharacterProhibitions(prohibitions) } : {}),
      },
    });
    queueRagUpsert("character", created.id);
    return created;
  }

  async updateCharacter(novelId: string, characterId: string, input: Partial<CharacterInput>) {
    const exists = await prisma.character.findFirst({
      where: { id: characterId, novelId },
      select: { id: true, currentState: true, currentGoal: true },
    });
    if (!exists) {
      throw new Error("el rol no existe");
    }

    const hasStateChanged = typeof input.currentState === "string" && input.currentState !== exists.currentState;
    const hasGoalChanged = typeof input.currentGoal === "string" && input.currentGoal !== exists.currentGoal;
    const { prohibitions, ...data } = input;
    const updated = await prisma.character.update({
      where: { id: characterId },
      data: {
        ...data,
        ...(prohibitions ? { prohibitionsJson: serializeCharacterProhibitions(prohibitions) } : {}),
        ...(hasStateChanged || hasGoalChanged ? { lastEvolvedAt: new Date() } : {}),
      },
    });

    queueRagUpsert("character", updated.id);
    return updated;
  }

  async deleteCharacter(novelId: string, characterId: string) {
    queueRagDelete("character", characterId);
    const deleted = await prisma.character.deleteMany({ where: { id: characterId, novelId } });
    if (deleted.count === 0) {
      throw new Error("el rol no existe");
    }
  }

  async listCharacterTimeline(novelId: string, characterId: string) {
    return prisma.characterTimeline.findMany({
      where: { novelId, characterId },
      orderBy: [{ chapterOrder: "asc" }, { createdAt: "asc" }],
    });
  }

  async syncCharacterTimeline(
    novelId: string,
    characterId: string,
    options: CharacterTimelineSyncOptions = {},
  ) {
    const character = await prisma.character.findFirst({
      where: { id: characterId, novelId },
    });
    if (!character) {
      throw new Error("el rol no existe");
    }

    const chapters = await prisma.chapter.findMany({
      where: {
        novelId,
        ...(typeof options.startOrder === "number" || typeof options.endOrder === "number"
          ? {
            order: {
              gte: options.startOrder ?? undefined,
              lte: options.endOrder ?? undefined,
            },
          }
          : {}),
      },
      orderBy: { order: "asc" },
      select: {
        id: true,
        order: true,
        title: true,
        content: true,
      },
    });

    const events: Array<{
      novelId: string;
      characterId: string;
      chapterId: string;
      chapterOrder: number;
      title: string;
      content: string;
      source: string;
    }> = [];

    for (const chapter of chapters) {
      const content = chapter.content ?? "";
      if (!content) {
        continue;
      }
      const lines = extractCharacterEventLines(content, character.name, 3);
      for (const line of lines) {
        events.push({
          novelId,
          characterId,
          chapterId: chapter.id,
          chapterOrder: chapter.order,
          title: `${chapter.order} · ${chapter.title}`,
          content: line,
          source: "chapter_extract",
        });
      }
    }

    await prisma.$transaction(async (tx) => {
      await tx.characterTimeline.deleteMany({
        where: {
          novelId,
          characterId,
          source: "chapter_extract",
          ...(typeof options.startOrder === "number" || typeof options.endOrder === "number"
            ? {
              chapterOrder: {
                gte: options.startOrder ?? undefined,
                lte: options.endOrder ?? undefined,
              },
            }
            : {}),
        },
      });
      if (events.length > 0) {
        await tx.characterTimeline.createMany({
          data: events,
        });
      }
    });

    const total = await prisma.characterTimeline.count({
      where: { novelId, characterId },
    });

    return {
      characterId,
      syncedCount: events.length,
      totalTimelineCount: total,
    };
  }

  async syncAllCharacterTimeline(novelId: string, options: CharacterTimelineSyncOptions = {}) {
    const characters = await prisma.character.findMany({
      where: { novelId },
      select: { id: true },
      orderBy: { createdAt: "asc" },
    });
    if (characters.length === 0) {
      return {
        characterCount: 0,
        syncedCount: 0,
        details: [] as Array<{ characterId: string; syncedCount: number; totalTimelineCount: number }>,
      };
    }

    const details = await Promise.all(
      characters.map((character) => this.syncCharacterTimeline(novelId, character.id, options)),
    );
    const syncedCount = details.reduce((sum, item) => sum + item.syncedCount, 0);

    return {
      characterCount: characters.length,
      syncedCount,
      details,
    };
  }

  async evolveCharacter(
    novelId: string,
    characterId: string,
    options: LLMGenerateOptions = {},
  ) {
    const [novel, character, timelines] = await Promise.all([
      prisma.novel.findUnique({
        where: { id: novelId },
        include: { bible: true },
      }),
      prisma.character.findFirst({
        where: { id: characterId, novelId },
      }),
      prisma.characterTimeline.findMany({
        where: { novelId, characterId },
        orderBy: [{ chapterOrder: "desc" }, { createdAt: "desc" }],
        take: 20,
      }),
    ]);

    if (!novel || !character) {
      throw new Error("La novela o el personaje no existe.");
    }

    const timelineText = timelines.length > 0
      ? timelines
        .map((item) => `${item.title}: ${item.content}`)
        .join("\n")
      : "Aún no hay eventos en la línea de tiempo";

    let ragContext = "";
    try {
      ragContext = await ragServices.hybridRetrievalService.buildContextBlock(
        `Evolución del personaje ${character.name}\n${timelineText}`,
        {
          novelId,
          ownerTypes: ["character", "character_timeline", "chapter_summary", "consistency_fact", "novel", "bible"],
          finalTopK: 6,
        },
      );
    } catch {
      ragContext = "";
    }

    const result = await runStructuredPrompt({
      asset: characterEvolutionPrompt,
      promptInput: {
        novelTitle: novel.title,
        bibleContent: novel.bible?.rawContent ?? "Sin datos",
        characterName: character.name,
        characterRole: character.role,
        personality: character.personality ?? "Sin datos",
        background: character.background ?? "Sin datos",
        development: character.development ?? "Sin datos",
        currentState: character.currentState ?? "Sin datos",
        currentGoal: character.currentGoal ?? "Sin datos",
        timelineText,
        ragContext: ragContext || "",
      },
      options: {
        provider: options.provider,
        model: options.model,
        temperature: options.temperature ?? 0.4,
      },
    });
    const parsed = result.output;

    const updated = await prisma.character.update({
      where: { id: characterId },
      data: {
        personality: parsed.personality ?? character.personality,
        background: parsed.background ?? character.background,
        development: parsed.development ?? character.development,
        currentState: parsed.currentState ?? character.currentState,
        currentGoal: parsed.currentGoal ?? character.currentGoal,
        lastEvolvedAt: new Date(),
      },
    });

    await prisma.characterTimeline.create({
      data: {
        novelId,
        characterId,
        title: `Actualizaciones de evolución de personajes · ${new Date().toLocaleString("zh-CN")}`,
        content: `estado:${updated.currentState ?? "Sin datos"};Objetivo:${updated.currentGoal ?? "Sin datos"}`,
        source: "ai_evolve",
      },
    });

    return updated;
  }

  async checkCharacterAgainstWorld(
    novelId: string,
    characterId: string,
    options: LLMGenerateOptions = {},
  ) {
    const [novel, character] = await Promise.all([
      prisma.novel.findUnique({
        where: { id: novelId },
        select: { id: true },
      }),
      prisma.character.findFirst({
        where: { id: characterId, novelId },
      }),
    ]);
    if (!novel || !character) {
      throw new Error("La novela o el personaje no existe.");
    }
    const worldContextBlock = await this.worldContextGateway.getWorldContextBlock(novelId, {
      purpose: "character",
      provider: options.provider,
      model: options.model,
      temperature: options.temperature,
    });
    if (!worldContextBlock) {
      return {
        status: "pass" as const,
        warnings: ["Actualmente no hay un contexto mundial disponible para que este libro realice comprobaciones estrictas de las reglas mundiales."],
        issues: [],
      };
    }

    const worldContext = worldContextBlock.promptBlock;
    try {
      const result = await runStructuredPrompt({
        asset: characterWorldCheckPrompt,
        promptInput: {
          worldContext,
          characterName: character.name,
          characterRole: character.role,
          personality: character.personality ?? "",
          background: character.background ?? "",
          development: character.development ?? "",
          currentState: character.currentState ?? "",
          currentGoal: character.currentGoal ?? "",
        },
        options: {
          provider: options.provider,
          model: options.model,
          temperature: options.temperature ?? 0.2,
        },
      });
      const parsed = result.output;

      return {
        status: parsed.status ?? "pass",
        warnings: Array.isArray(parsed.warnings) ? parsed.warnings : [],
        issues: Array.isArray(parsed.issues) ? parsed.issues : [],
      };
    } catch {
      return {
        status: "warn" as const,
        warnings: ["La verificación de IA falla y se devuelve el resultado de la reversión de las reglas"],
        issues: [] as Array<{ severity: "warn" | "error"; message: string; suggestion?: string }>,
      };
    }
  }
}
