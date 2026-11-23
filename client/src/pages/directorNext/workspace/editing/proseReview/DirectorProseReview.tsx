import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { proseParagraphs, type BatchProseReview } from "@ai-novel/shared/types/director/proseReview/discussion";
import { createDirectorCommandKey, submitDirectorCommand } from "@/api/directorNext";
import { queryKeys } from "@/api/queryKeys";
import { Button } from "@/components/ui/button";
import { AppDialogContent, Dialog } from "@/components/ui/dialog";
import type { WorkspaceChapter } from "../../model";
import { applyReviewSuggestions } from "../discussion/draft";
import { ReviewDiscussion } from "../discussion/ReviewDiscussion";
import DirectorCharacterCandidates, { useDirectorCharacterCandidates } from "@/components/directorNext/characters/DirectorCharacterCandidates";

interface Props {
  novelId: string;
  runId: string;
  expectedVersion: number;
  chapters: WorkspaceChapter[];
  hashes: Record<string, string>;
  nextRange: { from: number; to: number } | null;
  onClose: () => void;
  onConfirmed: () => void;
}
export function DirectorProseReview({
  novelId,
  runId,
  expectedVersion,
  chapters,
  hashes,
  nextRange,
  onClose,
  onConfirmed,
}: Props) {
  const queries = useQueryClient();
  const [opened] = useState(() =>
    chapters.map((chapter) => ({ chapter, hash: hashes[chapter.id], form: proseParagraphs(chapter.content!) })),
  );
  const [next] = useState(nextRange);
  const [selected, setSelected] = useState(opened[0].chapter.id);
  const [drafts, setDrafts] = useState<Record<string, Record<string, string>>>({});
  const [messages, setMessages] = useState<Record<string, string>>({});
  const [discard, setDiscard] = useState(false);
  const request = useRef({ body: "", key: "" });
  const current = opened.find((row) => row.chapter.id === selected)!;
  const draft = drafts[selected] ?? current.form.fields;
  const pending =
    opened.some(({ chapter, form }) => drafts[chapter.id] && form.render(drafts[chapter.id]) !== chapter.content) ||
    Object.values(messages).some((text) => text.trim());
  useEffect(() => {
    if (!pending) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [pending]);
  const mutation = useMutation({
    mutationFn: async (continueWriting: boolean) => {
      const review: BatchProseReview = {
        chapters: opened.map(({ chapter, hash, form }) => {
          const content = form.render(drafts[chapter.id] ?? form.fields);
          return { chapterId: chapter.id, baseHash: hash, ...(content !== chapter.content ? { content } : {}) };
        }),
        ...(continueWriting && next ? { nextRange: next } : {}),
      };
      const body = JSON.stringify(review);
      if (body !== request.current.body) request.current = { body, key: createDirectorCommandKey() };
      return submitDirectorCommand({
        type: "resolve_gate",
        runId,
        expectedVersion,
        proseReview: review,
        decision: review.chapters.some((row) => row.content !== undefined) ? "confirm_after_edit" : "confirm",
        idempotencyKey: request.current.key,
      });
    },
    onSuccess: async () => {
      await Promise.all(
        [
          ["directorBookWorkspace", novelId],
          queryKeys.directorNext.summary(novelId),
          queryKeys.directorNext.detail(novelId),
        ].map((queryKey) => queries.invalidateQueries({ queryKey })),
      );
      onClose();
      onConfirmed();
    },
  });
  const busy = mutation.isPending;
  const candidates = useDirectorCharacterCandidates(runId, true).data?.data;
  const blockingReviews = candidates?.reviews.filter(review => review.blocking &&
    opened.some(({chapter}) => chapter.id === review.chapterId) && review.items.some(item => item.status === "pending")) ?? [];
  const needsCharacters = !busy && blockingReviews.length > 0;
  const charactersPanel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (needsCharacters) charactersPanel.current?.focus();
  }, [needsCharacters]);
  function close() {
    if (!busy) {
      if (pending) setDiscard(true);
      else onClose();
    }
  }
  const nextLabel = next && (next.from === next.to ? `Cap. ${next.from}` : `Cap. ${next.from}–${next.to}`);
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) close();
      }}
    >
      <AppDialogContent
        title="Discutir y confirmar el texto de este lote."
        description="Elija un capítulo para leer y discutir. Los párrafos adoptados se mostrarán en el texto y podrá cambiar de capítulo y confirmarlos juntos."
        className="lg:h-[min(48rem,90dvh)] lg:max-w-6xl"
        bodyClassName="grid gap-5 lg:grid-cols-2 lg:overflow-hidden"
        footer={
          discard ? (
            <>
              <span className="mr-auto text-sm">¿Abandonar este manuscrito editado?</span>
              <Button variant="ghost" onClick={() => setDiscard(false)}>
                Continuar comprobando
              </Button>
              <Button variant="outline" onClick={onClose}>
                rendirse y cerrar
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" disabled={busy} onClick={close}>
                devolver
              </Button>
              {next && (
                <Button variant="outline" disabled={busy || needsCharacters} onClick={() => mutation.mutate(false)}>
                  Solo confirma este lote
                </Button>
              )}
              <Button disabled={busy || needsCharacters} onClick={() => mutation.mutate(Boolean(next))}>
                {busy ? "Guardando y sincronizando texto..." : nextLabel ? `Confirma y continúa escribiendo${nextLabel}` : "Confirmar el texto de este lote"}
              </Button>
            </>
          )
        }
      >
        <div className="min-w-0 space-y-4 lg:overflow-y-auto lg:pr-3">
          {needsCharacters && candidates && (
            <div ref={charactersPanel} tabIndex={-1}>
              <DirectorCharacterCandidates page={{...candidates, reviews: blockingReviews}} runId={runId}
                novelId={novelId} proseReview onResolved={() => mutation.reset()}/>
            </div>
          )}
          {mutation.isError && !needsCharacters && (
            <p role="alert" className="text-sm text-destructive">
              {mutation.error.message}
            </p>
          )}
          {opened.length > 1 ? (
            <label className="grid gap-1 text-sm">
              Seleccionar capítulo
              <select
                className="rounded-md border border-input bg-background px-3 py-2"
                value={selected}
                disabled={busy}
                onChange={(e) => setSelected(e.target.value)}
              >
                {opened.map(({ chapter }) => (
                  <option key={chapter.id} value={chapter.id}>
                    Cap. {chapter.order} capítulo · {chapter.title}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <h3 className="font-medium">
              Cap. {current.chapter.order} capítulo · {current.chapter.title}
            </h3>
          )}
          {Object.entries(draft).map(([key, value]) => (
            <div key={key} className="space-y-1">
              <p className="whitespace-pre-wrap break-words leading-8">{value}</p>
              {value !== current.form.fields[key] && (
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={busy || discard}
                  onClick={() =>
                    setDrafts((prev) => ({
                      ...prev,
                      [selected]: { ...prev[selected], [key]: current.form.fields[key] },
                    }))
                  }
                >
                  retirar el primero {key} Modificación de sección
                </Button>
              )}
            </div>
          ))}
        </div>
        <ReviewDiscussion
          key={selected}
          novelId={novelId}
          runId={runId}
          version={expectedVersion}
          scope={{ type: "chapter_batch_closed", bodyHash: current.hash }}
          subject={{ id: selected, title: `Cap. ${current.chapter.order} Capítulo · ${current.chapter.title}` }}
          fieldLabels={current.form.labels}
          base={current.form.fields}
          draft={draft}
          disabled={busy || discard}
          message={messages[selected] ?? ""}
          onMessage={(value) => setMessages((prev) => ({ ...prev, [selected]: value }))}
          onAccept={(changes) =>
            setDrafts((prev) => ({
              ...prev,
              [selected]: applyReviewSuggestions(prev[selected] ?? current.form.fields, current.form.fields, changes),
            }))
          }
        />
      </AppDialogContent>
    </Dialog>
  );
}
