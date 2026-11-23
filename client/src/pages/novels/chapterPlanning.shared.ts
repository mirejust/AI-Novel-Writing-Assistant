import type {
  AuditReport,
  QualityScore,
  ReplanRecommendation,
  ReviewIssue,
} from "@ai-novel/shared/types/novel";

export interface ChapterReviewResult {
  score: QualityScore;
  issues: ReviewIssue[];
  auditReports?: AuditReport[];
  replanRecommendation?: ReplanRecommendation;
}

export function buildReplanRecommendationFromAuditReports(
  auditReports: AuditReport[] | null | undefined,
): ReplanRecommendation | null {
  if (!auditReports || auditReports.length === 0) {
    return null;
  }

  const blockingIssueIds = auditReports
    .flatMap((report) => report.issues)
    .filter((issue) => issue.status === "open" && (issue.severity === "high" || issue.severity === "critical"))
    .map((issue) => issue.id);

  return {
    recommended: blockingIssueIds.length > 0,
    reason: blockingIssueIds.length > 0
      ? "Hay cuestiones de auditoría de alta prioridad sin resolver y se recomienda volver a planificar los capítulos siguientes."
      : "Actualmente no hay problemas de auditoría que bloqueen y no es necesario volver a planificar los capítulos siguientes.",
    blockingIssueIds,
  };
}
