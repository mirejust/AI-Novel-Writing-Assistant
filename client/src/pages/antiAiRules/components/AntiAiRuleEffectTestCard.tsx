import { isStyleIssueRewritable, type AntiAiRule, type StyleDetectionReport, type StyleRewriteGuard } from "@ai-novel/shared/types/styleEngine";
import { StyleRiskReport, StyleRewriteProtection } from "@/components/styleReview";
import { FlaskConical, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface AntiAiRuleEffectTestCardProps {
  content: string;
  report: StyleDetectionReport | null;
  rewritePreview: string;
  rewriteGuard?: StyleRewriteGuard;
  detectionPending: boolean;
  rewritePending: boolean;
  testRuleCount: number;
  scopeReady: boolean;
  previewRules: AntiAiRule[];
  onContentChange: (content: string) => void;
  onDetect: () => void;
  onRewrite: () => void;
  onRemovePreviewRule: (ruleId: string) => void;
  onClearPreviewRules: () => void;
}

export default function AntiAiRuleEffectTestCard(props: AntiAiRuleEffectTestCardProps) {
  const busy = props.detectionPending || props.rewritePending;
  const canTest = props.scopeReady && !busy && Boolean(props.content.trim());
  const hasRewritableIssue = !props.report || props.report.violations.some((issue) => isStyleIssueRewritable(issue));

  return (
    <section aria-labelledby="anti-ai-test-title" className="space-y-4 p-5 sm:p-6" aria-busy={busy}>
      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <h2 id="anti-ai-test-title" className="flex items-center gap-2 text-base font-semibold">
            <FlaskConical aria-hidden="true" className="h-4 w-4 text-muted-foreground" />Prueba de efecto
          </h2>
          <span className="text-xs tabular-nums text-muted-foreground">{props.scopeReady ? props.testRuleCount + " reglas" : "Reglas en preparación"}</span>
        </div>
        <p className="text-xs leading-5 text-muted-foreground">Pegue una escena completa para ver recordatorios de expresiones y vistas previas de revisiones parciales.</p>
      </div>

      {props.previewRules.length > 0 ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
            <span>Unirse temporalmente · {props.previewRules.length} Banda</span>
            <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={props.onClearPreviewRules}>Claro</Button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {props.previewRules.map((rule) => (
              <button key={rule.id} type="button"
                className="inline-flex max-w-full items-center gap-1 rounded-md bg-primary/10 px-2 py-1.5 text-xs text-primary hover:bg-primary/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onClick={() => props.onRemovePreviewRule(rule.id)} aria-label={"Eliminar prueba:" + rule.name} title="Salir de la prueba">
                <span className="truncate">{rule.name}</span><X aria-hidden="true" className="h-3 w-3 shrink-0" />
              </button>
            ))}
          </div>
          <p className="text-xs leading-5 text-muted-foreground">Las reglas temporales y las reglas efectivas se prueban juntas y la misma regla solo se cuenta una vez.</p>
        </div>
      ) : (
        <p className="text-xs leading-5 text-muted-foreground">Puede agregar temporalmente otras reglas de la lista de reglas para comparar los efectos.</p>
      )}

      <div className="space-y-2">
        <label htmlFor="anti-ai-test-content" className="block text-sm font-medium">Texto a probar</label>
        <textarea id="anti-ai-test-content"
          className="min-h-[200px] w-full resize-y rounded-lg border border-input bg-background p-3 text-sm leading-7 placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          value={props.content} placeholder="Pega el texto principal, como un diálogo o una descripción de la escena..."
          onChange={(event) => props.onContentChange(event.target.value)} />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={props.onDetect} disabled={!canTest} className="flex-1">
          {props.detectionPending ? <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin motion-reduce:animate-none" /> : null}
          {props.detectionPending ? "Comprobando…" : "Comprobar expresión"}
        </Button>
        <Button type="button" variant="secondary" onClick={props.onRewrite} disabled={!canTest || !hasRewritableIssue} className="flex-1">
          {props.rewritePending ? <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin motion-reduce:animate-none" /> : null}
          {props.rewritePending ? "En revisión…" : "Vista previa de revisiones parciales"}
        </Button>
      </div>
      <p className="text-xs leading-5 text-muted-foreground">Las pruebas y vistas previas no se guardarán en la novela; Verifique el tono del carácter y la configuración antes de usarlo.</p>

      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {props.detectionPending ? "Comprobando la expresión" : props.rewritePending ? "Generando vista previa de revisión" : props.report ? "La verificación de expresión está completa, puede ver los resultados a continuación" : ""}
      </div>
      {props.report ? (
        <div className="space-y-3 border-t border-border/60 pt-4">
          <h3 className="text-sm font-semibold">Comprobar resultados</h3>
          <StyleRiskReport report={props.report} />
        </div>
      ) : null}
      {props.rewritePreview ? (
        <div className="space-y-3 border-t border-border/60 pt-4">
          <h3 className="text-sm font-semibold">Vista previa de revisión parcial</h3>
          <StyleRewriteProtection guard={props.rewriteGuard} retainedOriginal={props.rewritePreview === props.content} />
          <div className="max-h-[360px] overflow-auto whitespace-pre-wrap break-words rounded-lg bg-muted/30 p-4 text-sm leading-7">
            {props.rewritePreview}
          </div>
        </div>
      ) : null}
    </section>
  );
}
