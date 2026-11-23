import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams, useSearchParams, useLocation, useNavigate } from "react-router-dom";
import { getDirectorRunDetail, getDirectorRuntimeStatus, getDirectorSummary, getDirectorWorkspace, type DirectorDriver } from "@/api/directorNext";
import {directorPollInterval} from "./polling";
import { getNovelDetail } from "@/api/novel";
import { queryKeys } from "@/api/queryKeys";
import { Button } from "@/components/ui/button";
import DirectorPanel, {type PanelPlanEditorRenderer} from "@/components/directorNext/DirectorPanel";
import DirectorBadge from "@/components/directorNext/DirectorBadge";
import {OutlineBookSource} from "@/components/outlines/OutlineBookSource";
import OutlineWritingControls from "@/components/outlines/OutlineWritingControls";
import DirectorStart from "@/components/directorNext/DirectorStart";
import { ResizableWorkspace } from "@/components/layout/resizableWorkspace";
import { previewStates, previewTimeline, previewView } from "./preview";
import { NovelWorkspace, previewBook, resolveSavedReview } from "./workspace";
import { useGenerationFollow, useWorkspaceActivity } from "./generation";
import DirectorVersionControl from "@/components/directorVersion/DirectorVersionControl";
import { DirectorProseReview, DirectorChapterEditor, DirectorChapterPlanEditor, DirectorReviewAssetEditor } from "./workspace/editing";
import {FinalReviewDialog} from "./workspace/finalReview/FinalReviewDialog";
import NovelBookDeliveryActions from "@/pages/novels/components/NovelBookDeliveryActions";

export default function DirectorNovelPage({ previewOnly = false }: { previewOnly?: boolean }) {
  const { novelId: routeNovelId = "" } = useParams();
  const novelId = previewOnly ? "preview" : routeNovelId;
  const [params, setParams] = useSearchParams();
  const location=useLocation();
  const navigate = useNavigate();
  const preview = novelId === "preview";
  const queryClient = useQueryClient();
  const [editingChapterId, setEditingChapterId] = useState<string|null>(null);
  const [adjustingCharacter, setAdjustingCharacter] = useState(false);
  const [editedChapter, setEditedChapter] = useState<{id:string;revision:number}|null>(null);
  useEffect(()=>{setEditingChapterId(null);setEditedChapter(null);setAdjustingCharacter(false);},[novelId]);
  const follow = useGenerationFollow(novelId, preview);
  useEffect(()=>{
    const type=params.get("review");
    if (!preview && type && [...params.keys()].some(key=>key!=="review")) setParams({review:type},{replace:true});
  },[params,preview,setParams]);
  const [directorOpen, setDirectorOpen] = useState(true);
  const poll = (query: {state: {error: unknown; errorUpdateCount: number}}) => directorPollInterval(query.state.error, query.state.errorUpdateCount);
  const summaryQuery = useQuery({ queryKey: queryKeys.directorNext.summary(novelId), queryFn: () => getDirectorSummary(novelId), enabled: !preview && !!novelId, retry: false, refetchInterval: poll });
  const runId = summaryQuery.data?.data?.runId;
  const detailQuery = useQuery({ queryKey: [...queryKeys.directorNext.detail(novelId),runId], queryFn: () => getDirectorRunDetail(runId!), enabled: !preview && !!runId && !summaryQuery.isError, retry: false, refetchInterval: poll });
  const diagnosticQuery = useQuery({queryKey: ["directorRuntimeStatus",novelId], queryFn: () => getDirectorRuntimeStatus(novelId), enabled: !preview && !!novelId && (summaryQuery.isError || detailQuery.isError), retry: false, refetchInterval: false});
  const bookQuery = useQuery({ queryKey: ["directorBookWorkspace",novelId], queryFn: () => getDirectorWorkspace(novelId), enabled: !preview && !!novelId, retry: false, refetchInterval: query => query.state.error ? directorPollInterval(query.state.error,query.state.errorUpdateCount) : 10000 });
  const book = preview ? previewBook : bookQuery.data?.data;
  const savedReview=book ? resolveSavedReview(book,params) : null;
  const detail = detailQuery.data?.data;
  const novelQuery = useQuery({queryKey: ["directorNovelMetadata",novelId],queryFn:()=>getNovelDetail(novelId),enabled:!preview && !!novelId,retry:false});
  const view = preview ? previewView(params.get("state") ?? "running") : detail?.view ?? summaryQuery.data?.data;
  useWorkspaceActivity(novelId, preview, view?.workspaceActivity, detail ? detailQuery.dataUpdatedAt : summaryQuery.dataUpdatedAt);
  const error = detailQuery.error ?? summaryQuery.error;
  const diagnostic = diagnosticQuery.data?.data;
  const metadata = novelQuery.data?.data;
  useEffect(() => {
    if (!preview && metadata?.directorVersion === "v1") navigate(`/novels/${encodeURIComponent(novelId)}/edit`, {replace: true});
  }, [metadata?.directorVersion, navigate, novelId, preview]);
  const startForm = !preview && book && metadata ? (range: {from:number;to:number}|null, driver: DirectorDriver = "assisted") => book.outlineBinding ? <OutlineWritingControls key={`${view?.runId ?? novelId}:${book.chapters.filter(chapter=>chapter.content?.trim()).length}`} book={book} initialStory={metadata.description ?? ""} worldId={metadata.worldId}/> : <DirectorStart key={`${view?.runId ?? novelId}:${range?.from ?? "planning"}`} novelId={novelId} estimatedChapterCount={book.novel.estimatedChapterCount} nextChapter={Math.max(0,...book.chapters.filter(chapter=>chapter.content?.trim()).map(chapter=>chapter.order))+1} initialStory={book.continuationStoryInput ?? metadata.description ?? ""} worldId={metadata.worldId} suggestedRange={range} initialDriver={driver}/> : null;

  const reviewType = savedReview?.type;
  const plans = savedReview?.plans;
  const renderReviewEditor: PanelPlanEditorRenderer | undefined =
    preview || bookQuery.isError || !book || !savedReview?.ready ? undefined
      : reviewType === "chapter_task_sheet" && plans?.length ? input => <DirectorChapterPlanEditor novelId={novelId} plans={plans} approvalFingerprint={book.chapterReviewFingerprint} activeVersionId={book.planning?.activeVersionId} {...input}/>
      : reviewType === "chapter_batch_closed" && savedReview.chapters?.length && book.proseReviewHashes ? (input, nextRange) =>
          <DirectorProseReview novelId={novelId} chapters={savedReview.chapters!} hashes={book.proseReviewHashes!} nextRange={nextRange} onConfirmed={()=>setParams({}, {replace:true})} {...input}/>
      : reviewType === "character_cast" || reviewType === "volume_strategy" ? input => <DirectorReviewAssetEditor book={book} type={reviewType} {...input}/>
      : undefined;
  return (
    <div className="flex h-full min-h-0 w-full min-w-0 flex-col gap-3">
      <header className="flex min-w-0 shrink-0 flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-border/60 pb-2">
        <div className="flex min-w-0 flex-1 basis-full flex-wrap items-center gap-x-4 gap-y-2 lg:basis-auto">
          <h1 title={book?.novel.title} className="min-w-0 truncate text-lg font-semibold">{book?.novel.title ?? "Creación novedosa"}</h1>
          {!preview ? <DirectorVersionControl novelId={novelId} version="v2"/> : <span className="text-sm">Director V2</span>}
          {!error && view ? <DirectorBadge view={view} novelId={novelId} modeOnly/> : null}
          <label className="flex shrink-0 cursor-pointer items-center gap-2 rounded-md bg-muted/40 px-3 py-2 text-sm" title="Abra automáticamente el material o capítulo que se está generando y admita una vista previa en tiempo real del texto.">
            <input type="checkbox" checked={follow.enabled} disabled={preview || !!editingChapterId || adjustingCharacter} onChange={event => follow.setEnabled(event.target.checked)} className="h-4 w-4 accent-primary"/>
            seguir la generación
          </label>
        </div>
        <div className="flex shrink-0 flex-wrap gap-1 [&_button]:h-8 [&_a]:h-8">
          {!previewOnly ? <Button asChild variant="ghost"><Link to="/novels">Volver a la estantería</Link></Button> : null}
          <Button variant="ghost" aria-expanded={directorOpen} onClick={() => setDirectorOpen(open => !open)}>{directorOpen ? "Cierra el escritorio del director." : "Mostrar escritorio del director"}</Button>
          {params.has("review") ? <Button asChild variant="ghost"><Link to={`/lab/director/${encodeURIComponent(novelId)}`}>Volver al libro</Link></Button> : null}
          {!previewOnly ? <Button asChild variant="ghost"><Link to="/lab/director">Registro de operación</Link></Button> : null}
          {!preview ? <Button asChild variant="ghost"><Link to={`/novels/${encodeURIComponent(novelId)}/ai-usage`}>Uso de IA</Link></Button> : null}
        </div>
      </header>
      {!preview && !bookQuery.isError && book?.bookCompletion?.status === "completed" ? (
        <><NovelBookDeliveryActions novelId={novelId} title={book.novel.title} completion={book.bookCompletion} onFinalReview={book.bookCompletion.finalReviewRoute ? ()=>setParams({delivery:"review"}) : undefined}/>
          {book.bookCompletion.finalReviewRoute && params.get("delivery")==="review" && <FinalReviewDialog key={novelId} novelId={novelId} onClose={()=>setParams({}, {replace:true})}/>}</>
      ) : null}
      {book?.outlineBinding ? <OutlineBookSource binding={book.outlineBinding}/> : null}
      {follow.disconnected ? <p role="status" className="text-xs text-muted-foreground">La conexión de vista previa de texto se interrumpió y se está reconectando. La tarea de creación continúa ejecutándose.</p> : null}
      {preview ? <details className="rounded-md bg-muted/30 px-4 py-3"><summary className="cursor-pointer text-xs text-muted-foreground">Vista previa de muestra · Cambiar estado de director</summary><p className="mt-3 text-xs text-muted-foreground">Esta página utiliza contenido de muestra con los comandos de creación deshabilitados.</p><div className="mt-3 flex flex-wrap gap-2">{previewStates.map((state) => <Button key={state.id} size="sm" variant={(params.get("state") ?? "running") === state.id ? "default" : "ghost"} onClick={() => setParams({ state: state.id })}>{state.label}</Button>)}</div></details> : null}
      <ResizableWorkspace id="director-novel-layout" className="min-h-0 flex-1" label="Ajustar el texto y el ancho del escritorio del director." defaultLeft={78} minLeft={580} minRight={280} breakpoint={920} left={<div className="flex h-full min-h-0 min-w-0 flex-col">
          {!preview && bookQuery.isError ? <div role="alert" className="mb-4 space-y-2 rounded-md bg-destructive/5 p-4"><p className="text-sm text-destructive">No se pudo leer el contenido de este libro.{book ? "Aún puedes ver la última lectura." : ""}</p><Button variant="outline" size="sm" onClick={() => void bookQuery.refetch()}>Vuelva a leer este libro</Button></div> : null}
          {book ? <NovelWorkspace key={novelId} book={book} preview={preview} review={params} onLeaveReview={()=>setParams({})} onOpenChapterReview={preview ? undefined : ()=>setParams({review:"chapter_task_sheet"})} followGeneration={follow.enabled && !editingChapterId && !adjustingCharacter} generation={follow.snapshot} activity={view?.workspaceActivity} onEditChapter={preview ? undefined : setEditingChapterId} editedChapter={editedChapter} onAdjustingCharacter={setAdjustingCharacter} /> : <p className="py-12 text-sm text-muted-foreground">{bookQuery.isLoading ? "Leyendo este libro..." : "Actualmente no hay contenido para mostrar."}</p>}
        </div>} right={directorOpen ? <aside aria-label="Escritorio del director" className="h-full min-h-0 min-w-0 overflow-y-auto overscroll-contain px-3 py-1">
          {!preview && error ? <div role="alert" className="space-y-3 py-4"><p className="text-sm text-destructive">{error instanceof Error ? error.message : "No se pudo leer la información del director."}</p>
            {diagnostic ? <div className="space-y-2 text-sm"><p>Estado de ejecución guardado:{diagnostic.status} · Versión {diagnostic.controlVersion}</p>{diagnostic.lastFailure ? <p>Motivo de la interrupción reciente:{diagnostic.lastFailure.message}</p> : null}<p className="text-muted-foreground">El progreso del texto es temporalmente ilegible. Resuelva el motivo y vuelva a leer.</p></div> : diagnosticQuery.isError ? <p className="text-sm">Los diagnósticos de ejecución también son temporalmente ilegibles.</p> : null}
            <Button variant="outline" onClick={() => void Promise.all([summaryQuery.refetch(), ...(runId ? [detailQuery.refetch()] : []), diagnosticQuery.refetch()])}>Releer</Button></div>
            : view ? <DirectorPanel view={view} novelId={novelId} outlineBound={Boolean(book?.outlineBinding)} timeline={preview ? previewTimeline : detail?.timeline} preview={preview} startForm={startForm} reviewTarget={savedReview ? location.pathname+location.search : undefined} reviewReady={Boolean(savedReview?.ready) && !bookQuery.isError} reviewCanRegenerate={Boolean(savedReview?.canRegenerate) && !bookQuery.isError} reviewRunId={savedReview?.runId} reviewVersion={savedReview?.controlVersion}
                proseApproval={reviewType === "chapter_task_sheet" && book?.planning?.activeVersionId && book.chapterReviewFingerprint
                  ? {planVersionId:book.planning.activeVersionId, approveForProse:book.chapterReviewFingerprint} : undefined}
                renderPlanEditor={renderReviewEditor}/>
              : <p className="py-4 text-sm text-muted-foreground">{summaryQuery.isLoading || detailQuery.isLoading ? "Cargando información del director..." : "Elija su alcance creativo y deje que la IA continúe con el libro."}</p>}
          {!error && !view ? startForm?.(null):null}
        </aside> : null}/>
      {!preview && editingChapterId ? <DirectorChapterEditor key={`${novelId}:${editingChapterId}`} novelId={novelId} chapterId={editingChapterId}
        onClose={()=>setEditingChapterId(null)} onSaved={async()=>{
          await queryClient.invalidateQueries({queryKey:["directorBookWorkspace",novelId]});
          setEditedChapter(previous=>({id:editingChapterId,revision:(previous?.revision ?? 0)+1}));
        }}/> : null}
    </div>
  );
}
