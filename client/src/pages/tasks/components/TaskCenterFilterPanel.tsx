import type { TaskKind, TaskStatus } from "@ai-novel/shared/types/task";
import { Input } from "@/components/ui/input";
import type { TaskSortMode } from "../taskCenterUtils";
import SelectControl from "@/components/common/SelectControl";

interface TaskCenterFilterPanelProps {
  kind: TaskKind | "";
  status: TaskStatus | "";
  keyword: string;
  onlyAnomaly: boolean;
  sortMode: TaskSortMode;
  onKindChange: (value: TaskKind | "") => void;
  onStatusChange: (value: TaskStatus | "") => void;
  onKeywordChange: (value: string) => void;
  onOnlyAnomalyChange: (value: boolean) => void;
  onSortModeChange: (value: TaskSortMode) => void;
}

export default function TaskCenterFilterPanel({
  kind,
  status,
  keyword,
  onlyAnomaly,
  sortMode,
  onKindChange,
  onStatusChange,
  onKeywordChange,
  onOnlyAnomalyChange,
  onSortModeChange,
}: TaskCenterFilterPanelProps) {
  return (
    <section aria-label="Filtrar registros en ejecución" className="task-filter-card rounded-2xl bg-muted/20 px-4 py-3">
      <div className="task-filter-controls grid min-w-0 grid-cols-3 gap-2 xl:grid-cols-[150px_150px_minmax(220px,1fr)_220px_auto] xl:items-center">
        <SelectControl
          aria-label="Filtrar por tipo de tarea"
          className="task-filter-kind col-start-1 row-start-1 xl:col-auto xl:row-auto h-10 w-full rounded-xl border-border/45 bg-background px-3 text-sm"
          value={kind}
          onChange={(event) => onKindChange(event.target.value as TaskKind | "")}
        >
          <option value="">Todos los tipos</option>
          <option value="book_analysis">Análisis de división de libros</option>
          <option value="novel_workflow">Creación novedosa</option>
          <option value="novel_pipeline">Nueva línea de montaje</option>
          <option value="knowledge_document">Índice de la base de conocimientos</option>
          <option value="image_generation">Generación de imágenes</option>
          <option value="style_extraction">Extracción de escritura</option>
          <option value="agent_run">Agente en ejecución</option>
        </SelectControl>
        <SelectControl
          aria-label="Filtrar por estado de tarea"
          className="task-filter-status col-start-2 row-start-1 xl:col-auto xl:row-auto h-10 w-full rounded-xl border-border/45 bg-background px-3 text-sm"
          value={status}
          onChange={(event) => onStatusChange(event.target.value as TaskStatus | "")}
        >
          <option value="">Todo el estado</option>
          <option value="queued">En cola</option>
          <option value="running">En ejecución</option>
          <option value="waiting_approval">Esperando aprobación</option>
          <option value="failed">Error</option>
          <option value="cancelled">Cancelado</option>
          <option value="succeeded">Completado</option>
        </SelectControl>
        <label className={`task-filter-pill col-start-3 row-start-1 xl:col-start-5 xl:row-start-1 flex h-10 cursor-pointer items-center justify-center gap-2 rounded-full px-4 text-sm transition-colors ${
          onlyAnomaly ? "bg-destructive/10 text-destructive" : "bg-background text-muted-foreground hover:bg-muted"
        }`}>
          <input
            type="checkbox"
            className="sr-only"
            checked={onlyAnomaly}
            onChange={(event) => onOnlyAnomalyChange(event.target.checked)}
          />
          Solo vea lo que necesita ser procesado
        </label>
        <Input
          aria-label="Buscar por título u objeto relacionado"
          className="task-filter-keyword col-span-2 col-start-1 row-start-2 xl:col-span-1 xl:col-start-3 xl:row-start-1 h-10 rounded-xl border-border/45 bg-background px-3"
          value={keyword}
          onChange={(event) => onKeywordChange(event.target.value)}
          placeholder="Título u objeto asociado"
        />
        <SelectControl
          aria-label="Cómo ordenar tareas"
          className="task-filter-sort col-start-3 row-start-2 xl:col-start-4 xl:row-start-1 h-10 w-full rounded-xl border-border/45 bg-background px-3 text-sm"
          value={sortMode}
          onChange={(event) => onSortModeChange(event.target.value as TaskSortMode)}
        >
          <option value="updated_desc">Ordenar por hora de actualización: más reciente primero</option>
          <option value="updated_asc">Ordenar por hora de actualización: el más antiguo primero</option>
          <option value="heartbeat_desc">Ordenar por latido más reciente: el más nuevo primero</option>
          <option value="heartbeat_asc">Ordenar por latido más reciente: el más temprano primero</option>
          <option value="default">Clasificación predeterminada: debe procesarse primero</option>
        </SelectControl>

      </div>
    </section>
  );
}
