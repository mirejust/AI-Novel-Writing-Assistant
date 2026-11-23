import type {
  DirectorTaskSnapshot,
} from "@ai-novel/shared/types/directorRuntime";
import type {
  DirectorAutoExecutionPlan,
  DirectorRunMode,
  DirectorTakeoverEntryReadiness,
  DirectorTakeoverEntryStep,
  DirectorTakeoverPreview,
  DirectorTakeoverReadinessResponse,
  DirectorTakeoverStrategy,
} from "@ai-novel/shared/types/novelDirector";

type TakeoverScopeMode = "book" | "chapter_range" | "volume";

export interface TakeoverGuidanceViewModel {
  diagnosis: string;
  nextStep: string;
  protectionNotes: string[];
  riskLevel: "safe" | "caution";
  actionLabel: string;
}

export interface TakeoverProgressCard {
  title: string;
  status: string;
  detail: string;
}

export interface TakeoverProgressInspectionViewModel {
  cards: TakeoverProgressCard[];
  summary: string;
}

export interface TakeoverChapterTargetViewModel {
  startOrder: number;
  maxOrder: number;
  selectedOrder: number;
  plan: DirectorAutoExecutionPlan;
  actionLabel: string;
  summary: string;
}

export interface TakeoverContinuousTargetViewModel {
  startOrder: number;
  currentWindowEndOrder: number;
  targetOrder: number;
  selectedOrder: number;
  actionLabel: string;
  summary: string;
}

const ENTRY_STEP_USER_LABELS: Record<DirectorTakeoverEntryStep, string> = {
  basic: "Configuración del proyecto",
  story_macro: "Gran plan de historia",
  world: "Preparación de la cosmovisión",
  character: "Preparación de personajes",
  outline: "Planificación de volumen",
  structured: "Capítulo para romper el ritmo",
  chapter: "Ejecución del capítulo",
  pipeline: "Arreglo de calidad",
};

const RUN_MODE_ACTION_LABELS: Record<DirectorRunMode, string> = {
  auto_to_ready: "Continúa avanzando hasta que puedas empezar a escribir.",
  auto_to_execution: "Continuar por alcance",
  full_book_autopilot: "Toma el control de todo el libro y sigue adelante.",
  stage_review: "Sigue adelante",
};

export function isTakeoverEntryStepAllowedForScope(
  entryStep: DirectorTakeoverEntryStep,
  scopeMode: TakeoverScopeMode,
): boolean {
  if (scopeMode === "chapter_range") {
    return entryStep === "structured" || entryStep === "chapter" || entryStep === "pipeline";
  }
  if (scopeMode === "volume") {
    return entryStep === "outline" || entryStep === "structured" || entryStep === "chapter" || entryStep === "pipeline";
  }
  return true;
}

export function resolveRecommendedTakeoverEntryStep(
  readiness: DirectorTakeoverReadinessResponse | null,
  scopeMode: TakeoverScopeMode,
): DirectorTakeoverEntryStep | null {
  if (!readiness) {
    return null;
  }
  const allowed = (entry: DirectorTakeoverEntryReadiness) => (
    entry.available && isTakeoverEntryStepAllowedForScope(entry.step, scopeMode)
  );
  return (
    readiness.entrySteps.find((entry) => entry.recommended && allowed(entry))
    ?? readiness.entrySteps.find(allowed)
    ?? null
  )?.step ?? null;
}

export function findTakeoverPreview(
  readiness: DirectorTakeoverReadinessResponse | null,
  entryStep: DirectorTakeoverEntryStep,
  strategy: DirectorTakeoverStrategy,
): DirectorTakeoverPreview | null {
  return readiness?.entrySteps
    .find((entry) => entry.step === entryStep)
    ?.previews.find((preview) => preview.strategy === strategy) ?? null;
}

export function buildTakeoverGuidance(
  readiness: DirectorTakeoverReadinessResponse | null,
  entryStep: DirectorTakeoverEntryStep,
  strategy: DirectorTakeoverStrategy,
  runMode: DirectorRunMode,
  taskSnapshot?: DirectorTaskSnapshot | null,
): TakeoverGuidanceViewModel {
  const task = taskSnapshot?.task ?? null;
  const chapterProgress = taskSnapshot?.chapterProgress ?? taskSnapshot?.projection?.chapterExecutionProgress ?? null;
  if (task && (task.status === "queued" || task.status === "running" || task.status === "waiting_approval")) {
    const currentStage = task.currentStage?.trim() || taskSnapshot?.displayState.stageLabel || "Tarea actual";
    const currentLabel = task.currentItemLabel?.trim() || taskSnapshot?.displayState.currentAction || "Espera para continuar";
    const nextChapterOrder = chapterProgress?.currentChapterOrder ?? chapterProgress?.activeChapterOrder ?? null;
    return {
      diagnosis: `Actualmente hay tareas de director estacionadas en "${currentStage}».`,
      nextStep: nextChapterOrder
        ? `El sistema detecta que la ejecución del capítulo ha avanzado al ${nextChapterOrder} El capítulo está cerca, se recomienda volver a la tarea actual para continuar.`
        : `Estado actual de la tarea:${currentLabel}.`,
      protectionNotes: [
        `Estado de la tarea:${task.status}`,
        currentLabel,
        "Continuar con la tarea actual no abrirá una nueva adquisición duplicada.",
      ],
      riskLevel: "safe",
      actionLabel: "Ingrese la tarea actual",
    };
  }
  if (!readiness) {
    return {
      diagnosis: "Se está leyendo el progreso del proyecto. Una vez completada la lectura, se proporcionará la ubicación de conexión recomendada.",
      nextStep: "Una vez completada la lectura, puede continuar.",
      protectionNotes: ["Los activos de escritura existentes se conservan de forma predeterminada."],
      riskLevel: "safe",
      actionLabel: RUN_MODE_ACTION_LABELS[runMode] ?? "Sigue adelante",
    };
  }
  const preview = findTakeoverPreview(readiness, entryStep, strategy);
  const entryLabel = ENTRY_STEP_USER_LABELS[preview?.effectiveStep ?? entryStep] ?? "Ubicación recomendada";
  const hasCharacters = readiness.snapshot.characterCount > 0;
  const hasVolumes = readiness.snapshot.volumeCount > 0;
  const hasChapters = readiness.snapshot.chapterCount > 0;
  const protectionNotes = [
    hasCharacters ? `mantener creado ${readiness.snapshot.characterCount} activos del personaje.` : "Si no se detecta ningún personaje creado, la IA compensará la preparación del personaje.",
    hasVolumes ? "Utilice los volúmenes existentes para planificar los activos y solo compense las brechas posteriores." : "No se detectan planes de volumen y la IA continúa generando planes de volumen.",
    hasChapters ? `Mantener existente ${readiness.snapshot.chapterCount} Texto del capítulo o recursos del capítulo.` : "No se detectó ningún cuerpo generado.",
  ];
  const riskLevel = strategy === "restart_current_step" ? "caution" : "safe";
  return {
    diagnosis: `El sistema detecta que los artículos se pueden obtener de "${entryLabel}“Tómalo.`,
    nextStep: preview?.summary ?? `La IA comenzará desde "${entryLabel}"Sigue empujando".`,
    protectionNotes,
    riskLevel,
    actionLabel: buildPrimaryActionLabel({
      fallback: RUN_MODE_ACTION_LABELS[runMode] ?? "Sigue adelante",
      taskSnapshot,
      readiness,
    }),
  };
}

function formatRatio(done: number, total: number): string {
  if (total <= 0) {
    return done > 0 ? `${done} artículo` : "Sin datos";
  }
  return `${done} / ${total}`;
}

function buildPrimaryActionLabel(input: {
  fallback: string;
  taskSnapshot?: DirectorTaskSnapshot | null;
  readiness?: DirectorTakeoverReadinessResponse | null;
}): string {
  const progress = input.taskSnapshot?.chapterProgress
    ?? input.taskSnapshot?.projection?.chapterExecutionProgress
    ?? null;
  if (progress?.currentChapterOrder) {
    return `continuar escribiendo ${progress.currentChapterOrder}`;
  }
  const drafted = progress?.draftedChapterCount ?? input.readiness?.snapshot.generatedChapterCount ?? 0;
  const approved = progress?.approvedChapterCount ?? input.readiness?.snapshot.approvedChapterCount ?? 0;
  if (drafted > approved) {
    return "Capítulos del proceso por confirmar";
  }
  if ((input.readiness?.snapshot.chapterCount ?? 0) > 0) {
    return "Continuar la ejecución del capítulo";
  }
  return input.fallback;
}

function normalizePositiveOrder(value: number | null | undefined): number | null {
  if (!Number.isFinite(value ?? NaN) || !value || value < 1) {
    return null;
  }
  return Math.max(1, Math.round(value));
}

function maxNormalizedOrder(values: Array<number | null | undefined>): number | null {
  const normalized = values
    .map(normalizePositiveOrder)
    .filter((value): value is number => Boolean(value));
  if (normalized.length === 0) {
    return null;
  }
  return Math.max(...normalized);
}

export function buildTakeoverChapterTarget(
  readiness: DirectorTakeoverReadinessResponse | null,
  taskSnapshot?: DirectorTaskSnapshot | null,
  selectedOrder?: number | null,
): TakeoverChapterTargetViewModel | null {
  const progress = taskSnapshot?.chapterProgress
    ?? taskSnapshot?.projection?.chapterExecutionProgress
    ?? null;
  const snapshot = readiness?.snapshot ?? null;
  const writtenChapterCount = maxNormalizedOrder([
    progress?.draftedChapterCount,
    progress?.completedChapters,
    snapshot?.generatedChapterCount,
  ]);
  const startOrder = maxNormalizedOrder([
    progress?.currentChapterOrder
      ?? null,
    progress?.activeChapterOrder
      ?? null,
    readiness?.executableRange?.nextChapterOrder
      ?? null,
    writtenChapterCount ? writtenChapterCount + 1 : null,
    snapshot?.approvedChapterCount ? snapshot.approvedChapterCount + 1 : null,
  ]);
  const totalChapters = maxNormalizedOrder([
    progress?.totalChapters
      ?? null,
    snapshot?.plannedChapterCount
      ?? null,
    readiness?.executableRange?.endOrder
      ?? null,
    snapshot?.chapterCount
      ?? null,
    snapshot?.firstVolumeChapterCount
      ?? null,
  ]);
  if (!startOrder || !totalChapters || startOrder > totalChapters) {
    return null;
  }
  const normalizedSelected = normalizePositiveOrder(selectedOrder ?? null);
  const selected = normalizedSelected
    ? Math.min(Math.max(normalizedSelected, startOrder), totalChapters)
    : startOrder;
  const plan: DirectorAutoExecutionPlan = {
    mode: "chapter_range",
    startOrder,
    endOrder: selected,
    autoReview: true,
    autoRepair: true,
  };
  return {
    startOrder,
    maxOrder: totalChapters,
    selectedOrder: selected,
    plan,
    actionLabel: `Avanzar a la ${selected}`,
    summary: selected === startOrder
      ? `desde el primero ${startOrder} El capítulo sigue avanzando.`
      : `desde el primero ${startOrder} Comienzo del capítulo, continúa avanzando al capítulo. ${selected} capítulo.`,
  };
}

export function buildTakeoverContinuousTarget(
  readiness: DirectorTakeoverReadinessResponse | null,
  taskSnapshot?: DirectorTaskSnapshot | null,
  selectedOrder?: number | null,
): TakeoverContinuousTargetViewModel | null {
  const currentWindow = readiness
    ? buildTakeoverChapterTarget({
      ...readiness,
      snapshot: { ...readiness.snapshot, plannedChapterCount: null },
    }, taskSnapshot)
    : null;
  const targetOrder = normalizePositiveOrder(readiness?.snapshot.plannedChapterCount ?? null);
  if (!currentWindow || !targetOrder || targetOrder <= currentWindow.maxOrder) {
    return null;
  }
  const normalizedSelected = normalizePositiveOrder(selectedOrder ?? null);
  const resolvedSelected = normalizedSelected
    ? Math.min(Math.max(normalizedSelected, currentWindow.startOrder), targetOrder)
    : targetOrder;
  return {
    startOrder: currentWindow.startOrder,
    currentWindowEndOrder: currentWindow.maxOrder,
    targetOrder,
    selectedOrder: resolvedSelected,
    actionLabel: resolvedSelected === targetOrder ? `Continúe avanzando hasta el ${targetOrder}` : `Avanzar a la ${resolvedSelected}`,
    summary: resolvedSelected === targetOrder
      ? `Avanzar primero ${currentWindow.startOrder}-${currentWindow.maxOrder} Capítulo; Al acercarse al final del rango, la IA complementará el esqueleto de los volúmenes posteriores y los capítulos recientes, y no generará tareas de capítulos futuros por adelantado.`
      : `Esta vez solo la primera ${currentWindow.startOrder}-${resolvedSelected} Capítulo; Puedes continuar desde el progreso actual después, y el número estimado de capítulos es ${targetOrder} capítulo.`,
  };
}

export function buildTakeoverProgressInspection(
  readiness: DirectorTakeoverReadinessResponse | null,
  taskSnapshot?: DirectorTaskSnapshot | null,
): TakeoverProgressInspectionViewModel {
  const factSummary = taskSnapshot?.factSummary ?? taskSnapshot?.projection?.factSummary ?? null;
  const outline = factSummary?.outlineFacts ?? null;
  const chapterFacts = factSummary?.chapterExecutionFacts ?? null;
  const repairFacts = factSummary?.repairFacts ?? null;
  const chapterProgress = taskSnapshot?.chapterProgress ?? taskSnapshot?.projection?.chapterExecutionProgress ?? null;
  const snapshot = readiness?.snapshot ?? null;
  const volumeRanges = snapshot?.volumeChapterRanges ?? [];
  const syncedChapterCount = outline?.syncedChapterCount ?? snapshot?.chapterCount ?? 0;
  const plannedChapterCount = outline?.plannedChapterCount ?? snapshot?.chapterCount ?? chapterProgress?.totalChapters ?? 0;
  const selectedChapterCount = outline?.selectedChapterCount ?? readiness?.executableRange?.totalChapterCount ?? 0;
  const detailDone = outline?.completedDetailSteps ?? snapshot?.firstVolumePreparedChapterCount ?? 0;
  const detailTotal = outline?.totalDetailSteps ?? selectedChapterCount;
  const drafted = chapterProgress?.draftedChapterCount ?? chapterFacts?.draftedChapterCount ?? snapshot?.generatedChapterCount ?? 0;
  const approved = chapterProgress?.approvedChapterCount ?? chapterFacts?.approvedChapterCount ?? snapshot?.approvedChapterCount ?? 0;
  const reviewed = chapterFacts?.reviewedChapterCount ?? repairFacts?.reviewedChapterCount ?? 0;
  const pendingRepair = chapterProgress?.needsRepairChapters ?? chapterFacts?.needsRepairChapters ?? snapshot?.pendingRepairChapterCount ?? 0;
  const nextChapterOrder = chapterProgress?.currentChapterOrder ?? readiness?.executableRange?.nextChapterOrder ?? null;

  const cards: TakeoverProgressCard[] = [
    {
      title: "Progreso de la planificación del volumen",
      status: factSummary?.hasVolumeStrategy || (snapshot?.volumeCount ?? 0) > 0 ? "Ya tengo estrategia de volumen" : "Estrategia de papel por reponer",
      detail: snapshot
        ? `${snapshot.volumeCount} Volumen; capítulo del volumen actual ${snapshot.firstVolumeChapterCount} capítulo; alcance eliminado ${volumeRanges.map((range) => `Cap.${range.startOrder}-${range.endOrder}Cap.`).join(",") || "Sin datos"}`
        : "Plan de volumen de lectura.",
    },
    {
      title: "Progreso de apertura y sincronización del capítulo.",
      status: formatRatio(syncedChapterCount, plannedChapterCount),
      detail: selectedChapterCount > 0
        ? `Alcance ejecutable actual ${readiness?.executableRange?.startOrder ?? 1}-${readiness?.executableRange?.endOrder ?? selectedChapterCount} capítulo.`
        : "Aún no se ha detectado ningún rango de capítulos ejecutables.",
    },
    {
      title: "Progreso del refinamiento del capítulo",
      status: formatRatio(detailDone, detailTotal),
      detail: outline?.chapterDetailReady || detailDone > 0
        ? `Preparado ${detailDone} Tareas del capítulo/recursos de ejecución.`
        : "Aún no se han detectado recursos de refinamiento de capítulos.",
    },
    {
      title: "Progreso del texto y la calidad.",
      status: formatRatio(drafted, chapterProgress?.totalChapters ?? chapterFacts?.totalChapters ?? plannedChapterCount),
      detail: [
        reviewed > 0 ? `Revisado ${reviewed}` : "",
        approved > 0 ? `Aprobado ${approved}` : "",
        pendingRepair > 0 ? `Pendiente ${pendingRepair}` : "",
        nextChapterOrder ? `Siguiente capítulo ${nextChapterOrder}` : "",
      ].filter(Boolean).join(";") || "La producción del texto aún no ha comenzado.",
    },
  ];

  return {
    cards,
    summary: taskSnapshot?.task
      ? `Tareas actuales:${taskSnapshot.task.currentStage || taskSnapshot.displayState.stageLabel || "Director automático"} / ${taskSnapshot.task.currentItemLabel || taskSnapshot.displayState.currentAction || "Espera para continuar"}`
      : "El siguiente es el avance de los activos detectados en el proyecto actual.",
  };
}

export function formatTakeoverStartError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error || "");
  if (message.includes("El alcance del capítulo solo puede comenzar con la división del tiempo, la ejecución del capítulo o correcciones de calidad.")) {
    return "El proyecto actual no ha entrado en la etapa de producción del capítulo y no puede continuar directamente desde el alcance del capítulo. Se recomienda utilizar las ubicaciones recomendadas por el sistema para seguir avanzando.";
  }
  if (message.includes("Actualmente existe una tarea de director automática.")) {
    return "Actualmente hay una tarea de director automática que procesa este libro. Ingrese la tarea actual para continuar o cancelar antes de asumir el control.";
  }
  return message || "No se pudo iniciar la toma de control automática del director.";
}
