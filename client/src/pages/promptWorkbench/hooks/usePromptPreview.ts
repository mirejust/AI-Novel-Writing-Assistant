import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  previewPrompt,
  testRunPrompt,
  type PromptCatalogItem,
  type PromptPreviewPayload,
  type PromptTestRunPayload,
  type PromptTestRunResult,
  type PromptTemplateJson,
} from "@/api/promptWorkbench";
import { useSSE } from "@/hooks/useSSE";
import type { PromptSlotDrafts } from "../promptWorkbenchTypes";
import { buildOpeningDirectionPreview } from "../openingDirectionPreview";

interface PreviewNovel {
  id: string;
  title?: string | null;
}

interface PreviewChapter {
  id: string;
  title?: string | null;
  order?: number | null;
  content?: string | null;
  expectation?: string | null;
  targetWordCount?: number | null;
  taskSheet?: string | null;
}

function buildPreviewExtraContextBlocks(prompt: PromptCatalogItem) {
  if (prompt.id !== "audit.chapter.light" && prompt.id !== "audit.chapter.full") {
    return [];
  }
  return [
    {
      id: "chapter_mission",
      group: "chapter_mission",
      priority: 100,
      content: [
        "Misión del capítulo: capítulo de ejemplo",
        "Objetivo: Deja que el protagonista descubra el código secreto del antiguo almacén y confirme que alguien se acerca.",
        "Expectativa: este capítulo debe avanzar en el descubrimiento de pistas, crear presión externa y dejar un gancho de seguimiento al final.",
        "Must advance",
        "- El protagonista descubre el código en la pared y determina que apunta a la Estación de Archivos de la Ciudad Vieja.",
        "- Unos pasos que se acercan por la puerta obligan al protagonista a tomar una decisión inmediata.",
        "Must preserve",
        "- Los códigos son pistas reales, no alucinaciones ni graffitis corrientes.",
      ].join("\n"),
    },
    {
      id: "chapter_boundary",
      group: "chapter_boundary",
      priority: 99,
      required: true,
      content: [
        "Chapter boundary:",
        "Evento exclusivo: El protagonista descubre por primera vez el código dejado por el investigador anterior en el antiguo almacén.",
        "Estado de entrada: el protagonista ingresa solo al antiguo almacén y el significado de la contraseña aún no se ha confirmado.",
        "Estado final: el protagonista confirma que el código apunta a la estación de archivos de la ciudad antigua y, al mismo tiempo, se da cuenta de que el rastreador ha llegado a la puerta.",
        "Estado de entrada del próximo capítulo: el protagonista debe decidir quitar la evidencia o preparar una emboscada para investigar antes de ser expuesto.",
        "Do not cross",
        "- El verdadero líder de la organización de la Ciudad Vieja no debe revelarse directamente en este capítulo.",
        "- No permita que el perseguidor le explique completamente el sistema de códigos en el acto.",
        "Protected reveals",
        "- La verdadera identidad del investigador anterior.",
      ].join("\n"),
    },
    {
      id: "structure_obligations",
      group: "structure_obligations",
      priority: 94,
      required: true,
      content: [
        "Structure obligations",
        "- Debe consultar este capítulo para ver si se descubren pistas, se acerca la presión y se completan los puntos de elección del final del capítulo.",
        "- Es necesario comprobar si la motivación del protagonista para la acción es continua y la respuesta al código secreto no se puede conocer de la nada.",
        "- Se debe comprobar el final para ver si crea nuevo suspenso o tensión de seguimiento.",
      ].join("\n"),
    },
    {
      id: "local_state",
      group: "local_state",
      priority: 89,
      content: "Estado local antes de la revisión: el protagonista de \\n se encuentra dentro de un antiguo almacén, se acercan rastreadores externos y el significado del código aún no se ha confirmado por completo.",
    },
    {
      id: "world_rules",
      group: "world_rules",
      priority: 84,
      content: "Reglas mundiales relevantes\\n: el antiguo sistema de códigos de la ciudad solo lo dominan unos pocos investigadores y miembros de la organización clandestina.",
    },
  ];
}

function buildPreviewExecutionMetadata(
  prompt: PromptCatalogItem,
  hasRealChapterContext: boolean,
): Record<string, unknown> | undefined {
  if (hasRealChapterContext) {
    return undefined;
  }
  const extraContextBlocks = buildPreviewExtraContextBlocks(prompt);
  if (extraContextBlocks.length === 0) {
    return undefined;
  }
  return { extraContextBlocks };
}

function buildPreviewPromptInput(
  prompt: PromptCatalogItem,
  previewNovel?: PreviewNovel | null,
  previewChapter?: PreviewChapter | null,
): Record<string, unknown> {
  if (prompt.id === "novel.director.candidate_titles") {
    return {
      context: {
        genreName: "Historia alternativa", count: 4,
        brief: [
          "Inspiración de la historia: un soldado fronterizo escribe cartas a casa para el general todos los días.",
          "La dirección de este caso: el soldado descubrió que el plan de defensa estaba oculto en la carta familiar, por lo que solo pudo tomar prestada la siguiente carta para pedirle confirmación al cocinero. Cada palabra que escribió podría exponerlo.",
          "Otro plan en la misma ronda (solo a modo de comparación): el peón y el cocinero tienen cada uno la mitad de las pruebas y deben convencer a la otra parte de que revele la verdad para salvar la ciudad.",
        ].join("\n"),
      },
    };
  }
  if (prompt.id === "outline.workbench_dialogue") {
    return { requestText: "Quiero escribir sobre una chica que guarda recuerdos para los demás. Ayúdame a comparar las dos direcciones de apertura.", baseVersion: 1,
      document: { story: { title: "Depositario de memoria" }, volumes: [], chapters: [], characters: [], facts: [], payoffs: [] }, priorProposal: null, history: [] };
  }
  if (prompt.id === "outline.character_impact") {
    return {
      role: "character", requestText: "Deje que Shen He sospeche de antemano la fuente del libro de cuentas, pero conserve el motivo de salvar al maestro.", prior: {},
      snapshot: {projectId: "sample", baseVersion: 1, characterId: "shen", writtenChapterIds: [], recentCharacterChanges: [],
        document: {schemaVersion: 1, story: {nodeId: "story", title: "Cuentas antiguas", premise: "Consultar el origen de los libros de cuentas.", synopsis: "", theme: "", tone: "", endingDirection: ""},
          characters: [{nodeId: "shen", name: "Shen él", motivation: "Cree en el Maestro", appearanceNodeIds: []}],
          volumes: [], chapters: [], payoffs: [], facts: []}},
    };
  }
  if (prompt.id === "audit.chapter.light" || prompt.id === "audit.chapter.full") {
    const chapterContent = previewChapter
      ? previewChapter.content?.trim()
        || previewChapter.taskSheet?.trim()
        || previewChapter.expectation?.trim()
        || "No hay texto para el capítulo actual."
      : "El protagonista entra al antiguo almacén y descubre que el código dejado por el investigador anterior permanece en la pared. Se oían pasos acercándose al otro lado de la puerta y tenía que determinar hacia dónde apuntaba el código antes de quedar expuesto.";
    return {
      novelTitle: previewNovel?.title || "Novela de muestra",
      chapterTitle: previewChapter
        ? `Cap. ${previewChapter.order ?? "?"} capítulo ${previewChapter.title || "Capítulo sin título"}`
        : "Capítulo de ejemplo",
      requestedTypes: ["plot", "character", "continuity"],
      storyModeContext: previewNovel
        ? "Realice una vista previa del libro utilizando las asignaciones de capítulos, los límites de los capítulos y las obligaciones estructurales de la novela elegida."
        : "Este libro prefiere el ritmo de una novela serializada en línea, y los capítulos deben avanzar continuamente en el conflicto y retener el gancho al final del capítulo.",
      content: chapterContent,
      ragContext: "Sin complementos de búsqueda adicionales.",
    };
  }

  if (prompt.id === "novel.chapter.writer") {
    const targetWordCount = previewChapter?.targetWordCount ?? 3000;
    const softMinWordCount = Math.max(800, Math.round(targetWordCount * 0.86));
    const softMaxWordCount = Math.max(softMinWordCount + 200, Math.round(targetWordCount * 1.14));
    return {
      novelTitle: previewNovel?.title || "Novela de muestra",
      chapterOrder: previewChapter?.order ?? 1,
      chapterTitle: previewChapter?.title || "Capítulo de ejemplo",
      mode: "draft",
      targetWordCount,
      minWordCount: softMinWordCount,
      maxWordCount: softMaxWordCount,
    };
  }

  if (prompt.id === "novel.short_story.segment.write") {
    return {
      originalIdea: "Una chica que puede oír mentiras conoce a la única persona que no puede distinguir la verdad de las mentiras.",
      understanding: "Crear una crisis de confianza con la imposibilidad de juzgar lo verdadero y lo falso, y darse cuenta de la relación y la verdad en un incidente completo.",
      direction: { id: "preview", title: "Testimonio silencioso", premise: "La niña debe cooperar con testigos que no pueden juzgar.", coreExperience: "Suspenso y confianza", protagonist: "La chica que puede oír mentiras.", centralConflict: "Fallo de capacidades y peligro inminente.", endingPromise: "Descubriendo las causas del fallo de capacidad", styleKeywords: ["Apertura rápida", "Revelación continua"] },
      plan: { title: "Testimonio silencioso", targetWordCount: 8000, endingPromise: "Descubrir la verdad", segments: [] },
      segment: { order: 1, purpose: "Generar excepción y presión colaborativa", targetWordCount: 2600, openingState: "La habilidad siempre ha sido confiable.", openingHook: "el único silencio", immediateGoal: "Determinar si el testigo es creíble.", progressionBeats: ["El peligro se acerca", "Obligado a cooperar"], turningPoint: "La habilidad no es ineficaz.", payoff: "Descubre la primera capa de la verdad", closingPull: "Las verdaderas mentiras provienen de las personas que te rodean.", closingState: "Los dos formaron una alianza temporal." },
      previousContinuity: "",
      previousContentTail: "",
    };
  }

  if (prompt.id === "novel.chapter_editor.workspace_diagnosis") {
    return {
      chapterTitle: "Capítulo de ejemplo",
      chapterMission: "Deja que el protagonista descubra pistas clave.",
      volumePositionLabel: "Parte media del volumen uno",
      volumePhaseLabel: "El conflicto se desarrolla",
      paceDirective: "Acelerar el progreso",
      previousChapterBridge: "El capítulo anterior dejó un rastro de pistas.",
      nextChapterBridge: "El siguiente capítulo entra en una confrontación frontal.",
      activePlotThreads: ["Estación de archivo de seguimiento"],
      paragraphs: [{ index: 1, text: "El protagonista entra en un antiguo almacén." }],
      openIssues: [],
    };
  }

  if (prompt.id === "bookAnalysis.character.profile") {
    return {
      generationDepth: "standard",
      selectedDimensions: ["basic", "personality", "arc"],
      character: {
        name: "Lin Che",
        role: "Protagonista",
        briefDescription: "Un joven investigador obligado a rastrear el código secreto de un antiguo almacén.",
        importance: "high",
        occurringChapters: ["Capítulo 1"],
      },
      characterSystemContext: "El protagonista es el encargado de avanzar en los secretos de la ciudad vieja.",
      notesText: "En el Capítulo 1, Lin Che descubrió el código secreto del antiguo almacén y se dio cuenta de que alguien lo estaba siguiendo.",
      ragEvidenceText: "",
    };
  }

  if (prompt.id === "bookAnalysis.character.generate") {
    return {
      generationDepth: "standard",
      selectedDimensions: ["basic", "personality", "arc"],
      characterNames: ["Lin Che", "Niebla densa"],
      characterSystemContext: "Los personajes principales forman una red en torno a los secretos de la ciudad vieja y las presiones para rastrearlos.",
      notesText: "Lin Che descubrió el código y Chen Wu tenía pistas sobre la ciudad vieja. Los dos temporalmente desconfiaron el uno del otro.",
    };
  }

  if (prompt.id === "image.novel_cover.brief") {
    return {
      sourcePrompt: "El antiguo almacén de la ciudad, el código secreto en la pared, los pasos fuera de la puerta y la cubierta vertical llena de suspenso.",
      title: "Antiguo código de la ciudad",
      description: "Un joven investigador descubre un código que cambia su destino en un almacén abandonado en la ciudad vieja.",
      targetAudience: "Lectores a los que les guste el suspense urbano y los ganchos fuertes.",
      bookSellingPoint: "Cada capítulo avanza en torno a una pista rastreable.",
      competingFeel: "Tenso, comedido, con un toque de película fría.",
      first30ChapterPromise: "Descubre la organización detrás del código de la Ciudad Vieja e involucra al protagonista en una conspiración mayor.",
      commercialTags: ["Suspenso urbano", "Seguimiento de pistas", "Arranque de alta presión"],
      genreLabel: "Suspenso urbano",
      primaryStoryModeLabel: "Las pistas avanzan",
      secondaryStoryModeLabel: "Misterio de identidad",
      worldName: "Ciudad vieja",
      worldSummary: "Una ciudad antigua con una superficie tranquila y pistas subterráneas entrelazadas.",
      styleTone: "Imagen fría, compacta y fuerte",
      narrativePovLabel: "perspectiva limitada en tercera persona",
      pacePreferenceLabel: "Ritmo medio a rápido",
      emotionIntensityLabel: "Restricción de alta presión",
    };
  }

  if (prompt.id === "novel.character.castAuto.relations") {
    return {
      storyInput: "El protagonista rastrea el código secreto en la ciudad vieja y poco a poco descubre el ocultamiento y la presión organizativa de las personas que lo rodean.",
      optionTitle: "Programa de seguimiento del casco antiguo",
      optionSummary: "El protagonista, el que da la pista y la fuente de presión forman una red de exploración mutua en torno a los secretos de la ciudad vieja.",
      protagonistNames: ["Lin Che"],
      memberNames: ["Lin Che", "Niebla densa", "Gu Heng"],
      memberRosterText: "Lin Che: Protagonista, joven investigador. \\n Chen Wu: Proveedor de pistas, conoce la fuente del código secreto de la ciudad vieja. \\n Gu Heng: Fuente de presión, tratando de impedir la investigación.",
    };
  }

  if (prompt.id === "world.layer.generate") {
    return {
      layerKey: "foundation",
      targetFields: ["background", "geography"],
      worldName: "Ciudad vieja",
      worldType: "Anécdotas urbanas",
      templateName: "Suspenso urbano",
      templateDescription: "Hay una orden secreta de larga data escondida bajo la superficie de la ciudad real.",
      classicElements: ["Casco antiguo", "Organización clandestina", "Código de pista"],
      pitfalls: ["No expliques todos los misterios a la vez", "No dejes que las reglas sigan siendo conceptos"],
      axioms: "El sistema de códigos secretos de la ciudad vieja realmente existe y afectará las acciones de los personajes.",
      summary: "La ciudad antigua consta de zonas habitables en la superficie y una red de pistas subterráneas.",
      blueprintPromptBlock: "El escenario central es un almacén abandonado, una calle antigua y una estación de archivos cubierta.",
      existingJson: "{}",
      ragContext: "Sin referencias adicionales.",
    };
  }

  if (prompt.id === "world.layer.localize") {
    return {
      layerKey: "foundation",
      layerFields: ["background", "geography"],
      sourcePayloadJson: JSON.stringify({
        background: "Old city has a hidden clue network.",
        geography: "Warehouse district, old streets, archive station.",
      }),
    };
  }

  if (prompt.id === "writingFormula.extract.stream") {
    return {
      extractLevel: "standard",
      focusAreas: ["Ritmo", "Patrón de oración", "Sentido de la imagen"],
      sourceText: "Los pasos fuera de la puerta se detuvieron. Lin Che contuvo la respiración y rozó el código de la pared con las yemas de los dedos. De repente comprendió que esto no era una advertencia, sino una invitación.",
    };
  }

  if (prompt.id === "novel.chapter_editor.rewrite_candidates") {
    return {
      operation: "polish",
      operationLabel: "Polaco clips seleccionados",
      scope: "selection",
      customInstruction: "",
      selectedText: "Los pasos fuera de la puerta se detuvieron. Lin Che contuvo la respiración y rozó el código de la pared con las yemas de los dedos.",
      beforeParagraphs: ["En el antiguo almacén sólo quedaba una luz parpadeante."],
      afterParagraphs: ["Al segundo siguiente, la puerta de hierro se abrió suavemente desde el exterior."],
      goalSummary: "Deje que el protagonista descubra pistas clave y utilice la presión externa para crear tensión al final del capítulo.",
      chapterSummary: "El protagonista entra en un antiguo almacén, descubre un código secreto y se da cuenta de que los perseguidores se acercan.",
      styleSummary: "Detalles fríos, comedidos y claros en acción.",
      characterStateSummary: "El protagonista se muestra cauteloso pero aún está dispuesto a correr riesgos para avanzar en la investigación.",
      worldConstraintSummary: "Los códigos de la ciudad antigua son pistas reales, no alucinaciones ni graffitis comunes y corrientes.",
      macroContextSummary: "Este capítulo es responsable del primer umbral que involucra al protagonista en los secretos de la ciudad vieja.",
      resolvedIntentSummary: "Haz que la secuencia sea más natural y aumenta la tensión del suspenso.",
      constraintsText: "Los tres hechos de que el código existe, que alguien se acerca desde afuera de la puerta y que el protagonista está investigando no cambian.",
    };
  }

  return {
    goal: "Ver vista previa de palabras rápidas",
    messages: [],
    contextMode: "novel",
    novelId: "novel-1",
    chapterTitle: "Capítulo de ejemplo",
    chapterMission: "Deja que el protagonista descubra pistas clave.",
  };
}

interface UsePromptPreviewInput {
  prompt: PromptCatalogItem | null;
  entrypoint: string;
  novelId?: string;
  chapterId?: string;
  previewNovel?: PreviewNovel | null;
  previewChapter?: PreviewChapter | null;
  slotOverrides: PromptSlotDrafts;
  templateDraft?: PromptTemplateJson;
}

export function usePromptPreview(input: UsePromptPreviewInput) {
  const {
    chapterId,
    entrypoint,
    novelId,
    previewChapter,
    previewNovel,
    prompt,
    slotOverrides,
    templateDraft,
  } = input;
  const [streamedTestRun, setStreamedTestRun] = useState<PromptTestRunResult | null>(null);
  const streamedTestRunRef = useRef<{
    prompt: PromptCatalogItem;
    llm?: PromptTestRunPayload["llm"];
    startedAt: number;
  } | null>(null);
  const testRunStream = useSSE({
    onDone: (outputText) => {
      const current = streamedTestRunRef.current;
      if (!current) {
        return;
      }
      setStreamedTestRun({
        prompt: current.prompt,
        outputType: "text",
        output: outputText,
        outputText,
        messages: [],
        context: {
          blocks: [],
          selectedBlockIds: [],
          droppedBlockIds: [],
          summarizedBlockIds: [],
          estimatedInputTokens: 0,
        },
        meta: {
          provider: current.llm?.provider,
          model: current.llm?.model,
          latencyMs: Date.now() - current.startedAt,
        },
        diagnostics: {
          missingRequiredGroups: [],
          resolverErrors: [],
          notes: [],
        },
      });
    },
  });

  const buildPayload = useCallback((): PromptPreviewPayload => {
    if (!prompt) {
      throw new Error("Seleccione la palabra solicitada antes de generar una vista previa.");
    }
    const executionNovelId = novelId || undefined;
    const executionChapterId = novelId ? chapterId || previewChapter?.id : undefined;
    const hasRealChapterContext = Boolean(novelId && executionChapterId && previewChapter);
    const openingPreview = buildOpeningDirectionPreview(prompt);
    return {
      promptKey: prompt.key,
      promptInput: openingPreview?.promptInput ?? buildPreviewPromptInput(prompt, previewNovel, previewChapter),
      executionContext: {
        entrypoint,
        novelId: executionNovelId,
        chapterId: executionChapterId,
        userGoal: "Ver vista previa de palabras rápidas",
        resourceBindings: {
          novelId: executionNovelId,
          ...(executionChapterId ? { chapterId: executionChapterId } : {}),
        },
        metadata: openingPreview?.metadata ?? buildPreviewExecutionMetadata(prompt, hasRealChapterContext),
      },
      maxContextTokens: prompt.contextPolicy.maxTokensBudget,
      slotOverrides,
      templateDraft,
    };
  }, [
    chapterId,
    entrypoint,
    novelId,
    previewChapter,
    previewNovel,
    prompt,
    slotOverrides,
    templateDraft,
  ]);

  const previewMutation = useMutation({
    mutationFn: () => previewPrompt(buildPayload()),
  });

  const testRunMutation = useMutation({
    mutationFn: (llm?: PromptTestRunPayload["llm"]) => {
      const payload: PromptTestRunPayload = {
        ...buildPayload(),
        ...(llm ? { llm } : {}),
      };
      return testRunPrompt(payload);
    },
  });

  const hasTemplateDraft = Boolean(templateDraft);
  useEffect(() => {
    streamedTestRunRef.current = null;
    testRunStream.abort();
    previewMutation.reset();
    testRunMutation.reset();
    setStreamedTestRun(null);
  }, [prompt?.key, novelId, chapterId, entrypoint, hasTemplateDraft]);

  const generatePreview = useCallback(() => {
    previewMutation.mutate();
  }, [previewMutation]);

  const generateTestRun = useCallback((llm?: PromptTestRunPayload["llm"]) => {
    if (prompt?.outputType === "text") {
      testRunMutation.reset();
      setStreamedTestRun(null);
      streamedTestRunRef.current = { prompt, llm, startedAt: Date.now() };
      void testRunStream.start("/prompt-workbench/test-run/stream", {
        ...buildPayload(),
        ...(llm ? { llm } : {}),
      });
      return;
    }
    testRunMutation.mutate(llm);
  }, [buildPayload, prompt, testRunMutation, testRunStream]);

  return {
    generatePreview,
    generateTestRun,
    preview: previewMutation.data?.data ?? null,
    previewMutation,
    testRun: streamedTestRun ?? testRunMutation.data?.data ?? null,
    testRunStreamOutput: testRunStream.isStreaming ? testRunStream.content : "",
    isTestRunPending: testRunStream.isStreaming || testRunMutation.isPending,
    testRunError: (streamedTestRunRef.current ? testRunStream.error : null)
      ?? (testRunMutation.error instanceof Error ? testRunMutation.error.message : null),
    testRunMutation,
    resetPreview: previewMutation.reset,
  };
}
