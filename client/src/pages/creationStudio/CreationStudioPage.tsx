import { getBookAnalysis } from "@/api/bookAnalysis";
import { ShortStoryReferenceSummary } from "@/components/creation/ShortStoryReferenceSummary";
import { isReadableBookAnalysisSection } from "@/pages/bookAnalysis/bookAnalysisWorkspaceViewModel";
import { BOOK_ANALYSIS_SECTIONS, type BookAnalysisSectionKey } from "@ai-novel/shared/types/bookAnalysis";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ArrowUpRight, Check, Loader2, RefreshCw, Sparkles } from "lucide-react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import type {
  CreationDirection,
  NarrativeForm,
} from "@ai-novel/shared/types/creationStudio";
import type { WritingPlatform, WritingPlatformPreference } from "@ai-novel/shared/types/writingPlatform";
import {
  confirmCreationDirection,
  getCreationStudioTask,
  interpretCreationIdea,
  regenerateCreationDirections,
} from "@/api/creationStudio";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

function normalizeTarget(form: NarrativeForm, value: number): number {
  if (form === "short_story") return Math.max(3000, Math.min(30000, Math.round(value)));
  return Math.max(50000, Math.min(3_000_000, Math.round(value)));
}

export default function CreationStudioPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const taskId = searchParams.get("taskId")?.trim() ?? "";
  const shortStoryEntry = searchParams.get("form") === "short_story";
  const longNovelEntry = searchParams.get("form") === "long_novel";
  const [referenceGoal, setReferenceGoal] = useState("Aprovecha la estructura, el ritmo y la escritura para crear una historia corta nueva y completa.");
  const [referenceSections, setReferenceSections] = useState<BookAnalysisSectionKey[]>([]);
  const [idea, setIdea] = useState("");
  const [selectedDirectionId, setSelectedDirectionId] = useState("");
  const [narrativeForm, setNarrativeForm] = useState<NarrativeForm>("short_story");
  const [targetWordCount, setTargetWordCount] = useState(8000);
  const [confirmedBaseline, setConfirmedBaseline] = useState("");
  const [initialPlatformPreference, setInitialPlatformPreference] = useState<WritingPlatformPreference>("ai_recommend");
  const [writingPlatform, setWritingPlatform] = useState<WritingPlatform>("fanqie_free");

  const taskQuery = useQuery({
    queryKey: ["creation-studio", taskId],
    queryFn: () => getCreationStudioTask(taskId),
    enabled: Boolean(taskId),
    refetchInterval: (query) => {
      const status = query.state.data?.data?.status;
      return status === "queued" || status === "running" ? 1500 : false;
    },
    retry: false,
  });
  const task = taskQuery.data?.data ?? null;
  const [retryClock, setRetryClock] = useState(Date.now);
  const retryAt = task?.diagnostic?.retryAt;
  const retryWaiting = Boolean(retryAt && Date.parse(retryAt) > retryClock);
  useEffect(() => {
    if (!retryWaiting) return;
    const timer = window.setTimeout(() => setRetryClock(Date.now()), 1000);
    return () => window.clearTimeout(timer);
  }, [retryWaiting, retryClock]);
  const interpretation = task?.interpretation ?? null;
  const referenceAnalysisId = searchParams.get("bookAnalysisId") ?? task?.referenceSelection?.analysisId ?? "";
  const referenceDocumentId = searchParams.get("sourceDocumentId") ?? task?.referenceSelection?.documentId ?? "";
  const referenceRequested = Boolean(referenceAnalysisId || referenceDocumentId || task?.reference);
  const referenceQuery = useQuery({ queryKey: ["short-story-reference", referenceAnalysisId],
    queryFn: () => getBookAnalysis(referenceAnalysisId), enabled: Boolean(referenceAnalysisId && !interpretation), retry: false });
  const sourceAnalysis = referenceQuery.data?.data;
  const availableReferenceSections = sourceAnalysis?.sections.filter((section) =>
    (section.status === "succeeded" || section.frozen) && isReadableBookAnalysisSection(section)
  ) ?? [];
  const referenceUnavailable = referenceRequested && !interpretation && (!sourceAnalysis || sourceAnalysis.documentId !== referenceDocumentId || sourceAnalysis.status !== "succeeded");
  const referenceSelectionReady = !referenceRequested || (!referenceUnavailable && Boolean(referenceGoal.trim()) && referenceSections.length > 0);
  const canGenerateWithoutIdea = referenceRequested && referenceSelectionReady;
  useEffect(() => {
    if (!sourceAnalysis) return;
    const availableKeys = new Set(availableReferenceSections.map((section) => section.sectionKey));
    const selectedKeys = task?.referenceSelection?.sectionKeys ?? availableReferenceSections.map((section) => section.sectionKey);
    setReferenceSections(selectedKeys.filter((key) => availableKeys.has(key)));
  }, [sourceAnalysis]);
  useEffect(() => {
    if (task?.referenceSelection) setReferenceGoal(task.referenceSelection.goal);
  }, [task?.taskId, task?.referenceSelection?.goal]);

  useEffect(() => {
    if (!task) return;
    setIdea((current) => current || task.idea);
    if (!interpretation) return;
    setNarrativeForm(interpretation.recommendedNarrativeForm);
    setTargetWordCount(interpretation.recommendedTargetWordCount);
    setSelectedDirectionId((current) => current || interpretation.directions[0].id);
    setWritingPlatform(interpretation.recommendedWritingPlatform);
    setConfirmedBaseline(`${interpretation.recommendedNarrativeForm}:${interpretation.recommendedTargetWordCount}:${interpretation.recommendedWritingPlatform}`);
  }, [task?.taskId, interpretation]);

  const currentScaleKey = `${narrativeForm}:${targetWordCount}:${writingPlatform}`;
  const scaleNeedsRefresh = Boolean(interpretation && confirmedBaseline && currentScaleKey !== confirmedBaseline);
  const selectedDirection = useMemo(
    () => interpretation?.directions.find((direction) => direction.id === selectedDirectionId) ?? null,
    [interpretation, selectedDirectionId],
  );

  const interpretMutation = useMutation({
    mutationFn: () => taskId && task?.status === "failed" ? regenerateCreationDirections(taskId, {
      ...(referenceRequested ? {reference:{analysisId:referenceAnalysisId,documentId:referenceDocumentId,sectionKeys:referenceSections,goal:referenceGoal.trim()}} : {}),
      narrativeForm: referenceRequested || shortStoryEntry ? "short_story" : narrativeForm,
      targetWordCount, writingPlatformPreference: initialPlatformPreference,
    }) : interpretCreationIdea({
      ...(referenceRequested ? {reference:{analysisId:referenceAnalysisId,documentId:referenceDocumentId,sectionKeys:referenceSections,goal:referenceGoal.trim()}} : {}),
      idea: idea.trim(),
      preferredNarrativeForm: shortStoryEntry ? "short_story" : undefined,
      ...(longNovelEntry ? {preferredNarrativeForm: "long_novel" as const} : {}),
      writingPlatformPreference: initialPlatformPreference,
    }),
    onSuccess: (response) => {
      const created = response.data;
      if (!created) return;
      queryClient.setQueryData(["creation-studio", created.taskId], response);
      setSearchParams({ taskId: created.taskId, ...(referenceRequested ? {form:"short_story"} : {}) }, { replace: true });
      if (created.status === "failed") { toast.error(created.diagnostic?.message ?? created.error ?? "La dirección creativa no está completa, verifique el mensaje de error antes de continuar."); return; }
      toast.success("La IA ha seleccionado dos direcciones alternativas.");
    },
    onError: async (error) => {
      if (taskId) await queryClient.invalidateQueries({ queryKey: ["creation-studio", taskId] });
      toast.error(error instanceof Error ? error.message : "No puedo entender esta idea en este momento, inténtalo de nuevo.");
    },
  });

  const regenerateMutation = useMutation({
    mutationFn: () => regenerateCreationDirections(taskId, {
      narrativeForm,
      targetWordCount: normalizeTarget(narrativeForm, targetWordCount),
      writingPlatformPreference: writingPlatform,
      feedback: "Reajuste las dos direcciones de acuerdo con mi escala de trabajo ajustada y mi plataforma de destino.",
    }),
    onSuccess: async (response) => {
      setConfirmedBaseline(`${narrativeForm}:${normalizeTarget(narrativeForm, targetWordCount)}:${writingPlatform}`);
      setSelectedDirectionId(response.data?.interpretation?.directions[0].id ?? "");
      await queryClient.invalidateQueries({ queryKey: ["creation-studio", taskId] });
      toast.success("Se han actualizado las instrucciones para la nueva escala del trabajo.");
    },
    onError: async (error) => { await queryClient.invalidateQueries({queryKey:["creation-studio",taskId]}); toast.error(error instanceof Error ? error.message : "Error en la dirección de actualización."); },
  });

  const confirmMutation = useMutation({
    mutationFn: () => {
      if (!selectedDirection) throw new Error("Primero elija una dirección.");
      return confirmCreationDirection(taskId, {
        directionId: selectedDirection.id,
        narrativeForm,
        targetWordCount: normalizeTarget(narrativeForm, targetWordCount),
        idempotencyKey: `creation:${taskId}:${selectedDirection.id}`,
        writingPlatform,
      });
    },
    onSuccess: (response) => {
      if (response.data?.resumeRoute) navigate(response.data.resumeRoute);
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "No se pudo iniciar la creación."),
  });

  if (taskId && taskQuery.isLoading) {
    return <CenteredStatus label="Reviviendo tus ideas creativas..." />;
  }

  return (
    <div className="w-full space-y-10 px-4 py-5 sm:px-6 sm:py-7 lg:px-8">
      <div className="flex w-full flex-wrap items-center justify-between gap-3">
        <Button asChild variant="ghost" size="sm" className="-ml-3 text-muted-foreground hover:text-foreground">
          <Link to="/novels"><ArrowLeft className="mr-2 h-4 w-4" />Volver a la lista de trabajo</Link>
        </Button>
        <Button asChild variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
          <Link to="/novels/create">
            Configuración completa
            <ArrowUpRight className="ml-1.5 h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        </Button>
      </div>

      <section className="w-full pt-3 sm:pt-8">
        <div className="text-[11px] font-medium uppercase tracking-[0.24em] text-muted-foreground">
          {shortStoryEntry ? "Escritura de cuentos · 3000—30 000 palabras" : "Estudio de creación de IA"}
        </div>
        <h1 className="mt-4 max-w-3xl text-4xl font-semibold leading-[1.08] tracking-[-0.045em] text-foreground sm:text-5xl lg:text-[3.5rem]">
          {shortStoryEntry ? "De una idea a un cuento completo" : "De una idea a una obra completa"}
        </h1>
        <p className="mt-5 max-w-2xl text-sm leading-7 text-muted-foreground sm:text-base">
          {shortStoryEntry
            ? "Escribe una imagen, un personaje o alguna emoción que quieras expresar. AI lo organizará en dos direcciones claras y lo escribirá directamente en un trabajo completo después de la confirmación."
            : "No es necesario entender primero la estructura y la planificación. Escriba la parte que más desee expresar y la IA clasificará la escala del trabajo y dos direcciones claras."}
        </p>
      </section>

      {task?.status === "failed" ? <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm" role="status">
        <p>{task.diagnostic?.message ?? task.error ?? "La generación de dirección no está completa, puede continuar desde esta página."}</p>
        {task.diagnostic ? <p className="mt-2 text-xs text-muted-foreground">Identificación de diagnóstico:{task.diagnostic.id} · Este intento {task.diagnostic.attempts} Segunda categoría · {task.diagnostic.model ?? "Modelo desconocido"}</p> : null}
        {retryWaiting && retryAt ? <p className="mt-2 text-xs text-muted-foreground">Disponible en {new Date(retryAt).toLocaleTimeString()} Continuar más tarde.</p> : null}
        {interpretation ? <Button className="mt-3" variant="outline" onClick={() => regenerateMutation.mutate()} disabled={regenerateMutation.isPending || retryWaiting}>Reorientar</Button> : null}
      </div> : null}
      {task?.reference ? <div className="space-y-3"><ShortStoryReferenceSummary reference={task.reference} confirmed={Boolean(task.novelId)} />
        {task.reference.sourceState !== "available" && !task.novelId ? <Button variant="outline" onClick={() => regenerateMutation.mutate()} disabled={regenerateMutation.isPending || retryWaiting}>Vuelva a leer la referencia y genere instrucciones.</Button> : null}
      </div> : referenceRequested ? <section className="space-y-3 rounded-xl bg-muted/30 p-4" aria-label="Configuración de creación de referencias">
        <p className="text-sm font-medium">Novela de referencia:{sourceAnalysis?.documentTitle ?? "Cargando fuentes de referencia…"}</p>
        {referenceUnavailable && !referenceQuery.isLoading ? <p className="text-sm text-destructive">La fuente de referencia no está disponible o el análisis no se ha completado. Regrese a la entrada de la novela de referencia y seleccione nuevamente.</p> : null}
        <label className="block text-sm">¿De qué esperas aprender?<Input className="mt-2" value={referenceGoal} maxLength={4000} onChange={(event) => setReferenceGoal(event.target.value)} /></label>
        <div className="flex flex-wrap gap-4 text-sm" aria-label="Elige abrir la conclusión del libro.">{availableReferenceSections.map((section) => <label className="flex items-center gap-2" key={section.sectionKey}>
          <input type="checkbox" checked={referenceSections.includes(section.sectionKey)} onChange={(event) => setReferenceSections((keys) => event.target.checked ? [...keys,section.sectionKey] : keys.filter((key) => key !== section.sectionKey))} />
          {BOOK_ANALYSIS_SECTIONS.find((item) => item.key === section.sectionKey)?.title ?? section.title}
        </label>)}</div>
      </section> : null}
      {!interpretation ? (
        <section
          aria-labelledby="creation-idea-heading"
          className="mx-auto w-full max-w-4xl rounded-2xl bg-muted/20 p-3 shadow-[0_14px_44px_rgba(15,23,42,0.06)] transition focus-within:bg-background focus-within:ring-2 focus-within:ring-primary/30 sm:p-4"
        >
          <div className="flex items-start justify-between gap-4 px-1 pt-1">
            <div>
              <div className="text-xs font-medium text-muted-foreground">01 · Punto de partida</div>
              <h2 id="creation-idea-heading" className="mt-2 text-xl font-semibold tracking-[-0.02em]">
                ¿Dónde comienza la historia?
              </h2>
            </div>
            {idea ? (
              <span className="pt-1 text-xs tabular-nums text-muted-foreground">
                {idea.length.toLocaleString()} / 12,000
              </span>
            ) : null}
          </div>
          <textarea
            value={idea}
            readOnly={Boolean(taskId)}
            onChange={(event) => setIdea(event.target.value)}
            placeholder={referenceRequested
              ? "Puede dejarlo en blanco y la IA creará una historia corta original basada en el objetivo de referencia; también puedes agregar nuevos personajes o conflictos..."
              : "Por ejemplo: una chica que siempre puede oír mentiras se encuentra con la única persona que no puede distinguir la verdad de las mentiras..."}
            aria-label={shortStoryEntry ? "Escribe ideas para cuentos cortos." : "Escribir ideas para historias"}
            className="mt-5 min-h-[180px] w-full resize-none bg-transparent px-1 py-1 text-base leading-7 text-foreground outline-none placeholder:text-muted-foreground/60 sm:text-lg sm:leading-8"
            maxLength={12000}
            autoFocus
          />
          <div className="flex flex-col gap-3 border-t border-border/60 pt-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-2 text-sm text-muted-foreground">
              <span className="shrink-0">Plataforma de destino</span>
              <Select
                value={initialPlatformPreference}
                onValueChange={(value) => setInitialPlatformPreference(value as WritingPlatformPreference)}
              >
                <SelectTrigger aria-label="Seleccionar plataforma de destino" className="h-9 min-w-[11rem] rounded-md px-2.5 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ai_recommend">Deja que AI te recomiende</SelectItem>
                  <SelectItem value="fanqie_free">Artículos web sin tomate</SelectItem>
                  {!shortStoryEntry ? <SelectItem value="qidian_male">Canal masculino qidian</SelectItem> : null}
                  {!shortStoryEntry ? <SelectItem value="jinjiang_female">Canal femenino de jinjiang</SelectItem> : null}
                  <SelectItem value="zhihu_story">Cuentos cortos de Zhihu.</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <span className="text-xs leading-5 text-muted-foreground">{referenceRequested ? "No es necesario que llenes tu imaginación, la IA generará instrucciones originales para historias cortas basadas en objetivos de referencia." : "Personajes, escenas, conflictos, simplemente escribe cualquiera de ellos."}</span>
              <Button
                size="lg"
                className="h-11 rounded-full px-6 shadow-none"
                onClick={() => interpretMutation.mutate()}
                disabled={(!idea.trim() && !canGenerateWithoutIdea) || interpretMutation.isPending || retryWaiting || !referenceSelectionReady}
              >
                {interpretMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                Generar dirección creativa
              </Button>
            </div>
          </div>
        </section>
      ) : (
        <div className="space-y-6">
          <Card className="border-border/70 bg-muted/20">
            <CardContent className="grid gap-5 p-5 md:grid-cols-[minmax(0,1fr)_18rem]">
              <div>
                <div className="text-xs font-medium uppercase tracking-wider text-primary">La comprensión de las obras por parte de la IA</div>
                <p className="mt-2 text-sm leading-7 text-foreground">{interpretation.understanding}</p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{interpretation.recommendationReason}</p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">Recomendaciones de plataforma:{interpretation.writingPlatformReason}</p>
                {interpretation.productionFoundation ? (
                  <div className="mt-4 border-t border-border/60 pt-3">
                    <div className="text-xs text-muted-foreground">Base creativa sugerida por IA</div>
                    <div className="mt-1 text-sm font-medium text-foreground">
                      {interpretation.productionFoundation.genre.path}
                      <span className="mx-2 text-muted-foreground">×</span>
                      {interpretation.productionFoundation.primaryStoryMode.path}
                      {interpretation.productionFoundation.secondaryStoryMode
                        ? ` + ${interpretation.productionFoundation.secondaryStoryMode.path}`
                        : ""}
                    </div>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                      {interpretation.productionFoundation.summary}
                    </p>
                  </div>
                ) : null}
              </div>
              <ScaleControls
                shortOnly={referenceRequested}
                narrativeForm={narrativeForm}
                targetWordCount={targetWordCount}
                onFormChange={(form) => {
                  setNarrativeForm(form);
                  setTargetWordCount(form === "short_story" ? 8000 : 200000);
                  setWritingPlatform("fanqie_free");
                }}
                onTargetChange={setTargetWordCount}
                writingPlatform={writingPlatform}
                onPlatformChange={setWritingPlatform}
              />
            </CardContent>
          </Card>

          {scaleNeedsRefresh ? (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-300/60 bg-amber-50/50 px-4 py-3 dark:bg-amber-950/10">
              <p className="text-sm text-muted-foreground">Si cambia la escala del trabajo o la plataforma de destino, deje que la IA vuelva a adaptar la dirección primero.</p>
              <Button
                variant="outline"
                onClick={() => regenerateMutation.mutate()}
                disabled={regenerateMutation.isPending}
              >
                <RefreshCw className={cn("mr-2 h-4 w-4", regenerateMutation.isPending && "animate-spin")} />
                Actualizar direcciones a una nueva escala
              </Button>
            </div>
          ) : null}

          <div className="grid gap-4 lg:grid-cols-2">
            {interpretation.directions.map((direction) => (
              <DirectionCard
                key={direction.id}
                direction={direction}
                selected={direction.id === selectedDirectionId}
                onSelect={() => setSelectedDirectionId(direction.id)}
              />
            ))}
          </div>

          <div className="sticky bottom-3 z-10 flex flex-col gap-3 rounded-2xl border bg-background/95 p-4 shadow-lg backdrop-blur sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-sm font-medium">{selectedDirection ? `se basará en "${selectedDirection.title}"comenzar` : "Por favor elige una dirección"}</div>
              <div className="mt-1 text-xs text-muted-foreground">
                {narrativeForm === "short_story" ? "Se generará directamente un trabajo breve continuo y completo." : "Se entregará al director automático del largometraje para que continúe con la preparación de todo el libro."}
              </div>
            </div>
            <Button
              size="lg"
              onClick={() => confirmMutation.mutate()}
              disabled={!selectedDirection || scaleNeedsRefresh || confirmMutation.isPending || task?.status === "failed" || Boolean(task?.reference && task.reference.sourceState !== "available")}
            >
              {confirmMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
              Confirma esta dirección y comienza.
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function DirectionCard(props: {
  direction: CreationDirection;
  selected: boolean;
  onSelect: () => void;
}) {
  const direction = props.direction;
  return (
    <button type="button" className="h-full text-left" onClick={props.onSelect} aria-pressed={props.selected}>
      <Card className={cn(
        "h-full transition hover:border-primary/50 hover:shadow-sm",
        props.selected && "border-primary ring-2 ring-primary/15",
      )}>
        <CardContent className="space-y-4 p-5">
          <div className="flex items-start justify-between gap-3">
            <h2 className="text-xl font-semibold">{direction.title}</h2>
            <span className={cn(
              "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border",
              props.selected ? "border-primary bg-primary text-primary-foreground" : "border-border",
            )}>
              {props.selected ? <Check className="h-3.5 w-3.5" /> : null}
            </span>
          </div>
          <p className="text-sm leading-7 text-foreground">{direction.premise}</p>
          <div className="grid gap-3 text-sm sm:grid-cols-2">
            <DirectionFact label="Experiencia central" value={direction.coreExperience} />
            <DirectionFact label="Protagonista" value={direction.protagonist} />
            <DirectionFact label="Conflicto principal" value={direction.centralConflict} />
            <DirectionFact label="Finalizar el pago" value={direction.endingPromise} />
          </div>
          <div className="flex flex-wrap gap-2">
            {direction.styleKeywords.map((keyword) => (
              <span key={keyword} className="rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">{keyword}</span>
            ))}
          </div>
        </CardContent>
      </Card>
    </button>
  );
}

function DirectionFact(props: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{props.label}</div>
      <div className="mt-1 leading-6">{props.value}</div>
    </div>
  );
}

function ScaleControls(props: {
  shortOnly?: boolean;
  narrativeForm: NarrativeForm;
  targetWordCount: number;
  onFormChange: (value: NarrativeForm) => void;
  onTargetChange: (value: number) => void;
  writingPlatform: WritingPlatform;
  onPlatformChange: (value: WritingPlatform) => void;
}) {
  return (
    <div className="space-y-3 rounded-xl border bg-background p-4">
      <div className="text-xs font-medium text-muted-foreground">Escala de trabajo</div>
      <div className="grid grid-cols-2 gap-2">
        <Button
          type="button"
          size="sm"
          variant={props.narrativeForm === "short_story" ? "default" : "outline"}
          onClick={() => props.onFormChange("short_story")}
        >
          cuento corto
        </Button>
        <Button
          type="button"
          size="sm"
          variant={props.narrativeForm === "long_novel" ? "default" : "outline"}
          disabled={props.shortOnly}
          onClick={() => props.onFormChange("long_novel")}
        >
          larga historia
        </Button>
      </div>
      <label className="block">
        <span className="text-xs text-muted-foreground">Palabras objetivo</span>
        <Input
          className="mt-1"
          type="number"
          min={props.narrativeForm === "short_story" ? 3000 : 30001}
          max={props.narrativeForm === "short_story" ? 30000 : 3000000}
          step={1000}
          value={props.targetWordCount}
          onChange={(event) => props.onTargetChange(Number(event.target.value))}
        />
      </label>
      <div className="block">
        <span className="text-xs text-muted-foreground">Plataforma de destino</span>
        <Select
          value={props.writingPlatform}
          onValueChange={(value) => props.onPlatformChange(value as WritingPlatform)}
        >
          <SelectTrigger className="mt-1 h-10 rounded-md">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="fanqie_free">Artículos web sin tomate</SelectItem>
            {props.narrativeForm === "long_novel" ? <SelectItem value="qidian_male">Canal masculino qidian</SelectItem> : null}
            {props.narrativeForm === "long_novel" ? <SelectItem value="jinjiang_female">Canal femenino de jinjiang</SelectItem> : null}
            {props.narrativeForm === "short_story" ? <SelectItem value="zhihu_story">Cuentos cortos de Zhihu.</SelectItem> : null}
          </SelectContent>
        </Select>
        <p className="mt-2 text-[11px] leading-5 text-muted-foreground">La IA ajustará la apertura, la progresión, la recompensa y la lectura del idioma según la plataforma.</p>
      </div>
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
