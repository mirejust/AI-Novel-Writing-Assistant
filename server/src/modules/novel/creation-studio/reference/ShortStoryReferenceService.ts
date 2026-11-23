import { createHash } from "node:crypto";
import type {
  ShortStoryReferenceSelection, ShortStoryReferenceSnapshot, ShortStoryReferenceContract, ShortStoryReferenceView,
} from "@ai-novel/shared/types/shortStoryReference";
import { BOOK_ANALYSIS_SECTIONS } from "@ai-novel/shared/types/bookAnalysis";
import { prisma } from "../../../../db/prisma";
import { AppError } from "../../../../middleware/errorHandler";
import { isEmptySucceededBookAnalysisSection } from "../../../../services/bookAnalysis/shared/bookAnalysis.status";
import { runStructuredPrompt } from "../../../../prompting/core/promptRunner";
import { shortStoryReferenceExtractPrompt } from "../../../../prompting/prompts/creation/shortStoryReference.prompts";

export function referenceContract(snapshot: ShortStoryReferenceSnapshot | null): ShortStoryReferenceContract | undefined {
  if (!snapshot) return undefined;
  return {
    sourceTitle: snapshot.sourceTitle, goal: snapshot.goal, structureLessons: snapshot.structureLessons,
    pacingLessons: snapshot.pacingLessons, styleLessons: snapshot.styleLessons, endingLessons: snapshot.endingLessons,
    endingEvidence: snapshot.endingEvidence, originalityConstraints: snapshot.originalityConstraints,
  };
}

export function parseShortStoryReference(raw: string | null, required = false): ShortStoryReferenceSnapshot | null {
  if (!raw && !required) return null;
  let snapshot: ShortStoryReferenceSnapshot | null = null;
  try { snapshot = JSON.parse(raw ?? "null") as ShortStoryReferenceSnapshot; } catch { /* fail below */ }
  if (!snapshot || snapshot.schemaVersion !== 1 || !snapshot.analysisRevision || !snapshot.selection
    || !snapshot.structureLessons?.length || !snapshot.originalityConstraints?.length) {
    throw new AppError("La instantánea de referencia está incompleta; verifique los datos guardados por el trabajo antes de continuar.", 409);
  }
  return snapshot;
}

export class ShortStoryReferenceService {
  private async source(selection: ShortStoryReferenceSelection) {
    const analysis = await prisma.bookAnalysis.findUnique({
      where: { id: selection.analysisId }, include: { document: true, documentVersion: true,
        sections: { orderBy: { sortOrder: "asc" } } },
    });
    if (!analysis || analysis.documentId !== selection.documentId) throw new AppError("El libro de referencia no coincide con el documento seleccionado, seleccione nuevamente.", 404);
    // The application currently has workspace-wide access; disabled/archived documents are unavailable.
    if (analysis.document.status !== "enabled") throw new AppError("El documento de referencia no es accesible, seleccione una novela de referencia disponible.", 403);
    if (analysis.status !== "succeeded" || analysis.documentVersion.documentId !== selection.documentId) {
      throw new AppError("Primero complete el análisis de apertura del libro de la novela de referencia seleccionada.", 409);
    }
    const keys = selection.sectionKeys ?? analysis.sections
      .filter((section) => (section.status === "succeeded" || section.frozen)
        && !isEmptySucceededBookAnalysisSection({ ...section, status: "succeeded", frozen: false }))
      .map((section) => section.sectionKey);
    const supported = new Set(BOOK_ANALYSIS_SECTIONS.map((section) => section.key as string));
    if (!keys.length || new Set(keys).size !== keys.length || keys.some((key) => !supported.has(key))) {
      throw new AppError("Elija una conclusión de apertura de libro válida.", 400);
    }
    const sections = keys.map((key) => analysis.sections.find((section) => section.sectionKey === key));
    if (sections.some((section) => !section || (section.status !== "succeeded" && !section.frozen)
      || isEmptySucceededBookAnalysisSection({ ...section, status: "succeeded", frozen: false }))) {
      throw new AppError("La conclusión del libro seleccionado aún no está completa o no tiene contenido disponible.", 409);
    }
    const conclusions = sections.map((section) => ({
      sectionKey: section!.sectionKey, title: section!.title,
      content: section!.editedContent?.trim() || [section!.aiContent?.trim(), section!.structuredDataJson?.trim()]
        .filter(Boolean).join("\n\n"),
      evidence: section!.evidenceJson,
    }));
    const revision = createHash("sha256").update(JSON.stringify({
      documentVersionId: analysis.documentVersionId, contentHash: analysis.documentVersion.contentHash,
      scope: [analysis.sourceStartOffset, analysis.sourceEndOffset], conclusions,
      updatedAt: sections.map((section) => section!.updatedAt.toISOString()),
    })).digest("hex");
    return { analysis, conclusions, revision };
  }

  async create(selection: ShortStoryReferenceSelection, idea: string, taskId: string): Promise<ShortStoryReferenceSnapshot> {
    const goal = selection.goal.trim();
    if (!goal || goal.length > 4000) throw new AppError("Describe en qué deseas basarte, hasta 4000 palabras.", 400);
    const source = await this.source(selection);
    if (JSON.stringify(source.conclusions).length > 100000) {
      throw new AppError("La conclusión del libro dividido seleccionado es larga; reduzca el rango de selección antes de continuar; la conclusión no cortará el principio ni reemplazará el artículo completo.", 400);
    }
    const result = await runStructuredPrompt({
      asset: shortStoryReferenceExtractPrompt,
      promptInput: { idea, goal, conclusions: source.conclusions },
      options: { taskId, stage: "creation_intent", itemKey: "reference_extract", entrypoint: "creation_studio",
        temperature: 0.3, maxTokens: 5000 },
    });
    const current = await this.source(selection);
    if (current.revision !== source.revision) throw new AppError("La conclusión de referencia cambió durante la lectura, vuelva a generar la dirección.", 409);
    return { ...result.output, schemaVersion: 1, mode: "adaptation", sourceTitle: source.analysis.document.title,
      goal, originalIdea: idea, analysisId: source.analysis.id, documentId: source.analysis.documentId,
      documentVersionId: source.analysis.documentVersionId, documentVersionNumber: source.analysis.documentVersion.versionNumber,
      analysisRevision: source.revision, selection: { ...selection, goal }, selectedConclusions: source.conclusions };
  }

  async validate(snapshot: ShortStoryReferenceSnapshot): Promise<void> {
    const source = await this.source(snapshot.selection);
    if (source.revision !== snapshot.analysisRevision) throw new AppError("El libro de referencia se ha actualizado, vuelva a generarlo y verifique las dos direcciones creativas.", 409);
  }

  async view(snapshot: ShortStoryReferenceSnapshot | null): Promise<ShortStoryReferenceView | null> {
    if (!snapshot) return null;
    let sourceState: ShortStoryReferenceView["sourceState"] = "available";
    try { const source = await this.source(snapshot.selection);
      if (source.revision !== snapshot.analysisRevision) sourceState = "updated";
    } catch (error) {
      if (!(error instanceof AppError)) throw error;
      sourceState = "unavailable";
    }
    return { ...referenceContract(snapshot)!, analysisId: snapshot.analysisId, documentId: snapshot.documentId,
      documentVersionNumber: snapshot.documentVersionNumber, analysisRevision: snapshot.analysisRevision, sourceState };
  }
}
export const shortStoryReferenceService = new ShortStoryReferenceService();
