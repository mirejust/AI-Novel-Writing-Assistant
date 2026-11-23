import { isStyleIssueRewritable, type StyleDetectionReport, type StyleRewriteGuard } from "@ai-novel/shared/types/styleEngine";

const layerLabels = { surface: "Expresión de oración", discourse: "Cohesión del párrafo", narrative: "Sugerencias narrativas" };

export function StyleRiskReport({ report }: { report: StyleDetectionReport }) {
  return <section aria-label="Escribir resultados de cheques" className="space-y-4 text-sm">
    <div className="space-y-1">
      <div className="font-medium text-foreground">Puntos de referencia de riesgo expresos:{report.riskScore}</div>
      <p className="leading-6 text-muted-foreground">{report.summary}</p>
    </div>
    {report.violations.length ? <div className="divide-y divide-border/40">
      {report.violations.map((issue, index) => <article key={`${issue.ruleId}-${index}`} className="space-y-2 py-3">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <h4 className="font-medium text-foreground">{issue.ruleName}</h4>
          <span className="text-xs text-muted-foreground">{issue.layer ? layerLabels[issue.layer] : "Recordatorio de escritura"} · {isStyleIssueRewritable(issue) ? "Se puede revisar parcialmente" : "Solo sugerencias"}</span>
        </div>
        <p className="leading-6 text-muted-foreground">{issue.reason}</p>
        <blockquote className="whitespace-pre-wrap rounded-md bg-muted/30 px-3 py-2 leading-6 text-foreground">{issue.excerpt}</blockquote>
        <p className="leading-6 text-muted-foreground">Sugerencia:{issue.suggestion}</p>
        {issue.layer === "narrative" ? <p className="text-xs leading-5 text-muted-foreground">Deje que la IA planifique la modificación primero y luego ajuste la trama después de la confirmación.</p> : null}
      </article>)}
    </div> : <p className="text-muted-foreground">Si no se encuentran problemas de expresión que requieran revisión, se podrá conservar el manuscrito original.</p>}
  </section>;
}

export function StyleRewriteProtection({ guard, retainedOriginal }: { guard?: StyleRewriteGuard; retainedOriginal?: boolean }) {
  const blocked = guard?.checks.filter(check => check.status === "blocked") ?? [];
  return <div role="status" className={`space-y-1 rounded-md px-3 py-2 text-sm leading-6 ${blocked.length ? "bg-amber-500/10 text-foreground" : "bg-muted/30 text-muted-foreground"}`}>
    <p className="font-medium">{retainedOriginal ? "Mantener original" : "Vista previa de revisión parcial"}</p>
    {blocked.map(check => <p key={check.code}>{check.reason}</p>)}
    {!blocked.length ? <p>{retainedOriginal ? "No hay expresiones que requieran un reemplazo seguro y el texto original permanece sin cambios." : "Compara el tono de voz, las acciones y los mensajes del personaje, y aplica los cambios necesarios."}</p> : null}
    {guard?.checks.some(check => check.code === "semantic_facts" && check.status === "not_checked") && !retainedOriginal
      ? <p className="text-xs">Consulta la vista previa con los personajes y escenarios de este libro.</p> : null}
  </div>;
}
