import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ShieldAlert, SlidersHorizontal } from "lucide-react";
import { Link } from "react-router-dom";
import type { DirectorIssueAction } from "@ai-novel/shared/types/directorIssue";
import { getDirectorTaskSnapshot, getNovelDirectorIssuePolicy } from "@/api/novelDirector";
import { queryKeys } from "@/api/queryKeys";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import NovelDirectorIssuePolicyCard from "../components/NovelDirectorIssuePolicyCard";

const ACTION_LABELS: Record<DirectorIssueAction, string> = {
  auto_retry: "Reintento automático",
  continue_with_warning: "Continuar después del recordatorio",
  pause_for_manual: "Pausar procesamiento",
  fail_task: "Finalizar la tarea",
};

export default function SimpleCreationIssueGovernancePanel(props: {
  novelId: string;
  directorTaskId?: string | null;
}) {
  const [managementOpen, setManagementOpen] = useState(false);
  const policyQuery = useQuery({
    queryKey: queryKeys.tasks.directorIssuePolicy(props.novelId),
    queryFn: () => getNovelDirectorIssuePolicy(props.novelId),
    enabled: Boolean(props.novelId),
  });
  const taskQuery = useQuery({
    queryKey: queryKeys.tasks.directorTaskSnapshot(props.directorTaskId ?? "none"),
    queryFn: () => getDirectorTaskSnapshot(props.directorTaskId as string),
    enabled: Boolean(props.directorTaskId),
    refetchInterval: 10_000,
  });
  const policy = policyQuery.data?.data;
  const issues = taskQuery.data?.data?.snapshot?.projection?.recentIssues?.slice(0, 6) ?? [];
  const overrideCount = Object.keys(policy?.override?.issueActions ?? {}).length
    + (policy?.override?.maxAutomaticRetries !== undefined ? 1 : 0);

  return (
    <details open className="overflow-hidden rounded-2xl border border-border bg-background">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4">
        <div className="flex min-w-0 items-start gap-3">
          <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
            <ShieldAlert className="h-4 w-4" />
          </span>
          <div>
            <div className="font-medium text-foreground">Resolución de problemas de IA</div>
            <div className="mt-1 text-xs leading-5 text-muted-foreground">Consulte las acciones de resolución de problemas del libro, así como los problemas recientes que ha abordado la IA.</div>
          </div>
        </div>
        <Badge variant="outline">{issues.length} Archivos</Badge>
      </summary>

      <div className="space-y-4 border-t border-border/60 px-5 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
            <span className="self-center">{policy?.source === "novel" ? `Este libro cubre ${overrideCount} artículo` : "Heredar reglas globales"}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => setManagementOpen(true)}>
              <SlidersHorizontal className="h-4 w-4" /> gestión de problemas
            </Button>
            <Button asChild size="sm" variant="outline"><Link to="/settings">Reglas globales</Link></Button>
          </div>
        </div>

        {issues.length > 0 ? (
          <div className="space-y-2">
            {issues.map(({ occurrence, decision }) => (
              <div key={occurrence.fingerprint} className="rounded-xl border border-border/70 bg-muted/20 px-3 py-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium text-foreground">{occurrence.summary}</span>
                  <Badge variant="outline">puntuación de riesgo {occurrence.riskScore ?? "Para ser evaluado"}</Badge>
                </div>
                <div className="mt-1 text-xs leading-5 text-muted-foreground">
                  {occurrence.chapterOrder ? `Cap. ${occurrence.chapterOrder} Capítulo · ` : ""}{occurrence.issueCode}
                  {decision ? ` · ${ACTION_LABELS[decision.action]}` : ""}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-xl bg-muted/30 p-3 text-sm leading-6 text-muted-foreground">
            La IA aún no ha documentado problemas que deban preocuparse. Los elementos de calidad normal del capítulo seguirán siendo procesados ​​por la IA en segundo plano.
          </div>
        )}
      </div>

      <Dialog open={managementOpen} onOpenChange={setManagementOpen}>
        <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Gestión de problemas de libros</DialogTitle>
            <DialogDescription>Sólo se guardan las preferencias de procesamiento que difieren de las reglas globales de este libro y los elementos bloqueados por seguridad no se pueden liberar automáticamente.</DialogDescription>
          </DialogHeader>
          <NovelDirectorIssuePolicyCard novelId={props.novelId} />
        </DialogContent>
      </Dialog>
    </details>
  );
}
