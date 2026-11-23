import type {VolumeChapterPlan} from "@ai-novel/shared/types/novel";
import type {WorkspaceBook, WorkspaceChapter} from "./model";

const labels: Record<string,string> = {story_macro:"Planificación de la historia",book_contract:"Acuerdo creativo",world_skeleton:"Ambientación del mundo",volume_beat_sheet:"Ritmo de este volumen.",volume_chapter_list:"Ruta capitular de este volumen",character_cast:"Reparto de personajes",volume_strategy:"Esquema",chapter_task_sheet:"Tareas y escenas del capítulo.",chapter_execution_contract:"Plan de ejecución de texto",chapter_batch_closed:"Texto de este lote"};
export interface SavedReview {
  type:string; label:string; ready:boolean; error?:string; notice?:string;
  canRegenerate?:boolean;
  runId?:string; controlVersion?:number;
  volumeId?:string;
  plan?:VolumeChapterPlan;
  plans?:VolumeChapterPlan[];
  executions?:WorkspaceBook["executionPlans"];
  chapters?:WorkspaceChapter[];
}

/** Navigation selects saved book assets, never derives a director state or authorization. */
export function resolveSavedReview(book:WorkspaceBook, params:URLSearchParams): SavedReview | null {
  const type=params.get("review");
  if (!type) return null;
  const result:SavedReview={type,label:labels[type] ?? "Resultados creativos",ready:false};
  const missing=()=>({...result,error:"Si no puede localizar los resultados completos de esta etapa, vuelva a leer este libro o regrese al escritorio del director para ver la entrada de confirmación."});
  if (book.reviewContextError) return {...result,error:book.reviewContextError};
  if (!labels[type]) return missing();
  const contexts=book.reviewContexts?.filter(row=>row.type===type) ?? [];
  if (!contexts.length) return {...result,notice:"No hay resultados pendientes en esta etapa. El contenido guardado se puede ver desde el catálogo de la izquierda y los siguientes pasos se pueden ver en la consola del director."};
  if (contexts.length!==1 || contexts[0].novelId!==book.novel.id) return missing();
  const context=contexts[0];
  result.runId=context.runId;result.controlVersion=context.controlVersion;
  if (type === "story_macro") return book.outlinePreparation?.storyMacro?.expansion && book.outlinePreparation.storyMacro.decomposition ? {...result,ready:true} : missing();
  if (type === "book_contract") return book.outlinePreparation?.hasBookContract ? {...result,ready:true} : missing();
  if (type === "world_skeleton") return book.materials.world || book.outlinePreparation?.worldMode==="skip" ? {...result,ready:true} : missing();
  if (type === "volume_beat_sheet" || type === "volume_chapter_list") {
    const volumes=book.planning?.volumes.filter(volume=>volume.id===context.volumeId) ?? [];
    if (volumes.length!==1) return missing();
    const saved=type==="volume_beat_sheet" ? book.planning?.beatSheets.some(sheet=>sheet.volumeId===context.volumeId && sheet.beats.length) : volumes[0].chapters.length;
    return saved ? {...result,ready:true,volumeId:context.volumeId} : missing();
  }
  if (type === "character_cast") return book.materials.characters.length ? {...result,ready:true} : missing();
  if (type === "volume_strategy") return book.planning?.volumes.length ? {...result,ready:true} : missing();
  const {from,to,chapterId:id,volumeId}=context;
  if (typeof from!=="number" || typeof to!=="number" || !Number.isSafeInteger(from) || !Number.isSafeInteger(to) || from<1 || to<from) return missing();
  if (type === "chapter_batch_closed") {
    const chapters=book.chapters.filter(row=>row.order>=from && row.order<=to).sort((a,b)=>a.order-b.order);
    if (chapters.length!==to-from+1 || chapters.some((row,index)=>row.order!==from+index || !hasText(row.content)) || chapters[0]?.id!==id) return missing();
    return {...result,ready:true,chapters};
  }
  const plans=book.planning?.volumes.filter(volume=>volume.id===volumeId).flatMap(volume=>volume.chapters.filter(plan=>plan.chapterOrder===from)) ?? [];
  if (plans.length!==1) return missing();
  if (type === "chapter_task_sheet") {
    const plan=plans[0];
    if (plan.id!==id) return missing();
    const selected:VolumeChapterPlan[] = [];
    const targets = context.chapterPlans ?? [{id:plan.id, volumeId, chapterOrder:from}];
    if (context.chapterPlans && (targets.length !== to-from+1 || targets[0]?.id !== id)) return missing();
    for (const [index,target] of targets.entries()) {
      const matches = book.planning!.volumes.filter(v => v.id === target.volumeId)
        .flatMap(v => v.chapters.filter(c => c.chapterOrder === target.chapterOrder));
      if (target.chapterOrder !== from + index || matches.length !== 1 || matches[0].id !== target.id) return missing();
      const chapter = matches[0];
      const missingFields = [!hasText(chapter.taskSheet) && "Tareas del capítulo", !hasText(chapter.sceneCards) && "Arreglo de escena"].filter(Boolean);
      if (missingFields.length) return {...result,canRegenerate:true,error:`Cap. ${target.chapterOrder} Falta el capitulo guardado${missingFields.join("y")}, maneje la etapa actual en el escritorio del director.`};
      selected.push(chapter);
    }
    return {...result,ready:true,plan,plans:selected};
  }
  const executions = (book.executionPlans ?? []).filter(row => row.order >= from && row.order <= to).sort((a,b) => a.order-b.order);
  if (executions.length !== to-from+1 || executions[0]?.id !== id || executions.some((row,index) =>
    row.order !== from+index || !hasText(row.taskSheet) || !hasText(row.sceneCards))) return missing();
  return {...result, ready:true, executions};
}

function hasText(value:unknown):value is string {return typeof value==="string" && Boolean(value.trim());}
