import { prisma } from "../../db/prisma";
import { AgentToolError, type AgentToolName } from "../types";
import type { AgentToolDefinition } from "./toolTypes";
import {
  bindWorldToNovelInputSchema,
  bindWorldToNovelOutputSchema,
  explainWorldConflictInputSchema,
  explainWorldConflictOutputSchema,
  getWorldDetailOutputSchema,
  listWorldsInputSchema,
  listWorldsOutputSchema,
  rebuildStoryWorldSliceInputSchema,
  rebuildStoryWorldSliceOutputSchema,
  unbindWorldFromNovelInputSchema,
  unbindWorldFromNovelOutputSchema,
  worldIdInputSchema,
} from "./worldToolSchemas";
import { NovelWorldSliceService } from "../../services/novel/storyWorldSlice/NovelWorldSliceService";

const novelWorldSliceService = new NovelWorldSliceService();

export const worldToolDefinitions: Partial<
  Record<AgentToolName, AgentToolDefinition<Record<string, unknown>, Record<string, unknown>>>
> = {
  list_worlds: {
    name: "list_worlds",
    title: "lista de cosmovisión",
    description: "Lea la lista de cosmovisiones, la versión y el estado general.",
    category: "read",
    riskLevel: "low",
    domainAgent: "WorldAgent",
    resourceScopes: ["world"],
    parserHints: {
      intent: "list_worlds",
      aliases: ["lista de visiones del mundo", "base de datos de cosmovisión", "worlds"],
      phrases: ["Haz una lista de visiones del mundo", "¿Qué cosmovisiones existen actualmente?", "Ver lista de cosmovisiones"],
      requiresNovelContext: false,
      whenToUse: "Los usuarios quieren ver recursos de cosmovisión global.",
      whenNotToUse: "El usuario vincula o examina una visión del mundo específica para la novela actual.",
    },
    inputSchema: listWorldsInputSchema,
    outputSchema: listWorldsOutputSchema,
    execute: async (_context, rawInput) => {
      const input = listWorldsInputSchema.parse(rawInput);
      const rows = await prisma.world.findMany({
        orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
        take: input.limit ?? 20,
      });
      return listWorldsOutputSchema.parse({
        items: rows.map((row) => ({
          id: row.id,
          name: row.name,
          worldType: row.worldType ?? null,
          status: row.status,
          version: row.version,
          overviewSummary: row.overviewSummary ?? null,
          updatedAt: row.updatedAt.toISOString(),
        })),
        summary: `Leer ${rows.length} una cosmovisión.`,
      });
    },
  },
  bind_world_to_novel: {
    name: "bind_world_to_novel",
    title: "Vincular la visión del mundo de la novela.",
    description: "Vincula la cosmovisión especificada a la cosmovisión de la novela actual.",
    category: "mutate",
    riskLevel: "medium",
    domainAgent: "WorldAgent",
    resourceScopes: ["world", "novel"],
    parserHints: {
      intent: "bind_world_to_novel",
      aliases: ["Vincular la visión del mundo", "Configurar la visión del mundo de la novela."],
      phrases: ["Establecer una determinada visión del mundo como la visión del mundo de la novela actual.", "Vincular la cosmovisión a la cosmovisión de la novela actual."],
      requiresNovelContext: true,
      whenToUse: "El usuario debe vincular una determinada visión del mundo a la novela actual.",
      whenNotToUse: "El usuario sólo quiere ver la lista de vistas del mundo o los detalles.",
    },
    inputSchema: bindWorldToNovelInputSchema,
    outputSchema: bindWorldToNovelOutputSchema,
    execute: async (_context, rawInput) => {
      const input = bindWorldToNovelInputSchema.parse(rawInput);
      const novel = await prisma.novel.findUnique({
        where: { id: input.novelId },
        select: {
          id: true,
          title: true,
        },
      });
      if (!novel) {
        throw new AgentToolError("NOT_FOUND", "Novela actual no encontrada.");
      }

      const resolvedWorld = input.worldId
        ? await prisma.world.findUnique({
          where: { id: input.worldId },
          select: { id: true, name: true },
        })
        : (() => undefined)();
      let world = resolvedWorld ?? null;
      if (!world && input.worldName) {
        const candidates = await prisma.world.findMany({
          where: {
            name: {
              contains: input.worldName,
            },
          },
          orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
          take: 8,
          select: {
            id: true,
            name: true,
          },
        });
        world = candidates.find((item) => item.name.trim() === input.worldName?.trim()) ?? candidates[0] ?? null;
      }

      if (!world) {
        throw new AgentToolError("NOT_FOUND", "No se ha encontrado ninguna cosmovisión que esté ligada.");
      }

      await prisma.novel.update({
        where: { id: novel.id },
        data: {
          worldId: world.id,
        },
      });

      return bindWorldToNovelOutputSchema.parse({
        novelId: novel.id,
        novelTitle: novel.title,
        worldId: world.id,
        worldName: world.name,
        summary: `La visión del mundo ha sido${world.name}"Unido a la novela"${novel.title}».`,
      });
    },
  },
  unbind_world_from_novel: {
    name: "unbind_world_from_novel",
    title: "Desvincular la cosmovisión de la novela.",
    description: "Desvincular la novela actual de la cosmovisión encuadernada.",
    category: "mutate",
    riskLevel: "medium",
    domainAgent: "WorldAgent",
    resourceScopes: ["world", "novel"],
    parserHints: {
      intent: "unbind_world_from_novel",
      aliases: ["Desvincular la cosmovisión", "Cancelar la vinculación de la cosmovisión", "No utilices la visión del mundo actual.", "remove world binding"],
      phrases: ["Ya no quiero esta visión del mundo", "No uses esta visión del mundo por ahora.", "Desvincular la cosmovisión de la novela actual.", "Cancelar la visión del mundo actual"],
      requiresNovelContext: true,
      whenToUse: "El usuario quiere cancelar la visión del mundo vinculada a la novela actual, o dejar claro que no quiere utilizar una visión del mundo determinada todavía.",
      whenNotToUse: "El usuario especifica una nueva visión del mundo para la novela actual o simplemente quiere ver los detalles de la visión del mundo.",
    },
    inputSchema: unbindWorldFromNovelInputSchema,
    outputSchema: unbindWorldFromNovelOutputSchema,
    execute: async (_context, rawInput) => {
      const input = unbindWorldFromNovelInputSchema.parse(rawInput);
      const novel = await prisma.novel.findUnique({
        where: { id: input.novelId },
        select: {
          id: true,
          title: true,
          world: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });
      if (!novel) {
        throw new AgentToolError("NOT_FOUND", "Novela actual no encontrada.");
      }

      const previousWorld = novel.world ?? null;
      if (previousWorld) {
        await prisma.novel.update({
          where: { id: novel.id },
          data: {
            worldId: null,
          },
        });
      }

      return unbindWorldFromNovelOutputSchema.parse({
        novelId: novel.id,
        novelTitle: novel.title,
        previousWorldId: previousWorld?.id ?? null,
        previousWorldName: previousWorld?.name ?? null,
        worldId: null,
        worldName: null,
        summary: previousWorld
          ? `La visión del mundo ha sido${previousWorld.name}"De la novela"${novel.title}"Desatar.`
          : `Novela actual "${novel.title}»No ha estado ligado a la visión del mundo.`,
      });
    },
  },
  get_world_detail: {
    name: "get_world_detail",
    title: "Leer detalles de la cosmovisión",
    description: "Lea los detalles de la visión del mundo, el resumen general y la cantidad de conflictos no resueltos.",
    category: "read",
    riskLevel: "low",
    domainAgent: "WorldAgent",
    resourceScopes: ["world", "novel"],
    inputSchema: worldIdInputSchema,
    outputSchema: getWorldDetailOutputSchema,
    execute: async (_context, rawInput) => {
      const input = worldIdInputSchema.parse(rawInput);
      const row = await prisma.world.findUnique({
        where: { id: input.worldId },
        include: {
          novels: {
            select: { id: true },
          },
          consistencyIssues: {
            where: { status: "open" },
            select: { id: true },
          },
        },
      });
      if (!row) {
        throw new AgentToolError("NOT_FOUND", "World not found.");
      }
      return getWorldDetailOutputSchema.parse({
        id: row.id,
        name: row.name,
        worldType: row.worldType ?? null,
        status: row.status,
        version: row.version,
        overviewSummary: row.overviewSummary ?? null,
        consistencyReport: row.consistencyReport ?? null,
        novelCount: row.novels.length,
        openIssueCount: row.consistencyIssues.length,
        summary: `Cosmovisión "${row.name}»Actualmente hay ${row.consistencyIssues.length} conflictos no resueltos.`,
      });
    },
  },
  explain_world_conflict: {
    name: "explain_world_conflict",
    title: "Explicar el conflicto de cosmovisión",
    description: "Lea los conflictos de coherencia de la visión del mundo y brinde sugerencias de recuperación.",
    category: "inspect",
    riskLevel: "low",
    domainAgent: "WorldAgent",
    resourceScopes: ["world"],
    inputSchema: explainWorldConflictInputSchema,
    outputSchema: explainWorldConflictOutputSchema,
    execute: async (_context, rawInput) => {
      const input = explainWorldConflictInputSchema.parse(rawInput);
      const world = await prisma.world.findUnique({
        where: { id: input.worldId },
        include: {
          consistencyIssues: {
            where: input.issueId ? { id: input.issueId } : { status: "open" },
            orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
          },
        },
      });
      if (!world) {
        throw new AgentToolError("NOT_FOUND", "World not found.");
      }
      const issue = world.consistencyIssues[0] ?? null;
      const failureSummary = issue
        ? `${issue.message}${issue.targetField ? `(Campo: ${issue.targetField})` : ""}`
        : "En la visión del mundo actual no hay conflictos de coherencia no resueltos.";
      return explainWorldConflictOutputSchema.parse({
        worldId: world.id,
        issueId: issue?.id ?? null,
        issueCount: world.consistencyIssues.length,
        severity: issue?.severity ?? null,
        failureSummary,
        failureDetails: issue?.detail ?? world.consistencyReport ?? null,
        recoveryHint: issue
          ? "Se recomienda confirmar primero si el campo de conflicto debe basarse en la visión del mundo y luego actualizar el contenido de la capa correspondiente o la configuración novedosa relacionada."
          : "Actualmente no hay conflictos que tratar.",
        summary: failureSummary,
      });
    },
  },
  rebuild_story_world_slice: {
    name: "rebuild_story_world_slice",
    title: "Reconstruya la porción mundial de este libro.",
    description: "Regenerar a la fuerza la parte mundial de este libro para la novela actual y reparar el problema de contaminación del vocabulario del viejo mundo causado por la falta de coincidencia entre la fuente del entorno mundial y el trasfondo de la historia de la novela (como que el mundo histórico esté vinculado a la historia moderna).",
    category: "mutate",
    riskLevel: "medium",
    domainAgent: "WorldAgent",
    resourceScopes: ["world", "novel"],
    parserHints: {
      intent: "inspect_world",
      aliases: ["Reconstruir la porción del mundo", "Arreglar la porción del mundo", "Actualizar porción del mundo", "rebuild world slice"],
      phrases: [
        "El escenario mundial no coincide con la historia.",
        "Partes del mundo están contaminadas por viejos términos",
        "La fuente vinculante mundial está equivocada",
        "Regenerar el escenario mundial de este libro.",
        "El corte está desactualizado",
      ],
      requiresNovelContext: true,
      whenToUse: "Los usuarios informan que el vocabulario de configuración del mundo no coincide con la historia actual, o que el segmento del mundo es Stale=true, o que el contenido del segmento debe actualizarse a la fuerza.",
      whenNotToUse: "Los usuarios solo ven los detalles de la visión del mundo o el estado vinculante.",
    },
    inputSchema: rebuildStoryWorldSliceInputSchema,
    outputSchema: rebuildStoryWorldSliceOutputSchema,
    execute: async (context, rawInput) => {
      const input = rebuildStoryWorldSliceInputSchema.parse(rawInput);
      const novelId = input.novelId?.trim() || context.novelId;
      if (!novelId) {
        throw new AgentToolError("INVALID_INPUT", "Las porciones del mundo no se pueden reconstruir sin el contexto de la novela actual.");
      }
      const view = await novelWorldSliceService.refreshWorldSlice(novelId, {
        storyInput: input.storyInput,
        builderMode: "manual_refresh",
        provider: context.provider as any,
        model: context.model,
        temperature: context.temperature,
      });
      return rebuildStoryWorldSliceOutputSchema.parse({
        novelId,
        worldId: view.worldId ?? null,
        worldName: view.worldName ?? null,
        coreWorldFrame: view.slice?.coreWorldFrame ?? null,
        isStale: view.isStale,
        summary: view.worldId
          ? `La porción del mundo de este libro ha sido reconstruida:${view.worldName ?? view.worldId}.${view.slice?.coreWorldFrame ? `Etapa central:${view.slice.coreWorldFrame.slice(0, 60)}` : ""}`
          : "La novela actual no está ligada al mundo y la parte no se puede reconstruir. Primero vincule la visión del mundo antes de realizar esta operación.",
      });
    },
  },
};
