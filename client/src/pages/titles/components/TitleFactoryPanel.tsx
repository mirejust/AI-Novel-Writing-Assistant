import { useMemo, useState } from "react";
import type { TitleFactorySuggestion } from "@ai-novel/shared/types/title";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Settings2, Sparkles } from "lucide-react";
import { flattenGenreTreeOptions, type GenreTreeNode } from "@/api/genre";
import { generateNovelTitles, type NovelListResponse } from "@/api/novel";
import { createTitleLibraryEntry } from "@/api/title";
import { queryKeys } from "@/api/queryKeys";
import { generateTitleIdeas } from "@/api/title";
import LLMSelector from "@/components/common/LLMSelector";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/components/ui/toast";
import { useLLMStore } from "@/store/llmStore";
import TitleSuggestionList from "./TitleSuggestionList";
import SelectControl from "@/components/common/SelectControl";

interface TitleFactoryPanelProps {
  genreTree: GenreTreeNode[];
  novels: NovelListResponse["items"];
}

type FactoryMode = "novel" | "brief" | "adapt";

const MODE_COPY: Record<FactoryMode, { title: string; description: string }> = {
  novel: {
    title: "Generar por novela",
    description: "Lea los datos del nuevo proyecto guardado y genere directamente candidatos a títulos que se acerquen más al trabajo actual.",
  },
  brief: {
    title: "Taller gratuito",
    description: "Simplemente escribe una oración sobre el tema, el punto de venta del protagonista o el conflicto central, y prueba rápidamente un lote de títulos en diferentes direcciones.",
  },
  adapt: {
    title: "Adaptación de referencia",
    description: "Consulte el ritmo y la estructura de nombres de un título y luego regénelo en función de la información de su trabajo.",
  },
};

const controlClassName = "w-full rounded-xl border-0 bg-background/85 px-3 py-2.5 text-sm outline-none shadow-sm ring-1 ring-border/45 transition hover:bg-background focus:bg-background focus:ring-2 focus:ring-primary/25";
const inputClassName = "h-10 rounded-xl border-0 bg-background/85 shadow-sm ring-1 ring-border/45 transition hover:bg-background focus-visible:ring-primary/25";
const textareaClassName = `${controlClassName} resize-y leading-6`;

function sortSuggestions<T extends { clickRate: number }>(items: T[]): T[] {
  return [...items].sort((left, right) => right.clickRate - left.clickRate);
}

export default function TitleFactoryPanel({ genreTree, novels }: TitleFactoryPanelProps) {
  const llm = useLLMStore();
  const queryClient = useQueryClient();
  const genreOptions = useMemo(() => flattenGenreTreeOptions(genreTree), [genreTree]);
  const [mode, setMode] = useState<FactoryMode>("novel");
  const [selectedNovelId, setSelectedNovelId] = useState("");
  const [brief, setBrief] = useState("");
  const [referenceTitle, setReferenceTitle] = useState("");
  const [genreId, setGenreId] = useState("");
  const [count, setCount] = useState(10);
  const [selectedTitle, setSelectedTitle] = useState("");
  const [suggestions, setSuggestions] = useState<TitleFactorySuggestion[]>([]);
  const [showModelSettings, setShowModelSettings] = useState(false);

  const selectedNovel = useMemo(
    () => novels.find((item) => item.id === selectedNovelId) ?? null,
    [novels, selectedNovelId],
  );

  const generateMutation = useMutation({
    mutationFn: async () => {
      if (mode === "novel") {
        if (!selectedNovelId) {
          throw new Error("Primero seleccione un proyecto de ficción.");
        }
        const response = await generateNovelTitles(selectedNovelId, {
          provider: llm.provider,
          model: llm.model,
          temperature: llm.temperature,
          count,
          maxTokens: llm.maxTokens,
        });
        return response.data?.titles ?? [];
      }

      const response = await generateTitleIdeas({
        mode,
        brief,
        referenceTitle,
        genreId: genreId || null,
        count,
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
      setSelectedTitle(next[0]?.title ?? "");
      toast.success(`Generado ${next.length} candidatos al título.`);
    },
  });

  const saveMutation = useMutation({
    mutationFn: (suggestion: TitleFactorySuggestion) => {
      const resolvedGenreId = mode === "novel" ? selectedNovel?.genre?.id ?? null : genreId || null;
      const description = mode === "novel"
        ? `Proyecto fuente:${selectedNovel?.title ?? "Proyecto sin nombre"}`
        : mode === "adapt"
          ? `Título de referencia:${referenceTitle.trim()}`
          : brief.trim().slice(0, 400);
      const keywords = mode === "novel"
        ? selectedNovel?.title ?? null
        : mode === "adapt"
          ? `Inspiración de adaptación / ${referenceTitle.trim()}`
          : brief.trim().slice(0, 160);
      return createTitleLibraryEntry({
        title: suggestion.title,
        clickRate: suggestion.clickRate,
        description: description || null,
        keywords,
        genreId: resolvedGenreId,
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.titles.all });
      toast.success("El título se ha agregado a la biblioteca de títulos.");
    },
  });

  const handleCopy = async (suggestion: TitleFactorySuggestion) => {
    await navigator.clipboard.writeText(suggestion.title);
    setSelectedTitle(suggestion.title);
    toast.success("Título copiado al portapapeles.");
  };

  const handlePrimaryAction = async (suggestion: TitleFactorySuggestion) => {
    await handleCopy(suggestion);
  };

  const modeCopy = MODE_COPY[mode];

  return (
    <div className="space-y-6">
      <Tabs value={mode} onValueChange={(value) => setMode(value as FactoryMode)}>
        <section className="rounded-3xl bg-muted/[0.18] p-4 sm:p-6">
          <div className="mx-auto max-w-3xl">
            <TabsList className="grid h-11 w-full grid-cols-3 rounded-full bg-background/70 p-1 shadow-sm">
              <TabsTrigger value="novel" className="rounded-full">Generar por novela</TabsTrigger>
              <TabsTrigger value="brief" className="rounded-full">Taller gratuito</TabsTrigger>
              <TabsTrigger value="adapt" className="rounded-full">Adaptación de referencia</TabsTrigger>
            </TabsList>
            <p className="mt-3 text-center text-sm leading-6 text-muted-foreground">{modeCopy.description}</p>
          </div>

          <div className="mx-auto mt-6 max-w-4xl">
            <TabsContent value="novel" className="mt-0 space-y-3">
              <div className="space-y-2">
                <label htmlFor="title-factory-novel" className="text-sm font-medium text-foreground">
                  ¿Qué novela te gustaría nombrar?
                </label>
                <SelectControl
                  id="title-factory-novel"
                  className={controlClassName}
                  value={selectedNovelId}
                  onChange={(event) => setSelectedNovelId(event.target.value)}
                >
                  <option value="">Por favor seleccione un artículo</option>
                  {novels.map((novel) => (
                    <option key={novel.id} value={novel.id}>
                      {novel.title}
                    </option>
                  ))}
                </SelectControl>
              </div>
              <div className="text-xs leading-5 text-muted-foreground">
                Adecuado para trabajos que han completado la introducción y el tipo, el sistema generará títulos de candidatos basados ​​en la información del proyecto.
              </div>
            </TabsContent>

            <TabsContent value="brief" className="mt-0 grid gap-4 md:grid-cols-[minmax(0,1fr)_240px]">
              <div className="space-y-3">
                <label htmlFor="title-factory-brief" className="text-sm font-medium text-foreground">
                  crear un resumen
                </label>
                <textarea
                  id="title-factory-brief"
                  className={`${textareaClassName} min-h-[176px]`}
                  value={brief}
                  onChange={(event) => setBrief(event.target.value)}
                  placeholder="Describe el tema, el punto de venta del protagonista, el conflicto, el estilo de escritura y las expectativas del lector. Cuanto más específico sea el título, más distintivo será."
                />
              </div>
              <div className="space-y-3">
                <label htmlFor="title-factory-genre" className="text-sm font-medium text-foreground">
                  Tipo de filtrado
                </label>
                <SelectControl
                  id="title-factory-genre"
                  className={controlClassName}
                  value={genreId}
                  onChange={(event) => setGenreId(event.target.value)}
                >
                  <option value="">No se especifica ningún tipo</option>
                  {genreOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.path}
                    </option>
                  ))}
                </SelectControl>
                <p className="text-xs leading-5 text-muted-foreground">
                  Si no está seguro del tipo, puede dejarlo en blanco y dejar que el modelo determine primero la dirección del título basándose en el resumen.
                </p>
              </div>
            </TabsContent>

            <TabsContent value="adapt" className="mt-0 space-y-4">
              <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_240px]">
                <div className="space-y-3">
                  <label htmlFor="title-factory-reference" className="text-sm font-medium text-foreground">
                    Título de referencia
                  </label>
                  <Input
                    id="title-factory-reference"
                    value={referenceTitle}
                    onChange={(event) => setReferenceTitle(event.target.value)}
                    placeholder="Por ejemplo: estoy recogiendo atributos en el páramo."
                    className={inputClassName}
                  />
                </div>
                <div className="space-y-3">
                  <label htmlFor="title-factory-adapt-genre" className="text-sm font-medium text-foreground">
                    Tipo de filtrado
                  </label>
                  <SelectControl
                    id="title-factory-adapt-genre"
                    className={controlClassName}
                    value={genreId}
                    onChange={(event) => setGenreId(event.target.value)}
                  >
                    <option value="">No se especifica ningún tipo</option>
                    {genreOptions.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.path}
                      </option>
                    ))}
                  </SelectControl>
                </div>
              </div>
              <div className="space-y-3">
                <label htmlFor="title-factory-adapt-brief" className="text-sm font-medium text-foreground">
                  Resumen de trabajo
                </label>
                <textarea
                  id="title-factory-adapt-brief"
                  className={`${textareaClassName} min-h-[132px]`}
                  value={brief}
                  onChange={(event) => setBrief(event.target.value)}
                  placeholder="Explica el tema, los personajes y los puntos de venta de tu trabajo. El sistema hará referencia al ritmo del título, pero no lo copiará directamente."
                />
              </div>
            </TabsContent>
          </div>

          <div className="mx-auto mt-6 flex max-w-4xl flex-col gap-3 border-t border-border/40 pt-4 lg:flex-row lg:items-center lg:justify-between">
            <button
              type="button"
              className="inline-flex items-center gap-2 text-left text-xs text-muted-foreground transition hover:text-foreground"
              onClick={() => setShowModelSettings((value) => !value)}
            >
              <Settings2 className="h-3.5 w-3.5" />
              <span>Modelo {llm.provider} · {llm.model}</span>
            </button>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
              <label className="flex items-center gap-2 text-sm">
                <span className="font-medium text-foreground">Cantidad</span>
                <Input
                  type="number"
                  min={3}
                  max={24}
                  step={1}
                  value={count}
                  onChange={(event) => setCount(Number(event.target.value) || 10)}
                  className={`${inputClassName} w-20`}
                />
              </label>
              <Button
                type="button"
                className="h-10 gap-2 rounded-full px-6"
                onClick={() => generateMutation.mutate()}
                disabled={generateMutation.isPending}
              >
                <Sparkles className="h-4 w-4" />
                {generateMutation.isPending ? "Generando..." : "Generar título"}
              </Button>
            </div>
          </div>

          {showModelSettings ? (
            <div className="mx-auto mt-4 max-w-4xl border-t border-border/40 pt-4">
              <LLMSelector showParameters showBadge={false} />
            </div>
          ) : null}
          {generateMutation.error ? (
            <div className="mx-auto mt-4 max-w-4xl rounded-xl bg-destructive/[0.055] px-4 py-3 text-sm text-destructive">
              {generateMutation.error instanceof Error ? generateMutation.error.message : "Error al generar el título. Inténtelo de nuevo."}
            </div>
          ) : null}
        </section>
      </Tabs>

      <section className="space-y-4">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <h3 className="text-base font-semibold text-foreground">Resultados de los candidatos</h3>
          <div className="text-xs text-muted-foreground">
            {suggestions.length > 0 ? `Ordenado por potencial de clics, total ${suggestions.length} un` : "Los resultados se mostrarán una vez generados."}
          </div>
        </div>
        <TitleSuggestionList
          layout="grid"
          suggestions={suggestions}
          selectedTitle={selectedTitle}
          primaryActionLabel="Copiar título"
          onPrimaryAction={handlePrimaryAction}
          onCopy={handleCopy}
          onSave={(suggestion) => saveMutation.mutate(suggestion)}
          savingTitle={saveMutation.isPending ? saveMutation.variables?.title ?? "" : ""}
          emptyMessage={`${modeCopy.title}Cuando esté listo, haga clic en "Generar título" para ver diferentes direcciones de nombres.`}
        />
      </section>
    </div>
  );
}
