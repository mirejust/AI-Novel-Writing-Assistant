import type { PromptCatalogItem } from "@/api/promptWorkbench";

export function buildOpeningDirectionPreview(prompt: Pick<PromptCatalogItem, "id" | "version">) {
  if (prompt.id !== "novel.director.direction_pair" && prompt.id !== "novel.director.candidates") {
    return undefined;
  }
  const idea = "Los guardias fronterizos escriben cartas al general a casa todos los días. El paso de montaña está a punto de congelarse y estas cartas todavía esperan en la ciudad.";
  const promptInput = { idea, context: {}, count: 2, batches: [], presets: [] };
  const directions = {
    A: { choice: "Finge recibir la carta y descubre quién responde a los soldados caídos.", engine: "Cada vez que un peón toma prestado un nombre para recibir una carta, existe un riesgo adicional de revelar su identidad y una pista más para rastrear al remitente." },
    B: { choice: "Dirige un grupo de mensajeros para salir de la aduana antes de que se congele la nieve.", engine: "Cada vez que el peón escolta a un equipo de mensajeros a la siguiente parada, tienen que elegir entre los caballos de grano restantes y los pueblos y ciudades que aún están atrapados." },
  };
  return {
    promptInput: prompt.id === "novel.director.candidates" && prompt.version === "v3"
      ? { ...promptInput, directions }
      : promptInput,
    metadata: { extraContextBlocks: [{ id: "idea_seed", group: "idea_seed", priority: 100, required: true, content: idea }] },
  };
}
