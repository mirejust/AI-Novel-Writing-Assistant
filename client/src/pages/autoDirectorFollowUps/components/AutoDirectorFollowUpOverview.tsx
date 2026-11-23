import type { AutoDirectorFollowUpListResponse, AutoDirectorFollowUpOverview } from "@ai-novel/shared/types/autoDirectorFollowUp";
import type { AutoDirectorFollowUpSection } from "@ai-novel/shared/types/autoDirectorValidation";
import { TaskQueueSection } from "@/components/taskQueue";
import { workspaceToneSurfaceClass, type WorkspaceTone } from "@/components/workspace";
import { cn } from "@/lib/utils";
import { AUTO_DIRECTOR_MOBILE_CLASSES } from "@/mobile/autoDirector";

interface OverviewCardConfig {
  section: AutoDirectorFollowUpSection | "";
  label: string;
  description: string;
  count: number;
  tone: WorkspaceTone;
}

interface AutoDirectorFollowUpOverviewCardsProps {
  overview: AutoDirectorFollowUpOverview | null;
  list: AutoDirectorFollowUpListResponse | null;
  activeSection: AutoDirectorFollowUpSection | "";
  onSectionChange: (section: AutoDirectorFollowUpSection | "") => void;
}

export function AutoDirectorFollowUpOverviewCards({
  overview,
  list,
  activeSection,
  onSectionChange,
}: AutoDirectorFollowUpOverviewCardsProps) {
  const counters = list?.countersBySection ?? overview?.countersBySection;
  const reasonCounters = overview?.countersByReason ?? list?.countersByReason;
  const blockingExceptionCount = (reasonCounters?.manual_recovery_required ?? 0)
    + (reasonCounters?.runtime_failed ?? 0);
  const pendingIncludesReplan = (reasonCounters?.replan_required ?? 0) > 0;
  const cards: OverviewCardConfig[] = [
    {
      section: "",
      label: "Todo",
      description: "Ver todas las tareas de dirección que requieren seguimiento",
      count: overview?.totalCount ?? list?.pagination.total ?? 0,
      tone: "neutral",
    },
    {
      section: "needs_validation",
      label: "Necesito verificar",
      description: "Primero confirme si las tareas y los activos son consistentes.",
      count: counters?.needs_validation ?? 0,
      tone: "danger",
    },
    {
      section: "exception",
      label: "Excepción y recuperación",
      description: blockingExceptionCount > 0 ? "La falla o la recuperación manual deben abordarse primero" : "Los registros cancelados se pueden restaurar a pedido",
      count: counters?.exception ?? 0,
      tone: blockingExceptionCount > 0 ? "danger" : "neutral",
    },
    {
      section: "pending",
      label: "Pendiente",
      description: pendingIncludesReplan ? "Contiene replanificación que debe abordarse primero." : "Nodo que requiere confirmación o continuación",
      count: counters?.pending ?? 0,
      tone: pendingIncludesReplan ? "danger" : "info",
    },
    {
      section: "auto_progress",
      label: "Avance automático",
      description: "Tareas en curso y registros de pases automáticos recientes",
      count: counters?.auto_progress ?? 0,
      tone: "info",
    },
    {
      section: "replaced",
      label: "Reemplazado",
      description: "Tareas antiguas reemplazadas por tareas nuevas",
      count: counters?.replaced ?? 0,
      tone: "neutral",
    },
  ];

  return (
    <div className={AUTO_DIRECTOR_MOBILE_CLASSES.followUpOverviewGrid}>
      <TaskQueueSection
        title="Partición de seguimiento"
        description={`Restaurar hoy ${list?.summaryCounters.recoveredToday ?? 0} Artículo, completado hoy ${list?.summaryCounters.completedToday ?? 0} Artículo; el bloqueo, la operación pendiente y el avance automático se manejan por separado.`}
        className={AUTO_DIRECTOR_MOBILE_CLASSES.followUpOverviewCard}
      >
          <div className={AUTO_DIRECTOR_MOBILE_CLASSES.followUpOverviewSectionGrid}>
            {cards.map((card) => (
              <button
                key={card.section || "all"}
                type="button"
                aria-pressed={activeSection === card.section}
                onClick={() => onSectionChange(card.section)}
                className={cn(
                  "h-full min-w-0 rounded-md border p-3 text-left transition hover:border-primary/50",
                  workspaceToneSurfaceClass[card.tone],
                  activeSection === card.section && "border-primary bg-primary/5",
                )}
              >
                <div className="text-sm font-medium">{card.label}</div>
                <div className="mt-1 text-xl font-semibold leading-none">{card.count}</div>
                <div className={`mt-1 text-xs text-muted-foreground ${AUTO_DIRECTOR_MOBILE_CLASSES.wrapText}`}>
                  {card.description}
                </div>
              </button>
            ))}
          </div>
      </TaskQueueSection>
    </div>
  );
}
