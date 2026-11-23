import { useMemo, useState } from "react";
import type { WorldConsistencyIssue, WorldConsistencyReport } from "@ai-novel/shared/types/world";
import { Button } from "@/components/ui/button";
import {
  localizeConsistencyField,
  localizeConsistencyIssueDetail,
  localizeConsistencyIssueMessage,
  localizeConsistencyIssueTitle,
  localizeConsistencySeverity,
  localizeConsistencySource,
  localizeConsistencyStatus,
} from "../../worldConsistencyUi";

interface WorldConsistencyTabProps {
  report: WorldConsistencyReport | null;
  issues: WorldConsistencyIssue[];
  checkPending: boolean;
  onCheck: () => void;
  onPatchIssue: (payload: { issueId: string; status: "open" | "resolved" | "ignored" }) => void;
}

export default function WorldConsistencyTab(props: WorldConsistencyTabProps) {
  const { report, issues, checkPending, onCheck, onPatchIssue } = props;
  const [activeIssueId, setActiveIssueId] = useState<string | null>(null);
  const openIssues = useMemo(() => issues.filter((issue) => issue.status === "open"), [issues]);
  const activeIssue = useMemo(() => {
    if (issues.length === 0) {
      return null;
    }
    return issues.find((issue) => issue.id === activeIssueId)
      ?? openIssues[0]
      ?? issues[0];
  }, [activeIssueId, issues, openIssues]);
  const errorCount = issues.filter((issue) => issue.severity === "error").length;
  const warnCount = issues.filter((issue) => issue.severity === "warn").length;
  const resolvedCount = issues.filter((issue) => issue.status === "resolved").length;
  const ignoredCount = issues.filter((issue) => issue.status === "ignored").length;

  return (
    <section className="space-y-6">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Comprueba la coherencia mundial</h2>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">Confirme que las reglas, las señales de género, los sistemas de poder y las fuentes de conflicto trabajan juntos para respaldar la misma historia.</p>
        </div>

        <div className="flex flex-col gap-4 rounded-3xl bg-primary/[0.055] p-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="font-medium">Deje que la IA lea el manual mundial completo</div>
            <div className="mt-1 text-xs leading-5 text-muted-foreground">
              Cuando se descubre que las configuraciones entran en conflicto entre sí o no pueden respaldar la trama, se darán problemas que se pueden resolver uno por uno.
            </div>
          </div>
          <Button className="shrink-0 rounded-full" onClick={onCheck} disabled={checkPending}>
            {checkPending ? "Comprobando..." : "Ejecutar chequeo físico manual"}
          </Button>
        </div>

        {report ? (
          <div className="rounded-3xl border border-border/35 bg-card/70 p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="text-lg font-semibold">{localizeConsistencyStatus(report.status)}</div>
                <div className="mt-1 text-sm leading-6 text-muted-foreground">{report.summary}</div>
              </div>
              <div className="shrink-0 text-left sm:text-right">
                <div className="text-2xl font-semibold tabular-nums">{report.score}</div>
                <div className="text-xs text-muted-foreground">Puntuación de consistencia</div>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 border-t border-border/30 pt-4 text-sm text-muted-foreground">
              <span><strong className="font-semibold tabular-nums text-foreground">{openIssues.length}</strong> Artículos pendientes</span>
              <span><strong className="font-semibold tabular-nums text-foreground">{errorCount}</strong> Artículo serio</span>
              <span><strong className="font-semibold tabular-nums text-foreground">{warnCount}</strong> Recordatorio de artículo</span>
              <span><strong className="font-semibold tabular-nums text-foreground">{resolvedCount + ignoredCount}</strong> Artículo procesado</span>
              <span className="text-xs">{report.generatedAt ? new Date(report.generatedAt).toLocaleString() : "Hora de verificación desconocida"}</span>
            </div>
          </div>
        ) : (
          <div className="flex min-h-44 flex-col items-center justify-center rounded-3xl bg-muted/20 px-6 text-center">
            <div className="font-medium">Aún no hay resultados de la verificación de coherencia</div>
            <div className="mt-1 text-sm text-muted-foreground">Después de ejecutar la verificación, aquí se muestran el veredicto general y los problemas que deben abordarse.</div>
          </div>
        )}

        {issues.length > 0 ? (
          <div className="grid gap-4 lg:grid-cols-[270px_minmax(0,1fr)]">
            <div className="space-y-2 rounded-3xl bg-muted/20 p-3">
              <div className="px-2 py-1 text-sm font-medium">Lista de preguntas</div>
              {issues.map((issue) => {
                const selected = activeIssue?.id === issue.id;
                return (
                  <button
                    key={issue.id}
                    type="button"
                    className={[
                      "w-full rounded-2xl px-3 py-2.5 text-left text-sm transition-colors",
                      selected ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:bg-background/60",
                    ].join(" ")}
                    onClick={() => setActiveIssueId(issue.id)}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-foreground">
                        {localizeConsistencyIssueTitle(issue.code)}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {localizeConsistencyStatus(issue.status)}
                      </span>
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {localizeConsistencySeverity(issue.severity)} · {localizeConsistencyField(issue.targetField)}
                    </div>
                  </button>
                );
              })}
            </div>

            {activeIssue ? (
              <div className="space-y-4 rounded-3xl border border-border/35 bg-card/70 p-5">
                <div>
                  <div className="font-medium">
                    [{localizeConsistencySeverity(activeIssue.severity)}] {localizeConsistencyIssueTitle(activeIssue.code)}
                  </div>
                  <div className="mt-2 text-sm">{localizeConsistencyIssueMessage(activeIssue)}</div>
                </div>
                <div className="rounded-2xl bg-muted/20 p-4 text-sm leading-6 text-muted-foreground">
                  {localizeConsistencyIssueDetail(activeIssue) ?? "Este riesgo puede revisarse en conjunto con el Manual Mundial."}
                </div>
                <div className="grid gap-2 md:grid-cols-3">
                  <div className="rounded-2xl bg-muted/20 p-3 text-xs">
                    <div className="text-muted-foreground">Comprobar la fuente</div>
                    <div className="mt-1 font-medium text-foreground">{localizeConsistencySource(activeIssue.source)}</div>
                  </div>
                  <div className="rounded-2xl bg-muted/20 p-3 text-xs">
                    <div className="text-muted-foreground">Afectar el contenido</div>
                    <div className="mt-1 font-medium text-foreground">{localizeConsistencyField(activeIssue.targetField)}</div>
                  </div>
                  <div className="rounded-2xl bg-muted/20 p-3 text-xs">
                    <div className="text-muted-foreground">Estado de procesamiento</div>
                    <div className="mt-1 font-medium text-foreground">{localizeConsistencyStatus(activeIssue.status)}</div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    className="rounded-full"
                    onClick={() => onPatchIssue({ issueId: activeIssue.id, status: "resolved" })}
                    disabled={activeIssue.status === "resolved"}
                  >
                    Bandera resuelta
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="rounded-full"
                    onClick={() => onPatchIssue({ issueId: activeIssue.id, status: "ignored" })}
                    disabled={activeIssue.status === "ignored"}
                  >
                    descuido
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
        ) : (
          report ? <div className="rounded-2xl bg-success/[0.055] px-4 py-3 text-sm text-muted-foreground">No hay problemas de coherencia que deban abordarse caso por caso.</div> : null
        )}
    </section>
  );
}
