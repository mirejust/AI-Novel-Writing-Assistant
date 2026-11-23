import type {
  DirectorManualEditImpact,
  DirectorNextAction,
  DirectorPolicyMode,
  DirectorRuntimeProjection,
  DirectorWorkspaceAnalysis,
} from "@ai-novel/shared/types/directorRuntime";
import type { NovelDirectorService } from "../../services/novel/director/NovelDirectorService";
import type { DirectorCommandService } from "../../services/novel/director/commands/DirectorCommandService";
import type { NovelWorkflowService } from "../../services/novel/workflow/NovelWorkflowService";
import { AgentToolError, type AgentToolName, type ToolExecutionContext } from "../types";
import type { AgentToolDefinition } from "./toolTypes";
import {
  analyzeDirectorWorkspaceInputSchema,
  analyzeDirectorWorkspaceOutputSchema,
  evaluateManualEditImpactInputSchema,
  evaluateManualEditImpactOutputSchema,
  explainDirectorNextActionInputSchema,
  explainDirectorNextActionOutputSchema,
  getDirectorRunStatusInputSchema,
  getDirectorRunStatusOutputSchema,
  runDirectorRuntimeInputSchema,
  runDirectorRuntimeOutputSchema,
  switchDirectorPolicyInputSchema,
  switchDirectorPolicyOutputSchema,
} from "./directorRuntimeToolSchemas";

let serviceCache: {
  novelDirectorService: NovelDirectorService;
  directorCommandService: DirectorCommandService;
  workflowService: NovelWorkflowService;
} | null = null;

async function getServices() {
  if (serviceCache) {
    return serviceCache;
  }
  const [
    { NovelDirectorService },
    { DirectorCommandService },
    { NovelWorkflowService },
  ] = await Promise.all([
    import("../../services/novel/director/NovelDirectorService"),
    import("../../services/novel/director/commands/DirectorCommandService"),
    import("../../services/novel/workflow/NovelWorkflowService"),
  ]);
  const workflowService = new NovelWorkflowService();
  serviceCache = {
    novelDirectorService: new NovelDirectorService(),
    directorCommandService: new DirectorCommandService(workflowService),
    workflowService,
  };
  return serviceCache;
}

interface ResolvedDirectorRuntimeScope {
  taskId: string;
  novelId: string;
}

function trimText(value: string | null | undefined): string | null {
  const text = value?.trim();
  return text ? text : null;
}

function resolveNovelId(context: ToolExecutionContext, input: {
  novelId?: string;
}): string | null {
  return trimText(input.novelId) ?? trimText(context.novelId);
}

async function resolveDirectorRuntimeScope(
  context: ToolExecutionContext,
  input: {
    novelId?: string;
    taskId?: string;
  },
): Promise<ResolvedDirectorRuntimeScope> {
  const { workflowService } = await getServices();
  const taskId = trimText(input.taskId);
  if (taskId) {
    const task = await workflowService.getTaskByIdWithoutHealing(taskId);
    if (!task) {
      throw new AgentToolError("NOT_FOUND", "No se encontró ninguna tarea de director automático vinculada.");
    }
    const novelId = trimText(input.novelId) ?? trimText(task.novelId) ?? trimText(context.novelId);
    if (!novelId) {
      throw new AgentToolError("INVALID_INPUT", "La tarea del director automático no tiene ningún vínculo novedoso y no puede leer el tiempo de ejecución.");
    }
    return { taskId: task.id, novelId };
  }

  const novelId = resolveNovelId(context, input);
  if (!novelId) {
    throw new AgentToolError("INVALID_INPUT", "Debe vincular la novela o pasar el ID de tarea del director automático.");
  }

  const activeTask = await workflowService.findActiveDirectorTask(novelId);
  const task = activeTask ?? await workflowService.resolveCurrentDirectorTask(novelId);
  if (!task) {
    throw new AgentToolError("NOT_FOUND", "Actualmente no hay misiones de director automático para cargar para la novela.");
  }
  return {
    taskId: task.id,
    novelId: trimText(task.novelId) ?? novelId,
  };
}

function toNextAction(action: DirectorNextAction | null | undefined) {
  if (!action) {
    return null;
  }
  return {
    action: action.action,
    reason: action.reason,
    affectedScope: action.affectedScope ?? null,
    riskLevel: action.riskLevel,
  };
}

function buildArtifactSummary(analysis: DirectorWorkspaceAnalysis) {
  const inventory = analysis.inventory;
  return {
    total: inventory.artifacts.length,
    missingArtifactTypes: inventory.missingArtifactTypes,
    staleArtifactCount: inventory.staleArtifacts.length,
    protectedUserContentCount: inventory.protectedUserContentArtifacts.length,
    needsRepairCount: inventory.needsRepairArtifacts.length,
  };
}

function buildWorkspaceOutput(input: {
  taskId: string | null;
  analysis: DirectorWorkspaceAnalysis;
}) {
  const interpretation = input.analysis.interpretation;
  const nextAction = input.analysis.recommendation ?? interpretation?.recommendedAction ?? null;
  return {
    novelId: input.analysis.novelId,
    taskId: input.taskId,
    productionStage: interpretation?.productionStage ?? null,
    summary: interpretation?.summary
      ?? nextAction?.reason
      ?? "Se completó el análisis automatizado del espacio de trabajo del director de la novela actual.",
    confidence: input.analysis.confidence,
    nextAction: toNextAction(nextAction),
    artifactSummary: buildArtifactSummary(input.analysis),
  };
}

function buildProjectionSummary(projection: DirectorRuntimeProjection): string {
  if (projection.requiresUserAction && projection.blockedReason) {
    return projection.blockedReason;
  }
  return projection.headline
    ?? projection.detail
    ?? projection.lastEventSummary
    ?? "Se ha leído el estado de ejecución de Autodirector.";
}

async function loadRuntimeProjection(scope: ResolvedDirectorRuntimeScope): Promise<DirectorRuntimeProjection> {
  const { novelDirectorService } = await getServices();
  const projection = await novelDirectorService.getRuntimeProjection(scope.taskId);
  if (!projection) {
    throw new AgentToolError("NOT_FOUND", "Actualmente no hay instantáneas en tiempo de ejecución para la tarea de Director automatizado.");
  }
  return projection;
}

function buildStatusOutput(scope: ResolvedDirectorRuntimeScope, projection: DirectorRuntimeProjection) {
  return {
    taskId: scope.taskId,
    novelId: projection.novelId ?? scope.novelId ?? null,
    status: projection.status,
    currentNodeKey: projection.currentNodeKey ?? null,
    currentLabel: projection.currentLabel ?? null,
    headline: projection.headline ?? null,
    detail: projection.detail ?? null,
    nextActionLabel: projection.nextActionLabel ?? null,
    scopeSummary: projection.scopeSummary ?? null,
    progressSummary: projection.progressSummary ?? null,
    progressBreakdown: projection.progressBreakdown ?? null,
    requiresUserAction: projection.requiresUserAction,
    blockedReason: projection.blockedReason ?? null,
    blockingReason: projection.blockingReason ?? projection.blockedReason ?? null,
    recommendedAction: projection.recommendedAction ?? null,
    recoveryDecision: projection.recoveryDecision ?? "requires_manual_recovery",
    isAutopilotRecoverable: projection.isAutopilotRecoverable ?? false,
    visibleRiskBadges: projection.visibleRiskBadges ?? [],
    rootCauseCode: projection.rootCauseCode ?? null,
    blockingObligations: projection.blockingObligations ?? [],
    qualityBudgetSummary: projection.qualityBudgetSummary ?? null,
    qualityDebtSummary: projection.qualityDebtSummary ?? null,
    policyMode: projection.policyMode,
    recentEvents: projection.recentEvents.map((event) => ({
      type: event.type,
      summary: event.summary,
      nodeKey: event.nodeKey ?? null,
      severity: event.severity ?? null,
      occurredAt: event.occurredAt,
    })),
    summary: buildProjectionSummary(projection),
  };
}

function getLlmOptions(context: ToolExecutionContext) {
  return {
    provider: context.provider as any,
    model: context.model,
    temperature: context.temperature,
  };
}

async function analyzeWorkspaceForTool(
  context: ToolExecutionContext,
  input: {
    novelId?: string;
    taskId?: string;
    includeAiInterpretation?: boolean;
  },
) {
  const { novelDirectorService } = await getServices();
  const scope = await resolveDirectorRuntimeScope(context, input);
  const analysis = await novelDirectorService.analyzeRuntimeWorkspace(scope.novelId, {
    workflowTaskId: context.plannerProfile === "creative_hub_readonly" ? null : scope.taskId,
    includeAiInterpretation: input.includeAiInterpretation === true,
    llm: getLlmOptions(context),
  });
  return { scope, analysis };
}

function normalizePolicyPatch(input: {
  mayOverwriteUserContent?: boolean;
  allowExpensiveReview?: boolean;
  modelTier?: "cheap_fast" | "balanced" | "high_quality";
}) {
  return {
    mayOverwriteUserContent: input.mayOverwriteUserContent,
    allowExpensiveReview: input.allowExpensiveReview,
    modelTier: input.modelTier,
  };
}

function describeDirectorPolicyMode(mode: DirectorPolicyMode): string {
  switch (mode) {
    case "suggest_only":
      return "solo da sugerencias";
    case "run_next_step":
      return "Continúe con el siguiente paso";
    case "run_until_gate":
      return "Avanza al siguiente punto de control";
    case "auto_safe_scope":
      return "Avance automático de rango seguro";
    default:
      return "Métodos de avance actuales";
  }
}

function buildManualImpactOutput(input: {
  taskId: string | null;
  impact: DirectorManualEditImpact;
}) {
  return {
    novelId: input.impact.novelId,
    taskId: input.taskId,
    impactLevel: input.impact.impactLevel,
    summary: input.impact.summary,
    safeToContinue: input.impact.safeToContinue,
    requiresApproval: input.impact.requiresApproval,
    affectedArtifactIds: input.impact.affectedArtifactIds,
    changedChapters: input.impact.changedChapters.map((chapter) => ({
      chapterId: chapter.chapterId,
      title: chapter.title,
      order: chapter.order,
    })),
    minimalRepairPath: input.impact.minimalRepairPath.map((step) => ({
      action: step.action,
      label: step.label,
      reason: step.reason,
      affectedScope: step.affectedScope ?? null,
      requiresApproval: step.requiresApproval,
    })),
    riskNotes: input.impact.riskNotes,
  };
}

async function runDirectorWithMode(
  context: ToolExecutionContext,
  input: {
    novelId?: string;
    taskId?: string;
    dryRun?: boolean;
  },
  mode: DirectorPolicyMode,
) {
  const { novelDirectorService, directorCommandService } = await getServices();
  const scope = await resolveDirectorRuntimeScope(context, input);
  const modeLabel = describeDirectorPolicyMode(mode);
  if (context.dryRun || input.dryRun) {
    return {
      taskId: scope.taskId,
      novelId: scope.novelId,
      mode,
      status: "preview_only" as const,
      summary: `Prensa "${modeLabel}"Solicita al director automático que continúe la ejecución, y la política y los límites de aprobación se mantendrán antes de la ejecución.`,
    };
  }
  await novelDirectorService.updateRuntimePolicy(scope.taskId, { mode });
  await directorCommandService.enqueueContinueCommand(scope.taskId, {});
  return {
    taskId: scope.taskId,
    novelId: scope.novelId,
    mode,
    status: "accepted" as const,
    summary: `Se ha solicitado prensa automática de director"${modeLabel}"Continuar la ejecución.`,
  };
}

export const directorRuntimeToolDefinitions: Partial<
  Record<AgentToolName, AgentToolDefinition<Record<string, unknown>, Record<string, unknown>>>
> = {
  analyze_director_workspace: {
    name: "analyze_director_workspace",
    title: "Analizar el espacio de trabajo del director automatizado",
    description: "Analice los activos novedosos actuales, el contenido faltante, los riesgos y las acciones recomendadas con un tiempo de ejecución de director automatizado.",
    category: "inspect",
    riskLevel: "low",
    domainAgent: "NovelAgent",
    resourceScopes: ["novel", "task"],
    parserHints: {
      intent: "analyze_director_workspace",
      aliases: ["Análisis del espacio de trabajo del director.", "Análisis automático del director.", "Analizar activos novedosos actuales"],
      phrases: ["Analiza ahora lo que falta en este libro.", "Haga que Auto Director verifique el espacio de trabajo actual", "¿Están completos los activos novedosos actuales?"],
      requiresNovelContext: true,
      whenToUse: "Los usuarios piden a directores automatizados que analicen los activos novedosos actuales, los elementos faltantes, los riesgos o la sostenibilidad.",
    },
    inputSchema: analyzeDirectorWorkspaceInputSchema,
    outputSchema: analyzeDirectorWorkspaceOutputSchema,
    execute: async (context, rawInput) => {
      const input = analyzeDirectorWorkspaceInputSchema.parse(rawInput);
      const { scope, analysis } = await analyzeWorkspaceForTool(context, input);
      return analyzeDirectorWorkspaceOutputSchema.parse(buildWorkspaceOutput({
        taskId: scope.taskId,
        analysis,
      }));
    },
  },
  get_director_run_status: {
    name: "get_director_run_status",
    title: "Leer el estado del director automático",
    description: "Lee la proyección instantánea del tiempo de ejecución de AutoDirector, que describe el nodo actual, el motivo de la espera y los eventos recientes.",
    category: "inspect",
    riskLevel: "low",
    domainAgent: "NovelAgent",
    resourceScopes: ["novel", "task"],
    parserHints: {
      intent: "query_director_status",
      aliases: ["estado de director automático", "El progreso del director.", "director runtime"],
      phrases: ["¿Dónde está el director automático?", "¿Cuál es el estado actual del cargo de director?", "¿Cuál es el nodo director actual?"],
      requiresNovelContext: true,
      whenToUse: "El usuario solicita al AutoDirector el estado de ejecución, el nodo actual, la confirmación pendiente o los eventos recientes.",
    },
    inputSchema: getDirectorRunStatusInputSchema,
    outputSchema: getDirectorRunStatusOutputSchema,
    execute: async (context, rawInput) => {
      const input = getDirectorRunStatusInputSchema.parse(rawInput);
      const scope = await resolveDirectorRuntimeScope(context, input);
      const projection = await loadRuntimeProjection(scope);
      return getDirectorRunStatusOutputSchema.parse(buildStatusOutput(scope, projection));
    },
  },
  explain_director_next_action: {
    name: "explain_director_next_action",
    title: "AutoDirector explicado a continuación",
    description: "Combinado con el estado del tiempo de ejecución y el análisis del espacio de trabajo, explique cómo se debe avanzar a continuación en la novela actual.",
    category: "inspect",
    riskLevel: "low",
    domainAgent: "NovelAgent",
    resourceScopes: ["novel", "task"],
    parserHints: {
      intent: "explain_director_next_action",
      aliases: ["Sugerencias para los próximos pasos", "El consejo del director.", "que hacer ahora"],
      phrases: ["¿Qué hacer ahora con este libro?", "Cómo proceder a continuación", "El director automático sugiere qué hacer a continuación"],
      requiresNovelContext: true,
      whenToUse: "Los usuarios esperan un centro creativo que explique los próximos pasos, los riesgos y las acciones recomendadas para la novela actual.",
    },
    inputSchema: explainDirectorNextActionInputSchema,
    outputSchema: explainDirectorNextActionOutputSchema,
    execute: async (context, rawInput) => {
      const input = explainDirectorNextActionInputSchema.parse(rawInput);
      const { scope, analysis } = await analyzeWorkspaceForTool(context, input);
      const projection = await loadRuntimeProjection(scope);
      const nextAction = analysis.recommendation ?? analysis.interpretation?.recommendedAction ?? null;
      const reason = nextAction?.reason
        ?? projection.nextActionLabel
        ?? projection.detail
        ?? "El director automático actual seguirá recomendando el siguiente paso según el estado del tiempo de ejecución.";
      return explainDirectorNextActionOutputSchema.parse({
        novelId: scope.novelId,
        taskId: scope.taskId,
        runtimeStatus: projection.status,
        currentStep: projection.currentLabel ?? projection.currentNodeKey ?? null,
        recommendedAction: toNextAction(nextAction),
        nextActionLabel: projection.nextActionLabel ?? null,
        requiresUserAction: projection.requiresUserAction,
        blockedReason: projection.blockedReason ?? null,
        reason,
        summary: projection.requiresUserAction && projection.blockedReason
          ? projection.blockedReason
          : reason,
      });
    },
  },
  run_director_next_step: {
    name: "run_director_next_step",
    title: "Continuar para dirigir automáticamente el siguiente paso.",
    description: "Continúe con el siguiente paso con solicitudes automatizadas de tiempo de ejecución del director.",
    category: "run",
    riskLevel: "high",
    approvalRequired: true,
    domainAgent: "NovelAgent",
    resourceScopes: ["novel", "task"],
    parserHints: {
      intent: "run_director_next_step",
      aliases: ["seguir dirigiendo", "Continúe con el siguiente paso", "run next step"],
      phrases: ["Continuar para dirigir automáticamente el siguiente paso.", "Que el director siga avanzando.", "director ejecutivo siguiente paso"],
      requiresNovelContext: true,
      whenToUse: "El usuario solicita explícitamente al AutoDirector que continúe con el siguiente paso.",
    },
    inputSchema: runDirectorRuntimeInputSchema,
    outputSchema: runDirectorRuntimeOutputSchema,
    execute: async (context, rawInput) => {
      const input = runDirectorRuntimeInputSchema.parse(rawInput);
      return runDirectorRuntimeOutputSchema.parse(await runDirectorWithMode(context, input, "run_next_step"));
    },
  },
  run_director_until_gate: {
    name: "run_director_until_gate",
    title: "Avanza automáticamente al punto de control",
    description: "Las solicitudes de tiempo de ejecución continúan avanzando al siguiente punto de control o validación a través del director automatizado.",
    category: "run",
    riskLevel: "high",
    approvalRequired: true,
    domainAgent: "NovelAgent",
    resourceScopes: ["novel", "task"],
    parserHints: {
      intent: "run_director_until_gate",
      aliases: ["Avance al punto de control", "run until gate", "Avance al punto de confirmación"],
      phrases: ["Continuar con la dirección automática hasta el punto de control", "Avance hasta donde necesito confirmar", "Deja que el director corra al siguiente nivel."],
      requiresNovelContext: true,
      whenToUse: "El usuario solicita explícitamente al AutoDirector que avance continuamente hasta un punto de control, punto de confirmación o punto de estrangulamiento.",
    },
    inputSchema: runDirectorRuntimeInputSchema,
    outputSchema: runDirectorRuntimeOutputSchema,
    execute: async (context, rawInput) => {
      const input = runDirectorRuntimeInputSchema.parse(rawInput);
      return runDirectorRuntimeOutputSchema.parse(await runDirectorWithMode(context, input, "run_until_gate"));
    },
  },
  switch_director_policy: {
    name: "switch_director_policy",
    title: "Cambiar el modo de avance automático del director",
    description: "Alternar políticas automáticas de tiempo de ejecución del director, como dar solo consejos, avanzar al siguiente paso, avanzar al punto de control o avanzar al rango seguro automáticamente.",
    category: "run",
    riskLevel: "medium",
    domainAgent: "NovelAgent",
    resourceScopes: ["novel", "task"],
    parserHints: {
      intent: "switch_director_policy",
      aliases: ["Estrategia de cambio de director", "Cambiar método de propulsión", "Intensidad de automatización"],
      phrases: ["Cambiar el director automático para dar solo sugerencias", "Cambiar para avanzar al punto de control", "Permitir que los límites seguros avancen automáticamente"],
      requiresNovelContext: true,
      whenToUse: "Los usuarios solicitan explícitamente ajustes en la estrategia del autodirector o la intensidad del impulso de automatización.",
    },
    inputSchema: switchDirectorPolicyInputSchema,
    outputSchema: switchDirectorPolicyOutputSchema,
    execute: async (context, rawInput) => {
      const input = switchDirectorPolicyInputSchema.parse(rawInput);
      const scope = await resolveDirectorRuntimeScope(context, input);
      if (context.dryRun || input.dryRun) {
        return switchDirectorPolicyOutputSchema.parse({
          taskId: scope.taskId,
          novelId: scope.novelId,
          mode: input.mode,
          status: "preview_only",
          summary: `Cambiará el modo de avance automático del director a "${describeDirectorPolicyMode(input.mode)}».`,
        });
      }
      const { novelDirectorService } = await getServices();
      await novelDirectorService.updateRuntimePolicy(scope.taskId, {
        mode: input.mode,
        patch: normalizePolicyPatch(input),
      });
      return switchDirectorPolicyOutputSchema.parse({
        taskId: scope.taskId,
        novelId: scope.novelId,
        mode: input.mode,
        status: "updated",
        summary: `El modo de avance automático del director se ha cambiado a "${describeDirectorPolicyMode(input.mode)}».`,
      });
    },
  },
  evaluate_manual_edit_impact: {
    name: "evaluate_manual_edit_impact",
    title: "Evaluar el impacto de las revisiones manuales",
    description: "Evalúe el alcance del impacto y la ruta mínima de reparación después de que un usuario modifique manualmente el texto a través del tiempo de ejecución de AutoDirector.",
    category: "inspect",
    riskLevel: "low",
    domainAgent: "NovelAgent",
    resourceScopes: ["novel", "chapter", "task"],
    parserHints: {
      intent: "evaluate_manual_edit_impact",
      aliases: ["Impacto del texto revisado", "Efectos de edición manual", "manual edit impact"],
      phrases: ["Cambié el Capítulo 3 para ver cuál es el impacto.", "Cambié la motivación del personaje principal, ¿tengo que volver a calcularla más tarde?", "¿Qué capítulos se verán afectados por la eliminación de presagios?"],
      requiresNovelContext: true,
      whenToUse: "Después de que los usuarios modifican manualmente el texto, la motivación, el presagio o la configuración, esperan determinar el alcance del impacto y la ruta de reparación.",
    },
    inputSchema: evaluateManualEditImpactInputSchema,
    outputSchema: evaluateManualEditImpactOutputSchema,
    execute: async (context, rawInput) => {
      const input = evaluateManualEditImpactInputSchema.parse(rawInput);
      const scope = await resolveDirectorRuntimeScope(context, input);
      const { novelDirectorService } = await getServices();
      const impact = await novelDirectorService.evaluateManualEditImpact(scope.novelId, {
        workflowTaskId: context.plannerProfile === "creative_hub_readonly" ? null : scope.taskId,
        chapterId: input.chapterId,
        includeAiInterpretation: input.includeAiInterpretation ?? true,
        llm: getLlmOptions(context),
      });
      return evaluateManualEditImpactOutputSchema.parse(buildManualImpactOutput({
        taskId: scope.taskId,
        impact,
      }));
    },
  },
};
