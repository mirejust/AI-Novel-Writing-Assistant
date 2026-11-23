import type { OutlinePayoffPlan } from "@ai-novel/shared/types/outlineOpenBook";
import type { PayoffLedgerSourceRef, PayoffLedgerEvidence } from "@ai-novel/shared/types/payoffLedger";
import { OutlineOpenBookError } from "./errors";
export interface OutlineLedgerCandidate {
  ledgerKey: string; currentStatus: string; sourceRefs: PayoffLedgerSourceRef[]; evidence: PayoffLedgerEvidence[];
  setupChapterId?: string | null; setupChapterOrder?: number | null; payoffChapterId?: string | null; payoffChapterOrder?: number | null;
}
export interface WrittenPayoffChapter {id: string; order: number; content: string | null}
/** Stable source identity plus literal prose evidence, never title similarity or planned chapter references. */
export function resolveOutlinePayoffSource(item: OutlineLedgerCandidate, plans: OutlinePayoffPlan[], chapters: WrittenPayoffChapter[], currentOrder?: number | null) {
  const refs = item.sourceRefs.filter(r => r.kind === "outline_plan");
  if (!refs.length) {
    if (item.ledgerKey.startsWith("outline:")) throw new OutlineOpenBookError("OUTLINE_PAYOFF_SOURCE_INVALID", "El presagio del esquema requiere una clave clara para la fuente del plan.", 422);
    return null;
  }
  const keys = new Set(refs.map(r => r.refId));
  if (keys.size !== 1) throw new OutlineOpenBookError("OUTLINE_PAYOFF_SOURCE_INVALID", "Un presagio real no puede combinar múltiples identidades de programa.", 422);
  const plan = plans.find(p => p.ledgerKey === refs[0].refId);
  if (!plan) throw new OutlineOpenBookError("OUTLINE_PAYOFF_SOURCE_INVALID", "El plan presagio no forma parte de la fuente de este libro.", 422);
  const written = chapters.filter(c => c.content?.trim() && (currentOrder == null || c.order <= currentOrder));
  const evidenceChapters = item.evidence.map(e => written.find(c => (!e.chapterId || c.id === e.chapterId) && (e.chapterOrder == null || c.order === e.chapterOrder) && Boolean(e.chapterId || e.chapterOrder != null) && e.quote?.trim() && c.content!.includes(e.quote.trim())));
  if (!evidenceChapters.length || evidenceChapters.some(c => !c)) throw new OutlineOpenBookError("OUTLINE_PAYOFF_EVIDENCE_REQUIRED", "El presagio del plan sólo puede relacionarse con el libro mayor real basándose en la evidencia original del texto escrito.", 422);
  for (const target of [{id: item.setupChapterId, order: item.setupChapterOrder}, {id: item.payoffChapterId, order: item.payoffChapterOrder}]) {
    if ((target.id || target.order != null) && !evidenceChapters.some(c => (!target.id || c!.id === target.id) && (target.order == null || c!.order === target.order)))
      throw new OutlineOpenBookError("OUTLINE_PAYOFF_EVIDENCE_REQUIRED", "Debe existir la evidencia textual correspondiente del entierro o cobro de los capítulos.", 422);
  }
  if (item.currentStatus === "paid_off" && !item.payoffChapterId && item.payoffChapterOrder == null) throw new OutlineOpenBookError("OUTLINE_PAYOFF_EVIDENCE_REQUIRED", "El retiro de efectivo requiere capítulos reales claros.", 422);
  return plan;
}
