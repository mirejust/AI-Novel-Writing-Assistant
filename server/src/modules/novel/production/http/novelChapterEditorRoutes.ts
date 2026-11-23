import type { Router } from "express";
import type { ApiResponse } from "@ai-novel/shared/types/api";
import { z } from "zod";
import { AppError } from "../../../../middleware/errorHandler";
import { validate } from "../../../../middleware/validate";
import type { NovelApplicationServices } from "../../../../services/novel/application/NovelApplicationContracts";

interface RegisterNovelChapterEditorRoutesInput {
  router: Router;
  novelService: Pick<NovelApplicationServices,
    | "getChapterEditorWorkspace"
    | "previewChapterAiRevision"
    | "previewChapterCursorContinuation"
    | "previewChapterRewrite"
  >;
  chapterParamsSchema: z.ZodType<{ id: string; chapterId: string }>;
  rewritePreviewSchema: z.ZodTypeAny;
  aiRevisionPreviewSchema: z.ZodTypeAny;
  cursorContinuationPreviewSchema: z.ZodTypeAny;
  forwardBusinessError: (error: unknown, next: (err?: unknown) => void) => boolean;
}

export function registerNovelChapterEditorRoutes(input: RegisterNovelChapterEditorRoutesInput): void {
  const {
    router,
    novelService,
    chapterParamsSchema,
    rewritePreviewSchema,
    aiRevisionPreviewSchema,
    cursorContinuationPreviewSchema,
    forwardBusinessError,
  } = input;

  router.get(
    "/:id/chapters/:chapterId/editor/workspace",
    validate({ params: chapterParamsSchema }),
    async (req, res, next) => {
      try {
        const { id, chapterId } = req.params as z.infer<typeof chapterParamsSchema>;
        const data = await novelService.getChapterEditorWorkspace(id, chapterId);
        res.status(200).json({
          success: true,
          data,
          message: "Chapter editor workspace loaded.",
        } satisfies ApiResponse<typeof data>);
      } catch (error) {
        if (forwardBusinessError(error, next)) {
          return;
        }
        if (error instanceof Error && ["La novela no existe.", "El capítulo no existe."].includes(error.message)) {
          next(new AppError(error.message, 400));
          return;
        }
        next(error);
      }
    },
  );

  router.post(
    "/:id/chapters/:chapterId/editor/continue-preview",
    validate({ params: chapterParamsSchema, body: cursorContinuationPreviewSchema }),
    async (req, res, next) => {
      try {
        const { id, chapterId } = req.params as z.infer<typeof chapterParamsSchema>;
        const data = await novelService.previewChapterCursorContinuation(id, chapterId, req.body as any);
        res.status(200).json({
          success: true,
          data,
          message: "Chapter editor cursor continuation preview generated.",
        } satisfies ApiResponse<typeof data>);
      } catch (error) {
        if (forwardBusinessError(error, next)) {
          return;
        }
        if (
          error instanceof Error
          && [
            "La novela no existe.",
            "El capítulo no existe.",
            "El texto del capítulo actual está vacío y no se puede iniciar la continuación de la IA. Primero escriba al menos un párrafo de texto.",
            "La posición del cursor de texto ha cambiado. Vuelva a colocar el cursor e inténtelo de nuevo.",
            "AI no devolvió suficientes candidatos de continuación. Inténtelo de nuevo.",
          ].includes(error.message)
        ) {
          next(new AppError(error.message, 400));
          return;
        }
        next(error);
      }
    },
  );

  router.post(
    "/:id/chapters/:chapterId/editor/ai-revision-preview",
    validate({ params: chapterParamsSchema, body: aiRevisionPreviewSchema }),
    async (req, res, next) => {
      try {
        const { id, chapterId } = req.params as z.infer<typeof chapterParamsSchema>;
        const data = await novelService.previewChapterAiRevision(id, chapterId, req.body as any);
        res.status(200).json({
          success: true,
          data,
          message: "Chapter editor AI revision preview generated.",
        } satisfies ApiResponse<typeof data>);
      } catch (error) {
        if (forwardBusinessError(error, next)) {
          return;
        }
        if (
          error instanceof Error
          && [
            "La novela no existe.",
            "El capítulo no existe.",
            "El texto del capítulo actual está vacío y no se puede iniciar la corrección de IA.",
            "La corrección de fragmentos requiere seleccionar primero el contenido del texto.",
            "El rango de selección no es válido, seleccione nuevamente e inténtelo nuevamente.",
            "El texto seleccionado no puede estar vacío.",
            "El texto seleccionado ha cambiado, selecciónelo nuevamente e inténtelo nuevamente.",
            "Empiece por escribir cómo desea que se modifique la IA.",
            "AI no devolvió suficientes versiones candidatas. Inténtelo de nuevo.",
          ].includes(error.message)
            || (error instanceof Error && error.message.includes("Las revisiones de capítulos completos están actualmente limitadas a"))
        ) {
          next(new AppError(error.message, 400));
          return;
        }
        next(error);
      }
    },
  );

  router.post(
    "/:id/chapters/:chapterId/editor/rewrite-preview",
    validate({ params: chapterParamsSchema, body: rewritePreviewSchema }),
    async (req, res, next) => {
      try {
        const { id, chapterId } = req.params as z.infer<typeof chapterParamsSchema>;
        const data = await novelService.previewChapterRewrite(id, chapterId, req.body as any);
        res.status(200).json({
          success: true,
          data,
          message: "Chapter editor rewrite preview generated.",
        } satisfies ApiResponse<typeof data>);
      } catch (error) {
        if (forwardBusinessError(error, next)) {
          return;
        }
        if (
          error instanceof Error
          && [
            "La novela no existe.",
            "El capítulo no existe.",
            "El texto del capítulo actual está vacío y no se puede iniciar una reescritura parcial.",
            "El rango de selección no es válido, seleccione nuevamente e inténtelo nuevamente.",
            "El texto seleccionado no puede estar vacío.",
            "El texto seleccionado ha cambiado, selecciónelo nuevamente e inténtelo nuevamente.",
            "AI no devolvió suficientes versiones candidatas. Inténtelo de nuevo.",
          ].includes(error.message)
        ) {
          next(new AppError(error.message, 400));
          return;
        }
        next(error);
      }
    },
  );
}
