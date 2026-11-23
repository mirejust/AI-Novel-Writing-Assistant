import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Feather } from "lucide-react";
import type { OutlineDocument } from "@ai-novel/shared/types/outline";
import type { ImpactSummary } from "@ai-novel/shared/types/outlineCharacterImpact";
import { apiClient } from "@/api/client";
import type { OutlineConversationTurn } from "@ai-novel/shared/types/agentConversation/outline";
import { applyOutlineProposal, listOutlineRevisions, type OutlineProposal, type OutlineProject, type OutlineEditProposalPayload } from "@/api/outlines";
import { Button } from "@/components/ui/button";
import { OutlineProposalPanel } from "../OutlineProposalPanel";
import { outlineReviewThread, type LocalTarget } from "./outlineReviewThread";
import { findOutlineNode, getOutlineNodeTitle, findOutlineNodeTitle } from "../outlineNodes";

interface Props {
  projectId: string; proposalId: string; version: number; document: OutlineDocument; locked: boolean; busy: boolean;
  onReturn: (nodeId?: string) => void; onSelect: (id: string) => void;
  onApplied: (version: number, nodeId?: string) => void;
  onRequest: (text: string, priorId: string, target?: LocalTarget) => void;
}
const statuses: Record<string,string> = { applied: "Adoptado", partially_applied: "Parcialmente adoptado", superseded: "Hay sugerencias de seguimiento.", rejected: "Abandonado", stale: "Hay una nueva versión del esquema." };

export function OutlineReviewReading({ projectId, proposalId, version, document, locked, busy, onReturn, onSelect, onApplied, onRequest }: Props) {
  const cache = useQueryClient();
  const [guidance, setGuidance] = useState("");
  const [followUp, setFollowUp] = useState(false);
  const review = useQuery({ queryKey: ["outline-review", projectId, proposalId], queryFn: async () =>
    (await apiClient.get(`/outlines/${projectId}/proposals/${proposalId}`, { errorPresentation: "inline" })).data.data as OutlineProposal | null });
  const proposal = review.data;
  const payload = proposal ? JSON.parse(proposal.proposalJson) as OutlineEditProposalPayload & { impact?: ImpactSummary; chapterId?: string; volumeId?: string; appliedOperationIds?: string[] } : null;
  const impact = payload?.impact;
  const target: LocalTarget | undefined = impact ? {kind:"character", id:impact.characterId}
    : proposal?.kind === "volume_edit" && payload?.volumeId ? {kind:"volume", id:payload.volumeId}
    : proposal?.kind === "chapter_edit" && payload?.chapterId ? {kind:"chapter", id:payload.chapterId} : undefined;
  const operationNodes = [...new Set(payload?.operations?.map(op => op.nodeId))];
  const ownerId = target?.id ?? payload?.volumeId ?? (operationNodes.length === 1 ? operationNodes[0] : undefined);
  const owner = ownerId ? findOutlineNode(document, ownerId) : undefined;
  const localHistoryKey = outlineReviewThread(projectId, target).queryKey;
  const wholeHistory = useQuery<OutlineConversationTurn[]>({
    queryKey: ["agent-conversation", "outline-workbench", projectId],
    queryFn: async () => (await apiClient.get(`/outlines/${projectId}/conversation`, { errorPresentation: "inline" })).data.data,
    enabled: !!proposal && !target && !payload?.volumeId,
  });
  const revisions = useQuery({ queryKey: ["outline-revisions", projectId], queryFn: () => listOutlineRevisions(projectId) });
  const roundIndex = wholeHistory.data?.findIndex(turn => turn.result?.id === proposalId) ?? -1;
  const adopted = revisions.data?.find(rev => rev.sourceProposalId === proposalId)?.version;
  const person = owner && "appearanceNodeIds" in owner ? owner : undefined;
  const decision = useMutation({
    mutationKey: ["outline-discussion-decision", projectId],
    mutationFn: (ids: string[]) => applyOutlineProposal(projectId, proposalId, ids),
    onSuccess: result => {
      cache.setQueryData<OutlineProject>(["outline", projectId], old => old && ({ ...old, currentVersion: result.revision.version, title: result.document.story.title, document: result.document }));
      onApplied(result.revision.version, ownerId && findOutlineNode(result.document, ownerId) ? ownerId : result.document.story.nodeId);
    },
    onSettled: async () => {
      await Promise.all(["outline", "outline-review", "outline-pending", "outline-revisions", "outlines"].map(key =>
        cache.invalidateQueries({ queryKey: key === "outlines" ? [key] : [key, projectId] })));
      await cache.invalidateQueries({queryKey:localHistoryKey});
    },
  });
  const reject = useMutation({ mutationKey: ["outline-discussion-decision", projectId],
    mutationFn: () => apiClient.post(`/outlines/${projectId}/proposals/${proposalId}/reject`, {}, { errorPresentation: "inline" }),
    onSuccess: () => { onReturn(ownerId); void cache.invalidateQueries({queryKey:["outline-pending",projectId]}); void cache.invalidateQueries({queryKey:["outline-review",projectId]});
      void cache.invalidateQueries({queryKey:localHistoryKey}); },
  });
  const back = <button type="button" className="outline-reading-link" onClick={() => onReturn(ownerId)}><ArrowLeft size={14} />Volver al borrador actual</button>;
  if (review.isLoading) return <p role="status" className="outline-reading">Sugerencias de lectura…</p>;
  if (!proposal || proposal.projectId !== projectId || !["initial_generation","character_impact","chapter_edit","volume_edit","volume_beats","edit"].includes(proposal.kind)) return <div className="outline-reading">{back}<p role="alert">Esta sugerencia de esquema no se puede abrir.</p><Button onClick={() => void review.refetch()}>Releer</Button></div>;
  const pending = proposal.status === "pending", stale = pending && proposal.baseVersion !== version;
  const initial = proposal.kind === "initial_generation";
  const canRequest = proposal.kind !== "volume_beats" && pending && (!target || !!owner);
  const submitting = locked || decision.isPending || reject.isPending || busy;
  const topic = owner ? getOutlineNodeTitle(owner) : (initial ? "Primer borrador" : "Esquema");
  return <article className="outline-reading outline-review-reading">
    <header className="outline-reading-meta">{back}<span>{pending ? stale ? "Viejo consejo" : "Para ser adoptado" : statuses[proposal.status] ?? "Terminó"}{adopted && `por v${adopted}`}</span></header>
    {(!initial || stale) && <h2>{stale ? "Volver a mirar" + topic + "Viejo consejo" : topic + "Sugerencias de modificación"}</h2>}
    {stale && <p className="outline-version-note">Esta propuesta fue escrita en v{proposal.baseVersion}. El esquema actual es v{version},{proposal.kind === "volume_beats" ? "Puede volver a este volumen para volver a planificar el ritmo." : "Puede seleccionar la dirección que desea mantener y dejar que AI redacte una nueva basada en el borrador actual."}</p>}
    {stale && initial && <details className="outline-volume"><summary>Ver borrador actual v{version}«{document.story.title}»</summary>
      <p>{document.story.premise}</p><p>{document.story.synopsis}</p><p>{document.volumes.map(vol => vol.title).join(",")}</p><p>{document.characters.map(p => p.name).join(",")}</p>
    </details>}
    {proposal.requestText && !initial && <p className="outline-request-quote">{proposal.requestText}</p>}
    <OutlineProposalPanel proposal={proposal} document={document} currentVersion={version} round={roundIndex >= 0 ? roundIndex + 1 : undefined} personName={person?.name} readOnly={!pending || stale}
      appliedIds={impact?.appliedOperationIds ?? payload?.appliedOperationIds} isApplying={decision.isPending} applyDisabled={submitting}
      onApply={ids => { if (!submitting && pending && !stale) decision.mutate(ids); }} onLater={() => onReturn(ownerId)}
      renderContext={base => impact && <div className="outline-impact-context">
        {person && !!person.appearanceNodeIds.length && <section><h3>El capítulo de apariencia del borrador actual.</h3>{person.appearanceNodeIds.map(ref =>
          <button type="button" className="outline-reading-link" key={ref} onClick={() => onSelect(ref)}>{findOutlineNodeTitle(document, ref)} ↗</button>)}</section>}
        {!!impact.retained.length && <details><summary>Parcelas y entornos que se recomienda conservar · {impact.retained.length}</summary><ul>{impact.retained.map((item,i) =>
          <li key={i}><b>{findOutlineNodeTitle(base,item.nodeId)}</b>　{item.reason}</li>)}</ul></details>}
        {!!impact.writtenChapterIds.length && <details><summary>Capítulos que ya tienen texto.</summary><p>{impact.writtenChapterIds.map(id => findOutlineNodeTitle(base,id)).join(",")}</p></details>}
      </div>} />
    {pending && target && !owner && <p role="status">Este contenido no se puede encontrar en el manuscrito actual. Puedes seleccionar el volumen, personaje o capítulo a modificar desde la tabla de contenidos.</p>}
    {canRequest && (stale || followUp ? <form className="outline-review-followup" onSubmit={e => {
      e.preventDefault(); if (!submitting && (stale || guidance.trim())) onRequest(guidance.trim() || "Compare esta antigua sugerencia con el esquema actual y proporcione nuevas sugerencias de modificación que sean adecuadas para el borrador actual.", proposalId, target);
    }}>
      <label> {stale ? "¿Qué quieres conservar de las viejas sugerencias?" : "¿Qué más te gustaría ajustar?"}
        <textarea value={guidance} onChange={e => setGuidance(e.target.value)} maxLength={6000} rows={2}
          placeholder={stale ? "Opcional, escribe un motivo, trama o cita que quieras conservar..." : "Escriba la dirección que desea ajustar..."} /></label>
      <div className="outline-reading-actions"><Button disabled={submitting || (!stale && !guidance.trim())}>{stale ? "Volver a dar sugerencias según el esquema actual." : "Generar recomendaciones ajustadas"}</Button>
        {stale && <Button type="button" variant="ghost" onClick={() => onReturn(ownerId)}>Mantener el borrador actual</Button>}</div>
    </form> : <button type="button" className="outline-reading-link" onClick={() => setFollowUp(true)}><Feather size={14} />{initial ? "Quiero cambiar de direccion" : "Hacer otra solicitud"}</button>)}
    {pending && !stale && <details className="outline-review-options"><summary>Otras operaciones</summary><button disabled={submitting} onClick={() => {
      if (window.confirm("¿Renunciar a esta sugerencia? Todavía se puede ver en la transcripción del debate.")) reject.mutate();
    }}>Descartar esta sugerencia</button></details>}
    {(decision.error || reject.error) && <p role="alert">{(decision.error || reject.error)?.message}</p>}
  </article>;
}
