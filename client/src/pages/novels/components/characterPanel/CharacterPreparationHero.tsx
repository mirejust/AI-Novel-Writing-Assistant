import type { Character } from "@ai-novel/shared/types/novel";
import AiButton from "@/components/common/AiButton";
import { Button } from "@/components/ui/button";
import { StatusRail, StepActionBar, StepHero } from "../workspaceShell";

interface CharacterPreparationHeroProps {
  characters: Character[];
  coreCharacterCount: number;
  selectedCharacter?: Character;
  baseCharacterCount: number;
  pendingCharacterResourceCount: number;
  onOpenCreateDialog: () => void;
  onOpenSupplementalDialog: () => void;
  onEvolveCharacter: () => void;
  isEvolvingCharacter: boolean;
  selectedCharacterId: string;
}

export default function CharacterPreparationHero(props: CharacterPreparationHeroProps) {
  const {
    characters,
    coreCharacterCount,
    selectedCharacter,
    baseCharacterCount,
    pendingCharacterResourceCount,
    onOpenCreateDialog,
    onOpenSupplementalDialog,
    onEvolveCharacter,
    isEvolvingCharacter,
    selectedCharacterId,
  } = props;
  const recommendedAction = getRecommendedAction({
    characterCount: characters.length,
    coreCharacterCount,
    selectedCharacter,
    pendingCharacterResourceCount,
  });

  return (
    <StepHero
      eyebrow="Reparto de personajes"
      title="Preparación de personajes"
      description="Mantenga a los personajes como activos narrativos sostenibles: primero complete el elenco, luego cambie a archivos, apariencias, recursos, líneas de tiempo y relaciones."
      className="border border-border/60 bg-[linear-gradient(135deg,hsl(var(--background))_0%,hsl(var(--muted))_100%)] shadow-sm"
    >
      <StatusRail
        items={[
          {
            label: "Rol creado",
            value: characters.length,
            description: characters.length > 0 ? "La alineación empieza a tomar forma." : "Primero crea el protagonista o importa un personaje básico.",
            tone: characters.length > 0 ? "success" : "warning",
          },
          {
            label: "Rol central",
            value: coreCharacterCount,
            description: coreCharacterCount > 0 ? "Continúe complementando a rivales, aliados y factores estresantes." : "Al menos deja claro quién es el protagonista y el principal antagonista.",
            tone: coreCharacterCount > 0 ? "success" : "warning",
          },
          {
            label: "Enfoque actual",
            value: selectedCharacter?.name ?? "Aún no se ha seleccionado ningún rol",
            description: selectedCharacter?.role || `${baseCharacterCount} Se pueden importar roles básicos`,
            tone: selectedCharacter ? "info" : "neutral",
          },
        ]}
      />
      <StepActionBar
        className="mt-4 border border-border/60 bg-background/80"
        label="Sugerencias para los próximos pasos"
        description={recommendedAction}
        actions={(
          <>
            <Button onClick={onOpenCreateDialog}>Agregar nuevo rol</Button>
            <AiButton variant="outline" onClick={onOpenSupplementalDialog}>
              rol complementario
            </AiButton>
            <AiButton
              variant="secondary"
              onClick={onEvolveCharacter}
              disabled={isEvolvingCharacter || !selectedCharacterId}
            >
              {isEvolvingCharacter ? "Evolucionando..." : "El estado actual de la evolución de la IA"}
            </AiButton>
          </>
        )}
      />
    </StepHero>
  );
}

function getRecommendedAction(input: {
  characterCount: number;
  coreCharacterCount: number;
  selectedCharacter?: Character;
  pendingCharacterResourceCount: number;
}): string {
  if (input.characterCount === 0) {
    return "Primero cree el protagonista o importe el personaje básico para que haya un tema de acción claro para el mundo posterior, la planificación del volumen y la generación de capítulos.";
  }
  if (input.coreCharacterCount === 0) {
    return "Marca claramente a tu protagonista, antagonista principal o aliado clave para evitar la falta de una fuente estable de estrés en capítulos posteriores.";
  }
  if (input.pendingCharacterResourceCount > 0) {
    return `tener ${input.pendingCharacterResourceCount} Los cambios de recursos están esperando confirmación. Se recomienda consultar en la página "Recursos".`;
  }
  if (!input.selectedCharacter) {
    return "Seleccione una función de la izquierda para ingresar al mantenimiento intercambiable de archivos, pantallas, recursos y cronogramas.";
  }
  return "Priorice la verificación de objetivos actuales, apariciones recientes y recursos clave antes de decidir si dejar que la IA evolucione el estado.";
}
