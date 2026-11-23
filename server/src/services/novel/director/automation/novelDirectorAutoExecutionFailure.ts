import type { DirectorAutoExecutionState } from "@ai-novel/shared/types/novelDirector";

export function isSkippableAutoExecutionReviewFailure(message: string | null | undefined): boolean {
  const normalized = message?.trim() ?? "";
  return normalized.startsWith("Chapter generation is blocked until review is resolved.");
}

function formatAutoExecutionContinuation(input: Pick<
  DirectorAutoExecutionState,
  "remainingChapterCount" | "nextChapterOrder"
>): string {
  const remainingPart = typeof input.remainingChapterCount === "number"
    ? input.remainingChapterCount > 0
      ? `todavía hay ${input.remainingChapterCount} Capítulo continuará`
      : "Actualmente no hay capítulos para continuar."
    : "Actualmente hay capítulos para continuar.";
  const nextPart = typeof input.nextChapterOrder === "number"
    ? `, el sistema comenzará desde el ${input.nextChapterOrder} El capítulo continúa`
    : ", el sistema continuará desde el siguiente capítulo";
  return `${remainingPart}${nextPart}.`;
}

function formatAutoExecutionActionLabel(
  autoExecution?: Pick<DirectorAutoExecutionState, "scopeLabel"> | null,
): string {
  const scopeLabel = autoExecution?.scopeLabel?.trim();
  return scopeLabel ? `Continuar la ejecución automática${scopeLabel}` : "Continuar ejecutando automáticamente el alcance actual";
}

export function buildSkippableAutoExecutionReviewFailureSummary(
  autoExecution?: Pick<DirectorAutoExecutionState, "remainingChapterCount" | "nextChapterOrder" | "scopeLabel"> | null,
): string {
  return [
    "El capítulo actual está suspendido debido al bloqueo de revisión, pero estos problemas le permiten omitir el capítulo actual y continuar con la ejecución.",
    `Haga clic en "${formatAutoExecutionActionLabel(autoExecution)}”, el sistema continuará ejecutando directamente los capítulos restantes.`,
    formatAutoExecutionContinuation({
      remainingChapterCount: autoExecution?.remainingChapterCount,
      nextChapterOrder: autoExecution?.nextChapterOrder,
    }),
  ].join(" ");
}

export function buildSkippableAutoExecutionReviewCheckpointSummary(input: {
  scopeLabel: string;
  autoExecution?: Pick<DirectorAutoExecutionState, "remainingChapterCount" | "nextChapterOrder"> | null;
}): string {
  return [
    `${input.scopeLabel}Se ha ingresado a la ejecución automática, pero el capítulo actual está suspendido debido al bloqueo de revisión.`,
    "Este tipo de pregunta le permite saltarse el capítulo actual y continuar.",
    formatAutoExecutionContinuation({
      remainingChapterCount: input.autoExecution?.remainingChapterCount,
      nextChapterOrder: input.autoExecution?.nextChapterOrder,
    }),
  ].join(" ");
}

export function buildSkippableAutoExecutionReviewBlockingReason(
  autoExecution?: Pick<DirectorAutoExecutionState, "nextChapterOrder" | "scopeLabel"> | null,
): string {
  const actionLabel = formatAutoExecutionActionLabel(autoExecution);
  if (typeof autoExecution?.nextChapterOrder === "number") {
    return `El capítulo actual está suspendido debido al bloqueo de revisión, pero estos problemas le permiten omitir el capítulo actual y continuar con la ejecución. Haga clic en "${actionLabel}”, el sistema comenzará desde el ${autoExecution.nextChapterOrder} El capítulo continúa.`;
  }
  return `El capítulo actual está suspendido debido al bloqueo de revisión, pero estos problemas le permiten omitir el capítulo actual y continuar con la ejecución. Haga clic en "${actionLabel}”, el sistema continuará a partir del siguiente capítulo.`;
}

export function buildSkippableAutoExecutionReviewRecoveryHint(
  autoExecution?: Pick<DirectorAutoExecutionState, "nextChapterOrder" | "scopeLabel"> | null,
): string {
  const actionLabel = formatAutoExecutionActionLabel(autoExecution);
  if (typeof autoExecution?.nextChapterOrder === "number") {
    return `Puedes hacer clic directamente en "${actionLabel}”, el sistema omitirá el capítulo de bloqueo de revisión actual y comenzará desde el ${autoExecution.nextChapterOrder} El capítulo continúa; Si necesita reparar el capítulo actual, regrese al proceso de ejecución del capítulo o reparación de calidad.`;
  }
  return `Puedes hacer clic directamente en "${actionLabel}", el sistema omitirá el capítulo actual bloqueado por auditoría y continuará desde el siguiente capítulo; si necesita reparar el capítulo actual, regrese a la ejecución del capítulo o al procesamiento de reparación de calidad.`;
}
