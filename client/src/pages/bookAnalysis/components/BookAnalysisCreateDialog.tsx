import {
  BOOK_ANALYSIS_PRESETS,
  BOOK_ANALYSIS_SECTIONS,
  DEFAULT_BOOK_ANALYSIS_BUDGET_TOKENS,
  type BookAnalysisPreset,
} from "@ai-novel/shared/types/bookAnalysis";
import type { DocumentChapter, KnowledgeDocumentDetail, KnowledgeDocumentSummary } from "@ai-novel/shared/types/knowledge";
import LLMSelector from "@/components/common/LLMSelector";
import BookAnalysisSourceRangePicker from "./BookAnalysisSourceRangePicker";
import { Button } from "@/components/ui/button";
import { AppDialogContent, Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { LLMConfigState } from "../bookAnalysis.types";
import type { BookAnalysisMode, BookAnalysisSourceRangeDraft, NovelOption } from "../hooks/bookAnalysisWorkspace.types";
import SelectControl from "@/components/common/SelectControl";

interface BookAnalysisCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  analysisMode: BookAnalysisMode;
  selectedDocumentId: string;
  selectedVersionId: string;
  selectedDiagnosisNovelId: string;
  userFocusInstruction: string;
  selectedSourceRange: BookAnalysisSourceRangeDraft;
  budgetTokens: number | null;
  analysisPreset: BookAnalysisPreset;
  llmConfig: LLMConfigState;
  documentOptions: KnowledgeDocumentSummary[];
  versionOptions: KnowledgeDocumentDetail["versions"];
  sourceDocument?: KnowledgeDocumentDetail;
  sourceChapters: DocumentChapter[];
  sourceChaptersRequested: boolean;
  sourceChaptersLoading: boolean;
  sourceChaptersError: string;
  novelOptions: NovelOption[];
  createPending: boolean;
  createDiagnosisPending: boolean;
  onModeChange: (mode: BookAnalysisMode) => void;
  onSelectDocument: (documentId: string) => void;
  onSelectVersion: (versionId: string) => void;
  onSelectDiagnosisNovel: (novelId: string) => void;
  onUserFocusInstructionChange: (instruction: string) => void;
  onSourceRangeChange: (range: BookAnalysisSourceRangeDraft) => void;
  onBudgetTokensChange: (budgetTokens: number | null) => void;
  onRequestSourceChapters: () => void;
  onAnalysisPresetChange: (preset: BookAnalysisPreset) => void;
  onLlmConfigChange: (config: LLMConfigState) => void;
  onCreate: () => void;
  onCreateDiagnosis: () => void;
}

const ESTIMATED_SEGMENT_CHARS = 10_000;
const MAX_ESTIMATED_SEGMENTS = 12;

function formatCount(value: number): string {
  return new Intl.NumberFormat("zh-CN").format(value);
}

function getBookAnalysisScaleLabel(charCount: number): { label: string; tone: string } {
  if (charCount >= 300_000) {
    return { label: "Libros grandes", tone: "Se recomienda utilizar un modelo con mayor control de costos o dividir primero el alcance del documento." };
  }
  if (charCount >= 100_000) {
    return { label: "Tamaño mediano", tone: "Adecuado para la división de libros estándar, el tiempo de generación y el uso de tokens aumentarán con el tamaño del capítulo." };
  }
  return { label: "Ligero", tone: "Bueno para una revisión rápida de la estructura, el carácter y las características de la escritura." };
}

function getPresetSectionTitles(sectionKeys: readonly string[]): string {
  return sectionKeys
    .map((key) => BOOK_ANALYSIS_SECTIONS.find((section) => section.key === key)?.title)
    .filter((title): title is string => Boolean(title))
    .join(",");
}

export default function BookAnalysisCreateDialog(props: BookAnalysisCreateDialogProps) {
  const {
    open,
    onOpenChange,
    analysisMode,
    selectedDocumentId,
    selectedVersionId,
    selectedDiagnosisNovelId,
    userFocusInstruction,
    selectedSourceRange,
    budgetTokens,
    analysisPreset,
    llmConfig,
    documentOptions,
    versionOptions,
    sourceDocument,
    sourceChapters,
    sourceChaptersRequested,
    sourceChaptersLoading,
    sourceChaptersError,
    novelOptions,
    createPending,
    createDiagnosisPending,
    onModeChange,
    onSelectDocument,
    onSelectVersion,
    onSelectDiagnosisNovel,
    onUserFocusInstructionChange,
    onSourceRangeChange,
    onBudgetTokensChange,
    onRequestSourceChapters,
    onAnalysisPresetChange,
    onLlmConfigChange,
    onCreate,
    onCreateDiagnosis,
  } = props;

  const isDiagnosisMode = analysisMode === "diagnosis";
  const selectedSourceVersion = sourceDocument?.versions.find((version) => version.id === selectedVersionId)
    ?? sourceDocument?.versions.find((version) => version.isActive)
    ?? sourceDocument?.versions[0];
  const sourceCharCount = selectedSourceVersion?.charCount ?? selectedSourceVersion?.content.length ?? 0;
  const sortedSourceChapters = [...sourceChapters].sort((a, b) => a.chapterIndex - b.chapterIndex);
  const rangeStartChapter = selectedSourceRange
    ? sortedSourceChapters.find((chapter) => chapter.chapterIndex === selectedSourceRange.startChapterIndex)
    : null;
  const rangeEndChapter = selectedSourceRange
    ? sortedSourceChapters.find((chapter) => chapter.chapterIndex === selectedSourceRange.endChapterIndex)
    : null;
  const selectedRangeCharCount = rangeStartChapter && rangeEndChapter
    ? Math.max(0, rangeEndChapter.endOffset - rangeStartChapter.startOffset)
    : sourceCharCount;
  const effectiveSourceCharCount = selectedSourceRange ? selectedRangeCharCount : sourceCharCount;
  const sourceRangeValid = !selectedSourceRange || Boolean(rangeStartChapter && rangeEndChapter && selectedRangeCharCount > 0);
  const estimatedSegmentCount = effectiveSourceCharCount > 0
    ? Math.min(MAX_ESTIMATED_SEGMENTS, Math.max(1, Math.ceil(effectiveSourceCharCount / ESTIMATED_SEGMENT_CHARS)))
    : 0;
  const selectedPreset = BOOK_ANALYSIS_PRESETS.find((preset) => preset.key === analysisPreset) ?? BOOK_ANALYSIS_PRESETS[1];
  const estimatedSectionCount = selectedPreset.sectionKeys.length;
  const estimatedLlmCalls = estimatedSegmentCount > 0 ? estimatedSegmentCount + estimatedSectionCount : 0;
  const scale = getBookAnalysisScaleLabel(effectiveSourceCharCount);

  const canSubmit = isDiagnosisMode
    ? Boolean(selectedDiagnosisNovelId) && !createDiagnosisPending
    : Boolean(selectedDocumentId) && sourceRangeValid && !createPending;
  const submitting = isDiagnosisMode ? createDiagnosisPending : createPending;
  const submitLabel = isDiagnosisMode
    ? (createDiagnosisPending ? "Creando diagnóstico..." : "Crear un libro de averías de diagnóstico")
    : (createPending ? "Creando..." : "Crear un libro dividido");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <AppDialogContent
        title="Análisis de libros recién abiertos."
        description="Seleccione el documento y el alcance de apertura del libro y, después del envío, aparecerá una nueva tarea en la lista de análisis a la derecha."
        className="max-w-4xl"
        footer={
          <div className="flex w-full items-center justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={!canSubmit}
              onClick={isDiagnosisMode ? onCreateDiagnosis : onCreate}
            >
              {submitLabel}
            </Button>
          </div>
        }
      >
        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2 rounded-md border bg-muted/20 p-1">
              <Button
                type="button"
                size="sm"
                variant={analysisMode === "reference" ? "default" : "ghost"}
                onClick={() => onModeChange("reference")}
              >
                Obras de referencia
              </Button>
              <Button
                type="button"
                size="sm"
                variant={isDiagnosisMode ? "default" : "ghost"}
                onClick={() => onModeChange("diagnosis")}
              >
                manuscrito de diagnóstico
              </Button>
            </div>

            {isDiagnosisMode ? (
              <div className="space-y-2">
                <div className="text-sm font-medium">Novela para diagnosticar</div>
                <SelectControl
                  className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                  value={selectedDiagnosisNovelId}
                  onChange={(event) => onSelectDiagnosisNovel(event.target.value)}
                >
                  <option value="">Seleccionar novela</option>
                  {novelOptions.map((novel) => (
                    <option key={novel.id} value={novel.id}>
                      {novel.title}
                    </option>
                  ))}
                </SelectControl>
                <div className="rounded-md border bg-muted/20 p-3 text-xs leading-5 text-muted-foreground">
                  El sistema exportará el texto del capítulo actual de la novela y lo utilizará como un nuevo documento de conocimiento para crear un libro de diagnóstico.
                </div>
              </div>
            ) : (
              <>
                <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <div className="text-sm font-medium">Documento de conocimiento</div>
                  <SelectControl
                    className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                    value={selectedDocumentId}
                    onChange={(event) => onSelectDocument(event.target.value)}
                  >
                    <option value="">Seleccionar documento</option>
                    {documentOptions.map((document) => (
                      <option key={document.id} value={document.id}>
                        {document.title}
                      </option>
                    ))}
                  </SelectControl>
                </div>
                <div className="space-y-2">
                  <div className="text-sm font-medium">Versión del documento</div>
                  <SelectControl
                    className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                    value={selectedVersionId}
                    onChange={(event) => onSelectVersion(event.target.value)}
                    disabled={!selectedDocumentId}
                  >
                    <option value="">Usar la versión actualmente activada</option>
                    {versionOptions.map((version) => (
                      <option key={version.id} value={version.id}>
                        v{version.versionNumber} {version.isActive ? "(actual)" : ""}
                      </option>
                    ))}
                  </SelectControl>
                </div>
              </div>
                <BookAnalysisSourceRangePicker
                  selectedRange={selectedSourceRange}
                  sourceChapters={sourceChapters}
                  sourceCharCount={sourceCharCount}
                  sourceSelected={Boolean(selectedDocumentId)}
                  chaptersRequested={sourceChaptersRequested}
                  chaptersLoading={sourceChaptersLoading}
                  chaptersError={sourceChaptersError}
                  onRangeChange={onSourceRangeChange}
                  onRequestChapters={onRequestSourceChapters}
                />
              </>
            )}

            <div className="space-y-2">
              <div className="text-sm font-medium">Modelo</div>
              <LLMSelector
                value={llmConfig}
                onChange={(next) =>
                  onLlmConfigChange({
                    provider: next.provider,
                    model: next.model,
                    temperature: next.temperature ?? llmConfig.temperature,
                    maxTokens: next.maxTokens ?? llmConfig.maxTokens,
                  })
                }
                showParameters
              />
              <div className="grid gap-2 rounded-md border bg-muted/20 p-3 sm:grid-cols-[minmax(0,1fr)_180px] sm:items-center">
                <div>
                  <div className="text-sm font-medium">Límite presupuestario</div>
                  <div className="mt-1 text-xs leading-5 text-muted-foreground">
                    Déjelo en blanco para utilizar los valores predeterminados del servidor. La tarea se detendrá después de que el uso acumulativo alcance el límite superior y se conservarán las secciones completadas.
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={1000}
                    max={10000000}
                    step={1000}
                    placeholder={DEFAULT_BOOK_ANALYSIS_BUDGET_TOKENS.toLocaleString("zh-CN")}
                    value={budgetTokens ?? ""}
                    onChange={(event) => {
                      if (!event.target.value) {
                        onBudgetTokensChange(null);
                        return;
                      }
                      const next = Number(event.target.value);
                      onBudgetTokensChange(Number.isFinite(next) ? Math.max(1000, Math.min(10000000, Math.floor(next))) : null);
                    }}
                    className="text-right font-mono tabular-nums"
                  />
                  <span className="shrink-0 text-xs text-muted-foreground">tokens</span>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-sm font-medium">Dimensiones de análisis</div>
              <div className="grid gap-2 sm:grid-cols-3">
                {BOOK_ANALYSIS_PRESETS.map((preset) => {
                  const selected = preset.key === analysisPreset;
                  return (
                    <button
                      key={preset.key}
                      type="button"
                      className={`rounded-md border p-3 text-left transition-colors ${
                        selected ? "border-primary bg-primary/5" : "hover:bg-muted/30"
                      }`}
                      onClick={() => onAnalysisPresetChange(preset.key)}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-sm font-medium">{preset.title}</div>
                        <div className="text-xs text-muted-foreground">{preset.sectionKeys.length} Artículo</div>
                      </div>
                      <div className="mt-1 text-xs leading-5 text-muted-foreground">{preset.summary}</div>
                      <div className="mt-2 text-xs leading-5 text-muted-foreground">
                        Incluir:{getPresetSectionTitles(preset.sectionKeys)}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-sm font-medium">El enfoque de este desembalaje del libro.</div>
              <textarea
                className="min-h-[92px] w-full rounded-md border bg-background p-3 text-sm"
                value={userFocusInstruction}
                onChange={(event) => onUserFocusInstructionChange(event.target.value)}
                placeholder={isDiagnosisMode
                  ? "Por ejemplo: centrarse en comprobar la retención de los tres primeros capítulos, la claridad de la motivación del protagonista o el riesgo de presagiar el reciclaje."
                  : "Por ejemplo: céntrate en observar la rotación de los retratos grupales, el estilo del lenguaje del protagonista o el diseño de los momentos destacados pagados."}
              />
            </div>
          </div>

          <aside className="space-y-3">
            <div className="rounded-md border border-warning/30 bg-warning/5 p-3 text-xs leading-5 text-foreground">
              {isDiagnosisMode
                ? "El diagnóstico consume tokens modelo según la longitud del texto novedoso. Cuantos más capítulos haya, mayor será el tiempo de análisis y el uso de tokens; Se recomienda seleccionar primero un rango de apertura de libros adecuado para esta inspección."
                : "Abrir un libro consumirá tokens modelo según la extensión del contenido del libro. Cuanto más largo sea el libro, mayor será el tiempo de análisis y el uso de tokens; Se recomienda confirmar el alcance del documento antes de iniciar el análisis."}
            </div>

            {!isDiagnosisMode && selectedSourceVersion ? (
              <div className="rounded-md border bg-muted/20 p-3 text-xs leading-5 text-muted-foreground">
                <div className="font-medium text-foreground">El volumen de este libro desempaquetado es:{scale.label}</div>
                <div className="mt-1">
                  aprox. {formatCount(effectiveSourceCharCount)} Es decir, se espera que se divida en {estimatedSegmentCount} fragmentos de texto originales, aprox. {estimatedLlmCalls} llamadas de modelo.
                </div>
                <div className="mt-1">{scale.tone}</div>
                <div className="mt-1">Se pueden analizar un máximo de 12 fragmentos de texto original a la vez. Si el rango es demasiado largo, reduzca el rango de capítulos o importe en lotes.</div>
              </div>
            ) : null}

            {!isDiagnosisMode && sourceDocument ? (
              <div className="rounded-md border bg-muted/20 p-3 text-xs text-muted-foreground">
                Número de versión:{sourceDocument.versions.length} | Ya abrí el libro:{sourceDocument.bookAnalysisCount}
              </div>
            ) : null}
          </aside>
        </div>
      </AppDialogContent>
    </Dialog>
  );
}
