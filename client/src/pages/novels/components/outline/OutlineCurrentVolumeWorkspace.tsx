import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import TensionCurvePanel, { type TensionCurveSeries } from "@/components/tensionCurve/TensionCurvePanel";
import VolumePayoffOverviewCard from "../VolumePayoffOverviewCard";
import type { OutlineTabViewProps } from "../NovelEditView.types";

type OutlineVolume = OutlineTabViewProps["volumes"][number];

interface OutlineCurrentVolumeWorkspaceProps {
  selectedVolume: OutlineVolume | undefined;
  strategyPlan: OutlineTabViewProps["strategyPlan"];
  volumes: OutlineVolume[];
  onSelectedVolumeChange: (volumeId: string) => void;
  onAddVolume: () => void;
  onRemoveVolume: OutlineTabViewProps["onRemoveVolume"];
  onMoveVolume: OutlineTabViewProps["onMoveVolume"];
  onVolumeFieldChange: OutlineTabViewProps["onVolumeFieldChange"];
  onOpenPayoffsChange: OutlineTabViewProps["onOpenPayoffsChange"];
  onGoToStructuredTab: () => void;
}

export default function OutlineCurrentVolumeWorkspace(props: OutlineCurrentVolumeWorkspaceProps) {
  const {
    selectedVolume,
    strategyPlan,
    volumes,
    onSelectedVolumeChange,
    onAddVolume,
    onRemoveVolume,
    onMoveVolume,
    onVolumeFieldChange,
    onOpenPayoffsChange,
    onGoToStructuredTab,
  } = props;
  const selectedStrategyVolume = selectedVolume
    ? strategyPlan?.volumes.find((item) => item.sortOrder === selectedVolume.sortOrder) ?? null
    : null;
  const tensionCurveSeries: TensionCurveSeries[] = selectedVolume
    ? [
        {
          id: "conflictLevel",
          label: "Intensidad del conflicto",
          color: "#2563eb",
          points: selectedVolume.chapters.map((chapter) => ({
            id: chapter.id,
            chapterOrder: chapter.chapterOrder,
            title: chapter.title || `Cap.${chapter.chapterOrder}Cap.`,
            value: typeof chapter.conflictLevel === "number" ? chapter.conflictLevel : null,
            source: chapter.conflictLevelSource ?? "ai",
          })),
        },
      ]
    : [];

  if (!selectedVolume) {
    return (
      <div className="rounded-md border border-dashed p-6 text-sm text-muted-foreground">
        Primero seleccione un volumen a la izquierda o genere primero el esqueleto de volumen completo y luego edite los detalles del volumen actual aquí.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border/70 bg-[linear-gradient(135deg,hsl(var(--background))_0%,hsl(var(--muted)/0.34)_100%)] p-4">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="default">Cap.{selectedVolume.sortOrder}Rollo</Badge>
              {selectedStrategyVolume ? (
                <Badge variant={selectedStrategyVolume.planningMode === "hard" ? "secondary" : "outline"}>
                  {selectedStrategyVolume.planningMode === "hard" ? "Planificación difícil" : "Planificación suave"}
                </Badge>
              ) : null}
              <Badge variant="outline">{selectedVolume.chapters.length} Cap.</Badge>
            </div>
            <div className="text-lg font-semibold tracking-tight">
              {selectedVolume.title || selectedStrategyVolume?.roleLabel || `Cap.${selectedVolume.sortOrder}Rollo`}
            </div>
            <div className="max-w-4xl text-sm leading-6 text-muted-foreground">
              {selectedVolume.mainPromise || selectedVolume.summary || selectedStrategyVolume?.coreReward || "Primero confirme qué recompensas brindará este volumen a los lectores y luego agregue el punto de partida, la fuente de estrés y la tracción al final del volumen."}
            </div>
          </div>
          <div className="grid min-w-[220px] grid-cols-2 gap-2 text-xs">
            <div className="rounded-xl border border-border/60 bg-background/75 p-3">
              <div className="text-muted-foreground">Fuente de opresión</div>
              <div className="mt-1 line-clamp-2 font-medium">{selectedVolume.primaryPressureSource || "Para ser reabastecido"}</div>
            </div>
            <div className="rounded-xl border border-border/60 bg-background/75 p-3">
              <div className="text-muted-foreground">Retiro al final del rollo</div>
              <div className="mt-1 line-clamp-2 font-medium">{selectedVolume.payoffType || selectedVolume.climax || "Para ser reabastecido"}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid items-start gap-3 xl:grid-cols-[320px_minmax(0,1fr)]">
        <Card className="self-start xl:sticky xl:top-4">
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="text-base font-semibold">Navegación por volumen</div>
                <div className="text-sm text-muted-foreground">Utilice el título y la descripción del volumen a la izquierda para ubicar el volumen que se está editando actualmente.</div>
              </div>
              <Button size="sm" variant="outline" onClick={onAddVolume}>Agregar nuevo volumen</Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {volumes.length > 0 ? (
              <div className="max-h-[720px] space-y-2 overflow-y-auto pr-1">
                {volumes.map((volume) => {
                  const strategyVolume = strategyPlan?.volumes.find((item) => item.sortOrder === volume.sortOrder) ?? null;
                  const isSelected = selectedVolume.id === volume.id;
                  return (
                    <button
                      key={volume.id}
                      type="button"
                      onClick={() => onSelectedVolumeChange(volume.id)}
                      className={`w-full rounded-xl border p-3 text-left transition ${
                        isSelected
                          ? "border-sky-400/70 bg-sky-50 shadow-sm ring-1 ring-sky-200"
                          : "border-border/70 bg-background hover:border-primary/30 hover:bg-muted/30"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <Badge variant={isSelected ? "default" : "outline"}>Cap.{volume.sortOrder}Rollo</Badge>
                        {strategyVolume ? (
                          <Badge variant={strategyVolume.planningMode === "hard" ? "secondary" : "outline"}>
                            {strategyVolume.planningMode === "hard" ? "Planificación difícil" : "Planificación suave"}
                          </Badge>
                        ) : null}
                      </div>
                      <div className="mt-2 text-sm font-medium">
                        {volume.title || strategyVolume?.roleLabel || `Cap.${volume.sortOrder}Rollo`}
                      </div>
                      <div className="mt-1 line-clamp-3 text-xs leading-5 text-muted-foreground">
                        {volume.summary || volume.mainPromise || strategyVolume?.coreReward || "Primero complete el título y la descripción de este volumen para facilitar la navegación posterior."}
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-md border border-dashed p-4 text-xs text-muted-foreground">
                Actualmente no existe un esqueleto de volumen. Primero cree sugerencias de estrategia de volumen y luego haga clic en "Generar esqueleto de volumen completo".
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-3">
          <VolumePayoffOverviewCard selectedVolume={selectedVolume} />
          <TensionCurvePanel
            title="La tensión de este volumen."
            subtitle="Consulta el capítulo Tendencia de intensidad de conflictos. El punto rojo indica la intensidad que has reservado para la IA posterior."
            series={tensionCurveSeries}
            readonly
            compact
          />
          <div className="flex justify-end">
            <Button type="button" size="sm" variant="outline" onClick={onGoToStructuredTab}>
              Curva de edición de ritmo/capítulo
            </Button>
          </div>
          <Card key={selectedVolume.id} className="overflow-hidden">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Badge variant="outline">Cap.{selectedVolume.sortOrder}Rollo</Badge>
                  {selectedStrategyVolume ? (
                    <Badge variant={selectedStrategyVolume.planningMode === "hard" ? "secondary" : "outline"}>
                      {selectedStrategyVolume.planningMode === "hard" ? "Planificación difícil" : "Planificación suave"}
                    </Badge>
                  ) : null}
                  {selectedStrategyVolume?.roleLabel ? <span className="text-sm text-muted-foreground">{selectedStrategyVolume.roleLabel}</span> : null}
                  <span className="text-sm text-muted-foreground">
                    {selectedVolume.chapters.length > 0
                      ? `capítulo ${selectedVolume.chapters[0]?.chapterOrder}-${selectedVolume.chapters[selectedVolume.chapters.length - 1]?.chapterOrder}`
                      : "sin abrir"}
                  </span>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => onMoveVolume(selectedVolume.id, -1)} disabled={selectedVolume.sortOrder === 1}>Subir</Button>
                  <Button size="sm" variant="outline" onClick={() => onMoveVolume(selectedVolume.id, 1)} disabled={selectedVolume.sortOrder === volumes.length}>Bajar</Button>
                  <Button size="sm" variant="outline" onClick={() => onRemoveVolume(selectedVolume.id)} disabled={volumes.length <= 1}>Eliminar</Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <VolumeEditSection
                title="Ubicación del volumen"
                description="Determine la primera impresión, la legibilidad y los principales puntos de venta de este volumen entre los lectores."
              >
                <VolumeTextField label="Título del volumen" value={selectedVolume.title} onChange={(value) => onVolumeFieldChange(selectedVolume.id, "title", value)} wide singleLine />
                <VolumeTextField label="Resumen de volumen" value={selectedVolume.summary ?? ""} onChange={(value) => onVolumeFieldChange(selectedVolume.id, "summary", value)} />
                <VolumeTextField label="Mango desenrollador" value={selectedVolume.openingHook ?? ""} onChange={(value) => onVolumeFieldChange(selectedVolume.id, "openingHook", value)} />
                <VolumeTextField label="Promesa principal" value={selectedVolume.mainPromise ?? ""} onChange={(value) => onVolumeFieldChange(selectedVolume.id, "mainPromise", value)} />
                <VolumeTextField label="Punto de venta principal" value={selectedVolume.coreSellingPoint ?? ""} onChange={(value) => onVolumeFieldChange(selectedVolume.id, "coreSellingPoint", value)} />
              </VolumeEditSection>

              <VolumeEditSection
                title="Presión de empuje"
                description="Controle la fuente de opresión, actualice los métodos y los cambios de roles en este volumen para evitar la holgura en el medio."
              >
                <VolumeTextField label="Principal fuente de opresión" value={selectedVolume.primaryPressureSource ?? ""} onChange={(value) => onVolumeFieldChange(selectedVolume.id, "primaryPressureSource", value)} />
                <VolumeTextField label="Método de actualización" value={selectedVolume.escalationMode ?? ""} onChange={(value) => onVolumeFieldChange(selectedVolume.id, "escalationMode", value)} />
                <VolumeTextField label="Cambios de protagonista" value={selectedVolume.protagonistChange ?? ""} onChange={(value) => onVolumeFieldChange(selectedVolume.id, "protagonistChange", value)} />
                <VolumeTextField label="Riesgo de rango medio" value={selectedVolume.midVolumeRisk ?? ""} onChange={(value) => onVolumeFieldChange(selectedVolume.id, "midVolumeRisk", value)} />
              </VolumeEditSection>

              <VolumeEditSection
                title="Efectivo en traccion"
                description="Aclare las recompensas al final del volumen, los compromisos heredados y la tracción hacia el siguiente volumen."
              >
                <VolumeTextField label="Clímax al final del volumen." value={selectedVolume.climax ?? ""} onChange={(value) => onVolumeFieldChange(selectedVolume.id, "climax", value)} />
                <VolumeTextField label="Tipo de canje" value={selectedVolume.payoffType ?? ""} onChange={(value) => onVolumeFieldChange(selectedVolume.id, "payoffType", value)} />
                <VolumeTextField label="Gancho de rollo inferior" value={selectedVolume.nextVolumeHook ?? ""} onChange={(value) => onVolumeFieldChange(selectedVolume.id, "nextVolumeHook", value)} />
                <VolumeTextField label="punto de reinicio entre volúmenes" value={selectedVolume.resetPoint ?? ""} onChange={(value) => onVolumeFieldChange(selectedVolume.id, "resetPoint", value)} />
                <VolumeTextField
                  label="Asuntos pendientes en este volumen"
                  value={selectedVolume.openPayoffs.join("\n")}
                  onChange={(value) => onOpenPayoffsChange(selectedVolume.id, value)}
                  placeholder="Uno por línea, o separados por comas chinas."
                  wide
                />
              </VolumeEditSection>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function VolumeEditSection(props: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border/60 bg-muted/10 p-3">
      <div className="mb-3 flex flex-col gap-1 border-b border-border/50 pb-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="text-sm font-semibold text-foreground">{props.title}</div>
          <div className="mt-1 text-xs leading-5 text-muted-foreground">{props.description}</div>
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-2">{props.children}</div>
    </section>
  );
}

function VolumeTextField(props: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  wide?: boolean;
  singleLine?: boolean;
}) {
  return (
    <label className={`space-y-1 text-sm ${props.wide ? "md:col-span-2" : ""}`}>
      <span className="text-xs text-muted-foreground">{props.label}</span>
      {props.singleLine ? (
        <input
          className="w-full rounded-md border bg-background p-2"
          value={props.value}
          onChange={(event) => props.onChange(event.target.value)}
        />
      ) : (
        <textarea
          className="min-h-[84px] w-full rounded-md border bg-background p-2"
          placeholder={props.placeholder}
          value={props.value}
          onChange={(event) => props.onChange(event.target.value)}
        />
      )}
    </label>
  );
}
