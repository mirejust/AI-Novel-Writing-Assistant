import { useState } from "react";
import type { KnowledgeDocumentDetail, KnowledgeRecallTestResult } from "@ai-novel/shared/types/knowledge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AppDialogContent, Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { formatStatus } from "./knowledgeRagUi";

const PREVIEW_CHAR_LIMIT = 3000;
const EXPAND_WARN_THRESHOLD = 100_000;

function VersionContentPreview({ content }: { content: string }) {
  const [expanded, setExpanded] = useState(false);
  const truncated = content.length > PREVIEW_CHAR_LIMIT && !expanded;
  const displayText = truncated ? content.slice(0, PREVIEW_CHAR_LIMIT) : content;
  const isLarge = content.length > EXPAND_WARN_THRESHOLD;

  const handleExpand = () => {
    if (!expanded && isLarge) {
      if (!window.confirm(`Documentos totales ${content.length.toLocaleString()} personajes. Ampliar el texto completo puede provocar que la página se congele. ¿Estás seguro de que quieres continuar?`)) {
        return;
      }
    }
    setExpanded((v) => !v);
  };

  return (
    <div className="mt-3">
      <pre className="max-h-64 w-full max-w-full overflow-x-hidden overflow-y-auto whitespace-pre-wrap break-all rounded-md bg-muted/40 p-3 text-xs">
        {displayText}
        {truncated ? "…" : null}
      </pre>
      {content.length > PREVIEW_CHAR_LIMIT ? (
        <button
          type="button"
          className="mt-1 text-xs text-muted-foreground underline-offset-2 hover:underline"
          onClick={handleExpand}
        >
          {expanded
            ? `Colapso (Total ${content.length.toLocaleString()} personaje)`
            : `Mostrar solo antes ${PREVIEW_CHAR_LIMIT.toLocaleString()} Caracteres, haz clic para expandir el texto completo (total ${content.length.toLocaleString()} personaje)`}
        </button>
      ) : null}
    </div>
  );
}

interface KnowledgeDocumentDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  document?: KnowledgeDocumentDetail;
  selectedDocumentId: string;
  versionBusy: boolean;
  onUploadVersionFile: (file: File) => Promise<void>;
  onReindex: () => void;
  recallQuery: string;
  onRecallQueryChange: (value: string) => void;
  onRecallTest: () => void;
  recallPending: boolean;
  recallErrorMessage?: string | null;
  recallResult: KnowledgeRecallTestResult | null;
  onRestoreDocument: () => void;
  restorePending: boolean;
  onActivateVersion: (versionId: string) => void;
  activateVersionPending: boolean;
}

export default function KnowledgeDocumentDetailDialog({
  open,
  onOpenChange,
  document,
  selectedDocumentId,
  versionBusy,
  onUploadVersionFile,
  onReindex,
  recallQuery,
  onRecallQueryChange,
  onRecallTest,
  recallPending,
  recallErrorMessage,
  recallResult,
  onRestoreDocument,
  restorePending,
  onActivateVersion,
  activateVersionPending,
}: KnowledgeDocumentDetailDialogProps) {
  const isArchived = document?.status === "archived";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <AppDialogContent
        className="max-w-4xl"
        title={document?.title ?? "Detalles del documento de conocimiento"}
        bodyClassName="min-w-0 space-y-4"
      >
          <div className="flex flex-wrap gap-2">
            {isArchived ? (
              <Button variant="outline" onClick={onRestoreDocument} disabled={restorePending}>
                {restorePending ? "Recuperante..." : "Restaurar habilitado"}
              </Button>
            ) : (
              <input
                type="file"
                accept=".txt,text/plain"
                className="rounded-md border bg-background p-2 text-sm"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.target.value = "";
                  if (!file) {
                    return;
                  }
                  void onUploadVersionFile(file);
                }}
                disabled={versionBusy}
              />
            )}
            {selectedDocumentId && !isArchived ? (
              <Button variant="outline" onClick={onReindex}>
                Reconstruir manualmente el índice
              </Button>
            ) : null}
          </div>

          {document ? (
            <>
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <Badge variant="outline">Estado del documento:{formatStatus(document.status)}</Badge>
                <Badge variant="outline">Estado del índice:{formatStatus(isArchived ? "idle" : (document.latestIndexStatus ?? "-"))}</Badge>
              </div>
              {document.latestIndexStatus === "failed" && document.latestIndexError ? (
                <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
                  Motivo del fallo del índice:{document.latestIndexError}
                </div>
              ) : null}

              <Card>
                <CardHeader>
                  <CardTitle>Prueba de recuerdo</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {isArchived ? (
                    <div className="text-sm text-muted-foreground">
                      Después de reactivar y completar la indexación, puede probar el efecto de recuperación.
                    </div>
                  ) : document.latestIndexStatus === "succeeded" ? (
                    <>
                      <div className="flex min-w-0 flex-col gap-2 md:flex-row">
                        <Input
                          value={recallQuery}
                          onChange={(event) => onRecallQueryChange(event.target.value)}
                          placeholder="Ingrese una pregunta o fragmento para probar el efecto de recuperación de la versión actualmente activada"
                        />
                        <Button
                          onClick={onRecallTest}
                          disabled={recallPending || !selectedDocumentId || !recallQuery.trim()}
                        >
                          {recallPending ? "Pruebas..." : "Empezar a probar"}
                        </Button>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Las pruebas de recuperación solo se realizan en la versión actualmente activa e indexada.
                      </div>
                      {recallErrorMessage ? (
                        <div className="text-sm text-destructive">{recallErrorMessage}</div>
                      ) : null}
                      {recallResult ? (
                        <div className="min-w-0 space-y-2 overflow-hidden">
                          {recallResult.hits.length === 0 ? (
                            <div className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
                              La consulta actual no recuerda ningún contenido fragmentado.
                            </div>
                          ) : (
                            recallResult.hits.map((hit, index) => (
                              <div key={hit.id} className="min-w-0 max-w-full overflow-hidden rounded-md border p-3">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <div className="min-w-0 break-all font-medium">
                                    golpear {index + 1} | {hit.source === "reranked" ? "Reorganizar" : hit.source === "vector" ? "Vector" : "Palabras clave"} | Trozo #{hit.chunkOrder + 1}
                                  </div>
                                  <Badge variant="outline">Puntaje {hit.score.toFixed(4)}</Badge>
                                </div>
                                {hit.title ? (
                                  <div className="mt-1 break-all text-xs text-muted-foreground">{hit.title}</div>
                                ) : null}
                                {hit.contextPrefix ? (
                                  <div className="mt-2 break-all rounded-md bg-muted/50 p-2 text-xs text-muted-foreground">
                                    {hit.contextPrefix}
                                  </div>
                                ) : null}
                                <pre className="mt-3 max-h-52 w-full max-w-full overflow-x-hidden overflow-y-auto whitespace-pre-wrap break-all rounded-md bg-muted/40 p-3 text-xs">
                                  {hit.chunkText}
                                </pre>
                              </div>
                            ))
                          )}
                        </div>
                      ) : null}
                    </>
                  ) : (
                    <div className="text-sm text-muted-foreground">
                      La prueba de recuperación solo se puede realizar después de que la versión actualmente activada se haya indexado correctamente.
                    </div>
                  )}
                </CardContent>
              </Card>

              <div className="min-w-0 space-y-3">
                {document.versions.map((version) => (
                  <div key={version.id} className="min-w-0 max-w-full overflow-hidden rounded-md border p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="font-medium">Versión v{version.versionNumber}</div>
                      {version.isActive ? <Badge>Actualmente activo</Badge> : null}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      Número de caracteres {version.charCount} | {new Date(version.createdAt).toLocaleString()}
                    </div>
                    {!version.isActive && !isArchived ? (
                      <div className="mt-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => onActivateVersion(version.id)}
                          disabled={activateVersionPending}
                        >
                          Cambiar a la versión activa
                        </Button>
                      </div>
                    ) : null}
                    <VersionContentPreview content={version.content} />
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
              Cargando detalles del documento...
            </div>
          )}
      </AppDialogContent>
    </Dialog>
  );
}
