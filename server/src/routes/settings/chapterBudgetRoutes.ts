import type {Router} from "express";
import {directorChapterBudgetSettingsSchema} from "@ai-novel/shared/types/director/chapterBudget";
import {validate} from "../../middleware/validate";
import {getDirectorChapterBudgetSettings, saveDirectorChapterBudgetSettings} from "../../services/settings/chapterBudget";

export function registerChapterBudgetSettingsRoutes(router: Router): void {
  router.get("/auto-director/chapter-budget", async (_req, res, next) => {
    try {res.json({success: true, data: await getDirectorChapterBudgetSettings()});}
    catch (error) {next(error);}
  });
  router.put("/auto-director/chapter-budget", validate({body: directorChapterBudgetSettingsSchema}), async (req, res, next) => {
    try {res.json({success: true, data: await saveDirectorChapterBudgetSettings(req.body), message: "El límite de uso de IA para un solo capítulo se ha guardado y se utilizará para nuevas misiones."});}
    catch (error) {next(error);}
  });
}
