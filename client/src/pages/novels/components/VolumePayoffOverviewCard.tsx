import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { VolumePlan } from "@ai-novel/shared/types/novel";

interface VolumePayoffOverviewCardProps {
  selectedVolume: VolumePlan;
}

function normalizePayoffText(value: string): string {
  return value.trim().toLowerCase().replace(/[\s，。、《》“”"'‘’()（）\-—]/g, "");
}

function isLikelySamePayoff(left: string, right: string): boolean {
  const normalizedLeft = normalizePayoffText(left);
  const normalizedRight = normalizePayoffText(right);
  if (!normalizedLeft || !normalizedRight) {
    return false;
  }
  return (
    normalizedLeft === normalizedRight
    || normalizedLeft.includes(normalizedRight)
    || normalizedRight.includes(normalizedLeft)
  );
}

export default function VolumePayoffOverviewCard(props: VolumePayoffOverviewCardProps) {
  const { selectedVolume } = props;
  const chapterPayoffGroups = selectedVolume.chapters
    .map((chapter) => ({
      chapterId: chapter.id,
      chapterOrder: chapter.chapterOrder,
      chapterTitle: chapter.title?.trim() || "Capítulo sin título",
      refs: chapter.payoffRefs.map((item) => item.trim()).filter(Boolean),
    }))
    .filter((chapter) => chapter.refs.length > 0);

  const chapterPayoffEntries = chapterPayoffGroups.flatMap((chapter) =>
    chapter.refs.map((ref) => ({
      ref,
      chapterOrder: chapter.chapterOrder,
      chapterTitle: chapter.chapterTitle,
    })),
  );

  const openPayoffRows = selectedVolume.openPayoffs
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => ({
      item,
      linkedChapters: chapterPayoffEntries.filter((entry) => isLikelySamePayoff(item, entry.ref)),
    }));

  const linkedOpenPayoffCount = openPayoffRows.filter((item) => item.linkedChapters.length > 0).length;
  const unplannedOpenPayoffs = openPayoffRows.filter((item) => item.linkedChapters.length === 0);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <CardTitle className="text-base">Volumen actual presagio/referencia de reciclaje</CardTitle>
            <div className="text-sm text-muted-foreground">
              Aquí solo se muestra el volumen seleccionado actualmente para verificar si los asuntos que se canjearán en este volumen son consistentes con los acuerdos de canje del capítulo. El libro mayor canónico a nivel de libro completo se ha trasladado a un módulo independiente arriba.
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">Cap. {selectedVolume.sortOrder} Rollo</Badge>
            <Badge variant="outline">para ser cobrado {openPayoffRows.length}</Badge>
            <Badge variant="outline">El capítulo ha sido suspendido. {linkedOpenPayoffCount}</Badge>
            <Badge variant={unplannedOpenPayoffs.length > 0 ? "secondary" : "outline"}>
              Asociación pendiente {unplannedOpenPayoffs.length}
            </Badge>
            <Badge variant="outline">Disposición del capítulo {chapterPayoffGroups.length}</Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 xl:grid-cols-[minmax(280px,0.9fr)_minmax(0,1.35fr)]">
          <div className="rounded-xl border border-border/70 bg-muted/20 p-4">
            <div className="flex items-center justify-between gap-2">
              <div className="font-medium text-foreground">Artículos a canjear en este volumen</div>
              <Badge variant="outline">{openPayoffRows.length}</Badge>
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              Estos son los elementos a cumplir establecidos en la estrategia de volumen, que se pueden utilizar para ver qué obstáculos deben enterrar y qué puntos deben recuperarse en este volumen.
            </div>
            <div className="mt-3 space-y-2 text-sm">
              {openPayoffRows.length > 0 ? (
                openPayoffRows.map((item) => (
                  <div
                    key={item.item}
                    className="rounded-lg border border-border/70 bg-background p-3"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="font-medium text-foreground">{item.item}</div>
                      <Badge variant={item.linkedChapters.length > 0 ? "default" : "secondary"}>
                        {item.linkedChapters.length > 0 ? "Toque del capítulo arreglado" : "No se han organizado capítulos específicos."}
                      </Badge>
                    </div>
                    {item.linkedChapters.length > 0 ? (
                      <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                        {item.linkedChapters.map((entry) => (
                          <span
                            key={`${item.item}-${entry.chapterOrder}-${entry.ref}`}
                            className="rounded-full border border-border/70 px-2 py-1"
                          >
                            Cap.{entry.chapterOrder}capitulo {entry.chapterTitle}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <div className="mt-2 text-xs text-muted-foreground">
                        Este artículo a canjear aún no se ha vinculado a ningún capítulo específico de este volumen. Se recomienda crear el enlace de canje al abrir el capítulo.
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <div className="rounded-lg border border-dashed border-border/70 bg-background p-3 text-xs text-muted-foreground">
                  El volumen actual no se ha llenado con artículos para canjear.
                </div>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-border/70 bg-muted/20 p-4">
            <div className="flex items-center justify-between gap-2">
              <div className="font-medium text-foreground">Disposiciones para el canje de capítulos de este volumen.</div>
              <Badge variant="outline">{chapterPayoffGroups.length}</Badge>
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              Lo que vemos aquí es la asociación de canje de que el volumen actual se ha vinculado al capítulo, que se utiliza para verificar si la división del capítulo realmente se ha ejecutado a nivel de capítulo.
            </div>
            <div className="mt-3 space-y-2 text-sm">
              {chapterPayoffGroups.length > 0 ? (
                chapterPayoffGroups.map((chapter) => (
                  <div
                    key={chapter.chapterId}
                    className="rounded-lg border border-border/70 bg-background p-3"
                  >
                    <div className="font-medium text-foreground">
                      Cap.{chapter.chapterOrder}capitulo {chapter.chapterTitle}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                      {chapter.refs.map((ref) => (
                        <span
                          key={`${chapter.chapterId}-${ref}`}
                          className="rounded-full border border-border/70 px-2 py-1"
                        >
                          {ref}
                        </span>
                      ))}
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-lg border border-dashed border-border/70 bg-background p-3 text-xs text-muted-foreground">
                  La relación de canje no se ha completado para los capítulos del volumen actual. Será más difícil comprobar qué presagios deben reciclarse cuando se abra el capítulo más tarde.
                </div>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
