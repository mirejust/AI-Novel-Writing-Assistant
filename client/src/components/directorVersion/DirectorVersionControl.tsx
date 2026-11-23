import {useEffect, useState} from "react";
import {useMutation, useQuery, useQueryClient} from "@tanstack/react-query";
import {useNavigate} from "react-router-dom";
import type {DirectorVersion} from "@ai-novel/shared/types/director/version";
import {getNovelDirectorVersion, setNovelDirectorVersion} from "@/api/novel/directorVersion";
import {Button} from "@/components/ui/button";
import {Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle} from "@/components/ui/dialog";

export default function DirectorVersionControl({novelId, version}: {novelId: string; version?: DirectorVersion}) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<DirectorVersion | null>(null);
  const client = useQueryClient(), navigate = useNavigate();
  const query = useQuery({queryKey: ["novels", novelId, "director-version"], queryFn: () => getNovelDirectorVersion(novelId), enabled: Boolean(novelId), retry: false});
  const identity = query.data;
  useEffect(() => {
    if (version && identity && identity.version !== version) navigate(identity.sourceRoute, {replace: true});
  }, [version, identity, navigate]);
  const save = useMutation({mutationFn: () => {
    if (!identity || !selected) throw new Error("Lea primero la configuración del director de este libro." );
    return setNovelDirectorVersion(novelId, selected, identity.epoch);
  }, onSuccess: async result => {
    await client.invalidateQueries();
    setOpen(false);
    navigate(result.sourceRoute);
  }});
  return <>
    <Button variant="ghost" size="sm" onClick={() => {setSelected(identity?.version ?? version ?? null); setOpen(true); save.reset(); void query.refetch();}}>
      {identity?.version || version ? `director ${(identity?.version ?? version)!.toUpperCase()}` : "Versión del director"}
    </Button>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Versión del director de este libro.</DialogTitle><DialogDescription>Elija el proceso responsable de la creación de este libro. Después de cambiar, seleccione el alcance creativo en el banco de trabajo de destino; el texto guardado y el historial se conservarán.</DialogDescription></DialogHeader>
        {identity ? <div className="space-y-4">
          <label className="block space-y-2 text-sm"><span>Versión del director</span><select aria-label="Versión del director" className="h-10 w-full rounded-md border border-input bg-background px-3" value={selected ?? identity.version} disabled={!identity.canSwitch || save.isPending} onChange={event => setSelected(event.target.value as DirectorVersion)}>
            {identity.availableVersions.map(value => <option key={value} value={value}>{value === "v2" ? "Director V2 · Nuevo director" : "Director V1 · Director original"}</option>)}
            {!identity.availableVersions.includes(identity.version) ? <option value={identity.version}>Director V2 · No habilitado</option> : null}
          </select></label>
          <p className="text-xs leading-5 text-muted-foreground">Cada versión utiliza tareas y procesos de recuperación independientes. Después de cambiar, seleccione el alcance de creación en el banco de trabajo correspondiente; Las tareas históricas se conservan para su visualización.</p>
          {identity.blockedReason ? <p role="status" className="text-sm text-muted-foreground">{identity.blockedReason}</p> : null}
          <Button disabled={!identity.canSwitch || save.isPending || !selected || selected === identity.version} onClick={() => save.mutate()}>{save.isPending ? "Guardando…" : "Guarde y abra el banco de trabajo correspondiente."}</Button>
        </div> : <p className="text-sm text-muted-foreground">{query.isPending ? "Configuración del director del libro de lectura..." : "No se pudo leer la configuración del director del libro."}</p>}
        {query.isError ? <Button variant="ghost" onClick={() => void query.refetch()}>Releer</Button> : null}
        {save.isError ? <p role="alert" className="text-sm text-destructive">{save.error.message}</p> : null}
      </DialogContent>
    </Dialog>
  </>;
}
