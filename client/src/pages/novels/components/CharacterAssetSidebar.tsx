import type { Character } from "@ai-novel/shared/types/novel";
import { Crown, Trash2, UsersRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { isProtagonistCharacter } from "./characterAssetWorkspace.helpers";

interface CharacterAssetSidebarProps {
  characters: Character[];
  selectedCharacterId: string;
  onSelectedCharacterChange: (id: string) => void;
  onDeleteCharacter: (characterId: string) => void;
  isDeletingCharacter: boolean;
  deletingCharacterId: string;
}

function getCharacterCardClass(isSelected: boolean, isProtagonist: boolean): string {
  const selectedClass = isProtagonist
    ? "border-emerald-300 bg-emerald-50 shadow-sm"
    : "border-primary/40 bg-primary/5 shadow-sm";
  const idleClass = isProtagonist
    ? "border-emerald-200 bg-emerald-50/40 hover:border-emerald-300 hover:bg-emerald-50"
    : "border-border/70 bg-background hover:border-primary/30 hover:bg-muted/20";
  return `group flex w-full items-stretch gap-2 rounded-2xl border p-2.5 text-left transition ${
    isSelected ? selectedClass : idleClass
  }`;
}

function confirmDeleteCharacter(character: Character, onDeleteCharacter: (characterId: string) => void) {
  const confirmed = window.confirm(`Confirmar eliminación de rol"${character.name}"? Esta operación es irreversible.`);
  if (!confirmed) {
    return;
  }
  onDeleteCharacter(character.id);
}

function CharacterCard(props: {
  character: Character;
  selectedCharacterId: string;
  onSelectedCharacterChange: (id: string) => void;
  onDeleteCharacter: (characterId: string) => void;
  isDeletingCharacter: boolean;
  deletingCharacterId: string;
  isProtagonist?: boolean;
}) {
  const {
    character,
    selectedCharacterId,
    onSelectedCharacterChange,
    onDeleteCharacter,
    isDeletingCharacter,
    deletingCharacterId,
    isProtagonist = false,
  } = props;
  const isSelected = selectedCharacterId === character.id;
  const isDeletingThis = isDeletingCharacter && deletingCharacterId === character.id;
  const supportingLine = isProtagonist
    ? character.currentGoal || character.storyFunction || character.role || "Objetivos del protagonista por cumplir."
    : character.relationToProtagonist || character.role || "Posicionamiento de roles por completar";
  const supportingLabel = character.relationToProtagonist ? "Relación con el protagonista" : "Posicionamiento";
  const avatarText = character.name.trim().slice(0, 1) || "Ángulo";

  return (
    <div className={getCharacterCardClass(isSelected, isProtagonist)}>
      <button
        type="button"
        onClick={() => onSelectedCharacterChange(character.id)}
        className="flex min-w-0 flex-1 items-start gap-2.5 text-left"
      >
        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border text-sm font-semibold ${
          isProtagonist ? "border-emerald-200 bg-white text-emerald-800" : "border-border/70 bg-muted/20 text-foreground"
        }`}>
          {avatarText}
        </div>
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2">
            <div className="truncate font-medium">{character.name}</div>
            {isProtagonist ? (
              <Badge variant="secondary" className="gap-1 px-1.5">
                <Crown className="h-3 w-3" />
                personaje principal
              </Badge>
            ) : null}
          </div>
          <div className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
            {isProtagonist ? `Identidad:${character.role || "Pendiente"}` : `${supportingLabel}:${supportingLine}`}
          </div>
          {isProtagonist ? (
            <div className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
              Objetivo:{supportingLine}
            </div>
          ) : null}
        </div>
      </button>
      <Button
        size="sm"
        variant="ghost"
        disabled={isDeletingThis}
        onClick={() => confirmDeleteCharacter(character, onDeleteCharacter)}
        className="h-8 w-8 shrink-0 self-center p-0 text-muted-foreground opacity-60 hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
        title="Eliminar rol"
      >
        {isDeletingThis ? "..." : <Trash2 className="h-4 w-4" />}
      </Button>
    </div>
  );
}

export default function CharacterAssetSidebar(props: CharacterAssetSidebarProps) {
  const {
    characters,
    selectedCharacterId,
    onSelectedCharacterChange,
    onDeleteCharacter,
    isDeletingCharacter,
    deletingCharacterId,
  } = props;
  const protagonists = characters.filter(isProtagonistCharacter);
  const supportingCharacters = characters.filter((character) => !isProtagonistCharacter(character));

  return (
    <div className="space-y-4 rounded-2xl border border-border/70 bg-muted/10 p-3">
      <section className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <Crown className="h-3.5 w-3.5 text-emerald-600" />
            Posición protagonista
          </div>
          {protagonists.length > 0 ? <Badge variant="outline">{protagonists.length} Gente</Badge> : null}
        </div>
        {protagonists.length > 0 ? protagonists.map((protagonist) => (
          <CharacterCard
            key={protagonist.id}
            character={protagonist}
            selectedCharacterId={selectedCharacterId}
            onSelectedCharacterChange={onSelectedCharacterChange}
            onDeleteCharacter={onDeleteCharacter}
            isDeletingCharacter={isDeletingCharacter}
            deletingCharacterId={deletingCharacterId}
            isProtagonist
          />
        )) : (
          <div className="rounded-xl border border-dashed border-primary/30 bg-primary/5 p-3 text-xs leading-5 text-muted-foreground">
            La alineación actual no tiene todavía un protagonista marcado. Puedes complementar la información del protagonista en el posicionamiento de roles.
          </div>
        )}
      </section>

      <section className="space-y-2">
        <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
          <UsersRound className="h-3.5 w-3.5 text-sky-600" />
          Roles de apoyo y relación
        </div>
        {characters.length === 0 ? (
          <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
            Actualmente no hay personajes en la novela. Primero cree o importe personajes en el asistente de arriba.
          </div>
        ) : supportingCharacters.length > 0 ? (
          <div className="max-h-[460px] space-y-2 overflow-auto pr-1">
            {supportingCharacters.map((character) => (
              <CharacterCard
                key={character.id}
                character={character}
                selectedCharacterId={selectedCharacterId}
                onSelectedCharacterChange={onSelectedCharacterChange}
                onDeleteCharacter={onDeleteCharacter}
                isDeletingCharacter={isDeletingCharacter}
                deletingCharacterId={deletingCharacterId}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
            La alineación actual solo tiene el protagonista, y luego se pueden agregar oponentes, aliados o personajes que presionen las relaciones.
          </div>
        )}
      </section>
    </div>
  );
}
