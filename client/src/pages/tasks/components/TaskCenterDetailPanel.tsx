import type { DirectorDashboardView, DirectorRuntimeProjection } from "@ai-novel/shared/types/directorRuntime";
import type { NovelWorkflowMilestone } from "@ai-novel/shared/types/novelWorkflow";
import type { UnifiedTaskDetail, UnifiedTaskStep } from "@ai-novel/shared/types/task";
import { Link } from "react-router-dom";
import { getTaskHistorySourceHref } from "@/lib/novelRoutes";
import DirectorRuntimeProjectionCard from "@/components/autoDirector/DirectorRuntimeProjectionCard";
import {
  TaskQueueActionRow,
  TaskQueueImpactNotice,
  TaskQueueSection,
  TaskQueueStatusBadge,
  type TaskQueueSeverity,
} from "@/components/taskQueue";
import { Button } from "@/components/ui/button";
import { WorkspaceStateNotice } from "@/components/workspace";
import TaskCenterDetailSummary from "./TaskCenterDetailSummary";
import TaskCenterMilestoneHistory from "./TaskCenterMilestoneHistory";

interface TaskCenterDetailPanelProps {
  task?: UnifiedTaskDetail | null;
  loading: boolean;
  errorMessage?: string | null;
  onRetryLoad: () => void;
  isAutoDirectorTask: boolean;
  currentModelLabel: string;
  dashboardView?: DirectorDashboardView | null;
  runtimeProjection?: DirectorRuntimeProjection | null;
  noticeSeverity: TaskQueueSeverity;
  noticeTitle: string;
  failureIsQualityReminder: boolean;
  steps: UnifiedTaskStep[];
  milestones: NovelWorkflowMilestone[];
}

export default function TaskCenterDetailPanel(props: TaskCenterDetailPanelProps) {
  const task = props.task;

  return (
    <TaskQueueSection
      title="Detalles de la misión"
      description="Vea el impacto actual, la ubicación de recuperación y las páginas de origen, y amplíe los parámetros de ejecución según sea necesario."
      className="overflow-hidden rounded-2xl border-border/40 bg-card/60 shadow-[0_12px_36px_rgba(15,23,42,0.035)]"
    >
      <div className="space-y-4 text-sm">
        {props.loading ? (
          <WorkspaceStateNotice loading title="Leer detalles de la tarea" description="Sincronización del estado de las tareas, puntos de control y pasos recientes." />
        ) : null}
        {props.errorMessage ? (
          <WorkspaceStateNotice
            tone="danger"
            title="No se pudieron leer los detalles de la tarea"
            description={props.errorMessage}
            action={<Button size="sm" variant="outline" onClick={props.onRetryLoad}>Releer</Button>}
          />
        ) : null}
        {!props.loading && !props.errorMessage && !task ? (
          <WorkspaceStateNotice title="Por favor seleccione una tarea" description="Después de seleccionar un elemento de la lista de tareas, puede ver el área de impacto, la ubicación de recuperación y la entrada de origen." />
        ) : null}

        {task ? (
          <>
            <TaskCenterDetailSummary
              task={task}
              isAutoDirectorTask={props.isAutoDirectorTask}
              currentModelLabel={props.currentModelLabel}
              dashboardView={props.dashboardView}
            />

            {task.noticeCode || task.noticeSummary ? (
              <TaskQueueImpactNotice
                severity={props.noticeSeverity}
                title={props.noticeTitle}
                description={task.noticeSummary ?? "La tarea ha registrado un recordatorio de resultado que debe verse."}
              />
            ) : null}

            {task.failureCode || task.failureSummary ? (
              <TaskQueueImpactNotice
                severity={props.failureIsQualityReminder ? "quality" : "blocking"}
                title={props.failureIsQualityReminder ? "Aviso de calidad" : "Bloqueo de tareas"}
                description={task.failureSummary ?? "La tarea registra el estado de falla que debe manejarse."}
              />
            ) : null}

            {task.lastError && !props.failureIsQualityReminder && !task.failureCode && !task.failureSummary ? (
              <WorkspaceStateNotice tone="danger" title="La última ejecución falló." description={task.lastError} />
            ) : null}

            {task.kind === "novel_workflow" && task.checkpointSummary ? (
              <WorkspaceStateNotice compact title="Último punto de control" description={task.checkpointSummary} />
            ) : null}

            {props.isAutoDirectorTask ? <DirectorRuntimeProjectionCard projection={props.runtimeProjection} /> : null}

            {props.isAutoDirectorTask ? (
              <WorkspaceStateNotice
                compact
                tone="info"
                title="Entrada a la fuente de tareas del director"
                description="Regrese a la página de la novela para conocer las estrategias de continuación, recuperación, cambio de modelo y avance; el registro en ejecución solo muestra el estado, los errores, las posiciones de recuperación y las entradas de origen."
              />
            ) : null}

            <TaskQueueActionRow
              title="Página de código abierto"
              consequence="Solo se abre el origen de la tarea y no se cambiará el estado de la tarea. Continuar, reanudar o volver a intentarlo en la página de origen."
              action={<Button asChild size="sm" variant="outline"><Link to={getTaskHistorySourceHref(task)}>Página de código abierto</Link></Button>}
            />

            <details className="group border-t border-border/35 pt-3">
              <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-medium marker:hidden">
                <span>Pasos de ejecución {props.steps.length > 0 ? `(${props.steps.length})` : ""}</span>
                <span className="text-xs font-normal text-muted-foreground group-open:hidden">Expandir</span>
                <span className="hidden text-xs font-normal text-muted-foreground group-open:inline">Cerca</span>
              </summary>
              <div className="mt-3 space-y-2">
                {props.steps.length === 0 ? (
                  <WorkspaceStateNotice compact title="Aún no hay estado de paso" description="Esta tarea aún no tiene un desglose demostrable." />
                ) : props.steps.map((step) => (
                  <div key={step.key} className="flex items-center justify-between rounded-xl bg-muted/25 px-3 py-2">
                    <div>{step.label}</div>
                    <TaskQueueStatusBadge
                      label={step.status === "succeeded" ? "Completado" : step.status === "failed" ? "Error" : step.status === "running" ? "En curso" : step.status === "cancelled" ? "Cancelado" : "Sin empezar"}
                      tone={step.status === "succeeded" ? "success" : step.status === "failed" ? "danger" : step.status === "running" ? "info" : "neutral"}
                      className="border-0 bg-background/70 font-normal"
                    />
                  </div>
                ))}
              </div>
            </details>

            {task.kind === "novel_workflow" ? <TaskCenterMilestoneHistory milestones={props.milestones} /> : null}
          </>
        ) : null}
      </div>
    </TaskQueueSection>
  );
}
