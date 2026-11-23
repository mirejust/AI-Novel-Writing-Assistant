import type { NovelUsagePage, NovelUsageSummary } from "@ai-novel/shared/types/llmUsage";
import { formatUsageTokens, usageCoverageNotes, usageTime } from "../presentation";

export function UsageOverview({ data }: { data: NovelUsagePage }) {
  const summary = data.summary;
  return <section aria-label="El uso se ha registrado a lo largo del libro." className="space-y-5 border-b border-border/60 pb-6">
    <h2 className="text-sm font-semibold">El uso se ha registrado a lo largo del libro.</h2>
    <dl className="grid grid-cols-2 gap-x-8 gap-y-5 lg:grid-cols-4">
      <Metric label="Fichas acumuladas" value={summary.totalTokens} />
      <div><Metric label="Introducir fichas" value={summary.promptTokens} /><div className="mt-2 space-y-1 text-xs text-muted-foreground tabular-nums">
        <p>golpe de caché {formatUsageTokens(summary.cacheHitTokens)}</p>
        <p>pérdida de caché {formatUsageTokens(summary.cacheMissTokens)}</p>
      </div></div>
      <Metric label="Fichas de salida" value={summary.completionTokens} />
      <div><dt className="text-xs text-muted-foreground">Llamada registrada</dt><dd className="mt-2 text-2xl font-semibold tabular-nums">{summary.recordedCallCount.toLocaleString()} De segunda categoría</dd><p className="mt-2 text-xs text-muted-foreground">llamada fallida {summary.failedCallCount} tiempos · devolución parcial {summary.partialCallCount} De segunda categoría</p></div>
    </dl>
    <div className="space-y-1 text-xs leading-relaxed text-muted-foreground">
      <p>Los tokens acumulativos incluyen entrada y salida; Los aciertos y errores de caché son entradas y no se agregan al uso acumulativo.</p>
      <p>El registro registra la llamada completada; el consumo en la generación se actualiza una vez finalizada esta convocatoria.</p>
      <p>{data.firstRecordedAt ? `Registro de llamada más antigua:${usageTime(data.firstRecordedAt)}.` : "No hay ningún registro de llamada por llamada en este libro."}Las llamadas históricas no registradas no se pueden compensar; el uso no devuelto por el fabricante se muestra como "no proporcionado".</p>
      {usageCoverageNotes(summary).map(note => <p key={note}>{note}</p>)}
    </div>
    {data.chapterBreakdown.length ? <details className="pt-2">
      <summary className="cursor-pointer text-sm font-medium">Ver uso por capítulo</summary>
      <div className="mt-3 overflow-x-auto"><table className="w-full text-left text-xs tabular-nums"><thead className="text-muted-foreground"><tr><th className="py-2 font-normal">Capítulo/Alcance</th><th className="px-3 font-normal">Llamar</th><th className="px-3 font-normal">Ingresar</th><th className="px-3 font-normal">Producción</th><th className="px-3 font-normal">Fichas acumuladas</th></tr></thead><tbody className="divide-y divide-border/50">{data.chapterBreakdown.map(row => <tr key={row.chapterId ?? "book"}><td className="py-3">{row.label}{row.unknownUsageCallCount || row.partialCallCount ? <span className="ml-2 text-muted-foreground">Las estadísticas están incompletas</span> : null}</td><td className="px-3">{row.recordedCallCount}</td><td className="px-3">{formatUsageTokens(row.promptTokens)}</td><td className="px-3">{formatUsageTokens(row.completionTokens)}</td><td className="px-3">{formatUsageTokens(row.totalTokens)}</td></tr>)}</tbody></table></div>
    </details> : null}
  </section>;
}

function Metric({label, value}: {label: string; value: NovelUsageSummary["totalTokens"]}) {
  return <div><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-2 text-2xl font-semibold tabular-nums">{formatUsageTokens(value)}</dd></div>;
}
