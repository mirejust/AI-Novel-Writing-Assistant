import type {
  NovelWorkflowCheckpoint,
  NovelWorkflowLane,
  NovelWorkflowMilestone,
  NovelWorkflowMilestoneType,
  NovelWorkflowResumeTarget,
  NovelWorkflowStage,
} from "@ai-novel/shared/types/novelWorkflow";
import { getNovelWorkflowLaneDescriptor } from "@ai-novel/shared/types/novelWorkflow";

export const NOVEL_WORKFLOW_STAGE_LABELS: Record<NovelWorkflowStage, string> = {
  project_setup: "Configuración del proyecto",
  creation_intent: "Comprender ideas creativas",
  short_story_plan: "planificación de cuento corto",
  short_story_draft: "Generar trabajo completo",
  short_story_review: "Revisión del texto completo",
  auto_director: "Director automático de IA",
  story_macro: "gran plan de historia",
  world_setup: "preparación de la cosmovisión",
  character_setup: "Preparación de personajes",
  volume_strategy: "Estrategia de volumen/esqueleto de volumen",
  structured_outline: "Ritmo / Capítulo de ruptura",
  chapter_execution: "Ejecución del capítulo",
  quality_repair: "arreglo de calidad",
};

export const NOVEL_WORKFLOW_STAGE_PROGRESS: Record<NovelWorkflowStage, number> = {
  project_setup: 0.08,
  creation_intent: 0.08,
  short_story_plan: 0.2,
  short_story_draft: 0.35,
  short_story_review: 0.9,
  auto_director: 0.15,
  story_macro: 0.26,
  world_setup: 0.34,
  character_setup: 0.42,
  volume_strategy: 0.5,
  structured_outline: 0.68,
  chapter_execution: 0.84,
  quality_repair: 0.94,
};

export const NOVEL_WORKFLOW_STAGE_STEPS = [
  { key: "project_setup", label: "Configuración del proyecto" },
  { key: "creation_intent", label: "Comprender ideas creativas" },
  { key: "short_story_plan", label: "planificación de cuento corto" },
  { key: "short_story_draft", label: "Generar trabajo completo" },
  { key: "short_story_review", label: "Revisión del texto completo" },
  { key: "auto_director", label: "Director automático" },
  { key: "story_macro", label: "gran plan de historia" },
  { key: "world_setup", label: "preparación de la cosmovisión" },
  { key: "character_setup", label: "Preparación de personajes" },
  { key: "volume_strategy", label: "Estrategia de volumen/esqueleto de volumen" },
  { key: "structured_outline", label: "Ritmo / Capítulo de ruptura" },
  { key: "chapter_execution", label: "Ejecución del capítulo" },
  { key: "quality_repair", label: "arreglo de calidad" },
] as const;

export function buildNovelCreateResumeTarget(taskId: string, mode: "director" | null = null): NovelWorkflowResumeTarget {
  return {
    route: "/novels/create",
    taskId,
    mode,
  };
}

export function buildCreationStudioResumeTarget(taskId: string): NovelWorkflowResumeTarget {
  return {
    route: "/create",
    taskId,
    lane: "creation_studio",
  };
}

export function buildShortStoryResumeTarget(novelId: string, taskId?: string | null): NovelWorkflowResumeTarget {
  return {
    route: "/novels/:id/story",
    novelId,
    taskId: taskId ?? null,
    lane: "creation_studio",
  };
}

export function buildNovelEditResumeTarget(params: {
  novelId: string;
  taskId?: string | null;
  lane?: NovelWorkflowResumeTarget["lane"];
  stage: NovelWorkflowResumeTarget["stage"];
  chapterId?: string | null;
  volumeId?: string | null;
}): NovelWorkflowResumeTarget {
  return {
    route: "/novels/:id/edit",
    novelId: params.novelId,
    taskId: params.taskId ?? null,
    lane: params.lane ?? null,
    stage: params.stage,
    chapterId: params.chapterId ?? null,
    volumeId: params.volumeId ?? null,
  };
}

export function resumeTargetToRoute(target: NovelWorkflowResumeTarget | null | undefined): string {
  if (!target) {
    return "/tasks";
  }
  if (target.route === "/create") {
    return target.taskId ? `/create?taskId=${encodeURIComponent(target.taskId)}` : "/create";
  }
  if (target.route === "/novels/create") {
    if (target.mode === "director") {
      const searchParams = new URLSearchParams();
      if (target.taskId) {
        searchParams.set("taskId", target.taskId);
      }
      const query = searchParams.toString();
      return query ? `/novels/auto-director?${query}` : "/novels/auto-director";
    }
    const searchParams = new URLSearchParams();
    if (target.taskId) {
      searchParams.set("workflowTaskId", target.taskId);
    }
    if (target.mode) {
      searchParams.set("mode", target.mode);
    }
    const query = searchParams.toString();
    return query ? `/novels/create?${query}` : "/novels/create";
  }

  if (!target.novelId) {
    return "/tasks";
  }

  if (target.route === "/lab/director/:novelId") return `/lab/director/${encodeURIComponent(target.novelId)}`;

  if (target.route === "/novels/:id/story") {
    return `/novels/${target.novelId}/story`;
  }

  const searchParams = new URLSearchParams();
  if (target.stage) {
    searchParams.set("stage", target.stage);
  }
  if (target.chapterId) {
    searchParams.set("chapterId", target.chapterId);
  }
  if (target.volumeId) {
    searchParams.set("volumeId", target.volumeId);
  }
  const query = searchParams.toString();
  const route = target.route === "/novels/:id/simple" ? "simple" : "edit";
  return query ? `/novels/${target.novelId}/${route}?${query}` : `/novels/${target.novelId}/${route}`;
}

export function parseMilestones(value: string | null | undefined): NovelWorkflowMilestone[] {
  if (!value?.trim()) {
    return [];
  }
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed
      .filter((item): item is NovelWorkflowMilestone => (
        Boolean(item)
        && typeof item === "object"
        && typeof (item as NovelWorkflowMilestone).checkpointType === "string"
        && typeof (item as NovelWorkflowMilestone).summary === "string"
        && typeof (item as NovelWorkflowMilestone).createdAt === "string"
      ));
  } catch {
    return [];
  }
}

export function appendMilestone(
  existing: string | null | undefined,
  checkpointType: NovelWorkflowMilestoneType,
  summary: string,
): string {
  const next = [
    ...parseMilestones(existing).filter((item) => item.checkpointType !== checkpointType),
    {
      checkpointType,
      summary,
      createdAt: new Date().toISOString(),
    },
  ];
  return JSON.stringify(next);
}

export function parseResumeTarget(value: string | null | undefined): NovelWorkflowResumeTarget | null {
  if (!value?.trim()) {
    return null;
  }
  try {
    const parsed = JSON.parse(value) as NovelWorkflowResumeTarget;
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

export function stringifyResumeTarget(value: NovelWorkflowResumeTarget | null | undefined): string | null {
  return value ? JSON.stringify(value) : null;
}

export function parseSeedPayload<T>(value: string | null | undefined): T | null {
  if (!value?.trim()) {
    return null;
  }
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

export function mergeSeedPayload<T extends Record<string, unknown>>(
  existing: string | null | undefined,
  patch: Partial<T>,
): string {
  const current = parseSeedPayload<T>(existing) ?? {} as T;
  return JSON.stringify({
    ...current,
    ...patch,
  });
}

export function defaultWorkflowTitle(input: {
  lane: NovelWorkflowLane;
  title?: string | null;
  novelTitle?: string | null;
}): string {
  const novelTitle = input.novelTitle?.trim() || input.title?.trim();
  if (novelTitle) {
    return novelTitle;
  }
  return getNovelWorkflowLaneDescriptor(input.lane).defaultTitle;
}
