import { prisma } from "../../db/prisma";
import { ragServices } from "../../services/rag";
import { AgentToolError, type AgentToolName } from "../types";
import type { AgentToolDefinition } from "./toolTypes";
import { getChapter, getChapterByOrder } from "./shared";
import {
  getCharacterStatesInput,
  getCharacterStatesOutput,
  getChapterByOrderInput,
  getChapterByOrderOutput,
  getChapterContentInput,
  getChapterContentOutput,
  getNovelContextInput,
  getNovelContextOutput,
  getStoryBibleInput,
  getStoryBibleOutput,
  getTimelineFactsInput,
  getTimelineFactsOutput,
  getWorldConstraintsInput,
  getWorldConstraintsOutput,
  listChaptersInput,
  listChaptersOutput,
  searchKnowledgeInput,
  searchKnowledgeOutput,
  summarizeChapterRangeInput,
  summarizeChapterRangeOutput,
  toChapterOverview,
} from "./novelToolShared";

export const novelReadToolDefinitions: Partial<
  Record<AgentToolName, AgentToolDefinition<Record<string, unknown>, Record<string, unknown>>>
> = {
  get_novel_context: {
    name: "get_novel_context",
    title: "Lea la descripción general de la novela.",
    description: "Lea una descripción general de la novela, incluido el título, la sinopsis y la información de progreso.",
    category: "read",
    riskLevel: "low",
    domainAgent: "NovelAgent",
    resourceScopes: ["novel", "chapter"],
    inputSchema: getNovelContextInput,
    outputSchema: getNovelContextOutput,
    execute: async (_context, rawInput) => {
      const input = getNovelContextInput.parse(rawInput);
      const novel = await prisma.novel.findUnique({
        where: { id: input.novelId },
        include: {
          genre: {
            select: {
              name: true,
            },
          },
          world: {
            select: {
              id: true,
              name: true,
            },
          },
          chapters: {
            orderBy: { order: "desc" },
            take: 6,
            select: {
              id: true,
              order: true,
              title: true,
              content: true,
              chapterSummary: {
                select: {
                  summary: true,
                },
              },
            },
          },
        },
      });
      if (!novel) {
        throw new AgentToolError("NOT_FOUND", "Novel not found.");
      }
      const [chapterCount, completedChapters] = await Promise.all([
        prisma.chapter.count({ where: { novelId: input.novelId } }),
        prisma.chapter.findMany({
          where: {
            novelId: input.novelId,
            content: { not: "" },
          },
          orderBy: { order: "asc" },
          select: { order: true },
        }),
      ]);
      return getNovelContextOutput.parse({
        novelId: novel.id,
        title: novel.title,
        description: novel.description,
        genre: novel.genre?.name ?? null,
        styleTone: novel.styleTone ?? null,
        narrativePov: novel.narrativePov ?? null,
        pacePreference: novel.pacePreference ?? null,
        projectMode: novel.projectMode ?? null,
        emotionIntensity: novel.emotionIntensity ?? null,
        aiFreedom: novel.aiFreedom ?? null,
        defaultChapterLength: novel.defaultChapterLength ?? null,
        worldId: novel.world?.id ?? null,
        worldName: novel.world?.name ?? null,
        outline: novel.outline,
        structuredOutline: novel.structuredOutline,
        chapterCount,
        completedChapterCount: completedChapters.length,
        latestCompletedChapterOrder: completedChapters.at(-1)?.order ?? null,
        chapterSummary: [...novel.chapters]
          .sort((left, right) => left.order - right.order)
          .map((chapter) => toChapterOverview(chapter)),
      });
    },
  },
  list_chapters: {
    name: "list_chapters",
    title: "Listar metainformación del capítulo",
    description: "Enumera la metainformación de todos los capítulos de la novela para ubicarlos por número de capítulo.",
    category: "read",
    riskLevel: "low",
    domainAgent: "NovelAgent",
    resourceScopes: ["novel", "chapter"],
    inputSchema: listChaptersInput,
    outputSchema: listChaptersOutput,
    execute: async (_context, rawInput) => {
      const input = listChaptersInput.parse(rawInput);
      const items = await prisma.chapter.findMany({
        where: { novelId: input.novelId },
        orderBy: { order: "asc" },
        select: {
          id: true,
          order: true,
          title: true,
          content: true,
        },
      });
      return listChaptersOutput.parse({
        novelId: input.novelId,
        items: items.map((item) => ({
          id: item.id,
          order: item.order,
          title: item.title,
          hasContent: (item.content ?? "").trim().length > 0,
          contentLength: (item.content ?? "").length,
        })),
      });
    },
  },
  get_chapter_by_order: {
    name: "get_chapter_by_order",
    title: "Leer capítulos por número de serie",
    description: "Lea la metainformación del capítulo por número de capítulo.",
    category: "read",
    riskLevel: "low",
    domainAgent: "NovelAgent",
    resourceScopes: ["novel", "chapter"],
    inputSchema: getChapterByOrderInput,
    outputSchema: getChapterByOrderOutput,
    execute: async (_context, rawInput) => {
      const input = getChapterByOrderInput.parse(rawInput);
      const chapter = await getChapterByOrder(input.novelId, input.chapterOrder);
      return getChapterByOrderOutput.parse({
        novelId: input.novelId,
        chapterId: chapter.id,
        order: chapter.order,
        title: chapter.title,
        hasContent: (chapter.content ?? "").trim().length > 0,
        contentLength: (chapter.content ?? "").length,
      });
    },
  },
  get_chapter_content_by_order: {
    name: "get_chapter_content_by_order",
    title: "Leer el texto del capítulo por número de serie",
    description: "Lea el texto del capítulo por número de capítulo.",
    category: "read",
    riskLevel: "low",
    domainAgent: "NovelAgent",
    resourceScopes: ["novel", "chapter"],
    inputSchema: getChapterByOrderInput,
    outputSchema: getChapterContentOutput,
    execute: async (_context, rawInput) => {
      const input = getChapterByOrderInput.parse(rawInput);
      const chapter = await getChapterByOrder(input.novelId, input.chapterOrder);
      return getChapterContentOutput.parse({
        novelId: input.novelId,
        chapterId: chapter.id,
        title: chapter.title,
        order: chapter.order,
        content: chapter.content ?? "",
        contentLength: (chapter.content ?? "").length,
      });
    },
  },
  get_chapter_content: {
    name: "get_chapter_content",
    title: "Leer el texto del capítulo",
    description: "Lea el texto del capítulo por ID de capítulo o número de capítulo.",
    category: "read",
    riskLevel: "low",
    domainAgent: "NovelAgent",
    resourceScopes: ["novel", "chapter"],
    inputSchema: getChapterContentInput,
    outputSchema: getChapterContentOutput,
    execute: async (_context, rawInput) => {
      const input = getChapterContentInput.parse(rawInput);
      const chapter = input.chapterId
        ? await getChapter(input.novelId, input.chapterId)
        : await getChapterByOrder(input.novelId, input.chapterOrder as number);
      return getChapterContentOutput.parse({
        novelId: input.novelId,
        chapterId: chapter.id,
        title: chapter.title,
        order: chapter.order,
        content: chapter.content ?? "",
        contentLength: (chapter.content ?? "").length,
      });
    },
  },
  summarize_chapter_range: {
    name: "summarize_chapter_range",
    title: "Resumir el alcance del capítulo",
    description: "Resume un rango de capítulos específico, utilizado para los primeros N capítulos o para las preguntas y respuestas de capítulos consecutivos.",
    category: "inspect",
    riskLevel: "low",
    domainAgent: "NovelAgent",
    resourceScopes: ["novel", "chapter"],
    inputSchema: summarizeChapterRangeInput,
    outputSchema: summarizeChapterRangeOutput,
    execute: async (_context, rawInput) => {
      const input = summarizeChapterRangeInput.parse(rawInput);
      if (input.startOrder > input.endOrder) {
        throw new AgentToolError("INVALID_INPUT", "startOrder must be <= endOrder.");
      }
      const chapters = await prisma.chapter.findMany({
        where: {
          novelId: input.novelId,
          order: { gte: input.startOrder, lte: input.endOrder },
        },
        orderBy: { order: "asc" },
        select: {
          id: true,
          order: true,
          title: true,
          content: true,
          chapterSummary: {
            select: {
              summary: true,
            },
          },
        },
      });
      const summaryMode = chapters.every((chapter) => chapter.chapterSummary?.summary?.trim()) && input.mode === "summary"
        ? "chapter_summary"
        : "content_excerpt";
      const summary = chapters
        .map((chapter) => {
          const basis = summaryMode === "chapter_summary"
            ? chapter.chapterSummary?.summary?.trim() ?? ""
            : (chapter.content ?? "").slice(0, 260).trim();
          return `Cap.${chapter.order}capítulo"${chapter.title}»:${basis || "Aún no hay contenido disponible"}`;
        })
        .join("\n");
      return summarizeChapterRangeOutput.parse({
        novelId: input.novelId,
        startOrder: input.startOrder,
        endOrder: input.endOrder,
        chapterCount: chapters.length,
        summaryMode,
        summary,
        chapters: chapters.map((chapter) => toChapterOverview(chapter)),
      });
    },
  },
  get_story_bible: {
    name: "get_story_bible",
    title: "Leer la Biblia de ficción",
    description: "Lea mensajes bíblicos novedosos.",
    category: "read",
    riskLevel: "low",
    domainAgent: "NovelAgent",
    resourceScopes: ["novel"],
    inputSchema: getStoryBibleInput,
    outputSchema: getStoryBibleOutput,
    execute: async (_context, rawInput) => {
      const input = getStoryBibleInput.parse(rawInput);
      const bible = await prisma.novelBible.findUnique({
        where: { novelId: input.novelId },
      });
      return getStoryBibleOutput.parse({
        novelId: input.novelId,
        exists: Boolean(bible),
        coreSetting: bible?.coreSetting ?? null,
        forbiddenRules: bible?.forbiddenRules ?? null,
        mainPromise: bible?.mainPromise ?? null,
        characterArcs: bible?.characterArcs ?? null,
        worldRules: bible?.worldRules ?? null,
      });
    },
  },
  get_character_states: {
    name: "get_character_states",
    title: "Leer el estado del personaje",
    description: "Lea el estado del personaje de la novela.",
    category: "read",
    riskLevel: "low",
    domainAgent: "CharacterAgent",
    resourceScopes: ["novel", "chapter"],
    parserHints: {
      intent: "inspect_characters",
      aliases: ["personaje novedoso", "estado del personaje", "current novel characters"],
      phrases: ["Se han planeado varios personajes para este libro.", "¿Cuántos personajes hay en la novela actual?", "Enumerar el estado actual del personaje de la novela"],
      requiresNovelContext: true,
      whenToUse: "El usuario está viendo el estado, la cantidad o la lista de personajes de la novela actual.",
      whenNotToUse: "El usuario está viendo la biblioteca de plantillas de roles básicos.",
    },
    inputSchema: getCharacterStatesInput,
    outputSchema: getCharacterStatesOutput,
    execute: async (_context, rawInput) => {
      const input = getCharacterStatesInput.parse(rawInput);
      const items = await prisma.character.findMany({
        where: { novelId: input.novelId },
        orderBy: { updatedAt: "desc" },
        select: {
          id: true,
          name: true,
          role: true,
          currentState: true,
          currentGoal: true,
        },
      });
      return getCharacterStatesOutput.parse({
        novelId: input.novelId,
        count: items.length,
        items,
      });
    },
  },
  get_timeline_facts: {
    name: "get_timeline_facts",
    title: "Leer hechos de la línea de tiempo",
    description: "Lea hechos de la línea de tiempo y hechos de coherencia.",
    category: "inspect",
    riskLevel: "low",
    domainAgent: "NovelAgent",
    resourceScopes: ["novel", "chapter"],
    inputSchema: getTimelineFactsInput,
    outputSchema: getTimelineFactsOutput,
    execute: async (_context, rawInput) => {
      const input = getTimelineFactsInput.parse(rawInput);
      const rows = await prisma.consistencyFact.findMany({
        where: { novelId: input.novelId },
        orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
        take: input.limit ?? 30,
        select: {
          id: true,
          chapterId: true,
          category: true,
          content: true,
        },
      });
      return getTimelineFactsOutput.parse({
        novelId: input.novelId,
        count: rows.length,
        items: rows,
      });
    },
  },
  get_world_constraints: {
    name: "get_world_constraints",
    title: "Leer limitaciones de la cosmovisión",
    description: "Lea las reglas estrictas y las limitaciones de coherencia de la cosmovisión.",
    category: "inspect",
    riskLevel: "low",
    domainAgent: "WorldAgent",
    resourceScopes: ["world", "novel"],
    inputSchema: getWorldConstraintsInput,
    outputSchema: getWorldConstraintsOutput,
    execute: async (_context, rawInput) => {
      const input = getWorldConstraintsInput.parse(rawInput);
      let worldId = input.worldId ?? null;
      const novelId = input.novelId ?? null;
      if (!worldId && novelId) {
        const novel = await prisma.novel.findUnique({
          where: { id: novelId },
          select: { worldId: true },
        });
        worldId = novel?.worldId ?? null;
      }
      if (!worldId) {
        return getWorldConstraintsOutput.parse({
          worldId: null,
          novelId,
          worldName: null,
          constraints: {
            axioms: null,
            magicSystem: null,
            conflicts: null,
            consistencyReport: null,
          },
        });
      }
      const world = await prisma.world.findUnique({
        where: { id: worldId },
        select: {
          id: true,
          name: true,
          axioms: true,
          magicSystem: true,
          conflicts: true,
          consistencyReport: true,
        },
      });
      if (!world) {
        throw new AgentToolError("NOT_FOUND", "World not found.");
      }
      return getWorldConstraintsOutput.parse({
        worldId: world.id,
        novelId,
        worldName: world.name,
        constraints: {
          axioms: world.axioms ?? null,
          magicSystem: world.magicSystem ?? null,
          conflicts: world.conflicts ?? null,
          consistencyReport: world.consistencyReport ?? null,
        },
      });
    },
  },
  search_knowledge: {
    name: "search_knowledge",
    title: "Buscar base de conocimientos",
    description: "Recupera la base de conocimientos y devuelve el bloque de contexto.",
    category: "inspect",
    riskLevel: "low",
    domainAgent: "KnowledgeAgent",
    resourceScopes: ["knowledge_document", "novel", "world"],
    parserHints: {
      intent: "search_knowledge",
      aliases: ["Búsqueda de base de conocimientos", "Búsqueda de conocimiento", "knowledge search", "Configurar búsquedas de referencias", "Búsqueda de referencias de visión del mundo."],
      phrases: [
        "Buscar en la base de conocimientos",
        "Consulta la información relevante",
        "Encuentre información de la base de conocimientos",
        "Buscar configuraciones similares",
        "¿Existe alguna referencia similar a un entorno determinado?",
        "Encuentre referencias de libros abiertos o visiones del mundo.",
      ],
      requiresNovelContext: false,
      whenToUse: "El usuario solicita recuperar una determinada palabra clave, entorno, modelo de relación, tema o arquetipo de cosmovisión, especialmente buscando referencias similares, y la respuesta puede existir en la base de conocimientos, materiales de libros abiertos indexados o base de datos de cosmovisión.",
      whenNotToUse: "El usuario claramente ha querido ver detalles de una visión del mundo específica, detalles de tareas específicas de apertura de libros, listas de novelas específicas o contenido de capítulos específicos.",
    },
    inputSchema: searchKnowledgeInput,
    outputSchema: searchKnowledgeOutput,
    execute: async (_context, rawInput) => {
      const input = searchKnowledgeInput.parse(rawInput);
      const contextBlock = await ragServices.hybridRetrievalService.buildContextBlock(input.query, {
        novelId: input.novelId,
        worldId: input.worldId,
        finalTopK: input.topK ?? 6,
      });
      const hitCount = contextBlock ? contextBlock.split("[RAG-").length - 1 : 0;
      return searchKnowledgeOutput.parse({
        query: input.query,
        contextBlock,
        hitCount,
      });
    },
  },
};
