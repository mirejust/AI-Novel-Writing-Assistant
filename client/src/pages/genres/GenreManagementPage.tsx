import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import {
  BookOpen,
  CircleAlert,
  FileText,
  Layers3,
  LoaderCircle,
  Plus,
  Sparkles,
  Tags,
} from "lucide-react";
import { deleteGenre, flattenGenreTreeOptions, getGenreTree, type GenreTreeNode } from "@/api/genre";
import { queryKeys } from "@/api/queryKeys";
import {
  AssetLibraryEmptyState,
  AssetLibraryHeader,
  AssetLibraryRecommendation,
  AssetLibrarySection,
  AssetLibraryStatusGrid,
  type AssetLibraryStatusItem,
} from "@/components/assetLibrary";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import GenreCreateDialog from "./components/GenreCreateDialog";
import GenreEditDialog from "./components/GenreEditDialog";
import GenreTreeBrowser from "./components/GenreTreeBrowser";
import {
  collectDescendantIds,
  countGenreNovelBindingsInSubtree,
  countGenres,
  findGenreNode,
} from "./genreManagement.shared";

export default function GenreManagementPage() {
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [defaultParentId, setDefaultParentId] = useState("");
  const [editingGenreId, setEditingGenreId] = useState("");

  const genreTreeQuery = useQuery({
    queryKey: queryKeys.genres.all,
    queryFn: getGenreTree,
  });

  const genreTree = genreTreeQuery.data?.data ?? [];
  const parentOptions = useMemo(() => flattenGenreTreeOptions(genreTree), [genreTree]);
  const totalGenres = useMemo(() => countGenres(genreTree), [genreTree]);
  const linkedNovelCount = useMemo(
    () => genreTree.reduce((total, node) => total + countGenreNovelBindingsInSubtree(node), 0),
    [genreTree],
  );
  const describedGenreCount = useMemo(
    () => parentOptions.filter((option) => Boolean(option.description?.trim())).length,
    [parentOptions],
  );
  const firstGenreWithoutDescription = useMemo(
    () => parentOptions.find((option) => !option.description?.trim()) ?? null,
    [parentOptions],
  );
  const editingGenre = useMemo(
    () => (editingGenreId ? findGenreNode(genreTree, editingGenreId) : null),
    [editingGenreId, genreTree],
  );
  const blockedParentIds = useMemo(
    () => editingGenre ? new Set([editingGenre.id, ...collectDescendantIds(editingGenre)]) : new Set<string>(),
    [editingGenre],
  );
  const statusUnavailable = genreTreeQuery.isLoading || genreTreeQuery.isError;
  const statusItems = useMemo<AssetLibraryStatusItem[]>(() => [
    {
      key: "genres",
      label: "Base temática",
      value: statusUnavailable ? "—" : totalGenres,
      detail: "Nodos de categoría para selección de novelas",
      icon: Tags,
      tone: statusUnavailable ? "neutral" : "info",
    },
    {
      key: "roots",
      label: "Categoría raíz",
      value: statusUnavailable ? "—" : genreTree.length,
      detail: "Se utiliza para dividir las principales direcciones creativas.",
      icon: Layers3,
    },
    {
      key: "novels",
      label: "Novelas relevantes",
      value: statusUnavailable ? "—" : linkedNovelCount,
      detail: "Funciona usando estos temas.",
      icon: BookOpen,
      tone: statusUnavailable ? "neutral" : linkedNovelCount > 0 ? "success" : "neutral",
    },
    {
      key: "descriptions",
      label: "Instrucciones completas",
      value: statusUnavailable ? "—" : `${describedGenreCount}/${totalGenres}`,
      detail: "Tema con una descripción clara del posicionamiento.",
      icon: FileText,
      tone: statusUnavailable
        ? "neutral"
        : totalGenres > describedGenreCount ? "warning" : "success",
    },
  ], [
    describedGenreCount,
    genreTree.length,
    linkedNovelCount,
    statusUnavailable,
    totalGenres,
  ]);

  const deleteMutation = useMutation({
    mutationFn: (genreId: string) => deleteGenre(genreId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.genres.all });
      toast.success("La base del tema ha sido eliminada.");
    },
  });

  const handleCreateRoot = () => {
    setDefaultParentId("");
    setCreateDialogOpen(true);
  };

  const handleCreateChild = (parentId: string) => {
    setDefaultParentId(parentId);
    setCreateDialogOpen(true);
  };

  const handleDelete = (genre: GenreTreeNode) => {
    const descendantCount = collectDescendantIds(genre).length;
    const message = descendantCount > 0
      ? `Confirmar la eliminación de la base del tema "${genre.name}”? Esto también eliminará el ${descendantCount} subcategoría, esta operación es irreversible.`
      : `Confirmar la eliminación de la base del tema "${genre.name}”? Esta operación es irreversible.`;
    const confirmed = window.confirm(message);
    if (!confirmed) {
      return;
    }
    deleteMutation.mutate(genre.id);
  };

  const recommendation = genreTreeQuery.isError ? (
    <AssetLibraryRecommendation
      icon={CircleAlert}
      title="Recargar la base del tema"
      description="La estructura del tema no se puede leer en este momento. Después de recargar, puede continuar viendo, editando y manteniendo temas."
      tone="danger"
      action={(
        <Button type="button" variant="outline" onClick={() => void genreTreeQuery.refetch()}>
          recargar
        </Button>
      )}
    />
  ) : genreTreeQuery.isLoading ? (
    <AssetLibraryRecommendation
      icon={LoaderCircle}
      title="Confirmar el estado base del tema"
      description="Una vez completada la carga, se darán sugerencias del siguiente paso según la cobertura del tema y la integridad de las instrucciones."
      tone="neutral"
    />
  ) : totalGenres === 0 ? (
    <AssetLibraryRecommendation
      icon={Sparkles}
      title="Primero crea el primer árbol base del tema."
      description="Describe la dirección creativa que deseas cubrir. Puede crear la jerarquía manualmente o puede dejar que la IA genere un borrador y luego lo ajuste."
      action={(
        <Button type="button" onClick={handleCreateRoot}>
          <Plus className="h-4 w-4" aria-hidden="true" />
          Crear una base temática
        </Button>
      )}
    />
  ) : firstGenreWithoutDescription ? (
    <AssetLibraryRecommendation
      icon={FileText}
      title={`Reponer"${firstGenreWithoutDescription.name}"Descripción del tema de`}
      description="Aclarar el posicionamiento del trabajo, las expectativas de los lectores y los conflictos centrales puede ayudar a la IA a comprender el tema con mayor precisión al abrir y planificar el libro."
      tone="warning"
      action={(
        <Button
          type="button"
          variant="outline"
          onClick={() => setEditingGenreId(firstGenreWithoutDescription.id)}
        >
          Información adicional
        </Button>
      )}
    />
  ) : (
    <AssetLibraryRecommendation
      icon={Sparkles}
      title="La base temática puede admitir la selección de apertura de libros."
      description="Los temas existentes están claramente expuestos. Cuando necesite cubrir una nueva dirección creativa, agregue un nuevo tema raíz o subcategoría."
      tone="success"
      action={(
        <Button type="button" variant="outline" onClick={handleCreateRoot}>
          <Plus className="h-4 w-4" aria-hidden="true" />
          Ampliar el tema
        </Button>
      )}
    />
  );

  return (
    <div className="space-y-5">
      <GenreCreateDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        parentOptions={parentOptions}
        defaultParentId={defaultParentId}
      />

      <GenreEditDialog
        open={Boolean(editingGenre)}
        genre={editingGenre}
        onOpenChange={(open) => {
          if (!open) {
            setEditingGenreId("");
          }
        }}
        parentOptions={parentOptions}
        blockedParentIds={blockedParentIds}
      />

      <AssetLibraryHeader
        icon={Tags}
        context="Activos creativos/posicionamiento novedoso"
        title="Biblioteca base de temas"
        description="Mantener la jerarquía de clasificación y posicionamiento de temas reutilizables de las novelas. Al abrir un libro, elija una base temática adecuada y la IA comprenderá el tipo de trabajo, las expectativas de los lectores y la dirección creativa principal en consecuencia."
        actions={(
          <Button type="button" onClick={handleCreateRoot}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            Crear un nuevo árbol base de temas
          </Button>
        )}
      />

      <AssetLibraryStatusGrid items={statusItems} />

      {recommendation}

      <AssetLibrarySection
        title="Estructura del tema"
        description="Expanda la dirección de subdivisión desde el directorio de la izquierda y vea los nodos de posicionamiento y mantenimiento a la derecha. Las categorías que utilizan las novelas deben ajustarse primero antes de poder eliminarlas."
      >
        {genreTreeQuery.isLoading ? (
          <div
            className="flex min-h-40 flex-col items-center justify-center rounded-md border border-dashed border-border px-5 py-8 text-center"
            role="status"
          >
            <LoaderCircle className="h-6 w-6 animate-spin text-muted-foreground" aria-hidden="true" />
            <div className="mt-3 text-sm font-semibold text-foreground">Cargando estructura del tema</div>
            <div className="mt-1 text-sm text-muted-foreground">Espere un momento, el tema y la relación novedosa se están sincronizando.</div>
          </div>
        ) : null}

        {genreTreeQuery.isError ? (
          <AssetLibraryEmptyState
            icon={CircleAlert}
            title="La base del tema no se puede cargar temporalmente."
            description="Verifique la conexión del servicio y vuelva a cargar. Los temas existentes no se verán afectados."
            action={(
              <Button type="button" variant="outline" onClick={() => void genreTreeQuery.refetch()}>
                recargar
              </Button>
            )}
          />
        ) : null}

        {!genreTreeQuery.isLoading && !genreTreeQuery.isError && genreTree.length === 0 ? (
          <AssetLibraryEmptyState
            icon={Tags}
            title="No hay una base temática para elegir para abrir un libro."
            description="Comience creando un tema principal. Puede completarlo manualmente o puede describir la dirección creativa y dejar que AI genere un borrador de árbol temático que contenga subcategorías."
            action={(
              <Button type="button" onClick={handleCreateRoot}>
                <Plus className="h-4 w-4" aria-hidden="true" />
                Crea el primer árbol temático.
              </Button>
            )}
          />
        ) : null}

        {!genreTreeQuery.isLoading && !genreTreeQuery.isError && genreTree.length > 0 ? (
          <GenreTreeBrowser
            nodes={genreTree}
            initialSelectedId={searchParams.get("selectedId") ?? ""}
            onCreateChild={handleCreateChild}
            onEdit={setEditingGenreId}
            onDelete={handleDelete}
            deletingId={deleteMutation.isPending ? deleteMutation.variables : undefined}
          />
        ) : null}
      </AssetLibrarySection>
    </div>
  );
}
