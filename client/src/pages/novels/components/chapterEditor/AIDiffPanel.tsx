import type { ChapterEditorCandidate } from "@ai-novel/shared/types/novel";
import { Button } from "@/components/ui/button";
import type { ChapterEditorSessionState } from "./chapterEditorTypes";

interface AIDiffPanelProps {
  session: ChapterEditorSessionState;
  activeCandidate: ChapterEditorCandidate | null;
  isApplying: boolean;
  onSelectCandidate: (candidateId: string) => void;
  onChangeViewMode: (mode: "inline" | "block") => void;
  onAccept: () => void;
  onReject: () => void;
  onRegenerate: () => void;
}

export default function AIDiffPanel(props: AIDiffPanelProps) {
  const {
    session,
    activeCandidate,
    isApplying,
    onSelectCandidate,
    onChangeViewMode,
    onAccept,
    onReject,
    onRegenerate,
  } = props;

  const isIdle = session.status === "idle";
  const statusText = isIdle
    ? "Después de seleccionar el texto, puede iniciar una reescritura parcial de IA"
    : session.status === "loading"
      ? "Lanzamiento del candidato de construcción"
      : session.status === "error"
        ? session.errorMessage || "Error de generación"
        : session.requestLabel || "Ver reescrituras pendientes";

  return (
    <div className="flex h-full min-h-[420px] flex-col overflow-hidden rounded-3xl border border-border/70 bg-background shadow-sm xl:min-h-0">
      <div className="shrink-0 space-y-3 border-b border-border/70 px-4 py-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-medium text-foreground">La IA reescribe los resultados</div>
            <div className="text-xs text-muted-foreground">{statusText}</div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant={session.viewMode === "block" ? "default" : "outline"}
              onClick={() => onChangeViewMode("block")}
              disabled={isIdle}
            >
              Comparación de párrafos
            </Button>
            <Button
              size="sm"
              variant={session.viewMode === "inline" ? "default" : "outline"}
              onClick={() => onChangeViewMode("inline")}
              disabled={isIdle}
            >
              marca de detalle
            </Button>
          </div>
        </div>

        {session.status === "ready" ? (
          <div className="flex flex-wrap gap-2">
            {(session.candidates ?? []).map((candidate) => (
              <Button
                key={candidate.id}
                size="sm"
                variant={candidate.id === session.activeCandidateId ? "default" : "outline"}
                onClick={() => onSelectCandidate(candidate.id)}
              >
                {candidate.label}
              </Button>
            ))}
          </div>
        ) : null}
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
        {isIdle ? (
          <>
            <div className="rounded-2xl border border-dashed border-border/70 bg-muted/10 p-4 text-sm leading-6 text-muted-foreground">
              El panel de resultados de la derecha está fijo. Primero puede seleccionar un párrafo en el texto y luego iniciar "optimizar la expresión, expandir, simplificar, fortalecer la emoción, fortalecer el conflicto o personalizar instrucciones" desde la barra de herramientas flotante.
            </div>
            <div className="rounded-2xl border border-border/70 bg-muted/10 p-4">
              <div className="text-sm font-medium text-foreground">Esperando reescribir</div>
              <div className="mt-2 text-sm leading-6 text-muted-foreground">
                Después de iniciar una reescritura, aquí se muestran de 2 a 3 versiones candidatas, un resumen de la reescritura y una comparación de párrafos.
              </div>
            </div>
          </>
        ) : null}

        {session.status === "loading" ? (
          <div className="rounded-2xl border border-dashed border-border/70 bg-muted/10 p-4 text-sm text-muted-foreground">
            Generando de 2 a 3 versiones candidatas según el texto seleccionado, espere.
          </div>
        ) : null}

        {session.status === "error" ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">
            {session.errorMessage || "Error al generar el candidato. Inténtelo de nuevo."}
          </div>
        ) : null}

        {session.status === "ready" && activeCandidate ? (
          <>
            <div className="space-y-2 rounded-2xl border border-border/70 bg-muted/10 p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-medium text-foreground">{activeCandidate.label}</div>
                {activeCandidate.semanticTags && activeCandidate.semanticTags.length > 0 ? (
                  <div className="flex flex-wrap justify-end gap-2">
                    {activeCandidate.semanticTags.map((tag) => (
                      <span key={tag} className="rounded-full bg-muted px-2 py-1 text-[11px] text-muted-foreground">
                        {tag}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
              {activeCandidate.summary ? (
                <div className="text-sm leading-6 text-muted-foreground">{activeCandidate.summary}</div>
              ) : null}
            </div>

            {session.viewMode === "block" ? (
              <div className="rounded-2xl border border-border/70 bg-muted/10 p-3 text-sm leading-6 text-muted-foreground">
                El área de texto del medio muestra una comparación de parches de párrafos. El texto original se conservará en bloques de color rojo claro y el texto reescrito estará en bloques de color verde claro en la misma posición, lo que facilitará juzgar directamente si se adopta de acuerdo con el orden de lectura de la novela.
              </div>
            ) : (
              <div className="rounded-2xl border border-border/70 bg-muted/10 p-3 text-sm leading-6 text-muted-foreground">
                El área de texto del medio muestra la marca de detalle diff, que es adecuada para confirmar la posición de eliminación específica; Si prefieres seguir leyendo la novela, será más fácil volver a "Comparación de párrafos".
              </div>
            )}
          </>
        ) : null}
      </div>

      <div className="shrink-0 flex flex-wrap items-center justify-end gap-2 border-t border-border/70 px-4 py-4">
        <Button size="sm" variant="outline" onClick={onReject} disabled={isIdle || session.status === "loading" || isApplying}>
          rechazar todo
        </Button>
        <Button size="sm" variant="outline" onClick={onRegenerate} disabled={isIdle || session.status === "loading" || isApplying}>
          regenerado
        </Button>
        <Button size="sm" onClick={onAccept} disabled={session.status !== "ready" || !activeCandidate || isApplying}>
          {isApplying ? "Aplicando..." : "Aceptar todo"}
        </Button>
      </div>
    </div>
  );
}
