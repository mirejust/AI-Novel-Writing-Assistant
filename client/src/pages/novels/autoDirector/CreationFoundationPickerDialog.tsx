import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Check, Loader2, RotateCcw, Search } from "lucide-react";
import AssetTreeNavigator from "@/components/assetLibrary/AssetTreeNavigator";
import { Button } from "@/components/ui/button";
import { AppDialogContent, Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  filterCreationFoundationTree,
  findCreationFoundationNode,
  type CreationFoundationTreeNode,
} from "./creationFoundationPickerState";

interface CreationFoundationPickerDialogProps<Node extends CreationFoundationTreeNode> {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  treeTitle: string;
  nodes: Node[];
  selectedId: string;
  autoLabel: string;
  emptyLabel: string;
  loading: boolean;
  error: boolean;
  applying: boolean;
  onRetry: () => void;
  onApply: (nodeId: string) => Promise<boolean>;
  renderDetails?: (node: Node) => ReactNode;
}

export default function CreationFoundationPickerDialog<Node extends CreationFoundationTreeNode>({
  open,
  onOpenChange,
  title,
  description,
  treeTitle,
  nodes,
  selectedId,
  autoLabel,
  emptyLabel,
  loading,
  error,
  applying,
  onRetry,
  onApply,
  renderDetails,
}: CreationFoundationPickerDialogProps<Node>) {
  const [search, setSearch] = useState("");
  const [draftId, setDraftId] = useState(selectedId);

  useEffect(() => {
    if (!open) {
      return;
    }
    setSearch("");
    setDraftId(selectedId);
  }, [open, selectedId]);

  const filteredNodes = useMemo(
    () => filterCreationFoundationTree(nodes, search),
    [nodes, search],
  );
  const selectedNode = useMemo(
    () => findCreationFoundationNode(nodes, draftId),
    [draftId, nodes],
  );

  const applySelection = async (nodeId: string) => {
    const applied = await onApply(nodeId);
    if (applied) {
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <AppDialogContent
        title={title}
        description={description}
        className="max-w-6xl"
        bodyClassName="p-0"
        footer={(
          <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
            <Button
              type="button"
              variant="ghost"
              disabled={applying}
              onClick={() => void applySelection("")}
            >
              <RotateCcw className="h-4 w-4" />
              {autoLabel}
            </Button>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={applying}>
                Cancelar
              </Button>
              <Button
                type="button"
                disabled={!draftId || applying}
                onClick={() => void applySelection(draftId)}
              >
                {applying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                usa esta dirección
              </Button>
            </div>
          </div>
        )}
      >
        {loading ? (
          <div className="flex min-h-72 items-center justify-center text-sm text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Leer instrucciones opcionales
          </div>
        ) : error ? (
          <div className="flex min-h-72 flex-col items-center justify-center gap-3 px-6 text-center">
            <div className="text-sm font-medium text-foreground">Temporalmente no puedo leer instrucciones opcionales</div>
            <div className="text-xs leading-5 text-muted-foreground">Aún puedes dejar que la IA coincida automáticamente o recargar y elegir nuevamente.</div>
            <Button type="button" variant="outline" size="sm" onClick={onRetry}>Recargar</Button>
          </div>
        ) : nodes.length === 0 ? (
          <div className="flex min-h-72 items-center justify-center px-6 text-sm text-muted-foreground">
            {emptyLabel}
          </div>
        ) : (
          <div className="grid min-h-[430px] lg:h-[min(600px,calc(100dvh-14rem))] lg:grid-cols-[336px_minmax(0,1fr)]">
            <div className="border-b border-border/70 lg:border-b-0 lg:border-r">
              <div className="border-b border-border/70 p-3">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    className="h-9 pl-9"
                    placeholder="Buscar nombre o descripción"
                  />
                </div>
              </div>
              {filteredNodes.length > 0 ? (
                <AssetTreeNavigator
                  nodes={filteredNodes}
                  selectedId={draftId}
                  onSelect={setDraftId}
                  title={treeTitle}
                  hint="Haga clic para ver"
                  ariaLabel={`${title}Tabla de contenido`}
                  viewportClassName="max-h-[356px]"
                />
              ) : (
                <div className="px-4 py-10 text-center text-sm text-muted-foreground">No hay dirección coincidente</div>
              )}
            </div>

            <div className="px-6 py-8 sm:px-8 lg:min-h-0 lg:overflow-y-auto">
              {selectedNode ? (
                renderDetails ? renderDetails(selectedNode) : (
                  <div className="flex min-h-full flex-col justify-center">
                    <div className="text-xs font-medium tracking-[0.16em] text-muted-foreground">Selección actual</div>
                    <div className="mt-3 text-2xl font-semibold text-foreground">{selectedNode.name}</div>
                    <p className="mt-4 max-w-xl text-sm leading-7 text-muted-foreground">
                      {selectedNode.description?.trim() || "Esta dirección servirá como base creativa para que la IA organice todo el plan del libro."}
                    </p>
                  </div>
                )
              ) : (
                <div className="flex min-h-full flex-col justify-center">
                  <div className="text-xs font-medium tracking-[0.16em] text-muted-foreground">Mantenlo ligero</div>
                  <div className="mt-3 text-2xl font-semibold text-foreground">{autoLabel}</div>
                  <p className="mt-4 max-w-xl text-sm leading-7 text-muted-foreground">
                    La IA combinará sus ideas iniciales, la plataforma de destino y el sentido de lectura para elegir automáticamente una dirección más adecuada para escribir todo el libro.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </AppDialogContent>
    </Dialog>
  );
}
