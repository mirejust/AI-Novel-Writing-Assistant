import type { BookAnalysisSectionKey } from "@ai-novel/shared/types/bookAnalysis";

export const CHAPTER_HEADING_REGEX =
  /^\s*((序章|楔子|尾声|后记|番外|第[零一二三四五六七八九十百千万两\d]+[章节回卷部集篇]|chapter\s+\d+|chap\.\s*\d+)[^\n]{0,40})\s*$/i;
export const MIN_CHAPTER_DETECTION_COUNT = 3;
export const MIN_SEGMENT_BODY_LENGTH = 120;
export const MAX_SEGMENT_COUNT = 12;
export const MIN_SEGMENT_CHARS = 6_000;
export const TARGET_SEGMENT_CHARS = 10_000;
export const MAX_SEGMENT_CHARS = 16_000;
export const CHUNK_OVERLAP_CHARS = 400;
export const DEFAULT_ANALYSIS_TEMPERATURE = 0.3;
export const MIN_ANALYSIS_MAX_TOKENS = 256;
export const MAX_ANALYSIS_MAX_TOKENS = 32_768;
export const UNLIMITED_NOTES_MAX_TOKENS_CACHE_KEY = 0;

export const SECTION_PROMPTS: Record<BookAnalysisSectionKey, string> = {
  overview: "Genere una descripción general del libro que cubra: posicionamiento de una oración, etiquetas de tema, etiquetas de puntos de venta, lectores objetivo, fortalezas generales y deficiencias generales, y dé prioridad a juicios integrales de bajo riesgo basados ​​​​en las notas de todo el libro.",
  plot_structure: "Analice la estructura de la trama, que cubre: esquema de la trama principal, avance del escenario, escalada del conflicto, diseño de aspectos destacados, evaluación del ritmo, organización del capítulo, problemas estructurales, aspectos destacados estructurales y rutinas reutilizables.",
  timeline: "Analice la línea de tiempo de la historia, que cubre: nodos de tiempo clave, secuencia de eventos, división del escenario de la línea principal, nodos de cambio de estado de los personajes, lapso de tiempo y riesgos de ritmo.",
  character_system: "Analice el sistema de personajes, que cubre: posicionamiento del protagonista, rol secundario y funciones del villano, red de relaciones, arco de crecimiento, aspectos destacados del personaje y claridad de la división del trabajo.",
  worldbuilding: "Analice la visión del mundo y el entorno, abarcando: el marco mundial, el sistema de reglas, los aspectos más destacados del entorno, cómo el entorno sirve a la trama y los problemas o riesgos del entorno.",
  themes: "Analice la expresión del tema, abarcando: tema central, título, tono emocional, motivo simbólico, método de presentación del tema y riesgos de expresión del tema.",
  style_technique: "Analice el estilo y las técnicas de escritura, que cubren: perspectiva narrativa, estilo de lenguaje, método de descripción, características del diálogo, control del ritmo, diseño de gancho y métodos de escritura reutilizables.",
  market_highlights: "Analice los puntos de venta comerciales, que cubren: disfrute del lector, impulso de clics, puntos de venta de los personajes, puntos de venta del tema, puntos de coincidencia del lector objetivo y riesgos de comercialización.",
};
