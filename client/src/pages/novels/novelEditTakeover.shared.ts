import type { UnifiedTaskDetail } from "@ai-novel/shared/types/task";
import type { DirectorLockScope } from "@ai-novel/shared/types/novelDirector";
import type { NovelEditTakeoverState } from "./components/NovelEditView.types";

export function resolveAutoExecutionScopeLabel(task: UnifiedTaskDetail | null): string {
  const seedPayload = (task?.meta.seedPayload ?? null) as {
    autoExecution?: {
      scopeLabel?: string | null;
      totalChapterCount?: number | null;
    } | null;
  } | null;
  const scopeLabel = seedPayload?.autoExecution?.scopeLabel?.trim();
  if (scopeLabel) {
    return scopeLabel;
  }
  const fallbackCount = Math.max(1, Math.round(seedPayload?.autoExecution?.totalChapterCount ?? 10));
  return `No. 1-${fallbackCount}`;
}

export function formatTakeoverCheckpoint(
  checkpoint: string | null | undefined,
  task: UnifiedTaskDetail | null,
): string {
  if (checkpoint === "candidate_selection_required") {
    return "Esperando confirmación de la dirección del libro";
  }
  if (checkpoint === "book_contract_ready") {
    return "Contrato de reserva por confirmar";
  }
  if (checkpoint === "character_setup_required") {
    return "Preparación de personajes pendiente de revisión";
  }
  if (checkpoint === "volume_strategy_ready") {
    return "Estrategia de volumen/esqueleto de volumen pendiente de revisión";
  }
  if (checkpoint === "chapter_batch_ready") {
    return `${resolveAutoExecutionScopeLabel(task)}La ejecución automatizada está en pausa`;
  }
  if (checkpoint === "replan_required") {
    return "Pendiente de tramitación de sugerencias de replanificación";
  }
  if (checkpoint === "workflow_completed") {
    return "El proceso principal ha sido completado.";
  }
  return "Proceso de dirección en curso";
}

export function buildTakeoverTitle(input: {
  mode: NovelEditTakeoverState["mode"];
  novelTitle: string;
  checkpointType: string | null | undefined;
  scopeLabel: string;
}): string {
  if (
    input.mode === "running"
    && input.checkpointType === "chapter_batch_ready"
  ) {
    return `«${input.novelTitle}»Ejecutando automáticamente${input.scopeLabel}`;
  }
  if (input.mode === "waiting" || input.mode === "action_required") {
    if (input.checkpointType === "candidate_selection_required") {
      return `«${input.novelTitle}»Esperando confirmación de la dirección a nivel de libro.`;
    }
    if (input.checkpointType === "character_setup_required") {
      return `«${input.novelTitle}»En espera de preparación de roles de revisión`;
    }
    if (input.checkpointType === "volume_strategy_ready") {
      return `«${input.novelTitle}»Esperando revisión de estrategia de volumen/esqueleto de volumen`;
    }
    if (input.checkpointType === "workflow_completed") {
      return `«${input.novelTitle}»Esta ronda de director automático se ha completado.`;
    }
    if (input.checkpointType === "replan_required") {
      return `«${input.novelTitle}»Necesidad de lidiar con una planificación intensa`;
    }
  }
  if (input.mode === "failed") {
    if (input.checkpointType === "chapter_batch_ready") {
      return `«${input.novelTitle}»${input.scopeLabel}La ejecución automatizada está en pausa`;
    }
    return `«${input.novelTitle}»El director automático ha sido interrumpido.`;
  }
  if (input.mode === "loading") {
    return `«${input.novelTitle}»Sincronización automática del estado del director en progreso`;
  }
  return `«${input.novelTitle}»Dirigir automáticamente`;
}

export function buildTakeoverDescription(input: {
  mode: NovelEditTakeoverState["mode"];
  checkpointType: string | null | undefined;
  reviewScope: DirectorLockScope | null | undefined;
  scopeLabel: string;
}): string {
  if (
    input.mode === "running"
    && input.checkpointType === "chapter_batch_ready"
  ) {
    return `La IA se ejecuta automáticamente en segundo plano${input.scopeLabel}y continuaremos completando la revisión y reparación. Aún puedes continuar viendo y editando manualmente; Si modifica el capítulo actual al mismo tiempo, los resultados automáticos posteriores pueden sobrescribir esta parte del contenido.`;
  }
  if (input.mode === "waiting" || input.mode === "action_required") {
    if (input.checkpointType === "candidate_selection_required") {
      return "Se han generado candidatos a dirección a nivel de libro. Regrese a la página de confirmación de dirección a nivel de libro para seleccionar o modificar el plan antes de que el director automático pueda continuar avanzando en la cadena principal posterior.";
    }
    if (input.checkpointType === "character_setup_required") {
      return "Se ha generado la preparación del personaje. Primero puedes verificar los personajes principales, las relaciones y los objetivos actuales y confirmar antes de continuar con la dirección automática.";
    }
    if (input.checkpointType === "volume_strategy_ready") {
      return "Actualmente, la estrategia de volumen/esqueleto de volumen se puede revisar y ajustar. Después de la confirmación, continúe generando automáticamente recursos detallados para tableros de ritmo, capítulos divididos y lotes de capítulos seleccionados.";
    }
    if (input.checkpointType === "workflow_completed") {
      return `Se ha completado el director automático.${input.scopeLabel}Implementación, revisión y reparación del capítulo. Puede ir directamente a la ejecución del capítulo para continuar escribiendo, o puede finalizar y salir del modo director.`;
    }
    if (input.checkpointType === "replan_required") {
      return "La IA determina que es necesario ajustar la disposición del capítulo actual y los capítulos adyacentes. Después de continuar, se conservará el texto existente y primero se volverán a planificar los capítulos cercanos y luego se continuarán con los capítulos no generados.";
    }
    if (input.reviewScope) {
      return "AutoDirector ha llegado al punto de revisión. Primero verifique la etapa actual del producto antes de decidir si desea continuar.";
    }
  }
  if (input.mode === "failed") {
    if (input.checkpointType === "chapter_batch_ready") {
      return `${input.scopeLabel}La ejecución automatizada está en pausa. Primero puede ver los detalles de ejecución o el área de reparación de calidad antes de decidir si continúa con la ejecución automática.`;
    }
    return "El proceso del director de backend ha sido interrumpido. Puede verificar los detalles de la ejecución antes de decidir si desea continuar desde el último punto de progreso.";
  }
  if (input.mode === "loading") {
    return "Sincronización del estado actual del director automático.";
  }
  return "La IA se hace cargo del proceso de apertura del libro en segundo plano. Puede continuar operando manualmente el proyecto actual; si el mismo contenido se modifica al mismo tiempo que el director automático, prevalecerá el último resultado escrito.";
}

export function buildContinueAutoExecutionActionLabel(scopeLabel: string, isPending: boolean): string {
  return isPending ? "Continuar ejecutando..." : `Continuar la ejecución automática${scopeLabel}`;
}

export function buildReplanAndContinueActionLabel(isPending: boolean): string {
  return isPending ? "Replanificando..." : "Continuar después de volver a planificar";
}

export function buildContinueAutoExecutionToast(scopeLabel: string): string {
  return `Autodirector ha continuado su ejecución.${scopeLabel}, y se revisará y reparará automáticamente en segundo plano.`;
}
