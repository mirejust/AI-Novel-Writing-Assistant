import type { CreationIntentInterpretation, ShortStoryRevisionImpact } from "@ai-novel/shared/types/creationStudio";
import { canRetryStructuredTask } from "../../../../platform/llm/diagnostics/StructuredDiagnosticStore";
import { prisma } from "../../../../db/prisma";
import { AppError } from "../../../../middleware/errorHandler";
import { runStructuredPrompt } from "../../../../prompting/core/promptRunner";
import { runShortStoryPlan } from "./shortStoryPlanCall";
import { shortStoryRevisionImpactPrompt } from "../../../../prompting/prompts/shortStory/shortStory.prompts";
import { affectedSegmentIds, parseJson } from "../domain/revisionState";
import { loadRevisionContext, captureBaseline } from "./ShortStoryContext";
import type { RevisionPreviewData } from "./ShortStoryRevisionService";
import { parseWritingPlatformSnapshot, shortStoryPlatformText } from "./shortStoryPromptContext";

export async function previewShortStoryRevision(
  novelId: string, instruction: string, mode: "revision" | "replan" = "revision",
): Promise<ShortStoryRevisionImpact> {
  const context = await loadRevisionContext(novelId);
  if(context.imported)throw new AppError("Para importar cuentos, genere candidatos sección por sección en el espacio de trabajo de revisión del manuscrito y acéptelos claramente; La replanificación de todo el artículo aún no está abierta.",409);
  if (!await canRetryStructuredTask(context.task.id)) throw new AppError("El servicio modelo requiere que vuelvas a intentarlo más tarde; espera antes de continuar.", 429);
  if (context.task.status === "queued" || context.task.status === "running") {
    throw new AppError("Espere hasta que se complete la generación actual antes de obtener una vista previa de los cambios.", 409);
  }
  if (mode === "replan" && context.task.checkpointType !== "replan_required") {
    throw new AppError("No hay ajustes pendientes para este trabajo.", 409);
  }
  if (mode !== "replan" && context.task.checkpointType === "replan_required") {
    throw new AppError("Primero revise el plan de ajuste de la historia.", 409);
  }
  const originalScope = parseJson<{ originalIdea?: string }>(context.activeIntent.impactScopeJson, {});
  const originalIdea = originalScope.originalIdea ?? context.activeIntent.originalExpression;
  const goal = mode === "replan"
    ? "Proponer un plan de ajuste completo basado en los problemas estructurales señalados por la revisión completa. Conserve la intención creativa original y los hechos fijos confirmados, y aclare lo que debe cambiarse. Motivo de la revisión:"
      + (context.task.checkpointSummary ?? "Es necesario replanificar la estructura central")
    : instruction.trim();
  const generated = await runStructuredPrompt({
    asset: shortStoryRevisionImpactPrompt,
    promptInput: {
      reference: context.reference,
      instruction: goal, originalIdea, understanding: context.interpretation.understanding,
      direction: context.direction, plan: context.plan,
      segments: context.segments.map((segment) => ({
        order: segment.order, content: segment.content, humanEdited: Boolean(segment.userEditedAt),
      })),
    },
    options: { novelId, taskId: context.task.id, stage: "short_story_review", itemKey: "revision_preview",
      entrypoint: "short_story_studio", temperature: 0.35 },
  });
  const revision = { ...generated.output, revisedDirection: { ...generated.output.revisedDirection, id: context.direction.id } };
  if (mode === "replan" || revision.recommendedTargetWordCount !== context.plan.targetWordCount) {
    revision.recommendedStrategy = "full_replan";
  }
  const affectedIds = affectedSegmentIds(context.segments, revision.affectedSegmentOrders, revision.recommendedStrategy);
  let candidatePlan: RevisionPreviewData["candidatePlan"] = null;
  if (revision.recommendedStrategy === "full_replan") {
    const planned = await runShortStoryPlan({
      promptInput: {
        originalIdea, understanding: context.interpretation.understanding, direction: revision.revisedDirection,
        targetWordCount: revision.recommendedTargetWordCount, requiredSegmentCount: context.segments.length,
        revisionInstruction: JSON.stringify({
          goal: revision.understoodGoal, previousPlan: context.plan,
          existingSegments: context.segments.map(({ order, content }) => ({ order, content })),
          fixedFacts: context.plan.causalContract?.fixedFacts ?? [],
        }),
        writingPlatform: shortStoryPlatformText(parseWritingPlatformSnapshot(context.novel.writingPlatformSnapshotJson), "planning"),
        productionFoundation: context.productionFoundation, reference: context.reference,
      },
      options: { novelId, taskId: context.task.id, stage: "short_story_plan", itemKey: "revision_replan_preview",
        entrypoint: "short_story_studio", temperature: 0.55 },
    });
    candidatePlan = planned.output;
  }
  const revisedInterpretation: CreationIntentInterpretation = {
    ...context.interpretation, recommendedTargetWordCount: revision.recommendedTargetWordCount,
    directions: context.interpretation.directions.map((direction) => direction.id === context.direction.id
      ? revision.revisedDirection : direction) as CreationIntentInterpretation["directions"],
  };
  const preview: RevisionPreviewData = {
    baseline: captureBaseline(context, affectedIds), originalIdea, mode, candidatePlan,
    selectedDirectionId: context.direction.id, revision,
  };
  // Allocate intent versions under the task lock, after all model requests finish.
  const intentVersion = await prisma.$transaction(async (tx) => {
    await tx.novelWorkflowTask.update({ where: { id: context.task.id }, data: { heartbeatAt: new Date() } });
    const latest = await tx.novelIntentVersion.findFirst({ where: { workflowTaskId: context.task.id }, orderBy: { version: "desc" } });
    return tx.novelIntentVersion.create({ data: {
      novelId, workflowTaskId: context.task.id, previousVersionId: context.activeIntent.id,
      version: (latest?.version ?? context.activeIntent.version) + 1, status: "proposed", source: "revision",
      originalExpression: goal, structuredIntentJson: JSON.stringify(revisedInterpretation),
      impactScopeJson: JSON.stringify(preview),
    } });
  }, { isolationLevel: "Serializable" });
  return {
    intentVersionId: intentVersion.id, understoodGoal: revision.understoodGoal, affectedSegmentIds: affectedIds,
    changesEnding: revision.changesEnding, changesScale: revision.changesScale, changesCoreIntent: revision.changesCoreIntent,
    recommendedTargetWordCount: revision.recommendedTargetWordCount, recommendedStrategy: revision.recommendedStrategy,
    summary: revision.summary, mode, direction: revision.revisedDirection,
    endingPromise: candidatePlan?.endingPromise ?? context.plan.endingPromise,
    preservedFacts: candidatePlan?.causalContract?.fixedFacts ?? context.plan.causalContract?.fixedFacts ?? [],
    segmentPurposes: candidatePlan?.segments.map(({ order, purpose }) => ({ order, purpose })) ?? [],
  };
}
