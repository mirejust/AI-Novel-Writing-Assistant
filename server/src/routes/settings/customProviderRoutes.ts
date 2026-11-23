import { probeIfEnabled, setAutoProbe } from "../../llm/compatibility/probing";
import type { Router } from "express";
import type { ApiResponse } from "@ai-novel/shared/types/api";
import {
  PROVIDER_AUTH_MODES,
  REASONING_EFFORTS,
  type ProviderAuthMode,
  type ReasoningEffort,
} from "@ai-novel/shared/types/llm";
import { z } from "zod";
import { prisma } from "../../db/prisma";
import { setProviderSecretCache } from "../../llm/factory";
import { evictSharedLimiters } from "../../llm/requestLimiter";
import { refreshProviderModels, serializeModelList } from "../../llm/modelCatalog";
import { isDeepSeekThinkingModeProvider, normalizeReasoningEffort } from "../../llm/reasoning";
import { llmProviderSchema } from "../../llm/providerSchema";
import { isBuiltInProvider } from "../../llm/providers";
import { AppError } from "../../middleware/errorHandler";
import { validate } from "../../middleware/validate";
import {
  getImageModelOptions,
  saveProviderImageModel,
} from "../../services/settings/ProviderImageSettingsService";
import { getLLMSelectionSettings } from "../../services/settings/LLMSelectionSettingsService";
import { getRagEmbeddingSettings } from "../../services/settings/RagSettingsService";
import { getRagRuntimeSettings } from "../../services/settings/RagRuntimeSettingsService";
import { secretStore } from "../../services/settings/secretStore";

const MAX_PROVIDER_CONCURRENCY_LIMIT = 100;
const MAX_PROVIDER_REQUEST_INTERVAL_MS = 3_600_000;

const providerSchema = z.object({
  provider: llmProviderSchema,
});

const createCustomProviderSchema = z.object({
  name: z.string().trim().min(1),
  key: z.string().trim().optional(),
  model: z.string().trim().optional(),
  imageModel: z.string().trim().optional(),
  baseURL: z.string().trim().url("La URL de la API no tiene el formato correcto."),
  authMode: z.enum(PROVIDER_AUTH_MODES).optional(),
  isActive: z.boolean().optional(),
  reasoningEnabled: z.boolean().optional(),
  reasoningEffort: z.enum(REASONING_EFFORTS).optional(),
  concurrencyLimit: z.coerce.number().int().min(0).max(MAX_PROVIDER_CONCURRENCY_LIMIT).optional(),
  requestIntervalMs: z.coerce.number().int().min(0).max(MAX_PROVIDER_REQUEST_INTERVAL_MS).optional(),
});

const customProviderModelsSchema = z.object({
  key: z.string().trim().optional(),
  baseURL: z.string().trim().url("La URL de la API no tiene el formato correcto."),
  authMode: z.enum(PROVIDER_AUTH_MODES).optional(),
});

type APIKeyRecordLike = {
  provider: string;
  displayName: string | null;
  key: string | null;
  model: string | null;
  baseURL: string | null;
  authMode: string;
  isActive: boolean;
  reasoningEnabled?: boolean | null;
  reasoningEffort?: string | null;
  hiddenModels?: string | null;
  availableModels?: string | null;
  concurrencyLimit?: number | null;
  requestIntervalMs?: number | null;
};

function normalizeOptionalText(value: string | null | undefined): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed || undefined;
}

function normalizeProviderLimit(value: number | null | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return 0;
  }
  return Math.floor(value);
}

function buildCustomProviderId(name: string): string {
  const normalized = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return `custom_${normalized || "provider"}`;
}

async function ensureUniqueCustomProviderId(name: string): Promise<string> {
  const baseId = buildCustomProviderId(name);
  let candidate = baseId;
  let suffix = 2;
  while (await secretStore.hasProvider(candidate)) {
    candidate = `${baseId}_${suffix}`;
    suffix += 1;
  }
  return candidate;
}

function getFallbackModels(currentModel?: string): string[] {
  return Array.from(new Set([currentModel ?? ""].filter(Boolean)));
}

function isModelFetchError(error: Error): boolean {
  return /failed|empty|失败|为空/i.test(error.message);
}

export function registerCustomProviderRoutes(router: Router): void {
  router.post(
    "/custom-providers/models",
    validate({ body: customProviderModelsSchema }),
    async (req, res, next) => {
      try {
        const body = req.body as z.infer<typeof customProviderModelsSchema>;
        if (body.authMode === "x-api-key" && !normalizeOptionalText(body.key)) {
          throw new AppError("La autenticación x-api-key requiere completar la clave API.", 400);
        }
        const models = await refreshProviderModels(
          "custom_preview",
          normalizeOptionalText(body.key),
          body.baseURL.trim(),
          body.authMode,
        );
        res.status(200).json({
          success: true,
          data: {
            models,
            defaultModel: models[0] ?? "",
          },
          message: `Obtenido ${models.length} modelo.`,
        } satisfies ApiResponse<{
          models: string[];
          defaultModel: string;
        }>);
      } catch (error) {
        if (error instanceof Error && isModelFetchError(error)) {
          next(new AppError(error.message, 400));
          return;
        }
        next(error);
      }
    },
  );

  router.post(
    "/custom-providers",
    validate({ body: createCustomProviderSchema }),
    async (req, res, next) => {
      try {
        const body = req.body as z.infer<typeof createCustomProviderSchema>;
        const provider = await ensureUniqueCustomProviderId(body.name);
        const apiKey = normalizeOptionalText(body.key);
        const baseURL = body.baseURL.trim();
        const authMode = body.authMode ?? "bearer";
        if (authMode === "x-api-key" && !apiKey) {
          throw new AppError("La autenticación x-api-key requiere completar la clave API.", 400);
        }
        let model = normalizeOptionalText(body.model);
        let models = getFallbackModels(model);
        let message = "Proveedor personalizado creado.";

        try {
          models = await refreshProviderModels(provider, apiKey, baseURL, authMode);
          model = model ?? models[0];
        } catch (error) {
          if (!model) {
            const detail = error instanceof Error ? `:${error.message}` : ".";
            throw new AppError(`No se pudo obtener la lista de modelos. Verifique la URL de la API o complete manualmente un modelo predeterminado.${detail}`, 400);
          }
          message = "Se creó el fabricante personalizado, pero falló la actualización de la lista de modelos. Se puede actualizar más tarde en la tarjeta de proveedor.";
        }

        const data = await secretStore.createProvider(provider, {
          displayName: body.name.trim(),
          key: apiKey ?? null,
          model: model ?? null,
          baseURL,
          authMode,
          isActive: body.isActive ?? true,
          reasoningEnabled: body.reasoningEnabled ?? false,
          reasoningEffort: normalizeReasoningEffort(body.reasoningEffort),
          hiddenModels: "[]",
          availableModels: serializeModelList(models),
          concurrencyLimit: body.concurrencyLimit ?? 0,
          requestIntervalMs: body.requestIntervalMs ?? 0,
        }) as APIKeyRecordLike;
        setProviderSecretCache(provider, data.isActive ? {
          displayName: data.displayName ?? undefined,
          key: data.key ?? undefined,
          model: data.model ?? undefined,
          baseURL: data.baseURL ?? undefined,
          authMode: data.authMode as ProviderAuthMode,
          reasoningEnabled: data.reasoningEnabled ?? true,
          reasoningEffort: normalizeReasoningEffort(data.reasoningEffort),
          concurrencyLimit: data.concurrencyLimit ?? 0,
          requestIntervalMs: data.requestIntervalMs ?? 0,
        } : null);
        // New custom providers probe compatibility by default so structured calls
        // can turn reasoning off from the first use. The per-provider switch in
        // the compatibility section can turn this back off.
        await setAutoProbe(provider, true).catch(() => undefined);
        void probeIfEnabled({ provider, model: data.model ?? undefined, baseURL: data.baseURL ?? undefined }).catch(() => undefined);
        const imageModel = await saveProviderImageModel(provider, body.imageModel);
        const imageModels = Array.from(new Set([
          ...getImageModelOptions(provider),
          imageModel ?? "",
        ].filter(Boolean)));
        const supportsReasoningEffort = isDeepSeekThinkingModeProvider(provider, data.baseURL ?? undefined, data.model ?? undefined);
        res.status(201).json({
          success: true,
          data: {
            provider: data.provider,
            displayName: data.displayName,
            model: data.model,
            imageModel: imageModel ?? null,
            baseURL: data.baseURL,
            authMode: data.authMode as ProviderAuthMode,
            isActive: data.isActive,
            reasoningEnabled: data.reasoningEnabled ?? true,
            reasoningEffort: supportsReasoningEffort ? normalizeReasoningEffort(data.reasoningEffort) : null,
            supportsReasoningEffort,
            hiddenModels: [],
            concurrencyLimit: normalizeProviderLimit(data.concurrencyLimit),
            requestIntervalMs: normalizeProviderLimit(data.requestIntervalMs),
            models,
            imageModels,
            supportsImageGeneration: Boolean(imageModel),
          },
          message,
        } satisfies ApiResponse<{
          provider: string;
          displayName: string | null;
          model: string | null;
          imageModel: string | null;
          baseURL: string | null;
          authMode: ProviderAuthMode;
          isActive: boolean;
          reasoningEnabled: boolean;
          reasoningEffort: ReasoningEffort | null;
          supportsReasoningEffort: boolean;
          hiddenModels: string[];
          concurrencyLimit: number;
          requestIntervalMs: number;
          models: string[];
          imageModels: string[];
          supportsImageGeneration: boolean;
        }>);
      } catch (error) {
        next(error);
      }
    },
  );

  router.delete(
    "/custom-providers/:provider",
    validate({ params: providerSchema }),
    async (req, res, next) => {
      try {
        const { provider } = req.params as z.infer<typeof providerSchema>;
        if (isBuiltInProvider(provider)) {
          throw new AppError("Los fabricantes integrados no se pueden eliminar.", 400);
        }
        const existing = await secretStore.getProvider(provider);
        if (!existing) {
          throw new AppError("Este fabricante personalizado no fue encontrado.", 404);
        }
        const [routeInUse, selection, ragSettings, ragRuntimeSettings] = await Promise.all([
          prisma.modelRouteConfig.findFirst({ where: { provider }, select: { taskType: true } }),
          getLLMSelectionSettings(),
          getRagEmbeddingSettings(),
          getRagRuntimeSettings(),
        ]);
        if (routeInUse) {
          throw new AppError(`Enrute primero el modelo ${routeInUse.taskType} Cambie a otro fabricante y luego elimine este fabricante.`, 400);
        }
        if (selection?.provider === provider) {
          throw new AppError("El modelo predeterminado superior utiliza este fabricante; cambie primero al modelo predeterminado.", 400);
        }
        if (ragRuntimeSettings.enabled && ragSettings.embeddingProvider === provider) {
          throw new AppError("La base de conocimientos utiliza este servicio vectorial. Primero cambie al servicio vectorial o suspenda la recuperación de datos.", 400);
        }
        await secretStore.deleteProvider(provider);
        await saveProviderImageModel(provider, null);
        setProviderSecretCache(provider, null);
        evictSharedLimiters(provider);
        res.status(200).json({
          success: true,
          message: "Proveedor personalizado eliminado.",
        } satisfies ApiResponse<null>);
      } catch (error) {
        next(error);
      }
    },
  );
}
