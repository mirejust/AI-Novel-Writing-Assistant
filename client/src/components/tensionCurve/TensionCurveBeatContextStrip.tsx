import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface TensionCurveBeatContext {
  key: string;
  label: string;
  chapterSpanHint?: string | null;
  summary?: string | null;
  mustDeliver?: string[];
}

interface TensionCurveBeatContextStripProps {
  beats: TensionCurveBeatContext[];
  selectedBeatKey: string;
  onBeatChange: (key: string) => void;
}

export function TensionCurveBeatContextStrip(props: TensionCurveBeatContextStripProps) {
  const { beats, selectedBeatKey, onBeatChange } = props;
  const selectedBeat = selectedBeatKey === "all"
    ? null
    : beats.find((beat) => beat.key === selectedBeatKey) ?? null;

  return (
    <div className="space-y-3 rounded-xl border border-border/70 bg-background p-3">
      <div className="w-full overflow-x-auto">
        <div className="flex gap-2 pb-2">
          <Button
            type="button"
            size="sm"
            variant={selectedBeatKey === "all" ? "secondary" : "outline"}
            className="h-8 shrink-0 px-3 text-xs"
            onClick={() => onBeatChange("all")}
          >
            volumen entero
          </Button>
          {beats.map((beat) => (
            <Button
              key={beat.key}
              type="button"
              size="sm"
              variant={selectedBeatKey === beat.key ? "secondary" : "outline"}
              className="h-8 shrink-0 px-3 text-xs"
              onClick={() => onBeatChange(beat.key)}
            >
              {beat.label}
            </Button>
          ))}
        </div>
      </div>

      {selectedBeat ? (
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(260px,0.8fr)]">
          <div className="rounded-lg border border-border/70 bg-muted/20 p-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge>{selectedBeat.label}</Badge>
              {selectedBeat.chapterSpanHint ? <Badge variant="outline">{selectedBeat.chapterSpanHint}</Badge> : null}
            </div>
            <div className="mt-2 text-sm leading-6 text-foreground">
              {selectedBeat.summary?.trim() || "Aún no hay una explicación del ritmo para esta sección, por lo que se recomienda volver al tablero de ritmo para completar el objetivo de entrega."}
            </div>
          </div>
          <div className="rounded-lg border border-border/70 bg-muted/20 p-3">
            <div className="text-sm font-medium text-foreground">Este párrafo debe ser entregado.</div>
            {selectedBeat.mustDeliver && selectedBeat.mustDeliver.length > 0 ? (
              <ol className="mt-2 space-y-1.5">
                {selectedBeat.mustDeliver.slice(0, 4).map((item, index) => (
                  <li key={`${selectedBeat.key}-${index}`} className="flex gap-2 text-xs leading-5 text-muted-foreground">
                    <span className="mt-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary/10 px-1 text-[10px] font-semibold text-primary">
                      {index + 1}
                    </span>
                    <span>{item}</span>
                  </li>
                ))}
              </ol>
            ) : (
              <div className="mt-2 text-xs leading-5 text-muted-foreground">No hay resultados claros en esta sección.</div>
            )}
          </div>
        </div>
      ) : (
        <div className={cn("rounded-lg border border-dashed p-3 text-sm text-muted-foreground", beats.length === 0 ? "bg-amber-50 text-amber-800" : "")}>
          {beats.length > 0 ? "Actualmente vea la tendencia de todo el volumen. Una vez que corte a un segmento de ritmo específico, puede ajustar la intensidad según el resumen del segmento y los resultados requeridos." : "No hay ninguna sección rítmica en el volumen actual. Primero genera el tablero de ritmo y luego revisa la curva por sección."}
        </div>
      )}
    </div>
  );
}
