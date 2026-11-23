import { useState } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { getDirectorUsage } from "@/api/directorNext";
import { formatCacheTokens } from "@/components/liveExecution/usage/presentation";
import { Button } from "@/components/ui/button";
import { Activity } from "lucide-react";
import PanelDisclosure from "../panel/PanelDisclosure";
export function InvocationUsageList({ runId, active = false }: {
    runId: string;
    active?: boolean;
}) {
    const [open, setOpen] = useState(false);
    const query = useInfiniteQuery({ queryKey: ["directorInvocationUsage", runId], initialPageParam: undefined as string | undefined,
        queryFn: ({ pageParam }) => getDirectorUsage(runId, { cursor: pageParam }), getNextPageParam: last => last.data?.nextCursor ?? undefined,
        enabled: open, retry: false, refetchInterval: open && active ? 5000 : false });
    const summary = query.data?.pages[0]?.data?.recordedSummary;
    const items = query.data?.pages.flatMap(p => p.data?.items ?? []) ?? [];
    return <PanelDisclosure title="Uso de llamadas" icon={Activity} onOpenChange={setOpen}>
 {open ? <div className="space-y-3 text-xs">
 {query.isPending ? <p className="text-muted-foreground">Leyendo el uso de llamadas...</p> : query.isError ? <p className="text-muted-foreground">El uso de llamadas no se puede leer en este momento.<button className="ml-2 underline" onClick={() => void query.refetch()}>Releer</button></p> : <>
 {summary ? <><p>Tokens de aciertos de caché {formatCacheTokens(summary.inputCache.cacheHitTokens, "completed", summary.inputCache.cacheUsageStatus)}</p>
 <p>Tokens perdidos en caché {formatCacheTokens(summary.inputCache.cacheMissTokens, "completed", summary.inputCache.cacheUsageStatus)}</p>
 <p className="text-muted-foreground">Grabado {summary.recordedCallCount} Llamadas{summary.unknownCallCount + summary.invalidCallCount + summary.partialCallCount > 0 ? ", algunas llamadas no proporcionan estadísticas completas." : "."}El uso de la caché no se registra para las llamadas históricas.</p></> : null}
 {!items.length ? <p className="text-muted-foreground">No existe ningún registro de uso para esta creación.</p> : <ul className="divide-y divide-border/50">{items.map(item => <li key={item.invocationId} className="space-y-1 py-3">
 <p>{new Date(item.startedAt).toLocaleString()} · {item.stage ?? "Crear"}</p>
 <p className="break-words text-muted-foreground">{item.provider ?? "Fabricante no registrado"} · {item.model ?? "Modelo no documentado"} · {item.status === "completed" ? "Llamada completada" : item.status === "partial" ? "Devolución parcial" : "Llamada fallida"}</p>
 <p>Tokens de aciertos de caché {formatCacheTokens(item.inputCache.cacheHitTokens, "completed", item.inputCache.cacheUsageStatus)}</p>
 <p>Tokens perdidos en caché {formatCacheTokens(item.inputCache.cacheMissTokens, "completed", item.inputCache.cacheUsageStatus)}</p>
 </li>)}</ul>}
 {query.hasNextPage ? <Button variant="ghost" size="sm" disabled={query.isFetchingNextPage} onClick={() => void query.fetchNextPage()}>Ver más llamadas</Button> : null}
 </>}
 </div> : null}</PanelDisclosure>;
}
