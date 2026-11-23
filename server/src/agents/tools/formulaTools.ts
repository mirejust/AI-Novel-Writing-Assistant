import { prisma } from "../../db/prisma";
import { AgentToolError, type AgentToolName } from "../types";
import type { AgentToolDefinition } from "./toolTypes";
import {
  type ExplainFormulaMatchOutput,
  explainFormulaMatchInputSchema,
  explainFormulaMatchOutputSchema,
  getWritingFormulaDetailOutputSchema,
  listWritingFormulasInputSchema,
  listWritingFormulasOutputSchema,
  writingFormulaIdInputSchema,
} from "./formulaToolSchemas";

function collectFormulaSignals(row: {
  genre: string | null;
  style: string | null;
  toneVoice: string | null;
  themes: string | null;
  motifs: string | null;
}) {
  return [
    row.genre?.trim(),
    row.style?.trim(),
    row.toneVoice?.trim(),
    row.themes?.trim(),
    row.motifs?.trim(),
  ].filter((item): item is string => Boolean(item));
}

export const formulaToolDefinitions: Partial<
  Record<AgentToolName, AgentToolDefinition<Record<string, unknown>, Record<string, unknown>>>
> = {
  list_writing_formulas: {
    name: "list_writing_formulas",
    title: "Lista de fórmulas de escritura",
    description: "Lea la lista de fórmulas de escritura y propiedades de estilo recientes.",
    category: "read",
    riskLevel: "low",
    domainAgent: "FormulaAgent",
    resourceScopes: ["writing_formula"],
    inputSchema: listWritingFormulasInputSchema,
    outputSchema: listWritingFormulasOutputSchema,
    execute: async (_context, rawInput) => {
      const input = listWritingFormulasInputSchema.parse(rawInput);
      const rows = await prisma.writingFormula.findMany({
        orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
        take: input.limit ?? 20,
      });
      return listWritingFormulasOutputSchema.parse({
        items: rows.map((row) => ({
          id: row.id,
          name: row.name,
          genre: row.genre ?? null,
          style: row.style ?? null,
          toneVoice: row.toneVoice ?? null,
          updatedAt: row.updatedAt.toISOString(),
        })),
        summary: `Leer ${rows.length} Fórmula de redacción del artículo.`,
      });
    },
  },
  get_writing_formula_detail: {
    name: "get_writing_formula_detail",
    title: "Leer los detalles de la fórmula de escritura",
    description: "Lea sugerencias de estilo, procedimiento y aplicación para escribir fórmulas.",
    category: "read",
    riskLevel: "low",
    domainAgent: "FormulaAgent",
    resourceScopes: ["writing_formula"],
    inputSchema: writingFormulaIdInputSchema,
    outputSchema: getWritingFormulaDetailOutputSchema,
    execute: async (_context, rawInput) => {
      const input = writingFormulaIdInputSchema.parse(rawInput);
      const row = await prisma.writingFormula.findUnique({
        where: { id: input.formulaId },
      });
      if (!row) {
        throw new AgentToolError("NOT_FOUND", "Writing formula not found.");
      }
      return getWritingFormulaDetailOutputSchema.parse({
        id: row.id,
        name: row.name,
        genre: row.genre ?? null,
        style: row.style ?? null,
        toneVoice: row.toneVoice ?? null,
        formulaDescription: row.formulaDescription ?? null,
        formulaSteps: row.formulaSteps ?? null,
        applicationTips: row.applicationTips ?? null,
        updatedAt: row.updatedAt.toISOString(),
        summary: `Leyendo la fórmula de escritura "${row.name}».`,
      });
    },
  },
  explain_formula_match: {
    name: "explain_formula_match",
    title: "Explicar la idoneidad de la fórmula.",
    description: "Interpretar las señales de adaptación de fórmulas de escritura actuales basadas en textos de muestra, capítulos o esquemas novedosos.",
    category: "inspect",
    riskLevel: "low",
    domainAgent: "FormulaAgent",
    resourceScopes: ["writing_formula", "novel", "chapter"],
    inputSchema: explainFormulaMatchInputSchema,
    outputSchema: explainFormulaMatchOutputSchema,
    execute: async (_context, rawInput) => {
      const input = explainFormulaMatchInputSchema.parse(rawInput);
      const row = await prisma.writingFormula.findUnique({
        where: { id: input.formulaId },
      });
      if (!row) {
        throw new AgentToolError("NOT_FOUND", "Writing formula not found.");
      }
      let basisText = input.sampleText?.trim() ?? "";
      let basisType: ExplainFormulaMatchOutput["basisType"] = "formula_only";
      if (!basisText && input.chapterId) {
        const chapter = await prisma.chapter.findUnique({
          where: { id: input.chapterId },
          select: { content: true },
        });
        basisText = chapter?.content?.trim() ?? "";
        basisType = basisText ? "chapter" : basisType;
      }
      if (!basisText && input.novelId) {
        const novel = await prisma.novel.findUnique({
          where: { id: input.novelId },
          select: { structuredOutline: true, outline: true },
        });
        basisText = novel?.structuredOutline?.trim() || novel?.outline?.trim() || "";
        basisType = basisText ? "novel_outline" : basisType;
      }
      if (input.sampleText?.trim()) {
        basisType = "sample_text";
      }
      const signals = collectFormulaSignals(row);
      const matchedSignals = basisText
        ? signals.filter((signal) => basisText.includes(signal.slice(0, Math.min(signal.length, 8))))
        : [];
      const missingSignals = signals.filter((signal) => !matchedSignals.includes(signal));
      const summary = basisText
        ? matchedSignals.length > 0
          ? `fórmula"${row.name}»llega al contexto actual ${matchedSignals.length} señal estilo barra.`
          : `fórmula"${row.name}»Leído, pero no aparece ninguna señal de acierto clara en el contexto actual.`
        : `fórmula"${row.name}» se ha leído, pero actualmente no hay ningún texto de contexto disponible para comparar.`;
      return explainFormulaMatchOutputSchema.parse({
        formulaId: row.id,
        basisType,
        matchedSignals,
        missingSignals,
        summary,
      });
    },
  },
};
