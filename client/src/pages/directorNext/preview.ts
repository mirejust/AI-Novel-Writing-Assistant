import type { DashboardView, DirectorTimelineEvent } from "@/api/directorNext";

export const previewStates = [
  { id: "running", label: "Avanzando", mode: "running", headline: "Generando un \"tablero de ritmo de volumen objetivo\"", pauseKind: null },
  { id: "waiting_gate", label: "Esperando confirmación", mode: "waiting_gate", headline: "Confirma la \"Lista de personajes\" antes de continuar.", pauseKind: null },
  { id: "manual", label: "Guardar progreso en pausa", mode: "paused", headline: "En pausa, esperando a que continúes después de guardar el progreso.", pauseKind: "manual_recovery" },
  { id: "replan", label: "Replanificar pausa", mode: "paused", headline: "Necesita volver a planificar antes de continuar", pauseKind: "replan" },
  { id: "safety", label: "Pausa de riesgo", mode: "paused", headline: "Riesgo detectado, pausado, esperando su procesamiento", pauseKind: "safety" },
  { id: "failed", label: "Interrupción creativa", mode: "failed", headline: "La creación se interrumpe y se puede reanudar desde el contenido existente.", pauseKind: null },
  { id: "completed", label: "Alcance completo", mode: "completed", headline: "Se ha completado la creación dentro del alcance autorizado actual.", pauseKind: null },
] as const;

export function previewView(id: string): DashboardView {
  const state = previewStates.find((item) => item.id === id) ?? previewStates[0];
  return {
    runId: "preview", novelId: "preview", mode: state.mode, driver: "auto", headline: state.headline,
    detail: state.id === "safety" ? "Se ha alcanzado el rango de uso autorizado. Verifique la configuración antes de decidir el siguiente paso." : null,
    nextActionGuidance: state.mode === "completed" ? "Verifique el alcance de los capítulos siguientes y envíe su creación." : state.mode === "waiting_gate" ? "Abra los resultados de esta etapa, verifique y confirme para continuar." : state.mode === "paused" ? "Verifique el motivo de la suspensión y continúe guardando el progreso después del procesamiento." : "Espere a que AI avance en el alcance de esta autorización.",
    chapterProgress: null, nextLaunchRange: null,
    progress: { done: state.id === "completed" ? 10 : 4, total: 10, source: "artifact_ledger" },
    debts: { count: 2, chapterOrders: [3, 5] },
    availableActions: state.mode === "completed" ? [] : state.mode === "waiting_gate"
      ? [{ id: "review", label: "Consulta la \"Lista de personajes\"", kind: "navigate", primary: true, target: "/lab/director/preview?state=waiting_gate" }]
      : state.mode === "paused"
        ? [{ id: "resume", label: state.id === "replan" ? "Continuar después de volver a planificar" : "Continuar desde el progreso de guardado", kind: "command", primary: true, command: "resume" }]
        : state.mode === "failed"
          ? [{ id: "open_run", label: "Continuar creando a partir de contenido existente", kind: "command", primary: true, command: "open_run" }]
          : [{ id: "cancel", label: "Cancelar esta creación", kind: "command", primary: false, command: "cancel" }],
    sourceRoute: "/lab/director/preview", sourceTrace: { controlStatus: state.mode, controlVersion: 4, pauseKind: state.pauseKind, planVersion: "director-next-production-v1" },
  };
}

export const previewTimeline: DirectorTimelineEvent[] = [
  { seq: 1, type: "command_accepted", payload: {}, createdAt: "2026-10-02T01:00:00Z" },
  { seq: 2, type: "step_finished", payload: {}, createdAt: "2026-10-02T01:03:00Z" },
  { seq: 3, type: "quality_debt_recorded", payload: {}, createdAt: "2026-10-02T01:04:00Z" },
];
