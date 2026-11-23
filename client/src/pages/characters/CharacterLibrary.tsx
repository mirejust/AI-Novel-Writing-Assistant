import { useMemo, useState } from "react";
import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ImageAsset } from "@ai-novel/shared/types/image";
import type { BaseCharacter } from "@ai-novel/shared/types/novel";
import { CircleAlert, ImageIcon, LibraryBig, Sparkles, UsersRound } from "lucide-react";
import { deleteBaseCharacter, getBaseCharacterList, updateBaseCharacter } from "@/api/character";
import { deleteImageAsset, listImageAssets, setPrimaryImageAsset } from "@/api/images";
import { queryKeys } from "@/api/queryKeys";
import OpenInCreativeHubButton from "@/components/creativeHub/OpenInCreativeHubButton";
import CharacterConversationWorkbench from "@/components/characterConversation/CharacterConversationWorkbench";
import {
  AssetLibraryEmptyState,
  AssetLibraryHeader,
  AssetLibraryRecommendation,
  AssetLibrarySection,
  AssetLibraryStatusGrid,
} from "@/components/assetLibrary";
import { Button } from "@/components/ui/button";
import { CharacterCard } from "./components/CharacterCard";
import { CharacterCreateDialog } from "./components/CharacterCreateDialog";
import { CharacterEditDialog } from "./components/CharacterEditDialog";
import { CharacterImageDialog } from "./components/CharacterImageDialog";

type EditableBaseCharacter = Omit<BaseCharacter, "id" | "createdAt" | "updatedAt">;

export default function CharacterLibrary() {
  const queryClient = useQueryClient();
  const [imageDialogOpen, setImageDialogOpen] = useState(false);
  const [selectedImageCharacter, setSelectedImageCharacter] = useState<BaseCharacter | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingCharacter, setEditingCharacter] = useState<BaseCharacter | null>(null);
  const [conversationCharacter, setConversationCharacter] = useState<BaseCharacter | null>(null);

  const characterListQuery = useQuery({
    queryKey: queryKeys.baseCharacters.all,
    queryFn: () => getBaseCharacterList(),
  });

  const characters = characterListQuery.data?.data ?? [];

  const imageAssetQueries = useQueries({
    queries: characters.map((character) => ({
      queryKey: queryKeys.images.assets("character", character.id),
      queryFn: () => listImageAssets({ sceneType: "character", sceneId: character.id }),
      staleTime: 30_000,
    })),
  });

  const assetsByCharacter = useMemo(() => {
    const map = new Map<string, ImageAsset[]>();
    characters.forEach((character, index) => {
      map.set(character.id, imageAssetQueries[index]?.data?.data ?? []);
    });
    return map;
  }, [characters, imageAssetQueries]);
  const categoryCount = useMemo(
    () => new Set(characters.map((character) => character.category.trim()).filter(Boolean)).size,
    [characters],
  );
  const characterWithImageCount = useMemo(
    () => characters.filter((character) => (assetsByCharacter.get(character.id) ?? []).length > 0).length,
    [assetsByCharacter, characters],
  );
  const incompleteCharacterCount = useMemo(
    () => characters.filter((character) => (
      !character.personality.trim()
      || !character.background.trim()
      || !character.development.trim()
    )).length,
    [characters],
  );

  const setPrimaryMutation = useMutation({
    mutationFn: (assetId: string) => setPrimaryImageAsset(assetId),
    onSuccess: async (response) => {
      const baseCharacterId = response.data?.baseCharacterId;
      if (!baseCharacterId) {
        return;
      }
      await queryClient.invalidateQueries({
        queryKey: queryKeys.images.assets("character", baseCharacterId),
      });
    },
  });

  const deleteAssetMutation = useMutation({
    mutationFn: (assetId: string) => deleteImageAsset(assetId),
    onSuccess: async (response) => {
      const baseCharacterId = response.data?.baseCharacterId;
      if (!baseCharacterId) {
        return;
      }
      await queryClient.invalidateQueries({
        queryKey: queryKeys.images.assets("character", baseCharacterId),
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({
      characterId,
      payload,
    }: {
      characterId: string;
      payload: EditableBaseCharacter;
    }) => updateBaseCharacter(characterId, payload),
    onSuccess: async (_, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.baseCharacters.all }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.baseCharacters.detail(variables.characterId),
        }),
      ]);
      setEditDialogOpen(false);
      setEditingCharacter(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (characterId: string) => deleteBaseCharacter(characterId),
    onSuccess: async (_, characterId) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.baseCharacters.all }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.images.assets("character", characterId),
        }),
      ]);
      if (selectedImageCharacter?.id === characterId) {
        setImageDialogOpen(false);
        setSelectedImageCharacter(null);
      }
      if (editingCharacter?.id === characterId) {
        setEditDialogOpen(false);
        setEditingCharacter(null);
      }
    },
  });

  const handleTaskCompleted = async (baseCharacterId: string) => {
    await queryClient.invalidateQueries({
      queryKey: queryKeys.images.assets("character", baseCharacterId),
    });
  };

  const openImageDialog = (character: BaseCharacter) => {
    setSelectedImageCharacter(character);
    setImageDialogOpen(true);
  };

  const openEditDialog = (character: BaseCharacter) => {
    setEditingCharacter(character);
    setEditDialogOpen(true);
  };

  const handleDeleteCharacter = (character: BaseCharacter) => {
    const confirmed = window.confirm(`Confirmar eliminación de rol"${character.name}”? Esta operación es irreversible.`);
    if (!confirmed) {
      return;
    }
    deleteMutation.mutate(character.id);
  };

  return (
    <div className="space-y-5">
      <AssetLibraryHeader
        icon={UsersRound}
        context="Reutilizar recursos en novelas"
        title="Biblioteca de personajes básicos"
        description="Precipite prototipos de personajes comunes, motivaciones centrales y datos de imágenes en activos reutilizables. Al crear una novela o perfeccionar un personaje, puedes hacer que la IA lea directamente estas bases de personajes."
        actions={(
          <>
            <OpenInCreativeHubButton bindings={{}} label="Sigue creando con tu biblioteca de personajes." />
            <CharacterCreateDialog />
          </>
        )}
      />

      <AssetLibraryStatusGrid
        items={[
          {
            key: "characters",
            label: "Roles reutilizables",
            value: characterListQuery.isPending || characterListQuery.isError ? "—" : characters.length,
            detail: characterListQuery.isPending
              ? "Leer recursos de personajes"
              : characterListQuery.isError
                ? "Ver después de recargar"
                : characters.length > 0
                  ? "Puede seguir utilizándose durante la preparación de novelas y la incorporación de personajes."
                  : "Una vez creado, se puede utilizar en nuevas novelas.",
            icon: LibraryBig,
            tone: characterListQuery.isPending || characterListQuery.isError
              ? "neutral"
              : characters.length > 0 ? "success" : "neutral",
          },
          {
            key: "categories",
            label: "Tipo de rol",
            value: characterListQuery.isPending || characterListQuery.isError ? "—" : categoryCount,
            detail: "Organizado por posicionamiento de roles como protagonistas, roles secundarios, etc.",
            icon: UsersRound,
          },
          {
            key: "images",
            label: "Ya tengo información de perfil.",
            value: characterListQuery.isPending || characterListQuery.isError ? "—" : characterWithImageCount,
            detail: "Guarda al menos una imagen de personaje.",
            icon: ImageIcon,
            tone: characterListQuery.isPending || characterListQuery.isError
              ? "neutral"
              : characterWithImageCount > 0 ? "info" : "neutral",
          },
          {
            key: "incomplete",
            label: "Información básica que debe complementarse",
            value: characterListQuery.isPending || characterListQuery.isError ? "—" : incompleteCharacterCount,
            detail: "Falta de carácter, antecedentes o trayectoria de crecimiento.",
            icon: CircleAlert,
            tone: characterListQuery.isPending || characterListQuery.isError
              ? "neutral"
              : characters.length === 0
                ? "neutral"
                : incompleteCharacterCount > 0 ? "warning" : "success",
          },
        ]}
      />

      <AssetLibraryRecommendation
        icon={Sparkles}
        title={characterListQuery.isPending
          ? "Organizar los recursos del personaje"
          : characterListQuery.isError
            ? "Vuelve a cargar la biblioteca de personajes primero."
            : characters.length === 0
              ? "Primero crea el primer rol reutilizable."
              : incompleteCharacterCount > 0
                ? "Prioriza completar por qué actúa el personaje y qué precio pagará."
                : "La base del personaje se puede utilizar en la preparación de novelas."}
        description={characterListQuery.isPending
          ? "Una vez completada la lectura, se recomendará el siguiente paso en función de la integridad del personaje."
          : characterListQuery.isError
            ? "Los roles existentes no se verán afectados y se podrán gestionar después de la recarga."
            : characters.length === 0
              ? "Simplemente comienza con un protagonista. Al escribir primero sus objetivos, debilidades y direcciones de crecimiento, será más fácil para la IA generar personajes impulsores."
              : incompleteCharacterCount > 0
                ? `tener ${incompleteCharacterCount} A un personaje le falta información básica. Una vez completado, la planificación del capítulo y el diálogo de los personajes tendrán una base más estable.`
                : "Puedes traer toda tu biblioteca de personajes al Centro Creativo o continuar refinando la apariencia y el diálogo de un solo personaje."}
        tone={characterListQuery.isError
          ? "danger"
          : characterListQuery.isPending || characters.length === 0
            ? "info"
            : incompleteCharacterCount > 0
              ? "warning"
              : "success"}
        action={characterListQuery.isError ? (
          <Button type="button" size="sm" variant="outline" onClick={() => void characterListQuery.refetch()}>
            recargar
          </Button>
        ) : undefined}
      />

      <CharacterImageDialog
        open={imageDialogOpen}
        character={selectedImageCharacter}
        onOpenChange={(open) => {
          setImageDialogOpen(open);
          if (!open) {
            setSelectedImageCharacter(null);
          }
        }}
        onTaskCompleted={handleTaskCompleted}
      />

      <CharacterEditDialog
        open={editDialogOpen}
        character={editingCharacter}
        saving={updateMutation.isPending}
        onOpenChange={(open) => {
          setEditDialogOpen(open);
          if (!open) {
            setEditingCharacter(null);
          }
        }}
        onSubmit={(payload) => {
          if (!editingCharacter) {
            return;
          }
          updateMutation.mutate({
            characterId: editingCharacter.id,
            payload,
          });
        }}
      />

      {conversationCharacter ? (
        <CharacterConversationWorkbench
          subject={{ kind: "base_character", id: conversationCharacter.id, scopeKind: "base_library", scopeId: null }}
          characterName={conversationCharacter.name}
          defaultFullscreen
          closeOnExitFullscreen
          onClose={() => setConversationCharacter(null)}
        />
      ) : null}

      <AssetLibrarySection
        title="Activos de carácter"
        description="Primero, mantenga la información central que pueda influir en las elecciones de la trama; Se pueden agregar diagramas de imágenes y materiales de expansión según sea necesario."
      >
        <div className="space-y-3">
          {characterListQuery.isLoading ? (
            <AssetLibraryEmptyState
              icon={UsersRound}
              title="Organizar los recursos del personaje"
              description="La lista de personajes y la información de la imagen se mostrarán aquí después de la carga."
            />
          ) : null}

          {characterListQuery.isError ? (
            <AssetLibraryEmptyState
              icon={CircleAlert}
              title="La biblioteca de personajes no se puede cargar temporalmente."
              description="Los personajes existentes no se verán afectados. Puedes recargar la lista y continuar."
              action={(
                <Button type="button" variant="outline" onClick={() => void characterListQuery.refetch()}>
                  recargar
                </Button>
              )}
            />
          ) : null}

          {!characterListQuery.isLoading && !characterListQuery.isError ? (
            <>
              {characters.map((character, index) => (
                <CharacterCard
                  key={character.id}
                  character={character}
                  assets={assetsByCharacter.get(character.id) ?? []}
                  assetsLoading={imageAssetQueries[index]?.isLoading}
                  onGenerateImage={() => openImageDialog(character)}
                  onSetPrimary={(assetId) => setPrimaryMutation.mutate(assetId)}
                  onDeleteAsset={(asset) => deleteAssetMutation.mutateAsync(asset.id).then(() => undefined)}
                  onEdit={() => openEditDialog(character)}
                  onDelete={() => handleDeleteCharacter(character)}
                  onConversation={() => setConversationCharacter(character)}
                  settingPrimary={setPrimaryMutation.isPending}
                  deletingAssetId={deleteAssetMutation.variables ?? null}
                  deleting={deleteMutation.isPending && deleteMutation.variables === character.id}
                  extraActions={(
                    <OpenInCreativeHubButton
                      bindings={{ baseCharacterId: character.id }}
                      label="Continuar con el personaje."
                    />
                  )}
                />
              ))}
              {characters.length === 0 ? (
                <AssetLibraryEmptyState
                  icon={UsersRound}
                  title="Aún no existe un rol básico."
                  description="Utilice &quot;Crear personaje&quot; en la esquina superior derecha de la página para crear primero un protagonista con objetivos claros y debilidades claras."
                />
              ) : null}
            </>
          ) : null}
        </div>
      </AssetLibrarySection>
    </div>
  );
}
