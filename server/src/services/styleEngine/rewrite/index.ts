import { createHash } from "node:crypto";
import { applyChapterPatchRepairPlan, type ChapterPatchRepairPlan } from "@ai-novel/shared/types/chapterPatchRepair";
import type { StyleRewriteBaseline, StyleRewriteGuard } from "@ai-novel/shared/types/styleEngine";

export const STYLE_REWRITE_POLICY_REVISION = "style-patch-v1";
const count = (text: string) => Array.from(text.replace(/\s/gu, "")).length;
export const styleContentHash = (text: string) => createHash("sha256").update(text).digest("hex");

/** Safety anchors only: this does not classify style or infer narrative facts. */
function numericTerms(text: string): string[] {
  return text.match(/\d+(?:[.,:/-]\d+)*(?:%|％)?/gu) ?? [];
}

function occurrences(text: string, term: string): number {
  return text.split(term).length - 1;
}

export function guardStylePatches(input: {
  original: string;
  plan: ChapterPatchRepairPlan;
  allowedIssueIds: string[];
  styleIssueIds: string[];
  protectedTerms?: string[];
}): { content: string; guard: StyleRewriteGuard; baseline: StyleRewriteBaseline } {
  const applied = applyChapterPatchRepairPlan(input.original, input.plan);
  const allowed = new Set(input.allowedIssueIds);
  const style = new Set(input.styleIssueIds);
  const scopeValid = applied.success && input.plan.patches.every(patch => patch.issueIds.length > 0
    && patch.issueIds.every(id => allowed.has(id)));
  const total = Math.max(1, count(input.original));
  const touchedRatio = input.plan.patches.reduce((sum, patch) => sum + count(patch.targetExcerpt), 0) / total;
  const addedCharacters = input.plan.patches.reduce((sum, patch) => sum
    + Math.max(0, count(patch.replacement) - count(patch.targetExcerpt)), 0);
  const lengthChangeRatio = (count(applied.content) - count(input.original)) / total;
  // Short pasted selections have a different denominator from full chapters.
  const budgetValid = touchedRatio <= (total < 500 ? 1 : 0.3)
    && addedCharacters / total <= (total < 500 ? 0.2 : 0.05)
    && Math.abs(lengthChangeRatio) <= 0.3;
  const protectedValid = input.plan.patches.every(patch => {
    // Explicit non-style repair may correct an erroneous draft fact. AI reacceptance
    // must separately verify the correction against its issue and canonical context.
    if (patch.issueIds.some(id => !style.has(id))) return true;
    const terms = new Set([...numericTerms(patch.targetExcerpt), ...numericTerms(patch.replacement),
      ...(input.protectedTerms ?? []).filter(Boolean)]);
    return [...terms].every(term => occurrences(patch.targetExcerpt, term) === occurrences(patch.replacement, term));
  });
  const guard: StyleRewriteGuard = {
    sourceContentHash: styleContentHash(input.original), candidateContentHash: styleContentHash(applied.content),
    policyRevision: STYLE_REWRITE_POLICY_REVISION, touchedRatio, addedCharacters, lengthChangeRatio,
    checks: [
      { code: "patch_scope", status: scopeValid ? "passed" : "blocked", reason: scopeValid ? "Se han comprobado los fragmentos que deben modificarse esta vez." : "Las revisiones que contienen cambios no confirmados o fragmentos que no pueden localizarse de manera confiable conservan el manuscrito original." },
      { code: "edit_budget", status: budgetValid ? "passed" : "blocked", reason: budgetValid ? "El alcance y la duración de las modificaciones están dentro del alcance de la protección." : "Si el alcance de la modificación o la extensión de las nuevas adiciones es demasiado grande, se conservará el manuscrito original." },
      { code: "protected_terms", status: protectedValid ? "passed" : "blocked", reason: protectedValid ? "Los parches de expresión conservan los términos del texto original protegidos explícitamente." : "Los parches de expresión cambian números o nombres propios protegidos, conservando el original." },
      { code: "semantic_facts", status: "not_checked", reason: "La protección del término del texto original no significa que el comportamiento del personaje sea consistente con el escenario, y la semántica será verificada mediante un nuevo examen del candidato." },
    ],
  };
  return {
    content: guard.checks.some(check => check.status === "blocked") ? input.original : applied.content,
    guard,
    baseline: {
      sourceContentHash: guard.sourceContentHash,
      changes: input.plan.patches.map(patch => ({ original: patch.targetExcerpt, replacement: patch.replacement })),
      allowedCorrectionIssueIds: [...new Set(input.plan.patches.flatMap(patch => patch.issueIds))]
        .filter(id => allowed.has(id) && !style.has(id)),
    },
  };
}

export function isStyleRewriteBlocked(guard?: StyleRewriteGuard): boolean {
  return Boolean(guard?.checks.some(check => check.status === "blocked"));
}
