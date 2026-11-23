import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  DIRECTOR_ISSUE_ACTIONS,
  DIRECTOR_ISSUE_CATALOG,
  DIRECTOR_ISSUE_POLICY_PRESETS,
  resolveChapterReviewRetryPolicy,
  type DirectorIssueAction,
  type DirectorIssueCode,
  type DirectorIssuePolicyOverride,
} from "@ai-novel/shared/types/directorIssue";
import { getNovelDirectorIssuePolicy, saveNovelDirectorIssuePolicy } from "@/api/novelDirector";
import { queryKeys } from "@/api/queryKeys";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChapterReviewRetryFields } from "@/components/settings/ChapterReviewRetryFields";

const ACTION_LABELS: Record<DirectorIssueAction, string> = {
  auto_retry: "Reintento automático",
  continue_with_warning: "Continuar después del recordatorio",
  pause_for_manual: "Pausar procesamiento",
  fail_task: "Finalizar la tarea",
};

const CONFIGURABLE_ISSUES = DIRECTOR_ISSUE_CATALOG;

export default function NovelDirectorIssuePolicyCard({ novelId }: { novelId: string }) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: queryKeys.tasks.directorIssuePolicy(novelId),
    queryFn: () => getNovelDirectorIssuePolicy(novelId),
  });
  const response = query.data?.data;
  const [draft, setDraft] = useState<DirectorIssuePolicyOverride | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (response) setDraft(response.override ?? {});
  }, [response]);

  const mutation = useMutation({
    mutationFn: (override: DirectorIssuePolicyOverride | null) => saveNovelDirectorIssuePolicy(novelId, override),
    onSuccess: async (result) => {
      setMessage(result.message ?? "Se han guardado las reglas para manejar este libro.");
      await queryClient.invalidateQueries({ queryKey: queryKeys.tasks.directorIssuePolicy(novelId) });
    },
    onError: (error) => setMessage(error instanceof Error ? error.message : "No se pudieron guardar las reglas de procesamiento de libros."),
  });

  if (!response || draft === null) return null;
  const overrideActions = draft.issueActions ?? {};
  const savedActions = response.override?.issueActions ?? {};
  const hasCompleteActionMap = CONFIGURABLE_ISSUES.every(
    (entry) => overrideActions[entry.code] !== undefined,
  );
  const hasChanges = JSON.stringify(overrideActions) !== JSON.stringify(savedActions)
    || draft.maxAutomaticRetries !== response.override?.maxAutomaticRetries;
  const retryChanged = JSON.stringify(draft.chapterReviewRetryPolicy) !== JSON.stringify(response.override?.chapterReviewRetryPolicy);

  const setAction = (code: DirectorIssueCode, value: string) => {
    const nextActions = { ...overrideActions };
    if (!value) delete nextActions[code];
    else nextActions[code] = value as DirectorIssueAction;
    setDraft({ ...draft, issueActions: nextActions });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Preferencias para manejar los problemas en este libro.</CardTitle>
        <CardDescription>Elija un tratamiento que funcione para este libro o ajústelo pieza por pieza. Después de guardar, se utilizará para tareas posteriores; La protección de seguridad seguirá dando prioridad a la protección del trabajo.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-3 md:grid-cols-2">
          {DIRECTOR_ISSUE_POLICY_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              className="rounded-xl border border-border p-4 text-left transition-colors hover:bg-muted/40"
              onClick={() => setDraft({
                maxAutomaticRetries: preset.policy.maxAutomaticRetries,
                chapterReviewRetryPolicy: { ...preset.policy.chapterReviewRetryPolicy },
                issueActions: { ...preset.policy.issueActions },
              })}
            >
              <div className="text-sm font-semibold">{preset.name}</div>
              <div className="mt-1 text-xs leading-5 text-muted-foreground">{preset.description}</div>
            </button>
          ))}
        </div>
        <label className="flex items-center justify-between gap-3 rounded-xl border border-border/70 px-3 py-2 text-sm">
          <span className="font-medium">Reintento automático de ejecución de capítulo</span>
          <select className="h-9 rounded-md border bg-background px-3 text-sm" value={draft.maxAutomaticRetries ?? response.effectivePolicy.maxAutomaticRetries} onChange={(event) => setDraft({ ...draft, maxAutomaticRetries: Number(event.target.value) })}>
            <option value={0}>No reintentar automáticamente</option>
            <option value={1}>Máximo 1 vez</option>
          </select>
        </label>
        <ChapterReviewRetryFields value={draft.chapterReviewRetryPolicy ?? resolveChapterReviewRetryPolicy(response.effectivePolicy)}
          onChange={chapterReviewRetryPolicy => setDraft({ ...draft, chapterReviewRetryPolicy })} />
        {CONFIGURABLE_ISSUES.map((entry) => (
          <div key={entry.code} className="grid gap-2 rounded-md border p-3 md:grid-cols-[minmax(0,1fr)_220px]">
            <div>
              <div className="text-sm font-medium">{entry.label}</div>
              <div className="mt-1 text-xs text-muted-foreground">Global:{ACTION_LABELS[response.effectivePolicy.issueActions[entry.code] ?? entry.defaultAction]}</div>
              {entry.lockedReason ? <div className="mt-1 text-xs text-amber-700">Consejos de seguridad:{entry.lockedReason}{entry.enforcedAction ? ` Todavía activo cuando se activa${ACTION_LABELS[entry.enforcedAction]}.` : ""}</div> : null}
            </div>
            <select className="h-9 rounded-md border bg-background px-3 text-sm" value={overrideActions[entry.code] ?? ""} onChange={(event) => setAction(entry.code, event.target.value)}>
              {!hasCompleteActionMap ? <option value="">Heredar global</option> : null}
              {DIRECTOR_ISSUE_ACTIONS.map((value) => <option key={value} value={value}>{ACTION_LABELS[value]}</option>)}
            </select>
          </div>
        ))}
        {hasChanges || retryChanged ? (
          <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm leading-6 text-amber-950" role="status">
            Modificó sus preferencias de manejo de problemas para este libro. Guardar afectará las tareas posteriores; Cuando se activa la protección de seguridad, el sistema aún puede pausar o finalizar la tarea y conservar esta selección para su revisión.
          </div>
        ) : null}
        <div className="flex flex-wrap items-center gap-2">
          <Button disabled={mutation.isPending} onClick={() => mutation.mutate(draft)}>{mutation.isPending ? "Guardando…" : "Guardar preferencias de libros"}</Button>
          <Button variant="outline" disabled={mutation.isPending} onClick={() => mutation.mutate(null)}>Restaurar herencia global</Button>
          {message ? <span className="text-xs text-muted-foreground">{message}</span> : null}
        </div>
      </CardContent>
    </Card>
  );
}
