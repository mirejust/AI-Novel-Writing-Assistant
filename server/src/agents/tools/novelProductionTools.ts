import { AgentToolError, type AgentToolName } from "../types";
import type { AgentToolDefinition } from "./toolTypes";
import {
  generateNovelCharactersInput,
  generateNovelCharactersOutput,
  generateNovelOutlineInput,
  generateNovelOutlineOutput,
  generateStoryBibleInput,
  generateStoryBibleOutput,
  generateStructuredOutlineInput,
  generateStructuredOutlineOutput,
  generateWorldForNovelInput,
  generateWorldForNovelOutput,
  getNovelProductionStatusInput,
  getNovelProductionStatusOutput,
  startFullNovelPipelineInput,
  startFullNovelPipelineOutput,
  syncChaptersFromStructuredOutlineInput,
  syncChaptersFromStructuredOutlineOutput,
} from "./novelToolShared";
import { novelProductionService } from "../../services/novel/NovelProductionService";

function resolveNovelId(contextNovelId: string | undefined, rawNovelId: string | undefined): string {
  const novelId = rawNovelId?.trim() || contextNovelId?.trim();
  if (!novelId) {
    throw new AgentToolError("INVALID_INPUT", "Sin contexto novedoso actual.");
  }
  return novelId;
}

export const novelProductionToolDefinitions: Partial<
  Record<AgentToolName, AgentToolDefinition<Record<string, unknown>, Record<string, unknown>>>
> = {
  generate_world_for_novel: {
    name: "generate_world_for_novel",
    title: "Visión del mundo novedosa generativa",
    description: "Generar una cosmovisión para la novela actual; Si la cosmovisión ha sido limitada, reutilícela directamente.",
    category: "mutate",
    riskLevel: "medium",
    domainAgent: "NovelAgent",
    resourceScopes: ["novel", "world"],
    inputSchema: generateWorldForNovelInput,
    outputSchema: generateWorldForNovelOutput,
    execute: async (context, rawInput) => {
      const input = generateWorldForNovelInput.parse(rawInput);
      return generateWorldForNovelOutput.parse(
        await novelProductionService.generateWorldForNovel({
          novelId: resolveNovelId(context.novelId, input.novelId),
          description: input.description,
          worldType: input.worldType,
          provider: context.provider as any,
          model: context.model,
          temperature: context.temperature,
        }),
      );
    },
  },
  generate_novel_characters: {
    name: "generate_novel_characters",
    title: "Generar roles centrales",
    description: "Generar personajes centrales para la novela actual; si hay personajes existentes, reutilícelos directamente.",
    category: "mutate",
    riskLevel: "medium",
    domainAgent: "NovelAgent",
    resourceScopes: ["novel", "chapter"],
    inputSchema: generateNovelCharactersInput,
    outputSchema: generateNovelCharactersOutput,
    execute: async (context, rawInput) => {
      const input = generateNovelCharactersInput.parse(rawInput);
      return generateNovelCharactersOutput.parse(
        await novelProductionService.generateNovelCharacters({
          novelId: resolveNovelId(context.novelId, input.novelId),
          description: input.description,
          genre: input.genre,
          styleTone: input.styleTone,
          narrativePov: input.narrativePov,
          provider: context.provider as any,
          model: context.model,
          temperature: context.temperature,
          count: input.count,
        }),
      );
    },
  },
  generate_story_bible: {
    name: "generate_story_bible",
    title: "Generar Biblia de ficción",
    description: "Genere una biblia novedosa para la novela actual.",
    category: "mutate",
    riskLevel: "medium",
    domainAgent: "NovelAgent",
    resourceScopes: ["novel"],
    inputSchema: generateStoryBibleInput,
    outputSchema: generateStoryBibleOutput,
    execute: async (context, rawInput) => {
      const input = generateStoryBibleInput.parse(rawInput);
      return generateStoryBibleOutput.parse(
        await novelProductionService.generateStoryBible({
          novelId: resolveNovelId(context.novelId, input.novelId),
          provider: context.provider as any,
          model: context.model,
          temperature: context.temperature,
        }),
      );
    },
  },
  generate_novel_outline: {
    name: "generate_novel_outline",
    title: "generar tendencias de desarrollo",
    description: "Generar tendencias de desarrollo de novelas actuales.",
    category: "mutate",
    riskLevel: "medium",
    domainAgent: "NovelAgent",
    resourceScopes: ["novel"],
    inputSchema: generateNovelOutlineInput,
    outputSchema: generateNovelOutlineOutput,
    execute: async (context, rawInput) => {
      const input = generateNovelOutlineInput.parse(rawInput);
      return generateNovelOutlineOutput.parse(
        await novelProductionService.generateNovelOutline({
          novelId: resolveNovelId(context.novelId, input.novelId),
          description: input.description,
          provider: context.provider as any,
          model: context.model,
          temperature: context.temperature,
        }),
      );
    },
  },
  generate_structured_outline: {
    name: "generate_structured_outline",
    title: "Generar esquema estructurado",
    description: "Genere un esquema estructurado y un plan de capítulos para su novela actual.",
    category: "mutate",
    riskLevel: "medium",
    domainAgent: "NovelAgent",
    resourceScopes: ["novel", "chapter"],
    inputSchema: generateStructuredOutlineInput,
    outputSchema: generateStructuredOutlineOutput,
    execute: async (context, rawInput) => {
      const input = generateStructuredOutlineInput.parse(rawInput);
      return generateStructuredOutlineOutput.parse(
        await novelProductionService.generateStructuredOutline({
          novelId: resolveNovelId(context.novelId, input.novelId),
          targetChapterCount: input.targetChapterCount,
          provider: context.provider as any,
          model: context.model,
          temperature: context.temperature,
        }),
      );
    },
  },
  sync_chapters_from_structured_outline: {
    name: "sync_chapters_from_structured_outline",
    title: "Sincronizar la tabla de contenidos del capítulo",
    description: "Sincronice el índice del capítulo según el esquema estructurado.",
    category: "mutate",
    riskLevel: "medium",
    domainAgent: "NovelAgent",
    resourceScopes: ["novel", "chapter"],
    inputSchema: syncChaptersFromStructuredOutlineInput,
    outputSchema: syncChaptersFromStructuredOutlineOutput,
    execute: async (context, rawInput) => {
      const input = syncChaptersFromStructuredOutlineInput.parse(rawInput);
      return syncChaptersFromStructuredOutlineOutput.parse(
        await novelProductionService.syncChaptersFromStructuredOutline(
          resolveNovelId(context.novelId, input.novelId),
        ),
      );
    },
  },
  start_full_novel_pipeline: {
    name: "start_full_novel_pipeline",
    title: "Empieza a escribir el libro completo.",
    description: "Inicie toda la tarea de escritura según la lista de capítulos de la novela actual.",
    category: "run",
    riskLevel: "high",
    approvalRequired: true,
    domainAgent: "NovelAgent",
    resourceScopes: ["novel", "chapter", "generation_job", "task"],
    inputSchema: startFullNovelPipelineInput,
    outputSchema: startFullNovelPipelineOutput,
    execute: async (context, rawInput) => {
      const input = startFullNovelPipelineInput.parse(rawInput);
      const novelId = resolveNovelId(context.novelId, input.novelId);
      if (input.dryRun) {
        const startOrder = input.startOrder ?? 1;
        const endOrder = input.endOrder ?? Math.max(input.targetChapterCount ?? 20, startOrder);
        return startFullNovelPipelineOutput.parse({
          novelId,
          jobId: null,
          status: "preview_only",
          startOrder,
          endOrder,
          dryRun: true,
          summary: "dryRun: se creará toda la tarea de escritura, pero no se iniciará realmente.",
        });
      }
      return startFullNovelPipelineOutput.parse(
        {
          ...(await novelProductionService.startFullNovelPipeline({
          novelId,
          startOrder: input.startOrder,
          endOrder: input.endOrder,
          maxRetries: input.maxRetries,
          provider: context.provider as any,
          model: context.model,
          temperature: context.temperature,
          targetChapterCount: input.targetChapterCount,
          })),
          dryRun: false,
        },
      );
    },
  },
  get_novel_production_status: {
    name: "get_novel_production_status",
    title: "Leer todo el estado de producción.",
    description: "Agrega el estado de preparación de los activos de la novela actual, el número de capítulos y el estado general de la tarea de escritura.",
    category: "inspect",
    riskLevel: "low",
    domainAgent: "NovelAgent",
    resourceScopes: ["novel", "chapter", "generation_job"],
    parserHints: {
      intent: "query_novel_production_status",
      aliases: ["El progreso de todo el libro.", "estado de producción", "production status"],
      phrases: ["Estado de la generación del libro", "¿Por qué no se inicia toda la compilación?", "¿Se han completado los preparativos de los activos actuales?"],
      requiresNovelContext: true,
      whenToUse: "El usuario pregunta sobre el estado general de producción, el bloqueo o la preparación de los activos de una novela en particular.",
      whenNotToUse: "El usuario solo consulta las tareas globales del centro de tareas del sistema.",
    },
    inputSchema: getNovelProductionStatusInput,
    outputSchema: getNovelProductionStatusOutput,
    execute: async (context, rawInput) => {
      const input = getNovelProductionStatusInput.parse(rawInput);
      return getNovelProductionStatusOutput.parse(
        await novelProductionService.getNovelProductionStatus({
          novelId: input.novelId?.trim() || context.novelId,
          title: input.title,
          targetChapterCount: input.targetChapterCount,
        }),
      );
    },
  },
};
