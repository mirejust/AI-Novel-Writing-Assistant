import { NOVEL_EXPORT_SCOPE_LABELS, type NovelExportScope } from "@ai-novel/shared/types/novelExport";
import type {
  NovelExportBasicSection,
  NovelExportBundle,
  NovelExportCharacterSection,
  NovelExportChapterSection,
  NovelExportOutlineSection,
  NovelExportPipelineSection,
  NovelExportSectionMap,
  NovelExportSectionScope,
  NovelExportStoryMacroSection,
  NovelExportStructuredSection,
} from "./novelExport.types";

const FULL_SECTION_ORDER: NovelExportSectionScope[] = [
  "basic",
  "story_macro",
  "character",
  "outline",
  "structured",
  "chapter",
  "pipeline",
];

function normalizeText(input: string | null | undefined): string {
  return (input ?? "").replace(/\r\n?/g, "\n").trim();
}

export function chapterExportText(content: string | null, confirmedManuscript = false): string {
  return confirmedManuscript ? content ?? "" : normalizeText(content);
}

function hasMeaningfulText(input: string | null | undefined): boolean {
  return normalizeText(input).length > 0;
}

export interface NovelTxtRecord {
  title: string;
  description: string | null;
  narrativeForm?: "short_story" | "long_novel";
  shortStoryContent?: string | null;
  confirmedManuscript?: boolean;
  chapters: Array<{
    order: number;
    title: string;
    content: string | null;
  }>;
}

export interface NovelExportResult {
  fileName: string;
  contentType: string;
  content: string | Buffer;
}

export function safeFileNamePart(input: string): string {
  const cleaned = input
    .replace(/[\\/:*?"<>|]/g, "_")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned || "novel";
}

function padTimeUnit(value: number): string {
  return String(Math.max(0, Math.floor(value))).padStart(2, "0");
}

export function buildExportTimestamp(input: Date = new Date()): string {
  return [
    input.getFullYear(),
    padTimeUnit(input.getMonth() + 1),
    padTimeUnit(input.getDate()),
  ].join("")
    + "-"
    + [
      padTimeUnit(input.getHours()),
      padTimeUnit(input.getMinutes()),
      padTimeUnit(input.getSeconds()),
    ].join("");
}

export function buildNovelTxtExport(novel: NovelTxtRecord) {
  return {fileName: `${safeFileNamePart(novel.title)}-${buildExportTimestamp()}.txt`, contentType:"text/plain; charset=utf-8",content:buildTxtContent(novel)};
}

export function buildTxtContent(novel: NovelTxtRecord): string {
  const lines: string[] = [];
  lines.push(`«${novel.title}»`);
  lines.push("");

  const description = novel.confirmedManuscript ? novel.description : normalizeText(novel.description);
  if (description) {
    lines.push("[Introducción]");
    lines.push(description);
    lines.push("");
  }

  if (novel.narrativeForm === "short_story") {
    lines.push(normalizeText(novel.shortStoryContent) || "(Aún no hay texto)");
    return lines.join("\n");
  }

  if (novel.chapters.length === 0) {
    lines.push("(Aún no hay contenido del capítulo)");
    return lines.join("\n");
  }

  for (const chapter of novel.chapters) {
    lines.push("=".repeat(48));
    lines.push(`Cap.${chapter.order}capítulo ${chapter.title}`);
    lines.push("-".repeat(48));
    lines.push(chapterExportText(chapter.content, novel.confirmedManuscript) || "(Este capítulo aún no tiene contenido)");
    lines.push("");
  }

  return lines.join("\n");
}

function addBullet(lines: string[], label: string, value: string | number | null | undefined): void {
  if (value === null || value === undefined) {
    return;
  }
  const text = typeof value === "number" ? String(value) : normalizeText(value);
  if (!text) {
    return;
  }
  lines.push(`- ${label}:${text}`);
}

function addParagraph(lines: string[], title: string, value: string | null | undefined, level = 3): void {
  const text = normalizeText(value);
  if (!text) {
    return;
  }
  lines.push(`${"#".repeat(level)} ${title}`);
  lines.push("");
  lines.push(text);
  lines.push("");
}

function addJsonBlock(lines: string[], title: string, value: unknown): void {
  lines.push(`### ${title}`);
  lines.push("");
  lines.push("```json");
  lines.push(JSON.stringify(value, null, 2));
  lines.push("```");
  lines.push("");
}

function buildBasicSummary(section: NovelExportBasicSection): string[] {
  const lines: string[] = [];
  addBullet(lines, "título", section.novel.title);
  addBullet(lines, "modo de escritura", section.novel.writingMode);
  addBullet(lines, "modo proyecto", section.novel.projectMode ?? null);
  addBullet(lines, "tema", section.novel.genre?.name ?? null);
  addBullet(lines, "Corriente principal", section.novel.primaryStoryMode?.name ?? null);
  addBullet(lines, "subgénero", section.novel.secondaryStoryMode?.name ?? null);
  addBullet(lines, "mundo atado", section.novel.world?.name ?? null);
  addBullet(lines, "Número estimado de capítulos", section.novel.estimatedChapterCount ?? null);
  if ((section.novel.commercialTags ?? []).length > 0) {
    addBullet(lines, "etiqueta comercial", section.novel.commercialTags.join(" / "));
  }
  addParagraph(lines, "Introducción de una frase", section.novel.description);
  addParagraph(lines, "público objetivo", section.novel.targetAudience);
  addParagraph(lines, "punto de venta principal", section.novel.bookSellingPoint);
  addParagraph(lines, "Sentimientos de evaluación comparativa", section.novel.competingFeel);
  addParagraph(lines, "Promesa de los primeros 30 capítulos", section.novel.first30ChapterPromise);
  addParagraph(lines, "Marco central de corte mundial", section.worldSlice?.slice?.coreWorldFrame ?? null);
  return lines;
}

function buildStoryMacroSummary(section: NovelExportStoryMacroSection): string[] {
  const lines: string[] = [];
  addParagraph(lines, "entrada de la historia", section.storyMacroPlan?.storyInput);
  addParagraph(lines, "Premisa de expansión", section.storyMacroPlan?.expansion?.expanded_premise ?? null);
  addParagraph(lines, "Núcleo protagonista", section.storyMacroPlan?.expansion?.protagonist_core ?? null);
  addParagraph(lines, "motor de conflicto", section.storyMacroPlan?.expansion?.conflict_engine ?? null);
  addParagraph(lines, "Conflicto central", section.storyMacroPlan?.decomposition?.core_conflict ?? null);
  addParagraph(lines, "gancho principal", section.storyMacroPlan?.decomposition?.main_hook ?? null);
  addParagraph(lines, "ciclo de avance", section.storyMacroPlan?.decomposition?.progression_loop ?? null);
  addParagraph(lines, "Compromiso de lectura a nivel de libro", section.bookContract?.readingPromise ?? null);
  addParagraph(lines, "punto de venta principal", section.bookContract?.coreSellingPoint ?? null);
  addParagraph(lines, "Escalera de mejora", section.bookContract?.escalationLadder ?? null);
  if ((section.bookContract?.absoluteRedLines ?? []).length > 0) {
    lines.push("### Línea roja absoluta");
    lines.push("");
    for (const item of section.bookContract?.absoluteRedLines ?? []) {
      lines.push(`- ${item}`);
    }
    lines.push("");
  }
  return lines;
}

function buildCharacterSummary(section: NovelExportCharacterSection): string[] {
  const lines: string[] = [];
  addBullet(lines, "Número de caracteres", section.characters.length);
  addBullet(lines, "número de relación", section.relations.length);
  addBullet(lines, "Número de alineaciones de candidatos", section.castOptions.length);
  if (section.characters.length > 0) {
    lines.push("### Rol actual");
    lines.push("");
    for (const character of section.characters) {
      const parts = [character.name, character.role, character.castRole].filter((item): item is string => Boolean(item?.trim()));
      lines.push(`- ${parts.join(" / ")}`);
    }
    lines.push("");
  }
  return lines;
}

function buildOutlineSummary(section: NovelExportOutlineSection): string[] {
  const lines: string[] = [];
  addBullet(lines, "fuente de volumen", section.workspace?.source ?? null);
  addBullet(lines, "Número de volúmenes", section.workspace?.volumes.length ?? 0);
  addBullet(lines, "Número de volúmenes recomendado", section.workspace?.strategyPlan?.recommendedVolumeCount ?? null);
  addParagraph(lines, "Esquema de exportación a nivel de volumen", section.workspace?.derivedOutline ?? null);
  addParagraph(lines, "Escalera de recompensas del lector", section.workspace?.strategyPlan?.readerRewardLadder ?? null);
  addParagraph(lines, "Escalera de mejora", section.workspace?.strategyPlan?.escalationLadder ?? null);
  addParagraph(lines, "Notas de estrategia", section.workspace?.strategyPlan?.notes ?? null);
  addParagraph(lines, "Resumen crítico", section.workspace?.critiqueReport?.summary ?? null);
  return lines;
}

function buildStructuredSummary(section: NovelExportStructuredSection): string[] {
  const lines: string[] = [];
  const beatCount = (section.workspace?.beatSheets ?? []).reduce((sum, item) => sum + item.beats.length, 0);
  const chapterCount = (section.workspace?.volumes ?? []).reduce((sum, item) => sum + item.chapters.length, 0);
  addBullet(lines, "Número de cartas de ritmo", beatCount);
  addBullet(lines, "Número de capítulos previstos", chapterCount);
  addBullet(lines, "Número de decisiones de reequilibrio", section.workspace?.rebalanceDecisions.length ?? 0);
  addParagraph(lines, "esquema estructurado", section.workspace?.derivedStructuredOutline ?? null);
  return lines;
}

function buildChapterSummary(section: NovelExportChapterSection): string[] {
  const lines: string[] = [];
  const generatedCount = section.chapters.filter((chapter) => hasMeaningfulText(chapter.content)).length;
  addBullet(lines, "Número total de capítulos", section.chapters.length);
  addBullet(lines, "Ya existe una sección de texto.", generatedCount);
  addBullet(lines, "Número de plan del capítulo", section.chapterPlans.length);
  if (section.chapters.length > 0) {
    lines.push("### Lista de capítulos");
    lines.push("");
    for (const chapter of section.chapters) {
      lines.push(`- No. ${chapter.order} capítulo:${chapter.title}`);
    }
    lines.push("");
  }
  return lines;
}

function buildPipelineSummary(section: NovelExportPipelineSection): string[] {
  const lines: string[] = [];
  addBullet(lines, "puntuación de calidad general", section.qualityReport.summary.overall);
  addBullet(lines, "Número de informes de calidad", section.qualityReport.totalReports ?? section.qualityReport.chapterReports.length);
  addBullet(lines, "Número de informes de auditoría", section.chapterAuditReports.length);
  addBullet(lines, "puntos de la trama", section.plotBeats.length);
  addBullet(lines, "Número de elementos del libro mayor de presagios", section.payoffLedger?.items.length ?? 0);
  addBullet(lines, "Estado reciente del oleoducto", section.latestPipelineJob?.status ?? null);
  addParagraph(lines, "Nuevo contenido original de la Biblia.", section.bible?.rawContent ?? null);
  return lines;
}

function buildSectionSummary(scope: NovelExportSectionScope, section: NovelExportSectionMap[NovelExportSectionScope]): string[] {
  switch (scope) {
    case "basic":
      return buildBasicSummary(section as NovelExportBasicSection);
    case "story_macro":
      return buildStoryMacroSummary(section as NovelExportStoryMacroSection);
    case "character":
      return buildCharacterSummary(section as NovelExportCharacterSection);
    case "outline":
      return buildOutlineSummary(section as NovelExportOutlineSection);
    case "structured":
      return buildStructuredSummary(section as NovelExportStructuredSection);
    case "chapter":
      return buildChapterSummary(section as NovelExportChapterSection);
    case "pipeline":
      return buildPipelineSummary(section as NovelExportPipelineSection);
    default:
      return [];
  }
}

export function buildScopedNovelExportPayload(
  bundle: NovelExportBundle,
  scope: NovelExportScope,
): {
  metadata: NovelExportBundle["metadata"] & {
    scope: NovelExportScope;
    scopeLabel: string;
  };
  data: NovelExportSectionMap | NovelExportSectionMap[NovelExportSectionScope];
} {
  return {
    metadata: {
      ...bundle.metadata,
      scope,
      scopeLabel: NOVEL_EXPORT_SCOPE_LABELS[scope],
    },
    data: scope === "full" ? bundle.sections : bundle.sections[scope],
  };
}

export function buildMarkdownExportContent(bundle: NovelExportBundle, scope: NovelExportScope): string {
  const lines: string[] = [];
  const scopeLabel = NOVEL_EXPORT_SCOPE_LABELS[scope];
  const sectionScopes = scope === "full" ? FULL_SECTION_ORDER : [scope];

  lines.push(`# ${bundle.metadata.novelTitle} Exportar`);
  lines.push("");
  lines.push(`- Rango de exportación:${scopeLabel}`);
  lines.push(`- Tiempo de exportación:${bundle.metadata.exportedAt}`);
  lines.push(`- ID de novela:${bundle.metadata.novelId}`);
  lines.push("");

  for (const sectionScope of sectionScopes) {
    const section = bundle.sections[sectionScope];
    lines.push(`## ${NOVEL_EXPORT_SCOPE_LABELS[sectionScope]}`);
    lines.push("");
    const summaryLines = buildSectionSummary(sectionScope, section);
    if (summaryLines.length > 0) {
      lines.push(...summaryLines);
    } else {
      lines.push("(Actualmente no hay contenido estructurado para resumir)");
      lines.push("");
    }
    addJsonBlock(lines, "datos completos", section);
  }

  return lines.join("\n");
}
