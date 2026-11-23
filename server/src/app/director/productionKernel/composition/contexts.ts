import { createContextBlock } from "../../../../prompting/core/contextBudget";
import { resolvePromptContextBlocksForAsset } from "../../../../prompting/context/promptContextResolution";
import { buildChapterWriterContextBlocks, sanitizeWriterContextBlocks } from "../../../../prompting/prompts/novel/chapterLayeredContext";
import { chapterWriterPrompt } from "../../../../prompting/prompts/novel/chapterWriter.prompts";
import type { WritingPlatformSnapshot } from "@ai-novel/shared/types/writingPlatform";
import type { RegisteredChapterWriterDependencies } from "../../../../modules/production";
import type { NativeStageDependencies } from "./types";

/** Same platform contract, sanitization and broker as the native chapter writer. */
export function nativeWriterContext({ db }: NativeStageDependencies): RegisteredChapterWriterDependencies["resolveContext"] {
  return async (run, prepared) => {
    const chapterWriteContext = prepared.contextPackage.chapterWriteContext;
    if (!chapterWriteContext) throw new Error("Chapter runtime context is required before chapter generation.");
    const novel = await db.novel.findUniqueOrThrow({ where: { id: run.progress.unit.novelId }, select: { writingPlatformSnapshotJson: true } });
    let content = "Siga el método general de redacción web de negocios chinos para mantener el avance de la trama, la iniciativa de los personajes, la causa y efecto claros y las recompensas de los capítulos.";
    if (novel.writingPlatformSnapshotJson) {
      try { const snapshot = JSON.parse(novel.writingPlatformSnapshotJson) as WritingPlatformSnapshot;
        content = `${snapshot.label}(Versión de configuración ${snapshot.profileVersion}):${snapshot.guidance.drafting}`;
      } catch { /* Native compatibility for pre-snapshot books. */ }
    }
    const sanitized = sanitizeWriterContextBlocks([createContextBlock({ id: "writing_platform", group: "writing_platform",
      priority: 105, required: true, content }), ...buildChapterWriterContextBlocks(chapterWriteContext)]);
    return (await resolvePromptContextBlocksForAsset({ asset: chapterWriterPrompt, executionContext: {
      entrypoint: "chapter_pipeline", novelId: run.progress.unit.novelId, chapterId: run.progress.unit.chapterId,
      metadata: { chapterWriteContext, chapterBlockMode: "full", ragContext: prepared.contextPackage.ragContext } },
      fallbackBlocks: sanitized.allowedBlocks })).blocks;
  };
}
