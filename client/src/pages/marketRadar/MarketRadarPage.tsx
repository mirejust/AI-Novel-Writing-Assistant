import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  MarketInfluenceMode,
  MarketRadarPlatform,
  MarketRadarSignal,
  MarketTrendReport,
} from "@ai-novel/shared/types/marketRadar";
import {
  resolveMarketRadarAnalysisAvailability,
  resolveMarketRadarPollingRunId,
  shouldResetMarketRadarSignalSelection,
} from "@ai-novel/shared/types/marketRadar";
import { ArrowRight, Check, ExternalLink, Loader2, Radar, RefreshCw, Sparkles, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  createMarketCreativeBrief,
  getLatestMarketRadarScan,
  getSavedMarketTopics,
  saveMarketTopic,
  deleteSavedMarketTopic,
  getMarketRadarScan,
  getMarketRadarSources,
  startMarketRadarAnalysis,
  startMarketRadarScan,
} from "@/api/marketRadar";
import { queryKeys } from "@/api/queryKeys";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

const PLATFORM_LABELS: Record<MarketRadarPlatform, string> = {
  fanqie: "Novela de tomate",
  qidian: "Sitio web chino Qidian",
  jinjiang: "Ciudad de la literatura de Jinjiang",
};

const KIND_LABELS: Record<MarketRadarSignal["kind"], string> = {
  genre: "Temas populares",
  protagonist: "Identidad protagonista",
  advantage: "Dedo dorado",
  opening: "Un comienzo caliente",
  relationship: "Punto de venta de la relación",
  title_pattern: "Patrón de oración de título",
  opportunity: "Oportunidades de diferenciación",
  crowding: "Rutina abarrotada",
};

const MODE_LABELS: Record<MarketInfluenceMode, string> = {
  follow_hot: "Seguir popular",
  differentiate: "Encuentra diferencias entre populares.",
  light: "Debilitar el mercado",
};

function recommendedSignalIds(report: MarketTrendReport): string[] {
  const recommended = report.signals.filter((signal) => signal.recommended);
  const opportunity = recommended.find((signal) => signal.kind === "opportunity");
  return [opportunity, ...recommended.filter((signal) => signal.id !== opportunity?.id)]
    .filter(Boolean).slice(0, 4).map((signal) => signal!.id);
}

function marketSourceKey(value: { platform: string; listKey: string }): string {
  return `${value.platform}:${value.listKey}`;
}

export default function MarketRadarPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [platforms, setPlatforms] = useState<MarketRadarPlatform[]>(["fanqie", "qidian", "jinjiang"]);
  const [activeRunId, setActiveRunId] = useState("");
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [selectedAnalysisItemIds, setSelectedAnalysisItemIds] = useState<string[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [viewTab, setViewTab] = useState<"rankings" | "analysis" | "saved">("rankings");
  const savedTopicsQuery = useQuery({ queryKey: queryKeys.marketRadar.savedTopics, queryFn: getSavedMarketTopics });
  const [influenceMode, setInfluenceMode] = useState<MarketInfluenceMode>("differentiate");
  const initialScanStarted = useRef(false);
  const analysisResultRef = useRef<HTMLDivElement | null>(null);
  const selectedSignalReportIdRef = useRef("");

  const sourcesQuery = useQuery({ queryKey: queryKeys.marketRadar.sources, queryFn: getMarketRadarSources });
  const latestScanQuery = useQuery({
    queryKey: queryKeys.marketRadar.latest,
    queryFn: getLatestMarketRadarScan,
  });
  const scanQuery = useQuery({
    queryKey: queryKeys.marketRadar.scan(activeRunId || "none"),
    queryFn: () => getMarketRadarScan(activeRunId),
    enabled: Boolean(activeRunId),
    refetchInterval: (query) => {
      const status = query.state.data?.data?.status;
      return status === "queued" || status === "running" || status === "analyzing" ? 1500 : false;
    },
  });
  const latestRun = latestScanQuery.data?.data ?? null;
  const currentRun = scanQuery.data?.data ?? null;
  const activeRun = currentRun && (currentRun.rankingItems.length > 0 || !latestRun)
    ? currentRun
    : latestRun;
  const availableReport = activeRun?.report ?? latestRun?.report ?? null;
  const report = showAnalysis ? availableReport : null;

  useEffect(() => {
    if (!availableReport || !shouldResetMarketRadarSignalSelection(selectedSignalReportIdRef.current, availableReport.id)) return;
    selectedSignalReportIdRef.current = availableReport.id;
    setSelectedIds(recommendedSignalIds(availableReport));
  }, [availableReport?.id]);

  useEffect(() => {
    if (report) analysisResultRef.current?.scrollIntoView({ block: "start" });
  }, [report?.id]);

  const scanMutation = useMutation({
    mutationFn: () => startMarketRadarScan(platforms),
    onSuccess: (response) => {
      const run = response.data;
      if (!run) return;
      setActiveRunId(run.id);
      queryClient.setQueryData(queryKeys.marketRadar.scan(run.id), response);
      setShowAnalysis(false);
      setSelectedAnalysisItemIds([]);
      selectedSignalReportIdRef.current = run.report?.id ?? "";
      setSelectedIds(run.report ? recommendedSignalIds(run.report) : []);
      void queryClient.invalidateQueries({ queryKey: queryKeys.marketRadar.latest });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "No se pudo escanear la lista, inténtelo nuevamente más tarde."),
  });
  const saveTopicMutation = useMutation({
    mutationFn: (signalId: string) => saveMarketTopic(report!.id, signalId),
    onSuccess: () => { void queryClient.invalidateQueries({ queryKey: queryKeys.marketRadar.savedTopics }); toast.success("El tema se ha agregado a la lista de temas populares."); },
    onError: (error) => toast.error(error instanceof Error ? error.message : "El tema de la colección falló."),
  });
  const deleteTopicMutation = useMutation({
    mutationFn: deleteSavedMarketTopic,
    onSuccess: () => { void queryClient.invalidateQueries({ queryKey: queryKeys.marketRadar.savedTopics }); toast.success("El tema ha sido cancelado."); },
    onError: () => toast.error("No se pudo cancelar la recolección."),
  });
  const analysisMutation = useMutation({
    mutationFn: () => startMarketRadarAnalysis(activeRun!.id, {
      selectedItemIds: selectedAnalysisItemIds,
    }),
    onSuccess: (response) => {
      const run = response.data;
      if (!run) return;
      queryClient.setQueryData(queryKeys.marketRadar.scan(run.id), response);
      if (run.status !== "analyzing" && run.report) {
        selectedSignalReportIdRef.current = run.report.id;
        setSelectedIds(recommendedSignalIds(run.report));
      }
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "El análisis de IA falló. Vuelve a intentarlo más tarde."),
  });
  const briefMutation = useMutation({
    mutationFn: () => createMarketCreativeBrief({ reportId: report!.id, signalIds: selectedIds, influenceMode }),
    onSuccess: (response) => {
      if (response.data) navigate(`/novels/auto-director?marketBriefId=${encodeURIComponent(response.data.id)}`);
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "No se pudo generar un resumen creativo de marketing."),
  });
  const savedTopicBriefMutation = useMutation({
    mutationFn: (topic: { reportId: string; signalId: string }) => createMarketCreativeBrief({
      reportId: topic.reportId,
      signalIds: [topic.signalId],
      influenceMode: "differentiate",
    }),
    onSuccess: (response) => {
      if (response.data) navigate(`/novels/auto-director?marketBriefId=${encodeURIComponent(response.data.id)}`);
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "La preparación para abrir la dirección del libro falló."),
  });
  useEffect(() => {
    if (initialScanStarted.current || latestScanQuery.isPending) return;
    initialScanStarted.current = true;
    if (!latestRun) scanMutation.mutate();
  }, [latestScanQuery.isPending, latestRun?.id]);

  const switchingToNewRun = Boolean(activeRunId && activeRunId !== latestRun?.id);
  const scanning = scanMutation.isPending
    || currentRun?.status === "queued"
    || currentRun?.status === "running"
    || (switchingToNewRun && !currentRun);
  const scanningProgress = Math.min(99, Math.round((currentRun?.progress ?? 0) * 100));
  const analyzing = analysisMutation.isPending || currentRun?.status === "analyzing";
  const analysisAvailability = resolveMarketRadarAnalysisAvailability({
    hasReport: Boolean(availableReport),
    scanning,
    analyzing,
    selectedItemCount: selectedAnalysisItemIds.length,
  });
  const pollingRunId = resolveMarketRadarPollingRunId(activeRunId, latestRun);

  useEffect(() => {
    if (pollingRunId && pollingRunId !== activeRunId) setActiveRunId(pollingRunId);
  }, [activeRunId, pollingRunId]);
  const displayingPreviousRun = Boolean(
    latestRun
    && activeRun?.id === latestRun.id
    && scanning,
  );
  const refreshFailure = latestRun && currentRun?.id !== latestRun.id && currentRun?.status === "failed"
    ? currentRun.lastError || "No se obtuvieron nuevos datos de la lista pública."
    : null;
  const rankingGroups = useMemo(() => {
    const groups = new Map<string, NonNullable<typeof activeRun>["rankingItems"]>();
    for (const item of activeRun?.rankingItems ?? []) {
      const key = `${item.platform}:${item.listKey}`;
      groups.set(key, [...(groups.get(key) ?? []), item]);
    }
    const isPrimaryList = (key: string) => key.endsWith(":new_book") || key.endsWith(":new_author");
    return [...groups.entries()]
      .sort(([left], [right]) => Number(isPrimaryList(right)) - Number(isPrimaryList(left)))
      .map(([key, items]) => ({
        key,
        platform: items[0].platform,
        listKey: items[0].listKey,
        items: items.sort((left, right) => left.rank - right.rank),
      }));
  }, [activeRun?.rankingItems]);
  const sourceLabels = useMemo(() => new Map((sourcesQuery.data?.data ?? []).map((source) => [`${source.platform}:${source.listKey}`, source.listLabel])), [sourcesQuery.data]);
  const rankingGroupSignature = rankingGroups.map((group) => group.key).join("|");

  useEffect(() => {
    if (scanning || rankingGroups.length === 0) return;
    const availableIds = new Set(rankingGroups.flatMap((group) => group.items.map((item) => item.id)));
    const reportItemIds = activeRun?.report?.analyzedItemIds?.filter((id) => availableIds.has(id)) ?? [];
    const reportListKeys = new Set(activeRun?.report?.analyzedLists?.map(marketSourceKey) ?? []);
    const primaryPlatforms = new Set(rankingGroups
      .filter((group) => group.listKey === "new_book" || group.listKey === "new_author")
      .map((group) => group.platform));
    const recommendedItemIds = rankingGroups
      .filter((group) => !primaryPlatforms.has(group.platform) || group.listKey === "new_book" || group.listKey === "new_author")
      .flatMap((group) => group.items.map((item) => item.id));
    const legacyReportItemIds = rankingGroups
      .filter((group) => reportListKeys.has(group.key))
      .flatMap((group) => group.items.map((item) => item.id));
    setSelectedAnalysisItemIds((current) => {
      const availableCurrent = current.filter((id) => availableIds.has(id));
      if (availableCurrent.length > 0) return availableCurrent;
      if (reportItemIds.length > 0) return reportItemIds;
      if (legacyReportItemIds.length > 0) return legacyReportItemIds;
      return recommendedItemIds;
    });
  }, [activeRun?.id, activeRun?.report?.id, rankingGroupSignature, scanning]);

  const togglePlatform = (platform: MarketRadarPlatform) => {
    setPlatforms((current) => current.includes(platform)
      ? current.length === 1 ? current : current.filter((item) => item !== platform)
      : [...current, platform]);
  };
  const toggleSignal = (id: string) => {
    setSelectedIds((current) => {
      if (current.includes(id)) return current.filter((item) => item !== id);
      if (current.length >= 5) { toast.error("Seleccione hasta 5 señales de mercado."); return current; }
      return [...current, id];
    });
  };
  const toggleAnalysisList = (itemIds: string[]) => {
    setSelectedAnalysisItemIds((current) => {
      const currentSet = new Set(current);
      const allSelected = itemIds.every((id) => currentSet.has(id));
      if (allSelected) return current.filter((id) => !itemIds.includes(id));
      return [...new Set([...current, ...itemIds])];
    });
  };
  const toggleAnalysisItem = (id: string) => {
    setSelectedAnalysisItemIds((current) => current.includes(id)
      ? current.filter((item) => item !== id)
      : [...current, id]);
  };
  const startNewAnalysis = () => {
    if (!activeRun) return;
    setActiveRunId(activeRun.id);
    setShowAnalysis(true);
    setViewTab("analysis");
    analysisMutation.mutate();
  };

  return (
    <div className="w-full min-w-0 space-y-6 py-6">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/35 pb-4">
        <h1 className="text-lg font-semibold tracking-tight">Radar de temas candentes</h1>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {Object.entries(PLATFORM_LABELS).map(([key, label]) => (
            <button key={key} type="button" onClick={() => togglePlatform(key as MarketRadarPlatform)} className={cn("rounded-full border px-3 py-1.5 text-sm transition", platforms.includes(key as MarketRadarPlatform) ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground")}>{label}</button>
          ))}
          <Button onClick={() => scanMutation.mutate()} disabled={scanMutation.isPending || scanning || sourcesQuery.isPending} variant="outline">
            {scanning ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            {scanning ? `Obteniendo la lista ${scanningProgress}%` : "Escanee la lista nuevamente"}
          </Button>
        </div>
      </div>

      <Tabs value={viewTab} onValueChange={(value) => { const next = value as typeof viewTab; setViewTab(next); setShowAnalysis(next === "analysis"); }}>
        <TabsList className="grid h-auto w-full grid-cols-3 rounded-lg bg-muted/45 p-1">
          <TabsTrigger value="rankings">Lista actual</TabsTrigger>
          <TabsTrigger value="analysis" disabled={!analysisAvailability.canViewReport && !analyzing}>Resultados del análisis de IA</TabsTrigger>
          <TabsTrigger value="saved">Lista de temas populares{savedTopicsQuery.data?.data?.length ? ` · ${savedTopicsQuery.data.data.length}` : ""}</TabsTrigger>
        </TabsList>
      </Tabs>

      {displayingPreviousRun ? (
        <Card className="border-primary/25 bg-primary/[0.035]">
          <CardContent className="p-4 text-sm text-muted-foreground">
             La lista pública se está actualizando y se muestran temporalmente los últimos resultados obtenidos.
          </CardContent>
        </Card>
      ) : null}

      {refreshFailure ? (
        <Card className="border-amber-300 bg-amber-50/60 dark:bg-amber-950/15">
          <CardContent className="p-4 text-sm text-amber-800 dark:text-amber-200">
            No se han obtenido nuevas clasificaciones en esta actualización y los últimos resultados obtenidos se conservan temporalmente:{refreshFailure}
          </CardContent>
        </Card>
      ) : null}

      {activeRun?.platformStatuses.some((item) => item.status !== "succeeded") ? (
        <Card className="border-amber-300 bg-amber-50/60 dark:bg-amber-950/15"><CardContent className="p-4 text-sm text-amber-800 dark:text-amber-200">Algunas listas no se pueden leer temporalmente, pero aún puedes ver y analizar los datos que se han obtenido con éxito:{activeRun.platformStatuses.filter((item) => item.status !== "succeeded").map((item) => `${PLATFORM_LABELS[item.platform]}:${item.error || "Error de lectura"}`).join(";")}</CardContent></Card>
      ) : null}
      {activeRun?.status === "failed" ? (
        <Card className="border-destructive/40"><CardContent className="p-4 text-sm text-destructive">Este barrido de lista no se ha completado:{activeRun.lastError || "No se obtuvieron datos de la lista pública que pudieran analizarse."}</CardContent></Card>
      ) : null}
      {activeRun?.lastError && activeRun.status !== "failed" ? (
        <Card className="border-amber-300 bg-amber-50/60 dark:bg-amber-950/15"><CardContent className="p-4 text-sm text-amber-800 dark:text-amber-200">{activeRun.lastError}</CardContent></Card>
      ) : null}

      {viewTab === "rankings" && (rankingGroups.length === 0 ? (
        <Card className="border-dashed"><CardContent className="flex min-h-72 flex-col items-center justify-center gap-3 text-center">{scanning ? <Loader2 className="h-10 w-10 animate-spin text-primary" /> : <Radar className="h-10 w-10 text-muted-foreground" />}<div className="font-medium">{scanning ? "Obteniendo lista pública" : "Aún no hay datos de lista para mostrar"}</div><p className="max-w-lg text-sm text-muted-foreground">Al ingresar a la página se escaneará automáticamente la lista. Una vez obtenida la lista, puede comprobar la clasificación original antes de decidir si desea que la IA la analice.</p></CardContent></Card>
      ) : <>
        <section className="flex flex-col gap-4 border-b border-border/50 pb-5 lg:flex-row lg:items-end lg:justify-between">
          <p className="text-sm text-muted-foreground">{availableReport
            ? `Seleccionado ${selectedAnalysisItemIds.length} Para este trabajo, se puede ajustar el alcance y generar nuevos análisis de IA; Se mantendrán los temas y sesiones informativas asociados con los informes existentes.`
            : `Seleccionado ${selectedAnalysisItemIds.length} Para este trabajo, puedes seleccionarlos todos en la esquina superior derecha de cada lista o ajustarlos uno por uno.`}</p>
          <div className="flex justify-end">
            <Button onClick={startNewAnalysis} disabled={analysisAvailability.startDisabled} className="shrink-0">
              {analyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {analyzing ? `Análisis de IA en progreso ${Math.round((activeRun?.progress ?? 0) * 100)}%` : scanning ? "Esperando que se obtenga la lista" : `${availableReport ? "Generar nuevo análisis" : "Iniciar análisis de IA"}(${selectedAnalysisItemIds.length} Libro)`}
            </Button>
          </div>
        </section>
        <div className="grid items-start gap-x-6 gap-y-8 md:grid-cols-2 2xl:grid-cols-3">
          {rankingGroups.map(({ key, items }) => {
            const itemIds = items.map((item) => item.id);
            const selectedCount = itemIds.filter((id) => selectedAnalysisItemIds.includes(id)).length;
            const allSelected = selectedCount === itemIds.length;
            return <Card key={key} className="flex h-[34rem] flex-col">
            <CardHeader className="flex-row items-start justify-between gap-3 border-b border-border/40 px-4 pb-4 pt-4">
              <div><CardTitle className="text-base">{PLATFORM_LABELS[items[0].platform]} · {sourceLabels.get(key) ?? items[0].listKey}</CardTitle><CardDescription className="mt-1">Esta identificación {items.length} Registros de lista pública (hasta 30 registros)</CardDescription></div>
              <Button type="button" variant="ghost" size="sm" aria-pressed={allSelected} disabled={analysisAvailability.selectionDisabled} onClick={() => toggleAnalysisList(itemIds)} className="shrink-0">
                {allSelected ? "Deseleccionar todo" : "Seleccionar todo"}{selectedCount > 0 && !allSelected ? ` ${selectedCount}/${items.length}` : ""}
              </Button>
            </CardHeader>
            <CardContent className="min-h-0 flex-1 overflow-y-auto px-4 pb-4 pt-2"><div className="divide-y divide-border/35">{items.map((item) => {
              const selected = selectedAnalysisItemIds.includes(item.id);
              return <div key={item.id} className="grid grid-cols-[1.5rem_2.5rem_minmax(0,1fr)_1.75rem] items-center gap-2 px-2 py-2.5 text-sm transition-colors hover:bg-muted/45">
                <button type="button" aria-pressed={selected} aria-label={`${selected ? "Deseleccionar" : "Elegir"}${item.title}`} disabled={analysisAvailability.selectionDisabled} onClick={() => toggleAnalysisItem(item.id)} className={cn("flex h-4 w-4 items-center justify-center rounded border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 disabled:cursor-not-allowed disabled:opacity-70", selected ? "border-primary bg-primary text-primary-foreground" : "border-border")}>
                  {selected ? <Check className="h-3 w-3" /> : null}
                </button>
                <span className="font-mono text-muted-foreground">#{item.rank}</span>
                <button type="button" disabled={analysisAvailability.selectionDisabled} onClick={() => toggleAnalysisItem(item.id)} className="min-w-0 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 disabled:cursor-not-allowed">
                  <span className="block truncate font-medium">{item.title}</span>
                  <span className="block truncate text-xs text-muted-foreground">{item.author || "Autor no revelado"}{item.category ? ` · ${item.category}` : ""}</span>
                </button>
                <a href={item.sourceUrl} target="_blank" rel="noreferrer" aria-label={`Controlar${item.title}Fuentes públicas de`} className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"><ExternalLink className="h-3.5 w-3.5" /></a>
              </div>;
            })}</div></CardContent>
          </Card>})}
        </div>
      </>)}

      {viewTab === "analysis" && analyzing ? (
        <section className="flex min-h-56 flex-col items-center justify-center gap-3 bg-muted/25 px-6 py-10 text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <div className="font-medium">Analizando obras seleccionadas · {Math.round((activeRun?.progress ?? 0) * 100)}%</div>
          <p className="text-sm text-muted-foreground">Los nuevos juicios de mercado se mostrarán aquí una vez finalizado.</p>
        </section>
      ) : null}

      {viewTab === "analysis" && !analyzing && report ? (
        <div ref={analysisResultRef} className="space-y-6 scroll-mt-6">
          <Card>
            <CardHeader><CardTitle className="text-xl">Sentencia en este asunto</CardTitle><CardDescription>Recogido de {new Date(report.createdAt).toLocaleString()}, todas las conclusiones se pueden revisar revisando la evidencia de la lista pública.</CardDescription></CardHeader>
            <CardContent>
              <p className="leading-7">{report.summary}</p>
              <div className="mt-4 flex flex-wrap gap-2">{report.platformStatuses.map((status) => <Badge key={status.platform} variant={status.status === "failed" ? "destructive" : "outline"}>{PLATFORM_LABELS[status.platform]} · {status.itemCount}Artículo{status.status === "stale" ? " · Recomendado para refrescar" : ""}</Badge>)}</div>
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {report.signals.map((signal) => {
              const selected = selectedIds.includes(signal.id);
              const saved = (savedTopicsQuery.data?.data ?? []).some((topic) => topic.reportId === report.id && topic.signalId === signal.id);
              return <article key={signal.id} className={cn("rounded-xl border p-5 text-left transition hover:border-primary/50 hover:shadow-sm", selected ? "border-primary bg-primary/5 ring-2 ring-primary/20" : "border-border bg-card")}>
                <div role="button" tabIndex={0} aria-pressed={selected} onClick={() => toggleSignal(signal.id)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") toggleSignal(signal.id); }} className="w-full text-left">
                <div className="flex items-start justify-between gap-3"><Badge variant={signal.kind === "opportunity" ? "default" : signal.kind === "crowding" ? "destructive" : "secondary"}>{KIND_LABELS[signal.kind]}</Badge><span className="flex items-center gap-2 text-xs font-medium text-primary">{selected ? "Seleccionado" : null}<button type="button" aria-label={`${saved ? "Cancelar favoritos" : "Recolectar"}${signal.label}`} onClick={(event) => { event.stopPropagation(); if (saved) { const item = savedTopicsQuery.data?.data?.find((topic) => topic.signalId === signal.id); if (item) deleteTopicMutation.mutate(item.id); } else saveTopicMutation.mutate(signal.id); }}><span className={saved ? "text-amber-600" : "text-muted-foreground"}>{saved ? "★" : "☆"}</span></button></span></div>
                <div className="mt-4 text-lg font-semibold">{signal.label}</div><p className="mt-2 text-sm leading-6 text-muted-foreground">{signal.summary}</p>
                <div className="mt-4 flex gap-3 text-xs text-muted-foreground"><span>picor {signal.heat}</span><span>Apiñamiento {signal.crowding}</span><span>{signal.direction === "current" ? "Alta frecuencia actual" : signal.direction === "rising" ? "se esta calentando" : signal.direction === "falling" ? "Enfriándose" : "Relativamente estable"}</span></div>
                </div>
              </article>;
            })}
          </div>

          <Card className="sticky bottom-4 border-primary/30 bg-background/95 shadow-xl backdrop-blur">
            <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div><div className="font-medium">Seleccionado {selectedIds.length}/5 señales de mercado</div><p className="mt-1 text-xs text-muted-foreground">La recomendación de IA se ha verificado automáticamente; puede reemplazarla antes de abrir el libro.</p></div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Select value={influenceMode} onValueChange={(value) => setInfluenceMode(value as MarketInfluenceMode)}><SelectTrigger className="w-full sm:w-44"><SelectValue /></SelectTrigger><SelectContent>{Object.entries(MODE_LABELS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select>
                <Button onClick={() => briefMutation.mutate()} disabled={selectedIds.length === 0 || briefMutation.isPending}>{briefMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}Utilice estas señales para crear<ArrowRight className="h-4 w-4" /></Button>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}
      {viewTab === "saved" ? <section className="space-y-3">
        <div className="flex items-center justify-between"><div><h2 className="text-base font-semibold">Lista de temas populares</h2><p className="text-sm text-muted-foreground">Recopile los temas aprobados por el análisis de IA y podrá revisar la fuente y los motivos de la recomendación más adelante.</p></div><Badge variant="secondary">{savedTopicsQuery.data?.data?.length ?? 0} Individual</Badge></div>
        {(savedTopicsQuery.data?.data ?? []).length > 0 ? <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{savedTopicsQuery.data!.data!.map((topic) => <Card key={topic.id}><CardContent className="p-4"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="font-medium">{topic.label}</div><p className="mt-1 text-sm leading-6 text-muted-foreground">{topic.summary}</p><div className="mt-2 text-xs text-muted-foreground">picor {topic.heat} · Aglomeración {topic.crowding}</div></div><Button type="button" variant="ghost" size="sm" aria-label={`Cancelar favoritos${topic.label}`} onClick={() => deleteTopicMutation.mutate(topic.id)}><X className="h-3.5 w-3.5" /></Button></div><div className="mt-4 flex items-center justify-between gap-3"><span className="text-xs text-muted-foreground">Recogido en {new Date(topic.createdAt).toLocaleString()}</span><Button type="button" size="sm" disabled={!topic.signalId || savedTopicBriefMutation.isPending} onClick={() => savedTopicBriefMutation.mutate(topic)}>{savedTopicBriefMutation.isPending && savedTopicBriefMutation.variables?.signalId === topic.signalId ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}Iniciar un libro con este tema.</Button></div></CardContent></Card>)}</div> : <div className="rounded-lg bg-muted/30 px-4 py-5 text-sm text-muted-foreground">Después de completar el análisis de IA, recopile temas populares que reconozca y aquí se formará su propia referencia de selección de temas.</div>}
      </section> : null}
    </div>
  );
}
