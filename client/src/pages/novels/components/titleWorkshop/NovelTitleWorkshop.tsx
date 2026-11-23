import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { TitleFactorySuggestion } from "@ai-novel/shared/types/title";
import { generateNovelTitles } from "@/api/novel";
import { createTitleLibraryEntry } from "@/api/title";
import { queryKeys } from "@/api/queryKeys";
import AiButton from "@/components/common/AiButton";
import LLMSelector from "@/components/common/LLMSelector";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { useLLMStore } from "@/store/llmStore";
import TitleSuggestionList from "@/pages/titles/components/TitleSuggestionList";

interface NovelTitleWorkshopProps {
  novelId: string;
  currentTitle: string;
  currentDescription?: string;
  genreId?: string;
  onApplyTitle: (title: string) => void;
}
const DEFAULT_NOVEL_TITLE_COUNT = 12;

export default function NovelTitleWorkshop({
  novelId,
  currentTitle,
  currentDescription,
  genreId,
  onApplyTitle,
}: NovelTitleWorkshopProps) {
  const llm = useLLMStore();
  const queryClient = useQueryClient();
  const [selectedTitle, setSelectedTitle] = useState(currentTitle);
  const [suggestions, setSuggestions] = useState<TitleFactorySuggestion[]>([]);

  const generateMutation = useMutation({
    mutationFn: () => generateNovelTitles(novelId, {
      provider: llm.provider,
      model: llm.model,
      temperature: llm.temperature,
      count: DEFAULT_NOVEL_TITLE_COUNT,
      maxTokens: llm.maxTokens,
    }),
    onSuccess: (response) => {
      const next = [...(response.data?.titles ?? [])].sort((left, right) => right.clickRate - left.clickRate);
      setSuggestions(next);
      setSelectedTitle(next[0]?.title ?? currentTitle);
      toast.success(`Generado ${next.length} candidatos al título.`);
    },
  });

  const saveMutation = useMutation({
    mutationFn: (suggestion: TitleFactorySuggestion) => createTitleLibraryEntry({
      title: suggestion.title,
      description: currentDescription?.trim().slice(0, 400) || null,
      clickRate: suggestion.clickRate,
      keywords: currentTitle?.trim().slice(0, 160) || null,
      genreId: genreId || null,
    }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.titles.all });
      toast.success("El título se ha agregado a la biblioteca de títulos.");
    },
  });

  const saveCurrentMutation = useMutation({
    mutationFn: () => createTitleLibraryEntry({
      title: currentTitle,
      description: currentDescription?.trim().slice(0, 400) || null,
      keywords: currentTitle.trim().slice(0, 160),
      genreId: genreId || null,
    }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.titles.all });
      toast.success("El título actual se ha agregado a la biblioteca de títulos.");
    },
  });

  const handleCopy = async (suggestion: TitleFactorySuggestion) => {
    await navigator.clipboard.writeText(suggestion.title);
    setSelectedTitle(suggestion.title);
    toast.success("Título copiado al portapapeles.");
  };

  const handleApply = (suggestion: TitleFactorySuggestion) => {
    setSelectedTitle(suggestion.title);
    onApplyTitle(suggestion.title);
    toast.success("El título ha sido escrito en el formulario de información básica, recuerda guardarlo.");
  };

  return (
    <div className="space-y-4">
      <div className="space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-1">
            <div className="text-sm font-semibold text-foreground">Taller de título dentro del proyecto.</div>
            <div className="text-sm leading-6 text-muted-foreground">
              Genere candidatos según la sinopsis y el género de la novela actualmente guardada. Si acaba de modificar la introducción o el tipo, se recomienda guardar la información básica antes de generarla.
            </div>
          </div>
          <Button type="button" variant="outline" disabled={!currentTitle.trim() || saveCurrentMutation.isPending} onClick={() => saveCurrentMutation.mutate()}>
            {saveCurrentMutation.isPending ? "Guardando..." : "Guardar título actual"}
          </Button>
        </div>
        <div className="space-y-3">
          <LLMSelector />
          <div className="flex justify-end">
            <AiButton type="button" onClick={() => generateMutation.mutate()} disabled={generateMutation.isPending}>
              {generateMutation.isPending ? "Generando..." : "Generar candidatos a título"}
            </AiButton>
          </div>
        </div>
      </div>

      <TitleSuggestionList
        suggestions={suggestions}
        selectedTitle={selectedTitle}
        primaryActionLabel="Aplicar al proyecto"
        onPrimaryAction={handleApply}
        onCopy={handleCopy}
        onSave={(suggestion) => saveMutation.mutate(suggestion)}
        savingTitle={saveMutation.isPending ? saveMutation.variables?.title ?? "" : ""}
        emptyMessage="Haga clic en Generar una vez para obtener un lote de candidatos a títulos según la configuración actual del proyecto."
      />
    </div>
  );
}
