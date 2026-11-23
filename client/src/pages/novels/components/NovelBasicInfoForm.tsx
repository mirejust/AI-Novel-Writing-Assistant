import type { ReactNode } from "react";
import type { BookAnalysisSectionKey } from "@ai-novel/shared/types/bookAnalysis";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  AI_FREEDOM_OPTIONS,
  BASIC_INFO_FIELD_HINTS,
  DEFAULT_ESTIMATED_CHAPTER_COUNT,
  EMOTION_OPTIONS,
  PACE_OPTIONS,
  POV_OPTIONS,
  PROJECT_MODE_OPTIONS,
  PROJECT_STATUS_OPTIONS,
  PUBLICATION_STATUS_OPTIONS,
  WRITING_MODE_OPTIONS,
  WRITING_PLATFORM_OPTIONS,
  type NovelBasicFormState,
} from "../novelBasicInfo.shared";
import {
  FieldLabel,
  SectionBlock,
  SelectionCard,
  findOptionSummary,
} from "./basicInfoForm/BasicInfoFormPrimitives";
import BookPositioningStudio from "./basicInfoForm/BookPositioningStudio";
import CollapsibleSummary from "./CollapsibleSummary";
import { ContinuationSourceSection } from "./basicInfoForm/ContinuationSourceSection";
import SelectControl from "@/components/common/SelectControl";

interface WorldOption {
  id: string;
  name: string;
}

interface GenreOption {
  id: string;
  label: string;
  path: string;
}

interface StoryModeOption {
  id: string;
  name: string;
  label: string;
  path: string;
  description?: string | null;
  profile: {
    coreDrive: string;
    readerReward: string;
  };
}

interface NovelBasicInfoFormProps {
  basicForm: NovelBasicFormState;
  genreOptions: GenreOption[];
  storyModeOptions: StoryModeOption[];
  worldOptions: WorldOption[];
  sourceNovelOptions: Array<{ id: string; title: string }>;
  sourceKnowledgeOptions: Array<{ id: string; title: string }>;
  sourceNovelBookAnalysisOptions: Array<{
    id: string;
    title: string;
    documentTitle: string;
    documentVersionNumber: number;
  }>;
  isLoadingSourceNovelBookAnalyses: boolean;
  availableBookAnalysisSections: Array<{ key: BookAnalysisSectionKey; title: string }>;
  onFormChange: (patch: Partial<NovelBasicFormState>) => void;
  onSubmit: () => void;
  isSubmitting: boolean;
  submitLabel: string;
  showPublicationStatus?: boolean;
  titleQuickFill?: ReactNode;
  framingQuickFill?: ReactNode;
  projectQuickStart?: ReactNode;
  resourceRecommendation?: ReactNode;
  coverSection?: ReactNode;
}

export default function NovelBasicInfoForm(props: NovelBasicInfoFormProps) {
  const {
    basicForm,
    genreOptions,
    storyModeOptions,
    worldOptions,
    sourceNovelOptions,
    sourceKnowledgeOptions,
    sourceNovelBookAnalysisOptions,
    isLoadingSourceNovelBookAnalyses,
    availableBookAnalysisSections,
    onFormChange,
    onSubmit,
    isSubmitting,
    submitLabel,
    showPublicationStatus = true,
    titleQuickFill,
    framingQuickFill,
    projectQuickStart,
    resourceRecommendation,
    coverSection,
  } = props;

  const continuationSourceMissing = basicForm.writingMode === "continuation"
    && (
      (basicForm.continuationSourceType === "novel" && !basicForm.sourceNovelId)
      || (basicForm.continuationSourceType === "knowledge_document" && !basicForm.sourceKnowledgeDocumentId)
    );

  const continuationAnalysisSectionMissing = basicForm.writingMode === "continuation"
    && Boolean(basicForm.continuationBookAnalysisId)
    && basicForm.continuationBookAnalysisSections.length === 0;

  const hasSelectedContinuationSource = basicForm.continuationSourceType === "novel"
    ? Boolean(basicForm.sourceNovelId)
    : Boolean(basicForm.sourceKnowledgeDocumentId);
  const primaryStoryMode = storyModeOptions.find((item) => item.id === basicForm.primaryStoryModeId);
  const secondaryStoryMode = storyModeOptions.find((item) => item.id === basicForm.secondaryStoryModeId);

  return (
    <div className="space-y-4">
      <section className="space-y-5">
        <BookPositioningStudio
          basicForm={basicForm}
          onFormChange={onFormChange}
          titleQuickFill={titleQuickFill}
          framingQuickFill={framingQuickFill}
          projectQuickStart={projectQuickStart}
        />

        <div className="space-y-2">
          <FieldLabel hint={BASIC_INFO_FIELD_HINTS.writingMode}>Modo creativo</FieldLabel>
          <div className="grid gap-3 md:grid-cols-2">
            {WRITING_MODE_OPTIONS.map((option) => (
              <SelectionCard
                key={option.value}
                option={option}
                selected={basicForm.writingMode === option.value}
                onSelect={(value) => onFormChange({ writingMode: value })}
              />
            ))}
          </div>
        </div>

        <div className="space-y-1 pt-1 text-sm leading-6 text-muted-foreground">
          <div className="font-medium text-foreground">La diferencia entre base temática y modo de promoción.</div>
          <div>
            La base temática responde "qué tipo de libro es este", como cultivar la inmortalidad, la ciudad y la ficción histórica; el modo de promoción responde "en qué se basa este libro para continuar promoviendo y realizando", como el flujo del sistema, el flujo invencible y el flujo agrícola.
          </div>
        </div>

        {resourceRecommendation}

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <div className="space-y-2">
            <FieldLabel htmlFor="basic-genre" hint={BASIC_INFO_FIELD_HINTS.genreId}>Base temática</FieldLabel>
            <SelectControl
              id="basic-genre"
              className="w-full rounded-md border bg-background p-2 text-sm"
              value={basicForm.genreId}
              onChange={(event) => onFormChange({ genreId: event.target.value })}
            >
              <option value="">Deja que la IA recomiende temas</option>
              {genreOptions.map((genre) => (
                <option key={genre.id} value={genre.id}>
                  {genre.path}
                </option>
              ))}
            </SelectControl>
          </div>

          <div className="space-y-2">
            <FieldLabel htmlFor="basic-default-length" hint={BASIC_INFO_FIELD_HINTS.defaultChapterLength}>
              Recuento de palabras del capítulo predeterminado
            </FieldLabel>
            <Input
              id="basic-default-length"
              type="number"
              min={500}
              max={10000}
              value={basicForm.defaultChapterLength}
              onChange={(event) => onFormChange({ defaultChapterLength: Number(event.target.value || 0) || 2800 })}
            />
            <div className="text-xs text-muted-foreground">Se recomienda configurarlo primero en 2500-3500, y aún se puede ajustar individualmente por capítulo más adelante.</div>
          </div>

          <div className="space-y-2">
            <FieldLabel htmlFor="basic-estimated-chapters" hint={BASIC_INFO_FIELD_HINTS.estimatedChapterCount}>
              Número estimado de capítulos
            </FieldLabel>
            <Input
              id="basic-estimated-chapters"
              type="number"
              min={1}
              max={2000}
              value={basicForm.estimatedChapterCount}
              onChange={(event) => onFormChange({
                estimatedChapterCount: Math.max(
                  1,
                  Math.min(2000, Number(event.target.value || 0) || DEFAULT_ESTIMATED_CHAPTER_COUNT),
                ),
              })}
            />
            <div className="text-xs text-muted-foreground">Se utilizará como referencia para el rango predeterminado del contorno, los puntos de disparo y la tubería, y aún se puede ajustar más adelante.</div>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-2">
            <FieldLabel htmlFor="basic-primary-story-mode" hint={BASIC_INFO_FIELD_HINTS.primaryStoryModeId}>
              modo de propulsión principal
            </FieldLabel>
            <SelectControl
              id="basic-primary-story-mode"
              className="w-full rounded-md border bg-background p-2 text-sm"
              value={basicForm.primaryStoryModeId}
              onChange={(event) => onFormChange({ primaryStoryModeId: event.target.value })}
            >
              <option value="">Deje que AI recomiende los principales métodos de promoción</option>
              {storyModeOptions.map((storyMode) => (
                <option key={storyMode.id} value={storyMode.id}>
                  {storyMode.path}
                </option>
              ))}
            </SelectControl>
          </div>

          <div className="space-y-2">
            <FieldLabel htmlFor="basic-secondary-story-mode" hint={BASIC_INFO_FIELD_HINTS.secondaryStoryModeId}>
              Modo de propulsión secundaria
            </FieldLabel>
            <SelectControl
              id="basic-secondary-story-mode"
              className="w-full rounded-md border bg-background p-2 text-sm"
              value={basicForm.secondaryStoryModeId}
              onChange={(event) => onFormChange({ secondaryStoryModeId: event.target.value })}
            >
              <option value="">Modo de propulsión secundaria no superpuesta</option>
              {storyModeOptions.map((storyMode) => (
                <option
                  key={storyMode.id}
                  value={storyMode.id}
                  disabled={storyMode.id === basicForm.primaryStoryModeId}
                >
                  {storyMode.path}
                </option>
              ))}
            </SelectControl>
          </div>
        </div>

        {primaryStoryMode || secondaryStoryMode ? (
          <div className="grid gap-3 md:grid-cols-2">
            {primaryStoryMode ? (
              <div className="rounded-lg bg-muted/15 p-3">
                <div className="text-sm font-semibold text-foreground">Resumen del modo de propulsión principal</div>
                <div className="mt-1 text-sm text-foreground">{primaryStoryMode.name}</div>
                <div className="mt-1 text-xs leading-5 text-muted-foreground">
                  {primaryStoryMode.description || primaryStoryMode.profile.coreDrive}
                </div>
                <div className="mt-2 text-xs text-muted-foreground">Controlador principal:{primaryStoryMode.profile.coreDrive}</div>
              </div>
            ) : null}
            {secondaryStoryMode ? (
              <div className="rounded-lg bg-muted/15 p-3">
                <div className="text-sm font-semibold text-foreground">Resumen del modo de propulsión secundaria.</div>
                <div className="mt-1 text-sm text-foreground">{secondaryStoryMode.name}</div>
                <div className="mt-1 text-xs leading-5 text-muted-foreground">
                  {secondaryStoryMode.description || secondaryStoryMode.profile.coreDrive}
                </div>
                <div className="mt-2 text-xs text-muted-foreground">Recompensas suplementarias para lectores:{secondaryStoryMode.profile.readerReward}</div>
              </div>
            ) : null}
          </div>
        ) : null}

        {coverSection}
      </section>

      <details className="group border-t border-border/60 pt-4">
        <summary className="cursor-pointer list-none">
          <CollapsibleSummary
            title="Configuraciones avanzadas para experiencias narrativas y colaboración con IA"
            description="Esta parte afectará el estilo de la próxima generación y el grado de automatización de la IA, pero no es algo que los principiantes deban decidir inmediatamente en la primera pantalla."
          />
        </summary>

        <div className="mt-4 space-y-4">
          <div className="space-y-3 pt-1">
            <div className="text-sm font-semibold text-foreground">Muestra mundial de referencia</div>
            <div className="mt-1 text-xs leading-5 text-muted-foreground">
              Esto sólo se utiliza para registrar referencias de inicialización. Complete la importación, generación y sincronización completas en el "Mundo del libro" del banco de trabajo novedoso después de la creación.
            </div>
            <div className="space-y-2">
              <FieldLabel htmlFor="basic-world" hint={BASIC_INFO_FIELD_HINTS.worldId}>Muestra mundial de referencia</FieldLabel>
              <SelectControl
                id="basic-world"
                className="w-full rounded-md border bg-background p-2 text-sm"
                value={basicForm.worldId}
                onChange={(event) => onFormChange({ worldId: event.target.value })}
              >
                <option value="">No se ha especificado ninguna muestra de referencia</option>
                {worldOptions.map((world) => (
                  <option key={world.id} value={world.id}>
                    {world.name}
                  </option>
                ))}
              </SelectControl>
            </div>
          </div>

          <SectionBlock
            title="Experiencia narrativa"
            description="Estos campos definen cómo los lectores percibirán el trabajo y afectan directamente el tono, la densidad y la progresión del plan del capítulo."
            surface="none"
          >
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <FieldLabel htmlFor="basic-writing-platform" hint="Después de guardar, solo afectará la planificación, el texto, la revisión y la modificación posteriores, y no reescribirá el texto existente.">Plataforma de destino</FieldLabel>
                <SelectControl
                  id="basic-writing-platform"
                  className="w-full rounded-md border bg-background p-2 text-sm"
                  value={basicForm.writingPlatformPreference}
                  onChange={(event) => onFormChange({ writingPlatformPreference: event.target.value as NovelBasicFormState["writingPlatformPreference"] })}
                >
                  {WRITING_PLATFORM_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </SelectControl>
                <div className="text-xs text-muted-foreground">{findOptionSummary(WRITING_PLATFORM_OPTIONS, basicForm.writingPlatformPreference)}</div>
              </div>
              <div className="space-y-2">
                <FieldLabel htmlFor="basic-pov" hint={BASIC_INFO_FIELD_HINTS.narrativePov}>Perspectiva narrativa</FieldLabel>
                <SelectControl
                  id="basic-pov"
                  className="w-full rounded-md border bg-background p-2 text-sm"
                  value={basicForm.narrativePov}
                  onChange={(event) => onFormChange({ narrativePov: event.target.value as NovelBasicFormState["narrativePov"] })}
                >
                  {POV_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </SelectControl>
                <div className="text-xs text-muted-foreground">{findOptionSummary(POV_OPTIONS, basicForm.narrativePov)}</div>
              </div>

              <div className="space-y-2">
                <FieldLabel htmlFor="basic-pace" hint={BASIC_INFO_FIELD_HINTS.pacePreference}>Preferencia de ritmo</FieldLabel>
                <SelectControl
                  id="basic-pace"
                  className="w-full rounded-md border bg-background p-2 text-sm"
                  value={basicForm.pacePreference}
                  onChange={(event) => onFormChange({ pacePreference: event.target.value as NovelBasicFormState["pacePreference"] })}
                >
                  {PACE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </SelectControl>
                <div className="text-xs text-muted-foreground">{findOptionSummary(PACE_OPTIONS, basicForm.pacePreference)}</div>
              </div>

              <div className="space-y-2">
                <FieldLabel htmlFor="basic-emotion" hint={BASIC_INFO_FIELD_HINTS.emotionIntensity}>Concentración emocional</FieldLabel>
                <SelectControl
                  id="basic-emotion"
                  className="w-full rounded-md border bg-background p-2 text-sm"
                  value={basicForm.emotionIntensity}
                  onChange={(event) => onFormChange({ emotionIntensity: event.target.value as NovelBasicFormState["emotionIntensity"] })}
                >
                  {EMOTION_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </SelectControl>
                <div className="text-xs text-muted-foreground">{findOptionSummary(EMOTION_OPTIONS, basicForm.emotionIntensity)}</div>
              </div>

              <div className="space-y-2">
                <FieldLabel htmlFor="basic-style-tone" hint={BASIC_INFO_FIELD_HINTS.styleTone}>Palabras claves de estilo de escritura</FieldLabel>
                <Input
                  id="basic-style-tone"
                  value={basicForm.styleTone}
                  placeholder="Por ejemplo: frialdad, moderación, humor negro."
                  onChange={(event) => onFormChange({ styleTone: event.target.value })}
                />
              </div>
            </div>
          </SectionBlock>

          <SectionBlock
            title="Colaboración de IA"
            description="Esta parte define cómo usted y la IA dividen el trabajo y hasta dónde puede avanzar el sistema automáticamente."
            surface="none"
          >
            <div className="space-y-2">
              <FieldLabel hint={BASIC_INFO_FIELD_HINTS.projectMode}>Modo proyecto</FieldLabel>
              <div className="grid gap-3 md:grid-cols-2">
                {PROJECT_MODE_OPTIONS.map((option) => (
                  <SelectionCard
                    key={option.value}
                    option={option}
                    selected={basicForm.projectMode === option.value}
                    onSelect={(value) => onFormChange({ projectMode: value })}
                  />
                ))}
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <FieldLabel htmlFor="basic-ai-freedom" hint={BASIC_INFO_FIELD_HINTS.aiFreedom}>Grados de libertad de la IA</FieldLabel>
                <SelectControl
                  id="basic-ai-freedom"
                  className="w-full rounded-md border bg-background p-2 text-sm"
                  value={basicForm.aiFreedom}
                  onChange={(event) => onFormChange({ aiFreedom: event.target.value as NovelBasicFormState["aiFreedom"] })}
                >
                  {AI_FREEDOM_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </SelectControl>
                <div className="text-xs text-muted-foreground">{findOptionSummary(AI_FREEDOM_OPTIONS, basicForm.aiFreedom)}</div>
              </div>

              <div className="space-y-2">
                <FieldLabel htmlFor="basic-resource-score" hint={BASIC_INFO_FIELD_HINTS.resourceReadyScore}>
                  Integridad de recursos
                </FieldLabel>
                <Input
                  id="basic-resource-score"
                  type="number"
                  min={0}
                  max={100}
                  value={basicForm.resourceReadyScore}
                  onChange={(event) => onFormChange({
                    resourceReadyScore: Math.max(0, Math.min(100, Number(event.target.value || 0))),
                  })}
                />
                <div className="text-xs text-muted-foreground">0 significa recién comenzando, 100 significa que el escenario, los personajes y la planificación están relativamente completos.</div>
              </div>
            </div>

            <div className="flex flex-col gap-3 py-1 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-1">
                <FieldLabel htmlFor="basic-post-generation-style-review" hint={BASIC_INFO_FIELD_HINTS.postGenerationStyleReviewEnabled}>
                  Ir a detección y corrección de IA después del texto
                </FieldLabel>
                <div className="text-xs leading-5 text-muted-foreground">
                  Después de activarse, la verificación del capítulo verificará el método de escritura y los riesgos de sabor de la IA; Los problemas que deban corregirse se revisarán parcialmente de acuerdo con esta estrategia creativa y las recomendaciones generales se conservarán como recordatorios de calidad.
                </div>
              </div>
              <Switch
                id="basic-post-generation-style-review"
                aria-label="Ir a detección y corrección de IA después del texto"
                checked={basicForm.postGenerationStyleReviewEnabled}
                onCheckedChange={(checked) => onFormChange({ postGenerationStyleReviewEnabled: checked })}
              />
            </div>
          </SectionBlock>
        </div>
      </details>

      {basicForm.writingMode === "continuation" ? (
        <details className="group border-t border-border/60 pt-4" open>
          <summary className="cursor-pointer list-none">
            <CollapsibleSummary
              title="Continuar escribiendo la configuración de origen"
              description="El modo de continuación requiere borrar primero la fuente ascendente, por lo que se expande de forma predeterminada."
              collapsedLabel="Expandir configuración"
              expandedLabel="Contraer configuración"
            />
          </summary>
          <div className="mt-4">
            <ContinuationSourceSection
              basicForm={basicForm}
              sourceNovelOptions={sourceNovelOptions}
              sourceKnowledgeOptions={sourceKnowledgeOptions}
              sourceNovelBookAnalysisOptions={sourceNovelBookAnalysisOptions}
              isLoadingSourceNovelBookAnalyses={isLoadingSourceNovelBookAnalyses}
              availableBookAnalysisSections={availableBookAnalysisSections}
              hasSelectedContinuationSource={hasSelectedContinuationSource}
              onFormChange={onFormChange}
            />
          </div>
        </details>
      ) : null}

      <details className="group border-t border-border/60 pt-4">
        <summary className="cursor-pointer list-none">
          <CollapsibleSummary
            title="Campos de estado y progreso del proyecto"
            description="Estos sirven principalmente para la gestión de proyectos y el juicio de procesos, y no son contenidos que deban procesarse inmediatamente en la primera pantalla."
            collapsedLabel="Expandir campos"
            expandedLabel="Contraer campo"
          />
        </summary>
        <div className="mt-4">
          <SectionBlock
            title="Progreso y estado de la producción."
            description="Estos estados sirven principalmente para la gestión de proyectos y el posterior juicio del proceso. No se completan de una vez y se pueden ajustar según etapas en el futuro."
            surface="none"
          >
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <FieldLabel htmlFor="basic-project-status">Estado del proyecto</FieldLabel>
                <SelectControl
                  id="basic-project-status"
                  className="w-full rounded-md border bg-background p-2 text-sm"
                  value={basicForm.projectStatus}
                  onChange={(event) => onFormChange({ projectStatus: event.target.value as NovelBasicFormState["projectStatus"] })}
                >
                  {PROJECT_STATUS_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </SelectControl>
              </div>

              <div className="space-y-2">
                <FieldLabel htmlFor="basic-storyline-status">Estado de la línea principal</FieldLabel>
                <SelectControl
                  id="basic-storyline-status"
                  className="w-full rounded-md border bg-background p-2 text-sm"
                  value={basicForm.storylineStatus}
                  onChange={(event) => onFormChange({ storylineStatus: event.target.value as NovelBasicFormState["storylineStatus"] })}
                >
                  {PROJECT_STATUS_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </SelectControl>
              </div>

              <div className="space-y-2">
                <FieldLabel htmlFor="basic-outline-status">Estado del esquema</FieldLabel>
                <SelectControl
                  id="basic-outline-status"
                  className="w-full rounded-md border bg-background p-2 text-sm"
                  value={basicForm.outlineStatus}
                  onChange={(event) => onFormChange({ outlineStatus: event.target.value as NovelBasicFormState["outlineStatus"] })}
                >
                  {PROJECT_STATUS_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </SelectControl>
              </div>

              {showPublicationStatus ? (
                <div className="space-y-2">
                  <FieldLabel hint={BASIC_INFO_FIELD_HINTS.status}>Estado de lanzamiento</FieldLabel>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {PUBLICATION_STATUS_OPTIONS.map((option) => (
                      <SelectionCard
                        key={option.value}
                        option={option}
                        selected={basicForm.status === option.value}
                        onSelect={(value) => onFormChange({ status: value })}
                      />
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </SectionBlock>
        </div>
      </details>

      {continuationSourceMissing ? (
        <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-800">
          En el modo de continuación, debe seleccionar una fuente ascendente clara antes de poder guardar información básica.
        </div>
      ) : null}

      {continuationAnalysisSectionMissing ? (
        <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-800">
          Los resultados del libro dividido deben coincidir con los capítulos del libro dividido que se inyectarán.
        </div>
      ) : null}

      <div className="flex justify-end">
        <Button
          onClick={onSubmit}
          disabled={isSubmitting || continuationSourceMissing || continuationAnalysisSectionMissing || !basicForm.title.trim()}
        >
          {isSubmitting ? "Sumisión..." : submitLabel}
        </Button>
      </div>
    </div>
  );
}
