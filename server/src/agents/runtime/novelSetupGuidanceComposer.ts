import { getLLM } from "../../llm/factory";
import { preparePromptExecution, runTextPrompt } from "../../prompting/core/promptRunner";
import { runtimeSetupGuidancePrompt } from "../../prompting/prompts/agent/runtime.prompts";
import type { StructuredIntent, ToolCall, ToolExecutionContext } from "../types";
import type { ToolExecutionResult } from "./runtimeHelpers";
import {
  buildNovelSetupGuidanceFacts,
  formatNovelSetupGuidance,
  parseNovelSetupStatus,
} from "./novelSetupResponses";

type GuidanceScene =
  | "create_missing_title"
  | "produce_missing_title"
  | "create_setup"
  | "select_setup";

type GuidanceLLMFactory = typeof getLLM;

let guidanceLLMFactory: GuidanceLLMFactory = getLLM;

function resolveGuidanceMaxTokens(maxTokens: number | undefined): number | undefined {
  if (typeof maxTokens !== "number" || !Number.isFinite(maxTokens)) {
    return undefined;
  }
  return Math.min(Math.floor(maxTokens), 8000);
}

function truncateFact(value: string, max = 160): string {
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

function buildIntentFacts(structuredIntent?: StructuredIntent): string {
  if (!structuredIntent) {
    return "Actualmente no hay señales de creación estructuradas adicionales.";
  }
  const lines = [
    structuredIntent.novelTitle ? `El usuario ha mencionado el título:${truncateFact(structuredIntent.novelTitle)}` : "El usuario aún no ha especificado el título.",
    structuredIntent.genre ? `Temas mencionados por los usuarios:${truncateFact(structuredIntent.genre)}` : null,
    structuredIntent.description ? `Configuraciones mencionadas por los usuarios:${truncateFact(structuredIntent.description)}` : null,
    structuredIntent.styleTone ? `Estilos mencionados por los usuarios:${truncateFact(structuredIntent.styleTone)}` : null,
  ].filter((item): item is string => Boolean(item));

  return lines.length > 0 ? lines.join("\n") : "Actualmente no hay señales de creación estructuradas adicionales.";
}

function fallbackForMissingTitle(scene: GuidanceScene): string {
  if (scene === "produce_missing_title") {
    return "Bien, establezcamos primero el punto de partida de este libro. ¿Quieres darle primero un título provisional o empezar hablando del tema, el protagonista y el conflicto central?";
  }
  return "Bien, primero finalicemos el prototipo de este libro. ¿Quieres darle primero un título provisional o decirme primero qué género quieres escribir y quién es el protagonista?";
}

async function composeWarmGuidance(input: {
  goal: string;
  scene: GuidanceScene;
  context: Omit<ToolExecutionContext, "runId" | "agentName">;
  facts: string;
  fallback: string;
  structuredIntent?: StructuredIntent;
}): Promise<string> {
  try {
    const resolvedMaxTokens = resolveGuidanceMaxTokens(input.context.maxTokens);
    const sceneInstruction = input.scene === "create_missing_title"
      ? "El usuario acaba de expresar su deseo de escribir una novela, pero aún no ha desarrollado un título para crearla."
      : input.scene === "produce_missing_title"
        ? "El usuario desea iniciar la producción completa del libro directamente, pero actualmente no hay ningún título ni contexto de novela disponibles."
        : input.scene === "create_setup"
          ? "La novela se creó con éxito y ahora debemos continuar con la guía de inicialización de apertura del libro."
          : "El usuario acaba de regresar al espacio de trabajo de una novela y necesita continuar con la inicialización inacabada.";
    if (guidanceLLMFactory === getLLM) {
      const result = await runTextPrompt({
        asset: runtimeSetupGuidancePrompt,
        promptInput: {
          sceneInstruction,
          goal: input.goal,
          intentFacts: buildIntentFacts(input.structuredIntent),
          knownFacts: input.facts,
        },
        options: {
          provider: input.context.provider ?? "deepseek",
          model: input.context.model,
          temperature: Math.max(input.context.temperature ?? 0.7, 0.7),
          maxTokens: resolvedMaxTokens,
        },
      });
      return result.output.trim() || input.fallback;
    }

    const prepared = preparePromptExecution({
      asset: runtimeSetupGuidancePrompt,
      promptInput: {
        sceneInstruction,
        goal: input.goal,
        intentFacts: buildIntentFacts(input.structuredIntent),
        knownFacts: input.facts,
      },
    });
    const llm = await guidanceLLMFactory(input.context.provider ?? "deepseek", {
      model: input.context.model,
      temperature: Math.max(input.context.temperature ?? 0.7, 0.7),
      maxTokens: resolvedMaxTokens,
      taskType: runtimeSetupGuidancePrompt.taskType,
      promptMeta: prepared.invocation,
    });
    const result = await llm.invoke(prepared.messages);
    const text = extractTextFromContent(result.content);
    return text || input.fallback;
  } catch {
    return input.fallback;
  }
}

export async function composeCreateNovelSetupAnswer(
  goal: string,
  results: ToolExecutionResult[],
  context: Omit<ToolExecutionContext, "runId" | "agentName">,
  structuredIntent?: StructuredIntent,
): Promise<string> {
  const created = getSuccessfulOutput(results, "create_novel");
  if (!created) {
    return composeWarmGuidance({
      goal,
      scene: "create_missing_title",
      context,
      structuredIntent,
      facts: "Actualmente no existe ninguna novela exitosa ni ningún título de novela estable.",
      fallback: fallbackForMissingTitle("create_missing_title"),
    });
  }

  const title = typeof created.title === "string" ? created.title.trim() : "";
  const setup = parseNovelSetupStatus(created.setup);
  if (title && setup) {
    return composeWarmGuidance({
      goal,
      scene: "create_setup",
      context,
      structuredIntent,
      facts: buildNovelSetupGuidanceFacts(setup),
      fallback: formatNovelSetupGuidance(`La novela "${title}», primero completemos las configuraciones más críticas.`, setup),
    });
  }

  return title ? `La novela "${title}».` : "Novela creada.";
}

export async function composeSelectNovelWorkspaceSetupAnswer(
  goal: string,
  results: ToolExecutionResult[],
  context: Omit<ToolExecutionContext, "runId" | "agentName">,
  structuredIntent?: StructuredIntent,
): Promise<string> {
  const selected = getSuccessfulOutput(results, "select_novel_workspace");
  if (!selected) {
    return "Dime a qué novela quieres cambiar y seguiré avanzando con su ambientación.";
  }

  const title = typeof selected.title === "string" ? selected.title.trim() : "";
  const setup = parseNovelSetupStatus(selected.setup);
  if (title && setup && setup.stage !== "ready_for_production") {
    return composeWarmGuidance({
      goal,
      scene: "select_setup",
      context,
      structuredIntent,
      facts: buildNovelSetupGuidanceFacts(setup),
      fallback: formatNovelSetupGuidance(`Cambiado a la novela "${title}"Espacio de trabajo, continuamos completando la configuración.`, setup),
    });
  }

  return title ? `El espacio de trabajo actual ha sido cambiado a "${title}».` : "El espacio de trabajo actual ha sido cambiado.";
}

export async function composeMissingNovelKickoffAnswer(
  goal: string,
  context: Omit<ToolExecutionContext, "runId" | "agentName">,
  structuredIntent: StructuredIntent | undefined,
  scene: "create_missing_title" | "produce_missing_title",
): Promise<string> {
  return composeWarmGuidance({
    goal,
    scene,
    context,
    structuredIntent,
    facts: [
      "Actualmente no hay ningún contexto novedoso disponible.",
      structuredIntent?.novelTitle ? `Actualmente hay pistas de títulos:${truncateFact(structuredIntent.novelTitle)}` : "Actualmente no existe ningún título confiable.",
    ].join("\n"),
    fallback: fallbackForMissingTitle(scene),
  });
}

export function setNovelSetupGuidanceLLMFactoryForTests(factory?: GuidanceLLMFactory): void {
  guidanceLLMFactory = factory ?? getLLM;
}
