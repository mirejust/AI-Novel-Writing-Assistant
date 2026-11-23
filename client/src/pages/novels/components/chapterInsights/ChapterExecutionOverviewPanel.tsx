import { Link } from "react-router-dom";
import type { ChapterRuntimePackage } from "@ai-novel/shared/types/chapterRuntime";
import type { Chapter, StoryPlan } from "@ai-novel/shared/types/novel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { chapterStatusLabel, generationStateLabel, resolveDisplayedChapterStatus } from "../chapterExecution.shared";

interface ChapterExecutionOverviewPanelProps {
  selectedChapter?: Chapter;
  chapterPlan?: StoryPlan | null;
  chapterQualityReport?: {
    coherence: number;
    repetition: number;
    pacing: number;
    voice: number;
    engagement: number;
    overall: number;
    issues?: string | null;
  } | null;
  chapterRuntimePackage?: ChapterRuntimePackage | null;
  reviewResult?: {
    issues?: Array<{ category: string; fixSuggestion: string }>;
  } | null;
  openAuditIssues?: Array<{ id: string; auditType: string; fixSuggestion: string }>;
}

function getQualityBadgeVariant(quality: number): "default" | "outline" | "secondary" {
  if (quality >= 85) {
    return "default";
  }
  if (quality >= 70) {
    return "outline";
  }
  return "secondary";
}

function OverviewStat(props: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-border/70 bg-muted/10 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 text-xs text-muted-foreground">{props.label}</div>
        <div className="shrink-0 text-right text-sm font-semibold text-foreground">{props.value}</div>
      </div>
      {props.hint ? <div className="mt-1 text-xs leading-5 text-muted-foreground">{props.hint}</div> : null}
    </div>
  );
}

export default function ChapterExecutionOverviewPanel(props: ChapterExecutionOverviewPanelProps) {
  const {
    selectedChapter,
    chapterPlan,
    chapterQualityReport,
    chapterRuntimePackage,
    reviewResult,
    openAuditIssues = [],
  } = props;

  if (!selectedChapter) {
    return (
      <section className="rounded-2xl border border-dashed border-border/70 bg-background p-4 text-sm leading-6 text-muted-foreground">
        Después de seleccionar un capítulo, aquí se muestran el estado del capítulo, los objetivos, el recuento de palabras, la calidad y los problemas pendientes.
      </section>
    );
  }

  const chapterLabel = `Cap.${selectedChapter.order}Cap.`;
  const chapterTitle = selectedChapter.title || "Capítulo sin título";
  const chapterObjective = chapterPlan?.objective ?? selectedChapter.expectation ?? "Aún no hay un objetivo claro para este capítulo, por lo que se recomienda elaborar primero el plan del capítulo.";
  const runtimePackage = chapterRuntimePackage?.chapterId === selectedChapter.id ? chapterRuntimePackage : null;
  const lengthControl = runtimePackage?.lengthControl ?? null;
  const qualityOverall = chapterQualityReport?.overall ?? selectedChapter.qualityScore ?? null;
  const displayedStatus = resolveDisplayedChapterStatus(selectedChapter);
  const statusLabel = chapterStatusLabel(displayedStatus);
  const generationLabel = generationStateLabel(selectedChapter.generationState);
  const currentWordCount = runtimePackage?.draft.wordCount ?? selectedChapter.content?.trim().length ?? 0;
  const targetWordCount = selectedChapter.targetWordCount ?? null;
  const issueCount = openAuditIssues.length || reviewResult?.issues?.length || 0;
  const updatedAt = selectedChapter.updatedAt ? new Date(selectedChapter.updatedAt).toLocaleString("zh-CN") : "Sin datos";

  return (
    <section className="space-y-3 rounded-2xl border border-border/70 bg-background/95 p-4">
      <div className="flex flex-col gap-3">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">{chapterLabel}</Badge>
            <Badge variant={displayedStatus === "needs_repair" ? "destructive" : displayedStatus === "pending_review" ? "secondary" : "default"}>
              {statusLabel}
            </Badge>
            {generationLabel ? <Badge variant="outline">{generationLabel}</Badge> : null}
            {typeof qualityOverall === "number" ? (
              <Badge variant={getQualityBadgeVariant(qualityOverall)}>calidad {qualityOverall}</Badge>
            ) : null}
          </div>

          <div className="space-y-2">
            <div className="text-xs font-medium text-muted-foreground">Resumen del capítulo</div>
            <div className="text-base font-semibold text-foreground">{chapterTitle}</div>
            <p className="line-clamp-6 text-sm leading-6 text-muted-foreground">
              {chapterObjective}
            </p>
          </div>
        </div>

        <Button asChild size="sm" variant="outline" className="w-full justify-center">
          <Link to={`/novels/${selectedChapter.novelId}/chapters/${selectedChapter.id}`}>Abrir editor de capítulos</Link>
        </Button>
      </div>

      <div className="space-y-2">
        <OverviewStat label="Recuento de palabras actual" value={String(currentWordCount)} hint="La longitud del texto que se muestra en el panel principal." />
        <OverviewStat label="Objetivo del capítulo" value={targetWordCount ? `${targetWordCount} palabras` : "No establecido"} hint="Se utiliza para determinar si el espacio actual es suficiente." />
        <OverviewStat label="Asuntos pendientes" value={String(issueCount)} hint="Cuantas menos preguntas haya, mejor será avanzar." />
        <OverviewStat label="Últimas actualizaciones" value={updatedAt} hint="Se utiliza para determinar si es necesario reexaminar este capítulo." />
      </div>

      {lengthControl ? (
        <div className="space-y-2">
          <OverviewStat
            label="Rango de presupuesto"
            value={`${lengthControl.softMinWordCount}-${lengthControl.softMaxWordCount}`}
            hint={`tapa dura ${lengthControl.hardMaxWordCount} palabras`}
          />
          <OverviewStat
            label="Modo de control de palabras"
            value={lengthControl.wordControlMode === "prompt_only" ? "Prioridad natural" : lengthControl.wordControlMode === "balanced" ? "Palabras de control estándar" : "Palabras de control mixtas"}
            hint={`desviación ${Math.round(lengthControl.variance * 100)}%`}
          />
        </div>
      ) : null}
    </section>
  );
}
