import type {
  NovelAutoDirectorTaskSummary,
  ProjectProgressStatus,
} from "@ai-novel/shared/types/novel";
import type { NovelListResponse } from "@/api/novel/shared";
import {
  canContinueChapterBatchAutoExecution,
  canContinueDirector,
  canEnterChapterExecution,
  getWorkflowDescription,
  isWorkflowRunningInBackground,
  requiresCandidateSelection,
} from "@/lib/novelWorkflowTaskUi";
import { featureFlags } from "@/config/featureFlags";
import {getDirectorWorkspaceHref} from "@/lib/novelRoutes";

export type NovelListItem = NovelListResponse["items"][number];
export type StatusFilter = "all" | "draft" | "published";
export type WritingModeFilter = "all" | "original" | "continuation";
export type NovelListTone = "neutral" | "info" | "success" | "warning" | "danger";

export const DIRECTOR_CREATE_LINK = "/novels/auto-director";
export const REFERENCE_CREATE_LINK = "/novels/auto-director?start=reference";
export const SHORT_STORY_CREATE_LINK = featureFlags.creationStudioEnabled
  ? "/create?form=short_story"
  : null;
export const PRIMARY_CREATE_LABEL = "El director automático de IA abre un libro";
export const REFERENCE_CREATE_LABEL = "Escribir según un libro";
export const MANUAL_CREATE_LINK = "/novels/create";
export const NOVEL_LIST_PAGE_SIZE = 24;

export interface NovelListSummaryItem {
  id: string;
  label: string;
  value: number;
  tone: NovelListTone;
}

export interface WorkflowDisplay {
  tone: NovelListTone;
  label: string;
  description: string;
  progress: number;
  currentStage: string;
  currentAction: string;
  lastHealthyStage: string;
  running: boolean;
}

export function getNovelWorkflowTask(novel: NovelListItem): NovelAutoDirectorTaskSummary | null {
  if (getDirectorWorkspaceHref(novel)) return null;
  return novel.narrativeForm === "short_story"
    ? novel.latestCreationStudioTask ?? null
    : novel.latestAutoDirectorTask ?? null;
}

export function filterNovelList(input: {
  novels: NovelListItem[];
  status: StatusFilter;
  writingMode: WritingModeFilter;
}): NovelListItem[] {
  return input.novels.filter((item) => {
    if (input.status !== "all" && item.status !== input.status) {
      return false;
    }
    if (input.writingMode !== "all" && item.writingMode !== input.writingMode) {
      return false;
    }
    return true;
  });
}

export function formatProgressStatus(status?: ProjectProgressStatus | null): string {
  if (status === "completed") {
    return "Completado";
  }
  if (status === "in_progress") {
    return "En curso";
  }
  if (status === "rework") {
    return "Para ser reelaborado";
  }
  if (status === "blocked") {
    return "Bloqueado";
  }
  return "Sin empezar";
}

export function formatTokenCount(value?: number | null): string {
  const normalized = typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, Math.round(value))
    : 0;
  return new Intl.NumberFormat("zh-CN").format(normalized);
}

export function buildNovelListSummary(novels: NovelListItem[]): NovelListSummaryItem[] {
  const running = novels.filter((novel) => {
    const task = getNovelWorkflowTask(novel);
    return task?.status === "queued" || task?.status === "running";
  }).length;
  const waiting = novels.filter((novel) => getNovelWorkflowTask(novel)?.status === "waiting_approval").length;
  const ready = novels.filter((novel) => (
    novel.narrativeForm === "short_story"
      ? getNovelWorkflowTask(novel)?.status === "succeeded"
      : canEnterChapterExecution(getNovelWorkflowTask(novel))
  )).length;
  const issue = novels.filter((novel) => {
    const status = getNovelWorkflowTask(novel)?.status;
    return status === "failed" || status === "cancelled";
  }).length;

  return [
    { id: "running", label: "Avanzando", value: running, tone: running > 0 ? "info" : "neutral" },
    { id: "waiting", label: "Pendiente de confirmación", value: waiting, tone: waiting > 0 ? "warning" : "neutral" },
    { id: "ready", label: "Puede continuar", value: ready, tone: ready > 0 ? "success" : "neutral" },
    { id: "issue", label: "Pausar/fallar", value: issue, tone: issue > 0 ? "danger" : "neutral" },
  ];
}

export function getWorkflowTone(task?: NovelAutoDirectorTaskSummary | null): NovelListTone {
  if (!task) {
    return "neutral";
  }
  if (task.status === "failed" || task.status === "cancelled") {
    return "danger";
  }
  if (task.status === "waiting_approval") {
    return "warning";
  }
  if (canEnterChapterExecution(task)) {
    return "success";
  }
  if (task.status === "running" || task.status === "queued") {
    return "info";
  }
  return "neutral";
}

export function buildWorkflowDisplay(novel: NovelListItem): WorkflowDisplay {
  const task = getNovelWorkflowTask(novel);
  if (novel.narrativeForm === "short_story") {
    return {
      tone: task?.status === "failed" ? "danger" : task?.status === "succeeded" ? "success" : "info",
      label: task?.status === "succeeded" ? "Cuento completo" : "Cuento corto en progreso",
      description: task?.checkpointSummary?.trim()
        || task?.currentItemLabel?.trim()
        || novel.description?.trim()
        || "La IA está escribiendo la dirección identificada en un trabajo continuo.",
      progress: Math.round((task?.progress ?? 0) * 100),
      currentStage: "Trabajo en serie",
      currentAction: task?.currentItemLabel?.trim() || "",
      lastHealthyStage: "",
      running: task?.status === "queued" || task?.status === "running",
    };
  }
  const description = getWorkflowDescription(task);
  if (!task) {
    return {
      tone: "neutral",
      label: "Elementos de datos",
      description: novel.description?.trim() || "No existe una tarea de director automática, puedes ingresar al proyecto para seguir mejorando los materiales o capítulos.",
      progress: 0,
      currentStage: "No entrar en director automático",
      currentAction: "",
      lastHealthyStage: "",
      running: false,
    };
  }
  const currentAction = task.currentItemLabel?.trim() || "";
  return {
    tone: getWorkflowTone(task),
    label: task.displayStatus?.trim() || task.resumeAction?.trim() || task.nextActionLabel?.trim() || "Director automático",
    description: description || "El sistema permanece en estado avanzado y se puede seguir viendo o restaurando.",
    progress: Math.round(task.progress * 100),
    currentStage: task.currentStage ?? "Director automático",
    currentAction,
    lastHealthyStage: task.lastHealthyStage ?? "",
    running: isWorkflowRunningInBackground(task),
  };
}

export function getPrimaryActionLabel(novel: NovelListItem): string {
  if (novel.narrativeForm === "short_story") {
    return "Trabajo abierto";
  }
  if (getDirectorWorkspaceHref(novel)) return "Abre el escritorio del director.";
  const task = getNovelWorkflowTask(novel);
  if (canContinueChapterBatchAutoExecution(task)) {
    return task?.resumeAction ?? `Continuar la ejecución automática${task?.executionScopeLabel ?? "Alcance del capítulo actual"}`;
  }
  if (canContinueDirector(task)) {
    return task?.resumeAction ?? "Seguir dirigiendo";
  }
  if (requiresCandidateSelection(task)) {
    return task?.resumeAction ?? "Continúe para confirmar la dirección.";
  }
  if (canEnterChapterExecution(task)) {
    return "Ir a la ejecución del capítulo";
  }
  if (task) {
    return "Ver estado de avance";
  }
  return "Editar novela";
}

export function getProjectAssetRows(novel: NovelListItem): Array<{
  label: string;
  value: string;
  tone?: NovelListTone;
}> {
  if (novel.narrativeForm === "short_story") {
    return [
      { label: "Forma", value: "Cuento corto" },
      { label: "Objetivo", value: `${(novel.targetWordCount ?? 0).toLocaleString()} palabras` },
      { label: "Texto", value: getNovelWorkflowTask(novel)?.status === "succeeded" ? "Completado" : "Generando", tone: "info" },
      { label: "Origen", value: novel.derivedFromNovelId ? "Obras derivadas" : "Original" },
    ];
  }
  return [
    { label: "Capítulos", value: String(novel._count.chapters) },
    { label: "Personaje", value: String(novel._count.characters) },
    {
      label: "Visión del mundo",
      value: novel.world?.name ?? "no obligado",
      tone: novel.world?.name ? "neutral" : "warning",
    },
    {
      label: "Recursos",
      value: `${novel.resourceReadyScore ?? 0}/100`,
      tone: (novel.resourceReadyScore ?? 0) >= 60 ? "success" : "warning",
    },
  ];
}
