import type { Prisma } from "@prisma/client";
import { AppError } from "../../../../middleware/errorHandler";
import type { RunContract } from "../../../../modules/director";
import { directorVolumeChapterPlanFilter } from "../../planning";

/** Planning IDs belong to the frozen run range. Execution Chapter IDs are a separate identity. */
export async function readChapterReviewPlans(db: Prisma.TransactionClient, contract: RunContract) {
  const range = contract.chapterRange;
  if (
    !range ||
    !Number.isSafeInteger(range.from) ||
    !Number.isSafeInteger(range.to) ||
    range.from < 1 ||
    range.to < range.from
  ) {
    throw new AppError("La sección a confirmar carece de alcance válido de autoridad.", 409);
  }
  const rows = await db.volumeChapterPlan.findMany({
    where: {
      volume: directorVolumeChapterPlanFilter(contract.novelId),
      chapterOrder: { gte: range.from, lte: range.to },
    },
    orderBy: { chapterOrder: "asc" },
  });
  if (
    rows.length !== range.to - range.from + 1 ||
    rows.some(
      (row, i) =>
        row.chapterOrder !== range.from + i ||
        (contract.launchInput?.targetVolumeId && row.volumeId !== contract.launchInput.targetVolumeId),
    )
  ) {
    throw new AppError("Al plan por confirmar le falta un capítulo de volumen objetivo guardado único.", 409);
  }
  return rows;
}
