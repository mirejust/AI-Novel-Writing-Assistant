import type { StoryMacroPlan } from "@ai-novel/shared/types/storyMacro";
import type { ResolvedStyleContext } from "@ai-novel/shared/types/styleEngine";
import type { PayoffLedgerResponse } from "@ai-novel/shared/types/payoffLedger";
import { isPayoffOverdueAtChapter } from "../payoff/payoffLedgerShared";
import { buildPlannerStyleContractSummaryText } from "../styleEngine/styleContractText";
import { buildStoryModePromptBlock, normalizeStoryModeOutput } from "../storyMode/storyModeProfile";
import { characterDynamicsQueryService } from "../novel/dynamics/CharacterDynamicsQueryService";

export type PlannerStoryModeRow = {
  id: string;
  name: string;
  description: string | null;
  template: string | null;
  parentId: string | null;
  profileJson: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type PlannerMappedVolume = {
  sortOrder: number;
  title: string;
  summary: string | null;
  mainPromise: string | null;
  climax: string | null;
  openPayoffs: string[];
  updatedAt: string;
  chapters: Array<{
    chapterOrder: number;
    title: string;
    summary: string | null;
    conflictLevel?: number | null;
    conflictLevelSource?: "ai" | "user" | null;
  }>;
};

type PlannerCharacterDynamicsOverview = Awaited<ReturnType<typeof characterDynamicsQueryService.getOverview>>;

function compactText(value: string | null | undefined, fallback = ""): string {
  const trimmed = value?.trim();
  return trimmed || fallback;
}

function takeNonEmptyLines(text: string | null | undefined, maxLines: number): string[] {
  if (!text?.trim()) {
    return [];
  }
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, maxLines);
}

export function buildPlannerStoryModeBlock(input: {
  primaryStoryMode?: PlannerStoryModeRow | null;
  secondaryStoryMode?: PlannerStoryModeRow | null;
}): string {
  return buildStoryModePromptBlock({
    primary: input.primaryStoryMode ? normalizeStoryModeOutput(input.primaryStoryMode) : null,
    secondary: input.secondaryStoryMode ? normalizeStoryModeOutput(input.secondaryStoryMode) : null,
  });
}

export function buildStoryMacroSummary(plan: StoryMacroPlan | null): string {
  if (!plan) {
    return "Ninguno";
  }
  const lines = [
    plan.expansion?.expanded_premise ? `Ampliar la premisa:${plan.expansion.expanded_premise}` : "",
    plan.expansion?.protagonist_core ? `Núcleo protagonista:${plan.expansion.protagonist_core}` : "",
    plan.decomposition?.selling_point ? `Desmontaje de puntos de venta:${plan.decomposition.selling_point}` : "",
    plan.decomposition?.core_conflict ? `Conflicto central:${plan.decomposition.core_conflict}` : "",
    plan.decomposition?.main_hook ? `Gancho principal:${plan.decomposition.main_hook}` : "",
    plan.decomposition?.progression_loop ? `Circuito de propulsión:${plan.decomposition.progression_loop}` : "",
    plan.decomposition?.growth_path ? `Camino de crecimiento:${plan.decomposition.growth_path}` : "",
    plan.decomposition?.major_payoffs?.length
      ? `Cumplimiento clave:${plan.decomposition.major_payoffs.join(";")}`
      : "",
    plan.decomposition?.ending_flavor ? `Sabor final:${plan.decomposition.ending_flavor}` : "",
    plan.constraints.length > 0 ? `Restricciones duras:${plan.constraints.join(";")}` : "",
    plan.constraintEngine?.phase_model?.length
      ? `Modelo de escenario:${plan.constraintEngine.phase_model.map((item) => `${item.name}:${item.goal}`).join(" | ")}`
      : "",
  ].filter(Boolean);
  return lines.join("\n") || "Ninguno";
}

export function buildCurrentVolumeWindowSummary(
  volumes: PlannerMappedVolume[],
  chapterOrder: number,
): string {
  if (volumes.length === 0) {
    return "La ventana de nivel de volumen aún no se ha creado; primero confirme el banco de trabajo de volumen.";
  }
  const currentIndex = volumes.findIndex((volume) => (
    volume.chapters.some((chapter) => chapter.chapterOrder === chapterOrder)
  ));
  if (currentIndex < 0) {
    return [
      `Capítulo actual: Capítulo${chapterOrder}cap.`,
      "Actualmente no está vinculado a ninguna estructura de volumen; primero sincronice las ventanas de capítulo y volumen.",
      `Ya tengo una ventana de volumen:${volumes.map((volume) => `Cap.${volume.sortOrder}rollo"${volume.title}»`).join(";")}`,
    ].join("\n");
  }

  const currentVolume = volumes[currentIndex];
  const previousVolume = currentIndex > 0 ? volumes[currentIndex - 1] : null;
  const nextVolume = currentIndex < volumes.length - 1 ? volumes[currentIndex + 1] : null;
  const chapterOrders = currentVolume.chapters.map((chapter) => chapter.chapterOrder).sort((a, b) => a - b);
  const chapterIndex = currentVolume.chapters
    .slice()
    .sort((left, right) => left.chapterOrder - right.chapterOrder)
    .findIndex((chapter) => chapter.chapterOrder === chapterOrder);

  return [
    `Capítulo actual: Capítulo${chapterOrder}Capítulo (posición dentro del volumen) ${chapterIndex + 1}/${currentVolume.chapters.length})`,
    `Volumen actual: No.${currentVolume.sortOrder}rollo"${currentVolume.title}»`,
    `Misión de volumen:${currentVolume.mainPromise ?? currentVolume.summary ?? "Ninguno"}`,
    currentVolume.climax ? `Clímax al final del volumen:${currentVolume.climax}` : "",
    chapterOrders.length > 0 ? `Rango de capítulos de volumen:${chapterOrders[0]}-${chapterOrders[chapterOrders.length - 1]}` : "",
    currentVolume.openPayoffs.length > 0 ? `Artículos a canjear en este volumen:${currentVolume.openPayoffs.join(";")}` : "",
    previousVolume
      ? `Continuación del volumen anterior: Capítulo${previousVolume.sortOrder}rollo"${previousVolume.title}» | ${previousVolume.mainPromise ?? previousVolume.summary ?? "Ninguno"}`
      : "Volumen anterior realizado: Ninguno",
    nextVolume
      ? `Próximo volumen esperado: Capítulo${nextVolume.sortOrder}rollo"${nextVolume.title}» | ${nextVolume.mainPromise ?? nextVolume.summary ?? "Ninguno"}`
      : "Expectativas para el próximo volumen: Ninguna",
  ].filter(Boolean).join("\n");
}

function describeConflictStep(
  previous: number | null | undefined,
  current: number | null | undefined,
): string {
  if (typeof previous !== "number" || typeof current !== "number") {
    return "Desconocido";
  }
  if (current > previous) {
    return "elevar";
  }
  if (current < previous) {
    return "rechazar";
  }
  return "departamento";
}

export function buildPlannerConflictLevelAnchorContext(
  volumes: PlannerMappedVolume[],
  affectedChapterOrders: number[] = [],
): string {
  const affectedOrderSet = new Set(affectedChapterOrders);
  const lines: string[] = [];
  for (const volume of volumes) {
    const chapters = volume.chapters
      .slice()
      .sort((left, right) => left.chapterOrder - right.chapterOrder);
    for (const [index, chapter] of chapters.entries()) {
      if (chapter.conflictLevelSource !== "user" || typeof chapter.conflictLevel !== "number") {
        continue;
      }
      if (affectedOrderSet.size > 0 && !affectedOrderSet.has(chapter.chapterOrder)) {
        continue;
      }
      const previous = index > 0 ? chapters[index - 1] : null;
      const next = index < chapters.length - 1 ? chapters[index + 1] : null;
      lines.push([
        `Cap.${chapter.chapterOrder}capítulo"${chapter.title}»`,
        `conflictLevel=${chapter.conflictLevel}`,
        "Usuario anclado, no se puede cambiar",
        `Comparado con el capítulo anterior =${describeConflictStep(previous?.conflictLevel, chapter.conflictLevel)}`,
        `En relación con el próximo capítulo =${describeConflictStep(chapter.conflictLevel, next?.conflictLevel)}`,
      ].join(" | "));
    }
  }
  return lines.join("\n") || "Ninguno";
}

export function buildPlannerCharacterDynamicsContext(overview: PlannerCharacterDynamicsOverview | null): {
  summary: string;
  volumeAssignments: string;
  relationStages: string;
  candidateGuards: string;
} {
  if (!overview) {
    return {
      summary: "Ninguno",
      volumeAssignments: "Ninguno",
      relationStages: "Ninguno",
      candidateGuards: "Ninguno",
    };
  }

  const highRiskCharacters = overview.characters
    .filter((item) => item.absenceRisk === "high" || item.absenceRisk === "warn")
    .slice(0, 4)
    .map((item) => `${item.name}(${item.absenceRisk}, período de ausencia =${item.absenceSpan})`);
  const coreCharacters = overview.characters
    .filter((item) => item.isCoreInVolume)
    .slice(0, 6)
    .map((item) => (
      [
        item.name,
        item.volumeRoleLabel ? `Identidad del nivel de volumen =${item.volumeRoleLabel}` : "",
        item.volumeResponsibility ? `Responsabilidades de nivel de volumen=${item.volumeResponsibility}` : "",
        item.plannedChapterOrders.length > 0 ? `Capítulo del plan =${item.plannedChapterOrders.join(",")}` : "",
        item.absenceRisk !== "none" ? `Riesgo de ausencia =${item.absenceRisk}(lapso =${item.absenceSpan})` : "",
      ].filter(Boolean).join(" | ")
    ));
  const relationStages = overview.relations
    .slice(0, 8)
    .map((item) => (
      `${item.sourceCharacterName} -> ${item.targetCharacterName}: ${item.stageLabel} | ${item.stageSummary}${item.nextTurnPoint ? ` |Siguiente=${item.nextTurnPoint}` : ""}`
    ));
  const candidateGuards = overview.candidates
    .slice(0, 4)
    .map((item) => (
      `${item.proposedName}${item.proposedRole ? `(${item.proposedRole})` : ""} | ${item.summary ?? "Candidatos por confirmar"} | Capítulo fuente =${item.sourceChapterOrder ?? "Desconocido"} | Restricciones de solo lectura, está prohibido escribir en la cadena de ejecución formal antes de la confirmación.`
    ));

  return {
    summary: [
      overview.summary,
      overview.currentVolume ? `Volumen actual:${overview.currentVolume.title}` : "Volumen actual: no localizado",
      coreCharacters.length > 0 ? `Funciones principales del volumen actual:${coreCharacters.map((item) => item.split(" | ")[0]).join(",")}` : "Rol principal actual: Ninguno",
      highRiskCharacters.length > 0 ? `Ausencia de roles de alto riesgo:${highRiskCharacters.join(";")}` : "Ausencia en roles de alto riesgo: Ninguno",
      overview.pendingCandidateCount > 0 ? `Candidatos por confirmar:${overview.pendingCandidateCount} individual` : "Candidatos por confirmar: Ninguno",
    ].join("\n"),
    volumeAssignments: coreCharacters.join("\n") || "Ninguno",
    relationStages: relationStages.join("\n") || "Ninguno",
    candidateGuards: candidateGuards.join("\n") || "Ninguno",
  };
}

export function buildPlannerStyleEngineSummary(styleContext: ResolvedStyleContext | null | undefined): string {
  const matchedBindings = styleContext?.matchedBindings ?? [];
  const compiled = styleContext?.compiledBlocks;

  if (matchedBindings.length === 0 && !compiled) {
    return "Ninguno";
  }

  const bindingLine = matchedBindings.length > 0
    ? `Escritura de éxito actual:${matchedBindings
      .map((binding) => compactText(binding.styleProfile?.name, binding.styleProfileId))
      .join(" / ")}`
    : "";

  const summaryText = buildPlannerStyleContractSummaryText(compiled?.contract);
  const sections = takeNonEmptyLines(summaryText, 10);

  return [
    bindingLine,
    sections.length > 0 ? `Restricciones de escritura del período de planificación: \\n${sections.join("\n")}` : "",
  ].filter(Boolean).join("\n\n") || "Ninguno";
}

export function buildPlannerPayoffLedgerContext(ledger: PayoffLedgerResponse, chapterOrder: number): string {
  if (!ledger.items.length) {
    return "Ninguno";
  }

  const pendingItems = ledger.items
    .filter((item) => item.currentStatus === "setup" || item.currentStatus === "hinted" || item.currentStatus === "pending_payoff")
    .slice(0, 6)
    .map((item) => `${item.title} | ${item.summary}`);
  const overdueItems = ledger.items
    .filter((item) => isPayoffOverdueAtChapter(item, chapterOrder))
    .slice(0, 4)
    .map((item) => `${item.title} | ${item.statusReason ?? item.summary}`);
  const touchNowItems = ledger.items
    .filter((item) => item.currentStatus !== "paid_off" && item.currentStatus !== "failed")
    .filter((item) => (
      (typeof item.targetStartChapterOrder === "number" && item.targetStartChapterOrder <= chapterOrder)
      || (typeof item.targetEndChapterOrder === "number" && item.targetEndChapterOrder <= chapterOrder + 1)
      || isPayoffOverdueAtChapter(item, chapterOrder)
    ))
    .slice(0, 5)
    .map((item) => `${item.title} | ventana =${item.targetStartChapterOrder ?? "?"}-${item.targetEndChapterOrder ?? "?"}`);
  const recentlyPaidOff = ledger.items
    .filter((item) => item.currentStatus === "paid_off")
    .sort((left, right) => (right.lastTouchedChapterOrder ?? 0) - (left.lastTouchedChapterOrder ?? 0))
    .slice(0, 4)
    .map((item) => `${item.title} | Ya en el${item.lastTouchedChapterOrder ?? "?"}efectivo cerca del capítulo`);

  return [
    `Resumen del libro mayor: Para canjear =${ledger.summary.pendingCount}, urgente =${ledger.summary.urgentCount}, vencido =${ledger.summary.overdueCount}, ha sido cobrado =${ledger.summary.paidOffCount}`,
    `Artículos pendientes actualmente:${pendingItems.join(";") || "Ninguno"}`,
    `Artículos vencidos actualmente:${overdueItems.join(";") || "Ninguno"}`,
    `Elementos que deben abordarse en este capítulo:${touchNowItems.join(";") || "Ninguno"}`,
    `Último artículo canjeado:${recentlyPaidOff.join(";") || "Ninguno"}`,
  ].join("\n");
}
