import type { FormEvent } from "react";
import type { CharacterDialogueInfluence, CharacterDialogueInfluenceStatus } from "@ai-novel/shared/types/characterDialogue";
import type { CharacterConversationPolicy } from "@ai-novel/shared/types/characterConversation";
import type { CharacterConversationSessionView } from "@/api/characterConversation";
import { MessageCircle, Send, Sparkles } from "lucide-react";
import AiButton from "@/components/common/AiButton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface CharacterDialogueStageProps {
  className?: string;
  characterName: string;
  interactionPolicy: CharacterConversationPolicy;
  session: CharacterConversationSessionView | null;
  isLoading: boolean;
  isCreating: boolean;
  isSending: boolean;
  isActivating: boolean;
  isDismissing: boolean;
  error: unknown;
  message: string;
  onMessageChange: (value: string) => void;
  onCreate: () => void;
  onSend: (sessionId: string) => void;
  onActivate: (sessionId: string) => void;
  onDismiss: (sessionId: string) => void;
}

const POLICY_DESCRIPTION: Record<CharacterConversationPolicy, string> = {
  novel_influence: "Los personajes responderán en función de sus propias situaciones, cogniciones y relaciones; la conversación no reescribirá directamente la historia de la novela.",
  read_only: "El personaje responde según el canon estable de la biblioteca de personajes; Este intercambio no reescribe el canon ni ninguna novela.",
  evidence_interview: "Los personajes sólo responden basándose en la gama actual de evidencia; cuando las pruebas son insuficientes, esto se indica claramente y la comunicación no reescribe el texto original.",
};

export default function CharacterDialogueStage(props: CharacterDialogueStageProps) {
  const influence = props.interactionPolicy === "novel_influence" ? props.session?.latestInfluence ?? null : null;
  const submitMessage = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (props.session && props.message.trim() && !props.isSending) {
      props.onSend(props.session.id);
    }
  };

  return (
    <section className={cn("flex min-h-[520px] min-w-0 flex-col overflow-hidden bg-background xl:max-h-[calc(100dvh-15rem)]", props.className)}>
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border/60 py-3.5">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold tracking-tight">
            <MessageCircle className="h-4 w-4 text-primary" />
            y {props.characterName} charlar
          </div>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">{POLICY_DESCRIPTION[props.interactionPolicy]}</p>
        </div>
        <span className="pt-0.5 text-xs text-muted-foreground">{props.session ? "Conversación en progreso" : "Esperando abrir"}</span>
      </header>

      {props.isLoading ? <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">Leyendo la transcripción de la conversación...</div> : null}
      {!props.isLoading && !props.session ? (
        <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary"><MessageCircle className="h-5 w-5" /></div>
          <div className="mt-4 text-base font-semibold">Comience con una oración</div>
          <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">puedo preguntar {props.characterName} preocupaciones, cuestionar sus decisiones o hablar sobre la situación actual.</p>
          <AiButton className="mt-5" onClick={props.onCreate} disabled={props.isCreating}>
            <Sparkles className="mr-1.5 h-4 w-4" />{props.isCreating ? "Preparándose para hablar..." : `Abrir con${props.characterName}Conversación`}
          </AiButton>
        </div>
      ) : null}
      {props.session ? (
        <>
          <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-1 py-6 sm:px-2">
            {props.session.turns.length ? props.session.turns.map((turn) => (
              <article key={turn.id} className={turn.role === "author" ? "ml-auto max-w-[82%] rounded-lg bg-primary px-4 py-3.5 text-primary-foreground" : "mr-auto max-w-[88%] border-l-2 border-primary/35 pl-4"}>
                <div className={`mb-2 text-xs font-medium ${turn.role === "author" ? "text-primary-foreground/70" : "text-primary"}`}>{turn.role === "author" ? "Tu" : props.characterName}</div>
                <div className="whitespace-pre-wrap text-sm leading-7">{turn.content}</div>
                {turn.role === "character" && turn.uncertainty ? <div className="mt-4 border-t border-border/60 pt-3 text-xs leading-5 text-muted-foreground"><span className="mr-1 font-medium text-foreground/75">Incertidumbres:</span>{turn.uncertainty}</div> : null}
                {turn.role === "character" && turn.evidence.length > 0 ? <div className="mt-3 border-t border-border/60 pt-3 text-xs leading-5 text-muted-foreground"><span className="mr-2 font-medium text-foreground/75">de acuerdo con</span>{turn.evidence.map((evidence, index) => <span key={`${evidence.sourceRef ?? evidence.label}-${index}`}>{index > 0 ? " · " : ""}{evidence.chapterOrder ? `Cap. ${evidence.chapterOrder} Capítulo · ` : ""}{evidence.label}</span>)}</div> : null}
              </article>
            )) : <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Dime que quieres hacer con {props.characterName} cosas de qué hablar.</div>}
          </div>
          {influence ? <DialogueInfluenceNotice influence={influence} isActivating={props.isActivating} isDismissing={props.isDismissing} onActivate={() => props.onActivate(props.session!.id)} onDismiss={() => props.onDismiss(props.session!.id)} /> : null}
          <form className="border-t border-border/60 bg-background pt-4" onSubmit={submitMessage}>
            <label className="sr-only" htmlFor="character-dialogue-message">Que decirle al personaje</label>
            <textarea
              id="character-dialogue-message"
              value={props.message}
              maxLength={800}
              rows={3}
              onChange={(event) => props.onMessageChange(event.target.value)}
              placeholder={`Quiere tener razón"${props.characterName}"¿Que qué?`}
              className="w-full resize-none rounded-lg border border-border/70 bg-muted/[0.24] px-4 py-3 text-sm leading-6 outline-none transition focus:border-primary/50 focus:bg-background focus:ring-2 focus:ring-primary/15"
              disabled={props.isSending}
            />
            <div className="mt-2 flex items-center justify-between gap-3">
              <span className="text-xs text-muted-foreground">{props.message.length}/800</span>
              <AiButton type="submit" size="sm" disabled={!props.message.trim() || props.isSending}>
                <Send className="mr-1.5 h-3.5 w-3.5" />{props.isSending ? "Esperando respuesta..." : "Enviar"}
              </AiButton>
            </div>
          </form>
        </>
      ) : null}
      {props.error ? <div className="border-t border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">{props.error instanceof Error ? props.error.message : "Esta conversación no puede continuar en este momento. Inténtelo de nuevo más tarde."}</div> : null}
    </section>
  );
}

function DialogueInfluenceNotice(props: {
  influence: CharacterDialogueInfluence;
  isActivating: boolean;
  isDismissing: boolean;
  onActivate: () => void;
  onDismiss: () => void;
}) {
  const canDecide = props.influence.status === "draft";
  const canDismiss = props.influence.status === "draft" || props.influence.status === "active";
  return (
    <aside className="border-t border-primary/20 bg-primary/[0.045] px-1 py-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="text-sm font-semibold">Las tendencias creativas que dejó esta conversación</div>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">{props.influence.summary}</p>
        </div>
        <Badge variant="outline">{influenceStatusLabel(props.influence.status)}</Badge>
      </div>
      {canDecide ? <div className="mt-3 flex flex-wrap gap-2"><AiButton size="sm" onClick={props.onActivate} disabled={props.isActivating}>{props.isActivating ? "Trayendo..." : "Llévelo a la creación posterior."}</AiButton><Button size="sm" variant="ghost" onClick={props.onDismiss} disabled={props.isDismissing}>{props.isDismissing ? "Procesando..." : "No traer esta vez"}</Button></div> : null}
      {!canDecide && canDismiss ? <Button className="mt-3" size="sm" variant="ghost" onClick={props.onDismiss} disabled={props.isDismissing}>{props.isDismissing ? "Procesando..." : "No traer esta vez"}</Button> : null}
    </aside>
  );
}

function influenceStatusLabel(status: CharacterDialogueInfluenceStatus) {
  const labels: Record<CharacterDialogueInfluenceStatus, string> = {
    draft: "Esperando la decisión",
    active: "Esperando a que se acepte el texto",
    applied: "Ya aceptado en el texto.",
    expired: "Capítulo aplicable aprobado",
    superseded: "Reemplazado por una nueva conversación",
    dismissed: "No traer esta vez",
  };
  return labels[status];
}
