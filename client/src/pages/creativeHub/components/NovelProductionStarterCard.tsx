import { useEffect, useRef, useState, type ReactNode } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { CreativeHubProductionStatus } from "@ai-novel/shared/types/creativeHub";
import { RefreshCw } from "lucide-react";
import { getNovelDetail, updateNovel } from "@/api/novel";
import { queryKeys } from "@/api/queryKeys";
import { WorkspaceStateNotice } from "@/components/workspace";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import SelectControl from "@/components/common/SelectControl";

interface NovelProductionStarterCardProps {
  currentNovelTitle?: string | null;
  currentNovelId?: string | null;
  productionStatus?: CreativeHubProductionStatus | null;
  actionDisabled?: boolean;
  onSubmit: (prompt: string) => void | Promise<void>;
  onQuickAction?: (prompt: string) => void;
}

function ProductionField(props: {
  htmlFor: string;
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="min-w-0 space-y-1.5">
      <label htmlFor={props.htmlFor} className="block text-xs font-medium text-foreground">
        {props.label}
      </label>
      {props.children}
      {props.hint ? <p className="text-xs leading-5 text-muted-foreground">{props.hint}</p> : null}
    </div>
  );
}

function fromNarrativePov(value: "first_person" | "third_person" | "mixed" | null | undefined): string {
  if (value === "first_person") return "Primera persona";
  if (value === "third_person") return "Tercera persona";
  if (value === "mixed") return "Voz mixta";
  return "";
}

function toNarrativePov(value: string): "first_person" | "third_person" | "mixed" | null {
  if (value === "Primera persona") return "first_person";
  if (value === "Tercera persona") return "third_person";
  if (value === "Voz mixta") return "mixed";
  return null;
}

function fromPacePreference(value: "slow" | "balanced" | "fast" | null | undefined): string {
  if (value === "slow") return "Ritmo lento";
  if (value === "balanced") return "Ritmo equilibrado";
  if (value === "fast") return "Ritmo rápido";
  return "";
}

function toPacePreference(value: string): "slow" | "balanced" | "fast" | null {
  if (value === "Ritmo lento") return "slow";
  if (value === "Ritmo equilibrado") return "balanced";
  if (value === "Ritmo rápido") return "fast";
  return null;
}

function fromProjectMode(value: "ai_led" | "co_pilot" | "draft_mode" | "auto_pipeline" | null | undefined): string {
  if (value === "ai_led") return "Dirigido por IA";
  if (value === "co_pilot") return "Colaboración hombre-máquina";
  if (value === "draft_mode") return "Borrador primero";
  if (value === "auto_pipeline") return "Línea de montaje automática";
  return "";
}

function toProjectMode(value: string): "ai_led" | "co_pilot" | "draft_mode" | "auto_pipeline" | null {
  if (value === "Dirigido por IA") return "ai_led";
  if (value === "Colaboración hombre-máquina") return "co_pilot";
  if (value === "Borrador primero") return "draft_mode";
  if (value === "Línea de montaje automática") return "auto_pipeline";
  return null;
}

function fromLevel(value: "low" | "medium" | "high" | null | undefined): string {
  if (value === "low") return "Bajo";
  if (value === "medium") return "Medio";
  if (value === "high") return "Alto";
  return "";
}

function toLevel(value: string): "low" | "medium" | "high" | null {
  if (value === "Bajo") return "low";
  if (value === "Medio") return "medium";
  if (value === "Alto") return "high";
  return null;
}

function buildProductionPrompt(input: {
  currentNovelId?: string | null;
  title: string;
  description: string;
  targetChapterCount: number;
  genre: string;
  styleTone: string;
  narrativePov: string;
  pacePreference: string;
  projectMode: string;
  emotionIntensity: string;
  aiFreedom: string;
  defaultChapterLength: number;
  worldType: string;
}) {
  const description = input.description.trim();
  const genre = input.genre.trim();
  const styleTone = input.styleTone.trim();
  const narrativePov = input.narrativePov.trim();
  const pacePreference = input.pacePreference.trim();
  const projectMode = input.projectMode.trim();
  const emotionIntensity = input.emotionIntensity.trim();
  const aiFreedom = input.aiFreedom.trim();
  const defaultChapterLength = Math.max(500, Math.min(10000, Math.floor(input.defaultChapterLength || 2500)));
  const worldType = input.worldType.trim();
  const targetChapterCount = Math.max(1, Math.min(200, Math.floor(input.targetChapterCount || 20)));
  if (input.currentNovelId) {
    const segments = [`Continuar generando la novela actual. Número objetivo de capítulos:${targetChapterCount}.`];
    if (description) {
      segments.push(`Configuraciones adicionales:${description}.`);
    }
    if (genre) {
      segments.push(`Preferencia de tema:${genre}.`);
    }
    if (styleTone) {
      segments.push(`Tono de estilo:${styleTone}.`);
    }
    if (narrativePov) {
      segments.push(`Perspectiva narrativa:${narrativePov}.`);
    }
    if (pacePreference) {
      segments.push(`Ritmo de avance:${pacePreference}.`);
    }
    if (projectMode) {
      segments.push(`Modo de colaboración:${projectMode}.`);
    }
    if (emotionIntensity) {
      segments.push(`Intensidad emocional:${emotionIntensity}.`);
    }
    if (aiFreedom) {
      segments.push(`Grados de libertad de la IA:${aiFreedom}.`);
    }
    if (defaultChapterLength) {
      segments.push(`Longitud predeterminada del capítulo: aprox. ${defaultChapterLength} palabras.`);
    }
    if (worldType) {
      segments.push(`Preferencia de tipo de cosmovisión:${worldType}.`);
    }
    return segments.join("");
  }
  const title = input.title.trim();
  const segments = [`Crear un libro${targetChapterCount}Novela del capítulo "${title}» y comenzar a generar el libro completo.`];
  if (description) {
    segments.push(`Introducción:${description}.`);
  }
  if (genre) {
    segments.push(`Tema:${genre}.`);
  }
  if (styleTone) {
    segments.push(`Tono de estilo:${styleTone}.`);
  }
  if (narrativePov) {
    segments.push(`Perspectiva narrativa:${narrativePov}.`);
  }
  if (pacePreference) {
    segments.push(`Ritmo de avance:${pacePreference}.`);
  }
  if (projectMode) {
    segments.push(`Modo de colaboración:${projectMode}.`);
  }
  if (emotionIntensity) {
    segments.push(`Intensidad emocional:${emotionIntensity}.`);
  }
  if (aiFreedom) {
    segments.push(`Grados de libertad de la IA:${aiFreedom}.`);
  }
  if (defaultChapterLength) {
    segments.push(`Longitud predeterminada del capítulo: aprox. ${defaultChapterLength} palabras.`);
  }
  if (worldType) {
    segments.push(`Tipo de visión del mundo:${worldType}.`);
  }
  return segments.join("");
}

export default function NovelProductionStarterCard({
  currentNovelTitle,
  currentNovelId,
  productionStatus,
  actionDisabled = false,
  onSubmit,
  onQuickAction,
}: NovelProductionStarterCardProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [targetChapterCount, setTargetChapterCount] = useState(20);
  const [genre, setGenre] = useState("");
  const [styleTone, setStyleTone] = useState("");
  const [narrativePov, setNarrativePov] = useState("");
  const [pacePreference, setPacePreference] = useState("");
  const [projectMode, setProjectMode] = useState("");
  const [emotionIntensity, setEmotionIntensity] = useState("");
  const [aiFreedom, setAiFreedom] = useState("");
  const [defaultChapterLength, setDefaultChapterLength] = useState(2500);
  const [worldType, setWorldType] = useState("");
  const submitInFlightRef = useRef(false);

  const novelDetailQuery = useQuery({
    queryKey: queryKeys.novels.detail(currentNovelId || "none"),
    queryFn: () => getNovelDetail(currentNovelId!),
    enabled: Boolean(currentNovelId),
    retry: false,
  });

  useEffect(() => {
    setTitle("");
    setDescription("");
    setTargetChapterCount(20);
    setGenre("");
    setStyleTone("");
    setNarrativePov("");
    setPacePreference("");
    setProjectMode("");
    setEmotionIntensity("");
    setAiFreedom("");
    setDefaultChapterLength(2500);
    setWorldType("");
  }, [currentNovelId]);

  useEffect(() => {
    if (productionStatus?.targetChapterCount) {
      setTargetChapterCount(productionStatus.targetChapterCount);
    }
  }, [productionStatus?.targetChapterCount]);

  useEffect(() => {
    const novel = novelDetailQuery.data?.data;
    if (!currentNovelId || !novel) {
      return;
    }
    setDescription(novel.description ?? "");
    setGenre(novel.genre?.name ?? "");
    setStyleTone(novel.styleTone ?? "");
    setNarrativePov(fromNarrativePov(novel.narrativePov));
    setPacePreference(fromPacePreference(novel.pacePreference));
    setProjectMode(fromProjectMode(novel.projectMode));
    setEmotionIntensity(fromLevel(novel.emotionIntensity));
    setAiFreedom(fromLevel(novel.aiFreedom));
    setDefaultChapterLength(novel.defaultChapterLength ?? 2500);
  }, [currentNovelId, novelDetailQuery.data]);

  const resolvedTitle = currentNovelTitle?.trim() || "";
  const isContinueMode = Boolean(currentNovelId);
  const detailErrorMessage = novelDetailQuery.error instanceof Error
    ? novelDetailQuery.error.message
    : isContinueMode && novelDetailQuery.isSuccess && !novelDetailQuery.data?.data
      ? "No se leyeron los escenarios de producción de la novela actual."
      : "";
  const submitMutation = useMutation({
    mutationFn: async () => {
      if (currentNovelId) {
        await updateNovel(currentNovelId, {
          ...(description.trim() ? { description: description.trim() } : {}),
          ...(styleTone.trim() ? { styleTone: styleTone.trim() } : {}),
          ...(toNarrativePov(narrativePov) ? { narrativePov: toNarrativePov(narrativePov) } : {}),
          ...(toPacePreference(pacePreference) ? { pacePreference: toPacePreference(pacePreference) } : {}),
          ...(toProjectMode(projectMode) ? { projectMode: toProjectMode(projectMode) } : {}),
          ...(toLevel(emotionIntensity) ? { emotionIntensity: toLevel(emotionIntensity) } : {}),
          ...(toLevel(aiFreedom) ? { aiFreedom: toLevel(aiFreedom) } : {}),
          ...(defaultChapterLength
            ? { defaultChapterLength: Math.max(500, Math.min(10000, defaultChapterLength)) }
            : {}),
        });
      }
      await onSubmit(buildProductionPrompt({
        currentNovelId,
        title,
        description,
        targetChapterCount,
        genre,
        styleTone,
        narrativePov,
        pacePreference,
        projectMode,
        emotionIntensity,
        aiFreedom,
        defaultChapterLength,
        worldType,
      }));
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Todo el inicio de la producción falló.");
    },
  });
  const formDisabled = actionDisabled
    || novelDetailQuery.isFetching
    || Boolean(detailErrorMessage)
    || submitMutation.isPending;
  const submitDisabled = formDisabled || (!isContinueMode && !title.trim());
  const fieldClassName = "w-full rounded-md border border-input bg-background px-3 py-2 text-base text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60 md:text-sm";
  const startProduction = () => {
    if (submitInFlightRef.current) {
      return;
    }
    submitInFlightRef.current = true;
    submitMutation.mutate(undefined, {
      onSettled: () => {
        submitInFlightRef.current = false;
      },
    });
  };

  return (
    <div className="space-y-3" aria-busy={novelDetailQuery.isFetching || submitMutation.isPending}>
      <div className="text-xs font-medium text-muted-foreground">Toda la producción</div>
      <div className="space-y-3">
        <div className="rounded-md border border-info/25 bg-info/5 px-3 py-2 text-xs text-muted-foreground">
          {isContinueMode
            ? `Actualmente, la producción continuará${resolvedTitle || "Novela actual"}».`
            : "Actualmente en modo global, puedes crear directamente un nuevo libro e iniciar toda la producción."}
        </div>
        <div className="rounded-md border border-dashed border-border bg-background px-3 py-2 text-xs leading-5 text-muted-foreground">
          Se recomienda confirmar primero: tema, estilo, perspectiva, ritmo, duración del capítulo y libertad de IA. Cuanto más completas sean las condiciones, menor será la desviación global de la producción.
        </div>

        {novelDetailQuery.isFetching ? (
          <WorkspaceStateNotice
            compact
            loading
            tone="info"
            title="Cargando configuraciones novedosas"
            description="No se confirmará toda la producción hasta que se complete la lectura para evitar sobrescribir la novela actual con configuraciones vacías."
          />
        ) : detailErrorMessage ? (
          <WorkspaceStateNotice
            compact
            tone="danger"
            title="No se pudo leer la configuración novedosa"
            description={`${detailErrorMessage} Vuelva a leer antes de comenzar toda la producción.`}
            action={(
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={novelDetailQuery.isFetching}
                onClick={() => void novelDetailQuery.refetch()}
              >
                <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                {novelDetailQuery.isFetching ? "Intentando de nuevo..." : "Releer"}
              </Button>
            )}
          />
        ) : null}

        {!isContinueMode ? (
          <ProductionField
            htmlFor="creative-hub-production-title"
            label="Título de la novela"
            hint="Requerido al crear una nueva novela."
          >
            <input
              id="creative-hub-production-title"
              className={fieldClassName}
              placeholder="Por ejemplo: Vigilante de la luz nocturna"
              value={title}
              disabled={formDisabled}
              required
              onChange={(event) => setTitle(event.target.value)}
            />
          </ProductionField>
        ) : null}

        <ProductionField htmlFor="creative-hub-production-description" label="Introducción y configuración básica">
          <textarea
            id="creative-hub-production-description"
            className={`${fieldClassName} min-h-[88px] resize-y`}
            placeholder="Resuma la situación del protagonista, el conflicto central y la experiencia que este libro más desea cumplir."
            value={description}
            disabled={formDisabled}
            onChange={(event) => setDescription(event.target.value)}
          />
        </ProductionField>

        <div className="grid gap-2 sm:grid-cols-2">
          <ProductionField htmlFor="creative-hub-production-genre" label="Tipo de tema">
            <input
              id="creative-hub-production-genre"
              className={fieldClassName}
              placeholder="Por ejemplo: fantasía oriental"
              value={genre}
              disabled={formDisabled}
              onChange={(event) => setGenre(event.target.value)}
            />
          </ProductionField>
          <ProductionField htmlFor="creative-hub-production-style" label="Tono de estilo">
            <input
              id="creative-hub-production-style"
              className={fieldClassName}
              placeholder="Por ejemplo: enérgico y apasionado."
              value={styleTone}
              disabled={formDisabled}
              onChange={(event) => setStyleTone(event.target.value)}
            />
          </ProductionField>
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          <ProductionField htmlFor="creative-hub-production-pov" label="Perspectiva narrativa">
            <SelectControl
              id="creative-hub-production-pov"
              className={fieldClassName}
              value={narrativePov}
              disabled={formDisabled}
              onChange={(event) => setNarrativePov(event.target.value)}
            >
              <option value="">Deja que la IA juzgue</option>
              <option value="Primera persona">Primera persona</option>
              <option value="Tercera persona">Tercera persona</option>
              <option value="Voz mixta">Voz mixta</option>
            </SelectControl>
          </ProductionField>
          <ProductionField htmlFor="creative-hub-production-pace" label="Empuja el ritmo">
            <SelectControl
              id="creative-hub-production-pace"
              className={fieldClassName}
              value={pacePreference}
              disabled={formDisabled}
              onChange={(event) => setPacePreference(event.target.value)}
            >
              <option value="">Deja que la IA juzgue</option>
              <option value="Ritmo lento">Ritmo lento</option>
              <option value="Ritmo equilibrado">Ritmo equilibrado</option>
              <option value="Ritmo rápido">Ritmo rápido</option>
            </SelectControl>
          </ProductionField>
        </div>

        <div className="grid gap-2 sm:grid-cols-3">
          <ProductionField htmlFor="creative-hub-production-mode" label="Modo de colaboración">
            <SelectControl
              id="creative-hub-production-mode"
              className={fieldClassName}
              value={projectMode}
              disabled={formDisabled}
              onChange={(event) => setProjectMode(event.target.value)}
            >
              <option value="">Utilice valores predeterminados novedosos</option>
              <option value="Dirigido por IA">Dirigido por IA</option>
              <option value="Colaboración hombre-máquina">Colaboración hombre-máquina</option>
              <option value="Borrador primero">Borrador primero</option>
              <option value="Línea de montaje automática">Línea de montaje automática</option>
            </SelectControl>
          </ProductionField>
          <ProductionField htmlFor="creative-hub-production-emotion" label="Intensidad emocional">
            <SelectControl
              id="creative-hub-production-emotion"
              className={fieldClassName}
              value={emotionIntensity}
              disabled={formDisabled}
              onChange={(event) => setEmotionIntensity(event.target.value)}
            >
              <option value="">Utilice valores predeterminados novedosos</option>
              <option value="Bajo">Bajo</option>
              <option value="Medio">Medio</option>
              <option value="Alto">Alto</option>
            </SelectControl>
          </ProductionField>
          <ProductionField htmlFor="creative-hub-production-freedom" label="Grados de libertad de la IA">
            <SelectControl
              id="creative-hub-production-freedom"
              className={fieldClassName}
              value={aiFreedom}
              disabled={formDisabled}
              onChange={(event) => setAiFreedom(event.target.value)}
            >
              <option value="">Utilice valores predeterminados novedosos</option>
              <option value="Bajo">Bajo</option>
              <option value="Medio">Medio</option>
              <option value="Alto">Alto</option>
            </SelectControl>
          </ProductionField>
        </div>

        <div className="grid gap-2 sm:grid-cols-3">
          <ProductionField htmlFor="creative-hub-production-chapters" label="Número objetivo de capítulos">
            <input
              id="creative-hub-production-chapters"
              className={fieldClassName}
              type="number"
              min={1}
              max={200}
              value={targetChapterCount}
              disabled={formDisabled}
              onChange={(event) => setTargetChapterCount(Number(event.target.value || 20))}
            />
          </ProductionField>
          <ProductionField htmlFor="creative-hub-production-length" label="Longitud predeterminada del capítulo (palabras)">
            <input
              id="creative-hub-production-length"
              className={fieldClassName}
              type="number"
              min={500}
              max={10000}
              value={defaultChapterLength}
              disabled={formDisabled}
              onChange={(event) => setDefaultChapterLength(Number(event.target.value || 2500))}
            />
          </ProductionField>
          <ProductionField htmlFor="creative-hub-production-world" label="Tipo de cosmovisión (opcional)">
            <input
              id="creative-hub-production-world"
              className={fieldClassName}
              placeholder="Por ejemplo: Páramo del Juicio Final"
              value={worldType}
              disabled={formDisabled}
              onChange={(event) => setWorldType(event.target.value)}
            />
          </ProductionField>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            disabled={submitDisabled}
            onClick={startProduction}
          >
            {submitMutation.isPending ? "Empezando..." : isContinueMode ? "Continuar con la producción completa" : "Iniciar producción completa"}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={formDisabled}
            onClick={() => onQuickAction?.("Estado de la generación del libro")}
          >
            Ver progreso
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={formDisabled}
            onClick={() => onQuickAction?.("¿Por qué no se inicia toda la compilación?")}
          >
            Ver bloqueo
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={formDisabled}
            onClick={() => onQuickAction?.("Según la información novedosa actual, se brindan 3 respuestas alternativas para cada tema de preproducción, estilo, perspectiva, ritmo, duración del capítulo y libertad de IA.")}
          >
            Generar alternativas
          </Button>
        </div>
      </div>
    </div>
  );
}
