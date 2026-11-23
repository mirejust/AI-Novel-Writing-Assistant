import { useState } from "react";
import type { OutlineDocument } from "@ai-novel/shared/types/outline";
import type { OutlineImportPreview as OutlineImportPreviewData } from "@/api/outlines";
import { Button } from "@/components/ui/button";
import { findOutlineNodeTitle, getOutlineNodeTitle, type OutlineNode } from "./outlineNodes";
import {
  setImportChapterVolume,
  setImportReferences,
  toggleId,
  updateImportNodeTitle,
  type ImportReferenceCollection,
  type ImportReferenceField,
} from "./outlineImportEditing";

interface OutlineImportPreviewProps {
  preview: OutlineImportPreviewData;
  isConfirming: boolean;
  error?: unknown;
  onConfirm: (document: OutlineDocument) => void;
}

interface ReferenceOption {
  id: string;
  label: string;
}

const inputClassName = "h-9 w-full rounded-md border border-input bg-background px-3 text-sm";
const selectClassName = "h-9 w-full rounded-md border border-input bg-background px-2 text-sm";

function optionsFromNodes(nodes: OutlineNode[]): ReferenceOption[] {
  return nodes.map(node => ({ id: node.nodeId, label: getOutlineNodeTitle(node) }));
}

function ReferenceChecklist({ label, options, selectedIds, onChange }: {
  label: string;
  options: ReferenceOption[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}) {
  return (
    <fieldset className="space-y-2">
      <legend className="text-xs font-medium text-muted-foreground">{label}</legend>
      {options.length ? (
        <div className="grid gap-1.5 sm:grid-cols-2">
          {options.map(option => (
            <label key={option.id} className="flex cursor-pointer items-center gap-2 text-xs">
              <input
                type="checkbox"
                className="h-4 w-4 shrink-0 accent-primary"
                checked={selectedIds.includes(option.id)}
                onChange={() => onChange(toggleId(selectedIds, option.id))}
              />
              <span>{option.label}</span>
            </label>
          ))}
        </div>
      ) : <p className="text-xs text-muted-foreground">Actualmente no hay nodos asociados.</p>}
    </fieldset>
  );
}

function NodeTitleInput({ label, value, onChange }: { label: string; value: string; onChange: (title: string) => void }) {
  return <input aria-label={label} className={inputClassName} value={value} onChange={event => onChange(event.target.value)} />;
}

export function OutlineImportPreview({ preview, isConfirming, error, onConfirm }: OutlineImportPreviewProps) {
  const [document, setDocument] = useState<OutlineDocument>(preview.document);
  const chapterOptions = optionsFromNodes(document.chapters);
  const volumeOptions = optionsFromNodes(document.volumes);
  const characterOptions = optionsFromNodes(document.characters);
  const payoffOptions = optionsFromNodes(document.payoffs);
  const appearanceOptions = optionsFromNodes([...document.volumes, ...document.chapters]);
  const allNodeOptions = optionsFromNodes([
    document.story,
    ...document.volumes,
    ...document.chapters,
    ...document.characters,
    ...document.payoffs,
    ...document.facts,
  ]);

  const updateReferences = (
    collection: ImportReferenceCollection,
    nodeId: string,
    field: ImportReferenceField,
    referenceIds: string[],
  ) => setDocument(current => setImportReferences(current, collection, nodeId, field, referenceIds));

  const hasEmptyTitle = !document.story.title.trim()
    || document.volumes.some(node => !node.title.trim())
    || document.chapters.some(node => !node.title.trim())
    || document.characters.some(node => !node.name.trim())
    || document.payoffs.some(node => !node.title.trim())
    || document.facts.some(node => !node.title.trim());
  const hasInvalidFactScope = document.facts.some(fact => {
    if (fact.scope.type === "story") return false;
    if (!fact.scope.nodeId) return true;
    const candidates = fact.scope.type === "volume" ? document.volumes : document.chapters;
    return !candidates.some(node => node.nodeId === fact.scope.nodeId);
  });

  return (
    <section className="space-y-5 bg-muted/20 p-4" aria-label="Confirmación del resultado de la importación">
      <div>
        <h3 className="font-medium">Confirmar resultado del reconocimiento</h3>
        <p className="mt-1 text-sm text-muted-foreground">Títulos ajustables, volúmenes de capítulos y referencias de nodos. El esquema se creará sólo después de la confirmación.</p>
      </div>
      <p className="text-sm">conocido {document.volumes.length} Rollo,{document.chapters.length} Capítulo;{preview.unclassified.length} El contenido de este párrafo debe revisarse manualmente.</p>
      <p className="text-xs text-muted-foreground">texto original total {preview.sourceLength} Carácter, anulación de fuente de nodo {preview.coveredLength} personaje. El contenido descubierto e inigualable requiere verificación manual.</p>

      <label className="block space-y-1.5 text-sm text-muted-foreground">
        <span>Título del esquema</span>
        <NodeTitleInput label="Título del esquema" value={document.story.title} onChange={title => setDocument(current => ({ ...current, story: { ...current.story, title } }))} />
      </label>

      <section className="space-y-4">
        <h4 className="text-sm font-medium">Volúmenes y capítulos</h4>
        {document.volumes.map(volume => (
          <div key={volume.nodeId} className="space-y-3 bg-background/70 p-3">
            <NodeTitleInput
              label={`Título del volumen:${volume.title}`}
              value={volume.title}
              onChange={title => setDocument(current => updateImportNodeTitle(current, "volumes", volume.nodeId, title))}
            />
            <div className="ml-3 space-y-3 border-l border-border/50 pl-3">
              {document.chapters.filter(chapter => chapter.volumeNodeId === volume.nodeId).map(chapter => (
                <div key={chapter.nodeId} className="space-y-2">
                  <NodeTitleInput
                    label={`Título del capítulo:${chapter.title}`}
                    value={chapter.title}
                    onChange={title => setDocument(current => updateImportNodeTitle(current, "chapters", chapter.nodeId, title))}
                  />
                  <label className="block space-y-1 text-xs text-muted-foreground">
                    <span>Volumen al que pertenece</span>
                    <select
                      className={selectClassName}
                      value={chapter.volumeNodeId}
                      onChange={event => setDocument(current => setImportChapterVolume(current, chapter.nodeId, event.target.value))}
                    >
                      {document.volumes.map(option => <option key={option.nodeId} value={option.nodeId}>{option.title}</option>)}
                    </select>
                  </label>
                  <details className="text-xs">
                    <summary className="cursor-pointer text-muted-foreground">Ajustar el carácter y las referencias de presagio.</summary>
                    <div className="mt-3 space-y-3">
                      <ReferenceChecklist label="Personas relacionadas" options={characterOptions} selectedIds={chapter.characterNodeIds} onChange={ids => updateReferences("chapters", chapter.nodeId, "characterNodeIds", ids)} />
                      <ReferenceChecklist label="Presagio y gancho relacionados" options={payoffOptions} selectedIds={chapter.payoffNodeIds} onChange={ids => updateReferences("chapters", chapter.nodeId, "payoffNodeIds", ids)} />
                    </div>
                  </details>
                </div>
              ))}
              {!volume.chapterNodeIds.length ? <p className="text-xs text-muted-foreground">Este volumen aún no tiene capítulos.</p> : null}
            </div>
          </div>
        ))}
      </section>

      {document.characters.length ? (
        <section className="space-y-3">
          <h4 className="text-sm font-medium">Personajes y lugares de aparición.</h4>
          {document.characters.map(character => (
            <div key={character.nodeId} className="space-y-2">
              <NodeTitleInput label={`Nombre del personaje:${character.name}`} value={character.name} onChange={title => setDocument(current => updateImportNodeTitle(current, "characters", character.nodeId, title))} />
              <details className="text-xs">
                <summary className="cursor-pointer text-muted-foreground">Ajustar la ubicación de salida planificada</summary>
                <ReferenceChecklist label="Aparición volumen o capítulo" options={appearanceOptions} selectedIds={character.appearanceNodeIds} onChange={ids => updateReferences("characters", character.nodeId, "appearanceNodeIds", ids)} />
              </details>
            </div>
          ))}
        </section>
      ) : null}

      {document.payoffs.length ? (
        <section className="space-y-3">
          <h4 className="text-sm font-medium">Presagio y gancho</h4>
          {document.payoffs.map(payoff => (
            <div key={payoff.nodeId} className="space-y-2">
              <NodeTitleInput label={`Título presagio:${payoff.title}`} value={payoff.title} onChange={title => setDocument(current => updateImportNodeTitle(current, "payoffs", payoff.nodeId, title))} />
              <details className="text-xs">
                <summary className="cursor-pointer text-muted-foreground">Ajustar nodos enterrados, reciclados y asociados.</summary>
                <div className="mt-3 space-y-3">
                  <ReferenceChecklist label="Planean enterrar el capítulo." options={chapterOptions} selectedIds={payoff.setupChapterNodeIds} onChange={ids => updateReferences("payoffs", payoff.nodeId, "setupChapterNodeIds", ids)} />
                  <ReferenceChecklist label="Capítulo de reciclaje planificado" options={chapterOptions} selectedIds={payoff.payoffChapterNodeIds} onChange={ids => updateReferences("payoffs", payoff.nodeId, "payoffChapterNodeIds", ids)} />
                  <ReferenceChecklist label="Otros nodos asociados" options={allNodeOptions.filter(option => option.id !== payoff.nodeId)} selectedIds={payoff.relatedNodeIds} onChange={ids => updateReferences("payoffs", payoff.nodeId, "relatedNodeIds", ids)} />
                </div>
              </details>
            </div>
          ))}
        </section>
      ) : null}

      {document.facts.length ? (
        <section className="space-y-3">
          <h4 className="text-sm font-medium">Ajustes fijos</h4>
          {document.facts.map(fact => (
            <div key={fact.nodeId} className="space-y-2">
              <NodeTitleInput label={`Establecer título:${fact.title}`} value={fact.title} onChange={title => setDocument(current => updateImportNodeTitle(current, "facts", fact.nodeId, title))} />
              <div className="grid gap-2 sm:grid-cols-2">
                <label className="space-y-1 text-xs text-muted-foreground">
                  <span>Ámbito de aplicación</span>
                  <select
                    className={selectClassName}
                    value={fact.scope.type}
                    onChange={event => {
                      const type = event.target.value as "story" | "volume" | "chapter";
                      setDocument(current => ({
                        ...current,
                        facts: current.facts.map(item => item.nodeId === fact.nodeId ? { ...item, scope: { type } } : item),
                      }));
                    }}
                  >
                    <option value="story">Libro completo</option>
                    <option value="volume">Especificar volumen</option>
                    <option value="chapter">Especificar capítulo</option>
                  </select>
                </label>
                {fact.scope.type !== "story" ? (
                  <label className="space-y-1 text-xs text-muted-foreground">
                    <span>{fact.scope.type === "volume" ? "Seleccionar volumen" : "Seleccionar capítulo"}</span>
                    <select
                      className={selectClassName}
                      value={fact.scope.nodeId ?? ""}
                      onChange={event => setDocument(current => ({
                        ...current,
                        facts: current.facts.map(item => item.nodeId === fact.nodeId ? { ...item, scope: { type: fact.scope.type, nodeId: event.target.value } } : item),
                      }))}
                    >
                      <option value="" disabled>Por favor seleccione</option>
                      {(fact.scope.type === "volume" ? document.volumes : document.chapters).map(node => <option key={node.nodeId} value={node.nodeId}>{node.title}</option>)}
                    </select>
                  </label>
                ) : null}
              </div>
              <details className="text-xs">
                <summary className="cursor-pointer text-muted-foreground">Ajustar los nodos asociados</summary>
                <ReferenceChecklist label="Nodo asociado" options={allNodeOptions.filter(option => option.id !== fact.nodeId)} selectedIds={fact.relatedNodeIds} onChange={ids => updateReferences("facts", fact.nodeId, "relatedNodeIds", ids)} />
              </details>
            </div>
          ))}
        </section>
      ) : null}

      {preview.unclassified.length ? (
        <details className="text-sm">
          <summary className="cursor-pointer font-medium">Ver texto original sin categoría ({preview.unclassified.length})</summary>
          <div className="mt-3 space-y-2">{preview.unclassified.map((item, index) => <p key={index} className="whitespace-pre-wrap bg-muted/40 p-3 text-xs text-muted-foreground">{item}</p>)}</div>
        </details>
      ) : null}
      {preview.unmatchedSources.length ? <p role="alert" className="text-sm text-destructive">{preview.unmatchedSources.length} Los nodos no coinciden con el texto original correspondiente. Vuelva al texto original para comprobarlo y luego confirmar.</p> : null}
      <details className="text-sm">
        <summary className="cursor-pointer font-medium">Verificar nodos y fragmentos de origen</summary>
        <ul className="mt-3 space-y-3">
          {preview.coverage.map(item => (
            <li key={`${item.nodeId}-${item.start}-${item.end}`}>
              <p className="font-medium">{findOutlineNodeTitle(document, item.nodeId)}</p>
              <p className="mt-1 text-xs text-muted-foreground">Ubicación original {item.start + 1}–{item.end}</p>
              <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap bg-muted/50 p-3 text-xs text-muted-foreground">{item.text}</pre>
            </li>
          ))}
        </ul>
      </details>

      {hasEmptyTitle ? <p role="alert" className="text-sm text-destructive">Complete el título del esquema y de cada nodo antes de confirmar.</p> : null}
      {hasInvalidFactScope ? <p role="alert" className="text-sm text-destructive">Seleccione el volumen o capítulo correspondiente para el rango especificado de configuraciones fijas.</p> : null}
      {error ? <p role="alert" className="text-sm text-destructive">{error instanceof Error ? error.message : "Error en la confirmación de importación, inténtelo de nuevo."}</p> : null}
      <Button onClick={() => onConfirm(document)} disabled={isConfirming || hasEmptyTitle || hasInvalidFactScope}>{isConfirming ? "Creando esquema…" : "Confirmar la creación del esquema"}</Button>
    </section>
  );
}
