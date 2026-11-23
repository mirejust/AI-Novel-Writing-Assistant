import type { Router } from "express";
import { z } from "zod";
import { prisma } from "../../../../db/prisma";
import { AppError } from "../../../../middleware/errorHandler";
import { runStructuredPrompt } from "../../../../prompting/core/promptRunner";
import { writingPlatformRecommendationPrompt } from "../../../../prompting/prompts/novel/writingPlatformRecommendation.prompts";
import { supportsWritingPlatformForm, writingPlatformProfileService } from "..";
import { novelEventBus } from "../../../../events/publisher";

const paramsSchema = z.object({ id: z.string().trim().min(1) });
const platformSchema = z.enum(["fanqie_free", "qidian_male", "jinjiang_female", "zhihu_story"]);

export function registerWritingPlatformRoutes(router: Router): void {
  router.post("/:id/writing-platform/recommend", async (req, res, next) => {
    try {
      const { id } = paramsSchema.parse(req.params);
      const novel = await prisma.novel.findUnique({ where: { id } });
      if (!novel) throw new AppError("La novela no existe.", 404);
      const result = await runStructuredPrompt({
        asset: writingPlatformRecommendationPrompt,
        promptInput: {
          narrativeForm: novel.narrativeForm,
          title: novel.title,
          description: novel.description ?? undefined,
          targetAudience: novel.targetAudience ?? undefined,
          bookSellingPoint: novel.bookSellingPoint ?? undefined,
          styleTone: novel.styleTone ?? undefined,
        },
        options: { novelId: id, entrypoint: "novel_settings", stage: "writing_platform_recommend", temperature: 0.25 },
      });
      res.json({ success: true, data: result.output });
    } catch (error) { next(error); }
  });

  router.put("/:id/writing-platform", async (req, res, next) => {
    try {
      const { id } = paramsSchema.parse(req.params);
      const platform = platformSchema.parse(req.body?.platform);
      const novel = await prisma.novel.findUnique({ where: { id } });
      if (!novel) throw new AppError("La novela no existe.", 404);
      if (novel.writingPlatform === platform && novel.writingPlatformSnapshotJson) {
        res.json({ success: true, data: novel });
        return;
      }
      const activeCount = await prisma.novelWorkflowTask.count({
        where: { novelId: id, status: { in: ["queued", "running", "waiting_approval"] } },
      });
      if (activeCount > 0) throw new AppError("La obra se está generando. Complete or cancel the current task before switching the target platform.", 409);
      if (!supportsWritingPlatformForm(platform, novel.narrativeForm)) throw new AppError("La plataforma seleccionada no admite el tamaño de producción actual.", 400);
      const snapshot = await writingPlatformProfileService.snapshot(platform, novel.narrativeForm);
      const updated = await prisma.novel.update({
        where: { id },
        data: {
          writingPlatform: platform,
          writingPlatformProfileVersion: snapshot.profileVersion,
          writingPlatformSnapshotJson: JSON.stringify(snapshot),
        },
      });
      void novelEventBus.emit({
        type: "novel:updated",
        payload: { novelId: id, fields: ["writingPlatform", "writingPlatformSnapshotJson"] },
      }).catch(() => {});
      res.json({ success: true, data: updated });
    } catch (error) { next(error); }
  });
}
