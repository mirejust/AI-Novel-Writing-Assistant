import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type {
  PayoffLedgerItem,
  PayoffLedgerResponse,
  StoryStateSnapshot,
} from "@ai-novel/shared/types/novel";
import CollapsibleSummary from "./CollapsibleSummary";

interface BookPayoffLedgerCardProps {
  latestStateSnapshot?: StoryStateSnapshot | null;
  payoffLedger?: PayoffLedgerResponse | null;
}

function payoffStatusLabel(status: string): string {
  switch (status) {
    case "setup":
      return "Enterrado";
    case "hinted":
      return "Ya se le solicitó";
    case "pending_payoff":
      return "para ser reciclado";
    case "paid_off":
      return "Reciclado";
    case "failed":
      return "Venció";
    case "overdue":
      return "Vencido";
    default:
      return status || "Desconocido";
  }
}

function payoffStatusVariant(status: string): "default" | "secondary" | "outline" {
  switch (status) {
    case "paid_off":
      return "default";
    case "failed":
      return "secondary";
    default:
      return "outline";
  }
}

function payoffStatusTone(status: string): string {
  if (status === "overdue") {
    return "border-amber-300 bg-amber-50 text-amber-900";
  }
  if (status === "paid_off") {
    return "border-emerald-300 bg-emerald-50 text-emerald-900";
  }
  if (status === "failed") {
    return "border-slate-300 bg-slate-100 text-slate-700";
  }
  return "";
}

function formatWindow(item: PayoffLedgerItem): string {
  if (
    typeof item.targetStartChapterOrder === "number"
    && typeof item.targetEndChapterOrder === "number"
  ) {
    return `Cap. ${item.targetStartChapterOrder}-${item.targetEndChapterOrder}`;
  }
  if (typeof item.targetEndChapterOrder === "number") {
    return `el último ${item.targetEndChapterOrder}`;
  }
  if (typeof item.targetStartChapterOrder === "number") {
    return `desde el primero ${item.targetStartChapterOrder} Comienza el capítulo`;
  }
  return "Ilimitado";
}

function scopeLabel(scopeType: PayoffLedgerItem["scopeType"]): string {
  if (scopeType === "book") {
    return "Libro completo";
  }
  if (scopeType === "volume") {
    return "Nivel de volumen";
  }
  return "Capítulos";
}

function sourceSummary(item: PayoffLedgerItem): string {
  const labels = item.sourceRefs
    .map((source) => source.refLabel?.trim())
    .filter(Boolean)
    .slice(0, 3);
  return labels.length > 0 ? labels.join(" / ") : "Aún no hay resumen de fuente";
}

export default function BookPayoffLedgerCard(props: BookPayoffLedgerCardProps) {
  const { latestStateSnapshot, payoffLedger } = props;
  const ledgerItems = payoffLedger?.items ?? [];
  const ledgerSummary = payoffLedger?.summary;
  const snapshotForeshadows = latestStateSnapshot?.foreshadowStates ?? [];
  const pendingForeshadows = snapshotForeshadows.filter(
    (item) => item.status !== "paid_off" && item.status !== "failed",
  );
  const paidOffForeshadows = snapshotForeshadows.filter((item) => item.status === "paid_off");
  const failedForeshadows = snapshotForeshadows.filter((item) => item.status === "failed");
  const hasCanonicalLedgerContent = ledgerItems.length > 0;
  const hasSnapshotContent = snapshotForeshadows.length > 0 || Boolean(latestStateSnapshot?.summary?.trim());

  return (
    <Card>
      <CardContent className="p-0">
        <details className="group">
          <summary className="cursor-pointer list-none p-5">
            <CollapsibleSummary
              title="Libro completo Libro de cuentas de presagios canónicos"
              description="Este es un libro de contabilidad de presagios canónicos a nivel de libro que no sigue el cambio de volumen actual. Está contraído de forma predeterminada y se puede expandir cuando necesite verificar toda la cadena de presagio o la presión de recuperación general."
              collapsedLabel="Ampliar el libro mayor completo"
              expandedLabel="Cerrar todo el libro mayor"
              meta={(
                <>
                  <Badge variant="outline">para ser cobrado {ledgerSummary?.pendingCount ?? 0}</Badge>
                  <Badge variant={ledgerSummary?.urgentCount ? "secondary" : "outline"}>
                    urgente {ledgerSummary?.urgentCount ?? 0}
                  </Badge>
                  <Badge variant={ledgerSummary?.overdueCount ? "secondary" : "outline"}>
                    Atrasado {ledgerSummary?.overdueCount ?? 0}
                  </Badge>
                  <Badge variant="outline">Reciclado {ledgerSummary?.paidOffCount ?? 0}</Badge>
                </>
              )}
            />
          </summary>

          <div className="space-y-3 border-t border-border/70 px-5 pb-5 pt-4">
            <div className="rounded-xl border border-border/70 bg-muted/20 p-4">
              <div className="flex items-center justify-between gap-2">
                <div className="font-medium text-foreground">Libro mayor de presagios canónicos</div>
                <Badge variant="outline">{ledgerItems.length}</Badge>
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                La planificación, redacción, revisión y reparación posteriores priorizan el consumo de los resultados canónicos aquí en lugar de centrarse únicamente en un determinado campo original.
              </div>
              <div className="mt-3 space-y-2 text-sm">
                {hasCanonicalLedgerContent ? (
                  ledgerItems.map((item) => (
                    <div
                      key={item.id}
                      className="rounded-lg border border-border/70 bg-background p-3"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="font-medium text-foreground">{item.title}</div>
                        <Badge
                          variant={payoffStatusVariant(item.currentStatus)}
                          className={cn(payoffStatusTone(item.currentStatus))}
                        >
                          {payoffStatusLabel(item.currentStatus)}
                        </Badge>
                        <Badge variant="outline">{scopeLabel(item.scopeType)}</Badge>
                        <Badge variant="outline">{formatWindow(item)}</Badge>
                      </div>
                      <div className="mt-2 text-xs text-muted-foreground">{item.summary}</div>
                      <div className="mt-2 grid gap-2 text-xs text-muted-foreground sm:grid-cols-3">
                        <div>
                          Tocado recientemente:
                          {typeof item.lastTouchedChapterOrder === "number"
                            ? `Cap. ${item.lastTouchedChapterOrder}`
                            : "Sin datos"}
                        </div>
                        <div>Resumen de la fuente:{sourceSummary(item)}</div>
                        <div>
                          Señales de riesgo:
                          {item.riskSignals.length > 0
                            ? ` ${item.riskSignals
                              .slice(0, 2)
                              .map((signal) => signal.summary)
                              .join(";")}`
                            : " Ninguno todavía"}
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-lg border border-dashed border-border/70 bg-background p-3 text-xs text-muted-foreground">
                    Actualmente no existe ningún libro de contabilidad de presagios canónicos disponible. Al ingresar a un proyecto antiguo por primera vez, el sistema sincronizará lentamente este libro mayor; si todavía está vacío, significa que los materiales de planificación o estado relevantes no son suficientes.
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-xl border border-border/70 bg-muted/20 p-4">
              <div className="flex items-center justify-between gap-2">
                <div className="font-medium text-foreground">Instantánea del último estado del libro.</div>
                <Badge variant="outline">{snapshotForeshadows.length}</Badge>
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                Lo que se muestra aquí es el estado más reciente de todo el libro, no solo el volumen actual, y se utiliza para ayudar a juzgar la presión de reciclaje general.
              </div>
              {latestStateSnapshot?.summary ? (
                <div className="mt-3 rounded-lg border border-border/70 bg-background p-3 text-xs text-muted-foreground">
                  {latestStateSnapshot.summary}
                </div>
              ) : null}
              <div className="mt-3 space-y-3 text-sm">
                {hasSnapshotContent ? (
                  <>
                    <div className="space-y-2">
                      <div className="text-xs font-medium text-muted-foreground">Para ser seguido</div>
                      {pendingForeshadows.length > 0 ? (
                        pendingForeshadows.slice(0, 5).map((item) => (
                          <div
                            key={item.id}
                            className="rounded-lg border border-border/70 bg-background p-3"
                          >
                            <div className="flex flex-wrap items-center gap-2">
                              <div className="font-medium text-foreground">{item.title}</div>
                              <Badge variant={payoffStatusVariant(item.status)}>
                                {payoffStatusLabel(item.status)}
                              </Badge>
                            </div>
                            {item.summary ? (
                              <div className="mt-1 text-xs text-muted-foreground">{item.summary}</div>
                            ) : null}
                          </div>
                        ))
                      ) : (
                        <div className="rounded-lg border border-dashed border-border/70 bg-background p-3 text-xs text-muted-foreground">
                          Actualmente no hay estados presagios a los que dar seguimiento.
                        </div>
                      )}
                    </div>

                    <div className="grid gap-2 sm:grid-cols-2">
                      <div className="rounded-lg border border-border/70 bg-background p-3">
                        <div className="text-xs text-muted-foreground">Reciclado</div>
                        <div className="mt-1 text-lg font-semibold text-foreground">
                          {paidOffForeshadows.length}
                        </div>
                      </div>
                      <div className="rounded-lg border border-border/70 bg-background p-3">
                        <div className="text-xs text-muted-foreground">Venció</div>
                        <div className="mt-1 text-lg font-semibold text-foreground">
                          {failedForeshadows.length}
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="rounded-lg border border-dashed border-border/70 bg-background p-3 text-xs text-muted-foreground">
                    Aún no hay una instantánea del estado de presagio disponible. Después de realizar primero la generación de capítulos o la auditoría, el estado aquí se enriquecerá gradualmente.
                  </div>
                )}
              </div>
            </div>
          </div>
        </details>
      </CardContent>
    </Card>
  );
}
