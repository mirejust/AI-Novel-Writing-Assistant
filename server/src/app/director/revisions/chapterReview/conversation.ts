import type { Prisma } from "@prisma/client";
import type { VolumePlanDocument } from "@ai-novel/shared/types/novel";
import {
  chapterDialogueOutput,
  chapterDraftSchema,
  chapterProposalChanges,
  chapterReplySchema,
  chapterReviewForm,
  sceneFieldKey,
} from "@ai-novel/shared/types/director/chapterReview/discussion";
import { AppError } from "../../../../middleware/errorHandler";
import type { RunContract } from "../../../../modules/director";
import { runStructuredPrompt } from "../../../../prompting/core/promptRunner";
import { chapterReviewDialoguePrompt } from "../../../../prompting/prompts/novel/chapterReview/dialogue.prompt";
import { getActiveVersionRow } from "../../../../services/novel/volume/volumeWorkspacePersistence";
import { reviewConversationRouter, type Address } from "../discussion";
import { readChapterReviewPlans } from "./plans";

async function read(db: Prisma.TransactionClient, address: Address, contract: RunContract) {
  const rows = await readChapterReviewPlans(db, contract);
  const row = rows.find((chapter) => chapter.id === address.resourceId);
  if (!row) throw new AppError("Seleccione los capítulos que se confirmarán esta vez.", 404);
  const version = await getActiveVersionRow(contract.novelId, db);
  if (!version || version.id !== address.planVersionId)
    throw new AppError("La versión del plan de volumen ha cambiado; vuelva a abrir la página de confirmación del capítulo.", 409);
  const document = JSON.parse(version.contentJson) as VolumePlanDocument;
  const matches =
    document.volumes
      ?.filter((v) => v.id === row.volumeId)
      .flatMap((v) =>
        v.chapters
          .filter((c) => c.id === row.id && c.chapterOrder === row.chapterOrder)
          .map((c) => ({ chapter: c, volumeTitle: v.title })),
      ) ?? [];
  if (matches.length !== 1) throw new AppError("No se puede localizar el capítulo actualmente planeado.", 409);
  const { chapter, volumeTitle } = matches[0];
  const { fields, scenePlan } = chapterReviewForm(row);
  if (!scenePlan) throw new AppError("El contenido de la escena no se puede comprobar elemento por elemento. Regrese al escritorio del director para regenerar esta etapa.", 409);
  const scenes = scenePlan.scenes.map(({ key, title, mustAdvance, mustPreserve, forbiddenExpansion }) => ({
    key,
    title,
    mustAdvance,
    mustPreserve,
    forbiddenExpansion,
  }));
  return {
    base: fields,
    scenes,
    volumeTitle,
    chapter: {
      order: row.chapterOrder,
      title: row.title,
      summary: row.summary,
      purpose: chapter.purpose,
      exclusiveEvent: chapter.exclusiveEvent,
      endingState: chapter.endingState,
      nextChapterEntryState: chapter.nextChapterEntryState,
      styleContract: chapter.styleContract,
    },
  };
}
export function chapterConversationRouter() {
  return reviewConversationRouter(
    "/novels/:novelId/runs/:runId/chapter-review/:version/plans/:planVersionId/chapters/:resourceId/conversation",
    {
      artifact: "chapter_task_sheet",
      scope: "director-chapter",
      stage: "chapter_detail_bundle",
      progress: "Leyendo este capítulo tareas y arreglos de escena...",
      draft: chapterDraftSchema,
      reply: chapterReplySchema,
      changes: chapterProposalChanges,
      read,
      async generate({ chapter, scenes, volumeTitle }, editor, context, options) {
        const result = await runStructuredPrompt({
          asset: chapterReviewDialoguePrompt,
          options,
          promptInput: { ...context, chapter, scenes, volumeTitle, editor },
        });
        const { changes, replyText } = chapterDialogueOutput.parse(result.output);
        return {
          replyText,
          changes: changes.map((item) => ({
            field: item.target === "chapter" ? item.field : sceneFieldKey(item.sceneKey, item.field),
            value: item.value,
            reason: item.reason,
          })),
        };
      },
    },
  );
}
