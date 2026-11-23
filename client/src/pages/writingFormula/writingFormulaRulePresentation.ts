import type {
  CharacterRules,
  LanguageRules,
  NarrativeRules,
  RhythmRules,
} from "@ai-novel/shared/types/styleEngine";

export type RuleSection = "narrativeRules" | "characterRules" | "languageRules" | "rhythmRules";
type RuleObject = NarrativeRules | CharacterRules | LanguageRules | RhythmRules;

export interface RuleEntry {
  key: string;
  label: string;
  value: string;
}

const FIELD_ORDER: Record<RuleSection, string[]> = {
  narrativeRules: [
    "summary",
    "progressionMode",
    "sceneUnitPattern",
    "multiPov",
    "looping",
    "endingStyle",
    "povSwitchStyle",
  ],
  characterRules: [
    "summary",
    "dialogueStyle",
    "emotionExpression",
    "defenseMechanisms",
    "allowSelfReflection",
    "facePriority",
  ],
  languageRules: [
    "summary",
    "register",
    "roughness",
    "sentenceVariation",
    "allowIncompleteSentences",
    "allowSwearing",
    "allowUselessDetails",
  ],
  rhythmRules: [
    "summary",
    "pace",
    "paragraphDensity",
    "allowFragmentedFlow",
    "actionOverExplanation",
  ],
};

const FIELD_LABELS: Record<RuleSection, Record<string, string>> = {
  narrativeRules: {
    summary: "Sensación general de avance",
    progressionMode: "Método de propulsión",
    sceneUnitPattern: "Unidad de escena",
    multiPov: "Múltiples perspectivas",
    looping: "Gancho de bucle invertido",
    endingStyle: "Método de acabado",
    povSwitchStyle: "Interruptor de perspectiva",
  },
  characterRules: {
    summary: "Resumen de expresiones de caracteres.",
    dialogueStyle: "Estilo de diálogo",
    emotionExpression: "Exhibición emocional",
    defenseMechanisms: "Mecanismo de defensa",
    allowSelfReflection: "Expresión introspectiva",
    facePriority: "La dignidad primero",
  },
  languageRules: {
    summary: "Descripción general de la calidad del lenguaje",
    register: "Tono del lenguaje",
    roughness: "Rugosidad",
    sentenceVariation: "Cambios de oración",
    allowIncompleteSentences: "Oración incompleta",
    allowSwearing: "Lenguaje soez",
    allowUselessDetails: "Ruido de la vida",
  },
  rhythmRules: {
    summary: "Descripción general del control del ritmo",
    pace: "Velocidad de propulsión",
    paragraphDensity: "Densidad de párrafos",
    allowFragmentedFlow: "Avance fragmentado",
    actionOverExplanation: "Prioridad de acción",
  },
};

const FIELD_VALUE_MAPS: Record<string, Record<string, string>> = {
  progressionMode: {
    time_sequence: "Avanzar por el tiempo",
    goal_driven: "Avance impulsado por objetivos",
    mystery_escalation: "El suspenso aumenta capa a capa",
    relationship_push_pull: "Relación de tirar y empujar",
    multi_thread: "Promoción de entrelazado multilínea.",
    scene_immersion: "Promoción de inmersión en escena.",
    fact_driven: "Avance basado en hechos",
    contrast_driven: "Avance impulsado por el contraste",
  },
  endingStyle: {
    unresolved: "Dilema central no resuelto",
    hook: "Lanzamiento de gancho al final",
    suspense: "Final de suspenso",
    emotional_hook: "Final de gancho emocional",
    cross_hook: "Acabado de gancho rayado",
    soft_open: "Acabado abierto suave",
    pressure_continue: "Fin de la continuación de la presión.",
    bitter_aftertaste: "Terminando con un regusto amargo",
  },
  povSwitchStyle: {
    controlled: "Conmutación controlada",
  },
  emotionExpression: {
    behavior_only: "Expuesto sólo a través del movimiento.",
    dialogue_and_action: "El diálogo y la acción se exponen juntos",
    reaction_only: "Principalmente expuesto a través de reacciones.",
    subtext: "Revelado a través del subtexto",
    mixed: "Diálogo, acción y reacciones se mezclan y exponen",
    light_behavior: "Utilice acciones y reacciones de luz para exponerse.",
    suppressed: "No lo digas directamente",
    deadpan: "Reacción fría expuesta",
  },
  dialogueStyle: {
    short_colloquial: "Estilo hablado de oración corta",
    direct: "Directo y duro",
    restrained: "Conténlo y dilo.",
    subtext_heavy: "La implicación es pesada.",
    distinct_by_role: "Ampliar significativamente las diferencias en bocas por rol",
    daily_natural: "Tono natural cotidiano",
    informational: "Diálogo informativo de moderación.",
    deadpan_colloquial: "Estilo hablado frio",
  },
  register: {
    colloquial: "Coloquial",
    direct: "Directo y nítido",
    restrained: "Moderación",
    natural: "Natural todos los días",
    flexible: "Flexible para adaptarse al rol",
    professional: "Moderación profesional",
  },
  sentenceVariation: {
    high: "Grandes cambios",
    medium: "Cambio moderado",
    medium_high: "El cambio es relativamente grande.",
  },
  pace: {
    medium_fast: "Medio rápido",
    fast: "Rápido",
    medium: "Velocidad media",
    medium_slow: "Medio lento",
    balanced: "Equilibrado",
    slow: "Lento",
  },
  paragraphDensity: {
    high: "Densidad alta",
    medium: "Densidad media",
    medium_high: "Densidad media a alta",
  },
};

function compactText(value: unknown): string {
  if (typeof value !== "string") {
    return "";
  }

  return value.replace(/\s+/g, " ").trim();
}

function humanizeUnknownToken(value: string): string {
  return value.replace(/_/g, " ").trim();
}

function formatBooleanValue(key: string, value: boolean): string {
  if (key === "multiPov") {
    return value ? "Permite el cambio de múltiples vistas" : "Intenta mantener una perspectiva única.";
  }
  if (key === "looping") {
    return value ? "Permitir ganchos loopback" : "Empuje en línea recta tanto como sea posible.";
  }
  if (key === "allowSelfReflection") {
    return value ? "permitir una introspección explícita" : "Intenta hacer la menor introspección directa posible.";
  }
  if (key === "facePriority") {
    return value ? "Prioriza mantener tu dignidad" : "No insistas en la respetabilidad";
  }
  if (key === "allowIncompleteSentences") {
    return value ? "Permitir oraciones incompletas" : "Las oraciones deben ser lo más completas posible.";
  }
  if (key === "allowSwearing") {
    return value ? "Se permiten malas palabras o malas palabras." : "Intenta evitar el lenguaje soez";
  }
  if (key === "allowUselessDetails") {
    return value ? "Deja que el ruido de la vida permanezca" : "Minimizar el ruido irrelevante";
  }
  if (key === "allowFragmentedFlow") {
    return value ? "Permitir un avance fragmentado" : "Intenta mantener el progreso intacto.";
  }
  if (key === "actionOverExplanation") {
    return value ? "La acción precede a la explicación." : "La explicación es más importante que la acción.";
  }
  return value ? "Sí" : "No";
}

function formatArrayValue(value: unknown[]): string {
  return value
    .map((item) => {
      if (typeof item === "string") {
        return humanizeUnknownToken(item);
      }
      return String(item);
    })
    .filter(Boolean)
    .join(" / ");
}

export function formatRuleFieldLabel(section: RuleSection, key: string): string {
  return FIELD_LABELS[section][key] ?? humanizeUnknownToken(key);
}

export function formatRuleFieldValue(section: RuleSection, key: string, value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }

  if (typeof value === "boolean") {
    return formatBooleanValue(key, value);
  }

  if (typeof value === "number") {
    if (key === "roughness") {
      return `${Math.round(value * 100)} / 100`;
    }
    return String(value);
  }

  if (Array.isArray(value)) {
    return formatArrayValue(value);
  }

  if (typeof value === "string") {
    const normalized = compactText(value);
    if (!normalized) {
      return "";
    }
    return FIELD_VALUE_MAPS[key]?.[normalized] ?? normalized;
  }

  return "";
}

export function buildReadableRuleEntries(section: RuleSection, rules: RuleObject | Record<string, unknown>): RuleEntry[] {
  const record = rules as Record<string, unknown>;
  const keySet = new Set<string>([
    ...FIELD_ORDER[section],
    ...Object.keys(record),
  ]);

  return Array.from(keySet)
    .map((key) => ({
      key,
      label: formatRuleFieldLabel(section, key),
      value: formatRuleFieldValue(section, key, record[key]),
    }))
    .filter((entry) => Boolean(entry.value))
    .sort((left, right) => {
      const leftIndex = FIELD_ORDER[section].indexOf(left.key);
      const rightIndex = FIELD_ORDER[section].indexOf(right.key);
      const normalizedLeft = leftIndex === -1 ? Number.MAX_SAFE_INTEGER : leftIndex;
      const normalizedRight = rightIndex === -1 ? Number.MAX_SAFE_INTEGER : rightIndex;
      return normalizedLeft - normalizedRight;
    });
}

export function buildReadableRuleSummary(
  section: RuleSection,
  rules: RuleObject | Record<string, unknown>,
  fallback: string,
): string {
  const entries = buildReadableRuleEntries(section, rules);
  if (entries.length === 0) {
    return fallback;
  }

  return entries
    .slice(0, 3)
    .map((entry) => (entry.key === "summary" ? entry.value : `${entry.label}:${entry.value}`))
    .join(";");
}
