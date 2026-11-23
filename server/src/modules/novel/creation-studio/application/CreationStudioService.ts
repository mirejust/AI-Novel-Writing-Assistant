import type { ShortStoryReferenceSelection, ShortStoryReferenceSnapshot } from "@ai-novel/shared/types/shortStoryReference";
import { shortStoryReferenceService, referenceContract } from "../reference";
import { latestStructuredDiagnostic, canRetryStructuredTask } from "../../../../platform/llm/diagnostics/StructuredDiagnosticStore";
import { Prisma } from "@prisma/client";
import type {
  CreationDirection,
  CreationIntentInterpretation,
  CreationStudioConfirmRequest,
  CreationStudioInterpretRequest,
  CreationStudioRegenerateRequest,
  CreationStudioTaskProjection,
  NarrativeForm,
} from "@ai-novel/shared/types/creationStudio";
import type { DirectorCandidate, DirectorConfirmRequest } from "@ai-novel/shared/types/novelDirector";
import type { CreativeCarryoverContract } from "@ai-novel/shared/types/creativeCarryoverContract";
import type { WritingPlatform, WritingPlatformPreference } from "@ai-novel/shared/types/writingPlatform";
import { prisma } from "../../../../db/prisma";
import { AppError } from "../../../../middleware/errorHandler";
import { runStructuredPrompt } from "../../../../prompting/core/promptRunner";
import { creationIntentInterpretPrompt } from "../../../../prompting/prompts/creation/creationIntent.prompts";
import { NovelDirectorService } from "../../../../services/novel/director/NovelDirectorService";
import { novelCreateResourceRecommendationService } from "../../../../services/novel/NovelCreateResourceRecommendationService";
import { NovelWorkflowService } from "../../../../services/novel/workflow/NovelWorkflowService";
import { parseSeedPayload, resumeTargetToRoute } from "../../../../services/novel/workflow/novelWorkflow.shared";
import { shortStoryProductionService } from "../../short-story/application/ShortStoryProductionService";
import { supportsWritingPlatformForm, writingPlatformProfileService } from "../../writing-platform";

interface CreationStudioSeed {
  referenceSelection?: ShortStoryReferenceSelection;
  referenceSnapshot?: ShortStoryReferenceSnapshot;
  creativeCarryoverContract?: CreativeCarryoverContract | null;
  idea: string;
  derivedFromNovelId?: string;
  currentIntentVersionId?: string;
  selectedDirectionId?: string;
  productionTaskId?: string;
  confirmedNarrativeForm?: NarrativeForm;
  writingPlatformPreference?: WritingPlatformPreference;
  confirmedWritingPlatform?: WritingPlatform;
}

export interface CreationStudioConfirmationResult {
  taskId: string;
  novelId: string;
  productionTaskId: string;
  narrativeForm: NarrativeForm;
  resumeRoute: string;
}

function parseInterpretation(value: string): CreationIntentInterpretation {
  return JSON.parse(value) as CreationIntentInterpretation;
}

function targetChapterCount(targetWordCount: number): number {
  return Math.max(30, Math.min(2000, Math.ceil(targetWordCount / 2500)));
}

function toDirectorCandidate(direction: CreationDirection, targetWordCount: number, writingPlatform: WritingPlatform): DirectorCandidate {
  return {
    id: direction.id,
    workingTitle: direction.title,
    logline: direction.premise,
    positioning: direction.coreExperience,
    sellingPoint: direction.coreExperience,
    coreConflict: direction.centralConflict,
    protagonistPath: direction.protagonist,
    endingDirection: direction.endingPromise,
    hookStrategy: `alrededor"${direction.centralConflict}"Establezca la primera ronda de preguntas de puesta al día lo antes posible.`,
    progressionLoop: "Continúe avanzando a través de la escalada de conflictos, la selección de personajes y las recompensas de escenario.",
    whyItFits: "Esta dirección proviene de la intención confirmada por el usuario en el estudio creativo.",
    recommendedWritingPlatform: writingPlatform === "zhihu_story" ? "fanqie_free" : writingPlatform,
    writingPlatformReason: "La plataforma ha sido confirmada por el usuario en el estudio creativo y el director automático hereda esta selección.",
    toneKeywords: direction.styleKeywords,
    targetChapterCount: targetChapterCount(targetWordCount),
  };
}

export class CreationStudioService {
  private readonly workflowService = new NovelWorkflowService();
  private readonly directorService = new NovelDirectorService();
  private longNovelLauncher?: (input: DirectorConfirmRequest, sourceTaskId: string) => Promise<{novel: {id: string}; workflowTaskId: string}>;
  configureLongNovelLauncher(launcher?: NonNullable<CreationStudioService["longNovelLauncher"]>): void {this.longNovelLauncher = launcher;}

  async interpret(input: CreationStudioInterpretRequest): Promise<CreationStudioTaskProjection> {
    const idea = input.idea?.trim()
      || (input.reference ? `Objetivos creativos:${input.reference.goal.trim()}` : "");
    if (!idea) {
      throw new AppError("Comience escribiendo lo que desea crear.", 400);
    }
    if (input.reference && input.preferredNarrativeForm !== "short_story") throw new AppError("Para historias cortas de referencia, comience desde la entrada de creación de historias cortas.", 400);
    const task = await this.workflowService.bootstrapTask({
      lane: "creation_studio",
      title: "convertir ideas en obras",
      forceNew: true,
      seedPayload: { idea, referenceSelection: input.reference },
    });
    try { return await this.runInterpretation(task.id, {
      idea,
      referenceSelection: input.reference,
      preferredNarrativeForm: input.preferredNarrativeForm,
      targetWordCount: input.targetWordCount,
      writingPlatformPreference: input.writingPlatformPreference,
      source: "initial",
    }); } catch { return this.getProjection(task.id); }
  }

  async createDerivedLongForm(sourceNovelId: string): Promise<CreationStudioTaskProjection> {
    const source = await prisma.novel.findUnique({
      where: { id: sourceNovelId },
      include: {
        shortStorySegments: { orderBy: { order: "asc" } },
        intentVersions: {
          where: { status: "active" },
          orderBy: { version: "desc" },
          take: 1,
        },
      },
    });
    if (!source || source.narrativeForm !== "short_story") {
      throw new AppError("Sólo puede desarrollarse desde obras cortas hasta obras largas.", 400);
    }
    const activeIntent = source.intentVersions[0];
    const storyDigest = source.shortStorySegments
      .map((segment) => segment.content.trim())
      .join("\n\n")
      .slice(0, 8000);
    const idea = [
      `Por favor escribe el cuento "${source.title}”se convirtió en una novela de larga duración conservando los personajes centrales, el conflicto central y el significado final de la obra original.`,
      activeIntent ? `Intención creativa original:${activeIntent.originalExpression}` : "",
      `Material de resumen del cuento:${storyDigest}`,
    ].filter(Boolean).join("\n\n");
    const task = await this.workflowService.bootstrapTask({
      lane: "creation_studio",
      title: `desarrollar"${source.title}»Capítulo de crecimiento`,
      forceNew: true,
      seedPayload: { idea, derivedFromNovelId: source.id },
    });
    return this.runInterpretation(task.id, {
      idea,
      preferredNarrativeForm: "long_novel",
      targetWordCount: 200000,
      source: "derived",
    });
  }

  async regenerate(taskId: string, input: CreationStudioRegenerateRequest): Promise<CreationStudioTaskProjection> {
    const task = await this.requireCreationTask(taskId);
    if (!await canRetryStructuredTask(taskId)) throw new AppError("El servicio modelo requiere que vuelvas a intentarlo más tarde; espera antes de continuar.", 429);
    const seed = parseSeedPayload<CreationStudioSeed>(task.seedPayloadJson);
    if (!seed?.idea) {
      throw new AppError("La tarea creativa actual carece de ideas originales, comience de nuevo.", 409);
    }
    if (task.novelId) {
      throw new AppError("El trabajo ha comenzado a generarse y la dirección antes de la confirmación no se puede reemplazar.", 409);
    }
    return this.runInterpretation(task.id, {
      idea: seed.idea,
      referenceSelection: input.reference ?? seed.referenceSelection,
      preferredNarrativeForm: input.narrativeForm,
      targetWordCount: input.targetWordCount,
      feedback: input.feedback,
      writingPlatformPreference: input.writingPlatformPreference,
      source: "regenerated",
    });
  }

  async getProjection(taskId: string): Promise<CreationStudioTaskProjection> {
    const task = await this.requireCreationTask(taskId);
    const seed = parseSeedPayload<CreationStudioSeed>(task.seedPayloadJson) ?? { idea: "" };
    const intent = seed.currentIntentVersionId
      ? await prisma.novelIntentVersion.findUnique({ where: { id: seed.currentIntentVersionId } })
      : await prisma.novelIntentVersion.findFirst({
        where: { workflowTaskId: task.id },
        orderBy: { version: "desc" },
      });
    const interpretation = intent ? parseInterpretation(intent.structuredIntentJson) : null;
    const confirmation = await prisma.creationStudioConfirmation.findUnique({
      where: { workflowTaskId: task.id },
    });
    const resumeTarget = task.resumeTargetJson
      ? JSON.parse(task.resumeTargetJson) as Parameters<typeof resumeTargetToRoute>[0]
      : null;
    const resumeRoute = confirmation?.narrativeForm === "long_novel" && confirmation.novelId
      ? this.longNovelLauncher ? `/lab/director/${confirmation.novelId}` : `/novels/${confirmation.novelId}/edit`
      : resumeTargetToRoute(resumeTarget);
    return {
      taskId: task.id,
      referenceSelection: seed.referenceSelection,
      reference: await shortStoryReferenceService.view(seed.referenceSnapshot ?? null),
      status: task.status,
      progress: task.progress,
      currentAction: task.currentItemLabel,
      idea: seed.idea,
      interpretation,
      selectedDirectionId: seed.selectedDirectionId ?? null,
      novelId: confirmation?.novelId ?? task.novelId,
      productionTaskId: confirmation?.productionTaskId ?? seed.productionTaskId ?? null,
      resumeRoute,
      error: task.lastError,
      diagnostic: task.status === "failed" ? await latestStructuredDiagnostic(task.id, true) : null,
    };
  }

  async confirm(taskId: string, input: CreationStudioConfirmRequest): Promise<CreationStudioConfirmationResult> {
    const task = await this.requireCreationTask(taskId);
    const existing = await prisma.creationStudioConfirmation.findUnique({ where: { workflowTaskId: task.id } });
    if (existing) {
      if (existing.idempotencyKey !== input.idempotencyKey) {
        throw new AppError("La dirección creativa ha sido confirmada, continúe con el trabajo original.", 409);
      }
      if (!existing.novelId || !existing.productionTaskId) {
        if (existing.status !== "failed") {
          throw new AppError("Confirme que la solicitud se está procesando, vuelva a intentarlo más tarde.", 409);
        }
        await prisma.creationStudioConfirmation.update({
          where: { id: existing.id },
          data: { status: "claimed" },
        });
      } else {
        return this.buildConfirmationResult(task.id, existing.narrativeForm, existing.novelId, existing.productionTaskId);
      }
    }

    const seed = parseSeedPayload<CreationStudioSeed>(task.seedPayloadJson);
    const intent = seed?.currentIntentVersionId
      ? await prisma.novelIntentVersion.findUnique({ where: { id: seed.currentIntentVersionId } })
      : null;
    if (task.status !== "waiting_approval") throw new AppError("Complete el arreglo de dirección antes de confirmar la creación.", 409);
    if (!seed?.idea || !intent) {
      throw new AppError("Primero complete la comprensión de la idea y elija una dirección.", 409);
    }
    const interpretation = parseInterpretation(intent.structuredIntentJson);
    const direction = interpretation.directions.find((item) => item.id === input.directionId);
    if (!direction) {
      throw new AppError("La dirección seleccionada no es válida, selecciónela nuevamente.", 400);
    }
    if (seed.referenceSnapshot) {
      if (input.narrativeForm !== "short_story") throw new AppError("Para referencia breve, mantenga el tamaño del cuento; para referencias largas, comience desde la entrada de la novela de referencia.", 400);
      await shortStoryReferenceService.validate(seed.referenceSnapshot);
    }
    this.assertTarget(input.narrativeForm, input.targetWordCount);
    if (!supportsWritingPlatformForm(input.writingPlatform, input.narrativeForm)) {
      throw new AppError("La plataforma seleccionada no admite el tamaño de trabajo actual, seleccione nuevamente.", 400);
    }

    if (!existing) {
      try {
        await prisma.creationStudioConfirmation.create({
          data: {
            workflowTaskId: task.id,
            idempotencyKey: input.idempotencyKey,
            narrativeForm: input.narrativeForm,
          },
        });
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
          return this.confirm(taskId, input);
        }
        throw error;
      }
    }

    if (input.narrativeForm === "short_story") {
      return this.confirmShortStory(task.id, seed, intent.id, direction, input);
    }
    return this.confirmLongNovel(task.id, seed, intent.id, direction, input);
  }

  private async runInterpretation(taskId: string, input: {
    idea: string;
    preferredNarrativeForm?: NarrativeForm;
    targetWordCount?: number;
    feedback?: string;
    writingPlatformPreference?: WritingPlatformPreference;
    source: "initial" | "regenerated" | "derived";
    referenceSelection?: ShortStoryReferenceSelection;
  }): Promise<CreationStudioTaskProjection> {
    if (input.targetWordCount !== undefined) {
      const inferredForm = input.preferredNarrativeForm
        ?? (input.targetWordCount > 30000 ? "long_novel" : "short_story");
      this.assertTarget(inferredForm, input.targetWordCount);
    }
    await this.workflowService.markTaskRunning(taskId, {
      stage: "creation_intent",
      itemKey: "interpret",
      itemLabel: "entendiendo tus pensamientos",
      progress: 0.04,
      seedPayload: { idea: input.idea, referenceSelection: input.referenceSelection },
    });
    try {
      const referenceSnapshot = input.referenceSelection
        ? await shortStoryReferenceService.create(input.referenceSelection, input.idea, taskId) : undefined;
      const generated = await runStructuredPrompt({
        asset: creationIntentInterpretPrompt,
        promptInput: { ...input, reference: referenceContract(referenceSnapshot ?? null) },
        options: {
          taskId,
          stage: "creation_intent",
          itemKey: "interpret",
          entrypoint: "creation_studio",
          temperature: 0.7,
        },
      });
      if (referenceSnapshot && generated.output.recommendedNarrativeForm !== "short_story") throw new AppError("La dirección de referencia no se ajusta al tamaño del cuento, generela nuevamente.", 502);
      const productionFoundation = await novelCreateResourceRecommendationService.resolveRequired({
        title: generated.output.directions[0].title,
        description: [
          generated.output.understanding,
          ...generated.output.directions.map((item) => `${item.title}:${item.premise}`),
        ].join("\n"),
        targetAudience: generated.output.directions[0].coreExperience,
        bookSellingPoint: generated.output.directions[0].coreExperience,
        styleTone: generated.output.directions[0].styleKeywords.join(","),
        projectMode: "auto_pipeline",
        writingMode: "original",
      });
      const interpretedOutput: CreationIntentInterpretation = {
        ...generated.output,
        productionFoundation: productionFoundation.recommendation,
      };
      const latest = await prisma.novelIntentVersion.findFirst({
        where: { workflowTaskId: taskId },
        orderBy: { version: "desc" },
      });
      const version = (latest?.version ?? 0) + 1;
      const created = await prisma.$transaction(async (tx) => {
        if (latest) {
          await tx.novelIntentVersion.update({
            where: { id: latest.id },
            data: { status: "superseded" },
          });
        }
        return tx.novelIntentVersion.create({
          data: {
            workflowTaskId: taskId,
            previousVersionId: latest?.id,
            version,
            status: "proposed",
            source: input.source,
            originalExpression: input.idea,
            structuredIntentJson: JSON.stringify(interpretedOutput),
            impactScopeJson: JSON.stringify({referenceSnapshot}),
          },
        });
      });
      await this.workflowService.markTaskWaitingApproval(taskId, {
        stage: "creation_intent",
        itemKey: "direction_confirmation",
        itemLabel: "Las instrucciones están listas, elija una para continuar",
        progress: 0.12,
        seedPayload: {
          idea: input.idea,
          referenceSelection: input.referenceSelection,
          referenceSnapshot,
          currentIntentVersionId: created.id,
          writingPlatformPreference: input.writingPlatformPreference,
        },
      });
      return this.getProjection(taskId);
    } catch (error) {
      const message = error instanceof Error ? error.message : "La IA no puede entender esta idea en este momento, inténtalo de nuevo.";
      await this.workflowService.markTaskFailed(taskId, message, {
        stage: "creation_intent",
        itemKey: "interpret",
        itemLabel: "La comprensión de la idea no está completa, puedes intentarlo de nuevo.",
      });
      throw error;
    }
  }

  private async confirmShortStory(
    taskId: string,
    seed: CreationStudioSeed,
    intentVersionId: string,
    direction: CreationDirection,
    input: CreationStudioConfirmRequest,
  ): Promise<CreationStudioConfirmationResult> {
    const platformSnapshot = await writingPlatformProfileService.snapshot(input.writingPlatform, "short_story");
    const intent = await prisma.novelIntentVersion.findUnique({ where: { id: intentVersionId } });
    const interpretation = intent ? parseInterpretation(intent.structuredIntentJson) : null;
    const foundation = interpretation?.productionFoundation
      ? {
        genreId: interpretation.productionFoundation.genre.id,
        primaryStoryModeId: interpretation.productionFoundation.primaryStoryMode.id,
        secondaryStoryModeId: interpretation.productionFoundation.secondaryStoryMode?.id,
      }
      : await novelCreateResourceRecommendationService.resolveRequired({
        title: direction.title,
        description: direction.premise,
        bookSellingPoint: direction.coreExperience,
        styleTone: direction.styleKeywords.join(","),
        writingMode: "original",
        projectMode: "ai_led",
      });
    const novel = await prisma.$transaction(async (tx) => {
      const created = await tx.novel.create({
        data: {
          title: direction.title,
          description: direction.premise,
          bookSellingPoint: direction.coreExperience,
          narrativeForm: "short_story",
          shortStoryReferenceJson: seed.referenceSnapshot ? JSON.stringify(seed.referenceSnapshot) : null,
          referenceBookAnalysisId: seed.referenceSnapshot?.analysisId,
          targetWordCount: input.targetWordCount,
          creationExperience: "professional",
          writingMode: "original",
          projectMode: "ai_led",
          genreId: foundation.genreId,
          primaryStoryModeId: foundation.primaryStoryModeId,
          secondaryStoryModeId: foundation.secondaryStoryModeId,
          writingPlatform: input.writingPlatform,
          writingPlatformProfileVersion: platformSnapshot.profileVersion,
          writingPlatformSnapshotJson: JSON.stringify(platformSnapshot),
        },
      });
      await tx.novelIntentVersion.update({
        where: { id: intentVersionId },
        data: {
          novelId: created.id,
          status: "active",
          impactScopeJson: JSON.stringify({ selectedDirectionId: direction.id }),
        },
      });
      await tx.creationStudioConfirmation.update({
        where: { workflowTaskId: taskId },
        data: {
          novelId: created.id,
          productionTaskId: taskId,
          status: "confirmed",
        },
      });
      return created;
    });
    await this.workflowService.attachNovelToTask(taskId, novel.id, "short_story_plan");
    await this.workflowService.markTaskRunning(taskId, {
      stage: "short_story_plan",
      itemKey: "short_story_plan",
      itemLabel: "Planificación de una historia corta completa",
      progress: 0.16,
      seedPayload: {
        ...seed,
        selectedDirectionId: direction.id,
        productionTaskId: taskId,
        confirmedNarrativeForm: "short_story",
        confirmedWritingPlatform: input.writingPlatform,
      },
    });
    shortStoryProductionService.schedule(taskId);
    return this.buildConfirmationResult(taskId, "short_story", novel.id, taskId);
  }

  private async confirmLongNovel(
    taskId: string,
    seed: CreationStudioSeed,
    intentVersionId: string,
    direction: CreationDirection,
    input: CreationStudioConfirmRequest,
  ): Promise<CreationStudioConfirmationResult> {
    try {
      const platformSnapshot = await writingPlatformProfileService.snapshot(input.writingPlatform, "long_novel");
      const intent = await prisma.novelIntentVersion.findUnique({ where: { id: intentVersionId } });
      const interpretation = intent ? parseInterpretation(intent.structuredIntentJson) : null;
      const foundation = interpretation?.productionFoundation
        ? {
          genreId: interpretation.productionFoundation.genre.id,
          primaryStoryModeId: interpretation.productionFoundation.primaryStoryMode.id,
          secondaryStoryModeId: interpretation.productionFoundation.secondaryStoryMode?.id,
        }
        : await novelCreateResourceRecommendationService.resolveRequired({
          title: direction.title,
          description: direction.premise,
          bookSellingPoint: direction.coreExperience,
          styleTone: direction.styleKeywords.join(","),
          writingMode: "original",
          projectMode: "auto_pipeline",
        });
      const confirmInput: DirectorConfirmRequest = {
        idea: seed.idea,
        candidate: toDirectorCandidate(direction, input.targetWordCount, input.writingPlatform),
        title: direction.title,
        description: direction.premise,
        bookSellingPoint: direction.coreExperience,
        styleTone: direction.styleKeywords.join(","),
        estimatedChapterCount: targetChapterCount(input.targetWordCount),
        defaultChapterLength: 2500,
        projectMode: "auto_pipeline",
        writingMode: "original",
        writingPlatformPreference: input.writingPlatform,
        genreId: foundation.genreId,
        primaryStoryModeId: foundation.primaryStoryModeId,
        secondaryStoryModeId: foundation.secondaryStoryModeId,
        creativeCarryoverContract: seed.creativeCarryoverContract ?? null,
      };
      const result = this.longNovelLauncher ? await this.longNovelLauncher(confirmInput,taskId) : await this.directorService.confirmCandidate(confirmInput);
      const productionTaskId = result.workflowTaskId;
      if (!productionTaskId) {
        throw new Error("El director automático del largometraje no ha regresado a las tareas de producción.");
      }
      await prisma.$transaction([
        prisma.novelIntentVersion.update({
          where: { id: intentVersionId },
          data: {
            novelId: result.novel.id,
            status: "active",
            impactScopeJson: JSON.stringify({ selectedDirectionId: direction.id }),
          },
        }),
        prisma.creationStudioConfirmation.update({
          where: { workflowTaskId: taskId },
          data: {
            novelId: result.novel.id,
            productionTaskId,
            status: "handed_off",
          },
        }),
      ]);
      if (seed.derivedFromNovelId) {
        await prisma.novel.update({
          where: { id: result.novel.id },
          data: { derivedFromNovelId: seed.derivedFromNovelId },
        });
      }
      await prisma.novel.update({
        where: { id: result.novel.id },
        data: {
          writingPlatform: input.writingPlatform,
          writingPlatformProfileVersion: platformSnapshot.profileVersion,
          writingPlatformSnapshotJson: JSON.stringify(platformSnapshot),
        },
      });
      await this.workflowService.recordCheckpoint(taskId, {
        stage: "creation_intent",
        checkpointType: "workflow_completed",
        checkpointSummary: "La dirección creativa ha sido entregada al director automático del largometraje para su posterior finalización.",
        itemLabel: "Ha comenzado la escritura extensa",
        progress: 1,
        seedPayload: {
          ...seed,
          selectedDirectionId: direction.id,
          productionTaskId,
          confirmedNarrativeForm: "long_novel",
          confirmedWritingPlatform: input.writingPlatform,
        },
      });
      return this.buildConfirmationResult(
        taskId,
        "long_novel",
        result.novel.id,
        productionTaskId,
      );
    } catch (error) {
      await prisma.creationStudioConfirmation.update({
        where: { workflowTaskId: taskId },
        data: { status: "failed" },
      });
      throw error;
    }
  }

  private async requireCreationTask(taskId: string) {
    const task = await this.workflowService.getTaskByIdWithoutHealing(taskId);
    if (!task || task.lane !== "creation_studio") {
      throw new AppError("La tarea de creación no existe.", 404);
    }
    return task;
  }

  private assertTarget(form: NarrativeForm, targetWordCount: number): void {
    if (!Number.isInteger(targetWordCount)) {
      throw new AppError("El recuento de palabras objetivo debe ser un número entero.", 400);
    }
    if (form === "short_story" && (targetWordCount < 3000 || targetWordCount > 30000)) {
      throw new AppError("El recuento de palabras objetivo para los cuentos debe estar entre 3000 y 30 000 palabras.", 400);
    }
    if (form === "long_novel" && (targetWordCount <= 30000 || targetWordCount > 3_000_000)) {
      throw new AppError("El recuento de palabras objetivo para artículos extensos debe ser superior a 30.000 palabras.", 400);
    }
  }

  private buildConfirmationResult(
    taskId: string,
    form: NarrativeForm,
    novelId: string,
    productionTaskId: string,
  ): CreationStudioConfirmationResult {
    return {
      taskId,
      novelId,
      productionTaskId,
      narrativeForm: form,
      resumeRoute: form === "short_story"
        ? `/novels/${novelId}/story`
        : this.longNovelLauncher ? `/lab/director/${novelId}` : `/novels/${novelId}/edit`,
    };
  }
}

export const creationStudioService = new CreationStudioService();
