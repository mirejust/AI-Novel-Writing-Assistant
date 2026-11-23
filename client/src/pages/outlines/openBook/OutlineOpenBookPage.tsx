import { BeatList } from "../workspace/volumeRhythm/BeatList";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { outlineOpenBookInputSchema, type OutlineOpenBookInput } from "@ai-novel/shared/types/outlineOpenBook";
import { createOutlineOpenBook, getOutline, getOutlineBookBinding, getOutlineRevision, listOutlineRevisions, previewOutlineOpenBook } from "@/api/outlines";
import { createDirectorCommandKey } from "@/api/directorNext";
import { Button } from "@/components/ui/button";
import { useIsMobileViewport } from "@/components/layout/mobile/useIsMobileViewport";
import { OutlinePreservationDetails } from "@/components/outlines/OutlinePreservationDetails";
import { findOutlineNodeTitle } from "../outlineNodes";
import { suggestedChapterCount, suggestVolumeQuotas } from "./model";
import { presentOutlineOpenBookError } from "./errorPresentation";

export default function OutlineOpenBookPage() {
  const { id = "" } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const isMobileViewport = useIsMobileViewport();
  const outline = useQuery({ queryKey: ["outline", id], queryFn: () => getOutline(id), enabled: !!id });
  const revisions = useQuery({ queryKey: ["outline-revisions", id], queryFn: () => listOutlineRevisions(id), enabled: !!id });
  const binding = useQuery({ queryKey: ["outline-book-binding", id], queryFn: () => getOutlineBookBinding(id), enabled: !!id });
  const revisionId = searchParams.get("revisionId") ?? revisions.data?.find(item=>item.version===outline.data?.currentVersion)?.id ?? "";
  const revision = revisions.data?.find(item => item.id === revisionId);
  const revisionDetail = useQuery({ queryKey: ["outline-revision", id, revisionId], queryFn: () => getOutlineRevision(id, revisionId), enabled: !!id && !!revisionId && !binding.data });
  const document = revisionDetail.data?.document;
  const currentVersion = outline.data?.currentVersion ?? 0;
  const [title, setTitle] = useState("");
  const [count, setCount] = useState(80);
  const [length, setLength] = useState(3000);
  const [quotas, setQuotas] = useState<Record<string, number>>({});
  const [confirmed, setConfirmed] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  useEffect(() => {
    if (!document) return;
    const total=suggestedChapterCount(document);
    setTitle(document.story.title || outline.data?.title || ""); setCount(total); setQuotas(suggestVolumeQuotas(document,total));
  }, [revisionDetail.data?.id]);
  const request = useMemo<OutlineOpenBookInput>(()=>({revisionId,expectedProjectVersion:currentVersion,
    bookSettings:{title:title.trim(),estimatedChapterCount:count,defaultChapterLength:length},volumeQuotas:quotas,allowOptimize:[]}),[revisionId,currentVersion,title,count,length,quotas]);
  const requestKey=JSON.stringify(request);
  const creation=useRef<{hash:string;key:string}|null>(null);
  const preview = useMutation({ mutationFn: (input:OutlineOpenBookInput) => previewOutlineOpenBook(id,input) });
  const matches=!!preview.data && JSON.stringify(preview.variables)===requestKey;
  useEffect(()=>{setConfirmed(false);creation.current=null;},[requestKey]);
  const create = useMutation({mutationFn:()=>{
    if (!matches || !confirmed) throw new Error("Primero verifique esta vista previa y confirme la cantidad de capítulos y el contenido reservado.");
    const hash=preview.data!.requestHash;
    if (creation.current?.hash!==hash) creation.current={hash,key:createDirectorCommandKey()};
    return createOutlineOpenBook(id,{...preview.variables!,requestHash:hash,idempotencyKey:creation.current!.key});
  },onSuccess:result=>navigate(result.sourceRoute)});
  const back=<Button asChild variant="ghost"><Link to={`/outlines/${id}`}>Volver al esquema</Link></Button>;
  if (isMobileViewport) return <section className="mx-auto max-w-xl space-y-3 py-8"><h1 className="text-xl font-semibold">Confirme el esquema y abra el libro en la computadora.</h1><p className="text-sm text-muted-foreground">La novela encuadernada se puede continuar desde el banco de trabajo de creación.</p>{back}</section>;
  if (outline.isLoading || revisions.isLoading || binding.isLoading) return <p className="py-8 text-sm text-muted-foreground">Leyendo la fuente del esquema y la información vinculante...</p>;
  if (binding.isError || outline.isError || revisions.isError) return <section className="space-y-3"><p role="alert" className="text-sm text-destructive">No se puede confirmar la fuente del resumen y la información vinculante, lea de nuevo.</p><Button variant="secondary" onClick={()=>void Promise.all([outline.refetch(),revisions.refetch(),binding.refetch()])}>Releer</Button>{back}</section>;
  // Resolve an existing binding before validating a revision deep-link: never offer a second book.
  if (binding.data) return <main className="mx-auto max-w-3xl space-y-5 py-8">{back}<h1 className="text-2xl font-semibold">Continúa este libro</h1><p>{binding.data.title} · Adoptar la revisión del plan de estudios v{binding.data.revisionVersion}</p><p className="text-sm text-muted-foreground">Un esquema sólo encuaderna un libro. Las nuevas revisiones de un esquema separado no reemplazan automáticamente la fuente de este libro.</p><Button asChild><Link to={binding.data.sourceRoute}>Abra el banco de trabajo creativo</Link></Button></main>;
  if (outline.data?.boundNovelId) return <section className="space-y-3"><p role="alert">La información vinculante del esquema está incompleta; regrese a la fuente para verificarla; la novela no será recreada.</p>{back}</section>;
  if (revisionDetail.isLoading) return <p className="py-8 text-sm text-muted-foreground">Leyendo la revisión del programa de estudios seleccionado...</p>;
  if (!revision || revisionDetail.isError || !document) return <section className="space-y-3"><p role="alert" className="text-sm text-destructive">No se puede encontrar esta revisión del programa de estudios; seleccione una nueva versión.</p>{back}</section>;
  const unsaved=revision.version===currentVersion && !!outline.data?.document && JSON.stringify(outline.data.document)!==JSON.stringify(document);
  const quotaTotal=Object.values(quotas).reduce((sum,value)=>sum+value,0);
  const valid=outlineOpenBookInputSchema.safeParse(request).success && (!document.volumes.length || quotaTotal===count);
  const error=create.error ?? preview.error;
  const checked=matches ? preview.data : undefined;
  const shownError=error ? presentOutlineOpenBookError(error.message,document) : null;
  return <main className="mx-auto flex h-full min-h-0 w-full max-w-6xl flex-col gap-4" aria-label="Vista previa del libro abierto según el esquema">
    <header className="flex shrink-0 items-start justify-between gap-4 border-b border-border/50 pb-4"><div><p className="text-xs text-muted-foreground">describir / {outline.data?.title}</p><h1 className="mt-1 text-2xl font-semibold">Lleva este esquema a la escritura de novelas.</h1><p className="mt-2 text-sm text-muted-foreground">Fuente: revisión v{revision.version}{revision.version!==currentVersion ? ` · Actualmente v${currentVersion}, esta vez solo se utilizará la versión seleccionada` : " · Utilice sólo esta versión"};No se incluyen sugerencias pendientes.</p></div>{back}</header>
    <div className="grid min-h-0 flex-1 gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section className="min-h-0 min-w-0 space-y-6 overflow-y-auto overscroll-contain pr-2">
          <section className="space-y-4"><h2 className="text-lg font-semibold">Entorno de trabajo</h2>
            <label className="block space-y-1.5"><span className="text-sm">Título del libro</span><input className="h-10 w-full rounded-md border border-input bg-background px-3" value={title} onChange={event=>setTitle(event.target.value)}/></label>
            <div className="grid grid-cols-2 gap-4"><label className="space-y-1.5 text-sm"><span className="block">Número objetivo de capítulos</span><input aria-label="Número objetivo de capítulos" className="h-10 w-full rounded-md border border-input bg-background px-3" type="number" min={1} max={2000} value={count} onChange={event=>{const total=Number(event.target.value);setCount(total);setQuotas(suggestVolumeQuotas(document,total));}}/></label><label className="space-y-1.5 text-sm"><span className="block">¿Cuántas palabras hay en cada capítulo?</span><input aria-label="¿Cuántas palabras hay en cada capítulo?" className="h-10 w-full rounded-md border border-input bg-background px-3" type="number" min={500} max={10000} value={length} onChange={event=>setLength(Number(event.target.value))}/></label></div>
          </section>
          {document.volumes.length ? <section className="space-y-3 border-t border-border/50 pt-5"><h2 className="text-lg font-semibold">Asignación de espacio</h2><p className="text-xs leading-6 text-muted-foreground">Este es un presupuesto de capítulo ajustable que no crea capítulos vacíos para ubicaciones no expandidas. El total debe ser {count} Capítulo.</p>{[...document.volumes].sort((a,b)=>a.order-b.order).map(volume=><label key={volume.nodeId} className="flex items-center justify-between gap-4 text-sm"><span className="min-w-0 break-words">{volume.title || "Volumen sin nombre"}<span className="ml-2 text-xs text-muted-foreground">{volume.planningDepth==="rough" ? "Esquema aproximado" : "Esquema detallado"}</span></span><input aria-label={`${volume.title}Número estimado de capítulos`} className="h-9 w-24 shrink-0 rounded-md border border-input bg-background px-2 text-right tabular-nums" type="number" min={Math.max(1,document.chapters.filter(chapter=>chapter.volumeNodeId===volume.nodeId).length)} max={count} value={quotas[volume.nodeId] ?? 0} onChange={event=>setQuotas(current=>({...current,[volume.nodeId]:Number(event.target.value)}))}/></label>)}{quotaTotal!==count ? <p role="alert" className="text-sm text-destructive">Total de trabajos {quotaTotal} Capítulo, por favor ajuste a {count} Capítulo.</p> : null}</section> : null}
          <section className="space-y-3 border-t border-border/50 pt-5"><h2 className="text-lg font-semibold">que conservar</h2><p className="text-sm leading-6 text-muted-foreground">Mantenga el contenido completado en el esquema; Los campos en blanco se pueden completar y las configuraciones fijas que no se pueden violar siempre restringen la escritura.</p>{document.facts.filter(fact=>fact.immutable).map(fact=><p key={fact.nodeId} className="text-sm leading-6"><strong>{fact.title}:</strong>{fact.content}</p>)}<Button variant="ghost" size="sm" onClick={()=>setShowDetails(value=>!value)} aria-expanded={showDetails}>{showDetails ? "Contraer detalles de retención" : "Ampliar detalles de retención"}</Button>{showDetails ? checked ? <OutlinePreservationDetails policy={checked.policy} document={document}/> : <p className="text-sm text-muted-foreground">Primero verifique el contenido del libro de apertura y vea los detalles de retención campo por campo.</p> : null}</section>
          <section className="space-y-3 border-t border-border/50 py-5"><h2 className="text-lg font-semibold">Que agregar</h2><p className="text-sm leading-6 text-muted-foreground">Mantenga el esquema a largo plazo y organice los capítulos más cerca de escribirlos. Después de abrir el libro, primero confirme cada etapa de preparación y luego autorice claramente el texto de un solo capítulo.</p><p className="text-xs text-muted-foreground">Las modificaciones locales no guardadas y las sugerencias de IA que se adoptarán no se incluirán en la apertura de este libro.</p></section>
        </section>
        <aside className="min-h-0 space-y-4 overflow-y-auto overscroll-contain rounded-lg bg-muted/30 p-5" aria-label="este traspaso"><h2 className="text-lg font-semibold">este traspaso</h2>{checked ? <>
          <p className="text-sm leading-7">{checked.counts.volumes} Volumen · {checked.counts.chapters} ya hay capitulos<br/>{checked.counts.characters} borrador de personaje · {checked.counts.payoffs} Un plan presagio</p>
          <div className="space-y-3 border-t border-border/50 pt-4"><h3 className="text-sm font-medium">Número de capítulos de cada volumen y prefacio del capítulo del libro.</h3>{checked.mapping.volumes.map(volume=>{
            const source = document.volumes.find(v=>v.nodeId===volume.nodeId);
            return <section key={volume.nodeId} className="text-sm"><p className="font-medium">{findOutlineNodeTitle(document,volume.nodeId)}</p><p className="mt-1 tabular-nums text-muted-foreground">esperado {volume.chapterQuota} Capítulo · Capítulo {volume.from}–{volume.to} Cap.</p>{source?.beats
            ? <BeatList beats={source.beats} chapters={document.chapters.filter(c=>c.volumeNodeId===volume.nodeId)}/>
            : <p className="text-xs text-muted-foreground">El ritmo dentro del volumen se puede completar durante la preparación para abrir el libro.</p>}{checked.mapping.chapters.filter(chapter=>chapter.volumeId===volume.volumeId).map(chapter=><p key={chapter.nodeId} className="mt-1 text-xs leading-6 text-muted-foreground">Cap. {chapter.chapterOrder} capítulo · {findOutlineNodeTitle(document,chapter.nodeId)}</p>)}</section>;})}</div>
          <p className="text-xs leading-6 text-muted-foreground">Cree únicamente los capítulos existentes mencionados anteriormente; sólo mantener el presupuesto en posiciones no ampliadas. El presagio se muestra como un plan, y el libro de contabilidad real sólo puede vincularse después de que haya evidencia textual.</p>
          {checked.warnings.map((warning,index)=><p key={index} className="text-sm leading-6 text-warning">{warning}</p>)}
          <label className="flex cursor-pointer items-start gap-2 border-t border-border/50 pt-4 text-sm leading-6"><input type="checkbox" className="mt-1 shrink-0 accent-primary" checked={confirmed} onChange={event=>setConfirmed(event.target.checked)}/><span>Confirme la cantidad de capítulos en cada volumen, el rango de orden de los capítulos y el contenido retenido, y use solo la revisión v{checked.revisionVersion}</span></label>
        </> : <p className="text-sm leading-7 text-muted-foreground">Después de verificar el entorno de trabajo y la asignación de espacio, consulte el contenido de este libro de apertura.</p>}</aside>
    </div>
    {unsaved ? <p role="alert" className="shrink-0 text-sm text-warning">El banco de trabajo tiene cambios no guardados. Vuelva al esquema y guárdelo antes de abrir el libro.</p> : null}
    {shownError ? <div role="alert" className="flex shrink-0 flex-wrap items-center gap-2 text-sm text-destructive"><span>{shownError.message}</span>{shownError.nodeId ? <Button asChild variant="ghost" size="sm"><Link to={`/outlines/${id}?nodeId=${encodeURIComponent(shownError.nodeId)}`}>Devolver"{shownError.nodeTitle}"editar</Link></Button> : null}<Button variant="ghost" size="sm" onClick={()=>void Promise.all([binding.refetch(),outline.refetch(),revisions.refetch()])}>Vuelva a verificar las fuentes y los enlaces</Button>{back}</div> : null}
    <footer className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-border/50 pt-3"><p className="max-w-md text-xs leading-6 text-muted-foreground">Después de la creación, puede ver y confirmar la preparación para la escritura. El modelo no se llamará automáticamente ni se generará el texto.</p><div className="flex gap-2"><Button variant="secondary" onClick={()=>{setConfirmed(false);preview.mutate(request);}} disabled={!valid || unsaved || preview.isPending || create.isPending}>{preview.isPending ? "De cheques…" : "Consulta el contenido del libro de apertura."}</Button><Button onClick={()=>create.mutate()} disabled={!matches || !confirmed || unsaved || create.isPending}>{create.isPending ? "Creando…" : "Crear una novela y ver la preparación."}</Button></div></footer>
  </main>;
}
