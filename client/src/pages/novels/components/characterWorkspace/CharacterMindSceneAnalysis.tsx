import { useState } from "react";
import type { CharacterMindSnapshot } from "@ai-novel/shared/types/characterMind";
import { Brain, ChevronDown, ChevronUp, CircleAlert, Lightbulb, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface CharacterMindSceneAnalysisProps {
  className?: string;
  characterName: string;
  mind: CharacterMindSnapshot;
}

export default function CharacterMindSceneAnalysis(props: CharacterMindSceneAnalysisProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  return (
    <aside className={cn("min-w-0 rounded-3xl border border-border/70 bg-background p-5 shadow-sm xl:sticky xl:top-0", props.className)}>
      <div className="flex items-center gap-2 text-sm font-semibold"><Brain className="h-4 w-4 text-primary" />Análisis de la escena del personaje.</div>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">El siguiente contenido ayuda a comprender {props.characterName} La lógica de respuesta es una inferencia de IA y no reescribirá la historia oficial de la novela.</p>

      <section className="mt-5 rounded-2xl border border-primary/15 bg-primary/[0.045] p-4">
        <div className="text-xs font-medium text-primary">¿Cómo ve la situación actual?</div>
        <p className="mt-2 text-sm leading-7 text-foreground">{props.mind.currentInterpretation}</p>
      </section>

      <div className="mt-4 space-y-3">
        <AnalysisItem icon={Lightbulb} title="Preocupaciones en la conversación" value={props.mind.activePlan || props.mind.privateIntent || "La IA aún no ha determinado un foco estable."} />
        <AnalysisItem icon={CircleAlert} title="Posible mala lectura" value={props.mind.misbeliefs[0] || "Aún no hay ningún malentendido claro."} tone="warning" />
        <AnalysisItem icon={ShieldCheck} title="Reacción al estrés" value={props.mind.actionTendency || "La IA aún no ha determinado una respuesta estable."} />
      </div>

      <Button className="mt-4 w-full justify-between" size="sm" variant="ghost" onClick={() => setIsExpanded((current) => !current)}>
        {isExpanded ? "Contraer análisis completo" : "Ver análisis completo"}
        {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </Button>
      {isExpanded ? <div className="mt-3 space-y-3 border-t border-border/60 pt-4">
        <AnalysisItem title="Estado de ánimo y postura actual" value={props.mind.emotionalStance || "No se ha formado ningún juicio estable."} />
        <AnalysisItem title="¿Qué cambiaría la decisión?" value={props.mind.decisionTrigger || "No se ha formado ningún juicio estable."} />
        <AnalysisItem title="Actualmente creo" value={props.mind.beliefs.join(";") || "Actualmente no se considera necesario un seguimiento especial."} />
        <AnalysisItem title="Base de inferencia" value={props.mind.evidence.join(";") || "Actualmente no existe ninguna base para la visualización."} />
      </div> : null}

      <div className="mt-5 flex flex-wrap gap-2 border-t border-border/60 pt-4 text-xs text-muted-foreground">
        <Badge variant="outline">Fuente:{props.mind.sourceType === "artifact_delta" ? "Cambios después de la finalización del capítulo" : props.mind.sourceType === "bootstrap" ? "Preparación de personajes" : "Clasificación manual"}</Badge>
        {typeof props.mind.confidence === "number" ? <Badge variant="outline">Confianza {Math.round(props.mind.confidence * 100)}%</Badge> : null}
      </div>
    </aside>
  );
}

function AnalysisItem(props: { icon?: typeof Brain; title: string; value: string; tone?: "warning" }) {
  const Icon = props.icon;
  return <section className="rounded-2xl border border-border/70 bg-muted/[0.16] p-3.5"><div className={`flex items-center gap-1.5 text-xs font-medium ${props.tone === "warning" ? "text-amber-700 dark:text-amber-400" : "text-muted-foreground"}`}>{Icon ? <Icon className="h-3.5 w-3.5" /> : null}{props.title}</div><p className="mt-1.5 text-sm leading-6 text-foreground">{props.value}</p></section>;
}
