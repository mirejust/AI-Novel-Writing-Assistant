import { randomUUID } from "node:crypto";
import type {
  AuditIssue,
  AuditReport,
  ChapterEditorDiagnosticCard,
  ChapterEditorMacroContext,
  ChapterEditorRecommendedTask,
  ChapterEditorWorkspaceResponse,
  StoryPlan,
  StoryStateSnapshot,
  VolumeChapterPlan,
  VolumePlan,
} from "@ai-novel/shared/types/novel";
import { runStructuredPrompt } from "../../../prompting/core/promptRunner";
import {
  chapterEditorWorkspaceDiagnosisPrompt,
  type ChapterEditorWorkspaceDiagnosisPromptInput,
} from "../../../prompting/prompts/novel/chapterEditor/workspaceDiagnosis.prompts";
import { NovelCoreService } from "../NovelCoreService";
import { NovelVolumeService } from "../volume/NovelVolumeService";
import { readActiveManuscriptChapters } from "../../../modules/novel/manuscript/application/ManuscriptIsolation";
import { prisma } from "../../../db/prisma";
import {
  buildAnchorRangeFromParagraphBounds,
  buildCharacterStateSummary,
  buildMustKeepConstraints,
  buildPaceDirective,
  buildStyleSummary,
  buildWorldConstraintSummary,
  countEditorWords,
  findVolumeLocation,
  normalizeChapterContent,
  parseLooseTextList,
  splitParagraphsWithRanges,
  type ChapterEditorParagraph,
} from "./context";

type LoadedWorkspaceNovel = NonNullable<Awaited<ReturnType<NovelCoreService["getNovelById"]>>>;

export interface ChapterEditorWorkspaceContext {
  novel: LoadedWorkspaceNovel;
  chapter: LoadedWorkspaceNovel["chapters"][number];
  chapterPlan: StoryPlan | null;
  auditReports: AuditReport[];
  latestStateSnapshot: StoryStateSnapshot | null;
  volumes: VolumePlan[];
  normalizedContent: string;
  paragraphs: ChapterEditorParagraph[];
  styleSummary: string;
  chapterSummary: string;
  openAuditIssues: AuditIssue[];
  macroContext: ChapterEditorMacroContext;
}

function toRoleLabel(planRole?: StoryPlan["planRole"] | null): string | null {
  return ({
    setup: "Responsable de establecer situaciones y expectativas.",
    progress: "Responsable de impulsar los objetivos hacia adelante.",
    pressure: "Responsable de aumentar la presión y la dificultad.",
    turn: "Responsable de crear un punto de inflexión o cambio de dirección.",
    payoff: "Responsable de cumplir los compromisos anteriores.",
    cooldown: "Responsable de resolver las secuelas y hacer la transición de la escena.",
  } as Record<string, string | undefined>)[planRole ?? ""] ?? null;
}

function trimPromptText(text: string, maxLength = 260): string {
  const normalized = text.trim().replace(/\s+/g, " ");
  return normalized.length > maxLength ? `${normalized.slice(0, maxLength)}…` : normalized;
}

function buildBridgeLabel(chapter: { title?: string | null; expectation?: string | null; summary?: string | null } | null | undefined, fallback: string): string {
  if (!chapter) {
    return fallback;
  }
  const body = chapter.summary?.trim() || chapter.expectation?.trim() || chapter.title?.trim() || "";
  return body || fallback;
}

function buildVolumeChapterBridge(chapter: VolumeChapterPlan | null | undefined, fallback: string): string {
  if (!chapter) {
    return fallback;
  }
  return chapter.summary?.trim()
    || chapter.purpose?.trim()
    || chapter.endingState?.trim()
    || chapter.nextChapterEntryState?.trim()
    || chapter.title?.trim()
    || fallback;
}

function buildChapterSummary(chapter: LoadedWorkspaceNovel["chapters"][number], content: string): string {
  const chapterWithSummary = chapter as LoadedWorkspaceNovel["chapters"][number] & {
    chapterSummary?: { summary?: string | null } | null;
  };
  return chapterWithSummary.chapterSummary?.summary?.trim()
    || chapter.expectation?.trim()
    || content.slice(0, 180)
    || "Aún no hay un resumen del capítulo.";
}

function buildActivePlotThreads(
  chapterPlan: StoryPlan | null,
  latestStateSnapshot: StoryStateSnapshot | null,
  volume: VolumePlan | null,
): string[] {
  const fromPlan = parseLooseTextList(chapterPlan?.mustAdvanceJson);
  const fromVolume = volume?.openPayoffs ?? [];
  const fromSnapshot = latestStateSnapshot?.foreshadowStates
    .filter((item) => item.status !== "paid_off")
    .map((item) => item.summary?.trim() || item.title?.trim() || "")
    .filter(Boolean) ?? [];
  return Array.from(new Set([
    ...fromPlan,
    ...fromVolume,
    ...fromSnapshot,
  ])).slice(0, 5);
}

function normalizeSnapshotDates(snapshot: Awaited<ReturnType<NovelCoreService["getLatestStateSnapshot"]>>): StoryStateSnapshot | null {
  if (!snapshot) {
    return null;
  }
  return {
    ...snapshot,
    createdAt: snapshot.createdAt instanceof Date ? snapshot.createdAt.toISOString() : snapshot.createdAt,
    updatedAt: snapshot.updatedAt instanceof Date ? snapshot.updatedAt.toISOString() : snapshot.updatedAt,
    characterStates: snapshot.characterStates.map((state) => ({
      ...state,
      createdAt: state.createdAt instanceof Date ? state.createdAt.toISOString() : state.createdAt,
      updatedAt: state.updatedAt instanceof Date ? state.updatedAt.toISOString() : state.updatedAt,
    })),
    relationStates: snapshot.relationStates.map((state) => ({
      ...state,
      createdAt: state.createdAt instanceof Date ? state.createdAt.toISOString() : state.createdAt,
      updatedAt: state.updatedAt instanceof Date ? state.updatedAt.toISOString() : state.updatedAt,
    })),
    informationStates: snapshot.informationStates.map((state) => ({
      ...state,
      createdAt: state.createdAt instanceof Date ? state.createdAt.toISOString() : state.createdAt,
      updatedAt: state.updatedAt instanceof Date ? state.updatedAt.toISOString() : state.updatedAt,
    })),
    foreshadowStates: snapshot.foreshadowStates.map((state) => ({
      ...state,
      createdAt: state.createdAt instanceof Date ? state.createdAt.toISOString() : state.createdAt,
      updatedAt: state.updatedAt instanceof Date ? state.updatedAt.toISOString() : state.updatedAt,
    })),
  };
}

function mapDiagnosticCard(
  card: {
    sourceIssueId?: string;
    title: string;
    problemSummary: string;
    whyItMatters: string;
    repairGoal?: string;
    repairApproach?: string;
    mustPreserve?: string[];
    recommendedAction: ChapterEditorDiagnosticCard["recommendedAction"];
    recommendedScope: ChapterEditorDiagnosticCard["recommendedScope"];
    paragraphStart?: number | null;
    paragraphEnd?: number | null;
    severity: ChapterEditorDiagnosticCard["severity"];
    sourceTags: string[];
  },
  paragraphs: ChapterEditorParagraph[],
  sourceIssueIds: ReadonlySet<string>,
): ChapterEditorDiagnosticCard {
  const start = card.paragraphStart ?? null;
  const end = card.paragraphEnd ?? start;
  return {
    id: randomUUID(),
    sourceIssueId: card.sourceIssueId && sourceIssueIds.has(card.sourceIssueId) ? card.sourceIssueId : null,
    title: card.title,
    problemSummary: card.problemSummary,
    whyItMatters: card.whyItMatters,
    repairGoal: card.repairGoal,
    repairApproach: card.repairApproach,
    mustPreserve: card.mustPreserve,
    recommendedAction: card.recommendedAction,
    recommendedScope: card.recommendedScope,
    anchorRange: buildAnchorRangeFromParagraphBounds(paragraphs, start, end),
    paragraphLabel: start && end ? (start === end ? `P${start}` : `P${start}-P${end}`) : null,
    severity: card.severity,
    sourceTags: card.sourceTags,
  };
}

function mapRecommendedTask(
  task: {
    title: string;
    summary: string;
    recommendedAction: ChapterEditorRecommendedTask["recommendedAction"];
    recommendedScope: ChapterEditorRecommendedTask["recommendedScope"];
    paragraphStart?: number | null;
    paragraphEnd?: number | null;
  } | undefined,
  cards: ChapterEditorDiagnosticCard[],
  paragraphs: ChapterEditorParagraph[],
): ChapterEditorRecommendedTask | null {
  if (task) {
    const start = task.paragraphStart ?? null;
    const end = task.paragraphEnd ?? start;
    return {
      title: task.title,
      summary: task.summary,
      recommendedAction: task.recommendedAction,
      recommendedScope: task.recommendedScope,
      anchorRange: buildAnchorRangeFromParagraphBounds(paragraphs, start, end),
      paragraphLabel: start && end ? (start === end ? `P${start}` : `P${start}-P${end}`) : null,
    };
  }
  const firstCard = cards[0];
  if (!firstCard) {
    return null;
  }
  return {
    title: firstCard.title,
    summary: firstCard.whyItMatters,
    recommendedAction: firstCard.recommendedAction,
    recommendedScope: firstCard.recommendedScope,
    anchorRange: firstCard.anchorRange ?? null,
    paragraphLabel: firstCard.paragraphLabel ?? null,
  };
}

export class ChapterEditorWorkspaceService {
  constructor(
    private readonly core: NovelCoreService = new NovelCoreService(),
    private readonly volumeService: NovelVolumeService = new NovelVolumeService(),
    private readonly promptRunner: typeof runStructuredPrompt = runStructuredPrompt,
  ) {}

  async loadContext(novelId: string, chapterId: string): Promise<ChapterEditorWorkspaceContext> {
    const [novel, volumeWorkspace, chapterPlan, auditReports, latestStateSnapshotRaw] = await Promise.all([
      this.core.getNovelById(novelId),
      this.volumeService.getVolumes(novelId).catch(() => null),
      this.core.getChapterPlan(novelId, chapterId).catch(() => null),
      this.core.listChapterAuditReports(novelId, chapterId).catch(() => []),
      this.core.getLatestStateSnapshot(novelId).catch(() => null),
    ]);

    if (!novel) {
      throw new Error("La novela no existe.");
    }

    const activeChapters = await readActiveManuscriptChapters(prisma as never, novelId);
    const effectiveChapters = activeChapters
      ? activeChapters.map(item => ({...item, chapterSummary: novel.chapters.find(row => row.id === item.id)?.chapterSummary ?? null}))
      : novel.chapters;
    const chapter = effectiveChapters.find((item) => item.id === chapterId);
    if (!chapter) {
      throw new Error("El capítulo no existe.");
    }

    const latestStateSnapshot = normalizeSnapshotDates(latestStateSnapshotRaw);
    const normalizedContent = normalizeChapterContent(chapter.content ?? "");
    const paragraphs = splitParagraphsWithRanges(normalizedContent);
    const volumes = volumeWorkspace?.volumes ?? [];
    const location = findVolumeLocation(volumes, chapter.order);
    const volumeChapters = location.volume?.chapters.slice().sort((left, right) => left.chapterOrder - right.chapterOrder) ?? [];
    const currentVolumeChapter = volumeChapters.find((item) => item.chapterOrder === chapter.order) ?? null;
    const previousVolumeChapter = location.chapterIndex > 0 ? volumeChapters[location.chapterIndex - 1] ?? null : null;
    const nextVolumeChapter = location.chapterIndex >= 0 ? volumeChapters[location.chapterIndex + 1] ?? null : null;
    const effectiveOrder = activeChapters ? effectiveChapters.findIndex((item) => item.id === chapterId) + 1 : chapter.order;
    const previousChapter = activeChapters
      ? effectiveChapters[effectiveOrder - 2] ?? null
      : effectiveChapters.find((item) => item.order === chapter.order - 1) ?? null;
    const nextChapter = activeChapters
      ? effectiveChapters[effectiveOrder] ?? null
      : effectiveChapters.find((item) => item.order === chapter.order + 1) ?? null;
    const styleSummary = buildStyleSummary(novel);
    const chapterSummary = buildChapterSummary(chapter, normalizedContent);
    const openAuditIssues = auditReports.flatMap((report) => report.issues.filter((issue) => issue.status === "open"));
    const activePlotThreads = buildActivePlotThreads(chapterPlan, latestStateSnapshot, location.volume);
    const chapterMission = chapterPlan?.objective?.trim()
      || currentVolumeChapter?.purpose?.trim()
      || currentVolumeChapter?.summary?.trim()
      || chapter.expectation?.trim()
      || "El objetivo actual es garantizar que este capítulo siga contribuyendo al avance del volumen.";
    const chapterRoleInVolume = currentVolumeChapter?.purpose?.trim()
      || toRoleLabel(chapterPlan?.planRole)
      || chapterPlan?.phaseLabel?.trim()
      || "Responsable de asumir las responsabilidades de promoción de este capítulo en el volumen.";
    const macroContext: ChapterEditorMacroContext = {
      chapterRoleInVolume,
      volumeTitle: location.volume?.title?.trim() || "Volumen no identificado",
      volumePositionLabel: location.volumePositionLabel,
      volumePhaseLabel: location.volumePhaseLabel,
      paceDirective: buildPaceDirective(location.volumePhaseLabel, novel.pacePreference),
      chapterMission,
      previousChapterBridge: buildVolumeChapterBridge(previousVolumeChapter, buildBridgeLabel(previousChapter, "No hay ningún resumen del capítulo anterior antes de este capítulo.")),
      nextChapterBridge: buildVolumeChapterBridge(nextVolumeChapter, buildBridgeLabel(nextChapter, "No hay ningún resumen del próximo capítulo después de este capítulo al que hacer referencia.")),
      activePlotThreads: activePlotThreads.length > 0 ? activePlotThreads : ["Actualmente no hay ningún recordatorio principal extraído explícitamente."],
      characterStateSummary: buildCharacterStateSummary(latestStateSnapshot),
      worldConstraintSummary: buildWorldConstraintSummary(novel.world),
      mustKeepConstraints: buildMustKeepConstraints(novel.bookContract, chapterPlan),
    };

    return {
      novel,
      chapter,
      chapterPlan,
      auditReports,
      latestStateSnapshot,
      volumes,
      normalizedContent,
      paragraphs,
      styleSummary,
      chapterSummary,
      openAuditIssues,
      macroContext,
    };
  }

  async getWorkspace(novelId: string, chapterId: string): Promise<ChapterEditorWorkspaceResponse> {
    const context = await this.loadContext(novelId, chapterId);

    if (!context.normalizedContent.trim() || context.paragraphs.length === 0) {
      return {
        chapterMeta: {
          chapterId: context.chapter.id,
          order: context.chapter.order,
          title: context.chapter.title?.trim() || "Capítulo sin título",
          wordCount: countEditorWords(context.normalizedContent),
          openIssueCount: context.openAuditIssues.length,
          styleSummary: context.styleSummary || null,
          updatedAt: context.chapter.updatedAt instanceof Date ? context.chapter.updatedAt.toISOString() : context.chapter.updatedAt,
        },
        macroContext: context.macroContext,
        diagnosticCards: [],
        recommendedTask: null,
        refreshReason: "El texto del capítulo actual está vacío. Primero complete el texto y luego use AI para generar sugerencias de revisión.",
      };
    }

    try {
      const result = await this.promptRunner({
        asset: chapterEditorWorkspaceDiagnosisPrompt,
        promptInput: {
          chapterTitle: `Cap. ${context.chapter.order} capítulo · ${context.chapter.title?.trim() || "Capítulo sin título"}`,
          chapterMission: context.macroContext.chapterMission,
          volumePositionLabel: context.macroContext.volumePositionLabel,
          volumePhaseLabel: context.macroContext.volumePhaseLabel,
          paceDirective: context.macroContext.paceDirective,
          previousChapterBridge: context.macroContext.previousChapterBridge,
          nextChapterBridge: context.macroContext.nextChapterBridge,
          activePlotThreads: context.macroContext.activePlotThreads,
          paragraphs: context.paragraphs.map((paragraph) => ({
            index: paragraph.index,
            text: trimPromptText(paragraph.text),
          })),
          openIssues: context.openAuditIssues.slice(0, 8).map((issue) => ({
            id: issue.id,
            severity: issue.severity,
            auditType: issue.auditType,
            code: issue.code,
            evidence: trimPromptText(issue.evidence, 180),
            fixSuggestion: trimPromptText(issue.fixSuggestion, 180),
          })),
        } satisfies ChapterEditorWorkspaceDiagnosisPromptInput,
        options: {
          provider: "deepseek",
          temperature: 0.4,
        },
      });

      const sourceIssueIds = new Set(context.openAuditIssues.map((issue) => issue.id));
      const diagnosticCards = result.output.cards.map((card) => mapDiagnosticCard(card, context.paragraphs, sourceIssueIds));
      const recommendedTask = mapRecommendedTask(result.output.recommendedTask, diagnosticCards, context.paragraphs);

      return {
        chapterMeta: {
          chapterId: context.chapter.id,
          order: context.chapter.order,
          title: context.chapter.title?.trim() || "Capítulo sin título",
          wordCount: countEditorWords(context.normalizedContent),
          openIssueCount: context.openAuditIssues.length,
          styleSummary: context.styleSummary || null,
          updatedAt: context.chapter.updatedAt instanceof Date ? context.chapter.updatedAt.toISOString() : context.chapter.updatedAt,
        },
        macroContext: context.macroContext,
        diagnosticCards,
        recommendedTask,
        refreshReason: "Las sugerencias de revisión se han generado en tiempo real en función del contenido de este capítulo, posicionamiento dentro del volumen y preguntas abiertas.",
      };
    } catch (error) {
      console.warn("Failed to generate chapter editor workspace diagnosis.", error);
      return {
        chapterMeta: {
          chapterId: context.chapter.id,
          order: context.chapter.order,
          title: context.chapter.title?.trim() || "Capítulo sin título",
          wordCount: countEditorWords(context.normalizedContent),
          openIssueCount: context.openAuditIssues.length,
          styleSummary: context.styleSummary || null,
          updatedAt: context.chapter.updatedAt instanceof Date ? context.chapter.updatedAt.toISOString() : context.chapter.updatedAt,
        },
        macroContext: context.macroContext,
        diagnosticCards: [],
        recommendedTask: null,
        refreshReason: "La IA aún no ha completado el diagnóstico de este capítulo. Aún puedes localizar manualmente el fragmento o decirle directamente a la IA cómo cambiarlo.",
      };
    }
  }
}
