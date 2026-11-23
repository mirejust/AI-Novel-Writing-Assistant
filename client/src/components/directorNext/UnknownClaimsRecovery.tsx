import {useState} from "react";
import {useMutation, useQueryClient} from "@tanstack/react-query";
import type {DirectorUnknownClaimsView} from "@ai-novel/shared/types/director/unknownClaims";
import {createDirectorCommandKey, submitDirectorCommand} from "@/api/directorNext";
import {queryKeys} from "@/api/queryKeys";
import {Button} from "@/components/ui/button";

export default function UnknownClaimsRecovery({claims, runId, novelId, expectedVersion, disabled = false}: {
  claims: DirectorUnknownClaimsView; runId: string; novelId: string; expectedVersion: number; disabled?: boolean;
}) {
  const [checked, setChecked] = useState(false);
  const [commandKey, setCommandKey] = useState(createDirectorCommandKey);
  const [deferred, setDeferred] = useState(false);
  const queries = useQueryClient();
  const mutation = useMutation({mutationFn: () => {
    if (!checked) throw new Error("Abra este capítulo y verifique el texto primero, luego confirme y vuelva a ejecutar.");
    return submitDirectorCommand({type: "resume", runId, expectedVersion, idempotencyKey: commandKey,
      resolveUnknownClaims: {chapterId: claims.chapterId}});
  }, onSuccess: async () => {
    await Promise.all([
      queries.invalidateQueries({queryKey: queryKeys.directorNext.summary(novelId)}),
      queries.invalidateQueries({queryKey: queryKeys.directorNext.detail(novelId)}),
      queries.invalidateQueries({queryKey: queryKeys.directorNext.runs(false)}),
      queries.invalidateQueries({queryKey: queryKeys.directorNext.runs(true)}),
    ]);
  }});
  const busy = disabled || mutation.isPending || mutation.isSuccess;
  if (deferred) return <section id="director-unknown-claims" className="space-y-3 py-4" role="status">
    <p className="text-xs leading-5 text-muted-foreground">Cap. {claims.chapterOrder} El capítulo permanece en pausa y el progreso se guarda. Puedes volver en cualquier momento para confirmar después de comprobar el texto.</p>
    <Button size="sm" variant="ghost" disabled={disabled} onClick={() => setDeferred(false)}>Ver pasos por confirmar</Button>
  </section>;
  return <section id="director-unknown-claims" aria-labelledby="unknown-claims-title" className="scroll-mt-4 space-y-3 border-t border-border/60 py-4">
    <h3 id="unknown-claims-title" className="text-sm font-semibold">Cap. {claims.chapterOrder} Los resultados de un paso del capítulo aún no se han confirmado.</h3>
    <p role="status" className="text-xs leading-5 text-muted-foreground">Cuando se interrumpió la creación, los resultados de este paso no se guardaron y fue imposible confirmar si la ejecución se completó en ese momento. Para evitar ejecuciones repetidas, la creación se detiene aquí esperando su confirmación.</p>
    <p className="text-xs leading-5 text-muted-foreground">Abra la primera página del directorio de la izquierda. {claims.chapterOrder} Capítulo Verifique el texto: cuando el texto esté completo y sea correcto, marque la casilla a continuación para confirmar, y AI volverá a ejecutar este paso y continuará creando; Si falta el texto o es anormal, no lo confirme todavía y mantenga el estado de pausa.</p>
    <label className="flex items-start gap-2 text-xs leading-5"><input type="checkbox" className="mt-1" checked={checked} disabled={busy}
      onChange={event => {setChecked(event.target.checked); setCommandKey(createDirectorCommandKey());}}/>He comprobado el {claims.chapterOrder} Texto del capítulo, confirme que el texto esté completo y sea correcto.</label>
    <Button className="w-full" disabled={busy || !checked} onClick={() => mutation.mutate()}>{mutation.isPending ? "Enviando…" : mutation.isSuccess ? "Presentado, restaurando..." : "Confirma y vuelve a ejecutar este paso."}</Button>
    <Button className="w-full" variant="ghost" disabled={busy} onClick={() => setDeferred(true)}>Permanecer en pausa</Button>
    {mutation.isError ? <p role="alert" className="text-xs text-destructive">{mutation.error.message}</p> : null}
  </section>;
}
