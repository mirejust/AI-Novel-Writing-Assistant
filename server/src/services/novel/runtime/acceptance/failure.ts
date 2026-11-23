import { StructuredOutputError } from "../../../../llm/structuredOutput";
import { ChapterRepairVerificationError, ChapterStyleReviewValidationError, ChapterContinuityReviewValidationError } from "../../../../prompting/prompts/novel/acceptance";

/** Persist safe, actionable diagnostics; provider responses and credentials stay out of reports. */
export function describeAcceptanceFailure(error: unknown): { code: string; message: string } {
  if (error instanceof ChapterContinuityReviewValidationError) {
    return {code:"continuity_review_evidence_invalid", message:error.message};
  }
  if (error instanceof ChapterStyleReviewValidationError) {
    return { code: `style_review_${error.code}`, message: error.message };
  }
  if (error instanceof ChapterRepairVerificationError) {
    return { code: "repair_review_evidence_invalid", message: "Si la identidad del texto, la evidencia o la verificación punto por punto del artículo revisado no supera el reexamen, se conservará el manuscrito original para su revisión." };
  }
  if (error instanceof StructuredOutputError) {
    return { code: `acceptance_${error.category}`, message: error.category === "transport_error"
      ? "La conexión del modelo no está completa y no hay resultados disponibles de la verificación del capítulo."
      : ["empty_response", "reasoning_budget_exhausted", "output_budget_exhausted"].includes(error.category)
        ? error.message
        : "El formato de los resultados de la verificación devueltos por el modelo no cumple con los requisitos y la verificación del capítulo no se completa." };
  }
  if (error && typeof error === "object" && "promptQualityFailureKind" in error
    && error.promptQualityFailureKind === "post_validate_failed") {
    return { code: "acceptance_result_invalid", message: "El resultado de la verificación del modelo no pasa la verificación entre el texto y el contrato y no puede considerarse una conclusión aprobada." };
  }
  return { code: "acceptance_invocation_failed", message: "La llamada de verificación del capítulo no se ha completado, conserve el texto y revíselo nuevamente desde la página del capítulo." };
}
