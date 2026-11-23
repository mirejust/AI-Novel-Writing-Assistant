import { referenceContract, parseShortStoryReference } from "../../creation-studio/reference";
import type {
  CreationDirection,
  CreationIntentInterpretation,
  ShortStoryPlanContract,
  ShortStoryQualityResult,
} from "@ai-novel/shared/types/creationStudio";
import { prisma } from "../../../../db/prisma";
import { runStructuredPrompt } from "../../../../prompting/core/promptRunner";
import { runShortStoryPlan } from "./shortStoryPlanCall";
import {
  shortStoryFullAuditPrompt,
  shortStoryPatchRepairPrompt,
  shortStorySegmentWritePrompt,
} from "../../../../prompting/prompts/shortStory/shortStory.prompts";
import { ProductionVersionConflictError } from "../../../production/common";
import { NovelWorkflowService } from "../../../../services/novel/workflow/NovelWorkflowService";
import {
  buildShortStoryWriterContextBlocks,
  parseWritingPlatformSnapshot,
  shortStoryProductionFoundationText,
  shortStoryPlatformText,
} from "./shortStoryPromptContext";
import {
  contextWindowForConfiguredModel,
  postRepairKeepsManuscript,
  qualityDebtFromAudit,
  ShortStoryAuditBudgetError,
  shortStoryOnV2Enabled,
  withShortStoryAuditBudget,
} from "./shortStoryAuditPolicy";

interface ActiveIntent {
  originalIdea: string;
  understanding: string;
  direction: CreationDirection;
}

function parseJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function countWords(content: string): number {
  return content.replace(/\s+/g, "").length;
}

import { shortStoryRevisionService } from "./ShortStoryRevisionService";
import { isLegacyRevision } from "../domain/revisionState";

export class ShortStoryProductionService {
  private readonly running = new Set<string>();
  private readonly workflowService = new NovelWorkflowService();
  private readonly v2Enabled: () => boolean;
  private readonly readAuditContextWindow: (provider: string, model: string) => Promise<number | null>;

  constructor(deps: {
    v2Enabled?: () => boolean;
    readAuditContextWindow?: (provider: string, model: string) => Promise<number | null>;
  } = {}) {
    this.v2Enabled = deps.v2Enabled ?? (() => shortStoryOnV2Enabled());
    this.readAuditContextWindow = deps.readAuditContextWindow ?? (async (provider, model) => contextWindowForConfiguredModel(provider, model));
  }

  schedule(taskId: string): void {
    setImmediate(() => {
      void this.run(taskId).catch((error) => {
        console.error(`[short-story] task failed taskId=${taskId}`, error);
      });
    });
  }

  async recoverPending(): Promise<void> {
    const tasks = await prisma.novelWorkflowTask.findMany({
      where: {
        lane: "creation_studio",
        novelId: { not: null },
        status: { in: ["queued", "running"] },
        pendingManualRecovery: false,
        novel: { narrativeForm: "short_story" },
      },
      select: { id: true },
      orderBy: { updatedAt: "asc" },
      take: 20,
    });
    for (const task of tasks) {
      this.schedule(task.id);
    }
  }

  async run(taskId: string): Promise<void> {
    if (this.running.has(taskId)) return;
    this.running.add(taskId);
    try {
      const taskState = await prisma.novelWorkflowTask.findUnique({ where: { id: taskId } });
      if (!taskState || taskState.checkpointType === "replan_required" || taskState.pendingManualRecovery
        || taskState.cancelRequestedAt || (taskState.status !== "queued" && taskState.status !== "running")) return;
      if (taskState.shortStoryOperationId) {
        await shortStoryRevisionService.run(taskState.shortStoryOperationId);
        return;
      }
      const context = await this.loadContext(taskId);
      if (isLegacyRevision(context.task, context.intentRow.source)) {
        await this.workflowService.markTaskFailed(taskId, "Obtenga una vista previa nuevamente y confirme los cambios. Se conservarán el texto y las instantáneas guardados.", {
          stage: "short_story_review", itemKey: "revision_apply", itemLabel: "Obtenga una vista previa del rango de modificación nuevamente",
        });
        return;
      }
      const plan = await this.ensurePlan(context);
      const completedSegments = await this.writePendingSegments(context, plan);
      await this.auditAndRepair(context, plan, completedSegments);
    } catch (error) {
      const task = await prisma.novelWorkflowTask.findUnique({ where: { id: taskId } });
      if (!task?.shortStoryOperationId && task?.checkpointType !== "replan_required" && task?.status !== "cancelled") {
        const message = error instanceof Error ? error.message : "La generación del cuento no está completa.";
        await this.workflowService.markTaskFailed(taskId, message, {
          stage: this.resolveFailureStage(task?.currentItemKey),
          itemLabel: "Generar una interrupción temporal que te permita continuar desde tu ubicación actual",
        });
      }
      throw error;
    } finally {
      this.running.delete(taskId);
    }
  }

  private async loadContext(taskId: string) {
    const task = await prisma.novelWorkflowTask.findUnique({
      where: { id: taskId },
      include: {
        novel: {
          include: {
            genre: true,
            primaryStoryMode: true,
            secondaryStoryMode: true,
          },
        },
        intentVersions: {
          where: { status: "active" },
          orderBy: { version: "desc" },
          take: 1,
        },
      },
    });
    if (!task || task.lane !== "creation_studio" || !task.novel || task.novel.narrativeForm !== "short_story") {
      throw new Error("La tarea de producción corta no existe o la forma de la obra no coincide.");
    }
    const intentRow = task.intentVersions[0];
    if (!intentRow) {
      throw new Error("La producción corta carece de intención creativa.");
    }
    const interpretation = parseJson<CreationIntentInterpretation | null>(intentRow.structuredIntentJson, null);
    const impact = parseJson<{ selectedDirectionId?: string }>(intentRow.impactScopeJson, {});
    const direction = interpretation?.directions.find((item) => item.id === impact.selectedDirectionId);
    if (!interpretation || !direction) {
      throw new Error("La producción de formato corto carece de una dirección creativa confirmada.");
    }
    return {
      task,
      novel: task.novel,
      intentRow,
      intent: {
        originalIdea: intentRow.originalExpression,
        understanding: interpretation.understanding,
        direction,
      } satisfies ActiveIntent,
      targetWordCount: task.novel.targetWordCount ?? interpretation.recommendedTargetWordCount,
      platform: parseWritingPlatformSnapshot(task.novel.writingPlatformSnapshotJson),
      productionFoundation: shortStoryProductionFoundationText(task.novel),
      reference: referenceContract(parseShortStoryReference(task.novel.shortStoryReferenceJson, Boolean(task.novel.referenceBookAnalysisId))),
    };
  }

  private async ensurePlan(context: Awaited<ReturnType<ShortStoryProductionService["loadContext"]>>) {
    const existing = await prisma.shortStoryPlan.findUnique({
      where: { novelId: context.novel.id },
      include: { segments: { orderBy: { order: "asc" } } },
    });
    if (existing) {
      return {
        row: existing,
        contract: parseJson<ShortStoryPlanContract>(existing.structureJson, {
          title: context.novel.title,
          targetWordCount: existing.targetWordCount,
          endingPromise: existing.endingPromise,
          segments: [],
        }),
      };
    }
    await this.assertRunnable(context.task.id);
    await this.workflowService.markTaskRunning(context.task.id, {
      stage: "short_story_plan",
      itemKey: "short_story_plan",
      itemLabel: "Planificación de una historia corta completa",
      progress: 0.16,
    });
    const generated = await runShortStoryPlan({
      beforeRetry: () => this.assertRunnable(context.task.id),
      promptInput: {
        originalIdea: context.intent.originalIdea,
        understanding: context.intent.understanding,
        direction: context.intent.direction,
        targetWordCount: context.targetWordCount,
        writingPlatform: shortStoryPlatformText(context.platform, "planning"),
        productionFoundation: context.productionFoundation, reference: context.reference,
      },
      options: {
        taskId: context.task.id,
        novelId: context.novel.id,
        stage: "short_story_plan",
        entrypoint: "creation_studio",
        temperature: 0.55,
      },
    });
    const row = await prisma.shortStoryPlan.create({
      data: {
        novelId: context.novel.id,
        intentVersionId: context.intentRow.id,
        status: "ready",
        targetWordCount: context.targetWordCount,
        endingPromise: generated.output.endingPromise,
        structureJson: JSON.stringify(generated.output),
        schemaVersion: 2,
        segments: {
          create: generated.output.segments.map((segment) => ({
            novelId: context.novel.id,
            order: segment.order,
            targetWordCount: segment.targetWordCount,
          })),
        },
      },
      include: { segments: { orderBy: { order: "asc" } } },
    });
    return { row, contract: generated.output };
  }

  private async writePendingSegments(
    context: Awaited<ReturnType<ShortStoryProductionService["loadContext"]>>,
    plan: Awaited<ReturnType<ShortStoryProductionService["ensurePlan"]>>,
  ) {
    await prisma.shortStoryPlan.update({
      where: { id: plan.row.id },
      data: { status: "writing" },
    });
    await prisma.shortStorySegment.updateMany({
      where: {
        planId: plan.row.id,
        status: "generating",
        userEditedAt: null,
        updatedAt: { lt: new Date(Date.now() - 5 * 60 * 1000) },
      },
      data: { status: "failed" },
    });
    let previousContinuity = "";
    let previousContentTail = "";
    const rows = await prisma.shortStorySegment.findMany({
      where: { planId: plan.row.id },
      orderBy: { order: "asc" },
    });
    for (const row of rows) {
      await this.assertRunnable(context.task.id);
      if (row.status === "completed" && row.content.trim()) {
        previousContentTail = row.content.slice(-1800);
        previousContinuity = parseJson<{ continuitySummary?: string }>(row.qualityResultJson, {}).continuitySummary ?? previousContinuity;
        continue;
      }
      const segmentPlan = plan.contract.segments.find((item) => item.order === row.order);
      if (!segmentPlan) {
        throw new Error(`Al plan del cuento le falta el primer capítulo. ${row.order} fragmento interno.`);
      }
      await this.workflowService.markTaskRunning(context.task.id, {
        stage: "short_story_draft",
        itemKey: `segment:${row.order}`,
        itemLabel: `El trabajo completo continúa (${row.order}/${rows.length})`,
        progress: 0.24 + (row.order - 1) / rows.length * 0.58,
      });
      const claimed = await prisma.shortStorySegment.updateMany({
        where: {
          id: row.id,
          version: row.version,
          userEditedAt: null,
          status: { in: ["pending", "failed"] },
        },
        data: { status: "generating" },
      });
      if (claimed.count === 0) {
        continue;
      }
      try {
        const writerInput = {
          originalIdea: context.intent.originalIdea,
          understanding: context.intent.understanding,
          direction: context.intent.direction,
          plan: plan.contract,
          segment: segmentPlan,
          previousContinuity,
          previousContentTail,
          writingPlatform: shortStoryPlatformText(context.platform, "drafting"),
          bookStyle: context.novel.styleTone ?? context.intent.direction.styleKeywords.join(","),
          productionFoundation: context.productionFoundation, reference: context.reference,
        };
        const generated = await runStructuredPrompt({
          asset: shortStorySegmentWritePrompt,
          promptInput: writerInput,
          contextBlocks: buildShortStoryWriterContextBlocks({ ...writerInput, platform: context.platform }),
          options: {
            taskId: context.task.id,
            novelId: context.novel.id,
            stage: "short_story_draft",
            itemKey: `segment:${row.order}`,
            entrypoint: "creation_studio",
            temperature: 0.78,
          },
        });
        const saved = await prisma.shortStorySegment.updateMany({
          where: { id: row.id, userEditedAt: null },
          data: {
            content: generated.output.content.trim(),
            status: "completed",
            version: { increment: 1 },
            generatedAt: new Date(),
            qualityResultJson: JSON.stringify({
              continuitySummary: generated.output.continuitySummary,
              wordCount: countWords(generated.output.content),
            }),
          },
        });
        if (saved.count > 0) {
          previousContinuity = generated.output.continuitySummary;
          previousContentTail = generated.output.content.slice(-1800);
        }
      } catch (error) {
        await prisma.shortStorySegment.update({
          where: { id: row.id },
          data: { status: "failed" },
        });
        throw error;
      }
    }
    return prisma.shortStorySegment.findMany({
      where: { planId: plan.row.id },
      orderBy: { order: "asc" },
    });
  }

  private async auditAndRepair(
    context: Awaited<ReturnType<ShortStoryProductionService["loadContext"]>>,
    plan: Awaited<ReturnType<ShortStoryProductionService["ensurePlan"]>>,
    segments: Awaited<ReturnType<ShortStoryProductionService["writePendingSegments"]>>,
  ): Promise<void> {
    await this.assertRunnable(context.task.id);
    if (segments.some((segment) => segment.status !== "completed" || !segment.content.trim())) {
      throw new Error("El cuento aún tiene secciones inacabadas y no se puede revisar en su totalidad.");
    }
    const content = segments.map((segment) => segment.content.trim()).join("\n\n");
    await prisma.shortStoryPlan.update({ where: { id: plan.row.id }, data: { status: "reviewing" } });
    await this.workflowService.markTaskRunning(context.task.id, {
      stage: "short_story_review",
      itemKey: "full_audit",
      itemLabel: "Comprobando el manuscrito completo",
      progress: 0.9,
    });
    const audited = await this.auditManuscript(context, plan, content, "full_audit");
    if (!audited) return;
    await prisma.shortStoryPlan.update({
      where: { id: plan.row.id },
      data: { auditResultJson: JSON.stringify(audited.output) },
    });
    if (audited.output.decision === "replan_required") {
      await this.workflowService.recordCheckpoint(context.task.id, {
        stage: "short_story_review",
        checkpointType: "replan_required",
        checkpointSummary: audited.output.summary,
        itemLabel: "Necesidad de reconfirmar la dirección de la historia.",
        progress: 0.92,
      });
      return;
    }

    let qualityDebt: string[] = [];
    if (audited.output.decision === "patchable") {
        const repaired = await this.generateSingleRepair(context, plan, segments, audited.output, content);
        const candidate = segments.map(segment => ({ ...segment,
          content: segment.userEditedAt ? segment.content : repaired.patches.find(patch => patch.segmentOrder === segment.order)?.content.trim() ?? segment.content,
        }));
        const reviewed = await this.auditManuscript(context, plan, candidate.map(segment => segment.content.trim()).join("\n\n"), "repair_review");
        if (!reviewed) return;
        console.info("[short-story.review]", { taskId: context.task.id, originalWordCount: countWords(content),
          candidateWordCount: countWords(candidate.map(segment => segment.content).join("\n\n")), decision: reviewed.output.decision });
        if (postRepairKeepsManuscript(reviewed.output.decision)) {
          await prisma.$transaction(async tx => {
            const current = await tx.shortStorySegment.findMany({ where: { planId: plan.row.id } });
            if (current.length !== segments.length || segments.some(before => !current.some(row => row.id === before.id && row.version === before.version))) {
              throw new ProductionVersionConflictError();
            }
            for (const segment of candidate) {
              if (segment.content === segments.find(row => row.id === segment.id)!.content) continue;
              const saved = await tx.shortStorySegment.updateMany({ where: { id: segment.id, version: segment.version, userEditedAt: null },
                data: { content: segment.content, version: { increment: 1 }, generatedAt: new Date(), qualityResultJson: JSON.stringify({ repairedFromAudit: true }) } });
              if (saved.count !== 1) throw new ProductionVersionConflictError();
            }
            await tx.shortStoryPlan.update({ where: { id: plan.row.id }, data: { auditResultJson: JSON.stringify(reviewed.output) } });
          });
        } else {
          qualityDebt = qualityDebtFromAudit(audited.output);
        }
    }
    await prisma.shortStoryPlan.update({
      where: { id: plan.row.id },
      data: {
        status: "completed",
        qualityDebtJson: JSON.stringify(qualityDebt),
      },
    });
    await this.workflowService.recordCheckpoint(context.task.id, {
      stage: "short_story_review",
      checkpointType: "workflow_completed",
      checkpointSummary: qualityDebt.length > 0
        ? "Se ha entregado el manuscrito completo, pero aún quedan algunas sugerencias para una mayor optimización."
        : "El manuscrito completo ha sido generado y revisado en su totalidad.",
      itemLabel: "La obra completa está lista.",
      progress: 1,
    });
  }

  private async auditManuscript(
    context: Awaited<ReturnType<ShortStoryProductionService["loadContext"]>>,
    plan: Awaited<ReturnType<ShortStoryProductionService["ensurePlan"]>>,
    content: string,
    itemKey: "full_audit" | "repair_review",
  ) {
    const request = {
      asset: shortStoryFullAuditPrompt,
      promptInput: {
        originalIdea: context.intent.originalIdea,
        understanding: context.intent.understanding,
        direction: context.intent.direction,
        plan: plan.contract,
        content,
        writingPlatform: shortStoryPlatformText(context.platform, "auditing"),
        productionFoundation: context.productionFoundation, reference: context.reference,
      },
      options: {
        taskId: context.task.id,
        novelId: context.novel.id,
        stage: "short_story_review",
        itemKey,
        entrypoint: "creation_studio",
        temperature: 0.25,
        maxTokens: this.v2Enabled() ? undefined : 5000,
      },
    };
    try {
      return await (this.v2Enabled()
        ? withShortStoryAuditBudget(this.readAuditContextWindow, () => runStructuredPrompt(request))
        : runStructuredPrompt(request));
    } catch (error) {
      if (!(error instanceof ShortStoryAuditBudgetError)) throw error;
      await this.workflowService.recordCheckpoint(context.task.id, {
        stage: "short_story_review", checkpointType: "step_review_required", checkpointSummary: error.message,
        itemLabel: "Por favor verifique el alcance del contexto del modelo.", progress: 0.9,
      });
      return null;
    }
  }

  private async generateSingleRepair(
    context: Awaited<ReturnType<ShortStoryProductionService["loadContext"]>>,
    plan: Awaited<ReturnType<ShortStoryProductionService["ensurePlan"]>>,
    segments: Awaited<ReturnType<ShortStoryProductionService["writePendingSegments"]>>,
    audit: ShortStoryQualityResult,
    content: string,
  ) {
    await this.workflowService.markTaskRunning(context.task.id, {
      stage: "short_story_review",
      itemKey: "single_patch",
      itemLabel: "Se están completando las modificaciones necesarias.",
      progress: 0.95,
    });
    const repaired = await runStructuredPrompt({
      asset: shortStoryPatchRepairPrompt,
      promptInput: {
        originalIdea: context.intent.originalIdea,
        understanding: context.intent.understanding,
        direction: context.intent.direction,
        plan: plan.contract,
        content,
        audit,
        segments: segments.map((segment) => ({
          order: segment.order,
          content: segment.content,
          humanEdited: Boolean(segment.userEditedAt),
        })),
        writingPlatform: shortStoryPlatformText(context.platform, "repairing"),
        productionFoundation: context.productionFoundation, reference: context.reference,
      },
      options: {
        taskId: context.task.id,
        novelId: context.novel.id,
        stage: "short_story_review",
        itemKey: "single_patch",
        entrypoint: "creation_studio",
        temperature: 0.45,
        maxTokens: 12000,
      },
    });
    return repaired.output;
  }

  private async assertRunnable(taskId: string): Promise<void> {
    const task = await prisma.novelWorkflowTask.findUnique({
      where: { id: taskId },
      select: { status: true, cancelRequestedAt: true },
    });
    if (!task || task.status === "cancelled" || task.cancelRequestedAt) {
      throw new Error("WORKFLOW_TASK_CANCELLED");
    }
  }

  private resolveFailureStage(itemKey: string | null | undefined) {
    if (itemKey === "full_audit" || itemKey === "repair_review" || itemKey === "single_patch") return "short_story_review" as const;
    if (itemKey?.startsWith("segment:")) return "short_story_draft" as const;
    return "short_story_plan" as const;
  }
}

export const shortStoryProductionService = new ShortStoryProductionService();
