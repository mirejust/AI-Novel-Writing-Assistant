import { useMemo, useState, type Dispatch, type SetStateAction } from "react";
import {readWorldAnswerIntegration, type WorldDeepeningQuestion} from "@ai-novel/shared/types/world";
import { Button } from "@/components/ui/button";

interface WorldDeepeningTabProps {
  questions: WorldDeepeningQuestion[];
  answerDrafts: Record<string, string>;
  setAnswerDrafts: Dispatch<SetStateAction<Record<string, string>>>;
  llmQuickOptions: Record<string, string[]>;
  generatePending: boolean;
  submitPending: boolean;
  onGenerate: () => void;
  onSubmit: () => void;
}

export function collectWorldAnswerDrafts(questions: WorldDeepeningQuestion[], drafts: Record<string, string>) {
  return Object.fromEntries(questions.map(question => [question.id, drafts[question.id] ?? question.answer ?? ""])
    .filter(([id, answer]) => {
      const question = questions.find(row => row.id === id)!;
      return answer.trim() && (question.status !== "integrated" || answer.trim() !== question.answer?.trim() || !readWorldAnswerIntegration(question.integratedSummary));
    }));
}

export default function WorldDeepeningTab(props: WorldDeepeningTabProps) {
  const {
    questions,
    answerDrafts,
    setAnswerDrafts,
    llmQuickOptions,
    generatePending,
    submitPending,
    onGenerate,
    onSubmit,
  } = props;
  const [activeQuestionId, setActiveQuestionId] = useState<string | null>(null);
  const activeQuestion = useMemo(() => {
    if (questions.length === 0) {
      return null;
    }
    return questions.find((question) => question.id === activeQuestionId) ?? questions[0];
  }, [activeQuestionId, questions]);
  const activeQuickOptions = activeQuestion
    ? (activeQuestion.quickOptions ?? llmQuickOptions[activeQuestion.id] ?? [])
      .map((option) => option.trim())
      .filter(Boolean)
      .slice(0, 4)
    : [];
  const answeredCount = Object.keys(collectWorldAnswerDrafts(questions, answerDrafts)).length;
  const activeIntegration = readWorldAnswerIntegration(activeQuestion?.integratedSummary);

  return (
    <section className="space-y-6">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Configuración clave completa</h2>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">La IA encontrará los huecos en el manual que más afectan a la historia, y tú sólo tendrás que elegir una dirección o responder con una frase.</p>
        </div>

        <div className="flex flex-col gap-4 rounded-3xl bg-primary/[0.055] p-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="font-medium">Encuentre el siguiente lote de preguntas críticas</div>
            <div className="mt-1 text-xs leading-5 text-muted-foreground">
              Concéntrese en una pequeña cantidad de preguntas de alto impacto a la vez y las respuestas se integrarán en las reglas, facciones, ubicaciones o escenarios de conflicto.
            </div>
          </div>
          <Button className="shrink-0 rounded-full" onClick={onGenerate} disabled={generatePending}>
            {generatePending ? "Generando..." : "Generar preguntas de finalización"}
          </Button>
        </div>

        {questions.length > 0 ? (
          <div className="grid gap-4 lg:grid-cols-[250px_minmax(0,1fr)]">
            <div className="space-y-2 rounded-3xl bg-muted/20 p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="px-2 text-sm font-medium">Preguntas por responder</div>
                <div className="text-xs text-muted-foreground">{answeredCount}/{questions.length}</div>
              </div>
              {questions.map((question, index) => {
                const answered = Boolean(answerDrafts[question.id]?.trim() || question.answer?.trim());
                const integrated = question.status === "integrated" && readWorldAnswerIntegration(question.integratedSummary)
                  && (answerDrafts[question.id] === undefined || answerDrafts[question.id].trim() === question.answer?.trim());
                const selected = activeQuestion?.id === question.id;
                return (
                  <button
                    key={question.id}
                    type="button"
                    className={[
                      "w-full rounded-2xl px-3 py-2.5 text-left text-sm transition-colors",
                      selected ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:bg-background/60",
                    ].join(" ")}
                    onClick={() => setActiveQuestionId(question.id)}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-foreground">pregunta {index + 1}</span>
                      <span className={answered ? "text-xs text-primary" : "text-xs text-muted-foreground"}>
                        {integrated ? "Integrado" : answered ? "Para ser integrado" : "Para ser respondido"}
                      </span>
                    </div>
                    <div className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
                      {question.question}
                    </div>
                  </button>
                );
              })}
            </div>

            {activeQuestion ? (
              <div className="space-y-4 rounded-3xl bg-muted/20 p-5">
                <div>
                  <div className="text-sm font-medium text-foreground">{activeQuestion.question}</div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    Esta respuesta se utilizará para completar el Manual Mundial.
                  </div>
                </div>
                {activeIntegration ? <div role="status" className="rounded-2xl bg-primary/5 p-3 text-sm leading-6">
                  <div className="font-medium">Resultados de la integración manual</div>
                  <p>{activeIntegration.summary}</p>
                </div> : activeQuestion.answer ? <p className="text-sm text-muted-foreground">La respuesta se ha guardado y se puede enviar para su integración en el Manual Mundial.</p> : null}
                {activeQuickOptions.length > 0 ? (
                  <div className="space-y-2">
                    <div className="text-xs text-muted-foreground">Responder instrucciones que se pueden seguir directamente.</div>
                    <div className="flex flex-wrap gap-2">
                      {activeQuickOptions.map((option) => (
                        <Button
                          key={`${activeQuestion.id}-${option}`}
                          size="sm"
                          variant={answerDrafts[activeQuestion.id] === option ? "default" : "outline"}
                          className="h-auto rounded-2xl whitespace-normal text-left"
                          onClick={() =>
                            setAnswerDrafts((prev) => ({ ...prev, [activeQuestion.id]: option }))
                          }
                        >
                          {option}
                        </Button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="rounded-2xl bg-muted/20 p-3 text-xs text-muted-foreground">
                    Puedes escribir la respuesta establecida directamente o puedes describir la dirección en una oración primero.
                  </div>
                )}
                <textarea
                  className="min-h-[120px] w-full rounded-2xl border border-border/45 bg-background/80 p-3 text-sm leading-6"
                  value={answerDrafts[activeQuestion.id] ?? activeQuestion.answer ?? ""}
                  onChange={(event) =>
                    setAnswerDrafts((prev) => ({ ...prev, [activeQuestion.id]: event.target.value }))
                  }
                  placeholder="Rellene este suplemento de configuración"
                />
              </div>
            ) : null}
          </div>
        ) : (
          <div className="flex min-h-48 flex-col items-center justify-center rounded-3xl bg-muted/20 px-6 text-center">
            <div className="font-medium">Brechas críticas en el mundo esperando ser descubiertas</div>
            <div className="mt-1 text-sm text-muted-foreground">Después de generar una pregunta, puede seleccionar las direcciones sugeridas una por una o agregar su propia configuración.</div>
          </div>
        )}
        <div className="flex justify-end">
          <Button
            className="rounded-full"
            onClick={onSubmit}
            disabled={submitPending || answeredCount === 0 || questions.length === 0}
          >
            {submitPending ? "Integrando..." : "Enviar y consolidar respuestas"}
          </Button>
        </div>
    </section>
  );
}
