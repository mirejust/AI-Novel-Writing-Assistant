import {FactIntegrityError, type RunStatus} from "../domain";
import {UnknownPlanVersionError, type ProjectionService} from "./projectionService";
import type {RunRepository} from "./ports";
import {DirectorProjectionUnavailableError} from "./diagnostics/errors";

export interface DirectorReadOnlyRecord {
  runId: string;
  novelId: string;
  statusLabel: string;
  headline: string;
  detail: string | null;
  progressLabel: string;
  sourceRoute: string;
  directorRoute: string;
}

const STATUS_LABELS: Readonly<Record<RunStatus, string>> = {
  queued: "esperando para comenzar", running: "Avanzando", waiting_gate: "Esperando confirmación", paused: "En pausa",
  completed: "Completado", failed: "interrumpir", cancelled: "Cancelado",
};

/** Read-only history can retain saved identity when the artifact facts cannot be projected. */
export class RecordProjection {
  constructor(private readonly deps: {
    projectionService: Pick<ProjectionService, "get">;
    runRepository: Pick<RunRepository, "getContract" | "getControl">;
  }) {}

  async get(runId: string): Promise<DirectorReadOnlyRecord> {
    try {
      const view = await this.deps.projectionService.get(runId);
      return {
        runId, novelId: view.novelId, statusLabel: STATUS_LABELS[view.mode], headline: view.headline,
        detail: view.detail, progressLabel: `${view.progress.done}/${view.progress.total} etapa completada`,
        sourceRoute: view.sourceRoute, directorRoute: `/lab/director/${encodeURIComponent(view.novelId)}`,
      };
    } catch (error) {
      if (!(error instanceof FactIntegrityError) && !(error instanceof UnknownPlanVersionError)
        && !(error instanceof DirectorProjectionUnavailableError)) throw error;
      const [contract, control] = await Promise.all([
        this.deps.runRepository.getContract(runId), this.deps.runRepository.getControl(runId),
      ]);
      if (!contract || contract.runId !== runId || typeof contract.novelId !== "string" || !contract.novelId.trim()
        || !control || !Object.hasOwn(STATUS_LABELS, control.status)) throw error;
      const sourceRoute = `/lab/director/${encodeURIComponent(contract.novelId)}`;
      return {
        runId, novelId: contract.novelId, statusLabel: STATUS_LABELS[control.status],
        headline: "Es necesario comprobar los resultados de la creación.",
        detail: error instanceof DirectorProjectionUnavailableError ? error.message
          : control.pause?.reason ?? "Vea y procese los resultados guardados desde la página de creación del libro.",
        progressLabel: "El progreso de la creación no se puede leer en este momento.", sourceRoute, directorRoute: sourceRoute,
      };
    }
  }
}
