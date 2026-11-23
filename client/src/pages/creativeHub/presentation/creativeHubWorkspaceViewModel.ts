import type { FailureDiagnostic } from "@ai-novel/shared/types/agent";
import type {
  CreativeHubInterrupt,
  CreativeHubNovelSetupStatus,
  CreativeHubProductionStatus,
  CreativeHubThread,
  CreativeHubTurnSummary,
} from "@ai-novel/shared/types/creativeHub";
import type { WorkspaceTone } from "@/components/workspace";

export type CreativeHubWorkspaceAction =
  | "retry_threads"
  | "retry_state"
  | "retry_thread"
  | "retry_novels"
  | "retry_create_thread"
  | "review_interrupt"
  | "view_activity"
  | "send_prompt"
  | "select_novel"
  | "open_production";

export interface CreativeHubWorkspaceRecommendation {
  tone: WorkspaceTone;
  title: string;
  description: string;
  action: CreativeHubWorkspaceAction;
  actionLabel: string;
  prompt?: string;
}

export interface CreativeHubWorkspacePresentation {
  objectTitle: string;
  stageLabel: string;
  threadStatusLabel: string;
  recommendation: CreativeHubWorkspaceRecommendation;
}

export function formatCreativeHubThreadStatus(
  status: CreativeHubThread["status"] | undefined,
): string {
  if (status === "busy") return "Ejecutando";
  if (status === "interrupted") return "Esperando confirmación";
  if (status === "error") return "Operación anormal";
  if (status === "idle") return "Esperando instrucciones";
  return "Inicializando";
}

function formatSetupStage(stage: CreativeHubNovelSetupStatus["stage"] | undefined): string | null {
  if (stage === "setup_in_progress") return "Información completa sobre la apertura del libro.";
  if (stage === "ready_for_planning") return "preparar el plan de la historia";
  if (stage === "ready_for_production") return "Prepárese para la producción completa";
  return null;
}

function errorText(value: unknown, fallback: string): string | null {
  if (!value) return null;
  if (value instanceof Error && value.message.trim()) return value.message.trim();
  if (typeof value === "string" && value.trim()) return value.trim();
  return fallback;
}

export function resolveCreativeHubWorkspacePresentation(input: {
  thread?: CreativeHubThread | null;
  currentNovelTitle?: string | null;
  interrupt?: CreativeHubInterrupt | null;
  isRunning: boolean;
  diagnostics?: FailureDiagnostic | null;
  productionStatus?: CreativeHubProductionStatus | null;
  novelSetup?: CreativeHubNovelSetupStatus | null;
  latestTurnSummary?: CreativeHubTurnSummary | null;
  threadsError?: unknown;
  stateError?: unknown;
  threadLoadError?: unknown;
  novelsError?: unknown;
  createThreadError?: unknown;
}): CreativeHubWorkspacePresentation {
  const objectTitle = input.currentNovelTitle?.trim()
    || input.productionStatus?.title?.trim()
    || input.novelSetup?.title?.trim()
    || "Novela sin encuadernar";
  const stageLabel = input.latestTurnSummary?.currentStage?.trim()
    || input.productionStatus?.currentStage?.trim()
    || formatSetupStage(input.novelSetup?.stage)
    || "Esperando objetivo de creación";
  const threadStatusLabel = formatCreativeHubThreadStatus(input.thread?.status);

  const threadsError = errorText(input.threadsError, "No se pudo cargar el hilo de creación.");
  if (threadsError) {
    return {
      objectTitle,
      stageLabel,
      threadStatusLabel,
      recommendation: {
        tone: "danger",
        title: "Recargar el hilo de creación",
        description: `${threadsError} Las historias guardadas y el contenido de los hilos no se modificarán.`,
        action: "retry_threads",
        actionLabel: "Recargar hilo",
      },
    };
  }

  const createThreadError = errorText(input.createThreadError, "Error al crear el hilo de creación.");
  if (createThreadError) {
    return {
      objectTitle,
      stageLabel,
      threadStatusLabel,
      recommendation: {
        tone: "danger",
        title: "Recrear el hilo de creación.",
        description: `${createThreadError} No se modificarán las novelas ni los materiales creativos existentes.`,
        action: "retry_create_thread",
        actionLabel: "Vuelva a crear el hilo",
      },
    };
  }

  const stateError = errorText(input.stateError, "Error al cargar el estado del hilo.")
    || errorText(input.threadLoadError, "Error al cargar el contenido del hilo.");
  if (stateError) {
    return {
      objectTitle,
      stageLabel,
      threadStatusLabel,
      recommendation: {
        tone: "danger",
        title: "Recargar la escena de creación actual.",
        description: `${stateError} Para evitar confusiones, ya no se mostrará el contenido de los hilos antiguos.`,
        action: input.threadLoadError ? "retry_thread" : "retry_state",
        actionLabel: "Recargar el hilo actual",
      },
    };
  }

  const novelsError = errorText(input.novelsError, "La lista de novelas no se pudo cargar.");
  if (novelsError) {
    return {
      objectTitle,
      stageLabel,
      threadStatusLabel,
      recommendation: {
        tone: "danger",
        title: "Recargar lista de novelas",
        description: `${novelsError} El contenido del hilo actual aún se conservará.`,
        action: "retry_novels",
        actionLabel: "Recargar novela",
      },
    };
  }

  if (input.interrupt) {
    return {
      objectTitle,
      stageLabel,
      threadStatusLabel,
      recommendation: {
        tone: "warning",
        title: input.interrupt.title || "Manejar operaciones de creación pendientes",
        description: input.interrupt.summary || "Esta ronda de ejecución está esperando su confirmación antes de poder continuar con la acción actual.",
        action: "review_interrupt",
        actionLabel: "Ver elementos pendientes",
      },
    };
  }

  if (input.thread?.status === "interrupted" || input.latestTurnSummary?.status === "interrupted") {
    return {
      objectTitle,
      stageLabel,
      threadStatusLabel,
      recommendation: {
        tone: "warning",
        title: "Ver acciones de creación pendientes",
        description: input.latestTurnSummary?.nextSuggestion?.trim()
          || "El hilo actual todavía está esperando confirmación. Procese primero los elementos pendientes.",
        action: "view_activity",
        actionLabel: "Ver elementos pendientes",
      },
    };
  }

  if (input.isRunning || input.thread?.status === "busy") {
    return {
      objectTitle,
      stageLabel,
      threadStatusLabel,
      recommendation: {
        tone: "info",
        title: "La IA está avanzando en los objetivos creativos actuales",
        description: `Etapa actual:${stageLabel}. El sistema actualizará continuamente el estado y le pedirá que lo maneje cuando sea necesario.`,
        action: "view_activity",
        actionLabel: "Ver estado actual",
      },
    };
  }

  const failedTurn = input.latestTurnSummary?.status === "failed"
    ? input.latestTurnSummary
    : null;
  const failureSummary = input.diagnostics?.failureSummary?.trim()
    || input.productionStatus?.failureSummary?.trim()
    || input.thread?.latestError?.trim()
    || failedTurn?.impactSummary?.trim()
    || (input.thread?.status === "error" ? "El hilo de creación actual se encuentra en un estado anormal." : null);
  if (failureSummary) {
    const recoveryHint = input.diagnostics?.recoveryHint?.trim()
      || input.productionStatus?.recoveryHint?.trim()
      || failedTurn?.nextSuggestion?.trim()
      || "Analice los motivos de falla actuales y proporcione pasos de recuperación seguros";
    return {
      objectTitle,
      stageLabel,
      threadStatusLabel,
      recommendation: {
        tone: "danger",
        title: "Verifique la excepción de estado actual",
        description: `${failureSummary} Las operaciones de restauración continúan utilizando activos novedosos y registros de misión existentes.`,
        action: "send_prompt",
        actionLabel: "Verifique el motivo del fallo",
        prompt: `Explique el motivo del error, el registro de ejecución y la entrada de procesamiento formal:${recoveryHint}`,
      },
    };
  }

  if (input.novelSetup && input.novelSetup.stage !== "ready_for_production") {
    const prompt = input.novelSetup.recommendedAction?.trim()
      || input.novelSetup.nextQuestion?.trim();
    return {
      objectTitle,
      stageLabel,
      threadStatusLabel,
      recommendation: {
        tone: "warning",
        title: "Continúe para completar la información de apertura del libro.",
        description: input.novelSetup.nextQuestion?.trim()
          || "Primero complete la información clave que afecta la planificación posterior antes de ingresar a toda la producción.",
        action: prompt ? "send_prompt" : "open_production",
        actionLabel: prompt ? "Continuar con sugerencias de IA" : "Ver los preparativos para la apertura del libro.",
        ...(prompt ? { prompt } : {}),
      },
    };
  }

  const nextSuggestion = input.latestTurnSummary?.nextSuggestion?.trim();
  if (nextSuggestion) {
    return {
      objectTitle,
      stageLabel,
      threadStatusLabel,
      recommendation: {
        tone: "info",
        title: "Ver los resultados del diagnóstico actual",
        description: nextSuggestion,
        action: "send_prompt",
        actionLabel: "Ver sugerencias",
        prompt: `Explique el estado actual, el registro de ejecución y la entrada sugerida:${nextSuggestion}`,
      },
    };
  }

  if (objectTitle === "Novela sin encuadernar") {
    return {
      objectTitle,
      stageLabel,
      threadStatusLabel,
      recommendation: {
        tone: "info",
        title: "Elige la novela para avanzar en esta ronda.",
        description: "Sólo después de vincular la novela, la IA puede leer los capítulos, mundos, personajes y estados de producción correspondientes.",
        action: "select_novel",
        actionLabel: "Seleccionar novela",
      },
    };
  }

  return {
    objectTitle,
    stageLabel,
    threadStatusLabel,
    recommendation: {
      tone: "neutral",
      title: "Explicar los objetivos creativos a promover en esta ronda.",
      description: "Puede agregar preguntas de trabajo, ajustar requisitos o abrir toda la configuración de producción para continuar con una novela existente.",
      action: "open_production",
      actionLabel: "Ver entrada de producción",
    },
  };
}
