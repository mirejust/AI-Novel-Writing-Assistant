import type { TaskKind, TaskStatus } from "@ai-novel/shared/types/task";
import {
  extractStructuredOutputErrorCategory,
} from "../../llm/structuredOutput";
import { summarizeStructuredOutputFailure } from "../../llm/structuredInvoke";

export function normalizeFailureSummary(summary?: string | null, fallback = "Actualmente no se han registrado fallos explícitos."): string {
  return summary?.trim() || fallback;
}

export function resolveStructuredFailureSummary(summary?: string | null): {
  failureCode: string | null;
  failureSummary: string | null;
} {
  if (!summary?.trim()) {
    return {
      failureCode: null,
      failureSummary: null,
    };
  }
  const category = extractStructuredOutputErrorCategory(summary);
  if (!category) {
    return {
      failureCode: null,
      failureSummary: null,
    };
  }
  const details = summarizeStructuredOutputFailure({
    error: summary,
    fallbackAvailable: false,
  });
  return {
    failureCode: details.failureCode,
    failureSummary: details.summary,
  };
}

export function isArchivableTaskStatus(status: TaskStatus): boolean {
  return status === "succeeded" || status === "failed" || status === "cancelled";
}

export function buildTaskRecoveryHint(kind: TaskKind, status: TaskStatus): string {
  if (status === "failed") {
    if (kind === "knowledge_document") {
      return "Se recomienda verificar la versión del documento de conocimiento, los resultados de la fragmentación, el modelo vectorial y la ocupación de la cola RAG compartida antes de volver a intentarlo.";
    }
    if (kind === "agent_run") {
      return "Se recomienda verificar el último paso fallido, el estado de aprobación relacionado y el contexto del recurso correspondiente antes de decidir si volver a intentarlo.";
    }
    if (kind === "novel_workflow") {
      return "Se recomienda restaurar desde el último punto de control, dando prioridad a verificar si los activos en la etapa actual están completos, si el modelo ha agotado el tiempo de espera y si la página de destino de recuperación se puede volver a abrir.";
    }
    if (kind === "novel_pipeline") {
      return "Se recomienda verificar la configuración del modelo, el contexto del capítulo y el registro de compilación más reciente antes de volver a intentarlo.";
    }
    if (kind === "book_analysis") {
      return "Se recomienda comprobar la calidad del documento original, la disponibilidad del modelo y los resultados de la segmentación del libro antes de volver a intentarlo.";
    }
    if (kind === "style_extraction") {
      return "Se recomienda verificar si el texto de referencia está completo, si el modelo está disponible y si la política de retención actual es adecuada para el guardado automático antes de volver a intentarlo.";
    }
    return "Se recomienda verificar las palabras clave, la configuración del modelo y el estado del recurso de destino antes de volver a intentarlo.";
  }
  if (status === "waiting_approval") {
    if (kind === "novel_workflow") {
      return "El proceso principal de la novela actual ha avanzado hasta el punto de control de seguridad. Haga clic en Continuar para regresar a la página de etapa correspondiente y reanudar la creación.";
    }
    return "La tarea actual está esperando aprobación. La aprobación debe procesarse antes de que pueda continuar la ejecución.";
  }
  if (status === "running") {
    return "La tarea actual aún se está ejecutando. Se recomienda esperar a que finalice o comprobar el seguimiento en tiempo real.";
  }
  if (status === "queued") {
    if (kind === "knowledge_document") {
      return "El índice de la base de conocimientos actual todavía se encuentra en la cola RAG compartida. Se recomienda confirmar si el trabajador está ocupado en tareas anteriores.";
    }
    if (kind === "style_extraction") {
      return "La tarea de extracción del método de escritura actual todavía está en cola. Se recomienda verificar primero el progreso en el centro de tareas. Los resultados se guardarán automáticamente más tarde.";
    }
    return "La tarea actual todavía está en cola. Se recomienda confirmar si el hilo de trabajo y el servicio modelo están disponibles.";
  }
  if (status === "cancelled") {
    if (kind === "knowledge_document") {
      return "La indexación actual de la base de conocimientos ha sido cancelada. Si necesita continuar, puede volver a enviar la tarea de indexación.";
    }
    if (kind === "novel_workflow") {
      return "El proceso principal de la novela actual ha sido cancelado. Si necesita continuar, puede reanudarlo desde el último punto de control.";
    }
    if (kind === "style_extraction") {
      return "La tarea de extracción del método de escritura actual ha sido cancelada. Si aún necesita generar este conjunto de métodos de escritura, puede volver a enviar el texto de referencia.";
    }
    return "La tarea actual ha sido cancelada. Si aún necesita continuar, puede reiniciar o realizar un nuevo intento.";
  }
  return "Actualmente no se requieren operaciones de recuperación.";
}
