import { ChevronRight } from "lucide-react";
import type { Selection, WorkspaceBook } from "../model";
import { beatChapterLabel } from "../planning";
import { AssetSection, SavedFields } from "./sections";
import { VolumeSummaryText } from "../reading/VolumeSummaryEmphasis";

export function PlanningOverview({book, onSelect}: {book: WorkspaceBook; onSelect?: (selection: Selection) => void}) {
  const strategy = book.planning?.strategyPlan;
  const volumes = book.planning
    ? book.planning.volumes.slice().sort((a, b) => a.sortOrder - b.sortOrder).map(volume => ({
        ...volume, range: beatChapterLabel(volume.chapters.map(plan => ({ plan }))),
      }))
    : book.materials.volumes.slice().sort((a, b) => a.order - b.order).map(volume => ({
        ...volume, range: volume.chapterCount ? `${volume.chapterCount}` : "Capítulo por abrir",
      }));
  return <div>
    {strategy ? <AssetSection title="Las ideas de avance del libro." open={!volumes.length}>
      <SavedFields fields={[["Cómo promover la cosecha de lectores",strategy.readerRewardLadder],["Cómo se intensifica el conflicto",strategy.escalationLadder],
        ["Cambios en la sección media",strategy.midpointShift],["Instrucciones de planificación",strategy.notes]]}/>
    </AssetSection> : null}
    {volumes.length ? <ol aria-label="Historias en cada volumen." className="divide-y divide-border/60 border-y border-border/60">
      {volumes.map((volume, index) => <li key={volume.id} className="py-4">
        <div className="mb-1 flex flex-wrap items-baseline gap-x-3 text-xs leading-5 text-muted-foreground">
          <span>Cap. {index + 1} Rollo</span><span>{volume.range}</span>
        </div>
        <h3 className="text-xl font-semibold leading-snug">
          {onSelect ? <button type="button" className="inline-flex max-w-full items-center gap-1 rounded-sm text-left hover:underline focus-visible:underline"
            aria-label={`Ver el esquema:${volume.title}`} onClick={() => onSelect({kind:"volume",id:volume.id})}>
            <span className="min-w-0 break-words">{volume.title}</span><ChevronRight aria-hidden className="size-4 shrink-0 text-muted-foreground"/>
          </button> : volume.title}
        </h3>
        {volume.summary?.trim() ? <p className="mt-2 max-w-[48em] whitespace-pre-wrap break-words text-base leading-7"><VolumeSummaryText id={volume.id} text={volume.summary}/></p> : null}
        {volume.mainPromise?.trim() ? <details className="mt-2" open={!volume.summary?.trim()}>
          <summary className="w-fit cursor-pointer rounded-sm py-1 text-sm font-medium text-muted-foreground hover:text-foreground">los lectores esperan</summary>
          <p className="mt-1 max-w-[48em] whitespace-pre-wrap break-words text-sm leading-7">{volume.mainPromise}</p>
        </details> : null}
      </li>)}
    </ol> : <p className="py-5 text-sm text-muted-foreground">Una vez guardado el plan de volumen, podrá ver la historia, la sección rítmica y la disposición de los capítulos de cada volumen.</p>}
  </div>;
}
