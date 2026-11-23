import type { RecoverableTaskSummary } from "@ai-novel/shared/types/task";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AppDialogContent,
  Dialog,
} from "@/components/ui/dialog";
import { useTaskRecovery } from "./TaskRecoveryContext";

function formatTaskKind(kind: RecoverableTaskSummary["kind"]): string {
  if (kind === "novel_workflow") {
    return "El flujo principal de la novela.";
  }
  if (kind === "novel_pipeline") {
    return "Canalización de capítulos";
  }
  if (kind === "book_analysis") {
    return "Tarea de apertura de libro";
  }
  if (kind === "style_extraction") {
    return "Extracción de escritura";
  }
  return "Tarea de imagen";
}

export default function TaskRecoveryDialog() {
  const { items, isOpen, closeDialog } = useTaskRecovery();

  return (
    <Dialog open={isOpen} onOpenChange={(nextOpen) => { if (!nextOpen) closeDialog(); }}>
      <AppDialogContent
        title="Tareas por hacer"
        description="Abra la página de creación correspondiente, vea los resultados guardados y la ubicación de la interrupción, y luego seleccione Siguiente."
        footer={(
          <Button variant="outline" onClick={closeDialog}>
            lidiar con eso más tarde
          </Button>
        )}
      >
        <div className="divide-y divide-border">
          {items.map((item) => (
            <section key={`${item.kind}-${item.id}`} className="space-y-3 py-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">{formatTaskKind(item.kind)}</Badge>
                    <Badge variant={item.status === "running" ? "default" : "secondary"}>
                      {item.status === "running" ? "Interrupción de la operación" : "Interrupción de la cola"}
                    </Badge>
                  </div>
                  <div className="text-base font-semibold">{item.title}</div>
                  <div className="text-sm text-muted-foreground">Objeto de pertenencia:{item.ownerLabel}</div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button asChild size="sm" variant="outline">
                    <Link to={item.sourceRoute} onClick={closeDialog}>Abrir ubicación de tarea</Link>
                  </Button>
                </div>
              </div>

              <div className="grid gap-2 text-sm text-muted-foreground">
                {item.currentStage ? <div>Etapa actual:{item.currentStage}</div> : null}
                {item.currentItemLabel ? <div>Ubicación de interrupción:{item.currentItemLabel}</div> : null}
                {item.recoveryHint ? <div>Sugerencias de recuperación:{item.recoveryHint}</div> : null}
              </div>
            </section>
          ))}
        </div>
      </AppDialogContent>
    </Dialog>
  );
}
