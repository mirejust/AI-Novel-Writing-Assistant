import type { RunContract } from "../../../modules/director";
import { prisma } from "../../../db/prisma";
import { readOutlinePlanningState, assertOutlineReference } from "../../../modules/planning/outline/constraints";
import { OutlineOpenBookError } from "../../../modules/planning/outline/openBook";
import { MANUAL_CHAPTER_PLAN_VERSION } from "../productionKernel/manual/contract";
import { outlineOpeningPlan } from "./plan";
export async function prepareOutlineHandoff(contract: RunContract) {
  const input = contract.launchInput!;
  const manual = contract.planVersion === MANUAL_CHAPTER_PLAN_VERSION;
  const state = await readOutlinePlanningState(prisma, contract.novelId, contract.chapterRange ?? {from: 1, to: 1});
  if (!state) {
    if (input.outlineBinding) throw new OutlineOpenBookError("OUTLINE_BINDING_INTEGRITY", "No existe una fuente de sinopsis correspondiente para este libro.");
    return false;
  }
  if (input.outlineBinding) await assertOutlineReference(prisma, contract.novelId, input.outlineBinding);
  if (contract.chapterRange && contract.chapterRange.from !== contract.chapterRange.to)
    throw new OutlineOpenBookError("OUTLINE_SINGLE_CHAPTER_REQUIRED", "Al escribir según el esquema, sólo puedes confirmar un capítulo a la vez. Por favor seleccione el capítulo actual.", 422);
  const novel = await prisma.novel.findUniqueOrThrow({where: {id: contract.novelId}, select: {estimatedChapterCount: true, worldId: true}});
  if (contract.chapterRange && contract.chapterRange.to > (novel.estimatedChapterCount ?? 0)) throw new OutlineOpenBookError("OUTLINE_RANGE_INVALID", "Los capítulos superan la extensión confirmada del libro.", 422);
  if (!manual && contract.chapterRange?.from && contract.chapterRange.from > 1) {
    const previous = await prisma.chapter.findFirst({where: {novelId: contract.novelId, order: contract.chapterRange.from-1}, select: {content: true}});
    if (!previous?.content?.trim()) throw new OutlineOpenBookError("OUTLINE_PREVIOUS_CHAPTER_REQUIRED", "Complete el capítulo anterior y verifique el texto antes de preparar el siguiente capítulo.", 422);
  }
  const targetSlot = [...state.mapping.volumes, ...(state.mapping.runtimeVolumes ?? [])].find(s => state.range.from >= s.from && state.range.from <= s.to);
  if (input.targetVolumeId && targetSlot && input.targetVolumeId !== targetSlot.volumeId) throw new OutlineOpenBookError("OUTLINE_RANGE_INVALID", "El volumen objetivo no coincide con el espacio del capítulo confirmado.", 422);
  input.outlineBinding = state.ref;
  input.storyInput = state.document.story.premise || state.document.story.synopsis;
  input.estimatedChapterCount = novel.estimatedChapterCount!;
  input.worldMode = novel.worldId ? "reuse" : input.worldMode;
  if (targetSlot) input.targetVolumeId = targetSlot.volumeId;
  if (!manual) {
    contract.driver = "assisted";
    contract.planVersion = outlineOpeningPlan.version;
  }
  return true;
}
