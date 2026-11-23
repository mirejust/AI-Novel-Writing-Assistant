import type {
  NovelWorkflowMilestone,
  NovelWorkflowMilestoneType,
} from "@ai-novel/shared/types/novelWorkflow";
import type { DirectorBookAutomationAction } from "@ai-novel/shared/types/directorRuntime";
import type { TaskStatus } from "@ai-novel/shared/types/task";
import type { CharacterResourceProposalSummary } from "@ai-novel/shared/types/characterResource";
import type { AutoDirectorAction } from "@ai-novel/shared/types/autoDirectorFollowUp";
import AICockpit from "@/components/autoDirector/AICockpit";
import LLMSelector from "@/components/common/LLMSelector";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Link } from "react-router-dom";
import TaskCenterManualEditImpactCard from "@/pages/tasks/components/TaskCenterManualEditImpactCard";
import TaskCenterRuntimePolicyCard from "@/pages/tasks/components/TaskCenterRuntimePolicyCard";
import type { NovelTaskDrawerState } from "./NovelEditView.types";

type DrawerTask = NonNullable<NovelTaskDrawerState["task"]>;

function formatStatus(status: TaskStatus): string {
  if (status === "queued") {
    return "En cola";
  }
  if (status === "running") {
    return "En ejecución";
  }
  if (status === "waiting_approval") {
    return "Esperando revisión";
  }
  if (status === "succeeded") {
    return "Completado";
  }
  if (status === "failed") {
    return "Error";
  }
  return "Cancelado";
}

function formatTaskStatus(task: DrawerTask): string {
  if (task.pendingManualRecovery) {
    return "Para ser restaurado";
  }
  return formatStatus(task.status);
}

function toStatusVariant(status: TaskStatus): "default" | "outline" | "secondary" | "destructive" {
  if (status === "running") {
    return "default";
  }
  if (status === "failed") {
    return "destructive";
  }
  if (status === "queued" || status === "waiting_approval") {
    return "secondary";
  }
  return "outline";
}

function toTaskStatusVariant(task: DrawerTask): "default" | "outline" | "secondary" | "destructive" {
  if (task.pendingManualRecovery) {
    return "secondary";
  }
  return toStatusVariant(task.status);
}

function formatCheckpoint(checkpoint: NovelWorkflowMilestoneType | null | undefined, scopeLabel?: string | null): string {
  const resolvedScopeLabel = scopeLabel?.trim() || "Primeros 10 capitulos";
  if (checkpoint === "rewrite_snapshot_created") {
    return "Copia de seguridad creada antes de reescribir";
  }
  if (checkpoint === "candidate_selection_required") {
    return "Esperando confirmación de la dirección del libro";
  }
  if (checkpoint === "book_contract_ready") {
    return "El contrato del libro está listo";
  }
  if (checkpoint === "character_setup_required") {
    return "Preparación de personajes pendiente de revisión";
  }
  if (checkpoint === "volume_strategy_ready") {
    return "Estrategia de volumen/esqueleto de volumen pendiente de revisión";
  }
  if (checkpoint === "production_experience_required") {
    return "Listo para empezar a escribir, esperando seleccionar el método de producción.";
  }
  if (checkpoint === "chapter_batch_ready") {
    return `${resolvedScopeLabel}La ejecución automatizada está en pausa`;
  }
  if (checkpoint === "step_review_required") {
    return "Paso actual a comprobar";
  }
  if (checkpoint === "workflow_completed") {
    return "Proceso principal completado";
  }
  return "Sin datos";
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
  return new Intl.NumberFormat("zh-CN").format(Math.max(0, Math.round(value ?? 0)));
}

function formatStepStatus(status: "idle" | "running" | "succeeded" | "failed" | "cancelled"): string {
  if (status === "running") {
    return "En curso";
  }
  if (status === "succeeded") {
    return "Completado";
  }
  if (status === "failed") {
    return "Error";
  }
  if (status === "cancelled") {
    return "Cancelado";
  }
  return "Pendiente";
}

function formatRiskLevel(riskLevel: CharacterResourceProposalSummary["riskLevel"]): string {
  if (riskLevel === "high") {
    return "Alto riesgo";
  }
  if (riskLevel === "medium") {
    return "Requiere juicio";
  }
  return "Bajo riesgo";
}

function formatProposalSource(proposal: CharacterResourceProposalSummary): string {
  return proposal.sourceType === "chapter_background_sync" ? "Descubrimiento de sincronización automática" : "Hallazgos de la revisión manual";
}

function followUpActionVariant(action: AutoDirectorAction): "default" | "outline" {
  return action.kind === "mutation" && action.riskLevel !== "high" ? "default" : "outline";
}

function formatFollowUpPriority(priority: "P0" | "P1" | "P2"): string {
  if (priority === "P0") {
    return "P0 Procesar inmediatamente";
  }
  if (priority === "P1") {
    return "P1 Procesar lo más pronto posible";
  }
  return "P2 se procesará más tarde";
}

function readProposalPayloadText(
  proposal: CharacterResourceProposalSummary,
  key: string,
): string {
  const value = proposal.payload[key];
  return typeof value === "string" ? value.trim() : "";
}

function ResourceProposalCard(props: {
  proposal: CharacterResourceProposalSummary;
  onOpenSource?: (proposal: CharacterResourceProposalSummary) => void;
  onConfirm?: (proposalId: string) => void;
  onReject?: (proposalId: string) => void;
  confirmingProposalId?: string;
  rejectingProposalId?: string;
}) {
  const {
    proposal,
    onOpenSource,
    onConfirm,
    onReject,
    confirmingProposalId = "",
    rejectingProposalId = "",
  } = props;
  const resourceName = readProposalPayloadText(proposal, "resourceName") || "Recursos clave";
  const holderName = readProposalPayloadText(proposal, "holderCharacterName");
  const narrativeImpact = readProposalPayloadText(proposal, "narrativeImpact");
  const isConfirming = confirmingProposalId === proposal.id;
  const isRejecting = rejectingProposalId === proposal.id;

  return (
    <div className="space-y-3 rounded-xl border bg-background/80 p-3">
      <div className="flex flex-wrap items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium text-foreground">{resourceName}</div>
          <div className="mt-1 text-xs leading-5 text-muted-foreground">
            {holderName ? `${holderName}Recursos relacionados` : "Es necesario confirmar la propiedad de los recursos"}
          </div>
        </div>
        <Badge variant={proposal.riskLevel === "high" ? "destructive" : "secondary"}>
          {formatRiskLevel(proposal.riskLevel)}
        </Badge>
      </div>
      <div className="text-sm leading-6 text-muted-foreground">{proposal.summary}</div>
      {narrativeImpact ? (
        <div className="rounded-lg border border-border/70 bg-muted/20 px-3 py-2 text-xs leading-5 text-muted-foreground">
          Impacto después de la confirmación:{narrativeImpact}
        </div>
      ) : null}
      {proposal.evidence[0] ? (
        <div className="text-xs leading-5 text-muted-foreground">Evidencia:{proposal.evidence[0]}</div>
      ) : null}
      {proposal.validationNotes[0] ? (
        <div className="text-xs leading-5 text-muted-foreground">Motivo del juicio:{proposal.validationNotes[0]}</div>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline">{formatProposalSource(proposal)}</Badge>
        {proposal.chapterId ? <Badge variant="outline">Capítulo fuente</Badge> : null}
      </div>
      <div className="flex flex-wrap gap-2">
        {proposal.chapterId ? (
          <Button type="button" size="sm" variant="outline" onClick={() => onOpenSource?.(proposal)}>
            Ver fuente
          </Button>
        ) : null}
        <Button
          type="button"
          size="sm"
          onClick={() => onConfirm?.(proposal.id)}
          disabled={isConfirming || !onConfirm}
        >
          {isConfirming ? "Confirmando..." : "Confirmar y utilizar para escritura posterior."}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => onReject?.(proposal.id)}
          disabled={isRejecting || !onReject}
        >
          {isRejecting ? "Procesando..." : "Ignora este cambio"}
        </Button>
      </div>
    </div>
  );
}

export default function NovelTaskDrawer({
  open,
  onOpenChange,
  task,
  snapshot,
  runtimeSnapshot,
  projection,
  currentUiModel,
  actions,
  onProjectionAction,
  resourceProposals = [],
  onOpenResourceProposalSource,
  onConfirmResourceProposal,
  onRejectResourceProposal,
  confirmingResourceProposalId = "",
  rejectingResourceProposalId = "",
  followUp,
  onFollowUpAction,
  executingFollowUpAction = false,
  runtimeHardBlocked = false,
  runtimeBlockedReason = null,
  overrideModel,
  onOverrideModelChange,
  onRetryWithOverrideModel,
  retryWithOverrideModelPending = false,
  canRetryWithOverrideModel = false,
  onRetryWithTaskModel,
  retryWithTaskModelPending = false,
  capabilities,
  onOpenFullTaskCenter,
}: NovelTaskDrawerState) {
  const milestones = Array.isArray(task?.meta.milestones)
    ? task.meta.milestones as NovelWorkflowMilestone[]
    : [];
  const displayState = snapshot?.displayState ?? null;
  const dashboardView = snapshot?.dashboardView ?? null;
  const projectedProgressPercent = dashboardView?.progressPercent
    ?? displayState?.progressPercent
    ?? projection?.runtimeProjection?.progressBreakdown?.totalPercent;
  const workflowProgressFraction = typeof task?.progress === "number" && Number.isFinite(task.progress)
    ? task.progress
    : null;
  const progressPercent = Math.max(0, Math.min(100, Math.round(
    workflowProgressFraction !== null
      ? workflowProgressFraction * 100
      : typeof projectedProgressPercent === "number"
        ? projectedProgressPercent
        : 0,
  )));
  const tokenUsage = task?.tokenUsage ?? null;
  const primaryAction = projection?.primaryAction ?? null;
  const primaryActionLabel = (
    (primaryAction?.type === "continue" || primaryAction?.type === "auto_execute_range")
    && projection?.displayState === "needs_confirmation"
    && projection.latestTask?.checkpointType !== "replan_required"
  )
    ? "Confirmar y continuar"
    : primaryAction?.label;
  const runProjectedAction = (action: DirectorBookAutomationAction) => {
    const matchedAction = actions.find((item) => {
      if (item.label === action.label) {
        return true;
      }
      if (action.type === "continue") {
        return item.label.includes("Continuar");
      }
      if (action.type === "auto_execute_range") {
        return item.label.includes("Ejecución automática");
      }
      if (action.type === "confirm_candidate") {
        return item.label.includes("Orientación a nivel de libro");
      }
      if (action.type === "open_quality_repair") {
        return item.label.includes("Arreglo de calidad");
      }
      if (action.type === "open_chapter") {
        return item.label.includes("Ejecución del capítulo");
      }
      return false;
    });
    matchedAction?.onClick();
  };
  const handleProjectionAction = (action: DirectorBookAutomationAction) => {
    if (onProjectionAction) {
      onProjectionAction(action);
      return;
    }
    runProjectedAction(action);
  };
  const canShowRuntimePolicy = capabilities?.canAdjustRuntimePolicy !== false && Boolean(task?.id && runtimeSnapshot);
  const canShowManualImpact = capabilities?.canInspectManualEditImpact !== false && Boolean(task);
  const canShowRetryWithOverrideModel = capabilities?.canRetryWithOverrideModel === true;
  const canShowFollowUp = capabilities?.availableFollowUps !== false && Boolean(followUp);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="left-auto right-0 top-0 flex h-dvh max-h-dvh w-full max-w-[520px] translate-x-0 translate-y-0 flex-col gap-0 rounded-none border-y-0 border-r-0 border-l bg-background p-0 sm:max-w-[520px]">
        <DialogHeader className="border-b border-border/70 px-5 py-4">
          <DialogTitle>Detalles de ejecución</DialogTitle>
          <DialogDescription>
            Consulte los registros de avance de la IA, las acciones de procesamiento rápido y la información de solución de problemas de este libro.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5">
          {task || projection ? (
            <AICockpit
              projection={projection}
              mode="focusedNovel"
              fallbackSummary={dashboardView?.currentAction || displayState?.currentAction || task?.blockingReason || task?.currentItemLabel || "Actualmente no hay acciones push de IA para procesar."}
              fallbackStatusLabel={dashboardView?.statusLabel ?? (task ? formatTaskStatus(task) : "No encendido")}
              showDetailsAction={false}
              onAction={(_projection, action) => handleProjectionAction(action)}
            />
          ) : null}

          {resourceProposals.length > 0 ? (
            <section className="space-y-3 rounded-2xl border border-amber-300/60 bg-amber-50/40 p-4 dark:border-amber-700/50 dark:bg-amber-950/15">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="text-sm font-medium text-foreground">Los cambios de recursos esperan confirmación</div>
                  <div className="mt-1 text-xs leading-5 text-muted-foreground">
                    Estos juicios influirán en qué recursos clave se pueden utilizar en los capítulos siguientes.
                  </div>
                </div>
                <Badge variant="secondary">{resourceProposals.length} Banda</Badge>
              </div>
              <div className="space-y-2">
                {resourceProposals.slice(0, 4).map((proposal) => (
                  <ResourceProposalCard
                    key={proposal.id}
                    proposal={proposal}
                    onOpenSource={onOpenResourceProposalSource}
                    onConfirm={onConfirmResourceProposal}
                    onReject={onRejectResourceProposal}
                    confirmingProposalId={confirmingResourceProposalId}
                    rejectingProposalId={rejectingResourceProposalId}
                  />
                ))}
              </div>
              {resourceProposals.length > 4 ? (
                <div className="text-xs text-muted-foreground">
                  además {resourceProposals.length - 4} Los cambios de recursos pueden continuar en los capítulos correspondientes.
                </div>
              ) : null}
            </section>
          ) : null}

          {task ? (
            <>
              <section className="space-y-3 rounded-2xl border border-border/70 bg-muted/15 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="text-base font-semibold text-foreground">{task.title}</div>
                  <Badge variant={toTaskStatusVariant(task)}>{formatTaskStatus(task)}</Badge>
                  <Badge variant="outline">cronograma {progressPercent}%</Badge>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border bg-background/80 p-3">
                    <div className="text-xs text-muted-foreground">Etapa actual</div>
                    <div className="mt-1 text-sm font-medium text-foreground">{dashboardView?.stageLabel ?? displayState?.stageLabel ?? task.currentStage ?? "Sin datos"}</div>
                  </div>
                  <div className="rounded-xl border bg-background/80 p-3">
                    <div className="text-xs text-muted-foreground">Acción actual</div>
                    <div className="mt-1 text-sm font-medium text-foreground">{dashboardView?.currentAction ?? displayState?.currentAction ?? task.currentItemLabel ?? "Sin datos"}</div>
                  </div>
                  <div className="rounded-xl border bg-background/80 p-3">
                    <div className="text-xs text-muted-foreground">Último punto de control</div>
                    <div className="mt-1 text-sm font-medium text-foreground">{displayState?.checkpointLabel ?? formatCheckpoint(task.checkpointType, task.executionScopeLabel)}</div>
                  </div>
                  <div className="rounded-xl border bg-background/80 p-3">
                    <div className="text-xs text-muted-foreground">Latido reciente</div>
                    <div className="mt-1 text-sm font-medium text-foreground">{formatDate(task.heartbeatAt)}</div>
                  </div>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progressPercent}%` }} />
                </div>
                {task.checkpointSummary ? (
                  <div className="rounded-xl border bg-background/80 p-3 text-sm text-muted-foreground">
                    {task.checkpointSummary}
                  </div>
                ) : null}
                {task.lastError ? (
                  <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                    <div className="font-medium">Errores recientes</div>
                    <div className="mt-1">{task.lastError}</div>
                    {task.recoveryHint ? (
                      <div className="mt-2 text-xs text-destructive/80">Sugerencias de recuperación:{task.recoveryHint}</div>
                    ) : null}
                  </div>
                ) : null}
              </section>

              {canShowFollowUp && followUp ? (
                <section className="space-y-3 rounded-2xl border border-primary/20 bg-primary/5 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="text-sm font-medium text-foreground">Acciones que deben procesarse actualmente</div>
                    <Badge variant="outline">{followUp.reasonLabel}</Badge>
                    <Badge variant={followUp.priority === "P0" ? "destructive" : "secondary"}>
                      {formatFollowUpPriority(followUp.priority)}
                    </Badge>
                  </div>
                  <div className="text-sm leading-6 text-muted-foreground">{followUp.followUpSummary}</div>
                  {followUp.blockingReason ? (
                    <div className="text-sm text-muted-foreground">Motivo del bloqueo de la acción:{followUp.blockingReason}</div>
                  ) : null}
                  {followUp.currentModel ? (
                    <div className="text-sm text-muted-foreground">Modelo de tarea actual:{followUp.currentModel}</div>
                  ) : null}
                  {runtimeHardBlocked && runtimeBlockedReason ? (
                    <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                      {runtimeBlockedReason}
                    </div>
                  ) : null}
                  <div className="flex flex-wrap gap-2">
                    {followUp.availableActions.map((action) => (
                      <Button
                        key={action.code}
                        type="button"
                        size="sm"
                        variant={followUpActionVariant(action)}
                        onClick={() => onFollowUpAction?.(action)}
                        disabled={executingFollowUpAction || (runtimeHardBlocked && action.kind !== "navigation")}
                      >
                        {action.label}
                      </Button>
                    ))}
                  </div>
                </section>
              ) : null}

              {canShowRuntimePolicy && task ? (
                <section className="space-y-3">
                  <div className="text-sm font-medium text-foreground">Método de propulsión</div>
                  <TaskCenterRuntimePolicyCard taskId={task.id} snapshot={runtimeSnapshot} />
                </section>
              ) : null}

              {canShowManualImpact && task ? (
                <section className="space-y-3">
                  <div className="text-sm font-medium text-foreground">Riesgos e impacto de los cambios.</div>
                  <TaskCenterManualEditImpactCard task={task} />
                </section>
              ) : null}

              {canShowRetryWithOverrideModel && overrideModel && onOverrideModelChange ? (
                <section className="space-y-3 rounded-2xl border border-border/70 bg-muted/15 p-4">
                  <div className="text-sm font-medium text-foreground">Inténtalo de nuevo con otro modelo.</div>
                  <LLMSelector
                    value={overrideModel}
                    onChange={onOverrideModelChange}
                    compact
                    showParameters
                    showBadge={false}
                    showHelperText={false}
                  />
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      onClick={onRetryWithOverrideModel}
                      disabled={retryWithOverrideModelPending || !canRetryWithOverrideModel}
                    >
                      {retryWithOverrideModelPending ? "Intentando de nuevo…" : "Vuelve a intentarlo con el modelo seleccionado."}
                    </Button>
                    {onRetryWithTaskModel ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={onRetryWithTaskModel}
                        disabled={retryWithTaskModelPending}
                      >
                        {retryWithTaskModelPending ? "Intentando de nuevo…" : "Inténtalo de nuevo con el modelo original."}
                      </Button>
                    ) : null}
                  </div>
                </section>
              ) : null}

              <section className="space-y-3">
                <div className="text-sm font-medium text-foreground">Acción rápida</div>
                {actions.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {actions.map((action) => (
                      <Button
                        key={action.label}
                        type="button"
                        size="sm"
                        variant={action.variant ?? "default"}
                        disabled={action.disabled}
                        onClick={action.onClick}
                      >
                        {action.label}
                      </Button>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed px-4 py-5 text-sm text-muted-foreground">
                    Actualmente no hay acciones de acceso directo disponibles directamente.
                  </div>
                )}
              </section>

              <section className="space-y-3">
                <div className="text-sm font-medium text-foreground">Información del modelo</div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border bg-background/80 p-3">
                    <div className="text-xs text-muted-foreground">Modelo de vinculación de tareas</div>
                    <div className="mt-1 text-sm font-medium text-foreground">
                      {task.provider ?? "Sin datos"} / {task.model ?? "Sin datos"}
                    </div>
                  </div>
                  <div className="rounded-xl border bg-background/80 p-3">
                    <div className="text-xs text-muted-foreground">Modelo de interfaz actual</div>
                    <div className="mt-1 text-sm font-medium text-foreground">
                      {currentUiModel.provider} / {currentUiModel.model}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      Temperatura actual:{currentUiModel.temperature}
                    </div>
                  </div>
                </div>
              </section>

              <section className="space-y-3">
                <div className="text-sm font-medium text-foreground">Estadísticas de tokens</div>
                {tokenUsage ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl border bg-background/80 p-3">
                      <div className="text-xs text-muted-foreground">Número acumulado de llamadas</div>
                      <div className="mt-1 text-sm font-medium text-foreground">{formatTokenCount(tokenUsage.llmCallCount)}</div>
                    </div>
                    <div className="rounded-xl border bg-background/80 p-3">
                      <div className="text-xs text-muted-foreground">Total acumulado de tokens</div>
                      <div className="mt-1 text-sm font-medium text-foreground">{formatTokenCount(tokenUsage.totalTokens)}</div>
                    </div>
                    <div className="rounded-xl border bg-background/80 p-3">
                      <div className="text-xs text-muted-foreground">Introducir fichas</div>
                      <div className="mt-1 text-sm font-medium text-foreground">{formatTokenCount(tokenUsage.promptTokens)}</div>
                    </div>
                    <div className="rounded-xl border bg-background/80 p-3">
                      <div className="text-xs text-muted-foreground">Fichas de salida</div>
                      <div className="mt-1 text-sm font-medium text-foreground">{formatTokenCount(tokenUsage.completionTokens)}</div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        Registros recientes:{formatDate(tokenUsage.lastRecordedAt)}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed px-4 py-5 text-sm text-muted-foreground">
                    La tarea actual aún no ha acumulado el uso de tokens visualizables; Una vez que el modelo comience a volver a usarse, se actualizará automáticamente.
                  </div>
                )}
              </section>

              <section className="space-y-3">
                <div className="text-sm font-medium text-foreground">Estado del paso</div>
                <div className="space-y-2">
                  {(displayState?.steps ?? task.steps).map((step) => (
                    <div key={step.key} className="flex items-center justify-between rounded-xl border bg-background/80 px-3 py-2">
                      <div className="text-sm text-foreground">{step.label}</div>
                      <Badge variant="outline">{"isCurrent" in step
                        ? (step.status === "attention"
                          ? "\u9700\u5904\u7406"
                          : step.status === "running"
                            ? "\u8fdb\u884c\u4e2d"
                            : step.status === "completed"
                              ? "\u5df2\u5b8c\u6210"
                              : "\u5f85\u63a8\u8fdb")
                        : formatStepStatus(step.status)}</Badge>
                    </div>
                  ))}
                </div>
              </section>

              <section className="space-y-3">
                <div className="text-sm font-medium text-foreground">Historia de hitos</div>
                {milestones.length > 0 ? (
                  <div className="space-y-2">
                    {milestones
                      .slice()
                      .reverse()
                      .map((milestone) => (
                        <div key={`${milestone.checkpointType}:${milestone.createdAt}`} className="rounded-xl border bg-background/80 p-3">
                          <div className="font-medium text-foreground">{formatCheckpoint(milestone.checkpointType)}</div>
                          <div className="mt-1 text-sm text-muted-foreground">{milestone.summary}</div>
                          <div className="mt-2 text-xs text-muted-foreground">Tiempo de grabación:{formatDate(milestone.createdAt)}</div>
                        </div>
                      ))}
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed px-4 py-5 text-sm text-muted-foreground">
                    Actualmente no hay registros de hitos para mostrar.
                  </div>
                )}
              </section>
            </>
          ) : (
            <section className="rounded-2xl border border-dashed px-5 py-8 text-sm text-muted-foreground">
              Actualmente no hay tareas de director automáticas visibles para la novela. Puede continuar creando manualmente o ver otras tareas en el centro de tareas en segundo plano.
            </section>
          )}
        </div>

        <div className="space-y-2 border-t border-border/70 px-5 py-4">
          {primaryAction ? (
            <Button type="button" className="w-full" onClick={() => handleProjectionAction(primaryAction)}>
              {primaryActionLabel || "Continuar procesando"}
            </Button>
          ) : null}
          {task?.sourceRoute ? (
            <Button asChild type="button" variant="outline" className="w-full">
              <Link to={task.sourceRoute}>Página de código abierto</Link>
            </Button>
          ) : null}
          <Button type="button" variant={primaryAction ? "ghost" : "outline"} className="w-full" onClick={onOpenFullTaskCenter}>
            Abrir el centro de tareas en segundo plano
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
