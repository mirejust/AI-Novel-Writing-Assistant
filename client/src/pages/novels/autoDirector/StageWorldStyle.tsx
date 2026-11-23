import type { StyleIntentSummary } from "@ai-novel/shared/types/styleEngine";
import { Button } from "@/components/ui/button";
import { AUTO_DIRECTOR_MOBILE_CLASSES } from "@/mobile/autoDirector";
import type { NovelBasicFormState } from "../novelBasicInfo.shared";
import { BASIC_INFO_FIELD_HINTS } from "../novelBasicInfo.shared";
import { FieldLabel } from "../components/basicInfoForm/BasicInfoFormPrimitives";
import SelectControl from "@/components/common/SelectControl";

interface StageWorldStyleProps {
  basicForm: NovelBasicFormState;
  worldOptions: Array<{ id: string; name: string }>;
  styleProfileOptions: Array<{ id: string; name: string }>;
  selectedStyleProfileId: string;
  selectedStyleSummary: StyleIntentSummary | null;
  onStyleProfileChange: (value: string) => void;
  onBasicFormChange: (patch: Partial<NovelBasicFormState>) => void;
  onBack: () => void;
  onConfirm: () => void;
}

export default function StageWorldStyle({
  basicForm,
  worldOptions,
  styleProfileOptions,
  selectedStyleProfileId,
  selectedStyleSummary,
  onStyleProfileChange,
  onBasicFormChange,
  onBack,
  onConfirm,
}: StageWorldStyleProps) {
  const selectedWorld = worldOptions.find((world) => world.id === basicForm.worldId) ?? null;
  const controlClassName = "w-full rounded-lg border-0 bg-muted/40 px-3 py-2.5 text-sm outline-none ring-1 ring-transparent transition hover:bg-muted/55 focus:bg-background focus:ring-2 focus:ring-primary/25";

  return (
    <section className="mx-auto w-full max-w-5xl space-y-7 py-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="text-2xl font-semibold tracking-normal text-foreground">Dale a la historia un trasfondo mundial.</div>
          <div className={`mt-2 max-w-2xl text-sm leading-6 text-muted-foreground ${AUTO_DIRECTOR_MOBILE_CLASSES.wrapText}`}>
            Puede seleccionar una muestra del mundo para que la IA haga referencia, o puede dejar que organice automáticamente el mundo en este libro según sus ideas iniciales. El método de escritura servirá como tono predeterminado para la planificación y el texto posteriores.
          </div>
        </div>
        <div className="rounded-full bg-muted/55 px-3 py-1 text-xs text-muted-foreground">
          Puede mantener el valor predeterminado
        </div>
      </div>

      <div className="space-y-5">
        <div className="space-y-2">
          <FieldLabel htmlFor="director-basic-world" hint={BASIC_INFO_FIELD_HINTS.worldId}>Muestra mundial de referencia de planificación</FieldLabel>
          <SelectControl
            id="director-basic-world"
            className={controlClassName}
            value={basicForm.worldId}
            onChange={(event) => onBasicFormChange({ worldId: event.target.value })}
            disabled={worldOptions.length === 0}
          >
            <option value="">No se especifica ningún mundo de referencia</option>
            {worldOptions.map((world) => (
              <option key={world.id} value={world.id}>{world.name}</option>
            ))}
          </SelectControl>
          <div className={`text-xs leading-5 text-muted-foreground ${AUTO_DIRECTOR_MOBILE_CLASSES.wrapText}`}>
            {worldOptions.length > 0
              ? "Esta es sólo una referencia rápida para Auto Director. Complete la importación, generación y sincronización completas en el \"Mundo del libro\" en la página de la novela."
              : "Cuando no haya muestras de mundos opcionales, puedes empezar el libro con una idea inicial."}
          </div>
        </div>

        <div className="space-y-3 pt-2">
          <div className="text-sm font-medium text-foreground">procesamiento del mundo del libro</div>
          {selectedWorld ? (
            <div className={`text-sm leading-6 text-muted-foreground ${AUTO_DIRECTOR_MOBILE_CLASSES.wrapText}`}>
              El director automático se referirá a "{selectedWorld.name}"Muestre el mundo y organice las restricciones del mundo que se pueden utilizar en este libro antes de la preparación del personaje.
            </div>
          ) : (
            <div className="rounded-lg bg-muted/45 px-4 py-3 text-sm leading-6 text-foreground">
              La IA organizará automáticamente el mundo del libro de acuerdo con el plan macro y lo utilizará para la generación posterior de personajes, capítulos y texto.
            </div>
          )}
        </div>

        <div className="space-y-2">
          <FieldLabel htmlFor="director-basic-style-profile" hint="Opcional. Después de la selección, el director solo leerá el resumen de escritura ligero en la primera mitad y continuará usando las reglas de escritura completas en la etapa del texto principal.">
            Método de escritura predeterminado a nivel de libro
          </FieldLabel>
          <SelectControl
            id="director-basic-style-profile"
            className={controlClassName}
            value={selectedStyleProfileId}
            onChange={(event) => onStyleProfileChange(event.target.value)}
          >
            <option value="">Primero use solo palabras clave de estilo</option>
            {styleProfileOptions.map((option) => (
              <option key={option.id} value={option.id}>{option.name}</option>
            ))}
          </SelectControl>
          <div className={`text-xs leading-5 text-muted-foreground ${AUTO_DIRECTOR_MOBILE_CLASSES.wrapText}`}>
            {selectedStyleSummary?.stageSummaryLines[0] ?? "Cuando tenga buenos recursos de escritura, se recomienda elegir un conjunto directamente para ayudarlo a anticipar con mayor claridad cómo escribirá el director."}
          </div>
          {selectedStyleSummary?.stageSummaryLines.length ? (
            <div className={`pt-1 text-xs leading-6 text-muted-foreground ${AUTO_DIRECTOR_MOBILE_CLASSES.wrapText}`}>
              Esta forma de escribir afectará el tono y ritmo de los capítulos siguientes:{selectedStyleSummary.stageSummaryLines.join(";")}
            </div>
          ) : null}
        </div>
      </div>

      <div className="flex flex-col gap-2 pt-2 sm:flex-row sm:justify-between">
        <Button type="button" variant="ghost" onClick={onBack}>Volver a la configuración inicial</Button>
        <Button type="button" onClick={onConfirm}>Confirmar el mundo y el método de escritura.</Button>
      </div>
    </section>
  );
}
