import { useState, type ReactNode } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { AgentConversationTurn } from "@ai-novel/shared/types/agentConversation/turn";
import { candidateFieldLabel, type CandidateProposal, type CandidateStoryField } from "@ai-novel/shared/types/director/candidateReview";
import type { DirectorCandidate } from "@ai-novel/shared/types/novelDirector";
import { apiClient, type ApiHttpError } from "@/api/client";
import { queryKeys } from "@/api/queryKeys";
import { AgentConversation, type AgentConversationAdapter } from "@/components/agentConversation/AgentConversation";
import { Button } from "@/components/ui/button";

const inline = { errorPresentation: "inline" } as const;
const labels = { pending: "Esperando tu elección", applied: "Adoptado", superseded: "Tener sugerencias de seguimiento", stale: "Las direcciones están actualizadas." };
interface Props {
  taskId: string; batchId: string; candidate: DirectorCandidate; disabled: boolean;
  context: ReactNode;
  draft: string;
  onDraftChange: (value: string) => void;
  onApplied: (batchId: string, candidate: DirectorCandidate) => void;
}

function ProposalReview({ proposal, disabled, apply }: {
  proposal: CandidateProposal; disabled: boolean; apply: (fields: CandidateStoryField[]) => void;
}) {
  const [fields, setFields] = useState(proposal.changes.map(item => item.field));
  const pending = proposal.status === "pending";
  return <div className="space-y-3">
    {proposal.changes.map(item => <div key={item.field} className="space-y-1.5 border-b border-border/45 pb-3">
      <label className="flex items-center gap-2 font-medium">
        {pending && <input type="checkbox" checked={fields.includes(item.field)} disabled={disabled}
          onChange={e => setFields(previous => e.target.checked ? [...previous, item.field] : previous.filter(field => field !== item.field))} />}
        {candidateFieldLabel[item.field]}
        {proposal.appliedFields.includes(item.field) && <small className="text-muted-foreground">Adoptado</small>}
      </label>
      <p className="text-muted-foreground">Texto original　{item.before}</p>
      <p>sugerencia　{item.value}</p>
      <p className="text-sm text-muted-foreground">{item.reason}</p>
    </div>)}
    {pending && <Button type="button" size="sm" onClick={() => apply(fields)} disabled={disabled || !fields.length}>
      Adoptar cambios seleccionados ({fields.length})
    </Button>}
  </div>;
}

export function CandidateDiscussion({ taskId, batchId, candidate, disabled, onApplied, context, draft, onDraftChange }: Props) {
  const client = useQueryClient();
  const key = ["agent-conversation", "opening-candidate", taskId, batchId, candidate.id];
  const url = `/novels/director/tasks/${encodeURIComponent(taskId)}/batches/${encodeURIComponent(batchId)}/candidates/${encodeURIComponent(candidate.id)}/conversation`;
  async function refreshCandidate() {
    await client.invalidateQueries({ queryKey: queryKeys.tasks.detail("novel_workflow", taskId) });
  }
  const apply = useMutation({
    mutationKey: ["apply-opening-candidate", taskId],
    mutationFn: async ({ id, fields }: { id: string; fields: CandidateStoryField[] }) =>
      (await apiClient.post(url + "/proposals/" + encodeURIComponent(id) + "/apply", { fields }, inline)).data.data as DirectorCandidate,
    onSuccess: result => onApplied(batchId, result),
    onSettled: () => Promise.all([client.invalidateQueries({ queryKey: key }), refreshCandidate()]),
  });
  const adapter: AgentConversationAdapter<CandidateProposal> = {
    queryKey: key,
    load: async () => (await apiClient.get(url, inline)).data.data as AgentConversationTurn<CandidateProposal>[],
    send: async input => {
      try { await apiClient.post(url + "/turns", { ...input, revision: candidate.reviewRevision ?? 0 }, inline); }
      catch (error) { if ((error as ApiHttpError).status === 409) await refreshCandidate(); throw error; }
    },
    interrupt: id => apiClient.post(url + "/turns/" + encodeURIComponent(id) + "/interrupt", {}, inline),
    streamUrl: id => apiClient.getUri({ url: url + "/turns/" + encodeURIComponent(id) + "/stream" }),
  };
  return <>
      <AgentConversation adapter={adapter} title="Asistente de apertura de libros." context={context}
        confirmationHint="La adopción actualizará este conjunto de candidatos. Abra el libro después de la selección." inputLabel="¿Qué quieres discutir en este conjunto de instrucciones de apertura de libros?"
        welcome={{ title: candidate.hookStrategy?.trim() ? candidateFieldLabel.hookStrategy : "Resumen de la historia",
          body: candidate.hookStrategy?.trim() || candidate.logline,
          starters: [{ label: "¿Dónde puede comenzar el primer capítulo?", text: "Combinando este conjunto de instrucciones, hablemos de desde qué escena puede comenzar el primer capítulo y por qué." },
            { label: "¿Tiene el protagonista otras opciones?", text: "¿Cómo se cambiará el conflicto posterior manteniendo el trasfondo de la historia y dejando que el protagonista tome una decisión diferente al principio?" }] }}
        placeholder="¿Qué lugares te gustan? ¿Dónde quieres cambiar la forma de escribir?" followUpPlaceholder="¿Qué quieres mantener o ajustar de la propuesta anterior?"
        initialAction="Enviar al asistente de apertura de libros" followUpAction={(_, n) => `Pregunta No. ${n} sugerencia redonda`} followUpTopic={(_, n) => `Discusión No. ${n} sugerencia redonda`}
        versionLabel={v => `borrador de dirección ${Number(v) + 1}`} disabled={disabled || apply.isPending} maxLength={4000}
        value={draft} onChange={onDraftChange} canContinue={result => result.status !== "superseded"}
        describeResult={result => result.status === "applied" ? `adoptado ${result.appliedFields.length} artículo` : labels[result.status]}
        renderResult={(result, busy) => <ProposalReview key={result.id} proposal={result} disabled={disabled || busy || apply.isPending}
          apply={fields => apply.mutate({ id: result.id, fields })} />} />
      {apply.error && <p role="alert" className="px-4 pb-3 text-sm text-destructive">{apply.error.message}</p>}
  </>;
}
