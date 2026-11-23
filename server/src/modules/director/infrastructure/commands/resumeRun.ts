import type {Prisma} from "@prisma/client";
import {canRecoverFailedGeneration, type RunContract, type RunControl} from "../../domain";
import type {DirectorChapterBudgetGrant} from "@ai-novel/shared/types/director/chapterBudget";
import type {UnknownClaimResolution} from "../../application/ports";
import {InvalidDirectorCommandError} from "../../application/commandService";

export async function assertFailedGenerationRecovery(tx: Prisma.TransactionClient, runId: string, control: RunControl) {
  const latest = await tx.directorNextEvent.findFirst({where: {runId, type: {in: ["stop_signal", "stop_signal_cleared"]}}, orderBy: {seq: "desc"}});
  const signal = latest?.type === "stop_signal" ? JSON.parse(latest.payloadJson) : null;
  if (!canRecoverFailedGeneration(control, signal)) throw new InvalidDirectorCommandError("Esta interrupción debe verificarse primero para detectar problemas de seguridad o de datos y no se puede volver a intentar.");
}

/** Business recovery participates in the command transaction; polling cannot invoke it. */
export type BusinessResume = (contract: RunContract, tx: Prisma.TransactionClient, chapterBudget?: DirectorChapterBudgetGrant, resolveUnknownClaims?: UnknownClaimResolution) => Promise<void>;

export async function commitExplicitResume(tx: Prisma.TransactionClient, contract: RunContract, commandId: string, resumeBusiness?: BusinessResume, chapterBudget?: DirectorChapterBudgetGrant, resolveUnknownClaims?: UnknownClaimResolution) {
  if (chapterBudget && !resumeBusiness) throw new InvalidDirectorCommandError("No hay un presupuesto de capítulo ajustable para esta producción.");
  if (resolveUnknownClaims && !resumeBusiness) throw new InvalidDirectorCommandError("No hay pasos pendientes identificables para esta creación.");
  await resumeBusiness?.(contract, tx, chapterBudget, resolveUnknownClaims);
  if (chapterBudget) {
    const latest = await tx.directorNextEvent.findFirst({where: {runId: contract.runId}, orderBy: {seq: "desc"}, select: {seq: true}});
    const seq = (latest?.seq ?? 0) + 1;
    await tx.directorNextEvent.create({data: {id: `${contract.runId}:${seq}`, runId: contract.runId, seq,
      type: "chapter_budget_granted", payloadJson: JSON.stringify({commandId, ...chapterBudget})}});
  }
  if (resolveUnknownClaims) {
    const latest = await tx.directorNextEvent.findFirst({where: {runId: contract.runId}, orderBy: {seq: "desc"}, select: {seq: true}});
    const seq = (latest?.seq ?? 0) + 1;
    await tx.directorNextEvent.create({data: {id: `${contract.runId}:${seq}`, runId: contract.runId, seq,
      type: "unknown_claims_resolved", payloadJson: JSON.stringify({commandId, ...resolveUnknownClaims})}});
  }
  const latest = await tx.directorNextEvent.findFirst({where: {runId: contract.runId}, orderBy: {seq: "desc"}, select: {seq: true}});
  const stop = await tx.directorNextEvent.findFirst({where: {runId: contract.runId, type: "stop_signal"}, orderBy: {seq: "desc"}, select: {seq: true}});
  if (!stop) return;
  const seq = (latest?.seq ?? 0) + 1;
  await tx.directorNextEvent.create({data: {id: `${contract.runId}:${seq}`, runId: contract.runId, seq, type: "stop_signal_cleared", payloadJson: JSON.stringify({signalSeq: stop.seq, commandId})}});
}
