import { isArtifactSatisfied, latestArtifact } from "./plan";
import { canRecoverFailedGeneration } from "./control";
import type {VolumeChapterListProgress} from "@ai-novel/shared/types/volumePlanning";
import type {DirectorChapterBudgetView} from "@ai-novel/shared/types/director/chapterBudget";
import type {DirectorUnknownClaimsView} from "@ai-novel/shared/types/director/unknownClaims";
import type {DirectorWorkerStatus} from "@ai-novel/shared/types/director/worker";
import type {
  ArtifactType,
  ActionRejection,
  ChapterRange,
  Driver,
  FactsSnapshot,
  PauseKind,
  PlanDefinition,
  RunContract,
  RunControl,
  RunStatus,
} from "./types";

export interface ArtifactTypeInfo {
  label: string;
  /** Composition may register a :novelId template; the application resolves it before project(). */
  reviewRoute: string;
}

export interface ActionDescriptor {
  id: string;
  label: string;
  kind: "command" | "navigate";
  primary: boolean;
  command?: "resume" | "cancel" | "open_run" | "handoff" | "retry_start";
  toDriver?: Driver;
  target?: string;
}

export interface DashboardView {
  chapterListProgress?: VolumeChapterListProgress;
  workerStatus?: DirectorWorkerStatus;
  runId: string;
  novelId: string;
  mode: RunStatus;
  driver: Driver;
  headline: string;
  detail: string | null;
  nextActionGuidance: string;
  chapterProgress: ChapterProgress | null;
  nextLaunchRange: ChapterRange | null;
  chapterBudget?: DirectorChapterBudgetView;
  unknownClaims?: DirectorUnknownClaimsView;
  workspaceActivity: WorkspaceActivity;
  progress: { done: number; total: number; source: "artifact_ledger" };
  debts: { count: number; chapterOrders: number[] };
  availableActions: ActionDescriptor[];
  sourceRoute: string;
  sourceTrace: {
    controlStatus: RunStatus;
    controlVersion: number;
    pauseKind: PauseKind | null;
    planVersion: string;
  };
}

/** Presentation-only identity and invalidation signal; never authorizes a workflow command. */
export interface WorkspaceActivity {
  novelId: string;
  runId: string;
  revision: string;
  focus: {key: string; artifactType: string; label: string; volumeId?: string; chapterOrder?: number} | null;
}

function projectWorkspaceActivity({contract, control, plan, facts}: ProjectionInput): WorkspaceActivity {
  const step = control.status === "running"
    ? plan.steps.find(row => row.id === control.cursorStepId)
    : control.status === "waiting_gate"
      ? plan.steps.find(row => row.produces === control.gate?.artifactTypes[0]) : undefined;
  return {
    novelId: contract.novelId,
    runId: contract.runId,
    // Control boundaries also invalidate review contexts. Artifact versions catch saves before the boundary.
    revision: JSON.stringify([contract.runId, control.version,
      facts.artifacts.map(row => JSON.stringify([row.type, row.scope, row.version, row.status])).sort()]),
    focus: step ? {key: `${contract.runId}:${control.version}:${step.id}`, artifactType: step.produces, label: step.label,
      ...(contract.launchInput?.targetVolumeId ? {volumeId: contract.launchInput.targetVolumeId} : {}),
      ...(contract.chapterRange ? {chapterOrder: contract.chapterRange.from} : {})} : null,
  };
}

/** Read-only saved production facts. Chapter identity is resolved by the business adapter. */
export interface ChapterProgress extends ChapterRange {
  done: number;
  total: number;
  current: {order: number; title: string; phase: "generating_chapters" | "reviewing" | "repairing" | "finalizing"} | null;
}

export interface ProductionProjection {
  chapterProgress: ChapterProgress | null;
  nextLaunchRange: ChapterRange | null;
  chapterBudget?: DirectorChapterBudgetView;
  unknownClaims?: DirectorUnknownClaimsView;
}

export interface ProjectionInput {
  chapterListProgress?: VolumeChapterListProgress;
  executionFailure?: string;
  actionRejection?: ActionRejection;
  contract: RunContract;
  control: RunControl;
  plan: PlanDefinition;
  facts: FactsSnapshot;
  artifactTypes: Readonly<Record<ArtifactType, ArtifactTypeInfo>>;
  sourceRoute: string;
  production?: ProductionProjection;
}

const CANCEL_ACTION: ActionDescriptor = {
  id: "cancel",
  label: "Cancelar esta creación",
  kind: "command",
  primary: false,
  command: "cancel",
};

export function project(input: ProjectionInput): DashboardView {
  const { contract, control, plan, facts, artifactTypes, sourceRoute } = input;

  const inScope = plan.steps.filter(
    (step) => !contract.stepIdsInScope || contract.stepIdsInScope.includes(step.id),
  );
  const done = inScope.filter((step) => isArtifactSatisfied(facts, step.produces, contract.scope, false)).length;
  const chapterOrders = [...new Set(facts.debts.map((debt) => debt.chapterOrder))].sort(
    (left, right) => left - right,
  );

  const infoOf = (type: ArtifactType): ArtifactTypeInfo =>
    artifactTypes[type] ?? { label: type, reviewRoute: sourceRoute };

  let headline: string;
  let detail: string | null = null;
  let availableActions: ActionDescriptor[];
  let nextActionGuidance = "Espere a que avance la IA; Después de guardar los resultados de la etapa, se le pedirá que los vea y confirme.";
  const chapterProgress = input.production?.chapterProgress ?? null;
  const nextLaunchRange = input.production?.nextLaunchRange ?? null;

  switch (control.status) {
    case "queued":
      headline = "Esperando para empezar a crear";
      availableActions = [CANCEL_ACTION];
      break;
    case "running": {
      const cursor = plan.steps.find((step) => step.id === control.cursorStepId);
      headline = cursor ? `Generando "${cursor.label}»` : "Creación en curso";
      if (control.cursorStepId === "chapter_batch" && chapterProgress) {
        const current = chapterProgress.current;
        const verbs = {generating_chapters:"escribiendo", reviewing:"examinar", repairing:"Completo", finalizing:"Guardar"};
        headline = current
          ? `son${verbs[current.phase]}Cap. ${current.order}${current.title ? `«${current.title}»` : ""}`
          : `Preparando o terminando el capítulo ${chapterProgress.from}—${chapterProgress.to}`;
        nextActionGuidance = "Espere hasta que se complete la escritura, verificación y guardado de este lote; Se le solicitará aquí cuando necesite confirmar o solucionar problemas.";
      }
      availableActions = [CANCEL_ACTION];
      break;
    }
    case "waiting_gate": {
      const types = control.gate?.artifactTypes ?? [];
      headline = `Por favor confirme "${types.map((type) => infoOf(type).label).join(",")}Continuar después`;
      nextActionGuidance = types.includes("chapter_batch_closed")
        ? "Abra el texto de este lote, seleccione un capítulo para leer o discutir con AI, verifique los párrafos adoptados y luego confirme este lote."
        : "Abra los resultados de esta etapa, verifíquelos y haga clic en \"Confirmar resultados y continuar\". AI seguirá ampliando el alcance de esta autorización.";
      if (types.some(type => {
        const artifact = latestArtifact(facts, type, contract.scope);
        return artifact?.status === "stale" && artifact.protectedUserContent;
      })) {
        nextActionGuidance = "Esta etapa contiene modificaciones que deben conservarse; verifique los resultados guardados y confirme; La IA seguirá utilizando estos contenidos.";
      }
      availableActions = [
        ...types.map(
          (type, index): ActionDescriptor => ({
            id: `review:${type}`,
            label: `Ir a confirmar "${infoOf(type).label}»`,
            kind: "navigate",
            primary: index === 0,
            target: infoOf(type).reviewRoute,
          }),
        ),
        CANCEL_ACTION,
      ];
      break;
    }
    case "paused": {
      const pauseKind = control.pause?.kind ?? "manual_recovery";
      detail = control.pause?.reason ?? null;
      const retryEmptyDraft = detail === "generation_output_unusable";
      if (detail === "execution_retry_budget_exhausted") {
        detail = input.executionFailure?.trim()
          ? `La generación fracasó en esta etapa:${input.executionFailure.trim()} Los reintentos automáticos han finalizado.`
          : "En esta etapa se genera una interrupción y el reintento automático ha finalizado.";
      }
      if (detail === "generation_output_unusable") detail = "No se generó ningún texto utilizable para este capítulo. Vuelva a intentar el paso de escritura actual. Se conservarán los preparativos preliminares y los capítulos completados.";
      if (detail === "rejection_budget_exhausted" || detail === "protected_content") {
        const rejection = input.actionRejection;
        const step = plan.steps.find(row => row.id === rejection?.stepId);
        const stage = step ? `«${step.label}»` : "etapa actual";
        const reasons: Record<string, string> = {
          protected_content: `${stage}Las modificaciones que deben conservarse no se pueden sobrescribir automáticamente. Verifique los resultados guardados de este libro antes de continuar.`,
          requires_unmet: `${stage}Faltan resultados previos guardados o confirmados. Por favor verifique las etapas de creación anteriores antes de continuar.`,
          step_out_of_scope: `${stage}Si excede el alcance de esta autorización, verifique el alcance de la creación y vuelva a enviarlo.`,
          unknown_step: "Este paso de creación es inconsistente con el plan guardado. Conserve los registros de ejecución para solucionar problemas.",
          budget_exceeded: "Esta creación ha alcanzado el límite de uso autorizado. Verifique el uso antes de continuar.",
        };
        detail = reasons[rejection?.code ?? (detail === "protected_content" ? "protected_content" : "")]
          ?? "Esta promoción no pasó la verificación de protección de creación. Verifique los motivos del rechazo en los resultados guardados y en los registros de ejecución antes de continuar.";
      }
      nextActionGuidance = "Primero verifique el motivo de la suspensión a continuación y luego haga clic en \"Continuar desde el progreso del guardado\" después del procesamiento; se mantendrá el texto existente.";
      if (pauseKind === "replan") {
        headline = "Necesita volver a planificar antes de continuar";
        nextActionGuidance = "Verifique el motivo de la suspensión a continuación y luego haga clic en \"Continuar después de volver a planificar\" para permitir que AI ajuste los planes posteriores.";
      } else if (pauseKind === "safety") {
        headline = "Riesgo detectado, pausado, esperando su procesamiento";
      } else {
        headline = retryEmptyDraft ? "La generación de este capítulo fracasó. Puede volver a intentar el paso actual." : "En pausa, esperando a que continúes después de guardar el progreso.";
      }
      if (retryEmptyDraft) nextActionGuidance = "Haga clic en \"Reintentar el paso de escritura actual\" y AI conservará los preparativos anteriores y los capítulos completados y continuará con esta creación.";
      availableActions = [
        {
          id: "resume",
          label: pauseKind === "replan" ? "Continuar después de volver a planificar" : retryEmptyDraft ? "Reintentar el paso de escritura actual" : "Continuar desde el progreso de guardado",
          kind: "command",
          primary: true,
          command: "resume",
        },
        CANCEL_ACTION,
      ];
      if (input.production?.unknownClaims && pauseKind === "manual_recovery") {
        headline = `Cap. ${input.production.unknownClaims.chapterOrder} Los resultados de un paso del capítulo aún no se han confirmado.`;
        nextActionGuidance = "Abra este capítulo desde el directorio de la izquierda y consulte el texto. Luego de confirmar que es correcto, vuelva a ejecutar los pasos que se confirmarán a continuación; se mantendrá el texto existente.";
        availableActions = [{id: "unknown_claims", label: "Ver pasos por confirmar", kind: "navigate", primary: true,
          target: `${sourceRoute}#director-unknown-claims`}, CANCEL_ACTION];
      }
      if (input.production?.chapterBudget && pauseKind === "manual_recovery") {
        headline = `Cap. ${input.production.chapterBudget.chapterOrder} El capítulo requiere cuota adicional para continuar.`;
        nextActionGuidance = "Verifique el uso a continuación y elija si desea aumentar el presupuesto antes de continuar; puede ajustar solo este capítulo o aplicarlo también a los capítulos posteriores de esta tarea.";
        availableActions = [{id: "chapter_budget", label: "Ajustar el importe de este capítulo", kind: "navigate", primary: true,
          target: `${sourceRoute}#director-chapter-budget`}, CANCEL_ACTION];
      }
      break;
    }
    case "completed":
      headline = chapterProgress && chapterProgress.done === chapterProgress.total
        ? `Cap. ${chapterProgress.from}—${chapterProgress.to} Capítulo completado`
        : chapterProgress ? `Esta vez ${chapterProgress.from}—${chapterProgress.to} La creación del capítulo ha finalizado.` : "Esta planificación creativa se ha completado.";
      nextActionGuidance = nextLaunchRange
        ? `El siguiente paso puede ser escribir el ${nextLaunchRange.from}—${nextLaunchRange.to} capítulo. Verifique el alcance del capítulo a continuación y haga clic en enviar antes de que AI comience esta creación.`
        : input.production ? "Todos los capítulos de destino tienen textos guardados. Lea y consulte el libro completo en la tabla de contenido de la izquierda." : "Elija el siguiente alcance creativo del contenido de este libro.";
      availableActions = nextLaunchRange ? [{id:"open_run",label:`Selecciona y continúa escribiendo ${nextLaunchRange.from}—${nextLaunchRange.to}`,kind:"command",primary:true,command:"open_run"}] : [];
      break;
    case "failed":
      if (canRecoverFailedGeneration(control, facts.stopSignal)) {
        headline = "La generación de este capítulo fracasó. Puede volver a intentar el paso actual.";
        detail = control.failureReason;
        nextActionGuidance = "Haga clic en \"Reintentar el paso de escritura actual\" y AI conservará los preparativos anteriores y los capítulos completados y continuará con esta creación.";
        availableActions = [{id: "resume", label: "Reintentar el paso de escritura actual", kind: "command", primary: true, command: "resume"}];
        break;
      }
      headline = "La creación se interrumpe y se puede reanudar desde el contenido existente.";
      detail = control.failureReason;
      nextActionGuidance = "Consulte el motivo de la interrupción a continuación. Puede verificar el nuevo alcance de la autorización y enviarlo; el texto existente se conservará.";
      availableActions = [
        {
          id: "open_run",
          label: "Continuar creando a partir de contenido existente",
          kind: "command",
          primary: true,
          command: "open_run",
        },
      ];
      break;
    case "cancelled":
      headline = "Esta creación ha sido cancelada.";
      nextActionGuidance = "Se conservará el contenido existente. Cuando necesite continuar, verifique el rango de capítulos a continuación y envíe una nueva creación.";
      availableActions = [
        {
          id: "open_run",
          label: "Continuar creando a partir de contenido existente",
          kind: "command",
          primary: true,
          command: "open_run",
        },
      ];
      break;
    default: {
      const unreachable: never = control.status;
      throw new Error(`unsupported run status ${String(unreachable)}`);
    }
  }

  if (["queued", "running", "waiting_gate"].includes(control.status) && !control.cursorStepId && !facts.stopSignal) {
    const toDriver = contract.driver === "auto" ? "assisted" : "auto";
    availableActions.push({id: "handoff", kind: "command", primary: false, command: "handoff", toDriver,
      label: toDriver === "auto" ? "Cambiar a propulsión totalmente automática según la autonomía original" : "Cambiar a confirmación de etapa según el rango original"});
  }

  return {
    runId: contract.runId,
    novelId: contract.novelId,
    mode: control.status,
    driver: contract.driver,
    headline,
    detail,
    nextActionGuidance,
    chapterProgress,
    ...(input.chapterListProgress ? {chapterListProgress: input.chapterListProgress} : {}),
    nextLaunchRange,
    ...(control.status === "paused" && input.production?.chapterBudget ? {chapterBudget: input.production.chapterBudget} : {}),
    ...(control.status === "paused" && input.production?.unknownClaims ? {unknownClaims: input.production.unknownClaims} : {}),
    workspaceActivity: projectWorkspaceActivity(input),
    progress: { done, total: inScope.length, source: "artifact_ledger" },
    debts: { count: facts.debts.length, chapterOrders },
    availableActions,
    sourceRoute,
    sourceTrace: {
      controlStatus: control.status,
      controlVersion: control.version,
      pauseKind: control.pause?.kind ?? null,
      planVersion: contract.planVersion,
    },
  };
}

