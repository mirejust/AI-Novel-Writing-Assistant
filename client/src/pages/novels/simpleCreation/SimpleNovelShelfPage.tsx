import { useEffect, useMemo, useState } from "react";
import DirectorVersionControl from "@/components/directorVersion/DirectorVersionControl";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowLeft,
  BookOpen,
  BookOpenText,
  CheckCircle2,
  Clock3,
  Eye,
  FileText,
  Loader2,
  PauseCircle,
  Settings2,
  Sparkles,
} from "lucide-react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import type { ChapterQualityDebtDetails, ChapterQualityDebtSource } from "@ai-novel/shared/types/chapterQualityLoop";
import type { SimpleCreationShelfChapterStatus } from "@ai-novel/shared/types/novel";
import {
  getSimpleCreationShelf,
  setNovelCreationExperience,
} from "@/api/novel";
import { continueNovelWorkflow } from "@/api/novelWorkflow";
import { queryKeys } from "@/api/queryKeys";
import { stripLegacyTaskUrlParams } from "@/lib/legacyTaskUrlParams";
import { getTaskCenterLink } from "@/lib/novelWorkflowTaskUi";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/toast";
import SimpleCreationMaterialsPanel from "./SimpleCreationMaterialsPanel";
import OnboardingTip from "@/components/onboarding/OnboardingTip";
import SimpleCreationIssueGovernancePanel from "./SimpleCreationIssueGovernancePanel";
import NovelBookDeliveryActions from "../components/NovelBookDeliveryActions";

const STATUS_LABELS: Record<SimpleCreationShelfChapterStatus, string> = {
  waiting_planning: "Esperando planificación",
  waiting_writing: "Esperando para escribir",
  generating: "Generando",
  reviewing: "Revisando y reparando",
  quality_debt: "Guardado · Por optimizar",
  replan_required: "Esperando una nueva planificación",
  completed: "Completado",
  error: "Incidencia",
};

const QUALITY_DEBT_SOURCE_LABELS: Record<ChapterQualityDebtSource, string> = {
  manual_review: "Revisión manual",
  pipeline_review: "Revisión de texto de IA",
  repair_recheck: "Revisión después de la corrección de IA",
};

function formatQualityDebtSource(source: ChapterQualityDebtSource | null): string {
  return source ? QUALITY_DEBT_SOURCE_LABELS[source] : "Registros históricos de calidad";
}

function formatQualityDebtAttempts(details: ChapterQualityDebtDetails): string {
  if (details.repairAttemptsUsed === null) {
    return `No se ha registrado el número de veces · Actualmente el más ${details.repairAttemptsAllowed} veces`;
  }
  if (details.repairAttemptsAllowed === 0) {
    return `${details.repairAttemptsUsed} veces · La reparación automática no está habilitada esta vez`;
  }
  return `${details.repairAttemptsUsed}/${details.repairAttemptsAllowed} veces`;
}

function formatQualityDebtTime(value: string | null): string {
  if (!value) return "Tiempo no registrado";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Tiempo no registrado"
    : date.toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function formatUpdatedAt(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Hora de actualización desconocida"
    : `actualizado el ${date.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;
}

function formatWordCount(value: number): string {
  return `${Math.max(0, Math.round(value)).toLocaleString()} palabras`;
}

export default function SimpleNovelShelfPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const [selectedChapterId, setSelectedChapterId] = useState("");

  useEffect(() => {
    const cleaned = stripLegacyTaskUrlParams(searchParams);
    if (cleaned.toString() !== searchParams.toString()) {
      setSearchParams(cleaned, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const shelfQuery = useQuery({
    queryKey: queryKeys.novels.simpleShelf(id),
    queryFn: () => getSimpleCreationShelf(id),
    enabled: Boolean(id),
    refetchInterval: (query) => {
      const status = query.state.data?.data?.progress.status;
      return status === "running" || status === "queued" ? 3000 : 10000;
    },
  });
  const shelf = shelfQuery.data?.data ?? null;
  const readableChapters = useMemo(
    () => shelf?.chapters.filter((chapter) => Boolean(chapter.content?.trim())) ?? [],
    [shelf?.chapters],
  );
  const selectedChapter = useMemo(
    () => readableChapters.find((chapter) => chapter.id === selectedChapterId)
      ?? readableChapters.at(-1)
      ?? null,
    [readableChapters, selectedChapterId],
  );

  useEffect(() => {
    if (selectedChapter && selectedChapter.id !== selectedChapterId) {
      setSelectedChapterId(selectedChapter.id);
    }
  }, [selectedChapter, selectedChapterId]);

  useEffect(() => {
    if (shelf?.novel.creationExperience === "professional") {
      navigate(`/novels/${id}/edit`, { replace: true });
    }
  }, [id, navigate, shelf?.novel.creationExperience]);

  const retryMutation = useMutation({
    mutationFn: async () => {
      const directorTaskId = shelf?.progress.directorTaskId;
      if (!directorTaskId) {
        throw new Error("No se encontraron tareas de IA reanudables.");
      }
      // 书架已投影出本书最近的自动导演任务。重规划检查点会将任务标记为
      // failed，因此不能再用“仅运行中任务”的查询覆盖这个恢复锚点。
      return continueNovelWorkflow(directorTaskId, { continuationMode: "auto_execute_range" });
    },
    onSuccess: async () => {
      toast.success(shelf?.progress.recoveryAction === "replan_and_continue"
        ? "AI conserva el texto existente, vuelve a planificar los capítulos siguientes y continúa creando."
        : "La IA está clasificando el contenido de seguimiento y continúa creando.");
      await queryClient.invalidateQueries({ queryKey: queryKeys.novels.simpleShelf(id) });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "La restauración falló, inténtelo de nuevo."),
  });

  const switchExperienceMutation = useMutation({
    mutationFn: () => setNovelCreationExperience(id, "professional"),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["novels", id] });
      navigate(`/novels/${id}/edit`, { replace: true });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "No se pudo cambiar de modo, inténtalo de nuevo."),
  });

  if (shelfQuery.isPending || !shelf) {
    return <div className="flex min-h-[60vh] items-center justify-center text-muted-foreground"><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Estantería del capítulo de apertura</div>;
  }

  const savedDraftCount = readableChapters.length;
  const stableChapterCount = shelf.progress.completedChapters;
  const totalChapterCount = shelf.progress.totalChapters || shelf.chapters.length;
  const interruption = shelf.progress.interruption;
  const interruptionTitle = interruption && {
    replan: "Es necesario volver a planificar los capítulos siguientes.",
    failed: "Interrupción creativa",
    waiting_confirmation: "Espere la confirmación antes de continuar.",
    paused: "La creación está en pausa",
  }[interruption.kind];

  return (
    <div className="min-h-screen bg-muted/20">
      <div className="mx-auto max-w-[1480px] space-y-4 px-3 py-4 sm:px-5 lg:px-8">
        <header className="overflow-hidden rounded-3xl border border-border bg-background shadow-sm">
          <div className="bg-muted/[0.28] px-5 py-5 sm:px-7 sm:py-6">
            <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
              <div className="min-w-0">
                <Button variant="ghost" size="sm" asChild className="-ml-2 px-2 text-muted-foreground hover:bg-background hover:text-foreground">
                  <Link to="/novels"><ArrowLeft className="h-4 w-4" /> Volver a la lista de novelas</Link>
                </Button>
                <div className="mt-4 flex items-start gap-3">
                  <span className="hidden h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 sm:flex">
                    <BookOpenText className="h-6 w-6 text-primary" />
                  </span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h1 className="truncate text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">{shelf.novel.title}</h1>
                      <DirectorVersionControl novelId={id!} version="v1" />
                      <Badge variant="outline">Modo fácil·Estantería de lectura</Badge>
                    </div>
                    <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Aquí se da prioridad al texto principal y al avance del libro. AI continuará planificando, escribiendo y revisando en segundo plano; puedes cambiar de estación de trabajo en cualquier momento cuando necesites ver el material completo.</p>
                  </div>
                </div>
              </div>

              <div className="w-full rounded-2xl border border-border/80 bg-background/80 p-4 shadow-sm xl:max-w-sm">
                <div className="flex items-center justify-between gap-3 text-sm text-foreground">
                  <span className="text-muted-foreground">El progreso de esta creación.</span>
                  <span className="font-semibold">{shelf.progress.percent}%</span>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-primary/70 transition-all" style={{ width: `${shelf.progress.percent}%` }} />
                </div>
                <div className="mt-3 flex items-start gap-2 text-xs leading-5 text-muted-foreground">
                  {shelf.progress.status === "paused" || shelf.progress.status === "failed" ? <PauseCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" /> : <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" />}
                  <span>{shelf.progress.currentAction}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 divide-x border-t border-border sm:grid-cols-4">
            <div className="p-4 sm:px-6"><div className="text-xs text-muted-foreground">Proyecto estable</div><div className="mt-1 text-xl font-semibold text-foreground">{stableChapterCount}<span className="ml-1 text-sm font-normal text-muted-foreground">/ {totalChapterCount || "—"} Cap.</span></div></div>
            <div className="p-4 sm:px-6"><div className="text-xs text-muted-foreground">Texto guardado</div><div className="mt-1 text-xl font-semibold text-foreground">{savedDraftCount}<span className="ml-1 text-sm font-normal text-muted-foreground">Los capítulos se pueden leer.</span></div></div>
            <div className="p-4 sm:px-6"><div className="text-xs text-muted-foreground">Tarea actual</div><div className="mt-1 truncate text-sm font-medium text-foreground">{shelf.progress.status === "paused" ? "En pausa, esperando para reanudar" : shelf.progress.currentAction}</div></div>
            <div className="p-4 sm:px-6"><div className="text-xs text-muted-foreground">Artículos de calidad a seguir</div><div className="mt-1 text-xl font-semibold text-foreground">{shelf.materials.openQualityDebtCount}<span className="ml-1 text-sm font-normal text-muted-foreground">Banda</span></div></div>
          </div>

          <div className="flex flex-wrap items-center gap-2 border-t border-border bg-muted/20 px-5 py-3 sm:px-7">
            {shelf.progress.directorTaskId ? (
              <Button variant="outline" size="sm" asChild>
                <Link to={getTaskCenterLink(shelf.progress.directorTaskId)}>Ver el progreso de AI Director</Link>
              </Button>
            ) : null}
            {shelf.progress.canRetry ? (
              <Button size="sm" onClick={() => retryMutation.mutate()} disabled={retryMutation.isPending}>
                {retryMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                {shelf.progress.recoveryAction === "replan_and_continue" ? "Continuar después de volver a planificar" : "Seguir creando"}
              </Button>
            ) : null}
            <div className="flex-1" />
            <NovelBookDeliveryActions novelId={id} title={shelf.novel.title} completion={shelf.bookCompletion} allowDraftExport />
            <Button variant="ghost" size="sm" onClick={() => switchExperienceMutation.mutate()} disabled={switchExperienceMutation.isPending}><Settings2 className="h-4 w-4" /> Modo profesional</Button>
          </div>
          {interruption ? (
            <div className="flex items-start gap-3 border-t border-amber-200 bg-amber-50 px-5 py-3 text-sm leading-6 text-amber-950 sm:px-7">
              <AlertTriangle className="mt-1 h-4 w-4 shrink-0 text-amber-600" />
              <div>
                <div className="font-medium">{interruptionTitle}</div>
                {interruption.detail ? <div className="text-amber-900/75">{interruption.detail}</div> : null}
              </div>
            </div>
          ) : null}
        </header>

        <OnboardingTip
          storageKey="simple-creation-shelf"
          title="Leer texto guardado"
          description="El texto guardado aparecerá en la estantería de manera oportuna; Los capítulos que se están revisando o reparando aún pueden actualizarse y se convertirán en un manuscrito estable cuando se completen."
          next="Seleccione un capítulo a la izquierda para leer la versión actual."
        />

        <SimpleCreationIssueGovernancePanel
          novelId={id}
          directorTaskId={shelf.progress.directorTaskId}
        />
        <SimpleCreationMaterialsPanel materials={shelf.materials} />

        <section className="flex min-h-[650px] flex-col overflow-hidden rounded-3xl border border-border bg-background shadow-sm lg:sticky lg:top-4 lg:h-[calc(100dvh-6rem)] lg:min-h-[560px]">
          <div className="flex shrink-0 flex-col gap-2 border-b border-border px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary"><FileText className="h-4 w-4" /></span>
              <div><div className="font-semibold text-foreground">Escritorio de lectura de textos</div><div className="text-xs text-muted-foreground">Después de seleccionar un capítulo, lea la versión guardada actualmente a la derecha</div></div>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-xs text-muted-foreground">{savedDraftCount} El capítulo tiene texto · {stableChapterCount} El capítulo se ha estabilizado.</div>
              <Button variant="outline" size="sm" asChild>
                <Link to={`/novels/${id}/preview${selectedChapter ? `?chapterId=${encodeURIComponent(selectedChapter.id)}` : ""}`}>
                  <Eye className="h-4 w-4" /> Ingrese al modo de vista previa
                </Link>
              </Button>
            </div>
          </div>

          <div className="grid min-h-0 flex-1 lg:grid-cols-[300px_minmax(0,1fr)]">
            <aside className="min-h-0 border-b border-border bg-muted/20 p-3 lg:overflow-y-auto lg:border-b-0 lg:border-r">
              <div className="flex items-center justify-between px-2 py-2">
                <div className="text-sm font-semibold text-foreground">Índice del capítulo</div>
                <Badge variant="secondary">{shelf.chapters.length} Cap.</Badge>
              </div>
              <div className="space-y-2 pr-1">
                {shelf.chapters.length === 0 ? <div className="rounded-xl border border-dashed border-border bg-background p-4 text-sm leading-6 text-muted-foreground">AI está preparando el plan del libro y el primer lote de capítulos aparecerá automáticamente aquí a medida que aparecen.</div> : null}
                {shelf.chapters.map((chapter) => {
                  const readable = Boolean(chapter.content?.trim());
                  const active = selectedChapter?.id === chapter.id;
                  return (
                    <button
                      key={chapter.id}
                      type="button"
                      disabled={!readable}
                      onClick={() => setSelectedChapterId(chapter.id)}
                      className={`group w-full rounded-2xl border p-3 text-left transition ${active ? "border-primary bg-primary/10 shadow-sm" : "border-border/70 bg-background hover:border-primary/40 hover:bg-primary/[0.03]"} ${readable ? "" : "cursor-default opacity-60"}`}
                    >
                      <div className="flex items-start gap-3">
                        <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-xs font-semibold ${active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                          {chapter.order}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-start justify-between gap-2">
                            <span className="min-w-0 truncate text-sm font-medium text-foreground">{chapter.title || "Esperando el nombre"}</span>
                            <Badge className={`shrink-0 ${chapter.status === "quality_debt" ? "border-amber-200 bg-amber-50 text-amber-800" : ""}`} variant={chapter.status === "completed" ? "outline" : chapter.status === "replan_required" || chapter.status === "error" ? "destructive" : "secondary"}>{STATUS_LABELS[chapter.status]}</Badge>
                          </span>
                          <span className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                            {readable ? chapter.status === "quality_debt" ? <><AlertTriangle className="h-3 w-3 text-amber-600" /> {formatWordCount(chapter.wordCount)}</> : <><CheckCircle2 className="h-3 w-3 text-emerald-600" /> {formatWordCount(chapter.wordCount)}</> : <><Clock3 className="h-3 w-3" /> Esperando texto</>}
                          </span>
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
              <div className="mt-3 rounded-xl border border-border/70 bg-background px-3 py-2 text-xs leading-5 text-muted-foreground">
                Los problemas de calidad ordinarios se registrarán como asuntos a seguir y no interrumpirán la producción de todo el libro.
              </div>
            </aside>

            <main className="min-w-0 bg-background lg:min-h-0 lg:overflow-y-auto">
              {selectedChapter?.content ? (
                <>
                  <div className="border-b border-border/80 bg-background px-5 py-5 sm:px-8 lg:sticky lg:top-0 lg:z-10">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-medium tracking-wide text-muted-foreground">Cap. {selectedChapter.order} Cap.</span>
                      <Badge className={selectedChapter.status === "quality_debt" ? "border-amber-200 bg-amber-50 text-amber-800" : ""} variant={selectedChapter.status === "completed" ? "outline" : selectedChapter.status === "replan_required" || selectedChapter.status === "error" ? "destructive" : "secondary"}>{STATUS_LABELS[selectedChapter.status]}</Badge>
                      <span className="text-xs text-muted-foreground">{formatWordCount(selectedChapter.wordCount)} · {formatUpdatedAt(selectedChapter.updatedAt)}</span>
                    </div>
                    <h2 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">{selectedChapter.title}</h2>
                    {selectedChapter.status === "quality_debt" ? (
                      <div className="mt-3 rounded-xl bg-amber-50 px-3 py-3 text-xs leading-5 text-amber-950">
                        <div className="flex items-start gap-2">
                          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
                          <div className="min-w-0 flex-1">
                            <div className="font-medium">El texto principal se ha guardado y los problemas locales no bloquearán la creación posterior.</div>
                            {selectedChapter.qualityDebt ? (
                              <>
                                <div className="mt-1 text-amber-900/80">{selectedChapter.qualityDebt.reason}</div>
                                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-amber-900/70">
                                  <span>Fuente:{formatQualityDebtSource(selectedChapter.qualityDebt.source)}</span>
                                  <span>Reparación automática:{formatQualityDebtAttempts(selectedChapter.qualityDebt)}</span>
                                  <span>{formatQualityDebtTime(selectedChapter.qualityDebt.evaluatedAt)}</span>
                                </div>
                                <Button asChild size="sm" variant="outline" className="mt-3 bg-background text-foreground">
                                  <Link to={`/novels/${id}/chapters/${encodeURIComponent(selectedChapter.id)}`}>Revisar y volver a revisar</Link>
                                </Button>
                              </>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    ) : selectedChapter.status === "replan_required" ? (
                      <div className="mt-3 flex items-start gap-2 rounded-xl border border-destructive/20 bg-destructive/5 px-3 py-2 text-xs leading-5 text-destructive">
                        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                        <span>La organización de este capítulo y los capítulos adyacentes requiere que AI vuelva a planificar primero y se conservará el texto principal.</span>
                      </div>
                    ) : selectedChapter.status !== "completed" ? (
                      <div className="mt-3 flex items-start gap-2 rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-xs leading-5 text-sky-900">
                        <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-sky-600" />
                        <span>La versión guardada se muestra actualmente y puede actualizarse después de que AI complete la revisión o las correcciones.</span>
                      </div>
                    ) : null}
                  </div>
                  <article className="mx-auto max-w-3xl px-5 py-8 pb-20 text-[16px] leading-8 text-foreground sm:px-10 sm:py-10 sm:pb-24 lg:px-14">
                    <div className="whitespace-pre-wrap">{selectedChapter.content}</div>
                  </article>
                </>
              ) : (
                <div className="flex min-h-full items-center justify-center px-6 py-20 text-center">
                  <div className="max-w-md">
                    <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-background text-muted-foreground shadow-sm"><BookOpen className="h-7 w-7" /></span>
                    <div className="mt-5 text-lg font-semibold text-foreground">Seleccione un capítulo con texto</div>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">Una vez completado el capítulo, aparecerá en la tabla de contenido de la izquierda. Los capítulos que se están revisando también se pueden leer con anticipación desde la versión guardada actualmente.</p>
                  </div>
                </div>
              )}
            </main>
          </div>
        </section>

      </div>
    </div>
  );
}
