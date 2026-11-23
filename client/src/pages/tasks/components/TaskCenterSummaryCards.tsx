interface TaskCenterSummaryCardsProps {
  activeCount: number;
  waitingActionCount: number;
  mustHandleCount: number;
  qualityReminderCount: number;
}

export default function TaskCenterSummaryCards({
  activeCount,
  waitingActionCount,
  mustHandleCount,
  qualityReminderCount,
}: TaskCenterSummaryCardsProps) {
  const items = [
    { key: "active", label: "En curso", value: activeCount, dot: "bg-info" },
    { key: "waiting", label: "Esperando su operación", value: waitingActionCount, dot: "bg-primary" },
    { key: "must-handle", label: "Requiere atención", value: mustHandleCount, dot: "bg-destructive" },
    { key: "quality", label: "Aviso de calidad", value: qualityReminderCount, dot: "bg-warning" },
  ];

  return (
    <section aria-label="Resumen del estado de la tarea" className="task-status-summary-grid flex flex-wrap items-center gap-x-6 gap-y-3 rounded-2xl bg-muted/25 px-5 py-3">
      {items.map((item) => (
        <div key={item.key} className="flex items-center gap-2 text-sm">
          <span className={`h-2 w-2 rounded-full ${item.dot}`} aria-hidden="true" />
          <span className="text-muted-foreground">{item.label}</span>
          <span className="font-semibold tabular-nums text-foreground">{item.value}</span>
        </div>
      ))}
    </section>
  );
}
