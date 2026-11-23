import { useEffect, useState } from "react";
import AiButton from "@/components/common/AiButton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import BookPayoffLedgerCard from "./BookPayoffLedgerCard";
import CollapsibleSummary from "./CollapsibleSummary";
import WorldInjectionHint from "./WorldInjectionHint";
import type { OutlineTabViewProps } from "./NovelEditView.types";
import DirectorTakeoverEntryPanel from "./DirectorTakeoverEntryPanel";
import SelectControl from "@/components/common/SelectControl";
import OutlineCurrentVolumeWorkspace from "./outline/OutlineCurrentVolumeWorkspace";
import OutlineResourceCommitments from "./outline/OutlineResourceCommitments";
import type { VolumeBeatImpactItem } from "@ai-novel/shared/types/novel";

type OutlineWorkspaceTab = "current" | "strategy" | "assets";

function versionStatusLabel(status: "draft" | "active" | "frozen"): string {
  if (status === "active") return "Ya efectivo";
  if (status === "frozen") return "Congelado";
  return "Borrador";
}

function versionStatusVariant(status: "draft" | "active" | "frozen"): "secondary" | "outline" | "default" {
  if (status === "active") return "default";
  if (status === "frozen") return "outline";
  return "secondary";
}

const readinessSteps = [
  {
    key: "canGenerateStrategy",
    label: "Estrategia de volumen",
    description: "Obtenga primero el número de volumen recomendado, el plan hardware/soft y el gradiente de actualización.",
  },
  {
    key: "canGenerateSkeleton",
    label: "Esqueleto de volumen",
    description: "Confirme la manija de apertura, la fuente de presión y el método de canje de cada volumen.",
  },
  {
    key: "canGenerateBeatSheet",
    label: "Tablero de ritmo",
    description: "Una vez que el esqueleto de rollo esté estable, es adecuado ingresar a la división del ritmo de un solo rollo.",
  },
  {
    key: "canGenerateChapterList",
    label: "Capítulos divididos",
    description: "Una vez que el tablero de ritmo esté listo, puede pasar al nivel del capítulo.",
  },
] as const;

function getNextOutlineAction(readiness: OutlineTabViewProps["readiness"]): string {
  if (!readiness.canGenerateStrategy) return "Consejos estratégicos del Sr. Paper";
  if (!readiness.canGenerateSkeleton) return "Ahora es adecuado generar el esqueleto de todo el libro.";
  if (!readiness.canGenerateBeatSheet) return "El esqueleto del volumen está listo, el siguiente paso es entrar en ritmo/desempaquetar el capítulo";
  if (!readiness.canGenerateChapterList) return "Primero haga el tablero de ritmo del volumen actual, luego divida los capítulos del volumen actual";
  return "La etapa de estrategia de volumen está completa y puede continuar ingresando a los capítulos de ritmo/desempaquetado.";
}

function getVolumeScaleProfileLabel(profile: OutlineTabViewProps["volumeCountGuidance"]["volumeScaleProfile"]): string {
  const labels: Record<OutlineTabViewProps["volumeCountGuidance"]["volumeScaleProfile"], string> = {
    short: "estructura de la historia corta",
    compact: "Novela compacta",
    standard: "Novela estándar",
    long: "Expansión de larga historia",
    epic: "Larga historia",
    mega: "Historia muy larga",
  };
  return labels[profile] ?? "Sugerencias estructurales";
}

function getBeatImpactStatusLabel(status: VolumeBeatImpactItem["status"]): string {
  if (status === "locked_with_draft") return "Texto bloqueado";
  if (status === "pending") return "Pendiente de generar";
  return "Puede acceder a secciones no escritas";
}

function getBeatImpactStatusVariant(status: VolumeBeatImpactItem["status"]): "secondary" | "outline" | "default" {
  if (status === "locked_with_draft") return "secondary";
  if (status === "pending") return "outline";
  return "default";
}

function formatBeatChapterOrders(chapterOrders: number[]): string {
  if (chapterOrders.length === 0) {
    return "Capítulos a generar";
  }
  const sorted = chapterOrders.slice().sort((left, right) => left - right);
  return sorted[0] === sorted[sorted.length - 1]
    ? `Cap. ${sorted[0]}`
    : `Cap. ${sorted[0]}-${sorted[sorted.length - 1]}`;
}

export default function OutlineTab(props: OutlineTabViewProps) {
  const {
    worldInjectionSummary,
    hasCharacters,
    hasUnsavedVolumeDraft,
    generationNotice,
    readiness,
    volumeCountGuidance,
    customVolumeCountEnabled,
    customVolumeCountInput,
    onCustomVolumeCountEnabledChange,
    onCustomVolumeCountInputChange,
    onApplyCustomVolumeCount,
    onRestoreSystemRecommendedVolumeCount,
    strategyPlan,
    critiqueReport,
    isGeneratingStrategy,
    onGenerateStrategy,
    isCritiquingStrategy,
    onCritiqueStrategy,
    isGeneratingSkeleton,
    onGenerateSkeleton,
    onGoToCharacterTab,
    onGoToStructuredTab,
    latestStateSnapshot,
    payoffLedger,
    characterResources = [],
    draftText,
    volumes,
    onVolumeFieldChange,
    onOpenPayoffsChange,
    onAddVolume,
    onRemoveVolume,
    onMoveVolume,
    onSave,
    isSaving,
    volumeMessage,
    volumeVersions,
    selectedVersionId,
    onSelectedVersionChange,
    onCreateDraftVersion,
    isCreatingDraftVersion,
    onLoadSelectedVersionToDraft,
    onActivateVersion,
    isActivatingVersion,
    onFreezeVersion,
    isFreezingVersion,
    onLoadVersionDiff,
    isLoadingVersionDiff,
    diffResult,
    onAnalyzeDraftImpact,
    isAnalyzingDraftImpact,
    onAnalyzeVersionImpact,
    isAnalyzingVersionImpact,
    impactResult,
  } = props;

  const selectedVersion = volumeVersions.find((item) => item.id === selectedVersionId);
  const completedReadinessCount = readinessSteps.filter((item) => readiness[item.key]).length;
  const readinessProgress = Math.round((completedReadinessCount / Math.max(readinessSteps.length, 1)) * 100);
  const nextOutlineAction = getNextOutlineAction(readiness);
  const outlineStageReady = completedReadinessCount === readinessSteps.length;
  const [selectedVolumeId, setSelectedVolumeId] = useState(volumes[0]?.id ?? "");
  const [workspaceTab, setWorkspaceTab] = useState<OutlineWorkspaceTab>("current");
  const volumeCountModeLabel = volumeCountGuidance.userPreferredVolumeCount != null
    ? `Actualmente arreglado ${volumeCountGuidance.userPreferredVolumeCount} volumen`
    : volumeCountGuidance.respectedExistingVolumeCount != null
      ? `Actualmente usando borrador ${volumeCountGuidance.respectedExistingVolumeCount} volumen`
      : `Actualmente recomendado por el sistema. ${volumeCountGuidance.systemRecommendedVolumeCount} volumen`;
  const volumeScaleProfileLabel = getVolumeScaleProfileLabel(volumeCountGuidance.volumeScaleProfile);

  useEffect(() => {
    if (!volumes.some((volume) => volume.id === selectedVolumeId)) {
      setSelectedVolumeId(volumes[0]?.id ?? "");
    }
  }, [selectedVolumeId, volumes]);

  const selectedVolume = volumes.find((volume) => volume.id === selectedVolumeId) ?? volumes[0];

  return (
    <div className="space-y-5">
      <DirectorTakeoverEntryPanel
        title="Adquisición de la estrategia de volumen"
        description="La IA primero determinará si la estrategia de rollo y el esqueleto de rollo están completos y luego decidirá si continúa completando las partes faltantes o vuelve a ejecutar el paso actual."
        entry={props.directorTakeoverEntry}
      />
      <section className="overflow-hidden rounded-2xl border border-border/70 bg-background shadow-sm">
      <div className="border-b border-border/60 bg-[linear-gradient(135deg,hsl(var(--background))_0%,hsl(var(--muted)/0.38)_100%)] px-5 py-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold tracking-tight">Consola de estrategia de volumen</h2>
              <Badge variant={outlineStageReady ? "default" : "outline"}>
                {completedReadinessCount}/{readinessSteps.length} Listo
              </Badge>
              {hasUnsavedVolumeDraft ? <Badge variant="secondary">Contiene borradores no guardados</Badge> : null}
            </div>
            <div className="max-w-3xl text-sm leading-6 text-muted-foreground">
              Primero determine el método de avance a nivel de volumen para todo el libro y luego revise el compromiso, la presión, el cumplimiento del volumen actual y la tracción para el siguiente volumen.
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <AiButton variant="outline" onClick={onGenerateStrategy} disabled={isGeneratingStrategy}>
              {isGeneratingStrategy ? "Generando..." : "Generar consejos de estrategia de volumen"}
            </AiButton>
            <AiButton variant="outline" onClick={onCritiqueStrategy} disabled={isCritiquingStrategy || !strategyPlan}>
              {isCritiquingStrategy ? "En revisión..." : "Estrategia de volumen de revisión de IA"}
            </AiButton>
            <AiButton onClick={onGenerateSkeleton} disabled={isGeneratingSkeleton || !readiness.canGenerateSkeleton}>
              {isGeneratingSkeleton ? "Generando..." : volumes.length > 0 ? "Renacer en el esqueleto de todo el libro." : "Generar el esqueleto de todo el libro."}
            </AiButton>
            <Button variant="secondary" onClick={onSave} disabled={isSaving}>
              {isSaving ? "Guardando..." : "Guardar espacio de trabajo de volumen"}
            </Button>
          </div>
        </div>
      </div>
      <div className="space-y-5 p-5">
        <WorldInjectionHint worldInjectionSummary={worldInjectionSummary} />
        {!hasCharacters ? (
          <div className="flex items-center justify-between gap-2 rounded-2xl bg-amber-50 px-4 py-3 text-xs text-amber-800">
            <span>Se recomienda completar los personajes primero y luego crear la estrategia de tirada y el esqueleto de tirada.</span>
            <Button size="sm" variant="outline" onClick={onGoToCharacterTab}>Ir a gestión de roles</Button>
          </div>
        ) : null}
        <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-muted/20 px-4 py-3 text-xs text-muted-foreground">
          <span>{generationNotice}</span>
          {hasUnsavedVolumeDraft ? <Badge variant="secondary">Contiene borradores no guardados</Badge> : null}
        </div>
        <div className="grid items-start gap-3 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-3">
            <Card className="self-start border-0 bg-muted/15 shadow-none">
              <CardHeader className="pb-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <CardTitle className="text-base">Preparación para el escenario</CardTitle>
                  <Badge variant={outlineStageReady ? "default" : "outline"}>
                    {completedReadinessCount}/{readinessSteps.length} Listo
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="rounded-xl bg-background/70 p-3">
                  <div className="text-xs text-muted-foreground">Siguiente paso recomendado</div>
                  <div className="mt-1 font-medium text-foreground">{nextOutlineAction}</div>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary transition-all"
                      style={{ width: `${readinessProgress}%` }}
                    />
                  </div>
                  <div className="mt-2 text-xs text-muted-foreground">
                    {outlineStageReady
                      ? "La actual etapa estratégica de volumen tiene todas las condiciones para avanzar."
                      : readiness.blockingReasons.length > 0
                        ? `además ${readiness.blockingReasons.length} Es necesario gestionar la condición de bloqueo del artículo.`
                        : "Ahora se puede continuar con esta etapa."}
                  </div>
                </div>

                <div className="grid gap-2 sm:grid-cols-2">
                  {readinessSteps.map((item) => (
                    <div key={item.key} className="rounded-xl bg-background/70 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="font-medium text-foreground">{item.label}</div>
                        <Badge variant={readiness[item.key] ? "default" : "outline"}>
                          {readiness[item.key] ? "Listo" : "No listo"}
                        </Badge>
                      </div>
                      <div className="mt-1 text-xs leading-5 text-muted-foreground">{item.description}</div>
                    </div>
                  ))}
                </div>

                {readiness.blockingReasons.length > 0 ? (
                  <div className="rounded-xl bg-amber-50 p-3 text-xs text-amber-800">
                    {readiness.blockingReasons.map((reason) => <div key={reason}>{reason}</div>)}
                  </div>
                ) : (
                  <div className="rounded-xl bg-emerald-50 p-3 text-xs text-emerald-800">
                    El área de trabajo actual ya cuenta con las condiciones básicas para seguir avanzando.
                  </div>
                )}
                {volumeMessage ? <div className="text-xs text-muted-foreground">{volumeMessage}</div> : null}
              </CardContent>
            </Card>

            <details className="group border-t border-border/60 pt-4">
              <summary className="cursor-pointer list-none">
                <CollapsibleSummary
                  title="Sugerencias de artículos y revisión de estrategias"
                  description="Esta es información de ayuda para la toma de decisiones. En la primera pantalla, observe primero el siguiente paso recomendado y el volumen actual, y luego proceda a revisar y controlar el volumen cuando sea necesario."
                  meta={<Badge variant="outline">{volumeCountModeLabel}</Badge>}
                />
              </summary>

              <div className="mt-4 space-y-3">
                <Card className="self-start border-0 bg-muted/15 shadow-none">
                  <CardHeader className="pb-3">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <CardTitle className="text-base">Número sugerido de artículos.</CardTitle>
                      <Badge variant="outline">{volumeCountModeLabel}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="rounded-xl bg-background/70 p-3">
                        <div className="text-xs text-muted-foreground">Presupuesto total del capítulo</div>
                        <div className="mt-1 text-lg font-semibold text-foreground">{volumeCountGuidance.chapterBudget} Cap.</div>
                      </div>
                      <div className="rounded-xl bg-background/70 p-3">
                        <div className="text-xs text-muted-foreground">Rango estructural sugerido</div>
                        <div className="mt-1 text-lg font-semibold text-foreground">
                          {volumeCountGuidance.decisionVolumeCountRange.min}-{volumeCountGuidance.decisionVolumeCountRange.max} rollo
                        </div>
                      </div>
                      <div className="rounded-xl bg-background/70 p-3">
                        <div className="text-xs text-muted-foreground">Número de volúmenes recomendado por el sistema</div>
                        <div className="mt-1 text-lg font-semibold text-foreground">{volumeCountGuidance.systemRecommendedVolumeCount} Rollo</div>
                      </div>
                      <div className="rounded-xl bg-background/70 p-3">
                        <div className="text-xs text-muted-foreground">Alcance de planificación estricta predeterminado</div>
                        <div className="mt-1 text-lg font-semibold text-foreground">
                          {volumeCountGuidance.hardPlannedVolumeRange.min}-{volumeCountGuidance.hardPlannedVolumeRange.max} rollo
                        </div>
                      </div>
                    </div>

                    <div className="rounded-xl bg-background/70 p-3 text-xs leading-6 text-muted-foreground">
                      Engranaje de estructura actual:{volumeScaleProfileLabel}.{volumeCountGuidance.volumeCountRationale}
                      Se seguirán haciendo referencia a los presupuestos de los capítulos. {volumeCountGuidance.targetChapterRange.min}-{volumeCountGuidance.targetChapterRange.max} Capítulo/Volumen, 但系统会优先按阶段承诺, 卖点切换, 局面升级和阶段兑现来建议卷数.
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant={customVolumeCountEnabled ? "default" : "outline"}
                        onClick={() => onCustomVolumeCountEnabledChange(!customVolumeCountEnabled)}
                      >
                        {customVolumeCountEnabled ? "Contraer volúmenes personalizados" : "Número de volumen personalizado"}
                      </Button>
                      <Button size="sm" variant="outline" onClick={onRestoreSystemRecommendedVolumeCount}>
                        Sugerencias del sistema de recuperación
                      </Button>
                    </div>

                    {customVolumeCountEnabled ? (
                      <div className="rounded-xl bg-background/70 p-3">
                        <div className="grid gap-3 sm:grid-cols-[minmax(0,180px)_auto_auto] sm:items-end">
                          <label className="space-y-1 text-sm">
                            <span className="text-xs text-muted-foreground">Número fijo de rollos.</span>
                            <input
                              type="number"
                              min={volumeCountGuidance.allowedVolumeCountRange.min}
                              max={volumeCountGuidance.allowedVolumeCountRange.max}
                              className="w-full rounded-md border bg-background p-2"
                              value={customVolumeCountInput}
                              onChange={(event) => onCustomVolumeCountInputChange(event.target.value)}
                            />
                          </label>
                          <Button size="sm" onClick={onApplyCustomVolumeCount}>Aplicar un número fijo de volúmenes.</Button>
                          <div className="text-xs text-muted-foreground">
                            Rango permitido:{volumeCountGuidance.allowedVolumeCountRange.min}-{volumeCountGuidance.allowedVolumeCountRange.max} rollo. Los volúmenes fijos anulan las recomendaciones estructurales.
                          </div>
                        </div>
                      </div>
                    ) : null}
                  </CardContent>
                </Card>

                {critiqueReport ? (
                  <Card className="self-start border-0 bg-muted/15 shadow-none">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between gap-2">
                        <CardTitle className="text-base">Revisión de la estrategia de volumen</CardTitle>
                        <Badge variant={critiqueReport.overallRisk === "high" ? "secondary" : critiqueReport.overallRisk === "medium" ? "outline" : "default"}>
                          riesgo {critiqueReport.overallRisk}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3 text-sm">
                      <div className="rounded-md border p-3 text-xs text-muted-foreground">{critiqueReport.summary}</div>
                      {critiqueReport.issues.length > 0 ? (
                        <div className="space-y-2">
                          {critiqueReport.issues.map((issue) => (
                            <div key={`${issue.targetRef}-${issue.title}`} className="rounded-md border p-3 text-xs">
                              <div className="flex items-center gap-2">
                                <Badge variant="outline">{issue.targetRef}</Badge>
                                <Badge variant={issue.severity === "high" ? "secondary" : issue.severity === "medium" ? "outline" : "default"}>
                                  {issue.severity}
                                </Badge>
                              </div>
                              <div className="mt-2 font-medium">{issue.title}</div>
                              <div className="mt-1 text-muted-foreground">{issue.detail}</div>
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </CardContent>
                  </Card>
                ) : null}
              </div>
            </details>
          </div>

          <details className="group border-t border-border/60 pt-4">
            <summary className="cursor-pointer list-none">
              <CollapsibleSummary
                title="Texto derivado, control de versiones y análisis de impacto."
                description="Esta parte tiene más que ver con el acabado y el contraste, y no es algo a lo que tengas que estar atento al editar el esqueleto del volumen actual."
              />
            </summary>

            <div className="mt-4 space-y-3">
              <Card className="self-start border-0 bg-muted/15 shadow-none">
                <CardHeader>
                  <CardTitle className="text-base">Vista previa del texto derivado</CardTitle>
                </CardHeader>
                <CardContent>
                  <textarea className="min-h-[220px] w-full rounded-md border bg-muted/20 p-3 text-sm" readOnly value={draftText} />
                </CardContent>
              </Card>

              <Card className="self-start border-0 bg-muted/15 shadow-none">
                <CardHeader>
                  <CardTitle className="text-base">Control de versiones</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  {volumeVersions.length > 0 ? (
                    <>
                      <SelectControl className="w-full rounded-md border bg-background p-2 text-sm" value={selectedVersionId} onChange={(event) => onSelectedVersionChange(event.target.value)}>
                        {volumeVersions.map((version) => (
                          <option key={version.id} value={version.id}>
                            V{version.version} · {versionStatusLabel(version.status)}
                          </option>
                        ))}
                      </SelectControl>
                      {selectedVersion ? (
                        <div className="rounded-md border p-2">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">V{selectedVersion.version}</span>
                            <Badge variant={versionStatusVariant(selectedVersion.status)}>
                              {versionStatusLabel(selectedVersion.status)}
                            </Badge>
                          </div>
                          <div className="text-xs text-muted-foreground">Hora de creación:{new Date(selectedVersion.createdAt).toLocaleString()}</div>
                          <div className="mt-1 line-clamp-4 text-xs text-muted-foreground">{selectedVersion.diffSummary || "Aún no hay resumen de diferencias"}</div>
                        </div>
                      ) : null}
                    </>
                  ) : (
                    <div className="text-xs text-muted-foreground">Aún no existe una versión en volumen. Guarde primero la versión borrador.</div>
                  )}
                  <div className="flex flex-wrap gap-2">
                    <Button onClick={onCreateDraftVersion} disabled={isCreatingDraftVersion || volumes.length === 0}>
                      {isCreatingDraftVersion ? "Guardando..." : "Guardar como versión borrador"}
                    </Button>
                    <Button variant="outline" onClick={onLoadSelectedVersionToDraft} disabled={!selectedVersionId}>Sobrescribir el borrador actual</Button>
                    <Button variant="secondary" onClick={onActivateVersion} disabled={isActivatingVersion || !selectedVersionId}>
                      {isActivatingVersion ? "Entrando en vigor..." : "Establecer como versión efectiva"}
                    </Button>
                    <Button variant="outline" onClick={onFreezeVersion} disabled={isFreezingVersion || !selectedVersionId}>
                      {isFreezingVersion ? "Congelando..." : "Congelar la versión actual"}
                    </Button>
                    <Button variant="outline" onClick={onLoadVersionDiff} disabled={isLoadingVersionDiff || !selectedVersionId}>
                      {isLoadingVersionDiff ? "Cargando..." : "Ver diferencias de versión"}
                    </Button>
                  </div>
                  {diffResult ? (
                    <div className="rounded-md border p-2 text-xs">
                      <div className="font-medium">Vista previa de diferencia V{diffResult.version}</div>
                      <div className="text-muted-foreground">cambiar volumen {diffResult.changedVolumeCount} | Capítulos afectados {diffResult.changedChapterCount} | Cambiar el número de filas {diffResult.changedLines}</div>
                    </div>
                  ) : null}
                </CardContent>
              </Card>

              <Card className="self-start border-0 bg-muted/15 shadow-none">
                <CardHeader>
                  <CardTitle className="text-base">Análisis de impacto</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex flex-wrap gap-2">
                    <AiButton variant="outline" onClick={onAnalyzeDraftImpact} disabled={isAnalyzingDraftImpact || volumes.length === 0}>
                      {isAnalyzingDraftImpact ? "Analizando..." : "Analizar el borrador actual"}
                    </AiButton>
                    <AiButton variant="outline" onClick={onAnalyzeVersionImpact} disabled={isAnalyzingVersionImpact || !selectedVersionId}>
                      {isAnalyzingVersionImpact ? "Analizando..." : "Analizar la versión actual"}
                    </AiButton>
                  </div>
                  {impactResult ? (
                    <div className="space-y-3 rounded-md border p-3 text-xs">
                      <div className="font-medium">Vista previa del impacto del nivel de volumen</div>
                      <div className="text-muted-foreground">volumen de impacto {impactResult.affectedVolumeCount} | Capítulos afectados {impactResult.affectedChapterCount} | Cambiar el número de filas {impactResult.changedLines}</div>
                      {impactResult.affectedBeats && impactResult.affectedBeats.length > 0 ? (
                        <div className="space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            {impactResult.defaultImpactAction ? <Badge variant="default">{impactResult.defaultImpactAction}</Badge> : null}
                            {typeof impactResult.staleBeatCount === "number" ? <Badge variant="outline">Párrafo no escrito {impactResult.staleBeatCount}</Badge> : null}
                            {typeof impactResult.lockedBeatCount === "number" && impactResult.lockedBeatCount > 0 ? (
                              <Badge variant="secondary">Segmento de bloqueo {impactResult.lockedBeatCount}</Badge>
                            ) : null}
                          </div>
                          <div className="space-y-2">
                            {impactResult.affectedBeats.slice(0, 8).map((beat) => (
                              <div key={`${beat.volumeId}-${beat.beatKey}`} className="rounded-md bg-background/70 p-2">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="font-medium">Cap.{beat.volumeOrder}Volumen · {beat.beatLabel}{beat.beatTitle ? ` · ${beat.beatTitle}` : ""}</span>
                                  <Badge variant={getBeatImpactStatusVariant(beat.status)}>
                                    {getBeatImpactStatusLabel(beat.status)}
                                  </Badge>
                                </div>
                                <div className="mt-1 text-muted-foreground">{formatBeatChapterOrders(beat.chapterOrders)}</div>
                              </div>
                            ))}
                          </div>
                          {impactResult.advancedImpactActions && impactResult.advancedImpactActions.length > 0 ? (
                            <div className="text-muted-foreground">
                              Acciones avanzadas:{impactResult.advancedImpactActions.join(" / ")}
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <div className="text-xs text-muted-foreground">Se recomienda realizar un análisis de impacto a nivel de volumen antes de que entre en vigor.</div>
                  )}
                </CardContent>
              </Card>
            </div>
          </details>
        </div>

        <Tabs value={workspaceTab} onValueChange={(value) => setWorkspaceTab(value as OutlineWorkspaceTab)} className="space-y-4">
          <TabsList className="h-auto flex-wrap justify-start bg-muted/60 p-1">
            <TabsTrigger value="current">Volumen actual</TabsTrigger>
            <TabsTrigger value="strategy">Descripción estratégica</TabsTrigger>
            <TabsTrigger value="assets">Restricciones de activos</TabsTrigger>
          </TabsList>

        <TabsContent value="strategy" className="mt-0 space-y-4">
        <Card className="border-0 bg-muted/15 shadow-none">
          <CardHeader className="pb-3">
            <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <CardTitle className="text-base">Resumen de estrategia de volumen</CardTitle>
                <div className="text-sm text-muted-foreground">Primero mire las recompensas de nivel de volumen y las rutas de actualización de todo el libro, y luego seleccione un volumen a continuación para ingresar a la edición detallada.</div>
              </div>
              <div className="flex flex-wrap gap-2">
                {strategyPlan ? (
                  <>
                    <Badge variant="outline">recomendar {strategyPlan.recommendedVolumeCount} Rollo</Badge>
                    <Badge variant="secondary">Planificación difícil {strategyPlan.hardPlannedVolumeCount} Rollo</Badge>
                  </>
                ) : null}
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {strategyPlan ? (
              <>
                <div className="grid gap-3 xl:grid-cols-3">
                  <div className="rounded-xl border border-border/70 bg-muted/20 p-4">
                    <div className="text-xs text-muted-foreground">gradiente de recompensa del lector</div>
                    <div className="mt-2 text-sm leading-6 text-foreground">{strategyPlan.readerRewardLadder}</div>
                  </div>
                  <div className="rounded-xl border border-border/70 bg-muted/20 p-4">
                    <div className="text-xs text-muted-foreground">Actualizar gradiente</div>
                    <div className="mt-2 text-sm leading-6 text-foreground">{strategyPlan.escalationLadder}</div>
                  </div>
                  <div className="rounded-xl border border-border/70 bg-muted/20 p-4">
                    <div className="text-xs text-muted-foreground">Turno de mitad de juego</div>
                    <div className="mt-2 text-sm leading-6 text-foreground">{strategyPlan.midpointShift}</div>
                  </div>
                </div>
                <div className="rounded-xl border border-border/70 p-4 text-sm text-muted-foreground">
                  <div className="text-xs">Descripción general del ritmo del nivel de volumen</div>
                  <div className="mt-2 leading-6">
                    {strategyPlan.volumes
                      .map((volume) => `Cap.${volume.sortOrder}Rollo:${volume.roleLabel},${volume.coreReward}`)
                      .join(";")}
                  </div>
                </div>
              </>
            ) : (
              <div className="rounded-md border border-dashed p-4 text-xs text-muted-foreground">
                Actualmente no hay recomendaciones de estrategias de volumen. Primero haga clic en "Generar sugerencias de estrategia de volumen".
              </div>
            )}
          </CardContent>
        </Card>
        </TabsContent>

        <TabsContent value="assets" className="mt-0 space-y-4">
        <BookPayoffLedgerCard
          latestStateSnapshot={latestStateSnapshot}
          payoffLedger={payoffLedger}
        />

        <OutlineResourceCommitments
          selectedVolume={selectedVolume}
          resources={characterResources}
        />
        </TabsContent>

        <TabsContent value="current" className="mt-0">
          <OutlineCurrentVolumeWorkspace
            selectedVolume={selectedVolume}
            strategyPlan={strategyPlan}
            volumes={volumes}
            onSelectedVolumeChange={setSelectedVolumeId}
            onAddVolume={onAddVolume}
            onRemoveVolume={onRemoveVolume}
            onMoveVolume={onMoveVolume}
            onVolumeFieldChange={onVolumeFieldChange}
            onOpenPayoffsChange={onOpenPayoffsChange}
            onGoToStructuredTab={onGoToStructuredTab}
          />
        </TabsContent>
        </Tabs>
      </div>
      </section>
    </div>
  );
}
