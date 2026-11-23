import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, BookOpenText, FileText, Layers3, Lightbulb, ListVideo, Plus, RefreshCw, Sparkles } from "lucide-react";
import {
  assembleDramaSourceBundle,
  createDramaProject,
  generateDramaOutline,
  generateDramaStrategy,
  listDramaProjects,
  recommendDramaTrack,
  type CreateDramaProjectPayload,
  type DramaTrackRecommendation,
  type DramaProject,
  type DramaSourceType,
} from "@/api/drama";
import { queryKeys } from "@/api/queryKeys";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/components/ui/toast";
import { getNovelList } from "@/api/novel/core";
import { DRAMA_SOURCE_LABELS, DRAMA_TRACK_OPTIONS, dramaTrackLabel } from "./dramaDisplay";
import SelectControl from "@/components/common/SelectControl";

const WIZARD_STEPS = [
  { key: "source", label: "Origen" },
  { key: "content", label: "Contenido" },
  { key: "settings", label: "Especificaciones" },
] as const;

function statusLabel(status: string): string {
  const labels: Record<string, string> = {
    draft: "Preparación de materiales",
    strategized: "Se ha generado la política",
    outlined: "El episodio ha sido generado.",
    scripting: "Se está generando el guión",
    completed: "Completado",
  };
  return labels[status] ?? status;
}

function buildRecommendationDigest(form: {
  source: DramaSourceType;
  inspiration: string;
  rawText: string;
  sourceRef: string;
}, selectedNovel?: { title?: string | null; _count?: { chapters: number } } | null): string {
  if (form.source === "original") {
    return form.inspiration.trim();
  }
  if (form.source === "text_import") {
    return form.rawText.trim().slice(0, 12000);
  }
  if (selectedNovel) {
    return `La novela "${selectedNovel.title || "Novela sin título"}",común ${selectedNovel._count?.chapters ?? 0} capítulo.`;
  }
  return "";
}

function hasSourceContent(form: {
  source: DramaSourceType;
  inspiration: string;
  rawText: string;
  sourceRef: string;
}): boolean {
  if (form.source === "novel_import") {
    return Boolean(form.sourceRef.trim());
  }
  if (form.source === "original") {
    return Boolean(form.inspiration.trim());
  }
  return Boolean(form.rawText.trim());
}

function buildCreatePayload(form: {
  title: string;
  source: DramaSourceType;
  sourceRef: string;
  inspiration: string;
  rawText: string;
  track: string;
  theme: string;
  targetEpisodes: string;
}): CreateDramaProjectPayload {
  return {
    title: form.title.trim(),
    source: form.source,
    sourceRef: form.source === "novel_import" ? form.sourceRef.trim() : undefined,
    inspiration: form.source === "original" ? form.inspiration.trim() : undefined,
    rawText: form.source === "text_import" ? form.rawText.trim() : undefined,
    track: form.track,
    theme: form.theme.trim() || undefined,
    targetEpisodes: Number(form.targetEpisodes) || 80,
  };
}

function ProjectCard(props: {
  project: DramaProject;
  busyProjectId: string;
  onAssemble: (project: DramaProject) => void;
  onStrategy: (project: DramaProject) => void;
  onOutline: (project: DramaProject) => void;
}) {
  const isBusy = props.busyProjectId === props.project.id;

  return (
    <Card className="rounded-lg">
      <CardHeader className="gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle className="text-lg leading-6">{props.project.title}</CardTitle>
            <Badge variant="secondary">{DRAMA_SOURCE_LABELS[props.project.source]}</Badge>
            <Badge variant="outline">{statusLabel(props.project.status)}</Badge>
          </div>
          <CardDescription>
            {dramaTrackLabel(props.project.track)} · {props.project.targetEpisodes} colocar
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        <Button asChild type="button" size="sm">
          <Link to={`/drama/projects/${props.project.id}`}>
            banco de trabajo abierto
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={isBusy}
          onClick={() => props.onAssemble(props.project)}
        >
          <Layers3 className="h-4 w-4" />
          organizar materiales
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={isBusy}
          onClick={() => props.onStrategy(props.project)}
        >
          <Sparkles className="h-4 w-4" />
          Generar estrategia
        </Button>
        <Button
          type="button"
          size="sm"
          disabled={isBusy}
          onClick={() => props.onOutline(props.project)}
        >
          <ListVideo className="h-4 w-4" />
          Generando los primeros 12 episodios
        </Button>
      </CardContent>
    </Card>
  );
}

export default function DramaWorkspacePage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [stepIndex, setStepIndex] = useState(0);
  const [form, setForm] = useState({
    title: "",
    source: "original" as DramaSourceType,
    sourceRef: "",
    inspiration: "",
    rawText: "",
    track: "counterattack",
    theme: "",
    targetEpisodes: "80",
  });
  const [busyProjectId, setBusyProjectId] = useState("");
  const [trackRecommendation, setTrackRecommendation] = useState<DramaTrackRecommendation | null>(null);

  const projectsQuery = useQuery({
    queryKey: queryKeys.drama.projects,
    queryFn: listDramaProjects,
  });
  const novelsQuery = useQuery({
    queryKey: queryKeys.novels.list(1, 100),
    queryFn: () => getNovelList({ page: 1, limit: 100 }),
  });

  const projects = useMemo(() => projectsQuery.data?.data ?? [], [projectsQuery.data?.data]);
  const novels = useMemo(() => novelsQuery.data?.data?.items ?? [], [novelsQuery.data?.data?.items]);
  const selectedNovel = useMemo(
    () => novels.find((novel) => novel.id === form.sourceRef),
    [form.sourceRef, novels],
  );
  const canRecommendTrack = hasSourceContent(form);

  const createMutation = useMutation({
    mutationFn: (payload: CreateDramaProjectPayload) => createDramaProject(payload),
    onSuccess: async (response) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.drama.projects });
      toast.success("Proyecto de sketch creado.");
      if (response.data?.id) {
        navigate(`/drama/projects/${response.data.id}`);
        return;
      }
      setForm((current) => ({
        ...current,
        title: "",
        sourceRef: "",
        inspiration: "",
        rawText: "",
        theme: "",
      }));
    },
  });

  const trackRecommendationMutation = useMutation({
    mutationFn: () => recommendDramaTrack({
      title: form.title.trim() || selectedNovel?.title || "Proyecto de obra corta",
      sourceType: form.source,
      sourceDigest: buildRecommendationDigest(form, selectedNovel),
      theme: form.theme.trim() || undefined,
      targetEpisodes: Number(form.targetEpisodes) || 80,
    }),
    onSuccess: (response) => {
      const recommendation = response.data;
      if (recommendation) {
        setTrackRecommendation(recommendation);
        setForm((current) => ({ ...current, track: recommendation.recommendedTrack }));
        toast.success("Se han recomendado pistas de sketch adecuadas.");
      }
    },
  });

  const runProjectAction = async (
    project: DramaProject,
    action: (projectId: string) => Promise<unknown>,
    successMessage: string,
  ) => {
    setBusyProjectId(project.id);
    try {
      await action(project.id);
      await queryClient.invalidateQueries({ queryKey: queryKeys.drama.projects });
      await queryClient.invalidateQueries({ queryKey: queryKeys.drama.project(project.id) });
      toast.success(successMessage);
    } finally {
      setBusyProjectId("");
    }
  };

  const validateCurrentStep = () => {
    if (stepIndex === 0) {
      return true;
    }
    if (stepIndex === 1) {
      if (form.source === "novel_import" && !form.sourceRef.trim()) {
        toast.error("Seleccione una novela para adaptarla.");
        return false;
      }
      if (form.source === "original" && !form.inspiration.trim()) {
        toast.error("Por favor complete la inspiración original.");
        return false;
      }
      if (form.source === "text_import" && !form.rawText.trim()) {
        toast.error("Por favor pegue el texto que desea organizar.");
        return false;
      }
    }
    return true;
  };

  const goNext = () => {
    if (!validateCurrentStep()) {
      return;
    }
    setStepIndex((current) => Math.min(current + 1, WIZARD_STEPS.length - 1));
  };

  const handleCreate = () => {
    if (!validateCurrentStep()) {
      return;
    }
    if (!form.title.trim()) {
      toast.error("Primero complete el nombre del proyecto de juego corto.");
      return;
    }
    if (form.source === "novel_import" && !form.sourceRef.trim()) {
      toast.error("Seleccione una novela para adaptarla.");
      return;
    }
    if (form.source === "original" && !form.inspiration.trim()) {
      toast.error("Por favor complete la inspiración original.");
      return;
    }
    if (form.source === "text_import" && !form.rawText.trim()) {
      toast.error("Por favor pegue el texto que desea organizar.");
      return;
    }
    createMutation.mutate(buildCreatePayload(form));
  };

  const chooseSource = (source: DramaSourceType) => {
    setForm((current) => ({
      ...current,
      source,
      sourceRef: "",
      title: source === "original" && !current.title ? "Proyecto de drama corto original." : current.title,
    }));
    setTrackRecommendation(null);
    setStepIndex(1);
  };

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-normal">Banco de trabajo de drama corto</h1>
        <p className="max-w-3xl text-sm text-muted-foreground">
          Organice materiales de juego corto a partir de novelas, inspiraciones originales o textos importados, y genere estrategias de juego corto pagados en pantalla vertical y guiones de episodios.
        </p>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(320px,420px)_1fr]">
        <Card className="rounded-lg">
          <CardHeader>
            <CardTitle className="text-lg">Nuevo proyecto de drama corto</CardTitle>
            <CardDescription>Siga los pasos para seleccionar fuentes, complementar contenido y crear proyectos que puedan ingresar a la línea de producción de dramas cortos.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-2">
              {WIZARD_STEPS.map((step, index) => (
                <button
                  key={step.key}
                  type="button"
                  className={`rounded-md border px-3 py-2 text-sm ${stepIndex === index ? "border-primary bg-primary/5 font-medium" : "text-muted-foreground"}`}
                  onClick={() => setStepIndex(index)}
                >
                  {index + 1}. {step.label}
                </button>
              ))}
            </div>

            {stepIndex === 0 ? (
              <div className="grid gap-3">
                <button type="button" className={`rounded-lg border p-3 text-left ${form.source === "novel_import" ? "border-primary bg-primary/5" : ""}`} onClick={() => chooseSource("novel_import")}>
                  <div className="flex items-center gap-2 font-medium"><BookOpenText className="h-4 w-4" />Importar novelas</div>
                  <p className="mt-1 text-sm text-muted-foreground">Adaptado de una novela existente, es adecuado para convertir una novela existente en una obra corta en pantalla vertical.</p>
                </button>
                <button type="button" className={`rounded-lg border p-3 text-left ${form.source === "original" ? "border-primary bg-primary/5" : ""}`} onClick={() => chooseSource("original")}>
                  <div className="flex items-center gap-2 font-medium"><Lightbulb className="h-4 w-4" />Obra corta original</div>
                  <p className="mt-1 text-sm text-muted-foreground">Comience con una inspiración y organice sistemáticamente personajes, conflictos y ritmos.</p>
                </button>
                <button type="button" className={`rounded-lg border p-3 text-left ${form.source === "text_import" ? "border-primary bg-primary/5" : ""}`} onClick={() => chooseSource("text_import")}>
                  <div className="flex items-center gap-2 font-medium"><FileText className="h-4 w-4" />Pegar texto</div>
                  <p className="mt-1 text-sm text-muted-foreground">Organice sinopsis de historias externas, cuentos o textos materiales en proyectos de juego cortos.</p>
                </button>
              </div>
            ) : null}

            {stepIndex === 1 ? (
              <div className="space-y-4">
                {form.source === "novel_import" ? (
                  <>
                    <label className="block space-y-1.5 text-sm">
                      <span className="font-medium">Seleccionar novela</span>
                      <SelectControl
                        className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                        value={form.sourceRef}
                        disabled={novelsQuery.isLoading || novels.length === 0}
                        onChange={(event) => {
                          const novel = novels.find((item) => item.id === event.target.value);
                          setForm((current) => ({
                            ...current,
                            sourceRef: event.target.value,
                            title: novel?.title ? `«${novel.title}»Versión dramática corta` : current.title,
                          }));
                        }}
                      >
                        <option value="" disabled>
                          {novelsQuery.isLoading ? "Cargando novela..." : novels.length > 0 ? "Por favor selecciona la novela que deseas adaptar" : "Aún no hay novelas disponibles"}
                        </option>
                        {novels.map((novel) => (
                          <option key={novel.id} value={novel.id}>
                            {novel.title || "Novela sin título"}({novel._count.chapters} capítulo)
                          </option>
                        ))}
                      </SelectControl>
                    </label>
                    {selectedNovel ? (
                      <div className="rounded-md border p-3 text-sm text-muted-foreground">
                        Seleccionado {selectedNovel.title || "Novela sin título"},común {selectedNovel._count.chapters} capítulo. Después de la creación, se organizará en paquetes de materiales de juego cortos.
                      </div>
                    ) : null}
                  </>
                ) : null}

                {form.source === "original" ? (
                  <label className="block space-y-1.5 text-sm">
                    <span className="font-medium">Inspiración original</span>
                    <textarea
                      className="min-h-32 w-full rounded-md border bg-background px-3 py-2 text-sm"
                      value={form.inspiration}
                      placeholder="Por ejemplo: la heroína cuyo compromiso fue roto descubrió que en realidad era la heredera de un chaebol y luchó en público contra todos aquellos que la humillaron."
                      onChange={(event) => setForm((current) => ({ ...current, inspiration: event.target.value }))}
                    />
                  </label>
                ) : null}

                {form.source === "text_import" ? (
                  <label className="block space-y-1.5 text-sm">
                    <span className="font-medium">Importar texto</span>
                    <textarea
                      className="min-h-40 w-full rounded-md border bg-background px-3 py-2 text-sm"
                      value={form.rawText}
                      placeholder="Pegue el esquema de la historia, la configuración de los personajes, el texto breve o los materiales adaptados."
                      onChange={(event) => setForm((current) => ({ ...current, rawText: event.target.value }))}
                    />
                  </label>
                ) : null}
              </div>
            ) : null}

            {stepIndex === 2 ? (
              <div className="space-y-4">
                <label className="block space-y-1.5 text-sm">
                  <span className="font-medium">Nombre del proyecto</span>
                  <input
                    className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                    value={form.title}
                    onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                  />
                </label>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block space-y-1.5 text-sm">
                    <span className="font-medium">Pista</span>
                    <SelectControl
                      className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                      value={form.track}
                      onChange={(event) => setForm((current) => ({ ...current, track: event.target.value }))}
                    >
                      {DRAMA_TRACK_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </SelectControl>
                  </label>
                  <label className="block space-y-1.5 text-sm">
                    <span className="font-medium">Número de conjuntos de objetivos</span>
                    <input
                      type="number"
                      min="1"
                      className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                      value={form.targetEpisodes}
                      onChange={(event) => setForm((current) => ({ ...current, targetEpisodes: event.target.value }))}
                    />
                  </label>
                </div>
                <label className="block space-y-1.5 text-sm">
                  <span className="font-medium">Suplemento temático</span>
                  <input
                    className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                    value={form.theme}
                    onChange={(event) => setForm((current) => ({ ...current, theme: event.target.value }))}
                  />
                </label>
                <div className="space-y-3 rounded-lg border p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="text-sm font-medium">Seguimiento de recomendaciones</div>
                      <p className="text-sm text-muted-foreground">Recomiende una pista de drama corto en pantalla vertical más adecuada basada en el material actual.</p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={trackRecommendationMutation.isPending || !canRecommendTrack}
                      onClick={() => trackRecommendationMutation.mutate()}
                    >
                      <Sparkles className="h-4 w-4" />
                      {trackRecommendationMutation.isPending ? "Recomendando..." : "Pista recomendada"}
                    </Button>
                  </div>
                  {trackRecommendation ? (
                    <div className="space-y-2 text-sm">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="default">{dramaTrackLabel(trackRecommendation.recommendedTrack)}</Badge>
                        <span className="text-muted-foreground">{trackRecommendation.reason}</span>
                      </div>
                      {trackRecommendation.fitSignals.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {trackRecommendation.fitSignals.map((signal) => (
                            <Badge key={signal} variant="secondary">{signal}</Badge>
                          ))}
                        </div>
                      ) : null}
                      {trackRecommendation.risks.length > 0 ? (
                        <div className="rounded-md border border-dashed p-2 text-muted-foreground">
                          {trackRecommendation.risks.join(";")}
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null}

            <div className="flex flex-wrap gap-2">
              {stepIndex > 0 ? (
                <Button type="button" variant="outline" onClick={() => setStepIndex((current) => Math.max(0, current - 1))}>
                  Paso anterior
                </Button>
              ) : null}
              {stepIndex < WIZARD_STEPS.length - 1 ? (
                <Button type="button" onClick={goNext}>
                  Siguiente paso
                  <ArrowRight className="h-4 w-4" />
                </Button>
              ) : (
                <Button type="button" disabled={createMutation.isPending} onClick={handleCreate}>
                  <Plus className="h-4 w-4" />
                  {createMutation.isPending ? "Creando..." : "Crear un proyecto de sketch"}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold tracking-normal">Proyecto</h2>
              <p className="text-sm text-muted-foreground">Primero organice los materiales y luego genere estrategias y episodios.</p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={projectsQuery.isFetching}
              onClick={() => void projectsQuery.refetch()}
            >
              <RefreshCw className="h-4 w-4" />
              refrescar
            </Button>
          </div>

          {projectsQuery.isLoading ? (
            <div className="rounded-md border p-4 text-sm text-muted-foreground">Cargando proyectos de sketches...</div>
          ) : null}

          {!projectsQuery.isLoading && projects.length === 0 ? (
            <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
              Aún no hay proyectos de drama cortos. Comience creando un proyecto a la izquierda.
            </div>
          ) : null}

          <div className="grid gap-3">
            {projects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                busyProjectId={busyProjectId}
                onAssemble={(item) => void runProjectAction(item, assembleDramaSourceBundle, "Se han recopilado los materiales de juego breve.")}
                onStrategy={(item) => void runProjectAction(item, generateDramaStrategy, "Estrategia de sketch generada.")}
                onOutline={(item) => void runProjectAction(
                  item,
                  (projectId) => generateDramaOutline(projectId, { startOrder: 1, count: 12 }),
                  "Se han producido los primeros 12 episodios.",
                )}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
