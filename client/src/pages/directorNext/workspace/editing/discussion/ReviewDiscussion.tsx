import { useState } from "react";
import { apiClient } from "@/api/client";
import { AgentConversation, type AgentConversationAdapter } from "@/components/agentConversation/AgentConversation";
import { Button } from "@/components/ui/button";
import type { AgentConversationTurn } from "@ai-novel/shared/types/agentConversation/turn";
import { castFieldLabels } from "@ai-novel/shared/types/director/castReview/discussion";
import { volumeFieldLabels } from "@ai-novel/shared/types/director/volumeReview/discussion";
import type { ReviewChange, ReviewProposal } from "@ai-novel/shared/types/director/review/fieldSuggestions";

const labels = { ...castFieldLabels, ...volumeFieldLabels };
type Proposal = ReviewProposal<string>;
type Scope = {type:"final_review";sourceHash:string;finding:number|"all"} | { type: "character_cast" } | {type:"chapter_batch_closed"; bodyHash:string} | { type: "volume_strategy" | "chapter_task_sheet"; planVersionId: string };

const inline = { errorPresentation: "inline" } as const;
interface Props {
  novelId: string; runId?: string; version?: number; scope: Scope; subject: { id: string; title: string };
  base: Record<string, string>; draft: Record<string, string>; disabled: boolean;
  message: string; onMessage: (value: string) => void;
  fieldLabels?: Record<string,string>;
  onAccept: (changes: ReviewChange<string>[]) => void;
}

function Suggestions({ proposal, draft, disabled, onAccept, fieldLabels }: {
  fieldLabels: Record<string,string>; proposal: Proposal; draft: Record<string, string>; disabled: boolean; onAccept: Props["onAccept"];
}) {
  const [picked, setPicked] = useState(() => new Set(proposal.changes.map(item => item.field)));
  const selected = proposal.changes.filter(item => picked.has(item.field) && draft[item.field] === item.before);
  return <div className="space-y-3">
    {proposal.changes.map(item => {
      const accepted = draft[item.field] === item.value;
      const available = draft[item.field] === item.before;
      return <div key={item.field} className="space-y-1.5 border-b border-border/40 pb-3">
        <label className="flex items-center gap-2 font-medium">
          <input type="checkbox" disabled={disabled || !available} checked={accepted || (available && picked.has(item.field))}
            onChange={event => { const checked = event.target.checked; setPicked(previous => {
              const next = new Set(previous);
              if (checked) next.add(item.field); else next.delete(item.field);
              return next;
            }); }}/>
          {fieldLabels[item.field]}
        </label>
        <p className="whitespace-pre-wrap text-muted-foreground">Texto original　{item.before || "Aún no completado"}</p>
        <p className="whitespace-pre-wrap">sugerencia　{item.value}</p>
        <p className="text-sm text-muted-foreground">{item.reason}</p>
        {!available && <p className="text-xs">{accepted ? "Agregado para editar" : "Hay cambios en este borrador editorial y puede continuar la discusión como un nuevo borrador."}</p>}
      </div>;
    })}
    {proposal.changes.some(item => draft[item.field] === item.before) && <Button type="button" size="sm" disabled={disabled || !selected.length} onClick={() => onAccept(selected)}>
      Adoptar cambios seleccionados ({selected.length})
    </Button>}
  </div>;
}

function presentation(scope: Scope, version: number | undefined, title: string) {
  if(scope.type==="final_review") return {path:"final-review",key:"director-final-review",assistant:"Asistente de acabado",
    welcome:{title:scope.finding==="all"?"¿Qué párrafo quieres revisar nuevamente?":"¿Cómo afecta este problema a la lectura?",body:"Puedes preguntar el motivo primero o pedirle a un asistente que te indique una manera de corregirlo.",starters:[{label:"Por favor haga una revisión paso a paso.",text:scope.finding==="all"?"Lea este capítulo detenidamente y haga sugerencias específicas para revisiones de los párrafos que necesitan pulir.":"Para los temas de inspección seleccionados, se dan sugerencias de modificaciones que pueden adoptarse párrafo por párrafo."}]},hint:"Los párrafos adoptados pasarán al borrador de confirmación.",placeholder:"Escriba las sentencias que desea mantener o sus pensamientos sobre cambiar la ley..."};
  if (scope.type === "chapter_batch_closed") return {
    path:`prose-review/${version}/versions/${encodeURIComponent(scope.bodyHash)}/chapters`,key:"director-prose",assistant:"Asistente de texto",
    welcome:{title:"¿Cómo se lee este capítulo?",body:"Primero puedes preguntar qué piensas después de leerlo, o puedes señalar las áreas que deseas cambiar.",starters:[
      {label:"¿Dónde suena incómodo de leer?",text:"Lee este capítulo y dime dónde el ritmo es lento y por qué."},
      {label:"Haz que el final sea más memorable",text:"Guarda lo que pasó en este capítulo y ayúdame a cambiar el final para dejar un pequeño regusto a los lectores."},
    ]},hint:"Comparar el texto original y la sugerencia párrafo por párrafo, que podrán retirarse después de su aprobación.",placeholder:"¿Qué pasaje del texto quieres discutir o cómo quieres que se sientan los lectores después de leerlo?",
  };
  if (scope.type === "chapter_task_sheet") return {
    path: `chapter-review/${version}/plans/${encodeURIComponent(scope.planVersionId)}/chapters`, key: "director-chapter", assistant:"Asistente de capítulo",
    welcome:{ title: "¿Cómo quieres escribir este capítulo?", body:"Puedes discutir lo que va a pasar en este capítulo, o simplemente puedes cambiar una escena.", starters:[
      {label:"¿Qué avanza este capítulo?", text:"Combinado con la ruta de este capítulo, explica qué quiere hacer el protagonista y qué resistencia encontrará."},
      {label:"Hacer más costoso el turno del segundo juego", text:"Ayúdame a ajustar el giro de la segunda escena para que el protagonista deba tomar una decisión costosa."},
    ]}, hint:"Si se acepta, se completará el borrador editado de este capítulo. Podéis continuar modificándolo manualmente y confirmarlo juntos.", placeholder:"Escribe una misión de capítulo o una escena que quieras discutir...",
  };
  if (scope.type === "volume_strategy") return {
    path:`volume-review/${version}/plans/${encodeURIComponent(scope.planVersionId)}/volumes`, key:"director-volume", assistant:"Asistente de esquema",
    welcome:{ title:`¿Cómo desea ajustar el${title}»?`, body:"Puede comenzar hablando sobre lo que los lectores más esperan y luego decidir qué elementos cambiar.", starters:[
      {label:"¿Podrá el clímax estar a la altura de las expectativas?",text:"¿Puede el clímax de este volumen estar a la altura de las expectativas dadas anteriormente a los lectores? Dime tu criterio."},
      {label:"Haga que la elección al final del artículo sea más valiosa",text:"Mantenga la trama principal de este volumen y deje que el protagonista tome una decisión más costosa en el clímax."},
    ]}, hint:"Si se acepta, se completará el borrador editado de este volumen y se abrirá el capítulo después de confirmar el esquema del volumen.", placeholder:"Escribe la trama o los cambios que quieras discutir...",
  };
  return {path:`cast-review/${version}/characters`, key:"director-cast", assistant:"Asistente de rol",
    welcome:{title:`¿Cómo quieres escribir?${title}?`, body:"Hable sobre lo que le gustaría conservar o qué decisiones le gustaría que tomara esta persona.", starters:[
      {label:"¿Qué quiere este personaje?",text:"Combinado con la dirección del libro, hable sobre lo que este personaje más quiere lograr y por qué."},
      {label:"Haz que este personaje sea más proactivo.",text:"Mantén las relaciones existentes entre los personajes y deja que este personaje tome la iniciativa para tomar una decisión que afecte la trama."},
    ]}, hint:"El borrador editado se completará después de la aceptación y el director continuará después de guardarlo.", placeholder:"Escribe tu opinión sobre este personaje...",
  };
}

export function ReviewDiscussion({ novelId, runId, version, subject, scope, base, draft, fieldLabels = labels, disabled, message, onMessage, onAccept }: Props) {
  const config = presentation(scope, version, subject.title);
  const root = `/director-next/novels/${encodeURIComponent(novelId)}`;
  const url = scope.type==="final_review" ? `${root}/final-review/chapters/${encodeURIComponent(subject.id)}/${scope.sourceHash}/findings/${scope.finding}/conversation` : `${root}/runs/${encodeURIComponent(runId!)}/${config.path}/${encodeURIComponent(subject.id)}/conversation`;
  const adapter: AgentConversationAdapter<Proposal> = {
    queryKey: ["agent-conversation", config.key, novelId, ...(scope.type==="final_review" ? [scope.sourceHash,String(scope.finding)] : [runId!, String(version)]), ...("planVersionId" in scope ? [scope.planVersionId] : "bodyHash" in scope ? [scope.bodyHash] : []), subject.id],
    load: async () => (await apiClient.get(url, inline)).data.data as AgentConversationTurn<Proposal>[],
    send: input => apiClient.post(url + "/turns", { ...input, base, draft }, inline),
    interrupt: id => apiClient.post(url + "/turns/" + encodeURIComponent(id) + "/interrupt", {}, inline),
    streamUrl: id => apiClient.getUri({ url: url + "/turns/" + encodeURIComponent(id) + "/stream" }),
  };
  return <div className="min-w-0 [container-type:inline-size] lg:flex lg:min-h-0 lg:[&_.agent-feed]:overflow-y-auto">
    <AgentConversation adapter={adapter} title={config.assistant} context={`Discutiendo · ${subject.title}`}
      welcome={config.welcome} confirmationHint={config.hint} inputLabel={`Discutir con el asistente${subject.title}`}
      placeholder={config.placeholder} followUpPlaceholder="¿Qué desea mantener o cambiar en esta sugerencia?"
      initialAction={`Enviar a${config.assistant}`} followUpAction={(_, n) => `Pregunta No. ${n} sugerencia redonda`} followUpTopic={(_, n) => `Discusión No. ${n} sugerencia redonda`}
      versionLabel={() => subject.title} disabled={disabled} maxLength={4000}
      value={message} onChange={onMessage} canContinue={() => true} describeResult={result => `${result.changes.length} sugerencias`}
      renderResult={(proposal, busy) => <Suggestions fieldLabels={fieldLabels} key={proposal.id} proposal={proposal} draft={draft}
        disabled={busy || disabled} onAccept={onAccept}/>}/>
  </div>;
}
