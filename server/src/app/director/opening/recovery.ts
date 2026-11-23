import {prisma} from "../../../db/prisma";
import {AppError} from "../../../middleware/errorHandler";
import {toAcceptedResponse} from "../../../services/novel/director/commands/DirectorCommandServiceHelpers";

const retryable = new Set(["generate_candidates","refine_candidates","patch_candidate","refine_titles","confirm_candidate"]);

/** Explicit recovery of the latest pre-book command. Historical failure rows remain unchanged. */
export async function prepareOpeningRetry(taskId: string) {
  return prisma.$transaction(async tx => {
    const task = await tx.novelWorkflowTask.findUnique({where:{id:taskId}});
    if (!task || task.lane !== "auto_director") throw new AppError("No se encontró ninguna tarea de apertura de libros reintentable.",404);
    if (task.novelId) throw new AppError("Continúe creando en el escritorio del director de la novela.",409);
    if (task.directorVersion !== "v2") throw new AppError("Reanude esta tarea desde la página de apertura de Director V1.",409);
    let failed = await tx.directorRunCommand.findFirst({where:{taskId},orderBy:[{createdAt:"desc"},{id:"desc"}]});
    if (!failed || !retryable.has(failed.commandType)) throw new AppError("No hay ninguna operación de apertura de libro que se pueda volver a intentar para la tarea actual.",409);
    const now = new Date();
    if (["leased","running"].includes(failed.status) && failed.leaseExpiresAt && failed.leaseExpiresAt <= now) {
      const expired = await tx.directorRunCommand.updateMany({where:{id:failed.id,status:failed.status,leaseOwner:failed.leaseOwner,leaseExpiresAt:failed.leaseExpiresAt},
        data:{status:"stale",finishedAt:now,errorMessage:"La operación de apertura del libro fue interrumpida, inténtelo nuevamente.",leaseOwner:null,leaseExpiresAt:null}});
      if (expired.count !== 1) throw new AppError("El estado de la operación de apertura del libro se ha actualizado. Actualice e intente nuevamente.",409);
      failed = await tx.directorRunCommand.findUniqueOrThrow({where:{id:failed.id}});
    }
    if (["queued","leased","running"].includes(failed.status) && !task.pendingManualRecovery) return toAcceptedResponse(failed);
    if (!["failed","stale"].includes(failed.status)) throw new AppError("Espere hasta que se complete la operación de apertura de este libro y vuelva a intentarlo.",409);
    const idempotencyKey = `opening-retry:${failed.id}`;
    const replay = await tx.directorRunCommand.findUnique({where:{taskId_commandType_idempotencyKey:{taskId,commandType:failed.commandType,idempotencyKey}}});
    if (replay) return toAcceptedResponse(replay);
    const command = await tx.directorRunCommand.create({data:{taskId,commandType:failed.commandType,idempotencyKey,payloadJson:failed.payloadJson}});
    await tx.novelWorkflowTask.update({where:{id:taskId},data:{status:"queued",pendingManualRecovery:false,lastError:null,cancelRequestedAt:null,heartbeatAt:new Date(),finishedAt:null}});
    return toAcceptedResponse(command);
  });
}
