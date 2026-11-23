import { useEffect, useState, useRef, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { FinalFinding, FinalReview } from "@ai-novel/shared/types/director/finalReview/contract";
import { proseParagraphs } from "@ai-novel/shared/types/director/proseReview/discussion";
import { Dialog, AppDialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ReviewDiscussion } from "../editing/discussion/ReviewDiscussion";
import { applyReviewSuggestions } from "../editing/discussion/draft";
import { readFinalReview, inspectChapter, approveManuscript, downloadFinalManuscript } from "./api";

interface Props {
  novelId: string;
  onClose: () => void;
}
export function FinalReviewDialog(props: Props) {
  const query = useQuery({
    queryKey: ["director-final-review", props.novelId],
    queryFn: () => readFinalReview(props.novelId),
    gcTime: 0,
    refetchOnWindowFocus: false,
    retry: false,
  });
  if (query.data) return <ReviewEditor {...props} book={query.data} />;
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) props.onClose();
      }}
    >
      <AppDialogContent title="Reseña completa del libro">
        {query.isError ? (
          <>
            <p role="alert">{query.error.message}</p>
            <Button variant="outline" onClick={() => void query.refetch()}>
              releer
            </Button>
          </>
        ) : (
          <p role="status">Leyendo el manuscrito completo...</p>
        )}
      </AppDialogContent>
    </Dialog>
  );
}
function ReviewEditor({ novelId, onClose, book: loaded }: Props & { book: FinalReview }) {
  const [book] = useState(loaded);
  const cache = useQueryClient();
  const [reports, setReports] = useState<Record<string, FinalFinding[] | null>>(() =>
    Object.fromEntries(book.chapters.map((c) => [c.id, c.findings])),
  );
  const [selected, setSelected] = useState(
    () => book.chapters.find((c) => c.findings?.length)?.id ?? book.chapters[0].id,
  );
  const [focus, setFocus] = useState<number | "all">(0);
  const chapter = book.chapters.find((c) => c.id === selected)!;
  const report = reports[selected],
    finding = typeof focus === "number" && report?.[focus] ? focus : "all";
  const form = useMemo(() => proseParagraphs(chapter.content), [chapter.content]);
  const [drafts, setDrafts] = useState<Record<string, Record<string, string>>>({});
  const [messages, setMessages] = useState<Record<string, string>>({});
  const [confirmed, setConfirmed] = useState(book.confirmedVersion);
  const [discard, setDiscard] = useState(false);
  const [checking, setChecking] = useState<number | null>(null);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const draft = drafts[selected] ?? form.fields;
  const issueKey = JSON.stringify([selected, finding]);
  const edits = useMemo(
    () =>
      book.chapters.flatMap((c) => {
        if (!drafts[c.id]) return [];
        const content = proseParagraphs(c.content).render(drafts[c.id]);
        return content === c.content ? [] : [{ chapterId: c.id, content }];
      }),
    [book, drafts],
  );
  const pending = edits.length > 0 || Object.values(messages).some((value) => value.trim());
  useEffect(() => {
    if (!pending || confirmed) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [pending, confirmed]);
  const checked = Object.values(reports).filter(Boolean).length,
    complete = checked === book.chapters.length;
  const scan = useMutation({
    mutationFn: async () => {
      try {
        for (const c of book.chapters) {
          if (!mounted.current) break;
          if (reports[c.id] !== null) continue;
          setChecking(c.order);
          const findings = await inspectChapter(novelId, c);
          if (!mounted.current) break;
          setReports((prev) => ({ ...prev, [c.id]: findings }));
        }
      } finally {
        if (mounted.current) setChecking(null);
      }
    },
  });
  const download = useMutation({
    mutationFn: async () => {
      let version = confirmed;
      if (!version) {
        const receipt = await approveManuscript(novelId, { version: book.version, edits });
        version = receipt.confirmedVersion;
        setConfirmed(version);
        void cache.invalidateQueries({ queryKey: ["directorBookWorkspace", novelId] });
      }
      await downloadFinalManuscript(novelId, version);
    },
    onSuccess: onClose,
  });
  const busy = download.isPending;
  function close() {
    if (busy) return;
    if (pending && !confirmed) setDiscard(true);
    else onClose();
  }
  const otherIssues = book.chapters.filter((c) => c.id !== selected && reports[c.id]?.length);
  const nextIssue = otherIssues.find((c) => c.order > chapter.order) ?? otherIssues[0];
  const issueCount = Object.values(reports).reduce((count, items) => count + (items?.length ?? 0), 0);
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) close();
      }}
    >
      <AppDialogContent
        title="Reseña completa del libro"
        description={
          confirmed
            ? "El manuscrito confirmado de todo el libro se puede descargar como TXT."
            : "Capítulo por capítulo, verifique la conexión entre el texto principal y los capítulos anteriores y siguientes. Si tiene problemas, puede discutirlo con su asistente y conservar el texto original o adoptar métodos revisados ​​párrafo por párrafo."
        }
        className="lg:h-[min(50rem,90dvh)] lg:max-w-6xl"
        bodyClassName="grid gap-6 lg:grid-cols-2 lg:overflow-hidden"
        footer={
          <>
            {discard ? (
              <>
                <p className="mr-auto text-sm">¿Abandonar las modificaciones y entradas de párrafos no confirmados?</p>
                <Button variant="ghost" onClick={() => setDiscard(false)}>
                  Continuar comprobando
                </Button>
                <Button variant="outline" onClick={onClose}>
                  rendirse y cerrar
                </Button>
              </>
            ) : (
              <>
                <Button variant="ghost" onClick={close} disabled={busy}>
                  devolver
                </Button>
                {confirmed && book.confirmedVersion === confirmed && (
                  <Button variant="outline" disabled={busy} onClick={() => setConfirmed(null)}>
                    Continuar revisando el texto.
                  </Button>
                )}
                {confirmed || complete ? (
                  <Button disabled={busy} onClick={() => download.mutate()}>
                    {busy ? "Preparando libro completo TXT..." : confirmed ? "Descarga el libro confirmado" : "Confirme el manuscrito y exporte el libro completo a TXT"}
                  </Button>
                ) : (
                  <Button disabled={scan.isPending} onClick={() => scan.mutate()}>
                    {scan.isPending ? "De cheques…" : checked || scan.isError ? "Continúe revisando los capítulos restantes." : "Empiece a consultar todo el libro."}
                  </Button>
                )}
              </>
            )}
          </>
        }
      >
        <section className="min-w-0 space-y-4 lg:overflow-y-auto lg:pr-3">
          <p role="status" className="text-sm text-muted-foreground">
            {confirmed
              ? `Todo el libro contiene ${book.chapters.length}`
              : `comprobado ${checked} / ${book.chapters.length} Capítulo · ${issueCount} pregunta`}
            {checking !== null && ` · Lectura del capítulo ${checking}`}
          </p>
          {scan.isError && (
            <p role="alert" className="text-sm text-destructive">
              {scan.error.message}
            </p>
          )}
          {download.isError && (
            <p role="alert" className="text-sm text-destructive">
              {download.error.message}
            </p>
          )}
          <label className="grid gap-1 text-sm">
            Seleccionar capítulo
            <select
              disabled={busy}
              className="rounded-md border border-input bg-background px-3 py-2"
              value={selected}
              onChange={(e) => {
                setSelected(e.target.value);
                setFocus(0);
              }}
            >
              {book.chapters.map((c) => (
                <option key={c.id} value={c.id}>
                  Cap. {c.order} capítulo · {c.title}
                  {confirmed
                    ? ""
                    : reports[c.id] === null
                      ? " · Para ser inspeccionado"
                      : reports[c.id]?.length
                        ? ` · ${reports[c.id]?.length} pregunta`
                        : " · No se encontró ningún problema"}
                </option>
              ))}
            </select>
          </label>
          {nextIssue && !confirmed && (
            <Button
              size="sm"
              variant="ghost"
              disabled={busy}
              onClick={() => {
                setSelected(nextIssue.id);
                setFocus(0);
              }}
            >
              Ver el {nextIssue.order} pregunta del capitulo
            </Button>
          )}
          {report &&
            !confirmed &&
            (report.length ? (
              <fieldset className="space-y-2">
                <legend className="mb-1 font-medium">Elija un tema para discutir</legend>
                {report.map((item, i) => (
                  <label key={i} className="flex cursor-pointer items-start gap-2 border-b border-border/40 py-2">
                    <input
                      type="radio"
                      className="mt-1.5"
                      name="final-review-finding"
                      checked={finding === i}
                      disabled={busy}
                      onChange={() => setFocus(i)}
                    />
                    <span className="space-y-1 text-sm">
                      <span className="block font-medium">
                        Cap. {item.paragraph} parte · {item.problem}
                      </span>
                      <q className="block text-muted-foreground">{item.quote}</q>
                      <span className="block">{item.advice}</span>
                    </span>
                  </label>
                ))}
              </fieldset>
            ) : (
              <p className="text-sm">No se encontraron problemas que requieran revisión en este capítulo.</p>
            ))}
          <h3 className="font-medium">
            Cap. {chapter.order} capítulo · {chapter.title}
          </h3>
          {Object.entries(draft).map(([key, value]) => (
            <div key={key} className="space-y-1">
              <p className="whitespace-pre-wrap break-words leading-8">{value}</p>
              {value !== form.fields[key] && !confirmed && (
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={busy}
                  onClick={() =>
                    setDrafts((prev) => ({ ...prev, [selected]: { ...prev[selected], [key]: form.fields[key] } }))
                  }
                >
                  retirar el primero {key} Modificación de sección
                </Button>
              )}
            </div>
          ))}
        </section>
        {report && !confirmed ? (
          <ReviewDiscussion
            key={issueKey}
            novelId={novelId}
            scope={{ type: "final_review", sourceHash: chapter.sourceHash, finding }}
            subject={{ id: selected, title: `Cap. ${chapter.order} Capítulo · ${chapter.title}` }}
            fieldLabels={form.labels}
            base={form.fields}
            draft={draft}
            disabled={busy || discard}
            message={messages[issueKey] ?? ""}
            onMessage={(value) => setMessages((prev) => ({ ...prev, [issueKey]: value }))}
            onAccept={(changes) =>
              setDrafts((prev) => ({
                ...prev,
                [selected]: applyReviewSuggestions(prev[selected] ?? form.fields, form.fields, changes),
              }))
            }
          />
        ) : !confirmed ? (
          <p className="text-sm text-muted-foreground">Una vez completada la inspección de este capítulo, los comentarios de la inspección se pueden discutir aquí.</p>
        ) : null}
      </AppDialogContent>
    </Dialog>
  );
}
