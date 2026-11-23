import {
  buildStyleIntentSummary,
  type StyleBinding,
  type StyleProfile,
} from "@ai-novel/shared/types/styleEngine";
import { buildReadableRuleSummary } from "./writingFormulaRulePresentation";
import { getStyleProfileOriginLabel, isStarterStyleProfile } from "./writingFormulaV2.shared";

export interface LandingProfileItem {
  id: string;
  name: string;
  originLabel: string;
  summaryLine: string;
  description: string;
  recentNovelTitle?: string | null;
  category?: string | null;
  tags: string[];
  applicableGenres: string[];
  narrativeSummary: string;
  characterSummary: string;
  languageSummary: string;
  rhythmSummary: string;
  antiAiFocus: string[];
  antiAiRuleNames: string[];
  sourceTypeLabel: string;
  sourceContentPreview?: string | null;
  extractedFeatureCount: number;
  highRiskFeatureCount: number;
  selectedPresetLabel?: string | null;
  presetLabels: string[];
  extractionAntiAiRecommendationCount: number;
  bindingCount: number;
  updatedAtLabel: string;
  isStarter: boolean;
}

interface BuildLandingProfileItemsParams {
  profiles: StyleProfile[];
  allBindings: StyleBinding[];
  novelTitleMap: Record<string, string>;
}

function compactText(value: unknown): string {
  if (typeof value !== "string") {
    return "";
  }

  return value.replace(/\s+/g, " ").trim();
}

function firstNonEmptyText(...values: unknown[]): string {
  for (const value of values) {
    const normalized = compactText(value);
    if (normalized) {
      return normalized;
    }
  }

  return "";
}

function formatSourceTypeLabel(sourceType: StyleProfile["sourceType"]): string {
  switch (sourceType) {
    case "manual":
      return "Clasificación manual";
    case "from_text":
      return "Extracto del texto";
    case "from_book_analysis":
      return "Generación de libros divididos";
    case "from_knowledge_document":
      return "Texto original de la base de conocimientos.";
    case "from_current_work":
      return "Resumen del trabajo actual";
    default:
      return "Otras fuentes";
  }
}

function formatUpdatedAtLabel(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value.slice(0, 10);
  }

  return new Intl.DateTimeFormat("zh-CN", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

function buildNarrativeSummary(profile: StyleProfile): string {
  return buildReadableRuleSummary("narrativeRules", profile.narrativeRules, "El resumen de la progresión de la trama aún no se ha aclarado.");
}

function buildCharacterSummary(profile: StyleProfile): string {
  return buildReadableRuleSummary("characterRules", profile.characterRules, "Aún no hay un resumen claro de la expresión del personaje.");
}

function buildLanguageSummary(profile: StyleProfile): string {
  return buildReadableRuleSummary("languageRules", profile.languageRules, "Aún no hay un resumen explícito de la textura del lenguaje.");
}

function buildRhythmSummary(profile: StyleProfile): string {
  return buildReadableRuleSummary("rhythmRules", profile.rhythmRules, "El resumen del control del ritmo aún no se ha aclarado.");
}

function buildSourceContentPreview(sourceContent?: string | null): string | null {
  const normalized = compactText(sourceContent);
  if (!normalized) {
    return null;
  }

  return normalized.length > 180 ? `${normalized.slice(0, 180)}...` : normalized;
}

export function buildLandingProfileItems(params: BuildLandingProfileItemsParams): LandingProfileItem[] {
  const { profiles, allBindings, novelTitleMap } = params;
  const recentNovelBindingsByProfileId = allBindings
    .filter((binding) => binding.targetType === "novel")
    .reduce<Map<string, StyleBinding>>((result, binding) => {
      const current = result.get(binding.styleProfileId);
      const bindingTimestamp = new Date(binding.updatedAt).getTime();
      const currentTimestamp = current ? new Date(current.updatedAt).getTime() : Number.NEGATIVE_INFINITY;

      if (!current || bindingTimestamp >= currentTimestamp) {
        result.set(binding.styleProfileId, binding);
      }

      return result;
    }, new Map<string, StyleBinding>());
  const bindingCountByProfileId = allBindings.reduce<Record<string, number>>((result, binding) => {
    result[binding.styleProfileId] = (result[binding.styleProfileId] ?? 0) + 1;
    return result;
  }, {});

  return [...profiles]
    .sort((left, right) => {
      const starterDelta = Number(isStarterStyleProfile(left)) - Number(isStarterStyleProfile(right));
      if (starterDelta !== 0) {
        return starterDelta;
      }
      return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();
    })
    .map((profile) => {
      const profileSummary = buildStyleIntentSummary({ styleProfile: profile });
      const description = firstNonEmptyText(
        profile.description,
        profileSummary?.readingFeel,
        "Si la posición del sentido de lectura no está completa, puede agregarla en la configuración de edición.",
      );
      const recentNovelBinding = recentNovelBindingsByProfileId.get(profile.id);
      const selectedPresetLabel = profile.selectedExtractionPresetKey
        ? (
          profile.extractionPresets.find((preset) => preset.key === profile.selectedExtractionPresetKey)?.label
          ?? profile.selectedExtractionPresetKey
        )
        : null;

      return {
        id: profile.id,
        name: profile.name,
        originLabel: getStyleProfileOriginLabel(profile),
        summaryLine: description,
        description,
        recentNovelTitle: recentNovelBinding
          ? (novelTitleMap[recentNovelBinding.targetId] ?? recentNovelBinding.targetId)
          : null,
        category: profile.category,
        tags: Array.from(new Set([...profile.tags, ...profile.applicableGenres].filter(Boolean))).slice(0, 6),
        applicableGenres: profile.applicableGenres.filter(Boolean),
        narrativeSummary: buildNarrativeSummary(profile),
        characterSummary: buildCharacterSummary(profile),
        languageSummary: buildLanguageSummary(profile),
        rhythmSummary: buildRhythmSummary(profile),
        antiAiFocus: profileSummary?.antiAiFocus ?? [],
        antiAiRuleNames: profile.antiAiRules.map((rule) => rule.name).slice(0, 6),
        sourceTypeLabel: formatSourceTypeLabel(profile.sourceType),
        sourceContentPreview: buildSourceContentPreview(profile.sourceContent),
        extractedFeatureCount: profile.extractedFeatures.filter((feature) => feature.enabled).length,
        highRiskFeatureCount: profile.extractedFeatures.filter((feature) => feature.fingerprintRisk >= 0.7).length,
        selectedPresetLabel,
        presetLabels: profile.extractionPresets.map((preset) => preset.label).slice(0, 3),
        extractionAntiAiRecommendationCount: profile.extractionAntiAiRuleKeys.length,
        bindingCount: bindingCountByProfileId[profile.id] ?? 0,
        updatedAtLabel: formatUpdatedAtLabel(profile.updatedAt),
        isStarter: isStarterStyleProfile(profile),
      };
    });
}
