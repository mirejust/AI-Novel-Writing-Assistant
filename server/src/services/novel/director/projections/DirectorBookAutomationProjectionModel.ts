import type {
  DirectorBookAutomationAction,
  DirectorBookAutomationDisplayState,
  DirectorBookAutomationFocusNovel,
  DirectorBookAutomationProjection,
  DirectorBookAutomationStatus,
  DirectorRuntimeProjection,
  DirectorStepRun,
} from "@ai-novel/shared/types/directorRuntime";

export function parseJsonOrNull<T>(value: string | null | undefined): T | null {
  if (!value?.trim()) {
    return null;
  }
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

export function toIso(value: Date | string | null | undefined): string {
  if (!value) {
    return new Date(0).toISOString();
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date(0).toISOString() : parsed.toISOString();
}

export function timestampOf(value: string | null | undefined): number {
  if (!value) {
    return 0;
  }
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : 0;
}

export function commandLabel(commandType: string): string {
  const labels: Record<string, string> = {
    confirm_candidate: "Confirmar la dirección de apertura",
    continue: "Continuar dirigiendo automáticamente",
    resume_from_checkpoint: "Reanudar desde el punto de progreso",
    retry: "Reintentar director automático",
    takeover: "hacerse cargo de este libro",
    repair_chapter_titles: "Arreglar el título del capítulo",
    cancel: "Cancelar director automático",
  };
  return labels[commandType] ?? commandType;
}

export function commandStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    queued: "En cola",
    leased: "listo para ejecutar",
    running: "Ejecutando",
    succeeded: "Finalizar",
    failed: "Error",
    cancelled: "Cancelado",
    stale: "Necesidad de restaurar",
  };
  return labels[status] ?? status;
}

export function workflowStatusToBookStatus(status: string | null | undefined): DirectorBookAutomationStatus {
  if (status === "queued") {
    return "queued";
  }
  if (status === "running") {
    return "running";
  }
  if (status === "waiting_approval") {
    return "waiting_approval";
  }
  if (status === "failed") {
    return "failed";
  }
  if (status === "cancelled") {
    return "cancelled";
  }
  if (status === "succeeded") {
    return "completed";
  }
  return "idle";
}

export function extractRunMode(directorTaskData: Record<string, unknown> | null | undefined): string | null {
  if (!directorTaskData) return null;
  const direct = directorTaskData.runMode;
  if (typeof direct === "string") {
    return direct;
  }
  const directorInput = directorTaskData.directorInput;
  if (directorInput && typeof directorInput === "object") {
    const value = (directorInput as { runMode?: unknown }).runMode;
    if (typeof value === "string") {
      return value;
    }
  }
  const directorSession = directorTaskData.directorSession;
  if (directorSession && typeof directorSession === "object") {
    const value = (directorSession as { runMode?: unknown }).runMode;
    if (typeof value === "string") {
      return value;
    }
  }
  return null;
}

export function extractCircuitBreaker(
  directorTaskData: Record<string, unknown> | null | undefined,
): DirectorBookAutomationProjection["circuitBreaker"] {
  const autoExecution = directorTaskData?.autoExecution;
  if (!autoExecution || typeof autoExecution !== "object") {
    return null;
  }
  const circuitBreaker = (autoExecution as { circuitBreaker?: unknown }).circuitBreaker;
  if (!circuitBreaker || typeof circuitBreaker !== "object") {
    return null;
  }
  const status = (circuitBreaker as { status?: unknown }).status;
  if (status !== "open" && status !== "closed") {
    return null;
  }
  return circuitBreaker as DirectorBookAutomationProjection["circuitBreaker"];
}

export function buildWhereByNovelOrTask(novelId: string, taskIds: string[]) {
  const uniqueTaskIds = Array.from(new Set(taskIds.filter(Boolean)));
  if (uniqueTaskIds.length === 0) {
    return { novelId };
  }
  return {
    OR: [
      { novelId },
      { taskId: { in: uniqueTaskIds } },
    ],
  };
}

export function buildHeadline(input: {
  status: DirectorBookAutomationStatus;
  runtimeProjection: DirectorRuntimeProjection | null;
  task: {
    currentItemLabel?: string | null;
    checkpointSummary?: string | null;
    lastError?: string | null;
  } | null;
}): string {
  if (input.status === "waiting_recovery") {
    return "Esperando que se reanude el director automático";
  }
  if (input.status === "cancelled") {
    return "Director automático cancelado";
  }
  if (input.runtimeProjection?.headline?.trim()) {
    return input.runtimeProjection.headline.trim();
  }
  if (input.status === "queued") {
    return "El director automático de IA está en cola";
  }
  if (input.status === "running") {
    const label = input.task?.currentItemLabel?.trim();
    return label ? `La IA avanza:${label}` : "La IA está avanzando en el libro";
  }
  if (input.status === "waiting_approval") {
    return "esperando tu confirmación";
  }
  if (input.status === "blocked") {
    return "Director automático está en pausa";
  }
  if (input.status === "failed") {
    return "Auto Director encontró un problema";
  }
  if (input.status === "completed") {
    return "Director automático completa el último avance";
  }
  return "Aún no existe un registro automático de director para este libro.";
}

function getTaskFailureReason(task: {
  lastError?: string | null;
  checkpointSummary?: string | null;
} | null | undefined): string | null {
  return task?.lastError?.trim() || task?.checkpointSummary?.trim() || null;
}

export function buildDetail(input: {
  status: DirectorBookAutomationStatus;
  runtimeProjection: DirectorRuntimeProjection | null;
  task: {
    checkpointSummary?: string | null;
    lastError?: string | null;
    currentItemLabel?: string | null;
  } | null;
}): string | null {
  if (input.status === "waiting_recovery") {
    return input.task?.lastError?.trim() || "Los puntos de progreso se conservan después de que se interrumpe la ejecución en segundo plano y continuarán desde el último progreso después de la confirmación de la recuperación.";
  }
  if (input.status === "cancelled") {
    return "La tarea de director automático ha sido cancelada.";
  }
  if (input.status === "failed") {
    return getTaskFailureReason(input.task)
      || input.runtimeProjection?.blockedReason?.trim()
      || input.runtimeProjection?.detail?.trim()
      || "Después de ver los detalles de la ejecución, puede optar por reanudar o volver a intentarlo.";
  }
  if (input.runtimeProjection?.detail?.trim()) {
    return input.runtimeProjection.detail.trim();
  }
  if (input.task?.checkpointSummary?.trim()) {
    return input.task.checkpointSummary.trim();
  }
  if (input.status === "idle") {
    return "Puede comenzar con un director automático de IA y dejar que el sistema recomiende los siguientes pasos según los activos del libro.";
  }
  return input.task?.currentItemLabel?.trim() ?? null;
}

export function buildAutomationSummary(input: {
  activeCommandCount: number;
  pendingCommandCount: number;
  artifactSummary: DirectorBookAutomationProjection["artifactSummary"];
  autoApprovalRecordCount: number;
  usageSummary?: DirectorBookAutomationProjection["usageSummary"];
}): string {
  const parts: string[] = [];
  if (input.activeCommandCount > 0) {
    parts.push(`${input.activeCommandCount} acción en progreso`);
  }
  if (input.pendingCommandCount > 0) {
    parts.push(`${input.pendingCommandCount} acciones en cola`);
  }
  if (input.autoApprovalRecordCount > 0) {
    parts.push(`${input.autoApprovalRecordCount} Las confirmaciones son procesadas automáticamente por IA`);
  }
  if (input.artifactSummary.activeCount > 0) {
    parts.push(`${input.artifactSummary.activeCount} productos disponibles`);
  }
  if (input.artifactSummary.staleCount > 0) {
    parts.push(`${input.artifactSummary.staleCount} Es necesario revisar los productos.`);
  }
  if (input.artifactSummary.repairTicketCount > 0) {
    parts.push(`${input.artifactSummary.repairTicketCount} arreglos`);
  }
  if (input.artifactSummary.protectedUserContentCount > 0) {
    parts.push(`${input.artifactSummary.protectedUserContentCount} El contenido personal está protegido.`);
  }
  if (input.usageSummary && input.usageSummary.llmCallCount > 0) {
    parts.push(`${input.usageSummary.llmCallCount} llamadas de IA`);
  }
  if (input.usageSummary && input.usageSummary.totalTokens > 0) {
    parts.push(`${input.usageSummary.totalTokens} Tokens`);
  }
  if ((input.artifactSummary.dependencyCount ?? 0) > 0) {
    parts.push(`${input.artifactSummary.dependencyCount} dependencia del producto`);
  }
  return parts.length > 0 ? parts.join(",") : "Aún no hay acciones automatizadas";
}

function buildNovelHref(
  novelId: string,
  options?: {
    tab?: DirectorBookAutomationAction["target"]["tab"];
    taskPanel?: boolean;
  },
): string {
  const params = new URLSearchParams();
  if (options?.tab) {
    params.set("stage", options.tab);
  }
  if (options?.taskPanel) {
    params.set("taskPanel", "1");
  }
  const query = params.toString();
  return `/novels/${novelId}/edit${query ? `?${query}` : ""}`;
}

function buildCandidateSelectionHref(taskId: string): string {
  const params = new URLSearchParams();
  params.set("taskId", taskId);
  return `/novels/auto-director?${params.toString()}`;
}

export function buildFocusNovel(input: { id: string; title?: string | null }): DirectorBookAutomationFocusNovel {
  const title = input.title?.trim() || "Novela sin título";
  return {
    id: input.id,
    title,
    href: buildNovelHref(input.id),
  };
}

export function buildDisplayState(status: DirectorBookAutomationStatus): DirectorBookAutomationDisplayState {
  if (status === "queued" || status === "running") {
    return "processing";
  }
  if (status === "waiting_approval") {
    return "needs_confirmation";
  }
  if (status === "waiting_recovery" || status === "blocked" || status === "cancelled") {
    return "paused";
  }
  if (status === "failed") {
    return "needs_attention";
  }
  if (status === "completed") {
    return "completed";
  }
  return "idle";
}

export function buildUserHeadline(input: {
  status: DirectorBookAutomationStatus;
  task?: {
    currentItemLabel?: string | null;
    checkpointType?: string | null;
  } | null;
}): string {
  if (input.status === "queued") {
    return "A la IA se le ha encomendado la tarea de hacer avanzar este libro";
  }
  if (input.status === "running") {
    const label = input.task?.currentItemLabel?.trim();
    return label ? `La IA está procesando:${label}` : "La IA está avanzando en el libro";
  }
  if (input.status === "waiting_approval") {
    return "Espere su confirmación para continuar.";
  }
  if (input.status === "waiting_recovery" || input.status === "blocked") {
    return "La IA se ha detenido donde se puede procesar";
  }
  if (input.status === "failed") {
    return "El avance de la IA encuentra problemas";
  }
  if (input.status === "cancelled") {
    return "El avance automático se ha detenido esta vez.";
  }
  if (input.status === "completed") {
    return "La IA completó su último impulso";
  }
  return "Este libro no ha activado el avance automático de la IA.";
}

export function buildUserReason(input: {
  status: DirectorBookAutomationStatus;
  runtimeProjection: DirectorRuntimeProjection | null;
  task: {
    checkpointType?: string | null;
    checkpointSummary?: string | null;
    lastError?: string | null;
    currentItemLabel?: string | null;
  } | null;
  blockedReason?: string | null;
  detail?: string | null;
}): string | null {
  const directReason = input.status === "failed"
    ? (
      getTaskFailureReason(input.task)
      || input.blockedReason?.trim()
      || input.detail?.trim()
      || input.runtimeProjection?.blockedReason?.trim()
      || input.runtimeProjection?.detail?.trim()
    )
    : (
      input.blockedReason?.trim()
      || input.detail?.trim()
      || input.runtimeProjection?.blockedReason?.trim()
      || input.runtimeProjection?.detail?.trim()
      || input.task?.checkpointSummary?.trim()
      || input.task?.lastError?.trim()
    );
  if (directReason) {
    return directReason;
  }
  if (input.status === "queued") {
    return "La tarea se ha ingresado en la cola de fondo y puede salir de la página actual.";
  }
  if (input.status === "running") {
    return input.task?.currentItemLabel?.trim() || "La IA está avanzando en la novela según lo previsto actualmente.";
  }
  if (input.status === "waiting_approval") {
    return "Debe confirmar los resultados o el alcance del impacto de la fase actual antes de continuar.";
  }
  if (input.status === "waiting_recovery") {
    return "El sistema conserva el progreso más reciente y puede continuar desde la ubicación actual después de la confirmación.";
  }
  if (input.status === "blocked") {
    return "Es necesario abordar la causa actual del bloqueo antes de continuar.";
  }
  if (input.status === "failed") {
    return "Después de verificar el motivo, puede intentarlo nuevamente o regresar a la página de la novela para procesar.";
  }
  if (input.status === "completed") {
    return "Puedes ingresar a la página de la novela para ver los resultados o continuar escribiendo el siguiente párrafo.";
  }
  return "Puedes continuar creando manualmente o dejar que la IA se haga cargo del avance posterior.";
}

function action(input: DirectorBookAutomationAction): DirectorBookAutomationAction {
  return input;
}

export function buildPrimaryAction(input: {
  novelId: string;
  status: DirectorBookAutomationStatus;
  task: {
    id: string;
    checkpointType?: string | null;
  } | null;
}): DirectorBookAutomationAction | null {
  const taskId = input.task?.id ?? null;
  if (!taskId) {
    return action({
      type: "open_novel",
      label: "novela abierta",
      target: { novelId: input.novelId, href: buildNovelHref(input.novelId) },
      emphasis: "primary",
    });
  }

  if (
    input.task?.checkpointType === "replan_required"
    && ["waiting_approval", "waiting_recovery", "failed", "blocked", "cancelled"].includes(input.status)
  ) {
    return action({
      type: "auto_execute_range",
      label: "Continuar después de volver a planificar",
      target: {
        novelId: input.novelId,
        taskId,
        tab: "pipeline",
        href: buildNovelHref(input.novelId, { tab: "pipeline" }),
      },
      commandPayload: { taskId, continuationMode: "auto_execute_range" },
      emphasis: "primary",
    });
  }

  if (input.status === "waiting_approval") {
    if (input.task?.checkpointType === "candidate_selection_required") {
      return action({
        type: "confirm_candidate",
        label: "Confirmar dirección a nivel de libro",
        target: { novelId: input.novelId, taskId, href: buildCandidateSelectionHref(taskId) },
        emphasis: "primary",
      });
    }
    if (input.task?.checkpointType === "production_experience_required") {
      return action({
        type: "open_novel",
        label: "Seleccionar método de producción de texto",
        target: {
          novelId: input.novelId,
          taskId,
          href: buildNovelHref(input.novelId),
        },
        emphasis: "primary",
      });
    }
    if (input.task?.checkpointType === "chapter_batch_ready") {
      return action({
        type: "auto_execute_range",
        label: "Continuar con los capítulos de ejecución automática",
        target: {
          novelId: input.novelId,
          taskId,
          tab: "chapter",
          href: buildNovelHref(input.novelId, { tab: "chapter" }),
        },
        commandPayload: { taskId, continuationMode: "auto_execute_range" },
        emphasis: "primary",
      });
    }
    return action({
      type: "continue",
      label: "Confirmar y continuar",
      target: { novelId: input.novelId, taskId, href: buildNovelHref(input.novelId) },
      commandPayload: { taskId, continuationMode: "resume" },
      emphasis: "primary",
    });
  }

  if (input.status === "waiting_recovery") {
    return action({
      type: "continue",
      label: "Continuar desde el punto de progreso",
      target: { novelId: input.novelId, taskId, href: buildNovelHref(input.novelId) },
      commandPayload: { taskId, continuationMode: "resume" },
      emphasis: "primary",
    });
  }

  if (input.status === "failed" || input.status === "blocked") {
    return action({
      type: "open_details",
      label: input.status === "failed" ? "Verifique el motivo del fallo" : "Consulta el motivo de la suspensión.",
      target: { novelId: input.novelId, taskId, href: buildNovelHref(input.novelId, { taskPanel: true }) },
      emphasis: "primary",
    });
  }

  if (input.status === "queued" || input.status === "running") {
    return action({
      type: "open_novel",
      label: "Ver estado de avance",
      target: { novelId: input.novelId, taskId, href: buildNovelHref(input.novelId) },
      emphasis: "primary",
    });
  }

  if (input.status === "completed") {
    return action({
      type: "open_chapter",
      label: "Ir a la ejecución del capítulo",
      target: {
        novelId: input.novelId,
        taskId,
        tab: "chapter",
        href: buildNovelHref(input.novelId, { tab: "chapter" }),
      },
      emphasis: "primary",
    });
  }

  return action({
    type: "open_novel",
    label: "novela abierta",
    target: { novelId: input.novelId, taskId, href: buildNovelHref(input.novelId) },
    emphasis: "primary",
  });
}

export function buildSecondaryActions(input: {
  novelId: string;
  status: DirectorBookAutomationStatus;
  taskId?: string | null;
}): DirectorBookAutomationAction[] {
  if (!input.taskId) {
    return [];
  }
  const actions: DirectorBookAutomationAction[] = [
    action({
      type: "open_details",
      label: "Detalles de ejecución",
      target: {
        novelId: input.novelId,
        taskId: input.taskId,
        href: buildNovelHref(input.novelId, { taskPanel: true }),
      },
      emphasis: "secondary",
    }),
  ];
  if (input.status === "queued" || input.status === "running" || input.status === "waiting_approval") {
    actions.push(action({
      type: "cancel",
      label: "Pausar avance",
      target: { novelId: input.novelId, taskId: input.taskId },
      emphasis: "secondary",
    }));
  }
  if (input.status === "failed" || input.status === "cancelled") {
    actions.push(action({
      type: "retry",
      label: "Reintentar",
      target: { novelId: input.novelId, taskId: input.taskId },
      emphasis: "secondary",
    }));
  }
  return actions;
}

export function mapStepForUsage(step: {
  idempotencyKey: string;
  nodeKey: string;
  label: string;
  status: string;
  targetType?: string | null;
  targetId?: string | null;
  startedAt: Date;
  finishedAt: Date | null;
  error: string | null;
}): DirectorStepRun {
  return {
    idempotencyKey: step.idempotencyKey,
    nodeKey: step.nodeKey,
    label: step.label,
    status: step.status as DirectorStepRun["status"],
    targetType: step.targetType as DirectorStepRun["targetType"],
    targetId: step.targetId,
    startedAt: step.startedAt.toISOString(),
    finishedAt: step.finishedAt?.toISOString() ?? null,
    error: step.error,
  };
}
