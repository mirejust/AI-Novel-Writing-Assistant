import { useState } from "react";
import type { WorldOptionRefinementLevel, WorldReferenceAnchor, WorldReferenceMode } from "@ai-novel/shared/types/worldWizard";
import { Button } from "@/components/ui/button";
import KnowledgeDocumentPicker from "@/components/knowledge/KnowledgeDocumentPicker";
import type {
  GeneratorGenreOption,
  InspirationMode,
  WorldGeneratorConceptCard,
} from "./worldGeneratorShared";
import { REFERENCE_MODE_OPTIONS } from "./worldGeneratorShared";
import SelectControl from "@/components/common/SelectControl";

const INSPIRATION_MODE_CARDS: Array<{
  value: InspirationMode;
  title: string;
  description: string;
}> = [
  {
    value: "free",
    title: "Comience con una inspiración",
    description: "Muestras del mundo adecuadas para temas, temperamentos o ideas escénicas de historias existentes.",
  },
  {
    value: "reference",
    title: "Refinamiento de obras de referencia.",
    description: "Es adecuado aprender de la textura de las obras existentes y regenerarlas en un mundo aéreo independiente.",
  },
  {
    value: "random",
    title: "Deja que la IA dé dirección",
    description: "No tengo una idea clara todavía, sólo quiero conseguir un prototipo de algo utilizable por primera vez en el mundo.",
  },
];

interface WorldGeneratorStepOneProps {
  worldName: string;
  selectedGenreId: string;
  selectedGenre: GeneratorGenreOption | null;
  genreOptions: GeneratorGenreOption[];
  genreLoading: boolean;
  inspirationMode: InspirationMode;
  referenceMode: WorldReferenceMode;
  selectedKnowledgeDocumentIds: string[];
  preserveText: string;
  allowedChangesText: string;
  forbiddenText: string;
  inspirationText: string;
  optionRefinementLevel: WorldOptionRefinementLevel;
  optionsCount: number;
  canAnalyze: boolean;
  analyzeStreaming: boolean;
  analyzeButtonLabel: string;
  analyzeProgressMessage?: string;
  inspirationSourceMeta: {
    extracted: boolean;
    originalLength: number;
    chunkCount: number;
  } | null;
  concept: WorldGeneratorConceptCard | null;
  propertyOptionsCount: number;
  referenceAnchors: WorldReferenceAnchor[];
  onWorldNameChange: (value: string) => void;
  onGenreChange: (value: string) => void;
  onOpenGenreManager: () => void;
  onInspirationModeChange: (value: InspirationMode) => void;
  onKnowledgeDocumentIdsChange: (ids: string[]) => void;
  onReferenceModeChange: (value: WorldReferenceMode) => void;
  onPreserveTextChange: (value: string) => void;
  onAllowedChangesTextChange: (value: string) => void;
  onForbiddenTextChange: (value: string) => void;
  onInspirationTextChange: (value: string) => void;
  onOptionRefinementLevelChange: (value: WorldOptionRefinementLevel) => void;
  onOptionsCountChange: (value: number) => void;
  onAnalyze: () => void;
}

export default function WorldGeneratorStepOne(props: WorldGeneratorStepOneProps) {
  const {
    worldName,
    selectedGenreId,
    selectedGenre,
    genreOptions,
    genreLoading,
    inspirationMode,
    referenceMode,
    selectedKnowledgeDocumentIds,
    preserveText,
    allowedChangesText,
    forbiddenText,
    inspirationText,
    optionRefinementLevel,
    optionsCount,
    canAnalyze,
    analyzeStreaming,
    analyzeButtonLabel,
    analyzeProgressMessage,
    inspirationSourceMeta,
    concept,
    propertyOptionsCount,
    referenceAnchors,
    onWorldNameChange,
    onGenreChange,
    onOpenGenreManager,
    onInspirationModeChange,
    onKnowledgeDocumentIdsChange,
    onReferenceModeChange,
    onPreserveTextChange,
    onAllowedChangesTextChange,
    onForbiddenTextChange,
    onInspirationTextChange,
    onOptionRefinementLevelChange,
    onOptionsCountChange,
    onAnalyze,
  } = props;

  const isReferenceMode = inspirationMode === "reference";
  const [preferencesOpen, setPreferencesOpen] = useState(false);

  return (
    <div className="space-y-4">
      <div className="rounded-md border bg-background p-4 space-y-3">
        <div>
          <div className="text-sm font-medium">¿Cómo se llamará este mundo primero?</div>
          <div className="mt-1 text-xs text-muted-foreground">
            El nombre se puede dejar en blanco y el sistema primero creará una muestra mundial que se puede organizar aún más.
          </div>
        </div>
        <input
          className="w-full rounded-md border p-2 text-sm"
          placeholder="Por ejemplo: Reino Zixia, Dinastía Ashes, Ciudad Vieja de Yuxiang"
          value={worldName}
          onChange={(event) => onWorldNameChange(event.target.value)}
        />
      </div>

      <div className="space-y-2">
        <div>
          <div className="text-sm font-medium">Elige una base temática</div>
          <div className="mt-1 text-xs text-muted-foreground">
            La base del tema determina las expectativas del lector, las reglas de poder y los conflictos comunes del mundo.
          </div>
        </div>
        <SelectControl
          className="w-full rounded-md border bg-background p-2 text-sm"
          value={selectedGenreId}
          disabled={genreLoading || genreOptions.length === 0}
          onChange={(event) => onGenreChange(event.target.value)}
        >
          <option value="">{genreLoading ? "Cargando base de temas..." : "Por favor seleccione una base temática"}</option>
          {genreOptions.map((genre) => (
            <option key={genre.id} value={genre.id}>
              {genre.path}
            </option>
          ))}
        </SelectControl>
        {selectedGenre ? (
          <div className="rounded-md border p-3 text-xs text-muted-foreground space-y-1">
            <div>Ruta base del tema actual:{selectedGenre.path}</div>
            {selectedGenre.description?.trim() ? <div>Descripción del tema:{selectedGenre.description.trim()}</div> : null}
            {selectedGenre.template?.trim() ? (
              <div className="whitespace-pre-wrap">Plantilla base del tema:{selectedGenre.template.trim()}</div>
            ) : null}
          </div>
        ) : null}
        {genreLoading ? <div className="text-xs text-muted-foreground">Cargando árbol base de temas...</div> : null}
          {!genreLoading && genreOptions.length === 0 ? (
            <div className="rounded-md border border-dashed p-3 text-xs text-muted-foreground space-y-2">
            <div>La biblioteca base de temas está vacía. Para crear una muestra mundial es necesario preparar primero una base temática opcional.</div>
            <Button type="button" variant="outline" onClick={onOpenGenreManager}>
              Ir a la biblioteca base de temas
            </Button>
          </div>
        ) : null}
        <div className="text-xs text-muted-foreground">
          Primero determine la base del tema, luego genere tarjetas conceptuales, atributos del mundo y la posterior selección del esqueleto.
        </div>
      </div>

      <div className="space-y-2">
        <div className="text-sm font-medium">Elige cómo crear</div>
        <div className="grid gap-3 md:grid-cols-3">
          {INSPIRATION_MODE_CARDS.map((item) => (
            <button
              key={item.value}
              type="button"
              className={[
                "rounded-md border p-3 text-left transition-colors",
                inspirationMode === item.value ? "border-primary bg-primary/5" : "border-border/70 bg-background hover:bg-muted/40",
              ].join(" ")}
              onClick={() => onInspirationModeChange(item.value)}
            >
              <div className="text-sm font-medium text-foreground">{item.title}</div>
              <div className="mt-2 text-xs text-muted-foreground">{item.description}</div>
            </button>
          ))}
        </div>
      </div>

      {isReferenceMode ? (
        <div className="space-y-3">
          <KnowledgeDocumentPicker
            selectedIds={selectedKnowledgeDocumentIds}
            onChange={(next) => onKnowledgeDocumentIdsChange(next ?? [])}
            title="Documentación de referencia de la base de conocimientos"
            description="La fuente de referencia se selecciona aquí. Más tarde, primero se extraerá el punto de anclaje del mundo original y luego se generará la dirección de transformación aérea."
            queryStatus="enabled"
          />

          <div className="rounded-md border p-3 text-sm space-y-2">
            <div className="font-medium">Método de referencia</div>
            <SelectControl
              className="w-full rounded-md border bg-background p-2 text-sm"
              value={referenceMode}
              onChange={(event) => onReferenceModeChange(event.target.value as WorldReferenceMode)}
            >
              {REFERENCE_MODE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </SelectControl>
            <div className="text-xs text-muted-foreground">
              {REFERENCE_MODE_OPTIONS.find((item) => item.value === referenceMode)?.description}
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-md border p-3 text-sm space-y-2">
              <div className="font-medium">Debe ser retenido</div>
              <textarea
                className="min-h-[120px] w-full rounded-md border p-2 text-sm"
                placeholder="Por ejemplo: base urbana realista, calidad de vida en alquiler, atracción emocional adulta"
                value={preserveText}
                onChange={(event) => onPreserveTextChange(event.target.value)}
              />
            </div>

            <div className="rounded-md border p-3 text-sm space-y-2">
              <div className="font-medium">Modificaciones permitidas</div>
              <textarea
                className="min-h-[120px] w-full rounded-md border p-2 text-sm"
                placeholder="Por ejemplo: jerarquía de la ciudad, reglas sociales, red eléctrica, sistema de ubicación."
                value={allowedChangesText}
                onChange={(event) => onAllowedChangesTextChange(event.target.value)}
              />
            </div>

            <div className="rounded-md border p-3 text-sm space-y-2">
              <div className="font-medium">La desviación está prohibida</div>
              <textarea
                className="min-h-[120px] w-full rounded-md border p-2 text-sm"
                placeholder="Por ejemplo: no seas extraordinario, no tengas un flujo de actualización apasionado, no te divorcies de la lógica de la sociedad real."
                value={forbiddenText}
                onChange={(event) => onForbiddenTextChange(event.target.value)}
              />
            </div>
          </div>
        </div>
      ) : null}

      <textarea
        className="min-h-[180px] w-full rounded-md border p-2 text-sm"
        placeholder={
          isReferenceMode
            ? "Pegue fragmentos del trabajo original, resumen mundial o su comprensión del trabajo; También puedes utilizar el documento de la base de conocimientos anterior."
            : inspirationMode === "random"
              ? "Opcional: escribe sobre el tema que deseas evitar, tu atmósfera preferida o tu público objetivo."
              : "Describe en pocas palabras el temperamento, el escenario, el conflicto o la fuente de poder del mundo."
        }
        value={inspirationText}
        onChange={(event) => onInspirationTextChange(event.target.value)}
      />

      <div className="rounded-md border p-3 text-sm space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="font-medium">Generar preferencias</div>
            <div className="mt-1 text-xs text-muted-foreground">
              De forma predeterminada, se proporcionan 6 atributos mundiales estándar y, por lo general, no es necesario ajustarlos.
            </div>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={() => setPreferencesOpen((value) => !value)}>
            {preferencesOpen ? "Contraer preferencias" : "Ajustar preferencias"}
          </Button>
        </div>
        {preferencesOpen ? (
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <div className="font-medium">Nivel de refinamiento de atributos</div>
              <SelectControl
                className="w-full rounded-md border bg-background p-2 text-sm"
                value={optionRefinementLevel}
                onChange={(event) => onOptionRefinementLevelChange(event.target.value as WorldOptionRefinementLevel)}
              >
                <option value="basic">Base</option>
                <option value="standard">Estándar</option>
                <option value="detailed">Detallado</option>
              </SelectControl>
            </div>
            <div className="space-y-2">
              <div className="font-medium">Número de atributos mundiales</div>
              <input
                className="w-full rounded-md border p-2 text-sm"
                type="number"
                min={4}
                max={8}
                value={optionsCount}
                onChange={(event) => onOptionsCountChange(Number(event.target.value) || 6)}
              />
            </div>
          </div>
        ) : null}
      </div>

      <Button onClick={onAnalyze} disabled={!canAnalyze}>
        {analyzeButtonLabel}
      </Button>

      {analyzeStreaming ? (
        <div className="rounded-md border p-3 text-sm space-y-1">
          <div className="font-medium">Progreso actual</div>
          <div>{analyzeProgressMessage ?? "Iniciando análisis..."}</div>
          <div className="text-xs text-muted-foreground">
            {isReferenceMode
              ? "Este paso se realizará en secuencia: clasificar los materiales de referencia, extraer los puntos de anclaje del mundo original y generar decisiones de transformación generales."
              : "Este paso se realizará en secuencia: organizar los aportes de inspiración, generar tarjetas conceptuales y generar opciones de atributos previos."}
          </div>
        </div>
      ) : null}

      {inspirationSourceMeta?.extracted ? (
        <div className="text-xs text-muted-foreground">
          Extraído automáticamente en secciones: texto original {inspirationSourceMeta.originalLength} personajes, segmentación {inspirationSourceMeta.chunkCount} parte.
        </div>
      ) : null}

      {concept ? (
        <div className="rounded-md border p-3 text-sm space-y-2">
          <div className="font-medium">{isReferenceMode ? "Resumen del análisis de referencia" : "Tarjeta conceptual"}</div>
          <div>Tipo:{concept.worldType}</div>
          <div>Fundamental:{concept.tone}</div>
          <div>Palabras clave:{concept.keywords.join(" / ") || "-"}</div>
          <div>Opciones previas a la propiedad:{propertyOptionsCount}</div>
          {isReferenceMode && referenceAnchors.length > 0 ? (
            <div className="space-y-1">
              <div className="text-xs font-medium text-muted-foreground">Ancla mundial original</div>
              {referenceAnchors.map((anchor) => (
                <div key={anchor.id} className="text-xs text-muted-foreground">
                  {anchor.label}:{anchor.content}
                </div>
              ))}
            </div>
          ) : null}
          <div className="whitespace-pre-wrap">{concept.summary}</div>
        </div>
      ) : null}
    </div>
  );
}
