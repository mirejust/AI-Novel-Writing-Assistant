import {useQuery} from "@tanstack/react-query";
import type {VolumePlanDocument} from "@ai-novel/shared/types/novel";
import {getDirectorCharacterAppearances} from "@/api/directorNext";
import {Button} from "@/components/ui/button";
import {appearanceDestination, appearanceLabels, projectAppearanceRows, summarizeAppearances, visibleAppearances, type AppearanceBoundary, type AppearanceRow, type AppearanceDestination} from "./appearanceModel";
import {AppearanceTimeline} from "./AppearanceTimeline";
import type { CharacterForwardPlanNotice } from "@ai-novel/shared/types/characterForwardAdjustment";

const chapterLabel = (order: number | null) => order === null ? "Aún no hay registro" : `Cap. ${order}`;

export function AppearanceList({rows, boundary, onSelect, reviewOrders}: {
  rows: AppearanceRow[]; boundary: AppearanceBoundary; onSelect: (target:AppearanceDestination)=>void;
  reviewOrders?: ReadonlySet<number>;
}) {
  if (boundary === null) return <p className="text-sm text-muted-foreground">Seleccione un capítulo para leer o cambie a "Último estado" para ver el registro completo de aparición del libro.</p>;
  const stats = summarizeAppearances(rows, boundary);
  const visible = visibleAppearances(rows, boundary);
  const recorded = visible.filter(row => row.events.length > 0);
  const planned = visible.filter(row => row.planned);
  const unknown = visible.filter(row => row.coverage === "untracked").length;
  const pending = visible.filter(row => row.chapterId === null && !row.planSource).length;
  const awaitingProse = visible.length > 0 && visible.every(row=>row.coverage === "unwritten");
  return <div className="min-w-0 space-y-4 text-sm leading-6">
    <dl className="flex flex-wrap gap-x-6 gap-y-2">
      <div><dt className="text-muted-foreground">Primera aparición registrada</dt><dd>{chapterLabel(stats.first)}</dd></div>
      <div><dt className="text-muted-foreground">Apariciones recientes</dt><dd>{chapterLabel(stats.last)}</dd></div>
      <div><dt className="text-muted-foreground">Número real de capítulos reproducidos.</dt><dd>{awaitingProse ? "Esperando que se genere texto" : `${stats.count}`}</dd></div>
    </dl>
    {pending > 0 ? <p className="text-sm text-muted-foreground">Para este ámbito se ha guardado un plan capitular, en el que {pending} Se generará el calendario de apariciones del personaje de Zhang. Al iniciar la creación del capítulo correspondiente, primero se prepararán las tareas del capítulo; el registro de apariencia real se establecerá sólo después de que se guarde y organice el texto final.</p> : null}
    <AppearanceTimeline key={String(boundary)} rows={rows} boundary={boundary} onSelect={onSelect} reviewOrders={reviewOrders}/>
    <div><h4 className="font-medium">Capítulo de apariencia planificada</h4>
      <p className="text-xs text-muted-foreground">Según la disposición preliminar de los capítulos y la disposición detallada de las tareas; Se da prioridad a las tareas detalladas y se utilizan registros de texto para verificar las apariencias reales.</p>
      {planned.length ? <div className="mt-2 flex flex-wrap gap-1">{planned.map(row=><Button key={appearanceDestination(row).id} size="sm" variant="ghost" onClick={()=>onSelect(appearanceDestination(row))}>Cap. {row.chapterOrder} Cap.{reviewOrders?.has(row.chapterOrder) ? " · Por verificar" : ""}</Button>)}</div>
        : <p className="mt-2 text-muted-foreground">{pending > 0 ? "Los arreglos de apariencia de los personajes se completarán después de que se generen las misiones del capítulo." : "No existe una disposición de apariencia clara para esta gama."}</p>}
    </div>
    {stats.missed.length > 0 ? <p className="text-muted-foreground">Cap. {stats.missed.join(",")} Zhang planea aparecer, pero la aparición real no ha sido confirmada en el registro de texto. Puedes consultar el arreglo; este recordatorio no suspenderá la creación.</p> : null}
    {unknown > 0 ? <p className="text-xs text-muted-foreground">{unknown} Los capítulos que carezcan de un registro completo de apariciones en la versión de texto vigente no se computarán como ausencias.</p> : null}
    {recorded.length ? <ol className="divide-y divide-border/40">{recorded.map(row=><li key={appearanceDestination(row).id} className="space-y-2 py-3">
      <Button variant="ghost" size="sm" className="-ml-3" onClick={()=>onSelect(appearanceDestination(row))}>Cap. {row.chapterOrder} capítulo · {row.chapterTitle}</Button>
      {row.events.map(event=><div key={event.kind} className="space-y-1"><p><span className="mr-2 text-xs text-muted-foreground">{appearanceLabels[event.kind]}</span>{event.summary}</p>
        <details className="text-xs text-muted-foreground"><summary className="cursor-pointer">Base del texto</summary><p className="mt-1 whitespace-pre-wrap">{event.evidence}</p></details></div>)}
    </li>)}</ol> : <p className="text-muted-foreground">Actualmente no hay registros de apariencia de personajes verificados en este rango.</p>}
  </div>;
}

export function CharacterAppearances({novelId, characterId, boundary, onSelect, planning, preview=false, notices}: {
  novelId: string; characterId: string; boundary: AppearanceBoundary; onSelect: (target:AppearanceDestination)=>void; planning?:VolumePlanDocument; preview?:boolean;
  notices?: CharacterForwardPlanNotice[];
}) {
  const query = useQuery({queryKey: ["director-character-appearances", novelId, characterId],
    queryFn: ()=>getDirectorCharacterAppearances(novelId,characterId), enabled: !preview, retry:false, refetchInterval:10000});
  return <section className="min-w-0 space-y-3 py-5"><h3 className="text-sm font-semibold">Línea de tiempo de aparición del personaje</h3>
    {query.isError ? <p role="alert" className="text-sm text-destructive">No se pudo leer el registro de apariencia.<Button variant="ghost" size="sm" onClick={()=>void query.refetch()}>Releer</Button></p>
      : query.isLoading && !preview ? <p className="text-sm text-muted-foreground">Leyendo registros de apariencia...</p>
      : <AppearanceList key={characterId} rows={projectAppearanceRows(query.data?.data?.chapters ?? [],planning,characterId)} boundary={boundary} onSelect={onSelect}
        reviewOrders={new Set(notices?.filter(notice => notice.characterIds.includes(characterId)).map(notice => notice.chapterOrder))}/>}
  </section>;
}
