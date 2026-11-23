import type {DashboardView} from "../../domain";
import type {DirectorWorkerHealth} from "../worker";
import type {RunRepository} from "../ports";

/** No task writes, wakeups or recovery commands from a read path. */
export function projectQueuedRun(view: DashboardView, state: NonNullable<Awaited<ReturnType<RunRepository["getSchedulingState"]>>>,
  health: DirectorWorkerHealth, now: Date): DashboardView {
  if (view.mode !== "queued") return view;
  const liveLease = !!state.leaseOwner && !!state.leaseExpiresAt && state.leaseExpiresAt > now;
  const stale = !health.lastPollAt || now.getTime() - health.lastPollAt.getTime() > 60_000;
  const busy = health.state === "working" && health.activeRunId !== view.runId;
  const unavailable = health.state === "stopped" || (!busy && stale);
  const canRetry = !liveLease && !busy && (unavailable || health.state === "retrying" || now.getTime() - state.createdAt.getTime() > 60_000);
  const status = liveLease ? "starting" : busy ? "busy" : unavailable ? "unavailable" : health.state === "retrying" ? "retrying" : "waiting";
  return {...view, workerStatus: {state: status, canRetry},
    headline: liveLease ? "Comenzando esta creación" : busy ? "A la espera de otras obras para completar la etapa actual" : canRetry ? "Esta creación aún no ha comenzado." : "Esperando para empezar a crear",
    nextActionGuidance: canRetry ? "Puede hacer clic en \"Reiniciar creación\" para volver a intentar hacer cola y se conservarán el contenido existente y el rango de creación."
      : busy ? "Otros trabajos se están procesando en segundo plano y este libro comenzará una vez que finalice la fase actual." : "Espere a que esta creación comience en segundo plano.",
    detail: unavailable ? "La ejecución en segundo plano no está disponible temporalmente. Reinicie la creación para solicitar la ejecución nuevamente."
      : health.state === "retrying" ? "Si se encuentra una excepción durante la ejecución en segundo plano, el sistema lo volverá a intentar automáticamente." : view.detail,
    availableActions: canRetry ? [{id: "retry_start", label: "Reiniciar la creación", kind: "command", primary: true, command: "retry_start"},
      ...view.availableActions] : view.availableActions};
}
