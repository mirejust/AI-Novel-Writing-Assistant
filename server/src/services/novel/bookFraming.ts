import { parseCommercialTagsJson } from "@ai-novel/shared/types/novelFraming";

interface BookFramingSource {
  targetAudience?: string | null;
  bookSellingPoint?: string | null;
  competingFeel?: string | null;
  first30ChapterPromise?: string | null;
  commercialTags?: string[] | null;
  commercialTagsJson?: string | null;
}

export function resolveCommercialTags(source: BookFramingSource): string[] {
  if (Array.isArray(source.commercialTags)) {
    return source.commercialTags.filter((item) => typeof item === "string" && item.trim().length > 0);
  }
  return parseCommercialTagsJson(source.commercialTagsJson);
}

export function buildBookFramingSummary(source: BookFramingSource): string {
  const commercialTags = resolveCommercialTags(source);
  return [
    source.targetAudience?.trim() ? `Lectores objetivo:${source.targetAudience.trim()}` : "",
    commercialTags.length > 0 ? `Etiquetas comerciales principales:${commercialTags.join(",")}` : "",
    source.bookSellingPoint?.trim() ? `Los principales puntos de venta de este libro:${source.bookSellingPoint.trim()}` : "",
    source.competingFeel?.trim() ? `Sentido del producto competitivo/sentido de lectura familiar:${source.competingFeel.trim()}` : "",
    source.first30ChapterPromise?.trim() ? `Los primeros 30 capítulos prometen:${source.first30ChapterPromise.trim()}` : "",
  ].filter(Boolean).join("\n");
}
