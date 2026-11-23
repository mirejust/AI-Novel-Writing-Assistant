import { useEffect, useRef, type ReactNode } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import MarkdownViewer from "@/components/common/MarkdownViewer";
import { AgentThinking } from "@/components/agentConversation/AgentThinking";
import { useAgentReplyPreview } from "@/components/agentConversation/useAgentReplyPreview";
import { outlineReviewThread, type LocalTarget } from "./outlineReviewThread";

export type LocalReviewDraft = { text: string; priorId?: string };
interface Props {
  children: ReactNode;
  projectId: string; target: LocalTarget; title: string; version: number;
  expanded: boolean; disabled: boolean; draft: LocalReviewDraft;
  onExpand: () => void; onChange: (draft: LocalReviewDraft) => void;
  onSend: (text: string, priorId?: string) => void; onOpen: (id: string) => void;
}
const statusLabels: Record<string, string> = { pending: "Para ser adoptado", applied: "Adoptado", partially_applied: "Parcialmente adoptado", rejected: "Abandonado", superseded: "Hay sugerencias de seguimiento.", stale: "Viejo consejo" };

export function OutlineLocalReview({ projectId, target, title, version, expanded, disabled, draft, onExpand, onChange, onSend, onOpen, children }: Props) {
  const thread = outlineReviewThread(projectId, target);
  const history = useQuery({ queryKey: thread.queryKey, queryFn: thread.load,
    refetchInterval: query => query.state.data?.some(turn => turn.status === "running") ? 1500 : false });
  const turns = history.data ?? [];
  const latest = turns.at(-1);
  const running = turns.find(turn => turn.status === "running");
  const live = useAgentReplyPreview(running && thread.streamUrl(running.id), running?.id, history.refetch);
  const stop = useMutation({ mutationFn: thread.interrupt, onSettled: () => history.refetch() });
  const input = useRef<HTMLTextAreaElement>(null);
  const { targetLabel, placeholder, hint } = {
    character: { targetLabel: "Personajes", placeholder: `Por ejemplo, enriquecer${title}objetivos y motivaciones.`, hint: "Revise los capítulos de apariencia y presagios juntos y escríbalos en el esquema después de la aceptación." },
    chapter: { targetLabel: "Capítulos", placeholder: "¿Cómo te gustaría modificar este capítulo? Por ejemplo, aumenta el suspenso al final.", hint: "Sólo ajuste este capítulo y escríbalo en el esquema después de su adopción." },
    volume: { targetLabel: "Dividir en volúmenes", placeholder: "¿Cómo le gustaría modificar este volumen? Por ejemplo, haz que el protagonista pague por sus elecciones al final del volumen.", hint: "Sólo se ajustará el esquema de este volumen y se incluirá en él después de su adopción." },
  }[target.kind];
  useEffect(() => {
    if (expanded) input.current?.focus({ preventScroll: true });
  }, [expanded]);
  const prior = turns.find(turn => turn.result && turn.result.id === draft.priorId);
  const composer = <form id="outline-local-form" className="outline-local-composer"
    aria-label={targetLabel + "Modificación local"} onSubmit={event => {
      event.preventDefault();
      if (draft.text.trim() && !disabled && !running && history.isSuccess) onSend(draft.text.trim(), draft.priorId);
    }}>
      <label><span className="sr-only">{target.kind === "character" ? `¿Cómo quieres modificarlo?${title}?` : `¿Cómo esperas adaptarte?${title}»?`}</span>
        <textarea ref={input} rows={2} maxLength={6000} value={draft.text} onChange={e => onChange({...draft, text:e.target.value})}
          placeholder={placeholder} /></label>
      {prior && <p className="outline-local-note">Sigue las sugerencias{prior.requestText}» <button type="button" className="underline" onClick={() => onChange({text:draft.text})}>Desreferenciación</button></p>}
      <div className="outline-local-send">
        <p className="outline-local-note">{hint}</p>
        <Button size="sm" disabled={disabled || !!running || !history.isSuccess || !draft.text.trim()}>Generar sugerencias de modificación</Button>
      </div>
    </form>;
  const activity = <section className="outline-local-review" aria-label={targetLabel + "Modificar registros"}>
    {running && <div role="status" className="outline-local-reply"><p>{live?.stage || "Compilando sugerencias de modificación..."}</p>
      <AgentThinking steps={live?.thinking ?? running.thinking} running />{live?.text && <MarkdownViewer content={live.text} />}
      <button type="button" className="outline-reading-link" disabled={stop.isPending} onClick={() => stop.mutate(running.id)}>Termina esta ronda</button></div>}
    {expanded && !running && latest?.status === "completed" && !latest.result && latest.replyText && <div className="outline-local-reply"><h4>Esta respuesta</h4><MarkdownViewer content={latest.replyText} /></div>}
    {history.isError && <p role="alert">No se pudo leer el registro de modificación.<button onClick={() => void history.refetch()}>Releer</button></p>}
    {stop.isError && <p role="alert">{stop.error.message}</p>}
    {!!turns.length && <details className="outline-local-history"><summary>consejo historico <small>{turns.length} Rueda</small></summary>
      <ol>{[...turns].reverse().map(turn => {
        const result = turn.result;
        return <li key={turn.id}><strong>{turn.requestText}</strong>
          <small>Basado en v{turn.contextVersion} · {result ? result.baseVersion !== version && result.status === "pending" ? "Viejo consejo" : statusLabels[result.status] ?? "Terminó"
            : turn.status === "completed" ? "Respuestas a la discusión" : turn.status === "running" ? "Generando" : turn.status === "interrupted" ? "Terminó" : "Error de generación"}</small>
          {result && <button className="outline-reading-link" onClick={() => onOpen(result.id)}>{result.baseVersion !== version && result.status === "pending" ? "Comparar con el manuscrito actual" : "Ver sugerencias"}</button>}
          {result && ["applied","partially_applied","pending"].includes(result.status) && <button className="outline-reading-link" onClick={() => {
            onChange({...draft, priorId:result.id}); onExpand(); input.current?.focus({ preventScroll: true });
          }}>Sigue este consejo</button>}
          {(turn.replyText || !!turn.thinking?.length) && <details><summary>Ver esta ronda de respuestas</summary><AgentThinking steps={turn.thinking} running={false} />{turn.replyText && <MarkdownViewer content={turn.replyText} />}</details>}
          {(turn.status === "failed" || turn.status === "interrupted") && <button className="outline-reading-link" onClick={() => {
            onChange({text:turn.requestText, priorId:turn.parentResultId ?? undefined}); onExpand(); input.current?.focus({ preventScroll: true });
          }}>Continuar con esta solicitud</button>}
        </li>;
      })}</ol></details>}
  </section>;
  return <>
    <div className="outline-reading-body">{activity}{children}</div>
    {expanded && <footer className="outline-local-dock">{composer}</footer>}
  </>;
}
