import { BeatList } from "./volumeRhythm/BeatList";
import type { ReactNode } from "react";
import { useIsMutating, useQuery } from "@tanstack/react-query";
import { ArrowRight, ArrowUpRight, BookOpen, Feather, PencilLine } from "lucide-react";
import type { OutlineDocument } from "@ai-novel/shared/types/outline";
import type { PendingOutlineProposal } from "@/api/outlines";
import { Button } from "@/components/ui/button";
import { findOutlineNodeTitle, formatOutlineValue, getOutlineNodes, getOutlineNodeTitle, outlineFieldLabels, type OutlineNode } from "../outlineNodes";
import { formatVolumeBeatDisplayLabel } from "@ai-novel/shared/types/volumeBeatSlots";
import { formFor, references } from "./OutlineNodeEditor";
import { outlineReviewThread } from "./outlineReviewThread";

export function isEmptyOutline(doc: OutlineDocument) {
  return !Object.entries(doc.story).some(([key, value]) => key !== "title" && key !== "nodeId" && value)
    && ![doc.volumes, doc.chapters, doc.characters, doc.facts, doc.payoffs].some(group => group.length);
}

export function IdeaStarter({ projectId, value, onChange, busy, onGenerate, onDiscuss, onEdit, children }: {
  projectId: string; value: string; onChange: (text: string) => void; busy: boolean;
  onGenerate: () => void; onDiscuss: () => void; onEdit: () => void; children: ReactNode;
}) {
  const thread = outlineReviewThread(projectId);
  const history = useQuery({ queryKey: thread.queryKey, queryFn: thread.load });
  const sending = useIsMutating({ mutationKey: thread.queryKey, exact: true }) > 0;
  const manual = <button type="button" className="outline-blank-edit" onClick={onEdit}>Complete el esquema usted mismo</button>;
  if (!history.data) return <div className="outline-reading">
    {history.isError ? <p role="alert">La discusión de la historia no se pudo leer.<Button variant="ghost" onClick={() => void history.refetch()}>Reintentar</Button></p>
      : <p role="status">Leyendo la discusión de la historia...</p>}
    {manual}
  </div>;
  if (history.data.length) return <div className="outline-idea-thread">
    {children}
    <div className="outline-idea-next">
      <Button variant="secondary" disabled={busy || sending || history.data.some(turn => turn.status === "running")} onClick={onGenerate}>
        Generar un primer borrador basado en la discusión. <ArrowRight />
      </Button>
      {manual}
    </div>
  </div>;
  return <><article className="outline-reading outline-idea">
    <Feather size={32} aria-hidden="true" />
    <h2>¿Qué historia quieres escribir?</h2>
    <p>Escribe sobre una persona, un dilema o una imagen sobre la que siempre quisiste escribir. El primer borrador lo ampliará en capítulos y personajes, y después de leerlo, tú decides si lo adoptas o no.</p>
    <label htmlFor="outline-story-idea">Mis ideas de historia</label>
    <textarea id="outline-story-idea" value={value} maxLength={6000} rows={5} placeholder="Si un día..."
      disabled={busy} onChange={e => onChange(e.target.value)} />
    <div className="outline-reading-actions"><Button disabled={busy || !value.trim()} onClick={onGenerate}>Genera un primer borrador basado en esta idea. <ArrowRight /></Button>
      <Button variant="ghost" disabled={busy} onClick={onDiscuss}>Ayúdame a pensar en ello primero.</Button></div>
  </article>{manual}</>;
}

export function PendingSuggestions({ proposals, version, document, onOpen }: {
  proposals: PendingOutlineProposal[]; version: number; document: OutlineDocument; onOpen: (id: string) => void;
}) {
  if (!proposals.length) return null;
  return <section className="outline-pending" aria-label="Sugerencias pendientes">
    <h3>Sugerencias esperando que las veas <small>{proposals.length}</small></h3>
    {proposals.map(item => <button type="button" key={item.id} onClick={() => onOpen(item.id)}>
      <span><b>{item.title || item.requestText || (item.characterId ? findOutlineNodeTitle(document, item.characterId) + "Modificación de personaje" : "Revisión del esquema")}</b>
        <small>{item.baseVersion === version ? `Basado en v${version} · Por adoptar` : `Basado en v${item.baseVersion} · con v actual${version} control`}</small></span><ArrowRight size={16} />
    </button>)}
  </section>;
}

export function OutlineReading({ document, node, version, onEdit, reviewAction, renderLocalReview, notices, volumeRhythm, onSelect }: {
  document: OutlineDocument; node: OutlineNode; version: number; onEdit: () => void; onSelect: (id: string) => void;
  reviewAction?: ReactNode; renderLocalReview?: (passages: ReactNode) => ReactNode; notices?: ReactNode; volumeRhythm?: ReactNode;
}) {
  const form = formFor(node);
  const isStory = node.nodeId === document.story.nodeId;
  const person = "appearanceNodeIds" in node ? node : null;
  const fields = node as unknown as Record<string, unknown>;
  const links = new Set(references(node));
  const related = getOutlineNodes(document).filter(other => other !== node && (links.has(other.nodeId) || references(other).includes(node.nodeId)));
  const link = (item: OutlineNode) => <button className="outline-reading-link" type="button" key={item.nodeId} onClick={() => onSelect(item.nodeId)}>{getOutlineNodeTitle(item)} <ArrowUpRight size={13} /></button>;
  const title = getOutlineNodeTitle(node);
  const passages = <>
      {"volumeNodeId" in node && node.beatKey && <p className="outline-reading-counts">Sección de ritmo · {formatVolumeBeatDisplayLabel(document.volumes.find(v=>v.nodeId===node.volumeNodeId)?.beats?.find(b=>b.key===node.beatKey) ?? {key:node.beatKey})}</p>}
      {notices}
      {isStory && <p className="outline-reading-counts">{document.volumes.length} volumen <i>·</i> {document.chapters.length} capitulo <i>·</i> {document.characters.length} Persona</p>}
      {[...form.main, ...form.more].filter(key => fields[key] !== undefined && fields[key] !== "" && key !== "planningDepth").map(key => <section className="outline-passage" key={key}>
        <h3>{person && key === "summary" ? "Descripción del personaje" : outlineFieldLabels[key]}</h3><p>{formatOutlineValue(fields[key], key, document)}</p>
      </section>)}
      {volumeRhythm}
      {isStory && <>
        {!!document.volumes.length && <section className="outline-passage"><h3>Disposición del capítulo</h3>{[...document.volumes].sort((a,b) => a.order-b.order).map(vol =>
          <details key={vol.nodeId} className="outline-volume"><summary>{vol.title} <small>{vol.chapterNodeIds.length} Cap.</small></summary>
            <p>{vol.summary}</p>
            {vol.beats && <BeatList beats={vol.beats} chapters={document.chapters.filter(ch=>ch.volumeNodeId===vol.nodeId)} onSelect={onSelect}/>}
            <div>{vol.chapterNodeIds.map(id => document.chapters.find(ch => ch.nodeId === id)).map(ch => ch && !ch.beatKey && link(ch))}</div>
          </details>)}</section>}
        {!!document.characters.length && <section className="outline-passage"><h3>Personajes</h3><div className="outline-person-list">{document.characters.map(p => <div key={p.nodeId}>{link(p)}<p>{p.role || p.summary}</p></div>)}</div></section>}
      </>}
      {person && <section className="outline-passage"><h3>Sello de apariencia</h3>
        {related.filter(item => "volumeNodeId" in item || "chapterNodeIds" in item).map(link)}
        {!related.some(item => "volumeNodeId" in item || "chapterNodeIds" in item) && <p>Aún no hay apariciones programadas.</p>}</section>}
      {related.some(item => !person || !("volumeNodeId" in item || "chapterNodeIds" in item)) && <section className="outline-passage" aria-label="Contenido relacionado"><h3>Contenido relacionado</h3>
        {related.filter(item => !person || !("volumeNodeId" in item || "chapterNodeIds" in item)).map(link)}</section>}
  </>;
  return <article className={reviewAction ? "outline-reading outline-local-page" : "outline-reading"}>
    <header className="outline-reading-heading">
      <div className="outline-reading-meta"><span><BookOpen size={14} /> {form.label} · Borrador actual v{version}</span><button onClick={onEdit}><PencilLine size={14} /> Edición manual</button></div>
      <div className="outline-reading-title"><h2 title={title}>{title}</h2>{reviewAction}</div>
    </header>
    {renderLocalReview ? renderLocalReview(passages) : <div className="outline-reading-body">{passages}</div>}
  </article>;
}
