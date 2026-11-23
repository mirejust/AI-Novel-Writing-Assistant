import type {
  AutoDirectorActionValidationInput,
  AutoDirectorAffectedScope,
  AutoDirectorFollowUpSection,
  AutoDirectorFollowUpSectionInput,
  AutoDirectorTakeoverValidationInput,
  AutoDirectorValidationResult,
  AutoDirectorValidationRequiredAction,
} from "@ai-novel/shared/types/autoDirectorValidation";
import {
  AUTO_DIRECTOR_TAKEOVER_ENTRY_ORDER,
} from "@ai-novel/shared/types/autoDirectorValidation";
import type {
  DirectorAutoExecutionPlan,
  DirectorTakeoverEntryStep,
} from "@ai-novel/shared/types/novelDirector";
import type { NovelWorkflowCheckpoint } from "@ai-novel/shared/types/novelWorkflow";

const WEB_SOURCES = new Set(["web", "follow_up_action", "batch_action", "takeover", "continue", "retry"]);
const CHANNEL_SOURCES = new Set(["dingtalk", "wecom", "feishu", "channel_callback"]);
const AUTO_DIRECTOR_FOLLOW_UP_SECTION_RANK: Record<AutoDirectorFollowUpSection, number> = {
  needs_validation: 0,
  exception: 1,
  pending: 2,
  auto_progress: 3,
  replaced: 4,
};

function requiredAction(input: AutoDirectorValidationRequiredAction): AutoDirectorValidationRequiredAction {
  return input;
}

function normalizeChapterOrder(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(1, Math.round(value))
    : null;
}

function resolveScopeFromPlan(plan: DirectorAutoExecutionPlan | null | undefined): AutoDirectorAffectedScope {
  if (!plan) {
    return {
      type: "book",
      label: "libro completo",
    };
  }
  if (plan?.mode === "book") {
    return {
      type: "book",
      label: "libro completo",
    };
  }
  if (plan?.mode === "chapter_range") {
    const startOrder = normalizeChapterOrder(plan.startOrder) ?? 1;
    const endOrder = Math.max(startOrder, normalizeChapterOrder(plan.endOrder) ?? startOrder);
    return {
      type: "chapter_range",
      label: startOrder === endOrder ? `Cap. ${startOrder}` : `Cap. ${startOrder}-${endOrder}`,
      startOrder,
      endOrder,
    };
  }
  if (plan?.mode === "volume") {
    const volumeOrder = normalizeChapterOrder(plan.volumeOrder) ?? 1;
    return {
      type: "volume",
      label: `Cap. ${volumeOrder} rollo`,
      volumeOrder,
    };
  }
  const startOrder = normalizeChapterOrder(plan?.startOrder) ?? 1;
  const endOrder = Math.max(startOrder, normalizeChapterOrder(plan?.endOrder) ?? startOrder);
  return {
    type: "chapter_range",
    label: startOrder === endOrder ? `Cap. ${startOrder}` : `Cap. ${startOrder}-${endOrder}`,
    startOrder,
    endOrder,
  };
}

function resolveScopeFromTask(input: AutoDirectorActionValidationInput): AutoDirectorAffectedScope {
  const autoExecution = input.task.directorTaskData?.autoExecution;
  const startOrder = normalizeChapterOrder(autoExecution?.startOrder);
  const endOrder = normalizeChapterOrder(autoExecution?.endOrder);
  if (startOrder && endOrder) {
    return {
      type: "chapter_range",
      label: autoExecution?.scopeLabel?.trim() || (startOrder === endOrder ? `Cap. ${startOrder}` : `Cap. ${startOrder}-${endOrder}`),
      startOrder,
      endOrder: Math.max(startOrder, endOrder),
    };
  }
  const volumeOrder = normalizeChapterOrder(autoExecution?.volumeOrder);
  if (volumeOrder) {
    return {
      type: "volume",
      label: autoExecution?.scopeLabel?.trim() || `Cap. ${volumeOrder} rollo`,
      volumeOrder,
    };
  }
  return {
    type: "book",
    label: autoExecution?.scopeLabel?.trim() || "libro completo",
  };
}

function buildResult(input: {
  allowed: boolean;
  affectedScope: AutoDirectorAffectedScope;
  blockingReasons?: string[];
  warnings?: string[];
  requiredActions?: AutoDirectorValidationRequiredAction[];
  nextCheckpoint?: NovelWorkflowCheckpoint | null;
  nextAction?: string | null;
}): AutoDirectorValidationResult {
  return {
    allowed: input.allowed,
    blockingReasons: input.blockingReasons ?? [],
    warnings: input.warnings ?? [],
    requiredActions: input.requiredActions ?? [],
    affectedScope: input.affectedScope,
    nextCheckpoint: input.nextCheckpoint ?? null,
    nextAction: input.nextAction ?? (input.allowed ? "continue" : "blocked"),
  };
}

function isEntryAtOrAfter(entryStep: DirectorTakeoverEntryStep, minimum: DirectorTakeoverEntryStep): boolean {
  return AUTO_DIRECTOR_TAKEOVER_ENTRY_ORDER[entryStep] >= AUTO_DIRECTOR_TAKEOVER_ENTRY_ORDER[minimum];
}

function isChapterRangeScope(
  scope: AutoDirectorAffectedScope,
): scope is Extract<AutoDirectorAffectedScope, { type: "chapter_range" }> {
  return scope.type === "chapter_range";
}

function isVolumeScope(
  scope: AutoDirectorAffectedScope,
): scope is Extract<AutoDirectorAffectedScope, { type: "volume" }> {
  return scope.type === "volume";
}

function shouldAllowStructuredBackfill(input: {
  entryStep: DirectorTakeoverEntryStep;
  request: AutoDirectorTakeoverValidationInput["request"];
  assets: AutoDirectorTakeoverValidationInput["assets"];
}): boolean {
  return input.request.strategy === "continue_existing"
    && isEntryAtOrAfter(input.entryStep, "chapter")
    && Boolean(input.assets.hasVolumeStrategyPlan);
}

function resolveStructuredOutlineMissingOrders(input: {
  affectedScope: AutoDirectorAffectedScope;
  volumeChapterRanges: Array<{ volumeOrder: number; startOrder: number; endOrder: number }>;
  structuredOutlineChapterOrders: Set<number>;
}): number[] {
  if (input.structuredOutlineChapterOrders.size === 0) {
    return [];
  }
  const missingOrders: number[] = [];
  if (isChapterRangeScope(input.affectedScope)) {
    for (let order = input.affectedScope.startOrder; order <= input.affectedScope.endOrder; order += 1) {
      if (!input.structuredOutlineChapterOrders.has(order)) {
        missingOrders.push(order);
      }
    }
  }
  if (isVolumeScope(input.affectedScope)) {
    const volumeOrder = input.affectedScope.volumeOrder;
    const range = input.volumeChapterRanges.find((item) => item.volumeOrder === volumeOrder);
    if (range) {
      for (let order = range.startOrder; order <= range.endOrder; order += 1) {
        if (!input.structuredOutlineChapterOrders.has(order)) {
          missingOrders.push(order);
        }
      }
    }
  }
  return missingOrders;
}

function resolveStructuredBackfillNeed(input: {
  affectedScope: AutoDirectorAffectedScope;
  assets: AutoDirectorTakeoverValidationInput["assets"];
  entryStep: DirectorTakeoverEntryStep;
}): {
  needed: boolean;
  missingOrders: number[];
} {
  if (!isEntryAtOrAfter(input.entryStep, "chapter")) {
    return { needed: false, missingOrders: [] };
  }
  if (!input.assets.hasVolumeStrategyPlan) {
    return { needed: false, missingOrders: [] };
  }
  const volumeChapterRanges = Array.isArray(input.assets.volumeChapterRanges)
    ? input.assets.volumeChapterRanges
      .map((range) => ({
        volumeOrder: normalizeChapterOrder(range.volumeOrder),
        startOrder: normalizeChapterOrder(range.startOrder),
        endOrder: normalizeChapterOrder(range.endOrder),
      }))
      .filter((range): range is { volumeOrder: number; startOrder: number; endOrder: number } => Boolean(range.volumeOrder && range.startOrder && range.endOrder))
    : [];
  const structuredOutlineChapterOrders = new Set(
    (input.assets.structuredOutlineChapterOrders ?? [])
      .map((order) => normalizeChapterOrder(order))
      .filter((order): order is number => Boolean(order)),
  );
  const missingOrders = resolveStructuredOutlineMissingOrders({
    affectedScope: input.affectedScope,
    volumeChapterRanges,
    structuredOutlineChapterOrders,
  });
  return {
    needed: !input.assets.hasStructuredOutline || missingOrders.length > 0,
    missingOrders,
  };
}

function resolvePlannedChapterCount(input: {
  assets: AutoDirectorTakeoverValidationInput["assets"];
  volumeChapterRanges: Array<{ volumeOrder: number; startOrder: number; endOrder: number }>;
  structuredOutlineChapterOrders: Set<number>;
}): number | null {
  const candidates = [
    normalizeChapterOrder(input.assets.plannedChapterCount ?? null),
    ...input.volumeChapterRanges.map((range) => normalizeChapterOrder(range.endOrder)),
    ...Array.from(input.structuredOutlineChapterOrders).map((order) => normalizeChapterOrder(order)),
    normalizeChapterOrder(input.assets.totalChapterCount ?? null),
  ].filter((count): count is number => Boolean(count));
  return candidates.length > 0 ? Math.max(...candidates) : null;
}

function validateScopeAgainstAssets(input: {
  affectedScope: AutoDirectorAffectedScope;
  assets: AutoDirectorTakeoverValidationInput["assets"];
  entryStep: DirectorTakeoverEntryStep;
  allowStructuredBackfill?: boolean;
  allowRollingPlanExpansion?: boolean;
}): string[] {
  const reasons: string[] = [];
  const volumeChapterRanges = Array.isArray(input.assets.volumeChapterRanges)
    ? input.assets.volumeChapterRanges
      .map((range) => ({
        volumeOrder: normalizeChapterOrder(range.volumeOrder),
        startOrder: normalizeChapterOrder(range.startOrder),
        endOrder: normalizeChapterOrder(range.endOrder),
      }))
      .filter((range): range is { volumeOrder: number; startOrder: number; endOrder: number } => Boolean(range.volumeOrder && range.startOrder && range.endOrder))
    : [];
  const structuredOutlineChapterOrders = new Set(
    (input.assets.structuredOutlineChapterOrders ?? [])
      .map((order) => normalizeChapterOrder(order))
      .filter((order): order is number => Boolean(order)),
  );
  const plannedChapterCount = resolvePlannedChapterCount({
    assets: input.assets,
    volumeChapterRanges,
    structuredOutlineChapterOrders,
  });
  const affectedScope = input.affectedScope;
  if (isChapterRangeScope(affectedScope) && plannedChapterCount && affectedScope.endOrder > plannedChapterCount) {
    reasons.push(`El rango de capítulos objetivo excede el número planificado actual de capítulos en el libro; ajuste el rango para ${plannedChapterCount} Dentro del Capítulo.`);
  }
  if (isVolumeScope(affectedScope)) {
    const volumeCount = normalizeChapterOrder(input.assets.volumeCount) ?? 0;
    if (volumeCount > 0 && affectedScope.volumeOrder > volumeCount) {
      reasons.push(`La estrategia de volumen actual sólo tiene ${volumeCount} volumen, no puede ejecutar directamente el ${affectedScope.volumeOrder} rollo.`);
    }
  }
  if (isChapterRangeScope(affectedScope) && !isEntryAtOrAfter(input.entryStep, "structured")) {
    reasons.push("El alcance del capítulo solo puede comenzar con divisiones de ritmo, ejecución del capítulo o correcciones de calidad.");
  }
  if (isVolumeScope(affectedScope) && !isEntryAtOrAfter(input.entryStep, "outline")) {
    reasons.push("El alcance del volumen solo puede comenzar con una estrategia de volumen, divisiones de ritmo, ejecución de capítulos o correcciones de calidad.");
  }
  if (isEntryAtOrAfter(input.entryStep, "structured") && !input.assets.hasVolumeStrategyPlan) {
    reasons.push("El rango objetivo carece de soporte para la estrategia de volumen y la estrategia de volumen debe completarse primero.");
  }
  if (isChapterRangeScope(affectedScope) && volumeChapterRanges.length > 0) {
    const isCoveredByVolumeStrategy = volumeChapterRanges.some((range) => (
      range.startOrder <= affectedScope.startOrder && range.endOrder >= affectedScope.endOrder
    ));
    if (!isCoveredByVolumeStrategy && !input.allowRollingPlanExpansion) {
      reasons.push("El rango de capítulos objetivo no está completamente cubierto por la estrategia de volumen actual. Primero ajuste la estrategia de volumen o reduzca el rango objetivo.");
    }
  }
  if (isEntryAtOrAfter(input.entryStep, "chapter") && !input.assets.hasStructuredOutline && !input.allowStructuredBackfill) {
    reasons.push("El rango objetivo carece de división de capítulos de ritmo y los resultados de la división de capítulos deben completarse o volverse a verificar primero.");
  }
  if (isEntryAtOrAfter(input.entryStep, "chapter") && structuredOutlineChapterOrders.size > 0) {
    const missingOrders = resolveStructuredOutlineMissingOrders({
      affectedScope,
      volumeChapterRanges,
      structuredOutlineChapterOrders,
    });
    if (missingOrders.length > 0 && !input.allowStructuredBackfill) {
      reasons.push(`El rango objetivo carece de detalles del capítulo de ritmo: Capítulo ${missingOrders.slice(0, 5).join(",")} El capítulo debe completarse o volverse a revisar primero.`);
    }
  }
  return reasons;
}

export function validateAutoDirectorTakeoverRequest(
  input: AutoDirectorTakeoverValidationInput,
): AutoDirectorValidationResult {
  const entryStep = input.request.entryStep ?? "basic";
  const affectedScope = resolveScopeFromPlan(input.request.autoExecutionPlan);
  const blockingReasons: string[] = [];
  const allowStructuredBackfill = shouldAllowStructuredBackfill({
    entryStep,
    request: input.request,
    assets: input.assets,
  });
  const structuredBackfillNeed = resolveStructuredBackfillNeed({
    affectedScope,
    assets: input.assets,
    entryStep,
  });
  const onlyStructuredBackfillBlocked = blockingReasons.length > 0
    && structuredBackfillNeed.needed
    && blockingReasons.every((reason) => reason.includes("Capítulo para romper el ritmo"));
  const canBackfillStructuredOutline = onlyStructuredBackfillBlocked
    && input.request.strategy === "continue_existing"
    && Boolean(input.assets.hasVolumeStrategyPlan);

  if (entryStep === "story_macro" && !input.assets.hasProjectSetup) {
    blockingReasons.push("La ambientación del proyecto está incompleta y no puede partir directamente de la macroplanificación de la historia.");
  }
  if (isEntryAtOrAfter(entryStep, "character") && !input.assets.hasStoryMacroPlan) {
    blockingReasons.push("La macroplanificación de la historia aún no se ha completado y no podemos entrar directamente en la preparación de los personajes.");
  }
  if (isEntryAtOrAfter(entryStep, "character") && !input.assets.hasBookContract) {
    blockingReasons.push("El Contrato del Libro aún no se ha completado y no puede ingresar directamente a la preparación del personaje o a los nodos posteriores.");
  }
  if (isEntryAtOrAfter(entryStep, "outline") && (!input.assets.hasStoryMacroPlan || !input.assets.hasBookContract || (input.assets.characterCount ?? 0) <= 0)) {
    blockingReasons.push("El plan macro de la historia, el contrato del libro o la preparación del personaje aún no están completos y no pueden pasar directamente a la estrategia del volumen.");
  }
  blockingReasons.push(...validateScopeAgainstAssets({
    affectedScope,
    assets: input.assets,
    entryStep,
    allowStructuredBackfill,
    allowRollingPlanExpansion: input.request.runMode === "full_book_autopilot"
      && (input.request.strategy ?? "continue_existing") === "continue_existing",
  }));

  return buildResult({
    allowed: blockingReasons.length === 0,
    blockingReasons,
    affectedScope,
    warnings: input.request.strategy === "restart_current_step"
      ? ["La regeneración afectará al nodo de destino y a los activos posteriores, y es necesario conservar una instantánea recuperable antes de la ejecución."]
      : [],
    requiredActions: onlyStructuredBackfillBlocked && Boolean(input.assets.hasVolumeStrategyPlan)
      ? [
          requiredAction({
            code: "auto_backfill_structured_outline",
            label: "Deje que AI complete las divisiones de capítulo antes de continuar.",
            riskLevel: "low",
            safeToAutoFix: true,
          }),
        ]
      : input.request.strategy === "restart_current_step"
        ? [
          requiredAction({
            code: "create_rewrite_snapshot",
            label: "Crear una instantánea previa a la reescritura",
            riskLevel: "high",
            safeToAutoFix: false,
          }),
          requiredAction({
            code: "reset_downstream_state",
            label: "El estado después de restablecer el nodo de destino",
            riskLevel: "medium",
            safeToAutoFix: false,
          }),
        ]
        : [],
    nextCheckpoint: "chapter_batch_ready",
    nextAction: blockingReasons.length > 0
      ? canBackfillStructuredOutline
        ? "auto_backfill_structured_outline"
        : "blocked"
      : allowStructuredBackfill && structuredBackfillNeed.needed
        ? "auto_backfill_structured_outline"
      : entryStep === "chapter" || entryStep === "pipeline"
        ? "continue_auto_execution"
        : "continue_structured_outline",
  });
}

export function validateAutoDirectorAction(input: AutoDirectorActionValidationInput): AutoDirectorValidationResult {
  const affectedScope = resolveScopeFromTask(input);
  const blockingReasons: string[] = [];

  if (input.task.lane && input.task.lane !== "auto_director") {
    blockingReasons.push("La tarea actual no es una tarea de director automática y no se pueden utilizar acciones de director automático.");
  }
  if (input.task.pendingManualRecovery && input.actionCode !== "continue_generic") {
    blockingReasons.push("La tarea está en estado de recuperación manual. Restaure la tarea antes de continuar con otras operaciones.");
  }
  if (CHANNEL_SOURCES.has(input.source) && input.actionCode !== "continue_auto_execution" && input.actionCode !== "retry_with_task_model") {
    blockingReasons.push("El terminal de mensajes solo admite acciones de bajo riesgo. Por favor regrese al sitio para confirmar antes de continuar.");
  }
  if (CHANNEL_SOURCES.has(input.source) && input.actionCode === "retry_with_route_model") {
    blockingReasons.push("Reintentar según el modelo de enrutamiento requiere confirmación en el sitio. Abra el centro de seguimiento para su procesamiento.");
  }
  if (input.actionCode === "continue_auto_execution" && input.task.status !== "waiting_approval") {
    blockingReasons.push("La tarea actual ya no está esperando para continuar. Primero vuelva a verificar el estado de la tarea.");
  }
  if (input.actionCode === "continue_auto_execution" && input.task.checkpointType !== "chapter_batch_ready") {
    blockingReasons.push("La ejecución del capítulo no se puede continuar directamente en el punto de control actual; verifique primero los detalles de la tarea.");
  }
  if ((input.actionCode === "retry_with_task_model" || input.actionCode === "retry_with_route_model") && input.task.status !== "failed" && input.task.status !== "cancelled") {
    blockingReasons.push("La tarea actual no ha fallado ni se ha cancelado y no es necesario volver a intentarla.");
  }

  return buildResult({
    allowed: blockingReasons.length === 0,
    blockingReasons,
    affectedScope,
    warnings: input.actionCode === "retry_with_route_model"
      ? ["Al volver a intentarlo por modelo de enrutamiento, se utilizará el modelo de enrutamiento actual y los resultados pueden ser diferentes del modelo original de la tarea."]
      : [],
    requiredActions: input.actionCode === "continue_auto_execution"
      ? [
          requiredAction({
            code: "clear_checkpoint",
            label: "Borrar puntos de control procesados",
            riskLevel: "low",
            safeToAutoFix: true,
          }),
        ]
      : input.actionCode === "retry_with_task_model" || input.actionCode === "retry_with_route_model"
        ? [
            requiredAction({
              code: "clear_failure",
              label: "Borrar el estado de error y volver a ejecutar",
              riskLevel: "low",
              safeToAutoFix: true,
            }),
          ]
        : [],
    nextAction: blockingReasons.length > 0
      ? (WEB_SOURCES.has(input.source) ? "revalidate" : "open_follow_up_center")
      : input.actionCode,
  });
}

export function resolveAutoDirectorFollowUpSection(input: AutoDirectorFollowUpSectionInput): AutoDirectorFollowUpSection {
  if (input.validationResult && !input.validationResult.allowed) {
    return "needs_validation";
  }
  if (input.status === "cancelled" && input.replacementTaskId?.trim()) {
    return "replaced";
  }
  if (input.pendingManualRecovery || input.status === "failed" || input.status === "cancelled") {
    return "exception";
  }
  if (input.status === "waiting_approval") {
    return "pending";
  }
  if (input.status === "queued" || input.status === "running") {
    return "auto_progress";
  }
  if (input.replacementTaskId?.trim()) {
    return "replaced";
  }
  return "pending";
}

export function compareAutoDirectorFollowUpSections(
  left: AutoDirectorFollowUpSection,
  right: AutoDirectorFollowUpSection,
): number {
  return AUTO_DIRECTOR_FOLLOW_UP_SECTION_RANK[left] - AUTO_DIRECTOR_FOLLOW_UP_SECTION_RANK[right];
}

export class AutoDirectorValidationService {
  validateTakeoverRequest(input: AutoDirectorTakeoverValidationInput): AutoDirectorValidationResult {
    return validateAutoDirectorTakeoverRequest(input);
  }

  validateAction(input: AutoDirectorActionValidationInput): AutoDirectorValidationResult {
    return validateAutoDirectorAction(input);
  }

  resolveFollowUpSection(input: AutoDirectorFollowUpSectionInput): AutoDirectorFollowUpSection {
    return resolveAutoDirectorFollowUpSection(input);
  }
}
