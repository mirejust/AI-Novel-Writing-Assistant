import {useState} from "react";
import {useMutation, useQuery, useQueryClient} from "@tanstack/react-query";
import {DEFAULT_DIRECTOR_CHAPTER_TOKEN_LIMIT, directorChapterTokenLimitSchema, MAX_DIRECTOR_CHAPTER_TOKEN_LIMIT} from "@ai-novel/shared/types/director/chapterBudget";
import {getDirectorChapterBudgetSettings, saveDirectorChapterBudgetSettings} from "@/api/settings";
import {queryKeys} from "@/api/queryKeys";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";

export function ChapterBudgetSettingsSection() {
  const queries = useQueryClient();
  const [draft, setDraft] = useState<string | null>(null);
  const [feedback, setFeedback] = useState("");
  const query = useQuery({queryKey: queryKeys.settings.directorChapterBudget, queryFn: getDirectorChapterBudgetSettings});
  const value = draft ?? String(query.data?.data?.tokenLimit ?? DEFAULT_DIRECTOR_CHAPTER_TOKEN_LIMIT);
  const valid = value.trim() !== "" && directorChapterTokenLimitSchema.safeParse(Number(value)).success;
  const save = useMutation({mutationFn: () => saveDirectorChapterBudgetSettings({tokenLimit: Number(value)}),
    onSuccess: async response => {
      queries.setQueryData(queryKeys.settings.directorChapterBudget, response);
      setDraft(null);
      setFeedback(response.message ?? "El límite de uso de IA para un solo capítulo se ha guardado y se utilizará para nuevas misiones.");
      await queries.invalidateQueries({queryKey: queryKeys.settings.directorChapterBudget});
    }, onError: error => setFeedback(error instanceof Error ? error.message : "Error al guardar, inténtelo de nuevo.")});
  return <section className="space-y-3 py-4" aria-labelledby="chapter-budget-settings-title">
    <div className="space-y-1">
      <h2 id="chapter-budget-settings-title" className="text-base font-medium">Límite de uso de IA de un solo capítulo</h2>
      <p className="text-sm text-muted-foreground">Establece el uso acumulativo de IA para cada capítulo de una nueva misión. Cuando se alcanza el límite superior o el saldo restante es insuficiente para pasar al siguiente paso, la IA guardará el progreso y preguntará si se debe aumentar el presupuesto.</p>
    </div>
    <label className="block max-w-xs space-y-2 text-sm">Límite superior predeterminado (Tokens)
      <Input type="number" min={16001} max={MAX_DIRECTOR_CHAPTER_TOKEN_LIMIT} step={1} value={value}
        disabled={query.isLoading || save.isPending} aria-invalid={!valid}
        onChange={event => {setDraft(event.target.value); setFeedback("");}}/>
    </label>
    <p className="text-xs leading-5 text-muted-foreground">El valor predeterminado es 100.000; Se puede configurar entre 16.001 y 10.000.000. Se calcula en función de la acumulación de entradas y salidas perdidas, que es diferente de la salida máxima única del modelo. Mantenga su propia configuración de cuota después de que comience la tarea.</p>
    {!valid ? <p className="text-xs text-destructive">Introduzca un número entero entre 16.001 y 10.000.000.</p> : null}
    {query.isError ? <p role="alert" className="text-xs text-destructive">No se pudo leer la configuración, inténtalo de nuevo.<Button size="sm" variant="ghost" onClick={() => void query.refetch()}>Releer</Button></p> : null}
    <Button disabled={query.isLoading || query.isError || save.isPending || !valid} onClick={() => save.mutate()}>{save.isPending ? "Guardando…" : "Guardar"}</Button>
    {feedback ? <p role="status" className="text-sm text-muted-foreground">{feedback}</p> : null}
  </section>;
}
