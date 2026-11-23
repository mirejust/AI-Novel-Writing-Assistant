import type {
  CharacterCastRole,
  CharacterGender,
  SupplementalCharacterCandidate,
  SupplementalCharacterGenerationMode,
} from "@ai-novel/shared/types/novel";

export const CAST_ROLE_LABELS: Record<CharacterCastRole, string> = {
  protagonist: "Protagonista",
  antagonist: "Oponente principal",
  ally: "Alianza",
  foil: "Papel espejo",
  mentor: "Mentor",
  love_interest: "Atracción emocional",
  pressure_source: "Factor estresante",
  catalyst: "Catalizador",
};

export const CHARACTER_GENDER_LABELS: Record<CharacterGender, string> = {
  male: "Masculino",
  female: "Femenino",
  other: "Otros",
  unknown: "Desconocido",
};

export const SUPPLEMENTAL_MODE_LABELS: Record<SupplementalCharacterGenerationMode, string> = {
  auto: "Juicio de IA",
  linked: "Relleno de relación",
  independent: "Relleno independiente",
};

export function getCastRoleLabel(castRole?: CharacterCastRole | "auto" | null): string {
  if (!castRole || castRole === "auto") {
    return "Juicio de IA";
  }
  return CAST_ROLE_LABELS[castRole] ?? castRole;
}

export function getCharacterGenderLabel(gender?: CharacterGender | null): string {
  if (!gender) {
    return "Desconocido";
  }
  return CHARACTER_GENDER_LABELS[gender] ?? gender;
}

export function getSupplementalRelationLabel(
  candidate: SupplementalCharacterCandidate,
  relation: SupplementalCharacterCandidate["relations"][number],
): string {
  if (relation.sourceName === candidate.name) {
    return relation.targetName;
  }
  if (relation.targetName === candidate.name) {
    return relation.sourceName;
  }
  return `${relation.sourceName} -> ${relation.targetName}`;
}
