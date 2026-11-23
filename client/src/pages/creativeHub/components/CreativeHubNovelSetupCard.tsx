import type { CreativeHubNovelSetupStatus } from "@ai-novel/shared/types/creativeHub";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface CreativeHubNovelSetupCardProps {
  setup: CreativeHubNovelSetupStatus;
  actionDisabled?: boolean;
  onQuickAction?: (prompt: string) => void;
}

function stageLabel(stage: CreativeHubNovelSetupStatus["stage"]): string {
  switch (stage) {
    case "ready_for_production":
      return "Puede entrar en producción";
    case "ready_for_planning":
      return "Puede entrar en planificación";
    default:
      return "Inicializando";
  }
}

function itemTone(status: "missing" | "partial" | "ready"): string {
  switch (status) {
    case "ready":
      return "border-success/30 bg-success/5 text-success";
    case "partial":
      return "border-warning/30 bg-warning/5 text-warning";
    default:
      return "border-border bg-muted/20 text-muted-foreground";
  }
}

export default function CreativeHubNovelSetupCard({
  setup,
  actionDisabled = false,
  onQuickAction,
}: CreativeHubNovelSetupCardProps) {
  const pendingItems = setup.checklist.filter((item) => item.status !== "ready");

  return (
    <div className="space-y-3">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="text-xs font-medium text-muted-foreground">Información de apertura del libro</div>
        <Badge variant="outline">{stageLabel(setup.stage)}</Badge>
      </div>

      <div className="rounded-md border border-border bg-muted/20 p-3">
        <div className="flex items-end justify-between gap-3">
          <div>
            <div className="text-sm font-medium text-foreground">{setup.title}</div>
            <div className="mt-1 text-xs text-muted-foreground">
              Listo {setup.completedCount}/{setup.totalCount} artículo
            </div>
          </div>
          <div className="text-right">
            <div className="text-lg font-semibold text-foreground">{setup.completionRatio}%</div>
            <div className="text-[11px] text-muted-foreground">Integridad</div>
          </div>
        </div>
        <div
          className="mt-3 h-2 overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-label="Integridad de la información de apertura del libro."
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={setup.completionRatio}
          aria-valuetext={`Información de apertura del libro completada. ${setup.completionRatio}%`}
        >
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${setup.completionRatio}%` }}
          />
        </div>
      </div>

      <div className="mt-3 grid gap-2">
        {setup.checklist.map((item) => (
          <div
            key={item.key}
            className={cn("rounded-md border px-3 py-2", itemTone(item.status))}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="text-sm font-medium">{item.label}</div>
              <div className="flex items-center gap-2 text-[11px]">
                {item.requiredForProduction ? (
                  <span className="rounded-md border border-current/20 bg-background/70 px-2 py-0.5">
                    Confirmar antes de la producción.
                  </span>
                ) : null}
                <span>
                  {item.status === "ready" ? "Listo" : item.status === "partial" ? "Pendiente" : "Desaparecido"}
                </span>
              </div>
            </div>
            {item.currentValue ? (
              <div className="mt-1 text-[11px] text-muted-foreground">Actual:{item.currentValue}</div>
            ) : null}
            <div className="mt-1 text-xs leading-5">{item.summary}</div>
            {item.status !== "ready" && (item.recommendedAction || item.optionPrompt) ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {item.recommendedAction ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={actionDisabled}
                    onClick={() => onQuickAction?.(item.recommendedAction!)}
                  >
                    compensar esto
                  </Button>
                ) : null}
                {item.optionPrompt ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={actionDisabled}
                    onClick={() => onQuickAction?.(item.optionPrompt!)}
                  >
                    Dame alternativas
                  </Button>
                ) : null}
              </div>
            ) : null}
          </div>
        ))}
      </div>

      {pendingItems.length > 0 ? (
        <div className="rounded-md border border-warning/30 bg-warning/5 p-3">
          <div className="text-xs font-medium text-warning">Por confirmar antes de la producción.</div>
          <div className="mt-2 text-sm leading-6 text-foreground">
            {pendingItems.slice(0, 4).map((item) => item.label).join(",")}
            {pendingItems.length > 4 ? " espera" : ""}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              disabled={actionDisabled}
              onClick={() => onQuickAction?.("Resuma las condiciones que aún deben confirmarse antes de que la novela actual entre en plena producción y dé el orden de finalización según la prioridad.")}
            >
              Generar lista de verificación de confirmación
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={actionDisabled}
              onClick={() => onQuickAction?.("Con base en la nueva información actual, se dan 3 respuestas alternativas para cada una de las condiciones clave que faltan antes de la producción, para que pueda elegir una por una.")}
            >
              Dame opciones en lotes
            </Button>
          </div>
        </div>
      ) : null}

      <div className="rounded-md border border-info/30 bg-info/5 p-3">
        <div className="text-xs font-medium text-info">Siguiente mensaje</div>
        <div className="mt-2 text-sm leading-6 text-foreground">{setup.nextQuestion}</div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          disabled={actionDisabled}
          onClick={() => onQuickAction?.(setup.recommendedAction)}
        >
          Siga las instrucciones para continuar
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={actionDisabled}
          onClick={() => onQuickAction?.("Resuma la finalización inicial de este libro y dígame qué información clave falta.")}
        >
          Ver resumen de inicialización
        </Button>
      </div>
    </div>
  );
}
