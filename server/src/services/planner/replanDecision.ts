import type {
  ChapterStateGoal,
  GenerationNextAction,
  CanonicalStateSnapshot,
  CanonicalPayoffState,
} from "@ai-novel/shared/types/canonicalState";
import type {
  AuditIssue,
  AuditReport,
  ReplanRecommendation,
} from "@ai-novel/shared/types/novel";
import type { PayoffLedgerSummary } from "@ai-novel/shared/types/payoffLedger";

type ReplanSignal =
  | "overdue_payoff"
  | "next_action_replan"
  | "blocking_audit"
  | "manual_request"
  | "stable";

type WindowMode = "forward" | "surrounding";
type ReplanAction = "continue_with_warning" | "local_patch_plan" | "stop_for_replan";
type ReplanScope = "local_window" | "global_book";

export interface ReplanDecisionInput {
  requestedWindowSize?: number | null;
  availableChapterOrders?: number[] | null;
  targetChapterOrder?: number | null;
  triggerType?: string | null;
  reason?: string | null;
  sourceIssueIds?: string[] | null;
  blockingIssueIds?: string[] | null;
  blockingLedgerKeys?: string[] | null;
  auditReports?: AuditReport[] | null;
  ledgerSummary?: PayoffLedgerSummary | null;
  snapshot?: CanonicalStateSnapshot | null;
  nextAction?: GenerationNextAction | null;
  chapterStateGoal?: ChapterStateGoal | null;
  protectedSecrets?: string[] | null;
  forceRecommended?: boolean;
  scope?: ReplanScope;
}

export interface ReplanDecision extends ReplanRecommendation {
  signal: ReplanSignal;
  triggerType: string;
  sourceIssueIds: string[];
  windowSize: number;
  blockingLedgerKeys: string[];
  affectedChapterOrders: number[];
  anchorChapterOrder: number | null;
  triggerReason: string;
  windowReason: string;
  whyTheseChapters: string;
  action: ReplanAction;
  scope: ReplanScope;
}

function uniqueStrings(items: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of items) {
    const normalized = String(item ?? "").trim();
    if (!normalized || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    result.push(normalized);
  }
  return result;
}

function uniqueNumbers(items: Array<number | null | undefined>): number[] {
  return Array.from(new Set(
    items
      .filter((item): item is number => Number.isInteger(item))
      .map((item) => Number(item)),
  )).sort((left, right) => left - right);
}

function clampWindowSize(value?: number | null): number {
  return Math.max(1, Math.min(value ?? 3, 5));
}

function collectBlockingIssues(auditReports?: AuditReport[] | null): AuditIssue[] {
  return (auditReports ?? [])
    .flatMap((report) => report.issues)
    .filter((issue) => issue.status === "open" && (issue.severity === "high" || issue.severity === "critical"));
}

function collectBlockingLedgerKeys(
  explicitKeys: string[] | null | undefined,
  snapshot?: CanonicalStateSnapshot | null,
): string[] {
  const fromSnapshot = snapshot?.narrative.overduePayoffs.map((item) => item.ledgerKey) ?? [];
  return uniqueStrings([...(explicitKeys ?? []), ...fromSnapshot]);
}

function pickFallbackAnchor(input: ReplanDecisionInput): number | null {
  return input.targetChapterOrder
    ?? input.chapterStateGoal?.chapterOrder
    ?? input.snapshot?.narrative.currentChapterOrder
    ?? input.availableChapterOrders?.[input.availableChapterOrders.length - 1]
    ?? null;
}

function pickPayoffAnchor(
  payoffs: CanonicalPayoffState[],
  fields: Array<keyof CanonicalPayoffState>,
  fallback: number | null,
): number | null {
  for (const field of fields) {
    const candidates = uniqueNumbers(payoffs.map((item) => {
      const value = item[field];
      return typeof value === "number" ? value : null;
    }));
    if (candidates.length > 0) {
      return candidates[0];
    }
  }
  return fallback;
}

function resolveAnchorChapterOrder(signal: ReplanSignal, input: ReplanDecisionInput): number | null {
  const fallbackAnchor = pickFallbackAnchor(input);
  if (signal === "overdue_payoff") {
    return pickPayoffAnchor(
      input.snapshot?.narrative.overduePayoffs ?? [],
      ["targetEndChapterOrder", "targetStartChapterOrder"],
      fallbackAnchor,
    );
  }
  return fallbackAnchor;
}

function pickSignal(input: ReplanDecisionInput, blockingIssues: AuditIssue[], blockingLedgerKeys: string[]): ReplanSignal {
  if (input.forceRecommended) {
    return "manual_request";
  }
  if (input.nextAction === "replan") {
    return "next_action_replan";
  }
  if (blockingIssues.length > 0) {
    return "blocking_audit";
  }
  const overdueCount = (input.ledgerSummary?.overdueCount ?? 0) + blockingLedgerKeys.length;
  if (overdueCount > 0) {
    return "overdue_payoff";
  }
  return "stable";
}

function resolveReplanAction(signal: ReplanSignal, input: ReplanDecisionInput, scope: ReplanScope): ReplanAction {
  if (scope === "global_book") {
    return "stop_for_replan";
  }
  if (input.forceRecommended || signal === "manual_request" || signal === "next_action_replan") {
    return "local_patch_plan";
  }
  if (signal === "blocking_audit") {
    return "local_patch_plan";
  }
  if (signal === "overdue_payoff") {
    return "continue_with_warning";
  }
  return "continue_with_warning";
}

function resolveWindowMode(signal: ReplanSignal): WindowMode {
  return signal === "blocking_audit" || signal === "manual_request" ? "forward" : "surrounding";
}

function resolveDefaultWindowSize(): number {
  return 3;
}

function nearestAnchorIndex(availableChapterOrders: number[], anchorChapterOrder: number): number {
  let bestIndex = 0;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (let index = 0; index < availableChapterOrders.length; index += 1) {
    const distance = Math.abs(availableChapterOrders[index] - anchorChapterOrder);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = index;
    }
  }
  return bestIndex;
}

function buildWindowOrders(
  anchorChapterOrder: number | null,
  availableChapterOrders: number[] | null | undefined,
  requestedWindowSize?: number | null,
  mode: WindowMode = "forward",
): number[] {
  const windowSize = clampWindowSize(requestedWindowSize);
  if (!anchorChapterOrder) {
    return [];
  }
  const normalizedOrders = uniqueNumbers(availableChapterOrders ?? []);
  if (normalizedOrders.length === 0) {
    const fallbackOrders = [anchorChapterOrder];
    if (mode === "surrounding") {
      let distance = 1;
      while (fallbackOrders.length < windowSize) {
        fallbackOrders.unshift(Math.max(1, anchorChapterOrder - distance));
        if (fallbackOrders.length >= windowSize) {
          break;
        }
        fallbackOrders.push(anchorChapterOrder + distance);
        distance += 1;
      }
      return uniqueNumbers(fallbackOrders).slice(0, windowSize);
    }
    for (let offset = 1; fallbackOrders.length < windowSize; offset += 1) {
      fallbackOrders.push(anchorChapterOrder + offset);
    }
    return fallbackOrders;
  }

  if (mode === "forward") {
    const fromAnchor = normalizedOrders.filter((order) => order >= anchorChapterOrder);
    if (fromAnchor.length >= windowSize) {
      return fromAnchor.slice(0, windowSize);
    }
    const beforeAnchor = normalizedOrders.filter((order) => order < anchorChapterOrder).reverse();
    const combined = [...fromAnchor];
    for (const order of beforeAnchor) {
      if (combined.length >= windowSize) {
        break;
      }
      combined.unshift(order);
    }
    return combined.slice(0, windowSize);
  }

  const anchorIndex = nearestAnchorIndex(normalizedOrders, anchorChapterOrder);
  const selected = [normalizedOrders[anchorIndex]];
  let left = anchorIndex - 1;
  let right = anchorIndex + 1;
  while (selected.length < windowSize && (left >= 0 || right < normalizedOrders.length)) {
    if (left >= 0) {
      selected.push(normalizedOrders[left]);
      left -= 1;
    }
    if (selected.length >= windowSize) {
      break;
    }
    if (right < normalizedOrders.length) {
      selected.push(normalizedOrders[right]);
      right += 1;
    }
  }
  return uniqueNumbers(selected).slice(0, windowSize);
}

function formatOrders(orders: number[]): string {
  return orders.map((order) => `Cap.${order}cap.`).join(",");
}

function buildTriggerReason(signal: ReplanSignal, input: ReplanDecisionInput, blockingIssues: AuditIssue[], blockingLedgerKeys: string[]): string {
  if (signal === "overdue_payoff") {
    const titles = uniqueStrings((input.snapshot?.narrative.overduePayoffs ?? []).map((item) => item.title)).slice(0, 2);
    return titles.length > 0
      ? `El estado canónico muestra que el pago ha expirado:${titles.join(";")}, continúe con el seguimiento como deuda de calidad a nivel de capítulo.`
      : `El estado canónico muestra que hay un pago vencido, al que se le dará seguimiento como una deuda de calidad a nivel de capítulo.`;
  }
  if (signal === "next_action_replan") {
    return `Las decisiones impulsadas por el estado se han recortado para replanificar, lo que indica un desajuste entre los objetivos del capítulo actual y la ventana de planificación existente.`;
  }
  if (signal === "blocking_audit") {
    const topIssues = blockingIssues.slice(0, 2).map((issue) => issue.description);
    return topIssues.length > 0
      ? `Cuestiones de auditoría de alta prioridad sin resolver:${topIssues.join(";")}.`
      : `Hay cuestiones de auditoría de alta prioridad sin resolver que requieren ajustes en el plan del capítulo primero.`;
  }
  if (signal === "manual_request") {
    return input.reason?.trim() || "El usuario solicita explícitamente que se reprograme la ventana actual.";
  }
  if (blockingLedgerKeys.length > 0) {
    return `Hay riesgos pendientes en el libro de presagios que requieren una recalibración de las responsabilidades del capítulo.`;
  }
  return "El estado actual es estable y no se recomienda ninguna nueva planificación por el momento.";
}

function buildWindowReason(signal: ReplanSignal, anchorChapterOrder: number | null, affectedChapterOrders: number[], protectedSecrets: string[]): string {
  const chapterLabel = anchorChapterOrder ? `Cap.${anchorChapterOrder}cap.` : "Capítulo actual";
  const secretHint = protectedSecrets.length > 0
    ? ` Al mismo tiempo, debemos mantener "${protectedSecrets.slice(0, 2).join(";")}"Este tipo de información no divulgada.`
    : "";
  if (signal === "overdue_payoff") {
    if (affectedChapterOrders.length === 0) {
      return `${chapterLabel}Sólo se utiliza para localizar compromisos vencidos; el sistema no seleccionará automáticamente una ventana de replanificación basándose únicamente en la distancia vencida o la referencia del capítulo actual.${secretHint}`.trim();
    }
    return `por${chapterLabel}Como punto de anclaje, las cubiertas de la ventana ${formatOrders(affectedChapterOrders)}, porque el pago atrasado a menudo requiere un vínculo continuo entre los preparativos, el cobro y las consecuencias del cobro.${secretHint}`.trim();
  }
  if (signal === "blocking_audit") {
    return `por${chapterLabel}desplegarse hacia atrás ${formatOrders(affectedChapterOrders)}Primero corrija el problema de bloqueo actual y luego evite que el plan anterior continúe contaminando los capítulos posteriores.${secretHint}`.trim();
  }
  if (signal === "next_action_replan") {
    return `por${chapterLabel}enlace para punto de anclaje ${formatOrders(affectedChapterOrders)}, permitiendo que los objetivos estatales actuales se realineen con las responsabilidades de los capítulos adyacentes.${secretHint}`.trim();
  }
  if (signal === "manual_request") {
    return `Presione esta vez ${formatOrders(affectedChapterOrders)} Realizar una replanificación manual, priorizando${chapterLabel}Cerca del final de capítulos consecutivos.${secretHint}`.trim();
  }
  return `Actualmente no hay ventanas que deban ajustarse.`;
}

function buildWhyTheseChapters(signal: ReplanSignal, affectedChapterOrders: number[], chapterStateGoal?: ChapterStateGoal | null): string {
  if (affectedChapterOrders.length === 0) {
    return "Actualmente no hay capítulos de replanificación seleccionados.";
  }
  const ordersLabel = formatOrders(affectedChapterOrders);
  const goalHint = chapterStateGoal?.summary?.trim()
    ? `, y alrededor "${chapterStateGoal.summary.trim()}”Reasignar responsabilidades del capítulo`
    : "";
  if (affectedChapterOrders.length === 1) {
    return `Ajustar solo${ordersLabel}, porque las preguntas actualmente se centran en un solo capítulo.${goalHint}.`;
  }
  if (signal === "overdue_payoff") {
    return `elegir${ordersLabel}, porque este grupo de capítulos necesita recuperar terreno continuamente, honrar los pagos atrasados ​​y emprender nuevos cambios en la junta directiva.${goalHint}.`;
  }
  if (signal === "blocking_audit") {
    return `elegir${ordersLabel}, porque cuestiones de alta prioridad han entrado en el capítulo actual y afectarán directamente el avance posterior inmediato.${goalHint}.`;
  }
  if (signal === "next_action_replan") {
    return `elegir${ordersLabel}Debido a que el estado canónico ha determinado que la ventana existente no coincide, es necesario cerrarla desde el punto de anclaje hacia el frente y hacia atrás.${goalHint}.`;
  }
  return `elegir${ordersLabel}, porque estos capítulos están directamente adyacentes al objetivo estatal actual y tienen el costo de ajuste más bajo${goalHint}.`;
}

export function buildReplanDecision(input: ReplanDecisionInput): ReplanDecision {
  const blockingIssues = collectBlockingIssues(input.auditReports);
  const blockingIssueIds = uniqueStrings([
    ...(input.blockingIssueIds ?? []),
    ...blockingIssues.map((issue) => issue.id),
  ]);
  const blockingLedgerKeys = collectBlockingLedgerKeys(input.blockingLedgerKeys, input.snapshot);
  const signal = pickSignal(input, blockingIssues, blockingLedgerKeys);
  const scope = input.scope === "global_book" ? "global_book" : "local_window";
  const action = resolveReplanAction(signal, input, scope);
  const recommended = action !== "continue_with_warning"
    && (
      input.forceRecommended
      || signal === "overdue_payoff"
      || signal === "next_action_replan"
      || signal === "blocking_audit"
    );
  const anchorChapterOrder = resolveAnchorChapterOrder(signal, input);
  const requestedWindowSize = input.requestedWindowSize ?? resolveDefaultWindowSize();
  const affectedChapterOrders = recommended
    ? buildWindowOrders(
      anchorChapterOrder,
      input.availableChapterOrders,
      requestedWindowSize,
      resolveWindowMode(signal),
    )
    : [];
  const triggerReason = buildTriggerReason(signal, input, blockingIssues, blockingLedgerKeys);
  const windowReason = buildWindowReason(
    signal,
    anchorChapterOrder,
    affectedChapterOrders,
    uniqueStrings(input.protectedSecrets ?? []),
  );
  return {
    recommended,
    reason: recommended
      ? triggerReason
      : signal === "overdue_payoff"
        ? "Los compromisos vencidos se han registrado como deudas de calidad a nivel de capítulo y continuarán implementándose en capítulos posteriores."
        : "Actualmente no hay señales de estado de bloqueo y no es necesario volver a planificar los capítulos siguientes.",
    blockingIssueIds,
    blockingLedgerKeys,
    affectedChapterOrders,
    anchorChapterOrder,
    triggerReason,
    windowReason,
    whyTheseChapters: buildWhyTheseChapters(signal, affectedChapterOrders, input.chapterStateGoal),
    action,
    scope,
    signal,
    triggerType: input.triggerType?.trim() || "state_driven",
    sourceIssueIds: uniqueStrings(input.sourceIssueIds ?? []),
    windowSize: affectedChapterOrders.length,
  };
}
