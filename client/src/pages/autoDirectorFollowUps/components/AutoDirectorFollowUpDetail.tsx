import type {
  AutoDirectorAction,
  AutoDirectorFollowUpDetail,
  AutoDirectorFollowUpItem,
} from "@ai-novel/shared/types/autoDirectorFollowUp";
import { Button } from "@/components/ui/button";
import {
  TaskQueueActionRow,
  TaskQueueImpactNotice,
  TaskQueueSection,
  TaskQueueStatusBadge,
} from "@/components/taskQueue";
import { WorkspaceStateNotice } from "@/components/workspace";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { AUTO_DIRECTOR_MOBILE_CLASSES } from "@/mobile/autoDirector";
import {
  getFollowUpActionConsequence,
  getFollowUpActionRiskDescription,
  getFollowUpActionTone,
  getFollowUpLevelLabel,
  getFollowUpPriorityLabel,
  getFollowUpSeverity,
  getFollowUpTone,
} from "../followUpPresentation";

interface AutoDirectorFollowUpDetailPanelProps {
  detail: AutoDirectorFollowUpDetail | null;
  selectedItem: AutoDirectorFollowUpItem | null;
  loading: boolean;
  errorMessage?: string | null;
  actionLoading: boolean;
  onExecuteAction: (item: AutoDirectorFollowUpItem, action: AutoDirectorAction) => void | Promise<void>;
  onRefreshValidation: () => void | Promise<void>;
  onSafeFix: () => void | Promise<void>;
  onRetry: () => void | Promise<void>;
}

export function AutoDirectorFollowUpDetailPanel({
  detail,
  selectedItem,
  loading,
  errorMessage,
  actionLoading,
  onExecuteAction,
  onRefreshValidation,
  onSafeFix,
  onRetry,
}: AutoDirectorFollowUpDetailPanelProps) {
  const deliveryStatusLabels = {
    delivered: "Entregado",
    pending: "Entregando",
    failed: "Entrega fallida",
  } as const;
  const eventTypeLabels = {
    "auto_director.approval_required": "Requiere atención",
    "auto_director.auto_approved": "La IA ha pasado automáticamente",
    "auto_director.exception": "Excepción de tarea",
    "auto_director.recovered": "Restaurado",
    "auto_director.completed": "Completado",
    "auto_director.progress_changed": "Cambios de progreso",
  } as const;
  const tone = selectedItem ? getFollowUpTone(selectedItem) : "neutral";

  return (
    <TaskQueueSection
      title="Detalles de seguimiento"
      description="Cada acción tiene consecuencias; Los elementos de seguimiento mantienen su correspondiente identidad de tarea de director y no se mezclan con tareas manuales del espacio de trabajo."
      className="min-w-0 overflow-hidden"
    >
      <div className="space-y-4">
        {loading ? (
          <WorkspaceStateNotice loading title="Leer detalles de seguimiento" description="Sincronización de tareas del director, puntos de control y resultados de verificación recientes." />
        ) : null}

        {errorMessage ? (
          <WorkspaceStateNotice
            tone="danger"
            title="No se pudieron leer los detalles de seguimiento"
            description={errorMessage}
            action={<Button size="sm" variant="outline" onClick={() => void onRetry()}>Releer</Button>}
          />
        ) : null}

        {!loading && !errorMessage && (!detail || !selectedItem) ? (
          <WorkspaceStateNotice title="Por favor seleccione un elemento de seguimiento del director" description="Seleccione para ver el rango de bloqueo, los próximos pasos y las acciones de seguridad." />
        ) : null}

        {detail && selectedItem ? (
          <>
            <div className="space-y-1">
              <div className={`${AUTO_DIRECTOR_MOBILE_CLASSES.wrapText} font-medium`}>{selectedItem.novelTitle}</div>
              <div className={`${AUTO_DIRECTOR_MOBILE_CLASSES.wrapText} text-sm text-muted-foreground`}>{selectedItem.reasonLabel}</div>
              <div className="flex flex-wrap gap-2 pt-2">
                <TaskQueueStatusBadge label={getFollowUpLevelLabel(selectedItem)} tone={tone} />
                <TaskQueueStatusBadge label={getFollowUpPriorityLabel(selectedItem.priority, selectedItem.reason)} tone={tone} />
              </div>
            </div>

            <TaskQueueImpactNotice
              severity={getFollowUpSeverity(selectedItem)}
              title={getFollowUpLevelLabel(selectedItem)}
              description={detail.blockingReason ?? detail.followUpSummary}
            />

            {detail.riskNote ? (
              <WorkspaceStateNotice
                compact
                tone={tone === "danger" ? "danger" : tone === "warning" ? "warning" : "info"}
                title="Declaración de riesgo"
                description={detail.riskNote}
              />
            ) : null}

            <div className={`grid gap-2 text-sm text-muted-foreground ${AUTO_DIRECTOR_MOBILE_CLASSES.wrapText}`}>
              <div>Sugerencias para los próximos pasos:{detail.nextStepSuggestion ?? "Revise los detalles de la tarea antes de continuar."}</div>
              <div>Resumen del punto de control:{detail.checkpointSummary ?? "Sin datos"}</div>
              <div>Modelo actual:{detail.currentModel ?? "Sin datos"}</div>
            </div>

            {selectedItem.section === "needs_validation" ? (
              <div className={`space-y-3 rounded-md border border-warning/25 bg-warning/5 p-3 text-sm text-foreground ${AUTO_DIRECTOR_MOBILE_CLASSES.wrapText}`}>
                <div className="flex items-start gap-2">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  <div>
                    <div className="font-medium">Verifique primero el estado de la tarea y los activos</div>
                    <div className="mt-1 text-xs">
                      La solución de seguridad solo maneja la conciliación de estados y no borra texto, reescribe planes, confirma candidatos, cambia de modelos ni toma decisiones creativas por usted.
                    </div>
                  </div>
                </div>
                {(detail.validationSummary?.blockingReasons.length ?? 0) > 0 ? (
                  <div className="space-y-1 text-xs">
                    {detail.validationSummary?.blockingReasons.map((reason) => (
                      <div key={reason}>Bloquear:{reason}</div>
                    ))}
                  </div>
                ) : null}
                {(detail.validationSummary?.warnings.length ?? 0) > 0 ? (
                  <div className="space-y-1 text-xs">
                    {detail.validationSummary?.warnings.map((warning) => (
                      <div key={warning}>Pista:{warning}</div>
                    ))}
                  </div>
                ) : null}
                <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                  <Button
                    variant="outline"
                    size="sm"
                    className={AUTO_DIRECTOR_MOBILE_CLASSES.fullWidthAction}
                    disabled={actionLoading}
                    onClick={() => void onRefreshValidation()}
                  >
                    <RefreshCw className="h-4 w-4" aria-hidden="true" />
                    Reverificación con un clic
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={actionLoading}
                    className={`${AUTO_DIRECTOR_MOBILE_CLASSES.fullWidthAction} border-warning/40 bg-warning/10 text-warning hover:bg-warning/15 hover:text-warning`}
                    title="Solo corrige estados, puntos de control, progreso, objetivos de recuperación, conciliaciones de ejecución automatizada, motivos de sustitución, auditorías y registros de notificación que están marcados como de bajo riesgo; no borrará el cuerpo, reescribirá activos, replanificará, confirmará candidatos, cambiará de modelo ni generará contenido."
                    onClick={() => void onSafeFix()}
                  >
                    <AlertTriangle className="h-4 w-4" aria-hidden="true" />
                    Reparación de seguridad con un clic
                  </Button>
                </div>
              </div>
            ) : null}

            <div className="space-y-2">
              <div className="text-sm font-medium">Acciones ejecutables</div>
              {detail.availableActions.map((action) => (
                <TaskQueueActionRow
                  key={action.code}
                  title={action.label}
                  consequence={`${getFollowUpActionConsequence(action)} riesgo:${getFollowUpActionRiskDescription(action)}`}
                  tone={getFollowUpActionTone(action)}
                  action={(
                    <Button
                      variant={action.kind === "mutation" && action.riskLevel === "low" ? "default" : "outline"}
                      size="sm"
                      className={AUTO_DIRECTOR_MOBILE_CLASSES.fullWidthAction}
                      disabled={actionLoading}
                      onClick={() => void onExecuteAction(selectedItem, action)}
                    >
                      {action.label}
                    </Button>
                  )}
                />
              ))}
            </div>

            <div className="space-y-2">
              <div className="text-sm font-medium">Hitos recientes</div>
              <div className="space-y-2">
                {detail.milestones.length === 0 ? (
                  <div className="text-sm text-muted-foreground">Aún no hay hito</div>
                ) : detail.milestones.map((milestone) => (
                  <div key={`${milestone.at}:${milestone.label}`} className={`rounded-md border p-3 text-sm ${AUTO_DIRECTOR_MOBILE_CLASSES.wrapText}`}>
                    <div className="font-medium">{milestone.label}</div>
                    <div className="text-xs text-muted-foreground">{new Date(milestone.at).toLocaleString()}</div>
                    {milestone.summary ? (
                      <div className="mt-1 text-xs text-muted-foreground">{milestone.summary}</div>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-sm font-medium">Acceso al canal</div>
              <div className="space-y-2">
                {(detail.channelDeliveries?.length ?? 0) === 0 ? (
                  <div className="text-sm text-muted-foreground">Aún no hay registro de entrega del canal</div>
                ) : detail.channelDeliveries?.map((delivery) => (
                  <div key={`${delivery.channelType}:${delivery.eventType}`} className={`rounded-md border p-3 text-sm ${AUTO_DIRECTOR_MOBILE_CLASSES.wrapText}`}>
                    <div className="flex flex-wrap items-center gap-2">
                      <TaskQueueStatusBadge label={delivery.channelType === "dingtalk" ? "DingTalk" : delivery.channelType === "feishu" ? "Feishu" : "Qiwei"} tone="neutral" />
                      <TaskQueueStatusBadge
                        label={deliveryStatusLabels[delivery.status]}
                        tone={delivery.status === "delivered" ? "success" : delivery.status === "failed" ? "danger" : "info"}
                      />
                      <span className="text-xs text-muted-foreground">{eventTypeLabels[delivery.eventType]}</span>
                    </div>
                    <div className="mt-2 text-xs text-muted-foreground">
                      Objetivo:{delivery.target ?? "Sin registro"} | Código de respuesta:{delivery.responseStatus ?? "Sin registro"} | Tiempo:{delivery.deliveredAt ? new Date(delivery.deliveredAt).toLocaleString() : "No entregado"}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        ) : null}
      </div>
    </TaskQueueSection>
  );
}
