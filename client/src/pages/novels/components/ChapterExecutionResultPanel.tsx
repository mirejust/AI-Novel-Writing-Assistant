import type {
  Chapter,
  StoryPlan,
} from "@ai-novel/shared/types/novel";
import type { SSEFrame } from "@ai-novel/shared/types/api";
import { useEffect, useRef } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import MarkdownViewer from "@/components/common/MarkdownViewer";
import {
  hasText,
  resolveDisplayedChapterStatus,
  type AssetTabKey,
} from "./chapterExecution.shared";

interface ChapterExecutionResultPanelProps {
  selectedChapter: Chapter | undefined;
  onOpenReferencePanel: (tab: Exclude<AssetTabKey, "content">) => void;
  chapterPlan?: StoryPlan | null;
  streamContent: string;
  isStreaming: boolean;
  streamingChapterId?: string | null;
  streamingChapterLabel?: string | null;
  chapterRunStatus?: Extract<SSEFrame, { type: "run_status" }> | null;
  onAbortStream: () => void;
  onRunFullAudit: () => void;
  isRunningFullAudit: boolean;
  onAutoRepair: () => void;
  isRepairStreaming: boolean;
  repairStreamingChapterId?: string | null;
}

function WorkspaceNotice(props: { title: string; description: string }) {
  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50/90 p-4 text-sm text-amber-900">
      <div className="font-medium">{props.title}</div>
      <div className="mt-1 leading-6 text-amber-800">{props.description}</div>
    </div>
  );
}

export default function ChapterExecutionResultPanel(props: ChapterExecutionResultPanelProps) {
  const {
    selectedChapter,
    onOpenReferencePanel,
    chapterPlan,
    streamContent,
    isStreaming,
    streamingChapterId,
    streamingChapterLabel,
    chapterRunStatus,
    onAbortStream,
    onRunFullAudit,
    isRunningFullAudit,
    onAutoRepair,
    isRepairStreaming,
    repairStreamingChapterId,
  } = props;

  if (!selectedChapter) {
    return (
      <div className="rounded-xl border border-dashed p-8 text-sm leading-7 text-muted-foreground">
        Primero seleccione un capítulo de la izquierda, que se convertirá en el área de escritura principal del capítulo actual y mostrará el texto principal, órdenes de tareas, comentarios de calidad y registros de reparación.
      </div>
    );
  }

  const chapterLabel = `Cap.${selectedChapter.order}Cap.`;
  const chapterTitle = selectedChapter.title || "Capítulo sin título";
  const chapterObjective = chapterPlan?.objective ?? selectedChapter.expectation ?? "Aún no hay un objetivo claro para este capítulo, por lo que se recomienda elaborar primero el plan del capítulo.";
  const savedChapterContent = selectedChapter.content?.trim() ?? "";
  const hasSavedChapterContent = hasText(savedChapterContent);

  const isSelectedChapterStreaming = isStreaming && streamingChapterId === selectedChapter.id;
  const isSelectedChapterFinalizing = isSelectedChapterStreaming && chapterRunStatus?.phase === "finalizing";
  const visibleLiveWritingOutput = streamingChapterId === selectedChapter.id ? streamContent : "";
  const hasVisibleLiveWritingOutput = hasText(visibleLiveWritingOutput);
  const useLiveWritingPanel = isSelectedChapterStreaming || (!hasSavedChapterContent && hasVisibleLiveWritingOutput);
  const contentPanelTitle = isSelectedChapterFinalizing
    ? "Final del capitulo"
    : useLiveWritingPanel
      ? "Escritura en tiempo real"
      : "Texto guardado";
  const contentPanelContent = useLiveWritingPanel
    ? visibleLiveWritingOutput
    : hasSavedChapterContent
      ? savedChapterContent
      : hasVisibleLiveWritingOutput
        ? visibleLiveWritingOutput
        : "";
  const contentPanelWordCount = contentPanelContent.trim().length;

  const isSelectedChapterRepairStreaming = isRepairStreaming && repairStreamingChapterId === selectedChapter.id;

  const writingInOtherChapter = isStreaming && streamingChapterId && streamingChapterId !== selectedChapter.id;

  const contentViewportRef = useRef<HTMLDivElement | null>(null);
  const displayedStatus = resolveDisplayedChapterStatus(selectedChapter);
  const needsAuditPrompt = displayedStatus === "pending_review"
    && selectedChapter.generationState !== "reviewed"
    && selectedChapter.generationState !== "approved";
  const needsConfirmationPrompt = displayedStatus === "pending_review"
    && (selectedChapter.generationState === "reviewed" || selectedChapter.generationState === "approved");
  const needsRepairPrompt = displayedStatus === "needs_repair";

  useEffect(() => {
    if (!isSelectedChapterStreaming && !isSelectedChapterFinalizing) {
      return;
    }
    const viewport = contentViewportRef.current;
    if (!viewport) {
      return;
    }
    const frame = window.requestAnimationFrame(() => {
      viewport.scrollTop = viewport.scrollHeight;
    });
    return () => window.cancelAnimationFrame(frame);
  }, [contentPanelContent, isSelectedChapterFinalizing, isSelectedChapterStreaming, selectedChapter.id]);

  const openQualityPanel = () => {
    onOpenReferencePanel("quality");
  };

  const openRepairPanel = () => {
    onOpenReferencePanel("repair");
  };

  const runAutoRepairFromWorkspace = () => {
    openRepairPanel();
    onAutoRepair();
  };

  return (
    <div className="h-full">
      <Card className="h-full overflow-hidden border-border/70">
        <CardContent className="flex h-full min-h-0 flex-col gap-5 pt-5">
          {writingInOtherChapter ? (
            <WorkspaceNotice
              title="Hay otros capítulos que se están escribiendo en el fondo."
              description={`${streamingChapterLabel ?? "Otro capitulo"} Aún se está generando. Después de cambiar a este capítulo, el texto de transmisión de ese capítulo no se mostrará. Puede continuar viendo el resultado en tiempo real volviendo al capítulo correspondiente.`}
            />
          ) : null}

          <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[28px] border border-border/80 bg-background shadow-sm">
            <div className="flex flex-col gap-3 border-b bg-muted/20 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={isSelectedChapterStreaming ? "default" : "secondary"}>
                    {isSelectedChapterFinalizing
                      ? "Terminando en progreso"
                      : isSelectedChapterStreaming
                        ? "Escribiendo en tiempo real"
                        : "Versión guardada"}
                  </Badge>
                  <Badge variant="outline">{chapterLabel}</Badge>
                  <Badge variant="outline">Pantalla actual {contentPanelWordCount} Palabras</Badge>
                </div>
                <div>
                  <div className="text-base font-semibold text-foreground">{chapterTitle}</div>
                  <div className="mt-1 text-xs leading-6 text-muted-foreground">
                    {contentPanelTitle}.{isSelectedChapterFinalizing
                      ? (chapterRunStatus?.message ?? "El texto es legible y el sistema guarda el borrador y reinyecta los recursos del capítulo.")
                      : isSelectedChapterStreaming
                        ? "AI continúa publicando el texto de este capítulo. Primero observa el ritmo y siente aquí. Puedes parar en cualquier momento si no estás satisfecho."
                        : chapterObjective}
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-muted-foreground">recuento de palabras {contentPanelWordCount}</span>
                {needsAuditPrompt ? (
                  <Button size="sm" onClick={onRunFullAudit} disabled={isRunningFullAudit}>
                    {isRunningFullAudit ? "En revisión..." : "Ir a revisar"}
                  </Button>
                ) : null}
                {needsConfirmationPrompt ? (
                  <Button size="sm" variant="outline" onClick={openQualityPanel}>
                    Ver recomendaciones
                  </Button>
                ) : null}
                {(needsConfirmationPrompt || needsRepairPrompt) ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={runAutoRepairFromWorkspace}
                    disabled={isSelectedChapterRepairStreaming}
                  >
                    {isSelectedChapterRepairStreaming ? "En reparación..." : "Reparación con un clic"}
                  </Button>
                ) : null}
                {isSelectedChapterStreaming && !isSelectedChapterFinalizing ? (
                  <Button size="sm" variant="secondary" onClick={onAbortStream}>
                    dejar de generar
                  </Button>
                ) : null}
              </div>
            </div>

            <div ref={contentViewportRef} className="min-h-0 flex-1 overflow-y-auto px-6 py-6 lg:px-10">
              {contentPanelContent ? (
                <article className="mx-auto max-w-4xl text-[15px] leading-8 text-foreground">
                  <MarkdownViewer content={contentPanelContent} />
                </article>
              ) : (
                <div className="mx-auto max-w-3xl rounded-3xl border border-dashed bg-muted/15 p-8 text-sm leading-7 text-muted-foreground">
                  No hay texto para el capítulo actual. Se recomienda elaborar primero el plan del capítulo o la lista de tareas y luego ejecutar directamente "Escribir este capítulo" desde el lado derecho.
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
