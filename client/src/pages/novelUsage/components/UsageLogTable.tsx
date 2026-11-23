import { Fragment, useState } from "react";
import type { NovelUsagePage } from "@ai-novel/shared/types/llmUsage";
import { InvocationDetail } from "./InvocationDetail";
import { formatUsageDuration, usageTokensPerSecond, formatUsageTokens, usageStageLabel, usageStatusLabel, usageTime } from "../presentation";

export function UsageLogTable({ items, novelId, focusedId, onJump }: { items: NovelUsagePage["items"]; novelId: string; focusedId?: string; onJump: (id: string) => void }) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [collapsedFocus, setCollapsedFocus] = useState<string | null>(null);
  const isExpanded = (id: string) => expanded === id || (focusedId === id && collapsedFocus !== id);
  const toggle = (id: string) => {
    const open = isExpanded(id);
    setExpanded(open ? null : id);
    if (focusedId === id) setCollapsedFocus(open ? id : null);
  };
  if (!items.length) return <p className="py-8 text-sm text-muted-foreground">No hay registros de llamadas que coincidan con los criterios del filtro.</p>;
  return <div className="overflow-x-auto"><table className="w-full min-w-[1150px] text-left text-xs">
    <thead className="border-b border-border/60 text-muted-foreground"><tr>{["Hora de inicio", "Capítulos y pasos", "Fabricante y modelo", "Introducir fichas", "Fichas de salida", "Fichas acumuladas", "Consume mucho tiempo/TTFT", "Tók/s de salida", "Modo de reintento/salida", "Estado de llamada"].map(label => <th key={label} className="px-3 py-3 font-normal first:pl-0">{label}</th>)}</tr></thead>
    <tbody className="divide-y divide-border/50">{items.map(item => <Fragment key={item.invocationId}>
      <tr id={`usage-${item.invocationId}`} className={`align-top ${focusedId === item.invocationId ? "bg-muted/50" : ""}`}>
        <td className="whitespace-nowrap py-4 pr-3">{usageTime(item.startedAt)}</td>
        <td className="max-w-64 px-3 py-4"><p className="font-medium">{item.chapter ? `Cap. ${item.chapter.order} Capítulo · ${item.chapter.title}` : item.chapterId ? "La información del capítulo no se registra." : "Nivel de libro/Capítulo sin atribuir"}</p><p className="mt-1 text-muted-foreground">{usageStageLabel(item.stage)}</p>
          <button type="button" className="mt-2 text-primary underline-offset-4 hover:underline" aria-expanded={isExpanded(item.invocationId)} onClick={() => toggle(item.invocationId)}>{isExpanded(item.invocationId) ? "Cierra el mensaje y prueba la cadena." : "Ver mensajes y cadena de intentos"}</button>
        </td>
        <td className="max-w-52 break-words px-3 py-4"><p>{item.provider ?? "Fabricante no registrado"}</p><p className="mt-1 text-muted-foreground">{item.model ?? "Modelo no documentado"}</p></td>
        <td className="whitespace-nowrap px-3 py-4 tabular-nums"><p className="font-medium">{formatUsageTokens(item.promptTokens)}</p><div className="mt-1 space-y-1 text-[11px] text-muted-foreground"><p>golpear {cacheCount(item, "cacheHitTokens")}</p><p>extrañar {cacheCount(item, "cacheMissTokens")}</p></div></td>
        <td className="px-3 py-4 tabular-nums">{formatUsageTokens(item.completionTokens)}</td>
        <td className="px-3 py-4 font-medium tabular-nums">{formatUsageTokens(item.totalTokens)}</td>
        <td className="whitespace-nowrap px-3 py-4 tabular-nums">{formatUsageDuration(item.durationMs)}<p className="mt-1 text-muted-foreground">TTFT {formatUsageDuration(item.firstTokenMs)}</p></td>
        <td className="px-3 py-4 tabular-nums" title="Tokens de salida ÷ Tiempo total de llamada (segundos)">{usageTokensPerSecond(item.completionTokens, item.durationMs)}</td>
        <td className="px-3 py-4">Intentar otra vez {item.attemptNumber - 1} De segunda categoría<p className="mt-1 text-muted-foreground">{item.structuredMode ?? "Salida de texto"}</p></td>
        <td className="whitespace-nowrap px-3 py-4"><span className={item.status === "failed" ? "text-destructive" : "text-muted-foreground"}>{usageStatusLabel(item.status)}</span></td>
      </tr>
      {isExpanded(item.invocationId) ? <tr><td colSpan={10} className="bg-muted/20 px-4"><InvocationDetail novelId={novelId} invocationId={item.invocationId} onJump={onJump} /></td></tr> : null}
    </Fragment>)}</tbody>
  </table></div>;
}

function cacheCount(item: NovelUsagePage["items"][number], key: "cacheHitTokens" | "cacheMissTokens"): string {
  return item.inputCache.cacheUsageStatus === "invalid" ? "Estadísticas no disponibles" : item.inputCache.cacheUsageStatus === "reported" ? formatUsageTokens(item.inputCache[key]) : "No disponible";
}
