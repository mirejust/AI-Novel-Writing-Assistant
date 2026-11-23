import type { DirectorIdeaContextRequest } from "@ai-novel/shared/types/novelDirector";
import { StructuredOutputError } from "../../../../llm/structuredOutput";
import { buildBookFramingSummary } from "../../bookFraming";

function compactText(value: string | null | undefined): string {
  return value?.replace(/\s+/g, " ").trim() ?? "";
}

function line(label: string, value: string | null | undefined): string {
  const text = compactText(value);
  return text ? `${label}:${text}` : "";
}

function readerChannelPreferenceLabel(value: DirectorIdeaContextRequest["readerChannelPreference"]): string {
  switch (value) {
    case "ai_judge":
      return "juicio de IA";
    case "male_oriented":
      return "frecuencia masculina";
    case "female_oriented":
      return "Frecuencia femenina";
    case "general":
      return "Lector general/ilimitado";
    default:
      return "";
  }
}

export function buildDirectorIdeaContextSummary(input: DirectorIdeaContextRequest, marketBriefPrompt = ""): string {
  const framing = buildBookFramingSummary({
    targetAudience: input.targetAudience,
    bookSellingPoint: input.bookSellingPoint,
    competingFeel: input.competingFeel,
    first30ChapterPromise: input.first30ChapterPromise,
    commercialTags: input.commercialTags,
  });
  return [
    line("Borrador del cuadro de entrada actual", input.currentIdea),
    line("Título provisional", input.title),
    line("Ya delineado", input.description),
    line("Base temática", input.genreLabel ?? input.genreId),
    line("Descripción del tema", input.genreDescription),
    line("modo de propulsión principal", input.primaryStoryModeLabel ?? input.primaryStoryModeId),
    line("Descripción del empuje principal", input.primaryStoryModeDescription),
    line("Modo de propulsión secundaria", input.secondaryStoryModeLabel ?? input.secondaryStoryModeId),
    line("Descripción de propulsión adjunta", input.secondaryStoryModeDescription),
    line("visión del mundo", input.worldName ?? input.worldId),
    marketBriefPrompt.trim() ? `Informe del mercado del libro abierto: \\n${marketBriefPrompt.trim()}` : "",
    line("Tendencias del canal de lectores", readerChannelPreferenceLabel(input.readerChannelPreference)),
    input.powerSystemPreference ? `Preferencia del sistema de energía de combate:${input.powerSystemPreference}` : "",
    input.narrativePov ? `Perspectiva narrativa:${input.narrativePov}` : "",
    input.pacePreference ? `Preferencia de ritmo:${input.pacePreference}` : "",
    input.emotionIntensity ? `Concentración emocional:${input.emotionIntensity}` : "",
    line("Palabras claves de estilo de escritura", input.styleTone),
    framing ? `Encuadre a nivel de libro: \\n${framing}` : "",
  ].filter(Boolean).join("\n");
}

export function shouldRetryDirectorIdeaWithOriginalContext(error: unknown): error is StructuredOutputError {
  return error instanceof StructuredOutputError && error.category !== "transport_error";
}
