import {InvocationUsageList} from "./usage";
import { History, ListChecks, ShieldCheck, ShieldAlert } from "lucide-react";
import type { DashboardView, DirectorTimelineEvent } from "@/api/directorNext";
import DirectorBadge, { directorDriverLabel } from "./DirectorBadge";
import DirectorGate, {type PlanEditorRenderer} from "./DirectorGate";
import DirectorDriveSwitch from "./DirectorDriveSwitch";
import type {ReactNode} from "react";
import DirectorCharacterCandidates, {useDirectorCharacterCandidates} from "./characters/DirectorCharacterCandidates";
import ChapterBudgetRecovery from "./budget/ChapterBudgetRecovery";
import UnknownClaimsRecovery from "./UnknownClaimsRecovery";
import WorkflowProgressBar from "@/components/workflow/WorkflowProgressBar";
import PanelDisclosure from "./panel/PanelDisclosure";

export type PanelPlanEditorRenderer = (input: Parameters<PlanEditorRenderer>[0], nextRange: DashboardView["nextLaunchRange"]) => ReactNode;

interface DirectorPanelProps {
  view: DashboardView;
  novelId: string;
  outlineBound?: boolean;
  timeline?: DirectorTimelineEvent[];
  preview?: boolean;
  startForm?: ReactNode | ((range: DashboardView["nextLaunchRange"], driver: DashboardView["driver"]) => ReactNode);
  reviewTarget?:string;
  reviewReady?:boolean;
  reviewCanRegenerate?:boolean;
  reviewRunId?:string;
  reviewVersion?:number;
  renderPlanEditor?: PanelPlanEditorRenderer;
  proseApproval?:import("./DirectorGate").ChapterProseApproval;
}

function formatEvent(event: DirectorTimelineEvent): string {
  const label: Record<string, string> = {
    command_accepted: "Orden de creación recibida",
    step_started: "Iniciar fase de procesamiento",
    step_finished: "Procesamiento de etapa completado",
    quality_debt_recorded: "Recordatorio de calidad de grabación",
    stop_signal: "Motivo de pausa de grabación",
    token_usage: "Completar una llamada AI",
  };
  return label[event.type] ?? "Actualizar registro de creación";
}

function formatTime(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Hora desconocida" : date.toLocaleString();
}

export default function DirectorPanel({ view, novelId, timeline = [], preview = false, startForm, reviewTarget, reviewReady = false, reviewCanRegenerate = false, reviewRunId, reviewVersion, renderPlanEditor, proseApproval, outlineBound = false }: DirectorPanelProps) {
  const candidates = useDirectorCharacterCandidates(view.runId, !preview);
  const candidatePage = candidates.data?.data;
  const reviewingCharacters = candidatePage?.reviews.some(r => r.blocking) ?? false;
  const canLaunch = !preview && ["completed", "cancelled", "failed"].includes(view.mode)
    && view.availableActions.some(action => action.command === "open_run");
  const launchForm = canLaunch && (typeof startForm === "function" ? startForm(view.nextLaunchRange, view.driver) : startForm);
  const badgeView = {
    ...view,
    headline: reviewingCharacters ? "Confirme los personajes de este capítulo antes de continuar." : view.headline,
    availableActions: view.availableActions.filter(action =>
      !(reviewingCharacters && action.command === "resume") && !(launchForm && action.command === "open_run")),
  };
  const reviewAction = view.availableActions.find(action=>action.id.startsWith("review:") && action.kind==="navigate" && action.target===reviewTarget);
  const currentReview = reviewAction && reviewRunId===view.runId && reviewVersion===view.sourceTrace.controlVersion;
  const reviewingCurrentGate = currentReview && reviewReady;
  const recoveringReview = currentReview && reviewAction.id === "review:chapter_task_sheet" && reviewCanRegenerate;
  const driveSwitch = view.availableActions.find(action => action.command === "handoff" && action.toDriver);
  const chapterProgress = view.chapterProgress;
  const chapterListProgress = view.chapterListProgress;
  const progress = chapterProgress ?? view.progress;

  return (
    <div className="flex min-h-0 min-w-0 flex-col pb-4">
      <section id="director-current-work" aria-label="¿Qué estás haciendo?" className="rounded-xl bg-muted/55 p-4">
        <DirectorBadge panel view={badgeView} novelId={novelId} preview={preview} currentNavigationTarget={reviewTarget} openRunLabel={outlineBound ? "Seleccione el siguiente capítulo y confirme" : undefined} />
        {reviewingCharacters && <p className="mt-2 text-sm text-muted-foreground">{view.headline}</p>}
        {chapterListProgress ? (
          <div className="mt-3 space-y-2 text-xs" role="status" aria-live="polite">
            <p>{chapterListProgress.label}</p>
            <div role="progressbar" aria-label="Progreso de la división del capítulo" aria-valuemin={0}
              aria-valuemax={chapterListProgress.totalChapters} aria-valuenow={chapterListProgress.completedChapters}>
              <WorkflowProgressBar progress={chapterListProgress.completedChapters / chapterListProgress.totalChapters} />
            </div>
            <p className="text-muted-foreground">
              Generado {chapterListProgress.completedChapters}/{chapterListProgress.totalChapters} Capítulo
              {chapterListProgress.completedChapters === chapterListProgress.totalChapters
                ? ", verificando y guardando la lista de capítulos..." : ", el progreso se actualiza cada vez que se completa un segmento de ritmo."}
            </p>
          </div>
        ) : null}
        {chapterProgress ? <p className="mt-2 text-xs text-muted-foreground">El texto de este artículo: Capítulo {chapterProgress.from}—{chapterProgress.to} Cap.</p> : null}
        <div className="mt-4" role="progressbar" aria-valuemin={0} aria-valuemax={progress.total} aria-valuenow={progress.done} aria-label={chapterProgress ? "El progreso de la finalización de este texto." : "Progreso de la etapa del director."}>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{chapterProgress ? "Texto revisado y guardado" : "Progreso de la planificación"}</span>
            <span className="font-medium tabular-nums text-foreground">{progress.done}/{progress.total}{chapterProgress ? "" : " etapa"}</span>
          </div>
          <div className="mt-2 h-1 overflow-hidden rounded-full bg-border" aria-hidden="true">
            <div className={`h-full rounded-full motion-safe:transition-[width] ${view.mode === "completed" ? "bg-success" : "bg-primary"}`} style={{ width: `${progress.total > 0 ? Math.min(100, (progress.done / progress.total) * 100) : 0}%` }} />
          </div>
        </div>
      </section>

      <section id="director-next-action" aria-label="¿Qué necesitas hacer?" className="space-y-3 py-5">
        {!(launchForm && view.mode === "completed") && <p className="text-sm leading-6 text-muted-foreground">{reviewingCurrentGate ? "Por favor, consulte los resultados de esta etapa a la izquierda. Después de la confirmación, AI continuará dentro del alcance de esta autorización." : recoveringReview ? "Después de regenerar las tareas y escenas del capítulo, confirme y continúe creando." : view.nextActionGuidance}</p>}
        {view.detail && <p className={`break-words rounded-md p-3 text-sm leading-6 ${reviewingCharacters ? "bg-muted/50 text-muted-foreground" : "bg-destructive/5 text-destructive"}`}>{view.detail}</p>}
        {!preview && <DirectorCharacterCandidates page={candidatePage} runId={view.runId} novelId={novelId}
          proseReview={view.availableActions.some(action => action.id === "review:chapter_batch_closed")}/>}
        {candidates.isError && <p role="alert" className="text-sm text-destructive">El personaje candidato no se puede cargar temporalmente, inténtalo de nuevo más tarde.</p>}
        {view.mode === "paused" && view.chapterBudget && <ChapterBudgetRecovery key={`${view.runId}:${view.sourceTrace.controlVersion}:${view.chapterBudget.chapterId}`}
          budget={view.chapterBudget} runId={view.runId} novelId={novelId} expectedVersion={view.sourceTrace.controlVersion} disabled={preview || reviewingCharacters}/>}
        {view.mode === "paused" && view.unknownClaims && <UnknownClaimsRecovery key={`${view.runId}:${view.sourceTrace.controlVersion}:${view.unknownClaims.chapterId}`}
          claims={view.unknownClaims} runId={view.runId} novelId={novelId} expectedVersion={view.sourceTrace.controlVersion} disabled={preview || reviewingCharacters}/>}
        {!preview && view.mode === "waiting_gate" && (reviewingCurrentGate || recoveringReview) && <DirectorGate key={`${view.runId}:${view.sourceTrace.controlVersion}`} runId={view.runId} novelId={novelId} expectedVersion={view.sourceTrace.controlVersion} reviewType={reviewAction?.id.slice("review:".length)} canConfirm={Boolean(reviewingCurrentGate)} proseApproval={proseApproval}
          renderPlanEditor={renderPlanEditor && (input => renderPlanEditor(input, view.nextLaunchRange))}/>}
        {!outlineBound && driveSwitch?.toDriver && <DirectorDriveSwitch runId={view.runId} novelId={novelId} expectedVersion={view.sourceTrace.controlVersion} toDriver={driveSwitch.toDriver} label={driveSwitch.label} disabled={preview}/>}
        {launchForm}
      </section>

      <section className="border-y border-border/60 py-3" aria-label="Aviso de calidad">
        {view.debts.count > 0 ? <>
          <p className="flex items-center gap-2.5 text-sm font-semibold"><ShieldAlert className="size-4 shrink-0 text-warning" aria-hidden="true" />{view.debts.count} Recordatorio de calidad del artículo</p>
          {view.debts.chapterOrders.length > 0 && <p className="mt-1 pl-7 text-sm leading-6 text-muted-foreground">Ver el Capítulo 1 del catálogo de la izquierda. {view.debts.chapterOrders.join(",")} Capítulo.</p>}
        </> : <p className="flex items-center gap-2.5 text-sm text-muted-foreground"><ShieldCheck className="size-4 shrink-0" aria-hidden="true" />Esta vez no hay recordatorio de calidad.</p>}
      </section>

      <div className="divide-y divide-border/60">
        <PanelDisclosure icon={History} title="Cronograma de creación">
          {timeline.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">Actualmente no hay una línea de tiempo para mostrar.</p>
          ) : (
            <ol className="space-y-2 pl-1">
              {timeline.slice(-8).reverse().map((event) => (
                <li key={`${event.seq}-${event.type}`} className="flex gap-3 text-xs">
                  <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground/60" aria-hidden="true" />
                  <span className="min-w-0 text-muted-foreground">
                    <span className="block text-foreground">{formatEvent(event)}</span>
                    <time className="mt-0.5 block tabular-nums" dateTime={event.createdAt}>{formatTime(event.createdAt)}</time>
                  </span>
                </li>
              ))}
            </ol>
          )}
        </PanelDisclosure>

        {!preview && <InvocationUsageList runId={view.runId} active={["running","queued"].includes(view.mode)}/>}
        <PanelDisclosure icon={ListChecks} title="Ver diagnósticos en ejecución">
          <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-2 text-xs text-muted-foreground">
            <dt>Método de creación</dt><dd className="text-foreground">{directorDriverLabel(view.driver)}</dd>
            <dt>Versión del plan</dt><dd className="break-all text-foreground">{view.sourceTrace.planVersion}</dd>
            <dt>Versión de estado</dt><dd className="text-foreground">{view.sourceTrace.controlVersion}</dd>
            <dt>Etapa completada</dt><dd className="text-foreground">{view.progress.done}/{view.progress.total}</dd>
          </dl>
        </PanelDisclosure>
      </div>
    </div>
  );
}
