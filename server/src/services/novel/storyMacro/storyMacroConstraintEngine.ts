import type {
  StoryConstraintEngine,
  StoryDecomposition,
  StoryExpansion,
  StoryMacroField,
  StoryMacroFieldValue,
  StoryMacroLocks,
  StoryMacroPhase,
  StoryMacroTurningPoint,
} from "@ai-novel/shared/types/storyMacro";
import {
  normalizeConflictLayers,
  normalizeConstraints,
  normalizeDecomposition,
  normalizeExpansion,
  STORY_MACRO_FIELDS,
} from "./storyMacroPlanSchema";

export interface StoryMacroEditablePlan {
  expansion: StoryExpansion;
  decomposition: StoryDecomposition;
  constraints: string[];
}

function mergeUnique(items: string[], maxItems: number): string[] {
  return Array.from(new Set(items.map((item) => item.trim()).filter(Boolean))).slice(0, maxItems);
}

function summarizeText(value: string, fallback: string): string {
  const parts = value
    .split(/\r?\n|。|！|!|？|\?|；|;/)
    .map((item) => item.trim())
    .filter(Boolean);
  return parts[0] ?? fallback;
}

function negativeConstraintsOnly(value: string[]): string[] {
  return value.filter((item) => /^(不要|禁止|避免|不可|不能)/.test(item.trim()));
}

export function toGrowthSteps(value: string): string[] {
  const steps = value
    .split(/\r?\n|->|→|=>|，|、|；|;/)
    .map((item) => item.trim())
    .filter(Boolean);
  return Array.from(new Set(steps)).slice(0, 6);
}

function buildPressureRoles(expansion: StoryExpansion): string[] {
  return mergeUnique([
    `Posición de protagonista:${summarizeText(expansion.protagonist_core, "El protagonista se encuentra atrapado en una situación de la que no puede salir fácilmente.")}`,
    `Posición opuesta:${summarizeText(expansion.conflict_layers.external, "Las fuerzas externas continúan oprimiendo al protagonista.")}`,
    `Nivel de estrés de la relación:${summarizeText(expansion.conflict_layers.relational, "Las relaciones clave ejercen una presión constante y crean costos de elección.")}`,
  ], 4);
}

const DEFAULT_PHASE_NAMES = [
  "Dilema bloqueado",
  "Acción mal juzgada",
  "Actualización de precio",
  "giro cognitivo",
  "Redención final",
] as const;

function buildPhaseModel(plan: StoryMacroEditablePlan): StoryMacroPhase[] {
  const { expansion, decomposition } = plan;
  return [
    {
      name: DEFAULT_PHASE_NAMES[0],
      goal: `Primero atrapa al protagonista en "${summarizeText(expansion.protagonist_core, decomposition.core_conflict)}”, y arroja el núcleo desconocido:${expansion.mystery_box || decomposition.main_hook}`,
    },
    {
      name: DEFAULT_PHASE_NAMES[1],
      goal: `alrededor"${decomposition.progression_loop}"Promueve la primera acción y haz que el protagonista pague el precio del error de juicio.`,
    },
    {
      name: DEFAULT_PHASE_NAMES[2],
      goal: `Simultáneamente elevar las tres líneas de presión externa, interna y de relación para hacer realidad el motor del conflicto:${summarizeText(expansion.conflict_engine, decomposition.core_conflict)}`,
    },
    {
      name: DEFAULT_PHASE_NAMES[3],
      goal: `Acércate y reescribe el núcleo desconocido"${expansion.mystery_box || decomposition.main_hook}”, provocando que la percepción del protagonista cambie.`,
    },
    {
      name: DEFAULT_PHASE_NAMES[4],
      goal: `por"${decomposition.ending_flavor}"Completa el final y descubre los puntos explosivos clave y la resistencia emocional.`,
    },
  ];
}

function buildTurningPoints(payoffs: string[]): StoryMacroTurningPoint[] {
  return payoffs.map((item, index) => ({
    title: `Canjear nodo ${index + 1}`,
    summary: item,
    phase: DEFAULT_PHASE_NAMES[Math.min(index, DEFAULT_PHASE_NAMES.length - 1)] ?? DEFAULT_PHASE_NAMES[DEFAULT_PHASE_NAMES.length - 1],
  }));
}

function buildHardConstraints(plan: StoryMacroEditablePlan): string[] {
  const growthSteps = toGrowthSteps(plan.decomposition.growth_path).map((item) => `El avance cognitivo del protagonista debe pasar por:${item}`);
  return mergeUnique([
    ...plan.constraints,
    "Está prohibido generar nombres de personajes específicos, alineaciones fijas de personajes o biografías completas de personajes antes de la creación de personajes.",
    `Cada ronda de avance debe continuar respondiendo a la incógnita central:${plan.expansion.mystery_box || plan.decomposition.main_hook}`,
    `La escalada de la trama debe ser impulsada por el motor del conflicto:${summarizeText(plan.expansion.conflict_engine, plan.decomposition.core_conflict)}`,
    `Las escenas de alta tensión deben servir a la trama principal, en lugar de mostrar únicamente habilidades:${plan.expansion.setpiece_seeds.join(" / ")}`,
    ...growthSteps,
  ], 10);
}

export function buildConstraintEngine(plan: StoryMacroEditablePlan): StoryConstraintEngine {
  const growthSteps = toGrowthSteps(plan.decomposition.growth_path);
  const hardConstraints = buildHardConstraints(plan);
  const mustNotHave = mergeUnique([
    ...negativeConstraintsOnly(plan.constraints),
    "Reemplazar el motor de la historia con personajes concretos.",
    "Dejemos que la explicación de la cosmovisión prevalezca sobre el conflicto para avanzar",
  ], 6);
  return {
    premise: plan.expansion.expanded_premise || `${plan.decomposition.selling_point} La línea principal gira en torno a "${plan.decomposition.core_conflict}"Expandir.`,
    conflict_axis: plan.decomposition.core_conflict,
    mystery_box: plan.expansion.mystery_box || plan.decomposition.main_hook,
    pressure_roles: buildPressureRoles(plan.expansion),
    growth_path: growthSteps.length > 0 ? growthSteps : [plan.decomposition.growth_path].filter(Boolean),
    phase_model: buildPhaseModel(plan),
    hard_constraints: hardConstraints,
    turning_points: buildTurningPoints(plan.decomposition.major_payoffs),
    ending_constraints: {
      must_have: mergeUnique([
        `En respuesta a la pregunta principal:${plan.decomposition.main_hook}`,
        `Mantén el sabor del final:${plan.decomposition.ending_flavor}`,
        plan.decomposition.major_payoffs[plan.decomposition.major_payoffs.length - 1] ?? "",
      ], 4),
      must_not_have: mustNotHave,
    },
  };
}

export function getEditablePlanFieldValue(plan: StoryMacroEditablePlan, field: StoryMacroField): StoryMacroFieldValue {
  switch (field) {
    case "expanded_premise":
    case "protagonist_core":
    case "conflict_engine":
    case "mystery_box":
    case "emotional_line":
    case "tone_reference":
      return plan.expansion[field];
    case "conflict_layers":
      return plan.expansion.conflict_layers;
    case "setpiece_seeds":
      return plan.expansion.setpiece_seeds;
    case "selling_point":
    case "core_conflict":
    case "main_hook":
    case "progression_loop":
    case "growth_path":
    case "ending_flavor":
      return plan.decomposition[field];
    case "major_payoffs":
      return plan.decomposition.major_payoffs;
    case "constraints":
      return plan.constraints;
  }
}

export function setEditablePlanFieldValue(
  plan: StoryMacroEditablePlan,
  field: StoryMacroField,
  value: StoryMacroFieldValue,
): StoryMacroEditablePlan {
  const nextPlan: StoryMacroEditablePlan = {
    expansion: normalizeExpansion(plan.expansion),
    decomposition: normalizeDecomposition(plan.decomposition),
    constraints: normalizeConstraints(plan.constraints),
  };
  switch (field) {
    case "expanded_premise":
    case "protagonist_core":
    case "conflict_engine":
    case "mystery_box":
    case "emotional_line":
    case "tone_reference":
      nextPlan.expansion = normalizeExpansion({
        ...nextPlan.expansion,
        [field]: typeof value === "string" ? value : "",
      });
      return nextPlan;
    case "conflict_layers":
      nextPlan.expansion = normalizeExpansion({
        ...nextPlan.expansion,
        conflict_layers: normalizeConflictLayers(value),
      });
      return nextPlan;
    case "setpiece_seeds":
      nextPlan.expansion = normalizeExpansion({
        ...nextPlan.expansion,
        setpiece_seeds: Array.isArray(value) ? value : [],
      });
      return nextPlan;
    case "selling_point":
    case "core_conflict":
    case "main_hook":
    case "progression_loop":
    case "growth_path":
    case "ending_flavor":
      nextPlan.decomposition = normalizeDecomposition({
        ...nextPlan.decomposition,
        [field]: typeof value === "string" ? value : "",
      });
      return nextPlan;
    case "major_payoffs":
      nextPlan.decomposition = normalizeDecomposition({
        ...nextPlan.decomposition,
        major_payoffs: Array.isArray(value) ? value : [],
      });
      return nextPlan;
    case "constraints":
      nextPlan.constraints = normalizeConstraints(value);
      return nextPlan;
  }
}

export function mergeLockedFields(
  nextPlan: StoryMacroEditablePlan,
  previousPlan: StoryMacroEditablePlan | null,
  locks: StoryMacroLocks,
): StoryMacroEditablePlan {
  if (!previousPlan) {
    return nextPlan;
  }
  let merged = {
    expansion: normalizeExpansion(nextPlan.expansion),
    decomposition: normalizeDecomposition(nextPlan.decomposition),
    constraints: normalizeConstraints(nextPlan.constraints),
  };
  for (const field of STORY_MACRO_FIELDS) {
    if (!locks[field]) {
      continue;
    }
    merged = setEditablePlanFieldValue(
      merged,
      field,
      getEditablePlanFieldValue(previousPlan, field),
    );
  }
  return merged;
}
