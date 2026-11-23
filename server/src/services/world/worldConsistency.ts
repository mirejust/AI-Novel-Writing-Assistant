const CONSISTENCY_FIELD_LABELS: Record<string, string> = {
  description: "visión general del mundo",
  background: "configuración de fondo",
  geography: "entorno geográfico",
  cultures: "costumbres culturales",
  magicSystem: "sistema de energía",
  politics: "estructura política",
  races: "Configuraciones de carrera",
  religions: "creencias religiosas",
  technology: "Sistema técnico",
  conflicts: "Conflicto central",
  history: "Contexto histórico",
  economy: "sistema económico",
  factions: "relaciones de poder",
};

export interface ConsistencyIssueDraft {
  severity: "pass" | "warn" | "error";
  code: string;
  message: string;
  detail?: string;
  source: "rule" | "llm";
  targetField?: string;
}

const ISSUE_LOCALIZATION: Record<
  string,
  {
    title: string;
    message: string;
    detail?: string | ((targetField?: string) => string);
  }
> = {
  AXIOM_MAGIC_CONFLICT: {
    title: "Conflicto entre axioma y sistema de potencia",
    message: "Los axiomas del mundo entran en conflicto con la configuración del sistema de poder.",
    detail: "Las habilidades sobrenaturales/mágicas actualmente están limitadas o negadas en los axiomas, pero aparece contenido equivalente en sistemas de poder o textos relacionados. Es necesario unificar las reglas subyacentes del mundo.",
  },
  TECH_ERA_MISMATCH: {
    title: "Tiempos tecnológicos mixtos",
    message: "La sensación de la era tecnológica es mixta y carece de explicación suficiente.",
    detail: "La descripción técnica actual presenta simultáneamente elementos de diferentes niveles de época, pero no explica las fuentes, las limitaciones o la lógica de transición.",
  },
  CONFLICT_WEAK: {
    title: "El conflicto central es débil",
    message: "La información central sobre el conflicto es demasiado escasa y carece de apoyo.",
    detail: "Se recomienda agregar partes en conflicto, eventos desencadenantes, vías de escalada y costos de fracaso para aclarar el principal conflicto en el mundo.",
  },
  BASELINE_PASS: {
    title: "Verificación de reglas aprobada",
    message: "No se encontraron conflictos difíciles obvios a nivel de reglas.",
  },
  THEMATIC_INCOHERENCE: {
    title: "El marco temático es inconsistente",
    message: "La búsqueda de contenido complementario introduce marcos temáticos que son inconsistentes con la configuración principal.",
    detail: "El contexto auxiliar actual añade expresiones temáticas que no están claramente establecidas en los escenarios originales, lo que fácilmente puede hacer que el eje principal de la visión del mundo se desvíe.",
  },
  REDUNDANT_AXIOM_APPLICATION: {
    title: "Aplicación repetida de axiomas mundiales.",
    message: "El contenido complementario reitera los axiomas existentes sin agregar nuevas restricciones efectivas.",
    detail: "Este tipo de repetición amplificará el ruido y reducirá el reconocimiento de las reglas mundiales. Se recomienda conservar nuevas restricciones realmente útiles o eliminar repeticiones redundantes.",
  },
  AXIOM_VIOLATION: {
    title: "conflicto de justicia mundial",
    message: "El nombre del mundo o concepto central entra en conflicto con los axiomas y antecedentes definidos.",
    detail: (targetField) =>
      `La situación actual es incompatible con los axiomas mundiales existentes.${targetField ? `, los principales campos de influencia son${localizeConsistencyField(targetField)}` : ""}. Es necesario unificar los nombres, los compromisos temáticos y las reglas subyacentes del mundo.`,
  },
  GENRE_MISMATCH: {
    title: "Conflicto de señales temáticas",
    message: "La señal del tema es inconsistente con las limitaciones de la visión del mundo actual.",
    detail: "Los nombres actuales, las palabras clave o el contexto de búsqueda transmiten otro tipo de expectativa sobre el tema, que no coincide con el estilo y las reglas enfatizadas por la visión del mundo.",
  },
};

function hasChinese(text: string): boolean {
  return /[\u4E00-\u9FFF]/.test(text);
}

function looksMostlyEnglish(text: string): boolean {
  return /[A-Za-z]/.test(text) && !hasChinese(text);
}

export function localizeConsistencyField(targetField?: string | null): string {
  if (!targetField) {
    return "No especificado";
  }
  return CONSISTENCY_FIELD_LABELS[targetField] ?? targetField;
}

export function localizeConsistencyIssue(issue: ConsistencyIssueDraft): ConsistencyIssueDraft {
  const code = issue.code?.trim() || "LLM_REVIEW";
  const localization = ISSUE_LOCALIZATION[code];
  const message = issue.message?.trim() || "";
  const detail = issue.detail?.trim();

  if (localization) {
    return {
      ...issue,
      code,
      message: hasChinese(message) ? message : localization.message,
      detail: detail && hasChinese(detail)
        ? detail
        : typeof localization.detail === "function"
          ? localization.detail(issue.targetField)
          : localization.detail,
    };
  }

  return {
    ...issue,
    code,
    message: hasChinese(message)
      ? message
      : `${localizeConsistencyField(issue.targetField)}Existen riesgos de coherencia.`,
    detail: !detail
      ? undefined
      : looksMostlyEnglish(detail)
        ? `El sistema detectó un${localizeConsistencyField(issue.targetField)}Si tiene preguntas relacionadas, revise este riesgo según la configuración actual de la visión del mundo.`
        : detail,
  };
}

export function buildConsistencySummary(status: "pass" | "warn" | "error", errorCount: number, warnCount: number): string {
  if (status === "pass") {
    return "La verificación de coherencia pasó y no se encontraron conflictos obvios.";
  }
  if (status === "error") {
    return `detectado ${errorCount} un conflicto grave,${warnCount} elemento de advertencia.`;
  }
  return `detectado ${warnCount} Un elemento de advertencia, se recomienda continuar corrigiéndolo.`;
}
