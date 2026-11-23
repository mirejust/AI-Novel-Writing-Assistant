import type {
  NovelProductionExperience,
  NovelProductionExperienceSelectionResponse,
} from "@ai-novel/shared/types/novelWorkflow";
import { buildFullBookAutopilotExecutionPlan } from "@ai-novel/shared/types/novelDirector";
import { buildFullDirectorAutoApprovalConfig } from "@ai-novel/shared/types/autoDirectorApproval";
import { prisma } from "../../../../db/prisma";
import { AppError } from "../../../../middleware/errorHandler";
import { DirectorTaskStateWriter } from "../state";
import { DirectorStateReader, toDirectorTaskDataView } from "../state/DirectorStateReader";
import {
  applyDirectorRunModeContract,
  type DirectorWorkflowSeedPayload,
} from "../runtime/novelDirectorHelpers";
import { DirectorCommandService } from "./DirectorCommandService";

export function parseSelectedExperience(seed: DirectorWorkflowSeedPayload): NovelProductionExperience | null {
  return seed.productionExperience === "simple" || seed.productionExperience === "professional"
    ? seed.productionExperience
    : null;
}

export function buildProductionExperienceSeed(
  seed: DirectorWorkflowSeedPayload,
  experience: NovelProductionExperience,
): DirectorWorkflowSeedPayload {
  const directorInput = seed.directorInput;
  if (!directorInput) {
    throw new AppError("Las tareas automáticas del director carecen del contexto necesario para continuar con la producción.", 409);
  }
  const nextInput = applyDirectorRunModeContract({
    ...directorInput,
    runMode: "full_book_autopilot" as const,
    autoExecutionPlan: buildFullBookAutopilotExecutionPlan(),
    autoApproval: buildFullDirectorAutoApprovalConfig(),
  });
  return {
    ...seed,
    productionExperience: experience,
    runMode: nextInput.runMode,
    autoExecutionPlan: nextInput.autoExecutionPlan,
    autoApproval: nextInput.autoApproval,
    directorInput: nextInput,
  };
}

export class DirectorProductionExperienceService {
  constructor(
    private readonly commandService = new DirectorCommandService(),
    private readonly stateWriter = new DirectorTaskStateWriter(),
  ) {}

  async select(
    taskId: string,
    experience: NovelProductionExperience,
  ): Promise<NovelProductionExperienceSelectionResponse> {
    const task = await prisma.novelWorkflowTask.findUnique({
      where: { id: taskId },
      select: { id: true, lane: true, novelId: true, status: true, checkpointType: true },
    });
    if (!task || task.lane !== "auto_director") {
      throw new AppError("Las tareas automáticas de director no existen.", 404);
    }
    if (!task.novelId) {
      throw new AppError("La tarea automática del director aún no está vinculada al proyecto novedoso.", 409);
    }
    const novelId = task.novelId;

    const state = await new DirectorStateReader().readTaskStateById(task.id);
    const seed = (state ? toDirectorTaskDataView(state) : {}) as DirectorWorkflowSeedPayload;
    const selected = parseSelectedExperience(seed);
    if (selected && selected !== experience) {
      buildProductionExperienceSeed(seed, experience);
      await prisma.$transaction(async (tx) => {
        await this.stateWriter.updateDirectorRunState(task.id, {
          productionExperience: experience,
        }, undefined, { transaction: tx });
        await tx.novel.update({
          where: { id: novelId },
          data: { creationExperience: experience },
        });
      });
      return {
        experience,
        workflowTaskId: task.id,
        novelId: task.novelId,
        targetRoute: experience === "simple" ? `/novels/${task.novelId}/simple` : `/novels/${task.novelId}/edit`,
        backgroundStarted: task.status === "queued" || task.status === "running",
      };
    }

    if (!selected) {
      if (task.checkpointType !== "production_experience_required") {
        throw new AppError("El director automático aún no ha completado los preparativos para la producción del texto principal.", 409);
      }
      buildProductionExperienceSeed(seed, experience);

      const claimed = await prisma.$transaction(async (tx) => {
        const updated = await this.stateWriter.updateDirectorRunStateMany({
          where: {
            id: task.id,
            checkpointType: "production_experience_required",
          },
          data: {
            status: "waiting_approval",
            currentStage: "chapter_execution",
            currentItemKey: "chapter_batch_ready",
            currentItemLabel: "La interfaz de creación ha sido seleccionada y lista para comenzar la producción completa del libro.",
            checkpointType: "chapter_batch_ready",
            checkpointSummary: "Los recursos de ejecución del capítulo están listos y la IA comenzará la producción completa del libro.",
          },
        }, { productionExperience: experience }, { transaction: tx });
        if (updated.count === 0) {
          return false;
        }
        await tx.novel.update({
          where: { id: task.novelId! },
          data: { creationExperience: experience },
        });
        return true;
      });

      if (!claimed) {
        return this.select(taskId, experience);
      }
    }

    const shouldEnqueue = !selected || (
      task.status === "waiting_approval"
      && task.checkpointType === "chapter_batch_ready"
    );
    const command = shouldEnqueue
      ? await this.commandService.enqueueContinueCommand(task.id, {
        continuationMode: "auto_execute_range",
        forceResume: true,
      })
      : null;
    return {
      experience,
      workflowTaskId: task.id,
      novelId: task.novelId,
      targetRoute: experience === "simple" ? `/novels/${task.novelId}/simple` : `/novels/${task.novelId}/edit`,
      backgroundStarted: true,
      commandId: command?.commandId,
    };
  }
}
