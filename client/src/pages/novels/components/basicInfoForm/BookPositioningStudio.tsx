import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import WorkflowProgressBar from "@/components/workflow/WorkflowProgressBar";
import type { NovelBasicFormState } from "../../novelBasicInfo.shared";
import { StatusRail } from "../workspaceShell";
import { BookFramingSection } from "./BookFramingSection";
import { FieldLabel } from "./BasicInfoFormPrimitives";

interface BookPositioningStudioProps {
  basicForm: NovelBasicFormState;
  onFormChange: (patch: Partial<NovelBasicFormState>) => void;
  titleQuickFill?: ReactNode;
  framingQuickFill?: ReactNode;
  projectQuickStart?: ReactNode;
}

const POSITIONING_FIELDS = [
  { key: "title", label: "Título" },
  { key: "description", label: "Descripción general" },
  { key: "targetAudience", label: "Lector" },
  { key: "bookSellingPoint", label: "Punto de venta" },
  { key: "first30ChapterPromise", label: "Primeros 30 capítulos" },
] satisfies Array<{ key: keyof NovelBasicFormState; label: string }>;

function hasText(value: unknown): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

function createPreview(value: string, fallback: string): string {
  const normalized = value.trim().replace(/\s+/g, " ");
  if (!normalized) {
    return fallback;
  }
  return normalized.length > 44 ? `${normalized.slice(0, 44)}...` : normalized;
}

export default function BookPositioningStudio(props: BookPositioningStudioProps) {
  const { basicForm, onFormChange, titleQuickFill, framingQuickFill, projectQuickStart } = props;
  const completedCount = POSITIONING_FIELDS.filter((field) => hasText(basicForm[field.key])).length;
  const readinessPercent = Math.round((completedCount / POSITIONING_FIELDS.length) * 100);
  const readinessItems = [
    {
      label: "Público objetivo",
      value: createPreview(basicForm.targetAudience, "Escriba claramente quién seguirá este libro."),
      description: hasText(basicForm.targetAudience) ? "Listo" : "Pendiente",
      tone: hasText(basicForm.targetAudience) ? "success" as const : "neutral" as const,
    },
    {
      label: "Punto de venta principal",
      value: createPreview(basicForm.bookSellingPoint, "Identificar los puntos más apasionantes o de suspenso."),
      description: hasText(basicForm.bookSellingPoint) ? "Listo" : "Pendiente",
      tone: hasText(basicForm.bookSellingPoint) ? "success" as const : "neutral" as const,
    },
    {
      label: "Tracción de los primeros 30 capítulos",
      value: createPreview(basicForm.first30ChapterPromise, "Dígale a la IA lo que debe cumplirse en la etapa inicial"),
      description: hasText(basicForm.first30ChapterPromise) ? "Listo" : "Pendiente",
      tone: hasText(basicForm.first30ChapterPromise) ? "success" as const : "neutral" as const,
    },
  ];

  return (
    <section className="space-y-6 rounded-2xl bg-muted/15 p-4 sm:p-5 lg:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="border-primary/20 bg-primary/5 text-primary">
              Posicionamiento de libro abierto
            </Badge>
            <span className="text-xs font-medium text-muted-foreground">Título, punto de venta y rentabilidad anticipada</span>
          </div>
          <h2 className="mt-3 text-lg font-semibold leading-7 text-foreground">Haga un compromiso claro con los lectores de este libro.</h2>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
            Anota quién te perseguirá, por qué y qué podrás ver en los primeros 30 capítulos; La IA seguirá planificando el mundo, los personajes y los capítulos según este conjunto de promesas.
          </p>
        </div>
        {projectQuickStart ? <div className="shrink-0">{projectQuickStart}</div> : null}
      </div>

      <div className="grid gap-5 rounded-xl bg-background/70 px-4 py-4 xl:grid-cols-[14rem_minmax(0,1fr)] xl:items-center">
        <div className="space-y-3">
          <div className="flex items-end justify-between gap-3">
            <div>
              <div className="text-xs font-medium text-muted-foreground">Finalización del posicionamiento</div>
              <div className="mt-1 text-xs text-muted-foreground">{completedCount} / {POSITIONING_FIELDS.length} El artículo está listo</div>
            </div>
            <div className="text-2xl font-semibold tracking-tight text-foreground">{readinessPercent}%</div>
          </div>
          <WorkflowProgressBar progress={readinessPercent} className="h-2" />
        </div>
        <StatusRail items={readinessItems} />
      </div>

      <div className="grid items-start gap-x-8 gap-y-6 xl:grid-cols-[minmax(18rem,0.8fr)_minmax(0,1.2fr)]">
        <div className="space-y-5">
          <div className="flex min-h-16 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h3 className="text-sm font-semibold text-foreground">Título del libro y entrada de la historia.</h3>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">Primero utiliza algunas frases para explicar al protagonista, el dilema y el giro más interesante que vale la pena seguir viendo.</p>
            </div>
            {titleQuickFill ? <div className="shrink-0">{titleQuickFill}</div> : null}
          </div>

          <div className="space-y-2">
            <FieldLabel htmlFor="basic-title">Título de la novela</FieldLabel>
            <Input
              id="basic-title"
              value={basicForm.title}
              placeholder="Por ejemplo: Oficina de Juicios de Fog Harbor"
              onChange={(event) => onFormChange({ title: event.target.value })}
              className="h-12 rounded-xl border-0 bg-background/85 text-base font-semibold ring-1 ring-border/50 transition-colors hover:bg-background focus-visible:ring-primary/30"
            />
          </div>

          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <FieldLabel htmlFor="basic-description">Resumen de una frase</FieldLabel>
              <span className="text-xs text-muted-foreground">Protagonista · Gol · Resistencia</span>
            </div>
            <textarea
              id="basic-description"
              rows={7}
              className="min-h-[184px] w-full resize-y rounded-xl border-0 bg-background/85 px-4 py-3 text-sm leading-7 outline-none ring-1 ring-border/50 transition-colors placeholder:text-muted-foreground/70 hover:bg-background focus-visible:ring-2 focus-visible:ring-primary/30"
              value={basicForm.description}
              placeholder="Describe al protagonista, el conflicto central y los aspectos más destacados de la historia en 2 a 4 oraciones."
              onChange={(event) => onFormChange({ description: event.target.value })}
            />
          </div>
        </div>

        <div className="xl:border-l xl:border-border/50 xl:pl-8">
          <BookFramingSection
            basicForm={basicForm}
            onFormChange={onFormChange}
            quickFill={framingQuickFill}
          />
        </div>
      </div>
    </section>
  );
}
