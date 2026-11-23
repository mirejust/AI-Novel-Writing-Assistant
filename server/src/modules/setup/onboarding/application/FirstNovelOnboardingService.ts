import type {
  FirstNovelMilestone,
  FirstNovelMilestoneKey,
  FirstNovelOnboardingProjection,
} from "@ai-novel/shared/types/onboarding";
import type { NovelWorkflowCheckpoint } from "@ai-novel/shared/types/novelWorkflow";
import type { TaskStatus } from "@ai-novel/shared/types/task";
import { prisma } from "../../../../db/prisma";
import { getQuickSetupStatus } from "./QuickSetupService";

const MILESTONE_DEFINITIONS: Array<Pick<FirstNovelMilestone, "key" | "title" | "description">> = [
  { key: "environment", title: "ambiente creativo", description: "Configure un modelo de texto que pueda completar la planificación, el texto y la revisión." },
  { key: "idea_direction", title: "inspiración y dirección", description: "Escribe una frase de inspiración y elige un conjunto de instrucciones dadas por la IA." },
  { key: "preparation", title: "Listo para abrir el libro", description: "La IA prepara la historia, el mundo, los personajes, la planificación de capítulos y los recursos de ejecución." },
  { key: "production_choice", title: "método de producción", description: "Elija IA para continuar escribiendo un libro completo o ingrese a un banco de trabajo profesional." },
  { key: "first_chapter", title: "Primer capítulo completado.", description: "Una vez completado el primer capítulo, abra el texto principal y comience a leer." },
];

function milestoneIndex(key: FirstNovelMilestoneKey): number {
  return MILESTONE_DEFINITIONS.findIndex((item) => item.key === key);
}

function buildMilestones(
  current: FirstNovelMilestoneKey,
  attention: boolean,
  summaries: Partial<Record<FirstNovelMilestoneKey, string>>,
): FirstNovelMilestone[] {
  const currentIndex = milestoneIndex(current);
  return MILESTONE_DEFINITIONS.map((item, index) => ({
    ...item,
    status: index < currentIndex
      ? "completed"
      : index === currentIndex
        ? attention ? "attention" : "current"
        : "pending",
    resultSummary: summaries[item.key] ?? null,
  }));
}

export async function getFirstNovelOnboardingProjection(): Promise<FirstNovelOnboardingProjection> {
  const [setup, firstReadableChapter, latestTask, latestNovel] = await Promise.all([
    getQuickSetupStatus(),
    prisma.chapter.findFirst({
      where: {
        content: { not: "" },
        OR: [
          { chapterStatus: "completed" },
          { generationState: { in: ["approved", "published"] } },
        ],
      },
      orderBy: [{ updatedAt: "desc" }, { order: "asc" }],
      select: {
        id: true,
        title: true,
        order: true,
        novelId: true,
        novel: {
          select: {
            id: true,
            title: true,
            creationExperience: true,
          },
        },
      },
    }),
    prisma.novelWorkflowTask.findFirst({
      where: { lane: "auto_director" },
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      select: {
        id: true,
        novelId: true,
        status: true,
        checkpointType: true,
        currentStage: true,
        currentItemLabel: true,
        lastError: true,
        novel: {
          select: {
            id: true,
            title: true,
            creationExperience: true,
          },
        },
      },
    }),
    prisma.novel.findFirst({
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      select: {
        id: true,
        title: true,
        creationExperience: true,
      },
    }),
  ]);

  const task = latestTask ? {
    id: latestTask.id,
    status: latestTask.status as TaskStatus,
    checkpointType: latestTask.checkpointType as NovelWorkflowCheckpoint | null,
    currentStage: latestTask.currentStage,
    currentItemLabel: latestTask.currentItemLabel,
    lastError: latestTask.lastError,
  } : null;
  const novel = latestTask?.novel ?? firstReadableChapter?.novel ?? latestNovel ?? null;
  const isAttention = latestTask?.status === "failed"
    || latestTask?.status === "cancelled"
    || Boolean(latestTask?.lastError);
  const summaries: Partial<Record<FirstNovelMilestoneKey, string>> = {
    ...(setup.readyForCreation ? { environment: `${setup.selectedProvider ?? "Modelo"} · ${setup.selectedModel ?? "Disponible"}` } : {}),
    ...(novel ? { idea_direction: `«${novel.title}»` } : {}),
    ...(latestTask?.novelId ? { preparation: latestTask.currentItemLabel ?? "Se están preparando recursos de libro abierto." } : {}),
    ...(novel?.creationExperience ? {
      production_choice: novel.creationExperience === "simple" ? "Fácil creación" : "Creación profesional",
    } : {}),
    ...(firstReadableChapter ? { first_chapter: `«${firstReadableChapter.title}"Legible` } : {}),
  };

  let currentMilestone: FirstNovelMilestoneKey = "environment";
  let headline = "Complete una configuración rápida primero";
  let description = "Solo se necesita un modelo de texto disponible y el sistema preparará automáticamente el enrutamiento de tareas para toda la cadena de creación.";
  let reason = "La dirección automática, la generación de texto y la revisión requieren conexiones de modelo estables.";
  let primaryAction: FirstNovelOnboardingProjection["primaryAction"] = {
    label: "Modelo de configuración rápida",
    route: "/help",
    kind: "open_quick_setup",
  };

  if (setup.readyForCreation) {
    currentMilestone = "idea_direction";
    headline = "Comienza tu primera novela con una línea de inspiración.";
    description = "No es necesario escribir un esquema primero, la IA seleccionará dos conjuntos completos de instrucciones para que usted elija.";
    reason = "Es más importante confirmar primero la dirección de todo el libro que vale la pena seguir escribiendo que completar una gran cantidad de entornos profesionales.";
    primaryAction = {
      label: "Deja que la IA me ayude a empezar",
      route: "/novels/auto-director",
      kind: "navigate",
    };
  }

  if (setup.readyForCreation && latestTask) {
    if (latestTask.checkpointType === "candidate_selection_required" || !latestTask.novelId) {
      primaryAction = {
        label: latestTask.checkpointType === "candidate_selection_required" ? "Elige la dirección del libro." : "Ver el progreso de generación de dirección",
        route: `/novels/auto-director?taskId=${latestTask.id}`,
        kind: "navigate",
      };
      headline = latestTask.checkpointType === "candidate_selection_required"
        ? "Elija la dirección que más desea leer"
        : "La IA está preparando la dirección de todo el libro.";
      description = latestTask.currentItemLabel ?? "Una vez completada la orientación, solo debes elegir una de las dos opciones.";
      reason = "Esta elección determinará el protagonista, el conflicto central y las principales expectativas de lectura de todo el libro.";
    } else if (latestTask.checkpointType === "production_experience_required") {
      currentMilestone = "production_choice";
      headline = "El libro está listo para ser abierto y se selecciona el método de producción del texto.";
      description = "La creación simple seguirá escribiendo el libro completo; La creación profesional entrará en el banco de trabajo editable completo.";
      reason = "La historia, los personajes y los recursos de los capítulos están todos listos, pero el texto principal aún no se ha iniciado.";
      primaryAction = {
        label: "Elija el método de producción",
        route: `/novels/${latestTask.novelId}/edit`,
        kind: "navigate",
      };
    } else if (
      latestTask.novel?.creationExperience === "simple"
      || latestTask.checkpointType === "chapter_batch_ready"
      || latestTask.currentStage === "chapter_execution"
      || latestTask.currentStage === "quality_repair"
    ) {
      currentMilestone = "first_chapter";
      headline = isAttention ? "Capítulo 1 Procesamiento de necesidades de producción" : "La IA está completando el Capítulo 1";
      description = isAttention
        ? latestTask.lastError ?? "Verifique el motivo de la pausa de seguridad y proceda después de manipularla."
        : latestTask.currentItemLabel ?? "Una vez completado y aprobado el texto, quedará abierto a la lectura.";
      reason = isAttention
        ? "La restauración desde el punto de control actual conserva el plan y el texto guardados."
        : "El texto que se genera no se mostrará con antelación para evitar que puedas leer una versión que aún no es estable.";
      primaryAction = {
        label: isAttention ? "Ver y restaurar" : "Ver capítulo estantería",
        route: latestTask.novel?.creationExperience === "simple"
          ? `/novels/${latestTask.novelId}/simple`
          : `/novels/${latestTask.novelId}/edit`,
        kind: isAttention ? "resume" : "navigate",
      };
    } else {
      currentMilestone = "preparation";
      headline = isAttention ? "Es necesario procesar los preparativos para abrir el libro." : "AI está preparando recursos para libros";
      description = isAttention
        ? latestTask.lastError ?? "Ver recomendaciones de recuperación para la tarea actual."
        : latestTask.currentItemLabel ?? "El sistema está preparando la planificación de la historia, los personajes y los capítulos.";
      reason = isAttention
        ? "Simplemente continúe desde el punto de control actual, no es necesario recrear la novela."
        : "Estos recursos impulsarán directamente los capítulos siguientes y no requerirán que los revise uno por uno.";
      primaryAction = {
        label: isAttention ? "Ver y restaurar" : "Verificar el progreso de la preparación",
        route: `/novels/${latestTask.novelId}/edit`,
        kind: isAttention ? "resume" : "navigate",
      };
    }
  } else if (setup.readyForCreation && novel) {
    currentMilestone = "first_chapter";
    headline = "Continúe para completar el Capítulo 1";
    description = "El proyecto puede seguir avanzando y entrar al banco de trabajo para preparar o generar el texto del primer capítulo.";
    reason = "Una vez completado el primer capítulo, habrá completado el enlace completo desde la inspiración hasta el texto.";
    primaryAction = {
      label: novel.creationExperience === "simple" ? "Estantería de capítulos abiertos" : "Continuar proyecto actual",
      route: novel.creationExperience === "simple" ? `/novels/${novel.id}/simple` : `/novels/${novel.id}/edit`,
      kind: "navigate",
    };
  }

  const graduated = Boolean(firstReadableChapter && setup.readyForCreation);
  if (graduated && firstReadableChapter) {
    currentMilestone = "first_chapter";
    headline = "El primer capítulo se puede leer.";
    description = `«${firstReadableChapter.title}»Se convirtió en un borrador legible y el proceso completo, desde la inspiración hasta el texto, se desarrolló sin problemas.`;
    reason = "A continuación, puede continuar observando la producción de todo el libro o ingresar al banco de trabajo para completar el contenido posterior.";
    primaryAction = {
      label: "Leer el Capítulo 1",
      route: firstReadableChapter.novel.creationExperience === "simple"
        ? `/novels/${firstReadableChapter.novelId}/simple?chapterId=${firstReadableChapter.id}`
        : `/novels/${firstReadableChapter.novelId}/chapters/${firstReadableChapter.id}`,
      kind: "navigate",
    };
  }

  const milestones = buildMilestones(currentMilestone, isAttention && !graduated, summaries);
  if (graduated) {
    milestones.forEach((milestone) => {
      milestone.status = "completed";
    });
  }

  return {
    graduated,
    currentMilestone,
    completedCount: graduated
      ? MILESTONE_DEFINITIONS.length
      : milestones.filter((milestone) => milestone.status === "completed").length,
    totalCount: MILESTONE_DEFINITIONS.length,
    headline,
    description,
    reason,
    primaryAction,
    novel: novel ? {
      id: novel.id,
      title: novel.title,
      creationExperience: novel.creationExperience,
    } : null,
    directorTask: task,
    firstReadableChapter: firstReadableChapter ? {
      id: firstReadableChapter.id,
      title: firstReadableChapter.title,
      order: firstReadableChapter.order,
      novelId: firstReadableChapter.novelId,
    } : null,
    milestones,
    optionalEnhancements: [
      {
        key: "knowledge",
        title: "base de conocimientos",
        description: "Habilítelo cuando necesite materiales de referencia o configuraciones a largo plazo, y no afectará el inicio de la creación.",
        route: "/knowledge",
      },
      {
        key: "style",
        title: "motor de escritura",
        description: "Una vez que tenga una muestra clara del estilo de escritura, podrá extraer el método de escritura. No es necesario esperar esta configuración al escribir el primer capítulo.",
        route: "/style-engine",
      },
      {
        key: "image",
        title: "Capacidades de imagen",
        description: "Configura el modelo de imagen cuando necesites una imagen de portada o de personaje.",
        route: "/settings",
      },
    ],
  };
}
