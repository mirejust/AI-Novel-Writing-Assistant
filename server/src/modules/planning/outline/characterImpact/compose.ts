import type { OutlineEditOperation } from "../domain/outlineEditOperations";
import { assertValidOutlineEditOperations } from "../domain/outlineEditOperations";
import { AppError } from "../../../../middleware/errorHandler";
import { impactRoleLabels, impactRoles, type ImpactReview, type ImpactRole, type ImpactSnapshot, type ImpactSummary } from "@ai-novel/shared/types/outlineCharacterImpact";

const fields = {
  character: ["role", "goal", "motivation", "conflict", "secret", "arcDirection"],
  volume: ["summary", "promise", "pressure", "protagonistChange", "climax", "endingHook"],
  chapter: ["summary", "purpose", "conflict", "emotionalBeat", "endingHook"],
  payoff: ["setupDescription", "payoffDescription"],
};
type NodeType = keyof typeof fields;
type Change = OutlineEditOperation & {nodeType: NodeType; nodeId: string; fields: Record<string, string>; reason: string; risks: string[]; affectedNodeIds: string[]};

export type ImpactSkipReason = "out_of_scope" | "written_chapter" | "conflicting_change" | "unknown_node";
export interface ImpactSkippedChange {
  role: ImpactRole;
  nodeId: string;
  field?: string;
  reason: ImpactSkipReason;
}
export interface ImpactComposeResult {
  operations: Change[];
  impact: ImpactSummary;
  skipped: ImpactSkippedChange[];
}
const invalid = (message: string) => new AppError(message, 400);

// A reviewer receives earlier validated edits as context. Keep their original
// attribution, and validate any new value, dependency or risk in the current role.
export function reviewHandoff(review: ImpactReview, prior: Partial<Record<ImpactRole, ImpactReview>>): ImpactReview {
  const earlier = Object.values(prior).flatMap(previous => previous.changes);
  const changes = review.changes.filter(item => !earlier.some(previous =>
    previous.nodeId === item.nodeId && previous.field === item.field && previous.value === item.value
    && item.dependsOnNodeIds.every(id => previous.dependsOnNodeIds.includes(id))
    && item.risks.every(risk => previous.risks.includes(risk))));
  return { changes, retained: review.retained };
}

// Two policies for the same scope rules. Model output on the workbench is
// noisy: one reviewer overreaching must not void the other reviewers' usable
// changes, so out-of-scope items are skipped and recorded instead of failing
// the whole proposal. External submissions are explicit tool input, so the
// same violations are still rejected outright.
export function composeImpact(snapshot: ImpactSnapshot, reviews: Partial<Record<ImpactRole, ImpactReview>>, origin: ImpactSummary["origin"]): ImpactComposeResult {
  const doc = snapshot.document;
  const targets = new Map<string, {type: NodeType; values: Record<string, unknown>}>();
  const add = (type: NodeType, nodes: {nodeId: string}[]) => {
    for (const node of nodes) targets.set(node.nodeId, {type, values: {...node}});
  };
  add("character", doc.characters); add("volume", doc.volumes); add("chapter", doc.chapters); add("payoff", doc.payoffs);
  const known = new Set([doc.story.nodeId, ...targets.keys(), ...doc.facts.map(fact => fact.nodeId)]);
  const written = new Set(snapshot.writtenChapterIds);
  const operations = new Map<string, Change>();
  const retained: ImpactSummary["retained"] = [];
  const skipped: ImpactSkippedChange[] = [];
  const lenient = origin === "workbench";
  // Records the item and skips it on the workbench; rejects it outright for
  // external submissions. Always exits the current item either way.
  const skip = (item: ImpactSkippedChange, message: string): true => {
    if (lenient) { skipped.push(item); return true; }
    throw invalid(message);
  };
  for (const role of impactRoles) {
    const review = reviews[role];
    if (!review) continue;
    for (const item of review.retained) {
      if (!known.has(item.nodeId)) {
        skip({role, nodeId: item.nodeId, reason: "unknown_node"}, "La nota de retención hace referencia a contenido que no existe en el programa de estudios.");
        continue;
      }
      retained.push({...item, role});
    }
    for (const item of review.changes) {
      const target = targets.get(item.nodeId);
      if (!target || !fields[target.type].includes(item.field)) {
        skip({role, nodeId: item.nodeId, field: item.field, reason: "out_of_scope"}, "Se recomienda modificar los nodos o campos fuera del alcance.");
        continue;
      }
      const allowed = role === "character" ? item.nodeId === snapshot.characterId
        : role === "plot" ? target.type === "volume" || target.type === "chapter"
        : target.type === "payoff" || (target.type === "chapter" && item.field === "endingHook");
      if (!allowed) {
        skip({role, nodeId: item.nodeId, field: item.field, reason: "out_of_scope"}, "Esta sugerencia está más allá del alcance de este vínculo de caracteres que se puede cambiar.");
        continue;
      }
      if (written.has(item.nodeId)) {
        skip({role, nodeId: item.nodeId, field: item.field, reason: "written_chapter"}, "Esta sugerencia involucra un capítulo que ya tiene texto y no se puede modificar.");
        continue;
      }
      if (item.value === (target.values[item.field] ?? "")) continue;
      let op = operations.get(item.nodeId);
      if (!op) {
        op = {operationId: item.nodeId, nodeId: item.nodeId, nodeType: target.type, kind: "update_fields", fields: {}, reason: "", dependsOn: [], risks: [], affectedNodeIds: [item.nodeId]};
        operations.set(item.nodeId, op);
      }
      if (op.fields[item.field] !== undefined && op.fields[item.field] !== item.value) {
        skip({role, nodeId: item.nodeId, field: item.field, reason: "conflicting_change"}, "Las dos sugerencias proporcionan diferentes modificaciones al mismo campo; unifíquelas antes de enviarlas.");
        continue;
      }
      op.fields[item.field] = item.value;
      const reason = `${impactRoleLabels[role]} · ${item.reason}`;
      if (!op.reason.split("\n").includes(reason)) op.reason = [op.reason, reason].filter(Boolean).join("\n");
      op.dependsOn = [...new Set([...op.dependsOn, ...item.dependsOnNodeIds])];
      op.risks = [...new Set([...op.risks, ...item.risks])];
    }
  }
  const edits = [...operations.values()];
  if (lenient) {
    // A skipped change can leave a dangling dependency behind: another kept
    // change may depend on a node that no longer has an operation in this
    // proposal. Drop those references (and self-references) so the proposal
    // stays structurally valid instead of failing on a prerequisite that
    // was filtered out. External submissions keep the strict failure.
    const operationIds = new Set(operations.keys());
    for (const op of operations.values()) {
      op.dependsOn = op.dependsOn.filter(id => id !== op.operationId && operationIds.has(id));
    }
  }
  if (edits.length && impactRoles.every(role => reviews[role])) assertValidOutlineEditOperations(edits, {document: doc});
  return {operations: edits, impact: {origin, characterId: snapshot.characterId, writtenChapterIds: snapshot.writtenChapterIds, retained} satisfies ImpactSummary, skipped};
}

// Raised when every proposed change was skipped, so there is nothing to
// adopt. The message names the real cause: the written-chapter half is only
// mentioned when a written chapter was actually involved.
export function buildNoUsableImpactError(skipped: ImpactSkippedChange[]): AppError {
  const written = skipped.some(item => item.reason === "written_chapter");
  const scope = skipped.some(item => item.reason !== "written_chapter");
  if (written && scope) return invalid("Entre las modificaciones propuestas esta vez, algunas se referían a capítulos que ya se habían escrito y otras no estaban dentro del alcance de las modificaciones de vinculación de personajes. Ninguno de ellos podría usarse. Inténtelo de nuevo con otra palabra.");
  if (written) return invalid("Todos los cambios propuestos esta vez afectan a capítulos donde el texto ya ha sido escrito y no se puede cambiar. Por favor, inténtalo de nuevo en una sección que aún no se haya escrito.");
  return invalid("Las modificaciones mencionadas esta vez no están dentro del alcance de las modificaciones de vinculación de personajes. Inténtelo de nuevo con otra palabra.");
}
