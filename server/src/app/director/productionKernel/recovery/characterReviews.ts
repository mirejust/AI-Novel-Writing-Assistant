import type { Prisma } from "@prisma/client";
import type { RunContract } from "../../../../modules/director";
import { directorCharacterCandidates } from "../../../../services/novel/characters/candidates";
import { AppError } from "../../../../middleware/errorHandler";

/** Assisted confirmations stay a source-page precondition; automatic deferred identities remain nonblocking. */
export async function assertKernelCharacterReviewsResolved(tx: Prisma.TransactionClient, contract: RunContract) {
  const rows = await tx.chapterArtifactSyncCheckpoint.findMany({ where: { novelId: contract.novelId,
    artifactType: `director_v2_character_candidates:${contract.runId}`, syncMode: "identity" }, select: { id: true, chapterId: true, metadataJson: true } });
  for (const row of rows) {
    const review = JSON.parse(row.metadataJson ?? "null") as { schemaVersion?: number; driver?: string; blocking?: boolean; items?: { status?: string }[] } | null;
    if (!review || review.schemaVersion !== 1 || !Array.isArray(review.items)) throw new AppError("El registro de confirmación de personaje no se puede leer.", 409);
    if (review.driver === "assisted" && (review.blocking || review.items.some(item => item.status === "pending"))) {
      const chapter = await tx.chapter.findFirst({ where: { id: row.chapterId, novelId: contract.novelId }, select: { order: true } });
      if (!chapter || !contract.chapterRange || chapter.order < contract.chapterRange.from || chapter.order > contract.chapterRange.to) {
        throw new AppError("Los registros de confirmación de carácter no pertenecen a capítulos autorizados.", 409);
      }
      await directorCharacterCandidates.assertResolved(contract.runId, row.id, tx);
    }
  }
}
