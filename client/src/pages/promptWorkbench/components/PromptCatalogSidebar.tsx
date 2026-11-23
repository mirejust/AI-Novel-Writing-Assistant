import { useState } from "react";
import { Layers3, RefreshCw, Search } from "lucide-react";
import type { PromptCatalogItem } from "@/api/promptWorkbench";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { TASK_TYPE_LABELS } from "../promptWorkbenchLabels";

interface PromptCatalogSidebarProps {
  keyword: string;
  onKeywordChange: (keyword: string) => void;
  prompts: PromptCatalogItem[];
  selectedKey: string | null;
  isLoading: boolean;
  isFetching: boolean;
  onSelect: (prompt: PromptCatalogItem) => void;
  onRefresh: () => void;
  onManagePlatforms: () => void;
}

export function PromptCatalogSidebar(props: PromptCatalogSidebarProps) {
  const [showAll, setShowAll] = useState(true);
  const editable = props.prompts.filter((prompt) => prompt.slotSupported || prompt.capabilities.supportsAdvancedTemplate);
  const searching = Boolean(props.keyword.trim());
  const visible = showAll || searching ? props.prompts : editable;
  return (
    <aside className="flex h-full min-h-0 flex-1 flex-col border-r border-border bg-card">
      <div className="shrink-0 space-y-3 px-4 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-base font-semibold">banco de trabajo de palabras rápidas</h1>
            <p className="mt-1 text-xs text-muted-foreground">Ajustar los requisitos de redacción y revisión para la IA</p>
          </div>
          <Button variant="ghost" size="sm" onClick={props.onRefresh} disabled={props.isFetching} aria-label="Actualizar el directorio de palabras del mensaje">
            <RefreshCw className={cn("h-4 w-4", props.isFetching && "animate-spin")} />
          </Button>
        </div>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={props.keyword} onChange={(event) => props.onKeywordChange(event.target.value)}
            aria-label="Buscar palabras clave" placeholder="Buscar nombre o propósito" className="pl-9 shadow-none" />
        </div>
        <div className="flex gap-1 rounded-md bg-muted p-1" aria-label="Rango de directorio de palabras rápidas">
          <Button variant={showAll ? "ghost" : "secondary"} size="sm" className="flex-1 shadow-none"
            aria-pressed={!showAll} onClick={() => setShowAll(false)}>Ajustable</Button>
          <Button variant={showAll ? "secondary" : "ghost"} size="sm" className="flex-1 shadow-none"
            aria-pressed={showAll} onClick={() => setShowAll(true)}>Todo</Button>
        </div>
        <p className="text-xs text-muted-foreground">
          {searching ? `Buscar todas las palabras clave · ${visible.length} artículo` : showAll ? `todo ${visible.length} elemento, incluidas las reglas de solo lectura del sistema` : `${editable.length} Los elementos se pueden ajustar y el resto usa las reglas del sistema.`}
        </p>
      </div>
      <div className="min-h-0 flex-1 space-y-1 overflow-y-auto px-2 pb-3">
        {props.isLoading ? <p className="p-3 text-sm text-muted-foreground">Leyendo palabras clave...</p>
          : visible.length === 0 ? <p className="p-3 text-sm text-muted-foreground">No hay palabras clave que coincidan.</p>
          : visible.map((prompt) => (
            <button key={prompt.key} type="button" aria-current={prompt.key === props.selectedKey ? "true" : undefined}
              onClick={() => props.onSelect(prompt)}
              className={cn("w-full rounded-md px-3 py-3 text-left transition-colors",
                prompt.key === props.selectedKey ? "bg-primary/10 text-primary" : "hover:bg-muted")}>
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium">{prompt.shortDescription || prompt.description || prompt.id}</span>
                {!prompt.slotSupported && !prompt.capabilities.supportsAdvancedTemplate
                  ? <span className="shrink-0 text-xs text-muted-foreground">Solo lectura</span> : null}
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                {prompt.capabilities.isProseGeneration ? "Escritura de textos·Lenguaje, narrativa y estilo" : TASK_TYPE_LABELS[prompt.taskType] ?? prompt.taskType}
              </div>
            </button>
          ))}
      </div>
      <div className="shrink-0 border-t border-border p-3">
        <Button variant="ghost" className="w-full justify-start" onClick={props.onManagePlatforms}>
          <Layers3 className="mr-2 h-4 w-4" />Preferencia de escritura en plataforma
        </Button>
      </div>
    </aside>
  );
}
