import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";
import { getTaskDetail, listTasks } from "@/api/tasks";
import { listAutoDirectorFollowUps } from "@/api/autoDirectorFollowUps";
import { queryKeys } from "@/api/queryKeys";
import { Button } from "@/components/ui/button";
import type { TaskKind, UnifiedTaskSummary } from "@ai-novel/shared/types/task";
import { getNovelEditHref } from "@/lib/novelRoutes";
import { formatStatus, getTaskQueueLevelLabel } from "@/pages/tasks/taskCenterUtils";

function formatMobileTaskStatus(task: UnifiedTaskSummary): string {
  const queueLabel = getTaskQueueLevelLabel(task);
  return queueLabel === "Tareas comunes" ? formatStatus(task.status) : queueLabel;
}

function MobileRecord({ task }: { task: UnifiedTaskSummary }) {
  const percent = Math.round(task.progress <= 1 ? task.progress * 100 : task.progress);
  return (
    <article className="space-y-2 py-4">
      <h2 className="font-medium">{task.title}</h2>
      <p className="text-sm">{formatMobileTaskStatus(task)} · {percent}%</p>
      <p className="text-sm text-muted-foreground">{task.currentItemLabel ?? task.currentStage}</p>
      {task.lastError ? <p className="text-sm text-destructive">{task.lastError}</p> : null}
      <Button asChild variant="outline" size="sm"><Link to={task.sourceRoute}>Página de código abierto</Link></Button>
    </article>
  );
}

function LinkedRecord({ kind, id }: { kind: TaskKind; id: string }) {
  const detail = useQuery({
    queryKey: queryKeys.tasks.detail(kind, id),
    queryFn: () => getTaskDetail(kind, id),
    retry: false,
    refetchInterval: query => {
      const status = query.state.data?.data?.status;
      return status === "running" || status === "queued" ? 5000 : false;
    },
  });
  return (
    <section className="space-y-4">
      <h1 className="text-xl font-semibold">Ejecutar detalles del registro</h1>
      {detail.isLoading ? <p role="status">Leyendo este disco...</p> : null}
      {detail.isError ? <p role="alert">La lectura del registro falló.<Button variant="ghost" onClick={() => void detail.refetch()}>Releer</Button></p> : null}
      {detail.isSuccess && !detail.data.data ? <p role="status">No se puede encontrar este registro de ejecución; verifique el enlace o vea otros registros.</p> : null}
      {detail.data?.data ? <MobileRecord task={detail.data.data} /> : null}
      <Button asChild variant="outline"><Link to="/tasks">Ver todos los registros en ejecución</Link></Button>
    </section>
  );
}

export function MobileRecords() {
  const [params] = useSearchParams();
  const kind = params.get("kind") as TaskKind | null;
  const id = params.get("id");
  return kind && id ? <LinkedRecord kind={kind} id={id} /> : <MobileRecordList />;
}

function MobileRecordList() {
  const [cursor, setCursor] = useState<string>();
  const query = useQuery({ queryKey: ["mobileRecords", cursor], queryFn: () => listTasks({ limit: 30, cursor }), refetchInterval: 5000 });
  const data = query.data?.data;
  return <section className="space-y-4"><h1 className="text-xl font-semibold">Registro de operación</h1>
    <p className="text-sm text-muted-foreground">Verifique el estado y abra la novela o página fuente correspondiente para procesar la tarea.</p>
    {query.isError ? <p role="alert">La lectura del registro falló.<Button variant="ghost" onClick={() => void query.refetch()}>Releer</Button></p> : null}
    <div className="divide-y">{data?.items.map(task => <MobileRecord key={`${task.kind}:${task.id}`} task={task} />)}</div>
    {data && !data.items.length ? <p className="text-sm text-muted-foreground">Aún no hay ningún registro actual.</p> : null}
    {data?.nextCursor ? <Button variant="outline" onClick={() => setCursor(data.nextCursor!)}>Página siguiente</Button> : null}
    {cursor ? <Button variant="ghost" onClick={() => setCursor(undefined)}>Volver al último registro</Button> : null}
  </section>;
}

export function MobileNotifications() {
  const query = useQuery({ queryKey: ["mobileNotifications"], queryFn: () => listAutoDirectorFollowUps({ page: 1, pageSize: 50 }), refetchInterval: 10000 });
  return <section className="space-y-4"><h1 className="text-xl font-semibold">Notificación y seguimiento</h1>
    {query.isError ? <p role="alert">Error de lectura de notificación.<Button variant="ghost" onClick={() => void query.refetch()}>Releer</Button></p> : null}
    <div className="divide-y">{query.data?.data?.items.map(item => <article className="space-y-2 py-4" key={`${item.itemType}:${item.directorTaskId}:${item.autoApprovalRecordId ?? ""}`}>
      <h2 className="font-medium">{item.novelTitle || item.taskTitle}</h2><p className="text-sm">{item.reasonLabel}</p><p className="text-sm text-muted-foreground">{item.followUpSummary}</p>
      {item.novelId ? <Button asChild size="sm" variant="outline"><Link to={getNovelEditHref(item.novelId)}>Novela abierta</Link></Button> : <p className="text-sm text-muted-foreground">Por favor verifique los resultados de apertura del libro en la computadora.</p>}
    </article>)}</div>
    {query.data?.data?.items.length === 0 ? <p className="text-sm text-muted-foreground">No hay notificaciones que requieran seguimiento.</p> : null}
  </section>;
}
