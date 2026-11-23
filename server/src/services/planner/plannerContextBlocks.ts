import { createContextBlock } from "../../prompting/core/contextBudget";
import type { PromptContextBlock } from "../../prompting/core/promptTypes";

function buildBlockContent(label: string, value: string): string {
  return `${label}:${value.trim() || "Ninguno"}`;
}

function buildVolumeOutline(input: Array<{
  sortOrder: number;
  title: string;
  summary: string | null;
  mainPromise: string | null;
  climax: string | null;
  chapters: Array<{
    chapterOrder: number;
    title: string;
    summary: string | null;
  }>;
}>): string {
  if (input.length === 0) {
    return "";
  }
  return input
    .slice()
    .sort((left, right) => left.sortOrder - right.sortOrder)
    .map((volume) => {
      const chapterSpan = volume.chapters.length > 0
        ? `${volume.chapters[0]?.chapterOrder ?? "-"}-${volume.chapters[volume.chapters.length - 1]?.chapterOrder ?? "-"}`
        : "sin abrir";
      return [
        `[No.${volume.sortOrder}rollo]${volume.title}`,
        volume.summary ? `Resumen del volumen:${volume.summary}` : "",
        volume.mainPromise ? `Promesa principal:${volume.mainPromise}` : "",
        volume.climax ? `Clímax al final del volumen:${volume.climax}` : "",
        `Alcance del capítulo:${chapterSpan}`,
      ].filter(Boolean).join("\n");
    })
    .join("\n\n");
}

function buildBookFramingText(input: {
  genreName?: string | null;
  targetAudience: string | null;
  bookSellingPoint: string | null;
  competingFeel: string | null;
  first30ChapterPromise: string | null;
  narrativePov?: string | null;
  pacePreference?: string | null;
  emotionIntensity?: string | null;
  styleTone?: string | null;
}): string {
  return [
    buildBlockContent("Base temática", input.genreName ?? "Ninguno"),
    buildBlockContent("público objetivo", input.targetAudience ?? "Ninguno"),
    buildBlockContent("punto de venta principal", input.bookSellingPoint ?? "Ninguno"),
    buildBlockContent("Producto competitivo/experiencia de referencia", input.competingFeel ?? "Ninguno"),
    buildBlockContent("Los primeros 30 capítulos prometen", input.first30ChapterPromise ?? "Ninguno"),
    buildBlockContent("perspectiva narrativa", input.narrativePov ?? "Ninguno"),
    buildBlockContent("preferencia de ritmo", input.pacePreference ?? "Ninguno"),
    buildBlockContent("intensidad emocional", input.emotionIntensity ?? "Ninguno"),
    buildBlockContent("barandillas de tono", input.styleTone ?? "Ninguno"),
  ].join("\n");
}

export function buildBookPlanContextBlocks(input: {
  novelTitle: string;
  description: string | null;
  genreName?: string | null;
  targetAudience: string | null;
  bookSellingPoint: string | null;
  competingFeel: string | null;
  first30ChapterPromise: string | null;
  narrativePov?: string | null;
  pacePreference?: string | null;
  emotionIntensity?: string | null;
  styleTone?: string | null;
  bible: string | null;
  chapterDrafts: string;
  plotBeats: string;
  storyModeBlock: string;
  styleEngine?: string | null;
}): PromptContextBlock[] {
  return [
    createContextBlock({
      id: "story_mode",
      group: "story_mode",
      priority: 95,
      content: input.storyModeBlock || "Modo historia: ninguno",
    }),
    createContextBlock({
      id: "novel_overview",
      group: "novel_overview",
      priority: 100,
      required: true,
      content: [
        `novedoso:${input.novelTitle}`,
        buildBlockContent("Introducción", input.description ?? ""),
      ].join("\n"),
    }),
    createContextBlock({
      id: "book_framing",
      group: "book_framing",
      priority: 99,
      content: buildBookFramingText({
        genreName: input.genreName,
        targetAudience: input.targetAudience,
        bookSellingPoint: input.bookSellingPoint,
        competingFeel: input.competingFeel,
        first30ChapterPromise: input.first30ChapterPromise,
        narrativePov: input.narrativePov,
        pacePreference: input.pacePreference,
        emotionIntensity: input.emotionIntensity,
        styleTone: input.styleTone,
      }),
    }),
    createContextBlock({
      id: "book_bible",
      group: "book_bible",
      priority: 90,
      content: buildBlockContent("Biblia de obras", input.bible ?? "Ninguno"),
    }),
    createContextBlock({
      id: "style_engine",
      group: "style_engine",
      priority: 89,
      content: buildBlockContent("Restricciones del motor de escritura", input.styleEngine ?? "Ninguno"),
    }),
    createContextBlock({
      id: "chapter_drafts",
      group: "chapter_drafts",
      priority: 70,
      content: buildBlockContent("Borrador del capítulo", input.chapterDrafts || "Ninguno"),
    }),
    createContextBlock({
      id: "plot_beats",
      group: "plot_beats",
      priority: 60,
      content: buildBlockContent("Punto de tiro de la trama", input.plotBeats || "Ninguno"),
    }),
  ];
}

export function buildArcPlanContextBlocks(input: {
  novelTitle: string;
  description: string | null;
  genreName?: string | null;
  targetAudience: string | null;
  bookSellingPoint: string | null;
  competingFeel: string | null;
  first30ChapterPromise: string | null;
  narrativePov?: string | null;
  pacePreference?: string | null;
  emotionIntensity?: string | null;
  styleTone?: string | null;
  bible: string | null;
  chapters: string;
  storyModeBlock: string;
  styleEngine?: string | null;
}): PromptContextBlock[] {
  return [
    createContextBlock({
      id: "story_mode",
      group: "story_mode",
      priority: 95,
      content: input.storyModeBlock || "Modo historia: ninguno",
    }),
    createContextBlock({
      id: "novel_overview",
      group: "novel_overview",
      priority: 100,
      required: true,
      content: [
        `novedoso:${input.novelTitle}`,
        buildBlockContent("Introducción", input.description ?? ""),
      ].join("\n"),
    }),
    createContextBlock({
      id: "book_framing",
      group: "book_framing",
      priority: 99,
      content: buildBookFramingText({
        genreName: input.genreName,
        targetAudience: input.targetAudience,
        bookSellingPoint: input.bookSellingPoint,
        competingFeel: input.competingFeel,
        first30ChapterPromise: input.first30ChapterPromise,
        narrativePov: input.narrativePov,
        pacePreference: input.pacePreference,
        emotionIntensity: input.emotionIntensity,
        styleTone: input.styleTone,
      }),
    }),
    createContextBlock({
      id: "book_bible",
      group: "book_bible",
      priority: 90,
      content: buildBlockContent("Biblia de obras", input.bible ?? "Ninguno"),
    }),
    createContextBlock({
      id: "style_engine",
      group: "style_engine",
      priority: 89,
      content: buildBlockContent("Restricciones del motor de escritura", input.styleEngine ?? "Ninguno"),
    }),
    createContextBlock({
      id: "chapter_drafts",
      group: "chapter_drafts",
      priority: 75,
      content: buildBlockContent("Capítulos existentes", input.chapters || "Ninguno"),
    }),
  ];
}

export function buildChapterPlanContextBlocks(input: {
  novelTitle: string;
  description: string | null;
  genreName?: string | null;
  targetAudience: string | null;
  bookSellingPoint: string | null;
  competingFeel: string | null;
  first30ChapterPromise: string | null;
  narrativePov?: string | null;
  pacePreference?: string | null;
  emotionIntensity?: string | null;
  styleTone?: string | null;
  chapterExpectation: string | null;
  chapterTaskSheet: string | null;
  chapterTargetWordCount?: number | null;
  bible: string | null;
  styleEngine?: string | null;
  outline: string | null;
  structuredOutline: string | null;
  mappedVolumes: Array<{
    sortOrder: number;
    title: string;
    summary: string | null;
    mainPromise: string | null;
    climax: string | null;
    updatedAt: string;
    chapters: Array<{
      chapterOrder: number;
      title: string;
      summary: string | null;
    }>;
  }>;
  bookPlan: string;
  arcPlans: string;
  characters: string;
  recentSummaries: string;
  plotBeats: string;
  stateSnapshot: string;
  openAuditIssues: string;
  recentDecisions: string;
  characterDynamicsSummary: string;
  characterVolumeAssignments: string;
  characterRelationStages: string;
  characterCandidateGuards: string;
  defaultMetadata: string;
  stateDrivenDirective: string;
  stateDrivenGoal: string;
  replanContext: string;
  replanConflictLevelAnchors?: string;
  storyMacroSummary: string;
  currentVolumeWindow: string;
  payoffLedgerSummary: string;
  storyModeBlock: string;
}): PromptContextBlock[] {
  const volumeOutline = buildVolumeOutline(input.mappedVolumes);
  const volumeSummary = input.mappedVolumes.length > 0
    ? input.mappedVolumes.map((volume) => `${volume.sortOrder}. ${volume.title} | ${volume.mainPromise ?? volume.summary ?? "Ninguno"}${volume.climax ? ` | Clímax =${volume.climax}` : ""}`).join("\n")
    : "Ninguno";

  return [
    createContextBlock({
      id: "story_mode",
      reuseScope: "book",
      group: "story_mode",
      priority: 95,
      content: input.storyModeBlock || "Modo historia: ninguno",
    }),
    createContextBlock({
      id: "novel_overview",
      reuseScope: "book",
      group: "novel_overview",
      priority: 100,
      required: true,
      content: [
        `novedoso:${input.novelTitle}`,
        buildBlockContent("Introducción", input.description ?? ""),
      ].join("\n"),
    }),
    createContextBlock({
      id: "book_framing",
      reuseScope: "book",
      group: "book_framing",
      priority: 99,
      content: buildBookFramingText({
        genreName: input.genreName,
        targetAudience: input.targetAudience,
        bookSellingPoint: input.bookSellingPoint,
        competingFeel: input.competingFeel,
        first30ChapterPromise: input.first30ChapterPromise,
        narrativePov: input.narrativePov,
        pacePreference: input.pacePreference,
        emotionIntensity: input.emotionIntensity,
        styleTone: input.styleTone,
      }),
    }),
    createContextBlock({
      id: "chapter_target",
      group: "chapter_target",
      priority: 100,
      required: true,
      content: [
        buildBlockContent("Borrador de objetivos del capítulo", input.chapterExpectation ?? "Ninguno"),
        buildBlockContent("Recuento de palabras objetivo del capítulo", typeof input.chapterTargetWordCount === "number" ? `${input.chapterTargetWordCount} palabras` : "Ninguno"),
        buildBlockContent("Hoja de tareas", input.chapterTaskSheet ?? "Ninguno"),
        buildBlockContent("toma de decisiones impulsada por el estado", input.stateDrivenDirective),
        buildBlockContent("Sugerencias de responsabilidad de estructura predeterminada", input.defaultMetadata),
      ].join("\n"),
    }),
    createContextBlock({
      id: "book_bible",
      reuseScope: "book",
      group: "book_bible",
      priority: 92,
      content: buildBlockContent("Biblia de obras", input.bible ?? "Ninguno"),
    }),
    createContextBlock({
      id: "style_engine",
      group: "style_engine",
      priority: 91,
      content: buildBlockContent("Restricciones del motor de escritura", input.styleEngine ?? "Ninguno"),
    }),
    createContextBlock({
      id: "current_volume_window",
      group: "current_volume_window",
      priority: 97,
      content: buildBlockContent("Ventana de volumen actual", input.currentVolumeWindow || "Ninguno"),
    }),
    createContextBlock({
      id: "story_macro",
      group: "story_macro",
      priority: 96,
      content: buildBlockContent("Restricciones de la macro historia", input.storyMacroSummary || "Ninguno"),
    }),
    createContextBlock({
      id: "payoff_ledger",
      group: "payoff_ledger",
      priority: 95,
      content: buildBlockContent("Libro mayor de presagios", input.payoffLedgerSummary || "Ninguno"),
    }),
    createContextBlock({
      id: "volume_summary",
      group: "volume_summary",
      priority: 95,
      freshness: input.mappedVolumes.length > 0 ? 3 : 0,
      content: [
        buildBlockContent("Resumen del banco de trabajo de nivel de volumen", volumeSummary),
        volumeOutline ? buildBlockContent("Ampliación del banco de trabajo a nivel de volumen", volumeOutline) : "",
      ].filter(Boolean).join("\n"),
    }),
    createContextBlock({
      id: "legacy_outline_source",
      group: "legacy_outline_source",
      priority: 58,
      content: [
        buildBlockContent("Esquema de línea principal anterior de compatibilidad (solo como referencia de migración)", input.outline ?? "Ninguno"),
        buildBlockContent("Compatibilidad con esquemas estructurados antiguos (solo como referencia de migración)", input.structuredOutline ?? "Ninguno"),
      ].join("\n"),
    }),
    createContextBlock({
      id: "book_plan",
      group: "book_plan",
      priority: 88,
      content: buildBlockContent("planificación de libros", input.bookPlan),
    }),
    createContextBlock({
      id: "arc_plans",
      group: "arc_plans",
      priority: 82,
      content: buildBlockContent("planificación del escenario", input.arcPlans),
    }),
    createContextBlock({
      id: "character_digest",
      group: "character_digest",
      priority: 80,
      content: buildBlockContent("Personaje", input.characters),
    }),
    createContextBlock({
      id: "recent_summaries",
      group: "recent_summaries",
      priority: 72,
      content: buildBlockContent("Resumen de capítulos recientes", input.recentSummaries),
    }),
    createContextBlock({
      id: "plot_beats",
      group: "plot_beats",
      priority: 68,
      content: buildBlockContent("Punto de tiro de la trama", input.plotBeats),
    }),
    createContextBlock({
      id: "state_driven_goal",
      group: "state_driven_goal",
      priority: 98,
      required: true,
      content: [
        buildBlockContent("objetivos impulsados ​​por el estado", input.stateDrivenGoal),
      ].join("\n"),
    }),
    createContextBlock({
      id: "state_snapshot",
      group: "state_snapshot",
      priority: 98,
      required: true,
      content: buildBlockContent("Instantánea del estado de entrada", input.stateSnapshot),
    }),
    createContextBlock({
      id: "open_audit_issues",
      group: "open_audit_issues",
      priority: 86,
      content: buildBlockContent("Problemas de auditoría no resueltos recientemente", input.openAuditIssues),
    }),
    createContextBlock({
      id: "recent_decisions",
      group: "recent_decisions",
      priority: 64,
      content: buildBlockContent("Decisiones creativas recientes", input.recentDecisions),
    }),
    createContextBlock({
      id: "character_dynamics_summary",
      group: "character_dynamics",
      priority: 89,
      content: buildBlockContent("Descripción general del sistema de caracteres dinámicos", input.characterDynamicsSummary),
    }),
    createContextBlock({
      id: "character_volume_assignments",
      group: "character_dynamics",
      priority: 88,
      content: buildBlockContent("Responsabilidades del rol de volumen actual y riesgos de ausencia", input.characterVolumeAssignments),
    }),
    createContextBlock({
      id: "character_relation_stages",
      group: "character_dynamics",
      priority: 87,
      content: buildBlockContent("etapa actual de la relación", input.characterRelationStages),
    }),
    createContextBlock({
      id: "character_candidate_guards",
      group: "character_dynamics",
      priority: 85,
      content: buildBlockContent("Protección del rol del candidato por confirmar", input.characterCandidateGuards),
    }),
    createContextBlock({
      id: "replan_context",
      group: "replan_context",
      priority: 84,
      content: [
        buildBlockContent("Entrada de replanificación", input.replanContext),
        buildBlockContent("Replanificación del anclaje a tensión", input.replanConflictLevelAnchors ?? "Ninguno"),
      ].join("\n"),
    }),
  ];
}
