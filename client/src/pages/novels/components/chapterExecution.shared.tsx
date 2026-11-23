import type { SSEFrame } from "@ai-novel/shared/types/api";
import type {
  AuditReport,
  Chapter,
  StoryStateSnapshot,
} from "@ai-novel/shared/types/novel";
import type { ChapterRuntimePackage } from "@ai-novel/shared/types/chapterRuntime";
import { parseChapterScenePlan } from "@ai-novel/shared/types/chapterLengthControl";
import {
  classifyChapterQualityLoopRisk,
  hasContinuableChapterQualityLoopRiskFlags,
} from "@ai-novel/shared/types/chapterQualityLoop";
import { Link } from "react-router-dom";
import AiButton from "@/components/common/AiButton";
import AiActionLabel from "@/components/common/AiActionLabel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export type AssetTabKey = "content" | "taskSheet" | "sceneCards" | "quality" | "repair";
export type QueueFilterKey = "all" | "setup" | "draft" | "review" | "completed";
export type ChapterExecutionFlowStageKey =
  | "execution_plan"
  | "writing"
  | "review"
  | "repair"
  | "state_sync"
  | "payoff_sync"
  | "ready";
export type ChapterExecutionFlowStageStatus = "not_started" | "in_progress" | "done";
export type ChapterExecutionBackgroundActivityKind = "character_dynamics" | "state_snapshot" | "payoff_ledger" | "character_resources";
export type ChapterExecutionBackgroundActivityStatus = "running" | "failed";

export interface ChapterExecutionBackgroundActivity {
  kind: ChapterExecutionBackgroundActivityKind;
  status: ChapterExecutionBackgroundActivityStatus;
  chapterId: string;
  chapterOrder?: number;
  chapterTitle?: string;
  updatedAt: string;
  error?: string | null;
}

export type PrimaryAction = {
  label: string;
  reason: string;
  variant: "default" | "secondary" | "outline";
  ai?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  href?: string;
};

export type QueueFilterOption = {
  key: QueueFilterKey;
  label: string;
  count: number;
};

/**
 * 手动新建的空白章节尚未进入任何生产步骤时，才允许从章节执行队列移除。
 * 这里刻意不按标题判断，避免用户改名后失去操作能力，也避免误删 AI 已规划的章节。
 */
export function canRemoveEmptyManualChapter(chapter: Chapter): boolean {
  return chapter.generationState === "planned"
    && (chapter.chapterStatus ?? "unplanned") === "unplanned"
    && !chapter.content?.trim()
    && !chapter.expectation?.trim()
    && !chapter.taskSheet?.trim()
    && !chapter.sceneCards?.trim()
    && !chapter.repairHistory?.trim()
    && !chapter.riskFlags?.trim();
}

export interface ChapterExecutionFlowStage {
  key: ChapterExecutionFlowStageKey;
  label: string;
  status: ChapterExecutionFlowStageStatus;
}

interface ResolveChapterExecutionFlowInput {
  selectedChapter: Chapter | undefined;
  chapterAuditReports: AuditReport[];
  chapterRuntimePackage?: ChapterRuntimePackage | null;
  chapterStateSnapshot?: StoryStateSnapshot | null;
  latestStateSnapshot?: StoryStateSnapshot | null;
  chapterRunStatus?: Extract<SSEFrame, { type: "run_status" }> | null;
  repairRunStatus?: Extract<SSEFrame, { type: "run_status" }> | null;
  isStreaming?: boolean;
  streamingChapterId?: string | null;
  isRepairStreaming?: boolean;
  repairStreamingChapterId?: string | null;
  isRunningFullAudit?: boolean;
  backgroundActivities?: ChapterExecutionBackgroundActivity[] | null;
}

const CHAPTER_EXECUTION_FLOW_ORDER: Array<{ key: ChapterExecutionFlowStageKey; label: string }> = [
  { key: "execution_plan", label: "Plan de ejecución" },
  { key: "writing", label: "Escritura de texto" },
  { key: "review", label: "Revisión" },
  { key: "repair", label: "Reparación" },
  { key: "state_sync", label: "Sincronización de estados" },
  { key: "payoff_sync", label: "Presagiando relleno" },
  { key: "ready", label: "Puede seguir avanzando" },
];

function hasOpenAuditIssues(reports: AuditReport[]): boolean {
  return reports.some((report) => report.issues.some((issue) => issue.status === "open"));
}

function hasBackgroundActivity(
  activities: ChapterExecutionBackgroundActivity[] | null | undefined,
  kind: ChapterExecutionBackgroundActivity["kind"],
  chapterId: string,
): boolean {
  return (activities ?? []).some((item) => item.kind === kind && item.status === "running" && item.chapterId === chapterId);
}

function hasRuntimeLedgerData(runtimePackage: ChapterRuntimePackage | null | undefined): boolean {
  if (!runtimePackage) {
    return false;
  }
  const context = runtimePackage.context;
  return Boolean(
    context.ledgerSummary
    || context.ledgerPendingItems.length > 0
    || context.ledgerUrgentItems.length > 0
    || context.ledgerOverdueItems.length > 0,
  );
}

function hasRuntimeResourceData(runtimePackage: ChapterRuntimePackage | null | undefined): boolean {
  const context = runtimePackage?.context.characterResourceContext;
  return Boolean(
    context
    && (
      context.availableItems.length > 0
      || context.setupNeededItems.length > 0
      || context.blockedItems.length > 0
      || context.highRiskCommittedItems.length > 0
      || context.pendingProposalItems.length > 0
      || context.riskSignals.length > 0
    ),
  );
}

function buildCurrentStageNote(stage: ChapterExecutionFlowStage): string {
  switch (stage.key) {
    case "execution_plan":
      return stage.status === "done"
        ? "El plan de ejecución de este capítulo está listo."
        : "Este capítulo aún carece de un plan de ejecución. El sistema primero preparará una lista de tareas o un desglose de escenas.";
    case "writing":
      return stage.status === "in_progress"
        ? "AI está escribiendo el texto de este capítulo."
        : "El plan de ejecución ya está listo y puedes empezar a escribir el texto.";
    case "review":
      return stage.status === "in_progress"
        ? "El texto ha sido generado y está siendo revisado por el sistema."
        : "El texto ya tiene contenido y el siguiente paso será revisarlo.";
    case "repair":
      return stage.status === "in_progress"
        ? "El sistema está arreglando el texto según el problema."
        : "Si se encuentran problemas durante la revisión, se ingresará a la fase de reparación.";
    case "state_sync":
      return stage.status === "in_progress"
        ? "El texto es legible y el sistema informa sobre el estado de este capítulo, los cambios de caracteres y los recursos clave."
        : "Una vez que el texto principal sea legible, el sistema informará el estado del capítulo y los recursos clave.";
    case "payoff_sync":
      return stage.status === "in_progress"
        ? "El sistema está calibrando el libro de presagios involucrado en este capítulo."
        : "Una vez reintroducidos los activos, el sistema calibrará el libro de presagios según el riesgo y el ritmo.";
    case "ready":
    default:
      return stage.status === "done"
        ? "Este capítulo ha llegado a un estado en el que se puede avanzar."
        : stage.status === "in_progress"
          ? "Este capítulo ha completado la ronda de revisión actual. Puedes continuar editando o trabajar en las sugerencias primero."
          : "Después de completar los pasos anteriores, puede continuar con este capítulo.";
  }
}

export function resolveChapterExecutionFlow(input: ResolveChapterExecutionFlowInput): {
  stages: ChapterExecutionFlowStage[];
  currentStage: ChapterExecutionFlowStage & { note: string };
} {
  const chapter = input.selectedChapter;
  const chapterId = chapter?.id ?? "";
  const isCurrentChapterWriting = Boolean(
    chapter && input.isStreaming && input.streamingChapterId === chapter.id,
  );
  const isCurrentChapterRepairing = Boolean(
    chapter && input.isRepairStreaming && input.repairStreamingChapterId === chapter.id,
  );
  const currentStateSnapshot = input.chapterRuntimePackage?.context.stateSnapshot
    ?? input.chapterStateSnapshot
    ?? (input.latestStateSnapshot?.sourceChapterId === chapterId ? input.latestStateSnapshot : null);

  const stages: ChapterExecutionFlowStage[] = CHAPTER_EXECUTION_FLOW_ORDER.map(({ key, label }) => {
    if (!chapter) {
      return {
        key,
        label,
        status: "not_started",
      };
    }

    switch (key) {
      case "execution_plan":
        return {
          key,
          label,
          status: chapter.taskSheet?.trim() || chapter.sceneCards?.trim()
            ? "done"
            : "not_started",
        };
      case "writing":
        return {
          key,
          label,
          status: isCurrentChapterWriting || chapter.chapterStatus === "generating"
            ? "in_progress"
            : chapter.content?.trim()
              ? "done"
              : "not_started",
        };
      case "review":
        return {
          key,
          label,
          status: (input.isRunningFullAudit || (isCurrentChapterWriting && input.chapterRunStatus?.phase === "finalizing"))
            ? "in_progress"
            : (input.chapterAuditReports.length > 0 || chapter.generationState === "reviewed" || chapter.generationState === "approved" || chapter.generationState === "published")
              ? "done"
              : "not_started",
        };
      case "repair":
        return {
          key,
          label,
          status: isCurrentChapterRepairing
            ? "in_progress"
            : (chapter.generationState === "repaired" || Boolean(chapter.repairHistory?.trim()))
              ? "done"
              : "not_started",
        };
      case "state_sync":
        return {
          key,
          label,
          status: hasBackgroundActivity(input.backgroundActivities, "state_snapshot", chapterId)
            || hasBackgroundActivity(input.backgroundActivities, "character_resources", chapterId)
            ? "in_progress"
            : (currentStateSnapshot || hasRuntimeResourceData(input.chapterRuntimePackage))
              ? "done"
              : "not_started",
        };
      case "payoff_sync":
        return {
          key,
          label,
          status: hasBackgroundActivity(input.backgroundActivities, "payoff_ledger", chapterId)
            ? "in_progress"
            : (hasRuntimeLedgerData(input.chapterRuntimePackage) || Boolean(currentStateSnapshot?.foreshadowStates?.length))
              ? "done"
              : "not_started",
        };
      case "ready":
      default:
        return {
          key,
          label,
          status: chapter.chapterStatus === "completed" || chapter.generationState === "approved" || chapter.generationState === "published"
            ? "done"
            : chapter.chapterStatus === "pending_review" && !hasOpenAuditIssues(input.chapterAuditReports)
              ? "in_progress"
              : "not_started",
        };
    }
  });

  const currentStage = stages.find((stage) => stage.status === "in_progress")
    ?? stages.find((stage) => stage.status === "not_started")
    ?? stages[stages.length - 1]!;

  return {
    stages,
    currentStage: {
      ...currentStage,
      note: buildCurrentStageNote(currentStage),
    },
  };
}

export function resolveDisplayedChapterStatus(chapter: Chapter): Chapter["chapterStatus"] | null | undefined {
  const status = chapter.chapterStatus;
  if (!hasText(chapter.content)) {
    return status;
  }
  if (chapter.generationState === "approved" || chapter.generationState === "published") {
    return "completed";
  }
  if (
    chapterHasContinuableQualityLoop(chapter)
    && (chapter.generationState === "reviewed" || chapter.generationState === "repaired")
  ) {
    return "pending_review";
  }
  if (status === "generating" && (chapter.generationState === "reviewed" || chapter.generationState === "repaired")) {
    return "pending_review";
  }
  if (status === "needs_repair" && chapterHasContinuableQualityLoop(chapter)) {
    return "pending_review";
  }
  if (status === "pending_generation") {
    return "pending_review";
  }
  return status;
}

export function chapterStatusLabel(status?: Chapter["chapterStatus"] | null): string {
  switch (status) {
    case "unplanned":
      return "Estar preparado";
    case "pending_generation":
      return "por escribir";
    case "generating":
      return "Escribiendo";
    case "pending_review":
      return "Revisado";
    case "needs_repair":
      return "Solución sugerida";
    case "completed":
      return "Completado";
    default:
      return "Sin configurar";
  }
}

export function chapterStatusDescription(status?: Chapter["chapterStatus"] | null): string {
  switch (status) {
    case "unplanned":
      return "Estar preparado: este capítulo aún carece de materiales de ejecución. Por lo general, primero es necesario complementar los objetivos del capítulo, las listas de tareas o las tarjetas de escena.";
    case "pending_generation":
      return "Por escribir: el plan del capítulo está básicamente listo y se puede iniciar el texto.";
    case "generating":
      return "Redacción: La IA está generando el texto de este capítulo o está finalizando el proceso de posgeneración.";
    case "pending_review":
      return "Revisado: El texto ha completado la actual ronda de revisión. Puede ver sugerencias, continuar editando directamente o solucionar problemas según sea necesario.";
    case "needs_repair":
      return "Solución recomendada: la revisión descubrió el problema pero no impide realizar más ediciones. Puedes solucionarlo con un clic o continuar escribiendo primero.";
    case "completed":
      return "Completado: este capítulo ha pasado el proceso actual y se puede pulir o pasar al siguiente capítulo.";
    default:
      return "No establecido: el capítulo actual no tiene un estado de proceso claro.";
  }
}

export function generationStateLabel(state?: Chapter["generationState"] | null): string {
  switch (state) {
    case "planned":
      return "Ya catalogado";
    case "drafted":
      return "Completado";
    case "reviewed":
      return "Revisado";
    case "repaired":
      return "Fijo";
    case "approved":
      return "Confirmado";
    case "published":
      return "Publicado";
    default:
      return "";
  }
}

export function generationStateDescription(state?: Chapter["generationState"] | null): string {
  switch (state) {
    case "planned":
      return "Ya incluido en el índice: el capítulo se ha incluido en el índice o se ha dividido en capítulos, pero aún no hay un borrador de texto.";
    case "drafted":
      return "Completado: Se ha generado un borrador del texto, pero aún no se ha completado la revisión y confirmación.";
    case "reviewed":
      return "Revisado: se ha completado una ronda de revisión y puede repararse o confirmarse más adelante.";
    case "repaired":
      return "Solucionado: Se ha reparado según el problema. Generalmente el siguiente paso es revisar o confirmar nuevamente.";
    case "approved":
      return "Confirmado: este capítulo ha superado el umbral de calidad actual y se considerará completado y omitido cuando se ejecute automáticamente.";
    case "published":
      return "Publicado: este capítulo ha entrado en el estado publicado y no se regenerará automáticamente.";
    default:
      return "";
  }
}

export function shouldShowGenerationStateBadge(state?: Chapter["generationState"] | null): boolean {
  return Boolean(state && state !== "planned");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function stringifyRiskLabel(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function qualityLoopActionLabel(value: unknown): string | null {
  switch (value) {
    case "continue":
      return "La calidad puede continuar";
    case "patch_repair":
      return "Se recomienda escribir y reparar.";
    case "replan":
      return "Se recomienda volver a planificar";
    case "manual_gate":
      return "Necesidad de confirmar el límite de reparación.";
    default:
      return null;
  }
}

function qualityLoopStatusLabel(value: unknown): string | null {
  switch (value) {
    case "risk":
      return "La calidad está en riesgo";
    case "invalid":
      return "La calidad necesita reparación";
    case "missing":
      return "Falta información de calidad.";
    default:
      return null;
  }
}

function qualityLoopArtifactLabel(value: unknown): string | null {
  switch (value) {
    case "chapter_retention_contract":
      return "Riesgo de retención";
    case "continuity_state":
      return "Riesgo de continuidad";
    case "rolling_window_review":
      return "Riesgos de conexión del capítulo";
    case "prose_quality":
      return "Detección de naturalidad/degradación del texto";
    default:
      return null;
  }
}

function parseStructuredRiskFlagsObject(input: string): Record<string, unknown> | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(input);
  } catch {
    return null;
  }
  return isRecord(parsed) ? parsed : null;
}

export function chapterHasContinuableQualityLoop(chapter: Pick<Chapter, "riskFlags">): boolean {
  return hasContinuableChapterQualityLoopRiskFlags(chapter.riskFlags);
}

function parseStructuredRiskFlags(input: string): string[] | null {
  const parsed = parseStructuredRiskFlagsObject(input);
  if (!parsed) return null;
  const labels: string[] = [];
  const qualityLoop = parsed.qualityLoop;
  if (isRecord(qualityLoop)) {
    const qualityLoopRisk = classifyChapterQualityLoopRisk(qualityLoop);
    if (qualityLoopRisk === "non_blocking_quality_debt") {
      labels.push("Deuda de calidad registrada");
    } else {
      const actionLabel = qualityLoopActionLabel(qualityLoop.recommendedAction);
      const statusLabel = qualityLoopStatusLabel(qualityLoop.overallStatus);
      if (actionLabel) labels.push(actionLabel);
      if (statusLabel) labels.push(statusLabel);
    }
    const signals = Array.isArray(qualityLoop.signals) ? qualityLoop.signals : [];
    signals.forEach((signal) => {
      if (!isRecord(signal) || signal.status === "valid") {
        return;
      }
      const label = qualityLoopArtifactLabel(signal.artifactType);
      if (label) {
        labels.push(label);
      }
    });
  }
  const extraLabels = Object.entries(parsed)
    .filter(([key]) => key !== "qualityLoop")
    .flatMap(([, value]) => Array.isArray(value) ? value : [value])
    .map(stringifyRiskLabel)
    .filter((value): value is string => Boolean(value));
  return Array.from(new Set([...labels, ...extraLabels])).slice(0, 4);
}

export function parseRiskFlags(input: string | null | undefined): string[] {
  if (!input?.trim()) {
    return [];
  }
  const structured = parseStructuredRiskFlags(input.trim());
  if (structured) {
    return structured;
  }
  return input
    .split(/[\n,，;；|]/g)
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
    .slice(0, 4);
}

export function hasText(input: string | null | undefined): boolean {
  return Boolean(input?.trim());
}

export function chapterHasPreparationAssets(chapter: Chapter): boolean {
  return hasText(chapter.expectation) || hasText(chapter.taskSheet) || hasText(chapter.sceneCards);
}

export function parseChapterScenePlanForDisplay(chapter: Chapter) {
  return parseChapterScenePlan(chapter.sceneCards, {
    targetWordCount: chapter.targetWordCount ?? undefined,
  });
}

export function resolveChapterQueuePreview(chapter: Chapter): string {
  if (hasText(chapter.expectation)) {
    return chapter.expectation!.trim();
  }
  if (hasText(chapter.taskSheet)) {
    return chapter.taskSheet!.trim();
  }
  const scenePlan = parseChapterScenePlanForDisplay(chapter);
  if (scenePlan) {
    const firstScene = scenePlan.scenes[0];
    return firstScene
      ? `${firstScene.title} · ${firstScene.purpose}`
      : "Este capítulo ha generado un contrato de presupuesto de escenario.";
  }
  if (hasText(chapter.sceneCards)) {
    return "Este capítulo contiene el desmantelamiento de la versión anterior de la escena y se recomienda regenerarla.";
  }
  return "Este capítulo aún no tiene un objetivo claro, por lo que es conveniente elaborar primero el plan del capítulo.";
}

export function chapterSuggestedActionLabel(chapter: Chapter): string {
  if (chapterHasContinuableQualityLoop(chapter)) {
    return hasText(chapter.content) ? "Continuar al siguiente capítulo" : "Escribe este capitulo";
  }
  const status = resolveDisplayedChapterStatus(chapter);
  if (status === "generating") return "Esperando generación";
  if (status === "needs_repair") return "Reparación con un clic";
  if (status === "pending_review") {
    return chapter.generationState === "reviewed" || chapter.generationState === "approved"
      ? "Ver sugerencias"
      : "Ejecutar revisión";
  }
  if (status === "completed") return "Continuar puliendo";
  if (status === "unplanned" || !chapterHasPreparationAssets(chapter)) return "Plan de capítulo complementario";
  if (!hasText(chapter.content) || status === "pending_generation") return "Escribe este capitulo";
  if (chapter.generationState === "drafted") return "Ejecutar revisión";
  return "Editor abierto";
}

export function chapterMatchesQueueFilter(chapter: Chapter, filter: QueueFilterKey): boolean {
  const status = resolveDisplayedChapterStatus(chapter);
  if (filter === "all") return true;
  if (filter === "completed") {
    return status === "completed"
      || chapter.generationState === "approved"
      || chapter.generationState === "published";
  }
  if (filter === "review") {
    return status === "pending_review"
      || status === "needs_repair"
      || chapter.generationState === "drafted"
      || chapter.generationState === "reviewed";
  }
  if (filter === "setup") {
    return status === "unplanned" || (!chapterHasPreparationAssets(chapter) && !hasText(chapter.content));
  }
  if (filter === "draft") {
    return status === "pending_generation"
      || status === "generating"
      || (!hasText(chapter.content) && status !== "unplanned");
  }
  return true;
}

export function MetricBadge(props: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border border-border/70 bg-background px-3 py-2">
      <div className="text-[11px] text-muted-foreground">{props.label}</div>
      <div className="mt-1 text-sm font-medium text-foreground">{props.value}</div>
      {props.hint ? <div className="mt-1 text-[11px] text-muted-foreground">{props.hint}</div> : null}
    </div>
  );
}

export function RiskBadgeList(props: { risks: string[] }) {
  if (props.risks.length === 0) {
    return null;
  }
  return (
    <div className="flex flex-wrap gap-1">
      {props.risks.map((risk) => <Badge key={risk} variant="secondary">{risk}</Badge>)}
    </div>
  );
}

export function PrimaryActionButton(props: { action: PrimaryAction | null; className?: string }) {
  const { action, className } = props;
  if (!action) {
    return null;
  }
  if (action.href) {
    return (
      <Button asChild size="sm" variant={action.variant} className={className}>
        <Link to={action.href}>
          {action.ai ? <AiActionLabel>{action.label}</AiActionLabel> : action.label}
        </Link>
      </Button>
    );
  }
  return (
    action.ai ? (
      <AiButton size="sm" variant={action.variant} className={className} onClick={action.onClick} disabled={action.disabled}>
        {action.label}
      </AiButton>
    ) : (
      <Button size="sm" variant={action.variant} className={className} onClick={action.onClick} disabled={action.disabled}>
        {action.label}
      </Button>
    )
  );
}
