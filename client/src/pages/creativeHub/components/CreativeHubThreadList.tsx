import type { CreativeHubThread } from "@ai-novel/shared/types/creativeHub";
import { RefreshCw } from "lucide-react";
import { WorkspaceStateNotice } from "@/components/workspace";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface CreativeHubThreadListProps {
  threads: CreativeHubThread[];
  activeThreadId: string;
  loading?: boolean;
  errorMessage?: string;
  retryPending?: boolean;
  actionPending?: boolean;
  actionDisabled?: boolean;
  pendingThreadId?: string;
  onRetry?: () => void;
  onSelect: (threadId: string) => void;
  onCreate: () => void;
  onArchive: (threadId: string, archived: boolean) => void;
  onDelete: (threadId: string) => void;
}

function toStatusLabel(status: CreativeHubThread["status"]): string {
  if (status === "busy") return "Ejecutando";
  if (status === "interrupted") return "Pendiente de confirmación";
  if (status === "error") return "Incidencia";
  return "Gratis";
}

function toStatusVariant(
  status: CreativeHubThread["status"],
): "default" | "secondary" | "destructive" | "outline" {
  if (status === "busy") return "default";
  if (status === "interrupted") return "secondary";
  if (status === "error") return "destructive";
  return "outline";
}

export default function CreativeHubThreadList({
  threads,
  activeThreadId,
  loading = false,
  errorMessage = "",
  retryPending = false,
  actionPending = false,
  actionDisabled = false,
  pendingThreadId = "",
  onRetry,
  onSelect,
  onCreate,
  onArchive,
  onDelete,
}: CreativeHubThreadListProps) {
  return (
    <Card
      className="flex h-full min-h-0 flex-col rounded-lg shadow-none"
      aria-busy={actionPending || retryPending || Boolean(pendingThreadId)}
    >
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base">Hilo de creación</CardTitle>
          <Badge variant="outline">{threads.length}</Badge>
        </div>
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden">
        <Button className="h-9 w-full" onClick={onCreate} disabled={actionPending || actionDisabled}>
          {actionPending ? "Creando..." : "Crear un nuevo hilo"}
        </Button>
        {loading ? (
          <WorkspaceStateNotice compact loading tone="info" title="Cargando hilo" description="Por favor espera." />
        ) : errorMessage ? (
          <WorkspaceStateNotice
            compact
            tone="danger"
            title="Error al cargar la lista de temas"
            description={errorMessage}
            action={onRetry ? (
              <Button type="button" size="sm" variant="outline" disabled={retryPending} onClick={onRetry}>
                <RefreshCw className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                {retryPending ? "Intentando de nuevo..." : "Reintentar"}
              </Button>
            ) : null}
          />
        ) : (
          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
            {threads.map((thread) => {
              const current = thread.id === activeThreadId;
              const pending = pendingThreadId === thread.id;
              return (
                <div
                  key={thread.id}
                  className={cn(
                    "rounded-md border px-3 py-2.5",
                    current ? "border-primary bg-primary/5" : "border-border bg-background",
                  )}
                >
                  <button
                    type="button"
                    className="w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    onClick={() => onSelect(thread.id)}
                    disabled={actionDisabled}
                    aria-current={current ? "true" : undefined}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 truncate text-sm font-medium text-foreground">
                        {thread.title}{current ? " · Actual" : ""}
                      </div>
                      <Badge variant={toStatusVariant(thread.status)}>{toStatusLabel(thread.status)}</Badge>
                    </div>
                    <div className="mt-1 text-xs leading-4 text-muted-foreground">
                      {thread.resourceBindings.novelId ? "Novela encuadernada" : "Novela sin encuadernar"}
                    </div>
                  </button>
                  <div className="mt-2 flex gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 text-xs"
                      onClick={() => onArchive(thread.id, !thread.archived)}
                      disabled={pending || actionDisabled}
                    >
                      {pending ? "Procesando..." : thread.archived ? "Desarchivar" : "Archivo"}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 text-xs text-destructive hover:text-destructive"
                      onClick={() => onDelete(thread.id)}
                      disabled={pending || actionDisabled}
                    >
                      borrar
                    </Button>
                  </div>
                </div>
              );
            })}
            {threads.length === 0 ? (
              <div className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">
                Una vez que crea un hilo, puede mantener un registro de sus objetivos creativos y su ejecución en torno a la misma novela.
              </div>
            ) : null}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
