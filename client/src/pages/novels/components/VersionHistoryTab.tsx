import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createNovelSnapshot, listNovelSnapshots, restoreNovelSnapshot } from "@/api/novel";
import { queryKeys } from "@/api/queryKeys";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface VersionHistoryTabProps {
  novelId: string;
}

function formatSnapshotTrigger(triggerType: string): string {
  if (triggerType === "manual") {
    return "Guardar manualmente";
  }
  if (triggerType === "auto_milestone") {
    return "Hitos automáticos";
  }
  if (triggerType === "before_pipeline") {
    return "Antes del procesamiento por lotes";
  }
  return "Instantánea de la versión";
}

export default function VersionHistoryTab({ novelId }: VersionHistoryTabProps) {
  const queryClient = useQueryClient();
  const snapshotsQuery = useQuery({
    queryKey: queryKeys.novels.snapshots(novelId),
    queryFn: () => listNovelSnapshots(novelId),
    enabled: Boolean(novelId),
  });

  const createMutation = useMutation({
    mutationFn: () => createNovelSnapshot(novelId, {
      triggerType: "manual",
      label: `manual-${new Date().toLocaleString()}`,
    }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.novels.snapshots(novelId) });
    },
  });

  const restoreMutation = useMutation({
    mutationFn: (snapshotId: string) => restoreNovelSnapshot(novelId, snapshotId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.novels.detail(novelId) });
      await queryClient.invalidateQueries({ queryKey: queryKeys.novels.snapshots(novelId) });
    },
  });

  const snapshots = snapshotsQuery.data?.data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-muted/15 p-4 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="font-medium">Historial de versiones</div>
          <div className="text-sm text-muted-foreground">
            Aquí damos prioridad a ayudarle a encontrar la última versión estable. El sistema realizará automáticamente una copia de seguridad del estado actual antes de la restauración.
          </div>
        </div>
        <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending}>
          {createMutation.isPending ? "Guardando..." : "Guardar versión actual"}
        </Button>
      </div>

      <div className="space-y-3">
        {snapshots.map((snapshot) => {
          const isRestoringCurrent = restoreMutation.isPending && restoreMutation.variables === snapshot.id;

          return (
            <div key={snapshot.id} className="rounded-2xl border border-border/70 bg-background p-4 shadow-sm">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="space-y-3">
                  <div className="space-y-1">
                    <div className="font-medium">{snapshot.label || "Versión sin nombre"}</div>
                    <div className="text-xs text-muted-foreground">
                      {formatSnapshotTrigger(snapshot.triggerType)} · {new Date(snapshot.createdAt).toLocaleString()}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Badge variant={snapshot.triggerType === "manual" ? "secondary" : "outline"}>
                      {formatSnapshotTrigger(snapshot.triggerType)}
                    </Badge>
                    <Badge variant="outline">{new Date(snapshot.createdAt).toLocaleDateString()}</Badge>
                  </div>

                  <div className="text-sm leading-6 text-muted-foreground">
                    Esta versión es adecuada cuando desea volver a un estado más estable de avance de capítulos.
                  </div>
                </div>

                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    const confirmed = window.confirm("Se realizará una copia de seguridad automática del estado actual antes de la restauración. ¿Está seguro de que desea restaurar esta versión?");
                    if (confirmed) {
                      restoreMutation.mutate(snapshot.id);
                    }
                  }}
                  disabled={restoreMutation.isPending}
                >
                  {isRestoringCurrent ? "Recuperante..." : "Volver a esta versión"}
                </Button>
              </div>
            </div>
          );
        })}
        {snapshots.length === 0 ? (
          <div className="rounded-2xl border border-dashed p-6 text-sm text-muted-foreground">
            Actualmente no existe ningún registro de versión. Se recomienda guardar manualmente una versión antes de realizar cambios importantes en la dirección, generación de lotes o reescritura de secciones grandes.
          </div>
        ) : null}
      </div>
    </div>
  );
}
