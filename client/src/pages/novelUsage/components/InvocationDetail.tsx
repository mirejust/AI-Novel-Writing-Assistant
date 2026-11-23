import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getNovelInvocation } from "@/api/novel/usage";
import { Button } from "@/components/ui/button";
import { formatUsageDuration, usageStatusLabel } from "../presentation";
import type { LlmOutputBudgetTrace } from "@ai-novel/shared/types/llmUsage";

const budgetSources: Record<LlmOutputBudgetTrace["source"], string> = {
  automatic: "Presupuesto automático", task: "esta misión", route: "Enrutamiento del modelo", endpoint: "Límite superior de salida del modelo",
  frozen: "Presupuesto de tarea guardado", structured: "Restricciones de salida estructuradas", provider: "Determinado por el punto final",
};

function OutputBudget({ trace }: { trace: LlmOutputBudgetTrace }) {
  const fields = [
    ["Solicitud de tarea", trace.requestedMaxTokens], ["Enrutamiento del modelo", trace.routeMaxTokens],
    ["Presupuesto automático", trace.automaticMaxTokens], ["Límite superior de salida del modelo", trace.endpointMaxTokens],
    ["Presupuesto de tarea guardado", trace.frozenMaxTokens], ["Restricciones de salida estructuradas", trace.structuredMaxTokens],
    ["Piensa en las reservas", trace.reasoningReserveTokens],
  ] as const;
  return <details className="space-y-2">
    <summary className="cursor-pointer">
      Presupuesto de producción {trace.finalMaxTokens == null ? "Determinado por el punto final" : `${trace.finalMaxTokens.toLocaleString("zh-CN")} Tokens · ${budgetSources[trace.source]}`}
    </summary>
    <dl className="grid grid-cols-2 gap-1 text-muted-foreground">
      {fields.map(([label, amount]) => amount == null ? null : <div key={label} className="contents">
        <dt>{label}</dt><dd>{amount.toLocaleString("zh-CN")} Tokens</dd>
      </div>)}
    </dl>
  </details>;
}

export function InvocationDetail({ novelId, invocationId, onJump }: { novelId: string; invocationId: string; onJump: (id: string) => void }) {
  const query = useQuery({ queryKey: ["novel-invocation", novelId, invocationId], queryFn: () => getNovelInvocation(novelId, invocationId) });
  const data = query.data?.data;
  if (query.isPending) return <p className="py-3">Leyendo mensajes y respuestas...</p>;
  if (query.isError) return <div role="alert"><p>No se pudieron leer los detalles de la llamada.</p><Button variant="ghost" onClick={() => void query.refetch()}>Releer</Button></div>;
  if (!data) return null;
  return <div className="space-y-4 py-3 text-xs">
    <p className="break-all text-muted-foreground">Número de llamada:{invocationId}</p>
    <p>pérdida de tiempo {formatUsageDuration(data.item.durationMs)} · Primera vuelta {formatUsageDuration(data.item.firstTokenMs)} · No. {data.item.attemptNumber} intentos · {data.item.structuredMode ?? "Salida de texto"}</p>
    {data.item.budgetTrace ? <OutputBudget trace={data.item.budgetTrace} /> : null}
    {data.item.finishReason ? <p>Motivo del fin del modelo · {data.item.finishReason}</p> : null}
    {data.item.structureStatus ? <p>Verificación de estructura · {data.item.structureStatus === "valid" ? "Pase" : "Falló"}</p> : null}
    <div className="space-y-1"><p className="font-medium">Prueba la cadena ({data.chain.length} Segunda categoría)</p>{data.chain.map(attempt => <button key={attempt.invocationId} type="button" className="block text-left text-primary underline-offset-4 hover:underline" onClick={() => onJump(attempt.invocationId)}>Cap. {attempt.attemptNumber} Segunda categoría · {attempt.model ?? "Modelo indocumentado"} · {attempt.structuredMode ?? "Salida de texto"} · {usageStatusLabel(attempt.status)} · {formatUsageDuration(attempt.durationMs)}</button>)}</div>
    {data.payload ? <>
      <div className="space-y-2"><p className="font-medium">Mensaje de palabra rápida</p>{data.payload.messages.map((message, index) => <PayloadText key={index} label={`${index + 1}. ${message.role}`} text={typeof message.content === "string" ? message.content : JSON.stringify(message.content, null, 2)} />)}</div>
      <PayloadText label="Modelo de respuesta original" text={data.payload.response} />
      {data.payload.parsed !== null ? <PayloadText label="Resultados de análisis estructurados" text={JSON.stringify(data.payload.parsed, null, 2)} /> : null}
      {data.payload.error ? <PayloadText label="Error de llamada o análisis" text={data.payload.error} /> : null}
    </> : <p className="text-muted-foreground">Esta llamada no guardó los mensajes ni las respuestas, o el contenido se limpió según la configuración de retención. El historial se puede activar en "Configuración → Modelo y fabricante".</p>}
  </div>;
}

function PayloadText({ label, text }: { label: string; text: string }) {
  const [copied, setCopied] = useState(false), [error, setError] = useState(false);
  return <details className="space-y-2" open={text.length < 500 ? true : undefined}>
    <summary className="cursor-pointer font-medium">{label} · {text.length.toLocaleString()} Personaje</summary>
    <Button size="sm" variant="ghost" onClick={() => void navigator.clipboard.writeText(text).then(() => { setCopied(true); setError(false); }, () => setError(true))}>{copied ? "Copiado" : "Copiar"}</Button>
    {error ? <span role="alert">La copia falló, seleccione el texto para copiar.</span> : null}
    <pre className="max-h-96 overflow-auto whitespace-pre-wrap break-words rounded bg-muted/40 p-3 font-mono">{text || "(vacío)"}</pre>
  </details>;
}
