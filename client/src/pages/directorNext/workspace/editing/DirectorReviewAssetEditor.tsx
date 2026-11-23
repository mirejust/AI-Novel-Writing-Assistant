import {useEffect, useRef, useState} from "react";
import {useMutation, useQueryClient} from "@tanstack/react-query";
import {castReviewFields, volumeReviewFields, reviewAssetEditSchema, type ReviewAssetEdit} from "@ai-novel/shared/types/director/revision";
import {createDirectorCommandKey, submitDirectorCommand, type DirectorWorkspace} from "@/api/directorNext";
import type {ApiHttpError} from "@/api/client";
import {queryKeys} from "@/api/queryKeys";
import {Button} from "@/components/ui/button";
import {AppDialogContent, Dialog} from "@/components/ui/dialog";
import {castFieldLabels} from "@ai-novel/shared/types/director/castReview/discussion";
import {volumeFieldLabels} from "@ai-novel/shared/types/director/volumeReview/discussion";
import {ReviewDiscussion} from "./discussion/ReviewDiscussion";
import {acceptReviewSuggestions, reviewFieldKey} from "./discussion/draft";

type Field = ReviewAssetEdit["changes"][number]["field"];
const labels: Record<Field, string> = {
  ...castFieldLabels, ...volumeFieldLabels,
};

function editableRows(book: DirectorWorkspace, type: ReviewAssetEdit["type"]) {
  return type === "character_cast"
    ? book.materials.characters.map(person => ({id: person.id, title: person.name,
      fields: castReviewFields.map(field => ({field, value: person[field] ?? ""}))}))
    : (book.planning?.volumes ?? []).map(volume => ({id: volume.id, title: `Cap. ${volume.sortOrder} rollo · ${volume.title}`,
      fields: volumeReviewFields.map(field => ({field, value: volume[field] ?? ""}))}));
}

export function DirectorReviewAssetEditor({book, type, runId, expectedVersion, onClose}: {
  book: DirectorWorkspace; type: ReviewAssetEdit["type"]; runId: string; expectedVersion: number; onClose: () => void;
}) {
  const queries = useQueryClient();
  const [rows] = useState(() => editableRows(book, type));
  const [planVersionId] = useState(book.planning?.activeVersionId);
  const isVolume = type === "volume_strategy";
  const staleVersion = isVolume && planVersionId !== book.planning?.activeVersionId;
  const [selectedId, setSelectedId] = useState(rows[0]?.id);
  const selectedRow = rows.find(row => row.id === selectedId);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [messages, setMessages] = useState<Record<string, string>>({});
  const [discarding, setDiscarding] = useState(false);
  const request = useRef({body: "", key: ""});
  const changes = rows.flatMap(row => row.fields.flatMap(({field, value}) => {
    const draft = drafts[reviewFieldKey(row.id, field)];
    return draft === undefined || draft.trim() === value.trim() ? [] : [{id: row.id, field, before: value, after: draft.trim()}];
  }));
  const novelId = book.novel.id;
  const scope = type === "character_cast" ? {type} : planVersionId ? {type, planVersionId} : null;
  const base = selectedRow && Object.fromEntries(selectedRow.fields.map(({field, value}) => [field, value]));
  const draft = selectedRow && Object.fromEntries(selectedRow.fields.map(({field, value}) =>
    [field, drafts[reviewFieldKey(selectedRow.id, field)] ?? value]));
  const hasUnsaved = !!changes.length || Object.values(messages).some(text => text.trim());
  useEffect(() => {
    if (!hasUnsaved) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [hasUnsaved]);
  const save = useMutation({
    mutationFn: () => {
      const expectedVolumePlanVersionId = isVolume ? planVersionId ?? undefined : undefined;
      if (!changes.length) {
        if (request.current.body !== "confirm") request.current = {body: "confirm", key: createDirectorCommandKey()};
        return submitDirectorCommand({type: "resolve_gate", runId, expectedVersion, decision: "confirm", expectedVolumePlanVersionId, idempotencyKey: request.current.key});
      }
      const parsed = reviewAssetEditSchema.safeParse({type, changes});
      if (!parsed.success) throw new Error("Verifique las modificaciones y guarde hasta 100 campos a la vez.");
      const body = JSON.stringify(parsed.data);
      if (request.current.body !== body) request.current = {body, key: createDirectorCommandKey()};
      return submitDirectorCommand({type: "resolve_gate", runId, expectedVersion, decision: "confirm_after_edit", expectedVolumePlanVersionId, assetEdit: parsed.data, idempotencyKey: request.current.key});
    },
    onError: error => {
      if ((error as ApiHttpError).status === 409) {
        void queries.invalidateQueries({queryKey: ["directorBookWorkspace", novelId]});
      }
    },
    onSuccess: async () => {
      await Promise.all([["directorBookWorkspace", novelId], queryKeys.directorNext.summary(novelId), queryKeys.directorNext.detail(novelId)]
        .map(queryKey => queries.invalidateQueries({queryKey})));
      onClose();
    },
  });
  function close() {
    if (save.isPending) return;
    if (hasUnsaved) setDiscarding(true);
    else onClose();
  }
  const confirmLabel = isVolume
    ? changes.length ? "Guarde los cambios y continúe descomprimiendo capítulos." : "Confirme el esquema y continúe descomprimiendo los capítulos."
    : changes.length ? "Guardar cambios y continuar" : "Confirmar alineación y continuar";
  return <Dialog open onOpenChange={open => {if (!open) close();}}>
    <AppDialogContent title={type === "character_cast" ? "Discutir y editar elencos" : "Discutir y editar esquemas"}
      description={type === "character_cast" ? "Elige un personaje para discutir o editar directamente. Puedes ajustar varios personajes, guardarlos juntos y continuar." : "Seleccione un volumen para discutirlo o editarlo directamente. Puede ajustar varios volúmenes, confirmarlos juntos y continuar abriendo capítulos."}
      className={scope ? "lg:h-[min(48rem,90dvh)] lg:max-w-6xl" : undefined}
      bodyClassName={scope ? "grid gap-5 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:overflow-hidden" : undefined}
      footer={discarding ? <><p className="mr-auto text-sm">Al cerrar se descartan los cambios no guardados.</p><Button variant="ghost" onClick={() => setDiscarding(false)}>Continuar editando</Button><Button variant="outline" onClick={onClose}>Descartar cambios y cerrar</Button></>
        : <><Button variant="ghost" disabled={save.isPending} onClick={close}>Cancelar</Button><Button disabled={!selectedRow || save.isPending || staleVersion} onClick={() => save.mutate()}>{save.isPending ? "Guardando…" : confirmLabel}</Button></>}>
      <div className={scope ? "min-w-0 lg:overflow-y-auto lg:pr-2" : undefined}>
      {rows.length > 1 ? <label className="grid gap-1 text-sm">{type === "character_cast" ? "Seleccionar rol" : "Seleccionar volumen"}
        <select className="rounded-md border border-input bg-background px-3 py-2" value={selectedId} disabled={save.isPending} onChange={event => setSelectedId(event.target.value)}>
          {rows.map(row => <option key={row.id} value={row.id}>{row.title}</option>)}
        </select>
      </label> : <h3 className="font-medium">{selectedRow?.title}</h3>}
      {selectedRow ? <div className="mt-3 grid gap-3">{selectedRow.fields.map(({field, value}) => {
          const key = reviewFieldKey(selectedRow.id, field);
          return <label key={field} className="grid gap-1 text-sm">{labels[field]}
            <textarea className="rounded-md border border-input bg-background px-3 py-2" rows={3} maxLength={12000} disabled={save.isPending}
              value={drafts[key] ?? value} onChange={event => {const next = event.target.value; setDrafts(previous => ({...previous, [key]: next}));}}/>
          </label>;
        })}</div> : null}
      {changes.length > 0 ? <p className="mt-3 text-xs text-muted-foreground" role="status">ser salvo {changes.length} Modificar en todas partes</p> : null}
      {staleVersion && <p role="alert" className="mt-3 text-sm text-destructive">La versión general ha cambiado; ciérrela y vuelva a abrirla.</p>}
      {save.isError ? <p role="alert" className="mt-3 text-sm text-destructive">{save.error.message}</p> : null}
      </div>
      {selectedRow && scope && base && draft && <ReviewDiscussion key={selectedRow.id} scope={scope} novelId={novelId} runId={runId} version={expectedVersion}
        subject={selectedRow} base={base} draft={draft} disabled={save.isPending || discarding || staleVersion}
        message={messages[selectedRow.id] ?? ""} onMessage={value => setMessages(previous => ({...previous, [selectedRow.id]: value}))}
        onAccept={items => setDrafts(previous => acceptReviewSuggestions(previous, selectedRow.id, base, items))}/>}
    </AppDialogContent>
  </Dialog>;
}
