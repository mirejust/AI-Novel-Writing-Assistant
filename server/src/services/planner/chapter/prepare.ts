import { buildStateContextBlockFromCanonical } from "../../novel/state/CanonicalStateService";
import { mapRowToPlan } from "../../novel/storyMacro/storyMacroPlanPersistence";
import { buildDefaultPlanMetadata } from "../plannerPlanMetadata";
import { buildChapterPlanContextBlocks } from "../plannerContextBlocks";
import { buildCurrentVolumeWindowSummary,buildPlannerConflictLevelAnchorContext,buildPlannerCharacterDynamicsContext,buildPlannerPayoffLedgerContext,buildPlannerStoryModeBlock,buildStoryMacroSummary,type PlannerMappedVolume } from "../plannerContextHelpers";
import { buildPlannerStateDrivenDirective,buildPlannerStateGoalText } from "../plannerStateDirectives";
import { buildPlannerPromptRequest } from "../plannerLlm";
import { readChapterPlanInputs } from "./readInputs";
import type { ChapterPlanPreparationDependencies,GenerateChapterPlanOptions } from "./types";

/** Read-only native source assembly. Caller owns dispatch and persistence. */
export async function prepareChapterPlan(novelId: string, chapterId: string, options: GenerateChapterPlanOptions, deps: ChapterPlanPreparationDependencies) {
  const {novel,chapter,bible,plotBeats,summaries,characters: rawCharacters,bookPlan,arcPlans,volumePlans,recentAuditReports,recentDecisions,storyMacroPlanRow,styleEngine,pendingReviewProposalCount}=await readChapterPlanInputs(novelId,chapterId,options,deps);
  const storyModeBlock = buildPlannerStoryModeBlock(novel);
  const storyMacroPlan = storyMacroPlanRow ? mapRowToPlan(storyMacroPlanRow) : null;
  const payoffLedger = await deps.readPayoff(novelId, {
    chapterOrder: chapter.order,
  }).catch(error => { if (deps.strictSources) throw error; return {
    summary: {
      totalCount: 0,
      pendingCount: 0,
      urgentCount: 0,
      overdueCount: 0,
      paidOffCount: 0,
      failedCount: 0,
      updatedAt: null,
    },
    items: [],
    updatedAt: null,
  }; });
  const characterDynamicsOverview = await deps.readDynamics(novelId, {
    chapterOrder: chapter.order,
  }).catch(error => { if (deps.strictSources) throw error; return null; });
  const characterDynamicsContext = buildPlannerCharacterDynamicsContext(characterDynamicsOverview);
  const mappedVolumes = volumePlans.map((volume) => ({
    id: volume.id,
    novelId,
    sortOrder: volume.sortOrder,
    title: volume.title,
    summary: volume.summary,
    mainPromise: volume.mainPromise,
    escalationMode: volume.escalationMode,
    protagonistChange: volume.protagonistChange,
    climax: volume.climax,
    nextVolumeHook: volume.nextVolumeHook,
    resetPoint: volume.resetPoint,
    openPayoffs: volume.openPayoffsJson ? JSON.parse(volume.openPayoffsJson) as string[] : [],
    status: volume.status,
    sourceVersionId: volume.sourceVersionId,
    chapters: volume.chapters.map((item) => ({
      id: item.id,
      volumeId: item.volumeId,
      chapterOrder: item.chapterOrder,
      title: item.title,
      summary: item.summary,
      purpose: item.purpose,
      conflictLevel: item.conflictLevel,
      conflictLevelSource: item.conflictLevelSource === "user"
        ? "user" as const
        : item.conflictLevelSource === "ai"
          ? "ai" as const
          : null,
      revealLevel: item.revealLevel,
      targetWordCount: item.targetWordCount,
      mustAvoid: item.mustAvoid,
      taskSheet: item.taskSheet,
      payoffRefs: item.payoffRefsJson ? JSON.parse(item.payoffRefsJson) as string[] : [],
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    })),
    createdAt: volume.createdAt.toISOString(),
    updatedAt: volume.updatedAt.toISOString(),
  }));
  const plannerVolumes: PlannerMappedVolume[] = mappedVolumes.map((volume) => ({
    sortOrder: volume.sortOrder,
    title: volume.title,
    summary: volume.summary,
    mainPromise: volume.mainPromise,
    climax: volume.climax,
    openPayoffs: volume.openPayoffs,
    updatedAt: volume.updatedAt,
    chapters: volume.chapters.map((item) => ({
      chapterOrder: item.chapterOrder,
      title: item.title,
      summary: item.summary,
      conflictLevel: item.conflictLevel,
      conflictLevelSource: item.conflictLevelSource,
    })),
  }));
  const anchoredVolumeChapter = mappedVolumes
    .flatMap((volume) => volume.chapters)
    .find((item) => item.chapterOrder === chapter.order && item.conflictLevelSource === "user");
  const defaultMetadata = buildDefaultPlanMetadata("chapter", {
    chapterOrder: chapter.order,
    totalChapters: novel.estimatedChapterCount ?? null,
    expectation: chapter.expectation ?? null,
  });
  const openAuditIssues = recentAuditReports.flatMap((report) => report.issues.map((issue) => (
    `${issue.auditType}/${issue.severity}: ${issue.description} | Evidencia =${issue.evidence}`
  )));
  const resolvedStateDrivenContext = await deps.buildStateContext({
    novelId,
    chapterId,
    chapterOrder: chapter.order,
    includeCurrentChapterState: false,
    policy: {
      kickoffMode: "manual_start",
      advanceMode: options.replanContext ? "stage_review" : "manual",
    },
    pendingReviewProposalCount,
    openAuditIssueCount: openAuditIssues.length,
    hasRepairableDraft: Boolean(chapter.content?.trim()),
  });
  const adjustedFields = new Map(resolvedStateDrivenContext.snapshot.characters?.flatMap(item => (
    item.forwardAdjustment ? [[item.characterId, item.forwardAdjustment] as const] : []
  )));
  const characters = rawCharacters.map(item => ({ ...item, ...adjustedFields.get(item.id) }));
  const chapterSummaries = adjustedFields.size ? await deps.db.chapterSummary.findMany({
    where: { novelId, chapter: { order: { lt: chapter.order } } },
    orderBy: { chapter: { order: "desc" } }, take: 4,
  }) : summaries;
  const plannerStateGoalText = buildPlannerStateGoalText({
    summary: resolvedStateDrivenContext.chapterStateGoal?.summary ?? null,
    targetConflicts: resolvedStateDrivenContext.chapterStateGoal?.targetConflicts ?? [],
    targetRelationships: resolvedStateDrivenContext.chapterStateGoal?.targetRelationships ?? [],
    targetPayoffs: resolvedStateDrivenContext.chapterStateGoal?.targetPayoffs ?? [],
    protectedSecrets: resolvedStateDrivenContext.protectedSecrets,
    recentTimeline: resolvedStateDrivenContext.recentTimeline.map((item) => item.summary),
  });
  const replanContextBlock = options.replanContext
    ? [
        `Razones para la replanificación:${options.replanContext.reason}`,
        `Tipo de disparador:${options.replanContext.triggerType}`,
        options.replanContext.triggerReason
          ? `Motivo del activador de estado:${options.replanContext.triggerReason}`
          : "",
        options.replanContext.windowReason
          ? `Razones para seleccionar la ventana:${options.replanContext.windowReason}`
          : "",
        options.replanContext.whyTheseChapters
          ? `¿Por qué cambiar estos capítulos?${options.replanContext.whyTheseChapters}`
          : "",
        `Ventana de replanificación: No. ${options.replanContext.affectedChapterOrders.join(",")}`,
        typeof options.replanContext.anchorChapterOrder === "number"
          ? `Capítulo ancla: Capítulo ${options.replanContext.anchorChapterOrder}`
          : "",
        options.replanContext.sourceIssueIds.length > 0
          ? `Pregunta fuente:${options.replanContext.sourceIssueIds.join(",")}`
          : "",
        options.replanContext.blockingLedgerKeys?.length
          ? `Riesgo de libro mayor:${options.replanContext.blockingLedgerKeys.join(",")}`
          : "",
        options.replanContext.replannedFromPlanId
          ? `Versión anterior del plan:${options.replanContext.replannedFromPlanId}`
          : "",
      ].filter(Boolean).join("\n")
    : "Ninguno";
  const contextBlocks = buildChapterPlanContextBlocks({
    novelTitle: novel.title,
    description: novel.description,
    genreName: novel.genre?.name ?? null,
    targetAudience: novel.targetAudience,
    bookSellingPoint: novel.bookSellingPoint,
    competingFeel: novel.competingFeel,
    first30ChapterPromise: novel.first30ChapterPromise,
    narrativePov: novel.narrativePov,
    pacePreference: novel.pacePreference,
    emotionIntensity: novel.emotionIntensity,
    styleTone: novel.styleTone,
    chapterExpectation: chapter.expectation,
    chapterTaskSheet: chapter.taskSheet,
    chapterTargetWordCount: chapter.targetWordCount,
    bible: bible?.rawContent ?? "Ninguno",
    styleEngine,
    outline: novel.outline,
    structuredOutline: novel.structuredOutline,
    mappedVolumes: plannerVolumes.map((volume) => ({
      sortOrder: volume.sortOrder,
      title: volume.title,
      summary: volume.summary,
      mainPromise: volume.mainPromise,
      climax: volume.climax,
      updatedAt: volume.updatedAt,
      chapters: volume.chapters,
    })),
    bookPlan: bookPlan ? `${bookPlan.title} | ${bookPlan.objective}${bookPlan.phaseLabel ? ` | etapa =${bookPlan.phaseLabel}` : ""}` : "Ninguno",
    arcPlans: arcPlans.length > 0
      ? arcPlans.map((plan) => `${plan.externalRef ?? "-"} ${plan.title} | ${plan.objective}${plan.phaseLabel ? ` | etapa =${plan.phaseLabel}` : ""}`).join("\n")
      : "Ninguno",
    characters: characters.map((item) => [
      `${item.id}|${item.name}|${item.role}|goal=${item.currentGoal ?? ""}|state=${item.currentState ?? ""}`,
      item.development ? `Dirección de crecimiento =${item.development.slice(0, 480)}` : "",
    ].filter(Boolean).join("|")).join("\n") || "Ninguno",
    recentSummaries: chapterSummaries.map((item) => `${item.summary}`).join("\n") || "Ninguno",
    plotBeats: plotBeats.map((item) => `${item.chapterOrder ?? "-"} ${item.title} ${item.content}`).join("\n") || "Ninguno",
    stateSnapshot: buildStateContextBlockFromCanonical(resolvedStateDrivenContext.snapshot),
    openAuditIssues: openAuditIssues.join("\n") || "Ninguno",
    recentDecisions: recentDecisions.map((item) => `${item.category}/${item.importance}: ${item.content}`).join("\n") || "Ninguno",
    characterDynamicsSummary: characterDynamicsContext.summary,
    characterVolumeAssignments: characterDynamicsContext.volumeAssignments,
    characterRelationStages: characterDynamicsContext.relationStages,
    characterCandidateGuards: characterDynamicsContext.candidateGuards,
    stateDrivenDirective: buildPlannerStateDrivenDirective({
      nextAction: resolvedStateDrivenContext.nextAction,
      pendingReviewProposalCount,
      openAuditIssueCount: openAuditIssues.length,
    }),
    stateDrivenGoal: plannerStateGoalText,
    defaultMetadata: [
      `planRole=${defaultMetadata.planRole ?? "progress"} | phase=${defaultMetadata.phaseLabel ?? "Ninguno"}`,
      `mustAdvance=${defaultMetadata.mustAdvance.join(";") || "Ninguno"}`,
      `mustPreserve=${defaultMetadata.mustPreserve.join(";") || "Ninguno"}`,
    ].join("\n"),
    replanContext: replanContextBlock,
    replanConflictLevelAnchors: options.replanContext
      ? buildPlannerConflictLevelAnchorContext(plannerVolumes, options.replanContext.affectedChapterOrders)
      : "Ninguno",
    storyMacroSummary: buildStoryMacroSummary(storyMacroPlan),
    currentVolumeWindow: buildCurrentVolumeWindowSummary(plannerVolumes, chapter.order),
    payoffLedgerSummary: buildPlannerPayoffLedgerContext(payoffLedger, chapter.order),
    storyModeBlock,
  });

  return {request:buildPlannerPromptRequest({options,scopeLabel:`Plan del Capítulo: Capítulo${chapter.order}capítulo"${chapter.title}»`,novelId,chapterId,planLevel:"chapter",contextBlocks}),
    projection:{novelId,chapter:{...chapter,updatedAt:chapter.updatedAt.toISOString()},defaultMetadata,characters,characterDynamicsOverview,resolvedStateDrivenContext,anchoredVolumeChapter:anchoredVolumeChapter ?? null,replanContext:options.replanContext,
      ...(options.preserveExecutionContract ? {preserveExecutionContract: true} : {})}};
}
export type PreparedChapterPlan=Awaited<ReturnType<typeof prepareChapterPlan>>;
