import {PrismaCommandRepository} from "../../../../modules/director/infrastructure";
import type {AutoDirectorActionRequest, AutoDirectorActionExecutionResult} from "@ai-novel/shared/types/autoDirectorFollowUp";
import {getDirectorProductionServices} from "../../../../app/director/services";
import {assertV2RunExecution} from "../../../../modules/novel/director-routing";

/** Run IDs address V2 directly. Never translate a historical V1 task into the book's latest run. */
export async function executeV2ChannelAction(input: AutoDirectorActionRequest): Promise<AutoDirectorActionExecutionResult> {
  await assertV2RunExecution(input.taskId);
  const {runRepository, commandService} = getDirectorProductionServices().http;
  const existing = await new PrismaCommandRepository().find(input.idempotencyKey);
  const control = await runRepository.getControl(input.taskId);
  const result = (code: AutoDirectorActionExecutionResult["code"], message: string): AutoDirectorActionExecutionResult => ({
    directorTaskId: input.taskId, taskId: input.taskId, actionCode: input.actionCode, code, message, task: null,
  });
  if (!["continue_auto_execution", "retry_with_task_model"].includes(input.actionCode)) return result("forbidden", "Maneje esto desde el escritorio del director de novelas.");
  if (existing) {
    const payload = existing.payload as {runId: string};
    if (payload.runId !== input.taskId) return result("forbidden", "Los registros de operación no pertenecen a esta creación.");
    await commandService.execute(existing.payload);
    return result("already_processed", "Procesado");
  }
  if (!control) return result("state_changed", "No se puede encontrar esta creación. Abra la consola del director de novelas.");
  const type = control.status === "paused" ? "resume"
    : control.status === "waiting_gate" && input.actionCode === "continue_auto_execution" ? "resolve_gate"
      : control.status === "queued" && input.actionCode === "retry_with_task_model" ? "retry_start" : null;
  if (!type) return result("state_changed", "El estado ha cambiado. Abra la consola del director novel para comprobarlo.");
  const executed = await commandService.execute({type, runId: input.taskId, expectedVersion: control.version,
    idempotencyKey: input.idempotencyKey, ...(type === "resolve_gate" ? {decision: "confirm"} : {})});
  return result(executed.replayed ? "already_processed" : "executed", executed.replayed ? "Procesado" : "Ejecutado con éxito");
}
