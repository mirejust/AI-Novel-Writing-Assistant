import { Check, Circle } from "lucide-react";
import { cn } from "@/lib/utils";
import OnboardingTip from "@/components/onboarding/OnboardingTip";

export type DirectorPreparationStepStatus = "pending" | "running" | "completed" | "failed";

interface DirectorPreparationStep {
  key: string;
  label: string;
}

interface NovelDirectorPreparationJourneyProps {
  steps: ReadonlyArray<DirectorPreparationStep>;
  statuses: ReadonlyArray<DirectorPreparationStepStatus>;
  onboardingStorageKey: string;
  chapterProgress?: {
    completed: number;
    total: number;
  } | null;
}

function stepTone(status: DirectorPreparationStepStatus): string {
  if (status === "completed") {
    return "border-emerald-500 bg-emerald-500 text-white";
  }
  if (status === "running") {
    return "border-primary bg-primary text-primary-foreground shadow-[0_0_0_5px_hsl(var(--primary)/0.10)]";
  }
  if (status === "failed") {
    return "border-destructive bg-destructive text-destructive-foreground";
  }
  return "border-border bg-background text-muted-foreground";
}

function connectorTone(
  current: DirectorPreparationStepStatus,
  next: DirectorPreparationStepStatus,
): string {
  return current === "completed" && (next === "completed" || next === "running")
    ? "bg-emerald-400/70"
    : "bg-border/70";
}

function statusLabel(status: DirectorPreparationStepStatus): string {
  if (status === "completed") return "Listo para completar";
  if (status === "running") return "La IA está procesando";
  if (status === "failed") return "Requiere atención";
  return "Esperando avance";
}

export default function NovelDirectorPreparationJourney({
  steps,
  statuses,
  onboardingStorageKey,
  chapterProgress = null,
}: NovelDirectorPreparationJourneyProps) {
  return (
    <div className="space-y-4">
      <OnboardingTip
        storageKey={onboardingStorageKey}
        title="Esta preparación no necesita ser revisada punto por punto."
        description="La IA convertirá la dirección completa de la historia en personajes, estrategias de volumen, ritmo y recursos de ejecución de capítulos; Los resultados de la página se pueden ampliar y ver en cualquier momento."
        next="Los recursos completos se pueden ver en cualquier momento; La IA continuará completando el contenido posterior."
      />
      <section className="rounded-2xl border border-border/70 bg-background px-4 py-5 shadow-[0_18px_45px_-38px_hsl(var(--foreground)/0.45)] sm:px-6">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="text-sm font-semibold text-foreground">Preparación de recursos de creación.</div>
            <div className="mt-1 text-xs leading-5 text-muted-foreground">
              La IA completa la dirección, los personajes y los recursos de los capítulos de todo el libro en secuencia, y los resultados completos se pueden ver directamente.
            </div>
          </div>
          <div className="text-xs text-muted-foreground">
            {chapterProgress
              ? `El texto ha sido generado. ${chapterProgress.completed}/${chapterProgress.total}`
              : "Las tareas de creación seguirán avanzando en segundo plano."}
          </div>
        </div>

        <ol className={cn(
          "mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4",
          steps.length > 6 ? "xl:grid-cols-7" : "xl:grid-cols-6",
        )}>
          {steps.map((step, index) => {
            const status = statuses[index] ?? "pending";
            const nextStatus = statuses[index + 1] ?? "pending";
            return (
              <li key={step.key} className="relative min-w-0">
                {index < steps.length - 1 ? (
                  <span
                    aria-hidden="true"
                    className={cn(
                      "absolute left-8 top-4 hidden h-px w-[calc(100%-1.25rem)] xl:block",
                      connectorTone(status, nextStatus),
                    )}
                  />
                ) : null}
                <div className="relative flex items-start gap-3 lg:block">
                  <span
                    className={cn(
                      "relative z-10 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-xs font-semibold transition",
                      stepTone(status),
                    )}
                  >
                    {status === "completed"
                      ? <Check className="h-4 w-4" />
                      : status === "pending"
                        ? <Circle className="h-3 w-3" />
                        : index + 1}
                  </span>
                  <div className="min-w-0 lg:mt-3">
                    <div className="truncate text-sm font-medium text-foreground">{step.label}</div>
                    <div className="mt-1 text-[11px] text-muted-foreground">{statusLabel(status)}</div>
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      </section>

    </div>
  );
}
