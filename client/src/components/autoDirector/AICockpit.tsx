import type { ReactNode } from "react";
import type {
  DirectorBookAutomationAction,
  DirectorBookAutomationDisplayState,
  DirectorBookAutomationProjection,
} from "@ai-novel/shared/types/directorRuntime";
import { getDirectorNodeDisplayLabel } from "@ai-novel/shared/types/directorRuntime";
import {
  Activity,
  AlertTriangle,
  ChevronDown,
  CheckCircle2,
  Clock3,
  Database,
  ExternalLink,
  History,
  PauseCircle,
  ShieldCheck,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface AICockpitProps {
  projection?: DirectorBookAutomationProjection | null;
  mode?: "focusedNovel" | "compact";
  fallbackSummary?: string | null;
  fallbackStatusLabel?: string | null;
  isActionPending?: boolean;
  showDetailsAction?: boolean;
  onAction?: (projection: DirectorBookAutomationProjection, action: DirectorBookAutomationAction) => void;
  onOpenDetails?: (projection: DirectorBookAutomationProjection) => void;
  onOpenNovel?: (projection: DirectorBookAutomationProjection) => void;
  onOpenFallbackDetails?: () => void;
}

function displayStateLabel(state: DirectorBookAutomationDisplayState): string {
  const labels: Record<DirectorBookAutomationDisplayState, string> = {
    processing: "La IA está procesando",
    needs_confirmation: "Esperando tu confirmación",
    paused: "En pausa",
    needs_attention: "El error debe ser manejado",
    completed: "Completado",
    idle: "No encendido",
  };
  return labels[state];
}

function stateBadgeVariant(state: DirectorBookAutomationDisplayState): "default" | "secondary" | "outline" | "destructive" {
  if (state === "needs_attention") {
    return "destructive";
  }
  if (state === "processing") {
    return "default";
  }
  if (state === "needs_confirmation" || state === "paused") {
    return "outline";
  }
  return "secondary";
}

function stateClassName(state: DirectorBookAutomationDisplayState): string {
  if (state === "processing") {
    return "border-sky-500/25 bg-sky-500/10";
  }
  if (state === "needs_confirmation") {
    return "border-amber-500/25 bg-amber-500/10";
  }
  if (state === "paused") {
    return "border-indigo-500/25 bg-indigo-500/10";
  }
  if (state === "needs_attention") {
    return "border-destructive/30 bg-destructive/5";
  }
  if (state === "completed") {
    return "border-emerald-500/25 bg-emerald-500/10";
  }
  return "border-border/70 bg-muted/20";
}

function stateIcon(state: DirectorBookAutomationDisplayState) {
  if (state === "processing") {
    return <Activity className="h-4 w-4" />;
  }
  if (state === "needs_confirmation") {
    return <PauseCircle className="h-4 w-4" />;
  }
  if (state === "paused") {
    return <Clock3 className="h-4 w-4" />;
  }
  if (state === "needs_attention") {
    return <AlertTriangle className="h-4 w-4" />;
  }
  if (state === "completed") {
    return <CheckCircle2 className="h-4 w-4" />;
  }
  return <ShieldCheck className="h-4 w-4" />;
}

function stateAccentClassName(state: DirectorBookAutomationDisplayState): string {
  if (state === "processing") {
    return "text-sky-700 dark:text-sky-300";
  }
  if (state === "needs_confirmation") {
    return "text-amber-700 dark:text-amber-300";
  }
  if (state === "paused") {
    return "text-indigo-700 dark:text-indigo-300";
  }
  if (state === "needs_attention") {
    return "text-destructive";
  }
  if (state === "completed") {
    return "text-emerald-700 dark:text-emerald-300";
  }
  return "text-muted-foreground";
}

function stateSoftSurfaceClassName(state: DirectorBookAutomationDisplayState): string {
  if (state === "processing") {
    return "bg-sky-500/10";
  }
  if (state === "needs_confirmation") {
    return "bg-amber-500/10";
  }
  if (state === "paused") {
    return "bg-indigo-500/10";
  }
  if (state === "needs_attention") {
    return "bg-destructive/5";
  }
  if (state === "completed") {
    return "bg-emerald-500/10";
  }
  return "bg-muted/20";
}

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

function fallbackProjectionReason(props: Pick<AICockpitProps, "fallbackSummary">): string {
  return props.fallbackSummary?.trim() || "No hay tareas de avance automático de IA que debas manejar.";
}

function renderActionLabel(
  action: DirectorBookAutomationAction,
  displayState?: DirectorBookAutomationDisplayState,
): string {
  if (
    displayState === "needs_confirmation"
    && (action.type === "continue" || action.type === "auto_execute_range")
  ) {
    return "Confirmar y continuar";
  }
  return action.label || "Continuar procesando";
}

function artifactTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    book_contract: "Acuerdo a nivel de libro",
    story_macro: "Planificación de la historia",
    character_cast: "Personaje",
    volume_strategy: "Dividir en volúmenes",
    chapter_task_sheet: "Hoja de tareas",
    chapter_draft: "Texto",
    audit_report: "Revisión",
    repair_ticket: "Reparación",
    reader_promise: "Compromiso del lector",
    character_governance_state: "Estado del personaje",
    world_skeleton: "Marco mundial",
    source_knowledge_pack: "Paquete de información",
    chapter_retention_contract: "Acuerdo de retención",
    continuity_state: "Continuidad",
    rolling_window_review: "Revisión reciente",
  };
  return labels[type] ?? type;
}

function recoveryActionLabel(
  action: NonNullable<DirectorBookAutomationProjection["circuitBreaker"]>["recoveryAction"],
): string | null {
  const labels: Record<string, string> = {
    retry: "Reintentar el paso actual",
    resume_after_review: "Continuar después de comprobar el motivo.",
    switch_model: "Continuar después de cambiar de modelo",
    confirm_protected_content: "Confirmar los límites del contenido protegido",
    manual_repair: "Tratar primero los problemas del capítulo",
  };
  return action ? labels[action] ?? null : null;
}

function workerStateLabel(
  state: NonNullable<DirectorBookAutomationProjection["workerHealth"]>["derivedState"],
): string {
  const labels: Record<NonNullable<DirectorBookAutomationProjection["workerHealth"]>["derivedState"], string> = {
    idle: "no corriendo",
    queued_waiting_worker: "Esperando para hacerse cargo",
    leased_starting: "Tomando el control",
    running_step: "Avanzando automáticamente",
    waiting_gate: "Esperando confirmación",
    auto_recovering: "Recuperante",
    cancelled: "Interrumpido",
    failed_recoverable: "Esperando la recuperación",
    failed_hard: "Requiere atención",
    succeeded: "Completado",
  };
  return labels[state] ?? state;
}

function workerStateDetail(health: NonNullable<DirectorBookAutomationProjection["workerHealth"]>): string {
  if (health.message?.trim()) {
    return health.message.trim();
  }
  if (health.queuedCommandCount > 0) {
    return "La tarea se ha puesto en cola y seguirá avanzando después de que se haga cargo de la ejecución en segundo plano.";
  }
  if (health.runningCommandCount > 0 || health.leasedCommandCount > 0) {
    return "La ejecución en segundo plano está procesando la tarea actual.";
  }
  if (health.staleCommandCount > 0) {
    return "Después de que se interrumpa la ejecución en segundo plano, intentará reanudarse desde el último progreso.";
  }
  return "Actualmente no hay acciones en segundo plano en cola o ejecutadas.";
}

function SummaryMetric(props: {
  label: string;
  value: ReactNode;
  className?: string;
}) {
  return (
    <div className="min-w-0">
      <div className="text-[11px] text-muted-foreground">{props.label}</div>
      <div className={cn("mt-1 truncate text-sm font-medium text-foreground", props.className)}>
        {props.value}
      </div>
    </div>
  );
}

function DetailPanel(props: {
  title: string;
  summary?: ReactNode;
  icon?: ReactNode;
  children: ReactNode;
}) {
  return (
    <details className="group rounded-2xl bg-muted/25">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-medium text-foreground [&::-webkit-details-marker]:hidden">
        <span className="flex min-w-0 items-center gap-2">
          {props.icon ? <span className="shrink-0 text-muted-foreground">{props.icon}</span> : null}
          <span className="truncate">{props.title}</span>
        </span>
        <span className="flex shrink-0 items-center gap-2 text-xs font-normal text-muted-foreground">
          {props.summary}
          <ChevronDown className="h-4 w-4 transition group-open:rotate-180" />
        </span>
      </summary>
      <div className="px-4 pb-4 pt-1">
        {props.children}
      </div>
    </details>
  );
}

export default function AICockpit(props: AICockpitProps) {
  const {
    mode = "focusedNovel",
    fallbackStatusLabel,
    isActionPending = false,
    showDetailsAction = true,
    onAction,
    onOpenDetails,
    onOpenNovel,
    onOpenFallbackDetails,
  } = props;
  const focusProjection = props.projection ?? null;
  const isCompact = mode === "compact";

  if (!focusProjection) {
    return (
      <div className="rounded-2xl bg-muted/25 p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-start gap-2">
            <span className="mt-0.5 shrink-0 text-muted-foreground">{stateIcon("idle")}</span>
            <div className="min-w-0">
              <div className="text-sm font-semibold text-foreground">Cabina de IA</div>
              <div className="mt-1 text-xs leading-5 text-muted-foreground">{fallbackProjectionReason(props)}</div>
            </div>
          </div>
          <Badge variant="secondary" className="shrink-0">{fallbackStatusLabel ?? "No encendido"}</Badge>
        </div>
        {onOpenFallbackDetails ? (
          <Button type="button" size="sm" variant="outline" className="mt-3 w-full" onClick={onOpenFallbackDetails}>
            Controlar
          </Button>
        ) : null}
      </div>
    );
  }

  const primaryAction = focusProjection.primaryAction ?? null;
  const detailAction = focusProjection.secondaryActions?.find((item) => item.type === "open_details") ?? null;
  const canOpenDetails = showDetailsAction && Boolean(onOpenDetails || (detailAction && onAction));
  const recentItems = focusProjection.timeline.slice(0, isCompact ? 2 : 3);
  const artifactRows = focusProjection.artifactSummary.byType?.slice(0, 3) ?? [];
  const usageSummary = focusProjection.usageSummary ?? null;
  const stepUsage = focusProjection.stepUsage?.slice(0, 2) ?? [];
  const promptUsage = focusProjection.promptUsage?.slice(0, 6) ?? [];
  const circuitBreaker = focusProjection.circuitBreaker?.status === "open" ? focusProjection.circuitBreaker : null;
  const circuitRecovery = recoveryActionLabel(circuitBreaker?.recoveryAction ?? null);
  const workerHealth = focusProjection.workerHealth ?? null;
  const artifactInsightLines = [
    focusProjection.artifactSummary.affectedChapterCount
      ? `Influencia ${focusProjection.artifactSummary.affectedChapterCount} capítulos`
      : null,
    focusProjection.artifactSummary.recentStaleArtifacts?.length
      ? `${focusProjection.artifactSummary.recentStaleArtifacts.length} Es necesario revisar los productos.`
      : null,
    focusProjection.artifactSummary.recentRepairArtifacts?.length
      ? `${focusProjection.artifactSummary.recentRepairArtifacts.length} Registros de reparación`
      : null,
    focusProjection.artifactSummary.recentVersionedArtifacts?.length
      ? `${focusProjection.artifactSummary.recentVersionedArtifacts.length} Hay una nueva versión de este producto.`
      : null,
  ].filter((line): line is string => Boolean(line));
  const reason = focusProjection.userReason?.trim()
    || focusProjection.blockedReason?.trim()
    || focusProjection.detail?.trim()
    || focusProjection.automationSummary?.trim()
    || fallbackProjectionReason(props);
  const statusHeadline = focusProjection.userHeadline?.trim()
    || focusProjection.headline?.trim()
    || displayStateLabel(focusProjection.displayState);
  const statusDetail = reason === statusHeadline
    ? focusProjection.progressSummary?.trim() || "AI resumirá el estado más reciente del avance automático del libro aquí."
    : reason;
  const latestRecordText = recentItems[0] ? formatDate(recentItems[0].occurredAt) : "Sin datos";

  const handlePrimaryAction = () => {
    if (primaryAction && onAction) {
      onAction(focusProjection, primaryAction);
      return;
    }
    onOpenNovel?.(focusProjection);
  };

  const handleDetails = () => {
    if (detailAction && onAction) {
      onAction(focusProjection, detailAction);
      return;
    }
    onOpenDetails?.(focusProjection);
  };

  const handleCompactOpen = () => {
    if (onOpenNovel) {
      onOpenNovel(focusProjection);
      return;
    }
    handleDetails();
  };

  if (isCompact) {
    return (
      <div className={cn("rounded-lg border p-3", stateClassName(focusProjection.displayState))}>
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-start gap-2">
            <span className="mt-0.5 shrink-0 text-foreground">{stateIcon(focusProjection.displayState)}</span>
            <div className="min-w-0">
              <div className="text-sm font-semibold text-foreground">Cabina de IA</div>
              <div className="mt-1 line-clamp-1 text-xs leading-5 text-muted-foreground">
                {focusProjection.userHeadline || focusProjection.headline || reason}
              </div>
            </div>
          </div>
          <Badge variant={stateBadgeVariant(focusProjection.displayState)} className="shrink-0">
            {displayStateLabel(focusProjection.displayState)}
          </Badge>
        </div>
        <Button type="button" size="sm" variant="outline" className="mt-3 w-full" onClick={handleCompactOpen}>
          Controlar
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <section className={cn("rounded-2xl p-5 shadow-sm", stateSoftSurfaceClassName(focusProjection.displayState))}>
        <div className="flex items-center justify-between gap-3">
          <div className={cn("flex min-w-0 items-center gap-2 text-xs font-medium", stateAccentClassName(focusProjection.displayState))}>
            <span className="shrink-0">
              {stateIcon(focusProjection.displayState)}
            </span>
            <span className="truncate">{displayStateLabel(focusProjection.displayState)}</span>
          </div>
          <span className="min-w-0 max-w-[52%] truncate rounded-full bg-background/60 px-2.5 py-1 text-xs text-muted-foreground">
            {focusProjection.focusNovel.title}
          </span>
        </div>

        <div className="mt-4 max-w-[46rem]">
          <h3 className="text-base font-semibold leading-7 text-foreground">{statusHeadline}</h3>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{statusDetail}</p>
        </div>

        <div className="mt-5 grid gap-3 rounded-xl bg-background/60 p-3 sm:grid-cols-3">
          <SummaryMetric
            label="Estado actual"
            value={displayStateLabel(focusProjection.displayState)}
            className={stateAccentClassName(focusProjection.displayState)}
          />
          <SummaryMetric label="Descripción general avanzada" value={focusProjection.progressSummary || "Aún no hay resumen de progreso"} />
          <SummaryMetric label="Registros recientes" value={latestRecordText} />
        </div>

        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <div className="text-[11px] text-muted-foreground">Siguiente</div>
            <div className="mt-1 text-sm font-medium leading-5 text-foreground">
              {focusProjection.nextActionLabel || "Abra la novela para ver el contenido actual."}
            </div>
          </div>
          <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
            <Button type="button" size="sm" onClick={handlePrimaryAction} disabled={isActionPending}>
              {isActionPending ? "Procesando..." : renderActionLabel(primaryAction ?? {
                type: "open_novel",
                label: "Novela abierta",
                target: { novelId: focusProjection.novelId },
              }, focusProjection.displayState)}
            </Button>
            {canOpenDetails ? (
              <Button type="button" size="sm" variant="secondary" onClick={handleDetails}>
                <ExternalLink className="h-4 w-4" />
                Detalles de ejecución
              </Button>
            ) : null}
          </div>
        </div>
      </section>

      {circuitBreaker ? (
        <section className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm leading-6 text-destructive">
          <div className="font-medium">El avance automático está en pausa</div>
          <div className="mt-1">{circuitBreaker.message || "El sistema ha detectado que el avance automático continuo puede fallar repetidamente."}</div>
          {circuitRecovery ? <div className="mt-1">Sugerencia:{circuitRecovery}.</div> : null}
        </section>
      ) : null}

      {workerHealth ? (
        <section className="rounded-2xl bg-muted/25 px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
              <Database className="h-4 w-4 text-muted-foreground" />
              ejecución en segundo plano
            </div>
            <span className="text-xs text-muted-foreground">{workerStateLabel(workerHealth.derivedState)}</span>
          </div>
          <div className="mt-1 text-xs leading-5 text-muted-foreground">{workerStateDetail(workerHealth)}</div>
          <div className="mt-3 grid grid-cols-4 gap-3">
            <SummaryMetric label="Cola" value={workerHealth.queuedCommandCount} />
            <SummaryMetric label="Tomar el control" value={workerHealth.leasedCommandCount} />
            <SummaryMetric label="Implementar" value={workerHealth.runningCommandCount} />
            <SummaryMetric label="Recuperar" value={workerHealth.staleCommandCount} />
          </div>
          {workerHealth.oldestQueuedWaitMs ? (
            <div className="mt-2 text-[11px] text-muted-foreground">
              esperando para hacerse cargo {formatDuration(workerHealth.oldestQueuedWaitMs) ?? "<1 segundo"}
            </div>
          ) : null}
        </section>
      ) : null}

      {artifactRows.length > 0 ? (
        <section className="rounded-2xl bg-muted/25 px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
              <Database className="h-4 w-4 text-muted-foreground" />
              registro de producto
            </div>
            {artifactInsightLines.length > 0 ? (
              <span className="text-xs text-muted-foreground">{artifactInsightLines[0]}</span>
            ) : null}
          </div>
          <div className="mt-3 flex flex-wrap gap-x-3 gap-y-2 text-xs text-muted-foreground">
            {artifactRows.map((item) => (
              <span key={item.artifactType}>
                <span className="font-medium text-foreground">{artifactTypeLabel(String(item.artifactType))}</span>
                <span className="ml-1">{item.activeCount}/{item.totalCount}</span>
              </span>
            ))}
          </div>
          {artifactInsightLines.length > 1 ? (
            <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
              {artifactInsightLines.slice(1).map((line) => (
                <span key={line}>{line}</span>
              ))}
            </div>
          ) : null}
        </section>
      ) : null}

      {usageSummary ? (
        <DetailPanel
          title="Uso de IA"
          summary={`${formatTokenCount(usageSummary.llmCallCount)} Segunda categoría · ${formatTokenCount(usageSummary.totalTokens)} Tokens`}
          icon={<Activity className="h-4 w-4" />}
        >
          <div className="space-y-3 text-xs leading-5 text-muted-foreground">
            <div>{formatUsageLine(usageSummary)}</div>
            {promptUsage.length > 0 ? (
              <div className="space-y-1">
                <div className="font-medium text-foreground">Dosificación por etapas</div>
                <div className="divide-y divide-border/60">
                  {promptUsage.map((item) => (
                    <div key={`${item.promptAssetKey}:${item.promptVersion ?? ""}:${item.nodeKey ?? ""}`} className="grid gap-1 py-2 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
                      <span className="min-w-0 truncate text-foreground">
                        {getDirectorNodeDisplayLabel({ label: item.label ?? item.promptAssetKey, nodeKey: item.nodeKey })}
                      </span>
                      <span>{formatUsageLine(item)}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
            {stepUsage.length > 0 ? (
              <div className="space-y-1">
                <div className="font-medium text-foreground">Pasos avanzados</div>
                <div className="divide-y divide-border/60">
                  {stepUsage.map((item) => (
                    <div key={item.stepIdempotencyKey} className="grid gap-1 py-2 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
                      <span className="min-w-0 truncate text-foreground">
                        {getDirectorNodeDisplayLabel({ label: item.label, nodeKey: item.nodeKey })}
                      </span>
                      <span>{formatUsageLine(item)}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </DetailPanel>
      ) : null}

      {recentItems.length > 0 ? (
        <DetailPanel
          title="Grabación automatizada"
          summary={`${recentItems.length} Artículo`}
          icon={<History className="h-4 w-4" />}
        >
          <div className="divide-y divide-border/60 text-xs leading-5">
            {recentItems.map((item) => (
              <div key={item.id} className="py-2">
                <div className="line-clamp-2 text-foreground">{item.title}</div>
                {item.usage ? (
                  <div className="mt-1 text-muted-foreground">{formatUsageLine(item.usage)}</div>
                ) : item.durationMs ? (
                  <div className="mt-1 text-muted-foreground">pérdida de tiempo {formatDuration(item.durationMs)}</div>
                ) : null}
                <div className="mt-1 text-muted-foreground">{formatDate(item.occurredAt)}</div>
              </div>
            ))}
          </div>
        </DetailPanel>
      ) : null}
    </div>
  );
}
