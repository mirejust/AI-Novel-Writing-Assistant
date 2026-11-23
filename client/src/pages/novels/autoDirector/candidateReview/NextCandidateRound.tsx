import { useId, type Ref } from "react";
import { ArrowLeft, Feather } from "lucide-react";
import { DIRECTOR_CORRECTION_PRESETS, type DirectorCorrectionPreset } from "@ai-novel/shared/types/novelDirector";
import { Button } from "@/components/ui/button";

export interface NextCandidateRoundProps {
  selectedPresets: DirectorCorrectionPreset[];
  feedback: string;
  onTogglePreset: (preset: DirectorCorrectionPreset) => void;
  onFeedbackChange: (value: string) => void;
  onGenerate: () => void;
}

export function NextCandidateRound({ selectedPresets, feedback, onTogglePreset, onFeedbackChange, onGenerate,
  disabled, headingRef, onBack }: NextCandidateRoundProps & {
    disabled: boolean;
    headingRef: Ref<HTMLHeadingElement>;
    onBack?: () => void;
  }) {
  const feedbackId = useId();
  return <section className="flex min-h-0 flex-1 flex-col" aria-label="Generar dirección de la siguiente ronda">
    <header className="agent-heading">
      <span className="agent-mark" aria-hidden="true"><Feather size={20} /></span>
      <div><h3>Asistente de apertura de libros.</h3></div>
      {onBack && <Button type="button" variant="ghost" size="sm" onClick={onBack}><ArrowLeft size={15} />Volver a la discusión del plan</Button>}
    </header>
    <form className="min-h-0 space-y-5 overflow-y-auto p-4" onSubmit={event => {
      event.preventDefault();
      if (!disabled) onGenerate();
    }}>
      <div>
        <h4 ref={headingRef} tabIndex={-1} className="font-semibold">Generar dirección de la siguiente ronda</h4>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">Se conservarán los planes existentes y podrá comparar la nueva ronda con las rondas anteriores.</p>
      </div>
      <fieldset disabled={disabled}>
        <legend className="text-sm font-medium">¿Qué cambios te gustaría probar en la próxima ronda?</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {DIRECTOR_CORRECTION_PRESETS.map(preset => (
            <Button key={preset.value} type="button" size="sm" className="rounded-full"
              aria-pressed={selectedPresets.includes(preset.value)} variant={selectedPresets.includes(preset.value) ? "default" : "secondary"}
              onClick={() => onTogglePreset(preset.value)}>{preset.label}</Button>
          ))}
        </div>
      </fieldset>
      <div className="space-y-2">
        <label htmlFor={feedbackId} className="block text-sm font-medium">Requisitos para la nueva ronda (opcional)</label>
        <textarea id={feedbackId} rows={3} maxLength={500} value={feedback} disabled={disabled}
          onChange={event => onFeedbackChange(event.target.value)}
          placeholder="Por ejemplo, deja que el protagonista se enfrente a un dilema en el primer capítulo."
          className="block w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm leading-6 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
      </div>
      <Button type="submit" disabled={disabled}>Generar una nueva ronda</Button>
    </form>
  </section>;
}
