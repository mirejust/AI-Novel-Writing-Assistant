import { getVolumeBeatRoleLabel } from "@ai-novel/shared/types/volumeBeatSlots";
import type { OutlineDocument } from "@ai-novel/shared/types/outline";

export type OutlineNode = OutlineDocument["story"]
  | OutlineDocument["volumes"][number]
  | OutlineDocument["chapters"][number]
  | OutlineDocument["characters"][number]
  | OutlineDocument["payoffs"][number]
  | OutlineDocument["facts"][number];

export const outlineFieldLabels: Record<string, string> = {
  beats: "Ritmo intravolumen", beatKey: "La sección rítmica a la que pertenece.", chapterSpanHint: "Prefacio del capítulo", mustDeliver: "Debe ser honrado", key: "Función de ritmo", label: "Nombre de la función",
  title: "Título",
  name: "Nombre",
  premise: "Ideas de historias",
  synopsis: "Resumen de la historia",
  theme: "Tema",
  tone: "Fundamental",
  endingDirection: "Dirección final",
  targetAudience: "Público objetivo",
  genre: "Tema",
  notes: "Notas de creación",
  summary: "Resumen",
  promise: "Compromisos centrales",
  pressure: "Presión principal",
  protagonistChange: "Cambios de protagonista",
  climax: "Clímax",
  endingHook: "Gancho final",
  purpose: "Programa del capitulo",
  conflict: "Conflicto principal",
  emotionalBeat: "Avance de la emoción y la información.",
  role: "La identidad y el papel de la historia.",
  goal: "Objetivo",
  motivation: "Motivación",
  secret: "Secreto",
  arcDirection: "El personaje cambia de dirección.",
  content: "Contenido",
  kind: "Tipo",
  setupDescription: "Instrucciones de entierro",
  payoffDescription: "Instrucciones de reciclaje",
  category: "Categoría",
  scope: "Ámbito de aplicación",
  immutable: "no puede ser violado",
  planningDepth: "Profundidad de planificación",
  volumeNodeId: "Volumen al que pertenece",
  parent: "Nodo padre",
  order: "Orden de clasificación",
  chapterNodeIds: "Contiene capítulos",
  chapterRefs: "Cita del capítulo",
  characterNodeIds: "Personas relacionadas",
  payoffNodeIds: "Presagio relacionado",
  appearanceNodeIds: "posición de apariencia planificada",
  setupChapterNodeIds: "Planean enterrar el capítulo.",
  payoffChapterNodeIds: "Capítulo de reciclaje planificado",
  relatedNodeIds: "Nodo asociado",
};

/** Works in the desktop app and on LAN HTTP where randomUUID may be unavailable. */
export function createOutlineId(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), byte => byte.toString(16).padStart(2, "0")).join("");
}

export function getOutlineNodes(document: OutlineDocument): OutlineNode[] {
  return [
    document.story,
    ...document.volumes,
    ...document.chapters,
    ...document.characters,
    ...document.payoffs,
    ...document.facts,
  ];
}

export function getOutlineNodeTitle(node: OutlineNode | null | undefined): string {
  if (!node) return "Nodo sin nombre";
  return ("title" in node ? node.title : node.name) || "Nodo sin nombre";
}

export function findOutlineNode(document: OutlineDocument, nodeId: string): OutlineNode | undefined {
  return getOutlineNodes(document).find(node => node.nodeId === nodeId);
}

export function findOutlineNodeTitle(document: OutlineDocument, nodeId: string): string {
  const node = findOutlineNode(document, nodeId);
  return node ? getOutlineNodeTitle(node) : "(nodo eliminado)";
}

/** Resolve references against the version being displayed, never the current draft. */
export function formatOutlineValue(value: unknown, field = "", document?: OutlineDocument, titles: Record<string, string> = {}): string {
  if (value === undefined || value === null || value === "") return "Ninguno";
  if (Array.isArray(value)) {
    if (!value.length) return "Ninguno";
    return value.map(item => formatOutlineValue(item, field, document, titles)).join(",");
  }
  if (typeof value === "string") {
    if (field === "beatKey" || field === "key") return getVolumeBeatRoleLabel(value, value);
    if (/NodeIds?$/.test(field)) return titles[value] ?? (document ? findOutlineNodeTitle(document, value) : "(nodo eliminado)");
    const labels: Record<string, string> = { rough: "Esquema aproximado", detailed: "Esquema detallado", story: "Libro completo", volume: "Rollo", chapter: "Capítulos", character: "Personajes", payoff: "Presagio", fact: "Ajustes fijos", other: "Otros", hook: "Gancho", foreshadowing: "Presagio", promise: "Compromiso", mystery: "Suspense" };
    return ["planningDepth", "kind", "category", "type"].includes(field) ? labels[value] ?? value : value;
  }
  if (typeof value === "boolean") return value ? "Sí" : "No";
  if (typeof value === "object") return Object.entries(value as Record<string, unknown>).map(([key, item]) => `${outlineFieldLabels[key] ?? (key === "type" ? "Tipo" : key === "nodeId" ? "Nodo" : key)}:${formatOutlineValue(item, key === "nodeId" ? "relatedNodeIds" : key, document, titles)}`).join(";");
  return String(value);
}

/** Only known schema terms / proposal IDs are translated; prose stays untouched. */
export function localizeOutlineText(text: string, operationTitles: Record<string, string> = {}): string {
  let result = text.replace(/\bimmutable\s*=\s*(true|false)\b/g, (_, value: string) => value === "true" ? "Configuraciones que no se pueden violar" : "Configuraciones ajustables");
  for (const [id, title] of Object.entries(operationTitles).sort((a, b) => b[0].length - a[0].length)) {
    result = result.replaceAll(id, title);
  }
  return result.replace(/\b[A-Za-z][A-Za-z0-9]*\b/g, word => outlineFieldLabels[word] ?? word)
    .replace(/\bop-[A-Za-z0-9_-]+\b/g, "Modificaciones relacionadas");
}
