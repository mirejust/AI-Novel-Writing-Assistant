import type { StepContext, StepHandler } from "../../application";
import type { VolumeChapterListProgress } from "@ai-novel/shared/types/volumePlanning";

interface ChapterListWorkspace {
  novelId: string;
  volumes: readonly {id: string; status: string; chapters: readonly unknown[]}[];
  beatSheets: readonly {volumeId: string; beats: readonly unknown[]}[];
}
export interface VolumeChapterListStepInput<Provider extends string, Document extends ChapterListWorkspace> {
  workspace: Document;
  targetVolumeId: string;
  provider?: Provider;
  model?: string;
  temperature?: number;
  guidance?: string;
  estimatedChapterCount?: number;
}
export interface VolumeChapterListStepDependencies<Provider extends string, Document extends ChapterListWorkspace> {
  inputProvider: (context: StepContext) => Promise<VolumeChapterListStepInput<Provider, Document>>;
  onProgress?: (context: StepContext, progress: VolumeChapterListProgress) => Promise<void>;
  volumeService: {
    generateVolumes(novelId: string, options: {
      scope: "chapter_list"; generationMode: "full_volume"; targetVolumeId: string; draftWorkspace: Document;
      provider?: Provider; model?: string; temperature?: number; guidance?: string; estimatedChapterCount?: number;
      taskId: string; entrypoint: "director_next"; persistIntermediateDocuments: true;
      onPhaseStart?: (event: {chapterProgress?: VolumeChapterListProgress}) => Promise<void>;
      onChapterTitleDiversityDebt?: (event: {volumeId: string; issue: string; chapterOrder: number}) => void;
    }): Promise<Document>;
    updateVolumesWithOptions(novelId: string, document: Document, options: {
      emitEvent: false; syncPayoffLedger: false; syncToChapterExecution: false;
      memoryTelemetry: {taskId: string; stage: "structured_outline"; itemKey: "chapter_list"; scope: "chapter_list"; entrypoint: "director_next"; volumeId: string};
    }): Promise<Document>;
  };
  contentHash: (content: unknown) => string;
}

/** Saved service status describes completeness; it is not a story-quality decision. */
export function isSavedVolumeChapterListComplete(volume: {status: string; chapters: readonly unknown[]}): boolean {
  const status = volume.status.trim();
  return volume.chapters.length > 0 && status !== "chapter_list_partial" && !status.startsWith("chapter_list_partial:");
}

function requireCompleteList(document: ChapterListWorkspace, novelId: string, volumeId: string) {
  if (document.novelId !== novelId) throw new Error("El espacio de trabajo de división de capítulos no pertenece a la novela actual.");
  const volume = document.volumes.find(row => row.id === volumeId);
  if (!volume || volume.chapters.length === 0) throw new Error("No hay una lista de capítulos disponible para el volumen de destino.");
  if (!isSavedVolumeChapterListComplete(volume)) {
    throw new Error("La lista de capítulos del volumen de destino no se ha guardado por completo y no se puede registrar como un producto completo.");
  }
  return volume.chapters;
}

export function createVolumeChapterListStepHandler<Provider extends string, Document extends ChapterListWorkspace>(dependencies: VolumeChapterListStepDependencies<Provider, Document>): StepHandler {
  return async context => {
    const input = await dependencies.inputProvider(context);
    const novelId = context.contract.novelId;
    if (input.workspace.novelId !== novelId) throw new Error("El espacio de trabajo de división de capítulos no pertenece a la novela actual.");
    if (!input.workspace.volumes.some(volume => volume.id === input.targetVolumeId)) throw new Error("Falta el volumen de destino que se va a abrir.");
    if (!input.workspace.beatSheets.some(sheet => sheet.volumeId === input.targetVolumeId && sheet.beats.length > 0)) {
      throw new Error("Al volumen de destino le falta un tablero de ritmo y no puede generar una lista de capítulos.");
    }
    const titleDiversityDebts: {chapterOrder: number; code: string; action: string}[] = [];
    const generated = await dependencies.volumeService.generateVolumes(novelId, {
      scope: "chapter_list", generationMode: "full_volume", targetVolumeId: input.targetVolumeId,
      draftWorkspace: input.workspace, provider: input.provider, model: input.model,
      temperature: input.temperature, guidance: input.guidance, estimatedChapterCount: input.estimatedChapterCount,
      taskId: context.runId, entrypoint: "director_next", persistIntermediateDocuments: true,
      onPhaseStart: async event => {
        if (event.chapterProgress) await dependencies.onProgress?.(context, event.chapterProgress);
      },
      onChapterTitleDiversityDebt: event => {
        titleDiversityDebts.push({
          chapterOrder: event.chapterOrder,
          code: "CHAPTER_TITLE_DIVERSITY",
          action: "continue_with_warning",
        });
      },
    });
    requireCompleteList(generated, novelId, input.targetVolumeId);
    const saved = await dependencies.volumeService.updateVolumesWithOptions(novelId, generated, {
      emitEvent: false, syncPayoffLedger: false, syncToChapterExecution: false,
      memoryTelemetry: {
        taskId: context.runId, stage: "structured_outline", itemKey: "chapter_list", scope: "chapter_list",
        entrypoint: "director_next", volumeId: input.targetVolumeId,
      },
    });
    const chapters = requireCompleteList(saved, novelId, input.targetVolumeId);
    return {artifact: {
      scope: context.contract.scope, status: "draft", protectedUserContent: false,
      contentRef: `volume_chapter_list:${novelId}:${input.targetVolumeId}`,
      contentHash: dependencies.contentHash(chapters),
    }, ...(titleDiversityDebts.length > 0 ? {debts: titleDiversityDebts} : {})};
  };
}
