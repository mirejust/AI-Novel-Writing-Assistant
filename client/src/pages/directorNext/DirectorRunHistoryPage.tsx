import {InvocationUsageList} from "@/components/directorNext/usage";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { listDirectorRuns, listLegacyDirectorRuns } from "@/api/directorNext";
import { queryKeys } from "@/api/queryKeys";
import { Button } from "@/components/ui/button";
import {directorPollInterval} from "./polling";

export default function DirectorRunHistoryPage() {
  const [needsAttention, setNeedsAttention] = useState(false);
  const query = useQuery({ queryKey: queryKeys.directorNext.runs(needsAttention), queryFn: () => listDirectorRuns({ needsAttention, limit: 50 }), retry: false, refetchInterval: state => directorPollInterval(state.state.error,state.state.errorUpdateCount) });
  const legacy = useQuery({queryKey:["legacyDirectorHistory"],queryFn:listLegacyDirectorRuns,retry:false});
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="flex flex-wrap justify-between gap-4 border-b border-border/60 pb-5">
        <div><h1 className="text-2xl font-semibold">Historial del director</h1><p className="mt-2 text-sm text-muted-foreground">Verifique el progreso de la creación y las excepciones, y abra el escritorio del director de novelas correspondiente para realizar el siguiente paso.</p></div>
        <Button asChild variant="outline"><Link to="/lab/director/preview">Ver vista previa del estado</Link></Button>
      </header>
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={needsAttention} onChange={(event) => setNeedsAttention(event.target.checked)} />Solo vea lo que necesita ser procesado</label>
        <Button variant="ghost" disabled={query.isFetching} onClick={() => void query.refetch()}>Actualizar registro</Button>
      </div>
      {query.data?.warnings?.length ? <p role="status" className="text-sm text-muted-foreground">tener {query.data.warnings.length} Los registros de creatividades no se pueden leer temporalmente, pero aún se pueden ver otros registros.</p> : null}
      {query.isLoading ? <p className="text-sm text-muted-foreground">Leyendo registros de ejecución...</p> : query.isError ? <p role="alert" className="text-sm text-destructive">{query.error instanceof Error ? query.error.message : "No se pudo leer, por favor lea de nuevo."}</p> : !query.data?.data?.length ? <p className="py-8 text-sm text-muted-foreground">No hay registros de creatividades que califiquen.</p> : (
        <ul className="divide-y divide-border/60">{query.data.data.map((record) => <li key={record.runId} className="flex flex-wrap items-start justify-between gap-4 py-5"><div className="min-w-0 flex-1"><p className="text-xs text-muted-foreground">{record.statusLabel} · {record.progressLabel}</p><p className="mt-1 text-sm font-medium">{record.headline}</p>{record.detail ? <p className="mt-2 text-sm text-muted-foreground">{record.detail}</p> : null}<InvocationUsageList runId={record.runId}/></div><Button asChild variant="ghost" size="sm"><Link to={record.directorRoute}>Abre el escritorio del director de novelas.</Link></Button></li>)}</ul>
      )}
      {!needsAttention && legacy.data?.data?.length ? <section className="border-t border-border/60 pt-5"><h2 className="text-sm font-semibold">Creación histórica</h2><ul className="divide-y divide-border/50">{legacy.data.data.map(record=><li key={record.runId} className="flex items-center justify-between gap-3 py-4"><div><p className="text-xs text-muted-foreground">{record.statusLabel} · {record.progressLabel}</p><p className="mt-1 text-sm">{record.headline}</p></div><Button asChild variant="ghost" size="sm"><Link to={record.sourceRoute}>Novela abierta</Link></Button></li>)}</ul></section>:null}
    </div>
  );
}
