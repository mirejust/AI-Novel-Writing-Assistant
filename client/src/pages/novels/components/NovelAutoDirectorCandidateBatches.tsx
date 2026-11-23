import { useId, useState, type CSSProperties, type ReactElement } from "react";
import { candidateAnchor } from "../autoDirector/candidateReview/candidateScope";
import { candidateFieldLabel, type CandidateStoryField } from "@ai-novel/shared/types/director/candidateReview";
import type { TitleFactorySuggestion } from "@ai-novel/shared/types/title";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Check, ChevronDown, MessageCircle, RefreshCw, Wand2 } from "lucide-react";
import {
  DIRECTOR_CORRECTION_PRESETS,
  type DirectorCandidate,
  type DirectorCandidateBatch,
  type DirectorRunMode,
} from "@ai-novel/shared/types/novelDirector";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { AUTO_DIRECTOR_MOBILE_CLASSES } from "@/mobile/autoDirector";

const openingLabels = { auto_to_ready: "Seleccionar y preparar automáticamente", stage_review: "Elige y confirma paso a paso" };

interface NovelAutoDirectorCandidateBatchesProps {
  batches: DirectorCandidateBatch[];
  discussionKey?: string;
  titlePatchFeedbacks: Record<string, string>;
  onTitlePatchFeedbackChange: (candidateId: string, value: string) => void;
  isRefiningTitle: boolean;
  isConfirming: boolean;
  isApplying: boolean;
  onApplyCandidateTitleOption: (batchId: string, candidateId: string, option: TitleFactorySuggestion) => void;
  onRefineTitle: (batchId: string, candidate: DirectorCandidate, feedback: string) => void;
  openingMode?: keyof typeof openingLabels;
  onConfirmCandidate: (candidate: DirectorCandidate, batch: DirectorCandidateBatch, mode?: DirectorRunMode) => void | Promise<void>;
}

function buildFallbackTitleOption(candidate: DirectorCandidate): TitleFactorySuggestion {
  return {
    title: candidate.workingTitle,
    clickRate: 60,
    style: "high_concept",
    angle: "Título del proyecto actual",
    reason: "Actualmente utilizando el título del libro candidato del director.",
  };
}

function resolveCandidateTitleOptions(candidate: DirectorCandidate): TitleFactorySuggestion[] {
  if (Array.isArray(candidate.titleOptions) && candidate.titleOptions.length > 0) {
    return candidate.titleOptions;
  }
  return [buildFallbackTitleOption(candidate)];
}

interface StoryField {
  row: CandidateStoryField | "plannedDirection" | "platform" | "foundation";
  value?: string | null;
}

const fieldLabels = {
  ...candidateFieldLabel, plannedDirection: "Dirección de este caso", coreConflict: "El conflicto se desarrolla",
  hookStrategy: "Qué leer al principio", progressionLoop: "¿Qué estás persiguiendo?", platform: "Recomendaciones de plataforma", foundation: "Conceptos básicos de creación",
};

// Typeset the saved conflict without rewriting the candidate or clipping a sentence.
const sentenceBreaks = typeof Intl.Segmenter === "function" ? new Intl.Segmenter("zh", { granularity: "sentence" }) : null;
function conflictExcerpt(value?: string) {
  const text = value?.trim() ?? "";
  const first = sentenceBreaks?.segment(text)[Symbol.iterator]().next().value?.segment ?? text;
  return { lead: first.trimEnd(), rest: text.slice(first.length).trimStart() };
}

function StoryFields({ fields, id, hidden }: { fields: StoryField[]; id?: string; hidden?: boolean }) {
  return <dl className="candidate-fields" id={id} hidden={hidden}>
    {fields.filter(field => field.value?.trim()).map(field =>
      <div key={field.row} data-field={field.row} style={{ "--candidate-field-row": field.row } as CSSProperties}>
        <dt>{fieldLabels[field.row]}</dt><dd>{field.value}</dd>
      </div>
    )}
  </dl>;
}

function CandidateStoryNotes({ fields }: { fields: StoryField[] }) {
  const [open, setOpen] = useState(true);
  const id = useId();
  return <section className="candidate-story-notes">
    <button type="button" aria-expanded={open} aria-controls={id} onClick={() => setOpen(!open)}>
      Configuración completa y motivos recomendados.<ChevronDown size={15} />
    </button>
    <StoryFields id={id} hidden={!open} fields={fields} />
  </section>;
}

function CandidatePairs({ children }: { children: ReactElement[] }) {
  if (children.length < 2) return children;
  const pairs: ReactElement[] = [];
  for (let index = 0; index < children.length; index += 2) {
    pairs.push(<div className="candidate-comparison" key={children[index].key}>
      {children.slice(index, index + 2)}
    </div>);
  }
  return pairs;
}

function foundationSourceLabel(source: "user_selected" | "ai_recommended" | "market_recommended" | undefined): string {
  if (source === "user_selected") return "Tu elección";
  if (source === "ai_recommended") return "Suplemento de IA";
  if (source === "market_recommended") return "Recomendación de radar";
  return "Conceptos básicos de creación";
}

export default function NovelAutoDirectorCandidateBatches(props: NovelAutoDirectorCandidateBatchesProps) {
  const {
    batches,
    discussionKey,
    titlePatchFeedbacks,
    onTitlePatchFeedbackChange,
    isRefiningTitle,
    isConfirming,
    isApplying,
    onApplyCandidateTitleOption,
    onRefineTitle,
    openingMode,
    onConfirmCandidate,
  } = props;
  const reducedMotion = useReducedMotion();
  const alternativeMode = openingMode === "stage_review" ? "auto_to_ready" : "stage_review";

  if (batches.length === 0) {
    return (
      <div className={`py-10 text-center text-sm text-muted-foreground ${AUTO_DIRECTOR_MOBILE_CLASSES.wrapText}`}>
        Primero, déle a la IA una oración de inspiración y primero producirá el primer lote de candidatos para toda la dirección del libro.
      </div>
    );
  }

  return (
    <div className="candidate-batches space-y-8">
      {batches.map((batch, batchIndex) => (
        <motion.section
          key={batch.id}
          initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: reducedMotion ? 0 : 0.18, delay: reducedMotion ? 0 : batchIndex * 0.04 }}
          className="min-w-0"
        >
          <header className="candidate-round">
            <h3 id={candidateAnchor(batch.id, "")} tabIndex={-1}>{batch.roundLabel} · {batch.candidates.length} Establecer dirección</h3>
            {batch.refinementSummary?.trim() && <p>{batch.refinementSummary}</p>}
            {batch.presets.length > 0 && <p>{batch.presets.map(preset =>
              DIRECTOR_CORRECTION_PRESETS.find(item => item.value === preset)?.label
            ).filter(Boolean).join(" · ")}</p>}
            {batch.candidates.length > 1 && <nav aria-label={`${batch.roundLabel}Directorio de dirección`}>
              {batch.candidates.map((candidate, index) => {
                const anchor = candidateAnchor(batch.id, candidate.id);
                return <button key={candidate.id} type="button" onClick={() => {
                  document.getElementById(anchor + "-title")?.focus();
                }}>{index + 1}. {candidate.workingTitle}</button>;
              })}
            </nav>}
          </header>

          <CandidatePairs>{batch.candidates.map((candidate, candidateIndex) => {
            const anchor = candidateAnchor(batch.id, candidate.id);
            const titleOptions = resolveCandidateTitleOptions(candidate);
            const conflict = conflictExcerpt(candidate.coreConflict);
            const lead = conflict.lead || candidate.logline;
            const platform = candidate.recommendedWritingPlatform === "qidian_male" ? "Canal masculino qidian"
              : candidate.recommendedWritingPlatform === "jinjiang_female" ? "Canal femenino de jinjiang"
              : candidate.recommendedWritingPlatform === "fanqie_free" ? "Artículos web sin tomate" : "";
            return (
              <article key={candidate.id} id={anchor} className="candidate-manuscript" aria-labelledby={anchor + "-title"}>
                <header>
                  <div className="candidate-byline">
                    <span className="candidate-number">plan {candidateIndex + 1}</span>
                    {discussionKey === anchor && <span className="candidate-discussing"><MessageCircle size={14} />Dirección de discusión actual</span>}
                    <span className="candidate-length">aprox. {candidate.targetChapterCount} Cap.</span>
                  </div>
                  <h4 className="candidate-book-title" id={anchor + "-title"} tabIndex={-1}>{candidate.workingTitle}</h4>
                  {lead && <dl className="candidate-lead">
                    <dt>{conflict.lead ? "Conflicto central" : candidateFieldLabel.logline}</dt>
                    <dd>{lead}</dd>
                  </dl>}
                  {candidate.toneKeywords.length > 0 && <ul className="candidate-keywords" aria-label="Palabras clave de la historia">
                    {candidate.toneKeywords.map((keyword, index) => <li key={index}>{keyword}</li>)}
                  </ul>}
                </header>
                <StoryFields fields={[
                  { row: "hookStrategy", value: candidate.hookStrategy },
                  { row: "progressionLoop", value: candidate.progressionLoop },
                ]} />

                <CandidateStoryNotes fields={[
                  { row: "plannedDirection", value: candidate.plannedDirection },
                  { row: "logline", value: conflict.lead ? candidate.logline : undefined },
                  { row: "coreConflict", value: conflict.rest },
                  { row: "sellingPoint", value: candidate.sellingPoint },
                  { row: "protagonistPath", value: candidate.protagonistPath },
                  { row: "positioning", value: candidate.positioning },
                  { row: "endingDirection", value: candidate.endingDirection },
                  { row: "whyItFits", value: candidate.whyItFits },
                  { row: "platform", value: [platform, candidate.writingPlatformReason].filter(Boolean).join(" · ") },
                  { row: "foundation", value: candidate.productionFoundation && [
                    `${candidate.productionFoundation.genre.path}(${foundationSourceLabel(candidate.productionFoundation.genre.source)})`,
                    `${candidate.productionFoundation.primaryStoryMode.path}(${foundationSourceLabel(candidate.productionFoundation.primaryStoryMode.source)})`,
                    candidate.productionFoundation.secondaryStoryMode &&
                      `${candidate.productionFoundation.secondaryStoryMode.path}(${foundationSourceLabel(candidate.productionFoundation.secondaryStoryMode.source)})`,
                  ].filter(Boolean).join(" · ") },
                ]} />

                <details className="candidate-title-options group mt-4">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-medium text-foreground">
                    Ajustar el título del libro
                    <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition group-open:rotate-180" />
                  </summary>
                  <div className="mt-4 space-y-5">
                    <div>
                      <div className="text-xs font-medium text-muted-foreground">Título del libro opcional</div>
                      <div className="mt-2 divide-y divide-border/45">
                        {titleOptions.map((option) => {
                          const active = option.title === candidate.workingTitle;
                          return (
                            <button
                              key={`${candidate.id}-${option.title}`}
                              type="button"
                              className={cn(
                                "flex w-full min-w-0 items-start justify-between gap-3 py-2 text-left text-sm transition",
                                active ? "text-primary" : "text-foreground hover:text-primary",
                              )}
                              onClick={() => onApplyCandidateTitleOption(batch.id, candidate.id, option)}
                            >
                              <span className="block min-w-0">
                                <span className="flex min-w-0 items-center gap-2">
                                  {active ? <Check className="h-3.5 w-3.5 shrink-0" /> : null}
                                  <span className={`break-words font-medium [overflow-wrap:anywhere] ${AUTO_DIRECTOR_MOBILE_CLASSES.wrapText}`}>
                                    {option.title}
                                  </span>
                                </span>
                                <span className={`mt-1 block line-clamp-2 text-xs leading-5 text-muted-foreground ${AUTO_DIRECTOR_MOBILE_CLASSES.wrapText}`}>
                                  {option.reason?.trim() || option.angle || "Puede utilizarse directamente como título de este conjunto de libros."}
                                </span>
                              </span>
                              <span className={cn("shrink-0 text-xs tabular-nums", active ? "text-primary" : "text-muted-foreground")}>
                                {option.clickRate}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="max-w-xl">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                          <RefreshCw className="h-4 w-4 text-muted-foreground" />
                          Rehacer grupo de títulos
                        </div>
                        <Input
                          className="mt-2 bg-background"
                          value={titlePatchFeedbacks[candidate.id] ?? ""}
                          onChange={(event) => onTitlePatchFeedbackChange(candidate.id, event.target.value)}
                          placeholder="Por ejemplo: es más urbano y genial, no como un artículo actualizado de estilo antiguo."
                        />
                        <div className="mt-2">
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            className={AUTO_DIRECTOR_MOBILE_CLASSES.fullWidthAction}
                            disabled={isApplying || isRefiningTitle || !titlePatchFeedbacks[candidate.id]?.trim()}
                            onClick={() => onRefineTitle(batch.id, candidate, titlePatchFeedbacks[candidate.id] ?? "")}
                          >
                            <Wand2 className="h-4 w-4" />
                            {isRefiningTitle ? "Rehaciendo..." : "Grupo de títulos reelaborado por IA"}
                          </Button>
                        </div>
                      </div>

                    </div>
                  </div>
                </details>
                <footer className="candidate-decision">
                  {batch.candidates.length > 1 && <button type="button" className="text-sm text-muted-foreground hover:text-foreground"
                    onClick={() => document.getElementById(candidateAnchor(batch.id, ""))?.focus()}>Volver al directorio de ronda actual</button>}
                  {openingMode && <Button type="button" size="sm" variant="secondary" disabled={isConfirming || isApplying}
                    onClick={() => void onConfirmCandidate(candidate, batch, alternativeMode)}>
                    {openingLabels[alternativeMode]}
                  </Button>}
                  <Button type="button" size="sm" disabled={isConfirming || isApplying}
                    onClick={() => void onConfirmCandidate(candidate, batch, openingMode)}>
                    {isConfirming ? "Creando…" : openingMode ? openingLabels[openingMode] : "Elige este conjunto"}<ArrowRight size={15} />
                  </Button>
                </footer>
              </article>
            );
          })}</CandidatePairs>
        </motion.section>
      ))}
    </div>
  );
}
