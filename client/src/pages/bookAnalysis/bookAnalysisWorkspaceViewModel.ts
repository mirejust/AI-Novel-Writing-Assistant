import type {
  BookAnalysisDetail,
  BookAnalysisSection,
  BookAnalysisStatus,
} from "@ai-novel/shared/types/bookAnalysis";
import { isBookAnalysisBudgetExceeded } from "./bookAnalysis.utils.ts";

export type BookAnalysisWorkspaceTone = "neutral" | "info" | "success" | "warning" | "danger";

export type BookAnalysisPrimaryAction =
  | "create"
  | "select"
  | "view_results"
  | "resume_budget"
  | "rebuild"
  | "copy";

export interface BookAnalysisSectionSummary {
  total: number;
  expected: number;
  frozen: number;
  unselected: number;
  frozenReadable: number;
  readable: number;
  readableExpected: number;
  missingExpected: number;
  failedExpected: number;
  succeeded: number;
  running: number;
  failed: number;
}

export interface BookAnalysisNextAction {
  tone: BookAnalysisWorkspaceTone;
  title: string;
  description: string;
  action: BookAnalysisPrimaryAction | null;
  actionLabel?: string;
}

function hasStructuredContent(value: Record<string, unknown> | null | undefined): boolean {
  return Boolean(value && Object.keys(value).length > 0);
}

export function isReadableBookAnalysisSection(section: BookAnalysisSection): boolean {
  return Boolean(
    section.editedContent?.trim()
      || section.aiContent?.trim()
      || hasStructuredContent(section.structuredData),
  );
}

export function shouldResumeBookAnalysisSection(section: BookAnalysisSection): boolean {
  return !section.frozen && (section.status !== "succeeded" || !isReadableBookAnalysisSection(section));
}

export function isUnselectedBookAnalysisSection(section: BookAnalysisSection): boolean {
  return section.frozen && !isReadableBookAnalysisSection(section);
}

export function summarizeBookAnalysisSections(
  analysis: Pick<BookAnalysisDetail, "sections"> | null | undefined,
): BookAnalysisSectionSummary {
  const summary: BookAnalysisSectionSummary = {
    total: 0,
    expected: 0,
    frozen: 0,
    unselected: 0,
    frozenReadable: 0,
    readable: 0,
    readableExpected: 0,
    missingExpected: 0,
    failedExpected: 0,
    succeeded: 0,
    running: 0,
    failed: 0,
  };
  for (const section of analysis?.sections ?? []) {
    summary.total += 1;
    if (section.frozen) {
      summary.frozen += 1;
    } else {
      summary.expected += 1;
    }
    const readable = isReadableBookAnalysisSection(section);
    if (section.frozen) {
      if (readable) {
        summary.frozenReadable += 1;
      } else {
        summary.unselected += 1;
      }
    }
    if (readable) {
      summary.readable += 1;
    }
    if (!section.frozen && readable) {
      summary.readableExpected += 1;
    }
    if (!section.frozen && !readable) {
      summary.missingExpected += 1;
    }
    if (section.status === "succeeded") {
      summary.succeeded += 1;
    } else if (section.status === "running") {
      summary.running += 1;
    } else if (section.status === "failed") {
      summary.failed += 1;
      if (!section.frozen) {
        summary.failedExpected += 1;
      }
    }
  }
  return summary;
}

export function getPreferredBookAnalysisSection(
  sections: BookAnalysisSection[],
): BookAnalysisSection | null {
  return sections.find(isReadableBookAnalysisSection)
    ?? sections.find((section) => section.status === "succeeded")
    ?? sections[0]
    ?? null;
}

function describeMissingExpectedSections(sections: BookAnalysisSectionSummary): string {
  return sections.missingExpected > 0
    ? `todavía hay ${sections.missingExpected} A la sección de planificación le faltan resultados legibles.`
    : "No faltan secciones dentro del alcance del plan.";
}

export function resolveBookAnalysisNextAction(input: {
  analysis?: BookAnalysisDetail | null;
  analysesCount: number;
  status?: BookAnalysisStatus | null;
}): BookAnalysisNextAction {
  const analysis = input.analysis ?? null;
  if (!analysis) {
    if (input.analysesCount > 0) {
      return {
        tone: "info",
        title: "Elija un análisis de libro",
        description: "Después de seleccionar un registro de la lista de análisis, aquí se muestran la fuente, la etapa de generación y los resultados legibles por humanos.",
        action: "select",
      };
    }
    return {
      tone: "info",
      title: "Crea tu primer análisis de apertura de libro",
      description: "Seleccione un documento de conocimiento y un alcance de análisis, y la IA organizará los resultados en secciones legibles y citables.",
      action: "create",
      actionLabel: "Crear un nuevo libro",
    };
  }

  const status = input.status ?? analysis.status;
  const sections = summarizeBookAnalysisSections(analysis);
  if (status === "queued" || status === "running") {
    const hasReadableResults = sections.readable > 0;
    return {
      tone: "info",
      title: status === "queued" ? "El análisis de división de libros está en cola" : "Se está generando un análisis de división de libros.",
      description: hasReadableResults
        ? `Progreso actual ${Math.round(analysis.progress * 100)}%, existente ${sections.readable} las secciones se pueden leer; se siguen generando los restantes tramos previstos.`
        : `Progreso actual ${Math.round(analysis.progress * 100)}%. Las secciones completadas se conservarán directamente y podrá leerlas en el "Contenido del libro abierto" una vez completadas.`,
      action: hasReadableResults ? "view_results" : null,
      actionLabel: hasReadableResults ? "Ver resultados existentes" : undefined,
    };
  }

  if ((status === "failed" || status === "cancelled") && isBookAnalysisBudgetExceeded(analysis.lastError)) {
    return {
      tone: "warning",
      title: "Continuar generación tras presupuesto de expansión",
      description: `Ya ${sections.readable} Se conservarán las secciones legibles.${describeMissingExpectedSections(sections)}La ampliación y la continuación sólo procesan las piezas que aún no han tenido éxito.`,
      action: "resume_budget",
      actionLabel: "Ampliar el presupuesto y seguir funcionando",
    };
  }

  if (status === "succeeded") {
    if (sections.readable === 0) {
      return {
        tone: "danger",
        title: "La misión se completó, pero no hay contenido de unboxing para mostrar.",
        description: "El documento fuente no se verá afectado. Vuelva a generar el análisis o abra el centro de tareas para ver los registros detallados de esta tarea.",
        action: "rebuild",
        actionLabel: "Regenerar análisis",
      };
    }
    if (sections.missingExpected > 0) {
      return {
        tone: "warning",
        title: "Verifique primero los resultados de las aperturas de libros existentes",
        description: `Ya ${sections.readableExpected}/${sections.expected} Las secciones planificadas se pueden leer y todavía hay ${sections.missingExpected} Las secciones se pueden completar regenerando.`,
        action: "view_results",
        actionLabel: "Ver resultados existentes",
      };
    }
    if (sections.failedExpected > 0) {
      return {
        tone: "warning",
        title: "Los resultados son legibles, pero algunas secciones requieren revisión.",
        description: `${sections.readableExpected}/${sections.expected} Cada sección del plan tiene contenido legible, que incluye ${sections.failedExpected} La última generación de secciones fracasó. Verifique el contenido retenido antes de decidir si regenerarlo.`,
        action: "view_results",
        actionLabel: "Ver resultados existentes",
      };
    }
    return {
      tone: "success",
      title: "El resultado de abrir el libro se puede leer.",
      description: `total ${sections.readable} Se han generado secciones. Puede continuar viendo evidencia, organizando personajes o publicando en la base de conocimiento de la novela.`,
      action: "view_results",
      actionLabel: "Consulta los resultados de abrir el libro.",
    };
  }

  if (status === "failed" || status === "cancelled") {
    if (sections.readable > 0) {
      return {
        tone: "warning",
        title: "El análisis se ha detenido, los resultados existentes aún se pueden leer",
        description: `Reservado ${sections.readable} secciones legibles.${describeMissingExpectedSections(sections)}Primero verifique los resultados existentes y luego decida si desea regenerarlos.`,
        action: "view_results",
        actionLabel: "Ver resultados existentes",
      };
    }
    return {
      tone: "danger",
      title: "Es necesario regenerar el análisis de libro abierto",
      description: analysis.lastError?.trim() || "Este análisis no produjo resultados legibles y los documentos originales no se verán afectados.",
      action: "rebuild",
      actionLabel: "Regenerar análisis",
    };
  }

  if (status === "archived") {
    return {
      tone: "neutral",
      title: sections.readable > 0 ? "Ver resultados archivados" : "Continuar después de copiar el análisis del archivo",
      description: sections.readable > 0
        ? "Los análisis archivados siguen siendo de solo lectura y los resultados, las pruebas y los perfiles de funciones existentes aún se pueden ver."
        : "Este análisis archivado no tiene resultados legibles y puede copiarse como un nuevo análisis y regenerarse.",
      action: sections.readable > 0 ? "view_results" : "copy",
      actionLabel: sections.readable > 0 ? "Ver resultados archivados" : "Copiar como nuevo análisis",
    };
  }

  return {
    tone: "info",
    title: "Comience a generar resultados de apertura de libros",
    description: "La IA generará conclusiones sobre la estructura, los personajes, el mundo y la escritura pieza por pieza en función del rango seleccionado y conservará cada sección completa.",
    action: "rebuild",
    actionLabel: "Empezar a generar",
  };
}
