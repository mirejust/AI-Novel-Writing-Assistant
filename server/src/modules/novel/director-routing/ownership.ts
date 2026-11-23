import type {Prisma} from "@prisma/client";
import type {DirectorVersion, NovelDirectorIdentity} from "@ai-novel/shared/types/director/version";
import {prisma} from "../../../db/prisma";
import {AppError} from "../../../middleware/errorHandler";
import {withSqliteRetry} from "../../../db/sqliteRetry";

type Database = Pick<Prisma.TransactionClient, "novel" | "novelWorkflowTask" | "directorNextRun" | "directorNextRunControl" | "directorRunCommand" | "generationJob"> & Partial<Pick<Prisma.TransactionClient,"manuscriptProject">>;
export const directorV2Available = () => ["true", "1"].includes(process.env.DIRECTOR_NEXT_ENABLED ?? "true");
const activeRuns = ["queued", "running", "waiting_gate", "paused"];
const activeTasks = ["queued", "running", "waiting_approval"] as const;
const openingCommands = new Set(["generate_candidates", "refine_candidates", "patch_candidate", "refine_titles", "confirm_candidate"]);

export function directorSourceRoute(novelId: string, version: DirectorVersion): string {
  return version === "v2" ? `/lab/director/${encodeURIComponent(novelId)}` : `/novels/${encodeURIComponent(novelId)}/edit`;
}

export async function readNovelDirectorIdentity(novelId: string, db: Database = prisma): Promise<Pick<NovelDirectorIdentity, "novelId" | "version" | "epoch" | "sourceRoute">> {
  const book = await db.novel.findUnique({where: {id: novelId}, select: {directorVersion: true, directorEpoch: true, narrativeForm: true}});
  if (!book) throw new AppError("No se puede encontrar la novela.", 404);
  if (book.narrativeForm === "short_story") throw new AppError("Las selecciones de versión del director están disponibles para novelas completas.", 400);
  if (book.directorVersion && !["v1", "v2"].includes(book.directorVersion)) throw new AppError("La atribución del director novedoso no es válida; verifique los registros en ejecución.", 409);
  const version: DirectorVersion = book.directorVersion as DirectorVersion
    || (await db.directorNextRun.findFirst({where: {novelId}, select: {id: true}}) ? "v2" : "v1");
  return {novelId, version, epoch: book.directorEpoch, sourceRoute: directorSourceRoute(novelId, version)};
}

export async function assertNovelDirectorVersion(novelId: string, version: DirectorVersion, epoch?: number, db: Database = prisma) {
  if(await db.manuscriptProject?.findUnique({where:{novelId},select:{id:true}}))throw new AppError("La copia revisada del manuscrito original solo puede ser vista previa y adoptada explícitamente capítulo por capítulo, y no se inicia la escritura del director.",409);
  const identity = await readNovelDirectorIdentity(novelId, db);
  if (identity.version !== version || (epoch !== undefined && epoch !== identity.epoch)) {
    throw new AppError(`por favor directo desde este libro ${identity.version.toUpperCase()} Inicie una nueva creación en el banco de trabajo.`, 409, {sourceRoute: identity.sourceRoute});
  }
  if (version === "v2" && !directorV2Available()) throw new AppError("Director V2 no está habilitado, habilítelo para continuar creando este libro.", 409);
  return identity;
}

export async function canExecuteLegacyTask(taskId: string, db: Database = prisma): Promise<boolean> {
  const task = await db.novelWorkflowTask.findUnique({where: {id: taskId}, select: {novelId: true, directorVersion: true, directorEpoch: true}});
  if (!task) return false;
  if (!task.novelId) return !task.directorVersion || task.directorVersion === "v1";
  if(await db.manuscriptProject?.findUnique({where:{novelId:task.novelId},select:{id:true}}))return false;
  const identity = await readNovelDirectorIdentity(task.novelId, db);
  return identity.version === "v1" && (!task.directorVersion || task.directorVersion === "v1") && (task.directorEpoch ?? 0) === identity.epoch;
}

export async function assertLegacyTaskExecution(taskId: string, commandType?: string, allowV2Opening = false, db: Database = prisma): Promise<void> {
  const task = await db.novelWorkflowTask.findUnique({where: {id: taskId}, select: {novelId: true, directorVersion: true}});
  if (!task) throw new AppError("No se puede encontrar esta tarea de creación.", 404);
  if (allowV2Opening && !task.novelId && task.directorVersion === "v2" && commandType && openingCommands.has(commandType)) return;
  if (!await canExecuteLegacyTask(taskId, db)) throw new AppError("Esta tarea pertenece a la versión de otro director o a una generación creativa que ha terminado. Abra el banco de trabajo correspondiente a la novela.", 409);
}

export async function assertV2RunExecution(runId: string): Promise<void> {
  const run = await prisma.directorNextRun.findUnique({where: {id: runId}, select: {novelId: true, contractJson: true}});
  if (!run) throw new AppError("No se puede encontrar la creación V2 de este director.", 404);
  await assertNovelDirectorVersion(run.novelId, "v2", readRunExecutionEpoch(run.contractJson));
}

export function readRunExecutionEpoch(contractJson: string): number {
  try {
    const value = JSON.parse(contractJson).executionEpoch ?? 0;
    if (Number.isSafeInteger(value) && value >= 0) return value;
  } catch { /* Invalid ownership is never guessed. */ }
  throw new AppError("El atributo de ejecución de la tarea de creación está dañado; verifique el registro de ejecución.", 409);
}

async function hasActiveProduction(novelId: string, epoch: number, db: Database): Promise<boolean> {
  const identity = await readNovelDirectorIdentity(novelId, db);
  const [runs, task, jobs, liveCommand, liveV2Lease] = await Promise.all([
    identity.version === "v2" ? db.directorNextRunControl.findMany({where: {novelId, status: {in: activeRuns}}, select: {run: {select: {contractJson: true}}}}) : [],
    identity.version === "v1" ? db.novelWorkflowTask.findFirst({where: {novelId, OR: [{directorEpoch: epoch}, ...(epoch === 0 ? [{directorEpoch: null}] : [])], AND: [{OR: [{status: {in: [...activeTasks]}}, {pendingManualRecovery: true}]}, {OR: [{currentItemKey: null}, {currentItemKey: {not: "opening_complete"}}]}]}, select: {id: true}}) : null,
    db.generationJob.findMany({where: {novelId, OR: [{status: {in: ["queued", "running"]}}, {pendingManualRecovery: true}]}, select: {payload: true, executionLeaseExpiresAt: true}}),
    db.directorRunCommand.findFirst({where: {task: {novelId}, OR: [
      {status: {in: ["leased", "running"]}, leaseExpiresAt: {gt: new Date()}},
      ...(identity.version === "v1" ? [{status: "queued", task: {status: {not: "cancelled" as const}, AND: [
        {OR: [{directorEpoch: epoch}, ...(epoch === 0 ? [{directorEpoch: null}] : [])]},
        {OR: [{directorVersion: "v1"}, {directorVersion: null}]},
      ]}}] : []),
    ]}, select: {id: true}}),
    db.directorNextRunControl.findFirst({where: {novelId, leaseExpiresAt: {gt: new Date()}, leaseOwner: {not: null}}, select: {runId: true}}),
  ]);
  if (task || liveCommand || liveV2Lease || runs.some(run => readRunExecutionEpoch(run.run.contractJson) === epoch)) return true;
  for (const job of jobs) {
    if (job.executionLeaseExpiresAt && job.executionLeaseExpiresAt > new Date()) return true;
    let payload: {directorNext?: {runId: string}; workflowTaskId?: string};
    try {payload = JSON.parse(job.payload || "{}");} catch {return true;}
    if (payload.directorNext) {
      const owner = await db.directorNextRun.findUnique({where: {id: payload.directorNext.runId}, select: {contractJson: true}});
      if (!owner || (identity.version === "v2" && readRunExecutionEpoch(owner.contractJson) === epoch)) return true;
    } else if (payload.workflowTaskId) {
      const owner = await db.novelWorkflowTask.findUnique({where: {id: payload.workflowTaskId}, select: {directorEpoch: true}});
      if (!owner || (identity.version === "v1" && (owner.directorEpoch ?? 0) === epoch)) return true;
    } else return true;
  }
  return false;
}

export async function getNovelDirectorIdentity(novelId: string): Promise<NovelDirectorIdentity> {
  const identity = await readNovelDirectorIdentity(novelId);
  const outlineBound = await prisma.outlineBookBinding.findUnique({where: {novelId}, select: {id: true}});
  const blocked = Boolean(outlineBound) || await hasActiveProduction(novelId, identity.epoch, prisma);
  return {...identity, availableVersions: outlineBound ? ["v2"] : directorV2Available() ? ["v1", "v2"] : ["v1"], canSwitch: !blocked,
    blockedReason: outlineBound ? "Escribir a partir de un esquema requiere que Director V2 preserve las fuentes y las limitaciones." : blocked ? "Primero termine la tarea de escritura actual de este libro y luego elija la versión del director." : null};
}

export async function switchNovelDirectorVersion(novelId: string, version: DirectorVersion, expectedEpoch: number): Promise<NovelDirectorIdentity> {
  if(await prisma.manuscriptProject.findUnique({where:{novelId},select:{id:true}}))throw new AppError("Las copias revisadas del manuscrito no cambian de director; trabaje en los capítulos en el espacio de trabajo de revisión.",409);
  if (version === "v2" && !directorV2Available()) throw new AppError("Director V2 no está habilitado.", 409);
  await withSqliteRetry(() => prisma.$transaction(async tx => {
    const locked = await tx.novel.updateMany({where: {id: novelId, directorEpoch: expectedEpoch}, data: {directorEpoch: {increment: 0}}});
    if (locked.count !== 1) throw new AppError("La configuración del director de este libro ha cambiado; actualice y seleccione nuevamente.", 409);
    const identity = await readNovelDirectorIdentity(novelId, tx);
    if (version === "v1" && await tx.outlineBookBinding.findUnique({where: {novelId}, select: {id: true}})) throw new AppError("Escribir a partir de un esquema requiere que Director V2 conserve las fuentes y las limitaciones y no se puede cambiar a V1.", 409);
    if (identity.version === version) return;
    if (await hasActiveProduction(novelId, expectedEpoch, tx)) throw new AppError("Primero termine la tarea de escritura actual de este libro y luego elija la versión del director.", 409);
    await tx.novel.update({where: {id: novelId}, data: {directorVersion: version, directorEpoch: {increment: 1}}});
  }), {label: "director.switch_version"});
  return getNovelDirectorIdentity(novelId);
}

export async function readOpeningVersion(taskId: string | undefined, requested?: DirectorVersion): Promise<DirectorVersion> {
  const task = taskId ? await prisma.novelWorkflowTask.findUnique({where: {id: taskId}, select: {directorVersion: true}}) : null;
  const frozen = task ? (task.directorVersion ?? "v1") : null;
  if (frozen && requested && frozen !== requested) throw new AppError("Finalice la tarea de apertura del libro actual antes de elegir la versión de otro director.", 409);
  const version = (frozen as DirectorVersion | null) ?? requested ?? "v1";
  if (!["v1", "v2"].includes(version)) throw new AppError("La propiedad del director de la tarea de apertura del libro no es válida; verifique los registros en ejecución.", 409);
  if (version === "v2" && !directorV2Available()) throw new AppError("Director V2 no está habilitado.", 409);
  return version;
}
