import { checkContextBudget } from "../../../production/common";
import { currentModelRequestBudget, currentModelRequestDescription, withModelRequestBudget } from "../../../../platform/llm/retries";

/** Default off. Existing short-story tasks keep the previous production path. */
export function shortStoryOnV2Enabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return ["true", "1"].includes(env.SHORT_STORY_ON_V2 ?? "false");
}

/** Reads an explicitly configured window. Unknown models stay unknown; nothing is inferred from a model family. */
export function contextWindowForConfiguredModel(provider: string, model: string, rawWindows = process.env.PRODUCTION_KERNEL_MODEL_WINDOWS): number | null {
  if (!provider.trim() || !model.trim()) return null;
  let rows: unknown;
  try {
    rows = JSON.parse(rawWindows ?? "[]");
  } catch {
    return null;
  }
  if (!Array.isArray(rows)) return null;
  const match = rows.find((row) => {
    if (!row || typeof row !== "object") return false;
    const value = row as { provider?: unknown; model?: unknown; contextWindow?: unknown };
    return value.provider === provider && value.model === model
      && typeof value.contextWindow === "number"
      && Number.isSafeInteger(value.contextWindow)
      && value.contextWindow > 0;
  }) as { contextWindow: number } | undefined;
  return match?.contextWindow ?? null;
}

export const SHORT_STORY_AUDIT_OUTPUT_TOKENS = 5000;
export const SHORT_STORY_AUDIT_SAFETY_TOKENS = 1024;

export type ShortStoryAuditBudget =
  | { ok: true; estimatedInputTokens: number; requiredTokens: number; contextWindow: number }
  | { ok: false; reason: "unknown_context_window" | "context_budget_exceeded"; summary: string };

/** Full-story review must fit in one model read. An unknown window is not treated as unlimited. */
export function evaluateShortStoryFullAuditBudget(input: {
  content: string;
  contextWindow: number | null;
  outputTokens?: number;
}): ShortStoryAuditBudget {
  const outputTokens = input.outputTokens ?? SHORT_STORY_AUDIT_OUTPUT_TOKENS;
  const result = checkContextBudget({
    input: input.content,
    contextWindow: input.contextWindow,
    outputTokens,
    safetyTokens: SHORT_STORY_AUDIT_SAFETY_TOKENS,
  });
  if (result.ok) {
    return {
      ok: true,
      estimatedInputTokens: result.estimatedInputTokens,
      requiredTokens: result.requiredTokens,
      contextWindow: result.contextWindow,
    };
  }
  if ("reason" in result && result.reason === "unknown_context_window") {
    return {
      ok: false,
      reason: "unknown_context_window",
      summary: "El tamaño del contexto del modelo actual aún no se ha configurado. Comuníquese con el mantenedor para completar la información de capacidad del modelo y continuar con la revisión completa.",
    };
  }
  return {
    ok: false,
    reason: "context_budget_exceeded",
    summary: "Este manuscrito terminado excede el alcance del modelo actual que se puede leer de una sola vez. Cambie a un modelo con un contexto más amplio antes de continuar con la revisión completa.",
  };
}

export class ShortStoryAuditBudgetError extends Error {}

/** Checks the actual primary, fallback and correction request at the existing dispatch boundary. */
export async function withShortStoryAuditBudget<T>(readWindow: (provider: string, model: string) => Promise<number | null>,
  operation: () => Promise<T>): Promise<T> {
  const parent = currentModelRequestBudget();
  let denied: ShortStoryAuditBudgetError | undefined;
  try {
    const result = await withModelRequestBudget({
      remaining: () => denied ? 0 : parent?.remaining() ?? Number.POSITIVE_INFINITY,
      beforeRequest: async () => {
        if (denied) throw denied;
        const request = currentModelRequestDescription();
        if (!request?.configuration) throw new Error("En la inspección de texto completo faltan solicitudes de modelos reales.");
        const configuration = request.configuration;
        if (!Number.isSafeInteger(configuration.maxTokens) || configuration.maxTokens! < 1) {
          denied = new ShortStoryAuditBudgetError("La verificación del artículo completo carece de un límite superior de salida único válido; verifique la configuración del modelo.");
          throw denied;
        }
        const budget = evaluateShortStoryFullAuditBudget({
          content: JSON.stringify({ input: request.input, options: request.options, modelKwargs: configuration.modelKwargs }),
          contextWindow: await readWindow(configuration.provider, configuration.model),
          outputTokens: configuration.maxTokens,
        });
        if (!budget.ok) {
          denied = new ShortStoryAuditBudgetError(budget.summary);
          throw denied;
        }
        await parent?.beforeRequest();
      },
    }, operation);
    // Native structured retries may classify an adapter error; preserve the original budget refusal.
    if (denied) throw denied;
    return result;
  } catch (error) {
    throw denied ?? error;
  }
}

/** One repair is allowed. Only a passing second review may keep the repaired manuscript. */
export function postRepairKeepsManuscript(decision: "accepted" | "patchable" | "replan_required"): boolean {
  return decision === "accepted";
}

export function qualityDebtFromAudit(audit: { summary: string; issues: Array<{ description: string }> }): string[] {
  const issues = audit.issues.map((issue) => issue.description.trim()).filter((item) => item.length >= 4);
  if (issues.length > 0) return issues.slice(0, 20);
  const summary = audit.summary.trim();
  return summary.length >= 4 ? [summary] : [];
}
