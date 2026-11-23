import type {
  DirectorPolicyMode,
  DirectorRuntimeProjection,
  DirectorRuntimeProjectionStatus,
} from "@ai-novel/shared/types/directorRuntime";
import { getDirectorNodeDisplayLabel } from "@ai-novel/shared/types/directorRuntime";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  PauseCircle,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Link } from "react-router-dom";
import type { DirectorIssueAction, DirectorIssueDecision } from "@ai-novel/shared/types/directorIssue";

interface DirectorRuntimeProjectionCardProps {
  projection: DirectorRuntimeProjection | null | undefined;
  className?: string;
  compact?: boolean;
}

const ISSUE_ACTION_LABELS: Record<DirectorIssueAction, string> = {
  auto_retry: "Reintento automático",
  continue_with_warning: "Continuar después del recordatorio",
  pause_for_manual: "Pausar procesamiento",
  fail_task: "Finalizar la tarea",
};

const POLICY_SOURCE_LABELS: Record<DirectorIssueDecision["policySource"], string> = {
  global: "Reglas globales",
  novel: "Reglas del libro",
  task_snapshot: "Reglas de inicio de tarea",
  safety: "Resultado final de seguridad",
};

function formatDate(value: string | null | undefined): string {
  if (!value) {
    return "Sin datos";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Sin datos";
  }
  return date.toLocaleString();
}

function formatTokenCount(value: number | null | undefined): string {
  const count = Math.max(0, Math.round(Number(value ?? 0)));
  return count.toLocaleString();
}

function formatDuration(value: number | null | undefined): string | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return null;
  }
  const seconds = Math.round(value / 1000);
  if (seconds <= 0) {
    return "<1 segundo";
  }
  if (seconds < 60) {
    return `${seconds} Segundo`;
  }
  const minutes = Math.floor(seconds / 60);
  const restSeconds = seconds % 60;
  return restSeconds > 0 ? `${minutes} punto ${restSeconds} Segundo` : `${minutes} puntos`;
}

function formatUsageLine(usage: {
  llmCallCount: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  durationMs?: number | null;
}): string {
  const duration = formatDuration(usage.durationMs);
  return [
    `${formatTokenCount(usage.llmCallCount)} llamadas`,
    `ingresar ${formatTokenCount(usage.promptTokens)}`,
    `producción ${formatTokenCount(usage.completionTokens)}`,
    `total ${formatTokenCount(usage.totalTokens)} Tokens`,
    duration ? `Tiempo de llamada acumulado ${duration}` : null,
  ].filter(Boolean).join(" · ");
}

function formatPolicyMode(mode: DirectorPolicyMode): string {
  if (mode === "suggest_only") {
    return "Solo da sugerencias";
  }
  if (mode === "run_next_step") {
    return "Continúe con el siguiente paso";
  }
  if (mode === "auto_safe_scope") {
    return "Avance automático de rango seguro";
  }
  return "Avance al punto de control";
}

function formatStatus(status: DirectorRuntimeProjectionStatus): string {
  if (status === "running") {
    return "Avanzando";
  }
  if (status === "waiting_approval") {
    return "Esperando confirmación";
  }
  if (status === "blocked") {
    return "En pausa";
  }
  if (status === "failed") {
    return "Error";
  }
  if (status === "completed") {
    return "Completado";
  }
  return "Para empezar";
}

function statusClassName(status: DirectorRuntimeProjectionStatus): string {
  if (status === "running") {
    return "border-sky-300 bg-sky-50 text-sky-900";
  }
  if (status === "waiting_approval") {
    return "border-amber-300 bg-amber-50 text-amber-900";
  }
  if (status === "blocked" || status === "failed") {
    return "border-destructive/30 bg-destructive/5 text-destructive";
  }
  if (status === "completed") {
    return "border-emerald-300 bg-emerald-50 text-emerald-900";
  }
  return "border-border bg-muted/30 text-muted-foreground";
}

function statusIcon(status: DirectorRuntimeProjectionStatus) {
  if (status === "running") {
    return <Activity className="h-4 w-4" />;
  }
  if (status === "waiting_approval") {
    return <PauseCircle className="h-4 w-4" />;
  }
  if (status === "blocked") {
    return <AlertTriangle className="h-4 w-4" />;
  }
  if (status === "failed") {
    return <XCircle className="h-4 w-4" />;
  }
  if (status === "completed") {
    return <CheckCircle2 className="h-4 w-4" />;
  }
  return <ShieldCheck className="h-4 w-4" />;
}

function riskBadgeClassName(level: NonNullable<DirectorRuntimeProjection["visibleRiskBadges"]>[number]["level"]) {
  if (level === "danger") {
    return "border-red-200 bg-red-50 text-red-700";
  }
  if (level === "warning") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }
  return "border-sky-200 bg-sky-50 text-sky-700";
}

function formatQualityDebtSummary(summary: DirectorRuntimeProjection["qualityDebtSummary"] | null | undefined): string | null {
  if (!summary || summary.deferredChapterCount <= 0) {
    return null;
  }
  const orderText = summary.deferredChapterOrders.length > 0
    ? `: No. ${summary.deferredChapterOrders.join(",")}`
    : "";
  return `Calidad a recuperar${orderText}. El sistema continuará escribiendo los capítulos siguientes primero y recuperará estos problemas en la fase de reparación de calidad.`;
}

function formatQualityBudgetSummary(summary: DirectorRuntimeProjection["qualityBudgetSummary"] | null | undefined): string | null {
  if (!summary) {
    return null;
  }
  const chapterText = typeof summary.currentChapterOrder === "number"
    ? `Cap. ${summary.currentChapterOrder}`
    : "Capítulo actual";
  const automaticRepairUsed = Math.min(1, summary.patchRepairUsed + summary.chapterRewriteUsed);
  return `${chapterText}Procesamiento automático: este capítulo arreglado ${automaticRepairUsed}/1, replanificación de ventanas ${Math.min(1, summary.windowReplanUsed)}/1.${summary.nextActionLabel}`;
}

function formatRootCauseSummary(projection: DirectorRuntimeProjection): string | null {
  if (!projection.rootCauseCode || projection.rootCauseCode === "none") {
    return null;
  }
  if (projection.rootCauseCode === "replan_required") {
    return "El problema actual proviene de la falta de coincidencia de las responsabilidades de los capítulos, y el sistema necesita ajustar primero la disposición de los capítulos cercanos.";
  }
  if (projection.rootCauseCode === "draft_obligation_unmet") {
    return "El texto principal ha sido generado, pero aún quedan cosas por completar en este capítulo que no se han cumplido.";
  }
  if (projection.rootCauseCode === "draft_repair_exhausted") {
    return "Se ha generado el texto principal, pero todavía hay problemas de bloqueo que deben procesarse después de la reparación automática.";
  }
  return "El texto principal no se generó correctamente y es necesario volver a ejecutar el capítulo actual.";
}

function formatRiskAction(action: NonNullable<DirectorRuntimeProjection["latestRiskAssessment"]>["action"]): string {
  if (action === "forced_pause" || action === "pause_requested" || action === "paused") {
    return "se detendrá después del nodo seguro actual";
  }
  if (action === "quality_debt_recorded") {
    return "La deuda de calidad se ha registrado y seguirá avanzando en próximos capítulos.";
  }
  if (action === "notified") {
    return "Alerta de riesgo enviada";
  }
  return "Ya grabado, el director automático seguirá determinando el siguiente paso";
}

function riskScoreClassName(score: number): string {
  if (score >= 8) return "border-destructive/30 bg-destructive/5 text-destructive";
  if (score >= 5) return "border-amber-300 bg-amber-50 text-amber-900";
  return "border-sky-300 bg-sky-50 text-sky-900";
}

function formatRiskCategory(category: NonNullable<DirectorRuntimeProjection["latestRiskAssessment"]>["category"]): string {
  const labels: Record<typeof category, string> = {
    planning: "Planificación",
    candidate_confirmation: "Confirmación de candidato",
    chapter_generation: "Generación de capítulos",
    chapter_acceptance: "Aceptación del capítulo",
    chapter_repair: "Correcciones del capítulo",
    state_proposal: "Propuesta de estado",
    replan: "Planificación pesada",
    model_failure: "Fallo del modelo",
    worker_failure: "Fallo del actuador",
    task_recovery: "Recuperación de tareas",
    protected_content: "Texto protegido",
    runtime_safety: "Seguridad en tiempo de ejecución",
    data_integrity: "Integridad de los datos",
    unknown: "Otros",
  };
  return labels[category];
}

function formatPercent(value: number | null | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "0%";
  }
  return `${Math.max(0, Math.min(100, Math.round(value)))}%`;
}

export default function DirectorRuntimeProjectionCard({
  projection,
  className,
  compact = false,
}: DirectorRuntimeProjectionCardProps) {
  if (!projection) {
    return null;
  }
  const primaryText = projection.headline?.trim()
    || projection.currentLabel?.trim()
    || projection.lastEventSummary?.trim()
    || "Esperando sincronización del estado de avance actual";
  const detailText = projection.detail?.trim();
  const attentionText = projection.requiresUserAction
    ? projection.blockingReason?.trim()
      || projection.blockedReason?.trim()
      || projection.lastEventSummary?.trim()
      || "Procese primero la parada actual."
    : projection.blockingReason?.trim() || projection.blockedReason?.trim();
  const progressLine = projection.progressBreakdown?.explanation?.trim()
    || projection.progressSummary?.trim()
    || null;
  const qualityDebtLine = formatQualityDebtSummary(projection.qualityDebtSummary);
  const qualityBudgetLine = formatQualityBudgetSummary(projection.qualityBudgetSummary);
  const rootCauseLine = formatRootCauseSummary(projection);
  const obligationLine = projection.blockingObligations && projection.blockingObligations.length > 0
    ? `Aún necesito procesar:${projection.blockingObligations.slice(0, 3).map((item) => item.summary).join(";")}`
    : null;
  const activeExecutionLine = projection.activeExecution
    ? `Ejecución en segundo plano:${getDirectorNodeDisplayLabel({
      nodeKey: projection.activeExecution.stepType,
      fallback: projection.currentAction || "Tareas automáticas del director",
    })}${projection.activeExecution.resourceClass ? ` · ${projection.activeExecution.resourceClass}` : ""}`
    : null;
  const waitingLine = projection.waitingReason ? `Razón de espera:${projection.waitingReason}` : null;
  const workerHealthLine = projection.workerHealth
    ? [
      `Cola de ejecución:${projection.workerHealth.queuedCommandCount} espera`,
      projection.workerHealth.runningCommandCount > 0 ? `${projection.workerHealth.runningCommandCount} procesamiento` : null,
      projection.workerHealth.currentWorkerId ? `Solenoide:${projection.workerHealth.currentWorkerId}` : null,
    ].filter(Boolean).join(" · ")
    : null;
  const helperLines = [
    activeExecutionLine,
    waitingLine,
    workerHealthLine,
    projection.nextActionLabel ? `Siguiente paso:${projection.nextActionLabel}` : null,
    projection.recommendedAction?.reason ? `Razones de la recomendación:${projection.recommendedAction.reason}` : null,
    projection.isAutopilotRecoverable ? "La IA puede continuar procesando desde su progreso actual." : null,
    rootCauseLine,
    obligationLine,
    qualityBudgetLine,
    qualityDebtLine,
    projection.scopeSummary,
    progressLine,
  ].filter((line): line is string => Boolean(line?.trim()));
  const recentEvents = projection.recentEvents.slice(0, compact ? 2 : 4);
  const recentIssues = projection.recentIssues?.slice(0, compact ? 2 : 6) ?? [];
  const usageSummary = projection.usageSummary ?? null;
  const stepUsage = projection.stepUsage?.slice(0, compact ? 2 : 4) ?? [];
  const promptUsage = projection.promptUsage?.slice(0, compact ? 2 : 6) ?? [];
  const visibleRiskBadges = projection.visibleRiskBadges?.slice(0, compact ? 3 : 6) ?? [];
  const progressBreakdown = projection.progressBreakdown ?? null;
  const latestRisk = projection.latestRiskAssessment ?? null;
  const riskHistory = projection.riskHistory ?? [];
  const affectedRiskChapters = latestRisk?.affectedChapterOrders.length
    ? `Cap. ${latestRisk.affectedChapterOrders.join(",")}`
    : "Paso actual";

  return (
    <div className={cn("rounded-lg border bg-background/80 p-3", statusClassName(projection.status), className)}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2">
          <span className="mt-0.5 shrink-0">{statusIcon(projection.status)}</span>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-foreground">El progreso del director.</div>
            <div className="mt-1 text-sm leading-5">{primaryText}</div>
          </div>
        </div>
        <Badge variant="outline" className="shrink-0 bg-background/70">
          {formatStatus(projection.status)}
        </Badge>
      </div>

      {visibleRiskBadges.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {visibleRiskBadges.map((badge) => (
            <Badge key={`${badge.source ?? "risk"}:${badge.label}`} variant="outline" className={cn("bg-background/70", riskBadgeClassName(badge.level))}>
              {badge.label}
            </Badge>
          ))}
        </div>
      ) : null}

      {latestRisk ? (
        <div className={cn("mt-3 rounded-md border px-3 py-2 text-sm leading-5", riskScoreClassName(latestRisk.score))}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-medium">Riesgo más alto actual:{latestRisk.score}/8</span>
            <span className="text-xs">Impacto:{affectedRiskChapters}</span>
          </div>
          <div className="mt-1">{latestRisk.evidenceSummary}</div>
          <div className="mt-1 text-xs opacity-85">{formatRiskAction(latestRisk.action)}. Siguiente paso:{latestRisk.recommendationReason}</div>
        </div>
      ) : null}

      <details className="mt-3 rounded-md border bg-background/70">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2 text-sm font-medium text-foreground">
          <span>Registro de eventos de riesgo</span>
          <Badge variant="outline">{projection.riskHistoryTotal ?? riskHistory.length}</Badge>
        </summary>
        <div className="space-y-2 border-t px-3 py-3">
          {riskHistory.length > 0 ? riskHistory.map((risk) => (
            <div key={risk.eventId} className={cn("rounded-md border px-3 py-2 text-xs leading-5", riskScoreClassName(risk.score))}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium">{risk.score}/8 · {formatRiskCategory(risk.category)}</span>
                <span>{formatDate(risk.assessedAt)}</span>
              </div>
              <div className="mt-1">{risk.evidenceSummary}</div>
              <div className="mt-1 opacity-85">
                Impacto:{risk.affectedChapterOrders.length > 0 ? `Cap. ${risk.affectedChapterOrders.join(",")}` : "Tarea actual"} · {formatRiskAction(risk.action)}
              </div>
              <div className="mt-1 opacity-85">Siguiente paso:{risk.recommendationReason}</div>
            </div>
          )) : (
            <div className="text-xs leading-5 text-muted-foreground">
              Actualmente no hay excepciones para puntuar. Luego de que se ejecute el director automático, cada tema que requiera toma de decisiones dejará aquí puntajes, motivos y acciones de procesamiento.
            </div>
          )}
        </div>
      </details>

      {progressBreakdown && !compact ? (
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <div className="rounded-md border bg-background/70 px-3 py-2">
            <div className="text-[11px] text-muted-foreground">Planificación</div>
            <div className="mt-1 text-sm font-semibold text-foreground">{formatPercent(progressBreakdown.planningProgress ?? progressBreakdown.planningPercent)}</div>
          </div>
          <div className="rounded-md border bg-background/70 px-3 py-2">
            <div className="text-[11px] text-muted-foreground">Capítulos</div>
            <div className="mt-1 text-sm font-semibold text-foreground">{progressBreakdown.continuableChapters}/{progressBreakdown.totalChapters}</div>
          </div>
          <div className="rounded-md border bg-background/70 px-3 py-2">
            <div className="text-[11px] text-muted-foreground">Calidad</div>
            <div className="mt-1 text-sm font-semibold text-foreground">{formatPercent(progressBreakdown.qualityProgress ?? progressBreakdown.qualityRepairPercent)}</div>
          </div>
          <div className="rounded-md border bg-background/70 px-3 py-2">
            <div className="text-[11px] text-muted-foreground">Acción actual</div>
            <div className="mt-1 text-sm font-semibold text-foreground">{formatPercent(progressBreakdown.activeJobProgress)}</div>
          </div>
        </div>
      ) : null}

      {attentionText ? (
        <div className="mt-3 rounded-md border bg-background/70 px-3 py-2 text-sm leading-5">
          {projection.requiresUserAction ? "Necesitas manejar:" : "Motivo de la suspensión:"}{attentionText}
        </div>
      ) : null}

      {detailText && detailText !== attentionText ? (
        <div className="mt-3 rounded-md border bg-background/70 px-3 py-2 text-sm leading-5">
          {detailText}
        </div>
      ) : null}

      {helperLines.length > 0 && !compact ? (
        <div className="mt-3 space-y-2">
          {helperLines.map((line) => (
            <div key={line} className="rounded-md border bg-background/70 px-3 py-2 text-xs leading-5 text-muted-foreground">
              {line}
            </div>
          ))}
        </div>
      ) : null}

      {usageSummary ? (
        <div className="mt-3 rounded-md border bg-background/70 px-3 py-2 text-xs leading-5 text-muted-foreground">
          <div className="font-medium text-foreground">Uso de IA</div>
          <div className="mt-1">{formatUsageLine(usageSummary)}</div>
          {promptUsage.length > 0 && !compact ? (
            <div className="mt-2 space-y-1">
              <div className="text-[11px] font-medium text-muted-foreground">Dosificación por etapas</div>
              {promptUsage.map((item) => (
                <div key={`${item.promptAssetKey}:${item.promptVersion ?? ""}:${item.nodeKey ?? ""}`} className="flex flex-wrap items-center justify-between gap-2 border-t pt-1">
                  <span className="min-w-0 truncate text-foreground">
                    {getDirectorNodeDisplayLabel({ label: item.label ?? item.promptAssetKey, nodeKey: item.nodeKey })}
                  </span>
                  <span className="shrink-0">{formatUsageLine(item)}</span>
                </div>
              ))}
            </div>
          ) : null}
          {stepUsage.length > 0 && !compact ? (
            <div className="mt-2 space-y-1">
              <div className="text-[11px] font-medium text-muted-foreground">Pasos avanzados</div>
              {stepUsage.map((item) => (
                <div key={item.stepIdempotencyKey} className="flex flex-wrap items-center justify-between gap-2 border-t pt-1">
                  <span className="min-w-0 truncate text-foreground">
                    {getDirectorNodeDisplayLabel({ label: item.label, nodeKey: item.nodeKey })}
                  </span>
                  <span className="shrink-0">{formatUsageLine(item)}</span>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
        <span className="rounded-full bg-background/70 px-2 py-1">Método de promoción:{formatPolicyMode(projection.policyMode)}</span>
        <span className="rounded-full bg-background/70 px-2 py-1">Hora de actualización:{formatDate(projection.updatedAt)}</span>
      </div>

      {recentIssues.length > 0 ? (
        <div className="mt-3 space-y-2">
          <div className="text-xs font-medium text-muted-foreground">Registro de problemas</div>
          {recentIssues.map(({ occurrence, decision }) => {
            const target = occurrence.chapterId && projection.novelId
              ? `/novels/${projection.novelId}/chapters/${occurrence.chapterId}`
              : projection.novelId ? `/novels/${projection.novelId}/edit` : null;
            return (
              <div key={occurrence.fingerprint} className="rounded-md border bg-background/70 px-3 py-2 text-xs leading-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium text-foreground">{occurrence.summary}</span>
                  {target ? <Link className="text-primary hover:underline" to={target}>Ir a procesamiento</Link> : null}
                </div>
                <div className="mt-1 text-muted-foreground">
                  {occurrence.issueCode} · {occurrence.chapterOrder ? `Cap. ${occurrence.chapterOrder} Capítulo · ` : ""}
                  puntuación de riesgo {occurrence.riskScore ?? "Para ser evaluado"}
                  {decision ? ` · ${ISSUE_ACTION_LABELS[decision.action]} · ${POLICY_SOURCE_LABELS[decision.policySource]}` : ""}
                </div>
              </div>
            );
          })}
        </div>
      ) : null}

      {recentEvents.length > 0 && !compact ? (
        <div className="mt-3 space-y-2">
          <div className="text-xs font-medium text-muted-foreground">Desarrollos recientes</div>
          {recentEvents.map((event) => (
            <div key={event.eventId} className="rounded-md border bg-background/70 px-3 py-2 text-xs leading-5">
              <div className="text-foreground">{event.summary}</div>
              <div className="mt-1 text-muted-foreground">{formatDate(event.occurredAt)}</div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
