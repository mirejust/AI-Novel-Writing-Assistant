import { useState } from "react";
import type { NovelBasicFormState } from "../novelBasicInfo.shared";
import {
  authorEstimatedChapterCount,
  BASIC_INFO_FIELD_HINTS,
  EMOTION_OPTIONS,
  PACE_OPTIONS,
  POWER_SYSTEM_OPTIONS,
  POV_OPTIONS,
  READER_CHANNEL_OPTIONS,
  WRITING_PLATFORM_OPTIONS,
} from "../novelBasicInfo.shared";
import { parseEstimatedChapterCountInput } from "./estimatedChapterCountInput";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { AUTO_DIRECTOR_MOBILE_CLASSES } from "@/mobile/autoDirector";
import { BookFramingQuickFillButton } from "../components/basicInfoForm/BookFramingQuickFillButton";
import {
  FieldLabel,
  findOptionSummary,
} from "../components/basicInfoForm/BasicInfoFormPrimitives";
import SelectControl from "@/components/common/SelectControl";

interface StageBasicSetupProps {
  basicForm: NovelBasicFormState;
  genreOptions: Array<{ id: string; path: string; label: string }>;
  idea: string;
  onBasicFormChange: (patch: Partial<NovelBasicFormState>) => void;
  onBack: () => void;
  onConfirm: () => void;
}

export default function StageBasicSetup({
  basicForm,
  genreOptions,
  idea,
  onBasicFormChange,
  onBack,
  onConfirm,
}: StageBasicSetupProps) {
  const [estimatedChapterCountDraft, setEstimatedChapterCountDraft] = useState<string | null>(null);
  const [volumeCountDraft, setVolumeCountDraft] = useState<string | null>(null);
  const chapterCount = authorEstimatedChapterCount(basicForm);
  const controlClassName = "w-full rounded-lg border-0 bg-muted/40 px-3 py-2.5 text-sm outline-none ring-1 ring-transparent transition hover:bg-muted/55 focus:bg-background focus:ring-2 focus:ring-primary/25";

  return (
    <section className="mx-auto w-full max-w-5xl space-y-7 py-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="text-2xl font-semibold tracking-normal text-foreground">Decide primero la sensación de este libro.</div>
          <div className={`mt-2 max-w-2xl text-sm leading-6 text-muted-foreground ${AUTO_DIRECTOR_MOBILE_CLASSES.wrapText}`}>
            Aquí solo confirmamos los parámetros básicos que afectan la experiencia de lectura de todo el libro. Deje el valor predeterminado cuando no esté seguro y la IA seguirá basando su juicio en sus pensamientos iniciales.
          </div>
        </div>
        <div className="rounded-full bg-muted/55 px-3 py-1 text-xs text-muted-foreground">
          alrededor de 1 minuto
        </div>
      </div>

      <div className="flex items-start gap-3 border-y border-border/60 py-4">
        <div className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-emerald-500" />
        <div>
          <div className="text-sm font-medium text-foreground">La IA determinará automáticamente la base creativa</div>
          <div className={`mt-1 text-xs leading-5 text-muted-foreground ${AUTO_DIRECTOR_MOBILE_CLASSES.wrapText}`}>
            El sistema determinará el tema y el método de avance principal basándose en la idea inicial y lo ejecutará a través de la planificación de dirección, texto, inspección y reparación. Después de la creación, aún puedes ajustar los métodos de escritura posteriores en la configuración de trabajo.
          </div>
        </div>
      </div>

      <div className="grid gap-x-8 gap-y-6 md:grid-cols-2">
        <div className="space-y-2">
          <FieldLabel htmlFor="director-basic-platform" hint="Decida qué tipo de plataforma de lectura se utilizará para la planificación, redacción, revisión y restauración.">Plataforma de destino</FieldLabel>
          <SelectControl
            id="director-basic-platform"
            className={controlClassName}
            value={basicForm.writingPlatformPreference}
            onChange={(event) => onBasicFormChange({ writingPlatformPreference: event.target.value as NovelBasicFormState["writingPlatformPreference"] })}
          >
            {WRITING_PLATFORM_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </SelectControl>
          <div className={`text-xs text-muted-foreground ${AUTO_DIRECTOR_MOBILE_CLASSES.wrapText}`}>
            {findOptionSummary(WRITING_PLATFORM_OPTIONS, basicForm.writingPlatformPreference)}
          </div>
        </div>
        <div className="space-y-2">
          <FieldLabel htmlFor="director-basic-reader-channel" hint={BASIC_INFO_FIELD_HINTS.readerChannelPreference}>Tendencias del canal de lectores</FieldLabel>
          <SelectControl
            id="director-basic-reader-channel"
            className={controlClassName}
            value={basicForm.readerChannelPreference}
            onChange={(event) => onBasicFormChange({
              readerChannelPreference: event.target.value as NovelBasicFormState["readerChannelPreference"],
            })}
          >
            {READER_CHANNEL_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </SelectControl>
          <div className={`text-xs text-muted-foreground ${AUTO_DIRECTOR_MOBILE_CLASSES.wrapText}`}>
            {findOptionSummary(READER_CHANNEL_OPTIONS, basicForm.readerChannelPreference)}
          </div>
        </div>

        <div className="space-y-2">
          <FieldLabel htmlFor="director-basic-pov" hint={BASIC_INFO_FIELD_HINTS.narrativePov}>Perspectiva narrativa</FieldLabel>
          <SelectControl
            id="director-basic-pov"
            className={controlClassName}
            value={basicForm.narrativePov}
            onChange={(event) => onBasicFormChange({
              narrativePov: event.target.value as NovelBasicFormState["narrativePov"],
            })}
          >
            {POV_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </SelectControl>
          <div className={`text-xs text-muted-foreground ${AUTO_DIRECTOR_MOBILE_CLASSES.wrapText}`}>
            {findOptionSummary(POV_OPTIONS, basicForm.narrativePov)}
          </div>
        </div>

        <div className="space-y-2">
          <FieldLabel htmlFor="director-basic-pace" hint={BASIC_INFO_FIELD_HINTS.pacePreference}>Preferencia de ritmo</FieldLabel>
          <SelectControl
            id="director-basic-pace"
            className={controlClassName}
            value={basicForm.pacePreference}
            onChange={(event) => onBasicFormChange({
              pacePreference: event.target.value as NovelBasicFormState["pacePreference"],
            })}
          >
            {PACE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </SelectControl>
          <div className={`text-xs text-muted-foreground ${AUTO_DIRECTOR_MOBILE_CLASSES.wrapText}`}>
            {findOptionSummary(PACE_OPTIONS, basicForm.pacePreference)}
          </div>
        </div>

        <div className="space-y-2">
          <FieldLabel htmlFor="director-basic-emotion" hint={BASIC_INFO_FIELD_HINTS.emotionIntensity}>Concentración emocional</FieldLabel>
          <SelectControl
            id="director-basic-emotion"
            className={controlClassName}
            value={basicForm.emotionIntensity}
            onChange={(event) => onBasicFormChange({
              emotionIntensity: event.target.value as NovelBasicFormState["emotionIntensity"],
            })}
          >
            {EMOTION_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </SelectControl>
          <div className={`text-xs text-muted-foreground ${AUTO_DIRECTOR_MOBILE_CLASSES.wrapText}`}>
            {findOptionSummary(EMOTION_OPTIONS, basicForm.emotionIntensity)}
          </div>
        </div>

        <div className="space-y-2">
          <FieldLabel htmlFor="director-basic-power-system" hint={BASIC_INFO_FIELD_HINTS.powerSystemPreference}>Sistema de poder de combate</FieldLabel>
          <SelectControl
            id="director-basic-power-system"
            className={controlClassName}
            value={basicForm.powerSystemPreference}
            onChange={(event) => onBasicFormChange({
              powerSystemPreference: event.target.value as NovelBasicFormState["powerSystemPreference"],
            })}
          >
            {POWER_SYSTEM_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </SelectControl>
          <div className={`text-xs text-muted-foreground ${AUTO_DIRECTOR_MOBILE_CLASSES.wrapText}`}>
            {findOptionSummary(POWER_SYSTEM_OPTIONS, basicForm.powerSystemPreference)}
          </div>
        </div>

        <div className="space-y-2">
          <FieldLabel htmlFor="director-basic-estimated" hint={BASIC_INFO_FIELD_HINTS.estimatedChapterCount}>Número estimado de capítulos</FieldLabel>
          <Input
            id="director-basic-estimated"
            type="number"
            min={1}
            max={2000}
            className={controlClassName}
            placeholder="Recomendado por IA según la dirección de la historia."
            value={estimatedChapterCountDraft ?? (basicForm.estimatedChapterCountSource === "default" ? "" : String(basicForm.estimatedChapterCount))}
            onChange={(event) => {
              const draft = event.target.value;
              setEstimatedChapterCountDraft(draft);
              const estimatedChapterCount = parseEstimatedChapterCountInput(draft);
              if (estimatedChapterCount !== null) onBasicFormChange({ estimatedChapterCount, estimatedChapterCountSource: "user" });
              else if (!draft.trim()) onBasicFormChange({estimatedChapterCountSource: "default"});
            }}
            onBlur={() => setEstimatedChapterCountDraft(null)}
          />
          <div className={`text-xs text-muted-foreground ${AUTO_DIRECTOR_MOBILE_CLASSES.wrapText}`}>
            Déjelo en blanco para recomendación de IA; Rellénelo y ordene la estructura del libro y los capítulos siguientes según esta escala.
          </div>
          {chapterCount !== undefined && chapterCount <= 60 ? (
            <div className={`rounded-lg bg-sky-50 px-3 py-2 text-xs leading-5 text-sky-900 ${AUTO_DIRECTOR_MOBILE_CLASSES.wrapText}`}>
              Modo libro compacto: la IA completará el final completo en un espacio limitado y agregará hasta 5 capítulos adicionales si es necesario.
            </div>
          ) : null}
          {chapterCount !== undefined && chapterCount > 200 ? (
            <div className={`rounded-lg bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900 ${AUTO_DIRECTOR_MOBILE_CLASSES.wrapText}`}>
              Se recomienda probarlo primero a pequeña escala: primero verifique la planificación y las instrucciones de los primeros capítulos, y luego expanda el alcance del resultado después de confirmar que cumple con sus ideas.
            </div>
          ) : null}
        </div>
        <div className="space-y-2">
          <FieldLabel htmlFor="director-basic-volumes">Número fijo de rollos (opcional)</FieldLabel>
          <Input id="director-basic-volumes" type="number" min={1} max={24} step={1}
            className={controlClassName} placeholder="Dejar en blanco para ser recomendado por AI"
            value={volumeCountDraft ?? basicForm.userPreferredVolumeCount ?? ""}
            onChange={(event) => {
              const draft = event.target.value;
              setVolumeCountDraft(draft);
              const count = Number(draft);
              if (!draft) onBasicFormChange({userPreferredVolumeCount: undefined});
              else if (Number.isInteger(count) && count >= 1 && count <= 24) onBasicFormChange({userPreferredVolumeCount: count});
            }}
            onBlur={() => setVolumeCountDraft(null)}/>
          <p className="text-xs text-muted-foreground">Complete los volúmenes del 1 al 24 y la IA organizará todo el libro de acuerdo con el número de volumen especificado; déjelo en blanco y la IA recomendará según el tamaño de la historia.</p>
        </div>
      </div>

      <details className="group pt-2">
        <summary className="cursor-pointer list-none">
          <div>
            <div className="text-base font-semibold text-foreground">Lectores de suplementos y puntos de venta.</div>
            <div className={`mt-1 max-w-3xl text-sm leading-6 text-muted-foreground ${AUTO_DIRECTOR_MOBILE_CLASSES.wrapText}`}>
              Si no está seguro, puede omitirlo primero. Después de la suplementación, la IA tendrá una idea más clara de para quién es el libro y qué deberían ofrecer los primeros 30 capítulos a los lectores.
            </div>
          </div>
        </summary>

        <div className="mt-5 flex justify-start">
          <BookFramingQuickFillButton
            basicForm={basicForm}
            genreOptions={genreOptions}
            descriptionOverride={idea}
            onApplySuggestion={onBasicFormChange}
          />
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <FieldLabel htmlFor="director-basic-target-audience" hint={BASIC_INFO_FIELD_HINTS.targetAudience}>
              público objetivo
            </FieldLabel>
            <Input
              id="director-basic-target-audience"
              className={controlClassName}
              value={basicForm.targetAudience}
              placeholder="Por ejemplo: lectores a quienes les gusta ver los contraataques urbanos de alta presión, los tirones de relaciones y la búsqueda constante de ganchos."
              onChange={(event) => onBasicFormChange({ targetAudience: event.target.value })}
            />
          </div>

          <div className="space-y-2">
            <FieldLabel htmlFor="director-basic-commercial-tags" hint={BASIC_INFO_FIELD_HINTS.commercialTagsText}>
              etiquetas de negocio principal
            </FieldLabel>
            <Input
              id="director-basic-commercial-tags"
              className={controlClassName}
              value={basicForm.commercialTagsText}
              placeholder="Por ejemplo: contraataque, conflicto fuerte, lleno de suspenso, juego en el lugar de trabajo."
              onChange={(event) => onBasicFormChange({ commercialTagsText: event.target.value })}
            />
          </div>

          <div className="space-y-2">
            <FieldLabel htmlFor="director-basic-competing-feel" hint={BASIC_INFO_FIELD_HINTS.competingFeel}>
              Sentido del producto competitivo/sentido de lectura familiar
            </FieldLabel>
            <Input
              id="director-basic-competing-feel"
              className={controlClassName}
              value={basicForm.competingFeel}
              placeholder="Por ejemplo: un poco de humor frío y tensión en las relaciones de alta densidad en la presión real del lugar de trabajo."
              onChange={(event) => onBasicFormChange({ competingFeel: event.target.value })}
            />
          </div>

          <div className="space-y-2">
            <FieldLabel htmlFor="director-basic-book-selling-point" hint={BASIC_INFO_FIELD_HINTS.bookSellingPoint}>
              El principal punto de venta de este libro.
            </FieldLabel>
            <textarea
              id="director-basic-book-selling-point"
              rows={3}
              className={`${controlClassName} min-h-[96px] resize-y`}
              value={basicForm.bookSellingPoint}
              placeholder="Por ejemplo: cada vez que el protagonista resuelve un dilema de la vida real, aprovechará una cadena más amplia de relaciones e intereses, y los lectores siempre esperarán con ansias la siguiente contrapresión."
              onChange={(event) => onBasicFormChange({ bookSellingPoint: event.target.value })}
            />
          </div>
        </div>

        <div className="space-y-2">
          <FieldLabel htmlFor="director-basic-first30-promise" hint={BASIC_INFO_FIELD_HINTS.first30ChapterPromise}>
            Promesa de los primeros 30 capítulos
          </FieldLabel>
          <textarea
            id="director-basic-first30-promise"
            rows={4}
            className={`${controlClassName} min-h-[120px] resize-y`}
            value={basicForm.first30ChapterPromise}
            placeholder="Por ejemplo: los primeros 30 capítulos deben permitir a los lectores ver al protagonista adoptar una postura firme en la primera etapa, emerge el oponente central y la línea de relación se invierte por primera vez, y debe quedar claro que el libro se volverá cada vez más despiadado más adelante."
            onChange={(event) => onBasicFormChange({ first30ChapterPromise: event.target.value })}
          />
        </div>
      </details>

      <div className="flex flex-col gap-2 pt-2 sm:flex-row sm:justify-between">
        <Button type="button" variant="ghost" onClick={onBack}>Devolver ideas</Button>
        <Button type="button" onClick={onConfirm}>Confirmar la configuración inicial</Button>
      </div>
    </section>
  );
}
