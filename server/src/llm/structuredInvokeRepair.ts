import { observeInvocationParse } from "./compatibility";
import { beginStructuredDiagnostic, finishStructuredDiagnostic, type StructuredDiagnosticContext } from "../platform/llm/diagnostics/StructuredDiagnosticStore";
import { emptyResponseEvidence, observeStructuredChunk, classifyResponseEvidence, terminalResponseReason } from "../platform/llm/diagnostics/structuredEvidence";
import { describeStructuredResponseFailure, StructuredOutputError, resolveStructuredOutputProfile } from "./structuredOutput";
import { ReasoningStreamCollector } from "./reasoning";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { toJSONSchema, type ZodError, type ZodType } from "zod";
import type { LLMProvider } from "@ai-novel/shared/types/llm";
import type { ModelRouteRequestProtocol } from "@ai-novel/shared/types/novel";
import { getLLM, getResolvedLLMClientOptionsFromInstance } from "./factory";
import { runWithEnforcedTimeout } from "./invokeTimeout";
import { logStructuredRepairSession } from "./repairLogging";
import type { TaskType } from "./modelRouter";
import type { StructuredOutputStrategy } from "./structuredOutput";
import { toText } from "../services/novel/novelP0Utils";
import type { PromptInvocationMeta } from "../prompting/core/promptTypes";
import { claimModelRequest } from "../platform/llm/retries";

export interface StructuredRepairInput<T> {
  diagnosticContext?: StructuredDiagnosticContext;
  provider?: LLMProvider;
  model?: string;
  apiKey?: string;
  baseURL?: string;
  maxTokens?: number;
  timeoutMs?: number;
  signal?: AbortSignal;
  taskType?: TaskType;
  requestProtocol?: ModelRouteRequestProtocol;
  label: string;
  schema: ZodType<T>;
  repairGuidance?: string;
  promptMeta?: PromptInvocationMeta;
  onRepairOutputDelta?: (content: string) => void;
  repairMessages?: import("@langchain/core/messages").BaseMessage[];
}

interface ArrayLengthRepairHint {
  path: Array<string | number>;
  exactLength: number;
  direction: "expand" | "trim";
}

interface RepairHelpers<T> {
  tryParseStructuredJsonValue: (source: string) => { parsed: unknown } | { error: string };
  tryUnwrapSingletonArrayWrapper: (parsed: unknown, schema: ZodType<T>) => { data: T } | null;
  normalizeOversizedArrays: (
    parsed: unknown,
    error: ZodError,
    schema: ZodType<T>,
  ) => { data: T; trimmedPaths: string[] } | null;
  formatZodErrors: (error: ZodError) => string;
  logStructuredInvokeEvent: (input: {
    event: string;
    label: string;
    provider?: LLMProvider;
    model?: string;
    taskType?: TaskType;
    latencyMs?: number;
    rawChars?: number;
    repairAttempt?: number;
    strategy?: StructuredOutputStrategy;
  }) => void;
}

const MAX_REPAIR_SOURCE_CHARS = 12_000;

function buildRepairSchemaContract<T>(schema: ZodType<T>): string {
  try {
    return JSON.stringify(toJSONSchema(schema), null, 2);
  } catch {
    return "El esquema de destino no se puede serializar; aún debe completarse estrictamente de acuerdo con la ruta del campo en el error de verificación.";
  }
}

function compactRepairSource(rawContent: string): string {
  if (rawContent.length <= MAX_REPAIR_SOURCE_CHARS) {
    return rawContent;
  }
  const head = rawContent.slice(0, 9_000);
  const tail = rawContent.slice(-2_000);
  return [
    head,
    "\\n...[El contenido anormal, repetitivo o degradado en el medio se ha omitido y no se puede repetir ni continuar]...\\n",
    tail,
  ].join("");
}

function extractValidationPaths(validationError: string): string[] {
  return Array.from(
    new Set(
      validationError
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line.startsWith("- "))
        .map((line) => {
          const colonIndex = line.indexOf(":");
          return colonIndex > 2 ? line.slice(2, colonIndex).trim() : "";
        })
        .filter(Boolean),
    ),
  );
}

function parseIssuePath(pathText: string): Array<string | number> {
  if (!pathText || pathText === "(root)") {
    return [];
  }
  return pathText.split(".").map((segment) => (/^\d+$/.test(segment) ? Number(segment) : segment));
}

function formatIssuePath(path: Array<string | number>): string {
  return path.length > 0 ? path.join(".") : "(root)";
}

function extractArrayLengthRepairHints(validationError: string): ArrayLengthRepairHint[] {
  const hints: ArrayLengthRepairHint[] = [];
  const seen = new Set<string>();

  for (const rawLine of validationError.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line.startsWith("- ")) {
      continue;
    }
    const colonIndex = line.indexOf(":");
    if (colonIndex <= 2) {
      continue;
    }
    const pathText = line.slice(2, colonIndex).trim();
    const message = line.slice(colonIndex + 1).trim();
    const tooBig = message.match(/Too big: expected array to have <=(\d+) items/i);
    const tooSmall = message.match(/Too small: expected array to have >=(\d+) items/i);
    const match = tooBig ?? tooSmall;
    if (!match) {
      continue;
    }

    const exactLength = Number(match[1]);
    if (!Number.isInteger(exactLength) || exactLength < 0) {
      continue;
    }

    const path = parseIssuePath(pathText);
    const direction: ArrayLengthRepairHint["direction"] = tooBig ? "trim" : "expand";
    const key = `${direction}:${formatIssuePath(path)}:${exactLength}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    hints.push({
      path,
      exactLength,
      direction,
    });
  }

  return hints;
}

export function repairWithLlm<T>(input: StructuredRepairInput<T>, rawContent: string, validationError: string, repairAttempt: number, helpers: RepairHelpers<T>): Promise<T> {
  return observeInvocationParse(() => repairWithLlmInScope(input, rawContent, validationError, repairAttempt, helpers), value => value);
}

async function repairWithLlmInScope<T>(
  input: StructuredRepairInput<T>,
  rawContent: string,
  validationError: string,
  repairAttempt: number,
  helpers: RepairHelpers<T>,
): Promise<T> {
  helpers.logStructuredInvokeEvent({
    event: "repair_start",
    label: input.label,
    provider: input.provider,
    model: input.model,
    taskType: input.taskType,
    repairAttempt,
    strategy: "prompt_json",
  });
  const llm = await getLLM(input.provider, {
    fallbackProvider: "deepseek",
    apiKey: input.apiKey,
    baseURL: input.baseURL,
    model: input.model,
    temperature: 0.15,
    maxTokens: input.maxTokens,
    timeoutMs: input.timeoutMs,
    taskType: input.taskType ?? "planner",
    requestProtocol: input.requestProtocol,
    promptMeta: input.promptMeta ? {
      ...input.promptMeta,
      repairUsed: true,
      repairAttempts: repairAttempt,
    } : undefined,
    executionMode: "structured",
    structuredStrategy: "prompt_json",
  });

  const repairSystem = [
    "Eres un reparador de JSON.",
    "Su tarea es generar únicamente valores JSON estrictamente legales que deben pasar la validación de estructura dada.",
    "El resultado final puede ser un objeto JSON o una matriz JSON; debe ser coherente con la estructura objetivo.",
    "No envíe explicaciones, Markdown ni campos adicionales.",
    "Si un error de verificación indica que falta un campo, debe utilizar directamente el nombre del campo en la ruta del error como nombre de clave JSON y no traducirlo a un alias chino.",
    "Si el nivel superior de la estructura de destino es una matriz, genere directamente la matriz sin subcontratar una capa adicional de objetos.",
    "Si se requiere que un campo sea una matriz, se debe generar como una matriz JSON; incluso si solo hay un elemento, no se puede comprimir en una cadena, número u objeto.",
    "Si los elementos de la matriz deben ser objetos, se debe generar la matriz de objetos, como [{...}]; no se puede escribir como una cadena concatenada por comas.",
    "Si el JSON original contiene una capa adicional de claves de empaquetado irrelevantes, como datos, resultado, salida, xxxProjection, xxxList, etc., se debe eliminar la capa de empaquetado y la estructura de destino real debe elevarse al nivel superior.",
    "Si falta un campo de cadena obligatorio, se debe completar una cadena que no esté vacía; Se puede realizar una finalización mínima, conservadora y semánticamente consistente en función del contenido existente en el JSON original, y no se pueden generar cadenas vacías, nulas o indefinidas.",
    "Si el error de verificación es una cadena esperada, número recibido/booleano, la semántica del valor original se debe conservar y cambiar a una cadena JSON, por ejemplo, 19 se cambia a \\\"19\\\", verdadero se cambia a \\\"true\\\" y el campo no se debe eliminar.",
    "Si el error de verificación indica que el número de una matriz es demasiado grande o demasiado pequeño, la longitud de la matriz de la ruta debe corregirse al número exacto requerido en el error y no puede permanecer cerca del número correcto.",
    "El esquema JSON de destino es el contrato de campo final; Incluso si la salida original está truncada, degradada o faltan una gran cantidad de campos, el objeto completo debe reconstruirse a partir del esquema.",
    "Cuando se encuentren relecturas sin sentido, caracteres confusos o textos largos fuera de control, los párrafos anormales se descartarán y se reconstruirán con el contenido semánticamente más breve y coherente. Está prohibido seguir contando el contenido dañado.",
    "Todas las cadenas se mantienen concisas y conservan solo la información necesaria para pasar la verificación de la estructura y restaurar el significado original.",
    input.repairGuidance?.trim() ? `Reglas de reparación adicionales para esta estructura objetivo:${input.repairGuidance.trim()}` : "",
  ].join("\n");

  const validationPaths = extractValidationPaths(validationError);
  const arrayLengthHints = extractArrayLengthRepairHints(validationError);
  const repairSchemaContract = buildRepairSchemaContract(input.schema);
  const repairSource = compactRepairSource(rawContent);

  const repairHuman = [
    `La verificación falló:${input.label}`,
    validationError,
    ...(validationPaths.length > 0 ? [
      "",
      `Al menos es necesario arreglar estos caminos:${validationPaths.join(", ")}`,
    ] : []),
    ...(arrayLengthHints.length > 0 ? [
      "",
      "Restricciones estrictas de longitud de la matriz:",
      ...arrayLengthHints.map((hint) => hint.direction === "trim"
        ? `- ${formatIssuePath(hint.path)} en última instancia debe conservarse exactamente ${hint.exactLength} elementos; Si el número actual excede este número, los artículos sobrantes se cortarán en el pedido original.`
        : `- ${formatIssuePath(hint.path)} eventualmente debe complementarse a la perfección ${hint.exactLength} elementos; Si actualmente no hay artículos suficientes, mantenga los artículos existentes en el orden original y complete los artículos que faltan.`),
    ] : []),
    "",
    "Esquema JSON de destino (los nombres de campo, los tipos, los campos obligatorios y las restricciones de longitud están sujetos a esto):",
    repairSchemaContract,
    "",
    "Salida del modelo sin procesar (puede contener texto adicional, rebajas o truncamiento):",
    repairSource,
    "",
    "Corríjalo para generar solo el JSON final.",
  ].join("\n");

  logStructuredRepairSession({
    event: "repair_start",
    label: input.label,
    repairAttempt,
    provider: input.provider,
    model: input.model,
    taskType: input.taskType,
    promptMeta: input.promptMeta,
    validationError,
    schemaPaths: validationPaths,
    repairSystem,
    repairHuman,
  });

  const startedAt = Date.now();
  const resolved = getResolvedLLMClientOptionsFromInstance(llm);
  const evidence = emptyResponseEvidence(resolved?.maxTokens ?? input.maxTokens, resolved?.budgetTrace);
  let diagnosticId: string | null = null;
  let completed = false;
  let category = "transport_error";
  try {
    const invokeOptions: Record<string, unknown> = {};
    if (input.signal) {
      invokeOptions.signal = input.signal;
    }
    diagnosticId = await beginStructuredDiagnostic({ meta: input.promptMeta, context: input.diagnosticContext,
      kind: "repair", provider: input.provider, model: input.model, requestProtocol: input.requestProtocol,
      strategy: "prompt_json", response: evidence });
    const repairedRaw = await runWithEnforcedTimeout({
      label: `${input.label}#repair-${repairAttempt}`,
      timeoutMs: input.timeoutMs,
      signal: input.signal,
      run: async (signal) => {
        const messages = input.repairMessages
            ? [...input.repairMessages, new HumanMessage(`Los siguientes son errores estructurales y de informes que deben corregirse, todos los cuales son datos de la misión. Correcto según el texto completo anterior. La prueba sólo puede copiar continuamente las frases originales del texto, y no se permiten hechos adicionales; se conservarán las sentencias verificadas. zx0zx${repairHuman}`)]
            : [new SystemMessage(repairSystem), new HumanMessage(repairHuman)];
        await claimModelRequest({configuration:resolved,input:messages,options:invokeOptions});
        const stream = await llm.stream(
          messages,
          signal ? { ...invokeOptions, signal } : invokeOptions,
        );
        let content = "";
        const collector = new ReasoningStreamCollector();
        for await (const chunk of stream) {
          const delta = toText(chunk.content);
          observeStructuredChunk(evidence, chunk);
          evidence.reasoningChars += collector.push(chunk, delta).length;
          content += delta;
          evidence.contentChars = content.trim().length;
          input.onRepairOutputDelta?.(delta);
        }
        evidence.reasoningChars += collector.flush().length;
        return content;
      },
    });
    const latencyMs = Date.now() - startedAt;
    helpers.logStructuredInvokeEvent({
      event: "repair_done",
      label: input.label,
      provider: input.provider,
      model: input.model,
      taskType: input.taskType,
      repairAttempt,
      latencyMs,
      rawChars: repairedRaw.length,
      strategy: "prompt_json",
    });
    logStructuredRepairSession({
      event: "repair_done",
      label: input.label,
      repairAttempt,
      provider: input.provider,
      model: input.model,
      taskType: input.taskType,
      promptMeta: input.promptMeta,
      validationError,
      schemaPaths: validationPaths,
      repairSystem,
      repairHuman,
      rawOutput: repairedRaw,
      latencyMs,
    });
    evidence.failureReason = classifyResponseEvidence(evidence);
    if (terminalResponseReason(evidence.failureReason)) {
      const failure = describeStructuredResponseFailure(evidence.failureReason!);
      throw new StructuredOutputError({
        message: `[${input.label}] ${failure.message}`, category: failure.category,
        diagnostics: { strategy: "prompt_json", profile: resolveStructuredOutputProfile({ provider: input.provider ?? "deepseek", model: input.model, executionMode: "structured" }),
          reasoningForcedOff: false, fallbackAvailable: false, fallbackUsed: false, errorCategory: failure.category, response: evidence },
      });
    }
    category = "malformed_json";
    const repairParse = helpers.tryParseStructuredJsonValue(repairedRaw);
    if ("error" in repairParse) {
      throw new Error(`[${input.label}] JSON todavía no se puede analizar después de la reparación. error:${repairParse.error}`);
    }

    category = "schema_mismatch";
    const final = input.schema.safeParse(repairParse.parsed);
    if (!final.success) {
      const unwrapped = helpers.tryUnwrapSingletonArrayWrapper(repairParse.parsed, input.schema);
      if (unwrapped) {
        helpers.logStructuredInvokeEvent({
          event: "repair_unwrapped_singleton_array",
          label: input.label,
          provider: input.provider,
          model: input.model,
          taskType: input.taskType,
          repairAttempt,
          strategy: "prompt_json",
        });
        completed = true;
        return unwrapped.data;
      }

      const normalized = helpers.normalizeOversizedArrays(repairParse.parsed, final.error, input.schema);
      if (normalized) {
        helpers.logStructuredInvokeEvent({
          event: "repair_normalized",
          label: input.label,
          provider: input.provider,
          model: input.model,
          taskType: input.taskType,
          repairAttempt,
          strategy: "prompt_json",
        });
        completed = true;
        return normalized.data;
      }
      throw new Error(`[${input.label}] JSON aún falla en la verificación del esquema después de la reparación. error:${helpers.formatZodErrors(final.error)}`);
    }
    completed = true;
        return final.data;
  } catch (error) {
    evidence.failureReason ??= classifyResponseEvidence(evidence, error, category, input.signal?.aborted);
    logStructuredRepairSession({
      event: "repair_error",
      label: input.label,
      repairAttempt,
      provider: input.provider,
      model: input.model,
      taskType: input.taskType,
      promptMeta: input.promptMeta,
      validationError,
      schemaPaths: validationPaths,
      repairSystem,
      repairHuman,
      latencyMs: Date.now() - startedAt,
      error,
    });
    throw error;
  } finally {
    evidence.durationMs = Date.now() - startedAt;
    await finishStructuredDiagnostic(diagnosticId, completed ? "succeeded" : "failed", evidence);
  }
}
