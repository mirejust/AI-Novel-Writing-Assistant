import type { NovelUsagePage } from "@ai-novel/shared/types/llmUsage";
import { formatUsageDuration, usageStageLabel } from "../presentation";

const colors = ["bg-primary", "bg-sky-500", "bg-amber-500", "bg-violet-500", "bg-emerald-500"];
export function UsageTiming({ data, onJump }: { data: NovelUsagePage; onJump: (id: string) => void }) {
  const timing = data.timing;
  return <section aria-label="La llamada lleva tiempo." className="space-y-4 border-b border-border/60 pb-5">
    <div className="flex flex-wrap gap-6 text-sm"><p>Tiempo promedio de llamada <strong className="tabular-nums">{formatUsageDuration(timing.averageMs)}</strong></p><p>llamada mas lenta {timing.slowest ? <button type="button" className="text-primary underline underline-offset-4" onClick={() => onJump(timing.slowest!.invocationId)}>{formatUsageDuration(timing.slowest.durationMs)} · Ver llamadas</button> : "No disponible"}</p></div>
    <p className="text-xs text-muted-foreground">Las estadísticas de pasos y que consumen mucho tiempo cubren todas las llamadas cronometradas del filtro actual. La acumulación de pasos incluye reintentos; El tiempo necesario para las llamadas paralelas se sumará y no es igual al tiempo de espera para la creación del capítulo.</p>
    <details><summary className="cursor-pointer text-sm font-medium">Ver el tiempo del paso por capítulo</summary>
      <div className="mt-4 space-y-5">{timing.chapters.map(row => {
        const total = row.steps.reduce((sum, step) => sum + step.durationMs, 0), chapter = data.facets.chapters.find(ch => ch.id === row.chapterId);
        return <div key={row.chapterId ?? "book"} className="space-y-2 text-xs"><p>{chapter ? `Cap. ${chapter.order} Capítulo · ${chapter.title}` : "Nivel de libro/Capítulo sin atribuir"}{row.steps[0] ? <span className="ml-3 text-muted-foreground">Paso más lento:{usageStageLabel(row.steps[0].stage)} · {formatUsageDuration(row.steps[0].durationMs)}</span> : null}</p>
          <div className="flex h-3 overflow-hidden rounded bg-muted" role="img" aria-label={row.steps.map(step => `${usageStageLabel(step.stage)} ${formatUsageDuration(step.durationMs)}`).join(";")}>{row.steps.map((step, index) => <div key={step.stage ?? "unknown"} className={colors[index % colors.length]} style={{ width: `${total ? step.durationMs / total * 100 : 0}%` }} title={`${usageStageLabel(step.stage)} ${formatUsageDuration(step.durationMs)}`} />)}</div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-muted-foreground">{row.steps.map((step, index) => <span key={step.stage ?? "unknown"}><span className={`mr-1 inline-block h-2 w-2 rounded-full ${colors[index % colors.length]}`} />{usageStageLabel(step.stage)} {formatUsageDuration(step.durationMs)}</span>)}</div>
        </div>;
      })}</div>
    </details>
  </section>;
}
