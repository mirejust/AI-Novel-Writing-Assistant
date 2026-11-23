import {useState, type ReactNode} from "react";
import {useMutation, useQueryClient} from "@tanstack/react-query";
import {createDirectorCommandKey, submitDirectorCommand} from "@/api/directorNext";
import {queryKeys} from "@/api/queryKeys";
import {Button} from "@/components/ui/button";
import {AppDialogContent, Dialog} from "@/components/ui/dialog";

export type PlanEditorRenderer = (input: {runId:string; expectedVersion:number; onClose:()=>void}) => ReactNode;

export interface ChapterProseApproval {planVersionId: string; approveForProse: string}

export default function DirectorGate({runId, novelId, expectedVersion, reviewType, canConfirm = true, renderPlanEditor, proseApproval}: {runId:string; novelId:string; expectedVersion:number; reviewType?:string; canConfirm?:boolean; renderPlanEditor?:PlanEditorRenderer; proseApproval?:ChapterProseApproval}) {
  const queries=useQueryClient();
  const [regenerating, setRegenerating]=useState(false);
  const [guidance, setGuidance]=useState("");
  const [editing, setEditing]=useState(false);
  const editLabel = reviewType === "chapter_task_sheet" ? "Discute o edita tareas y escenarios con la IA."
    : reviewType === "character_cast" ? "Discutir o editar elencos con IA" : reviewType === "volume_strategy" ? "Discutir o editar el programa de estudios con IA" : undefined;
  const batchReview = reviewType === "chapter_batch_closed" && Boolean(renderPlanEditor);
  const confirmSaved = reviewType === "chapter_execution_contract" || reviewType === "chapter_batch_closed";
  const canGenerate=reviewType==="chapter_task_sheet" || reviewType==="volume_strategy";
  const chapterApproval = reviewType === "chapter_task_sheet" ? proseApproval : undefined;
  const mutation=useMutation({
    mutationFn:(decision:"confirm"|"confirm_after_edit"|"regenerate")=>submitDirectorCommand({type:"resolve_gate",runId,decision,expectedVersion,idempotencyKey:createDirectorCommandKey(),
      ...(decision === "confirm" && chapterApproval ? {chapterPlanEdit: {...chapterApproval, chapters: []}} : {}),
      ...(decision==="regenerate" && canGenerate && guidance.trim() ? {guidance:guidance.trim()} : {})}),
    onSuccess:async()=>{
      setRegenerating(false);setGuidance("");
      await Promise.all([queries.invalidateQueries({queryKey:queryKeys.directorNext.summary(novelId)}),queries.invalidateQueries({queryKey:queryKeys.directorNext.detail(novelId)}),queries.invalidateQueries({queryKey:["directorBookWorkspace",novelId]})]);
    },
  });
  return <section className="space-y-3 border-t border-border/50 py-4">
    {canConfirm ? <>
      {batchReview ? <Button onClick={()=>setEditing(true)}>Discutir y confirmar el texto de este lote con AI</Button> : <>
      <p className="text-xs leading-5 text-muted-foreground">Después de comprobar los resultados a la izquierda, puedes confirmar y continuar.{editLabel && renderPlanEditor ? ", también puedes editar el contenido primero" : ""}{canGenerate ? "O pídele a AI que lo reescriba según tus sugerencias." : ""}.</p>
      <Button disabled={mutation.isPending} onClick={()=>mutation.mutate("confirm")}>{chapterApproval ? "Confirma este lote de capítulos y continúa escribiendo el texto." : "Confirmar resultados y continuar"}</Button></>}
    </> : null}
    <div className="flex flex-wrap gap-2">
      {canConfirm && editLabel && renderPlanEditor ? <Button variant="ghost" size="sm" disabled={mutation.isPending} onClick={()=>setEditing(true)}>{editLabel}</Button> : null}
      {canConfirm && !batchReview && confirmSaved ? <Button variant="ghost" size="sm" disabled={mutation.isPending} onClick={()=>mutation.mutate("confirm_after_edit")}>Confirmar cambios guardados</Button> : null}
      {canGenerate ? <Button variant="ghost" size="sm" disabled={mutation.isPending} onClick={()=>{mutation.reset();setRegenerating(true);}}>Regenerar esta etapa</Button>
        : reviewType==="chapter_execution_contract" ? <Button variant="ghost" size="sm" disabled={mutation.isPending} onClick={()=>mutation.mutate("regenerate")}>Plan de ejecución de resincronización</Button> : null}
    </div>
    {mutation.isError && !regenerating ? <p role="alert" className="text-xs text-destructive">{mutation.error.message}</p>:null}
    <Dialog open={regenerating} onOpenChange={open=>{if(!mutation.isPending)setRegenerating(open);}}>
      <AppDialogContent title="Regenerar esta etapa" description="Especifica lo que deseas conservar o ajustar y la IA se regenerará en consecuencia. Se recomienda dejarlo en blanco."
        footer={<><Button variant="ghost" disabled={mutation.isPending} onClick={()=>setRegenerating(false)}>Volver a ver</Button><Button disabled={mutation.isPending} onClick={()=>mutation.mutate("regenerate")}>{mutation.isPending ? "Enviando…" : guidance.trim() ? "Regenerar como se sugiere" : "Regenerar"}</Button></>}>
        <label className="space-y-2 text-sm"><span>Sugerencias de corrección manual (opcional)</span><textarea className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50" value={guidance} onChange={event=>setGuidance(event.target.value)} maxLength={6000} disabled={mutation.isPending} rows={6} placeholder="Por ejemplo: conservar la configuración del talismán residual, dejar que el protagonista pruebe activamente sus habilidades y aumentar el suspenso al final."/></label>
        {mutation.isError ? <p role="alert" className="mt-3 text-sm text-destructive">{mutation.error.message}</p>:null}
      </AppDialogContent>
    </Dialog>
    {canConfirm && editing ? renderPlanEditor?.({runId,expectedVersion,onClose:()=>setEditing(false)}) : null}
  </section>;
}
