import type { BaseCharacter } from "@ai-novel/shared/types/novelCharacter";
import type { CharacterSubjectProjection } from "@ai-novel/shared/types/characterConversation";
import type { CharacterSubjectAdapter } from "./types";

export interface BaseCharacterSubjectAdapterInput {
  character: BaseCharacter;
}

const PROMPT_FIELD_LIMIT = 420;

function compact(value: string | null | undefined): string {
  const text = value?.trim() ?? "";
  return text.length > PROMPT_FIELD_LIMIT ? `${text.slice(0, PROMPT_FIELD_LIMIT)}…` : text;
}

function present(label: string, value: string | null | undefined): string | null {
  const text = compact(value);
  return text ? `${label}:${text}` : null;
}

/**
 * Projects a library template as a read-only conversational subject. It has
 * no novel scope and intentionally does not manufacture a current plot state.
 */
export const baseCharacterSubjectAdapter: CharacterSubjectAdapter<BaseCharacterSubjectAdapterInput> = {
  project({ character }): CharacterSubjectProjection {
    const stableDetails = [
      present("personaje", character.personality),
      present("fondo", character.background),
      present("Dirección de desarrollo", character.development),
      present("debilidad", character.weaknesses),
      present("interés", character.interests),
      present("experiencias clave", character.keyEvents),
    ].filter((item): item is string => Boolean(item));

    return {
      subject: {
        kind: "base_character",
        id: character.id,
        scopeKind: "base_library",
        scopeId: null,
      },
      name: character.name,
      role: character.role,
      sourceLabel: "Biblioteca de personajes básicos",
      sourceDescription: "Responder de acuerdo con la configuración de personajes estables guardada en la biblioteca de personajes; La comunicación solo se utiliza para comprender los personajes y no reescribirá la configuración de la biblioteca de personajes.",
      interactionPolicy: "read_only",
      identity: stableDetails.join("\n") || `Posicionamiento de roles:${character.role}`,
      currentSituation: "Este es un prototipo de personaje reutilizable que no está vinculado a ninguna novela, capítulo o situación actual de la trama.",
      hardBoundaries: [
        "Solo puedes responder basándose en la configuración estable de la biblioteca de personajes básica y no puedes ficcionalizar experiencias existentes en una determinada novela.",
        "El intercambio es una entrevista de solo lectura y no modifica automáticamente la biblioteca de personajes, no crea versiones ni afecta ningún texto novedoso.",
      ],
      subjectiveState: null,
      evidence: [
        {
          label: "Configuración básica de la biblioteca de personajes",
          detail: `Entrada de la biblioteca de personajes"${character.name}"La configuración estable actual.`,
          sourceType: "base_character",
          sourceRef: character.id,
          chapterOrder: null,
        },
      ],
      chapterAnchor: null,
      chapterAnchorLabel: null,
    };
  },

  buildPromptContext({ character }): string {
    return [
      "Fuente de caracteres: Biblioteca de caracteres básicos (entrevista de solo lectura)",
      `Nombre:${compact(character.name)}`,
      `Posicionamiento de roles:${compact(character.role)}`,
      present("personaje", character.personality),
      present("fondo", character.background),
      present("Dirección de desarrollo", character.development),
      present("forma", character.appearance),
      present("debilidad", character.weaknesses),
      present("interés", character.interests),
      present("experiencias clave", character.keyEvents),
      character.tags.trim() ? `Etiqueta:${compact(character.tags)}` : null,
      "Límite: No vinculado a la trama de la novela; el contenido de la comunicación no debe considerarse como un hecho que ha sucedido y no se pueden proponer ni escribir modificaciones en la biblioteca de caracteres.",
    ].filter((line): line is string => Boolean(line)).join("\n");
  },
};
