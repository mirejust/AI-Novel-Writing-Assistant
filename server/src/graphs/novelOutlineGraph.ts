import { Annotation, END, START, StateGraph } from "@langchain/langgraph";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";

export const NovelOutlineGraphAnnotation = Annotation.Root({
  novelTitle: Annotation<string>(),
  novelDescription: Annotation<string>(),
  genre: Annotation<string>(),
  characters: Annotation<string[]>(),
  themeAnalysis: Annotation<string>(),
  conflictDesign: Annotation<string>(),
  outline: Annotation<string>(),
  structuredOutline: Annotation<unknown>(),
  provider: Annotation<string>(),
  model: Annotation<string>(),
  error: Annotation<string | undefined>(),
});

export type NovelOutlineGraphState = typeof NovelOutlineGraphAnnotation.State;
export type NovelOutlineGraphInput = Pick<
  NovelOutlineGraphState,
  "novelTitle" | "novelDescription" | "genre" | "characters" | "provider" | "model"
>;
export type NovelOutlineGraphOutput = Pick<
  NovelOutlineGraphState,
  "themeAnalysis" | "conflictDesign" | "outline" | "structuredOutline" | "error"
>;

async function analyzeTheme(state: NovelOutlineGraphState, llm: BaseChatModel) {
  try {
    const result = await llm.invoke([
      new SystemMessage("Eres un experto en analizar la temática de las novelas. Por favor refine el tema y la idea."),
      new HumanMessage(
        `título:${state.novelTitle}
Introducción:${state.novelDescription}
tipo:${state.genre}
Role:${state.characters.join(",") || "Sin datos"}
Por favor envíe el análisis del tema.`,
      ),
    ]);
    const text = typeof result.content === "string" ? result.content : JSON.stringify(result.content);
    return { themeAnalysis: text };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "El análisis del tema falló." };
  }
}

async function designConflicts(state: NovelOutlineGraphState, llm: BaseChatModel) {
  try {
    const result = await llm.invoke([
      new SystemMessage("Usted es un experto en diseño de conflictos, genere entre 3 y 5 conflictos centrales."),
      new HumanMessage(
        `Análisis temático:
${state.themeAnalysis}
Diseñe nodos de conflicto y puntos de inflexión.`,
      ),
    ]);
    const text = typeof result.content === "string" ? result.content : JSON.stringify(result.content);
    return { conflictDesign: text };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "El diseño del conflicto falla." };
  }
}

async function generateOutline(state: NovelOutlineGraphState, llm: BaseChatModel) {
  try {
    const result = await llm.invoke([
      new SystemMessage("Eres un planificador novedoso, genera una dirección de desarrollo completa."),
      new HumanMessage(
        `Análisis temático:
${state.themeAnalysis}

Diseño de conflictos:
${state.conflictDesign}

Por favor envíe la dirección de desarrollo completa.`,
      ),
    ]);
    const text = typeof result.content === "string" ? result.content : JSON.stringify(result.content);
    return { outline: text };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "El desarrollo avanza hacia el fracaso generativo." };
  }
}

async function structureOutline(state: NovelOutlineGraphState, llm: BaseChatModel) {
  try {
    const result = await llm.invoke([
      new SystemMessage("Convierta el esquema de su novela en un plan de capítulo JSON."),
      new HumanMessage(
        `Sinopsis de la novela:
${state.outline}
Solo genera una matriz JSON.`,
      ),
    ]);
    const text = typeof result.content === "string" ? result.content : JSON.stringify(result.content);
    const normalized = text.replace(/```json|```/g, "").trim();
    return { structuredOutline: JSON.parse(normalized) };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Falló la generación del esquema estructurado." };
  }
}

export function createNovelOutlineGraph(llm: BaseChatModel) {
  return new StateGraph(NovelOutlineGraphAnnotation)
    .addNode("analyzeTheme", (state) => analyzeTheme(state, llm))
    .addNode("designConflicts", (state) => designConflicts(state, llm))
    .addNode("generateOutline", (state) => generateOutline(state, llm))
    .addNode("structureOutline", (state) => structureOutline(state, llm))
    .addEdge(START, "analyzeTheme")
    .addConditionalEdges("analyzeTheme", (state) => (state.error ? END : "designConflicts"))
    .addConditionalEdges("designConflicts", (state) => (state.error ? END : "generateOutline"))
    .addConditionalEdges("generateOutline", (state) => (state.error ? END : "structureOutline"))
    .addEdge("structureOutline", END)
    .compile({
      name: "novel-outline-graph",
    });
}
