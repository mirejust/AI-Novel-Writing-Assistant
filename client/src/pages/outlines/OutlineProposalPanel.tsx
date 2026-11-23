import { BeatList } from "./workspace/volumeRhythm/BeatList";
import type { VolumeBeat } from "@ai-novel/shared/types/novel";
import { useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { getOutlineRevision, listOutlineRevisions } from "@/api/outlines";
import type { OutlineDocument } from "@ai-novel/shared/types/outline";
import type {
  OutlineInitialProposalPayload,
  OutlineProposal,
  OutlineProposalOperation,
} from "@/api/outlines";
import { Button } from "@/components/ui/button";
import {
  findMissingOperationDependencies,
  canApplyOperationSelection,
} from "./outlineProposalSelection";
import { InitialDraftReading } from "./workspace/InitialDraftReading";
import {
  findOutlineNode,
  findOutlineNodeTitle,
  formatOutlineValue,
  outlineFieldLabels,
  localizeOutlineText,
} from "./outlineNodes";

const operationKindLabels = {
  add_node: "Nuevo",
  update_fields: "Modificar",
  remove_node: "Eliminar",
  move_node: "Moverse",
} as const;

const nodeTypeLabels = {
  volume: "Rollo",
  chapter: "Capítulos",
  character: "Personajes",
  payoff: "Presagio o gancho",
  fact: "Ajustes fijos",
} as const;

interface OutlineProposalPanelProps {
  round?: number;
  proposal: OutlineProposal;
  document: OutlineDocument;
  isApplying: boolean;
  applyDisabled?: boolean;
  readOnly?: boolean;
  appliedIds?: string[];
  renderContext?: (base: OutlineDocument) => ReactNode;
  onApply: (operationIds: string[]) => void;
  currentVersion: number;
  personName?: string;
  onLater: () => void;
}

function operationTitle(operation: OutlineProposalOperation, document: OutlineDocument): string {
  const targetTitle = operation.nodeId ? findOutlineNodeTitle(document, operation.nodeId) : "";
  if (operation.kind === "add_node") {
    const title = operation.fields?.title ?? operation.fields?.name ?? "Nuevo nodo";
    return `Nuevo${operation.nodeType ? nodeTypeLabels[operation.nodeType] : "Nodo"}«${String(title)}»`;
  }
  return `${operationKindLabels[operation.kind]}«${targetTitle || "Nodo"}»`;
}

function FieldChanges({ operation, document, titles, current, version, oldVersion, historical }: { historical: boolean; current?: OutlineDocument; version: number; oldVersion?: number; operation: OutlineProposalOperation; document: OutlineDocument; titles: Record<string, string> }) {
  const target = operation.nodeId ? findOutlineNode(document, operation.nodeId) : undefined;
  const targetRecord = target as unknown as Record<string, unknown> | undefined;
  const live = current && operation.nodeId ? findOutlineNode(current, operation.nodeId) as unknown as Record<string, unknown> | undefined : undefined;
  if (operation.kind === "move_node") {
    return (
      <dl className="outline-comparison text-xs">
        <div><dt className="text-muted-foreground">{current ? `Proyecto actual v${version} Volumen al que pertenece` : "Volumen original"}</dt><dd className="mt-1 whitespace-pre-wrap">{(current ? live : targetRecord)?.volumeNodeId ? findOutlineNodeTitle(current ?? document, String((current ? live : targetRecord)?.volumeNodeId)) : "(vacío)"}</dd></div>
        <div><dt className="text-muted-foreground">{current ? "El volumen al que pertenece la antigua sugerencia." : "Volumen después del ajuste"}</dt><dd className="mt-1 whitespace-pre-wrap">{operation.parentNodeId ? findOutlineNodeTitle(document, operation.parentNodeId) : "(vacío)"}</dd></div>
      </dl>
    );
  }
  if (operation.kind === "remove_node") {
    return <p className="text-xs text-muted-foreground">Tras la adopción, este nodo y sus campos se eliminarán de la nueva revisión.</p>;
  }
  const fields = Object.entries(operation.fields ?? {});
  if (!fields.length) return null;
  return (
    <div className="space-y-2">
      {fields.map(([field, after]) => (
        <div key={field} className="text-xs">
          <p className="font-medium text-muted-foreground">{outlineFieldLabels[field] ?? field}</p>
          <dl className="outline-comparison mt-1">
            <div className="bg-muted/40 p-2"><dt className="text-muted-foreground">{historical ? "El manuscrito original en ese momento." : "Borrador actual"} v{version}</dt><dd className="mt-1 whitespace-pre-wrap break-words">{formatOutlineValue((current ? live : targetRecord)?.[field], field, current ?? document)}</dd></div>
            <div className="bg-muted/40 p-2"><dt className="text-muted-foreground">{current ? `Consejo antiguo · Basado en v${oldVersion}` : "Borrador de propuesta"}</dt><dd className="mt-1 whitespace-pre-wrap break-words">{formatOutlineValue(after, field, document, titles)}</dd></div>
          </dl>
          {current && <details className="outline-base-text"><summary>Ver v{oldVersion} El texto original en ese momento.</summary><p>{formatOutlineValue(targetRecord?.[field], field, document)}</p></details>}
        </div>
      ))}
    </div>
  );
}

export function OutlineProposalPanel({ proposal, document: currentDocument, isApplying, applyDisabled, readOnly, appliedIds, renderContext, onApply, onLater, currentVersion, personName, round }: OutlineProposalPanelProps) {
  const revisions = useQuery({ queryKey: ["outline-revisions", proposal.projectId], queryFn: () => listOutlineRevisions(proposal.projectId) });
  const baseRevision = revisions.data?.find(item => item.version === proposal.baseVersion);
  const base = useQuery({ queryKey: ["outline-revision", proposal.projectId, baseRevision?.id], queryFn: () => getOutlineRevision(proposal.projectId, baseRevision!.id), enabled: !!baseRevision });
  const document = base.data?.document ?? currentDocument;
  const payload = useMemo(
    () => JSON.parse(proposal.proposalJson) as OutlineInitialProposalPayload | { operations: OutlineProposalOperation[] },
    [proposal.proposalJson],
  );
  const stale = proposal.status === "pending" && proposal.baseVersion !== currentVersion;
  const replacesOutline = proposal.kind === "initial_generation" && (Object.entries(document.story).some(([key, value]) =>
    key !== "title" && key !== "nodeId" && Boolean(value)) || [document.volumes, document.chapters, document.characters, document.payoffs, document.facts].some(group => group.length));
  const operations = "operations" in payload ? payload.operations : [];
  const titles: Record<string, string> = {};
  for (const operation of operations) {
    const title = operation.fields?.title ?? operation.fields?.name;
    if (typeof title === "string") {
      if (operation.nodeId) titles[operation.nodeId] = title;
      if (operation.clientRef) titles[operation.clientRef] = title;
    }
  }
  const operationTitles = Object.fromEntries(operations.map(operation => [operation.operationId, operationTitle(operation, document)]));
  const displayText = (text: string) => localizeOutlineText(text, operationTitles);
  const allOperationIds = useMemo(() => operations.map(operation => operation.operationId), [operations]);
  const [selectedIds, setSelectedIds] = useState<string[]>(allOperationIds);
  const selected = new Set(selectedIds);
  const missingDependencies = findMissingOperationDependencies(operations, selectedIds);
  const allMissingDependencies = findMissingOperationDependencies(operations, allOperationIds);
  const selectedIsComplete = canApplyOperationSelection(operations, selectedIds);

  const only = operations.find(op => selected.has(op.operationId));
  const personFields = personName && selectedIds.length === 1 && only?.kind === "update_fields"
    && document.characters.some(p => p.nodeId === only.nodeId && p.name === personName) ? Object.keys(only.fields ?? {}).length : 0;
  const toggleOperation = (operationId: string) => {
    setSelectedIds(current => current.includes(operationId)
      ? current.filter(id => id !== operationId)
      : [...current, operationId]);
  };

  const dependencyName = (operationId: string) => {
    const dependency = operations.find(operation => operation.operationId === operationId);
    return dependency ? operationTitle(dependency, document) : "Modificaciones relacionadas";
  };

  if (revisions.isLoading || base.isLoading) return <p className="text-sm text-muted-foreground">Leyendo las revisiones de la línea base de la propuesta...</p>;
  if (revisions.isError || base.isError || !base.data) return <p role="alert" className="text-sm text-destructive">No se puede leer la sinopsis en ese momento.<button className="underline" onClick={() => { void revisions.refetch(); if (baseRevision) void base.refetch(); }}>Releer</button></p>;

  if (proposal.kind === "volume_beats") {
    const sheet = operations.find(op => Array.isArray(op.fields?.beats));
    const volume = document.volumes.find(v=>v.nodeId===sheet?.nodeId);
    if (!sheet || !volume) return <p role="alert">No se pueden leer las sugerencias de ritmo para este volumen.</p>;
    const assigned = new Map(operations.map(op=>[op.nodeId,op.fields?.beatKey as string | undefined]));
    const chapters = document.chapters.filter(ch=>ch.volumeNodeId===volume.nodeId).sort((a,b)=>a.order-b.order);
    const current = currentDocument.volumes.find(v=>v.nodeId===volume.nodeId);
    return <section className="outline-proposal-body"><h3>Asignaciones de capítulos y ritmo intravolumen sugeridos</h3>
      <BeatList beats={sheet.fields!.beats as VolumeBeat[]} chapters={chapters.map(ch=>({...ch,beatKey:assigned.get(ch.nodeId)}))}/>
      {current?.beats && <details className="outline-volume"><summary>Compara el ritmo del draft actual</summary><BeatList beats={current.beats} chapters={currentDocument.chapters.filter(c=>c.volumeNodeId===current.nodeId)}/></details>}
      {!readOnly && <Button disabled={applyDisabled || isApplying} onClick={()=>onApply(allOperationIds)}>Adopte el ritmo y la atribución de capítulos de este volumen.</Button>}
    </section>;
  }
  return (
    <section className="space-y-4 outline-proposal-body">
      <div>
        <p className="mt-1 text-xs text-muted-foreground">{round && `Cap. ${round} rueda · `}Basado en la revisión v{proposal.baseVersion}.{stale ? "Expanda cada elemento para ver el texto original en ese momento." : readOnly ? "Podrás consultar las modificaciones en ese momento." : "operations" in payload ? "Seleccione los cambios que desea conservar y adoptelos juntos." : replacesOutline ? `La adopción reemplazará "${document.story.title}»El esquema completo. original v${proposal.baseVersion} permanecerá en el historial de versiones.` : "Verifique la disposición de la historia y edítela elemento por elemento una vez aceptada."}</p>
      </div>

      {"operations" in payload ? (
        <>
          {!readOnly && operations.length > 1 && <div className="flex items-center justify-between gap-2 text-xs">
            <span className="text-muted-foreground">Seleccionado {selectedIds.length} / {operations.length} Artículo</span>
            <Button type="button" size="sm" variant="ghost" disabled={isApplying}
              onClick={() => setSelectedIds(selectedIds.length === operations.length ? [] : allOperationIds)}>
              {selectedIds.length === operations.length ? "Deseleccionar todo" : "Seleccionar todo"}
            </Button>
          </div>}
          <ul className="divide-y divide-border/60">
            {operations.map(operation => {
              const fields = Object.keys(operation.fields ?? {});
              const ownMissing = missingDependencies.find(result => result.operationId === operation.operationId);
              return (
                <li key={operation.operationId} className="space-y-3 py-4">
                  <label className="flex cursor-pointer items-start gap-2">
                    {!readOnly && <input
                      type="checkbox"
                      className="mt-1 h-4 w-4 shrink-0 accent-primary"
                      disabled={isApplying}
                      checked={selected.has(operation.operationId)}
                      onChange={() => toggleOperation(operation.operationId)}
                    />}
                    <span className="text-sm font-medium">{operationTitle(operation, document)}</span>
                    {readOnly && appliedIds && <span className="text-xs text-muted-foreground">{appliedIds.includes(operation.operationId) ? "Adoptado" : "No adoptado"}</span>}
                  </label>
                  {operation.kind === "update_fields" && fields.length > 1 && <p className="text-xs text-muted-foreground">
                    {fields.map(field => outlineFieldLabels[field] ?? field).join(",")}total {fields.length} , constituyen una enmienda.
                  </p>}
                  {operation.dependsOn.length ? (
                    <p className="text-xs text-muted-foreground">
                      Requisitos previos:{operation.dependsOn.map(dependencyName).join(",")}
                    </p>
                  ) : null}
                  {!readOnly && ownMissing ? (
                    <p role="alert" className="text-xs text-destructive">
                      También es necesario comprobar:{ownMissing.dependencyIds.map(dependencyName).join(",")}
                    </p>
                  ) : null}
                  <FieldChanges operation={operation} document={document} titles={titles} version={stale ? currentVersion : proposal.baseVersion} current={stale ? currentDocument : undefined} oldVersion={proposal.baseVersion} historical={!stale && proposal.baseVersion !== currentVersion} />
                  <p className="text-xs text-muted-foreground">Motivo de la sugerencia:{displayText(operation.reason)}</p>
                  {operation.affectedNodeIds.length ? (
                    <p className="text-xs text-muted-foreground">Ámbito de influencia:{operation.affectedNodeIds.map(id => titles[id] ?? findOutlineNodeTitle(document, id)).join(",")}</p>
                  ) : null}
                  {operation.risks.length ? <p className="text-xs text-amber-700 dark:text-amber-400">Necesito prestar atención a:{displayText(operation.risks.join(";"))}</p> : null}
                </li>
              );
            })}
          </ul>
          {!readOnly && operations.length > 0 && !selectedIds.length ? <p role="alert" className="text-xs text-destructive">La adopción parcial requiere seleccionar al menos una acción.</p> : null}
          {!readOnly && missingDependencies.length ? <p role="alert" className="text-xs text-destructive">Verifique también las modificaciones asociadas marcadas arriba.</p> : null}
          {allMissingDependencies.length ? <p role="alert" className="text-xs text-destructive">La propuesta contiene operaciones dependientes desconocidas; abandone y regenere la propuesta.</p> : null}
        </>
      ) : <InitialDraftReading payload={payload} />}

      {renderContext?.(document)}
      {!readOnly && <div className="outline-reading-actions">
        {"operations" in payload ? operations.length > 0 && (
          <Button onClick={() => onApply(selectedIds)} disabled={isApplying || applyDisabled || !selectedIsComplete}>
            {isApplying ? "Procesando…" : personFields ? `Adopción${personName}este ${personFields} Modificar en todas partes` : `Aceptar el seleccionado (${selectedIds.length})`}
          </Button>
        ) : (
          <Button onClick={() => onApply([])} disabled={isApplying || applyDisabled}>{replacesOutline ? "Confirmar para reemplazar todo el esquema con este primer borrador." : "Utilice este primer borrador"}</Button>
        )}
        <Button variant="ghost" onClick={onLater} disabled={isApplying}>Dejar de lado por ahora</Button>
      </div>}
    </section>
  );
}
