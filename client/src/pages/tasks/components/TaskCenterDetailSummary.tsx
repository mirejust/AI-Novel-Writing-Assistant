import type { DirectorDashboardView } from "@ai-novel/shared/types/directorRuntime";
import type { UnifiedTaskDetail } from "@ai-novel/shared/types/task";
import { TaskQueueStatusBadge } from "@/components/taskQueue";
import {
  formatCheckpoint,
  formatDate,
  formatKind,
  formatResumeTarget,
  formatStatus,
  formatTokenCount,
  getTaskQueueLevelLabel,
  getTaskQueueTone,
} from "../taskCenterUtils";

interface TaskCenterDetailSummaryProps {
  task: UnifiedTaskDetail;
  isAutoDirectorTask: boolean;
  currentModelLabel: string;
  dashboardView?: DirectorDashboardView | null;
}

export default function TaskCenterDetailSummary({
  task,
  isAutoDirectorTask,
  currentModelLabel,
  dashboardView,
}: TaskCenterDetailSummaryProps) {
  const progressPercent = typeof dashboardView?.progressPercent === "number"
    ? dashboardView.progressPercent
    : Math.round(task.progress * 100);
  const currentStage = dashboardView?.stageLabel ?? task.currentStage ?? "Sin datos";
  const currentItem = dashboardView?.currentAction ?? task.currentItemLabel ?? "Sin datos";
  const tone = getTaskQueueTone(task);
  const technicalRows = [
    ["Latido reciente", formatDate(task.heartbeatAt)],
    ["Hora de inicio", formatDate(task.startedAt)],
    ["Tiempo final", formatDate(task.finishedAt)],
    ["Número de reintentos", task.retryCountLabel],
    ...((task.provider || task.model) ? [["Modelo de llamada", `${task.provider ?? "Sin datos"} / ${task.model ?? "Sin datos"}`]] : []),
    ...(isAutoDirectorTask ? [["Modelo de interfaz", currentModelLabel]] : []),
    ...((task.tokenUsage || task.provider || task.model) ? [
      ["Llamadas acumuladas", formatTokenCount(task.tokenUsage?.llmCallCount ?? 0)],
      ["Introducir fichas", formatTokenCount(task.tokenUsage?.promptTokens ?? 0)],
      ["Fichas de salida", formatTokenCount(task.tokenUsage?.completionTokens ?? 0)],
      ["Fichas acumuladas", formatTokenCount(task.tokenUsage?.totalTokens ?? 0)],
      ["Registros recientes", formatDate(task.tokenUsage?.lastRecordedAt)],
    ] : []),
  ];

  return (
    <section className="space-y-4">
      <div>
        <div className="text-lg font-semibold tracking-tight">{task.title}</div>
        <div className="mt-1 text-xs text-muted-foreground">
          {formatKind(task.kind)} · {task.ownerLabel}
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5">
        <TaskQueueStatusBadge label={getTaskQueueLevelLabel(task)} tone={tone} />
        <TaskQueueStatusBadge label={formatStatus(task.status)} tone="neutral" className="border-0 bg-muted/60 font-normal" />
      </div>
      <div>
        <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
          <span>{dashboardView?.statusLabel ?? task.displayStatus ?? formatStatus(task.status)}</span>
          <span className="tabular-nums">{progressPercent}%</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-primary/70" style={{ width: `${progressPercent}%` }} />
        </div>
      </div>
      <div className="grid gap-3 rounded-xl bg-muted/25 p-4 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
        <div>
          <div className="text-[11px] text-muted-foreground">Etapa actual</div>
          <div className="mt-1 leading-5 text-foreground/90">{currentStage}</div>
        </div>
        <div>
          <div className="text-[11px] text-muted-foreground">Tratamiento</div>
          <div className="mt-1 leading-5 text-foreground/90">{currentItem}</div>
        </div>
        {task.kind === "novel_workflow" ? (
          <>
            <div>
              <div className="text-[11px] text-muted-foreground">Sugerir próximos pasos</div>
              <div className="mt-1 leading-5 text-foreground/90">{task.resumeAction ?? task.nextActionLabel ?? "Continúa el flujo principal de la novela."}</div>
            </div>
            <div>
              <div className="text-[11px] text-muted-foreground">Último punto de control</div>
              <div className="mt-1 leading-5 text-foreground/90">{formatCheckpoint(task.checkpointType, task.executionScopeLabel)}</div>
            </div>
          </>
        ) : null}
      </div>
      {task.blockingReason ? (
        <div className="rounded-xl bg-destructive/[0.055] px-4 py-3 text-sm leading-6 text-destructive">
          {task.blockingReason}
        </div>
      ) : null}
      <details className="group border-t border-border/35 pt-3">
        <summary className="flex cursor-pointer list-none items-center justify-between text-xs font-medium text-muted-foreground marker:hidden">
          Información de operación
          <span className="group-open:hidden">Expandir</span>
          <span className="hidden group-open:inline">Cerca</span>
        </summary>
        <dl className="mt-3 grid gap-x-4 gap-y-2 text-xs sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
          {task.kind === "novel_workflow" ? (
            <>
              <div><dt className="text-muted-foreground">Restaurar la página de destino</dt><dd className="mt-0.5 text-foreground/85">{formatResumeTarget(task.resumeTarget)}</dd></div>
              <div><dt className="text-muted-foreground">Etapa de salud reciente</dt><dd className="mt-0.5 text-foreground/85">{task.lastHealthyStage ?? "Sin datos"}</dd></div>
            </>
          ) : null}
          {technicalRows.map(([label, value]) => (
            <div key={label}><dt className="text-muted-foreground">{label}</dt><dd className="mt-0.5 break-words text-foreground/85">{value}</dd></div>
          ))}
        </dl>
      </details>
    </section>
  );
}
