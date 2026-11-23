import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { TitleFactorySuggestion, TitleLibraryEntry } from "@ai-novel/shared/types/title";
import {
  AI_FREEDOM_OPTIONS,
  EMOTION_OPTIONS,
  PACE_OPTIONS,
  POV_OPTIONS,
  WRITING_MODE_OPTIONS,
  type NovelBasicFormState,
} from "../../novelBasicInfo.shared";
import {
  buildTitleLibraryListKey,
  createTitleLibraryEntry,
  generateTitleIdeas,
  listTitleLibrary,
} from "@/api/title";
import { queryKeys } from "@/api/queryKeys";
import AiButton from "@/components/common/AiButton";
import LLMSelector from "@/components/common/LLMSelector";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/components/ui/toast";
import { useLLMStore } from "@/store/llmStore";
import TitleSuggestionList from "@/pages/titles/components/TitleSuggestionList";
import { getClickRateBadgeClass, truncateText } from "@/pages/titles/titleStudio.shared";

interface NovelCreateTitleQuickFillProps {
  basicForm: NovelBasicFormState;
  onApplyTitle: (title: string) => void;
}

const DEFAULT_TITLE_COUNT = 8;
const TITLE_LIBRARY_PAGE_SIZE = 8;

function sortSuggestions(items: TitleFactorySuggestion[]): TitleFactorySuggestion[] {
  return [...items].sort((left, right) => right.clickRate - left.clickRate);
}

function resolveOptionLabel<T extends string>(
  options: Array<{ value: T; label: string }>,
  value: T,
): string | null {
  return options.find((item) => item.value === value)?.label ?? null;
}

function buildGenerationBrief(basicForm: NovelBasicFormState): string {
  const lines = [
    basicForm.description.trim() ? `Resumen del trabajo:${basicForm.description.trim()}` : "",
    basicForm.title.trim() ? `Título del borrador actual:${basicForm.title.trim()}` : "",
    `Modo creativo:${resolveOptionLabel(WRITING_MODE_OPTIONS, basicForm.writingMode) ?? basicForm.writingMode}`,
    `Perspectiva narrativa:${resolveOptionLabel(POV_OPTIONS, basicForm.narrativePov) ?? basicForm.narrativePov}`,
    `Preferencia de ritmo:${resolveOptionLabel(PACE_OPTIONS, basicForm.pacePreference) ?? basicForm.pacePreference}`,
    `Concentración emocional:${resolveOptionLabel(EMOTION_OPTIONS, basicForm.emotionIntensity) ?? basicForm.emotionIntensity}`,
    `Grados de libertad de la IA:${resolveOptionLabel(AI_FREEDOM_OPTIONS, basicForm.aiFreedom) ?? basicForm.aiFreedom}`,
    basicForm.styleTone.trim() ? `Palabras clave para el estilo de escritura:${basicForm.styleTone.trim()}` : "",
  ].filter(Boolean);
  return lines.join("\n");
}

function renderLibraryDescription(entry: TitleLibraryEntry): string {
  if (entry.description?.trim()) {
    return truncateText(entry.description, 100);
  }
  if (entry.keywords?.trim()) {
    return `Palabras clave:${truncateText(entry.keywords, 80)}`;
  }
  return "Los candidatos de la biblioteca de títulos se pueden escribir directamente en el formulario de creación actual.";
}

function joinKeywords(...values: Array<string | null | undefined>): string | null {
  const next = values
    .map((value) => value?.trim() ?? "")
    .filter(Boolean)
    .join(" / ")
    .slice(0, 160);
  return next || null;
}

export default function NovelCreateTitleQuickFill({
  basicForm,
  onApplyTitle,
}: NovelCreateTitleQuickFillProps) {
  const llm = useLLMStore();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"generate" | "library">("generate");
  const [count, setCount] = useState(DEFAULT_TITLE_COUNT);
  const [search, setSearch] = useState("");
  const [manualBrief, setManualBrief] = useState("");
  const [referenceTitle, setReferenceTitle] = useState("");
  const [suggestions, setSuggestions] = useState<TitleFactorySuggestion[]>([]);

  const autoBrief = useMemo(() => buildGenerationBrief(basicForm), [basicForm]);
  const resolvedBrief = useMemo(
    () => [autoBrief, manualBrief.trim() ? `Extras:${manualBrief.trim()}` : ""].filter(Boolean).join("\n"),
    [autoBrief, manualBrief],
  );
  const generationMode = referenceTitle.trim() ? "adapt" : "brief";
  const hasGenerationContext = Boolean(resolvedBrief.trim() || referenceTitle.trim());

  const titleLibraryParams = useMemo(
    () => ({
      page: 1,
      pageSize: TITLE_LIBRARY_PAGE_SIZE,
      search: search.trim() || undefined,
      genreId: basicForm.genreId || undefined,
      sort: "clickRate" as const,
    }),
    [basicForm.genreId, search],
  );
  const titleLibraryParamsKey = useMemo(
    () => buildTitleLibraryListKey(titleLibraryParams),
    [titleLibraryParams],
  );

  const libraryQuery = useQuery({
    queryKey: queryKeys.titles.list(titleLibraryParamsKey),
    queryFn: () => listTitleLibrary(titleLibraryParams),
    staleTime: 60 * 1000,
  });

  const generateMutation = useMutation({
    mutationFn: async () => {
      if (!hasGenerationContext) {
        throw new Error("Primero complete un título breve o complete un título de referencia antes de generarlo.");
      }
      const response = await generateTitleIdeas({
        mode: generationMode,
        brief: resolvedBrief || undefined,
        referenceTitle: referenceTitle.trim() || undefined,
        genreId: basicForm.genreId || null,
        count: Math.min(24, Math.max(3, Math.floor(count) || DEFAULT_TITLE_COUNT)),
        provider: llm.provider,
        model: llm.model,
        temperature: llm.temperature,
        maxTokens: llm.maxTokens,
      });
      return response.data?.titles ?? [];
    },
    onSuccess: (rows) => {
      const next = sortSuggestions(rows);
      setSuggestions(next);
      toast.success(`Generado ${next.length} candidatos al título.`);
    },
  });

  const saveMutation = useMutation({
    mutationFn: (suggestion: TitleFactorySuggestion) => createTitleLibraryEntry({
      title: suggestion.title,
      description: basicForm.description.trim().slice(0, 400) || manualBrief.trim().slice(0, 400) || null,
      clickRate: suggestion.clickRate,
      keywords: joinKeywords(basicForm.title, referenceTitle, basicForm.styleTone),
      genreId: basicForm.genreId || null,
    }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.titles.all });
      toast.success("El título se ha agregado a la biblioteca de títulos.");
    },
  });

  const handleApplyTitle = (title: string, source: "generated" | "library") => {
    onApplyTitle(title);
    setOpen(false);
    toast.success(source === "generated" ? "Los candidatos al título se escriben en el formulario de creación." : "El título del banco de títulos se ha escrito en el formulario de creación.");
  };

  const handleCopySuggestion = async (suggestion: TitleFactorySuggestion) => {
    await navigator.clipboard.writeText(suggestion.title);
    toast.success("Título copiado al portapapeles.");
  };

  return (
    <>
      <div className="flex items-center justify-end">
        <AiButton type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
          Selección rápida de títulos
        </AiButton>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] max-w-5xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Selección rápida de títulos</DialogTitle>
            <DialogDescription>
              No existe una relación vinculante, simplemente te ayuda a escribir el título en el formulario de creación más rápido. Los candidatos se pueden generar directamente o se pueden completar seleccionando uno de la biblioteca de títulos.
            </DialogDescription>
          </DialogHeader>

          <Tabs
            value={mode}
            onValueChange={(value) => setMode(value as "generate" | "library")}
            className="space-y-4"
          >
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="generate">Generar rápidamente</TabsTrigger>
              <TabsTrigger value="library">Selección de biblioteca de títulos</TabsTrigger>
            </TabsList>

            <TabsContent value="generate" className="space-y-4">
              <div className="space-y-4">
                <div className="text-xs leading-6 text-muted-foreground">
                  Se dará prioridad a la lectura de la introducción, el tema, el estilo de escritura, el ritmo y la perspectiva narrativa que se han completado en la página creada actualmente. También puedes añadir un breve resumen a continuación sin tener que volver a rellenar el formulario primero.
                </div>
                <div>
                  <LLMSelector />
                </div>

                <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_280px]">
                  <div className="space-y-2">
                    <label
                      htmlFor="novel-create-title-quick-brief"
                      className="text-sm font-medium text-foreground"
                    >
                      Resumen del título complementario
                    </label>
                    <textarea
                      id="novel-create-title-quick-brief"
                      className="min-h-[132px] w-full rounded-md border bg-background px-3 py-2 text-sm outline-none transition focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                      value={manualBrief}
                      onChange={(event) => setManualBrief(event.target.value)}
                      placeholder="Por ejemplo: en el páramo apocalíptico, un ingeniero de mantenimiento exiliado dominó accidentalmente el núcleo de un antiguo mecha. Quería que el título tuviera una ambientación y un sentido de destino más duros."
                    />
                    <div className="text-xs leading-6 text-muted-foreground">
                      Esto solo afecta a esta generación y no escribirá automáticamente en el formulario de creación de la novela.
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="space-y-2">
                      <label
                        htmlFor="novel-create-title-reference"
                        className="text-sm font-medium text-foreground"
                      >
                        Título de referencia
                      </label>
                      <Input
                        id="novel-create-title-reference"
                        value={referenceTitle}
                        onChange={(event) => setReferenceTitle(event.target.value)}
                        placeholder="Opcional, si se cumplimenta se generará según la fórmula de adaptación de referencia."
                      />
                    </div>
                    <div className="text-xs leading-6 text-muted-foreground">
                      {referenceTitle.trim()
                        ? "Actualmente, los candidatos se regenerarán según el ritmo del título y la estructura de nombres que ingresaste, y se combinarán con la información de la novela."
                        : "Si se deja en blanco, se generará directamente según el informe. Si ya tiene una dirección de estilo en mente, puede completar un título de referencia aquí."}
                    </div>
                  </div>
                </div>

                <div className="border-l border-border/60 pl-3">
                  <div className="text-xs font-medium text-foreground">La información de la página creada que se ha leído automáticamente actualmente.</div>
                  <div className="mt-2 whitespace-pre-wrap text-xs leading-6 text-muted-foreground">
                    {autoBrief || "Aún no hay suficiente información en la página de creación. Puede escribir directamente un tema, punto de venta o conflicto en el \"Resumen de título complementario\" anterior y generarlo nuevamente."}
                  </div>
                </div>

                <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                  <label className="space-y-2 text-sm">
                    <span className="font-medium text-foreground">Generar cantidad</span>
                    <Input
                      type="number"
                      min={3}
                      max={24}
                      step={1}
                      value={count}
                      onChange={(event) => setCount(Number(event.target.value) || DEFAULT_TITLE_COUNT)}
                      className="w-[120px]"
                    />
                  </label>
                  <AiButton
                    type="button"
                    onClick={() => generateMutation.mutate()}
                    disabled={generateMutation.isPending || !hasGenerationContext}
                  >
                    {generateMutation.isPending ? "Generando..." : "Generar candidatos a título"}
                  </AiButton>
                </div>

                {!hasGenerationContext ? (
                  <div className="mt-3 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-800">
                    Al menos agregue primero un resumen del título o complete un título de referencia; si ya existe una introducción, tipo o estilo de escritura en la página de creación, también se generará automáticamente.
                  </div>
                ) : null}
              </div>

              <TitleSuggestionList
                suggestions={suggestions}
                selectedTitle={basicForm.title}
                primaryActionLabel="Completa el título"
                onPrimaryAction={(suggestion) => handleApplyTitle(suggestion.title, "generated")}
                onCopy={handleCopySuggestion}
                onSave={(suggestion) => saveMutation.mutate(suggestion)}
                savingTitle={saveMutation.isPending ? saveMutation.variables?.title ?? "" : ""}
                emptyMessage="Puede escribir directamente un tema o punto de venta en el resumen del título complementario anterior y hacer clic en Generar nuevamente, y el resultado se utilizará directamente como título candidato para la página de creación."
              />
            </TabsContent>

            <TabsContent value="library" className="space-y-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="space-y-1">
                  <div className="text-sm font-medium text-foreground">Seleccione rápidamente de la biblioteca de títulos</div>
                  <div className="text-xs leading-6 text-muted-foreground">
                    Ordenar por tasa de clics de forma predeterminada
                    {basicForm.genreId ? "y filtrar según el tema actual" : ""}
                    .
                  </div>
                </div>
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Palabras clave del título de búsqueda"
                  className="md:max-w-xs"
                />
              </div>

              {libraryQuery.isLoading ? (
                <div className="py-8 text-center text-sm text-muted-foreground">
                  Cargando biblioteca de títulos...
                </div>
              ) : (libraryQuery.data?.data?.items ?? []).length === 0 ? (
                <div className="py-8 text-center text-sm text-muted-foreground">
                  No hay títulos disponibles en este momento. Puede cambiar a "Generación rápida" para generar primero un lote de candidatos.
                </div>
              ) : (
                <div className="divide-y divide-border/60">
                  {(libraryQuery.data?.data?.items ?? []).map((entry) => {
                    const isSelected = basicForm.title.trim() === entry.title.trim();
                    return (
                      <div
                        key={entry.id}
                        className={`py-4 transition ${
                          isSelected ? "rounded-lg bg-primary/5 px-3" : ""
                        }`}
                      >
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                          <div className="space-y-2">
                            <div className="flex flex-wrap items-center gap-2">
                              {typeof entry.clickRate === "number" ? (
                                <Badge className={getClickRateBadgeClass(entry.clickRate)}>
                                  Estimar {entry.clickRate}
                                </Badge>
                              ) : null}
                              {typeof entry.usedCount === "number" ? (
                                <Badge variant="secondary">Usado {entry.usedCount}</Badge>
                              ) : null}
                              {entry.genre?.name ? <Badge variant="outline">{entry.genre.name}</Badge> : null}
                              {isSelected ? <Badge variant="outline">Seleccionado actualmente</Badge> : null}
                            </div>
                            <div className="text-lg font-semibold text-foreground">{entry.title}</div>
                            <div className="text-sm leading-6 text-muted-foreground">
                              {renderLibraryDescription(entry)}
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-2">
                            <Button type="button" size="sm" onClick={() => handleApplyTitle(entry.title, "library")}>
                              Completa el título
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </>
  );
}
