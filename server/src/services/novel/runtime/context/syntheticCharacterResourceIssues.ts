import type { GenerationContextPackage } from "@ai-novel/shared/types/chapterRuntime";

export function buildSyntheticCharacterResourceIssues(
  context: GenerationContextPackage["characterResourceContext"],
  input: {
    novelId: string;
    chapterId: string;
  },
): GenerationContextPackage["openAuditIssues"] {
  if (!context) {
    return [];
  }
  const now = new Date().toISOString();
  const blockedIssues = context.blockedItems.slice(0, 4).map((item) => ({
    id: `character-resource:${item.id}:blocked`,
    reportId: `character-resource:${input.novelId}:${input.chapterId}`,
    auditType: "continuity" as const,
    severity: item.status === "destroyed" || item.status === "lost" ? "high" as const : "medium" as const,
    code: "character_resource_unavailable",
    description: `${item.name} Actualmente ${item.status}, este capítulo no se puede utilizar directamente como un recurso utilizable.`,
    evidence: item.evidence[0]?.summary ?? item.summary,
    fixSuggestion: `Priorizar las reparaciones locales: compensar la readquisición, el reemplazo de recursos o las restricciones de acciones inutilizables para evitar una reutilización innecesaria ${item.name}.`,
    status: "open" as const,
    createdAt: now,
    updatedAt: now,
  }));
  const highRiskIssues = context.highRiskCommittedItems.slice(0, 3).map((item) => ({
    id: `character-resource:${item.id}:high-risk-committed`,
    reportId: `character-resource:${input.novelId}:${input.chapterId}`,
    auditType: "continuity" as const,
    severity: "medium" as const,
    code: "character_resource_high_risk_committed",
    description: `${item.name} Este capítulo, que ya está contabilizado pero con una señal de alto riesgo, se utiliza sin anular su estado de tenencia, visibilidad o agotamiento.`,
    evidence: item.evidence[0]?.summary ?? item.summary,
    fixSuggestion: `Voluntad ${item.name} Utilice pequeñas correcciones que sean reciclables y evite incluir recursos de alto riesgo en nuevos hechos irreversibles.`,
    status: "open" as const,
    createdAt: now,
    updatedAt: now,
  }));
  const pendingProposalIssues = context.pendingProposalItems.slice(0, 3).map((proposal) => ({
    id: `character-resource-proposal:${proposal.id}:pending-review`,
    reportId: `character-resource:${input.novelId}:${input.chapterId}`,
    auditType: "continuity" as const,
    severity: proposal.riskLevel === "high" ? "high" as const : "medium" as const,
    code: "character_resource_pending_proposal",
    description: `${proposal.summary} Todavía está pendiente de confirmación. No escriba este cambio de recurso como un hecho antes de la confirmación.`,
    evidence: proposal.evidence[0] ?? proposal.summary,
    fixSuggestion: "Regrese primero a la página del capítulo para confirmar o ignorar este cambio de recurso; la generación de texto solo debe basarse en los recursos que se han contabilizado.",
    status: "open" as const,
    createdAt: now,
    updatedAt: now,
  }));
  const signalIssues = context.riskSignals
    .filter((signal) => signal.severity === "high" || signal.severity === "critical")
    .slice(0, 3)
    .map((signal, index) => ({
      id: `character-resource:signal:${index}:${signal.code}`,
      reportId: `character-resource:${input.novelId}:${input.chapterId}`,
      auditType: "continuity" as const,
      severity: signal.severity,
      code: signal.code || "character_resource_risk",
      description: signal.summary,
      evidence: signal.summary,
      fixSuggestion: "Priorice patch_first: parchee solo la propiedad, el consumo o la relación de conocimiento de los recursos del capítulo actual, sin reescribir toda la trama.",
      status: "open" as const,
      createdAt: now,
      updatedAt: now,
    }));
  return [...blockedIssues, ...highRiskIssues, ...pendingProposalIssues, ...signalIssues];
}
