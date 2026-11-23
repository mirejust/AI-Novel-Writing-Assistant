import { useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { getChapterEditorWorkspace, getNovelDetail } from "@/api/novel";
import { queryKeys } from "@/api/queryKeys";
import { Button } from "@/components/ui/button";
import { AppDialogContent, Dialog } from "@/components/ui/dialog";
import { toast } from "@/components/ui/toast";
import ChapterEditorShell from "@/pages/novels/components/chapterEditor/ChapterEditorShell";

export function DirectorChapterEditor({ novelId, chapterId, onClose, onSaved }: {
  novelId: string; chapterId: string; onClose: () => void; onSaved: () => Promise<void>;
}) {
  const editingState = useRef({ isDirty: false, isBusy: false, hasCandidate: false });
  const detailQuery = useQuery({
    queryKey: queryKeys.novels.detail(novelId), queryFn: () => getNovelDetail(novelId),
    refetchOnWindowFocus: false,
  });
  const workspaceQuery = useQuery({
    queryKey: queryKeys.novels.chapterEditorWorkspace(novelId, chapterId),
    queryFn: () => getChapterEditorWorkspace(novelId, chapterId), staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false, refetchOnReconnect: false,
  });
  const chapter = detailQuery.data?.data?.chapters.find(row => row.id === chapterId);
  function requestClose() {
    const state = editingState.current;
    if (state.isBusy) {
      toast.error("Espere hasta que se complete la operación actual antes de abandonar la edición de texto.");
      return;
    }
    if ((state.isDirty || state.hasCandidate) && !window.confirm("Los cambios no guardados se pueden restaurar desde borradores y los candidatos de IA no adoptados se cerrarán. ¿Quieres dejar la edición de texto?")) return;
    onClose();
  }
  return <Dialog open onOpenChange={open => { if (!open) requestClose(); }}>
    <AppDialogContent title={chapter ? `Editar texto · No. ${chapter.order} Capítulo · ${chapter.title}` : "Editar texto"}
      description="Haga clic en el texto para colocar el cursor, seleccione la dirección de continuación en el área de operación de IA, compare los candidatos e inserte el texto. Pausa la generación de seguimiento durante la edición."
      className="left-0 top-0 h-dvh max-h-dvh w-full max-w-none translate-x-0 translate-y-0 rounded-none border-0"
      bodyClassName="flex min-h-0 flex-col overflow-hidden p-3 sm:p-4"
      onInteractOutside={event => event.preventDefault()}>
      {detailQuery.isError ? <div role="alert" className="space-y-3 py-8 text-sm"><p>Error al leer el capítulo, léalo nuevamente y luego edítelo.</p><Button onClick={() => void detailQuery.refetch()}>Releer el capítulo</Button></div>
        : !chapter ? <p className="py-8 text-sm text-muted-foreground">{detailQuery.isLoading ? "Leyendo capítulos..." : "Este capítulo no fue encontrado, regrese a la tabla de contenido para seleccionar un capítulo."}</p>
          : <ChapterEditorShell key={chapter.id} novelId={novelId} chapter={chapter}
            workspace={workspaceQuery.data?.data ?? null}
            workspaceStatus={workspaceQuery.isLoading ? "loading" : workspaceQuery.isError ? "error" : "ready"}
            backLabel="Volver a la lectura de texto" onBack={onClose} onChapterSaved={onSaved}
            onEditingStateChange={state => { editingState.current = state; }}
            onRefreshWorkspace={() => { void workspaceQuery.refetch(); }} isRefreshingWorkspace={workspaceQuery.isFetching}/>
      }
    </AppDialogContent>
  </Dialog>;
}
