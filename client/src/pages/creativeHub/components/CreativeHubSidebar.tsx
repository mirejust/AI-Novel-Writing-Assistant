import { useMemo, useState } from "react";
import type { FailureDiagnostic } from "@ai-novel/shared/types/agent";
import type {
  CreativeHubInterrupt,
  CreativeHubNovelSetupStatus,
  CreativeHubProductionStatus,
  CreativeHubResourceBinding,
  CreativeHubThread,
  CreativeHubTurnSummary,
} from "@ai-novel/shared/types/creativeHub";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import SelectControl from "@/components/common/SelectControl";
import { Link } from "react-router-dom";

interface CreativeHubSidebarProps {
  thread?: CreativeHubThread;
  bindings: CreativeHubResourceBinding;
  novels: Array<{ id: string; title: string }>;
  interrupt?: CreativeHubInterrupt;
  diagnostics?: FailureDiagnostic;
  productionStatus?: CreativeHubProductionStatus | null;
  novelSetup?: CreativeHubNovelSetupStatus | null;
  latestTurnSummary?: CreativeHubTurnSummary | null;
  currentCheckpointId?: string | null;
  modelSummary: {
    provider: string;
    model: string;
    temperature: number;
    maxTokens?: number;
  };
  defaultRuntimeDetailsCollapsed: boolean;
  actionDisabled?: boolean;
  novelsLoading?: boolean;
  novelsErrorMessage?: string;
  novelsRetrying?: boolean;
  onToggleRuntimeDetailsDefault: () => void;
  onRetryNovels?: () => void;
  onNovelChange: (novelId: string) => void | Promise<void>;
  onQuickAction?: (prompt: string) => void;
}

function bindingStatusLabel(value: string | null | undefined): string {
  return value?.trim() ? "Atado" : "no obligado";
}

function pipelineStatusLabel(status: string | null | undefined): string {
  if (status === "queued") return "Esperando ejecución";
  if (status === "running") return "Ejecutando";
  if (status === "succeeded") return "Completado";
  if (status === "failed") return "La ejecución falló";
  if (status === "cancelled") return "Cancelado";
  return "No iniciado";
}

function turnStatusLabel(status: CreativeHubTurnSummary["status"]): string {
  switch (status) {
    case "succeeded":
      return "Completado";
    case "interrupted":
      return "Pendiente de confirmación";
    case "failed":
      return "Error";
    case "cancelled":
      return "Cancelado";
    case "running":
      return "En curso";
    default:
      return status;
  }
}

function threadStatusLabel(status: CreativeHubThread["status"] | undefined): string {
  switch (status) {
    case "busy":
      return "Ejecutando";
    case "interrupted":
      return "Pendiente";
    case "error":
      return "Incidencia";
    case "idle":
      return "Gratis";
    default:
      return "no inicializado";
  }
}

function metricTone(status: "pending" | "completed" | "running" | "blocked"): string {
  switch (status) {
    case "completed":
      return "border-success/30 bg-success/5 text-success";
    case "running":
      return "border-info/30 bg-info/5 text-info";
    case "blocked":
      return "border-warning/30 bg-warning/5 text-warning";
    default:
      return "border-border bg-muted/30 text-muted-foreground";
  }
}

function buildBlockerCardData(input: {
  interrupt?: CreativeHubInterrupt;
  diagnostics?: FailureDiagnostic;
  productionStatus?: CreativeHubProductionStatus | null;
  latestTurnSummary?: CreativeHubTurnSummary | null;
}) {
  if (input.interrupt) {
    return {
      title: "Actualmente bloqueado",
      summary: input.interrupt.summary,
      details: [
        `Esperando confirmación: ${input.interrupt.title}`,
        input.interrupt.targetType ? `Tipo de objetivo: ${input.interrupt.targetType}` : "",
      ].filter(Boolean),
      tone: "border-warning/30 bg-warning/5 text-foreground",
      actionLabel: "Ver elementos pendientes",
      actionPrompt: "Resumir las decisiones creativas actuales que se deben confirmar y explicar los métodos de procesamiento recomendados.",
    };
  }

  if (input.diagnostics?.failureSummary) {
    return {
      title: "Riesgos actuales",
      summary: input.diagnostics.failureSummary,
      details: [
        input.diagnostics.failureCode ? `Código de error: ${input.diagnostics.failureCode}` : "",
        input.diagnostics.recoveryHint ? `Sugerencias de recuperación: ${input.diagnostics.recoveryHint}` : "",
      ].filter(Boolean),
      tone: "border-destructive/30 bg-destructive/5 text-foreground",
      actionLabel: "Generar plan de recuperación",
      actionPrompt: input.diagnostics.recoveryHint || "Analizar los motivos de falla actuales y proporcionar pasos de recuperación.",
    };
  }

  if (input.productionStatus?.failureSummary) {
    return {
      title: "Actualmente bloqueado",
      summary: input.productionStatus.failureSummary,
      details: [
        input.productionStatus.recoveryHint ? `Sugerencias de recuperación: ${input.productionStatus.recoveryHint}` : "",
        `Etapa actual: ${input.productionStatus.currentStage}`,
      ].filter(Boolean),
      tone: "border-destructive/30 bg-destructive/5 text-foreground",
      actionLabel: "Ver bloqueo actual",
      actionPrompt: input.productionStatus.recoveryHint || "Analizar los bloqueos de producción actuales y las entradas formales de procesamiento.",
    };
  }

  if (input.latestTurnSummary?.status === "interrupted") {
    return {
      title: "Preocupaciones actuales",
      summary: input.latestTurnSummary.nextSuggestion,
      details: [
        `escenario: ${input.latestTurnSummary.currentStage}`,
        `estado: ${turnStatusLabel(input.latestTurnSummary.status)}`,
      ],
      tone: "border-info/30 bg-info/5 text-foreground",
      actionLabel: "Ver sugerencias",
      actionPrompt: `Explicación de propuestas actuales y entrada formal:${input.latestTurnSummary.nextSuggestion}`,
    };
  }

  return {
    title: "Estado actual",
    summary: "Actualmente no hay problemas de estatus que deban abordarse. Puede ver el progreso novedoso o los registros de ejecución.",
    details: input.latestTurnSummary?.nextSuggestion
      ? [`Próximos pasos sugeridos: ${input.latestTurnSummary.nextSuggestion}`]
      : [],
    tone: "border-border bg-muted/20 text-foreground",
    actionLabel: input.latestTurnSummary?.nextSuggestion ? "Ver sugerencias" : undefined,
    actionPrompt: input.latestTurnSummary?.nextSuggestion
      ? `Explicación de propuestas actuales y entrada formal:${input.latestTurnSummary.nextSuggestion}`
      : undefined,
  };
}

function DebugRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 text-xs text-muted-foreground">
      <span>{label}</span>
      <span className="max-w-[60%] break-all text-right text-foreground">{value}</span>
    </div>
  );
}

export default function CreativeHubSidebar({
  thread,
  bindings,
  novels,
  interrupt,
  diagnostics,
  productionStatus,
  novelSetup,
  latestTurnSummary,
  currentCheckpointId,
  modelSummary,
  defaultRuntimeDetailsCollapsed,
  actionDisabled = false,
  novelsLoading = false,
  novelsErrorMessage = "",
  novelsRetrying = false,
  onToggleRuntimeDetailsDefault,
  onRetryNovels,
  onNovelChange,
  onQuickAction,
}: CreativeHubSidebarProps) {
  const [isBindingNovel, setIsBindingNovel] = useState(false);
  const selectedNovel = novels.find((item) => item.id === bindings.novelId);
  const currentNovelTitle = selectedNovel?.title
    ?? productionStatus?.title
    ?? novelSetup?.title
    ?? null;
  const blocker = useMemo(
    () => buildBlockerCardData({
      interrupt,
      diagnostics,
      productionStatus,
      latestTurnSummary,
    }),
    [diagnostics, interrupt, latestTurnSummary, productionStatus],
  );
  const completedAssets = productionStatus?.assetStages.filter((item) => item.status === "completed").length ?? 0;
  const latestRunId = latestTurnSummary?.runId ?? thread?.latestRunId ?? null;
  const blockerActionPrompt = blocker.actionPrompt ?? "";
  const resourceActionDisabled = actionDisabled || isBindingNovel;

  return (
    <Card
      className="flex h-full min-h-0 flex-col rounded-lg shadow-none"
      aria-busy={isBindingNovel || novelsRetrying}
    >
      <CardHeader className="pb-4">
        <CardTitle className="text-base">Novelas actuales y estado</CardTitle>
      </CardHeader>
      <CardContent className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1 text-sm">
        <div className="rounded-md border border-border bg-muted/20 p-3">
          <div className="mb-2 text-xs font-medium text-muted-foreground">Novelas y recursos actuales</div>
          <div className="space-y-3 text-xs text-muted-foreground">
            <div className="space-y-1">
              <label htmlFor="creative-hub-novel" className="text-xs font-medium text-muted-foreground">Novela actual</label>
              <SelectControl
                id="creative-hub-novel"
                className="w-full rounded-md border border-input bg-background p-2 text-base text-foreground disabled:cursor-not-allowed disabled:opacity-60 md:text-sm"
                value={bindings.novelId ?? ""}
                disabled={resourceActionDisabled || novelsLoading || Boolean(novelsErrorMessage)}
                onChange={(event) => {
                  const novelId = event.target.value;
                  setIsBindingNovel(true);
                  void Promise.resolve(onNovelChange(novelId))
                    .catch((error: unknown) => {
                      toast.error(error instanceof Error ? error.message : "No se pudo cambiar el nuevo espacio de trabajo. Inténtelo de nuevo.");
                    })
                    .finally(() => setIsBindingNovel(false));
                }}
              >
                <option value="">Novela sin encuadernar</option>
                {bindings.novelId && !selectedNovel ? (
                  <option value={bindings.novelId}>{currentNovelTitle ?? "Novela actualmente encuadernada"}</option>
                ) : null}
                {novels.map((novel) => (
                  <option key={novel.id} value={novel.id}>
                    {novel.title}
                  </option>
                ))}
              </SelectControl>
              {novelsLoading ? (
                <div className="text-xs leading-5 text-muted-foreground" role="status">
                  Cargando novelas disponibles, no se puede cambiar de espacio de trabajo hasta que se complete.
                </div>
              ) : novelsErrorMessage ? (
                <div className="rounded-md border border-destructive/30 bg-destructive/5 p-2 text-xs leading-5 text-foreground">
                  <div>La lectura de la lista de novelas falla, los hilos existentes no se ven afectados.</div>
                  {onRetryNovels ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="mt-2"
                      disabled={novelsRetrying}
                      onClick={onRetryNovels}
                    >
                      {novelsRetrying ? "Releyendo..." : "Releer la novela"}
                    </Button>
                  ) : null}
                </div>
              ) : null}
              <div className="mt-2 flex flex-wrap gap-2">
                <Button asChild size="sm" variant="outline"><Link to="/novels/create">Crear una novela</Link></Button>
                {bindings.novelId ? <Button asChild size="sm" variant="outline"><Link to={`/novels/${bindings.novelId}/edit`}>Abra el banco de trabajo novedoso</Link></Button> : null}
              </div>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <div>capítulo: {bindingStatusLabel(bindings.chapterId)}</div>
              <div>Visión del mundo: {bindingStatusLabel(bindings.worldId)}</div>
              <div>Tarea: {bindingStatusLabel(bindings.taskId)}</div>
              <div>Análisis de división de libros: {bindingStatusLabel(bindings.bookAnalysisId)}</div>
              <div>Fórmula de escritura: {bindingStatusLabel(bindings.formulaId)}</div>
              <div>Roles básicos: {bindingStatusLabel(bindings.baseCharacterId)}</div>
            </div>
            <div>Documentos de conocimiento: {bindings.knowledgeDocumentIds?.length ?? 0} Porción</div>
          </div>
        </div>

        <div className="rounded-md border border-info/30 bg-info/5 p-3">
          <div className="text-xs font-medium text-info">Entrada de creación formal.</div>
          <div className="mt-2 text-sm leading-6 text-foreground">Continúe desde el banco de trabajo oficial para el proceso completo de creación de novelas, producción de agentes y dirección automatizada.</div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button asChild size="sm"><Link to="/novels/auto-director">Activar el director automático de IA</Link></Button>
          </div>
        </div>

        <div className={cn("rounded-md border p-3", blocker.tone)}>
          <div className="mb-2 flex items-center justify-between gap-2">
            <div className="text-xs font-medium">{blocker.title}</div>
            {interrupt ? <Badge variant="secondary">Necesita confirmación</Badge> : null}
          </div>
          <div className="text-sm leading-6">{blocker.summary}</div>
          {blocker.details.length > 0 ? (
            <div className="mt-3 space-y-2 text-xs">
              {blocker.details.map((item) => (
                <div key={item}>{item}</div>
              ))}
            </div>
          ) : null}
          {blocker.actionLabel && blockerActionPrompt ? (
            <div className="mt-3">
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="border-current bg-background/80"
                disabled={actionDisabled}
                onClick={() => onQuickAction?.(blockerActionPrompt)}
              >
                {blocker.actionLabel}
              </Button>
            </div>
          ) : null}
        </div>

        <div className="rounded-md border border-border bg-background p-3">
          <div className="mb-3 text-xs font-medium text-muted-foreground">Etapa creativa</div>
          {productionStatus ? (
            <div className="space-y-3">
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="rounded-md border border-border bg-muted/20 p-3">
                  <div className="text-xs text-muted-foreground">Etapa actual</div>
                  <div className="mt-2 text-sm font-medium text-foreground">{productionStatus.currentStage}</div>
                </div>
                <div className="rounded-md border border-border bg-muted/20 p-3">
                  <div className="text-xs text-muted-foreground">Progreso del capítulo</div>
                  <div className="mt-2 text-sm font-medium text-foreground">
                    {productionStatus.chapterCount}/{productionStatus.targetChapterCount}
                  </div>
                </div>
                <div className="rounded-md border border-border bg-muted/20 p-3">
                  <div className="text-xs text-muted-foreground">Finalización de activos</div>
                  <div className="mt-2 text-sm font-medium text-foreground">
                    {completedAssets}/{productionStatus.assetStages.length}
                  </div>
                </div>
                <div className="rounded-md border border-border bg-muted/20 p-3">
                  <div className="text-xs text-muted-foreground">Línea de montaje</div>
                  <div className="mt-2 text-sm font-medium text-foreground">
                    {pipelineStatusLabel(productionStatus.pipelineStatus)}
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {productionStatus.assetStages.map((item) => (
                  <span
                    key={item.key}
                    className={cn("rounded-full border px-2 py-1 text-[11px]", metricTone(item.status))}
                  >
                    {item.label}
                  </span>
                ))}
              </div>
            </div>
          ) : (
            <div className="rounded-md border border-dashed border-border bg-muted/20 p-3 text-xs text-muted-foreground">
              Después de seleccionar una novela e iniciar toda la creación, aquí se mostrarán las etapas y el progreso.
            </div>
          )}
        </div>

        <details className="rounded-md border border-border bg-background p-3">
          <summary className="cursor-pointer list-none text-xs font-medium text-muted-foreground">
            Ejecutar y depurar información
          </summary>
          <div className="mt-3 space-y-3">
            <div className="rounded-md border border-border bg-muted/20 p-3">
              <div className="mb-2 text-xs font-medium text-muted-foreground">
                Visualización de detalles de ejecución
              </div>
              <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
                <span>
                  Valor predeterminado actual
                  {defaultRuntimeDetailsCollapsed ? "Doblar" : "Expandir"}
                  Detalles operativos dentro del mensaje.
                </span>
                <Button type="button" size="sm" variant="outline" onClick={onToggleRuntimeDetailsDefault}>
                  Cambiar a{defaultRuntimeDetailsCollapsed ? "Expandir por defecto" : "Plegado predeterminado"}
                </Button>
              </div>
            </div>

            <div className="space-y-2 rounded-md border border-border bg-muted/20 p-3">
              <div className="text-xs font-medium text-muted-foreground">Estado del hilo</div>
              <DebugRow label="ID del hilo" value={thread?.id ?? "-"} />
              <DebugRow label="Estado del hilo" value={threadStatusLabel(thread?.status)} />
              <DebugRow label="Última ejecución" value={latestRunId ?? "-"} />
              <DebugRow label="Punto de control actual" value={currentCheckpointId ?? "-"} />
            </div>

            <div className="space-y-2 rounded-md border border-border bg-muted/20 p-3">
              <div className="text-xs font-medium text-muted-foreground">ID de enlace de recursos</div>
              <DebugRow label="Novela" value={bindings.novelId ?? "-"} />
              <DebugRow label="Capítulos" value={bindings.chapterId ?? "-"} />
              <DebugRow label="Visión del mundo" value={bindings.worldId ?? "-"} />
              <DebugRow label="Tarea" value={bindings.taskId ?? "-"} />
              <DebugRow label="Análisis de división de libros" value={bindings.bookAnalysisId ?? "-"} />
              <DebugRow label="Formula de escritura" value={bindings.formulaId ?? "-"} />
              <DebugRow label="Escribir archivo" value={bindings.styleProfileId ?? "-"} />
              <DebugRow label="Rol básico" value={bindings.baseCharacterId ?? "-"} />
              <DebugRow label="Documento de conocimiento" value={bindings.knowledgeDocumentIds?.join(", ") || "-"} />
              {interrupt ? <DebugRow label="Objetivo por confirmar" value={interrupt.targetId ?? "-"} /> : null}
            </div>

            <div className="space-y-2 rounded-md border border-border bg-muted/20 p-3">
              <div className="text-xs font-medium text-muted-foreground">Enrutamiento del modelo</div>
              <DebugRow label="Provider" value={modelSummary.provider} />
              <DebugRow label="Model" value={modelSummary.model} />
              <DebugRow label="Temperature" value={String(modelSummary.temperature)} />
              <DebugRow label="Max tokens" value={modelSummary.maxTokens != null ? String(modelSummary.maxTokens) : "Predeterminado"} />
            </div>

            {latestTurnSummary ? (
              <div className="space-y-2 rounded-md border border-border bg-muted/20 p-3">
                <div className="text-xs font-medium text-muted-foreground">Última ronda</div>
                <DebugRow label="Estado de giro" value={turnStatusLabel(latestTurnSummary.status)} />
                <DebugRow label="Fase de giro" value={latestTurnSummary.currentStage} />
                <DebugRow label="Punto de control de resumen" value={latestTurnSummary.checkpointId ?? "-"} />
              </div>
            ) : null}
          </div>
        </details>
      </CardContent>
    </Card>
  );
}
