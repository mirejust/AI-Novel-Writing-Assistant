import { useEffect, useState } from "react";
import { BookOpenText, MessageCircleMore, Sparkles, WandSparkles } from "lucide-react";
import type { BookAnalysis } from "@ai-novel/shared/types/bookAnalysis";
import type { KnowledgeDocumentDetail, KnowledgeDocumentSummary } from "@ai-novel/shared/types/knowledge";
import type { StyleExtractionSourceProcessingMode, StyleTemplate } from "@ai-novel/shared/types/styleEngine";
import type { UnifiedTaskDetail } from "@ai-novel/shared/types/task";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TaskRecordActions } from "@/components/taskQueue/TaskRecordActions";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type {
  WritingFormulaCreateFormState,
  WritingFormulaMaterialSource,
} from "../useWritingFormulaCreateFlow";

const EXTRACTION_PRESET_OPTIONS = [
  {
    key: "imitate",
    label: "Intenta ser lo más cercano posible al texto original.",
    summary: "Trate de conservar fuertes huellas dactilares y hábitos de expresión, que sean adecuados para copias a corto plazo, escritura de prueba de estilo y estudio comparativo.",
  },
  {
    key: "balanced",
    label: "Mantenga el sentido principal de la lectura.",
    summary: "Conserva la sensación de lectura y el ritmo de avance, debilita el exceso de huellas dactilares y es adecuado para uso directo en la mayoría de los proyectos.",
  },
  {
    key: "transfer",
    label: "Migrar únicamente esqueletos reutilizables",
    summary: "Conserva un ritmo, una estructura y una lógica de diálogo más reutilizables, lo que es adecuado para proyectos a largo plazo y el método de escritura predeterminado de todo el libro.",
  },
] as const;

const MATERIAL_SOURCE_OPTIONS: Array<{
  key: WritingFormulaMaterialSource;
  label: string;
  summary: string;
}> = [
  {
    key: "direct_text",
    label: "Pegar texto directamente",
    summary: "Envíe el texto de muestra a la tarea de extracción en segundo plano, que es adecuado para fragmentos o capítulos existentes.",
  },
  {
    key: "knowledge_document",
    label: "Texto original de la base de conocimientos.",
    summary: "Seleccione la versión activa del documento de la base de conocimientos y el sistema congela la instantánea del texto completo y utiliza muestras representativas para aprender a escribir.",
  },
  {
    key: "book_analysis",
    label: "Resultados de la apertura del libro",
    summary: "Utilice directamente los estilos y técnicas de escritura del libro para generar métodos de escritura.",
  },
];

const KNOWLEDGE_SOURCE_PROCESSING_OPTIONS: Array<{
  key: StyleExtractionSourceProcessingMode;
  label: string;
  summary: string;
  badge?: string;
}> = [
  {
    key: "representative_sample",
    label: "Muestreo inteligente",
    summary: "Seleccione muestras representativas del principio, medio, final y conclusión, que sean adecuadas para textos originales largos y tengan mejor velocidad y estabilidad.",
    badge: "Recomendado",
  },
  {
    key: "full_text",
    label: "Extracción de texto completo",
    summary: "Usar el texto completo de la versión activa como entrada del modelo es adecuado para documentos breves; Los documentos largos pueden ser más lentos y es más probable que activen el contexto del modelo o restricciones de tiempo de espera.",
  },
];

function formatTaskStatus(task: UnifiedTaskDetail | null): string {
  if (!task) {
    return "Aún no hay tareas";
  }
  if (task.status === "queued") {
    return "En cola";
  }
  if (task.status === "running") {
    return "Procesamiento";
  }
  if (task.status === "succeeded") {
    return "Completado";
  }
  if (task.status === "failed") {
    return "Error";
  }
  if (task.status === "cancelled") {
    return "Cancelado";
  }
  return "Esperando aprobación";
}

function formatCharCount(value: number | null | undefined): string {
  if (!value) {
    return "0 palabras";
  }
  return `${value.toLocaleString("zh-CN")} palabras`;
}

function formatKnowledgeStatus(status: KnowledgeDocumentSummary["status"]): string {
  if (status === "enabled") {
    return "Disponible";
  }
  if (status === "disabled") {
    return "Desactivar";
  }
  return "Archivo";
}

interface WritingFormulaCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  form: WritingFormulaCreateFormState;
  onFormChange: (patch: Partial<WritingFormulaCreateFormState>) => void;
  templates: StyleTemplate[];
  createManualPending: boolean;
  createFromBriefPending: boolean;
  createFromTemplatePending: boolean;
  extractTaskSubmitting: boolean;
  activeExtractionTask: UnifiedTaskDetail | null;
  knowledgeDocuments: KnowledgeDocumentSummary[];
  knowledgeDocumentsLoading: boolean;
  selectedKnowledgeDocument: KnowledgeDocumentDetail | null;
  selectedKnowledgeDocumentLoading: boolean;
  bookAnalyses: BookAnalysis[];
  bookAnalysesLoading: boolean;
  selectedPresetKey: "imitate" | "balanced" | "transfer";
  onCreateManual: () => void;
  onCreateFromBrief: () => void;
  onCreateFromTemplate: (templateId: string) => void;
  onPresetChange: (value: "imitate" | "balanced" | "transfer") => void;
  onSubmitExtractionTask: () => void;
  onOpenTaskCenter?: (task: UnifiedTaskDetail) => void;
}

export default function WritingFormulaCreateDialog(props: WritingFormulaCreateDialogProps) {
  const {
    open,
    onOpenChange,
    form,
    onFormChange,
    templates,
    createManualPending,
    createFromBriefPending,
    createFromTemplatePending,
    extractTaskSubmitting,
    activeExtractionTask,
    knowledgeDocuments,
    knowledgeDocumentsLoading,
    selectedKnowledgeDocument,
    selectedKnowledgeDocumentLoading,
    bookAnalyses,
    bookAnalysesLoading,
    selectedPresetKey,
    onCreateManual,
    onCreateFromBrief,
    onCreateFromTemplate,
    onPresetChange,
    onSubmitExtractionTask,
    onOpenTaskCenter,
  } = props;
  const [activeTab, setActiveTab] = useState<"quick_start" | "blank" | "extract">("quick_start");

  useEffect(() => {
    if (open && activeExtractionTask) {
      setActiveTab("extract");
    }
  }, [activeExtractionTask, open]);

  const extractionTaskIsActive = activeExtractionTask?.status === "queued" || activeExtractionTask?.status === "running";
  const selectedPreset = EXTRACTION_PRESET_OPTIONS.find((item) => item.key === selectedPresetKey) ?? EXTRACTION_PRESET_OPTIONS[1];
  const activeKnowledgeVersion = selectedKnowledgeDocument?.versions.find((version) => version.isActive) ?? null;
  const selectedBookAnalysis = bookAnalyses.find((analysis) => analysis.id === form.bookAnalysisId) ?? null;
  const knowledgeDocumentReady = Boolean(
    selectedKnowledgeDocument
      && selectedKnowledgeDocument.status !== "archived"
      && activeKnowledgeVersion
      && activeKnowledgeVersion.content.trim(),
  );
  const bookAnalysisReady = Boolean(form.bookAnalysisId);
  const materialSubmitDisabled = extractTaskSubmitting
    || (form.materialSource !== "book_analysis" && extractionTaskIsActive)
    || !form.extractName.trim()
    || (form.materialSource === "direct_text" && !form.extractSourceText.trim())
    || (form.materialSource === "knowledge_document" && !knowledgeDocumentReady)
    || (form.materialSource === "book_analysis" && !bookAnalysisReady);
  const materialSubmitLabel = form.materialSource === "book_analysis"
    ? "Crear un método de escritura a partir del resultado de dividir el libro."
    : form.materialSource === "knowledge_document"
      ? "Extraiga el texto original de la base de conocimientos y guárdelo automáticamente"
      : "Enviar tarea de extracción y guardar automáticamente";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="writing-formula-theme flex h-[min(780px,92vh)] max-w-5xl flex-col overflow-hidden p-0">
        <DialogHeader className="shrink-0 border-b border-slate-100 bg-[linear-gradient(135deg,rgba(248,250,252,0.95),rgba(255,255,255,0.98))] px-6 py-5 pr-14">
          <div className="flex items-start gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-slate-950 text-white"><WandSparkles className="size-5" /></div>
            <div>
              <DialogTitle>Comience con un sentido de lectura.</DialogTitle>
          <DialogDescription>
                Elige un punto de partida que ya tengas a mano. El sistema primero lo ayudará a finalizar un conjunto de métodos de escritura que puede probar y los detalles se pueden ajustar en cualquier momento.
          </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as typeof activeTab)} className="flex min-h-0 flex-1 flex-col space-y-4 px-6 pb-6 pt-4">
          <TabsList className="grid h-auto w-full shrink-0 grid-cols-3 rounded-2xl bg-slate-100/80 p-1">
            <TabsTrigger value="quick_start" className="gap-1.5 rounded-xl py-2.5"><BookOpenText className="size-4" />Comience con una plantilla</TabsTrigger>
            <TabsTrigger value="blank" className="gap-1.5 rounded-xl py-2.5"><MessageCircleMore className="size-4" />Dame una idea</TabsTrigger>
            <TabsTrigger value="extract" className="gap-1.5 rounded-xl py-2.5"><Sparkles className="size-4" />Aprender de los materiales</TabsTrigger>
          </TabsList>

          <TabsContent value="quick_start" className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
            <div className="rounded-2xl border border-sky-100 bg-sky-50/60 p-4 text-sm leading-6 text-slate-700">
              Cuando no esté seguro de por dónde empezar, elija un estilo de escritura que se acerque a usted. Después de crearlo, puede continuar cambiando el tema, ajustar el ritmo y luego utilizar la escritura de prueba para confirmar la sensación de lectura.
            </div>
            <div className="grid gap-3 pr-1 md:grid-cols-2">
              {templates.map((template) => (
                <div key={template.id} className="rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-slate-400 hover:shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-base font-semibold text-foreground">{template.name}</div>
                      <div className="mt-1 text-xs text-muted-foreground">{template.category}</div>
                    </div>
                    <Badge variant="outline">Plantilla</Badge>
                  </div>
                  <div className="mt-3 text-sm leading-6 text-muted-foreground">{template.description}</div>
                  {template.tags.length > 0 ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {template.tags.slice(0, 4).map((tag) => (
                        <Badge key={`${template.id}-${tag}`} variant="secondary">{tag}</Badge>
                      ))}
                    </div>
                  ) : null}
                  {template.applicableGenres.length > 0 ? (
                    <div className="mt-3 text-xs text-muted-foreground">
                      Adecuado para:{template.applicableGenres.join(" / ")}
                    </div>
                  ) : null}
                  <Button
                    size="sm"
                    className="mt-4 w-full"
                    onClick={() => onCreateFromTemplate(template.id)}
                    disabled={createFromTemplatePending}
                  >
                    {createFromTemplatePending ? "Creando..." : "Creado en base a este conjunto"}
                  </Button>
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="blank" className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
            <div className="rounded-2xl border border-sky-100 bg-sky-50/60 p-4 text-sm leading-6 text-slate-700">
              Siempre que dejes claro cómo quieres que se sientan los lectores después de leerlo, la IA creará primero una primera versión que se pueda probar; Cuando esté familiarizado con las reglas, también puede comenzar desde cero para el mantenimiento.
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="order-2 rounded-2xl border border-slate-200 bg-white p-4 lg:order-1">
                <div className="mb-3">
                  <div className="text-sm font-medium text-foreground">Empezar desde el principio</div>
                  <div className="mt-1 text-xs leading-5 text-muted-foreground">
                    Es adecuado para usted que ya sabe qué tipo de escritura desea mantener y solo desea crear primero un shell vacío.
                  </div>
                </div>
                <div className="space-y-3">
                  <input
                    className="w-full rounded-md border p-2 text-sm"
                    placeholder="Por ejemplo: Transmisión rápida de conflictos urbanos fuertes"
                    value={form.manualName}
                    onChange={(event) => onFormChange({ manualName: event.target.value })}
                  />
                  <Button
                    className="w-full"
                    onClick={onCreateManual}
                    disabled={!form.manualName.trim() || createManualPending}
                  >
                    {createManualPending ? "Creando..." : "Crear escritura en blanco"}
                  </Button>
                </div>
              </div>

              <div className="order-1 rounded-2xl border border-slate-950 bg-[linear-gradient(135deg,rgba(15,23,42,0.04),rgba(240,249,255,0.86))] p-4 lg:order-2">
                <div className="mb-3">
                  <div className="flex items-center gap-2 text-sm font-medium text-foreground"><Sparkles className="size-4 text-sky-700" />La IA me ayuda a construir un set primero</div>
                  <div className="mt-1 text-xs leading-5 text-muted-foreground">
                    Adecuado para usted que sólo sabe cómo quiere escribirlo, pero no quiere completar primero los campos de la regla.
                  </div>
                </div>
                <div className="space-y-3">
                  <input
                    className="w-full rounded-md border p-2 text-sm"
                    placeholder="Nombre escrito (opcional)"
                    value={form.briefName}
                    onChange={(event) => onFormChange({ briefName: event.target.value })}
                  />
                  <input
                    className="w-full rounded-md border p-2 text-sm"
                    placeholder="Clasificación (opcional)"
                    value={form.briefCategory}
                    onChange={(event) => onFormChange({ briefCategory: event.target.value })}
                  />
                  <textarea
                    className="min-h-[180px] w-full rounded-md border p-2 text-sm"
                    placeholder="Por ejemplo: el avance general es rápido, los conflictos son intensos, el diálogo es directo, las emociones no son confusas y es adecuado para historias de actualización urbanas y apasionadas."
                    value={form.briefPrompt}
                    onChange={(event) => onFormChange({ briefPrompt: event.target.value })}
                  />
                  <Button
                    className="w-full"
                    onClick={onCreateFromBrief}
                    disabled={!form.briefPrompt.trim() || createFromBriefPending}
                  >
                    {createFromBriefPending ? "Generación de IA..." : "La IA genera un conjunto de métodos de escritura"}
                  </Button>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="extract" className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
            <div className="rounded-lg border bg-muted/20 p-4 text-sm leading-6 text-muted-foreground">
              Crea estilos de escritura a partir de materiales. El texto original y el texto de la base de conocimientos entrarán en la tarea de extracción en segundo plano; El resultado del desmontaje del libro se analizará directamente para generar un estilo de escritura mediante el análisis de estilo y técnica.
            </div>
            <div className="grid gap-5 xl:grid-cols-[minmax(0,1.05fr)_minmax(320px,0.95fr)]">
              <div className="space-y-4 rounded-lg border p-4">
                <div className={form.materialSource === "book_analysis" ? "grid gap-3" : "grid gap-3 md:grid-cols-2"}>
                  <input
                    className="rounded-md border p-2 text-sm"
                    placeholder="Nombre escrito"
                    value={form.extractName}
                    onChange={(event) => onFormChange({ extractName: event.target.value })}
                  />
                  {form.materialSource !== "book_analysis" ? (
                    <input
                      className="rounded-md border p-2 text-sm"
                      placeholder="Clasificación (opcional)"
                      value={form.extractCategory}
                      onChange={(event) => onFormChange({ extractCategory: event.target.value })}
                    />
                  ) : null}
                </div>

                <div className="grid gap-3 md:grid-cols-3">
                  {MATERIAL_SOURCE_OPTIONS.map((option) => {
                    const active = option.key === form.materialSource;
                    return (
                      <button
                        key={option.key}
                        type="button"
                        className={`rounded-2xl border px-3 py-3 text-left transition ${
                          active
                            ? "border-slate-950 bg-slate-950 text-white shadow"
                            : "border-slate-200 bg-white hover:border-slate-400"
                        }`}
                        onClick={() => onFormChange({ materialSource: option.key })}
                      >
                        <div className="text-sm font-semibold">{option.label}</div>
                        <div className={`mt-1 text-xs leading-5 ${active ? "text-slate-200" : "text-slate-500"}`}>
                          {option.summary}
                        </div>
                      </button>
                    );
                  })}
                </div>

                {form.materialSource === "direct_text" ? (
                  <textarea
                    className="min-h-[260px] w-full rounded-md border p-2 text-sm"
                    placeholder="Pegue el texto de referencia del que desea extraer la sensación. Se recomienda dar al menos una escena completa."
                    value={form.extractSourceText}
                    onChange={(event) => onFormChange({ extractSourceText: event.target.value })}
                  />
                ) : null}

                {form.materialSource === "knowledge_document" ? (
                  <div className="space-y-3">
                    <input
                      className="w-full rounded-md border p-2 text-sm"
                      placeholder="Buscar título del documento de la base de conocimientos o nombre de archivo"
                      value={form.knowledgeSearchKeyword}
                      onChange={(event) => onFormChange({ knowledgeSearchKeyword: event.target.value })}
                    />
                    <div className="grid max-h-[220px] gap-2 overflow-y-auto pr-1">
                      {knowledgeDocumentsLoading && knowledgeDocuments.length === 0 ? (
                        <div className="rounded-xl border border-dashed p-3 text-sm text-muted-foreground">
                          Buscando documentos de la base de conocimientos...
                        </div>
                      ) : null}
                      {!knowledgeDocumentsLoading && knowledgeDocuments.length === 0 ? (
                        <div className="rounded-xl border border-dashed p-3 text-sm text-muted-foreground">
                          No se encontró ningún documento de base de conocimientos disponible. Primero puede cargar el texto original en la base de conocimientos y luego volver aquí para crear el método de escritura.
                        </div>
                      ) : null}
                      {knowledgeDocuments.map((document) => {
                        const selected = document.id === form.knowledgeDocumentId;
                        return (
                          <button
                            key={document.id}
                            type="button"
                            className={`rounded-xl border px-3 py-3 text-left transition ${
                              selected ? "border-slate-950 bg-slate-50" : "border-slate-200 bg-white hover:border-slate-400"
                            }`}
                            disabled={document.status === "archived"}
                            onClick={() => onFormChange({
                              knowledgeDocumentId: document.id,
                              knowledgeDocumentTitle: document.title,
                              extractName: form.extractName.trim() ? form.extractName : `${document.title}Método de escritura`,
                            })}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <div className="text-sm font-medium text-slate-950">{document.title}</div>
                                <div className="mt-1 text-xs leading-5 text-slate-500">{document.fileName}</div>
                              </div>
                              <Badge variant={selected ? "default" : "outline"}>
                                {selected ? "Seleccionado" : formatKnowledgeStatus(document.status)}
                              </Badge>
                            </div>
                            <div className="mt-2 text-xs leading-5 text-slate-500">
                              Versión activa v{document.activeVersionNumber} · {document.versionCount} versiones · {document.bookAnalysisCount} Resultados de la división de libros
                            </div>
                          </button>
                        );
                      })}
                    </div>
                    <div className="space-y-2 rounded-xl border bg-white p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="text-sm font-medium text-slate-950">Método de procesamiento de texto original</div>
                        {activeKnowledgeVersion ? (
                          <div className="text-xs text-slate-500">
                            Instantánea de origen {formatCharCount(activeKnowledgeVersion.charCount)}
                          </div>
                        ) : null}
                      </div>
                      <div className="grid gap-2 md:grid-cols-2">
                        {KNOWLEDGE_SOURCE_PROCESSING_OPTIONS.map((option) => {
                          const active = option.key === form.knowledgeSourceProcessingMode;
                          return (
                            <button
                              key={option.key}
                              type="button"
                              className={`rounded-xl border px-3 py-3 text-left transition ${
                                active
                                  ? "border-slate-950 bg-slate-950 text-white"
                                  : "border-slate-200 bg-white hover:border-slate-400"
                              }`}
                              onClick={() => onFormChange({ knowledgeSourceProcessingMode: option.key })}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <div className="text-sm font-semibold">{option.label}</div>
                                {option.badge ? (
                                  <Badge variant={active ? "secondary" : "outline"}>{option.badge}</Badge>
                                ) : null}
                              </div>
                              <div className={`mt-1 text-xs leading-5 ${active ? "text-slate-200" : "text-slate-500"}`}>
                                {option.summary}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                      {form.knowledgeSourceProcessingMode === "representative_sample" ? (
                        <div className="text-xs leading-5 text-slate-500">
                          Los recursos de escritura seguirán conservando vistas previas completas de las fuentes; el modelo solo lee muestras representativas para evitar que el texto completo exceda la capacidad de carga del modelo a la vez.
                        </div>
                      ) : (
                        <div className="text-xs leading-5 text-amber-700">
                          La extracción de texto completo entrega la versión activa del texto completo al modelo. Para artículos originales extensos, se recomienda utilizar primero el muestreo inteligente.
                        </div>
                      )}
                    </div>
                    <div className="rounded-xl border bg-slate-50/80 p-3 text-sm leading-6 text-slate-700">
                      {selectedKnowledgeDocumentLoading ? (
                        "Leer la versión activa del documento seleccionado..."
                      ) : selectedKnowledgeDocument ? (
                        <>
                          <div className="font-medium text-slate-950">{selectedKnowledgeDocument.title}</div>
                          {activeKnowledgeVersion ? (
                            <div className="mt-1 text-xs text-slate-500">
                              Versión activa v{activeKnowledgeVersion.versionNumber} · {formatCharCount(activeKnowledgeVersion.charCount)}
                            </div>
                          ) : (
                            <div className="mt-1 text-xs text-amber-700">El documento seleccionado carece de una versión activa y no se puede enviar.</div>
                          )}
                          {activeKnowledgeVersion && !activeKnowledgeVersion.content.trim() ? (
                            <div className="mt-1 text-xs text-amber-700">El texto de la versión activa está vacío y no se puede enviar.</div>
                          ) : null}
                        </>
                      ) : (
                        "Después de seleccionar un documento de la base de conocimientos, el sistema lee el texto completo de la versión activa y congela la instantánea cuando se envía la tarea."
                      )}
                    </div>
                  </div>
                ) : null}

                {form.materialSource === "book_analysis" ? (
                  <div className="space-y-3">
                    <input
                      className="w-full rounded-md border p-2 text-sm"
                      placeholder="Busque títulos de libros o documentos fuente"
                      value={form.bookAnalysisSearchKeyword}
                      onChange={(event) => onFormChange({ bookAnalysisSearchKeyword: event.target.value })}
                    />
                    <div className="grid max-h-[290px] gap-2 overflow-y-auto pr-1">
                      {bookAnalysesLoading && bookAnalyses.length === 0 ? (
                        <div className="rounded-xl border border-dashed p-3 text-sm text-muted-foreground">
                          Buscando resultados de libros abiertos...
                        </div>
                      ) : null}
                      {!bookAnalysesLoading && bookAnalyses.length === 0 ? (
                        <div className="rounded-xl border border-dashed p-3 text-sm text-muted-foreground">
                          No se encontraron resultados de libros abiertos. Una vez que termine de desempacar el libro, puede generar directamente el método de escritura aquí.
                        </div>
                      ) : null}
                      {bookAnalyses.map((analysis) => {
                        const selected = analysis.id === form.bookAnalysisId;
                        return (
                          <button
                            key={analysis.id}
                            type="button"
                            className={`rounded-xl border px-3 py-3 text-left transition ${
                              selected ? "border-slate-950 bg-slate-50" : "border-slate-200 bg-white hover:border-slate-400"
                            }`}
                            onClick={() => onFormChange({
                              bookAnalysisId: analysis.id,
                              bookAnalysisTitle: analysis.title,
                              extractName: form.extractName.trim() ? form.extractName : `${analysis.title}Método de escritura`,
                            })}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <div className="text-sm font-medium text-slate-950">{analysis.title}</div>
                                <div className="mt-1 text-xs leading-5 text-slate-500">{analysis.documentTitle}</div>
                              </div>
                              <Badge variant={selected ? "default" : "outline"}>
                                {selected ? "Seleccionado" : "Puede generar"}
                              </Badge>
                            </div>
                            <div className="mt-2 text-xs leading-5 text-slate-500">
                              Versión fuente v{analysis.documentVersionNumber} · {analysis.summary || "Los resultados de la división de libros se pueden utilizar para generar métodos de escritura."}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : null}

                <div className="sticky bottom-0 -mx-4 border-t bg-white/95 px-4 py-3 backdrop-blur">
                  <Button
                    className="w-full"
                    onClick={onSubmitExtractionTask}
                    disabled={materialSubmitDisabled}
                  >
                    {extractTaskSubmitting
                      ? form.materialSource === "book_analysis" ? "Generando..." : "Enviando tarea..."
                      : extractionTaskIsActive && form.materialSource !== "book_analysis"
                        ? "Tarea en segundo plano en progreso..."
                        : materialSubmitLabel}
                  </Button>
                </div>
              </div>

              <div className="space-y-4 rounded-lg border p-4">
                {form.materialSource === "book_analysis" ? (
                  <>
                    <div>
                      <div className="text-sm font-medium text-foreground">Generación de resultados de división de libros</div>
                      <div className="mt-1 text-xs leading-5 text-muted-foreground">
                        Este paso leerá directamente las secciones de técnica y estilo de escritura en el libro abierto y abrirá el editor de escritura inmediatamente después de la generación.
                      </div>
                    </div>
                    <div className="rounded-xl border bg-slate-50/80 p-4 text-sm leading-6 text-slate-700">
                      {selectedBookAnalysis ? (
                        <>
                          <div className="font-medium text-slate-950">{selectedBookAnalysis.title}</div>
                          <div className="mt-1 text-xs text-slate-500">
                            Documento fuente:{selectedBookAnalysis.documentTitle} · v{selectedBookAnalysis.documentVersionNumber}
                          </div>
                          {selectedBookAnalysis.summary ? (
                            <div className="mt-3 text-xs leading-6 text-slate-600">{selectedBookAnalysis.summary}</div>
                          ) : null}
                        </>
                      ) : (
                        "Después de seleccionar un resultado de apertura de libro, el sistema utilizará el análisis de técnica y estilo de escritura para generar un método de escritura sin ingresar a la tarea de extracción en segundo plano."
                      )}
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <div className="text-sm font-medium text-foreground">Política de retención</div>
                      <div className="mt-1 text-xs leading-5 text-muted-foreground">
                        Primero decida cuántas huellas digitales originales desea conservar. El sistema generará y guardará automáticamente el método de escritura de acuerdo con esta estrategia.
                      </div>
                    </div>
                    <div className="grid gap-3">
                      {EXTRACTION_PRESET_OPTIONS.map((preset) => {
                        const active = preset.key === selectedPresetKey;
                        return (
                          <button
                            key={preset.key}
                            type="button"
                            className={`rounded-2xl border px-4 py-4 text-left transition ${
                              active
                                ? "border-slate-950 bg-slate-950 text-white shadow-lg"
                                : "border-slate-200 bg-white hover:border-slate-400"
                            }`}
                            onClick={() => onPresetChange(preset.key)}
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div className="text-base font-semibold">{preset.label}</div>
                              {active ? <Badge variant="secondary" className="bg-white/10 text-white">Plan actual</Badge> : null}
                            </div>
                            <div className={`mt-2 text-sm leading-6 ${active ? "text-slate-200" : "text-slate-600"}`}>
                              {preset.summary}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                    <div className="rounded-xl border bg-amber-50/80 p-3 text-xs leading-6 text-amber-900">
                      Presionará "{selectedPreset.label}"Envíe la tarea en segundo plano. Una vez completada la tarea, el sistema la guardará automáticamente. No es necesario hacer clic manualmente para guardarla tal como está escrita.
                    </div>
                    {activeExtractionTask ? (
                      <div className="rounded-xl border bg-slate-50/80 p-4 text-sm text-slate-700">
                        <div className="flex items-center justify-between gap-3">
                          <div className="font-medium text-slate-900">Tareas en segundo plano</div>
                          <Badge variant={extractionTaskIsActive ? "secondary" : "outline"}>
                            {formatTaskStatus(activeExtractionTask)}
                          </Badge>
                        </div>
                        <div className="mt-3 space-y-2 text-xs leading-5 text-slate-600">
                          <div>Título de la tarea:{activeExtractionTask.title}</div>
                          <TaskRecordActions kind="style_extraction" id={activeExtractionTask.id} status={activeExtractionTask.status} title={activeExtractionTask.title} allowStop allowDelete={false} />
                          <div>Fase de ejecución:{activeExtractionTask.currentStage ?? "Esperando envío"}</div>
                          <div>Progreso de la tarea:{Math.round(activeExtractionTask.progress * 100)}%</div>
                          {activeExtractionTask.failureSummary ? (
                            <div className="text-rose-600">Razón de excepción:{activeExtractionTask.failureSummary}</div>
                          ) : null}
                        </div>
                        {onOpenTaskCenter ? (
                          <Button
                            type="button"
                            variant="outline"
                            className="mt-4 w-full"
                            onClick={() => onOpenTaskCenter(activeExtractionTask)}
                          >
                            Vaya al centro de misión para ver
                          </Button>
                        ) : null}
                      </div>
                    ) : (
                      <div className="rounded-xl border border-dashed p-4 text-sm leading-6 text-muted-foreground">
                        Después del envío, el sistema completará la extracción, aplicará la política de retención y guardará automáticamente la escritura en segundo plano. Puede cerrar la ventana emergente primero y los resultados se abrirán automáticamente una vez finalizada.
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
