import type { StepContext, StepHandler } from "../../application";

interface ContractChapter {id: string; chapterOrder: number; taskSheet?: string | null; sceneCards?: string | null}
interface DetailWorkspace {novelId: string; volumes: readonly {id: string; chapters: readonly ContractChapter[]}[]}
export interface ChapterQualityReport {
  chapterId: string; chapterOrder: number;
  result: {status: string; canEnterExecution: boolean; issues: readonly {id: string; summary: string}[]};
  assessment?: {recommendedHandling: string};
}
export interface ChapterIssueDecision {
  action: "continue_with_warning" | "local_patch_plan" | "stop_for_replan" | "pause_for_manual";
  reason: string;
}
export interface ChapterDetailBundleInput<Provider extends string, Document extends DetailWorkspace> {
  workspace: Document;
  targets: readonly {volumeId: string; chapterId: string}[];
  provider?: Provider; model?: string; temperature?: number; guidance?: string;
}
export interface ChapterDetailBundleDependencies<Provider extends string, Document extends DetailWorkspace> {
  inputProvider: (context: StepContext) => Promise<ChapterDetailBundleInput<Provider, Document>>;
  volumeService: {
    generateVolumes(novelId: string, options: {
      scope: "chapter_detail"; detailMode: "task_sheet"; targetVolumeId: string; targetChapterId: string;
      chapterTaskSheetQualityMode: "full_book_autopilot";
      forceRegenerate?: boolean;
      provider?: Provider; model?: string; temperature?: number; guidance?: string;
      draftWorkspace: Document; taskId: string; entrypoint: "director_next"; persistIntermediateDocuments: false;
      onChapterTaskSheetQuality: (event: ChapterQualityReport) => Promise<void>;
    }): Promise<Document>;
    updateVolumesWithOptions(novelId: string, document: Document, options: {
      emitEvent: false; syncPayoffLedger: false; syncToChapterExecution: false;
      volumeUpdateReason: "chapter_execution_contract_refined";
      memoryTelemetry: {taskId: string; stage: "structured_outline"; itemKey: "chapter_detail_bundle"; scope: "chapter_detail"; entrypoint: "director_next"};
    }): Promise<Document>;
  };
  // AI/runtime supplies the unified issue decision. No prose matching or implicit replan here.
  resolveIssues: (context: StepContext, reports: readonly ChapterQualityReport[]) => Promise<ChapterIssueDecision>;
  contentHash: (content: unknown) => string;
}

function getChapter(document: DetailWorkspace, novelId: string, target: {volumeId: string; chapterId: string}) {
  if (document.novelId !== novelId) throw new Error("El espacio de trabajo de refinamiento de capítulos no pertenece a la novela actual.");
  const chapter = document.volumes.find(volume => volume.id === target.volumeId)?.chapters.find(chapter => chapter.id === target.chapterId);
  if (!chapter) throw new Error("Faltan capítulos objetivo que deben perfeccionarse.");
  return chapter;
}
function requireSavedContract(chapter: ContractChapter) {
  if (!chapter.taskSheet?.trim() || !chapter.sceneCards?.trim()) throw new Error("El capítulo de destino no guarda la lista completa de tareas ni el plan de escena.");
}

export function createChapterDetailBundleStepHandler<Provider extends string, Document extends DetailWorkspace>(dependencies: ChapterDetailBundleDependencies<Provider, Document>): StepHandler {
  return async context => {
    const input = await dependencies.inputProvider(context);
    const novelId = context.contract.novelId;
    if (!input.targets.length) throw new Error("El rango de refinamiento del capítulo no puede estar vacío.");
    const seen = new Set<string>();
    for (const target of input.targets) {
      const chapter = getChapter(input.workspace, novelId, target);
      if (seen.has(target.chapterId)) throw new Error("Hay objetivos duplicados en el alcance de refinamiento del capítulo.");
      seen.add(target.chapterId);
      const range = context.contract.chapterRange;
      if (range && (chapter.chapterOrder < range.from || chapter.chapterOrder > range.to)) throw new Error("El capítulo objetivo está más allá del alcance de esta autorización.");
    }
    const reports: ChapterQualityReport[] = [];
    let draft = input.workspace;
    for (const target of input.targets) {
      const chapter = getChapter(draft, novelId, target);
      draft = await dependencies.volumeService.generateVolumes(novelId, {
        scope: "chapter_detail", detailMode: "task_sheet", targetVolumeId: target.volumeId, targetChapterId: target.chapterId,
        // Collect usable content independently from issue-policy decisions made below.
        chapterTaskSheetQualityMode: "full_book_autopilot", provider: input.provider, model: input.model,
        temperature: input.temperature, guidance: context.regeneration?.guidance ?? input.guidance, draftWorkspace: draft,
        forceRegenerate: Boolean(context.regeneration),
        taskId: context.runId, entrypoint: "director_next", persistIntermediateDocuments: false,
        onChapterTaskSheetQuality: async report => {
          if (report.chapterId !== target.chapterId || report.chapterOrder !== chapter.chapterOrder) throw new Error("Los resultados de calidad del capítulo no son consistentes con el capítulo objetivo.");
          if (!report.result.canEnterExecution) throw new Error("La estructura del Contrato de Ejecución del Capítulo no está disponible y no puede registrarse como producto terminado.");
          reports.push(report);
        },
      });
      const generatedChapter = getChapter(draft, novelId, target);
      if (generatedChapter.chapterOrder !== chapter.chapterOrder) throw new Error("El refinamiento de capítulos cambia el orden de los capítulos de destino.");
      requireSavedContract(generatedChapter);
    }
    const saved = await dependencies.volumeService.updateVolumesWithOptions(novelId, draft, {
      emitEvent: false, syncPayoffLedger: false, syncToChapterExecution: false, volumeUpdateReason: "chapter_execution_contract_refined",
      memoryTelemetry: {taskId: context.runId, stage: "structured_outline", itemKey: "chapter_detail_bundle", scope: "chapter_detail", entrypoint: "director_next"},
    });
    const chapters = input.targets.map(target => {
      const chapter = getChapter(saved, novelId, target);
      if (chapter.chapterOrder !== getChapter(input.workspace, novelId, target).chapterOrder) throw new Error("Al guardar los resultados se cambia el orden de los capítulos de destino.");
      requireSavedContract(chapter);
      return chapter;
    });
    const warnings = reports.filter(report => report.result.status !== "passed" || report.result.issues.length > 0);
    const decision = warnings.length ? await dependencies.resolveIssues(context, warnings) : null;
    if (decision && (!["continue_with_warning", "local_patch_plan", "stop_for_replan", "pause_for_manual"].includes(decision.action) || !decision.reason.trim())) throw new Error("Decisión de la pregunta del capítulo inválida.");
    const action = decision?.action === "pause_for_manual" && context.contract.issuePolicy.mode !== "quality_first"
      ? "continue_with_warning" : decision?.action ?? "continue_with_warning";
    const debts = warnings.flatMap(report => (report.result.issues.length ? report.result.issues : [{id: "chapter_contract_quality_warning", summary: ""}])
      .map(issue => ({chapterOrder: report.chapterOrder, code: issue.id, action})));
    const stopSignal = decision?.action === "stop_for_replan"
      ? {kind: "replan" as const, reason: decision.reason, action: "stop_for_replan" as const}
      : decision?.action === "pause_for_manual" && context.contract.issuePolicy.mode === "quality_first"
        ? {kind: "manual_recovery" as const, reason: decision.reason, action: "pause_for_manual" as const} : undefined;
    return {
      artifact: {scope: context.contract.scope, status: "draft", protectedUserContent: false,
        contentRef: `chapter_task_sheet:${novelId}:${context.contract.scope}`, contentHash: dependencies.contentHash(chapters)},
      debts, ...(stopSignal ? {stopSignal} : {}),
    };
  };
}
