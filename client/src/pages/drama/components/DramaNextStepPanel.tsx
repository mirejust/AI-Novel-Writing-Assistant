import {
  CheckCircle2,
  Download,
  Layers3,
  ListVideo,
  RefreshCw,
  Sparkles,
  Video,
  Wand2,
} from "lucide-react";
import type { DramaEpisode, DramaProjectDetail, DramaShot, DramaVideoPrompt } from "@/api/drama";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type NextStepKind =
  | "source"
  | "strategy"
  | "outline"
  | "script"
  | "review"
  | "repair"
  | "storyboard"
  | "videoPrompt"
  | "providerTask"
  | "export";

interface NextStep {
  kind: NextStepKind;
  title: string;
  description: string;
  button: string;
  tab: "source" | "strategy" | "episodes" | "visual" | "export";
  icon: "source" | "strategy" | "outline" | "script" | "review" | "repair" | "video" | "export";
  episodeOrder?: number;
  shot?: DramaShot;
  videoPrompt?: DramaVideoPrompt;
}

function firstEpisodeWithoutScript(episodes: DramaEpisode[]): DramaEpisode | undefined {
  return episodes.find((episode) => !episode.content?.trim());
}

function firstEpisodeWithoutReview(episodes: DramaEpisode[]): DramaEpisode | undefined {
  return episodes.find((episode) =>
    Boolean(episode.content?.trim()) && !["reviewed", "needs_repair", "approved"].includes(episode.status)
  );
}

function firstRepairableEpisode(episodes: DramaEpisode[]): DramaEpisode | undefined {
  return episodes.find((episode) => episode.status === "needs_repair");
}

function firstEpisodeWithoutStoryboard(episodes: DramaEpisode[]): DramaEpisode | undefined {
  return episodes.find((episode) => Boolean(episode.content?.trim()) && (episode.storyboards?.length ?? 0) === 0);
}

function firstShotWithoutVideoPrompt(episodes: DramaEpisode[], videoPrompts: DramaVideoPrompt[]): {
  episode: DramaEpisode;
  shot: DramaShot;
} | undefined {
  const promptedShotIds = new Set(videoPrompts.filter(isActiveVideoPrompt).map((prompt) => prompt.shotId).filter(Boolean));
  for (const episode of episodes) {
    for (const storyboard of episode.storyboards ?? []) {
      for (const shot of storyboard.shots ?? []) {
        if (!promptedShotIds.has(shot.id)) {
          return { episode, shot };
        }
      }
    }
  }
  return undefined;
}

function firstPromptWithoutProviderTask(videoPrompts: DramaVideoPrompt[]): DramaVideoPrompt | undefined {
  return videoPrompts.find((prompt) => isActiveVideoPrompt(prompt) && !prompt.providerTaskId);
}

function isActiveVideoPrompt(prompt: DramaVideoPrompt): boolean {
  return prompt.status !== "superseded";
}

function buildNextStep(project: DramaProjectDetail): NextStep {
  const episodes = project.episodes ?? [];
  const videoPrompts = (project.videoPrompts ?? []).filter(isActiveVideoPrompt);
  const repairable = firstRepairableEpisode(episodes);
  const unreviewed = firstEpisodeWithoutReview(episodes);
  const unscripted = firstEpisodeWithoutScript(episodes);
  const unstagedStoryboard = firstEpisodeWithoutStoryboard(episodes);
  const shotWithoutPrompt = firstShotWithoutVideoPrompt(episodes, videoPrompts);
  const promptWithoutTask = firstPromptWithoutProviderTask(videoPrompts);

  if (!project.sourceBundle) {
    return {
      kind: "source",
      title: "Siguiente paso: organizar los materiales de origen",
      description: "Primero organiza la novela, la inspiración o el texto importado en la sinopsis, los ritmos, los personajes y los hechos concretos que se pueden utilizar en la obra corta.",
      button: "Organizar materiales",
      tab: "source",
      icon: "source",
    };
  }
  if (!project.strategy) {
    return {
      kind: "strategy",
      title: "Siguiente paso: generar una estrategia de sketch",
      description: "Generar posicionamiento de audiencia, puntos principales, puntos de tarjetas de pago y límites de adaptación en función del material y track.",
      button: "Generar estrategia",
      tab: "strategy",
      icon: "strategy",
    };
  }
  if (episodes.length === 0) {
    return {
      kind: "outline",
      title: "Siguiente paso: generar los primeros 12 episodios",
      description: "Comience creando un esquema de episodio verificable que confirme los ganchos, los conflictos y la dirección del cheque de pago.",
      button: "Generando los primeros 12 episodios",
      tab: "episodes",
      icon: "outline",
    };
  }
  if (unscripted) {
    return {
      kind: "script",
      title: `Siguiente paso: Generar el ${unscripted.order} Recopilar guiones`,
      description: "Escribe el esquema de este episodio en un guión corto que sea filmable, que tenga un diálogo denso, que tenga un gancho al principio y un punto conflictivo al final.",
      button: "Generar guión",
      tab: "episodes",
      icon: "script",
      episodeOrder: unscripted.order,
    };
  }
  if (repairable) {
    return {
      kind: "repair",
      title: `Siguiente paso: reparar el ${repairable.order} Problemas de calidad de la colección`,
      description: "Hay sugerencias de calidad para este episodio. Corríjalos primero de acuerdo con las sugerencias para evitar problemas al ingresar al guión gráfico y las indicaciones del video.",
      button: "Guión de reparación",
      tab: "episodes",
      icon: "repair",
      episodeOrder: repairable.order,
    };
  }
  if (unreviewed) {
    return {
      kind: "review",
      title: `Siguiente paso: comprobar el ${unreviewed.order} Establecer calidad`,
      description: "Verifique los 3 segundos de oro, la densidad de la información, los puntos de la tarjeta de pago, la duración, la coherencia de los hechos y la coherencia de los roles.",
      button: "Control de calidad",
      tab: "episodes",
      icon: "review",
      episodeOrder: unreviewed.order,
    };
  }
  if (unstagedStoryboard) {
    return {
      kind: "storyboard",
      title: `Siguiente paso: Generar el ${unstagedStoryboard.order} Guión gráfico`,
      description: "Divida el guión que haya pasado la inspección en tomas grabables, conservando el anclaje visual del personaje y el enfoque de la acción.",
      button: "Generar guiones gráficos",
      tab: "visual",
      icon: "video",
      episodeOrder: unstagedStoryboard.order,
    };
  }
  if (shotWithoutPrompt) {
    return {
      kind: "videoPrompt",
      title: `Siguiente paso: Generar el ${shotWithoutPrompt.episode.order} Colección de palabras de aviso en video.`,
      description: "Convierta una toma de guión gráfico en un video de pantalla vertical para generar palabras clave, preservando los personajes, las acciones y el lenguaje de la toma.",
      button: "Generar palabras de aviso de video",
      tab: "visual",
      icon: "video",
      episodeOrder: shotWithoutPrompt.episode.order,
      shot: shotWithoutPrompt.shot,
    };
  }
  if (promptWithoutTask) {
    return {
      kind: "providerTask",
      title: "Siguiente paso: crear una tarea de generación de video",
      description: "Envíe las palabras de aviso del video generado al proveedor actual y el estado se podrá actualizar en la página del video del guión gráfico más adelante.",
      button: "Crear una tarea de vídeo",
      tab: "visual",
      icon: "video",
      videoPrompt: promptWithoutTask,
    };
  }
  return {
    kind: "export",
    title: "Siguiente paso: exportar datos del sketch",
    description: "Exporte personajes, episodios, guiones, resultados de calidad y materiales de producción posteriores para su posterior edición o entrega.",
    button: "Rebaja de exportación",
    tab: "export",
    icon: "export",
  };
}

function StepIcon({ icon }: { icon: NextStep["icon"] }) {
  const className = "h-4 w-4";
  if (icon === "source") return <Layers3 className={className} />;
  if (icon === "strategy") return <Sparkles className={className} />;
  if (icon === "outline") return <ListVideo className={className} />;
  if (icon === "script") return <Wand2 className={className} />;
  if (icon === "review") return <CheckCircle2 className={className} />;
  if (icon === "repair") return <RefreshCw className={className} />;
  if (icon === "video") return <Video className={className} />;
  return <Download className={className} />;
}

export function DramaNextStepPanel(props: {
  project: DramaProjectDetail;
  busy: boolean;
  onSetTab: (tab: NextStep["tab"]) => void;
  onSelectEpisode: (order: number) => void;
  onAssembleSource: () => void;
  onGenerateStrategy: () => void;
  onGenerateOutline: () => void;
  onGenerateScript: (order: number) => void;
  onReviewEpisode: (order: number) => void;
  onRepairEpisode: (order: number) => void;
  onGenerateStoryboard: (order: number) => void;
  onGenerateVideoPrompt: (shot: DramaShot) => void;
  onCreateProviderTask: (prompt: DramaVideoPrompt) => void;
  onExportMarkdown: () => void;
}) {
  const step = buildNextStep(props.project);
  const runStep = () => {
    props.onSetTab(step.tab);
    if (step.episodeOrder) {
      props.onSelectEpisode(step.episodeOrder);
    }
    if (step.kind === "source") props.onAssembleSource();
    if (step.kind === "strategy") props.onGenerateStrategy();
    if (step.kind === "outline") props.onGenerateOutline();
    if (step.kind === "script" && step.episodeOrder) props.onGenerateScript(step.episodeOrder);
    if (step.kind === "review" && step.episodeOrder) props.onReviewEpisode(step.episodeOrder);
    if (step.kind === "repair" && step.episodeOrder) props.onRepairEpisode(step.episodeOrder);
    if (step.kind === "storyboard" && step.episodeOrder) props.onGenerateStoryboard(step.episodeOrder);
    if (step.kind === "videoPrompt" && step.shot) props.onGenerateVideoPrompt(step.shot);
    if (step.kind === "providerTask" && step.videoPrompt) props.onCreateProviderTask(step.videoPrompt);
    if (step.kind === "export") props.onExportMarkdown();
  };

  return (
    <Card className="rounded-lg">
      <CardHeader className="gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle className="text-lg">{step.title}</CardTitle>
            <Badge variant="outline">{props.project.targetEpisodes} Proyecto de colección</Badge>
          </div>
          <CardDescription>{step.description}</CardDescription>
        </div>
        <Button type="button" disabled={props.busy} onClick={runStep}>
          <StepIcon icon={step.icon} />
          {props.busy ? "Procesando..." : step.button}
        </Button>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2 text-sm text-muted-foreground">
        <span>Materiales organizados:{props.project.sourceBundle ? "Sí" : "No"}</span>
        <span>Estrategia:{props.project.strategy ? "Generado" : "No generado"}</span>
        <span>Episodios:{props.project.episodes?.length ?? 0} Colocar</span>
        <span>Palabras de aviso del video actual:{(props.project.videoPrompts ?? []).filter(isActiveVideoPrompt).length} Banda</span>
      </CardContent>
    </Card>
  );
}
