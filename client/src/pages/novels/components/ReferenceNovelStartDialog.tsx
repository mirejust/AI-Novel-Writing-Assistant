import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { BookAnalysis } from "@ai-novel/shared/types/bookAnalysis";
import { BookOpen, Check, GitBranch, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { listBookAnalyses } from "@/api/bookAnalysis";
import { queryKeys } from "@/api/queryKeys";
import { Button } from "@/components/ui/button";
import { AppDialogContent, Dialog } from "@/components/ui/dialog";

export type ReferenceNovelCreateMode = "continuation" | "adaptation";

interface ReferenceNovelStartDialogProps {
  open: boolean;
  fixedAnalysis?: BookAnalysis | null;
  onOpenChange: (open: boolean) => void;
}

export default function ReferenceNovelStartDialog({
  open,
  fixedAnalysis,
  onOpenChange,
}: ReferenceNovelStartDialogProps) {
  const navigate = useNavigate();
  const [targetForm, setTargetForm] = useState<"long_novel" | "short_story">("long_novel");
  const [selectedAnalysisId, setSelectedAnalysisId] = useState(fixedAnalysis?.id ?? "");
  const analysesQuery = useQuery({
    queryKey: queryKeys.bookAnalysis.list("reference-novel-start-succeeded"),
    queryFn: () => listBookAnalyses({ status: "succeeded" }),
    enabled: open && !fixedAnalysis,
  });
  const analyses = useMemo(
    () => fixedAnalysis ? [fixedAnalysis] : (analysesQuery.data?.data ?? []),
    [analysesQuery.data?.data, fixedAnalysis],
  );
  const selectedAnalysis = analyses.find((analysis) => analysis.id === selectedAnalysisId) ?? analyses[0] ?? null;

  useEffect(() => {
    if (open && !analyses.some((analysis) => analysis.id === selectedAnalysisId)) {
      setSelectedAnalysisId(analyses[0]?.id ?? "");
    }
  }, [analyses, open, selectedAnalysisId]);

  const startCreation = (mode: ReferenceNovelCreateMode) => {
    if (!selectedAnalysis || (targetForm === "short_story" && mode === "continuation")) {
      return;
    }
    const params = new URLSearchParams({
      referenceMode: mode,
      bookAnalysisId: selectedAnalysis.id,
      sourceDocumentId: selectedAnalysis.documentId,
      referenceTitle: selectedAnalysis.documentTitle,
    });
    onOpenChange(false);
    if (targetForm === "short_story") params.set("form", "short_story");
    navigate(`${targetForm === "short_story" ? "/create" : "/novels/auto-director"}?${params.toString()}`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <AppDialogContent
        className="max-w-3xl"
        title="Escribir según un libro"
        description="Seleccione la novela de referencia y el método de creación, y el sistema introducirá automáticamente la conclusión y el método de escritura del libro."
      >
        {!fixedAnalysis ? (
          <section>
            <div className="text-sm font-medium text-foreground">Elige una novela de referencia</div>
            {analysesQuery.isLoading ? (
              <div className="mt-3 flex items-center gap-2 rounded-xl bg-muted/45 px-4 py-6 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />Leyendo novelas disponibles...
              </div>
            ) : analyses.length > 0 ? (
              <div className="mt-3 max-h-56 space-y-1 overflow-y-auto rounded-xl bg-muted/35 p-2" role="radiogroup" aria-label="Novela de referencia">
                {analyses.map((analysis) => {
                  const selected = analysis.id === selectedAnalysis?.id;
                  return (
                    <button
                      key={analysis.id}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      className={`flex w-full items-start justify-between gap-3 rounded-lg px-3 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${selected ? "bg-background text-foreground ring-1 ring-border" : "text-muted-foreground hover:bg-background/65"}`}
                      onClick={() => setSelectedAnalysisId(analysis.id)}
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium text-foreground">{analysis.documentTitle}</span>
                        <span className="mt-1 block truncate text-xs">{analysis.title}</span>
                      </span>
                      {selected ? <Check className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" /> : null}
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="mt-3 rounded-xl bg-muted/45 px-4 py-5 text-sm text-muted-foreground">
                <p>Todavía no he terminado de desempacar la novela de referencia.</p>
                <Button type="button" variant="ghost" className="mt-2 h-auto p-0 text-primary hover:bg-transparent" onClick={() => navigate("/book-analysis")}>Importar y analizar novelas de referencia.</Button>
              </div>
            )}
          </section>
        ) : (
          <div className="rounded-xl bg-muted/40 px-4 py-3">
            <div className="text-xs text-muted-foreground">Novela de referencia</div>
            <div className="mt-1 font-medium text-foreground">{fixedAnalysis.documentTitle}</div>
          </div>
        )}

        <section className="mt-5" aria-label="Escala de trabajo">
          <div className="text-sm font-medium">Elige el tamaño de tu obra</div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button type="button" variant={targetForm === "long_novel" ? "default" : "outline"} aria-pressed={targetForm === "long_novel"} onClick={() => setTargetForm("long_novel")}>Novedoso</Button>
            <Button type="button" variant={targetForm === "short_story" ? "default" : "outline"} aria-pressed={targetForm === "short_story"} onClick={() => setTargetForm("short_story")}>Cuento breve · 3000—30 000 palabras</Button>
          </div>
        </section>
        <section className="mt-5">
          <div className="text-sm font-medium text-foreground">Elige cómo crear</div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              className="rounded-xl bg-muted/55 p-5 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              disabled={!selectedAnalysis || targetForm === "short_story"}
              onClick={() => startCreation("continuation")}
            >
              <BookOpen className="h-5 w-5" aria-hidden="true" />
              <div className="mt-4 font-semibold text-foreground">Continuación del trabajo original.</div>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{targetForm === "short_story" ? "Si quieres seguir escribiendo una obra original, elige una larga; Las historias cortas apoyan los métodos de préstamo y la creación de nuevas historias." : "Conserva los personajes, las reglas del mundo, la línea de tiempo y las pistas inacabadas, y continúa escribiendo desde el final de la obra original."}</p>
            </button>
            <button
              type="button"
              className="rounded-xl bg-muted/55 p-5 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              disabled={!selectedAnalysis}
              onClick={() => startCreation("adaptation")}
            >
              <GitBranch className="h-5 w-5" aria-hidden="true" />
              <div className="mt-4 font-semibold text-foreground">{targetForm === "short_story" ? "Crear nuevas historias cortas con referencia." : "Creación de referencia nuevo libro."}</div>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">En referencia a la estructura, el ritmo y la escritura, se regeneran personajes, mundo y trama.</p>
            </button>
          </div>
        </section>
      </AppDialogContent>
    </Dialog>
  );
}
