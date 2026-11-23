import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { characterForwardFieldLabels, characterForwardFieldNames, type CharacterForwardPreview } from "@ai-novel/shared/types/characterForwardAdjustment";
import { getCharacterForwardPreview, characterForwardPreviewKey, saveCharacterForwardAdjustment } from "@/api/characterForwardAdjustment";
import type { ApiHttpError } from "@/api/client";
import { queryKeys } from "@/api/queryKeys";
import { Button } from "@/components/ui/button";
import { AppDialogContent, Dialog } from "@/components/ui/dialog";
import { toast } from "@/components/ui/toast";

export function CharacterForwardAdjustDialog({ novelId, character, initialPreview, onClose }: {
  novelId: string;
  character: { id: string; name: string };
  initialPreview: CharacterForwardPreview;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [base, setBase] = useState(initialPreview);
  const [fields, setFields] = useState(initialPreview.fields);
  const [discarding, setDiscarding] = useState(false);
  const changed = characterForwardFieldNames.filter(field => (fields[field]?.trim() || null) !== (base.fields[field]?.trim() || null));
  const refresh = useMutation({
    mutationFn: () => getCharacterForwardPreview(novelId, character.id),
    onSuccess: next => {
      setBase(next);
      setFields(next.fields);
      save.reset();
      queryClient.setQueryData(characterForwardPreviewKey(novelId, character.id), next);
    },
  });
  const save = useMutation({
    mutationFn: () => saveCharacterForwardAdjustment(novelId, character.id, {
      effectiveFromChapterOrder: base.effectiveFromChapterOrder,
      fingerprint: base.fingerprint,
      fields: Object.fromEntries(changed.map(field => [field, fields[field]?.trim() || null])),
    }),
    onSuccess: result => {
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: ["directorBookWorkspace", novelId] }),
        queryClient.invalidateQueries({ queryKey: ["director-workspace", "character-history", novelId, character.id] }),
        queryClient.invalidateQueries({ queryKey: ["director-character-appearances", novelId] }),
        queryClient.invalidateQueries({ queryKey: queryKeys.novels.characterDynamicsOverview(novelId) }),
        queryClient.invalidateQueries({ queryKey: characterForwardPreviewKey(novelId, character.id) }),
      ]);
      toast.success(`Ajustes de personajes guardados, comenzando con ${result.effectiveFromChapterOrder} Vigente a partir de este Capítulo.`);
      onClose();
    },
  });
  const conflict = (save.error as ApiHttpError | null)?.status === 409;
  const pending = save.isPending || refresh.isPending;
  function requestClose() {
    if (pending) return;
    if (changed.length) setDiscarding(true);
    else onClose();
  }

  return <Dialog open onOpenChange={open => { if (!open) requestClose(); }}>
    <AppDialogContent title={`Ajuste ${character.name}`} description="Revise el estado del personaje, los objetivos de acción o los arcos de crecimiento para escritura posterior."
      footer={discarding ? <>
        <p className="mr-auto text-sm text-muted-foreground">Al cerrar se descartan los cambios no guardados.</p>
        <Button variant="ghost" onClick={() => setDiscarding(false)}>Continuar editando</Button>
        <Button variant="outline" onClick={onClose}>Abandonar cambios</Button>
      </> : <>
        <Button variant="ghost" disabled={pending} onClick={requestClose}>Cancelar</Button>
        <Button disabled={pending || !changed.length || !!base.blockedReason || conflict} onClick={() => save.mutate()}>
          {save.isPending ? "Guardando…" : "Guardar ajustes"}
        </Button>
      </>}>
      <div className="space-y-5">
        <section className="space-y-2 rounded-md bg-muted/40 p-4 text-sm">
          {base.blockedReason ? <p role="status">{base.blockedReason}</p> : <>
            <h3 className="font-medium">desde el primero {base.effectiveFromChapterOrder} En vigor a partir de la fecha del Capítulo</h3>
            <p className="text-muted-foreground">{base.effectiveFromChapterOrder > 1
              ? `1er a ${base.effectiveFromChapterOrder - 1} El capítulo no se ve afectado. Guardar no reescribirá el texto.`
              : "Guardar no reescribirá el texto."}</p>
            {base.affectedPlans.length ? <>
              <p className="font-medium">Plan de capítulo que se comprobará después de guardar</p>
              <ul className="max-h-28 list-disc space-y-1 overflow-y-auto pl-5 text-muted-foreground">
                {base.affectedPlans.map(plan => <li key={plan.planId}>Cap. {plan.chapterOrder} capítulo · {plan.title}</li>)}
              </ul>
            </> : <p className="text-muted-foreground">Actualmente no hay planes de capítulos para verificar.</p>}
          </>}
        </section>
        {characterForwardFieldNames.map(field => <label key={field} className="block space-y-2 text-sm">
          <span>{characterForwardFieldLabels[field]}</span>
          <textarea className="w-full rounded-md border border-input bg-background px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
            value={fields[field] ?? ""} onChange={event => setFields(previous => ({ ...previous, [field]: event.target.value }))}
            rows={field === "development" ? 4 : 2} maxLength={4000} disabled={pending || !!base.blockedReason || discarding}/>
        </label>)}
        {save.isError || refresh.isError ? <p role="alert" className="text-sm text-destructive">{refresh.error?.message ?? save.error?.message}</p> : null}
        {conflict || base.blockedReason ? <Button variant="outline" disabled={pending || discarding} onClick={() => refresh.mutate()}>
          {refresh.isPending ? "Vista previa…" : "Vista previa y restablecer el formulario nuevamente"}
        </Button> : null}
      </div>
    </AppDialogContent>
  </Dialog>;
}
