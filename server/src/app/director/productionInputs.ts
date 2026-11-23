import { currentOutlinePlanning } from "../../modules/planning/outline/constraints";
import { prisma } from "../../db/prisma";
import type { StepContext, RunContract } from "../../modules/director";
import { StoryMacroPlanService } from "../../services/novel/storyMacro/StoryMacroPlanService";
import type { DirectorBookContractPromptInput } from "../../prompting/prompts/novel/directorPlanning.prompts";
import type { VolumeChapterPlan, VolumePlanDocument } from "@ai-novel/shared/types/novel";
import {directorChapterTokenLimitSchema} from "@ai-novel/shared/types/director/chapterBudget";
import { AppError } from "../../middleware/errorHandler";
import {directorVolumeChapterPlanFilter} from "./planning";

export function requireLaunch(contract: RunContract) {
  const input = contract.launchInput;
  if (!input?.storyInput.trim() || !Number.isSafeInteger(input.estimatedChapterCount) || input.estimatedChapterCount < 1
    || !contract.modelConfig.route.trim() || contract.modelConfig.route === "default"
    || !contract.modelConfig.model.trim() || contract.modelConfig.model === "default") throw new Error("Al proceso de creación le faltan historias, capítulos o instantáneas de modelos.");
  if (contract.chapterRange && (contract.chapterRange.from < 1 || contract.chapterRange.to < contract.chapterRange.from
    || contract.chapterRange.to > input.estimatedChapterCount)) throw new Error("El alcance autorizado del texto principal no coincide con el número de capítulos previsto.");
  if (input.chapterTokenLimit !== undefined) directorChapterTokenLimitSchema.parse(input.chapterTokenLimit);
  return input;
}
export function modelOptions(context: StepContext) {
  const input = requireLaunch(context.contract);
  return {provider: context.contract.modelConfig.route, model: context.contract.modelConfig.model, temperature: input.temperature};
}
export async function bookContractInput(context: StepContext, macroService: StoryMacroPlanService): Promise<DirectorBookContractPromptInput> {
  const input = requireLaunch(context.contract);
  const novel = await prisma.novel.findUniqueOrThrow({where: {id: context.contract.novelId}});
  const macro = await macroService.getPlan(novel.id);
  if (!macro?.decomposition) throw new Error("Falta el plan macro de la historia guardada.");
  const decomposition = macro.decomposition;
  return {idea: input.storyInput, targetChapterCount: input.estimatedChapterCount, storyMacroPlan: macro,
    context: {title: novel.title, description: novel.description ?? undefined, targetAudience: novel.targetAudience ?? undefined,
      bookSellingPoint: novel.bookSellingPoint ?? undefined, genreId: novel.genreId ?? undefined, estimatedChapterCount: input.estimatedChapterCount},
    // Only project already-structured story output. No legacy task seed or invented creative judgment.
    candidate: {id: novel.id, workingTitle: novel.title, logline: input.storyInput, positioning: novel.targetAudience ?? "",
      sellingPoint: decomposition.selling_point, coreConflict: decomposition.core_conflict, protagonistPath: decomposition.growth_path,
      endingDirection: decomposition.ending_flavor, hookStrategy: decomposition.main_hook, progressionLoop: decomposition.progression_loop,
      whyItFits: "", toneKeywords: [], targetChapterCount: input.estimatedChapterCount}};
}

export function findTargetVolume(context: Pick<StepContext,"contract">, workspace: VolumePlanDocument): string | null {
  const input = requireLaunch(context.contract);
  if (input.targetVolumeId) {
    if (!workspace.volumes.some(volume => volume.id === input.targetVolumeId)) throw new Error("El volumen especificado no pertenece a la novela actual.");
    return input.targetVolumeId;
  }
  if (input.targetMode !== "opening") throw new Error("Iniciar una composición requiere una elección explícita del capítulo inicial o del volumen objetivo.");
  const from = context.contract.chapterRange?.from ?? (input.outlineBinding ? 1 : undefined);
  const state = currentOutlinePlanning();
  const slot = state && [...state.mapping.volumes, ...(state.mapping.runtimeVolumes ?? [])].find(s => from != null && from >= s.from && from <= s.to);
  if (slot) return slot.volumeId;
  const match = from ? workspace.volumes.find(volume => volume.chapters.some(chapter => chapter.chapterOrder === from)) : null;
  if (match) return match.id;
  // Fresh book opening follows the explicit sort order produced by the AI volume strategy.
  if (from == null || from === 1) {
    const opening = [...workspace.volumes].sort((a,b) => a.sortOrder-b.sortOrder)[0];
    if (opening) return opening.id;
  }
  return null;
}

export function targetVolume(context: Pick<StepContext,"contract">, workspace: VolumePlanDocument): string {
  const target = findTargetVolume(context, workspace);
  if (!target) throw new Error("El capítulo autorizado aún no se ha asignado al volumen; primero prepare la ruta del volumen de destino.");
  return target;
}
export function executionWindow(context: StepContext, workspace: VolumePlanDocument) {
  const range = context.contract.chapterRange;
  if (!range) throw new AppError("La preparación del texto principal requiere aclarar el alcance de la autoridad del capítulo.", 400);
  if (!Number.isSafeInteger(range.from) || !Number.isSafeInteger(range.to) || range.from < 1 || range.to < range.from) throw new AppError("El alcance de la autorización del capítulo no es válido.", 422);
  const matches = workspace.volumes.flatMap(volume => volume.chapters.filter(chapter => chapter.chapterOrder >= range.from && chapter.chapterOrder <= range.to)
    .map(chapter => ({volumeId: volume.id, chapterId: chapter.id, chapterOrder: chapter.chapterOrder})));
  const expected = range.to - range.from + 1;
  if (matches.length !== expected || new Set(matches.map(match => match.chapterOrder)).size !== expected) throw new AppError("Al alcance de la autoridad le falta una ruta de capítulo única.", 422);
  matches.sort((a, b) => a.chapterOrder - b.chapterOrder);
  return {targets: matches.map(({volumeId, chapterId}) => ({volumeId, chapterId})), executionRange: {startOrder: range.from, endOrder: range.to}};
}

type SavedChapterPlanFields = Pick<VolumeChapterPlan, "id" | "volumeId" | "chapterOrder" | "taskSheet" | "sceneCards" | "targetWordCount" | "mustAvoid">;

/** Use saved task and scene fields for one chapter, retaining the rest of the version. */
export function applySavedChapterPlanFields(workspace: VolumePlanDocument, saved: SavedChapterPlanFields): VolumePlanDocument {
  const {id, volumeId, chapterOrder, taskSheet, sceneCards, targetWordCount, mustAvoid} = saved;
  return {...workspace, volumes: workspace.volumes.map(volume => volume.id !== volumeId ? volume : {
    ...volume, chapters: volume.chapters.map(chapter => chapter.id === id && chapter.chapterOrder === chapterOrder
      ? {...chapter, taskSheet, sceneCards, targetWordCount, mustAvoid} : chapter),
  })};
}

export async function readExecutionWindow(context: StepContext, workspace: VolumePlanDocument) {
  const {targets, executionRange} = executionWindow(context, workspace);
  const {novelId, launchInput} = context.contract;
  const orders = new Map(workspace.volumes.flatMap(volume => volume.chapters.map(chapter => [chapter.id, chapter.chapterOrder] as const)));
  const rows = await prisma.volumeChapterPlan.findMany({where: {volume: directorVolumeChapterPlanFilter(novelId), chapterOrder: {gte: executionRange.startOrder, lte: executionRange.endOrder}}});
  const matched = new Set<string>();
  let hydrated = workspace;
  for (const target of targets) {
    const order = orders.get(target.chapterId) ?? executionRange.startOrder;
    const candidates = rows.filter(row => row.id === target.chapterId && row.volumeId === target.volumeId);
    const saved = candidates[0];
    if (candidates.length !== 1 || (launchInput?.targetVolumeId && saved.volumeId !== launchInput.targetVolumeId)) {
      throw new AppError(`No se puede localizar el ${order} Plan guardado del capítulo, lea este libro nuevamente.`, 409);
    }
    matched.add(saved.id);
    hydrated = applySavedChapterPlanFields(hydrated, saved);
  }
  if (matched.size !== rows.length) {
    const extra = rows.find(row => !matched.has(row.id));
    throw new AppError(`Cap. ${extra?.chapterOrder ?? executionRange.startOrder} El plan guardado del capítulo no es único; lea este libro nuevamente.`, 409);
  }
  return {workspace: hydrated, executionRange};
}
