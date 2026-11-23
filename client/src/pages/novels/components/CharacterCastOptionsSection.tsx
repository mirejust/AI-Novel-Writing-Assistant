import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Character, CharacterCastOption, CharacterCastRole, CharacterGender } from "@ai-novel/shared/types/novel";
import type { LLMProvider } from "@ai-novel/shared/types/llm";
import AiButton from "@/components/common/AiButton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  applyCharacterCastOption,
  clearCharacterCastOptions,
  deleteCharacterCastOption,
  generateCharacterCastOptions,
  getCharacterCastOptions,
  getCharacterRelations,
} from "@/api/novel";
import { getNovelWorldSlice } from "@/api/novelWorldSlice";
import { queryKeys } from "@/api/queryKeys";
import SelectControl from "@/components/common/SelectControl";

interface CharacterCastOptionsSectionProps {
  novelId: string;
  characters: Character[];
  selectedCharacter?: Character;
  onSelectedCharacterChange: (id: string) => void;
  llmProvider?: LLMProvider;
  llmModel?: string;
}

const CAST_ROLE_LABELS: Record<CharacterCastRole, string> = {
  protagonist: "Protagonista",
  antagonist: "Oponente principal",
  ally: "Alianza",
  foil: "Papel espejo",
  mentor: "Mentor",
  love_interest: "Atracción emocional",
  pressure_source: "Factor estresante",
  catalyst: "Catalizador",
};

const CHARACTER_GENDER_LABELS: Record<CharacterGender, string> = {
  male: "Masculino",
  female: "Femenino",
  other: "Otros",
  unknown: "Desconocido",
};

function getCastRoleLabel(castRole?: CharacterCastRole | null): string {
  if (!castRole) {
    return "Sin categoría";
  }
  return CAST_ROLE_LABELS[castRole] ?? castRole;
}

function getCharacterGenderLabel(gender?: CharacterGender | null): string {
  if (!gender) {
    return "Desconocido";
  }
  return CHARACTER_GENDER_LABELS[gender] ?? gender;
}

function getCharacterCastQualityWarnings(option: CharacterCastOption): string[] {
  const assessment = option.qualityAssessment;
  if (!assessment || assessment.autoApplicable) {
    return [];
  }
  const issueMessages = Array.from(
    new Set(assessment.issues.map((issue) => issue.message).filter((message) => message.trim().length > 0)),
  );
  if (issueMessages.length > 0) {
    return issueMessages;
  }
  return assessment.blockingReasons;
}

function buildCharacterCastApplyConfirmMessage(option: CharacterCastOption, warnings: string[]): string {
  const warningText = warnings
    .slice(0, 4)
    .map((warning, index) => `${index + 1}. ${warning}`)
    .join("\n");
  return [
    `Póngase en fila"${option.title}“Todavía hay algunas áreas que no coinciden completamente con el escenario actual de la historia.`,
    warningText,
    "¿Aún aplicas al banco de trabajo de recursos de personajes? Después de la aplicación, puedes continuar ajustándolo en los recursos del personaje.",
  ].filter((line) => line.trim().length > 0).join("\n\n");
}

export default function CharacterCastOptionsSection(props: CharacterCastOptionsSectionProps) {
  const { novelId, characters, selectedCharacter, onSelectedCharacterChange, llmProvider, llmModel } = props;
  const queryClient = useQueryClient();
  const [storyInput, setStoryInput] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [isPlannerExpanded, setIsPlannerExpanded] = useState(true);
  const [useWorldContext, setUseWorldContext] = useState(true);
  const [preferredWorldFaction, setPreferredWorldFaction] = useState("");
  const [forceWorldCompliance, setForceWorldCompliance] = useState(true);

  const castOptionsQuery = useQuery({
    queryKey: queryKeys.novels.characterCastOptions(novelId),
    queryFn: () => getCharacterCastOptions(novelId),
    enabled: Boolean(novelId),
  });

  const relationsQuery = useQuery({
    queryKey: queryKeys.novels.characterRelations(novelId),
    queryFn: () => getCharacterRelations(novelId),
    enabled: Boolean(novelId),
  });

  const worldSliceQuery = useQuery({
    queryKey: queryKeys.novels.worldSlice(novelId),
    queryFn: () => getNovelWorldSlice(novelId),
    enabled: Boolean(novelId) && useWorldContext,
  });

  const castOptions = castOptionsQuery.data?.data ?? [];
  const relations = relationsQuery.data?.data ?? [];
  const worldSliceView = worldSliceQuery.data?.data;
  const hasUsableWorld = Boolean(worldSliceView?.hasWorld);
  const hasWorldSlice = Boolean(worldSliceView?.slice);
  const activeWorldForces = worldSliceQuery.data?.data?.slice?.activeForces ?? [];
  const appliedOption = useMemo(
    () => castOptions.find((option) => option.status === "applied") ?? null,
    [castOptions],
  );
  const characterNameById = useMemo(
    () => new Map(characters.map((character) => [character.id, character.name])),
    [characters],
  );

  useEffect(() => {
    setIsPlannerExpanded(appliedOption == null);
  }, [appliedOption?.id]);

  async function refreshCastOptions() {
    await queryClient.invalidateQueries({ queryKey: queryKeys.novels.characterCastOptions(novelId) });
  }

  async function refreshAppliedCharacterWorkspace() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.novels.detail(novelId) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.novels.characterCastOptions(novelId) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.novels.characterRelations(novelId) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.novels.characterDynamicsOverview(novelId) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.novels.characterCandidates(novelId) }),
    ]);
  }

  function handleDeleteOption(option: CharacterCastOption) {
    const confirmed = window.confirm(
      option.status === "applied"
        ? `Confirmar plan de eliminación "${option.title}”? Esto solo eliminará los registros del escenario y no revertirá los roles y relaciones sincronizados.`
        : `Confirmar plan de eliminación "${option.title}»?`,
    );
    if (!confirmed) {
      return;
    }
    deleteMutation.mutate(option.id);
  }

  function handleRejectAll() {
    const confirmed = window.confirm(
      appliedOption
        ? "¿Confirmar para borrar todos los registros del plan de alineación actual? Los roles y relaciones sincronizados no se revertirán automáticamente."
        : `Confirmar para borrar el actual ${castOptions.length} ¿Un plan de alineación?`,
    );
    if (!confirmed) {
      return;
    }
    clearMutation.mutate();
  }

  const filteredRelations = useMemo(() => {
    if (!selectedCharacter) {
      return relations.slice(0, 8);
    }
    return relations.filter(
      (relation) => relation.sourceCharacterId === selectedCharacter.id || relation.targetCharacterId === selectedCharacter.id,
    );
  }, [relations, selectedCharacter]);

  const generateMutation = useMutation({
    mutationFn: () =>
      generateCharacterCastOptions(novelId, {
        provider: llmProvider,
        model: llmModel,
        temperature: 0.6,
        storyInput: storyInput.trim() || undefined,
        useWorldContext,
        worldFocusHints: useWorldContext
          ? {
            preferFaction: preferredWorldFaction || undefined,
            forceCompliance: forceWorldCompliance,
          }
          : undefined,
      }),
    onSuccess: async (response) => {
      setStatusMessage(response.message ?? "Se ha generado el plan de alineación de personajes.");
      setIsPlannerExpanded(true);
      await refreshCastOptions();
    },
    onError: (error) => {
      setStatusMessage(error instanceof Error ? error.message : "Falló la generación del plan de alineación de personajes.");
    },
  });

  const applyMutation = useMutation({
    mutationFn: (input: { optionId: string; overrideQualityGate?: boolean }) => (
      applyCharacterCastOption(novelId, input.optionId, {
        overrideQualityGate: input.overrideQualityGate,
        provider: llmProvider,
        model: llmModel,
        temperature: 0.45,
      })
    ),
    onSuccess: async (response) => {
      const primaryCharacterId = response.data?.primaryCharacterId ?? "";
      if (primaryCharacterId) {
        onSelectedCharacterChange(primaryCharacterId);
      }
      const createdCount = response.data?.createdCount ?? 0;
      const updatedCount = response.data?.updatedCount ?? 0;
      const backgroundHint = "La información explícita y la dinámica de los personajes se completarán en segundo plano y podrás verlas actualizando los recursos del personaje más tarde.";
      setStatusMessage(
        response.data?.qualityOverrideApplied
          ? `Esta alineación ha sido aplicada según su confirmación y sincronizada. ${createdCount} nuevos personajes, actualizados ${updatedCount} un rol existente.${backgroundHint}`
          : `${response.message ?? `Sincronizado ${createdCount} nuevos personajes, actualizados ${updatedCount} un rol existente.`}${backgroundHint}`,
      );
      setIsPlannerExpanded(false);
      await refreshAppliedCharacterWorkspace();
    },
    onError: (error) => {
      setStatusMessage(error instanceof Error ? error.message : "Error en la aplicación del esquema de alineación de roles.");
    },
  });

  function handleApplyOption(option: CharacterCastOption) {
    const qualityWarnings = getCharacterCastQualityWarnings(option);
    if (qualityWarnings.length > 0) {
      const confirmed = window.confirm(buildCharacterCastApplyConfirmMessage(option, qualityWarnings));
      if (!confirmed) {
        return;
      }
      applyMutation.mutate({ optionId: option.id, overrideQualityGate: true });
      return;
    }
    applyMutation.mutate({ optionId: option.id });
  }

  const deleteMutation = useMutation({
    mutationFn: (optionId: string) => deleteCharacterCastOption(novelId, optionId),
    onSuccess: async (response) => {
      if (response.data?.deletedAppliedOption) {
        setStatusMessage("El registro del plan ha sido eliminado; Se conservarán los datos correspondientes en la biblioteca de funciones y la red de relaciones.");
      } else {
        setStatusMessage("Este plan de alineación ha sido eliminado.");
      }
      await refreshCastOptions();
    },
    onError: (error) => {
      setStatusMessage(error instanceof Error ? error.message : "No se pudo eliminar el plan de alineación.");
    },
  });

  const clearMutation = useMutation({
    mutationFn: () => clearCharacterCastOptions(novelId),
    onSuccess: async (response) => {
      const deletedCount = response.data?.deletedCount ?? 0;
      const deletedAppliedCount = response.data?.deletedAppliedCount ?? 0;
      if (deletedCount === 0) {
        setStatusMessage("No hay planes de alineación que borrar.");
      } else if (deletedAppliedCount > 0) {
        setStatusMessage(`Borrado ${deletedCount} Un conjunto de registros del plan de alineación; Los roles y relaciones sincronizados no se revertirán automáticamente.`);
      } else {
        setStatusMessage(`Borrado ${deletedCount} Un plan de alineación.`);
      }
      setIsPlannerExpanded(true);
      await refreshCastOptions();
    },
    onError: (error) => {
      setStatusMessage(error instanceof Error ? error.message : "El plan para limpiar la alineación fracasó.");
    },
  });
  const isWorking =
    generateMutation.isPending
    || applyMutation.isPending
    || deleteMutation.isPending
    || clearMutation.isPending;

  return (
    <div className="space-y-4">
      <Card className={appliedOption && !isPlannerExpanded ? "border-border/60 bg-muted/15" : ""}>
        <CardHeader className="gap-3">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-1">
              <CardTitle>Plan de alineación de personajes de IA</CardTitle>
              <div className="text-sm text-muted-foreground">
                Es más adecuado para construir un sistema de personajes en la etapa inicial o replanificar la alineación después de un cambio importante en la dirección de la historia.
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">{castOptions.length} Conjunto de candidatos</Badge>
              <Badge variant="outline">{relations.length} Relación de rol</Badge>
              {appliedOption ? <Badge variant="secondary">Esquema aplicado</Badge> : null}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {appliedOption && !isPlannerExpanded ? (
            <div className="grid gap-4 rounded-2xl border border-border/70 bg-background/80 p-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="font-medium">{appliedOption.title}</div>
                  <Badge variant="secondary">Actualmente en vigor</Badge>
                </div>
                <div className="text-sm text-muted-foreground">{appliedOption.summary}</div>
                <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                  <span>{appliedOption.members.length} Rol central</span>
                  <span>{appliedOption.relations.length} Relaciones clave</span>
                  {appliedOption.recommendedReason ? <span>Recomendar:{appliedOption.recommendedReason}</span> : null}
                </div>
                {statusMessage ? <div className="text-xs text-muted-foreground">{statusMessage}</div> : null}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => setIsPlannerExpanded(true)}>
                  Ver el resto de opciones
                </Button>
                <Button variant="secondary" onClick={() => setIsPlannerExpanded(true)}>
                  Replanificar la alineación
                </Button>
              </div>
            </div>
          ) : (
            <>
              <div className="grid gap-4 xl:grid-cols-[minmax(280px,0.72fr)_minmax(0,1.28fr)]">
                <div className="space-y-3 rounded-2xl border border-border/70 bg-muted/20 p-4">
                  <div className="space-y-1">
                    <div className="text-sm font-medium">Generar instrucciones</div>
                    <div className="text-xs text-muted-foreground">
                      Puede complementar el deseo del protagonista, la presión del oponente, la tensión de la relación o la dirección del personaje en la que desea concentrarse para fortalecer.
                    </div>
                  </div>
                  <textarea
                    className="min-h-[140px] w-full rounded-xl border bg-background p-3 text-sm"
                    placeholder="Por ejemplo: el protagonista debe elegir entre responsabilidad familiar y libertad personal; el villano no debe ser pura maldad, sino tener el deseo de proteger y controlar."
                    value={storyInput}
                    onChange={(event) => setStoryInput(event.target.value)}
                  />
                  <div className="flex flex-wrap gap-2">
                    <label className="flex items-center gap-2 text-xs text-muted-foreground">
                      <input
                        type="checkbox"
                        checked={useWorldContext}
                        onChange={(event) => setUseWorldContext(event.target.checked)}
                      />
                      Genera un mundo basado en este libro.
                    </label>
                    {useWorldContext ? (
                      <label className="flex items-center gap-2 text-xs text-muted-foreground">
                        <input
                          type="checkbox"
                          checked={forceWorldCompliance}
                          onChange={(event) => setForceWorldCompliance(event.target.checked)}
                        />
                        Verifique el cumplimiento de las reglas mundiales
                      </label>
                    ) : null}
                  </div>
                  {useWorldContext ? (
                    <div className="grid gap-2 rounded-xl border border-border/70 bg-background/80 p-3 text-xs text-muted-foreground">
                      {worldSliceQuery.isLoading ? (
                        <div>Leyendo este libro alcance de uso mundial...</div>
                      ) : !hasUsableWorld ? (
                        <div>
                          El mundo del libro aún no está listo. En esta ronda, se dará prioridad al diseño de personajes basado en la información a nivel de libro y las instrucciones de tu generación.
                        </div>
                      ) : !hasWorldSlice ? (
                        <div>
                          El mundo de este libro existe, pero aún no se ha determinado su ámbito de uso. Se recomienda ir primero a la página de información básica para aclarar el alcance de uso de este libro, o continuar dejando que la IA lo genere de manera conservadora de acuerdo con el manual mundial.
                        </div>
                      ) : null}
                      <label className="space-y-1">
                        <span className="font-medium text-foreground">Tendencias sectarias</span>
                        <SelectControl
                          className="w-full rounded-md border bg-background p-2 text-sm"
                          value={preferredWorldFaction}
                          onChange={(event) => setPreferredWorldFaction(event.target.value)}
                          disabled={!hasWorldSlice || activeWorldForces.length === 0}
                        >
                          <option value="">Juzgado por IA</option>
                          {activeWorldForces.map((force) => (
                            <option key={force.id} value={force.name}>{force.name}</option>
                          ))}
                        </SelectControl>
                      </label>
                      <div>
                        {hasWorldSlice
                          ? "Los personajes darán prioridad a las fuerzas, ubicaciones, límites de identidad y combinaciones prohibidas en el mundo de este libro."
                          : "Una vez organizado el ámbito de uso mundial de este libro, se puede especificar más la tendencia de influencia."}
                      </div>
                    </div>
                  ) : null}
                  <div className="flex flex-wrap gap-2">
                    <AiButton onClick={() => generateMutation.mutate()} disabled={isWorking}>
                      {generateMutation.isPending ? "Generando..." : "Genera 3 alineaciones"}
                    </AiButton>
                    {castOptions.length > 0 ? (
                      <Button variant="outline" onClick={handleRejectAll} disabled={isWorking}>
                        {clearMutation.isPending ? "Limpiar el aire..." : "no me gusta"}
                      </Button>
                    ) : null}
                    {appliedOption ? (
                      <Button variant="outline" onClick={() => setIsPlannerExpanded(false)} disabled={isWorking}>
                        Contraer área del plan
                      </Button>
                    ) : null}
                  </div>
                  <div className="rounded-xl border border-dashed p-3 text-xs text-muted-foreground">
                    Después de aplicar una determinada alineación, los personajes se crearán/actualizarán simultáneamente y se actualizará el banco de trabajo de recursos de personajes.
                  </div>
                  {statusMessage ? (
                    <div className="rounded-xl border border-border/70 bg-background/80 p-3 text-xs text-muted-foreground">
                      {statusMessage}
                    </div>
                  ) : null}
                </div>

                {castOptionsQuery.isLoading ? (
                  <div className="flex min-h-[260px] items-center justify-center rounded-2xl border border-dashed text-sm text-muted-foreground">
                    Cargando plan de alineación...
                  </div>
                ) : castOptions.length > 0 ? (
                  <div className="grid gap-3 2xl:grid-cols-2">
                    {castOptions.map((option) => {
                      const qualityWarnings = getCharacterCastQualityWarnings(option);
                      const requiresQualityConfirmation = qualityWarnings.length > 0;
                      const isApplyingThisOption = applyMutation.isPending && applyMutation.variables?.optionId === option.id;
                      return (
                        <div
                          key={option.id}
                          className={`rounded-2xl border p-4 ${
                            option.status === "applied" ? "border-emerald-500/40 bg-emerald-50/40" : ""
                          }`}
                        >
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div className="space-y-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <div className="font-medium">{option.title}</div>
                                {option.status === "applied" ? <Badge variant="secondary">Aplicado</Badge> : null}
                                {option.recommendedReason ? <Badge variant="outline">Recomendado</Badge> : null}
                                {requiresQualityConfirmation ? <Badge variant="outline">Necesito confirmar</Badge> : null}
                              </div>
                              <div className="text-xs leading-5 text-muted-foreground">{option.summary}</div>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <Button
                                size="sm"
                                onClick={() => handleApplyOption(option)}
                                disabled={isWorking}
                                variant={option.status === "applied" ? "outline" : "default"}
                              >
                                {isApplyingThisOption
                                  ? "Aplicando..."
                                  : option.status === "applied"
                                    ? "Volver a aplicar"
                                    : requiresQualityConfirmation
                                      ? "Aplicar después de la confirmación"
                                      : "Aplicar esta alineación"}
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-muted-foreground hover:text-destructive"
                                onClick={() => handleDeleteOption(option)}
                                disabled={isWorking}
                              >
                                {deleteMutation.isPending && deleteMutation.variables === option.id ? "Eliminando..." : "Eliminar"}
                              </Button>
                            </div>
                          </div>
                          {requiresQualityConfirmation ? (
                            <div className="mt-3 rounded-xl border border-amber-300/70 bg-amber-50/70 p-3 text-xs text-amber-900">
                              <div className="font-medium">Necesitas confirmar esta alineación antes de aplicarla.</div>
                              <div className="mt-1">
                                El sistema descubrió que no coincidía completamente con la configuración de la historia actual. Puedes aplicarlo primero y luego ajustarlo en los recursos del personaje.
                              </div>
                              <ul className="mt-2 list-disc space-y-1 pl-4">
                                {qualityWarnings.slice(0, 3).map((warning) => (
                                  <li key={warning}>{warning}</li>
                                ))}
                              </ul>
                            </div>
                          ) : null}
                          {option.recommendedReason ? (
                            <div className="mt-3 rounded-xl border border-amber-200/60 bg-amber-50/50 p-3 text-xs text-muted-foreground">
                              Razones de la recomendación:{option.recommendedReason}
                            </div>
                          ) : null}
                          {option.whyItWorks ? (
                            <div className="mt-2 text-xs text-muted-foreground">Razones para su establecimiento:{option.whyItWorks}</div>
                          ) : null}
                          <div className="mt-3 grid gap-2 sm:grid-cols-2">
                            {option.members.map((member) => (
                              <div key={member.id} className="rounded-xl border border-dashed p-3">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="font-medium">{member.name}</span>
                                  <Badge variant="outline">{getCastRoleLabel(member.castRole)}</Badge>
                                  <Badge variant="secondary">{getCharacterGenderLabel(member.gender)}</Badge>
                                </div>
                                <div className="mt-1 text-xs text-muted-foreground">{member.role}</div>
                                <div className="mt-2 text-xs text-muted-foreground">Efecto:{member.storyFunction}</div>
                                {member.relationToProtagonist ? (
                                  <div className="text-xs text-muted-foreground">
                                    Relación con el protagonista:{member.relationToProtagonist}
                                  </div>
                                ) : null}
                                {member.outerGoal ? (
                                  <div className="text-xs text-muted-foreground">Metas externas:{member.outerGoal}</div>
                                ) : null}
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="flex min-h-[260px] items-center justify-center rounded-2xl border border-dashed px-6 text-center text-sm text-muted-foreground">
                    Aún no hay un plan de alineación. Primero ingrese un poco de dirección del personaje, luego haga clic en "Generar 3 alineaciones".
                  </div>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Red de roles</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {selectedCharacter ? (
            <div className="text-xs text-muted-foreground">
              Enfoque actual:{selectedCharacter.name}({selectedCharacter.role || "Sin definir"})
            </div>
          ) : (
            <div className="text-xs text-muted-foreground">Cuando no se selecciona una función, las entradas de relación más recientes se muestran de forma predeterminada.</div>
          )}
          {relationsQuery.isLoading ? (
            <div className="text-muted-foreground">Cargando red de relaciones...</div>
          ) : filteredRelations.length > 0 ? (
            <div className="grid gap-2 lg:grid-cols-2">
              {filteredRelations.map((relation) => {
                const selectedIsSource = selectedCharacter ? relation.sourceCharacterId === selectedCharacter.id : false;
                const counterpartId = selectedIsSource ? relation.targetCharacterId : relation.sourceCharacterId;
                const counterpartName = selectedIsSource
                  ? relation.targetCharacterName || characterNameById.get(counterpartId) || "Rol sin nombre"
                  : relation.sourceCharacterName || characterNameById.get(counterpartId) || "Rol sin nombre";
                return (
                  <button
                    key={relation.id}
                    type="button"
                    className="w-full rounded-xl border p-3 text-left transition hover:border-primary/40 hover:bg-muted/30"
                    onClick={() => {
                      if (counterpartId) {
                        onSelectedCharacterChange(counterpartId);
                      }
                    }}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="font-medium">{counterpartName}</div>
                      <Badge variant="outline">{relation.surfaceRelation}</Badge>
                    </div>
                    {relation.hiddenTension ? (
                      <div className="mt-2 text-xs text-muted-foreground">Tensión oculta:{relation.hiddenTension}</div>
                    ) : null}
                    {relation.conflictSource ? (
                      <div className="text-xs text-muted-foreground">Fuente de conflicto:{relation.conflictSource}</div>
                    ) : null}
                    {relation.nextTurnPoint ? (
                      <div className="text-xs text-muted-foreground">Próximo punto de reversión:{relation.nextTurnPoint}</div>
                    ) : null}
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed p-4 text-muted-foreground">
              Aún no hay relaciones entre personajes. Un elenco de personajes aparecerá aquí después de aplicarlo.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
