import type {
  DirectorAutoExecutionMode,
  DirectorAutoExecutionPlan,
  DirectorTakeoverExecutableRangeSnapshot,
  DirectorTakeoverStrategy,
} from "@ai-novel/shared/types/novelDirector";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { AUTO_DIRECTOR_MOBILE_CLASSES } from "@/mobile/autoDirector";

export interface DirectorAutoExecutionDraftState {
  mode: DirectorAutoExecutionMode;
  startOrder: string;
  endOrder: string;
  volumeOrder: string;
  autoReview: boolean;
  autoRepair: boolean;
}

const DEFAULT_DIRECTOR_AUTO_EXECUTION_DRAFT: DirectorAutoExecutionDraftState = {
  mode: "chapter_range",
  startOrder: "1",
  endOrder: "10",
  volumeOrder: "1",
  autoReview: true,
  autoRepair: true,
};

type DirectorAutoExecutionPlanUsage = "new_book" | "takeover";

const NEW_BOOK_SCOPE_OPTIONS: Array<{
  value: DirectorAutoExecutionMode;
  label: string;
  description: string;
}> = [
  {
    value: "book",
    label: "Libro completo",
    description: "Es adecuado permitir que la IA cubra directamente todo el libro, desde la planificación hasta la ejecución del texto.",
  },
  {
    value: "chapter_range",
    label: "Capítulo 1-N",
    description: "Es conveniente ejecutar primero los capítulos de muestra iniciales. Los capítulos predeterminados son del 1 al 10, que se pueden ajustar según la cantidad de capítulos de todo el libro.",
  },
  {
    value: "volume",
    label: "Volumen 1",
    description: "Es adecuado dejar que AI complete el desembalaje, redacción, revisión y reparación del primer volumen.",
  },
];

const TAKEOVER_SCOPE_OPTIONS: Array<{
  value: DirectorAutoExecutionMode;
  label: string;
  description: string;
}> = [
  {
    value: "book",
    label: "Libro completo",
    description: "Es adecuado que la IA vuelva a verificar todo el plan y continúe con la ejecución de acuerdo con el alcance de todo el libro.",
  },
  {
    value: "chapter_range",
    label: "Alcance del capítulo",
    description: "Es adecuado dejar que la IA solo se haga cargo de una determinada sección, como los Capítulos 11-20.",
  },
  {
    value: "volume",
    label: "Rango de volumen",
    description: "Es adecuado que la IA se haga cargo del volumen especificado y de los siguientes capítulos.",
  },
];

function normalizePositiveInteger(value: string | number | undefined, fallback: number): number {
  const numericValue = typeof value === "number" ? value : Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(numericValue) || numericValue < 1) {
    return fallback;
  }
  return Math.max(1, Math.round(numericValue));
}

function clampChapterOrder(value: number, maxChapterCount?: number | null): number {
  if (!maxChapterCount || maxChapterCount < 1) {
    return Math.max(1, value);
  }
  return Math.min(Math.max(1, value), Math.max(1, Math.round(maxChapterCount)));
}

export function createDefaultDirectorAutoExecutionDraftState(
  usage: DirectorAutoExecutionPlanUsage = "new_book",
): DirectorAutoExecutionDraftState {
  return {
    ...DEFAULT_DIRECTOR_AUTO_EXECUTION_DRAFT,
    mode: usage === "takeover" ? "book" : DEFAULT_DIRECTOR_AUTO_EXECUTION_DRAFT.mode,
  };
}

export function normalizeDirectorAutoExecutionDraftState(
  plan: DirectorAutoExecutionPlan | null | undefined,
): DirectorAutoExecutionDraftState {
  if (plan?.mode === "book") {
    return {
      mode: "book",
      startOrder: DEFAULT_DIRECTOR_AUTO_EXECUTION_DRAFT.startOrder,
      endOrder: DEFAULT_DIRECTOR_AUTO_EXECUTION_DRAFT.endOrder,
      volumeOrder: DEFAULT_DIRECTOR_AUTO_EXECUTION_DRAFT.volumeOrder,
      autoReview: plan.autoReview ?? true,
      autoRepair: plan.autoReview === false ? false : (plan.autoRepair ?? true),
    };
  }
  if (plan?.mode === "chapter_range") {
    const startOrder = normalizePositiveInteger(plan.startOrder, 1);
    const endOrder = normalizePositiveInteger(plan.endOrder, Math.max(startOrder, 10));
    return {
      mode: "chapter_range",
      startOrder: String(startOrder),
      endOrder: String(Math.max(startOrder, endOrder)),
      volumeOrder: DEFAULT_DIRECTOR_AUTO_EXECUTION_DRAFT.volumeOrder,
      autoReview: plan.autoReview ?? true,
      autoRepair: plan.autoReview === false ? false : (plan.autoRepair ?? true),
    };
  }
  if (plan?.mode === "volume") {
    return {
      mode: "volume",
      startOrder: DEFAULT_DIRECTOR_AUTO_EXECUTION_DRAFT.startOrder,
      endOrder: DEFAULT_DIRECTOR_AUTO_EXECUTION_DRAFT.endOrder,
      volumeOrder: String(normalizePositiveInteger(plan.volumeOrder, 1)),
      autoReview: plan.autoReview ?? true,
      autoRepair: plan.autoReview === false ? false : (plan.autoRepair ?? true),
    };
  }
  return {
    ...createDefaultDirectorAutoExecutionDraftState(),
    endOrder: String(normalizePositiveInteger(plan?.endOrder, 10)),
    autoReview: plan?.autoReview ?? true,
    autoRepair: plan?.autoReview === false ? false : (plan?.autoRepair ?? true),
  };
}

export function buildDirectorAutoExecutionPlanFromDraft(
  draft: DirectorAutoExecutionDraftState,
  options?: {
    usage?: DirectorAutoExecutionPlanUsage;
    maxChapterCount?: number | null;
  },
): DirectorAutoExecutionPlan {
  if (draft.mode === "book") {
    return {
      mode: "book",
      autoReview: draft.autoReview,
      autoRepair: draft.autoReview ? draft.autoRepair : false,
    };
  }
  if (draft.mode === "chapter_range") {
    const startOrder = clampChapterOrder(normalizePositiveInteger(draft.startOrder, 1), options?.maxChapterCount);
    const endOrder = Math.max(
      startOrder,
      clampChapterOrder(normalizePositiveInteger(draft.endOrder, 10), options?.maxChapterCount),
    );
    return {
      mode: "chapter_range",
      startOrder,
      endOrder,
      autoReview: draft.autoReview,
      autoRepair: draft.autoReview ? draft.autoRepair : false,
    };
  }
  if (draft.mode === "volume") {
    return {
      mode: "volume",
      volumeOrder: options?.usage === "new_book" ? 1 : normalizePositiveInteger(draft.volumeOrder, 1),
      autoReview: draft.autoReview,
      autoRepair: draft.autoReview ? draft.autoRepair : false,
    };
  }
  const endOrder = clampChapterOrder(normalizePositiveInteger(draft.endOrder, 10), options?.maxChapterCount);
  return {
    mode: "chapter_range",
    startOrder: 1,
    endOrder,
    autoReview: draft.autoReview,
    autoRepair: draft.autoReview ? draft.autoRepair : false,
  };
}

export function buildDirectorAutoExecutionPlanLabel(
  plan: DirectorAutoExecutionPlan | null | undefined,
): string {
  if (plan?.mode === "book") {
    return "Libro completo";
  }
  if (plan?.mode === "chapter_range") {
    const startOrder = normalizePositiveInteger(plan.startOrder, 1);
    const endOrder = Math.max(startOrder, normalizePositiveInteger(plan.endOrder, startOrder));
    if (startOrder === endOrder) {
      return `Cap. ${startOrder}`;
    }
    return `Cap. ${startOrder}-${endOrder}`;
  }
  if (plan?.mode === "volume") {
    return `Cap. ${normalizePositiveInteger(plan.volumeOrder, 1)} volumen`;
  }
  return `No. 1-${normalizePositiveInteger(plan?.endOrder, 10)}`;
}

export function buildTakeoverAutoExecutionDraftFromExecutableRange(
  executableRange: DirectorTakeoverExecutableRangeSnapshot | null | undefined,
  strategy: DirectorTakeoverStrategy = "continue_existing",
): DirectorAutoExecutionDraftState | null {
  if (!executableRange) {
    return null;
  }
  const preferredStartOrder = strategy === "continue_existing"
    ? executableRange.nextChapterOrder ?? executableRange.startOrder
    : executableRange.startOrder;
  const startOrder = Math.max(1, Math.round(preferredStartOrder));
  const endOrder = Math.max(startOrder, Math.round(executableRange.endOrder));
  return {
    ...createDefaultDirectorAutoExecutionDraftState("takeover"),
    mode: "chapter_range",
    startOrder: String(startOrder),
    endOrder: String(endOrder),
  };
}

interface DirectorAutoExecutionPlanFieldsProps {
  draft: DirectorAutoExecutionDraftState;
  onChange: (patch: Partial<DirectorAutoExecutionDraftState>) => void;
  usage?: DirectorAutoExecutionPlanUsage;
  maxChapterCount?: number | null;
}

export function DirectorAutoExecutionPlanFields({
  draft,
  onChange,
  usage = "new_book",
  maxChapterCount,
}: DirectorAutoExecutionPlanFieldsProps) {
  const plan = buildDirectorAutoExecutionPlanFromDraft(draft, { usage, maxChapterCount });
  const scopeLabel = buildDirectorAutoExecutionPlanLabel(plan);
  const scopeOptions = usage === "takeover" ? TAKEOVER_SCOPE_OPTIONS : NEW_BOOK_SCOPE_OPTIONS;
  const canEditChapterCount = usage === "new_book" && draft.mode === "chapter_range";
  const canEditChapterRange = usage === "takeover" && draft.mode === "chapter_range";
  const canEditVolumeOrder = usage === "takeover" && draft.mode === "volume";
  const reviewLabel = draft.autoReview
    ? draft.autoRepair
      ? "Revisión automática + reparación automática después del texto."
      : "Revisión automática después del texto principal, sin reparación automática"
    : "No se realizará ninguna revisión ni reparación automática después del texto principal.";

  return (
    <div className="mt-3 min-w-0 rounded-md border border-primary/15 bg-primary/5 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-xs font-medium text-foreground">Alcance de ejecución automática</div>
        <div className={`text-xs text-muted-foreground ${AUTO_DIRECTOR_MOBILE_CLASSES.wrapText}`}>Actualmente ejecutará:{scopeLabel}</div>
      </div>

      <div className="mt-3 grid min-w-0 gap-3 sm:grid-cols-3">
        {scopeOptions.map((option) => {
          const active = option.value === draft.mode;
          return (
            <button
              key={option.value}
              type="button"
              className={`rounded-xl border px-3 py-3 text-left transition ${
                active
                  ? "border-primary bg-primary/10 shadow-sm"
                  : "border-border bg-background hover:border-primary/40"
              }`}
              onClick={() => onChange({ mode: option.value })}
            >
              <div className="text-sm font-medium text-foreground">{option.label}</div>
              <div className={`mt-1 text-xs leading-5 text-muted-foreground ${AUTO_DIRECTOR_MOBILE_CLASSES.wrapText}`}>{option.description}</div>
            </button>
          );
        })}
      </div>

      {canEditChapterCount ? (
        <div className="mt-4 max-w-xs">
          <div className="text-xs font-medium text-foreground">Número de capítulos</div>
          <Input
            className="mt-2"
            type="number"
            min={1}
            max={maxChapterCount ?? undefined}
            value={draft.endOrder}
            onChange={(event) => onChange({ endOrder: event.target.value })}
            placeholder="Por ejemplo 10"
          />
          {maxChapterCount ? (
            <div className="mt-1 text-xs text-muted-foreground">Como mucho, no más de lo previsto para todo el libro. {maxChapterCount} Capítulo.</div>
          ) : null}
        </div>
      ) : null}

      {canEditChapterRange ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div>
            <div className="text-xs font-medium text-foreground">Capítulo inicial</div>
            <Input
              className="mt-2"
              type="number"
              min={1}
              max={maxChapterCount ?? undefined}
              value={draft.startOrder}
              onChange={(event) => onChange({ startOrder: event.target.value })}
              placeholder="Por ejemplo 11"
            />
          </div>
          <div>
            <div className="text-xs font-medium text-foreground">Fin del capitulo</div>
            <Input
              className="mt-2"
              type="number"
              min={1}
              max={maxChapterCount ?? undefined}
              value={draft.endOrder}
              onChange={(event) => onChange({ endOrder: event.target.value })}
              placeholder="por ejemplo 20"
            />
          </div>
        </div>
      ) : null}

      {canEditVolumeOrder ? (
        <div className="mt-4 max-w-xs">
          <div className="text-xs font-medium text-foreground">Número de volumen</div>
          <Input
            className="mt-2"
            type="number"
            min={1}
            value={draft.volumeOrder}
            onChange={(event) => onChange({ volumeOrder: event.target.value })}
            placeholder="Ejemplo 2"
          />
        </div>
      ) : null}

      <div className="mt-4 rounded-xl border bg-background/80 p-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <div className="text-sm font-medium text-foreground">Revisar automáticamente el texto después de generarlo.</div>
            <div className={`text-xs leading-5 text-muted-foreground ${AUTO_DIRECTOR_MOBILE_CLASSES.wrapText}`}>
              Después del cierre, se completa la generación del texto y finaliza el capítulo actual, y la verificación de calidad queda a su cargo para que la maneje manualmente.
            </div>
          </div>
          <Switch
            checked={draft.autoReview}
            onCheckedChange={(checked) => onChange({
              autoReview: checked,
              autoRepair: checked ? draft.autoRepair : false,
            })}
            aria-label="Cambiar si se debe revisar automáticamente el texto después de generarlo"
          />
        </div>

        <div className="mt-4 flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <div className="text-sm font-medium text-foreground">Reparar automáticamente cuando falla la revisión</div>
            <div className={`text-xs leading-5 text-muted-foreground ${AUTO_DIRECTOR_MOBILE_CLASSES.wrapText}`}>
              Sólo entra en vigor después de activar la revisión automática; cuando se apaga, el problema se mantendrá, esperando que usted lo maneje manualmente o lo vuelva a ejecutar.
            </div>
          </div>
          <Switch
            checked={draft.autoReview && draft.autoRepair}
            disabled={!draft.autoReview}
            onCheckedChange={(checked) => onChange({ autoRepair: checked })}
            aria-label="Cambiar si se debe reparar automáticamente después de la auditoría"
          />
        </div>
      </div>

      <div className={`mt-3 text-xs leading-5 text-muted-foreground ${AUTO_DIRECTOR_MOBILE_CLASSES.wrapText}`}>
        El sistema preparará automáticamente los recursos del tablero de ritmo, división de capítulos y ejecución de capítulos de acuerdo con el rango que seleccionó, y luego continuará escribiendo. Estrategia de calidad actual:{reviewLabel}.
      </div>
    </div>
  );
}
