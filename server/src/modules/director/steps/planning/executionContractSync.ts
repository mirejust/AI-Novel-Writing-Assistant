import type { StepContext, StepHandler, StepResult } from "../../application";
import { savedExecutionContract } from "../../domain";

interface PlannedContract {
  id: string; chapterId?: string | null; chapterOrder: number;
  taskSheet?: string | null; sceneCards?: string | null;
  targetWordCount?: number | null; conflictLevel?: number | null; revealLevel?: number | null; mustAvoid?: string | null;
}
interface ContractWorkspace {novelId: string; volumes: readonly {id: string; chapters: readonly PlannedContract[]}[]}
interface SavedChapter {
  id: string; novelId: string; order: number; content: string | null;
  taskSheet: string | null; sceneCards: string | null;
  targetWordCount?: number | null; conflictLevel?: number | null; revealLevel?: number | null; mustAvoid?: string | null;
}
export interface ExecutionContractSyncInput<Document extends ContractWorkspace> {
  workspace: Document;
  approvedPlanVersionId?: string;
  executionRange: {startOrder: number; endOrder: number};
}
export interface ExecutionContractSyncDependencies<Document extends ContractWorkspace> {
  inputProvider: (context: StepContext) => Promise<ExecutionContractSyncInput<Document>>;
  volumeService: {
    syncVolumeChaptersWithOptions(novelId: string, input: {
      volumes: Document["volumes"]; preserveContent: true; applyDeletes: false;
      allowIncompleteExecutionContracts: false;
      executionContractChapterRange: {startOrder: number; endOrder: number};
    }, options: {emitEvent: false; syncPayoffLedger: false; reviewedPlanVersionId?:string}): Promise<{clearContentCount: number; deleteCount: number}>;
  };
  chapterService: {listChapters(novelId: string): Promise<readonly SavedChapter[]>};
  contentHash: (content: unknown) => string;
}

function integrityStop(reason: string): StepResult {
  return {stopSignal: {kind: "data_integrity", reason}};
}

export function createExecutionContractSyncStepHandler<Document extends ContractWorkspace>(dependencies: ExecutionContractSyncDependencies<Document>): StepHandler {
  return async context => {
    const {workspace, executionRange, approvedPlanVersionId} = await dependencies.inputProvider(context);
    const novelId = context.contract.novelId;
    if (workspace.novelId !== novelId) throw new Error("El espacio de trabajo Contrato de ejecución no forma parte de la novela actual.");
    const {startOrder, endOrder} = executionRange;
    const authorized = context.contract.chapterRange;
    if (!Number.isSafeInteger(startOrder) || !Number.isSafeInteger(endOrder) || startOrder < 1 || endOrder < startOrder
      || (authorized && (startOrder < authorized.from || endOrder > authorized.to))) throw new Error("El alcance de sincronización del contrato de ejecución no es válido o excede el alcance autorizado.");
    const selected = workspace.volumes.flatMap(volume => volume.chapters)
      .filter(chapter => chapter.chapterOrder >= startOrder && chapter.chapterOrder <= endOrder)
      .sort((a,b) => a.chapterOrder-b.chapterOrder);
    if (selected.length !== endOrder-startOrder+1 || selected.some((chapter,index) => chapter.chapterOrder !== startOrder+index)) throw new Error("La ventana de ejecución carece de planificación de capítulos o tiene una secuencia repetitiva.");
    if (selected.some(chapter => !chapter.taskSheet?.trim() || !chapter.sceneCards?.trim())) throw new Error("La ventana de ejecución carece de órdenes de tareas preparadas y planes de escenarios.");
    const before = await dependencies.chapterService.listChapters(novelId);
    if (before.some(chapter => chapter.novelId !== novelId)) throw new Error("Los registros de capítulos antes de la sincronización no pertenecen a la novela actual.");
    // The existing service synchronizes the book's route metadata; this range limits execution-contract validation.
    const preview = await dependencies.volumeService.syncVolumeChaptersWithOptions(novelId, {
      volumes: workspace.volumes, preserveContent: true, applyDeletes: false,
      allowIncompleteExecutionContracts: false, executionContractChapterRange: executionRange,
    }, {emitEvent: false, syncPayoffLedger: false, ...(approvedPlanVersionId ? {reviewedPlanVersionId:approvedPlanVersionId} : {})});
    if (preview.clearContentCount !== 0 || preview.deleteCount !== 0) return integrityStop("Los resultados de la sincronización incluyen el borrado de texto o la eliminación de capítulos, por lo que debe verificar los resultados de guardado.");
    const saved = await dependencies.chapterService.listChapters(novelId);
    if (saved.some(chapter => chapter.novelId !== novelId)) return integrityStop("Los registros de capítulos sincronizados no pertenecen a la novela actual.");
    if (before.some(chapter => {
      const next = saved.find(row => row.id === chapter.id);
      return !next || next.content !== chapter.content;
    })) return integrityStop("La ejecución de la sincronización del contrato no conserva los capítulos ni el texto existentes, por lo que es necesario comprobar la integridad de los datos.");
    const contracts = [];
    for (const plan of selected) {
      const rows = saved.filter(chapter => chapter.order === plan.chapterOrder);
      const chapter = rows[0];
      if (rows.length !== 1 || !chapter || (plan.chapterId && chapter.id !== plan.chapterId)
        || chapter.taskSheet?.trim() !== plan.taskSheet?.trim() || chapter.sceneCards?.trim() !== plan.sceneCards?.trim()) {
        return integrityStop("Los contratos de ejecución del capítulo de destino no se guardan correctamente o no son coherentes con la planificación.");
      }
      for (const key of ["targetWordCount", "conflictLevel", "revealLevel", "mustAvoid"] as const) {
        if (plan[key] !== undefined && (chapter[key] ?? null) !== (plan[key] ?? null)) return integrityStop("Los parámetros de ejecución del capítulo de destino no son consistentes con el plan guardado.");
      }
      contracts.push(savedExecutionContract(chapter));
    }
    return {artifact: {scope: context.contract.scope, status: approvedPlanVersionId ? "confirmed" : "draft", protectedUserContent: false,
      contentRef: `chapter_execution_contract:${novelId}:${context.contract.scope}:${startOrder}-${endOrder}`,
      contentHash: dependencies.contentHash(contracts)}};
  };
}
