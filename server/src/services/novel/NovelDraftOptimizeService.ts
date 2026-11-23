import type { LLMProvider } from "@ai-novel/shared/types/llm";
import { prisma } from "../../db/prisma";
import { runTextPrompt } from "../../prompting/core/promptRunner";
import {
  novelDraftOptimizeFullPrompt,
  novelDraftOptimizeSelectionPrompt,
} from "../../prompting/prompts/novel/draftOptimize.prompts";

interface DraftOptimizeInput {
  provider?: LLMProvider;
  model?: string;
  temperature?: number;
  currentDraft: string;
  instruction: string;
  mode: "full" | "selection";
  selectedText?: string;
  target: "outline" | "structured_outline";
}

function toText(content: unknown): string {
  if (typeof content === "string") {
    return content;
  }
  if (Array.isArray(content)) {
    return content.map((item) => {
      if (typeof item === "string") {
        return item;
      }
      if (item && typeof item === "object" && "text" in item && typeof item.text === "string") {
        return item.text;
      }
      return "";
    }).join("");
  }
  return JSON.stringify(content ?? "");
}

function cleanJsonText(source: string): string {
  return source.replace(/```json|```/gi, "").trim();
}

function extractJSONArray(source: string): string {
  const text = cleanJsonText(source);
  const first = text.indexOf("[");
  const last = text.lastIndexOf("]");
  if (first < 0 || last < 0 || first >= last) {
    throw new Error("No se detectó ninguna matriz JSON válida.");
  }
  return text.slice(first, last + 1);
}

function normalizeLineBreaks(text: string): string {
  return text.replace(/\r\n/g, "\n");
}

function buildSelectionContext(currentDraft: string, selectedText: string): {
  before: string;
  after: string;
  index: number;
} {
  const draft = normalizeLineBreaks(currentDraft);
  const selection = normalizeLineBreaks(selectedText);
  const index = draft.indexOf(selection);
  if (index < 0) {
    throw new Error("El texto seleccionado no se encontró en el borrador actual, selecciónelo nuevamente e inténtelo nuevamente.");
  }
  const windowSize = 180;
  const before = draft.slice(Math.max(0, index - windowSize), index).trim();
  const after = draft.slice(index + selection.length, index + selection.length + windowSize).trim();
  return { before, after, index };
}

function buildWorldContext(novel: {
  world?: {
    name: string;
    worldType?: string | null;
    description?: string | null;
    axioms?: string | null;
    background?: string | null;
    geography?: string | null;
    magicSystem?: string | null;
    politics?: string | null;
    races?: string | null;
    religions?: string | null;
    technology?: string | null;
    conflicts?: string | null;
    history?: string | null;
    economy?: string | null;
    factions?: string | null;
  } | null;
}): string {
  const world = novel.world;
  if (!world) {
    return "Contexto mundial: Ninguno";
  }
  let axiomsText = "Ninguno";
  if (world.axioms) {
    try {
      const parsed = JSON.parse(world.axioms) as string[];
      axiomsText = Array.isArray(parsed) && parsed.length > 0
        ? parsed.map((item) => `- ${item}`).join("\n")
        : world.axioms;
    } catch {
      axiomsText = world.axioms;
    }
  }
  return `Contexto mundial:
Nombre mundial:${world.name}
Tipo de mundo:${world.worldType ?? "No especificado"}
Introducción al mundo:${world.description ?? "Ninguno"}
Axiomas centrales:
${axiomsText}
fondo:${world.background ?? "Ninguno"}
geografía:${world.geography ?? "Ninguno"}
Sistema de energía:${world.magicSystem ?? "Ninguno"}
Sociopolítico:${world.politics ?? "Ninguno"}
Carrera:${world.races ?? "Ninguno"}
religión:${world.religions ?? "Ninguno"}
ciencia y tecnología:${world.technology ?? "Ninguno"}
historia:${world.history ?? "Ninguno"}
economía:${world.economy ?? "Ninguno"}
Relaciones de poder:${world.factions ?? "Ninguno"}
Conflicto central:${world.conflicts ?? "Ninguno"}`;
}

export class NovelDraftOptimizeService {
  async optimizePreview(novelId: string, input: DraftOptimizeInput): Promise<{
    optimizedDraft: string;
    mode: "full" | "selection";
    selectedText?: string | null;
  }> {
    const novel = await prisma.novel.findUnique({
      where: { id: novelId },
      include: { world: true, characters: true },
    });
    if (!novel) {
      throw new Error("La novela no existe.");
    }

    const currentDraft = input.currentDraft.trim();
    if (!currentDraft) {
      throw new Error("El borrador actual no puede estar vacío.");
    }

    const worldContext = buildWorldContext(novel);
    const charactersText = novel.characters.length > 0
      ? novel.characters
          .map((c) => `- ${c.name}(${c.role})${c.personality ? `:${c.personality.slice(0, 80)}` : ""}`)
          .join("\n")
      : "Sin datos";

    if (input.mode === "selection") {
      const selectedText = input.selectedText?.trim();
      if (!selectedText) {
        throw new Error("El texto seleccionado debe proporcionarse en modo de optimización de selección.");
      }
      const selectionContext = buildSelectionContext(currentDraft, selectedText);
      const rewrittenSelection = await runTextPrompt({
        asset: novelDraftOptimizeSelectionPrompt,
        promptInput: {
          target: input.target,
          instruction: input.instruction,
          charactersText,
          worldContext,
          before: selectionContext.before,
          after: selectionContext.after,
          selectedText,
        },
        options: {
          provider: input.provider ?? "deepseek",
          model: input.model,
          temperature: input.temperature ?? 0.4,
        },
      });
      const optimizedSelection = rewrittenSelection.output.trim() || selectedText;
      return {
        optimizedDraft: optimizedSelection,
        mode: "selection",
        selectedText,
      };
    }

    const rewritten = await runTextPrompt({
      asset: novelDraftOptimizeFullPrompt,
      promptInput: {
        target: input.target,
        instruction: input.instruction,
        charactersText,
        worldContext,
        currentDraft,
      },
      options: {
        provider: input.provider ?? "deepseek",
        model: input.model,
        temperature: input.temperature ?? 0.4,
      },
    });

    let optimizedDraft = rewritten.output.trim() || currentDraft;
    if (input.target === "structured_outline") {
      try {
        const jsonText = extractJSONArray(optimizedDraft);
        JSON.parse(jsonText);
        optimizedDraft = jsonText;
      } catch {
        // keep raw response for manual correction when model output is non-JSON
      }
    }
    return {
      optimizedDraft,
      mode: "full",
      selectedText: null,
    };
  }
}
