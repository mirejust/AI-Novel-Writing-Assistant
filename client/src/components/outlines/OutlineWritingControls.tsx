import {useState} from "react";
import {useMutation,useQueryClient} from "@tanstack/react-query";
import type {DirectorWorkspace} from "@/api/directorNext";
import {createDirectorCommandKey,submitDirectorCommand} from "@/api/directorNext";
import {queryKeys} from "@/api/queryKeys";
import LLMSelector from "@/components/common/LLMSelector";
import {useLLMStore} from "@/store/llmStore";
import {Button} from "@/components/ui/button";
import {nextUnwrittenChapter} from "@/pages/outlines/openBook/model";
import {buildOutlineOpeningLaunchInput} from "./openingLaunchInput";

// Explicit authorization only: preparation must not include the body-writing producer.
export const outlinePreparationSteps=["story_macro","book_contract","world_setup","character_setup","volume_strategy","volume_beat_sheet","volume_chapter_list","chapter_detail_bundle","execution_contract_sync"];
export default function OutlineWritingControls({book,initialStory,worldId}:{book:DirectorWorkspace;initialStory:string;worldId?:string|null}) {
  const total=book.novel.estimatedChapterCount ?? 1;
  const next=nextUnwrittenChapter(book.chapters,total);
  const [order,setOrder]=useState(next ?? total);
  const [confirmed,setConfirmed]=useState(false);
  const model=useLLMStore(),queries=useQueryClient();
  const chapter=book.chapters.find(row=>row.order===order);
  const written=Boolean(chapter?.content?.trim());
  const previousReady=order===1 || Boolean(book.chapters.find(row=>row.order===order-1)?.content?.trim());
  const valid=Number.isSafeInteger(order) && order>=1 && order<=total && previousReady && !written;
  const mutation=useMutation({mutationFn:(action:"opening"|"prepare"|"write")=>{
    if (!model.provider || !model.model) throw new Error("Primero seleccione el modelo de escritura en la configuración del modelo.");
    if (!valid) throw new Error("Complete primero el capítulo anterior y asegúrese de que no haya texto para el capítulo actual.");
    if (action==="write" && !confirmed) throw new Error("Confirme que esta vez solo se genera el texto del capítulo actual.");
    return submitDirectorCommand({type:"open_run",novelId:book.novel.id,driver:"assisted",stepIdsInScope:action==="write" ? null : outlinePreparationSteps,idempotencyKey:createDirectorCommandKey(),
       launchInput:buildOutlineOpeningLaunchInput({storyInput:initialStory,estimatedChapterCount:total,worldMode:worldId ? "reuse" : "skip",provider:model.provider,model:model.model,temperature:model.temperature,chapterOrder:order})});
  },onSuccess:async()=>{setConfirmed(false);await Promise.all([queries.invalidateQueries({queryKey:queryKeys.directorNext.summary(book.novel.id)}),queries.invalidateQueries({queryKey:queryKeys.directorNext.detail(book.novel.id)}),queries.invalidateQueries({queryKey:["directorBookWorkspace",book.novel.id]})]);}});
  return <section id="director-start" className="space-y-4 border-t border-border/50 py-4" aria-label="Confirmar capítulo por capítulo según el esquema.">
    <h2 className="text-sm font-semibold">¿Qué capítulo escribir a continuación?</h2><p className="text-xs leading-6 text-muted-foreground">Revisar y confirmar los resultados de la cobertura de vacantes por etapas. La preparación de capítulos no generará texto; después de escribir, lea y revise antes de pasar al siguiente capítulo.</p>
    <Button variant="secondary" className="w-full" disabled={!valid || mutation.isPending} onClick={()=>mutation.mutate("opening")}>Preparativos completos para escribir.</Button>
    <label className="flex items-center justify-between gap-3 text-sm">Capítulo actual<input aria-label="Capítulo actual" className="h-9 w-24 rounded-md border border-input bg-background px-3 text-right" type="number" min={1} max={total} value={order} onChange={event=>{setOrder(Number(event.target.value));setConfirmed(false);}}/></label>
    {written ? <p className="text-xs leading-6 text-muted-foreground">Este capítulo tiene texto, léalo y modifíquelo desde el directorio de la izquierda; no se sobrescribirá ni generará.</p> : !previousReady ? <p className="text-xs leading-6 text-warning">Complete el capítulo anterior y verifique el texto antes de preparar este capítulo.</p> : null}
    {next===null ? <p className="text-xs leading-6 text-muted-foreground">Los capítulos dentro del rango objetivo tienen texto y puede continuar leyendo y modificando desde la tabla de contenido.</p> : null}
    <Button variant="outline" className="w-full" disabled={!valid || mutation.isPending} onClick={()=>mutation.mutate("prepare")}>Prepárese para el capítulo {order} Cap.</Button>
    <label className="flex cursor-pointer items-start gap-2 text-xs leading-6"><input type="checkbox" className="mt-1 accent-primary" checked={confirmed} disabled={!valid} onChange={event=>setConfirmed(event.target.checked)}/><span>Esta vez solo la primera {order} Capítulo, confirmar la disposición de este capítulo; no escriba automáticamente el siguiente capítulo.</span></label>
    <Button className="w-full" disabled={!valid || !confirmed || mutation.isPending} onClick={()=>mutation.mutate("write")}>{mutation.isPending ? "Enviando…" : `Empieza a escribir el capítulo. ${order}`}</Button>
    {mutation.isError ? <p role="alert" className="text-xs leading-6 text-destructive">{mutation.error.message} Puede consultar el estado del director de este libro antes de continuar.</p> : null}
    <details><summary className="cursor-pointer text-xs text-muted-foreground">Configuración del modelo</summary><div className="pt-3"><LLMSelector compact showHelperText/></div></details>
  </section>;
}
