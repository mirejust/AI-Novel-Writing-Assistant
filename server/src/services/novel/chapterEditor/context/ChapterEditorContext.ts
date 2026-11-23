import type {
  ChapterEditorAiRevisionIntent,
  ChapterEditorContextWindow,
  ChapterEditorMacroContext,
  ChapterEditorOperation,
  ChapterEditorTargetRange,
  PacePreference,
  StoryPlan,
  StoryStateSnapshot,
  VolumePlan,
} from "@ai-novel/shared/types/novel";
import { chapterParagraphs, normalizeChapterText } from "@ai-novel/shared/types/chapterEditor/document";

type WorldLike = {
  name?: string | null;
  worldType?: string | null;
  description?: string | null;
  overviewSummary?: string | null;
  conflicts?: string | null;
  magicSystem?: string | null;
  axioms?: string | null;
} | null | undefined;

type BookContractLike = {
  readingPromise?: string | null;
  protagonistFantasy?: string | null;
  coreSellingPoint?: string | null;
  escalationLadder?: string | null;
  absoluteRedLines?: string[] | null;
} | null | undefined;

export interface ChapterEditorParagraph {
  index: number;
  text: string;
  from: number;
  to: number;
}

export interface ChapterEditorVolumeLocation {
  volume: VolumePlan | null;
  chapterIndex: number;
  chapterCount: number;
  volumePositionLabel: string;
  volumePhaseLabel: string;
}

export function normalizeEditorText(text: string | null | undefined): string {
  return normalizeChapterText(text);
}

export function normalizeChapterContent(text: string | null | undefined): string {
  return normalizeChapterText(text);
}

export function countEditorWords(text: string | null | undefined): number {
  return normalizeEditorText(text).replace(/\s+/g, "").length;
}

export function splitParagraphsWithRanges(text: string | null | undefined): ChapterEditorParagraph[] {
  const normalized = normalizeChapterContent(text);
  if (!normalized) {
    return [];
  }

  return chapterParagraphs(normalized);
}

export function buildParagraphWindow(
  content: string,
  range: ChapterEditorTargetRange,
): ChapterEditorContextWindow {
  const paragraphs = splitParagraphsWithRanges(content);
  if (paragraphs.length === 0) {
    return { beforeParagraphs: [], afterParagraphs: [] };
  }

  const startIndex = paragraphs.findIndex((paragraph) => range.from >= paragraph.from && range.from <= paragraph.to);
  const endIndex = paragraphs.findIndex((paragraph) => range.to >= paragraph.from && range.to <= paragraph.to);
  const resolvedStart = startIndex >= 0 ? startIndex : 0;
  const resolvedEnd = endIndex >= 0 ? endIndex : resolvedStart;

  return {
    beforeParagraphs: paragraphs.slice(Math.max(0, resolvedStart - 3), resolvedStart).map((paragraph) => paragraph.text),
    afterParagraphs: paragraphs.slice(resolvedEnd + 1, resolvedEnd + 3).map((paragraph) => paragraph.text),
  };
}

export function createTargetRangeForWholeChapter(content: string): ChapterEditorTargetRange {
  return {
    from: 0,
    to: content.length,
    text: content,
  };
}

export function buildAnchorRangeFromParagraphBounds(
  paragraphs: ChapterEditorParagraph[],
  paragraphStart?: number | null,
  paragraphEnd?: number | null,
): Pick<ChapterEditorTargetRange, "from" | "to"> | null {
  if (!paragraphStart || !paragraphEnd || paragraphs.length === 0) {
    return null;
  }
  const start = paragraphs.find((paragraph) => paragraph.index === paragraphStart);
  const end = paragraphs.find((paragraph) => paragraph.index === paragraphEnd);
  if (!start || !end) {
    return null;
  }
  return {
    from: Math.max(0, Math.min(start.from, end.from)),
    to: Math.max(start.to, end.to),
  };
}

export function parseLooseTextList(value: string | null | undefined): string[] {
  const source = value?.trim();
  if (!source) {
    return [];
  }
  try {
    const parsed = JSON.parse(source) as unknown;
    if (Array.isArray(parsed)) {
      return parsed.filter((item): item is string => typeof item === "string" && item.trim().length > 0).map((item) => item.trim());
    }
  } catch {
    // Fall back to plain-text split below.
  }
  return source
    .split(/[\n,，;；]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function buildStyleSummary(novel: {
  styleTone?: string | null;
  narrativePov?: string | null;
  pacePreference?: string | null;
  emotionIntensity?: string | null;
}): string {
  return [
    novel.styleTone?.trim(),
    novel.narrativePov ? `Perspectiva: ${novel.narrativePov}` : null,
    novel.pacePreference ? `Ritmo: ${novel.pacePreference}` : null,
    novel.emotionIntensity ? `Intensidad emocional: ${novel.emotionIntensity}` : null,
  ].filter((item): item is string => Boolean(item && item.trim())).join(" · ");
}

export function buildWorldConstraintSummary(world: WorldLike): string {
  if (!world) {
    return "Actualmente no existen restricciones mundiales adicionales.";
  }
  const lines = [
    world.name?.trim() ? `${world.name}${world.worldType?.trim() ? ` (${world.worldType.trim()})` : ""}` : null,
    world.overviewSummary?.trim() || world.description?.trim() || null,
    world.conflicts?.trim() ? `Principales conflictos:${world.conflicts.trim()}` : null,
    world.magicSystem?.trim() ? `Poderes/Reglas:${world.magicSystem.trim()}` : null,
  ].filter((item): item is string => Boolean(item));
  const axioms = parseLooseTextList(world.axioms).slice(0, 3);
  if (axioms.length > 0) {
    lines.push(`Reglas duras:${axioms.join(";")}`);
  }
  return lines.join("\n") || "Actualmente no existen restricciones mundiales adicionales.";
}

export function buildCharacterStateSummary(snapshot?: StoryStateSnapshot | null): string {
  if (!snapshot || snapshot.characterStates.length === 0) {
    return "Actualmente no se ha extraído ningún estado de personaje.";
  }
  return snapshot.characterStates
    .slice(0, 5)
    .map((state) => {
      const parts = [
        state.summary?.trim(),
        state.currentGoal?.trim(),
        state.emotion?.trim(),
      ].filter(Boolean);
      return parts.length > 0 ? `- ${parts.join(" / ")}` : null;
    })
    .filter((item): item is string => Boolean(item))
    .join("\n") || "Actualmente no se ha extraído ningún estado de personaje.";
}

export function buildMustKeepConstraints(
  bookContract?: BookContractLike,
  chapterPlan?: StoryPlan | null,
): string[] {
  const mustPreserve = parseLooseTextList(chapterPlan?.mustPreserveJson);
  const redLines = (bookContract?.absoluteRedLines ?? []).filter((item): item is string => typeof item === "string" && item.trim().length > 0);
  return Array.from(new Set([
    ...mustPreserve,
    ...redLines,
    "Mantenga los hechos narrativos actuales consistentes",
    "Mantener la perspectiva narrativa actual y la persona.",
  ])).slice(0, 6);
}

export function findVolumeLocation(volumes: VolumePlan[], chapterOrder: number): ChapterEditorVolumeLocation {
  const volume = volumes.find((candidate) => candidate.chapters.some((chapter) => chapter.chapterOrder === chapterOrder)) ?? null;
  if (!volume) {
    return {
      volume: null,
      chapterIndex: -1,
      chapterCount: 0,
      volumePositionLabel: "Ubicación dentro del volumen no reconocida",
      volumePhaseLabel: "Revisión independiente",
    };
  }

  const sortedChapters = volume.chapters.slice().sort((left, right) => left.chapterOrder - right.chapterOrder);
  const chapterIndex = sortedChapters.findIndex((chapter) => chapter.chapterOrder === chapterOrder);
  const chapterCount = sortedChapters.length;
  const ordinal = chapterIndex + 1;

  return {
    volume,
    chapterIndex,
    chapterCount,
    volumePositionLabel: `Este volumen No. ${ordinal} / ${chapterCount}`,
    volumePhaseLabel: resolveVolumePhaseLabel(chapterIndex, chapterCount),
  };
}

function resolveVolumePhaseLabel(chapterIndex: number, chapterCount: number): string {
  if (chapterCount <= 0 || chapterIndex < 0) {
    return "Revisión independiente";
  }
  if (chapterCount === 1 || chapterIndex === 0) {
    return "libro abierto";
  }

  const ratio = chapterCount === 1 ? 1 : chapterIndex / (chapterCount - 1);
  if (ratio < 0.28) {
    return "avance";
  }
  if (ratio < 0.6) {
    return "Presión en el medio";
  }
  if (ratio < 0.82) {
    return "antes del orgasmo";
  }
  if (chapterIndex >= chapterCount - 1) {
    return "Transición";
  }
  return "Orgasmo cobrado";
}

export function buildPaceDirective(
  volumePhaseLabel: string,
  preference?: PacePreference | null,
): string {
  const paceLabel = preference === "slow"
    ? "El ritmo general es lento."
    : preference === "fast"
      ? "El ritmo general es rápido."
      : "El ritmo general se mantiene equilibrado.";
  const phaseDirective = ({
    开卷: "Prioriza establecer rápidamente la situación, las contradicciones y los puntos de lectura, y no es aconsejable desperdiciar espacio en explicaciones estáticas demasiado pronto.",
    前段推进: "Continúe avanzando en temas y objetivos y evite repetir información establecida.",
    中段承压: "La presión y el precio deben aumentarse, para que la situación empuje continuamente a los personajes.",
    高潮前: "Es necesario concentrar el poder de fuego para suprimir pistas, generar expectativas y prepararse para un brote.",
    高潮兑现: "Permitir que se materialicen conflictos, emociones y consecuencias más fuertes, pero sin desviarse de la misión principal.",
    收束过渡: "El punto es cumplir con las consecuencias, completar la transición y transportar de manera segura al lector al siguiente capítulo o volumen.",
  } as Record<string, string>)[volumePhaseLabel] ?? "Priorizar el mantenimiento de las tareas actuales del capítulo y los compromisos de volumen.";
  return `${paceLabel};${phaseDirective}`;
}

export function buildMacroContextSummary(context: ChapterEditorMacroContext): string {
  return [
    `El papel de los capítulos en este volumen:${context.chapterRoleInVolume}`,
    `Título del volumen:${context.volumeTitle}`,
    `Ubicación dentro del volumen:${context.volumePositionLabel}`,
    `Posicionamiento del escenario:${context.volumePhaseLabel}`,
    `Sugerencias de ritmo:${context.paceDirective}`,
    `Tareas en este capítulo:${context.chapterMission}`,
    `Continuando con el capítulo anterior:${context.previousChapterBridge}`,
    `Ir al siguiente capítulo:${context.nextChapterBridge}`,
    `Trama principal/presagio:${context.activePlotThreads.join(";") || "Sin datos"}`,
    `Estado del personaje:${context.characterStateSummary}`,
    `Restricciones mundiales:${context.worldConstraintSummary}`,
    `Debe conservar:${context.mustKeepConstraints.join(";") || "Mantener datos y pronombres actualizados."}`,
  ].join("\n");
}

export function buildPresetIntent(
  operation: ChapterEditorOperation,
  mustKeepConstraints: string[],
  customInstruction?: string,
): ChapterEditorAiRevisionIntent {
  const preserved = Array.from(new Set([
    ...mustKeepConstraints,
    "Mantenga los datos actuales de la trama",
    "Mantenga la información central del párrafo original.",
  ])).slice(0, 6);
  const shared = {
    mustPreserve: preserved,
    mustAvoid: ["No reescribas las cavidades de IA con plantilla", "No rompas la herencia del contexto"],
    strength: "medium" as const,
  };

  switch (operation) {
    case "expand":
      return {
        editGoal: "Complete los detalles para que la información sea más perceptible",
        toneShift: "Mantén el tono original.",
        paceAdjustment: "Disminuya ligeramente la velocidad para obtener imágenes y movimientos más claros.",
        conflictAdjustment: "Mantener la intensidad del conflicto existente",
        emotionAdjustment: "Mantener el tono emocional actual.",
        reasoningSummary: "El objetivo de esta reescritura es agregar detalles y experiencia, pero no cambia la misión original.",
        ...shared,
      };
    case "compress":
      return {
        editGoal: "Comprimir la redundancia y hacer que el progreso sea más estricto",
        toneShift: "Mantén el tono original.",
        paceAdjustment: "Significativamente más rápido, reduciendo la duplicación y las descripciones estáticas.",
        conflictAdjustment: "Mantener la tendencia conflictiva actual.",
        emotionAdjustment: "Conservar las señales de sentimiento existentes sin aumentar el nivel adicionalmente",
        reasoningSummary: "El objetivo de esta reescritura es eliminar el contenido que ralentiza el progreso y permite a los lectores pasar al siguiente paso más rápido.",
        ...shared,
      };
    case "emotion":
      return {
        editGoal: "Fortalecer la transmisión emocional",
        toneShift: "Tiene más tensión emocional sin desviarse del estilo del texto original.",
        paceAdjustment: "El ritmo se mantiene constante sin un alargamiento adicional de la cadena de acción.",
        conflictAdjustment: "Permitir que la tensión emocional se haga más evidente.",
        emotionAdjustment: "Mejora significativamente las emociones y sentimientos del personaje.",
        reasoningSummary: "El objetivo de esta reescritura es permitir a los lectores sentir las emociones de los personajes de forma más directa, en lugar de limitarse a ver los acontecimientos.",
        ...shared,
      };
    case "conflict":
      return {
        editGoal: "Reforzar el conflicto y la opresión.",
        toneShift: "Mantiene el tono original, pero más confrontativo.",
        paceAdjustment: "Aumente la velocidad adecuadamente para que los conflictos puedan surgir más rápidamente",
        conflictAdjustment: "Mejora significativamente los sentimientos de conflicto y malestar.",
        emotionAdjustment: "Dejar que las emociones sigan más de cerca el conflicto",
        reasoningSummary: "El objetivo de esta reescritura es llevar el conflicto al frente para que los lectores puedan percibir la tensión antes.",
        ...shared,
      };
    case "custom":
      return {
        editGoal: customInstruction?.trim() || "Modificado según los requisitos del usuario.",
        toneShift: "Ajustar según los requisitos del usuario.",
        paceAdjustment: "Ajustar según los requisitos del usuario.",
        conflictAdjustment: "Ajustar según los requisitos del usuario.",
        emotionAdjustment: "Ajustar según los requisitos del usuario.",
        reasoningSummary: "Esta reescritura implementa directamente los requisitos de corrección suplementarios del usuario manteniendo al mismo tiempo los hechos y la continuidad del capítulo.",
        ...shared,
      };
    case "polish":
    default:
      return {
        editGoal: "Optimice la expresión y haga que el texto sea más natural y fluido.",
        toneShift: "Mantén el tono original.",
        paceAdjustment: "Mantenga el ritmo lo más estable posible",
        conflictAdjustment: "Mantener la tendencia conflictiva actual.",
        emotionAdjustment: "Mantenga la emoción original, pero exprésela con mayor precisión.",
        reasoningSummary: "El objetivo de esta reescritura es hacer que las oraciones sean más fluidas y estables sin cambiar las responsabilidades de la trama del párrafo original.",
        ...shared,
      };
  }
}
