import {
  BOOK_ANALYSIS_STRUCTURED_FIELD_LABELS,
  type BookAnalysisSection,
} from "@ai-novel/shared/types/bookAnalysis";
import { getManualBookAnalysisContent } from "@ai-novel/shared/utils/bookAnalysisContent";
import type { DocumentChapter } from "@ai-novel/shared/types/knowledge";
import { LocateFixed } from "lucide-react";
import { useEffect, useState } from "react";
import MarkdownViewer from "@/components/common/MarkdownViewer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { SectionDraft, SectionEvidenceItem } from "../bookAnalysis.types";
import { formatStatus } from "../bookAnalysis.utils";
import { isUnselectedBookAnalysisSection } from "../bookAnalysisWorkspaceViewModel";
import type { BookAnalysisMode } from "../hooks/bookAnalysisWorkspace.types";
import BookAnalysisStructuredSummary from "./BookAnalysisStructuredSummary";

interface BookAnalysisSectionCardProps {
  analysisMode: BookAnalysisMode;
  section: BookAnalysisSection;
  draft: SectionDraft;
  readingMode: "summary" | "full";
  canOperate: boolean;
  isRegenerating: boolean;
  isOptimizing: boolean;
  isSaving: boolean;
  hasResultAnomaly: boolean;
  evidenceItems: SectionEvidenceItem[];
  selectedEvidenceKey: string;
  selectedEvidence: SectionEvidenceItem | null;
  selectedEvidenceChapter: DocumentChapter | null;
  selectedChapterContent: string;
  isDualPane: boolean;
  currentChapterIndex: number | null;
  onSelectEvidence: (evidenceKey: string) => void;
  onDraftChange: (section: BookAnalysisSection, patch: Partial<SectionDraft>) => void;
  onRegenerate: (section: BookAnalysisSection) => void;
  onOptimize: (section: BookAnalysisSection) => void;
  onApplyOptimizePreview: (section: BookAnalysisSection) => void;
  onCancelOptimizePreview: (section: BookAnalysisSection) => void;
  onSave: (section: BookAnalysisSection) => void;
}

function formatEvidenceBinding(item: SectionEvidenceItem): string {
  if (!item.fieldKey) {
    return item.label;
  }
  const label = BOOK_ANALYSIS_STRUCTURED_FIELD_LABELS[item.fieldKey] ?? item.fieldKey;
  return item.fieldIndex === undefined ? label : `${label} #${item.fieldIndex + 1}`;
}

export default function BookAnalysisSectionCard(props: BookAnalysisSectionCardProps) {
  const {
    analysisMode,
    section,
    draft,
    readingMode,
    canOperate,
    isRegenerating,
    isOptimizing,
    isSaving,
    hasResultAnomaly,
    evidenceItems,
    selectedEvidenceKey,
    selectedEvidence,
    selectedEvidenceChapter,
    selectedChapterContent,
    isDualPane,
    currentChapterIndex,
    onSelectEvidence,
    onDraftChange,
    onRegenerate,
    onOptimize,
    onApplyOptimizePreview,
    onCancelOptimizePreview,
    onSave,
  } = props;
  const canRegenerate = canOperate && !draft.frozen && !section.frozen && !isRegenerating;
  const canOptimize = canOperate
    && !draft.frozen
    && !section.frozen
    && !isOptimizing
    && draft.optimizeInstruction.trim().length > 0;
  const hasContent = draft.editedContent.trim().length > 0;
  const manualContent = getManualBookAnalysisContent(section);
  const aiContent = section.aiContent ?? "";
  const hasDraftChanges = draft.editedContent !== (section.editedContent?.trim() ? section.editedContent : aiContent);
  const compareWithAi = Boolean(aiContent.trim() && (manualContent || hasDraftChanges));
  const aiAppliedToDraft = draft.editedContent === aiContent;
  const [seenAiContent, setSeenAiContent] = useState(aiContent);
  useEffect(() => {
    if (!compareWithAi) {
      setSeenAiContent(aiContent);
    }
  }, [aiContent, compareWithAi]);
  const unselectedSection = isUnselectedBookAnalysisSection(section) && !hasContent;
  const frozenChangePending = draft.frozen !== section.frozen;
  const contentBlock = hasContent ? (
    <MarkdownViewer content={draft.editedContent} />
  ) : (
    <div className="text-sm text-muted-foreground">
      {unselectedSection
        ? "Esta sección no está incluida en esta generación. Si necesita complementar, puede cancelar el salto, guardarlo y luego regenerarlo."
        : "No hay contenido para mostrar en la sección actual."}
    </div>
  );

  return (
    <Card id={`book-analysis-section-${section.sectionKey}`} className="scroll-mt-28 rounded-2xl border-0 bg-transparent shadow-none">
      <CardHeader className="px-1 pb-4 pt-2 sm:px-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <CardTitle>{section.title}</CardTitle>
            <Badge variant="secondary" className="border-0 bg-muted/65 font-normal">
              <span className={`mr-1.5 h-1.5 w-1.5 rounded-full ${section.status === "succeeded" ? "bg-success" : "bg-muted-foreground/50"}`} />
              {unselectedSection ? "No seleccionado esta vez" : hasResultAnomaly ? "Resultados anormales" : formatStatus(section.status)}
            </Badge>
            {draft.frozen && !unselectedSection ? <Badge variant="secondary" className="border-0 font-normal">Congelado</Badge> : null}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={!canRegenerate}
              onClick={() => onRegenerate(section)}
            >
              Regenerado
            </Button>
            <Button size="sm" disabled={!canOperate || isSaving} onClick={() => onSave(section)}>
              ahorrar
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6 px-1 pb-2 sm:px-2">
        {!manualContent ? (
          <BookAnalysisStructuredSummary
            section={section}
            analysisMode={analysisMode}
            evidenceItems={evidenceItems}
            currentChapterIndex={currentChapterIndex}
          />
        ) : null}

        {evidenceItems.length > 0 ? (
          <div className="space-y-3 rounded-2xl bg-muted/20 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-sm font-medium">Evidencia de esta sección</div>
              <Badge variant="secondary" className="border-0 bg-background/70 font-normal">{evidenceItems.length} Banda</Badge>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {evidenceItems.map((item) => {
                const selected = selectedEvidenceKey === item.evidenceKey;
                return (
                  <button
                    key={item.evidenceKey}
                    type="button"
                    className={`rounded-lg border-0 px-2.5 py-1.5 text-left text-xs leading-5 transition-colors ${
                      selected ? "bg-primary/10 text-primary" : "bg-background/75 hover:bg-background"
                    }`}
                    onClick={() => onSelectEvidence(item.evidenceKey)}
                    title={item.excerpt}
                  >
                    {item.fieldKey ? (
                      <>
                        <span className="font-medium">{formatEvidenceBinding(item)}</span>
                        <span className="ml-1 text-muted-foreground">[{item.sourceLabel}]</span>
                      </>
                    ) : (
                      <span className={selected ? "font-medium" : "font-medium text-muted-foreground"}>
                        {formatEvidenceBinding(item)}
                        <span className="ml-1 opacity-70">[{item.sourceLabel}]</span>
                      </span>
                    )}
                    {item.chapterIndex !== undefined && item.excerptOffsetRange ? (
                      <span className="ml-2 inline-flex items-center gap-1 rounded border px-1 text-[11px] text-muted-foreground">
                        <LocateFixed className="h-3 w-3" />
                        original
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
            {selectedEvidence ? (
              <div className="rounded-xl bg-background/85 p-4 text-sm shadow-[0_8px_24px_rgba(15,23,42,0.035)]">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="font-medium">{selectedEvidence.label}</div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {selectedEvidence.fieldKey
                        ? `${formatEvidenceBinding(selectedEvidence)} | ${selectedEvidence.sourceLabel}`
                        : selectedEvidence.sourceLabel}
                    </div>
                  </div>
                  {selectedEvidence.chapterIndex !== undefined ? (
                    <Badge variant="outline">Cap. {selectedEvidence.chapterIndex + 1} Cap.</Badge>
                  ) : null}
                </div>
                <div className="mt-2 whitespace-pre-wrap text-muted-foreground">{selectedEvidence.excerpt}</div>
                {!isDualPane && selectedEvidenceChapter && selectedEvidence.excerptOffsetRange ? (
                  <div className="mt-3">
                    <div className="mb-2 text-xs font-medium text-muted-foreground">
                      Posicionamiento original:{selectedEvidenceChapter.title}
                    </div>
                    <HighlightedChapterExcerpt
                      chapterContent={selectedChapterContent}
                      chapterStartOffset={selectedEvidenceChapter.startOffset}
                      range={selectedEvidence.excerptOffsetRange}
                    />
                  </div>
                ) : isDualPane && selectedEvidenceChapter && selectedEvidence.excerptOffsetRange ? (
                  <div className="mt-2 text-xs text-muted-foreground">Esta prueba se ha ubicado en la sección del artículo original a la izquierda.</div>
                ) : (
                  <div className="mt-2 text-xs text-muted-foreground">Esta evidencia actualmente no tiene una ubicación de capítulo a la que saltar.</div>
                )}
              </div>
            ) : null}
          </div>
        ) : null}

        {readingMode === "full" || manualContent || hasDraftChanges ? (
          <div className="space-y-2">
            <div className="text-sm font-medium">{hasDraftChanges ? "Borrador de texto" : manualContent ? "Corregir el texto a mano." : "Analizar texto"}</div>
            <div className="min-h-[220px] rounded-2xl bg-muted/20 px-5 py-5 leading-7">
              {contentBlock}
            </div>
          </div>
        ) : (
          <details className="rounded-2xl bg-muted/15 p-4">
            <summary className="cursor-pointer text-sm font-medium">Ver texto completo</summary>
            <div className="mt-3 min-h-[180px] rounded-xl bg-background/75 p-4">
              {contentBlock}
            </div>
          </details>
        )}

        {compareWithAi ? (
          <details
            className="rounded-2xl bg-muted/15 p-4"
            onToggle={(event) => { if (event.currentTarget.open) setSeenAiContent(aiContent); }}
          >
            <summary className="cursor-pointer text-sm font-medium">
              Comparar la versión generada por IA
              {section.status === "succeeded" && aiContent !== seenAiContent ? (
                <span className="ml-2 text-xs text-primary">Hay nuevos resultados generados.</span>
              ) : null}
            </summary>
            <div className="mt-3 grid gap-4 lg:grid-cols-2">
              <div className="min-w-0 space-y-2">
                <h4 className="text-sm font-medium">{aiAppliedToDraft ? "Texto guardado" : "Texto actual"}</h4>
                <div className="max-h-96 overflow-auto">
                  <MarkdownViewer content={aiAppliedToDraft ? manualContent ?? "" : draft.editedContent} />
                </div>
              </div>
              <div className="min-w-0 space-y-2">
                <h4 className="text-sm font-medium">Versión generada por IA</h4>
                <div className="max-h-96 overflow-auto">
                  <MarkdownViewer content={aiContent} />
                </div>
              </div>
            </div>
            {canOperate ? (
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={isSaving || aiAppliedToDraft}
                  onClick={() => onDraftChange(section, { editedContent: aiContent })}
                >
                  Adopte la versión AI
                </Button>
                <span className="text-xs text-muted-foreground">{aiAppliedToDraft ? "Haga clic en \"Guardar\" para adoptar la versión AI." : "Complete el borrador del texto y guárdelo para que surta efecto."}</span>
              </div>
            ) : null}
          </details>
        ) : null}

        <details className="rounded-2xl border border-border/40 bg-muted/10 p-4">
          <summary className="cursor-pointer text-sm font-medium">{canOperate ? "Edición y optimización" : "Archivar contenido y notas"}</summary>
          <div className="mt-3 space-y-4">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={draft.frozen}
                disabled={!canOperate}
                onChange={(event) => onDraftChange(section, { frozen: event.target.checked })}
              />
              Omita la repetición automática y mantenga el contenido existente de esta sección.
            </label>

            {draft.frozen || frozenChangePending ? (
              <div className="rounded-md border border-warning/30 bg-warning/5 p-2 text-xs text-foreground">
                {frozenChangePending
                  ? draft.frozen
                    ? "La configuración de omisión no se ha guardado. Después de guardar, la repetición automática conservará el contenido existente de esta sección."
                    : "Cancelar Omitir No guardado. Una vez guardado, puede regenerarlo o utilizar la optimización de IA."
                  : unselectedSection
                    ? "Esta sección no está incluida en esta generación. Si necesita agregar algo, cancele la omisión y guárdelo primero."
                    : "El contenido actual está congelado. Cuando se requiera regeneración u optimización de IA, cancele el salto y guarde primero."}
              </div>
            ) : null}

            <div className="space-y-2">
              <div className="text-sm font-medium">Esta sección presta especial atención a</div>
              <textarea
                className="min-h-[90px] w-full rounded-md border bg-background p-3 text-sm"
                value={draft.focusInstruction}
                disabled={!canOperate}
                onChange={(event) => onDraftChange(section, { focusInstruction: event.target.value })}
                placeholder="Por ejemplo: mire únicamente la evidencia de las transiciones en el avance de etapa, o concéntrese en verificar si los aspectos destacados de los personajes se pueden reutilizar."
              />
            </div>

            <div className="space-y-2">
              <div className="text-sm font-medium">Editar texto</div>
              <textarea
                className="min-h-[220px] w-full rounded-md border bg-background p-3 text-sm"
                value={draft.editedContent}
                disabled={!canOperate}
                onChange={(event) => onDraftChange(section, { editedContent: event.target.value })}
                placeholder="Edite el borrador de la sección actual directamente aquí."
              />
            </div>

            <div className="space-y-2">
              <div className="text-sm font-medium">Optimización/corrección de IA</div>
              <textarea
                className="min-h-[90px] w-full rounded-md border bg-background p-2 text-sm"
                value={draft.optimizeInstruction}
                disabled={!canOperate}
                onChange={(event) => onDraftChange(section, { optimizeInstruction: event.target.value })}
                placeholder="Ingrese palabras clave de optimización o corrección, tales como: comprimir redundancia, resaltar conflictos, mantener los mismos hechos."
              />
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!canOptimize}
                  onClick={() => onOptimize(section)}
                >
                  {isOptimizing ? "Generando vista previa..." : "Generar vista previa de optimización"}
                </Button>
              </div>
            </div>

            {draft.optimizePreview.trim() ? (
              <div className="space-y-2">
                <div className="text-xs font-medium text-muted-foreground">Optimizar vista previa</div>
                <div className="max-h-[320px] overflow-auto rounded-md border bg-muted/20 p-4">
                  <MarkdownViewer content={draft.optimizePreview} />
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" disabled={!canOperate} onClick={() => onApplyOptimizePreview(section)}>
                    Aplicar al borrador actual
                  </Button>
                  <Button size="sm" variant="outline" disabled={!canOperate} onClick={() => onCancelOptimizePreview(section)}>
                    Cancelar vista previa
                  </Button>
                </div>
              </div>
            ) : null}

            <div className="space-y-2">
              <div className="text-sm font-medium">Observación</div>
              <textarea
                className="min-h-[120px] w-full rounded-md border bg-background p-3 text-sm"
                value={draft.notes}
                disabled={!canOperate}
                onChange={(event) => onDraftChange(section, { notes: event.target.value })}
                placeholder="Agregue notas, suposiciones o acciones de seguimiento."
              />
            </div>
          </div>
        </details>
      </CardContent>
    </Card>
  );
}

function HighlightedChapterExcerpt(props: {
  chapterContent: string;
  chapterStartOffset: number;
  range: { start: number; end: number };
}) {
  const relativeStart = Math.max(0, props.range.start - props.chapterStartOffset);
  const relativeEnd = Math.min(props.chapterContent.length, Math.max(relativeStart, props.range.end - props.chapterStartOffset));
  const previewStart = Math.max(0, relativeStart - 360);
  const previewEnd = Math.min(props.chapterContent.length, relativeEnd + 360);
  const before = props.chapterContent.slice(previewStart, relativeStart);
  const highlight = props.chapterContent.slice(relativeStart, relativeEnd);
  const after = props.chapterContent.slice(relativeEnd, previewEnd);

  return (
    <div className="max-h-[320px] overflow-auto rounded-md border bg-muted/20 p-3 leading-7 whitespace-pre-wrap">
      {previewStart > 0 ? <span className="text-muted-foreground">...</span> : null}
      <span>{before}</span>
      <mark className="rounded bg-warning/20 px-1 text-foreground">{highlight}</mark>
      <span>{after}</span>
      {previewEnd < props.chapterContent.length ? <span className="text-muted-foreground">...</span> : null}
    </div>
  );
}
