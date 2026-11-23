import { validateOutlineDocument, type OutlineDocument } from "../domain/outlineDocument";

export function exportOutlineJson(title: string, version: number, document: OutlineDocument): string {
  return JSON.stringify({ format: "anw-outline", schemaVersion: 1, project: { title }, revision: { version }, document: validateOutlineDocument(document) }, null, 2);
}
export function importOutlineJson(input: string): { title: string; document: OutlineDocument } {
  const data = JSON.parse(input) as { format?: string; schemaVersion?: number; project?: { title?: string }; document?: unknown };
  if (data.format !== "anw-outline") throw new Error("El formato de archivo no es JSON de esquema anw");
  if (data.schemaVersion !== 1) throw new Error("Esta versión JSON de esquema no es compatible");
  if (!data.project?.title || !data.document) throw new Error("Al esquema JSON le falta el título del proyecto o el contenido del documento");
  return { title: data.project.title, document: validateOutlineDocument(data.document) };
}
export function exportOutlineMarkdown(document: OutlineDocument): string {
  const lines = [`# ${document.story.title}`, "", "## Resumen de la historia", document.story.synopsis || document.story.premise, "", `tema:${document.story.theme}`, `fundamental:${document.story.tone}`, `Dirección final:${document.story.endingDirection}`, ""];
  for (const volume of [...document.volumes].sort((a,b)=>a.order-b.order)) {
    lines.push(`## ${volume.title} <!-- ${volume.nodeId} -->`, "", volume.summary, "");
    for (const chapter of document.chapters.filter(x=>x.volumeNodeId===volume.nodeId).sort((a,b)=>a.order-b.order)) lines.push(`### ${chapter.title} <!-- ${chapter.nodeId} -->`, "", chapter.summary, "");
  }
  for (const [heading, items] of [["borrador de personaje", document.characters.map(x=>`- ${x.name} <!-- ${x.nodeId} -->${x.role ? `:${x.role}` : ""}`)], ["Presagio y gancho", document.payoffs.map(x=>`- ${x.title} <!-- ${x.nodeId} -->:${x.setupDescription} → ${x.payoffDescription}`)], ["Ajustes fijos", document.facts.map(x=>`- ${x.title} <!-- ${x.nodeId} -->:${x.content}`)]] as const) lines.push(`## ${heading}`, "", ...items, "");
  return lines.join("\n");
}
