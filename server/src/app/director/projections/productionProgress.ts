import {nextProseBatchRange} from "../revisions/proseReview";
import {prisma} from "../../../db/prisma";
import {FactIntegrityError, PrismaEventLog, type RunContract, type RunControl, type ProductionProjection} from "../../../modules/director";
import {parsePipelinePayload, isPipelineActiveStage} from "../../../services/novel/pipelineJobState";
import {isCurrentV2ChapterProductionCompleted as isCurrentChapterProductionCompleted} from "../../../services/novel/production/completion";
import {CHAPTER_ARTIFACT_BOUNDARY_TYPE} from "../../../services/novel/runtime/artifactSync";
import {readPausedChapterBudget, readChapterUsageCounters, observeChapterUsage} from "../../../services/novel/production/usage";
import {readProductionBatchImplementation,readKernelChapterProgress,readKernelPausedChapterBudget,readKernelPausedUnknownClaims,isMissingProductionStorage} from "../productionKernel";
import {DirectorProjectionUnavailableError} from "../../../modules/director";

/** Read saved production facts only. Never claim a live chapter from a human-readable job label. */
export async function readProductionProjection({contract, control}: {contract: RunContract; control: RunControl}): Promise<ProductionProjection> {
  const range = contract.chapterRange;
  const target = contract.launchInput?.estimatedChapterCount ?? 0;
  const saved = await prisma.chapter.findMany({where:{novelId:contract.novelId},
    select:{order:true,content:true},orderBy:{order:"asc"}});
  const nextLaunchRange = nextProseBatchRange(saved,target,Boolean(contract.launchInput?.outlineBinding));
  if (!range) return {chapterProgress:null, nextLaunchRange};
  if (!Number.isSafeInteger(range.from) || !Number.isSafeInteger(range.to) || range.from < 1 || range.to < range.from) {
    throw new FactIntegrityError("El progreso del texto carece de un alcance de autorización válido.");
  }
  if (await readProductionBatchImplementation(prisma,contract) === "kernel") {
    try {
    const chapterBudget=await readKernelPausedChapterBudget(prisma,contract,control);
    const unknownClaims=await readKernelPausedUnknownClaims(prisma,contract,control);
    return {chapterProgress:await readKernelChapterProgress(prisma,contract,control),nextLaunchRange,...(chapterBudget ? {chapterBudget} : {}),...(unknownClaims ? {unknownClaims} : {})};
    } catch(error) {if(isMissingProductionStorage(error)) throw new DirectorProjectionUnavailableError(); throw error;}
  }
  const chapters = await prisma.chapter.findMany({where:{novelId:contract.novelId,order:{gte:range.from,lte:range.to}},
    select:{id:true,order:true,title:true,content:true,generationState:true,chapterStatus:true,riskFlags:true,
      artifactSyncCheckpoints:{where:{artifactType:CHAPTER_ARTIFACT_BOUNDARY_TYPE,status:"succeeded"},
        select:{contentHash:true,metadataJson:true},orderBy:{updatedAt:"desc"},take:6}}});
  if (new Set(chapters.map(chapter=>chapter.order)).size !== chapters.length) throw new FactIntegrityError("Hay números de capítulo duplicados en el progreso del texto.");
  const chapterProgress: NonNullable<ProductionProjection["chapterProgress"]> = {...range,
    total:range.to-range.from+1, done:chapters.filter(isCurrentChapterProductionCompleted).length, current:null};
  const binding = (await new PrismaEventLog().list(contract.runId)).filter(event=>event.type === "chapter_batch_job").at(-1);
  if (!binding) return {chapterProgress,nextLaunchRange};
  const jobId = (binding.payload as {jobId?:unknown})?.jobId;
  if (typeof jobId !== "string" || !jobId) throw new FactIntegrityError("El enlace del trabajo para el progreso del texto está roto.");
  const job = await prisma.generationJob.findUnique({where:{id:jobId},select:{novelId:true,startOrder:true,endOrder:true,payload:true,
    status:true,pendingManualRecovery:true,currentStage:true,currentItemKey:true}});
  if (!job || job.novelId !== contract.novelId || parsePipelinePayload(job.payload).directorNext?.runId !== contract.runId
    || job.startOrder !== range.from || job.endOrder !== range.to) throw new FactIntegrityError("Las asignaciones en el progreso del texto son inconsistentes con el alcance de esta creación.");
  if (control.status === "running" && control.cursorStepId === "chapter_batch" && job.status === "running" && !job.pendingManualRecovery && job.currentItemKey) {
    const chapter = chapters.find(item=>item.id === job.currentItemKey);
    if (!chapter) throw new FactIntegrityError("El capítulo que se trata no entra dentro del alcance de la autorización de este libro.");
    if (isPipelineActiveStage(job.currentStage) && job.currentStage !== "queued") {
      chapterProgress.current = {order:chapter.order,title:chapter.title,phase:job.currentStage};
    }
  }
  const snapshot = parsePipelinePayload(job.payload).directorNext!;
  let chapterBudget = control.status === "paused" && control.pause?.kind === "manual_recovery" && job.pendingManualRecovery
    ? readPausedChapterBudget(snapshot, jobId) : null;
  if (chapterBudget) {
    const budget = chapterBudget;
    if (!chapters.some(chapter=>chapter.id === budget.chapterId && chapter.order === budget.chapterOrder)) {
      throw new FactIntegrityError("Los capítulos sobre la suspensión del presupuesto están fuera del alcance de la autoridad de este libro.");
    }
    if (!budget.closed) {
      const usage = await readChapterUsageCounters(jobId);
      observeChapterUsage(snapshot,budget.chapterId,usage.job,usage.batch);
      chapterBudget = readPausedChapterBudget(snapshot,jobId);
    }
  }
  return {chapterProgress,nextLaunchRange,...(chapterBudget ? {chapterBudget} : {})};
}
