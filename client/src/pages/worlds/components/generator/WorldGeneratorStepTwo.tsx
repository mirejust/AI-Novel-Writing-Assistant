import type {
  WorldSkeletonGenerationCounts,
  WorldSkeletonPreset,
} from "@ai-novel/shared/types/worldWizard";
import {
  WORLD_SKELETON_COUNT_LIMITS,
  WORLD_SKELETON_PRESET_COUNTS,
} from "@ai-novel/shared/types/worldWizard";
import { Button } from "@/components/ui/button";

const PRESET_CARDS: Array<{
  value: WorldSkeletonPreset;
  title: string;
  description: string;
}> = [
  {
    value: "light",
    title: "Escenario ligero",
    description: "Adecuado para historias cortas, de una sola línea principal, de baja complejidad, primero obtenga una etapa de la historia clara y fácil de escribir.",
  },
  {
    value: "standard",
    title: "Novela estándar",
    description: "Adecuado para la mayoría de los artículos web extensos, se generan de forma predeterminada reglas, fuerzas, ubicaciones y entradas de apertura suficientes.",
  },
  {
    value: "epic",
    title: "Retrato de grupo complejo",
    description: "Adecuado para conflictos de múltiples poderes, múltiples ubicaciones y múltiples líneas, que requieren mapas y relaciones más sólidas.",
  },
];

const COUNT_LABELS: Record<keyof WorldSkeletonGenerationCounts, string> = {
  rules: "Reglas esenciales",
  factionGroups: "Dirección del campamento",
  forces: "Fuerzas específicas",
  locations: "Ubicaciones clave",
  conflicts: "Relación/conflicto",
  storyEntrySuggestions: "Entrada de la historia",
};

interface WorldGeneratorStepTwoProps {
  preset: WorldSkeletonPreset;
  counts: WorldSkeletonGenerationCounts;
  generating: boolean;
  onPresetChange: (preset: WorldSkeletonPreset) => void;
  onCountChange: (key: keyof WorldSkeletonGenerationCounts, value: number) => void;
  onGenerateSkeleton: () => void;
}

export default function WorldGeneratorStepTwo(props: WorldGeneratorStepTwoProps) {
  const {
    preset,
    counts,
    generating,
    onPresetChange,
    onCountChange,
    onGenerateSkeleton,
  } = props;

  return (
    <div className="space-y-4">
      <div className="rounded-md border bg-background p-4">
        <div className="text-sm font-medium">Elige el tamaño mundial</div>
        <div className="mt-1 text-xs text-muted-foreground">
          La escala determinará cuántas reglas, facciones, fuerzas específicas, ubicaciones clave y entradas de libros que se pueden abrir genera la IA. De forma predeterminada se recomienda "Estándar largo".
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        {PRESET_CARDS.map((item) => (
          <button
            key={item.value}
            type="button"
            className={`rounded-md border p-4 text-left transition ${
              preset === item.value ? "border-primary bg-primary/5" : "bg-background hover:border-primary/60"
            }`}
            onClick={() => onPresetChange(item.value)}
          >
            <div className="text-sm font-semibold">{item.title}</div>
            <div className="mt-2 text-xs leading-5 text-muted-foreground">{item.description}</div>
            <div className="mt-3 grid grid-cols-2 gap-1 text-xs text-muted-foreground">
              <span>poder {WORLD_SKELETON_PRESET_COUNTS[item.value].forces}</span>
              <span>ubicación {WORLD_SKELETON_PRESET_COUNTS[item.value].locations}</span>
              <span>conflicto {WORLD_SKELETON_PRESET_COUNTS[item.value].conflicts}</span>
              <span>Entrada {WORLD_SKELETON_PRESET_COUNTS[item.value].storyEntrySuggestions}</span>
            </div>
          </button>
        ))}
      </div>

      <div className="rounded-md border p-4">
        <div className="text-sm font-medium">Ajustar cantidad</div>
        <div className="mt-1 text-xs text-muted-foreground">
          Se recomienda a los principiantes que mantengan el valor predeterminado; Ajústelo solo si claramente desea un mundo más pequeño o más grande.
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {(Object.keys(COUNT_LABELS) as Array<keyof WorldSkeletonGenerationCounts>).map((key) => {
            const limit = WORLD_SKELETON_COUNT_LIMITS[key];
            return (
              <label key={key} className="rounded-md border p-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-medium">{COUNT_LABELS[key]}</span>
                  <span className="text-xs text-muted-foreground">{counts[key]}</span>
                </div>
                <input
                  className="mt-3 w-full"
                  type="range"
                  min={limit.min}
                  max={limit.max}
                  step={1}
                  value={counts[key]}
                  onChange={(event) => onCountChange(key, Number(event.target.value))}
                />
              </label>
            );
          })}
        </div>
      </div>

      <Button onClick={onGenerateSkeleton} disabled={generating}>
        {generating ? "Generando esqueleto mundial..." : "Generar esqueleto mundial"}
      </Button>
    </div>
  );
}
