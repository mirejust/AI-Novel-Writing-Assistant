import { createHash } from "node:crypto";
import { validateOutlineDocument, type OutlineDocument } from "@ai-novel/shared/types/outline";
import { outlineOpenBookInputSchema, type OutlineBookMapping, type OutlineBookPolicy, type OutlineOpenBookInput } from "@ai-novel/shared/types/outlineOpenBook";

import { inferRequiredChapterCountFromBeatSheet, validateBeatSheetChapterCoverage } from "@ai-novel/shared/types/volumeBeatCoverage";
import { createVolumeBeatSheetSchema } from "../../../../../services/novel/volume/volumeGenerationSchemas";

export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.entries(value).filter(([, v]) => v !== undefined).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(",")}}`;
  return JSON.stringify(value) ?? "null";
}
export const outlineHash = (value: unknown) => createHash("sha256").update(canonicalJson(value)).digest("hex");
const fail = (message: string): never => { throw new Error(`OUTLINE_OPEN_INVALID: ${message}`); };

export function validateOpenBookDocument(value: unknown): OutlineDocument {
  const doc = validateOutlineDocument(value);
  const types = new Map<string, string>([[doc.story.nodeId, "story"], ...(["volumes", "chapters", "characters", "payoffs", "facts"] as const).flatMap(group => doc[group].map(n => [n.nodeId, group] as [string, string]))]);
  const ref = (owner: string, field: string, id: string, allowed: string[]) => {
    if (!allowed.includes(types.get(id) ?? "")) fail(`${owner}.${field} Error de tipo de referencia:${id}`);
  };
  const uniqueOrder = (nodes: Array<{ order: number; nodeId: string }>, label: string) => {
    if (new Set(nodes.map(n => n.order)).size !== nodes.length) fail(`${label}ordenar duplicado`);
    if (nodes.some(n => n.order < 0)) fail(`${label}La clasificación no puede ser negativa`);
  };
  uniqueOrder(doc.volumes, "rollo");
  for (const v of doc.volumes) {
    if (new Set(v.chapterNodeIds).size !== v.chapterNodeIds.length) fail(`${v.nodeId}.chapterNodeIds duplicado`);
    v.chapterNodeIds.forEach(id => ref(v.nodeId, "chapterNodeIds", id, ["chapters"]));
    const chapters = doc.chapters.filter(c => c.volumeNodeId === v.nodeId);
    uniqueOrder(chapters, v.nodeId);
    if (chapters.length !== v.chapterNodeIds.length || chapters.some(c => !v.chapterNodeIds.includes(c.nodeId))) fail(`${v.nodeId} Referencias inconsistentes en ambas direcciones de volúmenes y capítulos.`);
    const declared = v.chapterNodeIds;
    if (chapters.sort((a, b) => a.order - b.order).some((c, i) => declared[i] !== c.nodeId)) fail(`${v.nodeId} El orden de las citas de los capítulos entra en conflicto con el orden`);
  }
  for (const c of doc.chapters) {
    ref(c.nodeId, "volumeNodeId", c.volumeNodeId, ["volumes"]);
    c.characterNodeIds.forEach(id => ref(c.nodeId, "characterNodeIds", id, ["characters"]));
    c.payoffNodeIds.forEach(id => ref(c.nodeId, "payoffNodeIds", id, ["payoffs"]));
  }
  for (const c of doc.characters) c.appearanceNodeIds.forEach(id => ref(c.nodeId, "appearanceNodeIds", id, ["volumes", "chapters"]));
  for (const p of doc.payoffs) [...p.setupChapterNodeIds, ...p.payoffChapterNodeIds].forEach(id => ref(p.nodeId, "chapterRefs", id, ["chapters"]));
  for (const f of doc.facts) {
    if (f.scope.type !== "story" && !f.scope.nodeId) fail(`${f.nodeId}.alcance falta objetivo`);
    if (f.scope.nodeId) ref(f.nodeId, "scope", f.scope.nodeId, [f.scope.type === "story" ? "story" : f.scope.type === "volume" ? "volumes" : "chapters"]);
  }
  if (!(doc.story.premise.trim() || doc.story.synopsis.trim())) fail("La idea de la historia no puede estar vacía.");
  return doc;
}

export function mapOutlineBook(value: unknown, raw: OutlineOpenBookInput, bindingId: string) {
  const doc = validateOpenBookDocument(value);
  const input = outlineOpenBookInputSchema.parse(raw);
  const volumes = [...doc.volumes].sort((a, b) => a.order - b.order);
  const counts = volumes.map(v => doc.chapters.filter(c => c.volumeNodeId === v.nodeId).length);
  const quotas = volumes.map((v, i) => input.volumeQuotas[v.nodeId] ?? Math.max(1, counts[i], v.beats ? inferRequiredChapterCountFromBeatSheet({beats: v.beats}) : 0));
  for (const key of Object.keys(input.volumeQuotas)) if (!volumes.some(v => v.nodeId === key)) fail(`La asignación de espacio incluye volúmenes desconocidos:${key}`);
  if (quotas.some((q, i) => q < counts[i])) fail("El presupuesto para el número de capítulos no puede ser inferior al número de capítulos existentes.");
  const total = input.bookSettings.estimatedChapterCount;
  let remaining = total - quotas.reduce((a, b) => a + b, 0);
  if (remaining < 0) fail("El número objetivo de capítulos no es suficiente para dar cabida al volumen presupuestado.");
  const flexible = volumes.map((v, i) => !input.volumeQuotas[v.nodeId] && !v.beats && (v.planningDepth === "rough" || counts[i] === 0) ? i : -1).filter(i => i >= 0);
  if (remaining && volumes.length) {
    if (!flexible.length) fail("Especifique la asignación de volumen para que la suma de los volúmenes y capítulos sea igual al número objetivo de capítulos.");
    flexible.forEach((i, n) => { const extra = Math.floor(remaining / (flexible.length - n)); quotas[i] += extra; remaining -= extra; });
  }
  const stableId = (kind: string, id: string) => `${kind}_${outlineHash([bindingId, kind, id]).slice(0, 32)}`;
  let order = 1;
  const mapping: OutlineBookMapping = { volumes: [], chapters: [], characters: [], payoffs: [] };
  volumes.forEach((v, i) => {
    if (v.beats) {
      const sheet = {beats: v.beats};
      const coverage = validateBeatSheetChapterCoverage({beatSheet:sheet, targetChapterCount:quotas[i]});
      if (!coverage.accepted || !createVolumeBeatSheetSchema(quotas[i]).safeParse(sheet).success)
        fail(`${v.title}(${v.nodeId}) el tablero de ritmo y esta vez ${quotas[i]} El presupuesto del capítulo no coincide, ajuste el presupuesto del volumen o vuelva al volumen y vuelva a planificar el ritmo.`);
    }
    const volumeId = stableId("vol", v.nodeId);
    mapping.volumes.push({ nodeId: v.nodeId, volumeId, chapterQuota: quotas[i], from: order, to: order + quotas[i] - 1 });
    doc.chapters.filter(c => c.volumeNodeId === v.nodeId).sort((a, b) => a.order - b.order).forEach((c, n) => mapping.chapters.push({ nodeId: c.nodeId, volumeId, planId: stableId("plan", c.nodeId), chapterId: stableId("ch", c.nodeId), chapterOrder: order + n, ...(c.beatKey && {beatKey: c.beatKey}) }));
    order += quotas[i];
  });
  mapping.characters = doc.characters.map(c => ({ nodeId: c.nodeId, characterId: stableId("char", c.nodeId) }));
  mapping.payoffs = doc.payoffs.map(p => ({ nodeId: p.nodeId, ledgerKey: `outline:${bindingId}:${p.nodeId}`, ledgerItemId: null }));
  const policy: OutlineBookPolicy = { rules: [] };
  const identity = new Set(["nodeId", "order", "volumeNodeId", "chapterNodeIds", "beats", "beatKey", "immutable"]);
  for (const node of [doc.story, ...doc.volumes, ...doc.chapters, ...doc.characters, ...doc.payoffs, ...doc.facts]) {
    for (const [field, value] of Object.entries(node)) {
      if (identity.has(field)) continue;
      const hard = "immutable" in node && node.immutable && ["content", "scope"].includes(field);
      const optimize = input.allowOptimize.some(r => r.nodeId === node.nodeId && r.field === field);
      const empty = value == null || value === "" || Array.isArray(value) && value.length === 0;
      policy.rules.push({ nodeId: node.nodeId, field, value, mode: hard ? "hard_constraint" : empty ? "fill_missing" : optimize ? "propose_change" : "preserve" });
    }
  }
  for (const choice of input.allowOptimize) {
    const rule = policy.rules.find(r => r.nodeId === choice.nodeId && r.field === choice.field);
    if (!rule || rule.mode === "hard_constraint") fail(`No se pueden liberar configuraciones fijas o campos de identidad:${choice.nodeId}.${choice.field}`);
  }
  const sourceDocumentHash = outlineHash(doc);
  const requestHash = outlineHash({ sourceDocumentHash, input });
  return { document: doc, mapping, policy, sourceDocumentHash, requestHash, settings: input.bookSettings, warnings: doc.characters.filter((c, i) => doc.characters.findIndex(x => x.name === c.name) !== i).map(c => `Los caracteres con el mismo nombre se conservan respectivamente:${c.name}`) };
}
