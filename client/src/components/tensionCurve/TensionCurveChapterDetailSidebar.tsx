import { ArrowRight, BookOpenText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export interface TensionCurveChapterContext {
  id: string;
  chapterId?: string | null;
  chapterOrder: number;
  beatKey?: string | null;
  title: string;
  summary?: string | null;
  purpose?: string | null;
  exclusiveEvent?: string | null;
  conflictLevel?: number | null;
  conflictLevelSource?: "ai" | "user" | null;
}

interface TensionCurveChapterDetailSidebarProps {
  chapter: TensionCurveChapterContext | null;
  beatLabel?: string | null;
  onOpenChapterDetail?: () => void;
}

function FieldBlock({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="rounded-lg border border-border/70 bg-background p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-sm leading-6 text-foreground">{value?.trim() || "Este elemento aún no se ha completado."}</div>
    </div>
  );
}

export function TensionCurveChapterDetailSidebar(props: TensionCurveChapterDetailSidebarProps) {
  const { chapter, beatLabel, onOpenChapterDetail } = props;

  if (!chapter) {
    return (
      <aside className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
        Después de hacer clic en el nodo de un capítulo en la curva, el título del capítulo, el resumen, el propósito y los eventos exclusivos se mostrarán aquí, lo que facilitará el ajuste de la intensidad según la intención narrativa.
      </aside>
    );
  }

  return (
    <aside className="space-y-3 rounded-xl border border-border/70 bg-muted/10 p-3">
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge>Cap.{chapter.chapterOrder}Cap.</Badge>
          {beatLabel ? <Badge variant="outline">{beatLabel}</Badge> : null}
          {chapter.conflictLevelSource === "user" ? <Badge variant="secondary">Fijación manual</Badge> : <Badge variant="outline">Alojamiento de IA</Badge>}
        </div>
        <div className="text-base font-semibold leading-6 text-foreground">{chapter.title || `Cap.${chapter.chapterOrder}Cap.`}</div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <BookOpenText className="h-3.5 w-3.5" aria-hidden="true" />
          intensidad del conflicto {typeof chapter.conflictLevel === "number" ? chapter.conflictLevel : "Por determinar"}
        </div>
      </div>

      <FieldBlock label="Resumen del capítulo" value={chapter.summary} />
      <FieldBlock label="Propósito de este capítulo" value={chapter.purpose} />
      <FieldBlock label="Evento exclusivo" value={chapter.exclusiveEvent} />

      {onOpenChapterDetail ? (
        <Button type="button" className="w-full justify-between" variant="outline" onClick={onOpenChapterDetail}>
          Abrir tarjeta de detalles del capítulo completo
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Button>
      ) : null}
    </aside>
  );
}
