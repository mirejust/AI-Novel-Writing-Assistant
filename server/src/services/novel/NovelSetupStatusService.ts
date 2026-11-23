import type {
  CreativeHubNovelSetupChecklistItem,
  CreativeHubNovelSetupStage,
  CreativeHubNovelSetupStatus,
} from "@ai-novel/shared/types/creativeHub";
import { prisma } from "../../db/prisma";
import { normalizeWorldStructuredData } from "../world/worldStructure";

type NovelSetupSource = {
  id: string;
  title: string;
  description: string | null;
  projectMode:
    | "ai_led"
    | "co_pilot"
    | "draft_mode"
    | "auto_pipeline"
    | null;
  narrativePov: "first_person" | "third_person" | "mixed" | null;
  pacePreference: "slow" | "balanced" | "fast" | null;
  styleTone: string | null;
  emotionIntensity: "low" | "medium" | "high" | null;
  aiFreedom: "low" | "medium" | "high" | null;
  primaryStoryMode: { name: string } | null;
  secondaryStoryMode: { name: string } | null;
  defaultChapterLength: number | null;
  outline: string | null;
  structuredOutline: string | null;
  genre: { name: string } | null;
  world: { id: string; name: string } | null;
  novelWorld: {
    title: string | null;
    coverSummary: string | null;
    sourceType: string;
    sourceWorldId: string | null;
    structuredDataJson: string | null;
    storySliceJson: string | null;
  } | null;
  bible: {
    coreSetting: string | null;
    forbiddenRules: string | null;
    mainPromise: string | null;
    characterArcs: string | null;
    worldRules: string | null;
  } | null;
  _count: {
    characters: number;
    chapters: number;
  };
};

type NovelWorldSetupRow = NovelSetupSource["novelWorld"];

function hasText(value: string | null | undefined): boolean {
  return Boolean(value?.trim());
}

function compactText(value: string | null | undefined, maxLength = 72): string | null {
  const normalized = value?.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return null;
  }
  return normalized.length > maxLength ? `${normalized.slice(0, maxLength)}...` : normalized;
}

function joinCurrentValues(values: Array<string | null | undefined>): string | null {
  const normalized = values.map((item) => item?.trim()).filter((item): item is string => Boolean(item));
  return normalized.length > 0 ? normalized.join(" / ") : null;
}

function parseJson(value: string | null | undefined): unknown {
  if (!value?.trim()) {
    return null;
  }
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function buildNovelWorldSetupSignal(novelWorld: NovelSetupSource["novelWorld"]) {
  if (!novelWorld) {
    return {
      hasWorld: false,
      hasRules: false,
      title: null,
      summary: null,
      rulePreview: null,
    };
  }

  const structure = normalizeWorldStructuredData(parseJson(novelWorld.structuredDataJson));
  const hasProfile = [
    structure.profile.identity,
    structure.profile.summary,
    structure.profile.tone,
    novelWorld.title,
    novelWorld.coverSummary,
  ].some(hasText);
  const hasWorldContent = hasProfile
    || structure.factions.length > 0
    || structure.forces.length > 0
    || structure.locations.length > 0
    || hasText(novelWorld.storySliceJson);
  const firstRule = structure.rules.axioms[0];
  const rulePreview = compactText([
    structure.rules.summary,
    firstRule ? [firstRule.name, firstRule.summary].filter(Boolean).join(":") : null,
    structure.rules.taboo[0],
    structure.rules.sharedConsequences[0],
  ].find(hasText), 56);
  const hasRules = hasText(novelWorld.storySliceJson)
    || hasText(structure.rules.summary)
    || structure.rules.axioms.length > 0
    || structure.rules.taboo.length > 0
    || structure.rules.sharedConsequences.length > 0;

  return {
    hasWorld: hasWorldContent,
    hasRules,
    title: novelWorld.title ?? structure.profile.identity ?? null,
    summary: compactText(novelWorld.coverSummary ?? structure.profile.summary, 56),
    rulePreview,
  };
}

function projectModeLabel(value: NovelSetupSource["projectMode"]): string | null {
  switch (value) {
    case "ai_led":
      return "Dirigido por IA";
    case "co_pilot":
      return "Colaboración hombre-máquina";
    case "draft_mode":
      return "Borrador primero";
    case "auto_pipeline":
      return "Línea de montaje automática";
    default:
      return null;
  }
}

function narrativePovLabel(value: NovelSetupSource["narrativePov"]): string | null {
  switch (value) {
    case "first_person":
      return "Primera persona";
    case "third_person":
      return "Tercera persona";
    case "mixed":
      return "Voz mixta";
    default:
      return null;
  }
}

function pacePreferenceLabel(value: NovelSetupSource["pacePreference"]): string | null {
  switch (value) {
    case "slow":
      return "Ritmo lento";
    case "balanced":
      return "ritmo equilibrado";
    case "fast":
      return "Ritmo rápido";
    default:
      return null;
  }
}

function emotionIntensityLabel(value: NovelSetupSource["emotionIntensity"]): string | null {
  switch (value) {
    case "low":
      return "baja intensidad emocional";
    case "medium":
      return "intensidad emocional media";
    case "high":
      return "alta intensidad emocional";
    default:
      return null;
  }
}

function aiFreedomLabel(value: NovelSetupSource["aiFreedom"]): string | null {
  switch (value) {
    case "low":
      return "Bajos grados de libertad de la IA";
    case "medium":
      return "Grados de libertad medios de la IA";
    case "high":
      return "Alta libertad de IA";
    default:
      return null;
  }
}

function withStatus(input: {
  key: CreativeHubNovelSetupChecklistItem["key"];
  label: string;
  status: CreativeHubNovelSetupChecklistItem["status"];
  summary: string;
  currentValue?: string | null;
  requiredForProduction?: boolean;
  recommendedAction?: string;
  optionPrompt?: string;
}): CreativeHubNovelSetupChecklistItem {
  return {
    key: input.key,
    label: input.label,
    status: input.status,
    summary: input.summary,
    currentValue: input.currentValue ?? null,
    requiredForProduction: input.requiredForProduction ?? false,
    ...(input.recommendedAction ? { recommendedAction: input.recommendedAction } : {}),
    ...(input.optionPrompt ? { optionPrompt: input.optionPrompt } : {}),
  };
}

function buildChecklist(novel: NovelSetupSource): CreativeHubNovelSetupChecklistItem[] {
  const novelWorldSignal = buildNovelWorldSetupSignal(novel.novelWorld);
  const premiseLength = novel.description?.trim().length ?? 0;
  const premiseStatus = premiseLength >= 80 ? "ready" : premiseLength > 0 ? "partial" : "missing";
  const storyPromiseStatus = hasText(novel.bible?.mainPromise)
    ? "ready"
    : premiseLength >= 80
      ? "partial"
      : "missing";
  const directionSignals = [Boolean(novel.genre?.name), hasText(novel.styleTone)].filter(Boolean).length;
  const storyModeSignals = [Boolean(novel.primaryStoryMode?.name), Boolean(novel.secondaryStoryMode?.name)].filter(Boolean).length;
  const narrativeSignals = [Boolean(novel.narrativePov), Boolean(novel.pacePreference)].filter(Boolean).length;
  const productionSignals = [
    Boolean(novel.projectMode),
    Boolean(novel.emotionIntensity),
    Boolean(novel.aiFreedom),
  ].filter(Boolean).length;
  const chapterScaleStatus = typeof novel.defaultChapterLength === "number" && novel.defaultChapterLength > 0
    ? "ready"
    : novel._count.chapters > 0 || hasText(novel.structuredOutline)
      ? "partial"
      : "missing";
  const worldStatus = novelWorldSignal.hasWorld
    ? "ready"
    : novel.novelWorld || novel.world
      ? "partial"
      : hasText(novel.bible?.coreSetting)
        ? "partial"
        : "missing";
  const hasBibleWorldRuleNotes = hasText(novel.bible?.worldRules) || hasText(novel.bible?.forbiddenRules);
  const worldRulesStatus = novelWorldSignal.hasRules
    ? "ready"
    : novelWorldSignal.hasWorld || novel.novelWorld || novel.world || hasText(novel.bible?.coreSetting) || hasBibleWorldRuleNotes
        ? "partial"
        : "missing";
  const characterStatus = novel._count.characters > 0
    ? "ready"
    : hasText(novel.bible?.characterArcs)
      ? "partial"
      : "missing";
  const outlineStatus = novel.structuredOutline?.trim()
    ? "ready"
    : novel._count.chapters > 0 || hasText(novel.outline)
      ? "partial"
      : "missing";

  return [
    withStatus({
      key: "premise",
      label: "configuración principal",
      status: premiseStatus,
      summary: premiseStatus === "ready"
        ? "El protagonista, el conflicto y los objetivos de la historia están claramente definidos."
        : premiseStatus === "partial"
          ? "Hay una sinopsis, pero el conflicto y la promesa de la historia aún no son lo suficientemente sólidos."
          : "Todavía carece de una configuración clara de una sola frase. Primero es necesario establecer claramente el protagonista, el conflicto y el objetivo.",
      currentValue: compactText(novel.description),
      requiredForProduction: true,
      recommendedAction: "Primero complete la configuración central de la novela actual, aclare el protagonista, el conflicto central, los objetivos y el compromiso del tema, y ​​organícelo en una versión que pueda escribirse directamente en la introducción.",
      optionPrompt: "Según el título actual y la información existente, se proporcionan 3 opciones de configuración principales para esta novela. Cada conjunto debe incluir un protagonista, un conflicto central, objetivos y valores temáticos.",
    }),
    withStatus({
      key: "story_promise",
      label: "promesa de la historia",
      status: storyPromiseStatus,
      summary: storyPromiseStatus === "ready"
        ? "Se han definido claramente los principales puntos de venta, los puntos emocionales y las expectativas de los lectores."
        : storyPromiseStatus === "partial"
          ? "Existe un entorno básico, pero la línea principal, el compromiso y las expectativas de lectura, no son lo suficientemente claras."
          : "Todavía carece de la promesa central de la historia y de las expectativas de lectura de este libro.",
      currentValue: compactText(novel.bible?.mainPromise ?? novel.description),
      requiredForProduction: true,
      recommendedAction: "Combine la configuración actual para completar la promesa de la historia de este libro: principal punto de venta, dirección emocional, expectativas finales y por qué los lectores querrán seguirlo.",
      optionPrompt: "Según el escenario actual, proporcione 3 conjuntos alternativos de compromisos narrativos para esta novela. Cada conjunto debe explicar el punto de venta, la dirección emocional y las expectativas del lector.",
    }),
    withStatus({
      key: "direction",
      label: "Tema y estilo",
      status: directionSignals >= 2 ? "ready" : directionSignals === 1 ? "partial" : "missing",
      summary: directionSignals >= 2
        ? "Se han determinado el tipo de tema, el estilo y el temperamento."
        : directionSignals === 1
          ? "Alguna información de dirección ya está disponible. Se recomienda completar el tono del tema o estilo."
          : "El tema y el estilo aún no se han determinado.",
      currentValue: joinCurrentValues([novel.genre?.name ?? null, compactText(novel.styleTone, 36)]),
      requiredForProduction: true,
      recommendedAction: "Aclare la etiqueta del tema y el estilo de la novela actual, indique si es más apasionante, de suspenso, curativa, oscura o relajante, y proporcione una descripción del estilo.",
      optionPrompt: "Combinado con el entorno actual, proporcione 3 conjuntos de opciones de combinación de temas y estilos para esta novela y explique los sentimientos de los lectores que sean adecuados para cada uno.",
    }),
    withStatus({
      key: "story_mode",
      label: "Modo de género",
      status: storyModeSignals >= 2 ? "ready" : storyModeSignals === 1 ? "partial" : "missing",
      summary: storyModeSignals >= 2
        ? "Se han aclarado los modos principales y de subgénero y la planificación posterior tiene ejes de control estables."
        : storyModeSignals === 1
          ? "Se han configurado algunos modos de género, pero se recomienda completar al menos el modo principal para estabilizar la planificación posterior."
          : "Aún no se ha definido en qué se basará el libro para avanzar, en qué se basará para lograr resultados y los límites del conflicto.",
      currentValue: joinCurrentValues([novel.primaryStoryMode?.name ?? null, novel.secondaryStoryMode?.name ?? null]),
      requiredForProduction: true,
      recommendedAction: "Primero determine el modelo de género principal de la novela actual y agregue un modelo de subgénero si es necesario. De esta manera, el sistema puede limitar de manera estable la planificación de la historia, el diseño de personajes y la generación de capítulos posteriores.",
      optionPrompt: "Con base en el tema actual, los puntos de venta y la promesa de los primeros 30 capítulos, se proporcionan tres conjuntos de sugerencias de combinación de modelos principales y de subgénero para esta novela, y se explican sus respectivas lógicas de avance, recompensas para el lector y límites de conflicto.",
    }),
    withStatus({
      key: "narrative",
      label: "configuración narrativa",
      status: narrativeSignals >= 2 ? "ready" : narrativeSignals > 0 ? "partial" : "missing",
      summary: narrativeSignals >= 2
        ? "Se establecen la perspectiva narrativa y las preferencias de ritmo."
        : narrativeSignals > 0
          ? "Ya existe cierta configuración narrativa, y se recomienda completar la perspectiva y el ritmo."
          : "La perspectiva narrativa y el ritmo de progresión aún no se han determinado.",
      currentValue: joinCurrentValues([
        narrativePovLabel(novel.narrativePov),
        pacePreferenceLabel(novel.pacePreference),
      ]),
      requiredForProduction: true,
      recommendedAction: "Determine para qué perspectiva narrativa y ritmo de progresión sería más adecuado este libro y explique brevemente por qué.",
      optionPrompt: "Según el tema y el entorno actuales, se proporcionan 3 opciones de configuración narrativa para esta novela. Cada conjunto incluye perspectiva y ritmo, y se explican los pros y los contras.",
    }),
    withStatus({
      key: "production_preferences",
      label: "preferencia de producción",
      status: productionSignals >= 3 ? "ready" : productionSignals > 0 ? "partial" : "missing",
      summary: productionSignals >= 3
        ? "Se definen los métodos de colaboración creativa, la intensidad emocional y la libertad de la IA."
        : productionSignals > 0
          ? "Ya existen algunas preferencias de producción, pero no son lo suficientemente estables."
          : "Aún no se han determinado los modos de colaboración, la intensidad emocional y la libertad de la IA.",
      currentValue: joinCurrentValues([
        projectModeLabel(novel.projectMode),
        emotionIntensityLabel(novel.emotionIntensity),
        aiFreedomLabel(novel.aiFreedom),
      ]),
      requiredForProduction: true,
      recommendedAction: "Complete las preferencias de producción de la novela actual, incluido el modo de colaboración, la intensidad emocional y la libertad de la IA, indicando qué partes deben ser conservadoras y cuáles pueden publicarse de forma creativa.",
      optionPrompt: "Proporcione 3 conjuntos alternativos de preferencias de producción para esta novela según el tema y los objetivos actuales. Cada conjunto debe incluir modos colaborativos, intensidad emocional y libertad de IA.",
    }),
    withStatus({
      key: "chapter_scale",
      label: "Especificaciones del capítulo",
      status: chapterScaleStatus,
      summary: chapterScaleStatus === "ready"
        ? "Se han aclarado la longitud y la granularidad predeterminadas del capítulo."
        : chapterScaleStatus === "partial"
          ? "Hay capítulos planeados, pero aún no se ha confirmado la duración predeterminada del capítulo."
          : "Aún no se ha confirmado el recuento aproximado de palabras ni la granularidad de los capítulos de un solo capítulo.",
      currentValue: typeof novel.defaultChapterLength === "number" && novel.defaultChapterLength > 0
        ? `Longitud del capítulo predeterminada ${novel.defaultChapterLength} palabras`
        : novel._count.chapters > 0
          ? `Ya ${novel._count.chapters} Tabla de contenido`
          : null,
      requiredForProduction: true,
      recommendedAction: "Combine el tema y el ritmo para confirmar el rango de longitud de capítulo predeterminado de este libro y si un solo capítulo está más impulsado por eventos, emocional o revelador de información.",
      optionPrompt: "Según el tema y el ritmo actuales, se proporcionan 3 conjuntos de especificaciones de capítulos para esta novela. Cada conjunto incluye longitudes de capítulos sugeridas y progresión de capítulos individuales.",
    }),
    withStatus({
      key: "world",
      label: "base de la cosmovisión",
      status: worldStatus,
      summary: worldStatus === "ready"
        ? `mundo del libro${novelWorldSignal.title ? `«${novelWorldSignal.title}»` : ""}Ha sido compilado en este manual mundial.`
        : worldStatus === "partial"
          ? "Hay semillas mundiales y se recomienda compilar este manual mundial."
          : "Todavía carece de semillas de cosmovisión o información básica sobre el escenario.",
      currentValue: novelWorldSignal.title
        ?? novelWorldSignal.summary
        ?? novel.world?.name
        ?? compactText(novel.bible?.coreSetting, 48),
      requiredForProduction: true,
      recommendedAction: "Primero complete la etapa de la historia, los antecedentes de la época, las reglas básicas y los entornos ambientales que afectarán el conflicto principal en el mundo de este libro.",
      optionPrompt: "Combinando los temas actuales y los escenarios centrales, se proporcionan 3 conjuntos de opciones básicas de escenario mundial para esta novela y se explican sus respectivos potenciales de conflicto.",
    }),
    withStatus({
      key: "world_rules",
      label: "Límites de reglas",
      status: worldRulesStatus,
      summary: worldRulesStatus === "ready"
        ? "Este manual mundial ya tiene reglas y límites que se pueden seguir."
        : worldRulesStatus === "partial"
          ? hasBibleWorldRuleNotes
            ? "Ya existen registros escritos de las reglas y se recomienda que se recopilen en este manual mundial."
            : "El marco mundial existe y se recomienda completar las reglas y tabúes clave."
          : "No se han resuelto reglas mundiales ni tabúes que regirían la trama.",
      currentValue: novelWorldSignal.rulePreview
        ?? compactText(novel.bible?.worldRules ?? novel.bible?.forbiddenRules, 56),
      requiredForProduction: false,
      recommendedAction: "Por favor refine las reglas mundiales, los tabúes y los límites estrictos que deben observarse en este manual mundial, especialmente las partes que afectarán directamente el avance de la trama y las acciones de los personajes.",
      optionPrompt: "Con base en el escenario actual, proporcione 3 conjuntos alternativos de reglas y tabúes del mundo del libro para esta novela, cada uno de los cuales describe cómo afectará la trama.",
    }),
    withStatus({
      key: "characters",
      label: "Conceptos básicos de roles",
      status: characterStatus,
      summary: characterStatus === "ready"
        ? `Ya ${novel._count.characters} Los personajes entran en la novela actual.`
        : characterStatus === "partial"
          ? "Se han descrito arcos de personajes, pero aún no se ha formado un elenco estable de personajes."
          : "Aún no hay un borrador del protagonista y los personajes principales.",
      currentValue: novel._count.characters > 0
        ? `${novel._count.characters} role`
        : compactText(novel.bible?.characterArcs, 48),
      requiredForProduction: true,
      recommendedAction: "Primero, clasifique a los protagonistas y personajes centrales de la novela actual, y al menos aclare el posicionamiento de los personajes, los objetivos, la resistencia y las relaciones conflictivas entre sí.",
      optionPrompt: "Según el escenario actual, se proporcionan tres alineaciones de personajes principales para esta novela, cada una de las cuales describe al protagonista, al antagonista y a las relaciones clave.",
    }),
    withStatus({
      key: "outline",
      label: "Esquema y plan del capítulo",
      status: outlineStatus,
      summary: outlineStatus === "ready"
        ? "Ya tenga un esquema estructurado o un plan de capítulo ejecutable."
        : outlineStatus === "partial"
          ? "Hay una dirección de la historia, pero no se ha dividido en un plan de capítulo estable."
          : "Aún no existe un esquema ejecutable ni un plan de progresión de capítulos.",
      currentValue: novel.structuredOutline?.trim()
        ? "Esquema estructurado generado"
        : novel.outline?.trim()
          ? "Se han generado tendencias de desarrollo."
          : novel._count.chapters > 0
            ? `Ya ${novel._count.chapters} Tabla de contenido`
            : null,
      requiredForProduction: true,
      recommendedAction: "Organice la configuración actual en un esquema ejecutable y desglose el plan de promoción del capítulo, al menos aclare el comienzo, el punto de inflexión del primer, medio y último capítulo, y el punto final.",
      optionPrompt: "Según el entorno actual, proporcione tres planes de avance alternativos para esta novela y explique el ritmo de cada capítulo.",
    }),
  ];
}

function buildStage(checklist: CreativeHubNovelSetupChecklistItem[]): CreativeHubNovelSetupStage {
  const requiredItems = checklist.filter((item) => item.requiredForProduction);
  if (requiredItems.length > 0 && requiredItems.every((item) => item.status === "ready")) {
    return "ready_for_production";
  }

  const byKey = Object.fromEntries(checklist.map((item) => [item.key, item])) as Record<
    CreativeHubNovelSetupChecklistItem["key"],
    CreativeHubNovelSetupChecklistItem
  >;

  if (
    byKey.premise.status !== "missing"
    && byKey.direction.status !== "missing"
    && byKey.story_mode.status !== "missing"
    && byKey.narrative.status !== "missing"
    && byKey.story_promise.status !== "missing"
  ) {
    return "ready_for_planning";
  }

  return "setup_in_progress";
}

function weightedCompletion(checklist: CreativeHubNovelSetupChecklistItem[]): number {
  const total = checklist.reduce((sum, item) => {
    if (item.status === "ready") return sum + 1;
    if (item.status === "partial") return sum + 0.5;
    return sum;
  }, 0);
  return Math.round((total / checklist.length) * 100);
}

function buildNextStep(checklist: CreativeHubNovelSetupChecklistItem[], stage: CreativeHubNovelSetupStage) {
  const next = checklist.find((item) => item.requiredForProduction && item.status !== "ready")
    ?? checklist.find((item) => item.status !== "ready");
  if (!next) {
    return {
      nextQuestion: "La inicialización básicamente se ha completado. ¿Quiere comprobar el esquema y completar los detalles primero o comenzar toda la producción directamente?",
      recommendedAction: "Primero resuma la información de inicialización actual de este libro y luego dame tres opciones para el siguiente paso: completar los detalles, leer el esquema y comenzar toda la producción.",
    };
  }

  switch (next.key) {
    case "premise":
      return {
        nextQuestion: "¿De quién quiere tratar este libro, qué conflictos encuentra y hacia dónde lleva la historia al final?",
        recommendedAction: "Primero, ayúdame a completar el escenario de este libro en una oración, aclarando el protagonista, el conflicto central y el compromiso de la historia.",
      };
    case "story_promise":
      return {
        nextQuestion: "¿Qué deberían esperar más los lectores de este libro y qué sentimientos deberían dejar atrás después de leerlo?",
        recommendedAction: "Primero, compense la promesa de la historia, el enfoque emocional y las expectativas de lectura de este libro.",
      };
    case "direction":
      return {
        nextQuestion: "¿Sobre qué tema y temperamento quieres escribir este libro?",
        recommendedAction: "Según el título y el entorno actuales, primero complete el tipo de tema y el estilo del libro.",
      };
    case "story_mode":
      return {
        nextQuestion: "Primero, confirme en qué se basa este libro para avanzar, en qué se basa para realizar y dónde debe ubicarse el límite superior del conflicto.",
        recommendedAction: "Primero complete el modelo de género principal y luego agregue un modelo de subgénero si es necesario, de modo que la planificación y generación posteriores no se vuelvan más sesgadas a medida que avanza la escritura.",
      };
    case "narrative":
      return {
        nextQuestion: "¿Qué perspectiva, qué ritmo y qué enfoque colaborativo serían más apropiados para este libro?",
        recommendedAction: "Ayúdame a determinar la perspectiva narrativa, las preferencias de ritmo y el modo creativo de este libro.",
      };
    case "production_preferences":
      return {
        nextQuestion: "¿Hasta qué punto este libro quiere que la IA sea más liberal, dónde debería suprimirse la intensidad emocional y dónde debería ser conservadora?",
        recommendedAction: "Determine los patrones de colaboración, la fuerza emocional y la libertad de la IA antes de pasar a la preparación de la producción.",
      };
    case "chapter_scale":
      return {
        nextQuestion: "¿Cuánto dura un capítulo de este libro? ¿Un solo capítulo es más sobre eventos o emociones?",
        recommendedAction: "Primero confirme la longitud y la granularidad del capítulo predeterminadas para evitar desviaciones excesivas en la producción posterior.",
      };
    case "world":
      return {
        nextQuestion: "¿En qué tipo de mundo se desarrolla la historia? ¿Quieres construir primero una semilla de cosmovisión?",
        recommendedAction: "Combinado con la configuración actual, primero agregue una semilla de visión del mundo para este libro y explique las reglas clave.",
      };
    case "world_rules":
      return {
        nextQuestion: "¿Existen reglas, tabúes o precios que no se deben tocar en este mundo?",
        recommendedAction: "Primero, ordene las reglas y tabúes del mundo y aclare qué límites afectarán directamente a la trama.",
      };
    case "characters":
      return {
        nextQuestion: "¿Quién es el protagonista, qué es lo que más desea y qué bloqueará?",
        recommendedAction: "Primero organice el borrador del protagonista y los personajes principales del libro, y al menos proporcione al personaje el posicionamiento y las relaciones conflictivas.",
      };
    case "outline":
      return {
        nextQuestion: stage === "ready_for_planning"
          ? "El escenario es suficiente. ¿Deberíamos primero dividirlo en esquemas y planes de capítulos?"
          : "¿Deberíamos primero organizar las configuraciones existentes en un esquema ejecutable?",
        recommendedAction: "Según la configuración actual, primero cree un esquema del libro y divida los capítulos para avanzar en el plan.",
      };
    default:
      return {
        nextQuestion: "¿Qué parte de la configuración quieres arreglar primero?",
        recommendedAction: "Primero resuma los elementos que faltan actualmente y brindeme una solución de inicialización mínima.",
      };
  }
}

export function buildStatus(novel: NovelSetupSource): CreativeHubNovelSetupStatus {
  const checklist = buildChecklist(novel);
  const stage = buildStage(checklist);
  const completedCount = checklist.filter((item) => item.status === "ready").length;
  const totalCount = checklist.length;
  const { nextQuestion, recommendedAction } = buildNextStep(checklist, stage);

  return {
    novelId: novel.id,
    title: novel.title,
    stage,
    completionRatio: weightedCompletion(checklist),
    completedCount,
    totalCount,
    missingItems: checklist.filter((item) => item.status !== "ready").map((item) => item.label),
    nextQuestion,
    recommendedAction,
    checklist,
  };
}

export class NovelSetupStatusService {
  async getNovelSetupStatus(novelId: string): Promise<CreativeHubNovelSetupStatus | null> {
    const novel = await prisma.novel.findUnique({
      where: { id: novelId },
      select: {
        id: true,
        title: true,
        description: true,
        projectMode: true,
        narrativePov: true,
        pacePreference: true,
        styleTone: true,
        emotionIntensity: true,
        aiFreedom: true,
        primaryStoryMode: {
          select: {
            name: true,
          },
        },
        secondaryStoryMode: {
          select: {
            name: true,
          },
        },
        defaultChapterLength: true,
        outline: true,
        structuredOutline: true,
        genre: {
          select: {
            name: true,
          },
        },
        world: {
          select: {
            id: true,
            name: true,
          },
        },
        bible: {
          select: {
            coreSetting: true,
            forbiddenRules: true,
            mainPromise: true,
            characterArcs: true,
            worldRules: true,
          },
        },
        _count: {
          select: {
            characters: true,
            chapters: true,
          },
        },
      },
    });

    if (!novel) {
      return null;
    }

    const [novelWorld = null] = await prisma.$queryRaw<NovelWorldSetupRow[]>`
      SELECT
        "title",
        "coverSummary",
        "sourceType",
        "sourceWorldId",
        "structuredDataJson",
        "storySliceJson"
      FROM "NovelWorld"
      WHERE "novelId" = ${novelId}
      LIMIT 1
    `;

    return buildStatus({
      ...novel,
      novelWorld,
    });
  }
}

export const novelSetupStatusService = new NovelSetupStatusService();
