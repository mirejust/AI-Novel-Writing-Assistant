import type { StoryModeProfile } from "@ai-novel/shared/types/storyMode";
import SelectControl from "@/components/common/SelectControl";

function linesToList(value: string): string[] {
  return value
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function listToLines(value: string[]): string {
  return value.join("\n");
}

interface StoryModeProfileFieldsProps {
  value: StoryModeProfile;
  onChange: (value: StoryModeProfile) => void;
}

export default function StoryModeProfileFields({
  value,
  onChange,
}: StoryModeProfileFieldsProps) {
  const updateList = (field: keyof Pick<
    StoryModeProfile,
    "progressionUnits" | "allowedConflictForms" | "forbiddenConflictForms" | "mandatorySignals" | "antiSignals"
  >, text: string) => {
    onChange({
      ...value,
      [field]: linesToList(text),
    });
  };

  const textareaClassName = "w-full rounded-md border bg-background px-3 py-2 text-sm outline-none transition focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50";

  return (
    <div className="space-y-7">
      <section className="border-t border-border pt-6">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Experiencia central</h3>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">Deje en claro por qué la historia continúa avanzando y qué obtendrá el lector en cada etapa.</p>
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <label className="space-y-2 text-sm">
            <span className="font-medium text-foreground">Controlador central</span>
            <textarea
              rows={3}
              className={textareaClassName}
              value={value.coreDrive}
              placeholder="Por ejemplo: los objetivos de construcción se mejoran constantemente y los recursos y el poder se amplían simultáneamente."
              onChange={(event) => onChange({ ...value, coreDrive: event.target.value })}
            />
          </label>
          <label className="space-y-2 text-sm">
            <span className="font-medium text-foreground">Comentarios de los lectores</span>
            <textarea
              rows={3}
              className={textareaClassName}
              value={value.readerReward}
              placeholder="Por ejemplo: ver resultados implementados, territorio ampliado y estatus de rol mejorado."
              onChange={(event) => onChange({ ...value, readerReward: event.target.value })}
            />
          </label>
        </div>
      </section>

      <section className="border-t border-border pt-6">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Empuja el ritmo</h3>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">Especifica cómo los capítulos forman pequeños ciclos y cómo se obtendrán los resultados al final de la etapa.</p>
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <label className="space-y-2 text-sm">
            <span className="font-medium text-foreground">Unidad de avance del capítulo</span>
            <textarea
              rows={4}
              className={textareaClassName}
              value={listToLines(value.progressionUnits)}
              placeholder={"Un elemento por línea, por ejemplo: \\n descubrió lagunas de recursos \\n completó los objetivos de construcción \\n obtuvo comentarios sobre la etapa"}
              onChange={(event) => updateList("progressionUnits", event.target.value)}
            />
          </label>
          <label className="space-y-2 text-sm">
            <span className="font-medium text-foreground">Partículas del capítulo</span>
            <textarea
              rows={4}
              className={textareaClassName}
              value={value.chapterUnit}
              placeholder="Describa hasta qué punto un capítulo logra típicamente sus objetivos y cambios."
              onChange={(event) => onChange({ ...value, chapterUnit: event.target.value })}
            />
          </label>
          <label className="space-y-2 text-sm">
            <span className="font-medium text-foreground">Soluciones comúnmente utilizadas</span>
            <textarea
              rows={3}
              className={textareaClassName}
              value={value.resolutionStyle}
              placeholder="En qué suele confiar el protagonista para resolver la resistencia y avanzar a la siguiente etapa."
              onChange={(event) => onChange({ ...value, resolutionStyle: event.target.value })}
            />
          </label>
          <label className="space-y-2 text-sm">
            <span className="font-medium text-foreground">Recompensa por etapa/final del trabajo</span>
            <textarea
              rows={3}
              className={textareaClassName}
              value={value.volumeReward}
              placeholder="Describe los resultados que se deben alcanzar al final de una gran etapa."
              onChange={(event) => onChange({ ...value, volumeReward: event.target.value })}
            />
          </label>
        </div>
      </section>

      <section className="border-t border-border pt-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Límites y prevención de desviaciones.</h3>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">Dígale a la IA qué conflictos se ajustan a este patrón y en qué punto debe cerrarse.</p>
          </div>
          <label className="flex shrink-0 items-center gap-2 text-sm">
            <span className="font-medium text-foreground">Intensidad del conflicto</span>
            <SelectControl
              className="w-28"
              value={value.conflictCeiling}
              onChange={(event) => onChange({ ...value, conflictCeiling: event.target.value as StoryModeProfile["conflictCeiling"] })}
            >
              <option value="low">Bajo</option>
              <option value="medium">Medio</option>
              <option value="high">Alto</option>
            </SelectControl>
          </label>
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <label className="space-y-2 text-sm">
            <span className="font-medium text-foreground">Conflicto adecuado</span>
            <textarea
              rows={4}
              className={textareaClassName}
              value={listToLines(value.allowedConflictForms)}
              placeholder="Un patrón de conflicto por línea adecuado para uso repetido."
              onChange={(event) => updateList("allowedConflictForms", event.target.value)}
            />
          </label>
          <label className="space-y-2 text-sm">
            <span className="font-medium text-foreground">Conflicto inapropiado</span>
            <textarea
              rows={4}
              className={textareaClassName}
              value={listToLines(value.forbiddenConflictForms)}
              placeholder="Una forma de conflicto por línea que arruinaría la experiencia del modo."
              onChange={(event) => updateList("forbiddenConflictForms", event.target.value)}
            />
          </label>
          <label className="space-y-2 text-sm">
            <span className="font-medium text-foreground">Señales que deben aparecer</span>
            <textarea
              rows={4}
              className={textareaClassName}
              value={listToLines(value.mandatorySignals)}
              placeholder="Una señal por línea que demuestra que el modo push está vigente."
              onChange={(event) => updateList("mandatorySignals", event.target.value)}
            />
          </label>
          <label className="space-y-2 text-sm">
            <span className="font-medium text-foreground">Señales de desviación que deben evitarse</span>
            <textarea
              rows={4}
              className={textareaClassName}
              value={listToLines(value.antiSignals)}
              placeholder="Una señal por línea de que la historia se está desviando del patrón."
              onChange={(event) => updateList("antiSignals", event.target.value)}
            />
          </label>
        </div>
      </section>
    </div>
  );
}
