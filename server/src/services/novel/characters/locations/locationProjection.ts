import type { CharacterLocationDelta, CharacterLocationProjection } from "@ai-novel/shared/types/characterLocation";

const compact = (text: string) => text.replace(/\s+/g, " ").trim();

/** Semantic judgments come from AI. This layer checks IDs, duplicate output and verbatim evidence. */
export function projectLocationDeltas(input: {
  content: string;
  characters: Array<{ id: string; name: string }>;
  deltas: CharacterLocationDelta[];
  contentProvenance?: "confirmed" | "debt";
}): CharacterLocationProjection["records"] {
  const characters = new Map(input.characters.map(character => [character.id, character.name]));
  const groups = new Map<string, CharacterLocationDelta[]>();
  for (const delta of input.deltas) {
    if (characters.get(delta.characterId) !== delta.characterName || delta.timeContext !== "present") continue;
    const group = groups.get(delta.characterId) ?? [];
    group.push(delta);
    groups.set(delta.characterId, group);
  }
  const content = compact(input.content);
  return [...groups].map(([characterId, deltas]) => {
    // The wire contract requests one final record per actor. Never choose an arbitrary duplicate.
    if (deltas.length !== 1) {
      return { characterId, locationName: null, evidence: null, concern: "Hay múltiples juicios en el registro de ubicación de este capítulo y se conserva la última ubicación confirmada." };
    }
    const delta = deltas[0];
    const evidence = compact(delta.evidence);
    const validEvidence = Boolean(evidence) && content.includes(evidence);
    const canConfirm = validEvidence && delta.locationName
      && (delta.movementType === "stay" || delta.movementType === "move")
      && delta.continuityStatus === "consistent" && input.contentProvenance !== "debt";
    return {
      characterId,
      locationName: canConfirm ? delta.locationName : null,
      evidence: validEvidence ? delta.evidence : null,
      concern: canConfirm ? null : !validEvidence
        ? "El juicio de posición de este capítulo carece de evidencia textual que pueda localizarse, por lo que se conserva la última posición confirmada."
        : `posición del candidato =${delta.locationName || "Desconocido"};${input.contentProvenance === "debt"
          ? "Es necesario comprobar la calidad de este capítulo y el cambio de ubicación no se considera un hecho confirmado por el momento."
          : delta.explanation || "Si el historial de movimientos o la relación de ubicación en este capítulo no están claros, se conservará la última ubicación confirmada."}`,
    };
  });
}
