import {ragConfig} from "../../../../config/rag";
import {ragServices, type RagSearchOptions} from "../../../../services/rag";
import {hashProductionContent} from "../../../../modules/production";
import {canonicalProductionJson, type ProductionJson} from "../../../../modules/production/common";
import {kernelModelWindowsSchema, createKernelModelWindowReader} from "../prompts/modelWindows";
import {KernelReadinessError} from "../readiness/models";
import type {KernelRagConfiguration} from "./types";

const hash = (value: unknown): string => hashProductionContent(canonicalProductionJson(JSON.parse(JSON.stringify(value)) as ProductionJson));

/** Read settings and explicit metadata only. Never resolves credentials, creates an SDK or probes a paid endpoint. */
export async function readKernelRagConfiguration(): Promise<KernelRagConfiguration> {
  const targets = ragConfig.enabled ? [await ragServices.embeddingService.describeTarget(),
    ...(ragConfig.rerankerEnabled ? [ragServices.ragRerankerService.describeTarget()] : [])] : [];
  const reader = createKernelModelWindowReader(kernelModelWindowsSchema.parse(JSON.parse(process.env.PRODUCTION_KERNEL_MODEL_WINDOWS ?? "[]")));
  const windows: KernelRagConfiguration["windows"] = [];
  for (const target of targets) {
    const contextWindow = await reader(target.provider, target.model);
    if (contextWindow === null) throw new KernelReadinessError({code: "production_model_capability_missing",
      message: "El modelo de recuperación carece de una configuración de ventana de contexto explícita. Complete la información de capacidad para el modelo exacto utilizado en la base de conocimientos."});
    windows.push({provider: target.provider, model: target.model, contextWindow});
  }
  return {version: 1, enabled: ragConfig.enabled, targets, windows,
    retrievalIdentity: hash({version: "native-retrieval@1", enabled: ragConfig.enabled, tenant: ragConfig.defaultTenantId,
      qdrant: hash(ragConfig.qdrantUrl), collection: ragConfig.qdrantCollection, embeddingVersion: ragConfig.embeddingVersion,
      vectorCandidates: ragConfig.vectorCandidates, keywordCandidates: ragConfig.keywordCandidates, finalTopK: ragConfig.finalTopK,
      rerankerEnabled: ragConfig.rerankerEnabled, rerankerCandidateLimit: ragConfig.rerankerCandidateLimit})};
}

export async function assertKernelRagIndex(): Promise<void> {
  if (ragConfig.enabled) await ragServices.vectorStoreService.assertReadOnlyCollection();
}
export async function readKernelRagSources(_query: string, options: unknown): Promise<string> {
  return hash(await ragServices.hybridRetrievalService.describeReadSources(options as RagSearchOptions));
}
