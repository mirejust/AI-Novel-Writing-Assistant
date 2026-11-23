import type { LLMProvider } from "@ai-novel/shared/types/llm";
import { saveOpeningCast } from "./characterPrep/opening/saveOpeningCast";
import { prisma } from "../../db/prisma";
import { runStructuredPrompt } from "../../prompting/core/promptRunner";
import { novelProductionCharactersPrompt } from "../../prompting/prompts/novel/production.prompts";
import { WorldService } from "../world/WorldService";
import { getSharedNovelServices } from "./application/sharedNovelServices";
import { collectStream, extractJsonArray, parseStructuredOutline } from "./novelProductionHelpers";
import { novelProductionStatusService, type ProductionStatusResult } from "./NovelProductionStatusService";

interface NovelLlmOptions {
  provider?: LLMProvider;
  model?: string;
  temperature?: number;
}

export class NovelProductionService {
  private readonly novelService = getSharedNovelServices();

  private readonly worldService = new WorldService();

  async generateWorldForNovel(input: {
    novelId: string;
    description?: string;
    worldType?: string;
  } & NovelLlmOptions) {
    const novel = await prisma.novel.findUnique({
      where: { id: input.novelId },
      include: {
        world: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
    if (!novel) {
      throw new Error("Novela actual no encontrada.");
    }
    if (novel.world) {
      return {
        novelId: novel.id,
        worldId: novel.world.id,
        worldName: novel.world.name,
        reused: true,
        summary: `Se ha reutilizado la cosmovisión ligada a la novela actual"${novel.world.name}».`,
      };
    }

    const worldName = `${novel.title}visión del mundo`;
    const generatedAt = new Date();
    const { stream, onDone } = await this.worldService.createWorldGenerateStream({
      name: worldName,
      description: input.description?.trim() || novel.description?.trim() || `Para la novela "${novel.title}»Generar configuración de visión mundial`,
      worldType: input.worldType?.trim() || "custom",
      complexity: "standard",
      dimensions: {
        geography: true,
        culture: true,
        magicSystem: true,
        technology: true,
        history: true,
      },
      provider: input.provider,
      model: input.model,
    });
    const fullContent = await collectStream(stream);
    await onDone(fullContent);

    const world = await prisma.world.findFirst({
      where: {
        name: worldName,
        createdAt: {
          gte: generatedAt,
        },
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
      },
    });
    if (!world) {
      throw new Error("La generación de la cosmovisión se completó, pero no se pudo localizar el resultado de la generación.");
    }
    return {
      novelId: novel.id,
      worldId: world.id,
      worldName: world.name,
      reused: false,
      summary: `Ya por "${novel.title}»Generando una cosmovisión»${world.name}».`,
    };
  }

  async generateNovelCharacters(input: {
    novelId: string;
    description?: string;
    genre?: string;
    styleTone?: string;
    narrativePov?: "first_person" | "third_person" | "mixed";
    count?: number;
  } & NovelLlmOptions) {
    const novel = await prisma.novel.findUnique({
      where: { id: input.novelId },
      include: {
        world: {
          select: {
            id: true,
            name: true,
            description: true,
            background: true,
            conflicts: true,
            magicSystem: true,
          },
        },
        characters: {
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            name: true,
            role: true,
          },
        },
      },
    });
    if (!novel) {
      throw new Error("Novela actual no encontrada.");
    }
    if (novel.characters.length > 0) {
      return {
        novelId: novel.id,
        reused: true,
        characterCount: novel.characters.length,
        items: novel.characters,
        summary: `ha sido reutilizado${novel.title}"Existente ${novel.characters.length} un papel.`,
      };
    }

    const result = await runStructuredPrompt({
      asset: novelProductionCharactersPrompt,
      promptInput: {
        desiredCount: input.count,
        estimatedChapterCount: novel.estimatedChapterCount,
        title: novel.title,
        description: input.description?.trim() || novel.description?.trim() || "Sin datos",
        genre: input.genre?.trim() || "No especificado",
        narrativePov: input.narrativePov ?? "No especificado",
        styleTone: input.styleTone?.trim() || "No especificado",
        worldContext: novel.world
          ? `${novel.world.name}\n${novel.world.description ?? novel.world.background ?? ""}\n${novel.world.conflicts ?? ""}\n${novel.world.magicSystem ?? ""}`
          : "Aún no se ha consolidado ninguna visión del mundo.",
      },
      options: {
        provider: input.provider ?? "deepseek",
        model: input.model,
        temperature: input.temperature ?? 0.6,
      },
    });

    const {characters, reused} = await saveOpeningCast(novel.id, result.output);
    if (!reused) await this.novelService.rebuildCharacterDynamics(novel.id, {sourceType: "rebuild_projection"}).catch(() => null);
    return {
      novelId: novel.id, reused, characterCount: characters.length, items: characters,
      summary: reused ? `ha sido reutilizado${novel.title}"Existente ${characters.length} un papel.` : `Ya por "${novel.title}"generar ${characters.length} un papel central.`,
    };
  }

  async generateStoryBible(input: {
    novelId: string;
  } & NovelLlmOptions) {
    const { stream, onDone } = await this.novelService.createBibleStream(input.novelId, {
      provider: input.provider,
      model: input.model,
      temperature: input.temperature,
    });
    const fullContent = await collectStream(stream);
    await onDone(fullContent);
    const novel = await prisma.novel.findUnique({
      where: { id: input.novelId },
      include: {
        bible: true,
      },
    });
    if (!novel) {
      throw new Error("Novela actual no encontrada.");
    }
    return {
      novelId: novel.id,
      exists: Boolean(novel.bible),
      coreSetting: novel.bible?.coreSetting ?? null,
      mainPromise: novel.bible?.mainPromise ?? null,
      summary: `ha sido generado${novel.title}"Nueva Biblia.`,
    };
  }

  async generateNovelOutline(input: {
    novelId: string;
    description?: string;
  } & NovelLlmOptions) {
    const { stream, onDone } = await this.novelService.createOutlineStream(input.novelId, {
      provider: input.provider,
      model: input.model,
      temperature: input.temperature,
      initialPrompt: input.description,
    });
    const outline = await collectStream(stream);
    await onDone(outline);
    return {
      novelId: input.novelId,
      outline,
      outlineLength: outline.length,
      summary: "La tendencia de desarrollo de las novelas generadas.",
    };
  }

  async generateStructuredOutline(input: {
    novelId: string;
    targetChapterCount?: number;
  } & NovelLlmOptions) {
    const targetChapterCount = input.targetChapterCount ?? 20;
    const { stream, onDone } = await this.novelService.createStructuredOutlineStream(input.novelId, {
      provider: input.provider,
      model: input.model,
      temperature: input.temperature,
      totalChapters: targetChapterCount,
    });
    const structuredOutline = await collectStream(stream);
    await onDone(structuredOutline);
    const chapterCount = await prisma.chapter.count({
      where: { novelId: input.novelId },
    });
    const novel = await prisma.novel.findUnique({
      where: { id: input.novelId },
      select: { structuredOutline: true },
    });
    return {
      novelId: input.novelId,
      chapterCount,
      targetChapterCount,
      structuredOutline: novel?.structuredOutline ?? structuredOutline,
      summary: `Generado ${targetChapterCount} Esquema estructurado del capítulo.`,
    };
  }

  async syncChaptersFromStructuredOutline(novelId: string) {
    const novel = await prisma.novel.findUnique({
      where: { id: novelId },
      select: {
        id: true,
        structuredOutline: true,
      },
    });
    if (!novel) {
      throw new Error("Novela actual no encontrada.");
    }
    if (!novel.structuredOutline?.trim()) {
      throw new Error("Actualmente no existe un esquema estructurado para la novela.");
    }
    const chapters = parseStructuredOutline(novel.structuredOutline);
    if (chapters.length === 0) {
      throw new Error("No hay capítulos sincronizables en un esquema estructurado.");
    }

    const existing = await prisma.chapter.findMany({
      where: { novelId },
      select: { id: true, order: true },
    });
    const existingByOrder = new Map(existing.map((item) => [item.order, item.id]));
    let createdCount = 0;
    let updatedCount = 0;

    for (const chapter of chapters) {
      const existingId = existingByOrder.get(chapter.order);
      if (existingId) {
        await prisma.chapter.update({
          where: { id: existingId },
          data: {
            title: chapter.title,
            expectation: chapter.summary,
          },
        });
        updatedCount += 1;
      } else {
        await prisma.chapter.create({
          data: {
            novelId,
            title: chapter.title,
            order: chapter.order,
            content: "",
            expectation: chapter.summary,
            generationState: "planned",
          },
        });
        createdCount += 1;
      }
    }

    return {
      novelId,
      chapterCount: chapters.length,
      createdCount,
      updatedCount,
      summary: `Sincronizado ${chapters.length} Tabla de contenido.`,
    };
  }

  async startFullNovelPipeline(input: {
    novelId: string;
    startOrder?: number;
    endOrder?: number;
    maxRetries?: number;
    targetChapterCount?: number;
  } & NovelLlmOptions) {
    const chapterCount = await prisma.chapter.count({
      where: { novelId: input.novelId },
    });
    if (chapterCount === 0) {
      throw new Error("La novela actualmente no tiene una lista de capítulos, por lo que es imposible empezar a escribir el libro completo.");
    }
    const startOrder = input.startOrder ?? 1;
    const endOrder = input.endOrder ?? Math.max(chapterCount, input.targetChapterCount ?? chapterCount);
    const job = await this.novelService.startPipelineJob(input.novelId, {
      startOrder,
      endOrder,
      maxRetries: input.maxRetries,
      provider: input.provider,
      model: input.model,
      temperature: input.temperature,
    });
    return {
      novelId: input.novelId,
      jobId: job.id,
      status: job.status,
      startOrder: job.startOrder,
      endOrder: job.endOrder,
      summary: `Comenzó${job.startOrder}al tercero${job.endOrder}Tarea de redacción de capítulos para todo el libro.`,
    };
  }

  getNovelProductionStatus(input: {
    novelId?: string;
    title?: string;
    targetChapterCount?: number;
  }): Promise<ProductionStatusResult> {
    return novelProductionStatusService.getNovelProductionStatus(input);
  }
}

export const novelProductionService = new NovelProductionService();
