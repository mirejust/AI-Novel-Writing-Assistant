import { getLLM } from "../../llm/factory";
import { preparePromptExecution, runTextPrompt } from "../../prompting/core/promptRunner";
import { runtimeSetupIdeationPrompt } from "../../prompting/prompts/agent/runtime.prompts";
import type { StructuredIntent, ToolCall, ToolExecutionContext } from "../types";
import { safeJson, type ToolExecutionResult } from "./runtimeHelpers";

type IdeationLLMFactory = typeof getLLM;

let ideationLLMFactory: IdeationLLMFactory = getLLM;

function resolveIdeationMaxTokens(maxTokens: number | undefined): number | undefined {
  if (typeof maxTokens !== "number" || !Number.isFinite(maxTokens)) {
    return undefined;
  }
  return Math.min(Math.floor(maxTokens), 8000);
}

function truncateFact(value: string, max = 220): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return "";
  }
  return normalized.length > max ? `${normalized.slice(0, max)}...` : normalized;
}

function extractTextFromContent(content: unknown): string {
  if (typeof content === "string") {
    return content.trim();
  }
  if (Array.isArray(content)) {
    return content
      .map((item) => {
        if (typeof item === "string") {
          return item;
        }
        if (item && typeof item === "object" && "text" in item && typeof item.text === "string") {
          return item.text;
        }
        return "";
      })
      .join("")
      .trim();
  }
  return "";
}

function getSuccessfulOutput(results: ToolExecutionResult[], tool: ToolCall["tool"]): Record<string, unknown> | null {
  return results.find((item) => item.success && item.tool === tool && item.output)?.output ?? null;
}

function toReadableValue(value: unknown): string | null {
  if (typeof value === "string") {
    return truncateFact(value);
  }
  if (typeof value === "number") {
    return String(value);
  }
  return null;
}

function pushFact(lines: string[], label: string, value: unknown): void {
  const text = toReadableValue(value);
  if (text) {
    lines.push(`${label}:${text}`);
  }
}

function buildIdeationFacts(results: ToolExecutionResult[], structuredIntent?: StructuredIntent): string {
  const novelContext = getSuccessfulOutput(results, "get_novel_context");
  const storyBible = getSuccessfulOutput(results, "get_story_bible");
  const world = getSuccessfulOutput(results, "get_world_constraints");
  const knowledge = getSuccessfulOutput(results, "search_knowledge");
  const lines: string[] = [];

  if (novelContext) {
    pushFact(lines, "Título de la novela", novelContext.title);
    pushFact(lines, "Ya tienes un perfil", novelContext.description);
    pushFact(lines, "tema", novelContext.genre);
    pushFact(lines, "Estilo y temperamento", novelContext.styleTone);
    pushFact(lines, "perspectiva narrativa", novelContext.narrativePov);
    pushFact(lines, "Empuja el ritmo", novelContext.pacePreference);
    pushFact(lines, "Modo de colaboración", novelContext.projectMode);
    pushFact(lines, "intensidad emocional", novelContext.emotionIntensity);
    pushFact(lines, "Grados de libertad de la IA", novelContext.aiFreedom);
    pushFact(lines, "Longitud del capítulo predeterminada", novelContext.defaultChapterLength);
    pushFact(lines, "Vincular la visión del mundo", novelContext.worldName);
    pushFact(lines, "Ya tengo un esquema", novelContext.outline);
    pushFact(lines, "esquema estructurado", novelContext.structuredOutline);
    pushFact(lines, "Número de capítulos", novelContext.chapterCount);
    pushFact(lines, "Número de capítulos completados", novelContext.completedChapterCount);
  }

  if (storyBible) {
    pushFact(lines, "Borrador de configuración principal", storyBible.coreSetting);
    pushFact(lines, "promesa de la historia", storyBible.mainPromise);
    pushFact(lines, "arco del personaje", storyBible.characterArcs);
    pushFact(lines, "reglas del mundo", storyBible.worldRules);
    pushFact(lines, "deshabilitar regla", storyBible.forbiddenRules);
  }

  if (world) {
    pushFact(lines, "nombre de la cosmovisión", world.worldName);
    const constraints = typeof world.constraints === "object" && world.constraints
      ? world.constraints as Record<string, unknown>
      : null;
    if (constraints) {
      pushFact(lines, "axiomas del mundo", constraints.axioms);
      pushFact(lines, "sistema de energía", constraints.magicSystem);
      pushFact(lines, "entorno de conflicto central", constraints.conflicts);
      pushFact(lines, "notas de coherencia", constraints.consistencyReport);
    }
  }

  if (knowledge) {
    pushFact(lines, "Visitas a la base de conocimientos", knowledge.hitCount);
    pushFact(lines, "contexto de la base de conocimientos", knowledge.contextBlock);
  }

  if (structuredIntent) {
    pushFact(lines, "Título explícito del usuario", structuredIntent.novelTitle);
    pushFact(lines, "Tema explícito del usuario", structuredIntent.genre);
    pushFact(lines, "Configuración explícita del usuario", structuredIntent.description);
    pushFact(lines, "estilo explícito del usuario", structuredIntent.styleTone);
  }

  return lines.length > 0 ? lines.join("\n") : "Actualmente no hay datos contextuales novedosos disponibles.";
}

function buildIdeationFallback(results: ToolExecutionResult[], structuredIntent?: StructuredIntent): string {
  const novelContext = getSuccessfulOutput(results, "get_novel_context");
  const title = typeof novelContext?.title === "string" && novelContext.title.trim()
    ? novelContext.title.trim()
    : typeof structuredIntent?.novelTitle === "string" && structuredIntent.novelTitle.trim()
      ? structuredIntent.novelTitle.trim()
      : "";

  if (title) {
    return `Puedo concentrarme directamente en "${title}»Haré varios conjuntos de alternativas para ti, pero para acercarte a la dirección que deseas, es mejor que me digas el elemento central que más deseas retener, como el tema, la identidad del protagonista o el conflicto que más deseas escribir.`;
  }
  return "Puedo darte algunas opciones directamente, pero primero dime qué deberías conservar al menos en el libro: un título provisional, un tema o un punto de conflicto sobre el que más te gustaría escribir.";
}

export async function composeNovelSetupIdeationAnswer(
  goal: string,
  results: ToolExecutionResult[],
  context: Omit<ToolExecutionContext, "runId" | "agentName">,
  structuredIntent?: StructuredIntent,
): Promise<string> {
  const facts = buildIdeationFacts(results, structuredIntent);
  const fallback = buildIdeationFallback(results, structuredIntent);

  try {
    const resolvedMaxTokens = resolveIdeationMaxTokens(context.maxTokens);
    if (ideationLLMFactory === getLLM) {
      const result = await runTextPrompt({
        asset: runtimeSetupIdeationPrompt,
        promptInput: {
          goal,
          structuredIntentJson: safeJson(structuredIntent ?? { intent: "ideate_novel_setup" }),
          facts,
        },
        options: {
          provider: context.provider ?? "deepseek",
          model: context.model,
          temperature: Math.max(context.temperature ?? 0.75, 0.75),
          maxTokens: resolvedMaxTokens,
        },
      });
      return result.output.trim() || fallback;
    }

    const prepared = preparePromptExecution({
      asset: runtimeSetupIdeationPrompt,
      promptInput: {
        goal,
        structuredIntentJson: safeJson(structuredIntent ?? { intent: "ideate_novel_setup" }),
        facts,
      },
    });
    const llm = await ideationLLMFactory(context.provider ?? "deepseek", {
      model: context.model,
      temperature: Math.max(context.temperature ?? 0.75, 0.75),
      maxTokens: resolvedMaxTokens,
      taskType: runtimeSetupIdeationPrompt.taskType,
      promptMeta: prepared.invocation,
    });
    const result = await llm.invoke(prepared.messages);
    const text = extractTextFromContent(result.content);
    return text || fallback;
  } catch {
    return fallback;
  }
}

export function setNovelSetupIdeationLLMFactoryForTests(factory?: IdeationLLMFactory): void {
  ideationLLMFactory = factory ?? getLLM;
}
