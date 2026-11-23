import { useMutation } from "@tanstack/react-query";
import type { ChapterEditorCandidate } from "@ai-novel/shared/types/novel";
import { applySelectedChapterEditorDiff, groupChapterEditorDiffChanges, insertChapterContinuation, replaceChapterSelection } from "@ai-novel/shared/types/chapterEditor/document";
import { createNovelSnapshot, updateNovelChapter } from "@/api/novel";
import { toast } from "@/components/ui/toast";
import type { ChapterEditorSessionState } from "../chapterEditorTypes";

export function useCandidateAcceptance(input: {
  novelId: string;
  chapter?: { id: string; order: number };
  session: ChapterEditorSessionState;
  candidate: ChapterEditorCandidate | null;
  selectedChangeIds: ReadonlySet<string>;
  content: string;
  sourceSnapshot?: string;
  savedUpdatedAt: string;
  savedContent: string;
  acknowledgeSave: (expectedDraftContent: string, saved: { content?: string | null; updatedAt: string }) => void;
  onAccepted: (result: { nextContent: string; savedUpdatedAt: string; fullyAccepted: boolean }) => Promise<void>;
}) {
  return useMutation({
    mutationFn: async () => {
      const { chapter, candidate, session, selectedChangeIds } = input;
      const sourceContent = input.content;
      if (!chapter || !candidate || !session.targetRange || session.status !== "ready") {
        throw new Error("Actualmente no hay candidatos de lanzamiento aplicables.");
      }
      if (selectedChangeIds.size === 0) throw new Error("Seleccione primero las ediciones que desea adoptar.");
      if (input.sourceSnapshot !== sourceContent) throw new Error("El texto ha cambiado, vuelva a generar sugerencias de modificación.");
      const replacement = applySelectedChapterEditorDiff(session.targetRange.text, candidate.content, candidate.diffChunks, selectedChangeIds);
      const nextContent = session.mode === "continuation"
        ? insertChapterContinuation(sourceContent, session.targetRange.from, replacement)
        : replaceChapterSelection(sourceContent, session.targetRange, replacement);
      if (nextContent === sourceContent) throw new Error("Los cambios seleccionados son los mismos que el texto original y no es necesario guardarlos nuevamente.");
      await createNovelSnapshot(input.novelId, {
        triggerType: "manual", label: `chapter-editor:${chapter.order}:${session.scope}:${Date.now()}`,
      });
      const response = await updateNovelChapter(input.novelId, chapter.id, {
        content: nextContent, expectedUpdatedAt: input.savedUpdatedAt, expectedContent: input.savedContent,
      });
      const fullyAccepted = groupChapterEditorDiffChanges(candidate.diffChunks).every((change) => selectedChangeIds.has(change.id));
      return { sourceContent, nextContent, saved: response.data, fullyAccepted };
    },
    onSuccess: async ({ sourceContent, nextContent, saved, fullyAccepted }) => {
      const savedUpdatedAt = String(saved?.updatedAt ?? Date.now());
      input.acknowledgeSave(sourceContent, { content: saved?.content ?? nextContent, updatedAt: savedUpdatedAt });
      await input.onAccepted({ nextContent: saved?.content ?? nextContent, savedUpdatedAt, fullyAccepted });
      toast.success("Las modificaciones seleccionadas se han guardado y se puede visualizar la versión anterior en el historial.");
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "No se pudo aplicar el candidato de versión."),
  });
}
