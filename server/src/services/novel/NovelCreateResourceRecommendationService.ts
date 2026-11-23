import type {
  AIFreedom,
  EmotionIntensity,
  NarrativePov,
  NovelWritingMode,
  PacePreference,
  ProjectMode,
} from "@ai-novel/shared/types/novel";
import type { LLMProvider } from "@ai-novel/shared/types/llm";
import type {
  NovelCreateResourceRecommendation,
  PowerSystemPreference,
} from "@ai-novel/shared/types/novelResourceRecommendation";
import { runStructuredPrompt } from "../../prompting/core/promptRunner";
import { novelCreateResourceRecommendationPrompt } from "../../prompting/prompts/novel/resourceRecommendation.prompts";
import { ensureSystemResourceStarterData } from "../bootstrap/SystemResourceBootstrapService";
import { GenreService, type GenreTreeNode } from "../genre/GenreService";
import { StoryModeService, type StoryModeTreeNode } from "../storyMode/StoryModeService";
import { buildStoryModePromptBlock } from "../storyMode/storyModeProfile";
import { buildBookFramingSummary } from "./bookFraming";

interface RecommendNovelCreateResourcesInput {
  marketBriefPrompt?: string;
  title?: string;
  description?: string;
  targetAudience?: string;
  bookSellingPoint?: string;
  competingFeel?: string;
  first30ChapterPromise?: string;
  commercialTags?: string[];
  genreId?: string;
  primaryStoryModeId?: string;
  secondaryStoryModeId?: string;
  writingMode?: NovelWritingMode;
  projectMode?: ProjectMode;
  narrativePov?: NarrativePov;
  pacePreference?: PacePreference;
  styleTone?: string;
  emotionIntensity?: EmotionIntensity;
  aiFreedom?: AIFreedom;
  powerSystemPreference?: PowerSystemPreference;
  provider?: LLMProvider;
  model?: string;
  temperature?: number;
}

export interface ResolvedNovelProductionFoundation {
  genreId: string;
  primaryStoryModeId: string;
  secondaryStoryModeId?: string;
  recommendation: NovelCreateResourceRecommendation;
  promptBlock: string;
}

interface FlattenedGenreOption {
  id: string;
  name: string;
  path: string;
  description?: string | null;
  template?: string | null;
}

interface FlattenedStoryModeOption {
  id: string;
  name: string;
  path: string;
  description?: string | null;
  template?: string | null;
  profile: StoryModeTreeNode["profile"];
}

function compactText(value: string | null | undefined): string {
  return value?.replace(/\s+/g, " ").trim() ?? "";
}

function truncateText(value: string | null | undefined, maxLength = 220): string {
  const text = compactText(value);
  if (!text) {
    return "";
  }
  if (text.length <= maxLength) {
    return text;
  }
  return `${text.slice(0, maxLength)}...`;
}

function flattenGenreOptions(nodes: GenreTreeNode[], path: string[] = []): FlattenedGenreOption[] {
  return nodes.flatMap((node) => {
    const nextPath = [...path, node.name];
    return [
      {
        id: node.id,
        name: node.name,
        path: nextPath.join(" / "),
        description: node.description,
        template: node.template,
      },
      ...flattenGenreOptions(node.children, nextPath),
    ];
  });
}

function flattenStoryModeOptions(nodes: StoryModeTreeNode[], path: string[] = []): FlattenedStoryModeOption[] {
  return nodes.flatMap((node) => {
    const nextPath = [...path, node.name];
    return [
      {
        id: node.id,
        name: node.name,
        path: nextPath.join(" / "),
        description: node.description,
        template: node.template,
        profile: node.profile,
      },
      ...flattenStoryModeOptions(node.children, nextPath),
    ];
  });
}

function buildGenreCatalogText(options: FlattenedGenreOption[]): string {
  return options.map((option, index) => [
    `Número de serie del candidato (solo se utiliza para posicionamiento):${index + 1}`,
    `ID (debe devolverse sin cambios después de la selección):${option.id}`,
    `camino:${option.path}`,
    option.description ? `ilustrar:${option.description}` : "",
    option.template ? `Tendencia de uso:${option.template}` : "",
  ].filter(Boolean).join("\n")).join("\n\n");
}

function buildStoryModeCatalogText(options: FlattenedStoryModeOption[]): string {
  return options.map((option, index) => [
    `Número de serie del candidato (solo se utiliza para posicionamiento):${index + 1}`,
    `ID (debe devolverse sin cambios después de la selección):${option.id}`,
    `camino:${option.path}`,
    option.description ? `ilustrar:${option.description}` : "",
    `Controlador principal:${option.profile.coreDrive}`,
    `Recompensas del lector:${option.profile.readerReward}`,
    `Límite de conflicto:${option.profile.conflictCeiling}`,
    option.template ? `Plantilla complementaria:${option.template}` : "",
  ].filter(Boolean).join("\n")).join("\n\n");
}

function buildCurrentSelectionSummary(input: RecommendNovelCreateResourcesInput, options: {
  genres: FlattenedGenreOption[];
  storyModes: FlattenedStoryModeOption[];
}): string {
  const genre = options.genres.find((item) => item.id === input.genreId);
  const primaryStoryMode = options.storyModes.find((item) => item.id === input.primaryStoryModeId);
  const secondaryStoryMode = options.storyModes.find((item) => item.id === input.secondaryStoryModeId);

  return [
    genre ? `Base temática actualmente seleccionada:${genre.path}` : "",
    primaryStoryMode ? `El modo de propulsión principal está actualmente seleccionado:${primaryStoryMode.path}` : "",
    secondaryStoryMode ? `Modo de propulsión secundaria actualmente seleccionado:${secondaryStoryMode.path}` : "",
  ].filter(Boolean).join("\n");
}

function buildUserIntentSummary(
  input: RecommendNovelCreateResourcesInput,
  options: {
    genres: FlattenedGenreOption[];
    storyModes: FlattenedStoryModeOption[];
  },
): string {
  const bookFramingSummary = buildBookFramingSummary({
    targetAudience: input.targetAudience,
    bookSellingPoint: input.bookSellingPoint,
    competingFeel: input.competingFeel,
    first30ChapterPromise: input.first30ChapterPromise,
    commercialTags: input.commercialTags,
  });
  const currentSelectionSummary = buildCurrentSelectionSummary(input, options);

  return [
    input.title?.trim() ? `título:${input.title.trim()}` : "",
    input.marketBriefPrompt?.trim() ? `Informe del mercado del libro abierto: \\n${input.marketBriefPrompt.trim()}` : "",
    input.description?.trim() ? `Resumen de una frase:${truncateText(input.description, 260)}` : "",
    input.writingMode ? `Modo creativo:${input.writingMode}` : "",
    input.projectMode ? `Modo de proyecto:${input.projectMode}` : "",
    input.narrativePov ? `Perspectiva narrativa:${input.narrativePov}` : "",
    input.pacePreference ? `Preferencia de ritmo:${input.pacePreference}` : "",
    input.emotionIntensity ? `Concentración emocional:${input.emotionIntensity}` : "",
    input.aiFreedom ? `Grados de libertad de la IA:${input.aiFreedom}` : "",
    input.powerSystemPreference ? `Preferencia del sistema de energía de combate:${input.powerSystemPreference}` : "",
    input.styleTone?.trim() ? `Palabras clave para el estilo de escritura:${input.styleTone.trim()}` : "",
    bookFramingSummary ? `Encuadre a nivel de libro: \\n${bookFramingSummary}` : "",
    currentSelectionSummary ? `Selección manual actual: \\n${currentSelectionSummary}` : "",
  ].filter(Boolean).join("\n");
}

export class NovelCreateResourceRecommendationService {
  private readonly genreService = new GenreService();

  private readonly storyModeService = new StoryModeService();

  private async loadOptions(): Promise<{
    genres: FlattenedGenreOption[];
    storyModes: FlattenedStoryModeOption[];
  }> {
    await ensureSystemResourceStarterData();

    const [genreTree, storyModeTree] = await Promise.all([
      this.genreService.listGenreTree(),
      this.storyModeService.listStoryModeTree(),
    ]);
    const genres = flattenGenreOptions(genreTree);
    const storyModes = flattenStoryModeOptions(storyModeTree);
    if (genres.length === 0 || storyModes.length === 0) {
      throw new Error("Los recursos integrados del sistema aún no están listos y el tema base y el modo avanzado no se pueden recomendar en este momento.");
    }
    return { genres, storyModes };
  }

  private async recommendFromOptions(
    input: RecommendNovelCreateResourcesInput,
    options: { genres: FlattenedGenreOption[]; storyModes: FlattenedStoryModeOption[] },
  ): Promise<NovelCreateResourceRecommendation> {
    const result = await runStructuredPrompt({
      asset: novelCreateResourceRecommendationPrompt,
      promptInput: {
        userIntentSummary: buildUserIntentSummary(input, options),
        powerSystemPreference: input.powerSystemPreference ?? "ai_recommend",
        genreCatalogText: buildGenreCatalogText(options.genres),
        storyModeCatalogText: buildStoryModeCatalogText(options.storyModes),
        allowedGenreIds: options.genres.map((item) => item.id),
        allowedStoryModeIds: options.storyModes.map((item) => item.id),
        genreCatalogOptions: options.genres.map((item) => ({
          id: item.id,
          name: item.name,
          path: item.path,
        })),
        storyModeCatalogOptions: options.storyModes.map((item) => ({
          id: item.id,
          name: item.name,
          path: item.path,
        })),
      },
      options: {
        provider: input.provider,
        model: input.model,
        temperature: Math.min(input.temperature ?? 0.3, 0.5),
      },
    });

    const parsed = result.output;
    const genre = options.genres.find((item) => item.id === parsed.genreId);
    const primaryStoryMode = options.storyModes.find((item) => item.id === parsed.primaryStoryModeId);
    const secondaryStoryMode = parsed.secondaryStoryModeId
      ? options.storyModes.find((item) => item.id === parsed.secondaryStoryModeId)
      : null;

    if (!genre || !primaryStoryMode) {
      throw new Error("AI ha devuelto un resultado de recomendación, pero el elemento correspondiente no se puede encontrar en la biblioteca actual.");
    }

    return {
      summary: parsed.summary,
      genre: {
        id: genre.id,
        name: genre.name,
        path: genre.path,
        reason: parsed.genreReason,
      },
      primaryStoryMode: {
        id: primaryStoryMode.id,
        name: primaryStoryMode.name,
        path: primaryStoryMode.path,
        reason: parsed.primaryStoryModeReason,
      },
      secondaryStoryMode: secondaryStoryMode
        ? {
          id: secondaryStoryMode.id,
          name: secondaryStoryMode.name,
          path: secondaryStoryMode.path,
          reason: parsed.secondaryStoryModeReason?.trim() || "Recompensas de sabor y lector para complementar el modo push principal.",
        }
        : null,
      powerSystem: {
        mode: input.powerSystemPreference && input.powerSystemPreference !== "ai_recommend"
          ? input.powerSystemPreference
          : parsed.powerSystemMode,
        reason: input.powerSystemPreference && input.powerSystemPreference !== "ai_recommend"
          ? "Mantenga la configuración del sistema de energía de combate que confirmó."
          : parsed.powerSystemReason,
        source: input.powerSystemPreference && input.powerSystemPreference !== "ai_recommend"
          ? "user_selected"
          : "ai_recommended",
      },
      caution: parsed.caution?.trim() || null,
      recommendedAt: new Date().toISOString(),
    };
  }

  async recommend(input: RecommendNovelCreateResourcesInput): Promise<NovelCreateResourceRecommendation> {
    const options = await this.loadOptions();
    return this.recommendFromOptions(input, options);
  }

  async resolveRequired(input: RecommendNovelCreateResourcesInput): Promise<ResolvedNovelProductionFoundation> {
    const options = await this.loadOptions();
    const selectedGenre = input.genreId?.trim()
      ? options.genres.find((item) => item.id === input.genreId?.trim())
      : null;
    const selectedPrimary = input.primaryStoryModeId?.trim()
      ? options.storyModes.find((item) => item.id === input.primaryStoryModeId?.trim())
      : null;
    const selectedSecondary = input.secondaryStoryModeId?.trim()
      ? options.storyModes.find((item) => item.id === input.secondaryStoryModeId?.trim())
      : null;

    if (input.genreId?.trim() && !selectedGenre) {
      throw new Error("La base temática actualmente seleccionada ya no está disponible. Elija nuevamente o deje que AI lo recomiende.");
    }
    if (input.primaryStoryModeId?.trim() && !selectedPrimary) {
      throw new Error("El modo de propulsión principal seleccionado actualmente ya no está disponible. Vuelva a elegirlo o deje que AI lo recomiende.");
    }
    if (input.secondaryStoryModeId?.trim() && !selectedSecondary) {
      throw new Error("El modo de propulsión secundaria seleccionado actualmente ya no está disponible; selecciónelo nuevamente.");
    }
    if (selectedPrimary && selectedSecondary && selectedPrimary.id === selectedSecondary.id) {
      throw new Error("El modo de propulsión principal y el modo de propulsión auxiliar no pueden ser iguales.");
    }

    const powerSystemPreference = input.powerSystemPreference ?? "ai_recommend";
    const aiRecommendation = selectedGenre && selectedPrimary && selectedSecondary && powerSystemPreference !== "ai_recommend"
      ? null
      : await this.recommendFromOptions(input, options);
    const genre = selectedGenre
      ?? options.genres.find((item) => item.id === aiRecommendation?.genre.id);
    const primary = selectedPrimary
      ?? options.storyModes.find((item) => item.id === aiRecommendation?.primaryStoryMode.id);
    const secondary = selectedSecondary
      ?? (!input.secondaryStoryModeId && aiRecommendation?.secondaryStoryMode
        ? options.storyModes.find((item) => (
          item.id === aiRecommendation.secondaryStoryMode?.id
          && item.id !== primary?.id
        ))
        : null);

    if (!genre || !primary) {
      throw new Error("La IA no pudo determinar la base temática disponible ni el modo de propulsión principal. Inténtelo de nuevo.");
    }
    if (secondary?.id === primary.id) {
      throw new Error("El modo de propulsión secundario recomendado por la IA es el mismo que el modo de propulsión principal. Por favor inténtalo de nuevo.");
    }

    const recommendation: NovelCreateResourceRecommendation = {
      summary: aiRecommendation?.summary
        ?? `Este libro se basará en "${genre.path}" como tema base y presione "${primary.path}"Seguir avanzando.`,
      genre: {
        id: genre.id,
        name: genre.name,
        path: genre.path,
        source: selectedGenre ? "user_selected" : "ai_recommended",
        reason: aiRecommendation?.genre.id === genre.id
          ? aiRecommendation.genre.reason
          : "Cíñete a la base temática que identificaste.",
      },
      primaryStoryMode: {
        id: primary.id,
        name: primary.name,
        path: primary.path,
        source: selectedPrimary ? "user_selected" : "ai_recommended",
        reason: aiRecommendation?.primaryStoryMode.id === primary.id
          ? aiRecommendation.primaryStoryMode.reason
          : "Utilice el modo de propulsión principal que confirmó.",
      },
      secondaryStoryMode: secondary
        ? {
          id: secondary.id,
          name: secondary.name,
          path: secondary.path,
          source: selectedSecondary ? "user_selected" : "ai_recommended",
          reason: aiRecommendation?.secondaryStoryMode?.id === secondary.id
            ? aiRecommendation.secondaryStoryMode.reason
            : "Utilice el modo de propulsión auxiliar que confirmó.",
        }
        : null,
      powerSystem: aiRecommendation?.powerSystem ?? {
        mode: powerSystemPreference === "ai_recommend" ? "none" : powerSystemPreference,
        reason: powerSystemPreference === "ai_recommend"
          ? "Actualmente no hay información suficiente para respaldar el establecimiento de un sistema de poder de combate, por lo que se considerará como si no se hubiera establecido."
          : "Mantenga la configuración del sistema de energía de combate que confirmó.",
        source: powerSystemPreference === "ai_recommend" ? "ai_recommended" : "user_selected",
      },
      caution: aiRecommendation?.caution ?? null,
      recommendedAt: new Date().toISOString(),
    };
    const storyModeBlock = buildStoryModePromptBlock({
      primary,
      secondary: secondary ?? null,
    });
    return {
      genreId: genre.id,
      primaryStoryModeId: primary.id,
      secondaryStoryModeId: secondary?.id,
      recommendation,
      promptBlock: [
        `Base temática:${genre.path}`,
        genre.description ? `Posicionamiento del tema:${genre.description}` : "",
        genre.template ? `Tendencia de uso del tema:${genre.template}` : "",
        storyModeBlock,
        `Modo de sistema de energía de combate:${recommendation.powerSystem?.mode ?? "none"}`,
        recommendation.powerSystem?.reason ? `Descripción del sistema de energía de combate:${recommendation.powerSystem.reason}` : "",
      ].filter(Boolean).join("\n\n"),
    };
  }
}

export const novelCreateResourceRecommendationService = new NovelCreateResourceRecommendationService();
