import {useState} from "react";
import {useMutation, useQueryClient} from "@tanstack/react-query";
import {Link} from "react-router-dom";
import type {DirectorChapterBudgetView} from "@ai-novel/shared/types/director/chapterBudget";
import {createDirectorCommandKey, submitDirectorCommand} from "@/api/directorNext";
import {queryKeys} from "@/api/queryKeys";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";

const stages = {draft: "Escribiendo", review: "Aceptación del capítulo", repair: "Revisar el artículo.", artifact_sync: "Sincronización de datos"};
const format = (value: number) => value.toLocaleString("zh-CN");

export default function ChapterBudgetRecovery({budget, runId, novelId, expectedVersion, disabled = false}: {
  budget: DirectorChapterBudgetView; runId: string; novelId: string; expectedVersion: number; disabled?: boolean;
}) {
  const [limit, setLimit] = useState(String(budget.recommendedLimit));
  const [commandKey, setCommandKey] = useState(createDirectorCommandKey);
  const [applyToRemaining, setApplyToRemaining] = useState(false);
  const [deferred, setDeferred] = useState(false);
  const queries = useQueryClient();
  const minimum = Math.max(budget.tokenLimit, budget.usedTokens + budget.reserveTokens, applyToRemaining ? 16000 : 0) + 1;
  const valid = limit.trim() !== "" && Number.isSafeInteger(Number(limit)) && Number(limit) >= minimum && Number(limit) <= 10_000_000;
  const updateLimit = (value: string) => {setLimit(value); setCommandKey(createDirectorCommandKey());};
  const mutation = useMutation({mutationFn: () => {
    if (!valid) throw new Error(`El nuevo límite superior para este capítulo es al menos ${format(minimum)} Fichas.`);
    return submitDirectorCommand({type: "resume", runId, expectedVersion, idempotencyKey: commandKey,
       chapterBudget: {jobId: budget.jobId, chapterId: budget.chapterId, metric: budget.metric, tokenLimit: Number(limit), applyToRemaining}});
  }, onSuccess: async () => {
    await Promise.all([
      queries.invalidateQueries({queryKey: queryKeys.directorNext.summary(novelId)}),
      queries.invalidateQueries({queryKey: queryKeys.directorNext.detail(novelId)}),
      queries.invalidateQueries({queryKey: queryKeys.directorNext.runs(false)}),
      queries.invalidateQueries({queryKey: queryKeys.directorNext.runs(true)}),
    ]);
  }});
  const busy = disabled || mutation.isPending || mutation.isSuccess;
  if (deferred) return <section id="director-chapter-budget" className="space-y-3 py-4" role="status">
    <p className="text-xs leading-5 text-muted-foreground">Cap. {budget.chapterOrder} El capítulo permanece en pausa y el progreso se guarda. Puede ajustar su presupuesto si necesita continuar.</p>
    <Button size="sm" variant="ghost" disabled={disabled} onClick={() => setDeferred(false)}>Ajustar presupuesto</Button>
  </section>;
  return <section id="director-chapter-budget" aria-labelledby="chapter-budget-title" className="scroll-mt-4 space-y-3 border-t border-border/60 py-4">
    <h3 id="chapter-budget-title" className="text-sm font-semibold">Cap. {budget.chapterOrder} Monto y cuota del capítulo</h3>
    <p role="status" className="text-xs leading-5 text-muted-foreground">{budget.usedTokens >= budget.tokenLimit
      ? "El uso acumulativo de este capítulo ha alcanzado el límite superior." : "El saldo restante en este capítulo no es suficiente para proceder al siguiente paso."}
      Se recomienda ajustar la cuota de este capítulo a {format(budget.recommendedLimit)} Fichas. Continuar guardando el progreso después de la confirmación.
    </p>
    <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
      <dt className="text-muted-foreground">Este capítulo ha sido utilizado</dt><dd>{format(budget.usedTokens)} {budget.metric === "uncached_tokens_v1" ? "Fichas válidas" : "Tokens"}</dd>
      <dt className="text-muted-foreground">Límite superior de este capítulo</dt><dd>{format(budget.tokenLimit)} Tokens</dd>
      <dt className="text-muted-foreground">{budget.stage ? stages[budget.stage] : "Siguiente"}Reservado</dt><dd>{format(budget.reserveTokens)} Tokens</dd>
    </dl>
    {budget.automaticTopUpTokens ? <p className="text-xs text-muted-foreground">Este capítulo ha sido añadido automáticamente. {format(budget.automaticTopUpTokens)} Fichas.</p> : null}
    {budget.metric === "uncached_tokens_v1" ? <div className="space-y-1 text-xs leading-5 text-muted-foreground">
      <p>El uso efectivo se calcula como "entrada perdida + salida", cada uno de los cuales se cuenta como 1 vez.</p>
      <p>ingresar {format(budget.promptTokens ?? 0)} · Golpe de caché {format(budget.cacheHitTokens ?? 0)} · Producción {format(budget.completionTokens ?? 0)}</p>
      {budget.unclassifiedTokens ? <p>La interfaz informa por separado. {format(budget.unclassifiedTokens)} Los tokens, que no proporcionan división de entrada y salida, se incluyen de forma conservadora en el uso de este capítulo.</p> : null}
      <p>Acumulado original {format(budget.rawTokens)} Fichas; el monto efectivo se utiliza para la protección de cuotas en este capítulo.</p>
    </div> : <p className="text-xs leading-5 text-muted-foreground">Esta tarea se mide en función de los tokens acumulados originales y el uso histórico sigue siendo el calibre original.</p>}
    <label className="block space-y-2 text-xs">Nuevo límite superior para este capítulo.
      <Input type="number" min={minimum} max={10_000_000} step={1} value={limit} disabled={busy}
        aria-invalid={!valid} onChange={event => updateLimit(event.target.value)}/>
    </label>
    <div className="flex flex-wrap items-center gap-2">
      <Button size="sm" variant="ghost" disabled={busy} onClick={() => updateLimit(String(budget.recommendedLimit))}>Utilice la cantidad recomendada {format(budget.recommendedLimit)}</Button>
      <Button asChild size="sm" variant="ghost"><Link to={`/novels/${encodeURIComponent(novelId)}/ai-usage`}>Ver detalles de la llamada</Link></Button>
    </div>
    {!valid ? <p className="text-xs text-destructive">Por favor ingresa {format(minimum)} a 10.000.000.</p> : null}
    <label className="flex items-start gap-2 text-xs leading-5"><input type="checkbox" className="mt-1" checked={applyToRemaining} disabled={busy}
      onChange={event => {setApplyToRemaining(event.target.checked); setCommandKey(createDirectorCommandKey());}}/>También se aplica a los capítulos posteriores de esta tarea.</label>
    <p className="text-xs leading-5 text-muted-foreground">{applyToRemaining
      ? "Este capítulo y los capítulos posteriores de esta misión utilizan el nuevo límite superior; la configuración predeterminada global permanece en sus valores originales."
      : "Sólo se ajustará este capítulo; Otros capítulos seguirán utilizando la cuota de esta tarea."}Mantenga el texto existente y el uso acumulado al continuar.</p>
    <Button className="w-full" disabled={busy || !valid} onClick={() => mutation.mutate()}>{mutation.isPending ? "Enviando…" : mutation.isSuccess ? "Presentado, restaurando..." : "Agregue crédito adicional y continúe con este capítulo."}</Button>
    <Button className="w-full" variant="ghost" disabled={busy} onClick={() => setDeferred(true)}>Permanecer en pausa</Button>
    {mutation.isError ? <p role="alert" className="text-xs text-destructive">{mutation.error.message}</p> : null}
  </section>;
}
