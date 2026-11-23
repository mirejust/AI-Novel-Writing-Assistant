import {readOutlinePlanningState} from "../../../modules/planning/outline/constraints";
import {AppError} from "../../../middleware/errorHandler";
import {readChapterReviewPlans} from "../revisions/chapterReview";
import {prisma} from "../../../db/prisma";
import {FactIntegrityError, type ArtifactTypeInfo, type RunContract, type RunControl} from "../../../modules/director";
import {directorVolumeChapterPlanFilter} from "../planning";

const reviewTargets: Record<string, string> = {
  story_macro: "Planificación de la historia", book_contract: "acuerdo creativo", world_skeleton: "Ambientación del mundo",
  character_cast: "Reparto de personajes", volume_strategy: "describir", volume_beat_sheet: "sección rítmica",
  volume_chapter_list: "Ruta del capítulo", chapter_task_sheet: "Tareas y escenas del capítulo.",
  chapter_execution_contract: "Plan de ejecución de texto", chapter_batch_closed: "Texto de este lote",
};

export const directorArtifactTypes: Readonly<Record<string, ArtifactTypeInfo>> = Object.fromEntries(
  Object.entries(reviewTargets).map(([type, label]) => [type, {label, reviewRoute: `/lab/director/:novelId?review=${type}`}]),
);

export interface SavedReviewContext {
  type:string; novelId:string; runId:string; controlVersion:number;
  from?:number; to?:number; chapterId?:string; volumeId?:string;
  chapterPlans?: {id:string; volumeId:string; chapterOrder:number}[];
}

/** Resolve only the open chapter gates, using saved current-book identities, never a first-row default. */
export async function resolveSavedReviewContexts({contract, control}: {contract: RunContract; control: RunControl}): Promise<SavedReviewContext[]> {
  const types = control.status === "waiting_gate" ? control.gate?.artifactTypes ?? [] : [];
  const contexts:SavedReviewContext[]=types.map(type=>({type,novelId:contract.novelId,runId:contract.runId,controlVersion:control.version}));
  const volumeContexts=contexts.filter(context=>["volume_beat_sheet","volume_chapter_list"].includes(context.type));
  if (volumeContexts.length) {
    let volumeId=contract.launchInput?.targetVolumeId ?? undefined;
    if (!volumeId && contract.launchInput?.outlineBinding) {
      // A story-only opening gains its runtime slots after strategy, not at launch.
      const state=await readOutlinePlanningState(prisma,contract.novelId,contract.chapterRange ?? {from:1,to:1});
      const slots=state ? [...state.mapping.volumes,...(state.mapping.runtimeVolumes ?? [])].filter(slot=>state.range.from>=slot.from && state.range.from<=slot.to) : [];
      if (slots.length!==1) throw new FactIntegrityError("Al volumen pendiente le falta una ubicación única del capítulo guardado.");
      volumeId=slots[0].volumeId;
    }
    for (const context of volumeContexts) context.volumeId=volumeId;
  }
  const chapterTypes = contexts.filter(row => ["chapter_task_sheet", "chapter_execution_contract", "chapter_batch_closed"].includes(row.type));
  if (!chapterTypes.length) return contexts;
  const from = contract.chapterRange?.from, to = contract.chapterRange?.to;
  if (!from || !to || !Number.isSafeInteger(from) || !Number.isSafeInteger(to) || from < 1 || to < from) throw new FactIntegrityError("La sección a confirmar carece de alcance válido de autoridad.");
  for (const context of chapterTypes) {
    const {type}=context;
    if (type === "chapter_task_sheet") {
      const rows = await readChapterReviewPlans(prisma, contract).catch(error => {
        if (error instanceof AppError && error.statusCode === 409) throw new FactIntegrityError(error.message);
        throw error;
      });
      context.chapterId = rows[0].id;
      context.volumeId = rows[0].volumeId;
      if (rows.length > 1) context.chapterPlans = rows.map(({id, volumeId, chapterOrder}) => ({id, volumeId, chapterOrder}));
    } else if (type === "chapter_batch_closed") {
      const chapters = await prisma.chapter.findMany({where: {novelId: contract.novelId, order: from}, select: {id: true}});
      if (chapters.length !== 1) throw new FactIntegrityError("Al texto a confirmar le falta un capítulo guardado único.");
      context.chapterId=chapters[0].id;
    } else {
      const chapters = await prisma.volumeChapterPlan.findMany({where: {volume: directorVolumeChapterPlanFilter(contract.novelId), chapterOrder: from}, select: {id: true, volumeId: true}});
      if (chapters.length !== 1 || (contract.launchInput?.targetVolumeId && chapters[0].volumeId !== contract.launchInput.targetVolumeId)) {
        throw new FactIntegrityError("Al plan por confirmar le falta un capítulo de volumen objetivo guardado único.");
      }
      context.volumeId=chapters[0].volumeId;
      if (type === "chapter_execution_contract") {
        const saved = await prisma.chapter.findMany({where: {novelId: contract.novelId, order: from}, select: {id: true}});
        if (saved.length !== 1) throw new FactIntegrityError("Al plan de ejecución por confirmar le falta un capítulo guardado único.");
        context.chapterId=saved[0].id;
      } else context.chapterId=chapters[0].id;
    }
    context.from=from;context.to=to;
  }
  return contexts;
}

export async function resolveConfirmationArtifactTypes(input: {contract: RunContract; control: RunControl}) {
  await resolveSavedReviewContexts(input);
  return directorArtifactTypes;
}
