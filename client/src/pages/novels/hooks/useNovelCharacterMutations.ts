import { useMutation, useQuery, type QueryClient } from "@tanstack/react-query";
import type { LLMProvider } from "@ai-novel/shared/types/llm";
import {
  applyBatchCharacterVisibleProfiles,
  applyCharacterVisibleProfile,
  applySupplementalCharacter,
  checkCharacterAgainstWorld,
  createNovelCharacter,
  deleteNovelCharacter,
  evolveNovelCharacter,
  generateBatchCharacterVisibleProfiles,
  generateCharacterVisibleProfile,
  generateSupplementalCharacters,
  getCharacterTimeline,
  syncAllCharacterTimeline,
  syncCharacterTimeline,
  updateNovelCharacter,
} from "@/api/novel";
import { queryKeys } from "@/api/queryKeys";
import { buildCharacterProfileFromWizard, type QuickCharacterCreatePayload } from "../components/characterPanel.utils";
import type {
  SupplementalCharacterCandidate,
  SupplementalCharacterGenerateInput,
} from "@ai-novel/shared/types/novel";

interface LLMState {
  provider?: LLMProvider;
  model?: string;
  temperature?: number;
}

interface PipelineFormState {
  startOrder: number;
  endOrder: number;
}

interface CharacterFormState {
  name: string;
  role: string;
  gender: "male" | "female" | "other" | "unknown";
  personality: string;
  background: string;
  development: string;
  appearance: string;
  physique: string;
  attireStyle: string;
  signatureDetail: string;
  voiceTexture: string;
  presenceImpression: string;
  currentState: string;
  currentGoal: string;
}

interface QuickCharacterFormState {
  name: string;
  role: string;
}

interface BaseCharacterOption {
  id: string;
  name: string;
  role: string;
  personality?: string | null;
  background?: string | null;
  development?: string | null;
}

interface UseNovelCharacterMutationsInput {
  id: string;
  selectedCharacterId: string;
  selectedBaseCharacter?: BaseCharacterOption;
  characters: Array<{ id: string }>;
  pipelineForm: PipelineFormState;
  llm: LLMState;
  characterForm: CharacterFormState;
  quickCharacterForm: QuickCharacterFormState;
  queryClient: QueryClient;
  setCharacterMessage: (message: string) => void;
  setSelectedCharacterId: (id: string) => void;
  setQuickCharacterForm: (updater: (prev: QuickCharacterFormState) => QuickCharacterFormState) => void;
}

async function invalidateCharacterViews(queryClient: QueryClient, novelId: string, selectedCharacterId?: string) {
  await queryClient.invalidateQueries({ queryKey: queryKeys.novels.detail(novelId) });
  await queryClient.invalidateQueries({ queryKey: queryKeys.novels.characterRelations(novelId) });
  await queryClient.invalidateQueries({ queryKey: queryKeys.novels.characterDynamicsOverview(novelId) });
  await queryClient.invalidateQueries({ queryKey: queryKeys.novels.characterCandidates(novelId) });
  if (selectedCharacterId) {
    await queryClient.invalidateQueries({
      queryKey: queryKeys.novels.characterTimeline(novelId, selectedCharacterId),
    });
  }
}

export function useNovelCharacterMutations(input: UseNovelCharacterMutationsInput) {
  const {
    id,
    selectedCharacterId,
    selectedBaseCharacter,
    characters,
    pipelineForm,
    llm,
    characterForm,
    quickCharacterForm,
    queryClient,
    setCharacterMessage,
    setSelectedCharacterId,
    setQuickCharacterForm,
  } = input;

  const characterTimelineQuery = useQuery({
    queryKey: queryKeys.novels.characterTimeline(id, selectedCharacterId || "none"),
    queryFn: () => getCharacterTimeline(id, selectedCharacterId),
    enabled: Boolean(id && selectedCharacterId),
  });

  const syncTimelineMutation = useMutation({
    mutationFn: () =>
      syncCharacterTimeline(id, selectedCharacterId, {
        startOrder: pipelineForm.startOrder,
        endOrder: pipelineForm.endOrder,
      }),
    onSuccess: async (response) => {
      setCharacterMessage(response.message ?? `La línea de tiempo del personaje se ha sincronizado y esta vez hay una nueva incorporación. ${response.data?.syncedCount ?? 0} banda.`);
      await invalidateCharacterViews(queryClient, id, selectedCharacterId || "none");
    },
  });

  const syncAllTimelineMutation = useMutation({
    mutationFn: () =>
      syncAllCharacterTimeline(id, {
        startOrder: pipelineForm.startOrder,
        endOrder: pipelineForm.endOrder,
      }),
    onSuccess: async (response) => {
      setCharacterMessage(response.message ?? `Se han sincronizado todas las líneas de tiempo de los personajes, con un total de nuevas incorporaciones. ${response.data?.syncedCount ?? 0} evento.`);
      await invalidateCharacterViews(queryClient, id, selectedCharacterId || "none");
    },
  });

  const evolveCharacterMutation = useMutation({
    mutationFn: () =>
      evolveNovelCharacter(id, selectedCharacterId, {
        provider: llm.provider,
        model: llm.model,
        temperature: 0.4,
      }),
    onSuccess: async () => {
      setCharacterMessage("La información del personaje se ha actualizado según la línea de tiempo.");
      await invalidateCharacterViews(queryClient, id, selectedCharacterId || "none");
    },
  });

  const generateVisibleProfileMutation = useMutation({
    mutationFn: (userGuidance?: string) =>
      generateCharacterVisibleProfile(id, selectedCharacterId, {
        provider: llm.provider,
        model: llm.model,
        temperature: 0.45,
        userGuidance: userGuidance?.trim() || undefined,
      }),
    onSuccess: (response) => {
      const count = Object.keys(response.data?.fields ?? {}).length;
      setCharacterMessage(count > 0 ? `Generado ${count} Elemento de sugerencia de datos explícita, por favor confirme antes de escribir.` : "No hay datos explícitos para el carácter actual que se va a reescribir.");
    },
    onError: (error) => {
      setCharacterMessage(error instanceof Error ? error.message : "Error en la generación de datos explícitos.");
    },
  });

  const applyVisibleProfileMutation = useMutation({
    mutationFn: () => {
      const suggestion = generateVisibleProfileMutation.data?.data;
      const fields = suggestion?.fields ?? {};
      return applyCharacterVisibleProfile(id, selectedCharacterId, fields, {
        overwriteExisting: suggestion?.allowsOverwriteExisting,
      });
    },
    onSuccess: async (response) => {
      const count = response.data?.appliedFields.length ?? 0;
      setCharacterMessage(count > 0 ? `ha sido escrito ${count} Información explícita del artículo.` : "No es necesario escribir nuevos datos explícitos.");
      await invalidateCharacterViews(queryClient, id, selectedCharacterId || "none");
    },
    onError: (error) => {
      setCharacterMessage(error instanceof Error ? error.message : "Error al escribir datos explícitos.");
    },
  });

  const generateBatchVisibleProfilesMutation = useMutation({
    mutationFn: (userGuidance?: string) =>
      generateBatchCharacterVisibleProfiles(id, {
        provider: llm.provider,
        model: llm.model,
        temperature: 0.45,
        userGuidance: userGuidance?.trim() || undefined,
      }),
    onSuccess: (response) => {
      const count = response.data?.results.filter((item) => item.hasApplicableChanges).length ?? 0;
      setCharacterMessage(count > 0 ? `Generado ${count} Sugerencias para los datos de apariencia de cada personaje, por favor confírmalas antes de escribir.` : "No hay contenido explícito que deba escribirse en el perfil del personaje actual.");
    },
    onError: (error) => {
      setCharacterMessage(error instanceof Error ? error.message : "No se pudieron generar datos explícitos por lotes.");
    },
  });

  const applyBatchVisibleProfilesMutation = useMutation({
    mutationFn: () => {
      const items = (generateBatchVisibleProfilesMutation.data?.data?.results ?? [])
        .filter((item) => item.hasApplicableChanges)
        .map((item) => ({
          characterId: item.characterId,
          fields: item.fields,
          overwriteExisting: item.allowsOverwriteExisting,
        }));
      return applyBatchCharacterVisibleProfiles(id, items);
    },
    onSuccess: async (response) => {
      const count = response.data?.results.reduce((sum, item) => sum + item.appliedFields.length, 0) ?? 0;
      setCharacterMessage(count > 0 ? `Escrito en lotes ${count} Información explícita del artículo.` : "No hay nuevos datos explícitos que deban escribirse en lotes.");
      await invalidateCharacterViews(queryClient, id, selectedCharacterId || "none");
    },
    onError: (error) => {
      setCharacterMessage(error instanceof Error ? error.message : "No se pudieron escribir datos explícitos por lotes.");
    },
  });

  const worldCheckMutation = useMutation({
    mutationFn: () =>
      checkCharacterAgainstWorld(id, selectedCharacterId, {
        provider: llm.provider,
        model: llm.model,
        temperature: 0.2,
      }),
    onSuccess: (response) => {
      const status = response.data?.status ?? "pass";
      const warningText = response.data?.warnings?.join(" | ") ?? "";
      const issueText = (response.data?.issues ?? [])
        .map((item) => `${item.severity.toUpperCase()}: ${item.message}`)
        .join(" | ");
      setCharacterMessage(`Verificación de reglas mundiales (${status}) ${warningText} ${issueText}`.trim());
    },
    onError: (error) => {
      setCharacterMessage(error instanceof Error ? error.message : "La verificación de las reglas mundiales falló.");
    },
  });

  const saveCharacterMutation = useMutation({
    mutationFn: () =>
      updateNovelCharacter(id, selectedCharacterId, {
        name: characterForm.name,
        role: characterForm.role,
        gender: characterForm.gender,
        personality: characterForm.personality,
        background: characterForm.background,
        development: characterForm.development,
        appearance: characterForm.appearance,
        physique: characterForm.physique,
        attireStyle: characterForm.attireStyle,
        signatureDetail: characterForm.signatureDetail,
        voiceTexture: characterForm.voiceTexture,
        presenceImpression: characterForm.presenceImpression,
        currentState: characterForm.currentState,
        currentGoal: characterForm.currentGoal,
      }),
    onSuccess: async () => {
      setCharacterMessage("Información de rol guardada.");
      await invalidateCharacterViews(queryClient, id, selectedCharacterId || "none");
    },
  });

  const importBaseCharacterMutation = useMutation({
    mutationFn: async () => {
      if (!selectedBaseCharacter) {
        throw new Error("Seleccione primero el rol base para importar.");
      }
      return createNovelCharacter(id, {
        name: selectedBaseCharacter.name,
        role: selectedBaseCharacter.role,
        personality: selectedBaseCharacter.personality ?? undefined,
        background: selectedBaseCharacter.background ?? undefined,
        development: selectedBaseCharacter.development ?? undefined,
        baseCharacterId: selectedBaseCharacter.id,
      });
    },
    onSuccess: async (response) => {
      setCharacterMessage(response.message ?? "El personaje base ha sido importado a la novela actual.");
      if (response.data?.id) {
        setSelectedCharacterId(response.data.id);
      }
      await invalidateCharacterViews(queryClient, id, response.data?.id ?? selectedCharacterId ?? "none");
    },
    onError: (error) => {
      setCharacterMessage(error instanceof Error ? error.message : "No se pudo importar el carácter base.");
    },
  });

  const quickCreateCharacterMutation = useMutation({
    mutationFn: async (payload?: QuickCharacterCreatePayload) => {
      const nextName = payload?.name?.trim() || quickCharacterForm.name.trim();
      const nextRole = payload?.role?.trim() || quickCharacterForm.role.trim() || "Protagonista";
      const generatedProfile = payload ? buildCharacterProfileFromWizard(payload) : {};
      return createNovelCharacter(id, {
        name: nextName,
        role: nextRole,
        relationToProtagonist: payload?.relationToProtagonist?.trim() || undefined,
        storyFunction: payload?.storyFunction?.trim() || undefined,
        ...generatedProfile,
      });
    },
    onSuccess: async (response) => {
      setCharacterMessage(response.message ?? "El personaje fue creado con éxito.");
      setQuickCharacterForm((prev) => ({ ...prev, name: "" }));
      if (response.data?.id) {
        setSelectedCharacterId(response.data.id);
      }
      await invalidateCharacterViews(queryClient, id, response.data?.id ?? selectedCharacterId ?? "none");
    },
    onError: (error) => {
      setCharacterMessage(error instanceof Error ? error.message : "La creación del personaje falló.");
    },
  });

  const deleteCharacterMutation = useMutation({
    mutationFn: (characterId: string) => deleteNovelCharacter(id, characterId),
    onSuccess: async (_response, deletedCharacterId) => {
      setCharacterMessage("El rol ha sido eliminado.");
      if (selectedCharacterId === deletedCharacterId) {
        const fallback = characters.find((item) => item.id !== deletedCharacterId);
        setSelectedCharacterId(fallback?.id ?? "");
      }
      await invalidateCharacterViews(queryClient, id, deletedCharacterId);
    },
    onError: (error) => {
      setCharacterMessage(error instanceof Error ? error.message : "No se pudo eliminar el rol.");
    },
  });

  const generateSupplementalCharacterMutation = useMutation({
    mutationFn: (payload: SupplementalCharacterGenerateInput) =>
      generateSupplementalCharacters(id, {
        ...payload,
        provider: payload.provider ?? llm.provider,
        model: payload.model ?? llm.model,
        temperature: payload.temperature ?? 0.55,
      }),
    onError: (error) => {
      setCharacterMessage(error instanceof Error ? error.message : "Error en la generación de caracteres suplementarios.");
    },
  });

  const applySupplementalCharacterMutation = useMutation({
    mutationFn: (candidate: SupplementalCharacterCandidate) => applySupplementalCharacter(id, candidate),
    onSuccess: async (response) => {
      const createdCharacterId = response.data?.character?.id ?? "";
      const relationCount = response.data?.relationCount ?? 0;
      setCharacterMessage(
        response.message
        ?? `Rol suplementario creado${relationCount > 0 ? `y sincronizar ${relationCount} relación estructurada` : ""}.`,
      );
      if (createdCharacterId) {
        setSelectedCharacterId(createdCharacterId);
      }
      await invalidateCharacterViews(queryClient, id, createdCharacterId || selectedCharacterId || "none");
    },
    onError: (error) => {
      setCharacterMessage(error instanceof Error ? error.message : "Error al aplicar el rol suplementario.");
    },
  });

  return {
    characterTimelineQuery,
    syncTimelineMutation,
    syncAllTimelineMutation,
    evolveCharacterMutation,
    generateVisibleProfileMutation,
    applyVisibleProfileMutation,
    generateBatchVisibleProfilesMutation,
    applyBatchVisibleProfilesMutation,
    worldCheckMutation,
    saveCharacterMutation,
    importBaseCharacterMutation,
    quickCreateCharacterMutation,
    deleteCharacterMutation,
    generateSupplementalCharacterMutation,
    applySupplementalCharacterMutation,
  };
}
