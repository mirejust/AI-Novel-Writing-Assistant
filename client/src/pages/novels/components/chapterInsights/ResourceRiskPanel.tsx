import { RefreshCw } from "lucide-react";
import type { CharacterResourceLedgerItem } from "@ai-novel/shared/types/characterResource";
import type { ChapterExecutionInsightsSidebarProps } from "./chapterInsights.types";
import { getTimelineCheckLabel } from "./TimelinePanel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

function ResourceGroup(props: {
  title: string;
  items: CharacterResourceLedgerItem[];
  emptyText: string;
}) {
  const { title, items, emptyText } = props;
  return (
    <div className="rounded-lg border border-border/70 bg-background p-3">
      <div className="text-xs font-medium text-muted-foreground">{title}</div>
      {items.length > 0 ? (
        <div className="mt-2 space-y-2">
          {items.slice(0, 4).map((item) => (
            <div key={item.id} className="rounded-md border border-border/60 bg-muted/15 p-2">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <span className="min-w-0 flex-1 text-sm font-medium">{item.name}</span>
                <Badge variant="outline">{item.status}</Badge>
              </div>
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

export default function ResourceRiskPanel(props: ChapterExecutionInsightsSidebarProps) {
  const {
    selectedChapter,
    chapterResourceContext,
    isLoadingChapterResourceContext = false,
    resourceWorkflowMode = "manual",
    pendingCharacterResourceProposals = [],
    onExtractChapterResources,
    isExtractingChapterResources = false,
    onConfirmCharacterResourceProposal,
    onRejectCharacterResourceProposal,
    confirmingCharacterResourceProposalId = "",
    rejectingCharacterResourceProposalId = "",
    chapterRuntimePackage,
  } = props;

  const isAutoDirectorMode = resourceWorkflowMode === "auto_director";
  const modeHint = isAutoDirectorMode
    ? "Automated Director sincroniza los cambios regulares de recursos, dejando a su criterio solo los cambios de alto riesgo."
    : "Después de revisar el texto, puede revisar los cambios de recursos en este capítulo. Los resultados confirmados afectarán la escritura posterior.";
  const openConflicts = chapterRuntimePackage?.context.openConflicts ?? [];
  const blockingIssues = chapterRuntimePackage?.audit.openIssues ?? [];
  const failureSummary = chapterRuntimePackage?.failureClassification?.summary?.trim() ?? "";
  const timelineCheck = chapterRuntimePackage?.timelineCheck ?? null;

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-border/70 bg-background p-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-xs font-medium text-muted-foreground">Recursos y riesgos</div>
            <div className="mt-1 text-sm font-medium text-foreground">Recursos clave y advertencias de riesgo en este capítulo</div>
            <div className="mt-1 text-xs leading-5 text-muted-foreground">{modeHint}</div>
          </div>
          <div className="flex flex-col items-end gap-2">
            <Badge variant={isAutoDirectorMode ? "secondary" : "outline"}>{isAutoDirectorMode ? "Sincronización automática" : "Revisión manual"}</Badge>
            {pendingCharacterResourceProposals.length > 0 ? <Badge variant="secondary">{pendingCharacterResourceProposals.length}</Badge> : null}
          </div>
        </div>
        {!isAutoDirectorMode ? (
          <Button
            size="sm"
            variant="outline"
            onClick={() => onExtractChapterResources?.()}
            disabled={isExtractingChapterResources || !onExtractChapterResources}
            className="mt-3 w-full justify-center gap-2"
          >
            <RefreshCw className={isExtractingChapterResources ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
            {isExtractingChapterResources ? "En revisión..." : "Revisar los recursos para este capítulo."}
          </Button>
        ) : null}
      </div>

      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-1">
        <div className="rounded-xl border border-border/70 bg-background p-3">
          <div className="text-xs font-medium text-muted-foreground">Resumen de riesgos</div>
          <div className="mt-2 space-y-2 text-xs leading-5 text-muted-foreground">
            <div className="flex items-center justify-between gap-2">
              <span>Clasificación de fallas</span>
              <span className="font-medium text-foreground">{failureSummary || "Ninguno"}</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span>Conflicto abierto</span>
              <span className="font-medium text-foreground">{openConflicts.length}</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span>Problema de bloqueo</span>
              <span className="font-medium text-foreground">{blockingIssues.length}</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span>Línea de tiempo</span>
              <span className="font-medium text-foreground">{timelineCheck ? getTimelineCheckLabel(timelineCheck.status) : "No detectado"}</span>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-border/70 bg-background p-3">
          <div className="text-xs font-medium text-muted-foreground">Capítulo actual</div>
          <div className="mt-2 text-sm font-medium text-foreground">
            {selectedChapter ? `Cap.${selectedChapter.order}capitulo ${selectedChapter.title || "Capítulo sin título"}` : "Ningún capítulo seleccionado"}
          </div>
          <div className="mt-1 text-xs leading-5 text-muted-foreground">
            {chapterResourceContext?.summary ?? "Después de seleccionar un capítulo, se le indicarán los recursos que están disponibles, que requieren un presagio y que no se pueden usar directamente en este capítulo."}
          </div>
        </div>
      </div>

      {isLoadingChapterResourceContext ? (
        <div className="rounded-xl border border-dashed border-border/70 bg-muted/10 p-3 text-xs leading-6 text-muted-foreground">
          Se están leyendo los límites de los recursos.
        </div>
      ) : null}

      <div className="space-y-3">
        <ResourceGroup title="Recursos disponibles" items={chapterResourceContext?.availableItems ?? []} emptyText="No hay recursos disponibles que requieran una dependencia especial." />
        <ResourceGroup title="Necesidad de allanar el camino" items={chapterResourceContext?.setupNeededItems ?? []} emptyText="No hay recursos que deban establecerse primero." />
        <ResourceGroup title="No se puede utilizar por adelantado" items={chapterResourceContext?.blockedItems ?? []} emptyText="No se consumen, pierden ni destruyen recursos críticos." />
        <ResourceGroup title="Se ha tenido en cuenta el alto riesgo." items={chapterResourceContext?.highRiskCommittedItems ?? []} emptyText="No existen recursos contabilizados de alto riesgo que deban utilizarse con precaución." />

        {pendingCharacterResourceProposals.length > 0 ? (
          <div className="space-y-2 rounded-lg border border-border/70 bg-muted/10 p-3">
            <div className="text-xs font-medium text-muted-foreground">Cambios de recursos que requieren juicio</div>
            {pendingCharacterResourceProposals.slice(0, 2).map((proposal) => (
              <div key={proposal.id} className="space-y-2 rounded-md border border-border/70 bg-background p-2">
                <div className="flex flex-wrap items-start gap-2">
                  <div className="min-w-0 flex-1 text-sm font-medium leading-5">{proposal.summary}</div>
                  <Badge variant="outline">{proposal.sourceType === "chapter_background_sync" ? "Descubrimiento de sincronización automática" : "Hallazgos de la revisión manual"}</Badge>
                </div>
                {proposal.evidence[0] ? <div className="line-clamp-2 text-[11px] leading-5 text-muted-foreground">Evidencia:{proposal.evidence[0]}</div> : null}
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" onClick={() => onConfirmCharacterResourceProposal?.(proposal.id)} disabled={confirmingCharacterResourceProposalId === proposal.id}>
                    {confirmingCharacterResourceProposalId === proposal.id ? "Confirmando..." : "Confirmar"}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onRejectCharacterResourceProposal?.(proposal.id)}
                    disabled={rejectingCharacterResourceProposalId === proposal.id}
                  >
                    {rejectingCharacterResourceProposalId === proposal.id ? "Procesando..." : "Ignorar"}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
