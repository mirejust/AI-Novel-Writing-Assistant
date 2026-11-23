/** Translated by composition adapters only for a known unavailable projection dependency. */
export class DirectorProjectionUnavailableError extends Error {
  readonly statusCode = 503;
  readonly code = "director_projection_unavailable";
  constructor(readonly reasonCode = "production_storage_not_ready") {
    super("El almacenamiento de ejecución de texto aún no está listo; verifique la estructura de la base de datos e inténtelo nuevamente.");
    this.name = "DirectorProjectionUnavailableError";
  }
}

const PUBLIC_FAILURES: Readonly<Record<string, {code: string; message: string}>> = {
  "模型缺少明确的上下文窗口配置。": {code: "kernel_model_window_missing", message: "El modelo carece de configuración de ventana de contexto explícita; complétela antes de continuar."},
};
const WINDOW_MISSING_PREFIX = "El modelo carece de configuración de ventana de contexto explícita";

/** The window-missing message may append the exact provider/model, so match only that stable prefix. */
function knownPublicFailure(message: string) {
  if (Object.hasOwn(PUBLIC_FAILURES, message)) return PUBLIC_FAILURES[message];
  if (message.startsWith(WINDOW_MISSING_PREFIX)) return PUBLIC_FAILURES["El modelo carece de configuración de ventana de contexto explícita."];
  return null;
}

/** Old persisted errors lack a code. Only explicitly known messages may cross the API boundary. */
export function publicRuntimeFailure(payload: unknown): {code: string; message: string; stepId: string | null} {
  const value = payload && typeof payload === "object" ? payload as Record<string, unknown> : {};
  const known = typeof value.message === "string" ? knownPublicFailure(value.message) : null;
  return {...known ?? {code: "director_execution_failed", message: "La ejecución de la creación se interrumpe; verifique el registro de operación del servidor."},
    stepId: typeof value.stepId === "string" && /^[a-z][a-z0-9_]{0,79}$/.test(value.stepId) ? value.stepId : null};
}
