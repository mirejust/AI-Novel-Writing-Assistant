import type { CharacterTimeline } from "@ai-novel/shared/types/novel";
import AiButton from "@/components/common/AiButton";
import { Badge } from "@/components/ui/badge";

interface CharacterTimelineTabProps {
  timelineEvents: CharacterTimeline[];
  onSyncTimeline: () => void;
  isSyncingTimeline: boolean;
  onSyncAllTimeline: () => void;
  isSyncingAllTimeline: boolean;
}

export default function CharacterTimelineTab(props: CharacterTimelineTabProps) {
  const { timelineEvents, onSyncTimeline, isSyncingTimeline, onSyncAllTimeline, isSyncingAllTimeline } = props;

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-border/70 bg-muted/10 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-sm font-medium">Flujo de eventos de personajes</div>
            <div className="mt-1 text-xs leading-5 text-muted-foreground">
              Utilice los eventos de capítulos recientes para observar los cambios en la situación del personaje y sincronice la línea de tiempo si es necesario antes de continuar escribiendo.
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <AiButton size="sm" variant="outline" onClick={onSyncTimeline} disabled={isSyncingTimeline}>
              {isSyncingTimeline ? "Sincronizando..." : "Sincronizar líneas de tiempo de personajes"}
            </AiButton>
            <AiButton size="sm" variant="outline" onClick={onSyncAllTimeline} disabled={isSyncingAllTimeline}>
              {isSyncingAllTimeline ? "Sincronizando..." : "Sincroniza todas las líneas de tiempo de los personajes."}
            </AiButton>
          </div>
        </div>
      </section>

      {timelineEvents.length > 0 ? (
        <div className="space-y-2">
          {timelineEvents.slice(-12).reverse().map((event) => (
            <div key={event.id} className="rounded-xl border border-border/70 bg-background p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="font-medium">{event.title}</div>
                <Badge variant="outline">{event.source}</Badge>
              </div>
              <div className="text-xs text-muted-foreground">
                {event.chapterOrder ? `capítulo ${event.chapterOrder}` : "Sin atribución de capítulo"} ·{" "}
                {new Date(event.createdAt).toLocaleString()}
              </div>
              <div className="mt-1 text-xs text-muted-foreground">{event.content}</div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
          Aún no hay eventos. Primero haga clic en "Sincronizar línea de tiempo de personajes".
        </div>
      )}
    </div>
  );
}
