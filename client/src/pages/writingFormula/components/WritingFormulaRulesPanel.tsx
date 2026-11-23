import { useMemo } from "react";
import type { AntiAiRule } from "@ai-novel/shared/types/styleEngine";
import { ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface WritingFormulaRulesPanelProps {
  antiAiRules: AntiAiRule[];
  onToggleRule: (rule: AntiAiRule, enabled: boolean) => void;
}

export default function WritingFormulaRulesPanel(props: WritingFormulaRulesPanelProps) {
  const { antiAiRules } = props;

  const enabledCount = useMemo(
    () => antiAiRules.filter((rule) => rule.enabled).length,
    [antiAiRules],
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5" />
          Reglas anti-IA
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="rounded-md border bg-muted/20 p-3 text-sm">
          permitir {enabledCount} / {antiAiRules.length} normas
        </div>
        <div className="text-sm leading-6 text-muted-foreground">
          Ver, crear y ajustar reglas anti-IA en el Centro de reglas; el área de edición de escritura sigue siendo responsable de seleccionar qué reglas están vinculadas a la escritura actual.
        </div>
        <Button className="w-full" variant="secondary" asChild>
          <Link to="/anti-ai-rules">Ingrese al centro de reglas</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
