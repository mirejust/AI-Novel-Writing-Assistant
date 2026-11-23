import { useEffect, useState } from "react";
import type { Character } from "@ai-novel/shared/types/novel";
import type { LLMProvider } from "@ai-novel/shared/types/llm";
import CharacterCastOptionsSection from "./CharacterCastOptionsSection";
import CollapsibleSummary from "./CollapsibleSummary";

interface CharacterDiagnosticsSectionProps {
  novelId: string;
  characters: Character[];
  selectedCharacter?: Character;
  onSelectedCharacterChange: (id: string) => void;
  llmProvider?: LLMProvider;
  llmModel?: string;
  defaultOpen?: boolean;
}

export default function CharacterDiagnosticsSection(props: CharacterDiagnosticsSectionProps) {
  const {
    novelId,
    characters,
    selectedCharacter,
    onSelectedCharacterChange,
    llmProvider,
    llmModel,
    defaultOpen = true,
  } = props;

  const [isOpen, setIsOpen] = useState(defaultOpen);

  useEffect(() => {
    setIsOpen(defaultOpen);
  }, [defaultOpen]);

  return (
    <details
      className="group rounded-2xl border border-border/70 bg-background/95 p-4"
      open={isOpen}
      onToggle={(event) => setIsOpen(event.currentTarget.open)}
    >
      <summary className="cursor-pointer list-none">
        <CollapsibleSummary
          title="Casting de roles y diagnóstico de relaciones"
          description="Amplíelo cuando necesite cubrir puestos, comprobar si hay huecos u organizar planes de alineación; La dinámica de roles, los candidatos y las responsabilidades a nivel de rol se concentran en la página &quot;Dinámica&quot;."
        />
      </summary>

      <div className="mt-4 space-y-4">
        <CharacterCastOptionsSection
          novelId={novelId}
          characters={characters}
          selectedCharacter={selectedCharacter}
          onSelectedCharacterChange={onSelectedCharacterChange}
          llmProvider={llmProvider}
          llmModel={llmModel}
        />
      </div>
    </details>
  );
}
