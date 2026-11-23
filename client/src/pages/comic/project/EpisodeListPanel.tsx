import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, BookOpen, Check, FileText, Layers, Loader2, Pencil, Sparkles, X } from "lucide-react";
import {
  generateComicOutline,
  generateComicPanelScript,
  importComicSourceBundle,
  listComicEpisodes,
  updateComicEpisode,
  type ComicCharacter,
  type ComicEpisode,
  type ComicProject,
  type GenerateScriptPayload,
} from "@/api/comic";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/components/ui/toast";

type DensityMode = NonNullable<GenerateScriptPayload["densityMode"]>;

const DENSITY_OPTIONS: Array<{ value: DensityMode; label: string; desc: string }> = [
  { value: "relaxed", label: "Estirar", desc: "Las emociones y reacciones son más claras." },
  { value: "balanced", label: "Equilibrado", desc: "Ritmo cómico predeterminado" },
  { value: "compact", label: "Compacto", desc: "La trama avanza más intensamente." },
];

const DENSITY_LABELS: Record<DensityMode, string> = { relaxed: "Estirar", balanced: "Equilibrado", compact: "Compacto" };

const FACT_CATEGORY_ZH: Record<string, string> = {
  completed: "Ha sucedido",
  revealed: "Primera aparición",
  state_changed: "Cambio de estado",
};

function parsePresetFormat(raw: string | null | undefined): string {
  if (!raw) return "webtoon";
  try {
    const parsed = JSON.parse(raw) as { format?: string };
    return parsed.format ?? "webtoon";
  } catch {
    return "webtoon";
  }
}

function parseScriptConfig(raw: string | null | undefined): {
  densityMode?: DensityMode;
  targetPanelCount?: number;
  comicFormat?: string;
  generatedAt?: string;
} {
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function resolveTargetPanelCount(densityMode: DensityMode, format: string): number {
  if (format === "4koma") {
    if (densityMode === "relaxed") return 10;
    if (densityMode === "compact") return 16;
    return 12;
  }
  if (densityMode === "relaxed") return 30;
  if (densityMode === "compact") return 65;
  return 45;
}

// ─── Episode inline editor ──────────────────────────────────────────────────

function EpisodeCard({
  ep,
  isBusy,
  onGenerateScript,
}: {
  ep: ComicEpisode;
  isBusy: boolean;
  onGenerateScript: (ep: ComicEpisode) => void;
}) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [draftTitle, setDraftTitle] = useState(ep.title ?? "");
  const [draftOutline, setDraftOutline] = useState(ep.outline ?? "");
  const [draftCliffhanger, setDraftCliffhanger] = useState(ep.cliffhanger ?? "");
  const [draftPaywalled, setDraftPaywalled] = useState(ep.isPaywalled);
  const scriptConfig = parseScriptConfig(ep.scriptConfig);

  const saveMut = useMutation({
    mutationFn: () =>
      updateComicEpisode(ep.id, {
        title: draftTitle || undefined,
        outline: draftOutline || undefined,
        cliffhanger: draftCliffhanger || undefined,
        isPaywalled: draftPaywalled,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["comic", "episodes", ep.projectId] });
      setEditing(false);
      toast.success("Esquema guardado");
    },
    onError: (e) => toast.error(String(e)),
  });

  const startEdit = () => {
    setDraftTitle(ep.title ?? "");
    setDraftOutline(ep.outline ?? "");
    setDraftCliffhanger(ep.cliffhanger ?? "");
    setDraftPaywalled(ep.isPaywalled);
    setEditing(true);
  };

  return (
    <Card className="rounded-md">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-sm leading-snug">
            Cap. {ep.order} hablar {ep.title ? `«${ep.title}»` : ""}
          </CardTitle>
          <div className="flex shrink-0 gap-1">
            {ep.isPaywalled && <Badge variant="destructive" className="h-5 text-[10px]">Punto atascado</Badge>}
            <Badge variant="outline" className="h-5 text-[10px]">{ep._count?.panels ?? 0} Cuadrícula</Badge>
            {!editing && (
              <button
                type="button"
                title="Editar esquema"
                onClick={startEdit}
                className="ml-1 rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <Pencil className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>

        {editing ? (
          <div className="mt-2 space-y-2">
            <div>
              <label className="mb-0.5 block text-[11px] text-muted-foreground">Título</label>
              <input
                value={draftTitle}
                maxLength={30}
                onChange={(e) => setDraftTitle(e.target.value)}
                className="w-full rounded border bg-background px-2 py-1 text-xs"
                placeholder="Título de este episodio"
              />
            </div>
            <div>
              <label className="mb-0.5 block text-[11px] text-muted-foreground">Describir</label>
              <textarea
                value={draftOutline}
                maxLength={1000}
                rows={4}
                onChange={(e) => setDraftOutline(e.target.value)}
                className="w-full resize-y rounded border bg-background px-2 py-1 text-xs leading-relaxed"
                placeholder="Resumen de la trama de este episodio."
              />
            </div>
            <div>
              <label className="mb-0.5 block text-[11px] text-muted-foreground">Suspenso al final</label>
              <input
                value={draftCliffhanger}
                maxLength={100}
                onChange={(e) => setDraftCliffhanger(e.target.value)}
                className="w-full rounded border bg-background px-2 py-1 text-xs"
                placeholder="El suspenso o gancho al final del capítulo."
              />
            </div>
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={draftPaywalled}
                onChange={(e) => setDraftPaywalled(e.target.checked)}
              />
              Recogida de puntos con tarjeta de pago
            </label>
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                disabled={saveMut.isPending}
                onClick={() => saveMut.mutate()}
                className="h-7 px-3 text-xs"
              >
                {saveMut.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                ahorrar
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={saveMut.isPending}
                onClick={() => setEditing(false)}
                className="h-7 px-3 text-xs"
              >
                <X className="h-3 w-3" />
                Cancelar
              </Button>
            </div>
          </div>
        ) : (
          <>
            {ep.outline && (
              <p className="mt-1 line-clamp-3 text-xs text-muted-foreground">{ep.outline}</p>
            )}
            {ep.cliffhanger && (
              <p className="mt-1 text-[11px] text-muted-foreground/70 italic">↳ {ep.cliffhanger}</p>
            )}
            {scriptConfig.densityMode && (
              <div className="mt-2 flex flex-wrap gap-1.5 text-[11px] text-muted-foreground">
                <span className="rounded border bg-muted/40 px-2 py-0.5">{DENSITY_LABELS[scriptConfig.densityMode]}Densidad</span>
                {scriptConfig.targetPanelCount ? (
                  <span className="rounded border bg-muted/40 px-2 py-0.5">aprox. {scriptConfig.targetPanelCount} Cuadrícula</span>
                ) : null}
              </div>
            )}
          </>
        )}
      </CardHeader>

      {!editing && (
        <CardContent className="pt-0">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="w-full"
            disabled={isBusy || !ep.outline}
            onClick={() => onGenerateScript(ep)}
          >
            {isBusy ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Generar guión...
              </>
            ) : (
              <>
                <BookOpen className="h-3.5 w-3.5" />
                Generar script de cuadrícula
              </>
            )}
          </Button>
        </CardContent>
      )}
    </Card>
  );
}

// ─── Character readiness warning ─────────────────────────────────────────────

function CharacterReadinessWarning({ characters }: { characters: ComicCharacter[] }) {
  const withoutSheet = characters.filter((c) => {
    try {
      const sd = c.sheetData ? JSON.parse(c.sheetData) : {};
      return sd.status !== "done";
    } catch {
      return true;
    }
  });
  if (characters.length === 0 || withoutSheet.length === 0) return null;
  return (
    <div className="flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-800 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-300">
      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <div>
        <span className="font-semibold">Se recomienda completar primero el borrador del diseño del personaje.</span>
        <span className="ml-1">
          {withoutSheet.map((c) => c.name).join(",")} Aún no se han generado tres vistas. Al generar guiones de cuadrícula, se inyectarán anclajes visuales de los personajes. Sólo con borradores de diseño puede ser consistente la apariencia de los personajes en cada cuadrícula.
        </span>
      </div>
    </div>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────

export function EpisodeListPanel({
  projectId,
  project,
}: {
  projectId: string;
  project: ComicProject & { characters: ComicCharacter[] };
}) {
  const queryClient = useQueryClient();
  const [busyEpId, setBusyEpId] = useState("");
  const [densityMode, setDensityMode] = useState<DensityMode>("balanced");
  const [showPromptSettings, setShowPromptSettings] = useState(false);
  const [scriptPromptInstruction, setScriptPromptInstruction] = useState("");

  const { data: episodes = [], isLoading } = useQuery({
    queryKey: ["comic", "episodes", projectId],
    queryFn: () => listComicEpisodes(projectId),
  });

  const format = parsePresetFormat(project.stylePreset);
  const targetPanelCount = resolveTargetPanelCount(densityMode, format);

  const bundleMut = useMutation({
    mutationFn: () => importComicSourceBundle(projectId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["comic", "project", projectId] });
      toast.success("La fuente del contenido ha sido importada.");
    },
  });

  const outlineMut = useMutation({
    mutationFn: ({ startOrder, count }: { startOrder?: number; count?: number }) =>
      generateComicOutline(projectId, { startOrder, count }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["comic", "episodes", projectId] });
      toast.success("Generación de esquema completada");
    },
    onError: (e) => toast.error(String(e)),
  });

  const scriptMut = useMutation({
    mutationFn: ({ episodeId, payload }: { episodeId: string; payload: GenerateScriptPayload }) =>
      generateComicPanelScript(episodeId, payload),
    onMutate: ({ episodeId }) => setBusyEpId(episodeId),
    onSuccess: (ep) => {
      queryClient.invalidateQueries({ queryKey: ["comic", "episodes", projectId] });
      queryClient.invalidateQueries({ queryKey: ["comic", "panels", ep?.id] });
      toast.success(`Cap. ${ep?.order ?? "?"} Se completa la generación del script.`);
    },
    onError: (e) => toast.error(String(e)),
    onSettled: () => setBusyEpId(""),
  });

  const generateScript = (episode: ComicEpisode) => {
    if ((episode._count?.panels ?? 0) > 0) {
      const ok = window.confirm("La regeneración reemplazará el script de cuadrícula existente en este episodio y afectará a los lotes de gráficos posteriores. ¿Seguir generando?");
      if (!ok) return;
    }
    scriptMut.mutate({
      episodeId: episode.id,
      payload: {
        targetPanelCount,
        densityMode,
        scriptPromptInstruction: scriptPromptInstruction.trim() || undefined,
      },
    });
  };

  return (
    <div className="space-y-4">
      <CharacterReadinessWarning characters={project.characters} />

      <div className="rounded-lg border bg-muted/20 p-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-2">
            {!project.sourceBundle && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={bundleMut.isPending}
                onClick={() => bundleMut.mutate()}
              >
                <Layers className="h-4 w-4" />
                {bundleMut.isPending ? "Importador..." : "Importar fuentes de contenido"}
              </Button>
            )}
            <Button
              type="button"
              size="sm"
              disabled={outlineMut.isPending || !project.sourceBundle}
              onClick={() => outlineMut.mutate({ startOrder: (episodes.length || 0) + 1, count: 12 })}
            >
              <Sparkles className="h-4 w-4" />
              {outlineMut.isPending ? "Generando..." : `Generar el ${(episodes.length || 0) + 1}-${(episodes.length || 0) + 12} esquema de charla`}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setShowPromptSettings((v) => !v)}
            >
              <FileText className="h-4 w-4" />
              Requisitos de generación de red
            </Button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground">Densidad de información</span>
            <div className="flex rounded-md border bg-background p-0.5">
              {DENSITY_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={[
                    "rounded px-2.5 py-1 text-xs font-medium transition-colors",
                    densityMode === option.value ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted",
                  ].join(" ")}
                  onClick={() => setDensityMode(option.value)}
                  title={option.desc}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <span className="text-xs text-muted-foreground">aprox. {targetPanelCount} Cuadrícula</span>
          </div>
        </div>

        {showPromptSettings && (
          <div className="mt-3 space-y-2">
            <textarea
              value={scriptPromptInstruction}
              maxLength={1000}
              onChange={(event) => setScriptPromptInstruction(event.target.value)}
              placeholder="Puedes complementar los puntos clave de esta división, por ejemplo: dar más primeros planos de las reacciones tranquilas del protagonista, evitar llenar cada cuadro con fondo y fortalecer el suspenso al final."
              className="min-h-20 w-full resize-y rounded-md border bg-background px-3 py-2 text-xs leading-relaxed"
            />
            <div className="flex justify-between text-[11px] text-muted-foreground">
              <span>Estos requisitos solo afectan la generación de esta cuadrícula y no cubrirán los puntos de anclaje de los personajes, los estilos de pintura ni las reglas de salida estructuradas.</span>
              <span>{scriptPromptInstruction.length}/1000</span>
            </div>
          </div>
        )}
      </div>

      {isLoading && <div className="py-8 text-center text-sm text-muted-foreground">Cargando...</div>}

      {!isLoading && episodes.length === 0 && (
        <div className="py-8 text-center text-sm text-muted-foreground">
          Aún no hay un esquema de conversación, haga clic en "Generar esquema" para comenzar.
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {episodes.map((ep) => (
          <EpisodeCard
            key={ep.id}
            ep={ep}
            isBusy={busyEpId === ep.id}
            onGenerateScript={generateScript}
          />
        ))}
      </div>
    </div>
  );
}
