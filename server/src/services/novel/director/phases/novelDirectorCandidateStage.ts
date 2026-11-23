import { DirectorTaskStateWriter } from "../state";
import { randomUUID } from "node:crypto";
import {
  DIRECTOR_CANDIDATE_SETUP_STEPS,
  type DirectorCandidate,
  type DirectorCandidateBatch,
  type DirectorCandidatePatchRequest,
  type DirectorCandidatePatchResponse,
  type DirectorCandidateTitleRefineRequest,
  type DirectorCandidateTitleRefineResponse,
  type DirectorCandidatesRequest,
  type DirectorCandidatesResponse,
  type DirectorCorrectionPreset,
  type DirectorRefineResponse,
  type DirectorRefinementRequest,
} from "@ai-novel/shared/types/novelDirector";
import type { NovelCreateResourceRecommendation } from "@ai-novel/shared/types/novelResourceRecommendation";
import { runCandidateStructuredCall } from "./candidateStructuredCall";
import { runStructuredPrompt } from "../../../../prompting/core/promptRunner";
import { novelCreateResourceRecommendationService } from "../../NovelCreateResourceRecommendationService";
import {
  buildDirectorCandidateContextBlocks,
  directorCandidatePatchPrompt,
  directorCandidatePrompt,
  directorDirectionPairPrompt,
} from "../../../../prompting/prompts/novel/directorPlanning.prompts";
import { titleGenerationService } from "../../../title/TitleGenerationService";
import type { NovelWorkflowService } from "../../workflow/NovelWorkflowService";
import {
  buildCandidateTitleBrief,
  buildRefinementSummary,
  buildWorkflowSeedPayload,
  enhanceCandidateTitles,
  mergeTitleOptions,
  normalizeCandidate,
  selectDistinctCandidateTitle,
  type CandidateGenerationContext,
} from "../runtime/novelDirectorHelpers";
import { DIRECTOR_PROGRESS } from "../projections/novelDirectorProgress";
import { marketRadarService } from "../../../../modules/marketRadar/application/MarketRadarService";

type WorkflowDependency = Pick<NovelWorkflowService, "bootstrapTask" | "markTaskRunning" | "recordCandidateSelectionRequired">;

function clampTemperature(value: number | undefined, ceiling: number): number {
  return Math.min(value ?? ceiling, ceiling);
}

function findTargetBatch(previousBatches: DirectorCandidateBatch[], batchId: string): DirectorCandidateBatch {
  const batch = previousBatches.find((item) => item.id === batchId);
  if (!batch) {
    throw new Error("La ronda del escenario objetivo no existe.");
  }
  return batch;
}

function findTargetCandidate(batch: DirectorCandidateBatch, candidateId: string): DirectorCandidate {
  const candidate = batch.candidates.find((item) => item.id === candidateId);
  if (!candidate) {
    throw new Error("La solución objetivo no existe.");
  }
  return candidate;
}

function replaceCandidateInBatch(
  batch: DirectorCandidateBatch,
  nextCandidate: DirectorCandidate,
  summary: string,
): DirectorCandidateBatch {
  return {
    ...batch,
    refinementSummary: summary,
    candidates: batch.candidates.map((candidate) => (
      candidate.id === nextCandidate.id ? nextCandidate : candidate
    )),
  };
}

function replaceBatchInList(
  batches: DirectorCandidateBatch[],
  nextBatch: DirectorCandidateBatch,
): DirectorCandidateBatch[] {
  return batches.map((batch) => (batch.id === nextBatch.id ? nextBatch : batch));
}

export class NovelDirectorCandidateStageService {
  constructor(private readonly workflowService: WorkflowDependency) {}

  private async markCandidateProgress(
    workflowTaskId: string | undefined,
    itemKey: typeof DIRECTOR_CANDIDATE_SETUP_STEPS[number]["key"],
    itemLabel: string,
    progress: number,
  ): Promise<void> {
    if (!workflowTaskId?.trim()) {
      return;
    }
    await new DirectorTaskStateWriter(this.workflowService).markRunning(workflowTaskId, {
      stage: "auto_director",
      itemKey,
      itemLabel,
      progress,
    });
  }

  private async generateBatch(context: CandidateGenerationContext & {
    workflowTaskId?: string;
    productionFoundation?: NovelCreateResourceRecommendation;
  }): Promise<{ batch: DirectorCandidateBatch }> {
    await this.markCandidateProgress(
      context.workflowTaskId,
      "candidate_direction_batch",
      "Buscando dos direcciones de historia diferentes para tu idea",
      DIRECTOR_PROGRESS.candidateDirectionBatch,
    );

    const latestBatch = context.batches.at(-1);
    const productionFoundation = context.productionFoundation
      ?? latestBatch?.candidates[0]?.productionFoundation;
    const request = {
      ...context.request,
      productionFoundationPrompt: context.request.productionFoundationPrompt || JSON.stringify(productionFoundation),
    };
    const promptInput = {
      idea: context.idea, context: request, count: context.count, batches: context.batches,
      presets: context.presets, feedback: context.feedback,
    };
    const contextBlocks = buildDirectorCandidateContextBlocks({ ...promptInput, latestBatch });
    const options = {
      provider: context.options.provider, model: context.options.model,
      temperature: clampTemperature(context.options.temperature, 0.45),
      taskId: context.workflowTaskId, stage: "auto_director", itemKey: "candidate_direction_batch", entrypoint: "auto_director_create",
    };
    const { output: directions } = await runStructuredPrompt({
      asset: directorDirectionPairPrompt, promptInput, contextBlocks,
      options: { ...options, reasoningEnabled: false, automaticMaxTokens: 1500 },
    });
    await this.markCandidateProgress(context.workflowTaskId, "candidate_direction_batch",
      "Los conflictos, los personajes y las direcciones de la historia se desarrollan en dos direcciones.", DIRECTOR_PROGRESS.candidateDirectionBatch);
    const { output: cards } = await runCandidateStructuredCall({
      asset: directorCandidatePrompt, promptInput: { ...promptInput, directions }, contextBlocks, options, candidateCount: context.count,
    });
    const normalizedCandidates = (["A", "B"] as const).map((key, index) => ({
      ...normalizeCandidate(cards[key], index),
      plannedDirection: directions[key].choice,
      productionFoundation,
    }));

    await this.markCandidateProgress(
      context.workflowTaskId,
      "candidate_title_pack",
      "El grupo de títulos de libros se está fortaleciendo para cada conjunto de planes.",
      DIRECTOR_PROGRESS.candidateTitlePack,
    );
    const independentlyEnrichedCandidates = await Promise.all(
      normalizedCandidates.map((candidate) => enhanceCandidateTitles(candidate, context, { roundCandidates: normalizedCandidates })),
    );
    const enrichedCandidates: DirectorCandidate[] = [];
    const selectedTitles: string[] = [];
    for (let index = 0; index < independentlyEnrichedCandidates.length; index += 1) {
      const enrichedCandidate = independentlyEnrichedCandidates[index];
      let distinctCandidate = selectDistinctCandidateTitle(enrichedCandidate, selectedTitles);
      if (!distinctCandidate) {
        const regeneratedCandidate = await enhanceCandidateTitles(normalizedCandidates[index], context, {
          roundCandidates: normalizedCandidates,
          excludedTitles: selectedTitles,
        });
        distinctCandidate = selectDistinctCandidateTitle(regeneratedCandidate, selectedTitles);
      }
      if (!distinctCandidate) {
        throw new Error(`Cap. ${index + 1} El conjunto de planes no logró generar un título distinto de otros planes. Por favor inténtalo de nuevo.`);
      }
      enrichedCandidates.push(distinctCandidate);
      selectedTitles.push(distinctCandidate.workingTitle);
    }

    const round = (context.batches.at(-1)?.round ?? 0) + 1;
    return {
      batch: {
        id: randomUUID(),
        round,
        roundLabel: `Cap. ${round} rueda`,
        idea: context.idea.trim(),
        refinementSummary: buildRefinementSummary(context.presets, context.feedback, round),
        presets: context.presets,
        candidates: enrichedCandidates,
        createdAt: new Date().toISOString(),
      },
    };
  }

  async generateCandidates(input: DirectorCandidatesRequest): Promise<DirectorCandidatesResponse> {
    const marketBriefPrompt = await marketRadarService.getBriefPromptBlock(input.marketBriefId);
    const { novelReferenceService } = await import("../../NovelReferenceService");
    const referenceAnalysisPrompt = await novelReferenceService.buildReferenceFromAnalysisId(
      input.writingMode === "continuation" ? input.continuationBookAnalysisId : input.referenceBookAnalysisId,
      "outline",
      input.writingMode === "continuation"
        ? input.continuationBookAnalysisSections
        : input.referenceBookAnalysisSections,
    );
    const foundation = await novelCreateResourceRecommendationService.resolveRequired({
      marketBriefPrompt,
      title: input.title,
      description: input.description || input.idea,
      targetAudience: input.targetAudience,
      bookSellingPoint: input.bookSellingPoint,
      competingFeel: input.competingFeel,
      first30ChapterPromise: input.first30ChapterPromise,
      commercialTags: input.commercialTags,
      genreId: input.genreId,
      primaryStoryModeId: input.primaryStoryModeId,
      secondaryStoryModeId: input.secondaryStoryModeId,
      writingMode: input.writingMode,
      projectMode: input.projectMode,
      narrativePov: input.narrativePov,
      pacePreference: input.pacePreference,
      styleTone: input.styleTone,
      emotionIntensity: input.emotionIntensity,
      aiFreedom: input.aiFreedom,
      powerSystemPreference: input.powerSystemPreference,
      provider: input.provider,
      model: input.model,
      temperature: input.temperature,
    });
    const resolvedInput: DirectorCandidatesRequest = {
      ...input,
      marketBriefPrompt,
      genreId: foundation.genreId,
      primaryStoryModeId: foundation.primaryStoryModeId,
      secondaryStoryModeId: foundation.secondaryStoryModeId,
      productionFoundationPrompt: [
        foundation.promptBlock,
        referenceAnalysisPrompt
          ? input.writingMode === "continuation"
            ? `Limitaciones de la fuente para la continuación: conservar los hechos existentes, las relaciones de los personajes, las reglas del mundo y las pistas inacabadas del trabajo original. zx0zx${referenceAnalysisPrompt}`
            : `Referencia estructural: Solo se pueden utilizar como referencia el mecanismo estructural, el ritmo y el método de escritura. Está prohibido utilizar nombres, personajes, hechos mundiales y tramas específicas originales. zx0zx${referenceAnalysisPrompt}`
          : "",
      ].filter(Boolean).join("\n\n"),
    };
    if (resolvedInput.workflowTaskId?.trim()) {
      await new DirectorTaskStateWriter(this.workflowService).initializeTask({
        workflowTaskId: resolvedInput.workflowTaskId,
        lane: "auto_director",
        title: resolvedInput.title ?? null,
        directorState: buildWorkflowSeedPayload(resolvedInput, {
          batches: [],
          candidateStage: {
            mode: "generate",
          },
        }),
      });
    }

    await this.markCandidateProgress(
      input.workflowTaskId,
      "candidate_seed_alignment",
      "Organizar la configuración de su proyecto y comenzar a inspirarse",
      DIRECTOR_PROGRESS.candidateSeedAlignment,
    );
    await this.markCandidateProgress(
      input.workflowTaskId,
      "candidate_project_framing",
      "Alinear el marco a nivel de libro con compromisos iniciales",
      DIRECTOR_PROGRESS.candidateProjectFraming,
    );

    const result = await this.generateBatch({
      idea: resolvedInput.idea,
      count: 2,
      batches: [],
      presets: [],
      request: resolvedInput,
      options: resolvedInput,
      workflowTaskId: resolvedInput.workflowTaskId,
      productionFoundation: foundation.recommendation,
    });
    if (!resolvedInput.workflowTaskId?.trim()) {
      return result;
    }

    const workflowTask = await new DirectorTaskStateWriter(this.workflowService).initializeTask({
      workflowTaskId: resolvedInput.workflowTaskId,
      lane: "auto_director",
      title: resolvedInput.title ?? null,
      directorState: buildWorkflowSeedPayload(resolvedInput, {
        batches: [result.batch],
        productionFoundation: foundation.recommendation,
        candidateStage: {
          mode: "generate",
        },
      }),
    });
    await new DirectorTaskStateWriter(this.workflowService).markCandidateSelectionRequired(workflowTask.id, {
      summary: `${result.batch.roundLabel} Generado ${result.batch.candidates.length} Establezca instrucciones a nivel de libro y complete cada grupo de títulos.`,
    });
    return {
      ...result,
      workflowTaskId: workflowTask.id,
    };
  }

  async refineCandidates(input: DirectorRefinementRequest): Promise<DirectorRefineResponse> {
    if (input.workflowTaskId?.trim()) {
      await new DirectorTaskStateWriter(this.workflowService).initializeTask({
        workflowTaskId: input.workflowTaskId,
        lane: "auto_director",
        title: input.title ?? null,
        directorState: buildWorkflowSeedPayload(input, {
          batches: input.previousBatches,
          candidateStage: {
            mode: "refine",
            presets: input.presets ?? [],
            feedback: input.feedback?.trim() || null,
          },
        }),
      });
    }

    await this.markCandidateProgress(
      input.workflowTaskId,
      "candidate_seed_alignment",
      "Leyendo la ronda anterior de planos y sus comentarios de revisión.",
      DIRECTOR_PROGRESS.candidateSeedAlignment,
    );
    await this.markCandidateProgress(
      input.workflowTaskId,
      "candidate_project_framing",
      "Alinear nuevas preferencias de sabor con un marco a nivel de libro",
      DIRECTOR_PROGRESS.candidateProjectFraming,
    );

    const result = await this.generateBatch({
      idea: input.idea,
      count: 2,
      batches: input.previousBatches,
      presets: input.presets ?? [],
      feedback: input.feedback,
      request: input,
      options: input,
      workflowTaskId: input.workflowTaskId,
    });
    if (!input.workflowTaskId?.trim()) {
      return result;
    }

    const nextBatches = [...input.previousBatches, result.batch];
    const workflowTask = await new DirectorTaskStateWriter(this.workflowService).initializeTask({
      workflowTaskId: input.workflowTaskId,
      lane: "auto_director",
      title: input.title ?? null,
      directorState: buildWorkflowSeedPayload(input, {
        batches: nextBatches,
        candidateStage: {
          mode: "refine",
          presets: input.presets ?? [],
          feedback: input.feedback?.trim() || null,
        },
      }),
    });
    await new DirectorTaskStateWriter(this.workflowService).markCandidateSelectionRequired(workflowTask.id, {
      summary: `${result.batch.roundLabel} Generado en base a comentarios revisados. ${result.batch.candidates.length} Establece una nueva dirección y completa mejoras en el conjunto de títulos.`,
    });
    return {
      ...result,
      workflowTaskId: workflowTask.id,
    };
  }

  async patchCandidate(input: DirectorCandidatePatchRequest): Promise<DirectorCandidatePatchResponse> {
    if (input.workflowTaskId?.trim()) {
      await new DirectorTaskStateWriter(this.workflowService).initializeTask({
        workflowTaskId: input.workflowTaskId,
        lane: "auto_director",
        title: input.title ?? null,
        directorState: buildWorkflowSeedPayload(input, {
          batches: input.previousBatches,
          candidateStage: {
            mode: "patch_candidate",
            presets: input.presets ?? [],
            feedback: input.feedback.trim(),
            batchId: input.batchId,
            candidateId: input.candidateId,
          },
        }),
      });
    }

    const targetBatch = findTargetBatch(input.previousBatches, input.batchId);
    const targetCandidate = findTargetCandidate(targetBatch, input.candidateId);

    await this.markCandidateProgress(
      input.workflowTaskId,
      "candidate_seed_alignment",
      `Lectura "${targetCandidate.workingTitle}»Plan actual`,
      DIRECTOR_PROGRESS.candidateSeedAlignment,
    );
    await this.markCandidateProgress(
      input.workflowTaskId,
      "candidate_direction_batch",
      `Lo estamos revisando según vuestras opiniones.${targetCandidate.workingTitle}»`,
      DIRECTOR_PROGRESS.candidateDirectionBatch,
    );

    const parsed = await runCandidateStructuredCall({
      asset: directorCandidatePatchPrompt,
      promptInput: {
        idea: input.idea,
        context: input,
        candidate: targetCandidate,
        batches: input.previousBatches,
        presets: input.presets ?? [],
        feedback: input.feedback,
      },
      contextBlocks: buildDirectorCandidateContextBlocks({
        idea: input.idea,
        context: input,
        latestBatch: input.previousBatches.at(-1),
        presets: input.presets ?? [],
        feedback: input.feedback,
      }),
      options: {
        provider: input.provider,
        model: input.model,
        temperature: clampTemperature(input.temperature, 0.4),
        taskId: input.workflowTaskId,
        stage: "auto_director",
        itemKey: "candidate_direction_batch",
        entrypoint: "auto_director_create",
      },
      candidateCount: 1,
    });

    await this.markCandidateProgress(
      input.workflowTaskId,
      "candidate_title_pack",
      `Actualmente trabajando en "${targetCandidate.workingTitle}»Reorganizar el grupo de títulos de libros`,
      DIRECTOR_PROGRESS.candidateTitlePack,
    );
    const enrichedCandidate = await enhanceCandidateTitles({
      ...normalizeCandidate(parsed.output, 0),
      id: targetCandidate.id,
      plannedDirection: targetCandidate.plannedDirection,
      reviewRevision: (targetCandidate.reviewRevision ?? 0) + 1,
      productionFoundation: targetCandidate.productionFoundation,
    }, {
      idea: input.idea,
      count: 1,
      batches: input.previousBatches,
      presets: input.presets ?? [],
      feedback: input.feedback,
      request: input,
      options: input,
    }, { roundCandidates: targetBatch.candidates });

    const nextBatch = replaceCandidateInBatch(
      targetBatch,
      enrichedCandidate,
      `Corrección de orientación:${input.feedback.trim()}`,
    );
    const nextBatches = replaceBatchInList(input.previousBatches, nextBatch);

    if (!input.workflowTaskId?.trim()) {
      return {
        batch: nextBatch,
        candidate: enrichedCandidate,
      };
    }

    const workflowTask = await new DirectorTaskStateWriter(this.workflowService).initializeTask({
      workflowTaskId: input.workflowTaskId,
      lane: "auto_director",
      title: input.title ?? null,
      directorState: buildWorkflowSeedPayload(input, {
        batches: nextBatches,
        candidateStage: {
          mode: "patch_candidate",
          presets: input.presets ?? [],
          feedback: input.feedback.trim(),
          batchId: input.batchId,
          candidateId: input.candidateId,
        },
      }),
    });
    await new DirectorTaskStateWriter(this.workflowService).markCandidateSelectionRequired(workflowTask.id, {
      summary: `Ha sido revisado según vuestras opiniones.${targetCandidate.workingTitle}».`,
    });
    return {
      batch: nextBatch,
      candidate: enrichedCandidate,
      workflowTaskId: workflowTask.id,
    };
  }

  async refineCandidateTitleOptions(input: DirectorCandidateTitleRefineRequest): Promise<DirectorCandidateTitleRefineResponse> {
    if (input.workflowTaskId?.trim()) {
      await new DirectorTaskStateWriter(this.workflowService).initializeTask({
        workflowTaskId: input.workflowTaskId,
        lane: "auto_director",
        title: input.title ?? null,
        directorState: buildWorkflowSeedPayload(input, {
          batches: input.previousBatches,
          candidateStage: {
            mode: "refine_titles",
            feedback: input.feedback.trim(),
            batchId: input.batchId,
            candidateId: input.candidateId,
          },
        }),
      });
    }

    const targetBatch = findTargetBatch(input.previousBatches, input.batchId);
    const targetCandidate = findTargetCandidate(targetBatch, input.candidateId);

    await this.markCandidateProgress(
      input.workflowTaskId,
      "candidate_title_pack",
      `siendo rehecho${targetCandidate.workingTitle}»grupo de título`,
      DIRECTOR_PROGRESS.candidateTitlePack,
    );

    const otherTitles = targetBatch.candidates.filter((item) => item.id !== targetCandidate.id).map((item) => item.workingTitle);
    const currentTitles = new Set([targetCandidate.workingTitle, ...(targetCandidate.titleOptions ?? []).map((item) => item.title)]);
    const response = await titleGenerationService.generateTitleIdeas({
      mode: "brief",
      selectionMode: "primary",
      brief: [
        buildCandidateTitleBrief(targetCandidate, { idea: input.idea, request: input }, {
          roundCandidates: targetBatch.candidates, excludedTitles: otherTitles,
        }),
        `Grupo de título actual:${[...currentTitles].join(",")}`,
        `Comentarios de corrección de título:${input.feedback.trim()}`,
      ].join("\n"),
      genreId: input.genreId ?? null,
      count: 4,
      provider: input.provider,
      model: input.model,
      temperature: clampTemperature(input.temperature, 0.85),
    });

    const titleOptions = mergeTitleOptions(response.titles, targetCandidate, otherTitles);
    if (!titleOptions.length) {
      throw new Error("El título del libro generado es el mismo que el de otras soluciones de la misma ronda. Por favor inténtalo de nuevo.");
    }
    const nextCandidate: DirectorCandidate = {
      ...targetCandidate,
      reviewRevision: (targetCandidate.reviewRevision ?? 0) + 1,
      workingTitle: titleOptions[0]?.title?.trim() || targetCandidate.workingTitle,
      titleOptions,
    };
    const nextBatch = replaceCandidateInBatch(
      targetBatch,
      nextCandidate,
      `Correcciones en el grupo de títulos:${input.feedback.trim()}`,
    );
    const nextBatches = replaceBatchInList(input.previousBatches, nextBatch);

    if (!input.workflowTaskId?.trim()) {
      return {
        batch: nextBatch,
        candidate: nextCandidate,
      };
    }

    const workflowTask = await new DirectorTaskStateWriter(this.workflowService).initializeTask({
      workflowTaskId: input.workflowTaskId,
      lane: "auto_director",
      title: input.title ?? null,
      directorState: buildWorkflowSeedPayload(input, {
        batches: nextBatches,
        candidateStage: {
          mode: "refine_titles",
          feedback: input.feedback.trim(),
          batchId: input.batchId,
          candidateId: input.candidateId,
        },
      }),
    });
    await new DirectorTaskStateWriter(this.workflowService).markCandidateSelectionRequired(workflowTask.id, {
      summary: `Ha sido rehecho según vuestras opiniones.${targetCandidate.workingTitle}»grupo de título.`,
    });
    return {
      batch: nextBatch,
      candidate: nextCandidate,
      workflowTaskId: workflowTask.id,
    };
  }
}
