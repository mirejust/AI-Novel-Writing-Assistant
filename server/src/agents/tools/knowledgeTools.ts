import { prisma } from "../../db/prisma";
import { AgentToolError, type AgentToolName } from "../types";
import type { AgentToolDefinition } from "./toolTypes";
import {
  getIndexFailureReasonOutputSchema,
  getKnowledgeDocumentDetailOutputSchema,
  knowledgeDocumentIdInputSchema,
  listKnowledgeDocumentsInputSchema,
  listKnowledgeDocumentsOutputSchema,
} from "./knowledgeToolSchemas";

export const knowledgeToolDefinitions: Partial<
  Record<AgentToolName, AgentToolDefinition<Record<string, unknown>, Record<string, unknown>>>
> = {
  list_knowledge_documents: {
    name: "list_knowledge_documents",
    title: "Listar documentos de conocimiento",
    description: "Lea el documento de la base de conocimientos, el estado del índice y el último error del índice.",
    category: "read",
    riskLevel: "low",
    domainAgent: "KnowledgeAgent",
    resourceScopes: ["knowledge_document", "task"],
    inputSchema: listKnowledgeDocumentsInputSchema,
    outputSchema: listKnowledgeDocumentsOutputSchema,
    execute: async (_context, rawInput) => {
      const input = listKnowledgeDocumentsInputSchema.parse(rawInput);
      const rows = await prisma.knowledgeDocument.findMany({
        where: {
          ...(input.status ? { status: input.status } : {}),
          ...(input.kind ? { kind: input.kind } : {}),
        },
        orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
        take: input.limit ?? 20,
      });
      const latestJobs = await prisma.ragIndexJob.findMany({
        where: {
          ownerType: "knowledge_document",
          ownerId: { in: rows.map((item) => item.id) },
        },
        orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      });
      const latestJobMap = new Map<string, (typeof latestJobs)[number]>();
      for (const job of latestJobs) {
        if (!latestJobMap.has(job.ownerId)) {
          latestJobMap.set(job.ownerId, job);
        }
      }
      return listKnowledgeDocumentsOutputSchema.parse({
        items: rows.map((row) => ({
          id: row.id,
          title: row.title,
          fileName: row.fileName,
          kind: row.kind,
          sourceAnalysisId: row.sourceAnalysisId,
          status: row.status,
          latestIndexStatus: row.latestIndexStatus,
          lastIndexedAt: row.lastIndexedAt?.toISOString() ?? null,
          latestIndexError: latestJobMap.get(row.id)?.lastError ?? null,
        })),
        summary: `Leer ${rows.length} documento de conocimiento.`,
      });
    },
  },
  get_knowledge_document_detail: {
    name: "get_knowledge_document_detail",
    title: "Leer los detalles del documento de conocimiento",
    description: "Lea los detalles del documento de conocimientos, el número de versión, el número de enlace y el estado del índice.",
    category: "read",
    riskLevel: "low",
    domainAgent: "KnowledgeAgent",
    resourceScopes: ["knowledge_document"],
    inputSchema: knowledgeDocumentIdInputSchema,
    outputSchema: getKnowledgeDocumentDetailOutputSchema,
    execute: async (_context, rawInput) => {
      const input = knowledgeDocumentIdInputSchema.parse(rawInput);
      const row = await prisma.knowledgeDocument.findUnique({
        where: { id: input.documentId },
        include: {
          versions: {
            select: { id: true },
          },
          bindings: {
            select: { id: true },
          },
        },
      });
      if (!row) {
        throw new AgentToolError("NOT_FOUND", "Knowledge document not found.");
      }
      const latestJob = await prisma.ragIndexJob.findFirst({
        where: {
          ownerType: "knowledge_document",
          ownerId: row.id,
        },
        orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      });
      return getKnowledgeDocumentDetailOutputSchema.parse({
        id: row.id,
        title: row.title,
        fileName: row.fileName,
        kind: row.kind,
        sourceAnalysisId: row.sourceAnalysisId,
        status: row.status,
        activeVersionNumber: row.activeVersionNumber,
        latestIndexStatus: row.latestIndexStatus,
        lastIndexedAt: row.lastIndexedAt?.toISOString() ?? null,
        latestIndexError: latestJob?.lastError ?? null,
        versionCount: row.versions.length,
        bindingCount: row.bindings.length,
        summary: `documento"${row.title}»El estado actual del índice es ${row.latestIndexStatus}.`,
      });
    },
  },
  get_index_failure_reason: {
    name: "get_index_failure_reason",
    title: "Explicar por qué falló el índice",
    description: "Explique por qué la indexación de documentos de conocimiento falló, estaba en cola o estaba incompleta.",
    category: "inspect",
    riskLevel: "low",
    domainAgent: "KnowledgeAgent",
    resourceScopes: ["knowledge_document", "task"],
    inputSchema: knowledgeDocumentIdInputSchema,
    outputSchema: getIndexFailureReasonOutputSchema,
    execute: async (_context, rawInput) => {
      const input = knowledgeDocumentIdInputSchema.parse(rawInput);
      const row = await prisma.knowledgeDocument.findUnique({
        where: { id: input.documentId },
      });
      if (!row) {
        throw new AgentToolError("NOT_FOUND", "Knowledge document not found.");
      }
      const latestJob = await prisma.ragIndexJob.findFirst({
        where: {
          ownerType: "knowledge_document",
          ownerId: row.id,
        },
        orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      });
      const failureSummary = row.latestIndexStatus === "failed"
        ? (latestJob?.lastError?.trim() || "La tarea de indexación falló, pero no se registró ningún error explícito.")
        : row.latestIndexStatus === "running"
          ? "La tarea de indexación aún se está ejecutando y no ha fallado."
          : row.latestIndexStatus === "queued"
            ? "Las tareas de indexación todavía están en cola."
            : "Actualmente no se han registrado errores de índice.";
      const recoveryHint = row.latestIndexStatus === "failed"
        ? "Se recomienda verificar el contenido del documento, la configuración de vectorización y el último registro de tareas de reconstrucción antes de volver a intentarlo."
        : row.latestIndexStatus === "queued"
          ? "Se recomienda comprobar si el subproceso del trabajador del índice se está ejecutando normalmente."
          : "Actualmente no se requieren operaciones de recuperación.";
      return getIndexFailureReasonOutputSchema.parse({
        documentId: row.id,
        status: row.latestIndexStatus,
        failureSummary,
        failureDetails: latestJob?.lastError ?? null,
        recoveryHint,
        summary: failureSummary,
      });
    },
  },
};
