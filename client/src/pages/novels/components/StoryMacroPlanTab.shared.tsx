import type { StoryMacroField } from "@ai-novel/shared/types/storyMacro";
import AiButton from "@/components/common/AiButton";
import { Button } from "@/components/ui/button";

export const ENGINE_TEXT_FIELDS: Array<{
  field: StoryMacroField;
  label: string;
  placeholder: string;
  multiline?: boolean;
}> = [
  { field: "expanded_premise", label: "Fortalecer la premisa", placeholder: "Primero escriba la premisa reforzada de la historia para que se pueda establecer la sensación de opresión y suspenso.", multiline: true },
  { field: "protagonist_core", label: "La situación central del protagonista", placeholder: "Escribe sobre la situación, las grietas y los espacios cambiantes en los que se encuentra atrapado el protagonista.", multiline: true },
  { field: "conflict_engine", label: "Motor de conflicto", placeholder: "Escriba por qué la historia continúa escalando, en lugar de simplemente escribir sobre un conflicto.", multiline: true },
  { field: "mystery_box", label: "Núcleo desconocido", placeholder: "Escriba sobre las preguntas que los lectores más quieren saber pero que aún no tienen respuestas.", multiline: true },
  { field: "emotional_line", label: "Empuje emocional", placeholder: "Escribe sobre cómo las emociones se profundizan gradualmente, en lugar de simplemente volverse más fuertes.", multiline: true },
  { field: "tone_reference", label: "Temperamento narrativo", placeholder: "Estilo de escritura, postura narrativa, método de control.", multiline: true },
];

export const SUMMARY_FIELDS: Array<{
  field: StoryMacroField;
  label: string;
  placeholder: string;
  multiline?: boolean;
}> = [
  { field: "selling_point", label: "Punto de venta en una frase.", placeholder: "En una frase, explique qué es lo más atractivo para los lectores de este trabajo." },
  { field: "core_conflict", label: "Antagonismo a largo plazo", placeholder: "Escribe sobre una oposición irreconciliable a largo plazo." },
  { field: "main_hook", label: "Gancho de línea principal", placeholder: "Escribe una pregunta de línea principal desconocida." },
  { field: "progression_loop", label: "Circuito de propulsión", placeholder: "Escriba cómo descubrir -> actualizar -> invertir el ciclo.", multiline: true },
  { field: "growth_path", label: "Camino de crecimiento", placeholder: "Escribe sobre cómo cambia la cognición del protagonista por etapas.", multiline: true },
  { field: "ending_flavor", label: "El sabor del final", placeholder: "Por ejemplo, colapso, vacío, inversión, calma y depresión." },
];

export function listToText(value: string[]): string {
  return value.join("\n");
}

export function textareaClassName(minHeight = "min-h-28") {
  return `${minHeight} w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm outline-none ring-offset-background placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring`;
}

export function FieldActions(props: {
  field: StoryMacroField;
  lockedFields: Partial<Record<StoryMacroField, boolean>>;
  regeneratingField: StoryMacroField | "";
  storyInput: string;
  onToggleLock: (field: StoryMacroField) => void;
  onRegenerateField: (field: StoryMacroField) => void;
}) {
  const isLocked = Boolean(props.lockedFields[props.field]);
  return (
    <div className="flex flex-wrap gap-2">
      <Button
        size="sm"
        variant={isLocked ? "secondary" : "outline"}
        onClick={() => props.onToggleLock(props.field)}
      >
        {isLocked ? "Bloqueado" : "Bloquear"}
      </Button>
      <AiButton
        size="sm"
        variant="outline"
        onClick={() => props.onRegenerateField(props.field)}
        disabled={props.regeneratingField === props.field || isLocked || !props.storyInput.trim()}
      >
        {props.regeneratingField === props.field ? "Renacimiento en progreso..." : "Renacer"}
      </AiButton>
    </div>
  );
}
