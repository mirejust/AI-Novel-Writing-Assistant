import type { Prisma } from "@prisma/client";
import {
  chapterPlanRevisionSchema,
  chapterPlanRevisionKey,
  type ChapterPlanRevision,
} from "@ai-novel/shared/types/director/revision";
import { parseChapterScenePlan, serializeChapterScenePlan } from "@ai-novel/shared/types/chapterLengthControl";
import type { VolumePlanDocument } from "@ai-novel/shared/types/novel";
import type { RunContract } from "../../../modules/director";
import { AppError } from "../../../middleware/errorHandler";
import { canApproveProse, chapterApprovalFingerprint, readChapterReviewPlans } from "./chapterReview";

/** Save the selected planning rows and the corresponding version in the gate transaction. */
export async function saveChapterPlanEdit(
  contract: RunContract,
  raw: ChapterPlanRevision,
  tx: Prisma.TransactionClient,
) {
  const parsed = chapterPlanRevisionSchema.safeParse(raw);
  if (!parsed.success) throw new AppError("Verifique las tareas del capítulo, las escenas y el recuento de palabras.", 400);
  const rows = await readChapterReviewPlans(tx, contract);
  const version = await tx.volumePlanVersion.findFirst({
    where: { novelId: contract.novelId, status: "active" },
    orderBy: { version: "desc" },
  });
  const revision = parsed.data;
  if (!version || ("chapters" in revision && revision.planVersionId !== version.id))
    throw new AppError("La versión del plan de volumen ha cambiado; vuelva a abrir la página de confirmación del capítulo.", 409);
  if ("chapters" in revision && revision.approveForProse) {
    if (!canApproveProse(contract) || revision.approveForProse !== chapterApprovalFingerprint(version.id, rows)) {
      throw new AppError("Los requisitos de redacción para este lote de capítulos han cambiado; vuelva a abrir la página de confirmación para verificar.", 409);
    }
    if (!revision.chapters.length) return revision.approveForProse;
  }
  const document = JSON.parse(version.contentJson) as VolumePlanDocument;
  // Historical single-chapter commands address only the first authorized chapter.
  const changes = "chapters" in revision ? revision.chapters : [{ chapterId: rows[0].id, edit: revision }];
  for (const { chapterId, edit } of changes) {
    const row = rows.find((item) => item.id === chapterId);
    if (!row || chapterPlanRevisionKey(row) !== edit.baseRevision)
      throw new AppError("El plan del capítulo ha cambiado; vuelva a abrir la página de confirmación del capítulo.", 409);
    const matches =
      document.volumes
        ?.filter((volume) => volume.id === row.volumeId)
        .flatMap((volume) =>
          volume.chapters.filter((chapter) => chapter.id === row.id && chapter.chapterOrder === row.chapterOrder),
        ) ?? [];
    if (matches.length !== 1) throw new AppError("No se puede ubicar el capítulo en el plan de actividades, vuelva a abrir la página de confirmación.", 409);
    const scenePlan = parseChapterScenePlan(edit.sceneCards, { targetWordCount: edit.targetWordCount });
    if (!scenePlan) throw new AppError("Complete el objetivo completo de la escena, el estado de entrada, el estado de salida y el recuento de palabras.", 400);
    const previousScenes = parseChapterScenePlan(row.sceneCards, { targetWordCount: row.targetWordCount });
    const sceneCards = serializeChapterScenePlan(scenePlan);
    const saved = {
      taskSheet: edit.taskSheet,
      targetWordCount: edit.targetWordCount,
      mustAvoid: edit.mustAvoid,
      sceneCards:
        previousScenes && serializeChapterScenePlan(previousScenes) === sceneCards ? row.sceneCards : sceneCards,
    };
    Object.assign(matches[0], saved);
    const updated = await tx.volumeChapterPlan.updateMany({
      where: {
        id: row.id,
        volumeId: row.volumeId,
        chapterOrder: row.chapterOrder,
        taskSheet: row.taskSheet,
        sceneCards: row.sceneCards,
        targetWordCount: row.targetWordCount,
        mustAvoid: row.mustAvoid,
      },
      data: saved,
    });
    if (updated.count !== 1) throw new AppError("El plan del capítulo cambió al guardarlo. Vuelva a abrir la página de confirmación.", 409);
    Object.assign(row, saved);
  }
  const updated = await tx.volumePlanVersion.updateMany({
    where: { id: version.id, status: "active", contentJson: version.contentJson },
    data: { contentJson: JSON.stringify(document) },
  });
  if (updated.count !== 1) throw new AppError("El plan de volumen cambió al guardar, vuelva a abrir la página de confirmación.", 409);
  // Sign the reviewed snapshot plus the accepted edits, even if a different row changes concurrently.
  if ("chapters" in revision && revision.approveForProse) return chapterApprovalFingerprint(version.id, rows);
}
