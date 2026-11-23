import type {
  TaskStatus,
  UnifiedTaskStep,
  UnifiedTaskSummary,
} from "@ai-novel/shared/types/task";

export interface ListTasksFilters {
  kind?: "book_analysis" | "novel_pipeline" | "knowledge_document" | "image_generation" | "agent_run" | "novel_workflow" | "style_extraction";
  status?: TaskStatus;
  keyword?: string;
  limit?: number;
  cursor?: string;
}

export interface CursorPayload {
  status: TaskStatus;
  updatedAt: string;
  id: string;
}

export const STATUS_RANK: Record<TaskStatus, number> = {
  running: 0,
  waiting_approval: 1,
  queued: 2,
  failed: 3,
  cancelled: 4,
  succeeded: 5,
};

export const BOOK_ANALYSIS_STEPS = [
  { key: "queued", label: "cola" },
  { key: "preparing_notes", label: "Extraer notas" },
  { key: "generating_sections", label: "Generar capítulos" },
  { key: "finalizing", label: "final" },
] as const;

export const NOVEL_PIPELINE_STEPS = [
  { key: "queued", label: "cola" },
  { key: "generating_chapters", label: "Generar capítulos" },
  { key: "reviewing", label: "Revisar" },
  { key: "repairing", label: "reparar" },
  { key: "finalizing", label: "final" },
] as const;

export const KNOWLEDGE_DOCUMENT_STEPS = [
  { key: "queued", label: "cola" },
  { key: "loading_source", label: "Leer documento" },
  { key: "chunking", label: "Cortar en trozos" },
  { key: "embedding", label: "Generar vector" },
  { key: "ensuring_collection", label: "conjunto de verificación" },
  { key: "deleting_existing", label: "Limpiar índices antiguos" },
  { key: "upserting_vectors", label: "Escribir en la biblioteca de vectores" },
  { key: "writing_metadata", label: "Escribir metadatos" },
  { key: "completed", label: "Finalizar" },
] as const;

export const IMAGE_TASK_STEPS = [
  { key: "queued", label: "cola" },
  { key: "submitting", label: "Enviar una solicitud" },
  { key: "generating", label: "Generar imágenes" },
  { key: "saving_assets", label: "Guardar metraje" },
  { key: "finalizing", label: "final" },
] as const;

export const STYLE_EXTRACTION_TASK_STEPS = [
  { key: "queued", label: "cola" },
  { key: "extracting_features", label: "Extraer funciones de escritura" },
  { key: "building_profile", label: "Organizar políticas de retención" },
  { key: "saving_profile", label: "Guardar automáticamente el método de escritura" },
  { key: "finalizing", label: "final" },
] as const;

export const NOVEL_WORKFLOW_STAGE_STEPS = [
  { key: "project_setup", label: "Configuración del proyecto" },
  { key: "auto_director", label: "Director automático" },
  { key: "story_macro", label: "gran plan de historia" },
  { key: "character_setup", label: "Preparación de personajes" },
  { key: "volume_strategy", label: "Estrategia de volumen/esqueleto de volumen" },
  { key: "structured_outline", label: "Ritmo / Capítulo de ruptura" },
  { key: "chapter_execution", label: "Ejecución del capítulo" },
  { key: "quality_repair", label: "arreglo de calidad" },
] as const;

export function normalizeKeyword(value: string | undefined): string | undefined {
  const keyword = value?.trim();
  return keyword ? keyword : undefined;
}

export function normalizeLimit(value: number | undefined): number {
  if (!value || Number.isNaN(value)) {
    return 30;
  }
  return Math.max(1, Math.min(100, Math.floor(value)));
}

export function statusRank(status: TaskStatus): number {
  return STATUS_RANK[status] ?? 99;
}

export function toCursor(summary: UnifiedTaskSummary): string {
  const payload: CursorPayload = {
    status: summary.status,
    updatedAt: summary.updatedAt,
    id: summary.id,
  };
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

export function parseCursor(cursor: string | undefined): CursorPayload | null {
  if (!cursor?.trim()) {
    return null;
  }
  try {
    const raw = Buffer.from(cursor, "base64url").toString("utf8");
    const parsed = JSON.parse(raw) as CursorPayload;
    if (!parsed?.status || !parsed.updatedAt || !parsed.id) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function compareTaskSummary(left: UnifiedTaskSummary, right: UnifiedTaskSummary): number {
  const leftRank = statusRank(left.status);
  const rightRank = statusRank(right.status);
  if (leftRank !== rightRank) {
    return leftRank - rightRank;
  }
  if (left.updatedAt !== right.updatedAt) {
    return right.updatedAt.localeCompare(left.updatedAt);
  }
  return right.id.localeCompare(left.id);
}

export function isAfterCursor(summary: UnifiedTaskSummary, cursor: CursorPayload): boolean {
  const rankDiff = statusRank(summary.status) - statusRank(cursor.status);
  if (rankDiff !== 0) {
    return rankDiff > 0;
  }
  if (summary.updatedAt !== cursor.updatedAt) {
    return summary.updatedAt < cursor.updatedAt;
  }
  return summary.id < cursor.id;
}

function resolveStageIndex(
  definitions: ReadonlyArray<{ key: string; label: string }>,
  currentStage: string | null | undefined,
): number {
  if (!currentStage) {
    return 0;
  }
  const index = definitions.findIndex((item) => item.key === currentStage);
  return index >= 0 ? index : 0;
}

export function buildSteps(
  definitions: ReadonlyArray<{ key: string; label: string }>,
  status: TaskStatus,
  currentStage: string | null | undefined,
  createdAt: string,
  updatedAt: string,
): UnifiedTaskStep[] {
  const stageIndex = resolveStageIndex(definitions, currentStage);
  return definitions.map((item, index) => {
    let stepStatus: UnifiedTaskStep["status"] = "idle";
    if (status === "queued") {
      stepStatus = index === 0 ? "running" : "idle";
    } else if (status === "running" || status === "waiting_approval") {
      if (index < stageIndex) {
        stepStatus = "succeeded";
      } else if (index === stageIndex) {
        stepStatus = status === "waiting_approval" ? "cancelled" : "running";
      }
    } else if (status === "succeeded") {
      stepStatus = "succeeded";
    } else if (status === "failed") {
      if (index < stageIndex) {
        stepStatus = "succeeded";
      } else if (index === stageIndex) {
        stepStatus = "failed";
      }
    } else if (status === "cancelled") {
      if (index < stageIndex) {
        stepStatus = "succeeded";
      } else if (index === stageIndex) {
        stepStatus = "cancelled";
      }
    }

    return {
      key: item.key,
      label: item.label,
      status: stepStatus,
      startedAt: stepStatus === "idle" ? null : createdAt,
      updatedAt: stepStatus === "idle" ? null : updatedAt,
    };
  });
}

export function toLegacyTaskStatus(
  status: TaskStatus | undefined,
): "queued" | "running" | "succeeded" | "failed" | "cancelled" | undefined {
  if (!status || status === "waiting_approval") {
    return undefined;
  }
  return status;
}

export function mapBookStatusToTaskStatus(status: string): TaskStatus | null {
  if (status === "queued" || status === "running" || status === "succeeded" || status === "failed" || status === "cancelled") {
    return status;
  }
  return null;
}
