import { prisma } from "../../db/prisma";
import { AgentToolError, type AgentToolName } from "../types";
import type { AgentToolDefinition } from "./toolTypes";
import {
  baseCharacterIdInputSchema,
  getBaseCharacterDetailOutputSchema,
  listBaseCharactersInputSchema,
  listBaseCharactersOutputSchema,
} from "./characterToolSchemas";

export const characterToolDefinitions: Partial<
  Record<AgentToolName, AgentToolDefinition<Record<string, unknown>, Record<string, unknown>>>
> = {
  list_base_characters: {
    name: "list_base_characters",
    title: "Listar plantillas de roles base",
    description: "Lea la lista de plantillas, la clasificación y la última hora de actualización de la biblioteca de funciones básicas.",
    category: "read",
    riskLevel: "low",
    domainAgent: "CharacterAgent",
    resourceScopes: ["base_character"],
    parserHints: {
      intent: "list_base_characters",
      aliases: ["Biblioteca de personajes básicos", "Biblioteca de plantillas de roles", "base characters"],
      phrases: ["Listar roles en la biblioteca de roles base", "Ver la biblioteca de personajes base", "¿Qué personajes hay en la biblioteca de personajes?"],
      requiresNovelContext: false,
      whenToUse: "El usuario desea ver la biblioteca de plantillas de roles base global.",
      whenNotToUse: "El usuario preguntó sobre el estado del personaje planeado en la novela actual.",
    },
    inputSchema: listBaseCharactersInputSchema,
    outputSchema: listBaseCharactersOutputSchema,
    execute: async (_context, rawInput) => {
      const input = listBaseCharactersInputSchema.parse(rawInput);
      const rows = await prisma.baseCharacter.findMany({
        where: {
          ...(input.category ? { category: input.category } : {}),
          ...(input.search
            ? {
              OR: [
                { name: { contains: input.search } },
                { role: { contains: input.search } },
                { personality: { contains: input.search } },
                { background: { contains: input.search } },
                { tags: { contains: input.search } },
              ],
            }
            : {}),
        },
        orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
        take: input.limit ?? 20,
      });
      return listBaseCharactersOutputSchema.parse({
        items: rows.map((row) => ({
          id: row.id,
          name: row.name,
          role: row.role,
          category: row.category,
          tags: row.tags ?? "",
          updatedAt: row.updatedAt.toISOString(),
        })),
        summary: `Leer ${rows.length} Una plantilla de rol básica.`,
      });
    },
  },
  get_base_character_detail: {
    name: "get_base_character_detail",
    title: "Leer detalles básicos del rol",
    description: "Lea la configuración completa y la información de crecimiento de la plantilla de personaje básica.",
    category: "read",
    riskLevel: "low",
    domainAgent: "CharacterAgent",
    resourceScopes: ["base_character"],
    inputSchema: baseCharacterIdInputSchema,
    outputSchema: getBaseCharacterDetailOutputSchema,
    execute: async (_context, rawInput) => {
      const input = baseCharacterIdInputSchema.parse(rawInput);
      const row = await prisma.baseCharacter.findUnique({
        where: { id: input.characterId },
      });
      if (!row) {
        throw new AgentToolError("NOT_FOUND", "Base character not found.");
      }
      return getBaseCharacterDetailOutputSchema.parse({
        id: row.id,
        name: row.name,
        role: row.role,
        category: row.category,
        personality: row.personality,
        background: row.background,
        development: row.development,
        appearance: row.appearance ?? null,
        weaknesses: row.weaknesses ?? null,
        interests: row.interests ?? null,
        keyEvents: row.keyEvents ?? null,
        tags: row.tags ?? "",
        updatedAt: row.updatedAt.toISOString(),
        summary: `Se ha leído la plantilla de roles.${row.name}».`,
      });
    },
  },
};
