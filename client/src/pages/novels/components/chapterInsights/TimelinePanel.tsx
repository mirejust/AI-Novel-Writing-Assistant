import { AlertTriangle, ArrowRight, Clock3, Loader2, ShieldAlert, Sparkles, UsersRound } from "lucide-react";
import type { ReactNode } from "react";
import type { ChapterRuntimePackage } from "@ai-novel/shared/types/chapterRuntime";
import type { Chapter } from "@ai-novel/shared/types/novel";
import type { TimelineContextForChapter, TimelineIssue } from "@ai-novel/shared/types/timeline";
import type { ChapterTimelineViewData } from "../NovelEditView.types";
import type { TimelineCheckSummary } from "./chapterInsights.types";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function getTimelineCheckLabel(status: TimelineCheckSummary["status"]): string {
  if (status === "failed") {
    return "Necesita reparación";
  }
  if (status === "warning") {
    return "Necesito revisar";
  }
  return "Pase";
}

function getTimelineCheckTone(status: TimelineCheckSummary["status"]): string {
  if (status === "failed") {
    return "border-red-200 bg-red-50 text-red-950";
  }
  if (status === "warning") {
    return "border-amber-200 bg-amber-50 text-amber-950";
  }
  return "border-emerald-200 bg-emerald-50 text-emerald-950";
}

function getTimelineCheckBadgeVariant(status: TimelineCheckSummary["status"]): NonNullable<BadgeProps["variant"]> {
  if (status === "failed") {
    return "destructive";
  }
  if (status === "warning") {
    return "secondary";
  }
  return "default";
}

function formatTimelineTimeLabel(context?: TimelineContextForChapter | null): string {
  if (!context) {
    return "Sin configurar";
  }
  const parts = [
    typeof context.currentTime?.storyDayIndex === "number" ? `Cap.${context.currentTime.storyDayIndex}Cielo` : "",
    context.currentTime?.label?.trim() ?? "",
  ].filter(Boolean);
  return parts.join(" · ") || `Cap.${context.currentChapterIndex}Cap.`;
}

function formatIssueSeverity(issue: TimelineIssue): string {
  if (issue.severity === "blocking") {
    return "Bloquear";
  }
  if (issue.severity === "error") {
    return "Error";
  }
  if (issue.severity === "warning") {
    return "Recordatorio";
  }
  return "Información";
}

function TimelineItemList(props: {
  title: string;
  icon: ReactNode;
  items: Array<{ title: string; summary: string }>;
  emptyText: string;
  tone?: "default" | "warning" | "critical";
}) {
  const { title, icon, items, emptyText, tone = "default" } = props;
  const toneClass =
    tone === "critical"
      ? "border-red-200 bg-red-50/60"
      : tone === "warning"
        ? "border-amber-200 bg-amber-50/60"
        : "border-border/70 bg-background";

  return (
    <div className={cn("rounded-xl border p-3", toneClass)}>
      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        {icon}
        <span>{title}</span>
      </div>
      {items.length > 0 ? (
        <div className="mt-2 space-y-2">
          {items.slice(0, 4).map((item) => (
            <div key={`${title}-${item.title}`} className="rounded-lg border border-border/60 bg-background/80 p-2">
              <div className="line-clamp-1 text-sm font-medium text-foreground">{item.title}</div>
              <div className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">{item.summary}</div>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-2 text-xs leading-5 text-muted-foreground">{emptyText}</div>
      )}
    </div>
  );
}

function TimelineCheckPanel(props: {
  timelineCheck: TimelineCheckSummary | null;
  isLoading: boolean;
  hasChapter: boolean;
}) {
  const { timelineCheck, isLoading, hasChapter } = props;
  if (isLoading && !timelineCheck) {
    return (
      <div className="rounded-xl border border-border/70 bg-muted/20 p-3 text-xs leading-6 text-muted-foreground">
        <div className="flex items-center gap-2 font-medium text-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Lectura de detección de línea de tiempo
        </div>
        <div className="mt-1">Después de cambiar de capítulo, los últimos resultados de las pruebas se mostrarán aquí.</div>
      </div>
    );
  }

  if (!hasChapter) {
    return (
      <div className="rounded-xl border border-dashed border-border/70 bg-muted/10 p-3 text-xs leading-6 text-muted-foreground">
        Después de seleccionar un capítulo, los resultados de la detección de la línea de tiempo del capítulo se muestran aquí.
      </div>
    );
  }

  if (!timelineCheck) {
    return (
      <div className="rounded-xl border border-dashed border-border/70 bg-muted/10 p-3 text-xs leading-6 text-muted-foreground">
        Aún no hay resultados de la verificación del cronograma para este capítulo.
      </div>
    );
  }

  return (
    <div className={cn("rounded-xl border p-3 text-sm", getTimelineCheckTone(timelineCheck.status))}>
      <div className="flex items-center justify-between gap-2">
        <div className="font-medium">{getTimelineCheckLabel(timelineCheck.status)}</div>
        <Badge variant={getTimelineCheckBadgeVariant(timelineCheck.status)}>Fracción {Math.round(timelineCheck.score * 100)}</Badge>
      </div>
      {timelineCheck.issues.length > 0 ? (
        <div className="mt-3 space-y-2">
          {timelineCheck.issues.slice(0, 3).map((issue, index) => (
            <div key={`${issue.type}-${index}`} className="rounded-lg border border-white/40 bg-background/85 p-2 text-xs leading-5 text-foreground">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="text-[11px]">{formatIssueSeverity(issue)}</Badge>
                <span className="font-medium">{issue.message}</span>
              </div>
              {issue.suggestedFix ? <div className="mt-1 line-clamp-2 text-muted-foreground">{issue.suggestedFix}</div> : null}
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-2 text-xs leading-6 opacity-80">En este capítulo no hay filtraciones futuras obvias, ganchos rotos o conflictos estatales críticos.</div>
      )}
    </div>
  );
}

export default function TimelinePanel(props: {
  selectedChapter?: Chapter;
  chapterTimeline?: ChapterTimelineViewData | null;
  isLoadingChapterTimeline?: boolean;
  chapterRuntimePackage?: ChapterRuntimePackage | null;
}) {
  const { selectedChapter, chapterTimeline, isLoadingChapterTimeline = false, chapterRuntimePackage } = props;
  const context = chapterTimeline?.context ?? null;
  const timelineCheck = (chapterTimeline?.latestReport ?? chapterRuntimePackage?.timelineCheck ?? null) as TimelineCheckSummary | null;
  const hasChapter = Boolean(selectedChapter);
  const chapterLabel = selectedChapter ? `Cap.${selectedChapter.order}Cap.` : "Ningún capítulo seleccionado";
  const timeLabel = formatTimelineTimeLabel(context);

  return (
    <div className="space-y-3">
      <div className="grid gap-2 md:grid-cols-2">
        <div className="rounded-xl border border-border/70 bg-background p-3">
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <Clock3 className="h-4 w-4" />
            <span>Ancla del tiempo</span>
          </div>
          <div className="mt-2 text-sm font-medium text-foreground">{timeLabel}</div>
          <div className="mt-1 text-xs leading-5 text-muted-foreground">{chapterLabel}</div>
        </div>
        <div className="rounded-xl border border-border/70 bg-background p-3">
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <ShieldAlert className="h-4 w-4" />
            <span>Resultados de la prueba</span>
          </div>
          <div className="mt-2 text-sm font-medium text-foreground">
            {timelineCheck ? getTimelineCheckLabel(timelineCheck.status) : isLoadingChapterTimeline ? "Leyendo" : "No detectado"}
          </div>
          <div className="mt-1 text-xs leading-5 text-muted-foreground">
            {timelineCheck ? `Fracción ${Math.round(timelineCheck.score * 100)}` : "Después de cambiar de capítulo, se leerán los últimos resultados de la inspección."}
          </div>
        </div>
      </div>

      {context ? (
        <>
          <TimelineItemList
            title="Gancho del capítulo anterior"
            icon={<ArrowRight className="h-4 w-4" />}
            items={context.openHooks.map((hook) => ({ title: hook.title, summary: hook.description }))}
            emptyText="No hay ganchos heredados que puedan hacerse cargo."
            tone={context.openHooks.length > 0 ? "warning" : "default"}
          />
          <TimelineItemList
            title="Este capítulo está planeado para avanzar"
            icon={<Sparkles className="h-4 w-4" />}
            items={context.plannedEventsThisChapter.map((event) => ({ title: event.title, summary: event.summary }))}
            emptyText="Este capítulo no tiene planes de avanzar."
          />
          <TimelineItemList
            title="Prohibido que ocurra por adelantado"
            icon={<AlertTriangle className="h-4 w-4" />}
            items={context.forbiddenEvents.map((item) => ({ title: item.title, summary: item.reason }))}
            emptyText="No existen restricciones de ocurrencia temprana en este capítulo."
            tone={context.forbiddenEvents.length > 0 ? "critical" : "default"}
          />
          <div className="rounded-xl border border-border/70 bg-background p-3">
            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <UsersRound className="h-4 w-4" />
              <span>Eventos clave recientes</span>
            </div>
            {context.previousEvents.length > 0 ? (
              <div className="mt-2 space-y-2">
                {context.previousEvents.slice(0, 4).map((item) => (
                  <div key={item.id} className="rounded-lg border border-border/60 bg-muted/10 p-2">
                    <div className="line-clamp-1 text-sm font-medium text-foreground">{item.title}</div>
                    <div className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">{item.summary}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-2 text-xs leading-5 text-muted-foreground">No hay eventos recientes para mostrar.</div>
            )}
          </div>
          <div className="space-y-2">
            <div className="text-xs font-medium text-muted-foreground">Última detección de línea de tiempo</div>
            <TimelineCheckPanel timelineCheck={timelineCheck} isLoading={isLoadingChapterTimeline} hasChapter={hasChapter} />
          </div>
        </>
      ) : (
        <div className="rounded-xl border border-dashed border-border/70 bg-muted/10 p-3 text-xs leading-6 text-muted-foreground">
          Después de seleccionar un capítulo, aquí se muestran el ancla de tiempo de este capítulo, el gancho del capítulo anterior, el avance del plan y los elementos prohibidos.
        </div>
      )}
    </div>
  );
}
