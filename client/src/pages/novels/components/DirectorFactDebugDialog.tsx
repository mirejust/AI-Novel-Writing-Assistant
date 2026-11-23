import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Bug, CheckCircle2, Loader2, RefreshCw } from "lucide-react";
import type { DirectorTaskFactInspectionStep } from "@ai-novel/shared/types/directorRuntime";
import { getDirectorNovelFactInspection } from "@/api/novelDirector";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

function formatPercent(ratio: number): string {
  return `${Math.max(0, Math.min(100, Math.round(ratio * 100)))}%`;
}

function formatStageLabel(stage: string): string {
  if (stage === "candidate_selection") return "Dirección de apertura del libro";
  if (stage === "candidate_confirm") return "Crear proyecto";
  if (stage === "story_macro") return "Gran plan de historia";
  if (stage === "book_contract") return "Acuerdo de escritura a nivel de libro";
  if (stage === "character_setup") return "Preparación de personajes";
  if (stage === "volume_strategy") return "Planificación de volumen";
  if (stage === "structured_outline") return "Ritmo y ruptura de capítulos";
  if (stage === "chapter_execution") return "Generación de texto";
  if (stage === "quality_repair") return "Bucle cerrado de calidad";
  if (stage === "takeover") return "Hacerse cargo de proyectos existentes";
  return stage;
}

function formatNextAction(action?: string | null): string {
  if (!action) return "Actualmente no hay sugerencias de acciones adicionales.";
  if (action === "run_chapter_detail_generation") return "Continúe refinando la lista de tareas para los capítulos restantes.";
  if (action === "run_chapter_list_generation") return "Continúe para completar la lista de volúmenes y capítulos.";
  if (action === "sync_execution_contracts") return "Contrato de Ejecución de Capítulo Síncrono";
  const text = action
    .replace(/_/g, " ")
    .replace(/\./g, " ")
    .trim();
  return text || action;
}

function formatResumeFrom(resumeFrom?: string | null): string {
  if (!resumeFrom) return "Rejuzgar según la escena actual";
  if (resumeFrom === "chapter_detail_bundle") return "Continuar desde los capítulos restantes sin refinar";
  if (resumeFrom === "chapter_list") return "Continuar desde la lista de capítulos";
  if (resumeFrom === "beat_sheet") return "Continuar desde Roll Rhythm Board";
  if (resumeFrom.startsWith("chapter:")) {
    const rawOrder = resumeFrom.slice("chapter:".length).trim();
    const order = Number(rawOrder);
    if (Number.isFinite(order) && order > 0) {
      return `Cap. ${order}`;
    }
  }
  return resumeFrom.replace(/_/g, " ").trim() || resumeFrom;
}

function summarizeStep(step: DirectorTaskFactInspectionStep): {
  tone: "done" | "current" | "blocked" | "working" | "error";
  title: string;
  detail: string;
} {
  if (step.inspectError) {
    return {
      tone: "error",
      title: "Cheque no completado",
      detail: step.inspectError,
    };
  }
  if (step.completed) {
    return {
      tone: "done",
      title: "Confirmado completado",
      detail: "El sistema ha encontrado el resultado real correspondiente a este paso y puede reutilizarse directamente.",
    };
  }
  if (!step.ready) {
    return {
      tone: "blocked",
      title: "No se puede ejecutar todavía",
      detail: step.blockers[0]?.reason || "Los hechos previos aún no se han completado, por lo que este paso aún no se puede iniciar.",
    };
  }
  if (step.isCurrentFactStep) {
    return {
      tone: "current",
      title: "Actualmente se da prioridad a completar este apartado.",
      detail: step.progress?.label || "Este es el siguiente paso principal del procesamiento determinado por el sistema basándose en los hechos existentes.",
    };
  }
  return {
    tone: "working",
    title: "Aún no cerrado",
    detail: step.progress?.label || "Este paso ya tiene las condiciones para su ejecución, pero lo cierto es que el ciclo aún no está completamente cerrado.",
  };
}

function toneBadgeVariant(tone: ReturnType<typeof summarizeStep>["tone"]): "default" | "secondary" | "outline" | "destructive" {
  if (tone === "done") return "secondary";
  if (tone === "current") return "default";
  if (tone === "blocked" || tone === "error") return "destructive";
  return "outline";
}

function StepFactCard({ step }: { step: DirectorTaskFactInspectionStep }) {
  const summary = summarizeStep(step);

  return (
    <Card className="rounded-lg">
      <CardHeader className="space-y-3 p-4 pb-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <div className="text-sm font-semibold text-foreground">{step.label}</div>
            <div className="text-xs text-muted-foreground">{formatStageLabel(step.stage)}</div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {step.isCurrentFactStep ? <Badge>La sentencia actual se procesará aquí primero.</Badge> : null}
            {step.isActiveRuntimeStep ? <Badge variant="outline">Este paso está sucediendo en segundo plano en este momento.</Badge> : null}
            <Badge variant={toneBadgeVariant(summary.tone)}>{summary.title}</Badge>
          </div>
        </div>
        <div className="text-sm leading-6 text-muted-foreground">{summary.detail}</div>
      </CardHeader>
      <CardContent className="space-y-4 p-4 pt-0">
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>La integridad de esta sección.</span>
            <span>{formatPercent(step.completenessRatio)}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: formatPercent(step.completenessRatio) }}
            />
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-lg border border-border/70 bg-muted/10 p-3">
            <div className="text-xs text-muted-foreground">¿Puedes seguir haciéndolo ahora?</div>
            <div className="mt-1 text-sm font-medium text-foreground">
              {step.ready ? "Puede comenzar o continuar" : "También necesitamos complementar primero los hechos previos."}
            </div>
          </div>
          <div className="rounded-lg border border-border/70 bg-muted/10 p-3">
            <div className="text-xs text-muted-foreground">El siguiente paso en el juicio del sistema</div>
            <div className="mt-1 text-sm font-medium text-foreground">{formatNextAction(step.nextAction)}</div>
          </div>
          <div className="rounded-lg border border-border/70 bg-muted/10 p-3">
            <div className="text-xs text-muted-foreground">Si se interrumpe, sugerencias sobre dónde continuar</div>
            <div className="mt-1 text-sm font-medium text-foreground">{formatResumeFrom(step.resumeFrom)}</div>
          </div>
          <div className="rounded-lg border border-border/70 bg-muted/10 p-3">
            <div className="text-xs text-muted-foreground">La descripción fáctica más reciente de este paso.</div>
            <div className="mt-1 text-sm font-medium text-foreground">{step.progress?.label || "Aún no hay descripción adicional"}</div>
          </div>
        </div>

        {step.blockers.length > 0 ? (
          <div className="space-y-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
            <div className="text-sm font-medium text-destructive">La razón por la que estoy estancado ahora</div>
            <ul className="space-y-2 text-sm leading-6 text-destructive/90">
              {step.blockers.map((blocker) => (
                <li key={`${step.stepId}:${blocker.code}`}>{blocker.reason}</li>
              ))}
            </ul>
          </div>
        ) : null}

        {step.evidence ? (
          <div className="space-y-2">
            <div className="text-sm font-medium text-foreground">Base del juicio</div>
            <pre className="overflow-x-auto rounded-lg border border-border/70 bg-muted/20 p-3 text-xs leading-5 text-muted-foreground">
              {JSON.stringify(step.evidence, null, 2)}
            </pre>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

export default function DirectorFactDebugDialog(input: {
  novelId: string;
  taskId?: string | null;
  disabled?: boolean;
}) {
  const { novelId, disabled = false } = input;
  const [open, setOpen] = useState(false);
  const query = useQuery({
    queryKey: ["director-novel-fact-inspection", novelId],
    queryFn: () => getDirectorNovelFactInspection(novelId),
    enabled: open && Boolean(novelId),
    staleTime: 0,
  });

  const inspection = query.data?.data?.inspection ?? null;
  const summary = useMemo(() => {
    const steps = inspection?.steps ?? [];
    return {
      completedCount: steps.filter((step) => step.completed).length,
      blockedCount: steps.filter((step) => !step.completed && !step.ready).length,
      currentStep: steps.find((step) => step.isCurrentFactStep) ?? null,
    };
  }, [inspection]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" disabled={disabled || !novelId}>
          <Bug className="h-4 w-4" />
          verificación de depuración
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] w-[calc(100vw-2rem)] max-w-5xl overflow-hidden p-0">
        <DialogHeader className="border-b border-border/70 px-6 py-5">
          <DialogTitle>Comprobación de integridad del paso del director</DialogTitle>
          <DialogDescription>
            Aquí se muestran los resultados de la inspección de cada paso basados ​​en la producción real. Puede ver directamente qué paso tiene resultados, qué paso carece de condiciones previas y dónde el sistema lo compensará primero.
          </DialogDescription>
        </DialogHeader>

        <div className="flex max-h-[calc(90vh-88px)] flex-col overflow-hidden">
          <div className="flex items-center justify-between gap-3 border-b border-border/70 px-6 py-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">
                Confirmado completado {summary.completedCount}/{inspection?.steps.length ?? 0}
              </Badge>
              <Badge variant={summary.blockedCount > 0 ? "destructive" : "outline"}>
                Es necesario complementar los requisitos previos. {summary.blockedCount}
              </Badge>
              {summary.currentStep ? (
                <Badge>
                  Mira primero ahora {summary.currentStep.label}
                </Badge>
              ) : null}
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void query.refetch()}
              disabled={query.isFetching || !novelId}
            >
              {query.isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              volver a comprobar
            </Button>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-5">
            {query.isLoading || query.isFetching ? (
              <div className="flex min-h-[240px] items-center justify-center text-sm text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Leyendo los resultados de la verificación de integridad de la cadena de directores actual...
              </div>
            ) : query.isError ? (
              <div className="flex min-h-[240px] items-center justify-center">
                <div className="max-w-md rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-4 text-sm text-destructive">
                  Esta verificación no se puede completar.{query.error instanceof Error ? query.error.message : "Inténtelo de nuevo más tarde."}
                </div>
              </div>
            ) : !inspection ? (
              <div className="flex min-h-[240px] items-center justify-center">
                <div className="max-w-md rounded-lg border border-border/70 bg-muted/10 px-4 py-4 text-sm text-muted-foreground">
                  Actualmente no hay tareas de director para comprobar. Primero inicie o asuma el proceso del director de IA y luego los resultados de la inspección paso a paso aparecerán aquí.
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {inspection.currentFactEvidence ? (
                  <Card className="rounded-lg border-primary/20 bg-primary/5">
                    <CardHeader className="p-4 pb-2">
                      <CardTitle className="flex items-center gap-2 text-base">
                        <CheckCircle2 className="h-4 w-4" />
                        El sistema actual completará esta sección primero.
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3 p-4 pt-0">
                      <div className="text-sm text-foreground">{inspection.currentFactStepLabel || "El sistema está reevaluando el siguiente paso."}</div>
                      <pre className="overflow-x-auto rounded-lg border border-border/70 bg-background/70 p-3 text-xs leading-5 text-muted-foreground">
                        {JSON.stringify(inspection.currentFactEvidence, null, 2)}
                      </pre>
                    </CardContent>
                  </Card>
                ) : null}

                <div className="grid gap-4">
                  {inspection.steps.map((step) => (
                    <StepFactCard key={step.stepId} step={step} />
                  ))}
                </div>

                {inspection.steps.some((step) => step.inspectError) ? (
                  <div className="flex items-start gap-2 rounded-lg border border-amber-300/60 bg-amber-50/60 px-4 py-3 text-sm text-amber-900">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                    Algunos pasos de la inspección no arrojaron resultados completos. Esto generalmente se debe a que la escena actual de la misión está incompleta o se necesitan más fuentes objetivas para este párrafo.
                  </div>
                ) : null}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
