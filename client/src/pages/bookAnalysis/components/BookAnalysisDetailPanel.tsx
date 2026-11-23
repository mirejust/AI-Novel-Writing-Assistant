import { useEffect, useMemo, useRef, useState } from "react";
import type { RefObject } from "react";
import type {
  BookAnalysisDetail,
  BookAnalysisPublishResult,
  BookAnalysisSection,
  BookAnalysisSectionKey,
} from "@ai-novel/shared/types/bookAnalysis";
import type { DocumentChapter } from "@ai-novel/shared/types/knowledge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertTriangle, Loader2, RefreshCw } from "lucide-react";
import type { ReactNode } from "react";
import type { AggregatedEvidenceItem, SectionDraft, SectionEvidenceItem } from "../bookAnalysis.types";
import {
  formatDate,
  formatStage,
  formatStatus,
  isBookAnalysisBudgetExceeded,
} from "../bookAnalysis.utils";
import {
  getPreferredBookAnalysisSection,
  isReadableBookAnalysisSection,
  isUnselectedBookAnalysisSection,
  summarizeBookAnalysisSections,
} from "../bookAnalysisWorkspaceViewModel";
import type { BookAnalysisMode } from "../hooks/bookAnalysisWorkspace.types";
import type {
  BookAnalysisChapterHighlightRange,
  BookAnalysisChapterReaderHandle,
} from "../hooks/useBookAnalysisChapterReader";
import BookAnalysisDualPaneLayout from "./BookAnalysisDualPaneLayout";
import BookAnalysisSectionCard from "./BookAnalysisSectionCard";
import SelectControl from "@/components/common/SelectControl";

type ExportFormat = "markdown" | "json";

function formatTokenCount(value: number | null | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "0";
  }
  return new Intl.NumberFormat("zh-CN").format(Math.max(0, Math.round(value)));
}

function hasMeaningfulStructuredValue(value: unknown): boolean {
  if (typeof value === "string") {
    return value.trim().length > 0;
  }
  if (Array.isArray(value)) {
    return value.some(hasMeaningfulStructuredValue);
  }
  if (value && typeof value === "object") {
    return Object.values(value).some(hasMeaningfulStructuredValue);
  }
  return false;
}

function hasUsableSectionResult(section: BookAnalysisSection): boolean {
  const effectiveContent = section.editedContent ?? section.aiContent ?? "";
  const hasReadableContent = effectiveContent.trim().length > 0;
  return hasReadableContent || hasMeaningfulStructuredValue(section.structuredData);
}

interface NovelOption {
  id: string;
  title: string;
}

interface PendingState {
  regenerate: boolean;
  optimizePreview: boolean;
  saveSection: boolean;
  publish: boolean;
}

interface BookAnalysisDetailPanelProps {
  analysisMode: BookAnalysisMode;
  selectedAnalysis: BookAnalysisDetail;
  novelOptions: NovelOption[];
  documentChapters: DocumentChapter[];
  sourceVersionContent: string;
  sourceLoading: boolean;
  sourceError: string;
  chaptersLoading: boolean;
  chaptersError: string;
  selectedNovelId: string;
  publishFeedback: string;
  styleProfileFeedback: string;
  lastPublishResult: BookAnalysisPublishResult | null;
  aggregatedEvidence: AggregatedEvidenceItem[];
  optimizingSectionKey: BookAnalysisSection["sectionKey"] | null;
  isDualPane: boolean;
  currentChapterIndex: number | null;
  chapterHighlightRange: BookAnalysisChapterHighlightRange | null;
  chapterReaderRef: RefObject<BookAnalysisChapterReaderHandle | null>;
  rightColumnExtra?: ReactNode;
  pending: PendingState;
  onActiveChapterChange: (chapterIndex: number) => void;
  onSelectChapter: (chapterIndex: number) => void;
  onEvidenceJump: (chapterIndex: number, range: { start: number; end: number }) => void;
  onRetrySource: () => void;
  onRetryChapters: () => void;
  onSelectedNovelChange: (novelId: string) => void;
  onPublish: () => void;
  onRegenerateSection: (section: BookAnalysisSection) => void;
  onOptimizeSection: (section: BookAnalysisSection) => void;
  onApplyOptimizePreview: (section: BookAnalysisSection) => void;
  onCancelOptimizePreview: (section: BookAnalysisSection) => void;
  onSaveSection: (section: BookAnalysisSection) => void;
  onDraftChange: (section: BookAnalysisSection, patch: Partial<SectionDraft>) => void;
  getSectionDraft: (section: BookAnalysisSection) => SectionDraft;
}

export default function BookAnalysisDetailPanel(props: BookAnalysisDetailPanelProps) {
  const {
    analysisMode,
    selectedAnalysis,
    novelOptions,
    documentChapters,
    sourceVersionContent,
    sourceLoading,
    sourceError,
    chaptersLoading,
    chaptersError,
    selectedNovelId,
    publishFeedback,
    styleProfileFeedback,
    lastPublishResult,
    aggregatedEvidence,
    optimizingSectionKey,
    isDualPane,
    currentChapterIndex,
    chapterHighlightRange,
    chapterReaderRef,
    rightColumnExtra,
    pending,
    onActiveChapterChange,
    onSelectChapter,
    onEvidenceJump,
    onRetrySource,
    onRetryChapters,
    onSelectedNovelChange,
    onPublish,
    onRegenerateSection,
    onOptimizeSection,
    onApplyOptimizePreview,
    onCancelOptimizePreview,
    onSaveSection,
    onDraftChange,
    getSectionDraft,
  } = props;
  const [selectedEvidenceKey, setSelectedEvidenceKey] = useState("");
  const [readingMode, setReadingMode] = useState<"summary" | "full">("full");
  const [activeSectionKey, setActiveSectionKey] = useState<BookAnalysisSectionKey | "">("");
  const previousAnalysisIdRef = useRef<string | null>(null);
  const previousAnalysisStatusRef = useRef<BookAnalysisDetail["status"] | null>(null);

  const evidenceEntries = useMemo<SectionEvidenceItem[]>(
    () => aggregatedEvidence.map((item, index) => ({
      ...item,
      evidenceKey: `${item.sectionKey}-${index}`,
    })),
    [aggregatedEvidence],
  );

  const evidenceBySection = useMemo(() => {
    const groups = new Map<BookAnalysisSectionKey, SectionEvidenceItem[]>();
    for (const item of evidenceEntries) {
      const next = groups.get(item.sectionKey) ?? [];
      next.push(item);
      groups.set(item.sectionKey, next);
    }
    return groups;
  }, [evidenceEntries]);

  const selectedEvidence = useMemo(() => {
    if (!selectedEvidenceKey) {
      return null;
    }
    return evidenceEntries.find((item) => item.evidenceKey === selectedEvidenceKey) ?? null;
  }, [evidenceEntries, selectedEvidenceKey]);

  const selectedEvidenceChapter = useMemo(() => {
    if (!selectedEvidence || selectedEvidence.chapterIndex === undefined) {
      return null;
    }
    return documentChapters.find((chapter) => chapter.chapterIndex === selectedEvidence.chapterIndex) ?? null;
  }, [documentChapters, selectedEvidence]);

  const selectedChapterContent = selectedEvidenceChapter && sourceVersionContent
    ? sourceVersionContent.slice(selectedEvidenceChapter.startOffset, selectedEvidenceChapter.endOffset)
    : "";

  const handleSelectEvidence = (evidenceKey: string) => {
    const item = evidenceEntries.find((entry) => entry.evidenceKey === evidenceKey);
    const willSelect = selectedEvidenceKey !== evidenceKey;
    setSelectedEvidenceKey(willSelect ? evidenceKey : "");
    if (
      willSelect &&
      isDualPane &&
      item?.chapterIndex !== undefined &&
      item.excerptOffsetRange
    ) {
      onEvidenceJump(item.chapterIndex, item.excerptOffsetRange);
    }
  };

  const sectionStats = useMemo(
    () => summarizeBookAnalysisSections(selectedAnalysis),
    [selectedAnalysis],
  );

  const invalidSucceededSections = useMemo(() => {
    return selectedAnalysis.sections.filter(
      (section) => !section.frozen && section.status === "succeeded" && !hasUsableSectionResult(section),
    );
  }, [selectedAnalysis]);
  const invalidSucceededSectionIds = useMemo(
    () => new Set(invalidSucceededSections.map((section) => section.id)),
    [invalidSucceededSections],
  );

  useEffect(() => {
    const analysisChanged = previousAnalysisIdRef.current !== selectedAnalysis.id;
    const previousStatus = previousAnalysisStatusRef.current;
    const generationJustFinished = !analysisChanged
      && (previousStatus === "queued" || previousStatus === "running")
      && selectedAnalysis.status !== "queued"
      && selectedAnalysis.status !== "running";
    previousAnalysisIdRef.current = selectedAnalysis.id;
    previousAnalysisStatusRef.current = selectedAnalysis.status;
    if (analysisChanged) {
      setSelectedEvidenceKey("");
    }
    if (!selectedAnalysis.sections.length) {
      setActiveSectionKey("");
      return;
    }
    const activeSection = selectedAnalysis.sections.find((section) => section.sectionKey === activeSectionKey);
    if (analysisChanged || !activeSection || (generationJustFinished && !isReadableBookAnalysisSection(activeSection))) {
      const preferred = getPreferredBookAnalysisSection(selectedAnalysis.sections);
      setActiveSectionKey((preferred?.sectionKey ?? selectedAnalysis.sections[0].sectionKey) as BookAnalysisSectionKey);
    }
  }, [activeSectionKey, selectedAnalysis]);

  const activeTabValue =
    activeSectionKey || (selectedAnalysis.sections[0]?.sectionKey as BookAnalysisSectionKey | undefined) || "overview";
  const budgetTokens = selectedAnalysis.budgetTokens ?? null;
  const usedTokens = selectedAnalysis.usedTokens ?? 0;
  const budgetUsageRatio = budgetTokens ? Math.min(1, usedTokens / budgetTokens) : 0;
  const budgetExceeded = isBookAnalysisBudgetExceeded(selectedAnalysis.lastError);

  return (
    <div className="space-y-3">

      {selectedAnalysis.lastError ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
          {budgetExceeded
            ? `El presupuesto se ha agotado y la misión se ha detenido. Uso acumulativo ${formatTokenCount(usedTokens)} / ${formatTokenCount(budgetTokens)} fichas. Se recomienda ampliar el presupuesto primero y luego ejecutarlo.`
            : `Errores recientes:${selectedAnalysis.lastError}`}
        </div>
      ) : null}

      {sourceLoading || chaptersLoading ? (
        <div className="flex items-center gap-2 rounded-md border border-info/25 bg-info/5 p-3 text-sm text-muted-foreground" aria-live="polite">
          <Loader2 className="h-4 w-4 animate-spin text-info" aria-hidden="true" />
          Se está cargando la posición de lectura del texto original. Los resultados de desempaquetar el libro aún se pueden ver.
        </div>
      ) : null}

      {sourceError || chaptersError ? (
        <div className="flex flex-col gap-3 rounded-md border border-warning/30 bg-warning/5 p-3 text-sm sm:flex-row sm:items-center sm:justify-between" role="status">
          <div className="flex min-w-0 items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden="true" />
            <div>
              <div className="font-medium text-foreground">La comparación de texto original no está disponible temporalmente</div>
              <div className="mt-1 text-muted-foreground">
                {chaptersError || sourceError} Los resultados de apertura de libros generados no se ocultarán ni eliminarán.
              </div>
            </div>
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={chaptersError ? onRetryChapters : onRetrySource}
          >
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
            Reintentar cargar el texto original
          </Button>
        </div>
      ) : null}

      {invalidSucceededSections.length > 0 ? (
        <div className="rounded-md border border-warning/30 bg-warning/5 p-3 text-sm text-warning" role="alert">
          <div className="font-medium">El resultado es una excepción.</div>
          <div className="mt-1">
            {invalidSucceededSections.map((section) => section.title).join(",")}: No se genera texto legible ni contenido estructurado. Haga clic en "Regenerar" después de que la ruta del modelo confirme que el modelo registrado en la tarea está disponible; Si necesita cambiar el modelo, cree un nuevo libro de demolición.
          </div>
        </div>
      ) : null}

      <BookAnalysisDualPaneLayout
        enabled={isDualPane && !sourceError && !chaptersError}
        chapters={documentChapters}
        sourceVersionContent={sourceVersionContent}
        readerRef={chapterReaderRef}
        currentChapterIndex={currentChapterIndex}
        highlightRange={chapterHighlightRange}
        onActiveChapterChange={onActiveChapterChange}
        onSelectChapter={onSelectChapter}
      >
        <div className="space-y-5">
          <details className="rounded-2xl border border-border/45 bg-card/65 px-5 py-4 shadow-[0_8px_28px_rgba(15,23,42,0.03)]">
            <summary className="cursor-pointer list-none">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-medium">Analizar información y publicar</div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    sección de planificación {sectionStats.readableExpected}/{sectionStats.expected} Legible
                    {sectionStats.unselected > 0 ? `, no seleccionado esta vez ${sectionStats.unselected} Festival` : ""}
                    {sectionStats.frozenReadable > 0 ? `, resultados congelados ${sectionStats.frozenReadable} Festival` : ""}
                  </div>
                </div>
                <Badge variant="secondary" className="border-0 bg-muted/60 font-normal">Expandir</Badge>
              </div>
            </summary>
            <div className="mt-3 space-y-3">
              {!selectedAnalysis.isCurrentVersion ? (
                <div className="rounded-md border border-warning/30 bg-warning/5 p-3 text-sm text-foreground">
                  Este análisis se basa en una versión anterior del documento fuente, actualmente la versión del documento activo es v{selectedAnalysis.currentDocumentVersionNumber}.
                </div>
              ) : null}
              {styleProfileFeedback ? (
                <div className="rounded-md border border-primary/20 bg-primary/5 p-3 text-sm text-muted-foreground">
                  {styleProfileFeedback}
                </div>
              ) : null}
              <div className="rounded-xl bg-muted/25 p-4 text-sm">
                <div className="mb-2 font-medium">Publicar en una nueva base de conocimientos</div>
                <div className="flex flex-wrap items-center gap-2">
                  <SelectControl
                    className="h-9 min-w-[220px] rounded-md border bg-background px-2 text-sm"
                    value={selectedNovelId}
                    onChange={(event) => onSelectedNovelChange(event.target.value)}
                  >
                    <option value="">Seleccionar novela de destino</option>
                    {novelOptions.map((novel) => (
                      <option key={novel.id} value={novel.id}>
                        {novel.title}
                      </option>
                    ))}
                  </SelectControl>
                  <Button
                    size="sm"
                    onClick={onPublish}
                    disabled={!selectedNovelId || pending.publish || selectedAnalysis.status === "archived"}
                  >
                    publicar y vincular
                  </Button>
                </div>
                {publishFeedback ? <div className="mt-2 text-xs text-muted-foreground">{publishFeedback}</div> : null}
                {lastPublishResult ? (
                  <div className="mt-1 text-xs text-muted-foreground">Hora de liberación:{formatDate(lastPublishResult.publishedAt)}</div>
                ) : null}
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-xl bg-muted/20 p-4 text-sm">
                  <div className="font-medium">Resumen</div>
                  <div className="mt-2 whitespace-pre-wrap text-muted-foreground">
                    {selectedAnalysis.summary?.trim() || "Una vez generada la descripción general, el contenido del resumen se muestra aquí."}
                  </div>
                </div>
                <div className="rounded-xl bg-muted/20 p-4 text-sm">
                  <div className="font-medium">Ejecutar metainformación</div>
                  <div className="mt-2 space-y-1 text-muted-foreground">
                    <div>Proveedor:{selectedAnalysis.provider ?? "deepseek"}</div>
                    <div>Modelo:{selectedAnalysis.model || "Predeterminado"}</div>
                    <div>Temperatura:{selectedAnalysis.temperature ?? "Predeterminado"}</div>
                    <div>Fichas máximas:{selectedAnalysis.maxTokens ?? "Predeterminado"}</div>
                    <div>
                      Uso del presupuesto:{budgetTokens
                        ? `${formatTokenCount(usedTokens)} / ${formatTokenCount(budgetTokens)} tokens`
                        : "Sin límite"}
                    </div>
                    {budgetTokens ? (
                      <div
                        className="h-1.5 overflow-hidden rounded-full bg-muted"
                        role="progressbar"
                        aria-label="Progreso del uso del presupuesto dividido en libros"
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={Math.round(budgetUsageRatio * 100)}
                      >
                        <div
                          className={`h-full rounded-full ${budgetExceeded ? "bg-destructive" : "bg-primary"}`}
                          style={{ width: `${Math.round(budgetUsageRatio * 100)}%` }}
                        />
                      </div>
                    ) : null}
                    <div>Alcance original:{selectedAnalysis.sourceRange?.label ?? "Texto completo"}</div>
                    <div>Etapa actual:{formatStage(selectedAnalysis.currentStage)}</div>
                    <div>Sección actual:{selectedAnalysis.currentItemLabel ?? "Sin datos"}</div>
                    <div>Latido reciente:{formatDate(selectedAnalysis.heartbeatAt)}</div>
                    <div>Ejecutado recientemente:{formatDate(selectedAnalysis.lastRunAt)}</div>
                    <div>Hora de creación:{formatDate(selectedAnalysis.createdAt)}</div>
                  </div>
                </div>
              </div>
            </div>
          </details>

          <section className="overflow-hidden rounded-2xl border border-border/45 bg-card shadow-[0_16px_46px_rgba(15,23,42,0.045)]">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border/35 px-5 py-4">
              <div className="flex flex-wrap items-center gap-2">
                <div className="text-lg font-semibold tracking-tight">Contenido del libro abierto</div>
                <Badge variant="secondary" className="border-0 bg-muted/70 font-normal">legible {sectionStats.readableExpected}/{sectionStats.expected}</Badge>
                {sectionStats.unselected > 0 ? <Badge variant="secondary" className="border-0 font-normal">No seleccionado esta vez {sectionStats.unselected}</Badge> : null}
                {sectionStats.frozenReadable > 0 ? <Badge variant="secondary" className="border-0 font-normal">Resultados congelados {sectionStats.frozenReadable}</Badge> : null}
              </div>
              <div className="flex rounded-xl bg-muted/55 p-1">
                <Button
                  size="sm"
                  variant={readingMode === "summary" ? "default" : "ghost"}
                  onClick={() => setReadingMode("summary")}
                >
                  Reflejos
                </Button>
                <Button
                  size="sm"
                  variant={readingMode === "full" ? "default" : "ghost"}
                  onClick={() => setReadingMode("full")}
                >
                  Leer completo
                </Button>
              </div>
            </div>
            <div className="space-y-5 p-4 sm:p-5">
              {selectedAnalysis.sections.length === 0 ? (
                <div className="rounded-md border border-dashed border-warning/40 bg-warning/5 px-5 py-8 text-center">
                  <AlertTriangle className="mx-auto h-5 w-5 text-warning" aria-hidden="true" />
                  <div className="mt-3 text-sm font-medium text-foreground">No hay ninguna sección de apertura de libros para mostrar.</div>
                  <p className="mx-auto mt-1 max-w-xl text-sm leading-6 text-muted-foreground">
                    Esta tarea no arrojó contenido legible. El documento fuente aún está seguro y se puede regenerar desde arriba o abrir el Centro de tareas para ver los detalles.
                  </p>
                </div>
              ) : (
              <Tabs
                value={activeTabValue}
                onValueChange={(value) => setActiveSectionKey(value as BookAnalysisSectionKey)}
                className="space-y-3"
              >
                <TabsList className="flex h-auto w-full flex-wrap justify-start gap-x-5 gap-y-1 rounded-none border-b border-border/40 bg-transparent p-0">
                  {selectedAnalysis.sections.map((section) => (
                    <TabsTrigger key={section.sectionKey} value={section.sectionKey} className="gap-2 rounded-none border-b-2 border-transparent bg-transparent px-0 pb-3 pt-2 shadow-none data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none">
                      <span>{section.title}</span>
                      <span className="text-xs text-muted-foreground">
                        {section.frozen
                          ? isUnselectedBookAnalysisSection(section) ? "No seleccionado esta vez" : "Congelado"
                          : invalidSucceededSectionIds.has(section.id) ? "Resultados anormales" : formatStatus(section.status)}
                      </span>
                    </TabsTrigger>
                  ))}
                </TabsList>
                {selectedAnalysis.sections.map((section) => {
                  const sectionEvidence = evidenceBySection.get(section.sectionKey as BookAnalysisSectionKey) ?? [];
                  const isSelectedEvidenceInSection = selectedEvidence?.sectionKey === section.sectionKey;
                  return (
                    <TabsContent key={section.id} value={section.sectionKey} className="mt-0">
                      <BookAnalysisSectionCard
                        analysisMode={analysisMode}
                        section={section}
                        draft={getSectionDraft(section)}
                        readingMode={readingMode}
                        canOperate={selectedAnalysis.status !== "archived"}
                        isRegenerating={pending.regenerate}
                        isOptimizing={pending.optimizePreview && optimizingSectionKey === section.sectionKey}
                        isSaving={pending.saveSection}
                        hasResultAnomaly={invalidSucceededSectionIds.has(section.id)}
                        evidenceItems={sectionEvidence}
                        selectedEvidenceKey={selectedEvidenceKey}
                        selectedEvidence={isSelectedEvidenceInSection ? selectedEvidence : null}
                        selectedEvidenceChapter={isSelectedEvidenceInSection ? selectedEvidenceChapter : null}
                        selectedChapterContent={isSelectedEvidenceInSection ? selectedChapterContent : ""}
                        isDualPane={isDualPane}
                        currentChapterIndex={isDualPane ? currentChapterIndex : null}
                        onSelectEvidence={handleSelectEvidence}
                        onDraftChange={onDraftChange}
                        onRegenerate={onRegenerateSection}
                        onOptimize={onOptimizeSection}
                        onApplyOptimizePreview={onApplyOptimizePreview}
                        onCancelOptimizePreview={onCancelOptimizePreview}
                        onSave={onSaveSection}
                      />
                    </TabsContent>
                  );
                })}
              </Tabs>
              )}
            </div>
          </section>
          {rightColumnExtra}
        </div>
      </BookAnalysisDualPaneLayout>
    </div>
  );
}
