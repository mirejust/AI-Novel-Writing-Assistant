import {useState} from "react";
import {useMutation, useQuery, useQueryClient} from "@tanstack/react-query";
import type {DirectorCharacterCandidatePage, DirectorCharacterCandidateReview, CharacterCandidateAction} from "@ai-novel/shared/types/director/characterCandidates";
import {getDirectorCharacterCandidates, resolveDirectorCharacterCandidates} from "@/api/directorNext";
import {Button} from "@/components/ui/button";
import {queryKeys} from "@/api/queryKeys";

export function useDirectorCharacterCandidates(runId: string, enabled: boolean) {
  return useQuery({queryKey: ["director-character-candidates", runId], enabled,
    queryFn: () => getDirectorCharacterCandidates(runId), refetchInterval: enabled ? 4000 : false});
}

interface CandidateProps {runId: string; novelId: string; proseReview?: boolean; onResolved?: () => void}

function Review({review, page, runId, novelId, proseReview, onResolved}: CandidateProps & {review: DirectorCharacterCandidateReview; page: DirectorCharacterCandidatePage}) {
  const queryClient = useQueryClient();
  const pending = review.items.filter(i => i.status === "pending");
  const [choices, setChoices] = useState<Record<string, {action: CharacterCandidateAction | ""; targetId?: string}>>(() => Object.fromEntries(pending.map(i => [i.id,
    {action: i.recommendation === "defer" ? "" : i.recommendation, targetId: i.targetId ?? undefined}])));
  const mutation = useMutation({mutationFn: async () => {
    await resolveDirectorCharacterCandidates(runId, {reviewId: review.id, revision: review.revision, contentHash: review.contentHash,
      decisions: pending.map(i => ({candidateId: i.id, action: choices[i.id].action as CharacterCandidateAction, targetId: choices[i.id].targetId}))});
  }, onSuccess: async () => {
    await Promise.all([
      queryClient.invalidateQueries({queryKey: ["director-character-candidates", runId]}),
      queryClient.invalidateQueries({queryKey: queryKeys.directorNext.summary(novelId)}),
      queryClient.invalidateQueries({queryKey: queryKeys.directorNext.detail(novelId)}),
      queryClient.invalidateQueries({queryKey: ["directorBookWorkspace", novelId]}),
      queryClient.invalidateQueries({queryKey: ["director-character-appearances", novelId]}),
    ]);
    onResolved?.();
  }});
  const complete = pending.every(i => choices[i.id]?.action && (choices[i.id].action !== "merge" || choices[i.id].targetId));
  const handled = review.items.length - pending.length;
  return <div className="space-y-3 py-3">
    <p className="text-sm font-medium">Cap. {review.chapterOrder} Cap.{pending.length ? ` · ${pending.length} bits pendientes` : ` · Procesado ${handled} persona`}</p>
    {review.blocking ? <p className="text-xs leading-5 text-muted-foreground">{proseReview
      ? "Caracteres a comprobar en el manuscrito revisado. Después de seleccionar el método de procesamiento, puede continuar confirmando el texto de este lote."
      : "Después de verificar los caracteres en este capítulo, haga clic en \"Continuar desde el progreso guardado\". El texto principal se conservará y los personajes confirmados se utilizarán en creaciones posteriores."}</p> : null}
    {pending.map(item => <div key={item.id} className="space-y-2 rounded-md bg-muted/30 p-3">
      <p className="text-sm font-medium">{item.name}{item.role ? ` · ${item.role}` : ""}</p>
      {item.summary ? <p className="text-xs leading-5">{item.summary}</p> : null}
      <p className="text-xs leading-5 text-muted-foreground">{item.reason}</p>
      {item.evidence.length ? <details className="text-xs text-muted-foreground"><summary className="cursor-pointer">Ver base de texto</summary><p className="mt-2 whitespace-pre-wrap leading-5">{item.evidence.join("\n")}</p></details> : null}
      <label className="block text-xs">Método de procesamiento
        <select aria-label={`${item.name}Método de procesamiento`} className="mt-1 w-full rounded-md border border-input bg-background p-2" disabled={!page.editable || mutation.isPending}
          value={choices[item.id]?.action ?? ""} onChange={e => setChoices(c => ({...c, [item.id]: {...c[item.id], action: e.target.value as CharacterCandidateAction | ""}}))}>
          <option value="">Por favor seleccione</option><option value="create">Agregado como personaje en este libro.</option><option value="merge">Asociar un rol existente</option><option value="ignore">Ignora a este candidato</option>
        </select>
      </label>
      {choices[item.id]?.action === "merge" ? <label className="block text-xs">rol asociado
        <select aria-label={`${item.name}Rol asociado`} className="mt-1 w-full rounded-md border border-input bg-background p-2" disabled={!page.editable || mutation.isPending}
          value={choices[item.id]?.targetId ?? ""} onChange={e => setChoices(c => ({...c, [item.id]: {...c[item.id], targetId: e.target.value}}))}>
          <option value="">Por favor selecciona un personaje en este libro</option>{page.characters.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </label> : null}
    </div>)}
    {pending.length ? <>
      {!page.editable ? <p className="text-xs text-muted-foreground">Se puede confirmar una vez completada esta ronda de procesamiento del capítulo; Los caracteres a verificar no bloquearán la creación automática.</p> : null}
      <Button className="h-auto w-full whitespace-normal py-2" disabled={!page.editable || !complete || mutation.isPending} onClick={() => mutation.mutate()}>{mutation.isPending ? "Guardando…" : "Confirme los resultados del procesamiento de caracteres en este capítulo."}</Button>
    </> : null}
    {mutation.isError ? <p role="alert" className="text-xs text-destructive">{mutation.error.message}</p> : null}
  </div>;
}

export default function DirectorCharacterCandidates({page, ...props}: CandidateProps & {page?: DirectorCharacterCandidatePage}) {
  if (!page?.reviews.length) return null;
  const pending = page.reviews.filter(r => r.items.some(i => i.status === "pending"));
  const handled = page.reviews.flatMap(r => r.items).filter(i => i.status !== "pending").length;
  return <section className="border-t border-border/60 py-4" aria-label="Personajes de este capítulo.">
    <h3 className="text-sm font-semibold">Personajes descubiertos en el texto.</h3>
    {handled ? <p className="mt-2 text-xs text-muted-foreground">Esta creación ha sido procesada. {handled} Hay candidatos a personajes y la información del personaje se puede ver en el directorio de la izquierda.</p> : null}
    {pending.map(review => <Review key={`${review.id}:${review.revision}`} review={review} page={page} {...props}/>)}
  </section>;
}
