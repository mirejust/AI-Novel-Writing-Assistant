import { useEffect, useMemo, useState } from "react";
import type { Chapter, ChapterStatus } from "@ai-novel/shared/types/novel";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowLeft, BookOpen, Check, Copy, Download, Edit3, List, Settings2, X } from "lucide-react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { downloadNovelExport, getNovelChapters, getNovelDetail } from "@/api/novel";
import { queryKeys } from "@/api/queryKeys";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {getNovelWorkspaceHref, getDirectorWorkspaceHref} from "@/lib/novelRoutes";

function countWords(content: string | null | undefined): number {
  const text = content?.trim() ?? "";
  if (!text) return 0;
  const cjk = text.match(/[\u3400-\u9fff]/g)?.length ?? 0;
  const words = text.replace(/[\u3400-\u9fff]/g, " ").match(/[A-Za-z0-9]+(?:[-'][A-Za-z0-9]+)*/g)?.length ?? 0;
  return cjk + words;
}

function formatCount(value: number): string {
  return new Intl.NumberFormat("zh-CN").format(value);
}

function formatChapterStatus(status?: ChapterStatus | null): string {
  switch (status) {
    case "completed": return "Texto completado";
    case "pending_review": return "Para ser revisado";
    case "needs_repair": return "Para ser arreglado";
    case "generating": return "Generando";
    case "pending_generation": return "Pendiente de generar";
    case "unplanned": return "No planeado";
    default: return "No notificado";
  }
}

function chapterText(content: string | null | undefined): string {
  return content?.trim() ?? "";
}

async function copyText(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
    return;
  } catch {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "true");
    area.style.position = "fixed";
    area.style.left = "-9999px";
    document.body.appendChild(area);
    area.select();
    document.execCommand("copy");
    document.body.removeChild(area);
  }
}

function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

function safeFileNamePart(value: string): string {
  return value.replace(/[\\/:*?"<>|]/g, "-").trim() || "Novela";
}

export default function NovelPreview() {
  const { id = "" } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const [showChapters, setShowChapters] = useState(true);
  const [copied, setCopied] = useState(false);
  const selectedChapterId = searchParams.get("chapterId") ?? "";

  const novelQuery = useQuery({
    queryKey: queryKeys.novels.detail(id),
    queryFn: () => getNovelDetail(id),
    enabled: Boolean(id),
  });
  const chaptersQuery = useQuery({
    queryKey: queryKeys.novels.chapters(id),
    queryFn: () => getNovelChapters(id),
    enabled: Boolean(id),
  });

  const novel = novelQuery.data?.data ?? null;
  const directorHref = novel ? getDirectorWorkspaceHref(novel) : null;
  const workspaceHref = novel ? getNovelWorkspaceHref(novel) : `/novels/${encodeURIComponent(id)}/edit`;
  const chapters = useMemo(
    () => [...(chaptersQuery.data?.data ?? [])].sort((a, b) => a.order - b.order),
    [chaptersQuery.data?.data],
  );
  const generatedChapters = useMemo(() => chapters.filter((chapter) => chapterText(chapter.content)), [chapters]);
  const activeChapter = useMemo(
    () => chapters.find((chapter) => chapter.id === selectedChapterId) ?? generatedChapters[0] ?? chapters[0] ?? null,
    [chapters, generatedChapters, selectedChapterId],
  );
  const activeContent = chapterText(activeChapter?.content);
  const totalWordCount = useMemo(() => chapters.reduce((sum, chapter) => sum + countWords(chapter.content), 0), [chapters]);
  const downloadFullMutation = useMutation({
    mutationFn: () => downloadNovelExport(id, "txt", "full", novel?.title),
    onSuccess: ({ blob, fileName }) => {
      downloadBlob(blob, fileName);
      toast.success("La descarga del texto completo ha comenzado.");
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "No se pudo descargar el texto completo."),
  });

  useEffect(() => {
    if (!activeChapter || selectedChapterId === activeChapter.id) return;
    setSearchParams((previous) => {
      const next = new URLSearchParams(previous);
      next.set("chapterId", activeChapter.id);
      return next;
    }, { replace: true });
  }, [activeChapter, selectedChapterId, setSearchParams]);

  const selectChapter = (chapter: Chapter) => {
    setSearchParams((previous) => {
      const next = new URLSearchParams(previous);
      next.set("chapterId", chapter.id);
      return next;
    });
    if (!window.matchMedia("(min-width: 1024px)").matches) {
      setShowChapters(false);
    }
  };

  const handleCopy = async () => {
    if (!activeContent) return toast.error("No hay texto para el capítulo actual.");
    try {
      await copyText(activeContent);
      setCopied(true);
      toast.success("El texto ha sido copiado.");
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      toast.error("Error al copiar. Seleccione manualmente el texto que desea copiar.");
    }
  };

  const handleDownloadChapter = () => {
    if (!activeChapter || !activeContent) return toast.error("No hay texto para el capítulo actual.");
    const title = safeFileNamePart(novel?.title ?? "Novela");
    const chapterTitle = activeChapter.title?.trim() ? safeFileNamePart(activeChapter.title) : "";
    downloadBlob(
      new Blob(["\uFEFF", `Cap. ${activeChapter.order}${chapterTitle ? ` ${chapterTitle}` : ""}\n\n${activeContent}`], { type: "text/plain;charset=utf-8" }),
      `${title}-No.${activeChapter.order}Cap.${chapterTitle ? `-${chapterTitle}` : ""}.txt`,
    );
    toast.success("Se ha iniciado la descarga del texto de este capítulo.");
  };

  if (!id) {
    return <div className="flex min-h-full items-center justify-center"><Button asChild><Link to="/novels">Volver a la lista de novelas</Link></Button></div>;
  }

  const isLoading = novelQuery.isPending || chaptersQuery.isPending;
  const isError = novelQuery.isError || chaptersQuery.isError;

  if (isLoading) {
    return <div className="flex min-h-full items-center justify-center text-sm text-muted-foreground">Trabajo de apertura...</div>;
  }
  if (isError) {
    return (
      <div className="flex min-h-full flex-col items-center justify-center gap-4 text-center">
        <p className="text-sm text-muted-foreground">Esta obra no se puede abrir en este momento.</p>
        <Button onClick={() => { void novelQuery.refetch(); void chaptersQuery.refetch(); }}>Recargar</Button>
      </div>
    );
  }
  if (chapters.length === 0) {
    return (
      <div className="flex min-h-full flex-col items-center justify-center gap-4 text-center">
        <BookOpen className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
        <p className="text-sm text-muted-foreground">Esta obra aún no tiene capítulos para leer.</p>
        <Button asChild><Link to={workspaceHref}>{directorHref ? "Abre el escritorio del director." : "Ingresar al espacio de trabajo"}</Link></Button>
      </div>
    );
  }

  return (
    <div className="relative h-full overflow-y-auto bg-background text-foreground">
      <header className="sticky top-0 z-20 border-b border-border/70 bg-background/90 backdrop-blur">
        <div className={cn("mx-auto flex h-16 max-w-5xl items-center justify-between gap-4 px-5 transition-[padding]", showChapters && "lg:pl-[22.5rem]")}>
          <div className="flex items-center gap-1">
            {!showChapters ? (
              <Button type="button" variant="ghost" size="sm" className="-ml-2 text-muted-foreground hover:text-foreground" onClick={() => setShowChapters(true)} title="Abrir directorio" aria-label="Abrir directorio">
                <List className="h-4 w-4" />
              </Button>
            ) : null}
            <Button asChild variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
              <Link to="/novels" aria-label="Volver a la estantería"><ArrowLeft className="h-4 w-4" /></Link>
            </Button>
          </div>
          <div className="min-w-0 flex-1 text-center">
            <div className="truncate text-sm font-medium">{novel?.title ?? "Vista previa de la novela"}</div>
            <div className="mt-0.5 text-xs text-muted-foreground">{activeChapter ? `Cap. ${activeChapter.order}` : "Leer"}</div>
          </div>
          <div className="flex items-center gap-1">
            <Button type="button" variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground" onClick={handleDownloadChapter} disabled={!activeContent} title="Descarga este capitulo" aria-label="Descarga este capitulo">
              <Download className="h-4 w-4" /><span className="ml-1.5 hidden xl:inline">este capitulo</span>
            </Button>
            <Button type="button" variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground" onClick={() => downloadFullMutation.mutate()} disabled={downloadFullMutation.isPending || generatedChapters.length === 0} title="Descarga el libro completo" aria-label="Descarga el libro completo">
              <BookOpen className="h-4 w-4" /><span className="ml-1.5 hidden xl:inline">Todo el libro</span>
            </Button>
            <Button asChild variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground" title="Espacio de trabajo abierto" aria-label="Espacio de trabajo abierto">
              <Link to={`/novels/${id}/edit`}><Settings2 className="h-4 w-4" /></Link>
            </Button>
          </div>
        </div>
      </header>

      <main className={cn("px-6 pb-24 pt-16 transition-[padding] sm:px-10 sm:pt-20", showChapters && "lg:pl-[22.5rem]")}>
        <div className="mx-auto max-w-3xl">
          <div className="mb-12 text-center">
          <div className="text-xs tracking-[0.22em] text-muted-foreground">{novel?.status === "published" ? "PUBLISHED" : "DRAFT"}</div>
          <h1 className="mt-4 text-3xl font-semibold tracking-normal text-foreground sm:text-4xl">{novel?.title ?? "Vista previa de la novela"}</h1>
          <p className="mt-3 text-sm text-muted-foreground">{formatCount(totalWordCount)} Personaje · {generatedChapters.length}/{chapters.length} El capítulo ha sido generado.</p>
          </div>

          <article className="whitespace-pre-wrap text-[17px] leading-[2.15] text-foreground sm:text-[18px]">
            {activeContent || "Aún no hay texto para este capítulo."}
          </article>

          <footer className="mt-20 flex items-center justify-center gap-2 border-t border-border/70 pt-6">
            <Button type="button" variant="ghost" size="sm" className="text-muted-foreground" onClick={() => void handleCopy()} disabled={!activeContent}>
              {copied ? <Check className="mr-1.5 h-4 w-4" /> : <Copy className="mr-1.5 h-4 w-4" />}
              {copied ? "Copiado" : "Copia este capítulo"}
            </Button>
            {activeChapter ? (
                <Button asChild variant="ghost" size="sm" className="text-muted-foreground">
                <Link to={`/novels/${id}/chapters/${activeChapter.id}`}><Edit3 className="mr-1.5 h-4 w-4" />Editar este capítulo</Link>
              </Button>
            ) : null}
          </footer>
        </div>
      </main>

      {showChapters ? (
        <>
          <button type="button" aria-label="Cerrar directorio" className="fixed inset-0 z-30 bg-foreground/20 lg:hidden" onClick={() => setShowChapters(false)} />
          <aside className="fixed inset-y-0 left-0 z-40 flex w-[min(360px,88vw)] flex-col border-r border-border bg-background shadow-xl lg:shadow-none">
            <div className="flex items-center justify-between border-b border-border/70 px-5 py-4">
              <div><div className="font-medium">Tabla de contenido</div><div className="mt-1 text-xs text-muted-foreground">{generatedChapters.length}/{chapters.length} capítulo · {formatCount(totalWordCount)} Palabras</div></div>
              <Button type="button" variant="ghost" size="sm" onClick={() => setShowChapters(false)} title="Cerrar directorio" aria-label="Cerrar directorio"><X className="h-4 w-4" /></Button>
            </div>
            <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto p-3">
              {chapters.map((chapter) => {
                const hasContent = Boolean(chapterText(chapter.content));
                return (
                  <button key={chapter.id} type="button" className={cn("w-full rounded-md px-3 py-3 text-left transition hover:bg-muted/70", activeChapter?.id === chapter.id && "bg-muted")} onClick={() => selectChapter(chapter)}>
                    <div className="flex items-center justify-between gap-3"><span className="text-sm font-medium">Cap. {chapter.order} Cap.</span><span className="text-xs text-muted-foreground">{formatCount(countWords(chapter.content))} Palabras</span></div>
                    <div className="mt-1 truncate text-sm text-muted-foreground">{chapter.title || "Capítulo sin título"}</div>
                    <div className="mt-1 text-xs text-muted-foreground">{hasContent ? formatChapterStatus(chapter.chapterStatus) : "Aún no hay texto"}</div>
                  </button>
                );
              })}
            </nav>
          </aside>
        </>
      ) : null}
    </div>
  );
}
