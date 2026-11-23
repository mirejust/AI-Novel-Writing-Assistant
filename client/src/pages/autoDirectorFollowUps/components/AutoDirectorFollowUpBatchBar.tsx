import type { AutoDirectorFollowUpItem, AutoDirectorMutationActionCode } from "@ai-novel/shared/types/autoDirectorFollowUp";
import type { AutoDirectorFollowUpSection } from "@ai-novel/shared/types/autoDirectorValidation";
import { Button } from "@/components/ui/button";
import { TaskQueueActionRow } from "@/components/taskQueue";
import { AUTO_DIRECTOR_MOBILE_CLASSES } from "@/mobile/autoDirector";

interface AutoDirectorFollowUpBatchBarProps {
  selectedItems: AutoDirectorFollowUpItem[];
  batchActionCode: AutoDirectorMutationActionCode | null;
  loading: boolean;
  onClear: () => void;
  onExecute: () => void | Promise<void>;
}

function formatBatchActionLabel(actionCode: AutoDirectorMutationActionCode | null): string {
  if (actionCode === "continue_auto_execution") {
    return "El bajo riesgo del lote continúa";
  }
  if (actionCode === "retry_with_task_model") {
    return "Reintentar tareas anormales en lotes";
  }
  return "No hay acciones masivas comunes para los elementos seleccionados actualmente";
}

function getSelectedSection(items: AutoDirectorFollowUpItem[]): AutoDirectorFollowUpSection | null {
  const sections = Array.from(new Set(items.map((item) => item.section)));
  return sections.length === 1 ? sections[0] : null;
}

export function AutoDirectorFollowUpBatchBar({
  selectedItems,
  batchActionCode,
  loading,
  onClear,
  onExecute,
}: AutoDirectorFollowUpBatchBarProps) {
  if (selectedItems.length === 0) {
    return null;
  }
  const selectedSection = getSelectedSection(selectedItems);
  const consequence = batchActionCode === "continue_auto_execution"
    ? "Solo los comandos de continuación se envían individualmente a las tareas del director seleccionado y el estado no se fusionará entre las tareas."
    : batchActionCode === "retry_with_task_model"
      ? "Cada misión se vuelve a intentar utilizando su propio modelo guardado y mantiene la identidad de misión del director correspondiente."
      : "No se realizarán operaciones por lotes; Vuelva a seleccionar tareas en la misma partición con acciones comunes.";

  return (
    <div className={AUTO_DIRECTOR_MOBILE_CLASSES.followUpBatchBar}>
      <TaskQueueActionRow
        title={`Seleccionado ${selectedItems.length} Artículo · ${selectedSection === "pending" || selectedSection === "exception" ? formatBatchActionLabel(batchActionCode) : "Esta partición no proporciona acciones masivas."}`}
        consequence={consequence}
        tone={selectedSection === "exception" ? "danger" : "info"}
        action={(
          <div className="grid grid-cols-2 gap-2 md:flex">
          <Button variant="outline" size="sm" className="w-full md:w-auto" onClick={onClear} disabled={loading}>
            Claro
          </Button>
          <Button size="sm" className="w-full md:w-auto" onClick={() => void onExecute()} disabled={!batchActionCode || loading}>
            Ejecutar acciones por lotes
          </Button>
          </div>
        )}
      />
    </div>
  );
}
