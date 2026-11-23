import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { InvocationHistorySettings } from "@ai-novel/shared/types/llmUsage";
import { apiClient } from "@/api/client";
import { Button } from "@/components/ui/button";

export function InvocationHistorySection() {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<InvocationHistorySettings>();
  const queryKey = ["invocation-history-settings"];
  const query = useQuery({ queryKey, queryFn: async () => (await apiClient.get<{ data: InvocationHistorySettings }>("/settings/llm-history")).data.data });
  const save = useMutation({ mutationFn: (value: InvocationHistorySettings) => apiClient.put("/settings/llm-history", value),
    onSuccess: () => { setDraft(undefined); void queryClient.invalidateQueries({ queryKey }); } });
  const value = draft ?? query.data;
  return <section className="space-y-3 border-t border-border/60 pt-5">
    <h2 className="font-semibold">La IA solicita palabras e historial de respuestas</h2>
    <p className="text-sm text-muted-foreground">Guarde los mensajes de creación y las respuestas modelo, que se pueden ver en el "Registro de llamadas y uso de IA" de la novela. El contenido puede contener texto completo; habilítelo si es necesario. Se registran continuamente estadísticas que requieren mucho tiempo.</p>
    {value ? <form className="flex flex-wrap items-end gap-4 text-sm" onSubmit={event => { event.preventDefault(); save.mutate(value); }}>
      <label className="flex items-center gap-2 py-2"><input type="checkbox" checked={value.enabled} onChange={event => setDraft({ ...value, enabled: event.target.checked })} />Guardar palabras y respuestas rápidas</label>
      <label className="space-y-1"><span className="block text-xs text-muted-foreground">Días de retención</span><input className="w-24 rounded-md border border-input bg-background p-2" type="number" required min={1} max={365} value={value.retentionDays} onChange={event => setDraft({ ...value, retentionDays: event.target.valueAsNumber })} /></label>
      <label className="space-y-1"><span className="block text-xs text-muted-foreground">Capacidad máxima después de la compresión (MB)</span><input className="w-28 rounded-md border border-input bg-background p-2" type="number" required min={1} max={4096} value={value.maxMb} onChange={event => setDraft({ ...value, maxMb: event.target.valueAsNumber })} /></label>
      <Button type="submit" disabled={save.isPending}>Guardar configuración histórica</Button>
    </form> : query.isPending ? <p className="text-sm">Configuración de lectura...</p> : null}
    <p className="text-xs text-muted-foreground">El contenido histórico que ha caducado o ha superado la capacidad se borra cada 15 minutos y los registros más antiguos se eliminan primero. Deje de guardar contenido nuevo después del cierre y limpie el contenido existente de acuerdo con la configuración de retención; retención de uso de llamadas.</p>
    {save.isSuccess ? <p role="status" className="text-sm">Configuración histórica guardada.</p> : null}
    {query.isError || save.isError ? <p role="alert" className="text-sm text-destructive">No se pudo leer ni guardar la configuración histórica. Inténtelo de nuevo.</p> : null}
  </section>;
}
