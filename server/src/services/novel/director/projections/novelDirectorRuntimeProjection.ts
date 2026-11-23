import type {
  DirectorRunCommandStatus,
  DirectorRunCommandType,
  DirectorRuntimePolicySnapshot,
  DirectorRuntimeProjectionEvent,
  DirectorRuntimeProjection,
  DirectorRuntimeSnapshot,
} from "@ai-novel/shared/types/directorRuntime";
import { prisma } from "../../../../db/prisma";
import { readLegacyDirectorRuntime } from "../infrastructure/legacyRuntime";
import { buildDefaultDirectorPolicy } from "../runtime/directorRuntimeDefaults";
import { DirectorEventProjectionService, parseDirectorIssueEventMetadata } from "../runtime/DirectorEventProjectionService";
import { directorUsageTelemetryQueryService } from "../runtime/DirectorUsageTelemetryQueryService";
import { ChapterExecutionProgressInspector } from "../runtime/ChapterExecutionProgressInspector";
import type { DirectorWorkflowSeedPayload } from "../runtime/novelDirectorHelpers";
import { DirectorStateReader } from "../state/DirectorStateReader";
import {
  parsePersistedDirectorRiskAssessment,
  type DirectorRiskHistoryItem,
} from "@ai-novel/shared/types/directorRisk";

function parseJsonOrNull<T>(value: string | null | undefined): T | null {
  if (!value?.trim()) {
    return null;
  }
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function parseRiskHistory(rows: Array<{
  id: string;
  metadataJson: string | null;
}>): DirectorRiskHistoryItem[] {
  return rows.flatMap((row) => {
    const metadata = parseJsonOrNull<Record<string, unknown>>(row.metadataJson);
    const parsed = parsePersistedDirectorRiskAssessment(metadata?.riskAssessment);
    return parsed ? [{ ...parsed, eventId: row.id }] : [];
  });
}

type ActiveRuntimeCommand = {
  id: string;
  commandType: DirectorRunCommandType;
  status: DirectorRunCommandStatus;
  updatedAt: Date;
};

type RuntimeInstanceProjectionRow = {
  id: string;
  novelId: string | null;
  runId: string | null;
  status: string;
  currentStep: string | null;
  checkpointVersion: number;
  workerMessage: string | null;
  lastErrorMessage: string | null;
  lastHeartbeatAt: Date | null;
  updatedAt: Date;
  executions: Array<{
    id: string;
    stepType: string;
    resourceClass: string | null;
    workerId: string | null;
    slotId: string | null;
    status: string;
    startedAt: Date | null;
    leaseExpiresAt: Date | null;
    errorMessage?: string | null;
  }>;
  checkpoints: Array<{
    summary: string | null;
    createdAt: Date;
  }>;
  commands: Array<{
    id: string;
    commandType: string;
    status: string;
    leaseOwner: string | null;
    leaseExpiresAt: Date | null;
    errorMessage?: string | null;
    runAfter?: Date | null;
    startedAt?: Date | null;
    finishedAt?: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }>;
};

function runtimeStatusToProjectionStatus(status: string): DirectorRuntimeProjection["status"] {
  if (status === "waiting_gate") {
    return "waiting_approval";
  }
  if (status === "failed_recoverable" || status === "failed_hard" || status === "cancelled") {
    return "failed";
  }
  if (status === "completed") {
    return "completed";
  }
  return "running";
}

function runtimeWaitingReason(status: string): string | null {
  if (status === "waiting_worker") {
    return "Esperando recursos de ejecución en segundo plano";
  }
  if (status === "waiting_llm_resource") {
    return "Esperando recursos modelo";
  }
  if (status === "waiting_retry") {
    return "Espere el reintento automático";
  }
  if (status === "waiting_gate") {
    return "Esperando confirmación";
  }
  return null;
}

function splitLeaseOwner(value: string | null | undefined): {
  workerId: string | null;
  slotId: string | null;
} {
  if (!value?.trim()) {
    return { workerId: null, slotId: null };
  }
  const [workerId, ...slotParts] = value.split(":");
  return {
    workerId: workerId || value,
    slotId: slotParts.length > 0 ? slotParts.join(":") : null,
  };
}

function runtimeHeadline(runtime: RuntimeInstanceProjectionRow): {
  headline: string;
  currentLabel: string;
  detail: string;
} {
  const activeExecution = runtime.executions[0] ?? null;
  if (activeExecution) {
    return {
      headline: "Autodirector está trabajando en el libro.",
      currentLabel: runtime.workerMessage || "La IA está avanzando en la tarea actual de dirección autónoma.",
      detail: activeExecution.resourceClass
        ? `Recursos de ejecución actuales:${activeExecution.resourceClass}`
        : "El ejecutor en segundo plano está procesando la tarea actual.",
    };
  }
  const waitingReason = runtimeWaitingReason(runtime.status);
  if (waitingReason) {
    return {
      headline: "El director automático espera recursos de ejecución.",
      currentLabel: runtime.workerMessage || waitingReason,
      detail: "El sistema continuará automáticamente con el libro cuando haya recursos de fondo disponibles.",
    };
  }
  if (runtime.status === "completed") {
    return {
      headline: "Auto Director ha guardado el progreso",
      currentLabel: runtime.workerMessage || runtime.checkpoints[0]?.summary || "Se ha guardado el progreso actual del director automático.",
      detail: "Puedes seguir viendo o iniciar el siguiente avance automático.",
    };
  }
  if (runtime.status === "cancelled") {
    return {
      headline: "Auto Director se ha detenido",
      currentLabel: runtime.workerMessage || "La tarea actual del director automático se ha detenido.",
      detail: "La dirección automática se puede reanudar si es necesario.",
    };
  }
  return {
    headline: "El autodirector se está ejecutando",
    currentLabel: runtime.workerMessage || "La IA está avanzando en la tarea actual de dirección autónoma.",
    detail: "El sistema seguirá guardando el progreso y continuará automáticamente.",
  };
}

function buildWorkerHealth(runtime: RuntimeInstanceProjectionRow): DirectorRuntimeProjection["workerHealth"] {
  const now = new Date();
  const queued = runtime.commands.filter((command) => command.status === "queued");
  const leased = runtime.commands.filter((command) => command.status === "leased");
  const running = runtime.commands.filter((command) => command.status === "running");
  const staleCommands = runtime.commands.filter((command) => {
    if (command.status === "stale") {
      return true;
    }
    if ((command.status === "leased" || command.status === "running") && command.leaseExpiresAt) {
      return command.leaseExpiresAt.getTime() < now.getTime();
    }
    return false;
  });
  const activeExecution = runtime.executions[0] ?? null;
  const activeExecutionStale = Boolean(
    activeExecution?.leaseExpiresAt
      && activeExecution.leaseExpiresAt.getTime() < now.getTime(),
  );
  const current = running[0] ?? leased[0] ?? queued[0] ?? runtime.commands[0] ?? null;
  const owner = splitLeaseOwner(current?.leaseOwner);
  const oldestQueued = queued
    .slice()
    .sort((left, right) => (left.runAfter ?? left.createdAt).getTime() - (right.runAfter ?? right.createdAt).getTime())[0] ?? null;
  const blockedReason = runtime.lastErrorMessage ?? current?.errorMessage ?? activeExecution?.errorMessage ?? null;
  const derivedState = (() => {
    if (activeExecution?.status === "running") {
      return "running_step" as const;
    }
    if (runtime.status === "waiting_gate") {
      return "waiting_gate" as const;
    }
    if (activeExecutionStale || staleCommands.length > 0) {
      return "auto_recovering" as const;
    }
    if (activeExecution?.status === "leased" || leased.length > 0) {
      return "leased_starting" as const;
    }
    if (queued.length > 0) {
      return "queued_waiting_worker" as const;
    }
    if (runtime.status === "failed_recoverable") {
      return "failed_recoverable" as const;
    }
    if (runtime.status === "failed_hard") {
      return "failed_hard" as const;
    }
    if (runtime.status === "cancelled") {
      return "cancelled" as const;
    }
    if (runtime.status === "completed") {
      return "succeeded" as const;
    }
    return "idle" as const;
  })();
  const nextAction = (() => {
    if (derivedState === "auto_recovering") return "recover_stale_command" as const;
    if (derivedState === "running_step") return "continue_running" as const;
    if (derivedState === "leased_starting") return "wait_for_lease_start" as const;
    if (derivedState === "queued_waiting_worker") return "wait_for_worker" as const;
    if (derivedState === "waiting_gate" || derivedState === "failed_recoverable" || derivedState === "failed_hard") {
      return "requires_user_action" as const;
    }
    return "none" as const;
  })();
  return {
    derivedState,
    message: runtime.workerMessage ?? runtimeWaitingReason(runtime.status),
    queuedCommandCount: queued.length,
    leasedCommandCount: leased.length,
    runningCommandCount: running.length,
    staleCommandCount: staleCommands.length + (activeExecutionStale ? 1 : 0),
    oldestQueuedAt: oldestQueued ? (oldestQueued.runAfter ?? oldestQueued.createdAt).toISOString() : null,
    oldestQueuedWaitMs: oldestQueued ? Math.max(0, now.getTime() - (oldestQueued.runAfter ?? oldestQueued.createdAt).getTime()) : null,
    currentCommandId: current?.id ?? null,
    currentCommandType: current?.commandType ?? null,
    currentWorkerId: activeExecution?.workerId ?? owner.workerId,
    currentSlotId: activeExecution?.slotId ?? owner.slotId,
    currentExecutionId: activeExecution?.id ?? null,
    currentExecutionStatus: activeExecution?.status ?? null,
    currentLeaseExpiresAt: activeExecution?.leaseExpiresAt?.toISOString() ?? current?.leaseExpiresAt?.toISOString() ?? null,
    blockedReason,
    lastErrorMessage: blockedReason,
    nextAction,
    lastCommandAt: current?.updatedAt.toISOString() ?? null,
  };
}

function overlayRuntimeInstance(
  projection: DirectorRuntimeProjection,
  runtime: RuntimeInstanceProjectionRow | null,
): DirectorRuntimeProjection {
  if (!runtime) {
    return projection;
  }
  const activeExecution = runtime.executions[0] ?? null;
  const copy = runtimeHeadline(runtime);
  return {
    ...projection,
    runtimeId: runtime.id,
    runtimeStatus: runtime.status,
    status: runtimeStatusToProjectionStatus(runtime.status),
    currentAction: runtime.currentStep,
    waitingReason: runtimeWaitingReason(runtime.status),
    activeExecution: activeExecution
      ? {
        executionId: activeExecution.id,
        stepType: activeExecution.stepType,
        resourceClass: activeExecution.resourceClass,
        workerId: activeExecution.workerId,
        slotId: activeExecution.slotId,
        status: activeExecution.status,
        startedAt: activeExecution.startedAt?.toISOString() ?? null,
        leaseExpiresAt: activeExecution.leaseExpiresAt?.toISOString() ?? null,
      }
      : null,
    resourceClass: activeExecution?.resourceClass ?? null,
    checkpointSummary: runtime.checkpoints[0]?.summary ?? null,
    nextAutomaticAction: runtime.status === "completed" ? null : "El sistema continuará automáticamente con la tarea actual del director automático.",
    workerHealth: buildWorkerHealth(runtime),
    headline: copy.headline,
    currentLabel: copy.currentLabel,
    detail: copy.detail,
    requiresUserAction: runtime.status === "waiting_gate" || runtime.status === "failed_hard",
    updatedAt: runtime.updatedAt.getTime() > Date.parse(projection.updatedAt)
      ? runtime.updatedAt.toISOString()
      : projection.updatedAt,
  };
}

function buildRuntimeOnlyProjection(
  taskId: string,
  runtime: RuntimeInstanceProjectionRow,
): DirectorRuntimeProjection {
  const copy = runtimeHeadline(runtime);
  return {
    runId: runtime.runId ?? runtime.id,
    novelId: runtime.novelId,
    runtimeId: runtime.id,
    runtimeStatus: runtime.status,
    status: runtimeStatusToProjectionStatus(runtime.status),
    currentAction: runtime.currentStep,
    waitingReason: runtimeWaitingReason(runtime.status),
    activeExecution: runtime.executions[0]
      ? {
        executionId: runtime.executions[0].id,
        stepType: runtime.executions[0].stepType,
        resourceClass: runtime.executions[0].resourceClass,
        workerId: runtime.executions[0].workerId,
        slotId: runtime.executions[0].slotId,
        status: runtime.executions[0].status,
        startedAt: runtime.executions[0].startedAt?.toISOString() ?? null,
        leaseExpiresAt: runtime.executions[0].leaseExpiresAt?.toISOString() ?? null,
      }
      : null,
    resourceClass: runtime.executions[0]?.resourceClass ?? null,
    checkpointSummary: runtime.checkpoints[0]?.summary ?? null,
    nextAutomaticAction: runtime.status === "completed" ? null : "El sistema continuará automáticamente con la tarea actual del director automático.",
    currentNodeKey: runtime.currentStep,
    currentLabel: copy.currentLabel,
    headline: copy.headline,
    detail: copy.detail,
    lastEventSummary: runtime.workerMessage ?? null,
    requiresUserAction: runtime.status === "waiting_gate" || runtime.status === "failed_hard",
    blockedReason: runtime.lastErrorMessage,
    blockingReason: runtime.lastErrorMessage,
    policyMode: "run_until_gate",
    updatedAt: runtime.updatedAt.toISOString(),
    recentEvents: runtime.commands.slice(0, 5).map((command) => ({
      eventId: `${taskId}:${command.id}`,
      type: "node_heartbeat",
      summary: command.status === "queued" ? "Auto Director espera recursos de ejecución en segundo plano." : "Autodirector está trabajando en el libro.",
      occurredAt: command.updatedAt.toISOString(),
      severity: "low",
    })),
    workerHealth: buildWorkerHealth(runtime),
  };
}

function resolveActiveCommandCopy(command: ActiveRuntimeCommand): {
  headline: string;
  currentLabel: string;
  detail: string;
} {
  if (command.status === "queued") {
    if (command.commandType === "confirm_candidate") {
      return {
        headline: "La IA maneja la orientación a nivel de libro",
        currentLabel: "Se completa el envío de la dirección a nivel de libro, a la espera de que la IA cree un proyecto novedoso.",
        detail: "Una vez que el ejecutor en segundo plano asuma el control, se creará la novela y continuará el proceso posterior.",
      };
    }
    return {
      headline: "El director automático de IA espera a que el fondo se haga cargo",
      currentLabel: "La tarea ingresa a la cola en segundo plano y está esperando que el ejecutor en segundo plano se haga cargo.",
      detail: "Una vez que el ejecutor en segundo plano asuma el control, continuará avanzando desde la posición actual.",
    };
  }
  if (command.status === "leased") {
    return {
      headline: "El ejecutor en segundo plano está asumiendo el control.",
      currentLabel: "El ejecutor en segundo plano se hace cargo de la tarea.",
      detail: "La tarea se asigna al ejecutor en segundo plano y está a punto de ingresar a la ejecución real.",
    };
  }
  if (command.commandType === "confirm_candidate") {
    return {
      headline: "La IA está creando proyectos novedosos",
      currentLabel: "Se está creando un proyecto novedoso basado en una dirección elegida.",
      detail: "La IA completa la dirección a nivel de libro que usted eligió en un proyecto novedoso y se hace cargo del proceso de seguimiento.",
    };
  }
  return {
    headline: "La IA está avanzando en los directores automatizados",
    currentLabel: "El ejecutor en segundo plano está avanzando en el proceso de director automatizado.",
    detail: "La IA está procesando la tarea actual en segundo plano y se escribirá un nuevo progreso cuando se complete.",
  };
}

function overlayActiveCommand(
  projection: DirectorRuntimeProjection,
  command: ActiveRuntimeCommand | null,
): DirectorRuntimeProjection {
  if (!command) {
    return projection;
  }
  if (command.status === "running" && projection.status === "running") {
    return projection;
  }
  const copy = resolveActiveCommandCopy(command);
  return {
    ...projection,
    status: "running",
    headline: copy.headline,
    currentLabel: copy.currentLabel,
    detail: copy.detail,
    requiresUserAction: false,
    blockedReason: null,
    blockingReason: null,
    updatedAt: command.updatedAt.getTime() > Date.parse(projection.updatedAt)
      ? command.updatedAt.toISOString()
      : projection.updatedAt,
  };
}

export async function loadPersistentDirectorRuntimeProjection(
  taskId: string,
  projectionService = new DirectorEventProjectionService(),
): Promise<DirectorRuntimeProjection | null> {
  const TERMINAL_TASK_STATUSES = ["succeeded", "cancelled", "failed"];
  const [run, activeCommand, runtime, taskRow, riskEventRows] = await Promise.all([
    prisma.directorRun.findUnique({
      where: { taskId },
      select: {
        id: true,
        novelId: true,
        entrypoint: true,
        policyJson: true,
        lastWorkspaceAnalysisJson: true,
        updatedAt: true,
        steps: {
          orderBy: [{ updatedAt: "desc" }, { startedAt: "desc" }],
          take: 30,
          select: {
            idempotencyKey: true,
            nodeKey: true,
            label: true,
            status: true,
            targetType: true,
            targetId: true,
            startedAt: true,
            finishedAt: true,
            error: true,
            policyDecisionJson: true,
          },
        },
        events: {
          orderBy: { occurredAt: "desc" },
          take: 30,
          select: {
            id: true,
            type: true,
            taskId: true,
            novelId: true,
            nodeKey: true,
            artifactId: true,
            artifactType: true,
            summary: true,
            affectedScope: true,
            severity: true,
            occurredAt: true,
            metadataJson: true,
          },
        },
      },
    }),
    prisma.directorRunCommand.findFirst({
      where: {
        taskId,
        status: { in: ["queued", "leased", "running"] },
        task: {
          status: { notIn: ["succeeded", "cancelled", "failed"] },
        },
      },
      orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }, { id: "desc" }],
      select: {
        id: true,
        commandType: true,
        status: true,
        updatedAt: true,
      },
    }) as Promise<ActiveRuntimeCommand | null>,
    readLegacyDirectorRuntime(prisma, taskId),
    prisma.novelWorkflowTask.findUnique({
      where: { id: taskId },
      select: { status: true },
    }).catch(() => null),
    prisma.directorEvent.findMany({
      where: { taskId },
      orderBy: { occurredAt: "desc" },
      take: 200,
      select: { id: true, metadataJson: true },
    }).catch(() => [] as Array<{ id: string; metadataJson: string | null }>),
  ]);
  const riskHistory = parseRiskHistory(riskEventRows);
  const taskData = taskRow
    ? await new DirectorStateReader().readTaskDataById(taskId) as DirectorWorkflowSeedPayload | null
    : null;
  const startupPreparation = taskData?.startupPreparation ?? null;
  const latestRiskAssessment = parsePersistedDirectorRiskAssessment(taskData?.autoExecution?.latestRiskAssessment)
    ?? riskHistory[0]
    ?? null;

  const isTaskTerminal = taskRow
    ? TERMINAL_TASK_STATUSES.includes(taskRow.status)
    : false;

  if (!run) {
    if (!runtime) return null;
    const chapterExecutionProgress = runtime.novelId
      ? await new ChapterExecutionProgressInspector().inspectNovel(runtime.novelId).catch(() => null)
      : null;
    return {
      ...buildRuntimeOnlyProjection(taskId, runtime),
      startupPreparation,
      latestRiskAssessment,
      riskHistory,
      riskHistoryTotal: riskHistory.length,
      chapterExecutionProgress,
    };
  }

  const snapshot: DirectorRuntimeSnapshot = {
    schemaVersion: 1,
    runId: run.id,
    novelId: run.novelId,
    entrypoint: run.entrypoint,
    policy: parseJsonOrNull<DirectorRuntimePolicySnapshot>(run.policyJson)
      ?? {
        ...buildDefaultDirectorPolicy(),
        updatedAt: run.updatedAt.toISOString(),
      },
    steps: [...run.steps].reverse().map((step) => ({
      idempotencyKey: step.idempotencyKey,
      nodeKey: step.nodeKey,
      label: step.label,
      status: step.status as DirectorRuntimeSnapshot["steps"][number]["status"],
      targetType: step.targetType as DirectorRuntimeSnapshot["steps"][number]["targetType"],
      targetId: step.targetId,
      startedAt: step.startedAt.toISOString(),
      finishedAt: step.finishedAt?.toISOString() ?? null,
      error: step.error,
      policyDecision: parseJsonOrNull<DirectorRuntimeSnapshot["steps"][number]["policyDecision"]>(step.policyDecisionJson),
    })),
    events: [...run.events].reverse().map((event) => ({
      eventId: event.id,
      type: event.type as DirectorRuntimeSnapshot["events"][number]["type"],
      taskId: event.taskId,
      novelId: event.novelId,
      nodeKey: event.nodeKey,
      artifactId: event.artifactId,
      artifactType: event.artifactType as DirectorRuntimeSnapshot["events"][number]["artifactType"],
      summary: event.summary,
      affectedScope: event.affectedScope,
      severity: event.severity as DirectorRuntimeSnapshot["events"][number]["severity"],
      occurredAt: event.occurredAt.toISOString(),
      metadata: parseJsonOrNull<Record<string, unknown>>(event.metadataJson) ?? undefined,
    })),
    artifacts: [],
    lastWorkspaceAnalysis: parseJsonOrNull<DirectorRuntimeSnapshot["lastWorkspaceAnalysis"]>(
      run.lastWorkspaceAnalysisJson,
    ),
    updatedAt: run.updatedAt.toISOString(),
  };
  const projection = projectionService.buildSnapshotProjection(snapshot);
  if (!projection) {
    return null;
  }
  const usageTelemetry = await directorUsageTelemetryQueryService.getTaskUsage(
    taskId,
    snapshot.steps,
  );
  const commandToOverlay = isTaskTerminal ? null : activeCommand;
  const chapterExecutionProgress = run.novelId
    ? await new ChapterExecutionProgressInspector().inspectNovel(run.novelId).catch(() => null)
    : null;
  return {
    ...overlayRuntimeInstance(overlayActiveCommand(projection, commandToOverlay), isTaskTerminal ? null : runtime),
    startupPreparation,
    latestRiskAssessment,
    riskHistory,
    riskHistoryTotal: riskHistory.length,
    chapterExecutionProgress,
    usageSummary: usageTelemetry.summary,
    recentUsage: usageTelemetry.recentUsage,
    stepUsage: usageTelemetry.stepUsage,
    promptUsage: usageTelemetry.promptUsage,
  };
}

export async function loadPersistentDirectorRuntimeEventHistory(
  taskId: string,
  limit = 200,
): Promise<{
  events: DirectorRuntimeProjectionEvent[];
  totalCount: number;
  limit: number;
}> {
  const normalizedLimit = Math.max(1, Math.min(500, Math.round(limit)));
  const [totalCount, events] = await Promise.all([
    prisma.directorEvent.count({ where: { taskId } }),
    prisma.directorEvent.findMany({
      where: { taskId },
      orderBy: { occurredAt: "desc" },
      take: normalizedLimit,
      select: {
        id: true,
        type: true,
        nodeKey: true,
        artifactType: true,
        summary: true,
        severity: true,
        metadataJson: true,
        occurredAt: true,
      },
    }),
  ]);

  return {
    events: events.map((event) => {
      const issue = parseDirectorIssueEventMetadata(parseJsonOrNull<Record<string, unknown>>(event.metadataJson));
      return {
        eventId: event.id,
        type: event.type as DirectorRuntimeProjectionEvent["type"],
        summary: event.summary,
        nodeKey: event.nodeKey,
        artifactType: event.artifactType as DirectorRuntimeProjectionEvent["artifactType"],
        severity: event.severity as DirectorRuntimeProjectionEvent["severity"],
        occurredAt: event.occurredAt.toISOString(),
        issue: issue?.occurrence ?? null,
        issueDecision: issue?.decision ?? null,
      };
    }),
    totalCount,
    limit: normalizedLimit,
  };
}
