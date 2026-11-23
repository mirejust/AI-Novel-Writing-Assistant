import { useMemo, useState } from "react";
import { ArrowRight, BookOpen, Map, Network, Workflow } from "lucide-react";
import type {
  NovelWorldSyncDiff,
  NovelWorldSyncInput,
  NovelWorldView,
} from "@ai-novel/shared/types/novelWorld";
import type { StoryWorldSliceOverrides, StoryWorldSliceView } from "@ai-novel/shared/types/storyWorldSlice";
import { Button } from "@/components/ui/button";
import NovelWorldSourcePanel, { type WorldOption } from "./novelWorld/NovelWorldSourcePanel";
import {
  NovelWorldHandbookDialog,
  type NovelWorldDialogTab,
} from "./novelWorld/NovelWorldHandbookDialog";
import {
  NovelWorldUsageSummary,
  useNovelWorldUsageDraft,
  type NovelWorldUsageCardProps,
} from "./NovelWorldUsageCard";
import { DetailDisclosure } from "./workspaceShell";

interface NovelWorldManagerCardProps {
  view?: NovelWorldView | null;
  syncDiff?: NovelWorldSyncDiff | null;
  worldOptions: WorldOption[];
  selectedWorldId: string;
  isLoading: boolean;
  isImporting: boolean;
  isGenerating: boolean;
  isCreatingManual: boolean;
  isSavingToLibrary: boolean;
  isLoadingSyncDiff: boolean;
  isSyncing: boolean;
  usageView?: StoryWorldSliceView | null;
  usageMessage: string;
  isRefreshingWorldSlice: boolean;
  isSavingWorldSliceOverrides: boolean;
  onImport: Parameters<typeof NovelWorldSourcePanel>[0]["onImport"];
  onCreateManual: Parameters<typeof NovelWorldSourcePanel>[0]["onCreateManual"];
  onGenerate: Parameters<typeof NovelWorldSourcePanel>[0]["onGenerate"];
  onSaveToLibrary: () => void;
  onSync: (payload: NovelWorldSyncInput) => void;
  onRefreshWorldSlice: () => void;
  onSaveWorldSliceOverrides: (patch: StoryWorldSliceOverrides) => void;
}

function labelSourceType(sourceType: string | null | undefined): string {
  switch (sourceType) {
    case "imported":
      return "de la biblioteca mundial";
    case "generated":
      return "Generado en base a este libro.";
    case "manual":
      return "Mundo personalizado";
    default:
      return "Sin configurar";
  }
}

function labelSyncDirection(direction: string | null | undefined): string {
  switch (direction) {
    case "push":
      return "Solo enviar a la biblioteca mundial";
    case "pull":
      return "Solo extraído de la biblioteca mundial.";
    case "bidirectional":
      return "Se puede sincronizar en ambas direcciones.";
    default:
      return "Fuera de sincronización";
  }
}

function sectionLabel(section: string): string {
  switch (section) {
    case "profile":
      return "Resumen del mundo";
    case "rules":
      return "Reglas esenciales";
    case "factions":
      return "Acampar";
    case "forces":
      return "Poder";
    case "locations":
      return "Ubicación";
    case "relations":
      return "Red de relaciones";
    default:
      return section;
  }
}

function formatSyncTime(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date.toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function firstText(items: Array<string | null | undefined>, fallback: string): string {
  return items.find((item) => Boolean(item)) ?? fallback;
}

function inlineText(items: Array<string | null | undefined>): string | null {
  const compact = items.filter((item): item is string => Boolean(item));
  return compact.length ? compact.join(" · ") : null;
}

function WorldSignal(props: {
  icon: typeof BookOpen;
  label: string;
  count: number;
  sample: string;
}) {
  const Icon = props.icon;

  return (
    <div className="rounded-xl bg-background/75 p-3 shadow-sm ring-1 ring-border/30">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Icon className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
        {props.label}
      </div>
      <div className="mt-2 text-xl font-semibold text-foreground">{props.count}</div>
      <div className="mt-1 line-clamp-1 text-xs text-muted-foreground">{props.sample}</div>
    </div>
  );
}

function GenerationChain() {
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
      {["Mundo del libro", "Personaje", "Esquema", "Capítulos"].map((item, index, array) => (
        <span key={item} className="flex items-center gap-2">
          <span className="rounded-full bg-background/80 px-2 py-1 shadow-sm ring-1 ring-border/25">{item}</span>
          {index < array.length - 1 ? <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" /> : null}
        </span>
      ))}
    </div>
  );
}

export default function NovelWorldManagerCard(props: NovelWorldManagerCardProps) {
  const [selectedSyncSections, setSelectedSyncSections] = useState<NovelWorldSyncInput["sections"]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogTab, setDialogTab] = useState<NovelWorldDialogTab>("overview");
  const novelWorld = props.view?.novelWorld ?? null;
  const handbook = props.view?.handbook ?? null;
  const worldAssets = props.view?.assets ?? [];
  const syncHistory = props.view?.syncHistory ?? [];
  const syncDiff = props.syncDiff ?? null;
  const usageProps = useMemo<NovelWorldUsageCardProps>(() => ({
    view: props.usageView,
    message: props.usageMessage,
    isRefreshing: props.isRefreshingWorldSlice,
    isSaving: props.isSavingWorldSliceOverrides,
    onRefresh: props.onRefreshWorldSlice,
    onSave: props.onSaveWorldSliceOverrides,
  }), [
    props.usageView,
    props.usageMessage,
    props.isRefreshingWorldSlice,
    props.isSavingWorldSliceOverrides,
    props.onRefreshWorldSlice,
    props.onSaveWorldSliceOverrides,
  ]);
  const usageDraft = useNovelWorldUsageDraft(usageProps);

  const activeWorldName = useMemo(() => {
    const id = novelWorld?.sourceWorldId ?? props.selectedWorldId;
    return props.worldOptions.find((item) => item.id === id)?.name ?? novelWorld?.title ?? "Ningún mundo seleccionado";
  }, [novelWorld?.sourceWorldId, novelWorld?.title, props.selectedWorldId, props.worldOptions]);
  const writingStatus = novelWorld
    ? novelWorld.hasStorySlice
      ? "El alcance de la escritura ha sido organizado."
      : "Necesidad de organizar el alcance disponible de este libro."
    : "El mundo del libro aún no se ha establecido.";
  const syncStatus = novelWorld?.syncEnabled
    ? labelSyncDirection(novelWorld.syncDirection)
    : novelWorld?.sourceWorldId
      ? "Guarde una copia de este libro."
      : "Para uso interno de este libro.";
  const lastSyncedAtText = formatSyncTime(novelWorld?.lastSyncedAt);
  const pendingSections = syncDiff?.differences.length
    ? syncDiff.differences.map((item) => item.section)
    : novelWorld?.syncPendingSections ?? [];
  const pendingSectionText = pendingSections.length > 0 ? pendingSections.map(sectionLabel).join(",") : null;
  const hasSyncDiff = Boolean(syncDiff?.differences.length);
  const forces = handbook?.forces.length ? handbook.forces : handbook?.factions ?? [];
  const summaryText = handbook?.summary
    ?? novelWorld?.coverSummary
    ?? (novelWorld ? "El mundo de este libro se está ordenando." : "Primero crea una copia del mundo que pertenece a este libro. Los personajes, esquemas y capítulos posteriores leerán los límites establecidos aquí.");
  const themeLine = inlineText([
    handbook?.identity ? `Identidad:${handbook.identity}` : null,
    handbook?.tone ? `Temperamento:${handbook.tone}` : null,
    ...(handbook?.themes.slice(0, 4) ?? []),
  ]);

  const openDialog = (tab: NovelWorldDialogTab) => {
    setDialogTab(tab);
    setDialogOpen(true);
  };

  return (
    <section className="space-y-5">
      <section className="overflow-hidden rounded-2xl bg-muted/10 shadow-sm ring-1 ring-border/35">
        <div className="grid gap-5 p-5 xl:grid-cols-[minmax(0,1.25fr)_420px]">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              {props.isLoading ? <span>Leyendo</span> : null}
              <span>{novelWorld ? labelSourceType(novelWorld.sourceType) : "Fuente no establecida"}</span>
              <span>{writingStatus}</span>
              <span>{syncStatus}</span>
              {lastSyncedAtText ? <span>sincrónico {lastSyncedAtText}</span> : null}
              {pendingSectionText ? <span>Pendiente {pendingSectionText}</span> : null}
            </div>
            <div className="mt-3 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <div className="text-sm text-muted-foreground">Mundo del libro</div>
                <h2 className="mt-1 truncate text-3xl font-semibold tracking-normal text-foreground">{activeWorldName}</h2>
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                {novelWorld ? (
                  <>
                    <Button type="button" onClick={() => openDialog("overview")}>
                      Abrir el manual del mundo completo.
                    </Button>
                    <Button type="button" variant="outline" onClick={() => openDialog("usage")}>
                      Organizar el ámbito de uso.
                    </Button>
                  </>
                ) : (
                  <Button asChild>
                    <a href="#novel-world-source">Seleccionar o generar un mundo de libros.</a>
                  </Button>
                )}
                {hasSyncDiff ? (
                  <Button type="button" variant="outline" onClick={() => openDialog("sync")}>
                    Manejar diferencias de sincronización
                  </Button>
                ) : null}
              </div>
            </div>

            <div className="mt-5 max-w-4xl text-lg leading-8 text-foreground/85">
              {summaryText}
            </div>
            {themeLine ? <div className="mt-3 text-sm leading-6 text-muted-foreground">{themeLine}</div> : null}

            <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <WorldSignal
                icon={BookOpen}
                label="Reglas esenciales"
                count={handbook?.coreRules.length ?? 0}
                sample={handbook?.coreRules[0]?.name ?? "Esperando a que se completen las reglas"}
              />
              <WorldSignal
                icon={Network}
                label="Facciones principales"
                count={forces.length}
                sample={forces[0]?.name ?? "Esperando reposición de fuerzas."}
              />
              <WorldSignal
                icon={Map}
                label="Escenario de la historia"
                count={handbook?.locations.length ?? 0}
                sample={handbook?.locations[0]?.name ?? "Esperando que se llene la ubicación"}
              />
              <WorldSignal
                icon={Workflow}
                label="Tensión crítica"
                count={handbook?.tensions.length ?? 0}
                sample={handbook?.tensions[0] ?? "Esperando que se llene la tensión"}
              />
            </div>

            <div className="mt-6 flex flex-col gap-3 rounded-xl bg-background/70 px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="text-sm font-medium text-foreground">La cadena de generación leerá este mundo.</div>
                <div className="mt-1 text-xs leading-5 text-muted-foreground">
                  {novelWorld?.hasStorySlice
                    ? "Los personajes, esquemas y capítulos tendrán prioridad sobre las reglas, poderes y ubicaciones dentro del alcance del libro."
                    : "Después de clasificar el alcance de uso de este libro, la cadena generacional leerá restricciones mundiales más precisas."}
                </div>
              </div>
              <GenerationChain />
            </div>
          </div>

          <aside className="space-y-4 rounded-2xl bg-background/65 p-4 shadow-sm ring-1 ring-border/30">
            <div>
              <div className="text-sm font-medium text-foreground">Limitaciones mundiales</div>
              <div className="mt-1 text-sm leading-6 text-muted-foreground">
                {firstText([
                  props.usageView?.slice?.coreWorldFrame,
                  handbook?.generationGuidance?.chapterUses[0],
                  novelWorld?.hasStorySlice ? "La generación de capítulos leerá el alcance de uso de este libro." : null,
                ], "Una vez creado el mundo del libro, aquí se muestran las restricciones que leerá la generación de capítulos.")}
              </div>
            </div>
            <div className="grid gap-3 text-sm">
              {[
                { label: "Reglas", value: props.usageView?.slice?.appliedRules.length ?? handbook?.coreRules.length ?? 0 },
                { label: "Poder", value: props.usageView?.slice?.activeForces.length ?? forces.length },
                { label: "Ubicación", value: props.usageView?.slice?.activeLocations.length ?? handbook?.locations.length ?? 0 },
                { label: "Presión", value: props.usageView?.slice?.pressureSources.length ?? handbook?.tensions.length ?? 0 },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between border-t border-border/45 pt-2">
                  <span className="text-muted-foreground">{item.label}</span>
                  <span className="font-semibold text-foreground">{item.value}</span>
                </div>
              ))}
            </div>
          </aside>
        </div>
      </section>

      {novelWorld ? (
        <NovelWorldUsageSummary
          {...usageProps}
          draft={usageDraft}
          onOpenDetails={() => openDialog("usage")}
        />
      ) : (
        <DetailDisclosure
          title="Seleccionar o generar un mundo de libros."
          description="Importe desde la biblioteca mundial, genere desde este libro o cree primero un esqueleto mundial personalizado."
          meta="Para ser seleccionado"
          defaultOpen
        >
          <div id="novel-world-source">
            <NovelWorldSourcePanel
              worldOptions={props.worldOptions}
              selectedWorldId={props.selectedWorldId}
              isImporting={props.isImporting}
              isGenerating={props.isGenerating}
              isCreatingManual={props.isCreatingManual}
              onImport={props.onImport}
              onCreateManual={props.onCreateManual}
              onGenerate={props.onGenerate}
            />
          </div>
        </DetailDisclosure>
      )}

      <NovelWorldHandbookDialog
        open={dialogOpen}
        activeTab={dialogTab}
        onOpenChange={setDialogOpen}
        onTabChange={setDialogTab}
        novelWorld={novelWorld}
        handbook={handbook}
        worldAssets={worldAssets}
        syncHistory={syncHistory}
        syncDiff={syncDiff}
        activeWorldName={activeWorldName}
        worldOptions={props.worldOptions}
        selectedWorldId={props.selectedWorldId}
        isImporting={props.isImporting}
        isGenerating={props.isGenerating}
        isCreatingManual={props.isCreatingManual}
        isSavingToLibrary={props.isSavingToLibrary}
        isLoadingSyncDiff={props.isLoadingSyncDiff}
        isSyncing={props.isSyncing}
        selectedSyncSections={selectedSyncSections}
        onSelectedSyncSectionsChange={setSelectedSyncSections}
        onImport={props.onImport}
        onCreateManual={props.onCreateManual}
        onGenerate={props.onGenerate}
        onSaveToLibrary={props.onSaveToLibrary}
        onSync={props.onSync}
        usageProps={usageProps}
        usageDraft={usageDraft}
      />
    </section>
  );
}
