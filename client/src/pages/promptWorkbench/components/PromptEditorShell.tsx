import type { ReactNode } from "react";
import { WorkspaceColumns } from "@/components/layout/resizableWorkspace";
import { Maximize2, Minimize2 } from "lucide-react";
import type { PromptCatalogItem, PromptSlotOverrideScope } from "@/api/promptWorkbench";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import SelectControl from "@/components/common/SelectControl";
import { ENTRYPOINT_OPTIONS, OUTPUT_TYPE_LABELS } from "../promptWorkbenchLabels";

interface PromptEditorShellProps {
  prompt: PromptCatalogItem;
  immersive?: boolean;
  onImmersiveChange?: (next: boolean) => void;
  entrypoint: string;
  onEntrypointChange: (entrypoint: string) => void;
  scope: PromptSlotOverrideScope;
  onScopeChange: (scope: PromptSlotOverrideScope) => void;
  selectedNovelId: string;
  onNovelChange: (novelId: string) => void;
  novels: Array<{ id: string; title?: string | null }>;
  selectedChapterId: string;
  onChapterChange: (chapterId: string) => void;
  chapters: Array<{ id: string; title?: string | null; order?: number | null; hasContent?: boolean }>;
  bodyPanel: ReactNode;
  contextPanel?: ReactNode;
  runBar: ReactNode;
  simplified?: boolean;
  heading?: string;
  advanced?: boolean;
}

export function PromptEditorShell(props: PromptEditorShellProps) {
  const { prompt, immersive = false, simplified = false, scope, advanced = false } = props;
  const globalOnly = prompt.management?.slotScope === "global";
  return (
    <section className="flex h-full min-h-0 flex-col bg-background">
      <header className="shrink-0 border-b border-border bg-card px-5 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-xl font-semibold">{props.heading || prompt.shortDescription || prompt.description || prompt.id}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{simplified
              ? "Ajuste la plantilla de texto y compare los resultados de la prueba con ejemplos o capítulos de este libro."
              : prompt.description}</p>
          </div>
          {props.onImmersiveChange ? (
            <Button variant="ghost" size="sm" onClick={() => props.onImmersiveChange?.(!immersive)}>
              {immersive ? <Minimize2 className="mr-2 h-4 w-4" /> : <Maximize2 className="mr-2 h-4 w-4" />}
              {immersive ? "Dejar de centrarse" : "Centrarse en la edición"}
            </Button>
          ) : null}
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          {!simplified && !globalOnly ? (
            <Tabs value={scope} onValueChange={(value) => props.onScopeChange(value as PromptSlotOverrideScope)}>
              <TabsList>
                <TabsTrigger value="global">{advanced ? "Borrador de plantilla" : "Todas las novelas"}</TabsTrigger>
                <TabsTrigger value="novel">{advanced ? "Plantilla de libro" : "Novela designada"}</TabsTrigger>
              </TabsList>
            </Tabs>
          ) : null}
          {scope === "novel" ? (
            <SelectControl value={props.selectedNovelId} onChange={(event) => props.onNovelChange(event.target.value)}
              aria-label="Ámbito de aplicación: novelas" className="h-9 max-w-72 rounded-md border border-input bg-background px-3 text-sm">
              <option value="">{advanced ? "Seleccione una novela (se puede seleccionar más tarde)" : "Selecciona la novela que deseas ajustar"}</option>
              {props.novels.map((novel) => <option key={novel.id} value={novel.id}>{novel.title || novel.id}</option>)}
            </SelectControl>
          ) : null}
          <span className="text-xs text-muted-foreground">{globalOnly ? "Ámbito de aplicación: todas las novelas." : advanced
            ? (scope === "novel" && props.selectedNovelId ? "Guardar para usar solo en esta novela." : "Se puede editar directamente y luego seleccionar la novela al guardar la aplicación.")
            : scope === "global" ? "Como requisito predeterminado para todas las novelas, el contenido establecido individualmente en este libro tiene prioridad." : "Sólo afecta a novelas seleccionadas."}</span>
        </div>
        <details className="mt-3 text-xs text-muted-foreground">
          <summary className="w-fit cursor-pointer">Vista previa de la configuración e información de palabras rápidas</summary>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2">Simular escenarios de uso
              <SelectControl value={props.entrypoint} onChange={(event) => props.onEntrypointChange(event.target.value)}
                className="h-8 rounded-md border border-input bg-background px-2">
                {ENTRYPOINT_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </SelectControl>
            </label>
            {scope === "novel" && props.selectedNovelId ? (
              <label className="flex items-center gap-2">Vista previa del capítulo
                <SelectControl value={props.selectedChapterId} onChange={(event) => props.onChapterChange(event.target.value)}
                  className="h-8 max-w-72 rounded-md border border-input bg-background px-2">
                  <option value="">Seleccionar capítulo</option>
                  {props.chapters.map((chapter) => <option key={chapter.id} value={chapter.id}>
                    Cap. {chapter.order ?? "?"} capitulo {chapter.title || "Capítulo sin título"}{chapter.hasContent ? "" : "(sin texto)"}
                  </option>)}
                </SelectControl>
              </label>
            ) : <span>Utilice la vista previa del contenido de muestra sin cambiar el texto novedoso</span>}
            <span className="break-all">{prompt.key} · {OUTPUT_TYPE_LABELS[prompt.outputType] ?? prompt.outputType} · Presupuesto contextual {prompt.contextPolicy.maxTokensBudget} tokens</span>
          </div>
        </details>
      </header>
      <div className={cn("min-h-0 flex-1", immersive && "px-4 py-4")}>
        {props.contextPanel ? (
          <WorkspaceColumns layoutId="prompt-context" className="h-full min-h-0 workspace-split" gap={0} minCenter={220}
            right={{ label: "Ajustar el ancho de referencia de datos", initial: "30%", min: 160 }}>
            <div className={cn("h-full min-h-0 overflow-y-auto px-5 py-5 pb-12", immersive && "bg-card px-8 py-7 pb-32")}>
              {props.bodyPanel}
            </div>
            <div className="h-full min-h-0 bg-muted/20">{props.contextPanel}</div>
          </WorkspaceColumns>
        ) : (
          <div className={cn("h-full min-h-0 overflow-y-auto px-5 py-5 pb-12", immersive && "bg-card px-8 py-7 pb-32")}>
            {props.bodyPanel}
          </div>
        )}
      </div>
      {props.runBar}
    </section>
  );
}
