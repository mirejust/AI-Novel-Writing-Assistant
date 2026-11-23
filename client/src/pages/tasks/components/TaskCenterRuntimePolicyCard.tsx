import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type {
  DirectorPolicyMode,
  DirectorRuntimeSnapshot,
} from "@ai-novel/shared/types/directorRuntime";
import { updateDirectorRuntimePolicy } from "@/api/novelDirector";
import { queryKeys } from "@/api/queryKeys";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import SelectControl from "@/components/common/SelectControl";

interface TaskCenterRuntimePolicyCardProps {
  taskId: string;
  snapshot: DirectorRuntimeSnapshot | null | undefined;
}

const POLICY_OPTIONS: Array<{ value: DirectorPolicyMode; label: string; description: string }> = [
  {
    value: "suggest_only",
    label: "Solo da sugerencias",
    description: "Solo analiza y da sugerencias, y no escribe planos ni textos automáticamente.",
  },
  {
    value: "run_next_step",
    label: "Continúe con el siguiente paso",
    description: "Da solo el paso más pequeño que puedas y haz una pausa para comprobar cuando hayas terminado.",
  },
  {
    value: "run_until_gate",
    label: "Avance al punto de control",
    description: "Avance continuamente al siguiente nodo que requiera confirmación.",
  },
  {
    value: "auto_safe_scope",
    label: "Avance automático de rango seguro",
    description: "Continúe el procesamiento automatizado solo en la medida en que el sistema considere que el riesgo es bajo.",
  },
];

function formatPolicyMode(mode: DirectorPolicyMode): string {
  return POLICY_OPTIONS.find((item) => item.value === mode)?.label ?? mode;
}

export default function TaskCenterRuntimePolicyCard({
  taskId,
  snapshot,
}: TaskCenterRuntimePolicyCardProps) {
  const queryClient = useQueryClient();
  const currentMode = snapshot?.policy.mode ?? "run_until_gate";
  const [selectedMode, setSelectedMode] = useState<DirectorPolicyMode>(currentMode);
  const [allowExpensiveReview, setAllowExpensiveReview] = useState(false);
  const [mayOverwriteUserContent, setMayOverwriteUserContent] = useState(false);
  const selectedOption = useMemo(
    () => POLICY_OPTIONS.find((item) => item.value === selectedMode) ?? POLICY_OPTIONS[2],
    [selectedMode],
  );
  const mutation = useMutation({
    mutationFn: () => updateDirectorRuntimePolicy(taskId, {
      mode: selectedMode,
      allowExpensiveReview,
      mayOverwriteUserContent,
    }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.tasks.directorRuntime(taskId) });
      toast.success("El método de avance de director ha sido actualizado.");
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "No se pudo actualizar el método de avance del director");
    },
  });

  useEffect(() => {
    setSelectedMode(currentMode);
    setAllowExpensiveReview(Boolean(snapshot?.policy.allowExpensiveReview));
    setMayOverwriteUserContent(Boolean(snapshot?.policy.mayOverwriteUserContent));
  }, [currentMode, snapshot?.policy.allowExpensiveReview, snapshot?.policy.mayOverwriteUserContent]);

  if (!snapshot) {
    return null;
  }

  return (
    <div className="rounded-md border bg-muted/20 p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="font-medium">El enfoque del director</div>
          <div className="mt-1 text-sm leading-6 text-muted-foreground">
            Elija cómo el sistema avanzará a continuación en esta tarea del director.
          </div>
        </div>
        <Badge variant="outline">{formatPolicyMode(snapshot.policy.mode)}</Badge>
      </div>
      <div className="mt-3 space-y-2">
        <SelectControl
          className="w-full rounded-md border bg-background px-3 py-2 text-sm"
          value={selectedMode}
          onChange={(event) => setSelectedMode(event.target.value as DirectorPolicyMode)}
        >
          {POLICY_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </SelectControl>
        <div className="text-xs leading-5 text-muted-foreground">{selectedOption.description}</div>
      </div>
      <div className="mt-3 space-y-2 rounded-md border bg-background/70 p-3">
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            className="mt-1"
            checked={allowExpensiveReview}
            onChange={(event) => setAllowExpensiveReview(event.target.checked)}
          />
          <span>
            <span className="block font-medium">Permite realizar una revisión más completa</span>
            <span className="block text-xs leading-5 text-muted-foreground">
              Se utiliza para pasos como la inspección de calidad del capítulo y la revisión reciente del capítulo. El sistema registrará la estrategia antes de su ejecución.
            </span>
          </span>
        </label>
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            className="mt-1"
            checked={mayOverwriteUserContent}
            onChange={(event) => setMayOverwriteUserContent(event.target.checked)}
          />
          <span>
            <span className="block font-medium">Permitir que se sobrescriba el contenido protegido</span>
            <span className="block text-xs leading-5 text-muted-foreground">
              Actívelo solo si está seguro de que desea que el sistema procese texto editado o configuraciones clave.
            </span>
          </span>
        </label>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          size="sm"
          onClick={() => mutation.mutate()}
          disabled={
            mutation.isPending
            || (
              selectedMode === snapshot.policy.mode
              && allowExpensiveReview === Boolean(snapshot.policy.allowExpensiveReview)
              && mayOverwriteUserContent === Boolean(snapshot.policy.mayOverwriteUserContent)
            )
          }
        >
          {mutation.isPending ? "Guardando..." : "Guardar método avanzado"}
        </Button>
      </div>
    </div>
  );
}
