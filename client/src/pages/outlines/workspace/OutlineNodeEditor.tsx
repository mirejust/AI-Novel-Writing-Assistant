import { formatVolumeBeatDisplayLabel } from "@ai-novel/shared/types/volumeBeatSlots";
import { ArrowUpRight } from "lucide-react";
import type { OutlineDocument } from "@ai-novel/shared/types/outline";
import { formatOutlineValue, getOutlineNodes, getOutlineNodeTitle, outlineFieldLabels, type OutlineNode } from "../outlineNodes";

const forms = {
  story: { label: "Esquema general", main: ["premise", "synopsis"], more: ["endingDirection", "theme", "tone", "genre", "targetAudience", "notes"] },
  volume: { label: "Rollo", main: ["summary", "promise"], more: ["pressure", "protagonistChange", "climax", "endingHook", "planningDepth"] },
  chapter: { label: "Capítulos", main: ["summary", "conflict"], more: ["purpose", "emotionalBeat", "endingHook", "planningDepth"] },
  character: { label: "Personajes", main: ["role", "summary", "goal", "motivation"], more: ["conflict", "secret", "arcDirection"] },
  payoff: { label: "Presagio y gancho", main: ["setupDescription", "payoffDescription"], more: ["kind"] },
  fact: { label: "Ajustes fijos", main: ["content"], more: ["category", "immutable"] },
};

const prompts: Record<string, string> = {
  premise: "¿Quién quiere lograr qué? ¿Qué interrumpió tu vida original?",
  synopsis: "Desde el comienzo de la historia hasta la decisión final, simplemente escribe primero la línea principal.",
  summary: "¿Dónde comienza esta historia? ¿Qué cambió al final?",
  role: "¿Quién es esta persona? ¿Qué tiene que ver con el protagonista?",
  goal: "¿Qué es lo que más desea esta persona?",
  motivation: "¿Por qué es esto tan importante para esta persona?",
  setupDescription: "¿Dónde notará el lector esta pista por primera vez?",
  payoffDescription: "¿Qué volverán a entender los lectores cuando se revele la verdad?",
};

export function formFor(node: OutlineNode) {
  if ("premise" in node) return forms.story;
  if ("volumeNodeId" in node) return forms.chapter;
  if ("chapterNodeIds" in node) return forms.volume;
  if ("appearanceNodeIds" in node) return forms.character;
  if ("setupChapterNodeIds" in node) return forms.payoff;
  return forms.fact;
}

export function references(node: OutlineNode): string[] {
  if ("chapterNodeIds" in node) return node.chapterNodeIds;
  if ("volumeNodeId" in node) return [node.volumeNodeId, ...node.characterNodeIds, ...node.payoffNodeIds];
  if ("appearanceNodeIds" in node) return node.appearanceNodeIds;
  if ("setupChapterNodeIds" in node) return [...node.setupChapterNodeIds, ...node.payoffChapterNodeIds, ...node.relatedNodeIds];
  if ("scope" in node) return node.scope.nodeId ? [...node.relatedNodeIds, node.scope.nodeId] : node.relatedNodeIds;
  return [];
}

interface Props {
  node: OutlineNode;
  document: OutlineDocument;
  disabled: boolean;
  onChange: (field: string, value: string | boolean) => void;
  onSelect: (id: string) => void;
}

export function OutlineNodeEditor({ node, document, disabled, onChange, onSelect }: Props) {
  const form = formFor(node);
  const titleField = "name" in node ? "name" : "title";
  const current = node as unknown as Record<string, unknown>;
  const parent = "volumeNodeId" in node ? document.volumes.find(volume => volume.nodeId === node.volumeNodeId) : undefined;
  const outgoing = new Set(references(node));
  const related = getOutlineNodes(document).filter(other =>
    other !== node && (outgoing.has(other.nodeId) || references(other).includes(node.nodeId)));

  function field(key: string) {
    const characterSummary = key === "summary" && "appearanceNodeIds" in node;
    const label = characterSummary ? "Descripción del personaje" : outlineFieldLabels[key];
    if (key === "immutable") return <label key={key} className="flex items-center gap-2 text-sm">
      <input type="checkbox" checked={!!current[key]} disabled={disabled} className="accent-primary"
        onChange={event => onChange(key, event.target.checked)} />El desarrollo de la parcela debe cumplir con esta configuración.
    </label>;
    const choices = key === "planningDepth" ? ["rough", "detailed"] : key === "kind" ? ["foreshadowing", "hook", "promise", "mystery", "other"] : null;
    return <label key={key} className="block space-y-2">
      <span className="text-sm font-medium">{label}</span>
      {choices ? <select className="outline-field" disabled={disabled} value={String(current[key] ?? "")}
        onChange={event => onChange(key, event.target.value)}>
        {choices.map(value => <option key={value} value={value}>{formatOutlineValue(value, key)}</option>)}
      </select> : <textarea className="outline-field outline-textarea" rows={key === "synopsis" || key === "summary" || key === "content" ? 4 : 2}
        disabled={disabled} value={String(current[key] ?? "")} placeholder={characterSummary ? "Anota los orígenes y circunstancias de la persona." : prompts[key]} onChange={event => onChange(key, event.target.value)} />}
    </label>;
  }

  return <div className="outline-editor-fields">
    <header className="mb-6">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>{parent ? `${parent.title} / ${form.label}` : form.label}</span>
      </div>
      <input className="outline-title" aria-label={outlineFieldLabels[titleField]} disabled={disabled}
        placeholder={titleField === "name" ? "Complete el nombre de la persona" : "Completa el título"} value={String(current[titleField])}
        onChange={event => onChange(titleField, event.target.value)} />
    </header>
    {parent?.beats && <label className="mb-4 block space-y-2 text-sm">La sección rítmica a la que pertenece.
      <select className="outline-field" disabled={disabled} value={String(current.beatKey ?? "")} onChange={e=>onChange("beatKey",e.target.value)}>
        <option value="">Aún no asociado</option>{parent.beats.map(b=><option key={b.key} value={b.key}>{formatVolumeBeatDisplayLabel(b)}</option>)}
      </select></label>}
    <div className="space-y-5">{form.main.map(field)}</div>
    <details className="outline-more">
      <summary>Más{form.label === "Ajustes fijos" ? "Opciones" : "Ajustes"}</summary>
      <div className="space-y-5 pt-4">{form.more.map(field)}</div>
    </details>
    {related.length > 0 && <section className="border-t border-border/50 pt-4" aria-label="Contenido relacionado">
      <h3 className="mb-2 text-sm font-medium">Contenido relacionado <span className="text-xs font-normal text-muted-foreground">{related.length}</span></h3>
      <ul className="flex flex-wrap gap-x-4 gap-y-1">{related.map(item => <li key={item.nodeId}>
        <button className="inline-flex items-center gap-1 py-1 text-left text-sm text-primary hover:underline" type="button" onClick={() => onSelect(item.nodeId)}>
          {getOutlineNodeTitle(item)}<ArrowUpRight aria-hidden size={12} />
        </button>
      </li>)}</ul>
    </section>}
  </div>;
}
