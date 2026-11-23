import type { TimelineContextForChapter } from "@ai-novel/shared/types/timeline";

function listBlock<T>(title: string, items: T[], render: (item: T) => string): string {
  if (items.length === 0) {
    return `${title}\\n- Ninguno`;
  }
  return [title, ...items.map((item) => `- ${render(item)}`)].join("\n");
}

type TimelineContextHook = TimelineContextForChapter["openHooks"][number];

export interface TimelinePromptBlockOptions {
  maxPreviousEvents?: number;
  maxSoftHooks?: number;
  maxAddressedHooks?: number;
}

function resolveModeOf(hook: TimelineContextHook): TimelineContextHook["resolveMode"] {
  return hook.resolveMode ?? "long_arc";
}

function isBlockingHook(hook: TimelineContextHook): boolean {
  return (Boolean(hook.blocking) && resolveModeOf(hook) === "immediate")
    || (!hook.resolveMode && hook.priority === "critical");
}

function hookLabel(hook: TimelineContextHook): string {
  return `[id=${hook.id}] ${hook.title}:${hook.description}(${hook.priority} / ${resolveModeOf(hook)})`;
}

export class TimelinePromptAdapter {
  toPromptBlock(context: TimelineContextForChapter, options: TimelinePromptBlockOptions = {}): string {
    const maxPreviousEvents = options.maxPreviousEvents ?? 40;
    const maxSoftHooks = options.maxSoftHooks ?? 20;
    const maxAddressedHooks = options.maxAddressedHooks ?? 12;
    const previousEvents = context.previousEvents.slice(-maxPreviousEvents);
    const blockingHooks = context.blockingHooks?.length
      ? context.blockingHooks
      : context.openHooks.filter(isBlockingHook);
    const blockingIds = new Set(blockingHooks.map((hook) => hook.id));
    const softHooksSource = context.softHooks?.length
      ? context.softHooks
      : context.openHooks.filter((hook) => !blockingIds.has(hook.id));
    const softHooks = softHooksSource.slice(-maxSoftHooks);
    const addressedHooks = (context.addressedHooks ?? []).slice(-maxAddressedHooks);
    return [
      "[Restricciones de la línea de tiempo]",
      `Capítulo actual: Capítulo ${context.currentChapterIndex}`,
      `Hora actual del cuento:${context.currentTime?.label || "No claro"}`,
      "",
      listBlock("[Han ocurrido eventos clave]", previousEvents, (event) =>
        `${event.title}:${event.summary}${event.storyTimeLabel ? `(${event.storyTimeLabel})` : ""}`),
      "",
      listBlock("[Este capítulo debe ser avanzado]", context.plannedEventsThisChapter, (event) =>
        `${event.title}:${event.summary}`),
      "",
      listBlock("[Gancho que debe aceptarse de inmediato]", blockingHooks, (hook) =>
        hookLabel(hook)),
      "",
      listBlock("[Gancho que se puede posponer]", softHooks, (hook) =>
        hookLabel(hook)),
      "",
      listBlock("[Ganchos que han sido parcialmente aceptados]", addressedHooks, (hook) =>
        hookLabel(hook)),
      "",
      listBlock("[Prohibido que suceda por adelantado]", context.forbiddenEvents, (event) =>
        `${event.title}:${event.reason}`),
      "",
      listBlock("[Requisitos de continuidad]", context.continuityRequirements, (item) => item),
      "",
      listBlock("[Cambios de estado clave]", context.knownStateChanges.slice(-8), (change) =>
        `${change.targetType}:${change.targetId}.${change.field} = ${change.after}(${change.certainty})`),
    ].join("\n").trim();
  }

  toPreviousHookBlock(context: TimelineContextForChapter): string {
    const blockingHooks = context.blockingHooks?.length
      ? context.blockingHooks
      : context.openHooks.filter(isBlockingHook);
    const softHooks = context.softHooks ?? [];
    const hooks = blockingHooks.length > 0 ? blockingHooks : softHooks.slice(0, 4);
    const title = blockingHooks.length > 0
      ? "[El anzuelo que hay que coger inmediatamente en el capítulo anterior]"
      : "[Ganchos que se pueden posponer del capítulo anterior]";
    return listBlock(title, hooks, (hook) =>
      `[id=${hook.id}] ${hook.title}:${hook.description}(Prioridad:${hook.priority} / ${resolveModeOf(hook)})`);
  }
}

export const timelinePromptAdapter = new TimelinePromptAdapter();
