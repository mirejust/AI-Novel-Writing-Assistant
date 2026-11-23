import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { StyleRecommendationResult } from "@ai-novel/shared/types/styleEngine";
import { createStyleBinding, getStyleBindings, recommendStyleProfilesForNovel } from "@/api/styleEngine";
import { queryKeys } from "@/api/queryKeys";
import AiButton from "@/components/common/AiButton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useLLMStore } from "@/store/llmStore";

interface NovelStyleRecommendationCardProps {
  novelId: string;
}

export default function NovelStyleRecommendationCard({ novelId }: NovelStyleRecommendationCardProps) {
  const llm = useLLMStore();
  const queryClient = useQueryClient();
  const [recommendation, setRecommendation] = useState<StyleRecommendationResult | null>(null);
  const [message, setMessage] = useState("");

  const novelBindingsQuery = useQuery({
    queryKey: queryKeys.styleEngine.bindings(`novel-${novelId}`),
    queryFn: () => getStyleBindings({ targetType: "novel", targetId: novelId }),
    enabled: Boolean(novelId),
  });

  const currentBindings = novelBindingsQuery.data?.data ?? [];
  const hasConfirmedBookStyle = currentBindings.length > 0;

  const recommendMutation = useMutation({
    mutationFn: () => recommendStyleProfilesForNovel(novelId, {
      provider: llm.provider,
      model: llm.model,
      temperature: 0.3,
    }),
    onSuccess: (response) => {
      setRecommendation(response.data ?? null);
      setMessage("");
    },
    onError: (error) => {
      setMessage(error instanceof Error ? error.message : "La recomendación de escritura falló. Vuelve a intentarlo más tarde.");
    },
  });

  const applyMutation = useMutation({
    mutationFn: (styleProfileId: string) => createStyleBinding({
      styleProfileId,
      targetType: "novel",
      targetId: novelId,
      priority: 1,
      weight: 1,
      enabled: true,
    }),
    onSuccess: async () => {
      setMessage("Este método de escritura se ha establecido como el método de escritura predeterminado para este libro. El director automático leerá primero el resumen ligero en la primera mitad y luego continuará usando las reglas completas en la fase de planificación y generación del texto.");
      await queryClient.invalidateQueries({ queryKey: queryKeys.styleEngine.bindings(`novel-${novelId}`) });
      await queryClient.invalidateQueries({ queryKey: queryKeys.styleEngine.bindings("all") });
    },
    onError: (error) => {
      setMessage(error instanceof Error ? error.message : "Error al vincular el método de escritura. Vuelva a intentarlo más tarde.");
    },
  });

  if (!novelId) {
    return null;
  }

  return (
    <Card className="border-slate-200/80 bg-white/95 shadow-[0_20px_60px_rgba(15,23,42,0.05)]">
      <CardHeader className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1">
            <CardTitle>El estilo de escritura predeterminado de este libro.</CardTitle>
            <div className="text-sm leading-7 text-muted-foreground">
              Aquí es donde eliges y aplicas métodos de escritura a nivel de libro a tu novela actual. Los recursos de escritura pertenecen a la capa de recursos y las novelas deben consumirlos aquí, en lugar de decidir "de qué libro usarlos" en la biblioteca de recursos.
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild type="button" variant="outline">
              <Link to="/style-engine">Abrir biblioteca de recursos/Edición avanzada</Link>
            </Button>
            <Button asChild type="button" variant="outline">
              <Link to="/style-engine?mode=imitate">Ve y crea un nuevo estilo de escritura.</Link>
            </Button>
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,0.96fr)_minmax(0,1.04fr)]">
          <div className="space-y-4 rounded-2xl border bg-slate-50/70 p-4">
            <div className="rounded-2xl border bg-white p-4">
              <div className="text-sm font-medium text-slate-900">Método de escritura predeterminado para el nivel de libro actual</div>
              {hasConfirmedBookStyle ? (
                <div className="mt-3 space-y-2">
                  {currentBindings.map((binding) => (
                    <div key={binding.id} className="rounded-xl border bg-slate-50/70 p-3">
                      <div className="font-medium text-slate-900">{binding.styleProfile?.name ?? binding.styleProfileId}</div>
                      <div className="mt-1 text-xs text-slate-600">
                        Prioridad P{binding.priority} / Fuerza W{binding.weight}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-3 text-sm leading-7 text-muted-foreground">
                  Este libro aún no está vinculado al método de escritura predeterminado. Se recomienda dejar que el sistema proporcione primero 2 o 3 conjuntos de candidatos según los lectores objetivo de la novela actual, sus puntos de venta y la promesa de los primeros 30 capítulos.
                </div>
              )}
            </div>

            <div className="rounded-2xl border bg-slate-950 p-4 text-white">
              <div className="text-sm font-medium">Método efectivo</div>
              <div className="mt-3 space-y-2 text-sm leading-7 text-slate-200">
                <div>Período de planificación: la planificación automática del director y del capítulo solo dice "compromiso del sentido de lectura/densidad del lenguaje/estilo de diálogo/explícito emocional/resumen anti-IA".</div>
                <div>Período de texto: después de una vinculación exitosa, el planificador y el tiempo de ejecución continuarán usando las reglas de escritura completas y las restricciones anti-IA.</div>
              </div>
            </div>

            <div className="flex flex-wrap justify-end gap-2">
              <AiButton onClick={() => recommendMutation.mutate()} disabled={recommendMutation.isPending}>
                {recommendMutation.isPending ? "Recomendando métodos de escritura..." : "Genere 2-3 conjuntos de recomendaciones de escritura."}
              </AiButton>
              {recommendation ? (
                <AiButton variant="secondary" onClick={() => recommendMutation.mutate()} disabled={recommendMutation.isPending}>
                  Recomendar
                </AiButton>
              ) : null}
            </div>
          </div>

          <div className="space-y-4 rounded-2xl border bg-white p-4">
            <div className="text-sm font-medium text-slate-900">Resultados recomendados</div>
            {recommendation ? (
              <>
                <div className="rounded-2xl border bg-slate-50/70 p-4 text-sm leading-7 text-slate-700">
                  {recommendation.summary}
                </div>
                {recommendation.candidates.length > 0 ? (
                  <div className="grid gap-3">
                    {recommendation.candidates.map((candidate) => (
                      <div key={candidate.styleProfileId} className="rounded-2xl border bg-white p-4 shadow-sm">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="text-base font-semibold text-slate-900">{candidate.styleProfileName}</div>
                            {candidate.styleProfileDescription ? (
                              <div className="mt-1 text-xs leading-6 text-slate-600">{candidate.styleProfileDescription}</div>
                            ) : null}
                          </div>
                          <Badge variant="outline">aptitud física {candidate.fitScore}</Badge>
                        </div>
                        <div className="mt-3 text-sm leading-7 text-slate-700">{candidate.recommendationReason}</div>
                        {candidate.caution ? (
                          <div className="mt-3 rounded-xl border bg-amber-50/70 p-3 text-xs leading-6 text-amber-900">
                            Cosas a tener en cuenta:{candidate.caution}
                          </div>
                        ) : null}
                        <div className="mt-4 flex justify-end">
                          <Button
                            type="button"
                            onClick={() => applyMutation.mutate(candidate.styleProfileId)}
                            disabled={applyMutation.isPending}
                          >
                            {applyMutation.isPending ? "Encuadernación..." : "Establecer como método de escritura predeterminado para este libro"}
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
                    Actualmente no hay activos de escritura para recomendar. Primero puede ir al motor de escritura para acumular 1 o 2 conjuntos y luego regresar para tomar decisiones para este libro.
                  </div>
                )}
              </>
            ) : (
              <div className="rounded-xl border border-dashed p-4 text-sm leading-7 text-muted-foreground">
                Aquí mostraremos 2 o 3 conjuntos de métodos de escritura seleccionados por el sistema para la novela actual y le diremos por qué son adecuados y qué precauciones tomar.
              </div>
            )}
          </div>
        </div>
      </CardHeader>

      {message ? (
        <CardContent className="pt-0">
          <div className="rounded-2xl border bg-muted/20 px-4 py-3 text-sm">
            {message}
          </div>
        </CardContent>
      ) : null}
    </Card>
  );
}
