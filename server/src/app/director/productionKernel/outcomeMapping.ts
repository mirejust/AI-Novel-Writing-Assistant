import type { StepResult } from "../../../modules/director";
import type { UnitOutcome, UnitRef } from "../../../modules/production";
type StopSignal = NonNullable<StepResult["stopSignal"]>;

export interface MappedProductionUnit {
  unit: UnitRef;
  closed: boolean;
  debts: NonNullable<StepResult["debts"]>;
  stopSignal?: StopSignal;
}

/** Maps saved structured decisions only; completed means finalized assets, not an absence of quality debt. */
export function mapProductionUnitOutcome(outcome: UnitOutcome): MappedProductionUnit {
  const progress = outcome.progress;
  const saved = Boolean(progress.selected && progress.selectedContentHash
    && progress.committedContentHash === progress.selectedContentHash && progress.completed.includes("commit"));
  const manual = outcome.status === "paused";
  const debts = [...new Set(progress.debts?.map(debt => debt.code) ?? [])].map(code => ({ chapterOrder: progress.unit.order,
    code, action: manual ? "pause_for_manual" : "defer_and_continue" }));
  const result: MappedProductionUnit = { unit: { ...progress.unit }, closed: false, debts };
  const stop = (signal: StopSignal): MappedProductionUnit => ({ ...result, stopSignal: signal });
  const integrity = () => stop({ kind: "data_integrity", action: "fail_task", source: "runtime", reason: "El texto del capítulo no coincide con el registro de finalización; regrese a la página del capítulo para verificarlo." });
  if (outcome.status === "completed") {
    if (!saved || !progress.completed.includes("reconcile") || !["completed", "degraded"].includes(progress.reconcileStatus ?? "")) return integrity();
    return { ...result, closed: true };
  }
  if (manual) {
    if (progress.styleReviewPause && !progress.styleReviewPause.acknowledged) {
      if (progress.committedContentHash || !progress.selectedContentHash
        || progress.styleReviewPause.contentHash !== progress.selectedContentHash) return integrity();
      // A book-level opt-in review rejection is a runtime gate: it must block commit in
      // any issue policy, so it cannot rely on the quality_first-only pause signal.
      return stop({ kind: "manual_recovery", action: "pause_for_manual", source: "runtime",
        reason: "La revisión escrita de este capítulo falló. Confirme desde la página del capítulo y continúe escribiendo." });
    }
    if (!saved || !progress.qualityPause || progress.qualityPause.acknowledged
      || progress.qualityPause.contentHash !== progress.committedContentHash) return integrity();
    return stop({ kind: "manual_recovery", action: "pause_for_manual", source: "quality", reason: "El texto de este capítulo ha sido guardado. Consulte el recordatorio de calidad de la página del capítulo antes de continuar." });
  }
  if (outcome.status === "stopped" && outcome.reason === "global_book") {
    return stop({ kind: "replan", action: "stop_for_replan", source: "quality", reason: "El capítulo actual necesita ajustar el plan general del libro; consulte los arreglos de seguimiento desde la página de creación." });
  }
  if (outcome.status === "failed") {
    if (outcome.reason === "data_integrity") return integrity();
    if (outcome.reason === "no_usable_content") return stop({kind: "manual_recovery", action: "pause_for_manual", source: "runtime", reason: "generation_output_unusable"});
    return stop({ kind: "safety", action: "fail_task", source: "runtime", reason: "La redacción de este capítulo no se pudo completar de manera segura; regrese a la página del capítulo para verificar." });
  }
  return stop({ kind: "manual_recovery", action: "pause_for_manual", source: "runtime",
    reason: outcome.status === "budget_exhausted" ? "La cuota disponible para este capítulo es insuficiente. Ajuste la cuota desde la página de creación antes de continuar." : "El resultado de la redacción de este capítulo aún no se ha confirmado. Regrese a la página del capítulo para verificar antes de continuar." });
}
