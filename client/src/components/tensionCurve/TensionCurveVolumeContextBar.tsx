import { Badge } from "@/components/ui/badge";

export interface TensionCurveVolumeContext {
  roleLabel?: string | null;
  coreReward?: string | null;
  escalationFocus?: string | null;
  planningMode?: "hard" | "soft" | null;
}

interface TensionCurveVolumeContextBarProps {
  volume?: TensionCurveVolumeContext | null;
}

function contextText(value: string | null | undefined, fallback: string): string {
  return value?.trim() || fallback;
}

export function TensionCurveVolumeContextBar({ volume }: TensionCurveVolumeContextBarProps) {
  return (
    <div className="grid gap-3 rounded-xl border border-primary/15 bg-primary/5 p-3 text-sm lg:grid-cols-[auto_1fr_1fr_1fr] lg:items-start">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={volume?.planningMode === "hard" ? "secondary" : "outline"}>
          {volume?.planningMode === "hard" ? "Planificación difícil" : "Posicionamiento del nivel de volumen"}
        </Badge>
      </div>
      <div className="min-w-0">
        <div className="text-xs text-muted-foreground">El papel de este volumen.</div>
        <div className="mt-1 line-clamp-2 text-foreground">{contextText(volume?.roleLabel, "Primero consulte el título del volumen actual y la dirección del capítulo.")}</div>
      </div>
      <div className="min-w-0">
        <div className="text-xs text-muted-foreground">los lectores deben obtener</div>
        <div className="mt-1 line-clamp-2 text-foreground">{contextText(volume?.coreReward, "Al ajustar la curva, priorizar la preservación de los retornos básicos de este volumen.")}</div>
      </div>
      <div className="min-w-0">
        <div className="text-xs text-muted-foreground">Enfoque de actualización</div>
        <div className="mt-1 line-clamp-2 text-foreground">{contextText(volume?.escalationFocus, "Deje que los puntos altos sirvan al impulso más importante del volumen.")}</div>
      </div>
    </div>
  );
}
