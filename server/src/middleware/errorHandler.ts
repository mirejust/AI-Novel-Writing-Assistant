import type { NextFunction, Request, Response } from "express";
import type { ApiResponse } from "@ai-novel/shared/types/api";
import { ZodError, type ZodIssue } from "zod";
import {randomUUID} from "node:crypto";

export class AppError extends Error {
  readonly statusCode: number;
  readonly details?: unknown;

  constructor(message: string, statusCode = 500, details?: unknown) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.details = details;
  }
}

function joinErrorParts(parts: Array<string | undefined>): string {
  return parts.map((part) => part?.trim() ?? "").filter(Boolean).join(" | ");
}

const RESERVED_ERROR_KEYS = new Set(["success", "error", "message", "code", "requestId"]);
/** Only workflow-recovery fields already consumed by the client may join the public envelope. */
const PUBLIC_ERROR_DETAIL_KEYS = new Set(["runId", "pauseKind", "pause", "unknownClaims", "sourceRoute", "sourceActionLabel"]);

/** Only explicit structured details from an AppError may join the public envelope. */
function structuredErrorDetails(details: unknown): Record<string, unknown> {
  if (!details || typeof details !== "object" || Array.isArray(details)) {
    return {};
  }
  return Object.fromEntries(Object.entries(details)
    .filter(([key, value]) => PUBLIC_ERROR_DETAIL_KEYS.has(key) && !RESERVED_ERROR_KEYS.has(key) && value !== undefined));
}

const VALIDATION_FIELD_LABELS: Record<string, string> = {
  id: "ID del proyecto",
  field: "Campo",
  provider: "proveedor de modelos",
  model: "Modelo",
  temperature: "temperatura",
  storyInput: "Entrada de ideas para la historia",
  expansion: "Prototipo de motor de historia",
  decomposition: "Resumen de avance y entrega",
  constraints: "reglas narrativas",
  lockedFields: "Bloquear campo",
  state: "estado de la historia",
  expanded_premise: "premisa extendida",
  protagonist_core: "Núcleo protagonista",
  conflict_engine: "motor de conflicto",
  conflict_layers: "capa de conflicto",
  external: "opresión externa",
  internal: "colapso interno",
  relational: "estrés en la relación",
  mystery_box: "Núcleo desconocido",
  emotional_line: "línea de humor",
  setpiece_seeds: "semillas de escena de alta tensión",
  tone_reference: "Referencia de atmósfera",
  selling_point: "punto de venta",
  core_conflict: "Conflicto central",
  main_hook: "gancho principal",
  progression_loop: "ciclo de avance",
  growth_path: "camino de crecimiento",
  major_payoffs: "Puntos de canje clave",
  ending_flavor: "sabor final",
  currentPhase: "etapa actual",
  progress: "cronograma",
  protagonistState: "La situación actual del protagonista.",
};

function formatValidationPath(path: PropertyKey[]): string {
  return path
    .map((segment) => {
      if (typeof segment === "number") {
        return `Cap. ${segment + 1} artículo`;
      }
      if (typeof segment === "symbol") {
        return segment.toString();
      }
      return VALIDATION_FIELD_LABELS[segment] ?? segment;
    })
    .filter(Boolean)
    .join(" / ");
}

function formatZodIssueMessage(issue: ZodIssue): string {
  const issueRecord = issue as ZodIssue & Record<string, unknown>;
  const code = String(issue.code);
  const origin = typeof issueRecord.origin === "string" ? issueRecord.origin : undefined;

  switch (code) {
    case "invalid_type":
      if (issueRecord.input === undefined) {
        return "No puede estar vacío.";
      }
      if (issueRecord.expected === "string") {
        return "Debe ser texto.";
      }
      if (issueRecord.expected === "number") {
        return "Debe ser un número.";
      }
      if (issueRecord.expected === "boolean") {
        return "Debe ser un valor booleano.";
      }
      return issue.message || "Tipo incorrecto.";
    case "invalid_value":
      return issue.message || "El valor es ilegal.";
    case "too_small":
      if (origin === "array") {
        return `Al menos requerido ${issueRecord.minimum} artículo.`;
      }
      if (origin === "string") {
        return issueRecord.minimum === 1 ? "No puede estar vacío." : `Al menos ${issueRecord.minimum} personajes.`;
      }
      if (origin === "number") {
        return `no puede ser menor que ${issueRecord.minimum}.`;
      }
      return issue.message || "El contenido es demasiado corto.";
    case "too_big":
      if (origin === "array") {
        return `Sólo puedes completar como máximo ${issueRecord.maximum} artículo.`;
      }
      if (origin === "string") {
        return `no puede exceder ${issueRecord.maximum} personajes.`;
      }
      if (origin === "number") {
        return `no puede ser mayor que ${issueRecord.maximum}.`;
      }
      return issue.message || "El contenido es demasiado largo.";
    default:
      return issue.message || "El formato es incorrecto.";
  }
}

function formatValidationIssue(issue: ZodIssue): string {
  const path = formatValidationPath(issue.path);
  const message = formatZodIssueMessage(issue);
  return path ? `${path}:${message}` : message;
}

function setRequestErrorMessage(
  res: Response<ApiResponse<null>>,
  error: string,
  detail?: string,
): void {
  res.locals.requestErrorMessage = joinErrorParts([error, detail]);
}

function logServerError(req: Request, error: unknown): void {
  console.error(`[error] requestId=${req.res?.locals.requestId ?? "unavailable"} ${req.method} ${req.originalUrl}`, error);
}

function collectErrorMessages(error: unknown, depth = 0): string[] {
  if (!error || depth > 4) {
    return [];
  }
  if (error instanceof Error) {
    return [
      error.message,
      ...collectErrorMessages((error as Error & { cause?: unknown }).cause, depth + 1),
    ].filter(Boolean);
  }
  if (typeof error === "object") {
    const record = error as {
      message?: unknown;
      cause?: unknown;
    };
    return [
      typeof record.message === "string" ? record.message : "",
      ...collectErrorMessages(record.cause, depth + 1),
    ].filter(Boolean);
  }
  return [];
}

function findConnectionCause(error: unknown, depth = 0): {
  code?: string;
  host?: string;
  port?: number | string;
} | null {
  if (!error || depth > 6 || typeof error !== "object") {
    return null;
  }
  const record = error as {
    code?: unknown;
    host?: unknown;
    port?: unknown;
    cause?: unknown;
  };
  if (
    (typeof record.code === "string" && record.code.trim())
    || (typeof record.host === "string" && record.host.trim())
  ) {
    return {
      code: typeof record.code === "string" ? record.code : undefined,
      host: typeof record.host === "string" ? record.host : undefined,
      port: typeof record.port === "number" || typeof record.port === "string" ? record.port : undefined,
    };
  }
  return findConnectionCause(record.cause, depth + 1);
}

function formatUpstreamConnectionError(error: unknown): string | null {
  const joinedMessage = collectErrorMessages(error).join(" | ").trim();
  const isNetworkLike = /connection error|fetch failed|ECONNRESET|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|socket hang up|tls/i
    .test(joinedMessage);
  if (!isNetworkLike) {
    return null;
  }
  const cause = findConnectionCause(error);
  const target = cause?.host
    ? `${cause.host}${cause.port ? `:${cause.port}` : ""}`
    : "Servicio de modelo ascendente";
  const code = cause?.code ? `(${cause.code})` : "";
  return `Error en la conexión del servicio de modelo ascendente: el servidor actual no se puede conectar ${target}${code}. Verifique la conectividad de red con este proveedor o cambie a otro proveedor de modelo disponible.`;
}

export function errorHandler(
  error: unknown,
  req: Request,
  res: Response<ApiResponse<null>>,
  _next: NextFunction,
): void {
  const requestId = randomUUID();
  res.locals.requestId = requestId;
  res.setHeader?.("X-Request-Id", requestId);
  if (
    error
    && typeof error === "object"
    && "type" in error
    && (error as { type?: string }).type === "entity.too.large"
  ) {
    setRequestErrorMessage(res, "El cuerpo de la solicitud es demasiado grande; acorte el texto o cárguelo en partes.");
    res.status(413).json({
      success: false,
      error: "El cuerpo de la solicitud es demasiado grande; acorte el texto o cárguelo en partes.",
    });
    return;
  }

  if (error instanceof ZodError) {
    const detail = error.issues.map((issue) => formatValidationIssue(issue)).join(" ");
    setRequestErrorMessage(res, "Error en la verificación del parámetro de solicitud.", detail);
    res.status(400).json({
      success: false,
      error: "Error en la verificación del parámetro de solicitud.",
      message: detail,
    });
    return;
  }

  if (error instanceof AppError) {
    const detail = typeof error.details === "string" ? error.details : undefined;
    setRequestErrorMessage(res, error.message, detail);
    if (error.statusCode >= 500) {
      logServerError(req, error);
    }
    res.status(error.statusCode).json({
      success: false,
      error: error.message,
      message: detail,
      ...("code" in error && typeof error.code === "string" ? {code: error.code} : {}),
      ...structuredErrorDetails(error.details),
      requestId,
    });
    return;
  }

  const message = "Error del servidor, inténtalo de nuevo más tarde.";
  const upstreamConnectionMessage = formatUpstreamConnectionError(error);
  if (upstreamConnectionMessage) {
    setRequestErrorMessage(res, upstreamConnectionMessage);
    logServerError(req, error);
    res.status(502).json({
      success: false,
      error: upstreamConnectionMessage,
    });
    return;
  }

  setRequestErrorMessage(res, message);
  logServerError(req, error);
  res.status(500).json({
    success: false,
    error: message,
    requestId,
  });
}
