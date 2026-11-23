import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface CreativeHubToolResultCardProps {
  toolName: string;
  summary: string;
  success: boolean;
  output?: Record<string, unknown>;
  errorCode?: string;
  onQuickAction?: (prompt: string) => void;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function asRecordArray(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value)
    ? value.map((item) => asRecord(item)).filter((item) => Object.keys(item).length > 0)
    : [];
}

function itemLabel(item: Record<string, unknown>): string {
  const candidates = ["title", "name", "label", "summary", "content"];
  for (const key of candidates) {
    const value = item[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  if (typeof item.id === "string" && item.id.trim()) {
    return item.id.trim();
  }
  return "Entrada sin nombre";
}

function compactText(value: string, max = 140): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return "";
  }
  return normalized.length > max ? `${normalized.slice(0, max)}...` : normalized;
}

function formatNovelProjectStatus(value: unknown): string | null {
  switch (value) {
    case "in_progress":
      return "por escrito";
    case "not_started":
      return "Sin empezar";
    case "completed":
      return "Completado";
    case "rework":
      return "Retrabajo en progreso";
    case "blocked":
      return "Bloqueado";
    default:
      return null;
  }
}

function renderActionButtons(actions: Array<{ label: string; prompt: string }>, onQuickAction?: (prompt: string) => void) {
  if (!onQuickAction || actions.length === 0) {
    return null;
  }
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {actions.map((action) => (
        <Button
          key={`${action.label}-${action.prompt}`}
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onQuickAction(action.prompt)}
        >
          {action.label}
        </Button>
      ))}
    </div>
  );
}

function renderNovelList(output: Record<string, unknown>, onQuickAction?: (prompt: string) => void) {
  const total = typeof output.total === "number" ? output.total : null;
  const items = asRecordArray(output.items).slice(0, 8);
  return (
    <div className="space-y-2">
      <div className="text-xs text-muted-foreground">
        Encontró {total ?? items.length} esta novela
        {total != null && total > items.length ? `, antes de la visualización actual ${items.length} Libro` : ""}
      </div>
      <div className="space-y-2">
        {items.map((item) => {
          const title = itemLabel(item);
          const chapterCount = typeof item.chapterCount === "number" ? item.chapterCount : null;
          const projectStatus = formatNovelProjectStatus(item.projectStatus);
          return (
            <div key={`${item.id ?? title}`} className="rounded-md border border-border bg-muted/20 px-3 py-2">
              <div className="text-sm font-medium text-foreground">«{title}»</div>
              <div className="mt-1 text-xs text-muted-foreground">
                {chapterCount != null ? `${chapterCount}` : "Capitulo desconocido"}
                {projectStatus ? ` · ${projectStatus}` : ""}
              </div>
              {onQuickAction ? (
                <div className="mt-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => onQuickAction(`Manojo"${title}»Establecer como espacio de trabajo actual`)}
                  >
                    Establecer como espacio de trabajo actual
                  </Button>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function renderWorkspaceCard(
  output: Record<string, unknown>,
  variant: "created" | "selected",
  onQuickAction?: (prompt: string) => void,
) {
  const title = typeof output.title === "string" && output.title.trim() ? output.title.trim() : "Novela sin título";
  const chapterCount = typeof output.chapterCount === "number" ? output.chapterCount : 0;
  const actions = variant === "created"
    ? [
      { label: "Ver el progreso actual", prompt: "¿En qué capítulo se encuentra este libro actualmente?" },
      { label: "Comienza a diseñar el primer capítulo.", prompt: "Planificando el primer capítulo del libro." },
    ]
    : [
      { label: "Ver el progreso actual", prompt: "¿En qué capítulo se encuentra este libro actualmente?" },
      { label: "Ver los dos primeros capítulos", prompt: "¿Qué se escribió en los dos primeros capítulos?" },
    ];
  return (
    <div className="space-y-2">
      <div className="rounded-md border border-success/30 bg-success/5 px-3 py-3">
        <div className="text-sm font-medium text-foreground">«{title}»</div>
        <div className="mt-1 text-xs text-muted-foreground">
          {variant === "created" ? "Se crea una nueva novela y se vincula al hilo actual." : "El hilo actual se ha cambiado al nuevo espacio de trabajo."}
        </div>
        <div className="mt-2 text-xs text-muted-foreground">Número actual de capítulos:{chapterCount}</div>
      </div>
      {renderActionButtons(actions, onQuickAction)}
    </div>
  );
}

function renderWorldBindingCard(output: Record<string, unknown>, onQuickAction?: (prompt: string) => void) {
  const novelTitle = typeof output.novelTitle === "string" && output.novelTitle.trim()
    ? output.novelTitle.trim()
    : "Novela actual";
  const worldName = typeof output.worldName === "string" && output.worldName.trim()
    ? output.worldName.trim()
    : "Visión del mundo sin nombre";
  return (
    <div className="space-y-2">
      <div className="rounded-md border border-info/30 bg-info/5 px-3 py-3">
        <div className="text-sm font-medium text-foreground">«{novelTitle}»</div>
        <div className="mt-1 text-xs text-muted-foreground">Visión del mundo limitada«{worldName}».</div>
      </div>
      {renderActionButtons([
        { label: "Ver limitaciones de la cosmovisión", prompt: "Ver las reglas de la cosmovisión de la novela actual." },
        { label: "Compruebe si hay conflictos de cosmovisión", prompt: "Compruebe si hay algún conflicto entre la novela actual y la cosmovisión." },
      ], onQuickAction)}
    </div>
  );
}

function renderProductionAssetCard(
  title: string,
  description: string,
  actions: Array<{ label: string; prompt: string }>,
  onQuickAction?: (prompt: string) => void,
) {
  return (
    <div className="space-y-2">
      <div className="rounded-md border border-primary/25 bg-primary/5 px-3 py-3">
        <div className="text-sm font-medium text-foreground">{title}</div>
        <div className="mt-1 text-xs leading-5 text-muted-foreground">{description}</div>
      </div>
      {renderActionButtons(actions, onQuickAction)}
    </div>
  );
}

function renderProductionStatusCard(output: Record<string, unknown>, onQuickAction?: (prompt: string) => void) {
  const title = typeof output.title === "string" && output.title.trim() ? output.title.trim() : "Novela actual";
  const currentStage = typeof output.currentStage === "string" ? output.currentStage.trim() : "Etapa desconocida";
  const chapterCount = typeof output.chapterCount === "number" ? output.chapterCount : 0;
  const targetChapterCount = typeof output.targetChapterCount === "number" ? output.targetChapterCount : null;
  const pipelineStatus = typeof output.pipelineStatus === "string" && output.pipelineStatus.trim()
    ? output.pipelineStatus.trim()
    : "No iniciado";
  const assetStages = asRecordArray(output.assetStages);
  return (
    <div className="space-y-2">
      <div className="rounded-md border border-info/30 bg-info/5 px-3 py-3">
        <div className="text-sm font-medium text-foreground">«{title}»</div>
        <div className="mt-1 text-xs text-muted-foreground">Etapa actual:{currentStage}</div>
        <div className="mt-1 text-xs text-muted-foreground">
          Índice del capítulo:{targetChapterCount != null ? `${chapterCount}/${targetChapterCount}` : chapterCount} capítulo
        </div>
        <div className="mt-1 text-xs text-muted-foreground">Escritura completa:{pipelineStatus}</div>
        {typeof output.failureSummary === "string" && output.failureSummary.trim() ? (
          <div className="mt-2 text-xs leading-5 text-muted-foreground">Resumen de fallas:{output.failureSummary.trim()}</div>
        ) : null}
      </div>
      {assetStages.length > 0 ? (
        <div className="grid gap-2">
          {assetStages.slice(0, 8).map((stage) => (
            <div key={`${stage.key ?? stage.label}`} className="rounded-md border border-border bg-muted/20 px-3 py-2">
              <div className="text-sm font-medium text-foreground">{String(stage.label ?? stage.key ?? "Escenario")}</div>
              <div className="mt-1 text-xs text-muted-foreground">Estado:{String(stage.status ?? "unknown")}</div>
              {typeof stage.detail === "string" && stage.detail.trim() ? (
                <div className="mt-1 text-xs text-muted-foreground">{stage.detail.trim()}</div>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
      {renderActionButtons([
        { label: "Ver progreso del libro", prompt: "Estado de la generación del libro" },
      ], onQuickAction)}
    </div>
  );
}

function renderPipelineRunCard(
  toolName: "preview_pipeline_run" | "queue_pipeline_run",
  output: Record<string, unknown>,
  onQuickAction?: (prompt: string) => void,
) {
  const startOrder = typeof output.startOrder === "number" ? output.startOrder : null;
  const endOrder = typeof output.endOrder === "number" ? output.endOrder : null;
  const jobId = typeof output.jobId === "string" && output.jobId.trim() ? output.jobId.trim() : null;
  const scope = startOrder != null && endOrder != null
    ? startOrder === endOrder
      ? `Cap. ${startOrder}`
      : `Cap. ${startOrder} al tercero ${endOrder}`
    : "Alcance del capítulo actual";
  const title = toolName === "preview_pipeline_run" ? "Vista previa de escritura completa" : "Tarea de escritura completa";
  const description = toolName === "preview_pipeline_run"
    ? `${scope} Se completó toda la vista previa de la escritura y actualmente está lista para su aprobación o diagnóstico continuo.`
    : `${scope} Se ha iniciado toda la tarea de escritura.${jobId ? `(Tarea ${jobId})` : ""}.`;
  const actions = toolName === "preview_pipeline_run"
    ? [
      { label: "Ver progreso del libro", prompt: "Estado de la generación del libro" },
      { label: "Ver bloqueo", prompt: "¿Por qué no se inicia toda la compilación?" },
    ]
    : [
      { label: "Ver progreso del libro", prompt: "Estado de la generación del libro" },
      { label: "Ver el estado de la tarea", prompt: "Enumerar el estado actual de las tareas del sistema" },
    ];
  return renderProductionAssetCard(title, description, actions, onQuickAction);
}

function renderDiagnosticCard(output: Record<string, unknown>, onQuickAction?: (prompt: string) => void) {
  const failureSummary = typeof output.failureSummary === "string" ? output.failureSummary : "";
  const failureDetails = typeof output.failureDetails === "string" ? output.failureDetails : "";
  const recoveryHint = typeof output.recoveryHint === "string" ? output.recoveryHint : "";
  return (
    <div className="space-y-2">
      {failureSummary ? <div className="text-sm font-medium text-foreground">{failureSummary}</div> : null}
      {failureDetails ? <div className="text-xs leading-5 text-muted-foreground">Detalles:{failureDetails}</div> : null}
      {recoveryHint ? <div className="text-xs leading-5 text-muted-foreground">Sugerencia:{recoveryHint}</div> : null}
      {renderActionButtons([
        { label: "Continuar diagnosticando", prompt: "Continúe explicando la causa del error y las recomendaciones de recuperación." },
        { label: "Ver el estado de la tarea", prompt: "Enumerar el estado actual de las tareas del sistema" },
      ], onQuickAction)}
    </div>
  );
}

function renderListCard(
  output: Record<string, unknown>,
  emptyLabel: string,
  onQuickAction?: (prompt: string) => void,
) {
  const items = asRecordArray(output.items).slice(0, 6);
  if (items.length === 0) {
    return <div className="text-xs text-muted-foreground">{emptyLabel}</div>;
  }
  return (
    <div className="space-y-2">
      <div className="space-y-2">
        {items.map((item) => (
          <div key={`${item.id ?? itemLabel(item)}`} className="rounded-md border border-border bg-muted/20 px-3 py-2">
            <div className="text-sm font-medium text-foreground">{itemLabel(item)}</div>
            {"status" in item && typeof item.status === "string" ? (
              <div className="mt-1 text-xs text-muted-foreground">Estado:{item.status}</div>
            ) : null}
          </div>
        ))}
      </div>
      {renderActionButtons([{ label: "Continuar filtrando", prompt: "Continúe refinando esta lista de resultados." }], onQuickAction)}
    </div>
  );
}

function renderChapterCard(output: Record<string, unknown>, onQuickAction?: (prompt: string) => void) {
  const title = typeof output.title === "string" && output.title.trim() ? output.title.trim() : "";
  const order = typeof output.order === "number" ? output.order : null;
  const content = typeof output.content === "string"
    ? output.content
    : typeof output.summary === "string"
      ? output.summary
      : "";
  return (
    <div className="space-y-2">
      <div className="text-sm font-medium text-foreground">
        {order != null ? `Cap.${order}Cap.` : "Contenido del capítulo"}
        {title ? `«${title}»` : ""}
      </div>
      <div className="rounded-md border border-border bg-muted/20 px-3 py-3 text-sm leading-6 text-muted-foreground">
        {content || "Actualmente no hay contenido de capítulo para mostrar."}
      </div>
      {renderActionButtons([
        { label: "Continuar resumiendo", prompt: "Resume la trama clave de este párrafo." },
        { label: "Compruebe si hay conflictos", prompt: "Compruebe si este capítulo entra en conflicto con la visión del mundo o el texto anterior." },
      ], onQuickAction)}
    </div>
  );
}

export default function CreativeHubToolResultCard({
  toolName,
  summary,
  success,
  output,
  errorCode,
  onQuickAction,
}: CreativeHubToolResultCardProps) {
  const [expanded, setExpanded] = useState(false);
  const detailsId = useId();
  const payload = asRecord(output);
  const summaryText = compactText(summary, 160) || "La herramienta ha arrojado resultados.";
  const cardContent = (() => {
    if (toolName === "list_novels") {
      return renderNovelList(payload, onQuickAction);
    }
    if (toolName === "create_novel") {
      return renderWorkspaceCard(payload, "created", onQuickAction);
    }
    if (toolName === "select_novel_workspace") {
      return renderWorkspaceCard(payload, "selected", onQuickAction);
    }
    if (toolName === "bind_world_to_novel") {
      return renderWorldBindingCard(payload, onQuickAction);
    }
    if (toolName === "generate_world_for_novel") {
      const worldName = typeof payload.worldName === "string" && payload.worldName.trim() ? payload.worldName.trim() : "Visión del mundo sin nombre";
      return renderProductionAssetCard(
        "Se ha generado una visión del mundo.",
        `Se ha generado una cosmovisión${worldName}».`,
        [
          { label: "Verificar el progreso de la producción", prompt: "Estado de la generación del libro" },
        ],
        onQuickAction,
      );
    }
    if (toolName === "generate_novel_characters") {
      const characterCount = typeof payload.characterCount === "number" ? payload.characterCount : 0;
      return renderProductionAssetCard(
        "Se han generado roles centrales.",
        `Generado ${characterCount} un papel central.`,
        [
          { label: "Ver el estado del personaje", prompt: "Ver el estado actual del personaje de la novela" },
        ],
        onQuickAction,
      );
    }
    if (toolName === "generate_story_bible") {
      return renderProductionAssetCard(
        "Se ha generado una novela bíblica.",
        typeof payload.mainPromise === "string" && payload.mainPromise.trim()
          ? payload.mainPromise.trim()
          : "Se ha generado la novela actual de la Biblia.",
        [
          { label: "Ver progreso del libro", prompt: "Estado de la generación del libro" },
        ],
        onQuickAction,
      );
    }
    if (toolName === "generate_novel_outline") {
      return renderProductionAssetCard(
        "La tendencia de desarrollo se ha generado",
        typeof payload.outline === "string" && payload.outline.trim()
          ? payload.outline.trim()
          : "Se ha generado la tendencia actual de desarrollo de la novela.",
        [
          { label: "Ver progreso del libro", prompt: "Estado de la generación del libro" },
        ],
        onQuickAction,
      );
    }
    if (toolName === "generate_structured_outline") {
      const targetChapterCount = typeof payload.targetChapterCount === "number" ? payload.targetChapterCount : 0;
      return renderProductionAssetCard(
        "Esquema estructurado generado",
        targetChapterCount > 0 ? `Generado ${targetChapterCount} Esquema estructurado del capítulo.` : "Se ha generado el esquema estructurado de la novela actual.",
        [
          { label: "Ver progreso del libro", prompt: "Estado de la generación del libro" },
        ],
        onQuickAction,
      );
    }
    if (toolName === "sync_chapters_from_structured_outline") {
      const chapterCount = typeof payload.chapterCount === "number" ? payload.chapterCount : 0;
      return renderProductionAssetCard(
        "La tabla de contenidos del capítulo ha sido sincronizada.",
        chapterCount > 0 ? `Sincronizado ${chapterCount} Tabla de contenido.` : "La tabla de contenidos del capítulo se ha sincronizado.",
        [
          { label: "Ver progreso del libro", prompt: "Estado de la generación del libro" },
          { label: "Ver el estado de la tarea", prompt: "Enumerar el estado actual de las tareas del sistema" },
        ],
        onQuickAction,
      );
    }
    if (toolName === "start_full_novel_pipeline" || toolName === "get_novel_production_status") {
      return renderProductionStatusCard(payload, onQuickAction);
    }
    if (toolName === "preview_pipeline_run" || toolName === "queue_pipeline_run") {
      return renderPipelineRunCard(toolName, payload, onQuickAction);
    }
    if (
      toolName === "get_task_failure_reason"
      || toolName === "get_run_failure_reason"
      || toolName === "get_index_failure_reason"
      || toolName === "get_book_analysis_failure_reason"
      || toolName === "explain_generation_blocker"
      || toolName === "explain_world_conflict"
      || toolName === "failure_diagnostic"
    ) {
      return renderDiagnosticCard(payload, onQuickAction);
    }
    if (
      toolName === "list_worlds"
      || toolName === "list_tasks"
      || toolName === "list_knowledge_documents"
      || toolName === "list_book_analyses"
      || toolName === "list_writing_formulas"
      || toolName === "list_base_characters"
    ) {
      return renderListCard(payload, "Actualmente no hay resultados para mostrar.", onQuickAction);
    }
    if (
      toolName === "get_chapter_content"
      || toolName === "get_chapter_content_by_order"
      || toolName === "summarize_chapter_range"
    ) {
      return renderChapterCard(payload, onQuickAction);
    }
    return null;
  })();

  if (!cardContent) {
    return null;
  }

  return (
    <div className="mt-3 rounded-md border border-border bg-muted/20 px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <div className="text-sm font-medium text-foreground">{summaryText}</div>
          <Badge variant={success ? "secondary" : "destructive"}>{success ? "Resultados analizados" : "La ejecución falló"}</Badge>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => setExpanded((value) => !value)}
          aria-expanded={expanded}
          aria-controls={detailsId}
        >
          {expanded ? "Contraer detalles" : "Ampliar detalles"}
        </Button>
      </div>
      {expanded ? (
        <div id={detailsId} className="mt-3 space-y-3">
          {!success && errorCode ? (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-muted-foreground">
              Código de error:{errorCode}
            </div>
          ) : null}
          {cardContent}
        </div>
      ) : (
        <div className="mt-2 text-xs text-muted-foreground">Los resultados de ejecución detallados están ocultos de forma predeterminada y se pueden ver a pedido.</div>
      )}
    </div>
  );
}
