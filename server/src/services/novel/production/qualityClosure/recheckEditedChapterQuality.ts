import { prisma } from "../../../../db/prisma";
import type { ReviewOptions } from "../../novelCoreShared";
import { ChapterQualityGateService } from "../../runtime/ChapterQualityGateService";
import { assembleChapterAuditContextPackage } from "../../runtime/repair/chapterAuditContext";
import type { PipelineRuntimeResult } from "../../runtime/chapterRuntimePipeline";
import { SavedChapterQualityRecoveryError } from "./SavedChapterQualityRecovery";

/** An explicit continuation may reassess author edits, but must never invoke the writer or automatic repair. */
export async function recheckEditedChapterQuality(novelId: string, chapterId: string, content: string,
  options: ReviewOptions): Promise<PipelineRuntimeResult> {
  const contextPackage = await assembleChapterAuditContextPackage({ novelId, chapterId, options, operation: "review" });
  const result = await new ChapterQualityGateService({}).runAcceptanceGate({ novelId, chapterId, content,
    contextPackage, request: options, persistAssessment: false });
  const current = await prisma.chapter.findFirst({ where: { id: chapterId, novelId }, select: { content: true } });
  if (current?.content !== content) throw new SavedChapterQualityRecoveryError("El cuerpo cambió durante la verificación; continúe trabajando en el nuevo cuerpo desde el progreso de guardado.");
  if (result.assessment.repairability === "plan_misalignment") {
    throw new SavedChapterQualityRecoveryError("La revisión de este capítulo requiere ajustes en los planes posteriores; guarde los planos antes de continuar.", "quality.replan_required");
  }
  return { reviewExecuted: !result.assessment.riskTags.includes("acceptance_gate_unavailable"),
    pass: result.assessment.status === "accepted" && result.assessment.continuePolicy === "continue",
    score: result.score, issues: result.issues, runtimePackage: null, retryCountUsed: 0 };
}
