import type { StructuredDiagnosticSummary, StructuredResponseEvidence, StructuredFailureReason } from "@ai-novel/shared/types/structuredDiagnostics";
import type { PromptInvocationMeta } from "../../../prompting/core/promptTypes";
import { prisma } from "../../../db/prisma";

export interface StructuredDiagnosticContext { invocationId: string; nextAttempt: number }

const messages: Record<StructuredFailureReason, string> = {
  empty_response: "El modelo devolvió contenido vacío. Verifique las capacidades de salida estructurada del modelo seleccionado e inténtelo nuevamente.",
  reasoning_budget_exhausted: "La cantidad de salida del modelo se utiliza para pensar y las soluciones disponibles aún no se han devuelto. Verifique los límites de salida del modelo y la configuración de pensamiento.",
  output_budget_exhausted: "La producción del modelo alcanzó esta cuota y el plan no se devolvió por completo. Verifique la cuota de salida e inténtelo nuevamente.",
  blocked: "La modelo negó o filtró explícitamente esta solicitud. Ajuste sus requisitos de creación o consulte las indicaciones del servicio modelo.",
  rate_limited: "El servicio de modelo está temporalmente limitado, espere antes de continuar.",
  network: "Se produjo una excepción de red al conectarse al servicio modelo. Puedes continuar más tarde.",
  timeout: "Esta solicitud de modelo caduca, puede verificar el estado del servicio antes de continuar.",
  cancelled: "Esta solicitud ha sido cancelada.",
  invalid_json: "El formato de esquema devuelto por el modelo está incompleto o no cumple con los requisitos de JSON; continúe intentándolo nuevamente.",
  schema_validation: "El esquema devuelto por el modelo carece de los campos necesarios o la estructura no cumple con los requisitos. Continúe intentándolo de nuevo.",
  business_validation: "La solución devuelta por el modelo no cumple con el acuerdo de creación, continúe intentándolo nuevamente.",
  unknown: "Esta solicitud no se ha completado y la evidencia existente es insuficiente para determinar el motivo específico. Verifique el servicio del modelo después de ver el indicador de diagnóstico.",
};

export function describeShortStoryPlanBudgetFailure(response: StructuredResponseEvidence): string | undefined {
  const reason = response.failureReason;
  if (reason !== "output_budget_exhausted" && reason !== "reasoning_budget_exhausted") return undefined;
  const result = reason === "reasoning_budget_exhausted"
    ? "El modelo no ha generado un plan corto después de agotar su cuota de producción."
    : "Los planes breves se truncaron antes de volver al contenido completo.";
  const limit = response.maxTokens;
  const requested = limit == null ? "" : `El límite superior para esta solicitud es ${limit.toLocaleString("zh-CN")} Simbólico.`;
  const modelSettings = "Verifique el límite superior de salida real del modelo y la interfaz actuales en \"Configuración → Modelo y proveedor → Compatibilidad del modelo\", o cambie el modelo e inténtelo nuevamente.";
  const used = response.tokenUsage?.completionTokens;
  if (limit != null && used != null && used < limit) {
    return `${result}${requested}Se genera el informe de servicio modelo. ${used.toLocaleString("zh-CN")} Simbólico.${modelSettings}`;
  }
  const trace = response.budgetTrace;
  if (trace?.source === "endpoint" || (limit != null && trace?.endpointMaxTokens === limit)) {
    return `${result}${requested}Esta solicitud ha alcanzado el límite superior en la configuración del modelo.${modelSettings}`;
  }
  return `${result}${requested}Vaya a "Configuración → Gestión de enrutamiento del modelo → Planificación del esquema → Longitud máxima de salida" y ajústelo de acuerdo con la cantidad admitida por el modelo utilizado e inténtelo nuevamente. También puede cambiar el modelo para la planificación del esquema.`;
}

export async function beginStructuredDiagnostic(input: {
  meta?: PromptInvocationMeta; context?: StructuredDiagnosticContext; kind?: string;
  provider?: string; model?: string; requestProtocol?: string; strategy: string;
  response: StructuredResponseEvidence;
}): Promise<string | null> {
  const meta = input.meta;
  if (!meta?.taskId || !(meta.promptId?.startsWith("novel.short_story.") || (meta.promptId === "creation.intent.interpret" || meta.promptId?.startsWith("creation.short_story.")))) return null;
  try {
    const row = await prisma.structuredInvocationDiagnostic.create({ data: {
      taskId: meta.taskId, novelId: meta.novelId, promptId: meta.promptId, stage: meta.stage,
      invocationId: input.context?.invocationId ?? crypto.randomUUID(),
      attempt: input.context ? ++input.context.nextAttempt : 1, kind: input.kind ?? "generate",
      provider: input.provider, model: input.model, requestProtocol: input.requestProtocol,
      strategy: input.strategy, detailsJson: JSON.stringify(input.response),
    } });
    return row.id;
  } catch { console.warn("[structured.diagnostics] diagnostic storage unavailable"); return null; }
}

export async function finishStructuredDiagnostic(id: string | null, status: string, response: StructuredResponseEvidence): Promise<void> {
  if (!id) return;
  try { await prisma.structuredInvocationDiagnostic.update({ where: { id }, data: { status, detailsJson: JSON.stringify(response) } }); }
  catch { console.warn("[structured.diagnostics] diagnostic update unavailable"); }
}

export async function latestStructuredDiagnostic(taskId: string, includeUnfinished = false): Promise<StructuredDiagnosticSummary | null> {
  const row = await prisma.structuredInvocationDiagnostic.findFirst({
    where: { taskId }, orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
  });
  if (!row || row.status === "succeeded" || (row.status === "running" && !includeUnfinished)) return null;
  const response = JSON.parse(row.detailsJson) as StructuredResponseEvidence;
  const attempts = await prisma.structuredInvocationDiagnostic.count({ where: { invocationId: row.invocationId } });
  return { id: row.id, reason: response.failureReason, message: row.status === "running"
    ? "No hay ningún registro de finalización para esta solicitud; puede continuar desde el contenido guardado después de reiniciar el software."
    : (row.promptId === "novel.short_story.plan" ? describeShortStoryPlanBudgetFailure(response) : undefined)
      ?? messages[response.failureReason ?? "unknown"], provider: row.provider, model: row.model, strategy: row.strategy,
    attempts, retryAt: response.retryAfterMs ? new Date(row.updatedAt.getTime() + response.retryAfterMs).toISOString() : null, response };
}

export async function canRetryStructuredTask(taskId: string): Promise<boolean> {
  const diagnostic = await latestStructuredDiagnostic(taskId);
  return !diagnostic?.retryAt || Date.parse(diagnostic.retryAt) <= Date.now();
}

export async function recordStructuredBusinessFailure(id: string | null | undefined): Promise<void> {
  if (!id) return;
  try {
    const row = await prisma.structuredInvocationDiagnostic.findUnique({ where: { id } });
    if (!row) return;
    const response = JSON.parse(row.detailsJson) as StructuredResponseEvidence;
    response.failureReason = "business_validation";
    await finishStructuredDiagnostic(id, "failed", response);
  } catch { console.warn("[structured.diagnostics] business validation storage unavailable"); }
}
