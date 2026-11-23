import {VolumeSummaryText} from "./reading/VolumeSummaryEmphasis";
import type { Selection, WorkspaceBook } from "./model";
import { buildStoryDirectory, beatSelection, chapterSelection } from "./planning";
import { Button } from "@/components/ui/button";
import { AssetSection, SavedFields } from "./assets/sections";

export function PlanningDetail({book,selected,onSelect,onOpenChapterReview}: {
  book:WorkspaceBook;selected:Selection;onSelect:(item:Selection)=>void;onOpenChapterReview?:()=>void;
}) {
  const tree = buildStoryDirectory(book,book.planning);
  const group = tree.volumes.find(group => selected.kind === "volume" ? group.volume.id === selected.id
    : selected.kind === "beat" ? group.volume.id === selected.volumeId
    : group.chapters.some(row => selected.kind === "chapter" ? row.chapter?.id === selected.id : selected.kind === "plan" && row.plan?.id === selected.id));
  if (!group) return selected.kind === "chapter" && book.planning ? <p className="px-6 pb-4 text-xs text-muted-foreground">Este capítulo aún no tiene volúmenes ni secciones rítmicas asociados.</p> : null;
  const entry = group.chapters.find(row => selected.kind === "chapter" ? row.chapter?.id === selected.id : selected.kind === "plan" && row.plan?.id === selected.id);
  const beatGroup = group.beats.find(row => selected.kind === "beat" ? row.beat.key === selected.id : row.beat.key === entry?.plan?.beatKey);
  const beat = beatGroup?.beat;
  const compact = selected.kind === "chapter";
  const volume = group.volume;
  const chapters = selected.kind === "beat" ? beatGroup?.chapters ?? [] : group.chapters;
  const targets = entry?.plan;
  const notice = book.characterForwardPlanNotices?.find(item => item.planId === targets?.id);
  const reviewReady = !!notice && book.reviewContexts?.some(context => context.type === "chapter_task_sheet" && context.chapterId === notice.planId);
  const goal = <SavedFields lead fields={[["Objetivo de la trama",targets?.purpose],["Resumen del capítulo",targets?.summary],["Evento central",targets?.exclusiveEvent],["Estado final",targets?.endingState]]}/>;
  return <div className={`px-2 pb-5 [container-type:inline-size] sm:px-6 ${compact ? "mx-auto max-w-[42rem]" : "min-w-0"}`}>
    <nav aria-label="Propiedad de la historia" className="mb-4 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
      <button className="hover:text-primary focus-visible:underline" onClick={()=>onSelect({kind:"volume",id:volume.id})}>{volume.title}</button>
      {beat ? <><span>/</span><button className="hover:text-primary focus-visible:underline" onClick={()=>onSelect(beatSelection(volume.id,beat))}>{beat.title || beat.label}</button></> : entry ? <span>/ Sección rítmica a asociar</span> : null}
      {entry ? <span>/ No.{entry.plan?.chapterOrder}Cap.</span> : null}
    </nav>
    {notice ? <div className="mb-4 space-y-2 rounded-md bg-muted/40 p-3 text-sm">
      <p>Por comprobar · Se prevé que este capítulo incluya personajes ajustados.</p>
      {reviewReady && onOpenChapterReview ? <Button size="sm" variant="outline" onClick={onOpenChapterReview}>Ir al capítulo para confirmar</Button>
        : <p className="text-xs text-muted-foreground">Puede ver la disposición de este capítulo y editarlo mientras las tareas del capítulo están pendientes de confirmación.</p>}
    </div> : null}
    {compact ? targets ? <AssetSection title="Objetivos de este capítulo">{goal}</AssetSection> : null : <>
      <h2 className="mb-4 text-2xl font-semibold">{selected.kind === "volume" ? volume.title : selected.kind === "beat" ? beat?.title || beat?.label : targets?.title}</h2>
      {selected.kind === "volume" ? <>
        <SavedFields lead fields={[["Historia de este volumen.",volume.summary,<VolumeSummaryText id={volume.id} text={volume.summary}/>],["los lectores esperan",volume.mainPromise],["Presión principal",volume.primaryPressureSource]]}/>
        {volume.climax || volume.payoffType ? <AssetSection title="El clímax y la conclusión de este volumen."><SavedFields fields={[["El clímax de este volumen.",volume.climax],["Este volumen está canjeado.",volume.payoffType]]}/></AssetSection> : null}
        <h3 className="mt-5 text-sm font-medium">sección rítmica · {group.beats.length}</h3>
        {group.beats.map(({beat,chapters})=><button key={beat.key} onClick={()=>onSelect(beatSelection(volume.id,beat))} className="flex w-full justify-between gap-3 border-b border-border/30 py-3 text-left text-sm hover:text-primary"><span>{beat.title || beat.label}</span><span className="text-xs text-muted-foreground">{chapters.filter(row=>row.chapter?.content?.trim()).length}/{chapters.length} Los capítulos se pueden leer.</span></button>)}
        {!group.beats.length ? <p className="py-3 text-sm text-muted-foreground">Sección rítmica por planificar</p> : null}
      </> : selected.kind === "beat" ? <>
        <SavedFields lead fields={[["Dirección de la trama",beat?.summary],["Alcance del capítulo sugerido",beat?.chapterSpanHint]]}/>
        {beat?.mustDeliver.length ? <section className="py-3"><h3 className="mb-2 text-sm font-medium">Debe ser honrado</h3><ul className="list-disc space-y-2 pl-5">{beat.mustDeliver.map((item,index)=><li key={index} className="leading-7">{item}</li>)}</ul></section> : null}
      </> : <><p className="mb-3 text-sm text-muted-foreground">Planificación del capítulo · Texto a redactar</p>{goal}{targets?.taskSheet ? <AssetSection title="Declaración de misión"><p className="max-w-[46em] whitespace-pre-wrap break-words text-sm leading-7">{targets.taskSheet}</p></AssetSection> : null}</>}
      {selected.kind !== "plan" ? <section className="mt-5"><h3 className="text-sm font-medium">Capítulo</h3>{chapters.map(row=><button key={row.plan?.id} onClick={()=>onSelect(chapterSelection(row))} className="flex w-full items-center justify-between gap-3 border-b border-border/30 py-3 text-left text-sm hover:text-primary"><span>Cap.{row.plan?.chapterOrder}capítulo · {row.chapter?.title ?? row.plan?.title}</span><span className="shrink-0 text-xs text-muted-foreground">{row.chapter?.content?.trim() ? "Legible" : "Texto pendiente"}</span></button>)}{!chapters.length ? <p className="py-3 text-sm text-muted-foreground">Aún no hay plan de capítulo</p> : null}</section> : null}
    </>}
  </div>;
}
