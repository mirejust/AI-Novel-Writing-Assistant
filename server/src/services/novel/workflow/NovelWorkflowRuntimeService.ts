import { NovelWorkflowService } from "./NovelWorkflowService";
import {canExecuteLegacyTask} from "../../../modules/novel/director-routing";

const STALE_RUNNING_RECOVERY_MESSAGE = "La tarea del director automático no tiene latidos durante mucho tiempo, lo que puede haberse interrumpido debido a un reinicio del servicio o memoria insuficiente. Por favor verifique y continúe o inténtelo nuevamente.";

interface WorkflowRecoveryPort {
  listRecoverableAutoDirectorTasks(options?: { includeStaleRunningFlag?: boolean }): Promise<Array<{
    id: string;
    status: string;
    stale?: boolean;
  }>>;
  requeueTaskForRecovery(taskId: string, message: string): Promise<unknown>;
  restoreTaskToCheckpoint(taskId: string): Promise<unknown>;
  markTaskFailed(taskId: string, message: string): Promise<unknown>;
}

function createWorkflowService(): WorkflowRecoveryPort {
  return new NovelWorkflowService();
}

export class NovelWorkflowRuntimeService {
  private readonly workflowService: WorkflowRecoveryPort;
  private readonly canRecover: (id: string) => Promise<boolean>;
  constructor(workflowService?: WorkflowRecoveryPort) {
    this.workflowService = workflowService ?? createWorkflowService();
    this.canRecover = workflowService ? async () => true : canExecuteLegacyTask;
  }

  async markPendingAutoDirectorTasksForManualRecovery(options: {
    staleRunningAsFailed?: boolean;
  } = {}): Promise<void> {
    const rows = await this.workflowService.listRecoverableAutoDirectorTasks({
      includeStaleRunningFlag: options.staleRunningAsFailed === true,
    });
    for (const row of rows) {
      if (!await this.canRecover(row.id)) continue;
      if (options.staleRunningAsFailed === true && row.stale) {
        await this.workflowService.markTaskFailed(row.id, STALE_RUNNING_RECOVERY_MESSAGE);
        continue;
      }
      await this.workflowService.requeueTaskForRecovery(row.id, "Una vez reiniciado el servicio, la tarea se suspendió y está esperando la recuperación manual.");
    }
  }
}
