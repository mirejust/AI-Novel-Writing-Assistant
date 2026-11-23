import { useEffect, useMemo, useState } from "react";
import {
  DIRECTOR_ISSUE_ACTIONS,
  DIRECTOR_ISSUE_CATALOG,
  DIRECTOR_ISSUE_POLICY_PRESETS,
  findDirectorIssuePolicyPreset,
  resolveChapterReviewRetryPolicy,
  type DirectorIssueAction,
  type DirectorIssueCategory,
  type DirectorIssuePolicy,
} from "@ai-novel/shared/types/directorIssue";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChapterReviewRetryFields } from "@/components/settings/ChapterReviewRetryFields";

const ACTION_LABELS: Record<DirectorIssueAction, string> = {
  auto_retry: "Reintento automático",
  continue_with_warning: "Grabar recordatorio y continuar",
  pause_for_manual: "En pausa para procesamiento",
  fail_task: "Finalizar tarea actual",
};

const CATEGORY_LABELS: Record<DirectorIssueCategory, string> = {
  planning: "Planificación",
  generation: "Generar",
  quality: "Calidad",
  runtime: "Correr",
};

export function AutoDirectorIssuePolicyCard(props: {
  policy?: DirectorIssuePolicy | null;
  isLoading: boolean;
  isSaving: boolean;
  onSave: (policy: DirectorIssuePolicy) => void;
  saveButtonLabel?: string;
}) {
  const { policy, isLoading, isSaving, onSave, saveButtonLabel = "Guardar reglas de manejo de problemas" } = props;
  const [draft, setDraft] = useState<DirectorIssuePolicy | null>(null);
  const [category, setCategory] = useState<DirectorIssueCategory | "all">("all");
  const [action, setAction] = useState<DirectorIssueAction | "all">("all");

  useEffect(() => {
    if (policy) setDraft(policy);
  }, [policy]);

  const current = draft ?? policy;
  const hasChanges = Boolean(policy && current && (
    current.maxAutomaticRetries !== policy.maxAutomaticRetries
    || JSON.stringify(current.chapterReviewRetryPolicy) !== JSON.stringify(policy.chapterReviewRetryPolicy)
    || JSON.stringify(current.issueActions) !== JSON.stringify(policy.issueActions)
  ));
  const entries = useMemo(() => DIRECTOR_ISSUE_CATALOG.filter((entry) => {
    const selectedAction = current?.issueActions[entry.code] ?? entry.defaultAction;
    return (category === "all" || entry.category === category)
      && (action === "all" || selectedAction === action);
  }), [action, category, current]);

  if (!current) {
    return (
      <Card><CardHeader><CardTitle>Reglas de manejo de problemas</CardTitle><CardDescription>{isLoading ? "Cargando…" : "No se pueden cargar reglas en este momento."}</CardDescription></CardHeader></Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Reglas de manejo de problemas</CardTitle>
        <CardDescription>Elija un conjunto de soluciones o ajústelas problema por problema. Cuando se activa la protección de seguridad, el sistema seguirá priorizando la protección del trabajo.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-2">
          {DIRECTOR_ISSUE_POLICY_PRESETS.map((preset) => {
            const selected = findDirectorIssuePolicyPreset(current)?.id === preset.id;
            return (
              <button
                key={preset.id}
                type="button"
                className={`rounded-xl border p-4 text-left transition-colors ${selected ? "border-primary bg-primary/5" : "border-border hover:bg-muted/40"}`}
                onClick={() => setDraft({ ...preset.policy, issueActions: { ...preset.policy.issueActions } })}
              >
                <div className="text-sm font-semibold">{preset.name}</div>
                <div className="mt-1 text-xs leading-5 text-muted-foreground">{preset.description}</div>
              </button>
            );
          })}
        </div>

        <div className="max-w-sm">
          <label className="space-y-2 text-sm">
            <span className="font-medium">Reintento automático de ejecución de capítulo</span>
            <select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={current.maxAutomaticRetries} onChange={(event) => setDraft({ ...current, maxAutomaticRetries: Number(event.target.value) })}>
              <option value={0}>No reintentar automáticamente</option>
              <option value={1}>Máximo 1 vez</option>
            </select>
          </label>
        </div>

        <ChapterReviewRetryFields value={resolveChapterReviewRetryPolicy(current)} onChange={chapterReviewRetryPolicy => setDraft({ ...current, chapterReviewRetryPolicy })} />

        <div className="flex flex-wrap gap-2">
          <select className="h-9 rounded-md border bg-background px-3 text-sm" value={category} onChange={(event) => setCategory(event.target.value as DirectorIssueCategory | "all")}>
            <option value="all">Todas las etapas</option>
            {Object.entries(CATEGORY_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <select className="h-9 rounded-md border bg-background px-3 text-sm" value={action} onChange={(event) => setAction(event.target.value as DirectorIssueAction | "all")}>
            <option value="all">Todas las acciones</option>
            {DIRECTOR_ISSUE_ACTIONS.map((value) => <option key={value} value={value}>{ACTION_LABELS[value]}</option>)}
          </select>
        </div>

        {hasChanges ? (
          <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm leading-6 text-amber-950" role="status">
            Modificó las reglas de manejo de problemas. Guardar afectará las tareas posteriores; Cuando se activa la protección de seguridad, el sistema dará prioridad a suspender o finalizar la tarea y retendrá esta selección para su revisión.
          </div>
        ) : null}

        <div className="space-y-2">
          {entries.map((entry) => {
            const selected = current.issueActions[entry.code] ?? entry.defaultAction;
            return (
              <div key={entry.code} className="grid gap-2 rounded-md border p-3 md:grid-cols-[minmax(0,1fr)_220px]">
                <div className="min-w-0">
                  <div className="text-sm font-medium">{entry.label}</div>
                  <div className="mt-1 break-all text-xs text-muted-foreground">{entry.code} · por defecto:{ACTION_LABELS[entry.defaultAction]}</div>
                  {entry.lockedReason ? <div className="mt-1 text-xs text-amber-700">Consejos de seguridad:{entry.lockedReason}{entry.enforcedAction ? ` Todavía activo cuando se activa${ACTION_LABELS[entry.enforcedAction]}.` : ""}</div> : null}
                </div>
                <select
                  className="h-9 rounded-md border bg-background px-3 text-sm"
                  value={selected}
                  onChange={(event) => setDraft({
                    ...current,
                    issueActions: { ...current.issueActions, [entry.code]: event.target.value as DirectorIssueAction },
                  })}
                >
                  {DIRECTOR_ISSUE_ACTIONS.map((value) => <option key={value} value={value}>{ACTION_LABELS[value]}</option>)}
                </select>
              </div>
            );
          })}
        </div>

        <Button disabled={isSaving} onClick={() => onSave(current)}>
          {isSaving ? "Guardando…" : saveButtonLabel}
        </Button>
      </CardContent>
    </Card>
  );
}
