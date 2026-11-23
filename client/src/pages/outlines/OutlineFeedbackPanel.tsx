import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { OutlineFeedbackRunView, OutlineFeedbackSettings } from "@ai-novel/shared/types/outlineFeedback";
import {
  adoptOutlineFeedback,
  analyzeOutlineFeedback,
  getOutlineFeedbackStatus,
  rejectOutlineFeedback,
  retryOutlineFeedbackRun,
  updateOutlineFeedbackSettings,
} from "@/api/outlines";
import { Button } from "@/components/ui/button";
import { featureFlags } from "@/config/featureFlags";
import { useIsMobileViewport } from "@/components/layout/mobile/useIsMobileViewport";
import { createOutlineId, findOutlineNodeTitle, outlineFieldLabels } from "./outlineNodes";
import type { OutlineDocument } from "@ai-novel/shared/types/outline";

const RUN_STATUS_LABEL: Record<OutlineFeedbackRunView["status"], string> = {
  pending: "Espera",
  running: "Analizando",
  completed: "Completado",
  failed: "Error",
};

const ITEM_STATUS_LABEL = {
  pending: "Pendiente",
  adopted: "Adoptado",
  rejected: "Rechazado",
} as const;

function defaultSettings(settings?: OutlineFeedbackSettings | null): OutlineFeedbackSettings {
  return {
    mode: settings?.mode ?? "chapter",
    everyN: settings?.everyN ?? 5,
    provider: settings?.provider,
    model: settings?.model,
  };
}

export function shouldShowOutlineFeedbackPanel(options: { flagEnabled: boolean; bound: boolean; isMobile: boolean }) {
  return options.flagEnabled && options.bound && !options.isMobile;
}

interface FeedbackProps {
  outlineId: string;
  document: OutlineDocument;
  applyDisabled: boolean;
}

export function OutlineFeedbackPanel({ bound, ...props }: FeedbackProps & { bound: boolean }) {
  const isMobile = useIsMobileViewport();
  if (!shouldShowOutlineFeedbackPanel({ flagEnabled: featureFlags.outlineFeedbackEnabled, bound, isMobile })) {
    return null;
  }
  return <OutlineFeedbackPanelBody {...props} />;
}

function OutlineFeedbackPanelBody({ outlineId, document, applyDisabled }: FeedbackProps) {
  const queryClient = useQueryClient();
  const [settingsDraft, setSettingsDraft] = useState<OutlineFeedbackSettings>(defaultSettings());
  const [chapterId, setChapterId] = useState("");
  const [requestKey, setRequestKey] = useState(() => createOutlineId());
  const statusQuery = useQuery({
    queryKey: ["outline-feedback", outlineId],
    queryFn: () => getOutlineFeedbackStatus(outlineId),
    enabled: !!outlineId,
    refetchInterval: (query) => {
      const runs = query.state.data?.runs ?? [];
      return runs.some((run) => run.status === "pending" || run.status === "running") ? 3000 : false;
    },
  });

  useEffect(() => {
    if (statusQuery.data?.settings) setSettingsDraft(defaultSettings(statusQuery.data.settings));
  }, [statusQuery.data?.settings]);

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["outline-feedback", outlineId] }),
      queryClient.invalidateQueries({ queryKey: ["outline", outlineId] }),
      queryClient.invalidateQueries({ queryKey: ["outline-revisions", outlineId] }),
    ]);
  };

  const saveSettings = useMutation({
    mutationFn: () => updateOutlineFeedbackSettings(outlineId, settingsDraft),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["outline-feedback", outlineId] });
    },
  });
  const analyze = useMutation({
    mutationFn: () => analyzeOutlineFeedback(outlineId, { chapterId: chapterId.trim(), requestKey }),
    onSuccess: async () => {
      setRequestKey(createOutlineId());
      await queryClient.invalidateQueries({ queryKey: ["outline-feedback", outlineId] });
    },
  });
  const retry = useMutation({
    mutationFn: (runId: string) => retryOutlineFeedbackRun(outlineId, runId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["outline-feedback", outlineId] });
    },
  });
  const decide = useMutation({
    mutationKey: ["outline-revision-decision", outlineId],
    mutationFn: ({ runId, action, operationIds }: { runId: string; action: "adopt" | "reject"; operationIds: string[] }) =>
      action === "adopt"
        ? adoptOutlineFeedback(outlineId, runId, operationIds)
        : rejectOutlineFeedback(outlineId, runId, operationIds),
    onSuccess: async () => {
      await refresh();
    },
  });

  const runs = statusQuery.data?.runs ?? [];
  const hasActive = useMemo(() => runs.some((run) => run.status === "pending" || run.status === "running"), [runs]);

  return (
    <section id="outline-feedback-panel" aria-label="Comentarios sobre el resumen del capítulo" className="space-y-4">
      <header className="space-y-1">
        <h2 className="text-base font-semibold">Comentarios sobre el resumen del capítulo</h2>
        <p className="text-xs text-muted-foreground">
          Compare el esquema con los resúmenes de los capítulos guardados. Puede revisar los motivos uno por uno y adoptar los cambios apropiados.
        </p>
      </header>

      {statusQuery.isLoading ? <p className="text-sm text-muted-foreground">Leyendo comentarios...</p> : null}
      {statusQuery.isError ? (
        <p role="alert" className="text-sm text-destructive">
          {statusQuery.error instanceof Error ? statusQuery.error.message : "No se pudo leer el estado de los comentarios. Vuelva a intentarlo más tarde."}
        </p>
      ) : null}

      {statusQuery.isSuccess ? (
        <>
          <form
            className="space-y-3 border-b border-border/50 pb-4"
            onSubmit={(event) => {
              event.preventDefault();
              saveSettings.mutate();
            }}
          >
            <h3 className="text-sm font-medium">Configuración de disparo</h3>
            <div className="flex flex-wrap items-end gap-3">
              <label className="space-y-1 text-xs">
                <span className="text-muted-foreground">Frecuencia</span>
                <select
                  className="block rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                  value={settingsDraft.mode}
                  onChange={(event) => setSettingsDraft((current) => ({ ...current, mode: event.target.value as OutlineFeedbackSettings["mode"] }))}
                >
                  <option value="chapter">Capítulo por capítulo</option>
                  <option value="every_n">Cada N capítulos</option>
                  <option value="volume">Capitulo final</option>
                  <option value="off">Desactivar el análisis automático</option>
                </select>
              </label>
              {settingsDraft.mode === "every_n" ? (
                <label className="space-y-1 text-xs">
                  <span className="text-muted-foreground">N</span>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    className="block w-20 rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                    value={settingsDraft.everyN}
                    onChange={(event) => setSettingsDraft((current) => ({ ...current, everyN: Number(event.target.value) || 1 }))}
                  />
                </label>
              ) : null}
              <Button type="submit" size="sm" variant="outline" disabled={saveSettings.isPending}>
                {saveSettings.isPending ? "Guardando…" : "Guardar configuración"}
              </Button>
            </div>
            {saveSettings.isError ? (
              <p role="alert" className="text-sm text-destructive">
                {saveSettings.error instanceof Error ? saveSettings.error.message : "No se pudo guardar la configuración, inténtelo de nuevo."}
              </p>
            ) : null}
          </form>

          <form
            className="space-y-3 border-b border-border/50 pb-4"
            onSubmit={(event) => {
              event.preventDefault();
              analyze.mutate();
            }}
          >
            <h3 className="text-sm font-medium">Análisis manual</h3>
            <div className="flex flex-wrap items-end gap-3">
              <label className="space-y-1 text-xs">
                <span className="text-muted-foreground">Capítulos para analizar</span>
                <select className="outline-field" value={chapterId} disabled={analyze.isPending}
                  onChange={event => { setChapterId(event.target.value); setRequestKey(createOutlineId()); analyze.reset(); }}>
                  <option value="">{statusQuery.data.chapters?.length ? "Selecciona un capítulo que ya tenga un resumen" : "Los resúmenes de los capítulos se pueden guardar para su análisis."}</option>
                  {statusQuery.data.chapters?.map(chapter => <option value={chapter.id} key={chapter.id}>
                    Cap. {chapter.order} capítulo · {chapter.title}
                  </option>)}
                </select>
              </label>
              <Button type="submit" size="sm" disabled={!statusQuery.data.chapters?.some(chapter => chapter.id === chapterId) || analyze.isPending}>
                {analyze.isPending ? "Enviando…" : "Iniciar análisis"}
              </Button>
            </div>
            {analyze.isError ? (
              <p role="alert" className="text-sm text-destructive">
                {analyze.error instanceof Error ? analyze.error.message : "La solicitud de análisis falló, inténtelo de nuevo."}
              </p>
            ) : null}
          </form>

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-medium">Operaciones y recomendaciones.</h3>
              {hasActive ? <p className="text-xs text-muted-foreground">Hay análisis en curso y la lista se actualizará automáticamente.</p> : null}
            </div>
            {runs.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aún no hay comentarios. Una vez guardado el resumen, se analizará de forma asincrónica según la configuración, o también se puede iniciar manualmente.</p>
            ) : (
              <ul className="space-y-4">
                {runs.map((run) => (
                  <li key={run.id} className="space-y-2 border-t border-border/50 py-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm">
                        Cap. {run.chapterOrder} capítulo · {RUN_STATUS_LABEL[run.status]}
                        {run.attempt > 1 ? ` · No. ${run.attempt} veces` : ""}
                      </p>
                      {run.status === "failed" || (run.status === "running" && run.attempt >= 1) ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={retry.isPending}
                          onClick={() => retry.mutate(run.id)}
                        >
                          Intentar otra vez
                        </Button>
                      ) : null}
                    </div>
                    {run.error ? <p role="alert" className="text-xs text-destructive">{run.error}</p> : null}
                    {run.items.length ? (
                      <ul className="space-y-3">
                        {run.items.map((item) => (
                          <li key={item.operationId} className="space-y-2 text-sm">
                            <div className="flex flex-wrap items-start justify-between gap-2">
                              <div>
                                <p className="font-medium">{findOutlineNodeTitle(document, item.nodeId)}</p>
                                <p className="text-xs text-muted-foreground">{ITEM_STATUS_LABEL[item.status]}</p>
                              </div>
                              {item.status === "pending" ? (
                                <div className="flex gap-2">
                                  <Button
                                    type="button"
                                    size="sm"
                                    disabled={applyDisabled || decide.isPending}
                                    onClick={() => decide.mutate({ runId: run.id, action: "adopt", operationIds: [item.operationId] })}
                                  >
                                    adopción
                                  </Button>
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    disabled={decide.isPending}
                                    onClick={() => decide.mutate({ runId: run.id, action: "reject", operationIds: [item.operationId] })}
                                  >
                                    rechazar
                                  </Button>
                                </div>
                              ) : null}
                            </div>
                            <p className="text-xs text-muted-foreground whitespace-pre-wrap">{item.reason}</p>
                            <dl className="outline-comparison text-xs">
                              {Object.entries(item.fields).map(([field, value]) => (
                                <div key={field}>
                                  <dt className="text-muted-foreground">{outlineFieldLabels[field] ?? field}</dt>
                                  <dd className="mt-1 whitespace-pre-wrap">{value}</dd>
                                </div>
                              ))}
                            </dl>
                          </li>
                        ))}
                      </ul>
                    ) : run.status === "completed" ? (
                      <p className="text-xs text-muted-foreground">No hay sugerencias de campo para adoptar para esta ejecución.</p>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
            {decide.isError ? (
              <p role="alert" className="text-sm text-destructive">
                {decide.error instanceof Error ? decide.error.message : "Error al procesar la sugerencia. Si el esquema ha sido modificado por otras revisiones, vuelva a analizarlo."}
              </p>
            ) : null}
            {retry.isError ? (
              <p role="alert" className="text-sm text-destructive">
                {retry.error instanceof Error ? retry.error.message : "El reintento falló, inténtelo de nuevo más tarde."}
              </p>
            ) : null}
          </div>
        </>
      ) : null}
    </section>
  );
}
