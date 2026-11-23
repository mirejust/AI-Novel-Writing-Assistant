import { DirectorTaskStateWriter } from "../state";
import type { DirectorStepCalibrationRequest } from "@ai-novel/shared/types/novelDirector";
import { AppError } from "../../../../middleware/errorHandler";
import type { getSharedNovelServices } from "../../application/sharedNovelServices";
import { NovelWorkflowService } from "../../workflow/NovelWorkflowService";
import { getDirectorInputFromSeedPayload } from "../runtime/novelDirectorHelpers";
import { DirectorStateReader, toDirectorTaskDataView } from "../state/DirectorStateReader";
import type { NovelDirectorRuntimeOrchestrator } from "../runtime/novelDirectorRuntimeOrchestrator";
import { directorWorkflowStepModuleRegistry } from "./directorWorkflowStepModules";
import { inspectWorkflowStepFacts, isExecutableWorkflowStepModule } from "./WorkflowStepModule";

type SharedNovelServices = ReturnType<typeof getSharedNovelServices>;

export class DirectorStepCalibrationService {
  constructor(
    private readonly workflowService: NovelWorkflowService,
    private readonly novelService: Pick<SharedNovelServices, "createNovelSnapshot">,
    private readonly runtimeOrchestrator: Pick<NovelDirectorRuntimeOrchestrator, "runStepModule">,
  ) {}

  async calibrate(taskId: string, input: DirectorStepCalibrationRequest): Promise<unknown> {
    const task = await this.workflowService.getTaskById(taskId);
    if (!task?.novelId) throw new AppError("La calibración de pasos debe estar vinculada a la nueva tarea del director.", 404);
    const module = directorWorkflowStepModuleRegistry.maybeGet(input.stepId.trim());
    if (!module || !isExecutableWorkflowStepModule(module)) {
      throw new AppError(`No se admiten los pasos del director de calibración:${input.stepId}`, 400);
    }
    const context = {
      taskId,
      novelId: task.novelId,
      targetType: module.targetType,
      targetId: input.targetId?.trim() || task.novelId,
    };
    if (input.action === "validate") {
      return { action: input.action, stepId: module.id, inspection: await inspectWorkflowStepFacts(module, context) };
    }

    const storedState = await new DirectorStateReader().readTaskStateById(task.id);
    const directorTaskData = storedState ? toDirectorTaskDataView(storedState) : {};
    const directorInput = getDirectorInputFromSeedPayload(directorTaskData);
    if (!directorInput) {
      throw new AppError("La tarea actual del director carece de información de generación reutilizable; continúe desde la entrada de adquisición del proyecto.", 409);
    }
    const instruction = input.instruction?.trim() || null;
    if (input.action === "regenerate") {
      await this.novelService.createNovelSnapshot(
        task.novelId,
        "before_pipeline",
        `before-step-calibration-${module.id}-${Date.now()}`,
      );
    }
    const stateWriter = new DirectorTaskStateWriter(this.workflowService);
    await stateWriter.updateDirectorRunState(taskId, {
      stepCalibration: { action: input.action, stepId: module.id, instruction, updatedAt: new Date().toISOString() },
    });
    await this.runtimeOrchestrator.runStepModule({
      module,
      taskId,
      novelId: task.novelId,
      targetId: input.targetId?.trim() || task.novelId,
      approveCurrentGate: false,
      approveAutoExecutionScope: false,
      reuseCompletedStep: false,
    });
    await stateWriter.updateDirectorRunState(taskId, {
      stepReview: {
        stepId: module.id,
        nodeKey: module.nodeKey,
        label: module.label,
        targetType: module.targetType,
        targetId: input.targetId?.trim() || task.novelId,
        completedAt: new Date().toISOString(),
      },
    });
    await stateWriter.markWaitingCheckpoint(taskId, {
      stage: "auto_director",
      itemKey: module.id,
      itemLabel: `${module.label}Ya calibrado, por favor verifique antes de continuar.`,
      checkpointType: "step_review_required",
      checkpointSummary: `${module.label}Completado${input.action === "improve" ? "Completo" : "Regenerado"}. Confirme el contenido actual antes de continuar con la dirección.`,
    });
    return { action: input.action, stepId: module.id, instruction, status: "waiting_review" };
  }
}
