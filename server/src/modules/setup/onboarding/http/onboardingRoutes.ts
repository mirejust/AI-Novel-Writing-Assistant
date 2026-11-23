import { Router } from "express";
import type { ApiResponse } from "@ai-novel/shared/types/api";
import type { CompleteQuickSetupRequest } from "@ai-novel/shared/types/onboarding";
import { z } from "zod";
import { authMiddleware } from "../../../../middleware/auth";
import { validate } from "../../../../middleware/validate";
import {
  completeQuickSetup,
  getQuickSetupStatus,
} from "../application/QuickSetupService";
import { getFirstNovelOnboardingProjection } from "../application/FirstNovelOnboardingService";

const router = Router();

const completeQuickSetupSchema = z.object({
  providerKind: z.enum(["builtin", "custom"]),
  provider: z.string().trim().min(1).optional(),
  customProviderName: z.string().trim().min(1).optional(),
  apiKey: z.string().trim().optional(),
  baseURL: z.string().trim().url("El formato de la dirección API es incorrecto.").optional(),
  model: z.string().trim().min(1, "El nombre del modelo no puede estar vacío."),
});

router.use(authMiddleware);

router.get("/settings/quick-setup/status", async (_req, res, next) => {
  try {
    const data = await getQuickSetupStatus();
    res.status(200).json({
      success: true,
      data,
      message: data.readyForCreation ? "El entorno de creación está disponible." : "También debe completar la configuración del entorno de creación.",
    } satisfies ApiResponse<typeof data>);
  } catch (error) {
    next(error);
  }
});

router.post(
  "/settings/quick-setup/complete",
  validate({ body: completeQuickSetupSchema }),
  async (req, res, next) => {
    try {
      const data = await completeQuickSetup(req.body as CompleteQuickSetupRequest);
      res.status(200).json({
        success: true,
        data,
        message: "El entorno creativo está configurado y puedes empezar a escribir novelas.",
      } satisfies ApiResponse<typeof data>);
    } catch (error) {
      next(error);
    }
  },
);

router.get("/onboarding/first-novel", async (_req, res, next) => {
  try {
    const data = await getFirstNovelOnboardingProjection();
    res.status(200).json({
      success: true,
      data,
      message: "Se ha actualizado el progreso de la redacción del primer libro.",
    } satisfies ApiResponse<typeof data>);
  } catch (error) {
    next(error);
  }
});

export default router;
