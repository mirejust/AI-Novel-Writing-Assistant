import type {
  ExtractedTimelineEvent,
  TimelineCheckResult,
  TimelineContextForChapter,
  TimelineIssue,
  TimelineIssueSeverity,
} from "@ai-novel/shared/types/timeline";
import { defaultTimelinePolicy, type TimelinePolicy } from "./timeline-policy";

function normalize(value: string | null | undefined): string {
  return (value ?? "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "")
    .trim();
}

function compact(value: string | null | undefined): string {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

function containsText(haystack: string, needle: string): boolean {
  const normalizedHaystack = normalize(haystack);
  const normalizedNeedle = normalize(needle);
  return normalizedNeedle.length >= 4 && normalizedHaystack.includes(normalizedNeedle);
}

function tokenSet(value: string): Set<string> {
  const normalized = value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
  return new Set(normalized.split(/\s+/g).filter((item) => item.length >= 2));
}

function similarity(left: string, right: string): number {
  const a = tokenSet(left);
  const b = tokenSet(right);
  if (a.size === 0 || b.size === 0) {
    return containsText(left, right) || containsText(right, left) ? 1 : 0;
  }
  const intersection = Array.from(a).filter((item) => b.has(item)).length;
  const union = new Set([...a, ...b]).size;
  return union === 0 ? 0 : intersection / union;
}

function eventText(event: ExtractedTimelineEvent): string {
  return `${event.title}\n${event.summary}`;
}

type TimelineContextHook = TimelineContextForChapter["openHooks"][number];

function resolveModeOf(hook: TimelineContextHook): TimelineContextHook["resolveMode"] {
  return hook.resolveMode ?? "long_arc";
}

function isImmediateBlockingHook(hook: TimelineContextHook): boolean {
  return Boolean(hook.blocking) && resolveModeOf(hook) === "immediate";
}

function splitTimelineHooks(context: TimelineContextForChapter): {
  blockingHooks: TimelineContextHook[];
  softHooks: TimelineContextHook[];
} {
  const categorizedCount = (context.blockingHooks?.length ?? 0)
    + (context.softHooks?.length ?? 0)
    + (context.addressedHooks?.length ?? 0);
  if (categorizedCount > 0) {
    const blockingHooks = (context.blockingHooks ?? []).filter(isImmediateBlockingHook);
    const blockingIds = new Set(blockingHooks.map((hook) => hook.id));
    return {
      blockingHooks,
      softHooks: [
        ...(context.softHooks ?? []),
        ...(context.blockingHooks ?? []).filter((hook) => !blockingIds.has(hook.id)),
      ],
    };
  }

  const blockingHooks = (context.openHooks ?? []).filter((hook) => (
    isImmediateBlockingHook(hook)
    || (!hook.resolveMode && (hook.priority === "critical" || hook.priority === "high"))
  ));
  const blockingIds = new Set(blockingHooks.map((hook) => hook.id));
  return {
    blockingHooks,
    softHooks: (context.openHooks ?? []).filter((hook) => !blockingIds.has(hook.id)),
  };
}

function buildResult(issues: TimelineIssue[]): TimelineCheckResult {
  const hasBlocking = issues.some((issue) => issue.severity === "blocking");
  const hasError = issues.some((issue) => issue.severity === "error");
  const hasWarning = issues.some((issue) => issue.severity === "warning");
  const penalty = issues.reduce((sum, issue) => {
    if (issue.severity === "blocking") return sum + 0.35;
    if (issue.severity === "error") return sum + 0.22;
    if (issue.severity === "warning") return sum + 0.12;
    return sum + 0.04;
  }, 0);
  return {
    status: hasBlocking || hasError ? "failed" : hasWarning ? "warning" : "passed",
    score: Math.max(0, Math.min(1, 1 - penalty)),
    issues,
  };
}

export class TimelineCheckerService {
  constructor(private readonly policy: TimelinePolicy = defaultTimelinePolicy) {}

  checkChapter(input: {
    novelId: string;
    chapterId: string;
    chapterIndex: number;
    extractedEvents: ExtractedTimelineEvent[];
    timelineContext: TimelineContextForChapter;
    chapterContent: string;
  }): TimelineCheckResult {
    const issues: TimelineIssue[] = [];
    issues.push(...this.checkFutureEventLeak(input));
    issues.push(...this.checkUnresolvedHooks(input));
    issues.push(...this.checkTimelineRegression(input));
    issues.push(...this.checkRepeatedEvents(input));
    issues.push(...this.checkStateConflicts(input));
    issues.push(...this.checkMissingPlannedEvents(input));
    issues.push(...this.checkForbiddenEvents(input));
    issues.push(...this.checkUnclearTimeAnchor(input));
    return buildResult(issues);
  }

  private checkFutureEventLeak(input: {
    extractedEvents: ExtractedTimelineEvent[];
    timelineContext: TimelineContextForChapter;
    chapterContent: string;
  }): TimelineIssue[] {
    const issues: TimelineIssue[] = [];
    for (const forbidden of input.timelineContext.forbiddenEvents) {
      const evidence = input.extractedEvents.find((event) =>
        containsText(eventText(event), forbidden.title)
        || similarity(eventText(event), `${forbidden.title} ${forbidden.reason}`) >= 0.55);
      if (!evidence && !containsText(input.chapterContent, forbidden.title)) {
        continue;
      }
      issues.push({
        type: "future_event_leak",
        severity: this.policy.futureEventLeakSeverity,
        message: `Los acontecimientos posteriores se anotan o confirman de antemano en este capítulo:${forbidden.title}`,
        evidence: evidence ? `${evidence.title}:${evidence.summary}` : forbidden.title,
        suggestedFix: `Eliminar o reescribir como presagio, no confirmar en este capítulo "${forbidden.title}"Ha sucedido.`,
        relatedEventIds: [forbidden.id],
        relatedHookIds: [],
      });
    }
    return issues;
  }

  private checkUnresolvedHooks(input: {
    extractedEvents: ExtractedTimelineEvent[];
    timelineContext: TimelineContextForChapter;
    chapterContent: string;
  }): TimelineIssue[] {
    const { blockingHooks, softHooks } = splitTimelineHooks(input.timelineContext);
    const isUnanswered = (hook: TimelineContextHook) => {
      const text = `${hook.title}\n${hook.description}`;
      return !input.extractedEvents.some((event) => similarity(eventText(event), text) >= 0.35)
        && !containsText(input.chapterContent, hook.title);
    };
    const blockingIssues = blockingHooks
      .filter(isUnanswered)
      .map((hook) => ({
        type: "unresolved_previous_hook" as const,
        severity: isImmediateBlockingHook(hook) || hook.priority === "critical" ? "blocking" as const : "error" as const,
        message: `Este capítulo no hereda los ganchos que quedaron del capítulo anterior:${hook.title}`,
        evidence: hook.description,
        suggestedFix: `El inicio o mitad del capítulo debe responder a "${hook.title}”, no salte directamente a eventos posteriores.`,
        relatedEventIds: [],
        relatedHookIds: [hook.id],
      }));
    const softIssues = softHooks
      .filter((hook) => hook.priority === "critical" || hook.priority === "high")
      .filter(isUnanswered)
      .map((hook) => ({
        type: "delayed_promise" as const,
        severity: resolveModeOf(hook) === "short_arc" ? "warning" as const : "info" as const,
        message: `Este capítulo aún no ha reciclado los ganchos aplazables:${hook.title}`,
        evidence: hook.description,
        suggestedFix: `Este gancho pertenece a ${resolveModeOf(hook)}, se puede seguir conservando, pero los capítulos siguientes deberían tener avances visibles.`,
        relatedEventIds: [],
        relatedHookIds: [hook.id],
      }));
    return [...blockingIssues, ...softIssues];
  }

  private checkTimelineRegression(input: { timelineContext: TimelineContextForChapter }): TimelineIssue[] {
    const currentDay = input.timelineContext.currentTime?.storyDayIndex;
    if (this.policy.allowTimeRegression || currentDay == null) {
      return [];
    }
    const previousDayLabels = input.timelineContext.previousEvents
      .map((event) => event.storyTimeLabel ?? "")
      .filter(Boolean);
    if (previousDayLabels.length > 0 && input.timelineContext.currentTime?.label?.includes("adelante")) {
      return [{
        type: "timeline_regression",
        severity: "warning",
        message: "Se sospecha que la etiqueta de tiempo de este capítulo está al revés y es necesario confirmar si se trata de un recuerdo o una narración.",
        evidence: input.timelineContext.currentTime.label,
        suggestedFix: "Si no es un recuerdo, ajuste el ancla de tiempo de este capítulo para que siga al capítulo anterior.",
        relatedEventIds: [],
        relatedHookIds: [],
      }];
    }
    return [];
  }

  private checkRepeatedEvents(input: {
    extractedEvents: ExtractedTimelineEvent[];
    timelineContext: TimelineContextForChapter;
  }): TimelineIssue[] {
    const issues: TimelineIssue[] = [];
    for (const event of input.extractedEvents) {
      const match = input.timelineContext.previousEvents.find((previous) =>
        containsText(eventText(event), previous.title)
        || containsText(`${previous.title} ${previous.summary}`, event.title)
        || similarity(eventText(event), `${previous.title} ${previous.summary}`) >= this.policy.maxRepeatedEventSimilarity);
      if (!match) {
        continue;
      }
      issues.push({
        type: "repeated_event",
        severity: "warning",
        message: `Se sospecha que este capítulo repite eventos que ya sucedieron:${match.title}`,
        evidence: `${event.title}:${event.summary}`,
        suggestedFix: "Asegúrese de que este capítulo avance en las consecuencias, no que repita el mismo evento una y otra vez.",
        relatedEventIds: [match.id],
        relatedHookIds: [],
      });
    }
    return issues;
  }

  private checkStateConflicts(input: {
    extractedEvents: ExtractedTimelineEvent[];
    timelineContext: TimelineContextForChapter;
  }): TimelineIssue[] {
    const known = new Map(input.timelineContext.knownStateChanges.map((change) => [
      `${change.targetType}:${change.targetId}:${change.field}`,
      change,
    ]));
    const issues: TimelineIssue[] = [];
    for (const event of input.extractedEvents) {
      for (const change of event.stateChanges) {
        const previous = known.get(`${change.targetType}:${change.targetId}:${change.field}`);
        if (!previous || normalize(previous.after) === normalize(change.after)) {
          continue;
        }
        if (previous.certainty !== "confirmed" || change.certainty === "rumored") {
          continue;
        }
        issues.push({
          type: "state_conflict",
          severity: "error",
          message: `Los cambios de estado en este capítulo entran en conflicto con el estado de confirmación existente:${change.targetType}:${change.targetId}.${change.field}`,
          evidence: `Antes =${previous.after};Capítulo=${change.after}`,
          suggestedFix: "Si el estado ha cambiado, primero se debe redactar un proceso claro de recuperación, transferencia o reversión; de lo contrario, deberá mantenerse el estatus actual.",
          relatedEventIds: [],
          relatedHookIds: [],
        });
      }
    }
    return issues;
  }

  private checkMissingPlannedEvents(input: {
    extractedEvents: ExtractedTimelineEvent[];
    timelineContext: TimelineContextForChapter;
  }): TimelineIssue[] {
    if (!this.policy.requirePlannedEventCoverage) {
      return [];
    }
    return input.timelineContext.plannedEventsThisChapter
      .filter((planned) => !input.extractedEvents.some((event) =>
        event.matchedPlannedEventIds.includes(planned.id)
        || similarity(eventText(event), `${planned.title} ${planned.summary}`) >= 0.35))
      .map((planned) => ({
        type: "missing_planned_event" as const,
        severity: "error" as const,
        message: `Este capítulo no completó los eventos planificados en el cronograma:${planned.title}`,
        evidence: planned.summary,
        suggestedFix: `Complemente o reescriba el texto para que "${planned.title}"Realmente sucedió en este capítulo; si el plan es incorrecto, primero se debe ajustar el cronograma.`,
        relatedEventIds: [planned.id],
        relatedHookIds: [],
      }));
  }

  private checkForbiddenEvents(input: {
    extractedEvents: ExtractedTimelineEvent[];
    timelineContext: TimelineContextForChapter;
    chapterContent: string;
  }): TimelineIssue[] {
    return input.timelineContext.continuityRequirements
      .filter((requirement) => requirement.includes("must_not_happen") || requirement.includes("Prohibido que ocurra por adelantado"))
      .flatMap((requirement) => {
        const matched = input.extractedEvents.find((event) => {
          const title = compact(event.title);
          return title.length > 0 && requirement.includes(title);
        });
        return matched
          ? [{
              type: "forbidden_event_occurred" as const,
              severity: "blocking" as const,
              message: "Este capítulo contiene eventos que la línea de tiempo prohíbe que sucedan antes.",
              evidence: `${matched.title}:${matched.summary}`,
              suggestedFix: requirement,
              relatedEventIds: [],
              relatedHookIds: [],
            }]
          : [];
      });
  }

  private checkUnclearTimeAnchor(input: { timelineContext: TimelineContextForChapter }): TimelineIssue[] {
    if (!this.policy.requireTimeAnchorEveryChapter || input.timelineContext.currentTime?.label) {
      return [];
    }
    return [{
      type: "unclear_time_anchor",
      severity: "info" as TimelineIssueSeverity,
      message: "Este capítulo no tiene un ancla temporal clara.",
      evidence: "Falta el ancla ChapterTime",
      suggestedFix: "Agregue una etiqueta de tiempo a este capítulo para que los capítulos siguientes puedan juzgar el avance del tiempo.",
      relatedEventIds: [],
      relatedHookIds: [],
    }];
  }
}

export const timelineCheckerService = new TimelineCheckerService();
