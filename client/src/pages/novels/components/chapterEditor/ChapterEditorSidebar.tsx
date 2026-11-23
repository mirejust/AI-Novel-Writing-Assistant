import type { ReactNode } from "react";
import type { Chapter, ChapterEditorDiagnosticCard, ChapterEditorWorkspaceResponse } from "@ai-novel/shared/types/novel";
import { PanelLeftClose } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ChapterEditorDiagnosticList } from "./diagnostics";

interface ChapterEditorSidebarProps {
  chapter: Chapter;
  workspace: ChapterEditorWorkspaceResponse | null;
  workspaceStatus: "loading" | "ready" | "error";
  wordCount: number;
  saveStatusLabel: string;
  isDirty: boolean;
  isSaving: boolean;
  selectedDiagnosticId: string | null;
  onBack?: () => void;
  backLabel?: string;
  onOpenChapterVersions?: () => void;
  onOpenVersionHistory?: () => void;
  onRefreshWorkspace?: () => void;
  isRefreshingWorkspace?: boolean;
  onSave: () => void;
  onFocusDiagnostic: (card: ChapterEditorDiagnosticCard) => void;
  onRunDiagnostic: (card: ChapterEditorDiagnosticCard) => void;
  onResolveDiagnostic: (card: ChapterEditorDiagnosticCard) => void;
  isResolvingDiagnostic?: boolean;
  diagnosticsDisabled?: boolean;
  onCollapse?: () => void;
  qualityNotice?: ReactNode;
}

function MetaChip({ label }: { label: string }) {
  return <span className="rounded-full bg-muted px-2 py-1 text-xs text-muted-foreground">{label}</span>;
}

export default function ChapterEditorSidebar(props: ChapterEditorSidebarProps) {
  const { chapter, workspace } = props;
  const macro = workspace?.macroContext;
  const loading = props.workspaceStatus === "loading";
  return (
    <div className="flex h-full min-h-0 flex-col gap-5 overflow-y-auto px-3 py-2">
      <section className="space-y-4">
        <div className="flex items-center justify-between gap-2">
          {props.onBack ? <Button size="sm" variant="outline" onClick={props.onBack}>{props.backLabel ?? "Volver a la página de ejecución del capítulo"}</Button> : <span />}
          {props.onCollapse ? (
            <Button size="icon" variant="ghost" className="h-8 w-8" title="Contraer columna izquierda" onClick={props.onCollapse}>
              <PanelLeftClose className="h-4 w-4" />
            </Button>
          ) : null}
        </div>
        <h2 className="text-lg font-semibold leading-7">Cap. {chapter.order} capítulo · {chapter.title?.trim() || "Capítulo sin título"}</h2>
        <div className="flex flex-wrap gap-2">
          <MetaChip label={props.wordCount + " palabras"} />
          <MetaChip label={props.saveStatusLabel} />
          <MetaChip label={loading ? "Análisis de IA en progreso" : "Pendiente " + (workspace?.diagnosticCards.length ?? 0) + " artículo"} />
        </div>
        <div className="grid gap-2">
          <Button size="sm" onClick={props.onSave} disabled={!props.isDirty || props.isSaving} title="Guardar texto (Ctrl/Cmd+S)" aria-keyshortcuts="Control+S Meta+S">
            {props.isSaving ? "Guardando..." : "Guardar · Ctrl/Cmd+S"}
          </Button>
          {props.onOpenChapterVersions ? <Button size="sm" variant="outline" onClick={props.onOpenChapterVersions}>Ver versión de este capítulo</Button>
            : props.onOpenVersionHistory ? <Button size="sm" variant="outline" onClick={props.onOpenVersionHistory}>Entrada de versión</Button> : null}
          {props.onRefreshWorkspace ? <Button size="sm" variant="ghost" onClick={props.onRefreshWorkspace} disabled={props.isRefreshingWorkspace || props.diagnosticsDisabled}>
            {props.isRefreshingWorkspace ? "Analizando..." : "Vuelva a analizar este capítulo"}
          </Button> : null}
        </div>
      </section>
      {props.qualityNotice}
      <details className="border-t border-border/50 pt-5">
        <summary className="cursor-pointer text-sm font-medium">
          Objetivos del capítulo y antecedentes del capítulo
          {loading ? <span className="ml-2 text-xs font-normal text-muted-foreground">Analizando…</span> : null}
        </summary>
        <div className="mt-3 space-y-3">
          <p className="text-sm leading-6 text-muted-foreground">{macro?.chapterMission || (loading ? "La IA está resolviendo los objetivos de este capítulo, puedes continuar editando." : "Seleccione la ubicación que debe modificarse según el texto de este capítulo.")}</p>
          <div className="space-y-3 text-sm leading-6 text-muted-foreground">
            {macro ? <>
              <div><div className="font-medium text-foreground">Posición dentro del volumen</div>{macro.volumeTitle} · {macro.volumePositionLabel} · {macro.volumePhaseLabel}</div>
              <div><div className="font-medium text-foreground">Sugerencias de ritmo</div>{macro.paceDirective}</div>
              <div><div className="font-medium text-foreground">Emprender antes y después</div><p>Capítulo anterior:{macro.previousChapterBridge}</p><p>Siguiente capítulo:{macro.nextChapterBridge}</p></div>
            </> : <p>{loading ? "Se están analizando los antecedentes del capítulo." : "El fondo del capítulo no está disponible temporalmente y puede continuar editándolo manualmente."}</p>}
            {workspace?.chapterMeta.styleSummary ? <p>Método de escritura:{workspace.chapterMeta.styleSummary}</p> : null}
          </div>
        </div>
      </details>
      <ChapterEditorDiagnosticList workspace={workspace} status={props.workspaceStatus} selectedId={props.selectedDiagnosticId}
        disabled={props.diagnosticsDisabled ?? false} isDirty={props.isDirty} isResolving={props.isResolvingDiagnostic ?? false}
        onFocus={props.onFocusDiagnostic} onRun={props.onRunDiagnostic} onResolve={props.onResolveDiagnostic} />
    </div>
  );
}
