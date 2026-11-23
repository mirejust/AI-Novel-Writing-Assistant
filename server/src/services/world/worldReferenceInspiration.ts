import type { LLMProvider } from "@ai-novel/shared/types/llm";
import { runStructuredPrompt } from "../../prompting/core/promptRunner";
import { worldReferenceInspirationPrompt } from "../../prompting/prompts/world/world.prompts";
import {
  createEmptyWorldReferenceSeedBundle,
  normalizeWorldReferenceSeedBundle,
  type WorldReferenceAnchor,
  type WorldReferenceMode,
  type WorldReferenceSeedBundle,
} from "@ai-novel/shared/types/worldWizard";

export interface ReferenceConceptCard {
  worldType: string;
  templateKey: string;
  coreImagery: string[];
  tone: string;
  keywords: string[];
  summary: string;
}

interface GenerateReferenceInspirationInput {
  sourceText: string;
  worldTypeHint?: string;
  referenceMode: WorldReferenceMode;
  preserveElements?: string[];
  allowedChanges?: string[];
  forbiddenElements?: string[];
  provider?: LLMProvider;
  model?: string;
}

interface ReferenceInspirationPayload {
  conceptCard: ReferenceConceptCard;
  anchors: WorldReferenceAnchor[];
  referenceSeeds: WorldReferenceSeedBundle;
}

const MIN_ANCHOR_COUNT = 4;

export function buildReferenceModeLabel(mode: WorldReferenceMode): string {
  switch (mode) {
    case "extract_base":
      return "Extrae la base mundial original.";
    case "tone_rebuild":
      return "Tomando prestado el temperamento y la estructura de la obra original para reconstruirla.";
    case "adapt_world":
    default:
      return "Una transformación aérea basada en el trabajo original.";
  }
}

function uniqueStrings(items: Array<string | null | undefined>): string[] {
  return Array.from(
    new Set(
      items
        .map((item) => (typeof item === "string" ? item.trim() : ""))
        .filter(Boolean),
    ),
  );
}

function compactText(source: string, maxChars: number): string {
  const normalized = source.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxChars) {
    return normalized;
  }
  return `${normalized.slice(0, maxChars - 3).trim()}...`;
}

function normalizeAnchors(raw: unknown): WorldReferenceAnchor[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  const anchors = raw
    .map<WorldReferenceAnchor | null>((item, index) => {
      if (!item || typeof item !== "object") {
        return null;
      }
      const record = item as Record<string, unknown>;
      const label = typeof record.label === "string" ? record.label.trim() : "";
      const content = typeof record.content === "string" ? record.content.trim() : "";
      const id = typeof record.id === "string" ? record.id.trim() : "";
      if (!label || !content) {
        return null;
      }
      return {
        id: id || `anchor-${index + 1}`,
        label,
        content,
      };
    })
    .filter((item): item is WorldReferenceAnchor => Boolean(item));

  return Array.from(new Map(anchors.map((item) => [item.label, item])).values()).slice(0, 6);
}

function buildFallbackAnchors(input: GenerateReferenceInspirationInput): WorldReferenceAnchor[] {
  const anchors: WorldReferenceAnchor[] = [];
  const push = (label: string, content: string) => {
    const normalizedLabel = label.trim();
    const normalizedContent = content.trim();
    if (!normalizedLabel || !normalizedContent || anchors.some((item) => item.label === normalizedLabel)) {
      return;
    }
    anchors.push({
      id: `anchor-${anchors.length + 1}`,
      label: normalizedLabel,
      content: normalizedContent,
    });
  };

  if (input.worldTypeHint?.trim()) {
    push("Base temática", `Esta transformación debería seguir entrando dentro del "${input.worldTypeHint.trim()}"Dentro de este tipo de mundo.`);
  }
  if (input.preserveElements && input.preserveElements.length > 0) {
    push("debe ser retenido", `Los fundamentos centrales del trabajo original que no se pueden perder incluyen:${input.preserveElements.join(",")}.`);
  }
  if (input.allowedChanges && input.allowedChanges.length > 0) {
    push("Modificaciones permitidas", `Se permiten cambios generales alrededor de las siguientes dimensiones:${input.allowedChanges.join(",")}.`);
  }
  if (input.forbiddenElements && input.forbiddenElements.length > 0) {
    push("La desviación está prohibida", `No se pueden modificar los siguientes límites:${input.forbiddenElements.join(",")}.`);
  }
  push("Resumen de referencia", compactText(input.sourceText, 140));
  push(
    "frontera mundial",
    input.referenceMode === "tone_rebuild"
      ? "Se pueden reconstruir hechos específicos, pero aún se deben preservar la tensión interpersonal, la textura de la vida y la sensación narrativa de la obra original."
      : "La transformación debe basarse en el mundo original y no puede saltar directamente a temas irrelevantes o plantillas distorsionadas.",
  );
  push("base social", "Es necesario identificar primero la realidad social, la ecología industrial y la estructura de presión vital en las que se basa el trabajo original.");
  push("Enfoque de renovación", "Priorizar la transformación en torno al sistema de ubicación, la red eléctrica, las reglas implícitas y los límites del orden abierto.");

  return anchors.slice(0, 6);
}

function normalizeConceptCard(
  raw: unknown,
  input: GenerateReferenceInspirationInput,
  anchors: WorldReferenceAnchor[],
): ReferenceConceptCard {
  const record = raw && typeof raw === "object" && !Array.isArray(raw)
    ? raw as Record<string, unknown>
    : {};
  const coreImagery = Array.isArray(record.coreImagery)
    ? uniqueStrings(record.coreImagery.map((item) => (typeof item === "string" ? item : ""))).slice(0, 6)
    : [];
  const keywords = Array.isArray(record.keywords)
    ? uniqueStrings(record.keywords.map((item) => (typeof item === "string" ? item : ""))).slice(0, 8)
    : [];

  const fallbackSummary = input.referenceMode === "extract_base"
    ? `Este mundo debería primero refinar la base mundial estable de la obra original antes de decidir la dirección de la expansión posterior. Los puntos de anclaje clave actualmente identificados incluyen:${anchors.map((item) => item.label).join(",")}.`
    : input.referenceMode === "tone_rebuild"
      ? `El objetivo esta vez no es copiar los hechos de la obra original, sino conservar su temperamento urbano, su estructura de relaciones y su sentimiento narrativo, y luego reconstruir una nueva forma de organizar el mundo. Los anclajes de referencia clave incluyen:${anchors.map((item) => item.label).join(",")}.`
      : `Este mundo debe construirse sobre la base de la obra original y someterse a una transformación general. Primero, se debe preservar el temperamento y el esqueleto realista de la obra original, y luego se deben reorganizar las reglas del mundo en torno a las dimensiones que permitan la transformación. Los anclajes clave incluyen:${anchors.map((item) => item.label).join(",")}.`;

  return {
    worldType: typeof record.worldType === "string" && record.worldType.trim()
      ? record.worldType.trim()
      : input.worldTypeHint?.trim() || "Las obras de referencia transforman el mundo",
    templateKey: "custom",
    coreImagery: coreImagery.length > 0 ? coreImagery : anchors.map((item) => item.label).slice(0, 5),
    tone: typeof record.tone === "string" && record.tone.trim()
      ? record.tone.trim()
      : "Conservando el espíritu del original con una transformación controlada",
    keywords: keywords.length > 0 ? keywords : uniqueStrings(anchors.flatMap((item) => [item.label, item.content])).slice(0, 8),
    summary: typeof record.summary === "string" && record.summary.trim()
      ? record.summary.trim()
      : fallbackSummary,
  };
}

function buildPrompt(input: GenerateReferenceInspirationInput): string {
  return [
    `Método de referencia:${buildReferenceModeLabel(input.referenceMode)}`,
    input.worldTypeHint?.trim() ? `Consejos de tipo mundial:${input.worldTypeHint.trim()}` : "",
    input.preserveElements && input.preserveElements.length > 0
      ? `Debe conservarse:${input.preserveElements.join(",")}`
      : "",
    input.allowedChanges && input.allowedChanges.length > 0
      ? `Modificaciones permitidas:${input.allowedChanges.join(",")}`
      : "",
    input.forbiddenElements && input.forbiddenElements.length > 0
      ? `Desviaciones prohibidas de:${input.forbiddenElements.join(",")}`
      : "",
    `Materiales de referencia:${input.sourceText}`,
  ]
    .filter(Boolean)
    .join("\n");
}

export async function generateReferenceInspirationAnalysis(
  input: GenerateReferenceInspirationInput,
): Promise<ReferenceInspirationPayload> {
  const retryPrompt = `${buildPrompt(input)}

Tenga en cuenta:
1. Si se trata de una "transformación general basada en la obra original", el objetivo es refinar los puntos de anclaje del mundo de la obra original, la configuración original y los límites de transformación que se pueden utilizar directamente, en lugar de generar nuevas plantillas de temas.
2. Si se trata de "extraer la base mundial de la obra original", el objetivo es estabilizar los hechos y la organización mundial, y no ampliarlos ni transformarlos activamente.
3. Si se trata de "reconstruir tomando prestado el temperamento y la estructura de la obra original", la atención se centra en conservar la atmósfera, la estructura de las relaciones y la calidad de vida, y no es necesario conservar todos los hechos específicos.`;

  for (const prompt of [buildPrompt(input), retryPrompt]) {
    try {
      const result = await runStructuredPrompt({
        asset: worldReferenceInspirationPrompt,
        promptInput: {
          userPrompt: prompt,
          isRetry: prompt === retryPrompt,
        },
        options: {
          provider: input.provider ?? "deepseek",
          model: input.model,
          temperature: 0.2,
        },
      });
      const parsed = result.output;

      const anchors = normalizeAnchors((parsed as any).anchors);
      const safeAnchors = anchors.length >= MIN_ANCHOR_COUNT ? anchors : buildFallbackAnchors(input);
      const referenceSeeds = normalizeWorldReferenceSeedBundle(
        (parsed as any).seedPackage ?? (parsed as any).referenceSeeds,
      );
      return {
        conceptCard: normalizeConceptCard((parsed as any).conceptCard, input, safeAnchors),
        anchors: safeAnchors,
        referenceSeeds,
      };
    } catch {
      continue;
    }
  }

  const fallbackAnchors = buildFallbackAnchors(input);
  return {
    conceptCard: normalizeConceptCard(null, input, fallbackAnchors),
    anchors: fallbackAnchors,
    referenceSeeds: createEmptyWorldReferenceSeedBundle(),
  };
}
