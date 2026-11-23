import type { ChapterIssueDecision, ChapterQualityReport } from "./chapterDetailBundle";

/** Deterministic projection of the existing structured AI contract, never classification of prose. */
export function resolveChapterQualityReports(reports: readonly ChapterQualityReport[]): ChapterIssueDecision {
  if (reports.length === 0 || reports.some(report => !report.assessment
    || !["use_as_is", "repair_contract", "replan_window"].includes(report.assessment.recommendedHandling))) {
    throw new Error("La calidad del capítulo carece de decisiones efectivas de procesamiento estructurado por IA.");
  }
  const reason = reports.flatMap(report => report.result.issues.map(issue => issue.summary.trim())).filter(Boolean).join(";")
    || "La evaluación del contrato del capítulo de IA brinda recordatorios de calidad.";
  if (reports.some(report => report.assessment?.recommendedHandling === "replan_window")) return {action: "stop_for_replan", reason};
  if (reports.some(report => report.assessment?.recommendedHandling === "repair_contract")) return {action: "local_patch_plan", reason};
  return {action: "continue_with_warning", reason};
}
