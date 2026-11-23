import type { Prisma } from "@prisma/client";
import type { RunContract } from "../../../../modules/director";
import type { UnitRun, PreparedChapter } from "../../../../modules/production";
import { canonicalProductionJson } from "../../../../modules/production/common";
import { AppError } from "../../../../middleware/errorHandler";

/** An explicit resume may invalidate an uncommitted decision only after the user saves a newer book route. */
export async function resetReplannedUnit(tx: Prisma.TransactionClient, contract: RunContract,
  pausedAt: Date, runs: UnitRun[]): Promise<void> {
  const replans=runs.filter(run=>run.progress.original?.verdict?.replan==="global_book");
  if(!replans.length)return;
  if(replans.length!==1)throw new AppError("Hay varios capítulos que replanificar; verifique los registros actuales.",409);
  const run=replans[0],unit=run.progress.unit,range=contract.chapterRange;
  if(!range||unit.novelId!==contract.novelId||unit.order<range.from||unit.order>range.to||run.activeStage
    ||run.progress.completed.includes("commit")||run.progress.committedContentHash)throw new AppError("El texto guardado o las solicitudes no confirmadas no se pueden reprogramar, consulte el capítulo.",409);
  const route=await tx.volumePlanVersion.findFirst({where:{novelId:contract.novelId,status:"active"},orderBy:{version:"desc"}});
  if(!route||route.updatedAt<=pausedAt)throw new AppError("Guarde la ruta del capítulo ajustada desde la página de planificación del libro antes de continuar con la creación.",400);
  const lockedRoute=await tx.volumePlanVersion.updateMany({where:{id:route.id,novelId:contract.novelId,
    updatedAt:route.updatedAt,contentJson:route.contentJson},data:{updatedAt:route.updatedAt}});
  if(lockedRoute.count!==1)throw new AppError("El plan cambió durante la recuperación; actualice e inténtelo nuevamente.",409);
  const baseline=(run.artifacts.prepared as unknown as PreparedChapter | undefined)?.baseline;
  if(!baseline)throw new AppError("El capítulo carece de texto original verificable; consulte el registro en ejecución.",409);
  const chapter=await tx.chapter.findFirst({where:{id:unit.chapterId,novelId:unit.novelId,order:unit.order}});
  if(!chapter||chapter.content!==baseline.content)throw new AppError("El texto ha sido modificado, consulte primero desde la página del capítulo.",409);
  const lockedChapter=await tx.chapter.updateMany({where:{id:unit.chapterId,novelId:unit.novelId,
    content:chapter.content,updatedAt:chapter.updatedAt},data:{updatedAt:chapter.updatedAt}});
  if(lockedChapter.count!==1)throw new AppError("El texto cambia durante la recuperación.",409);
  const changed=await tx.productionUnitRun.updateMany({where:{id:run.id,ownerKey:run.ownerKey,novelId:unit.novelId,
    chapterId:unit.chapterId,version:run.version,activeStage:null,activeRequestKey:null},data:{
    progressJson:canonicalProductionJson({unit,completed:[],repairAttemptsUsed:0}),stageArtifactsJson:canonicalProductionJson({receipts:{}}),version:{increment:1}}});
  if(changed.count!==1)throw new AppError("El estado de la replanificación ha cambiado. Actualice e inténtelo de nuevo.",409);
  const latest=await tx.directorNextEvent.findFirst({where:{runId:contract.runId},orderBy:{seq:"desc"},select:{seq:true}});
  await tx.directorNextEvent.create({data:{id:`${contract.runId}:kernel-replan:${run.id}:${run.version}`,runId:contract.runId,
    seq:(latest?.seq??0)+1,type:"production_kernel_replan_reset",payloadJson:canonicalProductionJson({version:1,unitRunId:run.id,
      route:{id:route.id,updatedAt:route.updatedAt.toISOString()},previous:{version:run.version,progress:run.progress,artifacts:run.artifacts}})}});
}
