import { Router } from "express";
import type { ApiResponse } from "@ai-novel/shared/types/api";
import { z } from "zod";
import { llmProviderSchema } from "../llm/providerSchema";
import { authMiddleware } from "../middleware/auth";
import { AppError } from "../middleware/errorHandler";
import { validate } from "../middleware/validate";
import { KnowledgeService } from "../services/knowledge/KnowledgeService";
import { StyleProfileService } from "../services/styleEngine/StyleProfileService";
import { styleExtractionTaskService } from "../services/styleEngine/StyleExtractionTaskService";
import { taskCenterService } from "../services/task/TaskCenterService";

const router = Router();
const styleProfileService = new StyleProfileService();
const knowledgeService = new KnowledgeService();

const providerSchema = llmProviderSchema;

const fromTextSchema = z.object({
  name: z.string().trim().min(1),
  sourceText: z.string().trim().min(1),
  category: z.string().trim().optional(),
  provider: providerSchema.optional(),
  model: z.string().trim().optional(),
  temperature: z.number().min(0).max(2).optional(),
});

const fromTextTaskSchema = fromTextSchema.extend({
  presetKey: z.enum(["imitate", "balanced", "transfer"]).optional(),
});

const sourceProcessingModeSchema = z.enum(["full_text", "representative_sample"]);

const fromKnowledgeDocumentTaskSchema = z.object({
  documentId: z.string().trim().min(1),
  name: z.string().trim().min(1),
  category: z.string().trim().optional(),
  provider: providerSchema.optional(),
  model: z.string().trim().optional(),
  temperature: z.number().min(0).max(2).optional(),
  presetKey: z.enum(["imitate", "balanced", "transfer"]).optional(),
  sourceProcessingMode: sourceProcessingModeSchema.optional(),
});

const styleRulePatchSchema = z.object({
  narrativeRules: z.record(z.string(), z.unknown()).optional(),
  characterRules: z.record(z.string(), z.unknown()).optional(),
  languageRules: z.record(z.string(), z.unknown()).optional(),
  rhythmRules: z.record(z.string(), z.unknown()).optional(),
});

const styleExtractionFeatureSchema = z.object({
  id: z.string().trim().min(1),
  group: z.enum(["narrative", "language", "dialogue", "rhythm", "fingerprint"]),
  label: z.string().trim().min(1),
  description: z.string().trim().min(1),
  evidence: z.string().trim().min(1),
  importance: z.number().min(0).max(1),
  imitationValue: z.number().min(0).max(1),
  transferability: z.number().min(0).max(1),
  fingerprintRisk: z.number().min(0).max(1),
  keepRulePatch: styleRulePatchSchema,
  weakenRulePatch: styleRulePatchSchema.optional(),
});

const styleExtractionPresetSchema = z.object({
  key: z.enum(["imitate", "balanced", "transfer"]),
  label: z.string().trim().min(1),
  summary: z.string().trim().min(1),
  decisions: z.array(z.object({
    featureId: z.string().trim().min(1),
    decision: z.enum(["keep", "weaken", "remove"]),
  })),
});

const styleExtractionDraftSchema = z.object({
  name: z.string().trim().min(1),
  description: z.string().trim().nullable().optional(),
  category: z.string().trim().nullable().optional(),
  tags: z.array(z.string().trim()),
  applicableGenres: z.array(z.string().trim()),
  analysisMarkdown: z.string().nullable().optional(),
  summary: z.string().trim().min(1),
  features: z.array(styleExtractionFeatureSchema),
  presets: z.array(styleExtractionPresetSchema),
  antiAiRuleKeys: z.array(z.string().trim()),
});

const fromExtractionSchema = z.object({
  name: z.string().trim().min(1),
  sourceText: z.string().trim().min(1),
  category: z.string().trim().optional(),
  draft: styleExtractionDraftSchema,
  presetKey: z.enum(["imitate", "balanced", "transfer"]).optional(),
  decisions: z.array(z.object({
    featureId: z.string().trim().min(1),
    decision: z.enum(["keep", "weaken", "remove"]),
  })),
});

router.use(authMiddleware);

router.post("/style-extractions/from-text", validate({ body: fromTextSchema }), async (req, res, next) => {
  try {
    const data = await styleProfileService.extractFromText(req.body as z.infer<typeof fromTextSchema>);
    res.status(200).json({
      success: true,
      data,
      message: "Se completa la extracción de la función de escritura de texto.",
    } satisfies ApiResponse<typeof data>);
  } catch (error) {
    next(error);
  }
});

router.post("/style-extraction-tasks/from-text", validate({ body: fromTextTaskSchema }), async (req, res, next) => {
  try {
    const task = await styleExtractionTaskService.createTask(req.body as z.infer<typeof fromTextTaskSchema>);
    const data = await taskCenterService.getTaskDetail("style_extraction", task.id);
    if (!data) {
      throw new Error("Style extraction task was created but could not be loaded.");
    }
    res.status(202).json({
      success: true,
      data,
      message: "Style extraction task queued.",
    } satisfies ApiResponse<typeof data>);
  } catch (error) {
    next(error);
  }
});

router.post(
  "/style-extraction-tasks/from-knowledge-document",
  validate({ body: fromKnowledgeDocumentTaskSchema }),
  async (req, res, next) => {
    try {
      const body = req.body as z.infer<typeof fromKnowledgeDocumentTaskSchema>;
      const document = await knowledgeService.getDocumentById(body.documentId);
      if (!document) {
        throw new AppError("El documento de la base de conocimientos no existe.", 404);
      }
      if (document.status === "archived") {
        throw new AppError("Los documentos archivados de la base de conocimientos no se pueden utilizar para crear scripts.", 400);
      }

      const activeVersion = document.versions.find((version) => version.isActive);
      if (!activeVersion) {
        throw new AppError("No hay ninguna versión activa disponible para el documento de la base de conocimientos.", 400);
      }
      const sourceText = activeVersion.content;
      if (!sourceText.trim()) {
        throw new AppError("El contenido de la versión activa del documento de la base de conocimientos está vacío y no se puede utilizar para crear métodos de escritura.", 400);
      }

      const task = await styleExtractionTaskService.createTask({
        name: body.name,
        category: body.category,
        sourceText,
        sourceType: "from_knowledge_document",
        sourceRefId: document.id,
        sourceProcessingMode: body.sourceProcessingMode ?? "representative_sample",
        provider: body.provider,
        model: body.model,
        temperature: body.temperature,
        presetKey: body.presetKey,
      });
      const data = await taskCenterService.getTaskDetail("style_extraction", task.id);
      if (!data) {
        throw new Error("Style extraction task was created but could not be loaded.");
      }
      res.status(202).json({
        success: true,
        data,
        message: "Se ha presentado la tarea de extraer el escrito original de la base de conocimientos.",
      } satisfies ApiResponse<typeof data>);
    } catch (error) {
      next(error);
    }
  },
);

router.post("/style-profiles/from-text", validate({ body: fromTextSchema }), async (req, res, next) => {
  try {
    const data = await styleProfileService.createFromText(req.body as z.infer<typeof fromTextSchema>);
    res.status(201).json({
      success: true,
      data,
      message: "La extracción de escritura del texto fue exitosa.",
    } satisfies ApiResponse<typeof data>);
  } catch (error) {
    next(error);
  }
});

router.post("/style-profiles/from-extraction", validate({ body: fromExtractionSchema }), async (req, res, next) => {
  try {
    const data = await styleProfileService.createProfileFromExtraction(req.body as z.infer<typeof fromExtractionSchema>);
    res.status(201).json({
      success: true,
      data,
      message: "Los recursos de escritura se han generado en función de la selección de funciones.",
    } satisfies ApiResponse<typeof data>);
  } catch (error) {
    next(error);
  }
});

export default router;
