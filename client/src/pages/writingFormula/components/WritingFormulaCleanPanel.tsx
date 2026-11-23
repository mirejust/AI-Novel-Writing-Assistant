import { isStyleIssueRewritable, type StyleDetectionReport, type StyleProfile, type StyleRewriteGuard } from "@ai-novel/shared/types/styleEngine";
import { StyleRiskReport, StyleRewriteProtection } from "@/components/styleReview";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface WritingFormulaCleanPanelProps {
  selectedProfile: StyleProfile | null;
  detectInput: string;
  detectionReport: StyleDetectionReport | null;
  detectionPending: boolean;
  rewritePending: boolean;
  rewritePreview: string;
  rewriteGuard?: StyleRewriteGuard;
  onDetectInputChange: (value: string) => void;
  onDetect: () => void;
  onRewrite: () => void;
}

export default function WritingFormulaCleanPanel(props: WritingFormulaCleanPanelProps) {
  const {
    selectedProfile,
    detectInput,
    detectionReport,
    detectionPending,
    rewritePending,
    rewritePreview,
    onDetectInputChange,
    onDetect,
    onRewrite,
  } = props;

  const antiAiRuleNames = selectedProfile?.antiAiRules.map((rule) => rule.name) ?? [];

  return (
    <Card className="border-0 shadow-none">
      <CardHeader>
        <CardTitle>Deshazte del sabor de la IA</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {selectedProfile ? (
          <div className="rounded-2xl bg-muted/30 px-4 py-3 text-sm leading-7 text-muted-foreground">
            Actualmente presionando "{selectedProfile.name}"Este conjunto de métodos de escritura se utiliza para pruebas y correcciones. Aquí solo se procesa el sabor AI del texto y el campo del método en sí no se reescribirá.
          </div>
        ) : (
          <div className="rounded-2xl bg-muted/30 px-4 py-3 text-sm leading-7 text-muted-foreground">
            Primero seleccione un método de escritura de la lista y luego verifique el texto.
          </div>
        )}

        <div className="space-y-4 py-2">
          <div className="space-y-1">
            <div className="text-base font-semibold text-slate-950">Restricciones anti-IA a las que actualmente se hará referencia primero</div>
            <div className="text-sm leading-6 text-slate-500">
              Si este método de escritura está sujeto a reglas anti-IA, la detección y corrección darán prioridad a juzgar el problema de acuerdo con estas restricciones.
            </div>
          </div>
          {antiAiRuleNames.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {antiAiRuleNames.map((ruleName) => (
                <div key={`${selectedProfile?.id}-${ruleName}`} className="rounded-full bg-muted/30 px-3 py-1 text-sm text-muted-foreground">
                  {ruleName}
                </div>
              ))}
            </div>
          ) : (
            <div className="py-3 text-sm leading-6 text-muted-foreground">
              Este conjunto de escritos aún no ha sido vinculado a reglas claras contra la IA. La prueba actual se basará más en un juicio de riesgo general y es posible que los resultados no sean consistentes con sus expectativas.
            </div>
          )}
        </div>

        <div className="space-y-4 py-2">
          <div className="space-y-1">
            <div className="text-base font-semibold text-slate-950">Detectar texto</div>
            <div className="text-sm leading-6 text-slate-500">
              Pega el texto que deseas verificar. Se recomienda dar una escena completa a la vez, para que sea más fácil ver los problemas de narrativa, diálogo y exposición.
            </div>
          </div>

          <textarea
            data-writing-formula-detect-input
            autoFocus
            className="min-h-[220px] w-full rounded-md border p-3 text-sm"
            placeholder="Pega el texto a detectar"
            value={detectInput}
            onChange={(event) => onDetectInputChange(event.target.value)}
          />

          <div className="flex flex-wrap gap-2">
            <Button onClick={onDetect} disabled={detectionPending || rewritePending || !selectedProfile || !detectInput.trim()}>
              Realizar detección
            </Button>
            <Button variant="secondary" onClick={onRewrite} disabled={rewritePending || detectionPending || !selectedProfile || !detectInput.trim() || Boolean(detectionReport && !detectionReport.violations.some(issue => isStyleIssueRewritable(issue)))}>
              Generar vista previa de revisión parcial
            </Button>
          </div>

          {detectionReport ? (
            <StyleRiskReport report={detectionReport} />
          ) : (
            <div className="py-3 text-sm leading-6 text-muted-foreground">
              Verifique los problemas de expresión en el párrafo, la base del texto original y la dirección de modificación.
            </div>
          )}

          {rewritePreview ? (
            <div className="space-y-2">
              <StyleRewriteProtection guard={props.rewriteGuard} retainedOriginal={rewritePreview === detectInput} />
              <pre className="max-h-[320px] overflow-auto whitespace-pre-wrap rounded-xl bg-muted/20 p-4 text-sm">
                {rewritePreview}
              </pre>
            </div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
