import type { Router } from "express";
import { probeIfEnabled } from "../../llm/compatibility/probing";
import type { ApiResponse } from "@ai-novel/shared/types/api";
import { z } from "zod";
import { llmProviderSchema } from "../../llm/providerSchema";
import { validate } from "../../middleware/validate";
import {
  getLLMSelectionSettings,
  saveLLMSelectionSettings,
  type LLMSelectionSettings,
} from "../../services/settings/LLMSelectionSettingsService";

const llmSelectionSchema = z.object({
  provider: llmProviderSchema,
  model: z.string().trim().min(1, "El nombre del modelo no puede estar vacío."),
  temperature: z.coerce.number().min(0).max(2).optional(),
  maxTokens: z.coerce.number().int().min(256).max(32768).optional(),
});

export function registerLLMSelectionRoutes(router: Router): void {
  router.get("/llm-selection", async (_req, res, next) => {
    try {
      const data = await getLLMSelectionSettings();
      res.status(200).json({
        success: true,
        data,
        message: "Se carga la selección del modelo actual.",
      } satisfies ApiResponse<LLMSelectionSettings | null>);
    } catch (error) {
      next(error);
    }
  });

  router.put(
    "/llm-selection",
    validate({ body: llmSelectionSchema }),
    async (req, res, next) => {
      try {
        const data = await saveLLMSelectionSettings(req.body as z.infer<typeof llmSelectionSchema>);
        void probeIfEnabled({ provider: data.provider, model: data.model }).catch(() => undefined);
        res.status(200).json({
          success: true,
          data,
          message: "Se guarda la selección del modelo actual.",
        } satisfies ApiResponse<LLMSelectionSettings>);
      } catch (error) {
        next(error);
      }
    },
  );
}
