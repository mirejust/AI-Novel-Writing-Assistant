import {VolumeSummaryText} from "./reading/VolumeSummaryEmphasis";
import {parseChapterScenePlan} from "@ai-novel/shared/types/chapterLengthControl";
import type {SavedReview} from "./review";
import {readableChapter, type WorkspaceBook} from "./model";
import {ReadingDisplaySettings, readingTextStyle, type ReadingDisplayPreferences} from "./reading";
import {OutlinePreparationReview} from "./OutlinePreparationReview";
import {Button} from "@/components/ui/button";
import {AssetSection, SavedFields} from "./assets/sections";

function Field({label,value}:{label:string;value?:string|number|null}) {
  return value != null && value !== "" ? <section className="py-2"><h3 className="mb-1 text-sm font-semibold">{label}</h3><p className="whitespace-pre-wrap break-words text-sm leading-7 text-foreground/80">{value}</p></section> : null;
}
function Scenes({value,targetWordCount}:{value?:string|null;targetWordCount?:number|null}) {
  const plan=parseChapterScenePlan(value,{targetWordCount});
  if (!plan) return <Field label="Arreglo de escena" value={value}/>;
  return <section className="py-3"><h3 className="text-sm font-medium">Disposición de escena · {plan.scenes.length} Campo</h3>{plan.scenes.map((scene,index)=><section key={scene.key} className="mt-4 border-t border-border/40 pt-4">
    <h4 className="font-medium">{index+1}. {scene.title}</h4>
    <Field label="Objetivo de la escena" value={scene.purpose}/><Field label="Debe avanzar" value={scene.mustAdvance.join("\n")}/><Field label="Contenido reservado" value={scene.mustPreserve.join("\n")}/>
    <Field label="Estado de admisión" value={scene.entryState}/><Field label="Estado de salida" value={scene.exitState}/><Field label="Resistencia" value={scene.resistance}/><Field label="Punto de inflexión" value={scene.turn}/><Field label="Cambios de humor" value={scene.emotionalShift}/><Field label="Ganancias de lectores" value={scene.readerValue}/><Field label="Evitar la extensión" value={scene.forbiddenExpansion.join("\n")}/><Field label="Palabras objetivo" value={scene.targetWordCount}/>
  </section>)}</section>;
}

export function ReviewDetail({book,review,readingDisplay,onReadingDisplayChange,onOpenChapter,onEditChapter}:{book:WorkspaceBook;review:SavedReview;readingDisplay:ReadingDisplayPreferences;onReadingDisplayChange:(next:ReadingDisplayPreferences)=>void;onOpenChapter?:(chapterId:string)=>void;onEditChapter?:(chapterId:string)=>void}) {
  const reviewPlans = review.plans ?? (review.plan ? [review.plan] : []);
  const latest = onOpenChapter && !review.chapters?.length
    ? book.chapters.filter(readableChapter).sort((a,b)=>b.order-a.order)[0] : undefined;
  return <article className="mx-auto max-w-[42rem] px-2 pb-8 sm:px-6" aria-label="El resultado de esta etapa de creación.">
    <p className="mb-3 text-xs text-muted-foreground">Ver los resultados de esta etapa</p>
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <h2 className="text-2xl font-semibold">{review.label}</h2>
      {latest ? <Button size="sm" variant="outline" onClick={()=>onOpenChapter?.(latest.id)}>Ver el último texto (No. {latest.order} Capítulo)</Button> : null}
      {review.chapters?.length ? <ReadingDisplaySettings preferences={readingDisplay} onChange={onReadingDisplayChange} previewText={review.chapters[0].content}/> : null}
    </div>
    {review.error ? <p role="alert" className="text-sm text-destructive">{review.error}</p> : review.notice ? <p role="status" className="text-sm leading-6 text-muted-foreground">{review.notice}</p> : <>
      <OutlinePreparationReview book={book} review={review}/>
      {reviewPlans.map((chapter,index) => <details open={index===0} key={chapter.id} className="border-t border-border/40 py-3">
        <summary className="cursor-pointer text-lg font-medium">Cap. {chapter.chapterOrder} capítulo · {chapter.title}</summary>
        <div className="py-4"><SavedFields lead fields={[["Objetivo de la trama",chapter.purpose],["Resumen del capítulo",chapter.summary],["Evento central",chapter.exclusiveEvent],["Estado final",chapter.endingState]]}/></div>
        <Field label="Tareas del capítulo" value={chapter.taskSheet}/><Field label="Palabras objetivo" value={chapter.targetWordCount}/><Field label="Necesidad de evitar" value={chapter.mustAvoid}/>
        <Scenes value={chapter.sceneCards} targetWordCount={chapter.targetWordCount}/><Field label="Convención de escritura" value={chapter.styleContract}/>
      </details>)}
      {review.executions?.map((execution,index) => <details open={index===0} key={execution.id} className="border-t border-border/40 py-3">
        <summary className="cursor-pointer text-lg font-medium">Cap. {execution.order} capítulo · {execution.title}</summary>
        <Field label="Tareas del capítulo" value={execution.taskSheet}/><Field label="Palabras objetivo" value={execution.targetWordCount}/><Field label="Necesidad de evitar" value={execution.mustAvoid}/><Scenes value={execution.sceneCards} targetWordCount={execution.targetWordCount}/>
      </details>)}
      {review.type === "character_cast" ? book.materials.characters.map(person=><section key={person.id} className="border-t border-border/40 py-4"><h3 className="text-lg font-medium">{person.name}</h3><Field label="Identidad de rol" value={person.role}/><Field label="Configuración de personajes" value={person.personality}/><Field label="Función en la historia" value={person.storyFunction}/><Field label="Objetivo de acción" value={person.currentGoal}/></section>) : null}
      {review.type === "volume_strategy" ? <>
        {book.planning?.strategyPlan ? <AssetSection title="Las ideas de avance del libro." open={!book.planning.volumes.length}>
          <SavedFields fields={[["Avance de las ganancias de lectores",book.planning.strategyPlan.readerRewardLadder],["Avance del conflicto",book.planning.strategyPlan.escalationLadder],["Cambios en la sección media",book.planning.strategyPlan.midpointShift],["Instrucciones de planificación",book.planning.strategyPlan.notes]]}/>
        </AssetSection> : null}
        {book.planning?.volumes.map(volume=><section key={volume.id} className="border-t border-border/40 py-4">
          <h3 className="mb-3 text-xl font-semibold">{volume.title}</h3>
          <SavedFields lead fields={[["Historia de este volumen.",volume.summary,<VolumeSummaryText id={volume.id} text={volume.summary}/>],["los lectores esperan",volume.mainPromise],["Presión principal",volume.primaryPressureSource]]}/>
          <AssetSection title="Avance y conclusión de este volumen."><SavedFields fields={[["Punto de partida",volume.openingHook],["Aspectos destacados de este volumen",volume.coreSellingPoint],["Método de propulsión",volume.escalationMode],["Cambios de protagonista",volume.protagonistChange],["Riesgo de rango medio",volume.midVolumeRisk],["El clímax de este volumen.",volume.climax],["Este volumen está canjeado.",volume.payoffType],["Rollo de plomo",volume.nextVolumeHook],["Empezar de nuevo",volume.resetPoint],["Contenido a canjear",volume.openPayoffs?.join("\n")]]}/></AssetSection>
        </section>)}
      </> : null}
      {review.chapters?.map(row=><section key={row.id} className="border-t border-border/40 py-5"><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><h3 className="text-lg font-medium">Cap. {row.order} capítulo · {row.title}</h3>{onEditChapter ? <Button size="sm" variant="outline" onClick={()=>onEditChapter(row.id)}>Editar texto</Button> : null}</div><p className="whitespace-pre-wrap break-words leading-[2.15] tracking-wide text-foreground/90" style={readingTextStyle(readingDisplay)}>{row.content}</p></section>)}
    </>}
  </article>;
}
