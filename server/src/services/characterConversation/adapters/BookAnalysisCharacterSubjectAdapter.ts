import type {
  BookAnalysisCharacter,
  BookAnalysisCharacterArc,
  BookAnalysisCharacterAppearanceSnapshot,
  BookAnalysisCharacterEvidenceItem,
  BookAnalysisCharacterProfileSection,
  BookAnalysisCharacterScene,
} from "@ai-novel/shared/types/bookAnalysisCharacter";
import type {
  CharacterConversationEvidence,
  CharacterSubjectProjection,
} from "@ai-novel/shared/types/characterConversation";
import type { CharacterSubjectAdapter } from "./types";

export interface BookAnalysisCharacterSubjectAdapterInput {
  analysisId: string;
  characterId: string;
  chapterAnchor: number;
  character: BookAnalysisCharacter;
}

const PROMPT_ITEM_LIMIT = 300;
const MAX_EVIDENCE = 12;

function compact(value: string | null | undefined, limit = PROMPT_ITEM_LIMIT): string {
  const text = value?.trim() ?? "";
  return text.length > limit ? `${text.slice(0, limit)}…` : text;
}

function evidenceAtOrBefore(
  evidence: BookAnalysisCharacterEvidenceItem[],
  chapterAnchor: number,
): BookAnalysisCharacterEvidenceItem[] {
  // An evidence item without a chapter cannot prove it belongs before the
  // anchor, so it is intentionally excluded rather than guessed into scope.
  return evidence.filter((item) =>
    typeof item.chapterIndex === "number" && item.chapterIndex > 0 && item.chapterIndex + 1 <= chapterAnchor,
  );
}

function isFullyAnchored(
  evidence: BookAnalysisCharacterEvidenceItem[],
  chapterAnchor: number,
): boolean {
  return evidence.length > 0 && evidenceAtOrBefore(evidence, chapterAnchor).length === evidence.length;
}

function toConversationEvidence(
  evidence: BookAnalysisCharacterEvidenceItem[],
  sourceType: string,
  sourceRefPrefix: string,
): CharacterConversationEvidence[] {
  return evidence.map((item, index) => ({
    label: compact(item.label, 160) || "evidencia del texto original",
    detail: compact(item.quote || item.excerpt, 360) || compact(item.sourceLabel, 360) || "Extractos de la evidencia original.",
    sourceType,
    sourceRef: `${sourceRefPrefix}:${item.chunkId || item.noteSegmentId || index}`,
    chapterOrder: typeof item.chapterIndex === "number" ? item.chapterIndex + 1 : null,
  }));
}

function appearanceSnapshotsAtOrBefore(
  character: BookAnalysisCharacter,
  chapterAnchor: number,
): BookAnalysisCharacterAppearanceSnapshot[] {
  return (character.appearance?.snapshots ?? []).filter((snapshot) => (
    snapshot.chapterIndex >= 0
    && snapshot.chapterIndex + 1 <= chapterAnchor
    && snapshot.evidence.length > 0
  ));
}

function toAppearanceSnapshotEvidence(
  snapshots: BookAnalysisCharacterAppearanceSnapshot[],
  sourceRefPrefix: string,
): CharacterConversationEvidence[] {
  return snapshots.flatMap((snapshot) => snapshot.evidence.map((item, index) => ({
    label: compact(item.label, 160) || "Evidencia de la imagen del capítulo",
    detail: compact(item.quote || item.excerpt, 360) || compact(item.sourceLabel, 360) || "Extracto de evidencia de imagen del capítulo.",
    sourceType: "book_analysis_appearance_snapshot",
    sourceRef: `${sourceRefPrefix}:${snapshot.id}:${index}`,
    chapterOrder: snapshot.chapterIndex + 1,
  })));
}

function formatProfileSection(section: BookAnalysisCharacterProfileSection): string {
  return `${compact(section.title, 80) || section.dimension}:${compact(section.content)}`;
}

function formatArc(arc: BookAnalysisCharacterArc): string {
  const state = arc.stateSnapshot ? `;estado:${compact(JSON.stringify(arc.stateSnapshot), 220)}` : "";
  const chapterLabel = typeof arc.chapterIndex === "number" ? `Cap. ${arc.chapterIndex + 1}` : "Etapa confirmada";
  return `${chapterLabel}:${compact(arc.stageLabel)}${state}`;
}

function formatScene(scene: BookAnalysisCharacterScene): string {
  const performance = scene.performance ? `;Actuación:${compact(JSON.stringify(scene.performance), 220)}` : "";
  return `${compact(scene.sceneLabel)}${scene.sceneType ? `(${compact(scene.sceneType, 60)})` : ""}${performance}`;
}

function assertInput(input: BookAnalysisCharacterSubjectAdapterInput): void {
  if (!input.analysisId.trim() || !input.characterId.trim()) {
    throw new Error("Abrir el diálogo del personaje del libro requiere un análisisId y un carácterId.");
  }
  if (!Number.isInteger(input.chapterAnchor) || input.chapterAnchor <= 0) {
    throw new Error("El diálogo entre personajes de libros divididos requiere anclajes de capítulos eficaces.");
  }
  if (input.character.id !== input.characterId || input.character.analysisId !== input.analysisId) {
    throw new Error("La función de libro dividido no coincide con el alcance del análisis especificado.");
  }
}

function collectAnchoredContent(input: BookAnalysisCharacterSubjectAdapterInput) {
  assertInput(input);
  const { character, chapterAnchor } = input;
  const characterEvidence = evidenceAtOrBefore(character.evidence, chapterAnchor);
  const sections = character.profileSections.filter((section) => isFullyAnchored(section.evidence, chapterAnchor));
  const arcs = character.arcs.filter((arc) =>
    typeof arc.chapterIndex === "number"
    && arc.chapterIndex > 0
    && arc.chapterIndex <= chapterAnchor
    && isFullyAnchored(arc.evidence, chapterAnchor),
  );
  const scenes = character.scenes.filter((scene) => isFullyAnchored(scene.evidence, chapterAnchor));
  const appearanceSnapshots = appearanceSnapshotsAtOrBefore(character, chapterAnchor);
  const evidence = [
    ...toConversationEvidence(characterEvidence, "book_analysis_character", `${character.analysisId}:${character.id}:character`),
    ...sections.flatMap((section) => toConversationEvidence(
      section.evidence,
      "book_analysis_profile",
      `${character.analysisId}:${character.id}:profile:${section.dimension}`,
    )),
    ...arcs.flatMap((arc) => toConversationEvidence(
      arc.evidence,
      "book_analysis_arc",
      `${character.analysisId}:${character.id}:arc:${arc.id}`,
    )),
    ...scenes.flatMap((scene) => toConversationEvidence(
      scene.evidence,
      "book_analysis_scene",
      `${character.analysisId}:${character.id}:scene:${scene.id}`,
    )),
    ...toAppearanceSnapshotEvidence(
      appearanceSnapshots,
      `${character.analysisId}:${character.id}:appearance`,
    ),
  ].slice(0, MAX_EVIDENCE);

  return { characterEvidence, sections, arcs, scenes, appearanceSnapshots, evidence };
}

/**
 * Projects a character inferred from a source text. Only material that can be
 * proven to be within the selected chapter anchor is passed onward.
 */
export const bookAnalysisCharacterSubjectAdapter: CharacterSubjectAdapter<BookAnalysisCharacterSubjectAdapterInput> = {
  project(input): CharacterSubjectProjection {
    const { character, analysisId, chapterAnchor } = input;
    const { characterEvidence, sections, arcs, scenes, appearanceSnapshots, evidence } = collectAnchoredContent(input);
    const hasEvidence = evidence.length > 0;
    const identityLines = [
      `Posicionamiento de roles original:${character.role}`,
      ...sections.slice(0, 3).map(formatProfileSection),
    ];
    const situationLines = [
      arcs.length > 0 ? `Etapas confirmadas:${formatArc(arcs[arcs.length - 1])}` : null,
      scenes.length > 0 ? `Actuación en escena confirmada:${formatScene(scenes[scenes.length - 1])}` : null,
      appearanceSnapshots.length > 0 ? `Nodo de imagen confirmado: No. ${appearanceSnapshots[appearanceSnapshots.length - 1]!.chapterIndex + 1} capítulo.` : null,
      !hasEvidence ? "A partir del punto de referencia de este capítulo, no hay evidencia textual suficiente para confirmar las circunstancias, motivaciones o información no revelada del personaje." : null,
    ].filter((line): line is string => Boolean(line));

    return {
      subject: {
        kind: "book_analysis_character",
        id: character.id,
        scopeKind: "book_analysis",
        scopeId: analysisId,
      },
      name: character.name,
      role: character.role,
      sourceLabel: "Abrir archivos de personajes de libros.",
      sourceDescription: `Basado únicamente en el elemento número 1 de este proyecto de apertura de libro. ${chapterAnchor} Capítulo y respuestas de evidencia de texto original rastreable anterior; No reescribirá el texto original ni tratará las especulaciones como si fueran un hecho.`,
      interactionPolicy: "evidence_interview",
      identity: identityLines.join("\n"),
      currentSituation: situationLines.join("\n") || "No hay pruebas suficientes en el texto original y no se puede confirmar la situación actual.",
      hardBoundaries: [
        `solo el primero ${chapterAnchor} Capítulo y evidencia textual anterior con números de capítulo rastreables.`,
        "No utilices la trama, cambios de personajes o información que el lector ya conozca después del punto de anclaje.",
        "Cuando no existan pruebas suficientes, se deberá dejar claro que no se puede confirmar a partir del texto original, y no se pueden añadir secretos, motivos o tramas posteriores.",
        "Esta comunicación solo se utiliza para comprender a los personajes originales y no modificará el texto original, la conclusión del libro ni ningún texto de la novela.",
      ],
      subjectiveState: characterEvidence.length > 0 || appearanceSnapshots.length > 0
        ? "Los siguientes juicios sólo representan la actuación del personaje respaldada por la evidencia del texto original y no son una confirmación de su verdad interior."
        : null,
      evidence,
      chapterAnchor,
      chapterAnchorLabel: `A partir de ${chapterAnchor} El alcance de la evidencia del texto original del capítulo.`,
    };
  },

  buildPromptContext(input): string {
    const { character, chapterAnchor } = input;
    const { sections, arcs, scenes, appearanceSnapshots, evidence } = collectAnchoredContent(input);
    const evidenceLines = evidence.slice(0, 8).map((item) =>
      `- No. ${item.chapterOrder} Capítulo |${item.label}:${item.detail}`,
    );
    const lines = [
      "Fuente del personaje: Archivo de personajes del libro abierto (entrevista restringida por evidencia)",
      `Role:${compact(character.name)}(${compact(character.role)})`,
      `Anclajes de evidencia: A partir de la p. ${chapterAnchor} capítulo.`,
      sections.length > 0 ? `Perfiles disponibles:${sections.slice(0, 4).map(formatProfileSection).join(";")}` : null,
      arcs.length > 0 ? `Etapas de personajes disponibles:${arcs.slice(-3).map(formatArc).join(";")}` : null,
      scenes.length > 0 ? `Rendimiento de escena disponible:${scenes.slice(-3).map(formatScene).join(";")}` : null,
      appearanceSnapshots.length > 0 ? `Nodos de imagen disponibles:${appearanceSnapshots.slice(-3).map((snapshot) => `Cap. ${snapshot.chapterIndex + 1}`).join(",")}` : null,
      evidenceLines.length > 0 ? `Evidencia original: \\n${evidenceLines.join("\n")}` : "Evidencia insuficiente del texto original: no hay confirmación del corazón, secretos, motivaciones o desarrollo posterior del personaje.",
      "Límite: Sólo puede responder basándose en la evidencia anterior; no se le permite citar el contenido después del punto de anclaje y no se le permite convertir especulaciones razonables en hechos originales.",
    ];
    return lines.filter((line): line is string => Boolean(line)).join("\n");
  },
};
