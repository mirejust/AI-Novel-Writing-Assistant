import { DEFAULT_MODEL_OUTPUT_TOKENS } from "@ai-novel/shared/types/llm";
import type { StructuredResponseEvidence } from "@ai-novel/shared/types/structuredDiagnostics";
import { runWithInvocationChain } from "../../../llm/compatibility";
import { resolveModel } from "../../../llm/modelRouter";
import { StructuredOutputError } from "../../../llm/structuredOutput";
import { AppError } from "../../../middleware/errorHandler";
import { currentModelRequestBudget } from "../../../platform/llm/retries";
import { runStructuredPrompt } from "../../../prompting/core/promptRunner";
import type { PromptExecutionOptions } from "../../../prompting/core/promptTypes";
import type { NovelThemeWorldGenerationPromptInput } from "../../../prompting/prompts/world/world.promptTypes";
import { novelThemeWorldGenerationPrompt } from "../../../prompting/prompts/world/world.prompts";
import { rethrowWithWorldGenerationTimeoutHint } from "../../settings/worldGeneration/timeoutSettings";

const WORLD_BUDGET_FLOOR = 12_000;
const WORLD_BUDGET_RETRY_CEILING = 48 * 1024;

function worldRouteLimit(maxTokens?: number | null): number {
  return maxTokens != null && maxTokens >= WORLD_BUDGET_FLOOR ? maxTokens : Infinity;
}

function retryBudget(response?: StructuredResponseEvidence): number | undefined {
  if (response == null) return undefined;
  const trace = response.budgetTrace;
  if (trace == null || response.maxTokens == null) return undefined;
  // A frozen budget is a scoped override: raising it is a no-op.
  if (trace.frozenMaxTokens != null) return undefined;
  const limit = response.maxTokens;
  // Some providers report visible tokens only even when thinking exhausted the request.
  const truncated = response.finishReason === "length" || response.finishReason === "max_tokens";
  if (!truncated && (response.tokenUsage?.completionTokens ?? 0) < limit) return undefined;
  const nextLimit = Math.min(
    limit * 2, WORLD_BUDGET_RETRY_CEILING, worldRouteLimit(trace.routeMaxTokens), trace.endpointMaxTokens ?? Infinity,
  );
  return nextLimit >= WORLD_BUDGET_FLOOR && nextLimit > limit ? nextLimit : undefined;
}

class NovelThemeWorldGenerationError extends AppError {
  readonly category: StructuredOutputError["category"];

  constructor(
    message: string,
    statusCode: number,
    cause: StructuredOutputError,
    sourceRoute: "/settings/models" | "/settings/model-routes" = "/settings/models",
  ) {
    super(message, statusCode, { sourceRoute });
    this.category = cause.category;
    this.cause = cause;
  }
}

export function runNovelThemeWorldGeneration(
  promptInput: NovelThemeWorldGenerationPromptInput,
  options: PromptExecutionOptions,
) {
  return runWithInvocationChain(async () => {
    const route = await resolveModel(novelThemeWorldGenerationPrompt.taskType);
    const startingBudget = promptInput.openingOnly
      ? WORLD_BUDGET_FLOOR
      : Math.max(WORLD_BUDGET_FLOOR, DEFAULT_MODEL_OUTPUT_TOKENS);
    // The generic automatic budget floors at 16,384, so pass this step's allowance explicitly.
    let requestedMaxTokens = Math.min(startingBudget, worldRouteLimit(route.routeMaxTokens));
    for (let attempt = 0; ; attempt++) {
      try {
        return await runStructuredPrompt({
          asset: novelThemeWorldGenerationPrompt,
          promptInput,
          options: { ...options, reasoningEnabled: false, maxTokens: requestedMaxTokens, structuredTransportRetryCount: 0 },
        });
      } catch (error) {
        if (!(error instanceof StructuredOutputError)) rethrowWithWorldGenerationTimeoutHint(error);
        const { response, target, fallbackAvailable, fallbackUsed } = error.diagnostics;
        const budgetFailure = error.category === "reasoning_budget_exhausted" || error.category === "output_budget_exhausted";
        const timedOut = error.category === "transport_error"
          && (response?.failureReason === "timeout" || response?.httpStatus === 408 || response?.httpStatus === 504);
        const rateLimited = error.category === "transport_error"
          && (response?.failureReason === "rate_limited" || response?.httpStatus === 429);
        const model = target?.model ?? options.model;
        const modelLabel = model ? `Modelo"${model}»` : "Modelo";
        const requestLimit = response?.maxTokens ?? requestedMaxTokens;
        const limit = `El límite de solicitud real esta vez es ${requestLimit.toLocaleString("zh-CN")} Simbólico.`;
        if (rateLimited) {
          // A reservation-based 429 cannot clear by retrying the same allowance.
          throw new NovelThemeWorldGenerationError(
            `${modelLabel}Se activa la limitación de corriente (429).${limit}Vuelva a intentarlo más tarde o cambie a un modelo cuya cuota admita esta solicitud.`,
            429,
            error,
          );
        }
        if (!budgetFailure && !timedOut) throw error;

        // A configured fallback is the second chance; don't restart the primary chain afterwards.
        if (attempt === 0 && !fallbackAvailable && !fallbackUsed && !options.signal?.aborted
          && currentModelRequestBudget()?.remaining() !== 0) {
          const nextBudget = budgetFailure ? retryBudget(response) : undefined;
          if (nextBudget != null) {
            requestedMaxTokens = nextBudget;
            continue;
          }
          if (timedOut) continue;
        }

        if (timedOut) {
          const waited = response?.durationMs == null ? "" : `(Esta vez esperando ${(response.durationMs / 1000).toFixed(1)} Segundo)`;
          throw new NovelThemeWorldGenerationError(
            `${modelLabel}Generar tiempo de espera de configuración mundial${waited}.${limit}Aumente el tiempo de espera en "Configuración → Modelo y fabricante → Espera máxima para una sola generación", o cambie el modelo e inténtelo nuevamente.`,
            504,
            error,
          );
        }
        const reason = error.category === "reasoning_budget_exhausted"
          ? "Después de agotar la cuota de salida, todavía no has regresado a la configuración mundial." : "La cuota de producción se agotó antes de que se restableciera por completo el entorno mundial.";
        const routeLimited = response?.maxTokens === worldRouteLimit(response?.budgetTrace?.routeMaxTokens);
        const settingsHint = routeLimited
          ? "Verifique la longitud máxima de salida en \"Configuración → Gestión de enrutamiento de modelos → Planificación de esquemas\", o cambie el modelo e inténtelo nuevamente."
          : "Verifique el límite superior de salida del modelo en \"Configuración → Modelo y fabricante → Compatibilidad del modelo\", o cambie el modelo e inténtelo nuevamente.";
        throw new NovelThemeWorldGenerationError(
          `${modelLabel}${reason}.${limit}${settingsHint}`,
          502,
          error,
          routeLimited ? "/settings/model-routes" : "/settings/models",
        );
      }
    }
  });
}
