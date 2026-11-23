export function compactPlannerText(value: string | null | undefined, fallback = ""): string {
  return String(value ?? "").replace(/\s+/g, " ").trim() || fallback;
}

export function takeUniquePlannerItems(
  items: Array<string | null | undefined>,
  limit = items.length,
): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of items) {
    const normalized = compactPlannerText(item);
    if (!normalized || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    result.push(normalized);
    if (result.length >= limit) {
      break;
    }
  }
  return result;
}

export function buildPlannerStateDrivenDirective(input: {
  nextAction: string;
  pendingReviewProposalCount: number;
  openAuditIssueCount: number;
}): string {
  return [
    `recommended_next_action=${input.nextAction}`,
    `pending_state_review=${input.pendingReviewProposalCount}`,
    `open_audit_issues=${input.openAuditIssueCount}`,
  ].join("\n");
}

export function buildPlannerStateGoalText(input: {
  summary: string | null;
  targetConflicts: string[];
  targetRelationships: string[];
  targetPayoffs: string[];
  protectedSecrets: string[];
  recentTimeline: string[];
}): string {
  return [
    `Objetivos del estado del capítulo:${compactPlannerText(input.summary, "Ninguno")}`,
    `Los conflictos deben avanzarse:${takeUniquePlannerItems(input.targetConflicts, 4).join(";") || "Ninguno"}`,
    `Se deben promover las relaciones:${takeUniquePlannerItems(input.targetRelationships, 4).join(";") || "Ninguno"}`,
    `Se debe tocar el pago:${takeUniquePlannerItems(input.targetPayoffs, 4).join(";") || "Ninguno"}`,
    `Está prohibido revelar por adelantado:${takeUniquePlannerItems(input.protectedSecrets, 4).join(";") || "Ninguno"}`,
    `Eventos clave recientes:${takeUniquePlannerItems(input.recentTimeline, 3).join(";") || "Ninguno"}`,
  ].join("\n");
}
