import type { WorldConsistencyIssue, WorldConsistencyReport } from "@ai-novel/shared/types/world";

const ISSUE_CODE_LABELS: Record<string, string> = {
  THEMATIC_INCOHERENCE: "El marco temático es inconsistente",
  REDUNDANT_AXIOM_APPLICATION: "Aplicación repetida de axiomas mundiales.",
  AXIOM_VIOLATION: "Conflicto de justicia mundial",
  GENRE_MISMATCH: "Conflicto de señales temáticas",
  AXIOM_MAGIC_CONFLICT: "Conflicto entre axioma y sistema de potencia",
  TECH_ERA_MISMATCH: "Tiempos tecnológicos mixtos",
  CONFLICT_WEAK: "El conflicto central es débil",
  BASELINE_PASS: "Verificación de reglas aprobada",
};

const ISSUE_MESSAGE_LABELS: Record<string, string> = {
  THEMATIC_INCOHERENCE: "La búsqueda de contenido complementario introduce marcos temáticos que son inconsistentes con la configuración principal.",
  REDUNDANT_AXIOM_APPLICATION: "El contenido complementario reitera los axiomas existentes sin agregar nuevas restricciones efectivas.",
  AXIOM_VIOLATION: "El nombre del mundo o el concepto central entra en conflicto con los axiomas y los antecedentes existentes.",
  GENRE_MISMATCH: "Las señales temáticas son inconsistentes con las restricciones manuales mundiales.",
  AXIOM_MAGIC_CONFLICT: "Los axiomas del mundo entran en conflicto con la configuración del sistema de poder.",
  TECH_ERA_MISMATCH: "La sensación de la era tecnológica es mixta y carece de explicación suficiente.",
  CONFLICT_WEAK: "La información central sobre el conflicto es demasiado escasa y carece de apoyo.",
  BASELINE_PASS: "No se encontraron conflictos difíciles obvios a nivel de reglas.",
};

const ISSUE_DETAIL_LABELS: Record<string, string> = {
  THEMATIC_INCOHERENCE: "El contexto auxiliar introduce expresiones temáticas que no están claramente establecidas en el escenario original, lo que fácilmente puede hacer que el eje principal del mundo se desvíe.",
  REDUNDANT_AXIOM_APPLICATION: "El contenido complementario repite principalmente las normas existentes. Se recomienda eliminar las repeticiones redundantes y conservar sólo las restricciones verdaderamente nuevas.",
  AXIOM_VIOLATION: "La denominación, el compromiso temático o los conceptos centrales son inconsistentes con las reglas subyacentes del mundo existente, y es necesario unificar el entorno principal.",
  GENRE_MISMATCH: "Los nombres o las palabras clave transmiten otra expectativa del tema, que no coincide con el estilo y las reglas enfatizadas en el Manual Mundial.",
  AXIOM_MAGIC_CONFLICT: "Limitas el contenido sobrenatural/mágico en los axiomas del mundo, pero el sistema de poder o el texto relacionado lo reintroduce.",
  TECH_ERA_MISMATCH: "La descripción técnica presenta simultáneamente elementos de diferentes niveles de época, pero no explica las fuentes, las limitaciones o la lógica de transición.",
  CONFLICT_WEAK: "Se recomienda agregar partes en conflicto, eventos desencadenantes, vías de escalada y costos de fracaso para aclarar el principal conflicto en el mundo.",
};

const FIELD_LABELS: Record<string, string> = {
  description: "Visión general del mundo",
  background: "Configuración de fondo",
  geography: "Entorno geográfico",
  cultures: "Costumbres culturales",
  magicSystem: "Sistema de energía",
  politics: "Estructura política",
  races: "Configuraciones de carrera",
  religions: "Creencias religiosas",
  technology: "Sistema técnico",
  conflicts: "Conflicto central",
  history: "Contexto histórico",
  economy: "Sistema económico",
  factions: "Relaciones de poder",
};

function hasChinese(text: string): boolean {
  return /[\u4E00-\u9FFF]/.test(text);
}

function localizeSummary(summary: string, status: WorldConsistencyReport["status"], issues: WorldConsistencyIssue[]): string {
  if (hasChinese(summary)) {
    return summary;
  }
  if (/Consistency check passed/i.test(summary)) {
    return "Se aprobó el examen físico del Manual Mundial y no se encontraron conflictos evidentes y difíciles.";
  }
  const errorCount = issues.filter((item) => item.severity === "error").length;
  const warnCount = issues.filter((item) => item.severity === "warn").length;
  if (status === "error") {
    return `detectado ${errorCount} un conflicto grave,${warnCount} elemento de advertencia.`;
  }
  if (status === "warn") {
    return `detectado ${warnCount} Un elemento de advertencia, se recomienda continuar corrigiéndolo.`;
  }
  return "Examen físico del manual mundial completado.";
}

export function parseConsistencyReport(raw: string | null | undefined, issues: WorldConsistencyIssue[]): WorldConsistencyReport | null {
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as Partial<WorldConsistencyReport>;
    if (!parsed || typeof parsed !== "object") {
      return null;
    }
    const status = parsed.status === "error" || parsed.status === "warn" || parsed.status === "pass"
      ? parsed.status
      : "pass";
    return {
      worldId: typeof parsed.worldId === "string" ? parsed.worldId : "",
      score: typeof parsed.score === "number" ? parsed.score : 0,
      summary: localizeSummary(typeof parsed.summary === "string" ? parsed.summary : "", status, issues),
      status,
      generatedAt: typeof parsed.generatedAt === "string" ? parsed.generatedAt : undefined,
      issues,
    };
  } catch {
    return null;
  }
}

export function localizeConsistencySeverity(severity: WorldConsistencyIssue["severity"]): string {
  switch (severity) {
    case "error":
      return "Conflicto serio";
    case "warn":
      return "Advertencia";
    case "pass":
      return "Pase";
    default:
      return severity;
  }
}

export function localizeConsistencyStatus(status: WorldConsistencyIssue["status"] | WorldConsistencyReport["status"]): string {
  switch (status) {
    case "open":
      return "Pendiente";
    case "resolved":
      return "Resuelto";
    case "ignored":
      return "Ignorado";
    case "error":
      return "Hay un conflicto serio";
    case "warn":
      return "Hay una advertencia";
    case "pass":
      return "Cheque aprobado";
    default:
      return status;
  }
}

export function localizeConsistencySource(source: WorldConsistencyIssue["source"]): string {
  return source === "llm" ? "Revisión del modelo" : "Comprobación de reglas";
}

export function localizeConsistencyField(targetField?: string | null): string {
  if (!targetField) {
    return "No especificado";
  }
  return FIELD_LABELS[targetField] ?? targetField;
}

export function localizeConsistencyIssueTitle(code: string): string {
  return ISSUE_CODE_LABELS[code] ?? code;
}

export function localizeConsistencyIssueMessage(issue: WorldConsistencyIssue): string {
  if (hasChinese(issue.message)) {
    return issue.message;
  }
  return ISSUE_MESSAGE_LABELS[issue.code]
    ?? `${localizeConsistencyField(issue.targetField)}Existen riesgos de coherencia.`;
}

export function localizeConsistencyIssueDetail(issue: WorldConsistencyIssue): string | null {
  if (issue.detail && hasChinese(issue.detail)) {
    return issue.detail;
  }
  if (ISSUE_DETAIL_LABELS[issue.code]) {
    return ISSUE_DETAIL_LABELS[issue.code];
  }
  if (issue.detail) {
    return `El sistema detectó un${localizeConsistencyField(issue.targetField)}Para preguntas relacionadas, revise este riesgo con el Manual Mundial.`;
  }
  return null;
}
