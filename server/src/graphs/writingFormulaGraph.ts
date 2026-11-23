import { Annotation, END, START, StateGraph } from "@langchain/langgraph";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";

export const WritingFormulaGraphAnnotation = Annotation.Root({
  sourceText: Annotation<string>(),
  extractLevel: Annotation<string>(),
  focusAreas: Annotation<string[]>(),
  styleAnalysis: Annotation<string>(),
  techniqueExtraction: Annotation<string>(),
  formulaMarkdown: Annotation<string>(),
  formulaStructured: Annotation<Record<string, string | null>>(),
  error: Annotation<string | undefined>(),
});

export type WritingFormulaGraphState = typeof WritingFormulaGraphAnnotation.State;
export type WritingFormulaGraphInput = Pick<
  WritingFormulaGraphState,
  "sourceText" | "extractLevel" | "focusAreas"
>;
export type WritingFormulaGraphOutput = Pick<
  WritingFormulaGraphState,
  "styleAnalysis" | "techniqueExtraction" | "formulaMarkdown" | "formulaStructured" | "error"
>;

async function analyzeStyle(state: WritingFormulaGraphState, llm: BaseChatModel) {
  try {
    const result = await llm.invoke([
      new SystemMessage("Eres un experto en análisis de estilo de escritura. Analice el estilo del lenguaje, la perspectiva narrativa y el ritmo."),
      new HumanMessage(state.sourceText),
    ]);
    const text = typeof result.content === "string" ? result.content : JSON.stringify(result.content);
    return { styleAnalysis: text };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "El análisis de estilo falló." };
  }
}

async function extractTechniques(state: WritingFormulaGraphState, llm: BaseChatModel) {
  try {
    const result = await llm.invoke([
      new SystemMessage("Extraiga habilidades de escritura reproducibles y resuma las reglas."),
      new HumanMessage(
        `Análisis de estilo:
${state.styleAnalysis}
Centrarse en las dimensiones:${state.focusAreas.join(", ")}`,
      ),
    ]);
    const text = typeof result.content === "string" ? result.content : JSON.stringify(result.content);
    return { techniqueExtraction: text };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Falló la extracción de la punta." };
  }
}

async function buildFormula(state: WritingFormulaGraphState, llm: BaseChatModel) {
  try {
    const result = await llm.invoke([
      new SystemMessage("Organice los resultados del análisis en un documento de fórmula de escritura de Markdown."),
      new HumanMessage(
        `Análisis de estilo:
${state.styleAnalysis}

Extracción de puntas:
${state.techniqueExtraction}

Por favor organice según los siguientes encabezados:
## Posicionamiento de estilo general
## Habilidades básicas de escritura (incluidos ejemplos de textos originales)
## Fórmula de escritura reproducible
## Guía de aplicación (cómo escribir texto nuevo usando esta fórmula)`,
      ),
    ]);
    const text = typeof result.content === "string" ? result.content : JSON.stringify(result.content);
    return { formulaMarkdown: text };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Error al crear el documento de fórmula." };
  }
}

function extractSection(content: string, heading: string): string | null {
  const regex = new RegExp(`##\\s*${heading}[\\s\\S]*?(?=\\n##\\s|$)`, "i");
  const matched = content.match(regex)?.[0];
  if (!matched) {
    return null;
  }
  return matched.replace(new RegExp(`##\\s*${heading}`, "i"), "").trim();
}

async function structureFormula(state: WritingFormulaGraphState) {
  try {
    return {
      formulaStructured: {
        style: extractSection(state.formulaMarkdown, "posicionamiento general del estilo"),
        formulaDescription: extractSection(state.formulaMarkdown, "Habilidades básicas de escritura (incluidos ejemplos de textos originales)"),
        formulaSteps: extractSection(state.formulaMarkdown, "Fórmulas de escritura reproducibles"),
        applicationTips: extractSection(state.formulaMarkdown, "Guía de aplicación (cómo escribir texto nuevo usando esta fórmula)"),
      },
    };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "La estructuración de la fórmula falló." };
  }
}

export function createWritingFormulaGraph(llm: BaseChatModel) {
  return new StateGraph(WritingFormulaGraphAnnotation)
    .addNode("analyzeStyle", (state) => analyzeStyle(state, llm))
    .addNode("extractTechniques", (state) => extractTechniques(state, llm))
    .addNode("buildFormula", (state) => buildFormula(state, llm))
    .addNode("structureFormula", structureFormula)
    .addEdge(START, "analyzeStyle")
    .addConditionalEdges("analyzeStyle", (state) => (state.error ? END : "extractTechniques"))
    .addConditionalEdges("extractTechniques", (state) => (state.error ? END : "buildFormula"))
    .addConditionalEdges("buildFormula", (state) => (state.error ? END : "structureFormula"))
    .addEdge("structureFormula", END)
    .compile({
      name: "writing-formula-graph",
    });
}
