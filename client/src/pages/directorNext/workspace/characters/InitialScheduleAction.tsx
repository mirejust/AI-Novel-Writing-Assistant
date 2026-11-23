import {useState} from "react";
import {useMutation,useQueryClient} from "@tanstack/react-query";
import {fillDirectorInitialCharacterSchedule} from "@/api/directorNext";
import {useLLMStore} from "@/store/llmStore";
import {Button} from "@/components/ui/button";
import type {WorkspaceBook} from "../model";

export function InitialScheduleAction({book,preview=false}:{book:WorkspaceBook;preview?:boolean}) {
  const queries=useQueryClient();
  const {provider,model}=useLLMStore();
  const [message,setMessage]=useState<string|null>(null);
  const planned=book.planning?.volumes.flatMap(volume=>volume.chapters) ?? [];
  const missing=planned.filter(chapter=>chapter.plannedCharacterIds===undefined && !chapter.taskSheet?.trim() && !chapter.sceneCards?.trim()
    && !book.chapters.find(row=>row.order===chapter.chapterOrder)?.content?.trim());
  const mutation=useMutation({mutationFn:()=>fillDirectorInitialCharacterSchedule(book.novel.id,{provider,model}),
    onSuccess:async response=>{
      const result=response.data;
      setMessage(result ? `completo ${result.updated} Disposición de la apariencia del papel de Zhang${result.remaining ? `, y otro ${result.remaining} Los capítulos pueden continuar hasta completarse.` : ""}.` : "Se ha guardado el calendario de aparición de personajes.");
      await Promise.all([
        queries.invalidateQueries({queryKey:["directorBookWorkspace",book.novel.id]}),
        queries.invalidateQueries({queryKey:["director-character-appearances",book.novel.id]}),
      ]);
    }});
  if(preview || !book.materials.characters.length || !missing.length) return message ? <p role="status" className="text-sm text-muted-foreground">{message}</p> : null;
  return <div className="space-y-2 text-sm">
    <p className="text-muted-foreground">{missing.length} Al capítulo le faltan vistas previas de los personajes. Completa con el modelo seleccionado en la parte superior, hasta 24 capítulos a la vez; conservar la planificación y el texto del capítulo.</p>
    <Button variant="secondary" disabled={mutation.isPending || !provider || !model}
      onClick={()=>{setMessage(null);mutation.mutate();}}>{mutation.isPending ? "Organizar roles para aparecer..." : `Completa los arreglos de apariencia del personaje (${Math.min(24,missing.length)} capítulo)`}</Button>
    <p className="text-xs text-muted-foreground">Esta acción invoca a la IA; Úselo después de que haya terminado de escribir este libro.</p>
    {mutation.isError ? <p role="alert" className="text-destructive">{mutation.error.message}</p> : message ? <p role="status" className="text-muted-foreground">{message}</p> : null}
  </div>;
}
