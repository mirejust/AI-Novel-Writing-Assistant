import type { GenerationContextPackage } from "@ai-novel/shared/types/chapterRuntime";

export interface ChapterRuntimeReadinessResult {
  ready: boolean;
  reasons: string[];
}

function compactText(value: string | null | undefined): string {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

export class ChapterRuntimeReadinessService {
  evaluate(contextPackage: GenerationContextPackage): ChapterRuntimeReadinessResult {
    const reasons: string[] = [];
    const chapter = contextPackage.chapter;
    const mission = contextPackage.chapterWriteContext?.chapterMission ?? contextPackage.chapterMission ?? null;
    const hasChapterGoal = Boolean(
      compactText(mission?.objective)
      || compactText(mission?.expectation)
      || compactText(chapter.expectation)
      || compactText(contextPackage.plan?.objective)
      || compactText(contextPackage.plan?.title),
    );

    if (!compactText(chapter.title)) {
      reasons.push("Primero complete el título del capítulo y luego genere el texto.");
    }

    if (!hasChapterGoal) {
      reasons.push("Primero prepare las tareas del capítulo o los objetivos del capítulo para este capítulo y luego genere el texto principal.");
    }

    if (!contextPackage.chapterWriteContext) {
      reasons.push("El contexto de redacción del capítulo aún no está listo; actualice primero el contexto del capítulo.");
    }

    if ((contextPackage.characterRoster ?? []).length === 0) {
      reasons.push("Prepare al menos un personaje de esta novela antes de generar el texto.");
    }

    return {
      ready: reasons.length === 0,
      reasons,
    };
  }

  assertReady(contextPackage: GenerationContextPackage): void {
    const result = this.evaluate(contextPackage);
    if (result.ready) {
      return;
    }
    throw new Error(result.reasons.join(" "));
  }
}
