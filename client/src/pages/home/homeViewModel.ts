import type { TaskOverviewSummary } from "@ai-novel/shared/types/task";
import { getNovelWorkflowAttention, type NovelListResponse } from "@/api/novel/shared";
import {
  canContinueChapterBatchAutoExecution,
  canContinueDirector,
  canEnterChapterExecution,
  getCandidateSelectionLink,
  getWorkflowDescription,
  isWorkflowActionRequired,
  isWorkflowRunningInBackground,
  requiresCandidateSelection,
} from "@/lib/novelWorkflowTaskUi";
import { featureFlags } from "@/config/featureFlags";
import { getDirectorWorkspaceHref, getNovelWorkspaceHref } from "@/lib/novelRoutes";

export const HOME_NOVEL_FETCH_LIMIT = 12;
export const HOME_RECENT_LIMIT = 6;
export const DIRECTOR_CREATE_LINK = "/novels/auto-director";
export const SHORT_STORY_CREATE_LINK = featureFlags.creationStudioEnabled
  ? "/create?form=short_story"
  : null;
export const MANUAL_CREATE_LINK = "/novels/create";

export type HomeNovelItem = NovelListResponse["items"][number];
export type HomeTone = "neutral" | "info" | "success" | "warning" | "danger";

export interface HomeMetric {
  id: string;
  title: string;
  value: string | number;
  hint: string;
  tone: HomeTone;
}

export interface HomeAttentionItem {
  id: string;
  title: string;
  description: string;
  tone: HomeTone;
  to?: string;
  actionLabel?: string;
}

export interface HomeAssetHealthItem {
  id: string;
  title: string;
  value: string;
  description: string;
  tone: HomeTone;
}

export interface HomeNextAction {
  kind: "novel" | "starter";
  eyebrow: string;
  title: string;
  description: string;
  reason: string;
  tone: HomeTone;
}

export function getHomeNovelTask(novel: HomeNovelItem) {
  if (isHomeV2Novel(novel)) return null;
  return novel.narrativeForm === "short_story"
    ? novel.latestCreationStudioTask ?? null
    : novel.latestAutoDirectorTask ?? null;
}

export function isHomeV2Novel(novel: HomeNovelItem): boolean {
  return novel.narrativeForm !== "short_story" && (novel.directorVersion === "v2" || !!getDirectorWorkspaceHref(novel));
}

export function getHomeWrittenChapters(novel: HomeNovelItem): number {
  return novel.bookProgress?.writtenChapters ?? (isHomeV2Novel(novel) ? 0 : novel._count.chapters);
}

function isHomeRunning(novel: HomeNovelItem): boolean {
  if (isHomeV2Novel(novel)) return ["queued", "running"].includes(novel.bookProgress?.director?.status ?? "");
  const task = getHomeNovelTask(novel);
  return getNovelWorkflowAttention(task) !== "recovery" && isWorkflowRunningInBackground(task);
}

function isHomeActionRequired(novel: HomeNovelItem): boolean {
  if (isHomeV2Novel(novel)) return ["paused", "waiting_gate", "failed"].includes(novel.bookProgress?.director?.status ?? "");
  const task = getHomeNovelTask(novel);
  return getNovelWorkflowAttention(task) === "recovery" || isWorkflowActionRequired(task);
}

export function getHomeNovelActionHref(novel: HomeNovelItem): string | null {
  if (isHomeV2Novel(novel)) return getDirectorWorkspaceHref(novel);
  const task = getHomeNovelTask(novel);
  if (task && requiresCandidateSelection(task)) return getCandidateSelectionLink(task.id);
  return getNovelWorkspaceHref(novel);
}

function canHomeWrite(novel: HomeNovelItem): boolean {
  if (isHomeV2Novel(novel)) return novel.bookProgress?.director?.status === "completed"
    && (!novel.bookProgress.targetChapters || getHomeWrittenChapters(novel) < novel.bookProgress.targetChapters);
  return novel.narrativeForm === "short_story" ? getHomeNovelTask(novel)?.status === "succeeded"
    : canEnterChapterExecution(getHomeNovelTask(novel));
}

export function formatHomeDate(value: string | undefined): string {
  if (!value) {
    return "Sin datos";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Sin datos";
  }
  return date.toLocaleString();
}

export function getNovelPriorityScore(novel: HomeNovelItem): number {
  if (isHomeV2Novel(novel)) return isHomeActionRequired(novel) ? 0 : isHomeRunning(novel) ? 3 : canHomeWrite(novel) ? 4 : 6;
  const task = getHomeNovelTask(novel);
  if (getNovelWorkflowAttention(task) === "recovery" || canContinueChapterBatchAutoExecution(task)) {
    return 0;
  }
  if (requiresCandidateSelection(task)) {
    return 1;
  }
  if (canContinueDirector(task)) {
    return 2;
  }
  if (task?.status === "running" || task?.status === "queued") {
    return 3;
  }
  if (canEnterChapterExecution(task)) {
    return 4;
  }
  if (task?.status === "failed" || task?.status === "cancelled") {
    return 5;
  }
  return 6;
}

export function getNovelLeadSummary(novel: HomeNovelItem): string {
  if (isHomeV2Novel(novel)) return "Entra en el escritorio del director de novelas para comprobar la planificación, el texto y el avance de esta creación.";
  const workflowDescription = getWorkflowDescription(getHomeNovelTask(novel));
  if (workflowDescription) {
    return workflowDescription;
  }
  if (novel.description?.trim()) {
    return novel.description.trim();
  }
  if (novel.world?.name) {
    return `El proyecto actual está ligado a la cosmovisión "${novel.world.name}”, puedes seguir creando.`;
  }
  return "El proyecto actual no tiene introducción. Puedes ingresar a la página de edición para seguir progresando.";
}

export function selectPrimaryNovel(novels: HomeNovelItem[]): HomeNovelItem | null {
  if (novels.length === 0) {
    return null;
  }
  return novels.reduce<HomeNovelItem | null>((selected, current) => {
    if (!selected) {
      return current;
    }
    const selectedPriority = getNovelPriorityScore(selected);
    const currentPriority = getNovelPriorityScore(current);
    return currentPriority < selectedPriority ? current : selected;
  }, null);
}

export function buildHomeNextAction(primaryNovel: HomeNovelItem | null): HomeNextAction {
  if (!primaryNovel) {
    return {
      kind: "starter",
      eyebrow: "Empezar la primera novela",
      title: "Elige el primer método creativo que más te convenga",
      description: "Si desea completar una función, puede dejar que el director automático prepare toda la estructura; Si quieres ver la obra completa más rápido, puedes empezar directamente desde el cuento.",
      reason: "Ambos métodos solo requieren que primero expongas una idea vaga, y la IA continuará ayudándote a organizar tu dirección creativa.",
      tone: "info",
    };
  }

  const task = getHomeNovelTask(primaryNovel);
  if (isHomeV2Novel(primaryNovel)) {
    const status = primaryNovel.bookProgress?.director?.status;
    const action = status === "waiting_gate" ? "Confirmar los resultados de esta etapa." : isHomeActionRequired(primaryNovel) || status === "cancelled"
      ? "Ver pausas creativas" : isHomeRunning(primaryNovel) ? "Ver el progreso de la creación"
      : primaryNovel.bookProgress?.targetChapters && getHomeWrittenChapters(primaryNovel) >= primaryNovel.bookProgress.targetChapters
        ? "Leer y comprobar el texto." : "Seguir escribiendo novelas";
    return {kind: "novel", eyebrow: "Siguiente paso recomendado", title: action, description: getNovelLeadSummary(primaryNovel),
      reason: "Verifique los resultados de guardado, los recordatorios de calidad y el alcance de los capítulos posteriores en el escritorio del director del libro antes de continuar con la creación.",
      tone: isHomeActionRequired(primaryNovel) ? "warning" : "info"};
  }
  if (primaryNovel.narrativeForm === "short_story") {
    return {
      kind: "novel",
      eyebrow: task?.status === "succeeded" ? "Trabajo completo" : "Creación en curso",
      title: task?.status === "succeeded" ? "Continuar mejorando este trabajo." : "Consultar el progreso del manuscrito.",
      description: getNovelLeadSummary(primaryNovel),
      reason: task?.status === "succeeded"
        ? "El trabajo ha sido completamente generado y se puede leer, editar, modificar o exportar directamente."
        : "La historia corta se escribe en un trabajo continuo en segundo plano y puedes ver el progreso en tiempo real después de abrirla.",
      tone: task?.status === "succeeded" ? "success" : "info",
    };
  }
  if (getNovelWorkflowAttention(task) === "recovery" || canContinueChapterBatchAutoExecution(task)) {
    return {
      kind: "novel",
      eyebrow: "Siguiente paso recomendado",
      title: "Reanudar la creación de capítulos",
      description: getNovelLeadSummary(primaryNovel),
      reason: "El lote de capítulos se detiene en el nodo reanudable. Reanudar la ejecución primero puede volver a la producción de texto lo más rápido posible.",
      tone: "danger",
    };
  }
  if (requiresCandidateSelection(task)) {
    return {
      kind: "novel",
      eyebrow: "Siguiente paso recomendado",
      title: "Confirmar la dirección general de la historia.",
      description: getNovelLeadSummary(primaryNovel),
      reason: "Después de confirmar la dirección, el sistema puede continuar preparando la visión del mundo, los personajes y el plan de ejecución del capítulo.",
      tone: "warning",
    };
  }
  if (canContinueDirector(task)) {
    return {
      kind: "novel",
      eyebrow: "Siguiente paso recomendado",
      title: "Continuar preparando toda la novela.",
      description: getNovelLeadSummary(primaryNovel),
      reason: "La etapa actual está a la espera de confirmación. Después de continuar, avanzará a la siguiente etapa de preparación del ejecutable.",
      tone: "warning",
    };
  }
  if (task?.status === "running" || task?.status === "queued") {
    return {
      kind: "novel",
      eyebrow: "Creación de IA en progreso",
      title: "Ver el progreso de la creación",
      description: getNovelLeadSummary(primaryNovel),
      reason: "La ejecución automática del director o capítulo todavía se está procesando en segundo plano y se pueden ver el progreso y las etapas recientes.",
      tone: "info",
    };
  }
  if (canEnterChapterExecution(task)) {
    return {
      kind: "novel",
      eyebrow: "Siguiente paso recomendado",
      title: "Comience a crear un capítulo",
      description: getNovelLeadSummary(primaryNovel),
      reason: "Los activos de planificación ya pueden respaldar la producción de capítulos y pueden ingresar a la generación y revisión del texto.",
      tone: "success",
    };
  }
  if (task?.status === "failed" || task?.status === "cancelled") {
    return {
      kind: "novel",
      eyebrow: "Requiere atención",
      title: "Manejar las interrupciones creativas",
      description: getNovelLeadSummary(primaryNovel),
      reason: "Hay constancia de suspensión o fracaso de la tarea. Verifique los detalles antes de decidir reanudar, reintentar o ajustar.",
      tone: "danger",
    };
  }
  return {
    kind: "novel",
    eyebrow: "Siguiente paso recomendado",
    title: "Continuar mejorando la novela.",
    description: getNovelLeadSummary(primaryNovel),
    reason: "Si no hay elementos de bloqueo con mayor prioridad, puede regresar a la página de inicio del proyecto para continuar mejorando los materiales o capítulos.",
    tone: "neutral",
  };
}

export function buildHomeMetrics(input: {
  novels: HomeNovelItem[];
  taskOverview?: TaskOverviewSummary | null;
}): HomeMetric[] {
  const liveWorkflowCount = input.novels.filter((novel) => (
    isHomeRunning(novel)
  )).length;
  const actionRequiredCount = input.novels.filter((novel) => (
    isHomeActionRequired(novel)
  )).length;
  const readyForExecutionCount = input.novels.filter((novel) => (
    canHomeWrite(novel)
  )).length;
  const totalChapterCount = input.novels.reduce((sum, novel) => sum + getHomeWrittenChapters(novel), 0);

  return [
    {
      id: "running",
      title: "Actualmente creando",
      value: liveWorkflowCount,
      hint: "La novela o capítulo que avanza la IA.",
      tone: "info",
    },
    {
      id: "attention",
      title: "Esperando tu confirmación",
      value: actionRequiredCount,
      hint: "Después de la confirmación, puede continuar creando el proyecto.",
      tone: actionRequiredCount > 0 ? "warning" : "success",
    },
    {
      id: "chapter-ready",
      title: "Puedes empezar a escribir",
      value: readyForExecutionCount,
      hint: "La historia está bien preparada y se puede introducir en el texto.",
      tone: readyForExecutionCount > 0 ? "success" : "neutral",
    },
    {
      id: "chapters",
      title: "El texto ha sido escrito.",
      value: totalChapterCount,
      hint: "Una acumulación continua de capítulos en todas las obras.",
      tone: totalChapterCount > 0 ? "info" : "neutral",
    },
  ];
}

export function buildHomeAttentionItems(
  novels: HomeNovelItem[],
  primaryNovelId?: string,
): HomeAttentionItem[] {
  return novels.filter((novel) => novel.id !== primaryNovelId && isHomeActionRequired(novel)).map((novel) => {
    const task = getHomeNovelTask(novel);
    const status = isHomeV2Novel(novel) ? novel.bookProgress?.director?.status : task?.status;
    const to = getHomeNovelActionHref(novel);
    const description = status === "waiting_gate" || getNovelWorkflowAttention(task) === "confirmation"
      ? "A la espera de confirmación de los resultados de esta etapa."
      : status === "failed" ? "La creación se interrumpe, abre el trabajo para comprobar el método de recuperación."
        : status === "cancelled" ? "Esta creación ha sido cancelada." : "La creación ha sido suspendida. Abra el trabajo para ver el motivo de la suspensión.";
    return {
      id: novel.id,
      title: novel.title,
      description: to ? description : `${description}. La entrada de creación no está disponible temporalmente, lea de nuevo.`,
      tone: status === "failed" ? "danger" : "warning",
      to: to ?? undefined,
      actionLabel: isHomeV2Novel(novel) ? "Abre el escritorio del director." : "Trabajo abierto",
    };
  });
}

export function buildHomeAssetHealthItems(novels: HomeNovelItem[]): HomeAssetHealthItem[] {
  const totalNovels = novels.length;
  const worldBoundCount = novels.filter((novel) => Boolean(novel.world?.id || novel.worldId)).length;
  const totalCharacters = novels.reduce((sum, novel) => sum + novel._count.characters, 0);
  const totalChapters = novels.reduce((sum, novel) => sum + getHomeWrittenChapters(novel), 0);
  const resourceScores = novels
    .map((novel) => novel.resourceReadyScore)
    .filter((score): score is number => typeof score === "number" && Number.isFinite(score));
  const averageResourceScore = resourceScores.length > 0
    ? Math.round(resourceScores.reduce((sum, score) => sum + score, 0) / resourceScores.length)
    : null;

  return [
    {
      id: "world",
      title: "Cobertura de visión mundial",
      value: totalNovels > 0 ? `${worldBoundCount}/${totalNovels}` : "0",
      description: totalNovels > 0
        ? "Los elementos que vinculan una visión del mundo hacen que sea más fácil mantener la coherencia de las reglas en los capítulos siguientes."
        : "Después de crear una novela, el estado del activo de la visión del mundo se mostrará aquí.",
      tone: totalNovels === 0 ? "neutral" : worldBoundCount === totalNovels ? "success" : "warning",
    },
    {
      id: "characters",
      title: "Activos de carácter",
      value: String(totalCharacters),
      description: "La cantidad de caracteres se utiliza para determinar si el proyecto tiene los activos básicos para generarse continuamente.",
      tone: totalCharacters > 0 ? "success" : "warning",
    },
    {
      id: "chapters",
      title: "Precipitación del capítulo",
      value: String(totalChapters),
      description: "Cuantos más capítulos tengas, más necesitarás una alimentación constante de resúmenes, hechos y líneas de tiempo de los personajes.",
      tone: totalChapters > 0 ? "info" : "neutral",
    },
    {
      id: "readiness",
      title: "Preparación de recursos",
      value: averageResourceScore == null ? "--" : `${averageResourceScore}`,
      description: "La señal promedio de la disponibilidad de los datos del proyecto se utiliza para ayudar a juzgar la base para la apertura y la redacción.",
      tone: averageResourceScore == null
        ? "neutral"
        : averageResourceScore >= 80
          ? "success"
          : averageResourceScore >= 50
            ? "warning"
            : "danger",
    },
  ];
}
