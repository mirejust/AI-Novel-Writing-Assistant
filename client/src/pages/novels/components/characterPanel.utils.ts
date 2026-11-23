import type { Character, CharacterTimeline } from "@ai-novel/shared/types/novel";

const RELATION_POSITIVE_KEYWORDS = ["Socio", "Aliados", "Confianza", "Proteger", "Intimidad", "Me gusta", "Cooperación"];
const RELATION_NEGATIVE_KEYWORDS = ["Hostil", "Oposición", "Duda", "Traición", "Aprovechar", "Conflicto", "Reprimir"];
const TREND_UP_KEYWORDS = ["Calentando", "Facilidad", "Cerrar", "Reparación", "La cooperación se profundiza", "La confianza aumenta"];
const TREND_DOWN_KEYWORDS = ["Empeorar", "Ruptura", "Nervioso", "Romper", "El conflicto se intensifica", "La hostilidad se profundiza"];

function compactText(input: string | null | undefined): string {
  return (input ?? "").trim();
}

function joinSegments(segments: Array<string | null | undefined>): string {
  return segments
    .map((segment) => compactText(segment))
    .filter((segment) => segment.length > 0)
    .join(";");
}

function countHits(source: string, keywords: string[]): number {
  return keywords.reduce((count, keyword) => (source.includes(keyword) ? count + 1 : count), 0);
}

export interface QuickCharacterCreatePayload {
  name: string;
  role: string;
  relationToProtagonist?: string;
  storyFunction?: string;
  keywords?: string;
  autoGenerateProfile?: boolean;
}

export interface CharacterRelationRow {
  targetCharacterId: string;
  targetCharacterName: string;
  currentRelation: string;
  trend: string;
  lastChangedChapter: number | null;
  evidence: string;
}

interface GeneratedCharacterProfile {
  personality?: string;
  background?: string;
  development?: string;
  currentState?: string;
  currentGoal?: string;
}

export function buildCharacterProfileFromWizard(payload: QuickCharacterCreatePayload): GeneratedCharacterProfile {
  if (!payload.autoGenerateProfile) {
    return {};
  }

  const keywordList = (payload.keywords ?? "")
    .split(/[，,\s]+/g)
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
  const keywordText = keywordList.length > 0 ? keywordList.join(",") : "Pendiente";

  const personality = `Características principales:${keywordText}`;
  const background = joinSegments([
    payload.relationToProtagonist ? `Relación con el protagonista:${payload.relationToProtagonist}` : "",
    payload.storyFunction ? `Función de historia:${payload.storyFunction}` : "",
  ]);
  const development = joinSegments([
    payload.storyFunction ? `El eje principal del crecimiento del personaje: alrededor de "${payload.storyFunction}"Avance.` : "",
    keywordList.length > 0 ? `Posibles puntos de conflicto:${keywordList.slice(0, 3).join(",")}` : "",
    keywordList.length > 0 ? `Posibles puntos presagios:${keywordList.slice(-2).join(",")}` : "",
    keywordList.length > 0 ? `Consejos de estilo de discurso: sesgo${keywordList[0]}Tono.` : "",
  ]);

  return {
    personality: personality || undefined,
    background: background || undefined,
    development: development || undefined,
    currentState: payload.relationToProtagonist ? `La relación está progresando (${payload.relationToProtagonist})` : "Esperando para jugar",
    currentGoal: payload.storyFunction || "Promocionar nodos clave de la línea principal.",
  };
}

function inferCurrentRelation(source: string): string {
  if (!source) {
    return "Por definir";
  }
  const positiveHits = countHits(source, RELATION_POSITIVE_KEYWORDS);
  const negativeHits = countHits(source, RELATION_NEGATIVE_KEYWORDS);
  if (positiveHits > negativeHits) {
    return "Cooperación / intimidad";
  }
  if (negativeHits > positiveHits) {
    return "Oposición / tensión";
  }
  return "Complejo / por ver";
}

function inferTrend(source: string): string {
  if (!source) {
    return "para ser visto";
  }
  const upHits = countHits(source, TREND_UP_KEYWORDS);
  const downHits = countHits(source, TREND_DOWN_KEYWORDS);
  if (upHits > downHits) {
    return "Calentando";
  }
  if (downHits > upHits) {
    return "Empeorar";
  }
  return "Suave";
}

function includesCharacterName(source: string, characterName: string): boolean {
  if (!source || !characterName) {
    return false;
  }
  return source.includes(characterName);
}

function buildLatestEvidence(event?: CharacterTimeline): string {
  if (!event) {
    return "Aún no hay evidencia del capítulo";
  }
  const excerpt = compactText(event.content).slice(0, 36);
  return excerpt.length > 0 ? excerpt : event.title;
}

export function buildCharacterRelationRows(
  selectedCharacter: Character | undefined,
  characters: Character[],
  timelineEvents: CharacterTimeline[],
): CharacterRelationRow[] {
  if (!selectedCharacter) {
    return [];
  }

  const selectedText = joinSegments([
    selectedCharacter.background,
    selectedCharacter.development,
    selectedCharacter.currentState,
    selectedCharacter.currentGoal,
    selectedCharacter.personality,
  ]);

  return characters
    .filter((character) => character.id !== selectedCharacter.id)
    .map((character) => {
      const relatedEvents = timelineEvents
        .filter((event) => includesCharacterName(`${event.title} ${event.content}`, character.name))
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      const latestEvent = relatedEvents[0];
      const relationSource = joinSegments([
        selectedText,
        ...relatedEvents.slice(0, 3).map((event) => `${event.title} ${event.content}`),
      ]);

      return {
        targetCharacterId: character.id,
        targetCharacterName: character.name,
        currentRelation: inferCurrentRelation(relationSource),
        trend: inferTrend(relationSource),
        lastChangedChapter: latestEvent?.chapterOrder ?? null,
        evidence: buildLatestEvidence(latestEvent),
      };
    });
}

export function getLastAppearanceChapter(timelineEvents: CharacterTimeline[]): number | null {
  return timelineEvents.reduce<number | null>((latest, event) => {
    if (typeof event.chapterOrder !== "number") {
      return latest;
    }
    if (latest === null || event.chapterOrder > latest) {
      return event.chapterOrder;
    }
    return latest;
  }, null);
}
