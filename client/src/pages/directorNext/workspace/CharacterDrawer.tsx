import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getCharacterTimeline } from "@/api/novel";
import { getCharacterDynamicsOverview } from "@/api/novelCharacterDynamics";
import { queryKeys } from "@/api/queryKeys";
import { Button } from "@/components/ui/button";
import { AppDialogContent, Dialog } from "@/components/ui/dialog";
import { visibleCharacterHistory } from "./model";
import type { WorkspaceBook, WorkspaceCharacter } from "./model";
import { previewCharacterHistory } from "./previewBook";
import {CharacterAppearances} from "./characters/CharacterAppearances";
import { characterForwardPreviewKey, getCharacterForwardPreview } from "@/api/characterForwardAdjustment";
import type { CharacterForwardPreview } from "@ai-novel/shared/types/characterForwardAdjustment";

export function CharacterDrawer({ book, character, readingOrder, preview, onClose, onChapter, onPlan, onResources, onAdjust }: {
  book: WorkspaceBook; character: WorkspaceCharacter; readingOrder: number | null; preview: boolean;
  onClose: () => void; onChapter: (id: string) => void; onPlan: (id: string) => void;
  onResources?: (id:string) => void;
  onAdjust?: (preview: CharacterForwardPreview) => void;
}) {
  const [latest, setLatest] = useState(false);
  const historyQuery = useQuery({
    queryKey: ["director-workspace", "character-history", book.novel.id, character.id],
    queryFn: () => getCharacterTimeline(book.novel.id, character.id), enabled: !preview, retry: false, refetchInterval: 10000,
  });
  // The existing overview contains mutable latest fields even when chapterOrder is supplied.
  // Request/display it only after the reader explicitly chooses latest state.
  const latestQuery = useQuery({
    queryKey: queryKeys.novels.characterDynamicsOverview(book.novel.id),
    queryFn: () => getCharacterDynamicsOverview(book.novel.id), enabled: !preview && latest, retry: false, refetchInterval: 10000,
  });
  const history = visibleCharacterHistory(preview ? previewCharacterHistory[character.id] ?? [] : historyQuery.data?.data ?? [], latest ? "latest" : readingOrder);
  const latestCharacter = latestQuery.data?.data?.characters.find(row => row.characterId === character.id);
  const currentGoal = preview ? character.currentGoal : latestCharacter?.currentGoal;
  const currentState = preview ? (character.id === "lin" ? "Acepta a Shen Zhi en la ciudad y comienza a investigar las marcas de la ciudad vieja." : null) : latestCharacter?.currentState;
  const adjustmentQuery = useQuery({
    queryKey: characterForwardPreviewKey(book.novel.id, character.id),
    queryFn: () => getCharacterForwardPreview(book.novel.id, character.id),
    enabled: !preview && !!onAdjust, retry: false, refetchInterval: 10000,
  });
  const adjustment = adjustmentQuery.data;
  return <Dialog open onOpenChange={open => { if (!open) onClose(); }}>
    <AppDialogContent title={character.name} description="Ver los cambios de personajes y sus orígenes de capítulos." className="left-auto right-0 top-0 h-dvh max-h-dvh w-full max-w-md translate-x-0 translate-y-0 rounded-none sm:w-[420px]">
      <div className="flex gap-2" role="group" aria-label="Rango de registro de roles">
        <Button size="sm" variant={!latest ? "default" : "ghost"} onClick={() => setLatest(false)}>Lee este capitulo</Button>
        <Button size="sm" variant={latest ? "default" : "ghost"} onClick={() => setLatest(true)}>Último estado</Button>
      </div>
      <p className="mt-3 text-xs leading-6 text-muted-foreground">{latest ? "Contiene los registros guardados de todo el libro, que pueden revelar tramas posteriores." : readingOrder === null ? "Primero seleccione un capítulo para leer y luego vea los registros de cambios en el rango correspondiente." : `Mostrar solo el ${readingOrder} Registros de cambios de capítulo y anteriores.`}</p>
      {onResources ? <Button size="sm" variant="ghost" className="mt-3" onClick={()=>onResources(character.id)}>Ver mochilas y recursos</Button> : null}
      {!preview && onAdjust ? <div className="mt-3 space-y-2">
        <Button size="sm" variant="outline" disabled={!adjustment || !!adjustment.blockedReason || adjustmentQuery.isError}
          onClick={() => { if (adjustment) onAdjust(adjustment); }}>Ajustes de capítulos posteriores</Button>
        {adjustmentQuery.isError ? <p role="alert" className="text-xs text-destructive">
          {adjustmentQuery.error.message}<Button size="sm" variant="ghost" onClick={() => void adjustmentQuery.refetch()}>Reintentar</Button>
        </p> : adjustment?.blockedReason ? <p className="text-xs text-muted-foreground">{adjustment.blockedReason}</p> : null}
      </div> : null}
      {latest ? <section className="mt-6 space-y-3 rounded-md bg-muted/40 p-4">
        <h3 className="text-sm font-medium">Último estado guardado</h3>
        {!preview && latestQuery.isError ? <p role="alert" className="text-sm text-destructive">No se pudo leer el estado más reciente.<Button size="sm" variant="ghost" onClick={() => void latestQuery.refetch()}>Releer</Button></p>
          : latestQuery.isLoading && !preview ? <p className="text-sm text-muted-foreground">Leyendo el último estado...</p>
            : <><p className="whitespace-pre-wrap text-sm leading-7">{currentState || "Aún no hay descripción de estado"}</p><p className="whitespace-pre-wrap text-sm leading-7"><span className="text-muted-foreground">Objetivos de acción:</span>{currentGoal || "Aún no hay objetivo de acción"}</p><p className="text-xs text-muted-foreground">Este estado no proporciona una instantánea histórica capítulo por capítulo.</p></>}
      </section> : null}
      <CharacterAppearances novelId={book.novel.id} characterId={character.id} preview={preview} boundary={latest ? "latest" : readingOrder} planning={book.planning} notices={book.characterForwardPlanNotices} onSelect={target=>{if(target.kind==="chapter") onChapter(target.id);else onPlan(target.id);onClose();}}/>
      <section className="mt-7"><h3 className="text-sm font-semibold">Otros registros de cambios</h3>
        {!preview && historyQuery.isError ? <p role="alert" className="mt-4 text-sm text-destructive">Error en la lectura del registro de cambio.<Button size="sm" variant="ghost" onClick={() => void historyQuery.refetch()}>Releer</Button></p>
          : !preview && historyQuery.isLoading ? <p className="mt-4 text-sm text-muted-foreground">Leyendo registros de cambios...</p>
            : history.length === 0 ? <p className="mt-4 text-sm leading-7 text-muted-foreground">{readingOrder === null && !latest ? "No se han seleccionado capítulos para leer." : "Actualmente no hay cambios documentados en este rango. Los perfiles de personajes se pueden encontrar a continuación."}</p>
              : <ol className="mt-3 divide-y divide-border/50">{history.map(event => {
                const source = book.chapters.find(chapter => event.chapterId ? chapter.id === event.chapterId : chapter.order === event.chapterOrder);
                return <li key={event.id} className="space-y-2 py-4"><h4 className="text-sm font-medium">{event.title}</h4><p className="whitespace-pre-wrap text-sm leading-7 text-foreground/80">{event.content}</p>
                  {source ? <Button size="sm" variant="ghost" className="-ml-3 text-xs text-primary" onClick={() => { onChapter(source.id); onClose(); }}>Fuente: No. {source.order} capítulo · {source.title}</Button>
                    : <p className="text-xs text-muted-foreground">{typeof event.chapterOrder === "number" ? `Fuente: No. ${event.chapterOrder} Capítulo (el texto no está en el índice)` : "Fuente del capítulo no anotada"}</p>}
                </li>;
              })}</ol>}
      </section>
      <details className="mt-6 border-t border-border/50 pt-5"><summary className="cursor-pointer text-sm font-medium">Configuración de personajes·Información completa del libro</summary><dl className="mt-4 space-y-4 text-sm leading-7">
        <div><dt className="text-muted-foreground">Identidad</dt><dd>{character.role}</dd></div><div><dt className="text-muted-foreground">Personaje</dt><dd>{character.personality || "Aún no completado"}</dd></div><div><dt className="text-muted-foreground">Función en la historia</dt><dd>{character.storyFunction || "Aún no completado"}</dd></div>
      </dl></details>
    </AppDialogContent>
  </Dialog>;
}
