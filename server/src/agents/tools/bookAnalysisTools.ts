import { prisma } from "../../db/prisma";
import { AgentToolError, type AgentToolName } from "../types";
import type { AgentToolDefinition } from "./toolTypes";
import {
  analyzeQualityDebtAttributionInputSchema,
  analyzeQualityDebtAttributionOutputSchema,
  auditChapterContinuityInputSchema,
  auditChapterContinuityOutputSchema,
  bookAnalysisIdInputSchema,
  getBookAnalysisDetailOutputSchema,
  getBookAnalysisFailureReasonOutputSchema,
  listBookAnalysesInputSchema,
  listBookAnalysesOutputSchema,
  type QualityDebtChapterAttribution,
} from "./bookAnalysisToolSchemas";

export const bookAnalysisToolDefinitions: Partial<
  Record<AgentToolName, AgentToolDefinition<Record<string, unknown>, Record<string, unknown>>>
> = {
  list_book_analyses: {
    name: "list_book_analyses",
    title: "Listar tareas de apertura de libros",
    description: "Lea la lista de tareas de análisis de libros divididos, el estado y los errores recientes.",
    category: "read",
    riskLevel: "low",
    domainAgent: "BookAnalysisAgent",
    resourceScopes: ["book_analysis", "knowledge_document", "task"],
    inputSchema: listBookAnalysesInputSchema,
    outputSchema: listBookAnalysesOutputSchema,
    execute: async (_context, rawInput) => {
      const input = listBookAnalysesInputSchema.parse(rawInput);
      const rows = await prisma.bookAnalysis.findMany({
        where: {
          ...(input.documentId ? { documentId: input.documentId } : {}),
          ...(input.status ? { status: input.status } : {}),
        },
        include: {
          document: {
            select: {
              id: true,
              title: true,
            },
          },
        },
        orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
        take: input.limit ?? 20,
      });
      return listBookAnalysesOutputSchema.parse({
        items: rows.map((row) => ({
          id: row.id,
          title: row.title,
          documentId: row.documentId,
          documentTitle: row.document.title,
          status: row.status,
          progress: row.progress,
          currentStage: row.currentStage ?? null,
          lastError: row.lastError ?? null,
          updatedAt: row.updatedAt.toISOString(),
        })),
        summary: `Leer ${rows.length} Una tarea de apertura de libros.`,
      });
    },
  },
  get_book_analysis_detail: {
    name: "get_book_analysis_detail",
    title: "Lea los detalles de cómo abrir el libro.",
    description: "Lea el progreso, la cantidad de capítulos y el estado reciente de una sola tarea de apertura de libros.",
    category: "read",
    riskLevel: "low",
    domainAgent: "BookAnalysisAgent",
    resourceScopes: ["book_analysis", "knowledge_document"],
    inputSchema: bookAnalysisIdInputSchema,
    outputSchema: getBookAnalysisDetailOutputSchema,
    execute: async (_context, rawInput) => {
      const input = bookAnalysisIdInputSchema.parse(rawInput);
      const row = await prisma.bookAnalysis.findUnique({
        where: { id: input.analysisId },
        include: {
          document: {
            select: {
              id: true,
              title: true,
            },
          },
          sections: {
            select: { id: true },
          },
        },
      });
      if (!row) {
        throw new AgentToolError("NOT_FOUND", "Book analysis not found.");
      }
      return getBookAnalysisDetailOutputSchema.parse({
        id: row.id,
        title: row.title,
        documentId: row.documentId,
        documentTitle: row.document.title,
        status: row.status,
        summary: row.summary ?? null,
        progress: row.progress,
        currentStage: row.currentStage ?? null,
        currentItemLabel: row.currentItemLabel ?? null,
        lastError: row.lastError ?? null,
        sectionCount: row.sections.length,
        updatedAt: row.updatedAt.toISOString(),
      });
    },
  },
  get_book_analysis_failure_reason: {
    name: "get_book_analysis_failure_reason",
    title: "Explique el motivo por el que no se pudo abrir el libro.",
    description: "Explique por qué la tarea de apertura del libro falló, se bloqueó o no se puede continuar actualmente.",
    category: "inspect",
    riskLevel: "low",
    domainAgent: "BookAnalysisAgent",
    resourceScopes: ["book_analysis", "task"],
    inputSchema: bookAnalysisIdInputSchema,
    outputSchema: getBookAnalysisFailureReasonOutputSchema,
    execute: async (_context, rawInput) => {
      const input = bookAnalysisIdInputSchema.parse(rawInput);
      const row = await prisma.bookAnalysis.findUnique({
        where: { id: input.analysisId },
      });
      if (!row) {
        throw new AgentToolError("NOT_FOUND", "Book analysis not found.");
      }
      const failureSummary = row.status === "failed"
        ? (row.lastError?.trim() || "La tarea de apertura del libro falló, pero no se registró ningún error claro.")
        : row.status === "cancelled"
          ? "La tarea de abrir el libro ha sido cancelada."
          : row.status === "running"
            ? "La tarea de abrir el libro aún está en marcha y no ha fracasado."
            : row.status === "queued"
              ? "La tarea de abrir el libro todavía está en cola y aún no se ha iniciado."
              : "Actualmente no existe ningún registro de fallas para la tarea de apertura de libros.";
      const recoveryHint = row.status === "failed"
        ? "Puede verificar la integridad del contenido del documento, la configuración del modelo y el registro de generación del capítulo más reciente antes de decidir si desea volver a intentarlo."
        : row.status === "running"
          ? "Se recomienda esperar a que se complete la tarea actual o verificar el progreso en tiempo real en el centro de tareas."
          : row.status === "queued"
            ? "Se recomienda verificar la presión de la cola y la disponibilidad del modelo para confirmar si la tarea está programada."
            : "Actualmente no se requieren operaciones de recuperación.";
      return getBookAnalysisFailureReasonOutputSchema.parse({
        analysisId: row.id,
        status: row.status,
        failureSummary,
        failureDetails: row.lastError ?? null,
        recoveryHint,
        summary: failureSummary,
      });
    },
  },
  audit_chapter_continuity: {
    name: "audit_chapter_continuity",
    title: "Capítulo Diagnóstico de Continuidad",
    description: "Escanee el texto generado del rango de capítulos especificado, detecte patrones de escena repetidos (repetición de los tres elementos de tiempo + ubicación + acción) y patrones repetidos al comienzo de los capítulos, y genere un informe de diagnóstico. No se requiere LLM, la detección de estructuras se basa directamente en el contenido del capítulo.",
    category: "inspect",
    riskLevel: "low",
    domainAgent: "NovelAgent",
    resourceScopes: ["novel", "chapter"],
    parserHints: {
      intent: "inspect_failure_reason",
      aliases: ["Capítulo Diagnóstico de Continuidad", "Detección de capítulos duplicados", "Comprobación de coherencia de la trama", "audit chapter continuity"],
      phrases: [
        "Comprueba si hay capítulos duplicados.",
        "Ver qué capítulos se repiten",
        "Diagnosticar problemas de continuidad en una novela.",
        "¿Qué escenas fueron reescritas?",
        "¿Hay un patrón que se repite al principio?",
      ],
      requiresNovelContext: true,
      whenToUse: "El usuario desea diagnosticar patrones de escenas recurrentes, aperturas duplicadas o problemas de estado de hitos en los capítulos generados.",
      whenNotToUse: "El usuario consulta el estado de la tarea o el progreso de la producción.",
    },
    inputSchema: auditChapterContinuityInputSchema,
    outputSchema: auditChapterContinuityOutputSchema,
    execute: async (context, rawInput) => {
      const input = auditChapterContinuityInputSchema.parse(rawInput);
      const novelId = input.novelId?.trim() || context.novelId;
      if (!novelId) {
        throw new AgentToolError("INVALID_INPUT", "El diagnóstico de continuidad no se puede realizar sin el contexto de la novela actual.");
      }

      const chapters = await prisma.chapter.findMany({
        where: {
          novelId,
          order: {
            gte: input.startOrder ?? 1,
            ...(input.endOrder != null ? { lte: input.endOrder } : {}),
          },
          NOT: { content: null },
        },
        orderBy: { order: "asc" },
        select: { id: true, order: true, title: true, content: true },
      });

      if (chapters.length === 0) {
        return auditChapterContinuityOutputSchema.parse({
          novelId,
          checkedRange: `ch${input.startOrder ?? 1}-end`,
          chapterCount: 0,
          milestoneBreaks: [],
          repetitionClusters: [],
          openingPatternClusters: [],
          hasCriticalIssues: false,
          summary: "No se genera ningún texto de capítulo en el rango especificado y no se puede realizar el diagnóstico.",
          recommendation: "Genere el texto del capítulo antes de realizar el diagnóstico.",
        });
      }

      const OPENING_LENGTH = 120;
      const SCENE_PATTERN_KEYWORDS = [
        ["madrugada", "Albergue", "agacharse"],
        ["madrugada", "agacharse"],
        ["Oficina del subdistrito", "estampilla"],
        ["Oficina del subdistrito", "cap."],
        ["Industria y comercio", "licencia"],
        ["Industria y comercio", "cap."],
        ["parar", "contrato"],
        ["parar", "firmar"],
        ["las cuatro de la mañana"],
        ["cuatro de la mañana"],
        ["seguir de cerca", "perdido"],
        ["Mañana por la mañana"],
      ];

      function extractOpeningSnippet(content: string): string {
        return content.replace(/\s+/g, "").slice(0, OPENING_LENGTH);
      }

      function matchesPatternGroup(content: string, keywords: string[]): boolean {
        return keywords.every((kw) => content.includes(kw));
      }

      const repetitionMap = new Map<string, number[]>();
      const openingMap = new Map<string, number[]>();

      for (const chapter of chapters) {
        if (!chapter.content) {
          continue;
        }
        const content = chapter.content;
        for (const patternGroup of SCENE_PATTERN_KEYWORDS) {
          if (matchesPatternGroup(content, patternGroup)) {
            const key = patternGroup.join("+");
            const existing = repetitionMap.get(key) ?? [];
            existing.push(chapter.order);
            repetitionMap.set(key, existing);
          }
        }
        const opening = extractOpeningSnippet(content);
        if (opening.length >= 30) {
          const prefix = opening.slice(0, 30);
          const existing = openingMap.get(prefix) ?? [];
          existing.push(chapter.order);
          openingMap.set(prefix, existing);
        }
      }

      const repetitionClusters = Array.from(repetitionMap.entries())
        .filter(([, orders]) => orders.length >= 2)
        .map(([pattern, occurrences]) => ({ pattern, occurrences }));

      const openingPatternClusters = Array.from(openingMap.entries())
        .filter(([, orders]) => orders.length >= 3)
        .map(([pattern, occurrences]) => ({ pattern: `Mismo fragmento al principio:${pattern}`, occurrences }));

      const hasCriticalIssues = repetitionClusters.some((c) => c.occurrences.length >= 3)
        || openingPatternClusters.length > 0;

      const firstOrder = chapters[0]?.order ?? (input.startOrder ?? 1);
      const lastOrder = chapters[chapters.length - 1]?.order ?? firstOrder;
      const checkedRange = `ch${firstOrder}-ch${lastOrder}`;

      const issueLines: string[] = [
        ...repetitionClusters.map((c) => `repetición de escena[${c.pattern}] apareció en el ${c.occurrences.join(",")}`),
        ...openingPatternClusters.map((c) => `Repetido al principio Aparece en el n. ${c.occurrences.join(",")}`),
      ];

      const summary = issueLines.length > 0
        ? `Descubrir ${issueLines.length} Problemas de continuidad:${issueLines.slice(0, 3).join(";")}`
        : `existir ${checkedRange} común ${chapters.length} No se detectaron patrones repetitivos obvios en el Capítulo.`;

      const recommendation = issueLines.length > 0
        ? "Recomendaciones: 1) Agregue capítulos con escenas repetidas a la lista negra de RecentScenePatterns para evitar que se repitan capítulos posteriores; 2) Reparar la diferenciación de contenido de capítulos repetidos manualmente o mediante apply_chapter_patch."
        : "La continuidad del capítulo es buena y no se necesitan correcciones.";

      return auditChapterContinuityOutputSchema.parse({
        novelId,
        checkedRange,
        chapterCount: chapters.length,
        milestoneBreaks: [],
        repetitionClusters,
        openingPatternClusters,
        hasCriticalIssues,
        summary,
        recommendation,
      });
    },
  },

  analyze_quality_debt_attribution: {
    name: "analyze_quality_debt_attribution",
    title: "Análisis de atribución de causa raíz de deuda de calidad",
    description: "Escanee los capítulos de deuda de calidad registrada (aplazar_y_continuar), agregue la proporción de causas raíz A/B/D/E, el código de problema de falla principal y los tipos de obligaciones faltantes, y produzca un informe de decisión. No se requiere LLM, se calcula directamente en función de los datos de RiskFlags.",
    category: "inspect",
    riskLevel: "low",
    domainAgent: "NovelAgent",
    resourceScopes: ["novel", "chapter"],
    parserHints: {
      intent: "inspect_failure_reason",
      aliases: ["atribución de deuda de calidad", "Análisis de deuda de calidad", "análisis de causa raíz", "analyze quality debt", "quality debt attribution"],
      phrases: [
        "Por qué los capítulos siempre no se reparan",
        "¿Cuáles son las causas fundamentales de la deuda de calidad?",
        "Analizar qué capítulos tienen problemas de calidad.",
        "Informe de causa raíz de la deuda de calidad",
        "Estadísticas sobre causas de fallos de reparación.",
      ],
      requiresNovelContext: true,
      whenToUse: "Los usuarios quieren comprender la distribución de la causa raíz de los capítulos de deuda de calidad registrados para determinar la dirección de optimización.",
      whenNotToUse: "El usuario consulta el contenido detallado o el estado de generación de un solo capítulo.",
    },
    inputSchema: analyzeQualityDebtAttributionInputSchema,
    outputSchema: analyzeQualityDebtAttributionOutputSchema,
    execute: async (context, rawInput) => {
      const input = analyzeQualityDebtAttributionInputSchema.parse(rawInput);
      const novelId = input.novelId?.trim() || context.novelId;
      if (!novelId) {
        throw new AgentToolError("INVALID_INPUT", "El análisis de atribución de deuda de calidad no se puede realizar sin el novedoso contexto actual.");
      }

      const chapters = await prisma.chapter.findMany({
        where: {
          novelId,
          order: {
            gte: input.startOrder ?? 1,
            ...(input.endOrder != null ? { lte: input.endOrder } : {}),
          },
          riskFlags: { not: null },
        },
        orderBy: { order: "asc" },
        select: { id: true, order: true, title: true, riskFlags: true },
      });

      // 过滤出 terminalAction = defer_and_continue 的章节
      const deferredChapters: QualityDebtChapterAttribution[] = [];

      for (const chapter of chapters) {
        let riskFlagsObj: Record<string, unknown> = {};
        try {
          if (chapter.riskFlags) {
            const parsed = JSON.parse(chapter.riskFlags) as unknown;
            if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
              riskFlagsObj = parsed as Record<string, unknown>;
            }
          }
        } catch {
          continue;
        }

        const qualityLoop = riskFlagsObj.qualityLoop;
        if (!qualityLoop || typeof qualityLoop !== "object" || Array.isArray(qualityLoop)) {
          continue;
        }
        const loop = qualityLoop as Record<string, unknown>;
        if (loop.terminalAction !== "defer_and_continue") {
          continue;
        }

        const attribution = loop.qualityDebtAttribution;
        if (!attribution || typeof attribution !== "object" || Array.isArray(attribution)) {
          // 旧数据，无归因信息
          deferredChapters.push({
            chapterOrder: chapter.order,
            chapterId: chapter.id,
            title: chapter.title ?? `Cap.${chapter.order}cap.`,
            firstFailureIssueCodes: [],
            secondFailureIssueCodes: [],
            firstFailureClassificationCode: null,
            patchAnchorFailed: false,
            sameObligationRepeated: false,
            planMisaligned: false,
            lengthVsContentDrift: false,
            missingObligationKinds: [],
            primaryRootCause: "unknown",
          });
          continue;
        }

        const attr = attribution as Record<string, unknown>;
        const firstIssueCodes = Array.isArray(attr.firstFailureIssueCodes)
          ? attr.firstFailureIssueCodes.filter((c): c is string => typeof c === "string")
          : [];
        const secondIssueCodes = Array.isArray(attr.secondFailureIssueCodes)
          ? attr.secondFailureIssueCodes.filter((c): c is string => typeof c === "string")
          : [];
        const obligationKinds = Array.isArray(attr.missingObligationKinds)
          ? attr.missingObligationKinds.filter((k): k is string => typeof k === "string")
          : [];
        const patchAnchorFailed = attr.patchAnchorFailed === true;
        const sameObligationRepeated = attr.sameObligationRepeated === true;
        const planMisaligned = attr.planMisaligned === true;
        const lengthVsContentDrift = attr.lengthVsContentDrift === true;
        const classCode = typeof attr.firstFailureClassificationCode === "string"
          ? attr.firstFailureClassificationCode
          : null;

        // 推断主要根因（优先级：D > B > A > E > unknown）
        let primaryRootCause: QualityDebtChapterAttribution["primaryRootCause"] = "unknown";
        if (planMisaligned) {
          primaryRootCause = "D";
        } else if (patchAnchorFailed) {
          primaryRootCause = "B";
        } else if (sameObligationRepeated) {
          primaryRootCause = "A";
        } else if (lengthVsContentDrift) {
          primaryRootCause = "E";
        }

        deferredChapters.push({
          chapterOrder: chapter.order,
          chapterId: chapter.id,
          title: chapter.title ?? `Cap.${chapter.order}cap.`,
          firstFailureIssueCodes: firstIssueCodes,
          secondFailureIssueCodes: secondIssueCodes,
          firstFailureClassificationCode: classCode,
          patchAnchorFailed,
          sameObligationRepeated,
          planMisaligned,
          lengthVsContentDrift,
          missingObligationKinds: obligationKinds,
          primaryRootCause,
        });
      }

      const attributed = deferredChapters.filter((c) => c.primaryRootCause !== "unknown" || c.firstFailureIssueCodes.length > 0);
      const attributedCount = attributed.length;
      const totalDeferred = deferredChapters.length;

      // 根因占比
      const countByRoot = { A: 0, B: 0, D: 0, E: 0, unknown: 0 };
      for (const c of deferredChapters) {
        countByRoot[c.primaryRootCause] += 1;
      }
      const denominator = totalDeferred || 1;
      const rootCauseRatios = {
        A: Number((countByRoot.A / denominator).toFixed(3)),
        B: Number((countByRoot.B / denominator).toFixed(3)),
        D: Number((countByRoot.D / denominator).toFixed(3)),
        E: Number((countByRoot.E / denominator).toFixed(3)),
        unknown: Number((countByRoot.unknown / denominator).toFixed(3)),
      };

      // Top 失败 issue code
      const issueCodeCount: Record<string, number> = {};
      for (const c of deferredChapters) {
        for (const code of [...c.firstFailureIssueCodes, ...c.secondFailureIssueCodes]) {
          issueCodeCount[code] = (issueCodeCount[code] ?? 0) + 1;
        }
      }
      const topFailureIssueCodes = Object.entries(issueCodeCount)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([code, count]) => ({ code, count }));

      // Top 缺失义务种类
      const obligationKindCount: Record<string, number> = {};
      for (const c of deferredChapters) {
        for (const kind of c.missingObligationKinds) {
          obligationKindCount[kind] = (obligationKindCount[kind] ?? 0) + 1;
        }
      }
      const topMissingObligationKinds = Object.entries(obligationKindCount)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([kind, count]) => ({ kind, count }));

      // 生成决策建议
      const dominantRoot = Object.entries(countByRoot)
        .filter(([k]) => k !== "unknown")
        .sort((a, b) => b[1] - a[1])[0]?.[0] ?? "unknown";
      const recommendationMap: Record<string, string> = {
        D: "La causa raíz D (obligación inalcanzable) domina → Se da prioridad a la planificación perezosa en la fase de implementación y la generación de hojas de tareas JIT se puede resolver directamente.",
        A: "Predomina la causa raíz A (reparación en bucle abierto) → Priorizar la reparación de bucles cerrados (subítem 1.D), permitiendo al reparador realizar tareas estructuradas.",
        B: "La causa raíz B (no coincide el anclaje del parche) domina → conserva el texto original y registra la deuda de calidad; El usuario debe seleccionar explícitamente las reconstrucciones posteriores y el modo de reparación no se puede actualizar automáticamente.",
        E: "La causa raíz E (derivación de la firma) domina → dividir el problema de longitud/contenidoFirma y calcular el presupuesto por separado.",
        unknown: "Aún no hay suficientes datos de atribución. Se recomienda ejecutar más capítulos antes de analizarlos.",
      };
      const recommendation = totalDeferred === 0
        ? "La novela actual no tiene capítulos de deuda de calidad registrados y no necesita ser procesada."
        : recommendationMap[dominantRoot] ?? recommendationMap.unknown;

      const startOrder = input.startOrder ?? 1;
      const endOrder = input.endOrder ?? chapters[chapters.length - 1]?.order ?? startOrder;
      const checkedRange = `ch${startOrder}-${endOrder}`;

      return analyzeQualityDebtAttributionOutputSchema.parse({
        novelId,
        checkedRange,
        totalDeferredChapters: totalDeferred,
        attributedChapters: attributedCount,
        rootCauseRatios,
        topFailureIssueCodes,
        topMissingObligationKinds,
        chapters: deferredChapters,
        recommendation,
      });
    },
  },
};
