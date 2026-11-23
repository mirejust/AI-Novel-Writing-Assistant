import { MAX_CHAPTER_REVIEW_RETRIES, type ChapterReviewRetryPolicy } from "@ai-novel/shared/types/directorIssue";

export function ChapterReviewRetryFields({ value, onChange }: {
  value: ChapterReviewRetryPolicy;
  onChange: (value: ChapterReviewRetryPolicy) => void;
}) {
  return (
    <div className="space-y-3 border-t pt-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-2 text-sm">
          <span className="font-medium">Número máximo de reintentos para la verificación de texto</span>
          <input type="number" min={0} max={MAX_CHAPTER_REVIEW_RETRIES} step={1}
            className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={value.maxRetries}
            onChange={event => {
              const maxRetries = Number(event.target.value);
              if (Number.isInteger(maxRetries) && maxRetries >= 0 && maxRetries <= MAX_CHAPTER_REVIEW_RETRIES) onChange({ ...value, maxRetries });
            }} />
        </label>
        <label className="space-y-2 text-sm">
          <span className="font-medium">Después de que se agote el número de veces.</span>
          <select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={value.onExhausted}
            onChange={event => onChange({ ...value, onExhausted: event.target.value as ChapterReviewRetryPolicy["onExhausted"] })}>
            <option value="continue_with_warning">Saltar el cheque y continuar</option>
            <option value="pause_for_manual">En pausa para procesamiento</option>
          </select>
        </label>
      </div>
      <p className="text-xs leading-5 text-muted-foreground">
        Se puede configurar en 0–{MAX_CHAPTER_REVIEW_RETRIES} veces, excluyendo la primera inspección del texto y el primer reexamen después de la revisión. El número de verificaciones y correcciones de texto compartido para el mismo capítulo; cuando se establece en 0, no se producirá el reintento automático. Saltar deja el texto disponible y marca el cheque como incompleto; reanudar el procesamiento desde el nuevo banco de trabajo después de una pausa. Se detiene cuando el texto no está disponible o falla al guardar.
      </p>
    </div>
  );
}
