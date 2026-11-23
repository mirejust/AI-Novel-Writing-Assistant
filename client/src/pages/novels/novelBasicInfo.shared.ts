import type { BookAnalysisSectionKey } from "@ai-novel/shared/types/bookAnalysis";
import { formatCommercialTagsInput, normalizeCommercialTags } from "@ai-novel/shared/types/novelFraming";
import type { WritingPlatformPreference } from "@ai-novel/shared/types/writingPlatform";
import type { PowerSystemPreference } from "@ai-novel/shared/types/novelResourceRecommendation";

export interface NovelBasicFormState {
  title: string;
  penName: string;
  description: string;
  targetAudience: string;
  bookSellingPoint: string;
  competingFeel: string;
  first30ChapterPromise: string;
  commercialTagsText: string;
  genreId: string;
  primaryStoryModeId: string;
  secondaryStoryModeId: string;
  worldId: string;
  status: "draft" | "published";
  writingMode: "original" | "continuation";
  projectMode: "ai_led" | "co_pilot" | "draft_mode" | "auto_pipeline";
  readerChannelPreference: "ai_judge" | "male_oriented" | "female_oriented" | "general";
  powerSystemPreference: PowerSystemPreference;
  writingPlatformPreference: WritingPlatformPreference;
  narrativePov: "first_person" | "third_person" | "mixed";
  pacePreference: "slow" | "balanced" | "fast";
  styleTone: string;
  emotionIntensity: "low" | "medium" | "high";
  aiFreedom: "low" | "medium" | "high";
  postGenerationStyleReviewEnabled: boolean;
  defaultChapterLength: number;
  estimatedChapterCount: number;
  userPreferredVolumeCount?: number;
  estimatedChapterCountSource?: "default" | "user";
  projectStatus: "not_started" | "in_progress" | "completed" | "rework" | "blocked";
  storylineStatus: "not_started" | "in_progress" | "completed" | "rework" | "blocked";
  outlineStatus: "not_started" | "in_progress" | "completed" | "rework" | "blocked";
  resourceReadyScore: number;
  continuationSourceType: "novel" | "knowledge_document";
  sourceNovelId: string;
  sourceKnowledgeDocumentId: string;
  continuationBookAnalysisId: string;
  continuationBookAnalysisSections: BookAnalysisSectionKey[];
  referenceBookAnalysisId: string;
  referenceBookAnalysisSections: BookAnalysisSectionKey[];
}

export interface BasicInfoOption<T extends string> {
  value: T;
  label: string;
  summary: string;
  recommended?: boolean;
}

export const DEFAULT_ESTIMATED_CHAPTER_COUNT = 80;

export const WRITING_MODE_OPTIONS: BasicInfoOption<NovelBasicFormState["writingMode"]>[] = [
  {
    value: "original",
    label: "Original",
    summary: "Crea mundos, personajes e historias desde cero, adecuados para la mayoría de proyectos nuevos.",
    recommended: true,
  },
  {
    value: "continuation",
    label: "Continuar escribiendo",
    summary: "Continúe creando basándose en novelas o documentos de conocimiento existentes, y en el futuro se dará prioridad a inyectar configuraciones existentes y contenido de libros desempaquetados.",
  },
];

export const PROJECT_MODE_OPTIONS: BasicInfoOption<NovelBasicFormState["projectMode"]>[] = [
  {
    value: "co_pilot",
    label: "Copiloto de IA",
    summary: "Usted establece la dirección y la IA proporciona planos y borradores, lo que es adecuado para el pulido temprano y la toma de decisiones manual de alta frecuencia.",
    recommended: true,
  },
  {
    value: "ai_led",
    label: "La IA toma el control",
    summary: "La IA es responsable de la promoción principal y usted revisa en los nodos clave. Es adecuado para proyectos con objetivos claros.",
  },
  {
    value: "draft_mode",
    label: "Borrador primero",
    summary: "En primer lugar, producir texto y dirección rápidamente, con limitaciones estructurales débiles, adecuados para probar historias y encontrar sentimientos.",
  },
  {
    value: "auto_pipeline",
    label: "Tubería primero",
    summary: "Es adecuado para el avance continuo a través de la planificación, generación, auditoría y reparación una vez que la configuración esté relativamente completa.",
  },
];

export const READER_CHANNEL_OPTIONS: BasicInfoOption<NovelBasicFormState["readerChannelPreference"]>[] = [
  {
    value: "ai_judge",
    label: "Juicio de IA",
    summary: "Deje que la IA determine la tendencia del canal de lectores predeterminado en función del tema, los puntos de venta y las ideas iniciales, que es adecuada como opción predeterminada.",
    recommended: true,
  },
  {
    value: "male_oriented",
    label: "Frecuencia masculina",
    summary: "Se pone más énfasis en los objetivos, las actualizaciones, la competencia, la realización de puntos interesantes y la promoción de eventos externos.",
  },
  {
    value: "female_oriented",
    label: "Frecuencia femenina",
    summary: "Se pone más énfasis en las líneas de relación, la atracción emocional, la selección de personajes y la delicada retroalimentación escenificada.",
  },
  {
    value: "general",
    label: "Lector general/ilimitado",
    summary: "No limite las tendencias del canal y deje que la IA priorice la planificación en función de la historia misma y las descripciones de los lectores objetivo.",
  },
];

export const POWER_SYSTEM_OPTIONS: BasicInfoOption<NovelBasicFormState["powerSystemPreference"]>[] = [
  {
    value: "ai_recommend",
    label: "Recomendación de IA",
    summary: "La IA determinará si se necesita el sistema de poder de combate; no generará niveles cuando no sea necesario y no organizará por la fuerza parcelas de mejora.",
    recommended: true,
  },
  {
    value: "none",
    label: "No es necesario",
    summary: "No hay reinos, niveles o líneas de mejora, lo que permite que el conflicto sea impulsado por las elecciones de los personajes, las relaciones, la información y las condiciones del mundo real.",
  },
  {
    value: "soft",
    label: "Suavidad",
    summary: "Permite diferencias de capacidad, costos y restricciones, pero no establece una jerarquía clara.",
  },
  {
    value: "ranked",
    label: "Aclarar el nivel",
    summary: "Establece un sistema jerárquico con orden, límites y costos, y úsalo para el crecimiento del personaje y el avance de la trama.",
  },
];

export const WRITING_PLATFORM_OPTIONS: BasicInfoOption<NovelBasicFormState["writingPlatformPreference"]>[] = [
  { value: "ai_recommend", label: "Recomendación de IA", summary: "AI recomienda la redacción de plataformas basada en la experiencia de la historia, la audiencia y los métodos de avance a largo plazo.", recommended: true },
  { value: "fanqie_free", label: "Artículos web sin tomate", summary: "Entrada rápida, segmentos móviles cortos, alto conflicto y clara recompensa." },
  { value: "qidian_male", label: "Canal masculino qidian", summary: "Objetivos de crecimiento, cambios en las capacidades de los recursos, actualizaciones estables y presagios de cumplimiento." },
  { value: "jinjiang_female", label: "Canal femenino de jinjiang", summary: "Relaciones de personajes, causa y efecto emocional, voces de personajes y cambios en el estado de las relaciones." },
];

export const POV_OPTIONS: BasicInfoOption<NovelBasicFormState["narrativePov"]>[] = [
  {
    value: "third_person",
    label: "Tercera persona",
    summary: "El más estable, adecuado para múltiples personajes y líneas principales complejas.",
    recommended: true,
  },
  {
    value: "first_person",
    label: "Primera persona",
    summary: "El sentido de sustitución es fuerte, pero la información es limitada, lo que es adecuado para narrativas desde la perspectiva de un protagonista fuerte.",
  },
  {
    value: "mixed",
    label: "Voz mixta",
    summary: "Más flexible, pero más fácil de perder el control, adecuado para proyectos maduros.",
  },
];

export const PACE_OPTIONS: BasicInfoOption<NovelBasicFormState["pacePreference"]>[] = [
  {
    value: "balanced",
    label: "Equilibrado",
    summary: "Tiene tanto avance como presagio, por lo que es adecuado como opción predeterminada.",
    recommended: true,
  },
  {
    value: "slow",
    label: "Ritmo lento",
    summary: "Más énfasis en el presagio, la atmósfera y la fermentación emocional.",
  },
  {
    value: "fast",
    label: "Ritmo rápido",
    summary: "Más impulsado por eventos, ganchos y avance continuo.",
  },
];

export const EMOTION_OPTIONS: BasicInfoOption<NovelBasicFormState["emotionIntensity"]>[] = [
  {
    value: "medium",
    label: "Concentración emocional media",
    summary: "Conserva la ondulación sin exagerar, adecuada por defecto.",
    recommended: true,
  },
  {
    value: "low",
    label: "Baja concentración emocional",
    summary: "Más sobrio, adecuado para narrativas tranquilas o obras más racionales.",
  },
  {
    value: "high",
    label: "Alta concentración emocional",
    summary: "Se pone más énfasis en explosiones, conflictos y escenas muy estimulantes.",
  },
];

export const AI_FREEDOM_OPTIONS: BasicInfoOption<NovelBasicFormState["aiFreedom"]>[] = [
  {
    value: "medium",
    label: "Grados medios de libertad",
    summary: "Permite que la IA agregue detalles y avances locales dentro de la configuración, lo que la hace adecuada como predeterminada.",
    recommended: true,
  },
  {
    value: "low",
    label: "Bajos grados de libertad",
    summary: "Ejecutar estrictamente de acuerdo con la configuración y los planes, adecuado para el control de etapa temprana.",
  },
  {
    value: "high",
    label: "Alto grado de libertad",
    summary: "Permite que la IA expanda activamente la trama y los detalles, lo que es adecuado para proyectos estables en etapa intermedia o tardía.",
  },
];

export const PUBLICATION_STATUS_OPTIONS: BasicInfoOption<NovelBasicFormState["status"]>[] = [
  {
    value: "draft",
    label: "Borrador",
    summary: "Aún en etapa de desarrollo y pulido, apto para la mayoría de proyectos.",
    recommended: true,
  },
  {
    value: "published",
    label: "Publicado",
    summary: "Se utiliza para marcar obras que han sido completadas o lanzadas al público.",
  },
];

export const PROJECT_STATUS_OPTIONS: Array<{ value: NovelBasicFormState["projectStatus"]; label: string }> = [
  { value: "not_started", label: "Sin empezar" },
  { value: "in_progress", label: "En curso" },
  { value: "completed", label: "Completado" },
  { value: "rework", label: "Retrabajar" },
  { value: "blocked", label: "Bloquear" },
];

export const BASIC_INFO_FIELD_HINTS = {
  penName: "Junto con la portada se generará el seudónimo del autor. Si se deja en blanco, solo aparecerá el título del libro en la portada y el nombre del autor no se inventará automáticamente.",
  writingMode: "Decida si comenzar el proyecto desde cero o aprovechar el trabajo existente. Afecta directamente a qué fuentes contextuales se priorizan para su uso posterior.",
  targetAudience: "Explique a quién está destinado principalmente este libro. No importa si no sabes escribir retratos de personas profesionales, simplemente descríbelos intuitivamente.",
  bookSellingPoint: "Anota claramente los puntos más apasionantes del libro, como el tirón de la relación, la emoción del contraataque, el avance del suspense o la frescura del escenario.",
  competingFeel: "Escribir para crear una experiencia de lectura con la que los lectores se identifiquen no requiere que imites obras específicas.",
  first30ChapterPromise: "Escriba claramente lo que quiere que los lectores vean, se sientan felices y crean en los primeros 30 capítulos.",
  commercialTagsText: "Simplemente use comas para separar de 3 a 6 etiquetas, como contraataque, conflicto fuerte, suspenso y juego en el lugar de trabajo.",
  projectMode: "Decida cómo trabajan juntos usted y la IA. Afectará qué pasos posteriores se avanzan automáticamente y qué pasos dependen más de la confirmación manual.",
  readerChannelPreference: "Ayude a la IA a determinar el punto de interés predeterminado, el centro de gravedad emocional y el peso de la línea de relación. Mantenga el juicio de la IA cuando no esté seguro.",
  powerSystemPreference: "Decide si este libro requiere potencia explícita o crecimiento nivelado. Temas como la realidad, el suspenso y el romance también pueden omitirse por completo.",
  narrativePov: "Decidir qué perspectiva narrativa utilizar de forma predeterminada para la generación de capítulos también afecta la forma en que se distribuye la información.",
  pacePreference: "Decidir si centrarse en el presagio o el avance al planificar los capítulos afectará la densidad de la escena y la fuerza del gancho.",
  emotionIntensity: "Para determinar la frecuencia de los arrebatos emocionales y los conflictos durante la generación siguiente, cuanto más alto no es mejor.",
  aiFreedom: "Determinar hasta qué punto la IA puede desviarse de los planes y entornos establecidos. Se recomienda mantenerlo bajo o medio en la etapa inicial.",
  postGenerationStyleReviewEnabled: "Verifique la redacción válida y las reglas anti-IA en la verificación del capítulo y revise el texto para seguir esta estrategia creativa. Después de desactivarlo, la generación de texto todavía utiliza escritura y mensajes anti-IA.",
  defaultChapterLength: "Este es un recuento de palabras de referencia al planificar y generar capítulos, no un límite estricto. Las recomendaciones comunes son de 2500 a 3500.",
  estimatedChapterCount: "Este es el número total estimado de capítulos para el proyecto, que se utilizará como referencia para el esquema estructurado, los puntos de la trama y el alcance predeterminado del proyecto. No es un límite estricto.",
  resourceReadyScore: "Se utiliza para marcar si los escenarios, los personajes y la información de la historia principal son suficientes. Cuanto mayor sea el valor, más adecuado será entrar en la etapa de producción automatizada.",
  styleTone: "Simplemente escriba algunas palabras clave, como frialdad, moderación y humor negro. Afecta el estilo del lenguaje generado.",
  genreId: "Responda \"¿Qué tipo de libro es este\" según el tema, como cultivar la inmortalidad, la ciudad y la ficción histórica? Afectará la planificación, el título y la tendencia general del punto de venta, por lo que se recomienda determinarlo lo antes posible.",
  primaryStoryModeId: "El modo de promoción principal responde \"¿En qué se basa este libro para continuar promoviendo y logrando su cumplimiento?\", como el flujo del sistema, el flujo invencible y el flujo agrícola. La planificación y generación posteriores lo obedecerán primero.",
  secondaryStoryModeId: "El modo de promoción secundario solo es responsable de complementar el sabor, como superponer el sentido de gestión de la tienda en la curación diaria y superponer el sentido de chaleco en un flujo invencible, y no puede cubrir los límites del modo principal.",
  worldId: "Aquí sólo se registra una muestra de referencia para facilitar la inicialización del mundo de este libro. La generación novel dará prioridad a la lectura del contenido de la tarjeta \"Mundo del libro\" en la parte superior de la página.",
  status: "Es solo una marca del ciclo de vida laboral y no afecta las capacidades creativas básicas, pero afectará la lista y el estado de gestión del proyecto.",
  continuationSourceType: "Al continuar, elija si desea citar la novela en el sitio o la versión del documento en la base de conocimientos.",
  continuationBookAnalysis: "El contenido del libro dividido servirá como un contexto estructurado de alto peso, adecuado para que proyectos continuos mantengan un estilo y un entorno consistentes.",
} satisfies Record<string, string>;

export function createDefaultNovelBasicFormState(): NovelBasicFormState {
  return {
    title: "",
    penName: "",
    description: "",
    targetAudience: "",
    bookSellingPoint: "",
    competingFeel: "",
    first30ChapterPromise: "",
    commercialTagsText: "",
    genreId: "",
    primaryStoryModeId: "",
    secondaryStoryModeId: "",
    worldId: "",
    status: "draft",
    writingMode: "original",
    projectMode: "co_pilot",
    readerChannelPreference: "ai_judge",
    powerSystemPreference: "ai_recommend",
    writingPlatformPreference: "ai_recommend",
    narrativePov: "third_person",
    pacePreference: "balanced",
    styleTone: "",
    emotionIntensity: "medium",
    aiFreedom: "medium",
    postGenerationStyleReviewEnabled: true,
    defaultChapterLength: 2800,
    estimatedChapterCount: DEFAULT_ESTIMATED_CHAPTER_COUNT,
    estimatedChapterCountSource: "default",
    projectStatus: "not_started",
    storylineStatus: "not_started",
    outlineStatus: "not_started",
    resourceReadyScore: 0,
    continuationSourceType: "novel",
    sourceNovelId: "",
    sourceKnowledgeDocumentId: "",
    continuationBookAnalysisId: "",
    continuationBookAnalysisSections: [],
    referenceBookAnalysisId: "",
    referenceBookAnalysisSections: [],
  };
}

export function authorEstimatedChapterCount(form: NovelBasicFormState): number | undefined {
  return form.estimatedChapterCountSource === "default" ? undefined : form.estimatedChapterCount;
}

export function patchNovelBasicForm(
  previous: NovelBasicFormState,
  patch: Partial<Omit<NovelBasicFormState, "estimatedChapterCount">> & { estimatedChapterCount?: number | null },
): NovelBasicFormState {
  const next: NovelBasicFormState = {
    ...previous,
    ...patch,
    estimatedChapterCount: patch.estimatedChapterCount ?? previous.estimatedChapterCount,
  };
  // Persisted AI-recommended counts are null, not an explicit author choice.
  if (Object.hasOwn(patch, "estimatedChapterCount") && patch.estimatedChapterCount == null) {
    next.estimatedChapterCount = DEFAULT_ESTIMATED_CHAPTER_COUNT;
    next.estimatedChapterCountSource = "default";
  } else if (patch.estimatedChapterCount !== undefined && patch.estimatedChapterCountSource === undefined) {
    next.estimatedChapterCountSource = "user";
  }
  if (
    next.primaryStoryModeId
    && next.secondaryStoryModeId
    && next.primaryStoryModeId === next.secondaryStoryModeId
  ) {
    next.secondaryStoryModeId = "";
  }
  if (next.writingMode === "original") {
    next.sourceNovelId = "";
    next.sourceKnowledgeDocumentId = "";
    next.continuationBookAnalysisId = "";
    next.continuationBookAnalysisSections = [];
  } else {
    next.referenceBookAnalysisId = "";
    next.referenceBookAnalysisSections = [];
    if (next.continuationSourceType === "novel") {
      next.sourceKnowledgeDocumentId = "";
    } else if (next.continuationSourceType === "knowledge_document") {
      next.sourceNovelId = "";
    }
  }
  if (
    patch.continuationSourceType !== undefined
    && patch.continuationSourceType !== previous.continuationSourceType
    && patch.continuationBookAnalysisId === undefined
  ) {
    next.continuationBookAnalysisId = "";
    next.continuationBookAnalysisSections = [];
  }
  if (
    next.continuationSourceType === "novel"
    && patch.sourceNovelId !== undefined
    && patch.sourceNovelId !== previous.sourceNovelId
    && patch.continuationBookAnalysisId === undefined
  ) {
    next.continuationBookAnalysisId = "";
    next.continuationBookAnalysisSections = [];
  }
  if (
    next.continuationSourceType === "knowledge_document"
    && patch.sourceKnowledgeDocumentId !== undefined
    && patch.sourceKnowledgeDocumentId !== previous.sourceKnowledgeDocumentId
    && patch.continuationBookAnalysisId === undefined
  ) {
    next.continuationBookAnalysisId = "";
    next.continuationBookAnalysisSections = [];
  }
  if (patch.continuationBookAnalysisId !== undefined && !patch.continuationBookAnalysisId) {
    next.continuationBookAnalysisSections = [];
  }
  return next;
}

export function buildNovelCreatePayload(basicForm: NovelBasicFormState) {
  const commercialTags = normalizeCommercialTags(basicForm.commercialTagsText);
  return {
    title: basicForm.title.trim(),
    penName: basicForm.penName.trim() || undefined,
    description: basicForm.description.trim() || undefined,
    targetAudience: basicForm.targetAudience.trim() || undefined,
    bookSellingPoint: basicForm.bookSellingPoint.trim() || undefined,
    competingFeel: basicForm.competingFeel.trim() || undefined,
    first30ChapterPromise: basicForm.first30ChapterPromise.trim() || undefined,
    commercialTags: commercialTags.length > 0 ? commercialTags : undefined,
    genreId: basicForm.genreId || undefined,
    primaryStoryModeId: basicForm.primaryStoryModeId || undefined,
    secondaryStoryModeId: basicForm.secondaryStoryModeId || undefined,
    worldId: basicForm.worldId || undefined,
    writingMode: basicForm.writingMode,
    projectMode: basicForm.projectMode,
    narrativePov: basicForm.narrativePov,
    pacePreference: basicForm.pacePreference,
    styleTone: basicForm.styleTone.trim() || undefined,
    emotionIntensity: basicForm.emotionIntensity,
    aiFreedom: basicForm.aiFreedom,
    postGenerationStyleReviewEnabled: basicForm.postGenerationStyleReviewEnabled,
    defaultChapterLength: basicForm.defaultChapterLength,
    estimatedChapterCount: basicForm.estimatedChapterCount,
    projectStatus: basicForm.projectStatus,
    storylineStatus: basicForm.storylineStatus,
    outlineStatus: basicForm.outlineStatus,
    resourceReadyScore: basicForm.resourceReadyScore,
    sourceNovelId: basicForm.writingMode === "continuation" && basicForm.continuationSourceType === "novel"
      ? (basicForm.sourceNovelId || undefined)
      : undefined,
    sourceKnowledgeDocumentId: basicForm.writingMode === "continuation" && basicForm.continuationSourceType === "knowledge_document"
      ? (basicForm.sourceKnowledgeDocumentId || undefined)
      : undefined,
    continuationBookAnalysisId: basicForm.writingMode === "continuation"
      && (
        (basicForm.continuationSourceType === "novel" && Boolean(basicForm.sourceNovelId))
        || (basicForm.continuationSourceType === "knowledge_document" && Boolean(basicForm.sourceKnowledgeDocumentId))
      )
      ? (basicForm.continuationBookAnalysisId || undefined)
      : undefined,
    continuationBookAnalysisSections:
      basicForm.writingMode === "continuation"
        && (
          (basicForm.continuationSourceType === "novel" && Boolean(basicForm.sourceNovelId))
          || (basicForm.continuationSourceType === "knowledge_document" && Boolean(basicForm.sourceKnowledgeDocumentId))
        )
        && basicForm.continuationBookAnalysisId
        ? (basicForm.continuationBookAnalysisSections.length > 0 ? basicForm.continuationBookAnalysisSections : undefined)
        : undefined,
    referenceBookAnalysisId:
      basicForm.writingMode === "original" ? (basicForm.referenceBookAnalysisId || undefined) : undefined,
    referenceBookAnalysisSections:
      basicForm.writingMode === "original" && basicForm.referenceBookAnalysisId
        ? (basicForm.referenceBookAnalysisSections.length > 0 ? basicForm.referenceBookAnalysisSections : undefined)
        : undefined,
  };
}

export function buildNovelUpdatePayload(basicForm: NovelBasicFormState) {
  const commercialTags = normalizeCommercialTags(basicForm.commercialTagsText);
  return {
    title: basicForm.title,
    penName: basicForm.penName.trim() || null,
    description: basicForm.description,
    targetAudience: basicForm.targetAudience.trim() || null,
    bookSellingPoint: basicForm.bookSellingPoint.trim() || null,
    competingFeel: basicForm.competingFeel.trim() || null,
    first30ChapterPromise: basicForm.first30ChapterPromise.trim() || null,
    commercialTags: commercialTags.length > 0 ? commercialTags : null,
    genreId: basicForm.genreId || null,
    primaryStoryModeId: basicForm.primaryStoryModeId || null,
    secondaryStoryModeId: basicForm.secondaryStoryModeId || null,
    worldId: basicForm.worldId || null,
    status: basicForm.status,
    writingMode: basicForm.writingMode,
    projectMode: basicForm.projectMode,
    narrativePov: basicForm.narrativePov,
    pacePreference: basicForm.pacePreference,
    styleTone: basicForm.styleTone || null,
    emotionIntensity: basicForm.emotionIntensity,
    aiFreedom: basicForm.aiFreedom,
    postGenerationStyleReviewEnabled: basicForm.postGenerationStyleReviewEnabled,
    defaultChapterLength: basicForm.defaultChapterLength,
    estimatedChapterCount: basicForm.estimatedChapterCount,
    projectStatus: basicForm.projectStatus,
    storylineStatus: basicForm.storylineStatus,
    outlineStatus: basicForm.outlineStatus,
    resourceReadyScore: basicForm.resourceReadyScore,
    sourceNovelId: basicForm.writingMode === "continuation" && basicForm.continuationSourceType === "novel"
      ? (basicForm.sourceNovelId || null)
      : null,
    sourceKnowledgeDocumentId: basicForm.writingMode === "continuation" && basicForm.continuationSourceType === "knowledge_document"
      ? (basicForm.sourceKnowledgeDocumentId || null)
      : null,
    continuationBookAnalysisId: basicForm.writingMode === "continuation"
      && (
        (basicForm.continuationSourceType === "novel" && Boolean(basicForm.sourceNovelId))
        || (basicForm.continuationSourceType === "knowledge_document" && Boolean(basicForm.sourceKnowledgeDocumentId))
      )
      ? (basicForm.continuationBookAnalysisId || null)
      : null,
    continuationBookAnalysisSections:
      basicForm.writingMode === "continuation"
        && (
          (basicForm.continuationSourceType === "novel" && Boolean(basicForm.sourceNovelId))
          || (basicForm.continuationSourceType === "knowledge_document" && Boolean(basicForm.sourceKnowledgeDocumentId))
        )
        && basicForm.continuationBookAnalysisId
        ? (basicForm.continuationBookAnalysisSections.length > 0 ? basicForm.continuationBookAnalysisSections : null)
        : null,
    referenceBookAnalysisId:
      basicForm.writingMode === "original" ? (basicForm.referenceBookAnalysisId || null) : null,
    referenceBookAnalysisSections:
      basicForm.writingMode === "original" && basicForm.referenceBookAnalysisId
        ? (basicForm.referenceBookAnalysisSections.length > 0 ? basicForm.referenceBookAnalysisSections : null)
        : null,
  };
}

export { formatCommercialTagsInput };
