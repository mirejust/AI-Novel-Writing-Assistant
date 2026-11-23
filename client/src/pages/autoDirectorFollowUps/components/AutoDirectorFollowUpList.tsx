import type {
  AutoDirectorFollowUpAvailableFilters,
  AutoDirectorFollowUpItem,
  AutoDirectorFollowUpPagination,
} from "@ai-novel/shared/types/autoDirectorFollowUp";
import type { AutoDirectorFollowUpSection } from "@ai-novel/shared/types/autoDirectorValidation";
import type { TaskStatus } from "@ai-novel/shared/types/task";
import { Button } from "@/components/ui/button";
import { TaskRecordActions } from "@/components/taskQueue/TaskRecordActions";
import {
  TaskQueueEmptyState,
  TaskQueueItem,
  TaskQueueSection,
  TaskQueueSeverityBadge,
  TaskQueueStatusBadge,
} from "@/components/taskQueue";
import { WorkspaceStateNotice } from "@/components/workspace";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AUTO_DIRECTOR_MOBILE_CLASSES } from "@/mobile/autoDirector";
import {
  getFollowUpLevelLabel,
  getFollowUpPriorityLabel,
  getFollowUpSeverity,
  getFollowUpTone,
} from "../followUpPresentation";

interface AutoDirectorFollowUpListPanelProps {
  items: AutoDirectorFollowUpItem[];
  pagination: AutoDirectorFollowUpPagination | null;
  filters: AutoDirectorFollowUpAvailableFilters | null;
  activeReason: string;
  activeSection: AutoDirectorFollowUpSection | "";
  activeStatus: string;
  activeSupportsBatch: string;
  selectedTaskId: string;
  selectedTaskIds: string[];
  loading: boolean;
  errorMessage?: string | null;
  actionLoading: boolean;
  onSelectTask: (taskId: string) => void;
  onFilterChange: (key: "reason" | "status" | "supportsBatch" | "channelType", value: string) => void;
  onToggleSelected: (taskId: string, checked: boolean) => void;
  onPageChange: (page: number) => void;
  onRetry: () => void;
}

function formatStatus(status: TaskStatus): string {
  if (status === "waiting_approval") return "Esperando aprobación";
  if (status === "failed") return "Error";
  if (status === "cancelled") return "Cancelado";
  if (status === "running") return "En ejecución";
  if (status === "queued") return "En cola";
  return "Completado";
}

function formatReason(reason: AutoDirectorFollowUpItem["reason"]): string {
  const labels: Record<AutoDirectorFollowUpItem["reason"], string> = {
    manual_recovery_required: "Recuperación manual pendiente",
    runtime_failed: "No se pudo volver a intentar",
    candidate_selection_required: "Dirección del nivel del libro por confirmar.",
    replan_required: "Pendiente de replanificación",
    runtime_cancelled: "Cancelado pendiente de restauración",
    chapter_batch_execution_pending: "La ejecución automática continuará",
    quality_repair_pending: "Las correcciones de calidad continuarán",
    auto_progress_running: "Avanzando automáticamente",
    auto_approval_completed: "Aprobado recientemente automáticamente",
    runtime_replaced: "La tarea ha sido reemplazada",
    validation_required: "Necesito volver a comprobar",
  };
  return labels[reason];
}

function formatSection(section: AutoDirectorFollowUpSection): string {
  if (section === "needs_validation") return "Necesito verificar";
  if (section === "exception") return "Incidencia";
  if (section === "pending") return "Pendiente";
  if (section === "auto_progress") return "Avance automático";
  return "Reemplazado";
}

function formatActiveSection(section: AutoDirectorFollowUpSection | ""): string {
  return section ? formatSection(section) : "Todas las particiones";
}

function buildChannelBadges(item: AutoDirectorFollowUpItem): string[] {
  const labels: string[] = [];
  if (item.channelCapabilities.dingtalk) {
    labels.push("Acceso directo a DingTalk");
  }
  if (item.channelCapabilities.wecom) {
    labels.push("Acceso directo a Qiwei");
  }
  if (item.channelCapabilities.feishu) {
    labels.push("Acceso directo a través de Feishu");
  }
  return labels;
}

function formatItemType(item: AutoDirectorFollowUpItem): string {
  return item.itemType === "auto_approval_record" ? "Aprobado recientemente automáticamente" : "Avanzando";
}

export function AutoDirectorFollowUpListPanel(props: AutoDirectorFollowUpListPanelProps) {
  const totalPages = props.pagination ? Math.max(1, Math.ceil(props.pagination.total / props.pagination.pageSize)) : 1;

  return (
    <TaskQueueSection
      title={formatActiveSection(props.activeSection)}
      description="Filtrar por motivo estructurado y estado; Utilice diferentes niveles para recordatorios de calidad y tareas de bloqueo."
      className="min-w-0 overflow-hidden"
    >
      <div className="space-y-4">
        <div className={AUTO_DIRECTOR_MOBILE_CLASSES.followUpFilterGrid}>
          <Select value={props.activeReason || "__all__"} onValueChange={(value) => props.onFilterChange("reason", value === "__all__" ? "" : value)}>
            <SelectTrigger aria-label="Filtrar por motivo de seguimiento" className={AUTO_DIRECTOR_MOBILE_CLASSES.followUpFilterTrigger}>
              <SelectValue placeholder="Todas las razones" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todas las razones</SelectItem>
              {(props.filters?.reasons ?? []).map((reason) => (
                <SelectItem key={reason} value={reason}>{formatReason(reason)}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={props.activeStatus || "__all__"} onValueChange={(value) => props.onFilterChange("status", value === "__all__" ? "" : value)}>
            <SelectTrigger aria-label="Filtrar por estado de tarea" className={AUTO_DIRECTOR_MOBILE_CLASSES.followUpFilterTrigger}>
              <SelectValue placeholder="Todo el estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todo el estado</SelectItem>
              {(props.filters?.statuses ?? []).map((status) => (
                <SelectItem key={status} value={status}>{formatStatus(status)}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={props.activeSupportsBatch || "__all__"} onValueChange={(value) => props.onFilterChange("supportsBatch", value === "__all__" ? "" : value)}>
            <SelectTrigger aria-label="Filtrar por capacidad de operación por lotes" className={AUTO_DIRECTOR_MOBILE_CLASSES.followUpFilterTrigger}>
              <SelectValue placeholder="Capacidad de lote" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todo</SelectItem>
              <SelectItem value="true">Sólo disponible al por mayor</SelectItem>
              <SelectItem value="false">No disponible solo en lotes</SelectItem>
            </SelectContent>
          </Select>

        </div>

        <div className="space-y-3">
          {props.loading ? (
            <WorkspaceStateNotice compact loading title="Leer artículos de seguimiento" description="Sincronización de tareas del director y grabaciones recientes de pases automáticos." />
          ) : null}

          {props.errorMessage ? (
            <WorkspaceStateNotice
              compact
              tone="danger"
              title="No se pudo leer la lista de seguimiento"
              description={props.errorMessage}
              action={<Button size="sm" variant="outline" onClick={props.onRetry}>Releer</Button>}
            />
          ) : null}

          {!props.loading && !props.errorMessage && props.items.length === 0 ? (
            <TaskQueueEmptyState
              title="Actualmente no hay artículos de seguimiento elegibles"
              description={props.activeSection === "auto_progress"
                ? "Actualmente no hay tareas en progreso ni pases automáticos recientes registrados."
                : props.activeSection === "replaced"
                  ? "Hay tareas antiguas que actualmente no son reemplazadas por tareas nuevas."
                  : "Puede cambiar de sección o borrar filtros para ver otras tareas del director."}
            />
          ) : null}

          {props.items.map((item) => {
            const itemKey = item.autoApprovalRecordId ?? item.directorTaskId;
            const checked = props.selectedTaskIds.includes(item.directorTaskId);
            const selected = props.selectedTaskId === item.directorTaskId;
            const tone = getFollowUpTone(item);
            return (
              <div key={itemKey} className="relative">
                <TaskQueueItem
                  selected={selected}
                  tone={tone}
                  className={item.supportsBatch ? "p-4 pr-12" : "p-4"}
                  onClick={() => props.onSelectTask(item.directorTaskId)}
                >
                <div className={AUTO_DIRECTOR_MOBILE_CLASSES.followUpListHeader}>
                  <div className="min-w-0 space-y-1">
                    <div className={`${AUTO_DIRECTOR_MOBILE_CLASSES.wrapText} font-medium`}>{item.novelTitle}</div>
                    <div className={`${AUTO_DIRECTOR_MOBILE_CLASSES.wrapText} text-sm text-muted-foreground`}>{item.followUpSummary}</div>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    <TaskQueueSeverityBadge severity={getFollowUpSeverity(item)} label={getFollowUpLevelLabel(item)} />
                  </div>
                </div>

                <div className="mt-3 flex min-w-0 flex-wrap gap-2 text-xs text-muted-foreground">
                  {item.section === "auto_progress" ? <TaskQueueStatusBadge label={formatItemType(item)} tone={tone} /> : null}
                  <TaskQueueStatusBadge label={formatStatus(item.status)} tone="neutral" />
                  <TaskQueueStatusBadge label={item.reasonLabel} tone="neutral" />
                  <TaskQueueStatusBadge label={getFollowUpPriorityLabel(item.priority, item.reason)} tone={tone} />
                  {item.executionScope ? <TaskQueueStatusBadge label={item.executionScope} tone="neutral" className={`max-w-full whitespace-normal text-left ${AUTO_DIRECTOR_MOBILE_CLASSES.wrapText}`} /> : null}
                  {item.supportsBatch ? <TaskQueueStatusBadge label="Disponible en lotes" tone="info" /> : null}
                  {buildChannelBadges(item).map((label) => (
                    <TaskQueueStatusBadge key={`${item.directorTaskId}:${label}`} label={label} tone="info" />
                  ))}
                </div>

                <div className={`mt-2 text-xs text-muted-foreground ${AUTO_DIRECTOR_MOBILE_CLASSES.wrapText}`}>
                  Etapa actual:{item.currentStage ?? "Sin datos"} · Modelo actual:{item.currentModel ?? "Sin datos"} · Hora de actualización:{new Date(item.updatedAt).toLocaleString()}
                </div>
                </TaskQueueItem>
                <TaskRecordActions kind="novel_workflow" id={item.directorTaskId} status={item.status} title={item.novelTitle} allowStop />
                {item.supportsBatch ? (
                  <label className="absolute right-4 top-4 flex h-6 w-6 items-center justify-center">
                    <span className="sr-only">Seleccionar {item.novelTitle} Realizar operaciones por lotes</span>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(event) => props.onToggleSelected(item.directorTaskId, event.target.checked)}
                      disabled={props.actionLoading}
                    />
                  </label>
                ) : null}
              </div>
            );
          })}
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-xs text-muted-foreground">
            Cap. {props.pagination?.page ?? 1} / {totalPages} Páginas, total {props.pagination?.total ?? 0} banda
          </div>
          <div className="grid grid-cols-2 gap-2 sm:flex">
            <Button
              variant="outline"
              size="sm"
              className={AUTO_DIRECTOR_MOBILE_CLASSES.fullWidthAction}
              disabled={(props.pagination?.page ?? 1) <= 1}
              onClick={() => props.onPageChange((props.pagination?.page ?? 1) - 1)}
            >
              Pagina anterior
            </Button>
            <Button
              variant="outline"
              size="sm"
              className={AUTO_DIRECTOR_MOBILE_CLASSES.fullWidthAction}
              disabled={(props.pagination?.page ?? 1) >= totalPages}
              onClick={() => props.onPageChange((props.pagination?.page ?? 1) + 1)}
            >
              Página siguiente
            </Button>
          </div>
        </div>
      </div>
    </TaskQueueSection>
  );
}
