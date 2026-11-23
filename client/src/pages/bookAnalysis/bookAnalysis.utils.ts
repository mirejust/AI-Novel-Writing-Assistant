import type { BookAnalysisDetail, BookAnalysisSection, BookAnalysisStatus } from "@ai-novel/shared/types/bookAnalysis";
import type { SectionDraft } from "./bookAnalysis.types";

export function formatStatus(status: BookAnalysisStatus | BookAnalysisSection["status"]): string {
  switch (status) {
    case "draft":
      return "Borrador";
    case "queued":
      return "En cola";
    case "running":
      return "En ejecución";
    case "succeeded":
      return "Éxito";
    case "failed":
      return "Error";
    case "cancelled":
      return "Cancelado";
    case "archived":
      return "Archivado";
    case "idle":
      return "Pendiente";
    default:
      return status;
  }
}

export function formatStage(stage?: string | null): string {
  switch (stage) {
    case "loading_cache":
      return "Encuentra resultados reutilizables";
    case "preparing_notes":
      return "Preparar datos para el análisis.";
    case "generating_overview":
      return "Generar descripción general";
    case "generating_sections":
      return "Generar secciones de libro divididas";
    default:
      return stage?.trim() || "Sin datos";
  }
}

export const BOOK_ANALYSIS_BUDGET_EXCEEDED_CODE = "budget_exceeded";

export function isBookAnalysisBudgetExceeded(lastError?: string | null): boolean {
  return lastError?.includes(BOOK_ANALYSIS_BUDGET_EXCEEDED_CODE) ?? false;
}

export function formatDate(value?: string | null): string {
  if (!value) {
    return "Sin datos";
  }
  return new Date(value).toLocaleString();
}

export function syncDrafts(detail: BookAnalysisDetail): Record<string, SectionDraft> {
  return Object.fromEntries(detail.sections.map((section) => [section.id, buildSectionDraft(section)]));
}

export function createDownload(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function buildSectionDraft(section: BookAnalysisSection): SectionDraft {
  return {
    editedContent: section.editedContent?.trim() ? section.editedContent : section.aiContent ?? "",
    notes: section.notes ?? "",
    focusInstruction: section.focusInstruction ?? "",
    frozen: section.frozen,
    optimizeInstruction: "",
    optimizePreview: "",
  };
}

export function buildSectionUpdate(draft: SectionDraft, savedDraft: SectionDraft) {
  return {
    ...(draft.editedContent !== savedDraft.editedContent
      ? { editedContent: draft.editedContent.trim() ? draft.editedContent : null }
      : {}),
    notes: draft.notes.trim() ? draft.notes : null,
    focusInstruction: draft.focusInstruction.trim() ? draft.focusInstruction : null,
    frozen: draft.frozen,
  };
}
