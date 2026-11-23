import { ShortStoryReferenceSummary } from "@/components/creation/ShortStoryReferenceSummary";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  BookOpen,
  Download,
  FileText,
  Loader2,
  PencilLine,
  RefreshCw,
  Save,
  Sparkles,
  WandSparkles,
} from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import type { ShortStoryRevisionImpact } from "@ai-novel/shared/types/creationStudio";
import {
  applyShortStoryRevision,
  deriveShortStoryLongForm,
  getShortStory,
  previewShortStoryRevision,
  previewShortStoryReplan,
  retryShortStoryProduction,
  updateShortStorySegment,
} from "@/api/creationStudio";
import { downloadNovelExport } from "@/api/novel";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

function createDownload(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export default function ShortStoryStudioPage() {
  const novelId = useParams<{ id: string }>().id ?? "";
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [revisionInstruction, setRevisionInstruction] = useState("");
  const [revisionImpact, setRevisionImpact] = useState<ShortStoryRevisionImpact | null>(null);

  const storyQuery = useQuery({
    queryKey: ["short-story", novelId],
    queryFn: () => getShortStory(novelId),
    enabled: Boolean(novelId),
    refetchInterval: (query) => {
      const production = query.state.data?.data?.production;
      if (production?.diagnostic?.retryAt && Date.parse(production.diagnostic.retryAt) > Date.now()) return 1000;
      const status = production?.status;
      return status === "queued" || status === "running" ? 1800 : false;
    },
  });
  const story = storyQuery.data?.data ?? null;
  const isProducing = story?.production.status === "queued" || story?.production.status === "running";

  useEffect(() => {
    if (!story || editing) return;
    setDrafts(Object.fromEntries(story.segments.map((segment) => [segment.id, segment.content])));
  }, [story, editing]);

  const changedSegments = useMemo(() => {
    if (!story) return [];
    return story.segments.filter((segment) => (drafts[segment.id] ?? segment.content) !== segment.content);
  }, [drafts, story]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!story) return;
      for (const segment of changedSegments) {
        await updateShortStorySegment(novelId, segment.id, {
          content: drafts[segment.id] ?? segment.content,
          expectedVersion: segment.version,
        });
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["short-story", novelId] });
      setEditing(false);
      setRevisionImpact(null);
      toast.success("El texto se guardó y se conservó la instantánea previa a la modificación.");
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "No se pudo guardar, actualice e inténtelo nuevamente."),
  });

  const revisionPreviewMutation = useMutation({
    mutationFn: () => previewShortStoryRevision(novelId, { instruction: revisionInstruction.trim() }),
    onSuccess: (response) => {
      setRevisionImpact(response.data ?? null);
    },
    onError: async (error) => { await queryClient.invalidateQueries({queryKey:["short-story",novelId]}); toast.error(error instanceof Error ? error.message : "No puedo entender esta modificación en este momento."); },
  });

  const replanPreviewMutation = useMutation({
    mutationFn: () => previewShortStoryReplan(novelId),
    onSuccess: (response) => setRevisionImpact(response.data ?? null),
    onError: async (error) => { await queryClient.invalidateQueries({queryKey:["short-story",novelId]}); toast.error(error instanceof Error ? error.message : "El plan de ajuste no se puede generar por el momento."); },
  });

  const revisionApplyMutation = useMutation({
    mutationFn: () => {
      if (!revisionImpact) throw new Error("La vista previa de edición ya no está disponible.");
      return applyShortStoryRevision(novelId, revisionImpact.intentVersionId);
    },
    onSuccess: async () => {
      setRevisionImpact(null);
      setRevisionInstruction("");
      await queryClient.invalidateQueries({ queryKey: ["short-story", novelId] });
      toast.success("La obra ha sido modificada según el alcance confirmado.");
    },
    onError: async (error) => {
      setRevisionImpact(null);
      await queryClient.invalidateQueries({ queryKey: ["short-story", novelId] });
      toast.error(error instanceof Error ? error.message : "Error al aplicar los cambios.");
    },
  });

  const exportMutation = useMutation({
    mutationFn: () => downloadNovelExport(novelId, "txt", "full", story?.novel.title),
    onSuccess: ({ blob, fileName }) => {
      createDownload(blob, fileName);
      toast.success("La exportación ha comenzado.");
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "La exportación falló."),
  });

  const deriveMutation = useMutation({
    mutationFn: () => deriveShortStoryLongForm(novelId),
    onSuccess: (response) => {
      if (response.data?.resumeRoute) navigate(response.data.resumeRoute);
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Por el momento no se puede desarrollar en un artículo completo."),
  });

  const retryMutation = useMutation({
    mutationFn: () => retryShortStoryProduction(novelId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["short-story", novelId] });
      toast.success("La construcción se ha reanudado donde se quedó.");
    },
    onError: async (error) => {
      await queryClient.invalidateQueries({ queryKey: ["short-story", novelId] });
      toast.error(error instanceof Error ? error.message : "Error al continuar la generación.");
    },
  });

  if (storyQuery.isLoading) {
    return <CenteredStatus label="Trabajo de apertura..." />;
  }
  if (!story) {
    return (
      <div className="mx-auto max-w-2xl py-16 text-center">
        <h1 className="text-xl font-semibold">La obra no se puede abrir temporalmente</h1>
        <p className="mt-2 text-sm text-muted-foreground">Vuelva a la lista de trabajo e inténtelo de nuevo.</p>
        <Button asChild className="mt-5"><Link to="/novels">Volver a la lista de trabajo</Link></Button>
      </div>
    );
  }

  return (
    <div className="min-w-0 bg-muted/15 p-3 sm:p-4 xl:p-5">
      <header className="mb-4 rounded-xl border bg-background px-4 py-3 shadow-sm sm:px-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-center gap-2">
              <Button asChild variant="ghost" size="sm" className="-ml-2 shrink-0 text-muted-foreground">
                <Link to="/novels"><ArrowLeft className="mr-1.5 h-4 w-4" />Lista de obras</Link>
              </Button>
              <span className="h-4 w-px bg-border" />
              <h1 className="truncate text-xl font-semibold tracking-tight sm:text-2xl">{story.novel.title}</h1>
            </div>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {story.intent?.understanding ?? "La IA está decidiendo la dirección creativa de esta pieza."}
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2 lg:justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={() => exportMutation.mutate()}
              disabled={exportMutation.isPending || !story.continuousContent}
            >
              <Download className="mr-2 h-4 w-4" />{exportMutation.isPending ? "Exportador…" : "Exportar obra"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => deriveMutation.mutate()}
              disabled={deriveMutation.isPending || isProducing}
            >
              <BookOpen className="mr-2 h-4 w-4" />{deriveMutation.isPending ? "En preparación…" : "Desarrollarse en una larga historia"}
            </Button>
          </div>
        </div>
      </header>

      {story.reference ? <div className="mb-4"><ShortStoryReferenceSummary reference={story.reference} /></div> : null}
      <div className="grid min-w-0 items-start gap-4 xl:grid-cols-[minmax(0,1fr)_380px] 2xl:grid-cols-[minmax(0,1fr)_420px]">
        <main className="min-w-0 space-y-4">
          {isProducing ? (
            <Card className="border-primary/20 bg-primary/[0.03] shadow-none">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Loader2 className="h-5 w-5 animate-spin" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-4 text-sm">
                      <span className="truncate font-medium">{story.production.currentAction ?? "La IA está escribiendo obras completas"}</span>
                      <span className="shrink-0 tabular-nums text-muted-foreground">{Math.round(story.production.progress * 100)}%</span>
                    </div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary transition-all"
                        style={{ width: `${Math.max(3, Math.round(story.production.progress * 100))}%` }}
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : null}

          {story.production.recoveryAction ? (
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm" role="status">
              <div className="font-medium text-destructive">
                {story.production.recoveryAction === "preview_replan" ? "Necesidad de confirmar la nueva dirección de la historia."
                  : story.production.recoveryAction === "preview_revision" ? "Vuelva a verificar el alcance de la modificación."
                  : story.production.recoveryAction === "retry_revision" ? "Modificación suspendida temporalmente" : "Generar interrupción temporal"}
              </div>
              <p className="mt-1 break-words text-muted-foreground">
                {story.production.checkpointSummary ?? story.production.diagnostic?.message ?? story.production.error ?? "Puede continuar desde el contenido guardado."}
              </p>
              {story.production.recoveryAction === "preview_replan" ? (
                <Button className="mt-3" size="sm" onClick={() => { setRevisionImpact(null); replanPreviewMutation.mutate(); }}
                  disabled={replanPreviewMutation.isPending || revisionApplyMutation.isPending || editing}>
                  {replanPreviewMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {replanPreviewMutation.isPending ? "Preparándose para ajustar el plan..." : "Ver plan de ajuste"}
                </Button>
              ) : story.production.recoveryAction === "preview_revision" ? (
                <p className="mt-2 text-muted-foreground">Se conservan el texto guardado y la instantánea previa a la modificación. Describa sus requisitos en "Modificar el trabajo en una oración", luego obtenga una vista previa y confirme.</p>
              ) : (
                <Button className="mt-3" variant="outline" size="sm" onClick={() => retryMutation.mutate()}
                  disabled={retryMutation.isPending || editing || revisionPreviewMutation.isPending || Boolean(story.production.diagnostic?.retryAt && Date.parse(story.production.diagnostic.retryAt) > Date.now())}>
                  {retryMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                  {story.production.recoveryAction === "retry_revision" ? "Continuar modificando" : "Continuar generando"}
                </Button>
              )}
              {story.production.diagnostic ? (
                <details className="mt-3 text-xs leading-6 text-muted-foreground">
                  <summary className="cursor-pointer">Ver información de fallas</summary>
                  <p>{story.production.diagnostic.message}</p>
                  <p>Identificación de diagnóstico:{story.production.diagnostic.id} · Este intento {story.production.diagnostic.attempts} De segunda categoría</p>
                  <p>Modelo:{story.production.diagnostic.provider ?? "Desconocido"} / {story.production.diagnostic.model ?? "Desconocido"}</p>
                  <p>Razón final:{story.production.diagnostic.response.finishReason ?? "Desconocido"} ·HTTP:{story.production.diagnostic.response.httpStatus ?? "Desconocido"}</p>
                  {story.production.diagnostic.retryAt ? <p>Tiempo de reintento:{new Date(story.production.diagnostic.retryAt).toLocaleString()}</p> : null}
                </details>
              ) : null}
              {revisionImpact?.mode === "replan" ? (
                <RevisionPreview
                  impact={revisionImpact}
                  applying={revisionApplyMutation.isPending || editing || isProducing || replanPreviewMutation.isPending}
                  onCancel={() => setRevisionImpact(null)}
                  onConfirm={() => revisionApplyMutation.mutate()}
                />
              ) : null}
            </div>
          ) : null}

          <section className="min-w-0 overflow-hidden rounded-xl border bg-background shadow-sm">
            <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 border-b bg-background/95 px-4 py-3 backdrop-blur sm:px-5">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                  <FileText className="h-4 w-4" />
                </span>
                <div>
                  <div className="text-sm font-medium">{editing ? "Editar texto" : "Manuscrito completo"}</div>
                  <div className="mt-0.5 text-xs tabular-nums text-muted-foreground">
                    {story.continuousContent.replace(/\s+/g, "").length.toLocaleString()} Personaje
                    {editing && changedSegments.length > 0 ? ` · ${changedSegments.length} No guardado en` : ""}
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                {editing ? (
                  <>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setDrafts(Object.fromEntries(story.segments.map((segment) => [segment.id, segment.content])));
                        setEditing(false);
                      }}
                    >
                      Cancelar
                    </Button>
                    <Button size="sm" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || changedSegments.length === 0}>
                      {saveMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                      Guardar cambios
                    </Button>
                  </>
                ) : (
                  <Button variant="outline" size="sm" onClick={() => setEditing(true)} disabled={isProducing || revisionApplyMutation.isPending || revisionPreviewMutation.isPending || replanPreviewMutation.isPending || story.segments.length === 0}>
                    <PencilLine className="mr-2 h-4 w-4" />Editar directamente
                  </Button>
                )}
              </div>
            </div>

            <article className="min-h-[calc(100vh-15rem)] px-5 py-7 sm:px-8 sm:py-9 xl:px-10 2xl:px-12">
              {story.segments.length === 0 ? (
                <div className="flex min-h-[45vh] items-center justify-center text-sm text-muted-foreground">
                  {isProducing ? "El primer párrafo de texto aparecerá aquí una vez completado." : "Aún no hay texto."}
                </div>
              ) : editing ? (
                <div className="overflow-hidden rounded-lg border border-input bg-background focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/10">
                  {story.segments.map((segment) => (
                    <textarea
                      key={segment.id}
                      aria-label="Texto de la obra"
                      value={drafts[segment.id] ?? segment.content}
                      onChange={(event) => setDrafts((current) => ({ ...current, [segment.id]: event.target.value }))}
                      className="block w-full resize-none border-0 bg-transparent px-5 py-3 text-[16px] leading-8 outline-none first:pt-6 last:pb-6"
                      style={{ minHeight: `${Math.max(180, Math.ceil((drafts[segment.id] ?? segment.content).length / 42) * 32)}px` }}
                    />
                  ))}
                </div>
              ) : (
                <div className="whitespace-pre-wrap text-[16px] leading-8 text-foreground selection:bg-primary/15">
                  {story.continuousContent || "El texto aún se está generando."}
                </div>
              )}
            </article>
          </section>
        </main>

        <aside className="min-w-0 space-y-4 xl:sticky xl:top-20 xl:self-start">
          <Card className="border-primary/15 shadow-sm">
            <CardContent className="space-y-4 p-4 sm:p-5">
              <div>
                <div className="flex items-center gap-2 text-base font-semibold">
                  <WandSparkles className="h-4 w-4 text-primary" />
                  Modifica la obra en una frase.
                </div>
                <p className="mt-1.5 text-sm leading-6 text-muted-foreground">Primero obtenga una vista previa del alcance de influencia y luego AI modificará el texto después de la confirmación.</p>
              </div>
              <textarea
                value={revisionInstruction}
                onChange={(event) => {
                  setRevisionInstruction(event.target.value);
                  setRevisionImpact(null);
                }}
                placeholder="Por ejemplo: hacer el final más cálido, pero conservar la elección final del protagonista."
                className="min-h-32 w-full resize-y rounded-lg border border-input bg-background px-3.5 py-3 text-sm leading-6 outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
                disabled={isProducing || story.production.recoveryAction === "preview_replan"}
              />
              <Button
                className="w-full"
                onClick={() => revisionPreviewMutation.mutate()}
                disabled={!revisionInstruction.trim() || revisionPreviewMutation.isPending || replanPreviewMutation.isPending || revisionApplyMutation.isPending || editing || isProducing || story.production.recoveryAction === "preview_replan"}
              >
                {revisionPreviewMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                Rango de modificación de vista previa
              </Button>

              {story.production.diagnostic && !story.production.recoveryAction && !revisionPreviewMutation.isPending ? <div className="rounded-lg bg-destructive/5 p-3 text-sm leading-6" role="status">
                <p>{story.production.diagnostic.message}</p>
                <p className="mt-1 text-xs text-muted-foreground">Identificación de diagnóstico:{story.production.diagnostic.id} · Este intento {story.production.diagnostic.attempts} De segunda categoría</p>
              </div> : null}
              {revisionImpact && revisionImpact.mode !== "replan" ? (
                <RevisionPreview
                  impact={revisionImpact}
                  applying={revisionApplyMutation.isPending || editing || isProducing || replanPreviewMutation.isPending || revisionPreviewMutation.isPending}
                  onCancel={() => setRevisionImpact(null)}
                  onConfirm={() => revisionApplyMutation.mutate()}
                />
              ) : null}
            </CardContent>
          </Card>

          <details className="rounded-xl border bg-background px-4 py-3 text-sm shadow-sm">
            <summary className="cursor-pointer font-medium">Dirección de trabajo y sugerencias de optimización.</summary>
            <div className="mt-4 space-y-4 border-t pt-4 text-muted-foreground">
              <div>
                <div className="text-xs font-medium text-foreground">Dirección creativa</div>
                <p className="mt-1.5 leading-6">{story.intent?.direction.premise ?? "Aún no generado"}</p>
              </div>
              {story.plan?.qualityDebt.length ? (
                <div>
                  <div className="text-xs font-medium text-foreground">Puede continuar optimizando</div>
                  <ul className="mt-2 list-disc space-y-1.5 pl-5">
                    {story.plan.qualityDebt.map((item) => <li key={item}>{item}</li>)}
                  </ul>
                </div>
              ) : (
                <p>No hay recomendaciones generales de calidad pendientes.</p>
              )}
            </div>
          </details>
        </aside>
      </div>
    </div>
  );
}

function RevisionPreview(props: {
  impact: ShortStoryRevisionImpact;
  applying: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const impact = props.impact;
  const strategyLabel = impact.recommendedStrategy === "local_patch"
    ? "Ajuste local"
    : impact.recommendedStrategy === "rewrite_downstream"
      ? "Ajustar hacia atrás desde el punto de impacto."
      : "Vuelva a planificar todo el artículo";
  return (
    <div className={impact.mode === "replan" ? "mt-4 rounded-lg bg-background/80 p-4" : "rounded-xl border border-primary/25 bg-primary/[0.03] p-4"}>
      <div className="font-medium">{impact.mode === "replan" ? "Plan de ajuste de la historia" : "Comprensión de las modificaciones por parte de la IA"}</div>
      <p className="mt-2 text-sm leading-6">{impact.understoodGoal}</p>
      <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
        <PreviewFact label="Manera sugerida" value={strategyLabel} />
        <PreviewFact label="Alcance de influencia" value={`${impact.affectedSegmentIds.length} área de texto`} />
        <PreviewFact label="Finalizando" value={impact.changesEnding ? "Cambiará" : "Mantener"} />
        <PreviewFact label="Intención central" value={impact.changesCoreIntent ? "Cambiará" : "Mantener"} />
      </div>
      <p className="mt-4 text-sm leading-6 text-muted-foreground">{impact.summary}</p>
      {impact.direction ? <div className="mt-4 text-sm leading-6"><strong>{impact.direction.title}</strong><p>{impact.direction.premise}</p></div> : null}
      {impact.endingPromise ? <p className="mt-3 text-sm leading-6"><strong>Disposición final:</strong>{impact.endingPromise}</p> : null}
      {impact.preservedFacts?.length ? <div className="mt-3 text-sm leading-6"><strong>hechos de la historia preservados</strong><ul className="list-disc pl-5">{impact.preservedFacts.map((fact) => <li key={fact}>{fact}</li>)}</ul></div> : null}
      {impact.segmentPurposes?.length ? <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm leading-6">{impact.segmentPurposes.map((segment) => <li key={segment.order}>{segment.purpose}</li>)}</ol> : null}
      <p className="mt-3 text-xs leading-5 text-muted-foreground">Después de la confirmación, se generará el contenido del ajuste y el texto se actualizará una vez completado todo; Al cerrar la vista previa se conservará el texto actual.</p>
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="ghost" onClick={props.onCancel} disabled={props.applying}>No lo modifiques todavía</Button>
        <Button onClick={props.onConfirm} disabled={props.applying}>
          {props.applying && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {impact.mode === "replan" ? "Confirmar y continuar" : "Confirmar y aplicar"}
        </Button>
      </div>
    </div>
  );
}

function PreviewFact(props: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-background px-3 py-2">
      <div className="text-xs text-muted-foreground">{props.label}</div>
      <div className="mt-1 font-medium">{props.value}</div>
    </div>
  );
}

function CenteredStatus({ label }: { label: string }) {
  return (
    <div className="flex min-h-[50vh] items-center justify-center text-sm text-muted-foreground">
      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      {label}
    </div>
  );
}
