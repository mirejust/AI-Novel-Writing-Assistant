import type { CreativeHubMessage, CreativeHubThread } from "@ai-novel/shared/types/creativeHub";

const activeThreadIds = new Set<string>();

export function acquireCreativeHubThread(threadId: string): () => void {
  if (activeThreadIds.has(threadId)) {
    throw new Error("Actualmente hay ejecuciones que aún se están ejecutando.");
  }
  activeThreadIds.add(threadId);
  return () => activeThreadIds.delete(threadId);
}

export function latestHumanGoal(messages: CreativeHubMessage[]): string {
  const latestHuman = [...messages].reverse().find((item) => item.type === "human");
  if (typeof latestHuman?.content === "string" && latestHuman.content.trim()) {
    return latestHuman.content.trim();
  }
  return "Continúe con la tarea actual del centro creativo.";
}

export function toRunStatusContext(status: CreativeHubThread["status"], latestError: string | null) {
  return {
    threadStatus: status,
    latestError,
  };
}
