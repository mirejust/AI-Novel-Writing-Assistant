import { prisma } from "../../db/prisma";
import { novelSetupStatusService } from "../../services/novel/NovelSetupStatusService";
import { AgentToolError, type AgentToolName } from "../types";
import type { AgentToolDefinition } from "./toolTypes";
import {
  createNovelInput,
  createNovelOutput,
  listNovelsInput,
  listNovelsOutput,
  selectNovelWorkspaceInput,
  selectNovelWorkspaceOutput,
  toNovelListItem,
} from "./novelToolShared";

async function resolveGenreIdByName(name: string | undefined): Promise<string | null> {
  if (!name?.trim()) {
    return null;
  }
  const candidates = await prisma.novelGenre.findMany({
    where: {
      name: {
        contains: name.trim(),
      },
    },
    orderBy: { updatedAt: "desc" },
    take: 8,
    select: {
      id: true,
      name: true,
    },
  });
  return candidates.find((item) => item.name.trim() === name.trim())?.id
    ?? candidates[0]?.id
    ?? null;
}

export const novelWorkspaceToolDefinitions: Partial<
  Record<AgentToolName, AgentToolDefinition<Record<string, unknown>, Record<string, unknown>>>
> = {
  list_novels: {
    name: "list_novels",
    title: "lista de novelas",
    description: "Enumera las novelas actualmente en el sistema, filtrables por título y estado del proyecto.",
    category: "read",
    riskLevel: "low",
    domainAgent: "NovelAgent",
    resourceScopes: ["global", "novel"],
    parserHints: {
      intent: "list_novels",
      aliases: ["lista de novelas", "lista de libros", "novels"],
      phrases: ["Listar novelas actuales", "¿Cuántas novelas hay actualmente?", "Ver el nuevo espacio de trabajo"],
      requiresNovelContext: false,
      whenToUse: "El usuario consulta la lista global de novelas, la cantidad o el espacio de trabajo conmutable.",
      whenNotToUse: "El usuario se ha fijado en una novela y pregunta sobre los capítulos, los personajes o el estado de producción.",
    },
    inputSchema: listNovelsInput,
    outputSchema: listNovelsOutput,
    execute: async (_context, rawInput) => {
      const input = listNovelsInput.parse(rawInput);
      const where = {
        ...(input.query
          ? {
            title: {
              contains: input.query,
            },
          }
          : {}),
        ...(input.projectStatus
          ? {
            projectStatus: input.projectStatus,
          }
          : {}),
      };
      const [total, rows] = await Promise.all([
        prisma.novel.count({ where }),
        prisma.novel.findMany({
          where,
          orderBy: { updatedAt: "desc" },
          take: input.limit ?? 10,
          include: {
            _count: {
              select: {
                chapters: true,
              },
            },
          },
        }),
      ]);
      return listNovelsOutput.parse({
        total,
        items: rows.map(toNovelListItem),
      });
    },
  },
  create_novel: {
    name: "create_novel",
    title: "crear una novela",
    description: "Crea una nueva novela y devuelve información básica del espacio de trabajo.",
    category: "mutate",
    riskLevel: "medium",
    domainAgent: "NovelAgent",
    resourceScopes: ["global", "novel"],
    parserHints: {
      intent: "create_novel",
      aliases: ["crear una novela", "Crear una nueva novela", "create novel"],
      phrases: ["Crea una novela \"xxx\"", "Crear un nuevo libro", "Crear un nuevo espacio de trabajo novedoso"],
      requiresNovelContext: false,
      whenToUse: "El usuario simplemente está creando una nueva novela.",
      whenNotToUse: "Toda la generación del libro comienza inmediatamente después de que se crea la solicitud del usuario, lo que está más cerca de producir_novel.",
    },
    inputSchema: createNovelInput,
    outputSchema: createNovelOutput,
    execute: async (_context, rawInput) => {
      const input = createNovelInput.parse(rawInput);
      const genreId = await resolveGenreIdByName(input.genre);
      const novel = await prisma.novel.create({
        data: {
          title: input.title,
          description: input.description ?? null,
          genreId,
          narrativePov: input.narrativePov,
          pacePreference: input.pacePreference,
          styleTone: input.styleTone ?? null,
          emotionIntensity: input.emotionIntensity,
          aiFreedom: input.aiFreedom,
          defaultChapterLength: input.defaultChapterLength,
          projectStatus: input.projectStatus ?? "in_progress",
          outlineStatus: "not_started",
          storylineStatus: "not_started",
          projectMode: input.projectMode ?? "auto_pipeline",
        },
      });
      const setup = await novelSetupStatusService.getNovelSetupStatus(novel.id);
      if (!setup) {
        throw new AgentToolError("INTERNAL", "No se pudo leer el estado de inicialización después de crear la novela.");
      }
      return createNovelOutput.parse({
        novelId: novel.id,
        title: novel.title,
        status: novel.status,
        chapterCount: 0,
        summary: `La novela "${novel.title}», actualmente ingresando al arranque de inicialización.`,
        setup,
      });
    },
  },
  select_novel_workspace: {
    name: "select_novel_workspace",
    title: "Seleccione un espacio de trabajo novedoso",
    description: "Seleccione una novela por título o ID para vincularla al espacio de trabajo actual del centro de creación.",
    category: "mutate",
    riskLevel: "low",
    domainAgent: "NovelAgent",
    resourceScopes: ["global", "novel"],
    parserHints: {
      intent: "select_novel_workspace",
      aliases: ["cambiar de novela", "Seleccionar espacio de trabajo", "select workspace"],
      phrases: ["Establecer \"xxx\" como el espacio de trabajo actual", "Cambiar a una novela", "Abrir el espacio de trabajo para esta novela."],
      requiresNovelContext: false,
      whenToUse: "El usuario desea vincular una novela como espacio de trabajo creativo actual.",
      whenNotToUse: "El usuario sólo quiere ver todas las novelas, no cambiar de contexto.",
    },
    inputSchema: selectNovelWorkspaceInput,
    outputSchema: selectNovelWorkspaceOutput,
    execute: async (_context, rawInput) => {
      const input = selectNovelWorkspaceInput.parse(rawInput);
      const novel = input.novelId
        ? await prisma.novel.findUnique({
          where: { id: input.novelId },
          include: {
            _count: {
              select: {
                chapters: true,
              },
            },
          },
        })
        : null;
      let resolved = novel ?? null;
      if (!resolved && input.title) {
        const candidates = await prisma.novel.findMany({
          where: {
            title: {
              contains: input.title,
            },
          },
          orderBy: { updatedAt: "desc" },
          take: 8,
          include: {
            _count: {
              select: {
                chapters: true,
              },
            },
          },
        });
        resolved = candidates.find((item) => item.title.trim() === input.title?.trim()) ?? candidates[0] ?? null;
      }
      if (!resolved) {
        throw new AgentToolError("NOT_FOUND", "No se encontró ninguna novela vinculante.");
      }
      const setup = await novelSetupStatusService.getNovelSetupStatus(resolved.id);
      if (!setup) {
        throw new AgentToolError("INTERNAL", "No se pudo leer el estado de inicialización después de cambiar de espacio de trabajo.");
      }
      return selectNovelWorkspaceOutput.parse({
        novelId: resolved.id,
        title: resolved.title,
        chapterCount: resolved._count.chapters,
        summary: `Cambiado a la novela "${resolved.title}»espacio de trabajo.`,
        setup,
      });
    },
  },
};
