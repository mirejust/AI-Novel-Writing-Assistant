import { createHash } from "node:crypto";
import type { ChapterRuntimePackage } from "@ai-novel/shared/types/chapterRuntime";
import type { ReviewIssue } from "@ai-novel/shared/types/novel";
import type { StyleRewriteGuard } from "@ai-novel/shared/types/styleEngine";

export interface ChapterRepairCandidateEvaluation {
  content: string;
  pass: boolean;
  runtimePackage: ChapterRuntimePackage;
  issues?: ReviewIssue[];
  assessmentVerified?: boolean;
  rewriteGuard?: StyleRewriteGuard;
}

export interface ChapterRepairSelectionRecord {
  selected: "original" | "candidate";
  reasonCode:
    | "candidate_passed"
    | "candidate_resolved_blockers"
    | "candidate_improved"
    | "original_retained_new_severe_issue"
    | "original_retained_obligation_regression"
    | "original_retained_no_clear_improvement"
    | "original_retained_unverified_review";
  reason: string;
  originalContentHash: string;
  candidateContentHash: string;
  originalScore: number;
  candidateScore: number;
}

export function selectChapterRepairCandidate(input: {
  original: ChapterRepairCandidateEvaluation;
  candidate: ChapterRepairCandidateEvaluation;
}): ChapterRepairSelectionRecord {
  const originalSevereIssues = collectSevereIssueKeys(input.original);
  const candidateSevereIssues = collectSevereIssueKeys(input.candidate);
  const addedSevereIssues = [...candidateSevereIssues]
    .filter((key) => !originalSevereIssues.has(key));
  const originalMissing = collectMissingObligationKeys(input.original.runtimePackage);
  const candidateMissing = collectMissingObligationKeys(input.candidate.runtimePackage);
  const addedMissingObligations = [...candidateMissing]
    .filter((key) => !originalMissing.has(key));
  const base = {
    originalContentHash: hashContent(input.original.content),
    candidateContentHash: hashContent(input.candidate.content),
    originalScore: input.original.runtimePackage.audit.score.overall,
    candidateScore: input.candidate.runtimePackage.audit.score.overall,
  };

  const guard = input.candidate.rewriteGuard;
  if (input.candidate.assessmentVerified === false || (guard && (
    guard.sourceContentHash !== base.originalContentHash || guard.candidateContentHash !== base.candidateContentHash
    || guard.checks.some(check => check.status !== "passed")
    || ["patch_scope", "edit_budget", "protected_terms", "semantic_facts"].some(code => !guard.checks.some(check => check.code === code))
  ))) {
    return {
      ...base, selected: "original", reasonCode: "original_retained_unverified_review",
      reason: "Si la nueva inspección del texto candidato no ha completado una verificación efectiva, se conservarán el manuscrito original y los resultados de su inspección.",
    };
  }

  if (addedSevereIssues.length > 0) {
    return {
      ...base,
      selected: "original",
      reasonCode: "original_retained_new_severe_issue",
      reason: "El candidato a reparación introduce un problema de alta gravedad que el original no tiene, por lo que se conserva el original.",
    };
  }

  if (addedMissingObligations.length > 0
    || candidateMissing.size > originalMissing.size) {
    return {
      ...base,
      selected: "original",
      reasonCode: "original_retained_obligation_regression",
      reason: "Los candidatos a reparación añaden o amplían obligaciones del capítulo incumplidas y, por tanto, conservan el manuscrito original.",
    };
  }

  if (input.candidate.pass && !input.original.pass) {
    return {
      ...base,
      selected: "candidate",
      reasonCode: "candidate_passed",
      reason: "El candidato a reparación pasó la verificación de aceptación, pero el original falló.",
    };
  }

  const originalBlocking = countBlockingIssues(input.original);
  const candidateBlocking = countBlockingIssues(input.candidate);
  if (candidateBlocking < originalBlocking) {
    return {
      ...base,
      selected: "candidate",
      reasonCode: "candidate_resolved_blockers",
      reason: "Los candidatos a remediación reducen los problemas de bloqueo sin introducir nuevos problemas críticos o brechas en las obligaciones.",
    };
  }

  const originalIssueCount = input.original.runtimePackage.audit.openIssues.length;
  const candidateIssueCount = input.candidate.runtimePackage.audit.openIssues.length;
  if (candidateMissing.size < originalMissing.size || candidateIssueCount < originalIssueCount) {
    return {
      ...base,
      selected: "candidate",
      reasonCode: "candidate_improved",
      reason: "Los candidatos a remediación reducen las obligaciones incumplidas o los problemas de revisión estructurada sin introducir nuevos riesgos graves.",
    };
  }

  return {
    ...base,
    selected: "original",
    reasonCode: "original_retained_no_clear_improvement",
    reason: "Los candidatos a reparación no dieron como resultado una mejora clara de la calidad estructural, por lo que se conservó el original.",
  };
}

function hashContent(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

function collectSevereIssueKeys(evaluation: ChapterRepairCandidateEvaluation): Set<string> {
  return new Set([
    ...evaluation.runtimePackage.audit.openIssues
      .filter((issue) => issue.severity === "high" || issue.severity === "critical")
      // Runtime audit issues retain stable ids/codes. Derived ReviewIssue
      // values intentionally omit AI evidence, which is not an identity.
      .map((issue) => normalizeKey(issue.code || issue.id)),
  ]);
}

function collectMissingObligationKeys(runtimePackage: ChapterRuntimePackage): Set<string> {
  return new Set((runtimePackage.obligationCoverage?.missing ?? [])
    .map((obligation) => normalizeKey(`${obligation.kind}:${obligation.summary}`)));
}

function countBlockingIssues(evaluation: ChapterRepairCandidateEvaluation): number {
  const severeIssueCount = collectSevereIssueKeys(evaluation).size;
  const explicitBlockingCount = evaluation.runtimePackage.replanRecommendation?.blockingIssueIds?.length ?? 0;
  return Math.max(
    severeIssueCount + explicitBlockingCount,
    evaluation.runtimePackage.audit.hasBlockingIssues ? 1 : 0,
  );
}

function normalizeKey(value: string): string {
  return value.trim().toLowerCase();
}
