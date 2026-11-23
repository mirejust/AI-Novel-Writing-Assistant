import { useEffect, useMemo, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import type { GenreTreeNode } from "@/api/genre";
import { AssetTreeNavigator } from "@/components/assetLibrary";
import { Button } from "@/components/ui/button";
import { countGenreNovelBindingsInSubtree, findGenreNode } from "../genreManagement.shared";

interface GenreTreeBrowserProps {
  nodes: GenreTreeNode[];
  onCreateChild: (parentId: string) => void;
  onEdit: (genreId: string) => void;
  onDelete: (genre: GenreTreeNode) => void;
  deletingId?: string;
  initialSelectedId?: string;
}

function findGenrePath(nodes: GenreTreeNode[], targetId: string, parents: string[] = []): string[] {
  for (const node of nodes) {
    const nextPath = [...parents, node.name];
    if (node.id === targetId) return nextPath;
    const childPath = findGenrePath(node.children, targetId, nextPath);
    if (childPath.length > 0) return childPath;
  }
  return [];
}

export default function GenreTreeBrowser({
  nodes,
  onCreateChild,
  onEdit,
  onDelete,
  deletingId,
  initialSelectedId,
}: GenreTreeBrowserProps) {
  const [selectedId, setSelectedId] = useState(initialSelectedId || nodes[0]?.id || "");
  const selectedNode = useMemo(() => findGenreNode(nodes, selectedId), [nodes, selectedId]);
  const selectedPath = useMemo(() => findGenrePath(nodes, selectedId), [nodes, selectedId]);

  useEffect(() => {
    if (initialSelectedId && findGenreNode(nodes, initialSelectedId)) {
      setSelectedId(initialSelectedId);
      return;
    }
    if (!selectedNode && nodes[0]) setSelectedId(nodes[0].id);
  }, [initialSelectedId, nodes, selectedNode]);

  if (!selectedNode) return null;

  const boundNovelCount = countGenreNovelBindingsInSubtree(selectedNode);
  const deleteDisabled = boundNovelCount > 0;

  return (
    <div className="grid overflow-hidden rounded-lg border border-border/80 bg-background lg:grid-cols-[320px_minmax(0,1fr)]">
      <AssetTreeNavigator
        nodes={nodes}
        selectedId={selectedId}
        onSelect={setSelectedId}
        title="Catálogo de materias"
        hint="Haga clic en el nodo para ver detalles"
        ariaLabel="Árbol base del tema"
        viewportClassName="max-h-[380px]"
      />

      <section className="flex min-w-0 flex-col" aria-labelledby="selected-genre-title">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 px-5 py-3">
          <div className="truncate text-xs text-muted-foreground">{selectedPath.join(" / ")}</div>
          <div className="flex items-center gap-1">
            <Button type="button" variant="ghost" size="sm" onClick={() => onCreateChild(selectedNode.id)}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              Agregar subordinado
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => onEdit(selectedNode.id)}>
              <Pencil className="h-4 w-4" aria-hidden="true" />
              editar
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive"
              disabled={deleteDisabled || deletingId === selectedNode.id}
              title={deleteDisabled ? "El tema actual o el tema subordinado todavía se utiliza en la novela; ajuste primero los trabajos relacionados." : undefined}
              onClick={() => onDelete(selectedNode)}
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
              {deletingId === selectedNode.id ? "Eliminando..." : "Eliminar"}
            </Button>
          </div>
        </div>

        <div className="px-5 py-5 sm:px-7 sm:py-6">
          <div className="max-w-3xl">
            <div className="text-xs font-medium tracking-[0.16em] text-muted-foreground">Base temática</div>
            <h2 id="selected-genre-title" className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
              {selectedNode.name}
            </h2>
            <p className="mt-4 text-sm leading-7 text-muted-foreground">
              {selectedNode.description?.trim() || "Aún no se ha especificado a qué lectores está destinado este tema y qué experiencias promete. Con instrucciones adicionales, la IA se puede utilizar con mayor precisión para la apertura y planificación de libros."}
            </p>

            <div className="mt-5 flex flex-wrap gap-x-6 gap-y-2 border-y border-border/70 py-3 text-xs text-muted-foreground">
              <span>Directamente relacionado <strong className="ml-1 font-semibold text-foreground">{selectedNode.novelCount}</strong></span>
              <span>Temas subordinados <strong className="ml-1 font-semibold text-foreground">{selectedNode.childCount}</strong></span>
              <span>obras sucursales <strong className="ml-1 font-semibold text-foreground">{boundNovelCount}</strong></span>
            </div>

            {selectedNode.template?.trim() ? (
              <div className="mt-5 border-l-2 border-foreground/20 pl-4">
                <div className="text-sm font-semibold text-foreground">Tendencias de uso de la IA</div>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-muted-foreground">
                  {selectedNode.template}
                </p>
              </div>
            ) : null}
          </div>
        </div>
      </section>
    </div>
  );
}
