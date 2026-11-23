import type { ReactNode } from "react";
import { Check, ChevronDown, LoaderCircle } from "lucide-react";
import { Link } from "react-router-dom";
import type { CreativeCarryoverContract } from "@ai-novel/shared/types/creativeCarryoverContract";
import { Button } from "@/components/ui/button";

export type CreativeCarryoverPanelState =
  | { kind: "idle" }
  | { kind: "loading" }
  | {
    kind: "insufficient";
    bookAnalysisId: string;
    analysisTitle: string;
    missingSectionTitles: string[];
  }
  | { kind: "error"; message: string; hasPrevious: boolean }
  | { kind: "ready"; contract: CreativeCarryoverContract };

interface CreativeCarryoverContractPanelProps {
  modeLabel: string;
  referenceTitle: string;
  state: CreativeCarryoverPanelState;
  previousContract?: CreativeCarryoverContract | null;
  onRegenerate: () => void;
  isGenerating: boolean;
  isAdopting: boolean;
}

function TraitList({ items }: { items: string[] }) {
  return (
    <ul className="space-y-3 text-sm leading-7 text-foreground">
      {items.map((item, index) => (
        <li key={index} className="flex gap-3">
          <span className="mt-3 h-1 w-1 shrink-0 rounded-full bg-muted-foreground/50" aria-hidden="true" />
          <span className="min-w-0 break-words">{item}</span>
        </li>
      ))}
    </ul>
  );
}

function PlanDetails({ title, hint, children }: {
  title: string;
  hint: string;
  children: ReactNode;
}) {
  return (
    <details className="group border-t border-border/60 py-4">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
        <span className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="text-sm font-medium text-foreground">{title}</span>
          <span className="text-xs text-muted-foreground">{hint}</span>
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180 motion-reduce:transition-none" aria-hidden="true" />
      </summary>
      <div className="pt-4">{children}</div>
    </details>
  );
}

export default function CreativeCarryoverContractPanel({
  modeLabel,
  referenceTitle,
  state,
  previousContract,
  onRegenerate,
  isGenerating,
  isAdopting,
}: CreativeCarryoverContractPanelProps) {
  const contract = state.kind === "ready" ? state.contract
    : state.kind === "error" ? previousContract : null;
  const title = referenceTitle || contract?.documentTitle || "Obras de referencia";
  const busy = isGenerating || isAdopting;

  return (
    <section className="space-y-5" aria-label="Plan de emprendimiento creativo." aria-busy={busy}>
      <div>
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="rounded bg-primary/10 px-2 py-1 font-medium text-primary">{modeLabel}</span>
          </div>
          <h2 className="break-words text-xl font-semibold leading-8 text-foreground">{title}</h2>
          <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
            Mire primero la dirección de la historia de los primeros tres capítulos y luego decida si incluir este plan en el libro.
          </p>
        </div>
      </div>

      <div role="status" aria-live="polite" className="text-sm leading-6 text-muted-foreground">
        {isGenerating || state.kind === "loading" ? (
          <span className="inline-flex items-center gap-2">
            <LoaderCircle className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
            {contract ? "Se está generando un nuevo plan y el plan actual se conserva para su comparación." : "El plan se está compilando en base a las conclusiones del libro de desembalaje y estará listo para su adopción una vez finalizado."}
          </span>
        ) : isAdopting ? "Guardando plan adoptado..." : contract?.adopted ? (
          <span className="inline-flex items-center gap-2 text-success">
            <Check className="h-4 w-4" aria-hidden="true" />
            Adoptado, puede continuar completando la configuración de apertura del libro.
          </span>
        ) : contract ? "El plan está listo y puedes continuar abriendo el libro después de la adopción." : null}
      </div>

      {state.kind === "insufficient" ? (
        <div className="space-y-3 rounded-lg bg-warning/10 px-4 py-3 text-sm leading-6">
          <p className="font-medium text-foreground">
            El libro aún falta:{state.missingSectionTitles.join(",")}
          </p>
          <p className="text-muted-foreground">Una vez completadas estas conclusiones, la IA puede proporcionar "{title}»Compile planes creativos confiables.</p>
          <Button type="button" size="sm" variant="secondary" asChild>
            <Link to={`/book-analysis?analysisId=${encodeURIComponent(state.bookAnalysisId)}`}>Ve y compensa el desempaquetado de libros.</Link>
          </Button>
        </div>
      ) : null}

      {state.kind === "error" ? (
        <div role="alert" className="flex flex-col gap-3 rounded-lg bg-warning/10 px-4 py-3 text-sm leading-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-medium text-foreground">{state.message}</p>
            <p className="text-muted-foreground">
              {contract ? "Puede utilizar la solución reservada a continuación o puede volver a intentar la generación." : "Las obras de referencia aún se conservan, intente generar el plano nuevamente."}
            </p>
          </div>
          <Button type="button" size="sm" variant="secondary" className="self-start sm:shrink-0" onClick={onRegenerate} disabled={busy}>
            {isGenerating ? "Intentando de nuevo…" : "Reintentar generación"}
          </Button>
        </div>
      ) : null}

      {contract ? (
        <div>
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] lg:gap-10">
            <div className="min-w-0">
              <h3 className="text-base font-semibold text-foreground">Cómo escribir los primeros tres capítulos.</h3>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">Dirección de apertura · Después de la adopción, entréguelo a AI para una planificación continua</p>
              <ol className="mt-4 divide-y divide-border/60">
                {contract.openingChapters.slice().sort((a, b) => a.chapterNumber - b.chapterNumber).map((item) => (
                  <li key={item.chapterNumber} className="grid grid-cols-[2.5rem_minmax(0,1fr)] gap-3 py-4 first:pt-0">
                    <span className="pt-0.5 text-xl font-medium tabular-nums text-primary" aria-label={`Cap.${item.chapterNumber}Cap.`}>
                      {String(item.chapterNumber).padStart(2, "0")}
                    </span>
                    <p className="break-words text-sm leading-7 text-foreground">{item.direction}</p>
                  </li>
                ))}
              </ol>
            </div>
            <div className="min-w-0">
              <h3 className="text-base font-semibold text-foreground">La dirección creativa de este libro.</h3>
              <p className="mb-4 mt-1 text-xs leading-5 text-muted-foreground">Implementa las características de la obra de referencia en tu historia.</p>
              <TraitList items={contract.bookRealization.slice(0, 3)} />
              {contract.bookRealization.length > 3 ? (
                <div className="mt-4">
                  <PlanDetails title="Ver otras direcciones creativas" hint={`También ${contract.bookRealization.length - 3} artículo`}>
                    <TraitList items={contract.bookRealization.slice(3)} />
                  </PlanDetails>
                </div>
              ) : null}
              <div className="mt-4">
                <PlanDetails title="¿Cuáles son las características del libro original?" hint={`${contract.sourceTraits.length} base de referencia del artículo`}>
                  <TraitList items={contract.sourceTraits} />
                </PlanDetails>
              </div>
            </div>
          </div>

          {contract.mode === "continuation" && contract.continuationFocus ? (
            <PlanDetails title="¿Qué hay que atrapar para seguir escribiendo?" hint={`${contract.continuationFocus.finalCharacterStates.length} Estado de carácter personal · ${contract.continuationFocus.unfinishedThreads.length} pistas inacabadas`}>
              <div className="grid gap-6 md:grid-cols-2">
                <div>
                  <h3 className="mb-3 text-sm font-medium text-foreground">El estado del personaje al final de la obra original.</h3>
                  <TraitList items={contract.continuationFocus.finalCharacterStates} />
                </div>
                <div>
                  <h3 className="mb-3 text-sm font-medium text-foreground">La trama aún no ha terminado.</h3>
                  <TraitList items={contract.continuationFocus.unfinishedThreads} />
                </div>
              </div>
            </PlanDetails>
          ) : null}
          {contract.mode === "adaptation" && contract.adaptationFocus ? (
            <PlanDetails title="Cómo convertir a un nuevo libro independiente" hint="Ganchos, conflictos y ritmos geniales.">
              <p className="mb-5 max-w-3xl text-sm leading-7 text-foreground">{contract.adaptationFocus.conversionPlan}</p>
              <div className="grid gap-6 md:grid-cols-3">
                <div>
                  <h3 className="mb-3 text-sm font-medium text-foreground">Ganchos para atraer lectores</h3>
                  <TraitList items={contract.adaptationFocus.hooks} />
                </div>
                <div>
                  <h3 className="mb-3 text-sm font-medium text-foreground">Conflicto que continúa impulsando la historia.</h3>
                  <TraitList items={contract.adaptationFocus.conflictLoops} />
                </div>
                <div>
                  <h3 className="mb-3 text-sm font-medium text-foreground">Puntos de actualización y ritmo de recompensa.</h3>
                  <TraitList items={contract.adaptationFocus.payoffRhythm} />
                </div>
              </div>
            </PlanDetails>
          ) : null}
          <p className="pt-2 text-xs leading-5 text-muted-foreground">Versión original v{contract.documentVersionNumber} · {title}</p>
        </div>
      ) : null}
    </section>
  );
}
