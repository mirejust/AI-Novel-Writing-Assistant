import type { DirectorQualityRepairRisk } from "@ai-novel/shared/types/novelDirector";
import {
  PIPELINE_QUALITY_NOTICE_CODE,
  PIPELINE_REPLAN_NOTICE_CODE,
  parsePipelinePayload,
} from "../../pipelineJobState";

type PipelineRepairMode = NonNullable<ReturnType<typeof parsePipelinePayload>["repairMode"]>;

export interface DirectorQualityRepairRiskInput {
  noticeCode?: string | null;
  payload?: string | null;
  remainingChapterCount: number;
}

function normalizeCount(value: number | null | undefined): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0;
}

function buildDeferredQualityDebtReason(input: {
  affectedChapterCount: number;
  remainingChapterCount: number;
}): string {
  const affectedSummary = input.affectedChapterCount > 0
    ? `Este tiempo ha sido registrado. ${input.affectedChapterCount} deuda de calidad del capítulo`
    : "Esta vez se ha registrado deuda de calidad";
  const remainingSummary = input.remainingChapterCount > 0
    ? `, todavía hay ${input.remainingChapterCount} El capítulo puede seguir avanzando.`
    : "";
  return `${affectedSummary}${remainingSummary}.`;
}

export function buildDirectorQualityRepairRisk(
  input: DirectorQualityRepairRiskInput,
): DirectorQualityRepairRisk {
  const payload = parsePipelinePayload(input.payload);
  const noticeCode = input.noticeCode?.trim() || null;
  const repairMode = payload.repairMode ?? null;
  const replanCount = normalizeCount(payload.replanAlertDetails?.length);
  const qualityCount = normalizeCount(payload.qualityAlertDetails?.length);
  const recoverableRepairCount = normalizeCount(payload.recoverableRepairDetails?.length);
  const affectedChapterCount = noticeCode === PIPELINE_REPLAN_NOTICE_CODE
    ? replanCount
    : Math.max(qualityCount, recoverableRepairCount);
  const remainingChapterCount = normalizeCount(input.remainingChapterCount);

  if (noticeCode === PIPELINE_REPLAN_NOTICE_CODE || replanCount > 0) {
    return {
      riskLevel: "replan",
      autoContinuable: false,
      reason: "La inspección de calidad claramente requiere que primero se procese una planificación exhaustiva, y los capítulos posteriores deben confirmar el plan antes de continuar.",
      noticeCode: PIPELINE_REPLAN_NOTICE_CODE,
      repairMode,
      affectedChapterCount: replanCount,
      remainingChapterCount,
    };
  }

  return {
    riskLevel: "low",
    autoContinuable: true,
    reason: buildDeferredQualityDebtReason({
      affectedChapterCount,
      remainingChapterCount,
    }),
    noticeCode: noticeCode ?? PIPELINE_QUALITY_NOTICE_CODE,
    repairMode,
    affectedChapterCount,
    remainingChapterCount,
  };
}
