import {
  proseDialogueOutput,
  proseParagraphs,
  proseDraftSchema,
  proseChanges,
  proseReply,
} from "@ai-novel/shared/types/director/proseReview/discussion";
import { hashProductionContent } from "../../../../modules/production";
import { AppError } from "../../../../middleware/errorHandler";
import { runStructuredPrompt } from "../../../../prompting/core/promptRunner";
import { proseReviewDialoguePrompt } from "../../../../prompting/prompts/novel/proseReview/dialogue.prompt";
import { reviewConversationRouter } from "../discussion";

export function proseConversationRouter() {
  return reviewConversationRouter(
    "/novels/:novelId/runs/:runId/prose-review/:version/versions/:bodyHash/chapters/:resourceId/conversation",
    {
      artifact: "chapter_batch_closed",
      scope: "director-prose",
      stage: "chapter_batch",
      progress: "Leyendo el texto de este capítulo…",
      draft: proseDraftSchema,
      reply: proseReply,
      changes: proseChanges,
      async read(db, address, contract) {
        const range = contract.chapterRange;
        if (!range) throw new AppError("No hay lugar para discusión en este momento.", 409);
        const chapters = await db.chapter.findMany({
          where: { novelId: contract.novelId, order: { gte: range.from, lte: range.to } },
          orderBy: { order: "asc" },
          select: { id: true, order: true, title: true, content: true, taskSheet: true, mustAvoid: true },
        });
        if (
          chapters.length !== range.to - range.from + 1 ||
          chapters.some((row, i) => row.order !== range.from + i || !row.content?.trim())
        ) {
          throw new AppError("Hay cambios en el texto de este lote, vuelva a abrir la página de confirmación.", 409);
        }
        const row = chapters.find((chapter) => chapter.id === address.resourceId);
        if (!row) throw new AppError("Seleccione un capítulo para este lote.", 404);
        if (address.bodyHash !== hashProductionContent(row.content!))
          throw new AppError("Hay una nueva versión del texto de este capítulo; vuelva a abrirla para su discusión.", 409);
        const { order, title, taskSheet, mustAvoid } = row;
        return { base: proseParagraphs(row.content!).fields, chapter: { order, title, taskSheet, mustAvoid } };
      },
      async generate({ chapter }, editor, context, options) {
        const result = await runStructuredPrompt({
          asset: proseReviewDialoguePrompt,
          options,
          promptInput: { ...context, chapter, editor },
        });
        const { replyText, changes } = proseDialogueOutput.parse(result.output);
        return {
          replyText,
          changes: changes.map(({ paragraph, value, reason }) => ({ field: String(paragraph), value, reason })),
        };
      },
    },
  );
}
