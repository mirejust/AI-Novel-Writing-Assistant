export interface StorylineStructuredView {
  coreTheme: string;
  mainGoal: string;
  earlyPhase: string;
  middlePhase: string;
  latePhase: string;
  growthCurve: string;
  emotionTrend: string;
  coreConflicts: string;
  endingDirection: string;
  forbiddenItems: string;
}

function normalizeLines(draftText: string): string[] {
  return draftText
    .split(/\r?\n/g)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

function stripLabel(line: string): string {
  return line.replace(/^[^:：]{1,16}[:：]\s*/, "").trim();
}

function findByKeywords(lines: string[], keywords: string[]): string {
  const matched = lines.find((line) => keywords.some((keyword) => line.includes(keyword)));
  if (!matched) {
    return "";
  }
  const stripped = stripLabel(matched);
  return stripped || matched;
}

function buildFallbackPhases(lines: string[]): { early: string; middle: string; late: string } {
  if (lines.length === 0) {
    return { early: "", middle: "", late: "" };
  }
  const blockSize = Math.max(1, Math.ceil(lines.length / 3));
  return {
    early: lines.slice(0, blockSize).join(";"),
    middle: lines.slice(blockSize, blockSize * 2).join(";"),
    late: lines.slice(blockSize * 2).join(";"),
  };
}

export function parseStorylineStructuredView(draftText: string): StorylineStructuredView {
  const lines = normalizeLines(draftText);
  const fallbackPhases = buildFallbackPhases(lines);
  const coreTheme = findByKeywords(lines, ["Temas centrales", "Tema"]);
  const mainGoal = findByKeywords(lines, ["Objetivo principal", "Objetivo", "Misión central"]);
  const earlyPhase = findByKeywords(lines, ["Etapa temprana", "Comienzo", "Primera etapa"]) || fallbackPhases.early;
  const middlePhase = findByKeywords(lines, ["Mediano plazo", "Segunda etapa", "Punto de inflexión"]) || fallbackPhases.middle;
  const latePhase = findByKeywords(lines, ["Etapa posterior", "La tercera etapa", "Envolver", "Etapa final"]) || fallbackPhases.late;
  const growthCurve = findByKeywords(lines, ["Crecer", "Camino de crecimiento", "Arco de crecimiento"]);
  const emotionTrend = findByKeywords(lines, ["Emoción", "Emociones", "Linea emocional"]);
  const coreConflicts = findByKeywords(lines, ["Conflicto", "Contradicción", "Confrontación"]);
  const endingDirection = findByKeywords(lines, ["Finalizando", "Final", "Final"]);
  const forbiddenItems = findByKeywords(lines, ["Prohibido", "Evitar", "Tabú"]);

  return {
    coreTheme: coreTheme || "Sin etiquetar",
    mainGoal: mainGoal || "Sin etiquetar",
    earlyPhase: earlyPhase || "Sin etiquetar",
    middlePhase: middlePhase || "Sin etiquetar",
    latePhase: latePhase || "Sin etiquetar",
    growthCurve: growthCurve || "Sin etiquetar",
    emotionTrend: emotionTrend || "Sin etiquetar",
    coreConflicts: coreConflicts || "Sin etiquetar",
    endingDirection: endingDirection || "Sin etiquetar",
    forbiddenItems: forbiddenItems || "Sin etiquetar",
  };
}
