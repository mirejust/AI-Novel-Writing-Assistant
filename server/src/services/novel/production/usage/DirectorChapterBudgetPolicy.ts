import type {DirectorChapterBudgetGrant, DirectorChapterBudgetStage, DirectorChapterBudgetView} from "@ai-novel/shared/types/director/chapterBudget";
import {automaticDirectorChapterTopUp, directorChapterTokenLimitSchema, recommendDirectorChapterTokenLimit} from "@ai-novel/shared/types/director/chapterBudget";
import type {PipelineDirectorSnapshot} from "../directorBridge";
import {DIRECTOR_CHAPTER_PREFLIGHT_RESERVE_TOKENS, DIRECTOR_CHAPTER_TOKEN_LIMIT} from "./DirectorChapterUsageBudget";

type Checkpoint = NonNullable<PipelineDirectorSnapshot["chapterUsage"]>[number];

export function chapterBudgetView(jobId: string, row: Checkpoint): DirectorChapterBudgetView {
  const usedTokens = row.effectiveTokens ?? row.totalTokens;
  const reserveTokens = row.budgetPause?.reserveTokens
    ?? (row.endJobTokens === undefined ? DIRECTOR_CHAPTER_PREFLIGHT_RESERVE_TOKENS : 0);
  const tokenLimit = row.tokenLimit ?? DIRECTOR_CHAPTER_TOKEN_LIMIT;
  const recommendedLimit = recommendDirectorChapterTokenLimit(tokenLimit, usedTokens, reserveTokens);
  return {jobId, chapterId: row.chapterId, chapterOrder: row.chapterOrder,
    metric: row.metric ?? "raw_tokens_v1", usedTokens, rawTokens: row.totalTokens,
    ...(row.metric ? {promptTokens: row.promptTokens, completionTokens: row.completionTokens, cacheHitTokens: row.cacheHitTokens,
      ...(row.unclassifiedTokens ? {unclassifiedTokens: row.unclassifiedTokens} : {})} : {}),
    tokenLimit, automaticTopUpTokens: row.automaticTopUpTokens, reserveTokens, recommendedLimit,
    stage: row.budgetPause?.stage ?? null, closed: row.endJobTokens !== undefined};
}

/** A structured saved decision, never error-text matching, identifies the paused chapter. */
export function readPausedChapterBudget(snapshot: PipelineDirectorSnapshot, jobId: string): DirectorChapterBudgetView | null {
  const unresolved = snapshot.decisions.slice(snapshot.resolvedDecisionCount ?? 0);
  const pauses = unresolved.filter(decision => decision.action === "pause_for_manual" || decision.action === "fail_task");
  const decision = pauses.filter(decision => decision.issueCode === "runtime.token_budget_exceeded").at(-1);
  if (!decision || decision.issueCode !== "runtime.token_budget_exceeded" || !decision.chapterOrder) return null;
  const row = snapshot.chapterUsage?.find(item => item.chapterOrder === decision.chapterOrder);
  return row ? chapterBudgetView(jobId, row) : null;
}

export function authorizeChapterBudget(snapshot: PipelineDirectorSnapshot, jobId: string, grant: DirectorChapterBudgetGrant): void {
  if (grant.applyToRemaining && !directorChapterTokenLimitSchema.safeParse(grant.tokenLimit).success) {
    throw new Error("Los capítulos posteriores deben tener un límite de un número entero entre 16.001 y 10.000.000.");
  }
  const view = readPausedChapterBudget(snapshot, jobId);
  if (!view || grant.jobId !== jobId || grant.chapterId !== view.chapterId) throw new Error("La autorización presupuestaria no coincide con el capítulo suspendido, actualice e inténtelo nuevamente.");
  if (grant.metric !== view.metric) throw new Error("El calibre de medición del presupuesto ha cambiado; actualice e inténtelo nuevamente.");
  if (!Number.isSafeInteger(grant.tokenLimit) || grant.tokenLimit > 10_000_000
    || grant.tokenLimit <= view.tokenLimit || grant.tokenLimit <= view.usedTokens + view.reserveTokens) {
    throw new Error("El monto de este capítulo debe ser superior al monto utilizado, a la próxima reserva y al límite superior actual.");
  }
  const row = snapshot.chapterUsage!.find(item => item.chapterId === view.chapterId)!;
  row.tokenLimit = grant.tokenLimit;
  if (grant.applyToRemaining) {
    snapshot.chapterTokenLimit = grant.tokenLimit;
    snapshot.chapterBudgetAutomatic = false;
  }
  delete row.budgetPause;
}

export function pauseChapterBudget(row: Checkpoint, reserveTokens: number, stage: DirectorChapterBudgetStage | null,
  automatic = false): boolean {
  if (!Number.isSafeInteger(reserveTokens) || reserveTokens < 0) throw new Error("La estimación del presupuesto del siguiente paso no es válida.");
  const view = chapterBudgetView("", row);
  if (view.usedTokens < view.tokenLimit && (reserveTokens === 0 || view.usedTokens + reserveTokens < view.tokenLimit)) return false;
  if (automatic && row.automaticTopUpTokens == null && !row.budgetPause) {
    const newLimit = automaticDirectorChapterTopUp(view.tokenLimit, view.usedTokens, reserveTokens);
    if (newLimit !== null) {
      row.automaticTopUpTokens = newLimit - view.tokenLimit;
      row.tokenLimit = newLimit;
      return false;
    }
  }
  row.budgetPause = {reserveTokens, stage};
  return true;
}
