export type ChapterTitleSurfaceFrame =
  | "of_phrase"
  | "colon_split"
  | "comma_split"
  | "question_hook"
  | "plain_statement";

const ENABLE_CHAPTER_TITLE_DIVERSITY_VALIDATION = true;
const CHAPTER_TITLE_OF_PHRASE_PATTERN = /^[^，,：:？?的\s]{1,18}的[^，,：:？?的\s]{1,18}$/u;
const CHAPTER_TITLE_MAX_CORE_CHARS = 16;
const CHAPTER_TITLE_SOFT_SENTENCE_CHARS = 12;
const CHAPTER_TITLE_FIRST_PERSON_PATTERN =
  /(^|[，,：:？?！!、\s])我|我的|我们|替我|为我|给我|把我|追杀我|杀我|救我|我[亲也却已又将把用拿看暗]/u;

function normalizeChapterTitle(title: string): string {
  return title
    .replace(/^["'“”‘’《》〈〉「」『』【】]+|["'“”‘’《》〈〉「」『』【】]+$/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/,/g, ",")
    .replace(/:/g, ":")
    .replace(/\?/g, "?");
}

export function getChapterTitleCollisionIssue(
  reservedTitles: string[],
  candidateTitles: string[],
): string | null {
  const reserved = new Set(reservedTitles.map(normalizeChapterTitle).filter(Boolean));
  for (const title of candidateTitles) {
    const normalized = normalizeChapterTitle(title);
    if (normalized && reserved.has(normalized)) {
      return `Los títulos de los capítulos están duplicados:${normalized}. Asegúrese de que el título de cada capítulo sea único.`;
    }
  }
  return null;
}

export function isChapterTitleDuplicateIssue(message: string | null | undefined): boolean {
  return message?.includes("Los títulos de los capítulos están duplicados.") ?? false;
}

function countChapterTitleCoreChars(title: string): number {
  return Array.from(normalizeChapterTitle(title))
    .filter((char) => !/[，,：:？?！!、；;·\s"'“”‘’《》〈〉「」『』【】]/u.test(char))
    .length;
}

function getChapterTitleBasicQualityIssue(title: string): string | null {
  const normalized = normalizeChapterTitle(title);
  if (!normalized) {
    return "El título del capítulo no puede estar vacío.";
  }

  if (CHAPTER_TITLE_FIRST_PERSON_PATTERN.test(normalized)) {
    return `Los títulos de los capítulos no deben utilizar descripciones del protagonista en primera persona o en forma de eslogan:${normalized}. Cámbielo por el nombre de un capítulo objetivo, como evento, lugar, conflicto, cambio o resultado.`;
  }

  const coreCharCount = countChapterTitleCoreChars(normalized);
  if (coreCharCount > CHAPTER_TITLE_MAX_CORE_CHARS) {
    return `El título del capítulo es demasiado largo:${normalized}. Por favor comprimir a ${CHAPTER_TITLE_MAX_CORE_CHARS} Dentro de tres palabras centrales, evite escribir un resumen de la trama.`;
  }

  if (
    coreCharCount > CHAPTER_TITLE_SOFT_SENTENCE_CHARS
    && /[，,]/u.test(normalized)
    && /但|却|可|于是|因此|同时|然后/u.test(normalized)
  ) {
    return `Los títulos de los capítulos son como sinopsis de la trama:${normalized}. Cambie el título del capítulo por uno más corto y no incluya la oración completa de causa y efecto en el título.`;
  }

  return null;
}

export function detectChapterTitleSurfaceFrame(title: string): ChapterTitleSurfaceFrame {
  const normalized = normalizeChapterTitle(title);
  if (!normalized) {
    return "plain_statement";
  }
  if (normalized.includes(":")) {
    return "colon_split";
  }
  if (normalized.includes(",")) {
    return "comma_split";
  }
  if (normalized.includes("?")) {
    return "question_hook";
  }
  if (CHAPTER_TITLE_OF_PHRASE_PATTERN.test(normalized)) {
    return "of_phrase";
  }
  return "plain_statement";
}

function maximumOfPhraseCount(titleCount: number): number {
  return Math.max(1, Math.ceil(Math.max(titleCount, 1) * 0.3));
}

function maximumSingleFrameCount(titleCount: number): number {
  return Math.max(2, Math.ceil(Math.max(titleCount, 1) * 0.5));
}

function formatFrameLabel(frame: ChapterTitleSurfaceFrame): string {
  if (frame === "of_phrase") {
    return "\"Y de X/Y de X\"";
  }
  if (frame === "comma_split") {
    return "\"A, B / acción de cuatro caracteres, resultado de cuatro caracteres\"";
  }
  if (frame === "colon_split") {
    return "\"A:B\"";
  }
  if (frame === "question_hook") {
    return "\"Tipo gancho de pregunta\"";
  }
  return "\"Tipo directo plano\"";
}

export type ChapterTitleDiversitySeverity = "blocking" | "severe" | "marginal";

export interface ChapterTitleDiversityAssessment {
  issue: string;
  severity: ChapterTitleDiversitySeverity;
  /**
   * Raw titles (as passed in) that carry the flagged surface frame.
   * Callers use them to point at the first affected chapter.
   */
  offendingTitles: string[];
}

export function assessChapterTitleDiversity(titles: string[]): ChapterTitleDiversityAssessment | null {
  if (!ENABLE_CHAPTER_TITLE_DIVERSITY_VALIDATION) {
    return null;
  }
  const entries = titles
    .map((raw) => ({ raw, normalized: normalizeChapterTitle(raw) }))
    .filter((entry) => entry.normalized.length > 0);
  const normalizedTitles = entries.map((entry) => entry.normalized);
  for (const entry of entries) {
    const basicQualityIssue = getChapterTitleBasicQualityIssue(entry.normalized);
    if (basicQualityIssue) {
      return { issue: basicQualityIssue, severity: "blocking", offendingTitles: [entry.raw] };
    }
  }

  if (normalizedTitles.length <= 1) {
    return null;
  }

  const seenTitles = new Set<string>();
  const ofPhraseExamples: string[] = [];
  const frameCounts = new Map<ChapterTitleSurfaceFrame, number>();
  const frameExamples = new Map<ChapterTitleSurfaceFrame, string[]>();
  const frameTitles = new Map<ChapterTitleSurfaceFrame, string[]>();
  let previousFrame: ChapterTitleSurfaceFrame | null = null;
  let currentFrameClusterCount = 0;
  let maxFrameClusterCount = 0;
  let dominantClusterFrame: ChapterTitleSurfaceFrame | null = null;

  for (const entry of entries) {
    const title = entry.normalized;
    if (seenTitles.has(title)) {
      return {
        issue: `Los títulos de los capítulos están duplicados:${title}. Asegúrese de que el título de cada capítulo sea único.`,
        severity: "blocking",
        offendingTitles: [entry.raw],
      };
    }
    seenTitles.add(title);

    const frame = detectChapterTitleSurfaceFrame(title);
    frameCounts.set(frame, (frameCounts.get(frame) ?? 0) + 1);
    const titlesForFrame = frameTitles.get(frame) ?? [];
    titlesForFrame.push(entry.raw);
    frameTitles.set(frame, titlesForFrame);
    const examples = frameExamples.get(frame) ?? [];
    if (examples.length < 3) {
      examples.push(title);
      frameExamples.set(frame, examples);
    }

    if (frame === "of_phrase") {
      if (ofPhraseExamples.length < 3) {
        ofPhraseExamples.push(title);
      }
    }

    if (frame === previousFrame) {
      currentFrameClusterCount += 1;
    } else {
      currentFrameClusterCount = 1;
      previousFrame = frame;
    }
    if (currentFrameClusterCount > maxFrameClusterCount) {
      maxFrameClusterCount = currentFrameClusterCount;
      dominantClusterFrame = frame;
    }
  }

  const ofPhraseCount = frameCounts.get("of_phrase") ?? 0;
  const maxAllowedOfPhraseCount = maximumOfPhraseCount(normalizedTitles.length);
  if (ofPhraseCount > maxAllowedOfPhraseCount) {
    const issue = [
      `La estructura del título del capítulo está demasiado concentrada:${ofPhraseCount}/${normalizedTitles.length} Un título utiliza la estructura "Y de X / Y de X".`,
      ofPhraseExamples.length > 0 ? `Ejemplo de esqueleto repetido:${ofPhraseExamples.join(",")}.` : "",
      "Reduzca la proporción de este tipo de títulos y utilice diferentes nombres de capítulos, como tipo de avance de acción, tipo de presión de conflicto, tipo de descubrimiento de anomalías, tipo de realización de resultados, etc.",
    ].filter(Boolean).join("");
    // Marginal band: the frame overshoots its allowance by at most one title
    // and still covers less than half of the list. At or above half of the
    // list the concentration stays a hard failure.
    const severity: ChapterTitleDiversitySeverity = ofPhraseCount - maxAllowedOfPhraseCount <= 1
      && ofPhraseCount * 2 < normalizedTitles.length
      ? "marginal"
      : "severe";
    return { issue, severity, offendingTitles: frameTitles.get("of_phrase") ?? [] };
  }

  let dominantFrame: ChapterTitleSurfaceFrame = "plain_statement";
  let dominantFrameCount = 0;
  for (const [frame, count] of frameCounts.entries()) {
    if (count > dominantFrameCount) {
      dominantFrame = frame;
      dominantFrameCount = count;
    }
  }

  const maxAllowedSingleFrameCount = maximumSingleFrameCount(normalizedTitles.length);
  if (dominantFrame !== "plain_statement" && dominantFrameCount > maxAllowedSingleFrameCount) {
    const examples = frameExamples.get(dominantFrame) ?? [];
    const issue = [
      `La estructura del título del capítulo está demasiado concentrada:${dominantFrameCount}/${normalizedTitles.length} todos los títulos caen bajo ${formatFrameLabel(dominantFrame)} Sobre el esqueleto.`,
      examples.length > 0 ? `Ejemplo de esqueleto repetido:${examples.join(",")}.` : "",
      "Cambie el título para que esté más disperso y utilice diferentes sintaxis, como tipo de promoción de acciones, tipo de conflicto, tipo de descubrimiento de anomalías, tipo de cumplimiento de resultados, tipo de giro decisivo, etc.",
    ].filter(Boolean).join("");
    // Crossing the single-frame allowance means the frame already holds more
    // than half of the list, so this finding is never marginal.
    return { issue, severity: "severe", offendingTitles: frameTitles.get(dominantFrame) ?? [] };
  }

  if (maxFrameClusterCount > 3 && dominantClusterFrame && dominantClusterFrame !== "plain_statement") {
    const issue = `La estructura del título de los capítulos adyacentes es demasiado repetitiva: continua ${maxFrameClusterCount} los títulos están en uso ${formatFrameLabel(dominantClusterFrame)} esqueleto. Cambie los nombres de los capítulos adyacentes a una sintaxis diferente.`;
    const clusterFrameCount = frameCounts.get(dominantClusterFrame) ?? 0;
    const severity: ChapterTitleDiversitySeverity = maxFrameClusterCount <= 4
      && clusterFrameCount * 2 < normalizedTitles.length
      ? "marginal"
      : "severe";
    return { issue, severity, offendingTitles: frameTitles.get(dominantClusterFrame) ?? [] };
  }

  return null;
}

export function getChapterTitleDiversityIssue(titles: string[]): string | null {
  return assessChapterTitleDiversity(titles)?.issue ?? null;
}

export function isChapterTitleDiversityIssue(message: string | null | undefined): boolean {
  if (!ENABLE_CHAPTER_TITLE_DIVERSITY_VALIDATION) {
    return false;
  }
  const normalized = message?.trim();
  if (!normalized) {
    return false;
  }
  return normalized.includes("La estructura del título del capítulo está demasiado concentrada.")
    || normalized.includes("La estructura del título de los capítulos adyacentes es demasiado repetitiva.")
    || normalized.includes("Los títulos de los capítulos están duplicados.")
    || normalized.includes("Los títulos de los capítulos no deben estar en primera persona.")
    || normalized.includes("El título del capítulo es demasiado largo.")
    || normalized.includes("Los títulos de los capítulos parecen sinopsis de la trama.");
}

export function isBlockingChapterTitleQualityIssue(message: string | null | undefined): boolean {
  const normalized = message?.trim();
  if (!normalized) {
    return false;
  }
  return normalized.includes("Los títulos de los capítulos no deben estar en primera persona.")
    || normalized.includes("El título del capítulo es demasiado largo.")
    || normalized.includes("Los títulos de los capítulos parecen sinopsis de la trama.");
}

export function assertChapterTitleDiversity(titles: string[]): void {
  const issue = getChapterTitleDiversityIssue(titles);
  if (issue) {
    throw new Error(issue);
  }
}
