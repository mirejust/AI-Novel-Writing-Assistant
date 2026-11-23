import {
  type BookFramingSuggestion,
  type BookFramingSuggestionInput,
} from "@ai-novel/shared/types/novelFraming";
import { runStructuredPrompt } from "../../prompting/core/promptRunner";
import { novelFramingSuggestionPrompt } from "../../prompting/prompts/novel/framing.prompts";
import { novelReferenceService } from "./NovelReferenceService";

function buildInputSummary(input: BookFramingSuggestionInput): string {
  return [
    input.title?.trim() ? `Título del libro:${input.title.trim()}` : "",
    input.description?.trim() ? `Resumen de una frase:${input.description.trim()}` : "",
    input.genreLabel?.trim() ? `Tipo de trabajo:${input.genreLabel.trim()}` : "",
    input.styleTone?.trim() ? `Palabras clave del estilo de escritura actual:${input.styleTone.trim()}` : "",
    input.referenceIntent === "continuation"
      ? "Intención creativa: para continuar con el trabajo original, los lectores y los puntos de venta deben heredar las pistas inacabadas del trabajo original y el estado final del personaje."
      : input.referenceIntent === "adaptation"
        ? "Intención creativa: Crear un nuevo libro basado en el libro, heredando solo la estructura, el ritmo y la experiencia de lectura, y debe formar una historia independiente."
        : "",
  ].filter(Boolean).join("\n");
}

export class NovelFramingSuggestionService {
  async suggest(input: BookFramingSuggestionInput): Promise<BookFramingSuggestion> {
    if (!input.title?.trim() && !input.description?.trim() && !input.bookAnalysisId?.trim()) {
      throw new Error("Complete al menos el título del libro o un resumen de una oración y luego deje que AI lo complete por usted.");
    }

    const referenceIntent = input.referenceIntent
      ?? (input.bookAnalysisId?.trim() ? "adaptation" : undefined);
    const analysisContext = input.bookAnalysisId?.trim() && referenceIntent
      ? await novelReferenceService.buildFramingReferenceFromAnalysisId(
        input.bookAnalysisId.trim(),
        referenceIntent,
        input.bookAnalysisSections,
      )
      : "";

    if (input.bookAnalysisId?.trim() && !analysisContext.trim()) {
      throw new Error("La conclusión encuadernada que abre el libro no se puede leer por el momento. Confirme que la apertura del libro se haya completado y contenga una conclusión legible.");
    }

    const inputSummary = buildInputSummary(input);
    const result = await runStructuredPrompt({
      asset: novelFramingSuggestionPrompt,
      promptInput: {
        inputSummary,
        analysisContext: analysisContext.trim() || undefined,
        referenceIntent,
      },
      options: {
        provider: input.provider,
        model: input.model,
        temperature: Math.min(input.temperature ?? 0.5, 0.8),
      },
    });
    return result.output;
  }
}

export const novelFramingSuggestionService = new NovelFramingSuggestionService();
