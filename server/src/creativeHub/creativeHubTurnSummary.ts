import { asObject, summarizeOutput } from "../agents/runtime/runtimeHelpers";
import type { AgentRuntimeResult, PlannerResult, StructuredIntent } from "../agents/types";
import type { ProductionStatusResult } from "../services/novel/NovelProductionStatusService";
import type { AgentStep } from "@ai-novel/shared/types/agent";
import type {
  CreativeHubInterrupt,
  CreativeHubThread,
  CreativeHubTurnStatus,
  CreativeHubTurnSummary,
} from "@ai-novel/shared/types/creativeHub";

function truncateText(value: string, max = 180): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return "";
  }
  return normalized.length > max ? `${normalized.slice(0, max)}...` : normalized;
}

function formatIntentLabel(intent: StructuredIntent["intent"] | undefined): string {
  switch (intent) {
    case "social_opening":
      return "apertura de luz";
    case "list_novels":
      return "Ver el nuevo espacio de trabajo";
    case "create_novel":
      return "crear nueva novela";
    case "select_novel_workspace":
      return "Cambiar el espacio de trabajo actual";
    case "unbind_world_from_novel":
      return "Desvincular la visión del mundo actual";
    case "produce_novel":
      return "Promover la creación del libro completo.";
    case "query_novel_production_status":
      return "Verifique todo el progreso de la producción.";
    case "query_chapter_content":
      return "Ver el contenido del capítulo";
    case "inspect_failure_reason":
      return "Diagnosticar el bloqueo actual";
    case "write_chapter":
      return "Promover la creación de capítulos";
    case "rewrite_chapter":
      return "Reescribir el capítulo actual";
    case "search_knowledge":
      return "Consultar materiales de conocimiento.";
    case "ideate_novel_setup":
      return "Generar alternativas de configuración";
    case "workflow_handoff":
      return "Ir al banco de trabajo oficial";
    case "out_of_scope":
      return "Ver entrada adecuada";
    case "inspect_world":
      return "Verifique las limitaciones de la visión del mundo";
    case "inspect_characters":
      return "Ver el estado del personaje";
    case "general_chat":
      return "discusión creativa";
    default:
      return "Avanza tu creación actual";
  }
}

function toTurnStatus(
  threadStatus: CreativeHubThread["status"],
  latestError: string | null,
  executionResult: AgentRuntimeResult | null,
): CreativeHubTurnStatus {
  if (latestError || executionResult?.run.status === "failed") {
    return "failed";
  }
  if (threadStatus === "interrupted" || executionResult?.run.status === "waiting_approval") {
    return "interrupted";
  }
  if (executionResult?.run.status === "cancelled") {
    return "cancelled";
  }
  if (executionResult?.run.status === "running" || threadStatus === "busy") {
    return "running";
  }
  return "succeeded";
}

function extractToolSummaries(steps: AgentStep[]): string[] {
  return steps
    .filter((step) => step.stepType === "tool_result" && step.status === "succeeded")
    .map((step) => {
      const input = asObject(step.inputJson);
      const output = asObject(step.outputJson);
      const tool = typeof input.tool === "string" ? input.tool : "";
      if (!tool) {
        return "";
      }
      return truncateText(summarizeOutput(tool, output), 120);
    })
    .filter(Boolean);
}

function shouldEmitTurnSummary(
  turnStatus: CreativeHubTurnStatus,
  latestError: string | null,
  plannerResult: PlannerResult | null,
  executionResult: AgentRuntimeResult | null,
): boolean {
  if (plannerResult?.structuredIntent.intent === "social_opening") {
    return false;
  }
  if (latestError) {
    return true;
  }
  if (turnStatus !== "succeeded") {
    return true;
  }
  const steps = executionResult?.steps ?? [];
  return steps.some((step) => step.stepType === "tool_result" && step.status === "succeeded");
}

function buildIntentSummary(goal: string, plannerResult: PlannerResult | null): string {
  const structuredIntent = plannerResult?.structuredIntent;
  const describedGoal = truncateText(structuredIntent?.description ?? structuredIntent?.note ?? goal, 150);
  const label = formatIntentLabel(structuredIntent?.intent);
  return describedGoal ? `${label}:${describedGoal}` : label;
}

function buildActionSummary(
  turnStatus: CreativeHubTurnStatus,
  plannerResult: PlannerResult | null,
  toolSummaries: string[],
): string {
  if (toolSummaries.length > 0) {
    const preview = toolSummaries.slice(0, 3).join(";");
    if (toolSummaries.length > 3) {
      return `${preview} esperar ${toolSummaries.length} Acción.`;
    }
    return preview;
  }
  if ((plannerResult?.actions.length ?? 0) > 0) {
    const count = plannerResult?.actions.reduce((total, action) => total + action.calls.length, 0) ?? 0;
    if (turnStatus === "interrupted") {
      return `Planificado ${count} Esta acción se encuentra actualmente estancada en la etapa de aprobación o confirmación.`;
    }
    return `Planificado ${count} Para esta acción, esta ronda se centra principalmente en la colaboración creativa y la clasificación de estados.`;
  }
  return "En esta ronda no se activaron acciones de herramientas explícitas y la atención se centró en el diálogo creativo y la comprensión del espacio de trabajo.";
}

function buildImpactSummary(
  latestError: string | null,
  interrupts: CreativeHubInterrupt[],
  productionStatus?: ProductionStatusResult | null,
  toolSummaries: string[] = [],
): string {
  if (latestError) {
    return truncateText(latestError, 180);
  }
  if (interrupts.length > 0) {
    return truncateText(interrupts[0]?.summary ?? "Actualmente quedan pendientes acciones de alto impacto por confirmar.", 180);
  }
  if (productionStatus?.summary?.trim()) {
    return truncateText(productionStatus.summary, 180);
  }
  if (toolSummaries.length > 0) {
    return toolSummaries[toolSummaries.length - 1];
  }
  return "El estado del espacio de trabajo se ha actualizado y puedes continuar avanzando en tu dirección creativa actual.";
}

function buildNextSuggestion(
  turnStatus: CreativeHubTurnStatus,
  plannerResult: PlannerResult | null,
  latestError: string | null,
  interrupts: CreativeHubInterrupt[],
  productionStatus?: ProductionStatusResult | null,
): string {
  if (turnStatus === "interrupted" && interrupts.length > 0) {
    return "Primero procese la tarjeta de aprobación actual y luego continúe con la creación posterior.";
  }
  if (turnStatus === "failed" || latestError) {
    return productionStatus?.recoveryHint?.trim()
      || "Primero verifique el diagnóstico de falla y los motivos de bloqueo, y luego decida continuar generando o ajustar el contexto.";
  }
  switch (plannerResult?.structuredIntent.intent) {
    case "create_novel":
      return "Continúe completando la visión del mundo, los personajes o los parámetros de producción completos para llevar el libro a un espacio de trabajo estable.";
    case "unbind_world_from_novel":
      return "Si aún necesita apoyo en su visión del mundo, elija una visión del mundo más adecuada; de lo contrario, continúe compensando la configuración básica.";
    case "produce_novel":
      return "Continúe avanzando en toda la producción en torno a la novela actual, comprobando primero si hay bloqueos críticos si es necesario.";
    case "query_novel_production_status":
      return "Según el progreso actual, decida si continuar generando y reponiendo recursos o abordar el punto de falla primero.";
    case "write_chapter":
    case "rewrite_chapter":
      return "Continúe avanzando el texto alrededor del capítulo actual, solucione problemas o verifique la coherencia contextual.";
    case "search_knowledge":
      return "Continúe haciendo preguntas basadas en la información que ha encontrado o vincule materiales clave al espacio de trabajo actual.";
    case "ideate_novel_setup":
      return "Elija la versión más cercana entre las opciones actuales y continúe perfeccionando el protagonista, el conflicto y el compromiso de la historia.";
    case "workflow_handoff":
    case "out_of_scope":
      return "Abra el banco de trabajo novedoso, el director automático o la página de capítulo correspondiente para completar operaciones posteriores; el registro en ejecución solo se utiliza para consultar el estado.";
    default:
      return "Vea el estado actual, el motivo del error o los próximos pasos recomendados.";
  }
}

function buildCurrentStage(
  turnStatus: CreativeHubTurnStatus,
  plannerResult: PlannerResult | null,
  executionResult: AgentRuntimeResult | null,
  productionStatus?: ProductionStatusResult | null,
): string {
  if (turnStatus === "interrupted") {
    return "Esperando aprobación";
  }
  if (turnStatus === "failed") {
    return "La ejecución falló";
  }
  if (productionStatus?.currentStage?.trim()) {
    return productionStatus.currentStage.trim();
  }
  if (executionResult?.run.currentStep?.trim()) {
    return executionResult.run.currentStep.trim();
  }
  return formatIntentLabel(plannerResult?.structuredIntent.intent);
}

export function buildCreativeHubTurnSummary(input: {
  checkpointId: string;
  goal: string;
  threadStatus: CreativeHubThread["status"];
  latestError: string | null;
  plannerResult: PlannerResult | null;
  executionResult: AgentRuntimeResult | null;
  interrupts: CreativeHubInterrupt[];
  productionStatus?: ProductionStatusResult | null;
}): CreativeHubTurnSummary | null {
  const executionResult = input.executionResult;
  const runId = executionResult?.run.id;
  if (!runId) {
    return null;
  }

  const turnStatus = toTurnStatus(input.threadStatus, input.latestError, executionResult);
  if (!shouldEmitTurnSummary(turnStatus, input.latestError, input.plannerResult, executionResult)) {
    return null;
  }
  const toolSummaries = extractToolSummaries(executionResult.steps);

  return {
    runId,
    checkpointId: input.checkpointId,
    status: turnStatus,
    currentStage: buildCurrentStage(turnStatus, input.plannerResult, executionResult, input.productionStatus),
    intentSummary: buildIntentSummary(input.goal, input.plannerResult),
    actionSummary: buildActionSummary(turnStatus, input.plannerResult, toolSummaries),
    impactSummary: buildImpactSummary(input.latestError, input.interrupts, input.productionStatus, toolSummaries),
    nextSuggestion: buildNextSuggestion(
      turnStatus,
      input.plannerResult,
      input.latestError,
      input.interrupts,
      input.productionStatus,
    ),
  };
}
