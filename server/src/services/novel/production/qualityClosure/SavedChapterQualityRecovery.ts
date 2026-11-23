import type { ReviewOptions } from "../../novelCoreShared";
import { readManualChapterSync } from "../../chapterEditor/synchronization";
import { z } from "zod";
import { prisma } from "../../../../db/prisma";
import { chapterAcceptanceAssessmentSchema } from "../../../../prompting/prompts/novel/chapterAcceptance.prompts";
import { hashContent } from "../../runtime/chapterRuntimePackageBuilders";
import { hasCurrentChapterArtifactSyncBoundary } from "../../runtime/artifactSync";
import type { ChapterProductionCompletionCandidate } from "../completion/ChapterProductionCompletionPolicy";
import type { PipelineRuntimeResult } from "../../runtime/chapterRuntimePipeline";

const savedAcceptanceSchema = z.object({
  schemaVersion: z.union([z.literal(2), z.literal(3)]), gate: z.literal("acceptance"), contentHash: z.string(),
  result: z.object({
    assessment: chapterAcceptanceAssessmentSchema,
    score: chapterAcceptanceAssessmentSchema.shape.score,
    issues: z.array(z.object({
      severity: z.enum(["low", "medium", "high", "critical"]),
      category: z.enum(["coherence", "repetition", "pacing", "voice", "engagement", "logic"]),
      evidence: z.string(), fixSuggestion: z.string(),
    })),
  }),
});

export class SavedChapterQualityRecoveryError extends Error {
  constructor(message: string, readonly issueCode: "runtime.data_integrity" | "quality.replan_required" = "runtime.data_integrity") {
    super(message);
  }
}

/** Old budget pauses can precede quality bookkeeping. Recover exact saved facts; explicit author revisions may be reassessed without rewriting. */
export async function recoverSavedChapterQuality(
  novelId: string,
  chapter: ChapterProductionCompletionCandidate & { id: string },
  options: ReviewOptions & {manualRevision?: boolean} = {},
): Promise<PipelineRuntimeResult> {
  if (!hasCurrentChapterArtifactSyncBoundary(chapter.content, chapter.artifactSyncCheckpoints ?? [], {requireAppliedDelta: true})) {
    throw new SavedChapterQualityRecoveryError("El texto de este capítulo o el registro de sincronización de estado no coincide con el progreso de guardado. Por favor verifique el contenido del capítulo antes de continuar.");
  }
  const qualityLoop = JSON.parse(chapter.riskFlags || "{}").qualityLoop;
  if (qualityLoop?.rootCauseCode === "replan_required" || qualityLoop?.recommendedAction === "replan") {
    throw new SavedChapterQualityRecoveryError("Este capítulo requiere ajustes para la planificación posterior, guarde el plan y continúe.", "quality.replan_required");
  }
  const contentHash = hashContent(chapter.content!);
  const row = await prisma.chapterArtifactSyncCheckpoint.findFirst({
    where: { novelId, chapterId: chapter.id, contentHash, artifactType: "quality_gate_acceptance", status: "succeeded" },
    select: { contentHash: true, metadataJson: true }, orderBy: { updatedAt: "desc" },
  });
  let payload: unknown;
  try { payload = JSON.parse(row?.metadataJson ?? "null"); } catch { payload = null; }
  const parsed = savedAcceptanceSchema.safeParse(payload);
  if ((!parsed.success || row?.contentHash !== contentHash || parsed.data.contentHash !== contentHash) && options.manualRevision) {
    const marker = await readManualChapterSync(novelId, chapter.id, chapter.content!);
    if (marker?.status === "succeeded") {
      const {recheckEditedChapterQuality} = await import("./recheckEditedChapterQuality");
      return recheckEditedChapterQuality(novelId, chapter.id, chapter.content!, options);
    }
  }
  if (!parsed.success || row?.contentHash !== contentHash || parsed.data.contentHash !== contentHash) {
    throw new SavedChapterQualityRecoveryError("Este capítulo carece de los resultados de la verificación correspondientes al texto guardado. Por favor verifique el contenido del capítulo antes de continuar.");
  }
  const { assessment, score, issues } = parsed.data.result;
  if (assessment.repairability === "plan_misalignment"
    || (!options.manualRevision && (assessment.continuePolicy === "pause" || assessment.status === "needs_manual_review"))) {
    throw new SavedChapterQualityRecoveryError("La inspección en este capítulo requiere un ajuste de la planificación o el procesamiento manual. Verifique los resultados de la inspección antes de continuar.", "quality.replan_required");
  }
  return {
    reviewExecuted: true,
    pass: assessment.status === "accepted" && assessment.continuePolicy === "continue",
    score, issues, runtimePackage: null, retryCountUsed: 0,
  };
}
