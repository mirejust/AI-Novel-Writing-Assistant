import { DirectorTaskStateWriter } from "../state";
import type { DirectorConfirmRequest } from "@ai-novel/shared/types/novelDirector";
import { buildNovelEditResumeTarget } from "../../workflow/novelWorkflow.shared";
import { getChapterTitleDiversityIssue } from "../../volume/chapterTitleDiversity";
import { resolveVolumeChapterBeatKey } from "../../volume/volumeGenerationHelpers";
import type { NovelVolumeService } from "../../volume/NovelVolumeService";
import type { NovelWorkflowService } from "../../workflow/NovelWorkflowService";
import { buildDirectorSessionState } from "../runtime/novelDirectorHelpers";
import { DIRECTOR_PROGRESS } from "../projections/novelDirectorProgress";
import { buildChapterTitleDiversityTaskNotice } from "../projections/novelDirectorTaskNotice";

function buildRepairStatusLabel(input: {
  volumeOrder: number;
  phase: string;
  label: string;
}): string {
  const normalizedLabel = input.label.trim();
  if (normalizedLabel) {
    return normalizedLabel;
  }
  if (input.phase === "load_context") {
    return `organizando la primera ${input.volumeOrder} Contexto del capítulo`;
  }
  return `La IA está reparando el Capítulo 1 ${input.volumeOrder} Título del capítulo del volumen`;
}

function shouldRefreshBeatSheetForRepair(lastError: string | null | undefined): boolean {
  const normalized = lastError?.trim() ?? "";
  return normalized.includes("La duración de capítulos del tablero de ritmo del volumen actual es anormal.");
}

function resolveRepairBeatKeys(input: {
  volume: Awaited<ReturnType<NovelVolumeService["getVolumes"]>>["volumes"][number];
  beatSheet: Awaited<ReturnType<NovelVolumeService["getVolumes"]>>["beatSheets"][number];
}): string[] {
  const seenTitles = new Set<string>();
  const repairBeatKeys = new Set<string>();
  for (const chapter of input.volume.chapters.slice().sort((left, right) => left.chapterOrder - right.chapterOrder)) {
    const title = chapter.title.trim();
    const beatKey = resolveVolumeChapterBeatKey({ chapter, volume: input.volume, beatSheet: input.beatSheet });
    if (seenTitles.has(title) && beatKey) {
      repairBeatKeys.add(beatKey);
    }
    seenTitles.add(title);
  }
  return repairBeatKeys.size > 0 ? [...repairBeatKeys] : input.beatSheet.beats.map((beat) => beat.key);
}

async function loadWorkflowTaskForTitleRepair(
  workflowService: NovelWorkflowService,
  taskId: string,
): Promise<Awaited<ReturnType<NovelWorkflowService["getTaskByIdWithoutHealing"]>> | null> {
  const reader = workflowService as Partial<Pick<NovelWorkflowService, "getTaskByIdWithoutHealing" | "getTaskById">>;
  if (typeof reader.getTaskByIdWithoutHealing === "function") {
    return reader.getTaskByIdWithoutHealing(taskId);
  }
  if (typeof reader.getTaskById === "function") {
    return reader.getTaskById(taskId);
  }
  return null;
}

export async function repairDirectorChapterTitles(input: {
  taskId: string;
  novelId: string;
  targetVolumeId: string;
  request: DirectorConfirmRequest;
  volumeService: NovelVolumeService;
  workflowService: NovelWorkflowService;
  buildDirectorSeedPayload: (
    request: DirectorConfirmRequest,
    novelId: string,
    extra?: Record<string, unknown>,
  ) => Record<string, unknown>;
}): Promise<void> {
  const currentWorkspace = await input.volumeService.getVolumes(input.novelId);
  const targetVolume = currentWorkspace.volumes.find((volume) => volume.id === input.targetVolumeId);
  if (!targetVolume) {
    throw new Error("El volumen objetivo correspondiente a la tarea actual no existe y no se puede continuar con el título del capítulo de reparación de IA.");
  }

  const resumeTarget = buildNovelEditResumeTarget({
    novelId: input.novelId,
    taskId: input.taskId,
    stage: "structured",
    volumeId: targetVolume.id,
  });
  const currentTask = await loadWorkflowTaskForTitleRepair(input.workflowService, input.taskId);
  let workingWorkspace = currentWorkspace;
  const hasTargetBeatSheet = workingWorkspace.beatSheets.some((sheet) => (
    sheet.volumeId === targetVolume.id && sheet.beats.length > 0
  ));
  if (shouldRefreshBeatSheetForRepair(currentTask?.lastError) || !hasTargetBeatSheet) {
    workingWorkspace = await input.volumeService.generateVolumes(input.novelId, {
      provider: input.request.provider,
      model: input.request.model,
      temperature: input.request.temperature,
      scope: "beat_sheet",
      targetVolumeId: targetVolume.id,
      draftWorkspace: workingWorkspace,
      onPhaseStart: async (event) => {
        await new DirectorTaskStateWriter(input.workflowService).markRunning(input.taskId, {
          stage: "structured_outline",
          itemKey: "beat_sheet",
          itemLabel: event.label.trim() || `Reorganizando ${targetVolume.sortOrder} tablero de ritmo rodante`,
          progress: DIRECTOR_PROGRESS.beatSheet,
        });
      },
    });
  }

  const targetBeatSheet = workingWorkspace.beatSheets.find((sheet) => (
    sheet.volumeId === targetVolume.id && sheet.beats.length > 0
  ));
  if (!targetBeatSheet) {
    throw new Error("El volumen actual carece de una placa rítmica utilizable y no puede reescribir los títulos de los capítulos de forma segura.");
  }

  const repairBeatKeys = resolveRepairBeatKeys({
    volume: targetVolume,
    beatSheet: targetBeatSheet,
  });
  for (const beat of targetBeatSheet.beats.filter((item) => repairBeatKeys.includes(item.key))) {
    workingWorkspace = await input.volumeService.generateVolumes(input.novelId, {
      provider: input.request.provider,
      model: input.request.model,
      temperature: input.request.temperature,
      scope: "chapter_list",
      generationMode: "single_beat",
      targetBeatKey: beat.key,
      targetVolumeId: targetVolume.id,
      draftWorkspace: workingWorkspace,
      onPhaseStart: async (event) => {
        await new DirectorTaskStateWriter(input.workflowService).markRunning(input.taskId, {
          stage: "structured_outline",
          itemKey: "chapter_list",
          itemLabel: buildRepairStatusLabel({
            volumeOrder: targetVolume.sortOrder,
            phase: event.phase,
            label: event.label,
          }),
          progress: DIRECTOR_PROGRESS.chapterList,
        });
      },
    });
  }
  const persistedWorkspace = await input.volumeService.updateVolumes(input.novelId, {
    ...workingWorkspace,
    syncToChapterExecution: true,
  });
  const repairedVolume = persistedWorkspace.volumes.find((volume) => volume.id === targetVolume.id);
  if (!repairedVolume) {
    throw new Error("La IA ha devuelto resultados de títulos de nuevos capítulos, pero el volumen actual después de guardar se pierde y la reparación no se puede completar.");
  }

  const titleDiversityIssue = getChapterTitleDiversityIssue(
    repairedVolume.chapters.map((chapter) => chapter.title),
  );
  const pausedSession = buildDirectorSessionState({
    runMode: input.request.runMode,
    phase: "structured_outline",
    isBackgroundRunning: false,
  });
  const directorTaskData = input.buildDirectorSeedPayload(input.request, input.novelId, {
    directorSession: pausedSession,
    resumeTarget,
    taskNotice: titleDiversityIssue
      ? buildChapterTitleDiversityTaskNotice({
        issue: titleDiversityIssue,
        volumeId: repairedVolume.id,
      })
      : null,
  });
  const stateWriter = new DirectorTaskStateWriter(input.workflowService);
  await stateWriter.updateDirectorRunStateFromTaskData(input.taskId, directorTaskData);
  await stateWriter.markWaitingCheckpoint(input.taskId, {
    stage: "structured_outline",
    itemKey: "chapter_list",
    itemLabel: titleDiversityIssue
      ? `Cap. ${repairedVolume.sortOrder} Se han reescrito los títulos de los capítulos del volumen, pero aún se recomienda que la estructura permanezca fragmentada.`
      : `Cap. ${repairedVolume.sortOrder} Se han realizado correcciones de IA en los títulos de los capítulos de volumen`,
    progress: DIRECTOR_PROGRESS.chapterList,
    volumeId: repairedVolume.id,
    clearCheckpoint: true,
  });
}
