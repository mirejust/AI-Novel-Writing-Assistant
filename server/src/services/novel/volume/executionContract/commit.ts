import type { Prisma } from "@prisma/client";
import { persistActiveVolumeWorkspace } from "../volumeWorkspacePersistence";
import { serializeVolumeWorkspaceDocument } from "../volumeWorkspaceDocument";
import type { ChapterExecutionContractServiceDeps, ContractTransactionFence } from "./types";
import type { PreparedChapterExecutionContract } from "./prepare";
import type { EvaluatedChapterExecutionContract } from "./evaluate";
import { readWorkspaceFingerprint } from "./sourceVersion";
export async function commitExecutionContract(tx: Prisma.TransactionClient, prepared: PreparedChapterExecutionContract,
  outcome: EvaluatedChapterExecutionContract, deps: ChapterExecutionContractServiceDeps, assertTransaction?: ContractTransactionFence) {
  const { novelId, chapterId, chapter } = prepared;
  if (assertTransaction) {
    await assertTransaction(tx, "before");
    if (!prepared.workspaceFingerprint) throw new Error("Missing prepared workspace version");
    if (prepared.workspaceFingerprint !== await readWorkspaceFingerprint(tx, novelId)) throw new Error("El plan de volumen cambió durante la compilación; prepare este capítulo nuevamente.");
    const locked = await tx.chapter.updateMany({where: {id: chapterId, novelId, content: chapter.content,
      updatedAt: new Date(chapter.updatedAt), taskSheet: chapter.taskSheet, sceneCards: chapter.sceneCards},
      data: {updatedAt: new Date(chapter.updatedAt)}});
    if (locked.count !== 1) throw new Error("El texto o la planificación de este capítulo ha cambiado durante la producción; prepare este capítulo nuevamente.");
  }
  const { reviewedPrevious } = outcome;
  if (outcome.kind === "reuse") {
    if (reviewedPrevious) {
      const source = await tx.chapter.findFirst({where: {novelId, order: reviewedPrevious.order}, select: {content: true}});
      if (source?.content !== reviewedPrevious.content) throw new Error("El texto del capítulo anterior ha cambiado durante la generación del plan; prepare este capítulo nuevamente.");
    }
    await assertTransaction?.(tx, "after");
    return { ...chapter, createdAt: new Date(chapter.createdAt), updatedAt: new Date(chapter.updatedAt), styleContract: outcome.styleContract };
  }
  const { generatedDocument, targetChapter, taskSheet, sceneCards, styleContract } = outcome;
  const saved = await (async () => {
      const current = await tx.chapter.findFirst({ where: { id: chapterId, novelId }, select: { taskSheet: true, sceneCards: true } });
      if (current?.taskSheet !== chapter.taskSheet || current?.sceneCards !== chapter.sceneCards) throw new Error("El plan para este capítulo cambió durante el proceso de generación y las nuevas modificaciones se han mantenido. Por favor prepare este capítulo nuevamente.");
      if (reviewedPrevious) {
        const source = await tx.chapter.findFirst({ where: { novelId, order: reviewedPrevious.order }, select: { content: true } });
        if (source?.content !== reviewedPrevious.content) throw new Error("El texto del capítulo anterior ha cambiado durante la generación del plan; prepare este capítulo nuevamente.");
      }
      const { versionId } = await deps.ensureActiveVersionRecord(
        tx,
        novelId,
        generatedDocument,
        `Actualizar el primero${chapter.order}Contrato de ejecución del capítulo.`,
      );
      const persistedDocument = {
        ...generatedDocument,
        activeVersionId: versionId,
        source: "volume" as const,
      };
      await tx.volumePlanVersion.update({
        where: { id: versionId },
        data: {
          contentJson: serializeVolumeWorkspaceDocument(persistedDocument),
        },
      });
      await persistActiveVolumeWorkspace(tx, novelId, persistedDocument, versionId);
      const updatedChapter = await tx.chapter.update({
        where: { id: chapterId },
        data: {
          targetWordCount: targetChapter.targetWordCount ?? chapter.targetWordCount ?? null,
          conflictLevel: targetChapter.conflictLevel ?? chapter.conflictLevel ?? null,
          revealLevel: targetChapter.revealLevel ?? chapter.revealLevel ?? null,
          mustAvoid: targetChapter.mustAvoid ?? chapter.mustAvoid ?? null,
          taskSheet,
          sceneCards: sceneCards,
        },
      });
      return {
        ...updatedChapter,
        styleContract,
      };
  })();
  await assertTransaction?.(tx, "after");
  return saved;
}
