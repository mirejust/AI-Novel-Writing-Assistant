import { prisma } from "../../db/prisma";
import { taskCenterService } from "../../services/task/TaskCenterService";
import { buildTaskRecoveryHint, normalizeFailureSummary } from "../../services/task/taskSupport";
import { AgentToolError, type AgentToolName } from "../types";
import type { AgentToolDefinition } from "./toolTypes";
import {
  explainGenerationBlockerInputSchema,
  explainGenerationBlockerOutputSchema,
  getRunFailureReasonInputSchema,
  getRunFailureReasonOutputSchema,
  getTaskDetailOutputSchema,
  getTaskFailureReasonOutputSchema,
  listTasksInputSchema,
  listTasksOutputSchema,
  taskIdentityInputSchema,
  taskMutationOutputSchema,
} from "./taskToolSchemas";

export const taskToolDefinitions: Partial<
  Record<AgentToolName, AgentToolDefinition<Record<string, unknown>, Record<string, unknown>>>
> = {
  list_tasks: {
    name: "list_tasks",
    title: "Listar tareas del sistema",
    description: "Lea la lista de tareas unificadas, el estado y las indicaciones de recuperación en el Centro de tareas.",
    category: "read",
    riskLevel: "low",
    domainAgent: "Coordinator",
    resourceScopes: ["task", "agent_run", "generation_job"],
    parserHints: {
      intent: "query_task_status",
      aliases: ["lista de tareas", "Tareas del sistema", "tasks"],
      phrases: ["Enumerar el estado actual de las tareas del sistema", "¿Qué tareas tiene actualmente el sistema?", "Ver el estado del centro de tareas"],
      requiresNovelContext: false,
      whenToUse: "El usuario consulta el centro de tareas, el estado de las tareas del sistema o la lista de tareas.",
      whenNotToUse: "El usuario pregunta sobre el progreso de producción de una determinada novela, que está más cerca de query_novel_production_status.",
    },
    inputSchema: listTasksInputSchema,
    outputSchema: listTasksOutputSchema,
    execute: async (_context, rawInput) => {
      const input = listTasksInputSchema.parse(rawInput);
      const data = await taskCenterService.listTasks(input);
      return listTasksOutputSchema.parse({
        items: data.items.map((item) => ({
          id: item.id,
          kind: item.kind,
          title: item.title,
          status: item.status,
          progress: item.progress,
          currentStage: item.currentStage ?? null,
          ownerLabel: item.ownerLabel,
          failureSummary: item.failureSummary ?? item.lastError ?? null,
          recoveryHint: item.recoveryHint ?? null,
        })),
        summary: `Leer ${data.items.length} tareas del sistema.`,
      });
    },
  },
  get_task_detail: {
    name: "get_task_detail",
    title: "Leer detalles de la tarea",
    description: "Lea los detalles unificados de la tarea, la página de origen y el diagnóstico de fallas.",
    category: "read",
    riskLevel: "low",
    domainAgent: "Coordinator",
    resourceScopes: ["task", "agent_run", "generation_job"],
    inputSchema: taskIdentityInputSchema,
    outputSchema: getTaskDetailOutputSchema,
    execute: async (_context, rawInput) => {
      const input = taskIdentityInputSchema.parse(rawInput);
      const detail = await taskCenterService.getTaskDetail(input.kind, input.id);
      if (!detail) {
        throw new AgentToolError("NOT_FOUND", "Task not found.");
      }
      const failureSummary = detail.failureSummary ?? detail.lastError ?? null;
      return getTaskDetailOutputSchema.parse({
        id: detail.id,
        kind: detail.kind,
        title: detail.title,
        status: detail.status,
        currentStage: detail.currentStage ?? null,
        ownerLabel: detail.ownerLabel,
        sourceRoute: detail.sourceRoute,
        failureSummary,
        failureDetails: detail.failureDetails ?? detail.lastError ?? null,
        recoveryHint: detail.recoveryHint ?? buildTaskRecoveryHint(detail.kind, detail.status),
        summary: `lectura de tarea ${detail.title}.`,
      });
    },
  },
  get_task_failure_reason: {
    name: "get_task_failure_reason",
    title: "Explica por qué falló la tarea.",
    description: "Explique por qué las tareas unificadas fallan, están en cola, bloqueadas o esperan aprobación.",
    category: "inspect",
    riskLevel: "low",
    domainAgent: "Coordinator",
    resourceScopes: ["task", "agent_run", "generation_job"],
    inputSchema: taskIdentityInputSchema,
    outputSchema: getTaskFailureReasonOutputSchema,
    execute: async (_context, rawInput) => {
      const input = taskIdentityInputSchema.parse(rawInput);
      const detail = await taskCenterService.getTaskDetail(input.kind, input.id);
      if (!detail) {
        throw new AgentToolError("NOT_FOUND", "Task not found.");
      }
      const recoveryHint = detail.recoveryHint ?? buildTaskRecoveryHint(detail.kind, detail.status);
      const failureSummary = normalizeFailureSummary(
        detail.failureSummary ?? detail.lastError,
        detail.status === "failed"
          ? "La tarea falló, pero no se registró ningún error explícito."
          : `El estado actual de la tarea es ${detail.status}.`,
      );
      return getTaskFailureReasonOutputSchema.parse({
        kind: detail.kind,
        id: detail.id,
        status: detail.status,
        failureSummary,
        failureDetails: detail.failureDetails ?? detail.lastError ?? null,
        recoveryHint,
        summary: failureSummary,
      });
    },
  },
  get_run_failure_reason: {
    name: "get_run_failure_reason",
    title: "Explica por qué falló la operación.",
    description: "Lea el último paso fallido de la ejecución del agente, el resumen de errores y las recomendaciones de recuperación.",
    category: "inspect",
    riskLevel: "low",
    domainAgent: "Coordinator",
    resourceScopes: ["agent_run", "task"],
    inputSchema: getRunFailureReasonInputSchema,
    outputSchema: getRunFailureReasonOutputSchema,
    execute: async (_context, rawInput) => {
      const input = getRunFailureReasonInputSchema.parse(rawInput);
      const run = await prisma.agentRun.findUnique({
        where: { id: input.runId },
      });
      if (!run) {
        throw new AgentToolError("NOT_FOUND", "Agent run not found.");
      }
      const failedStep = await prisma.agentStep.findFirst({
        where: {
          runId: run.id,
          status: "failed",
        },
        orderBy: [{ seq: "desc" }],
      });
      const failureSummary = normalizeFailureSummary(
        run.error ?? failedStep?.error,
        run.status === "failed"
          ? "La ejecución falla, pero no se registra ningún error explícito."
          : run.status === "waiting_approval"
            ? "Ejecutar pendiente de aprobación."
            : `El estado de ejecución actual es ${run.status}.`,
      );
      return getRunFailureReasonOutputSchema.parse({
        runId: run.id,
        status: run.status,
        failureSummary,
        failureDetails: failedStep?.error ?? run.error ?? null,
        recoveryHint: buildTaskRecoveryHint("agent_run", run.status),
        lastFailedStep: failedStep ? `${failedStep.agentName}.${failedStep.stepType}` : null,
        summary: failureSummary,
      });
    },
  },
  retry_task: {
    name: "retry_task",
    title: "Reintentar tarea",
    description: "Realiza un reintento en la tarea unificada y devuelve un nuevo resumen de estado.",
    category: "run",
    riskLevel: "medium",
    domainAgent: "Coordinator",
    resourceScopes: ["task", "agent_run", "generation_job"],
    inputSchema: taskIdentityInputSchema,
    outputSchema: taskMutationOutputSchema,
    execute: async (_context, rawInput) => {
      const input = taskIdentityInputSchema.parse(rawInput);
      const detail = await taskCenterService.retryTask(input.kind, input.id);
      return taskMutationOutputSchema.parse({
        kind: detail.kind,
        id: detail.id,
        status: detail.status,
        summary: `Reintento de tarea activado:${detail.title}.`,
      });
    },
  },
  cancel_task: {
    name: "cancel_task",
    title: "Cancelar tarea",
    description: "Cancele la tarea unificada y vuelva al estado más reciente.",
    category: "run",
    riskLevel: "medium",
    domainAgent: "Coordinator",
    resourceScopes: ["task", "agent_run", "generation_job"],
    inputSchema: taskIdentityInputSchema,
    outputSchema: taskMutationOutputSchema,
    execute: async (_context, rawInput) => {
      const input = taskIdentityInputSchema.parse(rawInput);
      const detail = await taskCenterService.cancelTask(input.kind, input.id);
      return taskMutationOutputSchema.parse({
        kind: detail.kind,
        id: detail.id,
        status: detail.status,
        summary: `Tarea cancelada:${detail.title}.`,
      });
    },
  },
  explain_generation_blocker: {
    name: "explain_generation_blocker",
    title: "Explicar el bloqueo de generación de capítulos.",
    description: "Lea el registro de última generación del capítulo de la novela y explique los motivos del fallo, la cola o el bloqueo.",
    category: "inspect",
    riskLevel: "low",
    domainAgent: "NovelAgent",
    resourceScopes: ["novel", "chapter", "generation_job", "task"],
    inputSchema: explainGenerationBlockerInputSchema,
    outputSchema: explainGenerationBlockerOutputSchema,
    execute: async (_context, rawInput) => {
      const input = explainGenerationBlockerInputSchema.parse(rawInput);
      if (input.runId?.trim()) {
        const run = await prisma.agentRun.findUnique({
          where: { id: input.runId },
        });
        if (run && run.novelId === input.novelId && run.error?.trim()) {
          return explainGenerationBlockerOutputSchema.parse({
            novelId: input.novelId,
            chapterOrder: input.chapterOrder ?? null,
            blockerType: "agent_run",
            status: run.status,
            failureSummary: run.error.trim(),
            failureDetails: run.error,
            recoveryHint: buildTaskRecoveryHint("agent_run", run.status),
            summary: run.error.trim(),
          });
        }
      }

      const job = await prisma.generationJob.findFirst({
        where: {
          novelId: input.novelId,
          ...(input.chapterOrder != null
            ? {
              startOrder: { lte: input.chapterOrder },
              endOrder: { gte: input.chapterOrder },
            }
            : {}),
        },
        orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      });

      if (!job) {
        return explainGenerationBlockerOutputSchema.parse({
          novelId: input.novelId,
          chapterOrder: input.chapterOrder ?? null,
          blockerType: "none",
          status: null,
          failureSummary: "Actualmente no se han encontrado registros de tareas de generación relacionados con este capítulo.",
          failureDetails: null,
          recoveryHint: "Se recomienda confirmar primero si se ha iniciado la generación del capítulo o verificar si existe una tarea de canalización correspondiente en el centro de tareas.",
          summary: "Actualmente no se han encontrado registros de tareas de generación relacionados con este capítulo.",
        });
      }

      const blockerType = job.status === "failed"
        ? "pipeline_failed"
        : job.status === "running"
          ? "pipeline_running"
          : job.status === "queued"
            ? "pipeline_waiting"
            : "none";
      const failureSummary = job.status === "failed"
        ? normalizeFailureSummary(job.error, "Error al generar el capítulo, pero no se registró ningún error explícito.")
        : job.status === "running"
          ? "La generación de capítulos aún está en progreso."
          : job.status === "queued"
            ? "Las tareas de generación de capítulos todavía están en cola."
            : job.status === "cancelled"
              ? "La tarea de generación de capítulos ha sido cancelada."
              : "La última tarea de generación de capítulos ha finalizado.";
      return explainGenerationBlockerOutputSchema.parse({
        novelId: input.novelId,
        chapterOrder: input.chapterOrder ?? null,
        blockerType,
        status: job.status,
        failureSummary,
        failureDetails: job.error ?? null,
        recoveryHint: buildTaskRecoveryHint("novel_pipeline", job.status),
        summary: failureSummary,
      });
    },
  },
};
