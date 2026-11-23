import type { NovelUsageQuery, NovelUsageSummary } from "@ai-novel/shared/types/llmUsage";

export function formatUsageTokens(value: number | null | undefined): string {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value.toLocaleString() : "No disponible";
}

export function usageCoverageNotes(summary: Pick<NovelUsageSummary, "recordedCallCount" | "unknownUsageCallCount" | "cacheReportedCallCount" | "partialCallCount">): string[] {
  const notes: string[] = [];
  if (summary.unknownUsageCallCount) notes.push(`${summary.unknownUsageCallCount} No se devolvió ningún token para esta llamada y el uso total solo incluye la parte informada.`);
  if (summary.recordedCallCount && summary.cacheReportedCallCount < summary.recordedCallCount) {
    notes.push(`Anulación de estadísticas de caché ${summary.cacheReportedCallCount}/${summary.recordedCallCount} llamadas, sólo se agrega la porción reportada de aciertos y errores.`);
  }
  if (summary.partialCallCount) notes.push(`${summary.partialCallCount} La llamada se devuelve sólo parcialmente y las estadísticas pueden estar incompletas.`);
  return notes;
}

export function usageFiltersFromParams(params: URLSearchParams): NovelUsageQuery {
  const filters: NovelUsageQuery = {};
  for (const key of ["chapterId", "stage", "provider", "model"] as const) {
    const value = params.get(key)?.trim();
    if (value) filters[key] = value;
  }
  const status = params.get("status");
  if (status === "completed" || status === "partial" || status === "failed") filters.status = status;
  return filters;
}

const stages: Record<string, string> = {
  writer: "Generación de texto", chapter_writer: "Generación de texto", chapter_writing: "Generación de texto",
  chapter_acceptance: "Aceptación del capítulo", review: "Revisión", chapter_review: "Revisión del capítulo",
  chapter_repair: "Revisión de texto", repair: "Revisión de texto", chapter_patch: "Revisión parcial",
  chapter_artifact_sync: "Organización de datos del capítulo", chapter_summary: "Resumen del capítulo",
  chapter_artifact_delta: "Reabastecimiento de recursos del capítulo", payoff_ledger_reconcile: "Previendo la calibración general", payoff_ledger_planning: "Presagio de planificación",
  chapter_batch: "Creación de lotes de capítulos", production_run: "Creación de texto",
  story_macro: "Planificación de la historia", story_macro_plan: "Planificación de la historia", book_contract: "Objetivos de creación del libro.",
  world_setup: "Ambientación del mundo", character_setup: "Configuración de personajes", volume_strategy: "Planificación de volumen",
  volume_beat_sheet: "planificación de la sección rítmica", volume_chapter_list: "Planificación del índice del capítulo",
  chapter_detail_bundle: "Tareas y escenas del capítulo.", structured_outline: "Planificación del capítulo",
  replan: "Replanificación posterior", chapter_local_replan: "Replanificación para capítulos posteriores",
};
export function usageStageLabel(stage: string | null): string { return stage ? stages[stage] ?? stage : "Pasos de creación no registrados"; }
export function usageStatusLabel(status: string): string {
  return status === "completed" ? "Llamada completada" : status === "partial" ? "Devolución parcial" : status === "failed" ? "Llamada fallida" : "Estado no registrado";
}
export function usageTime(value: string | null): string {
  return value && Number.isFinite(Date.parse(value)) ? new Date(value).toLocaleString() : "Sin registro";
}

export function formatUsageDuration(ms: number | null | undefined): string {
  return ms == null ? "No disponible" : ms < 1000 ? `${Math.round(ms)} ms` : `${(ms / 1000).toFixed(1)} Segundo`;
}
export function usageTokensPerSecond(tokens: number | null, durationMs: number | null): string {
  return tokens !== null && durationMs !== null && durationMs > 0 ? (tokens * 1000 / durationMs).toFixed(1) : "No disponible";
}
