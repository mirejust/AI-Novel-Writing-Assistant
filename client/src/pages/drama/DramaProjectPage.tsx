import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  CheckCircle2,
  Download,
  RefreshCw,
  Save,
  Wand2,
} from "lucide-react";
import {
  assembleDramaSourceBundle,
  checkDramaProjectCompliance,
  createDramaEpisodeBatchJob,
  createDramaVideoProviderTask,
  downloadDramaEpisodeExport,
  downloadDramaExport,
  generateDramaEpisodeScript,
  generateDramaOutline,
  generateDramaStoryboard,
  generateDramaStrategy,
  generateDramaShotKeyframe,
  generateDramaVideoPrompt,
  getDramaProject,
  importDramaCharacterFromLibrary,
  listDramaCharacterLibrary,
  listDramaTTSProviders,
  listDramaVideoProviders,
  repairDramaEpisode,
  refreshDramaVideoProviderTask,
  reviewDramaEpisode,
  saveDramaCharacterToLibrary,
  type DramaBatchCostBreakdown,
  type DramaEpisodeExportFormat,
  type DramaEpisode,
  type DramaProjectDetail,
  updateDramaCharacter,
  updateDramaEpisode,
} from "@/api/drama";
import { queryKeys } from "@/api/queryKeys";
import { DramaCharactersPanel } from "@/pages/drama/components/DramaCharactersPanel";
import { DramaEpisodeAudioPanel } from "@/pages/drama/components/DramaEpisodeAudioPanel";
import { DramaNextStepPanel } from "@/pages/drama/components/DramaNextStepPanel";
import { DramaQualityPanel } from "@/pages/drama/components/DramaQualityPanel";
import { DramaSourcePanel } from "@/pages/drama/components/DramaSourcePanel";
import { DramaVisualPanel } from "@/pages/drama/components/DramaVisualPanel";
import { dramaTrackLabel } from "@/pages/drama/dramaDisplay";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/components/ui/toast";

type DramaTab = "source" | "strategy" | "episodes" | "quality" | "characters" | "visual" | "export";

const TABS: Array<{ key: DramaTab; label: string }> = [
  { key: "source", label: "Material de origen" },
  { key: "strategy", label: "Estrategia de sketch" },
  { key: "episodes", label: "Guión del episodio" },
  { key: "quality", label: "Problemas de calidad" },
  { key: "characters", label: "Personaje" },
  { key: "visual", label: "Vídeo del guión gráfico" },
  { key: "export", label: "Exportar" },
];

function statusLabel(status: string): string {
  const labels: Record<string, string> = {
    draft: "Preparación de materiales",
    strategized: "Se ha generado la política",
    outlined: "El episodio ha sido generado.",
    scripting: "Se está generando el guión",
    completed: "Completado",
    planned: "Guión a generar",
    scripted: "Se ha generado el script",
    reviewed: "Comprobado",
    needs_repair: "Necesita reparación",
    approved: "Aprobado",
  };
  return labels[status] ?? status;
}

function safeJson<T>(input: string | null | undefined, fallback: T): T {
  if (!input) {
    return fallback;
  }
  try {
    return JSON.parse(input) as T;
  } catch {
    return fallback;
  }
}

function compactText(input: unknown): string {
  if (typeof input === "string") {
    return input;
  }
  if (input == null) {
    return "";
  }
  return JSON.stringify(input, null, 2);
}

const STRATEGY_LABELS: Record<string, string> = {
  positioning: "Posicionamiento de la audiencia",
  mainPleasureLine: "Línea de punto principal",
  paywallNote: "Planificación de puntos de tarjeta de pago",
  paywallPlan: "Plan de puntos de tarjeta paga",
  emotionCurveNote: "Curva de sentimiento",
  deviationDeclaration: "Límite de adaptación",
};

const SCORE_LABELS: Record<string, string> = {
  hook: "Gancho de apertura",
  density: "Densidad de información",
  paywall: "Pagar puntos de tarjeta",
  emotion: "Curva de sentimiento",
  duration: "Duración",
  consistency: "Consistencia",
  overall: "Integral",
};

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function readBatchCost(raw: string | null | undefined): DramaBatchCostBreakdown | null {
  const parsed = safeJson<{ cost?: DramaBatchCostBreakdown }>(raw, {});
  return parsed.cost ?? null;
}

function summarizeBatchCosts(project: DramaProjectDetail): DramaBatchCostBreakdown | null {
  const costs = (project.batchJobs ?? [])
    .map((job) => readBatchCost(job.progress))
    .filter((cost): cost is DramaBatchCostBreakdown => Boolean(cost));
  if (!costs.length) {
    return null;
  }
  const currency = costs[0]?.currency ?? "CNY";
  return {
    currency,
    estimated: costs.reduce((sum, cost) => sum + (cost.estimated ?? 0), 0),
    actual: costs.reduce((sum, cost) => sum + (cost.actual ?? 0), 0),
    estimatedUnits: {},
    actualUnits: {},
    unit: {},
  };
}

function formatBatchCost(cost: DramaBatchCostBreakdown, amount: number): string {
  return `${cost.currency} ${amount.toFixed(2)}`;
}

function ProjectProgress(props: { project: DramaProjectDetail }) {
  const hasBundle = Boolean(props.project.sourceBundle);
  const hasStrategy = Boolean(props.project.strategy);
  const episodeCount = props.project.episodes?.length ?? 0;
  const scriptedCount = props.project.episodes?.filter((episode) => Boolean(episode.content?.trim())).length ?? 0;
  const reviewedCount = props.project.episodes?.filter((episode) =>
    ["reviewed", "needs_repair", "approved"].includes(episode.status)
  ).length ?? 0;
  const steps = [
    { label: "Paquete de materiales", done: hasBundle },
    { label: "Estrategia", done: hasStrategy },
    { label: "Diversidad", done: episodeCount > 0 },
    { label: "Guion", done: scriptedCount > 0 },
    { label: "Calidad", done: reviewedCount > 0 },
  ];

  return (
    <div className="grid gap-2 sm:grid-cols-5">
      {steps.map((step) => (
        <div key={step.label} className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
          <CheckCircle2 className={step.done ? "h-4 w-4 text-emerald-600" : "h-4 w-4 text-muted-foreground"} />
          <span>{step.label}</span>
        </div>
      ))}
    </div>
  );
}

function StrategyPanel({ project }: { project: DramaProjectDetail }) {
  const strategy = safeJson<Record<string, unknown>>(project.strategy, {});
  const entries = Object.entries(strategy);
  if (!project.strategy) {
    return <div className="rounded-md border border-dashed p-6 text-sm text-muted-foreground">Aún no se ha generado ninguna estrategia de sketch.</div>;
  }
  return (
    <div className="grid gap-3 lg:grid-cols-2">
      {entries.length > 0 ? entries.map(([key, value]) => (
        <Card key={key} className="rounded-lg">
          <CardHeader>
            <CardTitle className="text-base">{STRATEGY_LABELS[key] ?? key}</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="whitespace-pre-wrap break-words text-sm leading-6 text-muted-foreground">{compactText(value)}</pre>
          </CardContent>
        </Card>
      )) : (
        <Card className="rounded-lg">
          <CardContent className="pt-6">
            <pre className="whitespace-pre-wrap break-words text-sm leading-6 text-muted-foreground">{project.strategy}</pre>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function EpisodeCard(props: {
  episode: DramaEpisode;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      className={`w-full rounded-lg border p-3 text-left text-sm transition ${props.selected ? "border-primary bg-primary/5" : "hover:border-primary/50"}`}
      onClick={props.onSelect}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium">Cap. {props.episode.order} Colocar</span>
        <Badge variant={props.episode.isPaywall ? "default" : "secondary"}>{props.episode.isPaywall ? "Pagar puntos de tarjeta" : "Conjunto ordinario"}</Badge>
        <Badge variant="outline">{statusLabel(props.episode.status)}</Badge>
      </div>
      <div className="mt-2 font-medium">{props.episode.title}</div>
      <div className="mt-1 line-clamp-2 text-muted-foreground">{props.episode.hookOpening || props.episode.cliffhanger || "Aún no hay información sobre el gancho"}</div>
    </button>
  );
}

function QualityFlags({ episode }: { episode: DramaEpisode }) {
  const quality = safeJson<{
    status?: string;
    score?: Record<string, number>;
    flags?: Array<{ severity?: string; code?: string; evidence?: string; suggestion?: string }>;
    repairPlan?: { mode?: string; instruction?: string };
  }>(episode.qualityFlags, {});
  if (!episode.qualityFlags) {
    return <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">Aún no hay resultados de control de calidad.</div>;
  }
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={quality.status === "approved" ? "default" : "secondary"}>{quality.status || "Comprobado"}</Badge>
        {quality.score?.overall != null ? <span className="text-sm text-muted-foreground">integral {quality.score.overall}</span> : null}
      </div>
      {quality.score ? (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {Object.entries(quality.score).map(([key, value]) => (
            <div key={key} className="rounded-md border px-3 py-2 text-sm">
              <div className="text-xs text-muted-foreground">{SCORE_LABELS[key] ?? key}</div>
              <div className="mt-1 font-medium">{value}</div>
            </div>
          ))}
        </div>
      ) : null}
      {quality.flags?.length ? (
        <div className="space-y-2">
          {quality.flags.map((flag, index) => (
            <div key={`${flag.code ?? "flag"}-${index}`} className="rounded-md border p-3 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">{flag.severity || "notice"}</Badge>
                <span className="font-medium">{flag.code || "Consejos de calidad"}</span>
              </div>
              <p className="mt-2 text-muted-foreground">{flag.evidence}</p>
              <p className="mt-1">{flag.suggestion}</p>
            </div>
          ))}
        </div>
      ) : null}
      {quality.repairPlan?.instruction ? (
        <div className="rounded-md border border-dashed p-3 text-sm">
          <div className="font-medium">Solución sugerida</div>
          <p className="mt-1 text-muted-foreground">{quality.repairPlan.instruction}</p>
        </div>
      ) : null}
    </div>
  );
}

function episodeFields(episode?: DramaEpisode) {
  return {
    title: episode?.title ?? "",
    hookOpening: episode?.hookOpening ?? "",
    cliffhanger: episode?.cliffhanger ?? "",
    content: episode?.content ?? "",
    durationSec: episode?.durationSec != null ? String(episode.durationSec) : "",
  };
}
type EpisodeFields = ReturnType<typeof episodeFields>;

function EpisodesPanel(props: {
  drafts: Record<string, EpisodeFields>;
  onEdit: (episode: DramaEpisode, fields: EpisodeFields) => void;
  project: DramaProjectDetail;
  selectedOrder: number | null;
  onSelectOrder: (order: number) => void;
  ttsProviders: Array<{ provider: string; label: string; description?: string }>;
  onBatchJob: (order: number, input: { type: "tts"; provider?: string; failedShotIds?: string[] }) => void;
  onGenerateScript: (order: number) => void;
  onReview: (order: number) => void;
  onRepair: (order: number) => void;
  onSave: (order: number, input: EpisodeFields) => void;
  busy: boolean;
}) {
  const episodes = props.project.episodes ?? [];
  const selectedEpisode = episodes.find((episode) => episode.order === props.selectedOrder) ?? episodes[0];
  const unsaved = selectedEpisode && props.drafts[selectedEpisode.id];
  const draft = unsaved ?? episodeFields(selectedEpisode);
  const setDraft = (update: (current: EpisodeFields) => EpisodeFields) => {
    if (selectedEpisode) props.onEdit(selectedEpisode, update(draft));
  };

  if (episodes.length === 0) {
    return <div className="rounded-md border border-dashed p-6 text-sm text-muted-foreground">Aún no hay un resumen del episodio. Primero genera los primeros 12 episodios.</div>;
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[360px_1fr]">
      <div className="space-y-2">
        {episodes.map((episode) => (
          <EpisodeCard
            key={episode.id}
            episode={episode}
            selected={selectedEpisode?.id === episode.id}
            onSelect={() => props.onSelectOrder(episode.order)}
          />
        ))}
      </div>
      {selectedEpisode ? (
        <Card className="rounded-lg">
          <CardHeader className="gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-2">
              <CardTitle className="text-lg">Cap. {selectedEpisode.order} Colocar:{selectedEpisode.title}</CardTitle>
              {unsaved ? <p role="status" className="text-sm text-warning">Este episodio tiene cambios no guardados. Puede regresar y continuar editando después de cambiar de episodio o etiqueta.</p> : null}
              <CardDescription>{selectedEpisode.hookOpening || "Aún no se ha escrito el gancho inicial para este episodio."}</CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" type="button" disabled={props.busy} onClick={() => props.onGenerateScript(selectedEpisode.order)}>
                <Wand2 className="h-4 w-4" />
                Generar guión
              </Button>
              <Button size="sm" type="button" variant="outline" disabled={props.busy || !selectedEpisode.content?.trim()} onClick={() => props.onReview(selectedEpisode.order)}>
                <CheckCircle2 className="h-4 w-4" />
                control de calidad
              </Button>
              <Button size="sm" type="button" variant="outline" disabled={props.busy || !selectedEpisode.content?.trim()} onClick={() => props.onRepair(selectedEpisode.order)}>
                <RefreshCw className="h-4 w-4" />
                reparar
              </Button>
              <Button size="sm" type="button" variant="outline" disabled={props.busy} onClick={() => props.onSave(selectedEpisode.order, draft)}>
                <Save className="h-4 w-4" />
                Guardar ediciones
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-md border p-3 text-sm">Duración:{selectedEpisode.durationSec ?? "Pendiente de generar"} Segundo</div>
              <div className="rounded-md border p-3 text-sm">Patrimonio neto emocional:{selectedEpisode.emotionNet ?? "Pendiente de generar"}</div>
              <div className="rounded-md border p-3 text-sm">Estado:{statusLabel(selectedEpisode.status)}</div>
            </div>
            <section className="space-y-2">
              <h3 className="text-sm font-medium">Información sobre este episodio</h3>
              <div className="grid gap-3 lg:grid-cols-2">
                <label className="block space-y-1.5 text-sm">
                  <span className="font-medium">Título</span>
                  <input className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={draft.title} onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))} />
                </label>
                <label className="block space-y-1.5 text-sm">
                  <span className="font-medium">Duración estimada (segundos)</span>
                  <input className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={draft.durationSec} onChange={(event) => setDraft((current) => ({ ...current, durationSec: event.target.value }))} />
                </label>
                <label className="block space-y-1.5 text-sm lg:col-span-2">
                  <span className="font-medium">Gancho de apertura</span>
                  <textarea className="min-h-20 w-full rounded-md border bg-background px-3 py-2 text-sm" value={draft.hookOpening} onChange={(event) => setDraft((current) => ({ ...current, hookOpening: event.target.value }))} />
                </label>
                <label className="block space-y-1.5 text-sm lg:col-span-2">
                  <span className="font-medium">Punto atascado al final</span>
                  <textarea className="min-h-20 w-full rounded-md border bg-background px-3 py-2 text-sm" value={draft.cliffhanger} onChange={(event) => setDraft((current) => ({ ...current, cliffhanger: event.target.value }))} />
                </label>
              </div>
            </section>
            <section className="space-y-2">
              <h3 className="text-sm font-medium">Guion</h3>
              <textarea
                className="min-h-[420px] w-full rounded-md border bg-background px-3 py-2 text-sm leading-6"
                value={draft.content}
                placeholder="El guión aún no se ha generado. Puede generarse primero o escribirse manualmente."
                onChange={(event) => setDraft((current) => ({ ...current, content: event.target.value }))}
              />
            </section>
            <section className="space-y-2">
              <h3 className="text-sm font-medium">Resultados de calidad</h3>
              <QualityFlags episode={selectedEpisode} />
            </section>
            <DramaEpisodeAudioPanel
              projectId={props.project.id}
              episode={selectedEpisode}
              batchJobs={props.project.batchJobs}
              ttsProviders={props.ttsProviders}
              busy={props.busy}
              onBatchJob={props.onBatchJob}
            />
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

export default function DramaProjectPage() {
  const { id } = useParams();
  return <DramaProjectWorkspace key={id} id={id} />;
}

function DramaProjectWorkspace({ id }: { id?: string }) {
  const [drafts, setDrafts] = useState<Record<string, EpisodeFields>>({});
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<DramaTab>("source");
  const [selectedOrder, setSelectedOrder] = useState<number | null>(null);
  const [selectedVideoProvider, setSelectedVideoProvider] = useState("mock");

  const projectQuery = useQuery({
    queryKey: queryKeys.drama.project(id ?? "none"),
    queryFn: () => getDramaProject(id!),
    enabled: Boolean(id),
  });
  const characterLibraryQuery = useQuery({
    queryKey: queryKeys.drama.characterLibrary(id),
    queryFn: () => listDramaCharacterLibrary(id),
    enabled: Boolean(id),
  });
  const videoProvidersQuery = useQuery({
    queryKey: queryKeys.drama.videoProviders,
    queryFn: listDramaVideoProviders,
  });
  const ttsProvidersQuery = useQuery({
    queryKey: queryKeys.drama.ttsProviders,
    queryFn: listDramaTTSProviders,
  });

  const project = projectQuery.data?.data;
  const videoProviders = videoProvidersQuery.data?.data ?? [];
  const ttsProviders = ttsProvidersQuery.data?.data ?? [];
  const activeVideoProvider = videoProviders.some((provider) => provider.provider === selectedVideoProvider)
    ? selectedVideoProvider
    : videoProviders[0]?.provider ?? "mock";
  const selectedOrderValue = useMemo(() => {
    if (selectedOrder) {
      return selectedOrder;
    }
    return project?.episodes?.[0]?.order ?? null;
  }, [project?.episodes, selectedOrder]);
  const batchCostSummary = project ? summarizeBatchCosts(project) : null;

  const invalidateProject = async () => {
    if (!id) {
      return;
    }
    await queryClient.invalidateQueries({ queryKey: queryKeys.drama.project(id) });
    await queryClient.invalidateQueries({ queryKey: queryKeys.drama.projects });
    await queryClient.invalidateQueries({ queryKey: queryKeys.drama.characterLibrary(id) });
  };

  const actionMutation = useMutation({
    mutationFn: async (input: { action: () => Promise<unknown>; message: string }) => {
      await input.action();
      return input.message;
    },
    onSuccess: async (message) => {
      await invalidateProject();
      toast.success(message);
    },
  });

  const runAction = (action: () => Promise<unknown>, message: string) => {
    return actionMutation.mutateAsync({ action, message });
  };

  const handleExport = async (format: "markdown" | "json") => {
    if (!project) {
      return;
    }
    const blob = await downloadDramaExport(project.id, format);
    downloadBlob(blob, `${project.title}-short-drama.${format === "json" ? "json" : "md"}`);
  };

  const handleEpisodeExport = async (order: number, format: DramaEpisodeExportFormat) => {
    if (!project) {
      return;
    }
    const blob = await downloadDramaEpisodeExport(project.id, order, format);
    const suffix = format === "timeline-json" ? "timeline.json" : "srt";
    downloadBlob(blob, `${project.title}-E${order}.${suffix}`);
  };

  const handleSaveEpisode = (order: number, input: EpisodeFields) => {
    if (!project) {
      return;
    }
    const durationSec = input.durationSec.trim() ? Number(input.durationSec) : undefined;
    if (!input.title.trim()) {
      toast.error("Por favor complete el título de este episodio.");
      return;
    }
    const episode = project.episodes?.find(item => item.order === order);
    if (!episode) return;
    void runAction(
      () => updateDramaEpisode(project.id, order, {
        title: input.title.trim(),
        hookOpening: input.hookOpening.trim() || null,
        cliffhanger: input.cliffhanger.trim() || null,
        content: input.content,
        durationSec: durationSec !== undefined && Number.isFinite(durationSec) ? durationSec : null,
      }),
      `Cap. ${order} Conjunto guardado.`,
    ).then(() => {
      setDrafts(current => {
        if (current[episode.id] !== input) return current;
        const next = { ...current };
        delete next[episode.id];
        return next;
      });
    }).catch(() => { /* The request reports the error; retain the draft for retry. */ });
  };

  const changeEpisodeScript = (order: number, repair: boolean) => {
    const episode = project?.episodes?.find(item => item.order === order);
    if (!episode || !project) return;
    if (drafts[episode.id]) {
      setSelectedOrder(order);
      setActiveTab("episodes");
      toast.info("Primero guarde la modificación manual de este episodio y luego deje que AI modifique el guión.");
      return;
    }
    return repair
      ? runAction(() => repairDramaEpisode(project.id, order), `Cap. ${order} El conjunto se ha arreglado según las recomendaciones de calidad.`)
      : runAction(() => generateDramaEpisodeScript(project.id, order), `Cap. ${order} Se ha generado el script establecido.`);
  };

  if (projectQuery.isLoading) {
    return <div className="rounded-md border p-4 text-sm text-muted-foreground">Cargando proyectos de sketches...</div>;
  }

  if (!project) {
    return (
      <div className="space-y-4">
        <Button asChild variant="outline" size="sm">
          <Link to="/drama"><ArrowLeft className="h-4 w-4" />Volver al banco de trabajo de drama corto</Link>
        </Button>
        <div className="rounded-md border border-dashed p-6 text-sm text-muted-foreground">Este elemento de juego corto no fue encontrado.</div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <Button asChild variant="ghost" size="sm" className="px-0">
            <Link to="/drama"><ArrowLeft className="h-4 w-4" />Banco de trabajo de drama corto</Link>
          </Button>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-normal">{project.title}</h1>
            <Badge variant="secondary">{statusLabel(project.status)}</Badge>
            <Badge variant="outline">{dramaTrackLabel(project.track)}</Badge>
            <Badge variant="outline">{project.targetEpisodes} Colocar</Badge>
            {batchCostSummary ? (
              <Badge variant="outline">
                Gastos de producción: usado {formatBatchCost(batchCostSummary, batchCostSummary.actual)} / esperado {formatBatchCost(batchCostSummary, batchCostSummary.estimated)}
              </Badge>
            ) : null}
          </div>
          <p className="text-sm text-muted-foreground">
            Avance este breve drama en el orden de "Material → Estrategia → Episodio → Guión → Calidad → Video del guión gráfico".
          </p>
        </div>
        <Button type="button" variant="outline" disabled={projectQuery.isFetching} onClick={() => void projectQuery.refetch()}>
          <RefreshCw className="h-4 w-4" />
          refrescar
        </Button>
      </div>

      <ProjectProgress project={project} />

      <DramaNextStepPanel
        project={project}
        busy={actionMutation.isPending}
        onSetTab={setActiveTab}
        onSelectEpisode={setSelectedOrder}
        onAssembleSource={() => runAction(() => assembleDramaSourceBundle(project.id), "Se han recopilado los materiales de juego breve.")}
        onGenerateStrategy={() => runAction(() => generateDramaStrategy(project.id), "Estrategia de sketch generada.")}
        onGenerateOutline={() => {
          const unsaved = project.episodes?.find(episode => episode.order <= 12 && drafts[episode.id]);
          if (unsaved) {
            setSelectedOrder(unsaved.order);
            setActiveTab("episodes");
            toast.info(`Por favor guarda el primero ${unsaved.order} Modificaciones a los episodios y regeneración de los primeros 12 episodios.`);
            return;
          }
          return runAction(() => generateDramaOutline(project.id, { startOrder: 1, count: 12 }), "Se han producido los primeros 12 episodios.");
        }}
        onGenerateScript={order => changeEpisodeScript(order, false)}
        onReviewEpisode={(order) => runAction(() => reviewDramaEpisode(project.id, order), `Cap. ${order} Inspección de calidad del conjunto completada.`)}
        onRepairEpisode={order => changeEpisodeScript(order, true)}
        onGenerateStoryboard={(order) => runAction(() => generateDramaStoryboard(project.id, order), `Cap. ${order} Se ha generado el guión gráfico del episodio.`)}
        onGenerateVideoPrompt={(shot) => runAction(() => generateDramaVideoPrompt(project.id, shot.id), `lente ${shot.order} Se ha generado la palabra de aviso del vídeo.`)}
        onCreateProviderTask={(prompt) => runAction(() => createDramaVideoProviderTask(prompt.id, activeVideoProvider), "Se ha creado la tarea de vídeo.")}
        onExportMarkdown={() => void handleExport("markdown")}
      />

      <div className="flex gap-2 overflow-x-auto border-b pb-2">
        {TABS.map((tab) => (
          <Button
            key={tab.key}
            type="button"
            size="sm"
            variant={activeTab === tab.key ? "default" : "ghost"}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </Button>
        ))}
      </div>

      {activeTab === "source" ? <DramaSourcePanel project={project} /> : null}
      {activeTab === "strategy" ? <StrategyPanel project={project} /> : null}
      {activeTab === "episodes" ? (
        <EpisodesPanel
          drafts={drafts}
          onEdit={(episode, fields) => setDrafts(current => {
            const next = { ...current };
            if (JSON.stringify(fields) === JSON.stringify(episodeFields(episode))) delete next[episode.id];
            else next[episode.id] = fields;
            return next;
          })}
          project={project}
          selectedOrder={selectedOrderValue}
          onSelectOrder={setSelectedOrder}
          ttsProviders={ttsProviders}
          onBatchJob={(order, input) => runAction(() => createDramaEpisodeBatchJob(project.id, order, input), "Tarea de locución creada.")}
          busy={actionMutation.isPending}
          onGenerateScript={order => changeEpisodeScript(order, false)}
          onReview={(order) => runAction(() => reviewDramaEpisode(project.id, order), `Cap. ${order} Inspección de calidad del conjunto completada.`)}
          onRepair={order => changeEpisodeScript(order, true)}
          onSave={handleSaveEpisode}
        />
      ) : null}
      {activeTab === "quality" ? (
        <DramaQualityPanel
          project={project}
          busy={actionMutation.isPending}
          onSelectEpisode={setSelectedOrder}
          onOpenEpisodes={() => setActiveTab("episodes")}
          onReview={(order) => runAction(() => reviewDramaEpisode(project.id, order), `Cap. ${order} Inspección de calidad del conjunto completada.`)}
          onComplianceAll={() => runAction(() => checkDramaProjectCompliance(project.id), "Verificación previa de cumplimiento completada.")}
          onRepair={order => changeEpisodeScript(order, true)}
        />
      ) : null}
      {activeTab === "characters" ? (
        <DramaCharactersPanel
          project={project}
          library={characterLibraryQuery.data?.data ?? []}
          busy={actionMutation.isPending}
          onSave={(character, input) => {
            if (!input.name.trim()) {
              toast.error("Por favor completa el nombre del personaje.");
              return;
            }
            runAction(
              () => updateDramaCharacter(project.id, character.id, {
                name: input.name.trim(),
                archetype: input.screenRole.trim() || undefined,
                persona: input.audienceRead.trim() || undefined,
                speechStyle: input.lineRule.trim() || undefined,
                visualAnchor: input.visualAnchor.trim() || undefined,
                voiceProfile: input.voiceAnchor.trim() || undefined,
                relations: input.relationMap.trim() || undefined,
              }),
              `${input.name || character.name} Guardado.`,
            );
          }}
          onSaveToLibrary={(character) => runAction(
            () => saveDramaCharacterToLibrary(project.id, character.id),
            `${character.name} Guardado en la biblioteca de personajes.`,
          )}
          onImportFromLibrary={(libraryId) => runAction(
            () => importDramaCharacterFromLibrary(project.id, libraryId),
            "El rol se ha importado al proyecto actual.",
          )}
          onRefreshProject={() => void projectQuery.refetch()}
        />
      ) : null}
      {activeTab === "visual" ? (
        <DramaVisualPanel
          project={project}
          selectedOrder={selectedOrderValue}
          onSelectOrder={setSelectedOrder}
          busy={actionMutation.isPending}
          onStoryboard={(order) => runAction(() => generateDramaStoryboard(project.id, order), `Cap. ${order} Se ha generado el guión gráfico del episodio.`)}
          onBatchJob={(order, input) => runAction(() => createDramaEpisodeBatchJob(project.id, order, input), "Se ha creado la tarea por lotes.")}
          onKeyframe={(shot, provider, useCharacterRefImages, overrides) => runAction(() => generateDramaShotKeyframe(project.id, shot.id, provider, useCharacterRefImages, overrides), `lente ${shot.order} Se ha generado el primer fotograma de la imagen.`)}
          onVideoPrompt={(shot) => runAction(() => generateDramaVideoPrompt(project.id, shot.id), `lente ${shot.order} Se ha generado la palabra de aviso del vídeo.`)}
          videoProviders={videoProviders}
          selectedProvider={activeVideoProvider}
          onSelectProvider={setSelectedVideoProvider}
          onProviderTask={(prompt, provider) => runAction(() => createDramaVideoProviderTask(prompt.id, provider), "Se ha creado la tarea de vídeo.")}
          onRefreshProviderTask={(prompt) => runAction(() => refreshDramaVideoProviderTask(prompt.id), "Se actualizó el estado de la tarea de video.")}
        />
      ) : null}
      {activeTab === "export" ? (
        <Card className="rounded-lg">
          <CardHeader>
            <CardTitle className="text-lg">Exportar datos de sketches</CardTitle>
            <CardDescription>Exporta los personajes, episodios y guiones generados del proyecto actual.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button type="button" onClick={() => void handleExport("markdown")}>
              <Download className="h-4 w-4" />
              Rebaja de exportación
            </Button>
            <Button type="button" variant="outline" onClick={() => void handleExport("json")}>
              <Download className="h-4 w-4" />
              Exportar JSON
            </Button>
            {selectedOrderValue ? (
              <>
                <Button type="button" variant="outline" onClick={() => void handleEpisodeExport(selectedOrderValue, "srt")}>
                  <Download className="h-4 w-4" />
                  Exportar este episodio SRT
                </Button>
                <Button type="button" variant="outline" onClick={() => void handleEpisodeExport(selectedOrderValue, "timeline-json")}>
                  <Download className="h-4 w-4" />
                  Exportar borrador de clip
                </Button>
              </>
            ) : null}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
