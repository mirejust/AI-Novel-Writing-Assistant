export type ChapterArtifactSyncStatus = "completed" | "pending" | "degraded" | "failed";

export interface ChapterArtifactSyncResult {
  status: ChapterArtifactSyncStatus;
  contentHash: string;
  completedArtifacts: string[];
  reason?: string;
  characterReviewId?: string;
}

export function mergeChapterArtifactSyncResults(
  contentHash: string,
  ...results: ChapterArtifactSyncResult[]
): ChapterArtifactSyncResult {
  const status = results.some((result) => result.status === "failed")
    ? "failed"
    : results.some((result) => result.status === "pending")
      ? "pending"
      : results.some((result) => result.status === "degraded")
        ? "degraded"
        : "completed";
  return {
    status,
    contentHash,
    completedArtifacts: [...new Set(results.flatMap((result) => result.completedArtifacts))],
    reason: results.find((result) => result.status === status)?.reason,
    characterReviewId: results.find(result => result.characterReviewId)?.characterReviewId,
  };
}

export class CharacterCandidateReviewRequiredError extends Error {
  constructor(readonly reviewId: string) {
    super("El texto de este capítulo ha sido guardado. Confirme los caracteres de este capítulo antes de continuar; puedes optar por agregar nuevos personajes, asociar personajes existentes o ignorarlos.");
    this.name = "CharacterCandidateReviewRequiredError";
  }
}

export class ChapterArtifactSyncBoundaryError extends Error {
  constructor(readonly result: ChapterArtifactSyncResult) {
    super(result.reason || `Sincronización de recursos del capítulo no completada (${result.status}).`);
    this.name = "ChapterArtifactSyncBoundaryError";
  }
}

/** A saved chapter changed while a background artifact run was still active. */
export class ChapterArtifactContentVersionError extends Error {
  constructor(message = "La versión del texto del capítulo cambió y los resultados de los activos vencidos fueron rechazados.") {
    super(message);
    this.name = "ChapterArtifactContentVersionError";
  }
}
