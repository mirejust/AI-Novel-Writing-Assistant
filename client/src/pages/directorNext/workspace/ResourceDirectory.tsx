import {
  BookMarked, BookOpen, CalendarDays, FileText, Globe2, Layers, ListChecks,
  Map, Network, Package, Route, Users, type LucideIcon,
} from "lucide-react";
import type { Selection, WorkspaceBook } from "./model";
import { buildStoryDirectory, beatSelection, chapterSelection, sameSelection, beatChapterLabel, type PlannedChapter } from "./planning";
import { CharacterDirectoryItem } from "./characters/CharacterDirectoryItem";
import { DirectoryBranch } from "./directory/DirectoryBranch";
import "./directory/directory.css";

const chapterLabels = {
  waiting_planning: "Para ser planificado", waiting_writing: "por escribir", generating: "Escribiendo", reviewing: "Comprobando",
  quality_debt: "Para mejorar", replan_required: "Para ser ajustado", completed: "Legible", error: "Pendiente",
};

const entryStyle = "w-full min-w-0 rounded-md px-2 py-2 text-left hover:bg-muted/65 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring aria-[current=true]:bg-primary/10 aria-[current=true]:font-semibold aria-[current=true]:text-primary";
const childrenStyle = "mb-2 ml-3 border-l border-border/70 pl-2";

export function ResourceDirectory({ book, selected, onSelect }: { book: WorkspaceBook; selected: Selection; onSelect: (item: Selection) => void }) {
  const tree = buildStoryDirectory(book, book.planning);
  const plansToReview = new Set(book.characterForwardPlanNotices?.map(notice => notice.planId));
  const selectionKey = "id" in selected ? `${selected.kind}:${selected.id}` : selected.kind;
  const characters = book.materials.characters;
  const inCast = ["characters", "character", "character_graph", "character_timeline"].includes(selected.kind);
  const inLedgers = ["foreshadowing", "resources", "character_resources"].includes(selected.kind);
  const inWorld = ["story", "world", "world_map"].includes(selected.kind);

  function row(item: Selection, label: string, Icon: LucideIcon) {
    const active = sameSelection(selected, item) || (item.kind === "resources" && selected.kind === "character_resources");
    return <button type="button" key={"id" in item ? item.id : item.kind} aria-current={active || undefined}
      className={`${entryStyle} flex items-center gap-2.5 text-sm`} onClick={() => onSelect(item)}>
      <Icon aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
      <span className="min-w-0 break-words">{label}</span>
    </button>;
  }
  function chapterRow(item: PlannedChapter) {
    const target = chapterSelection(item);
    const order = item.chapter?.order ?? item.plan?.chapterOrder;
    const title = item.chapter?.title ?? item.plan?.title;
    const status = item.plan && plansToReview.has(item.plan.id) ? "Por verificar" : item.chapter ? chapterLabels[item.chapter.status] : "Texto pendiente";
    return <button type="button" key={item.plan?.id ?? item.chapter?.id} aria-current={sameSelection(selected, target) || undefined}
      aria-label={`Cap. ${order} Capítulo · ${title},${status}`} onClick={() => onSelect(target)}
      className={`${entryStyle} chapter-entry gap-x-2 gap-y-0.5 text-sm`}>
      <span className="whitespace-nowrap text-xs tabular-nums text-muted-foreground">Cap. {order} Cap.</span>
      <span className="min-w-0 break-words">{title}</span>
      <span className="chapter-state text-xs font-normal text-muted-foreground">{status}</span>
    </button>;
  }
  function contains(rows: PlannedChapter[]) {
    return rows.some(item => sameSelection(chapterSelection(item), selected));
  }
  function groupHeading(label: string, Icon: LucideIcon, count?: string) {
    return <><Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      <span className="min-w-0 flex-1 text-sm font-semibold">{label}</span>
      {count && <span className="text-xs tabular-nums text-muted-foreground">{count}</span>}
    </>;
  }

  return <nav aria-label="Directorio de recursos novedosos" className="director-directory max-h-[70dvh] min-h-0 flex-1 overflow-y-auto overscroll-contain px-1 pb-4 md:max-h-none">
    <section aria-label="Directorio de historias">
      {row({kind: "volumes"}, "Planificación de volúmenes y capítulos.", Layers)}
      <div className="mt-2 space-y-1">
        {tree.volumes.map(({ volume, beats, chapters, unassigned }) => {
          const active = contains(chapters) || sameSelection(selected, {kind: "volume", id: volume.id})
            || (selected.kind === "beat" && selected.volumeId === volume.id);
          return <DirectoryBranch key={volume.id} reveal={active ? selectionKey : undefined} heading={<>
            <span className="shrink-0 text-xs font-medium tabular-nums text-muted-foreground">volumen {volume.sortOrder}</span>
            <span className="min-w-0 flex-1 break-words text-base font-semibold leading-snug">{volume.title}</span>
          </>}>
            <div className={childrenStyle}>
              {row({kind: "volume", id: volume.id}, "Ver el esquema", BookMarked)}
              {unassigned.map(chapterRow)}
              {beats.map(({ beat, chapters: beatChapters }) => {
                const target = beatSelection(volume.id, beat);
                const activeBeat = contains(beatChapters) || sameSelection(selected, target);
                const chapterRange = beatChapterLabel(beatChapters);
                return <DirectoryBranch key={beat.key} reveal={activeBeat ? selectionKey : undefined} heading={
                  <span className="beat-label grid min-w-0 flex-1 grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-2 gap-y-0.5">
                    <span className="min-w-0 break-words text-sm font-medium">{beat.title || beat.label}</span>
                    <span className="max-w-24 truncate text-xs tabular-nums text-muted-foreground" title={chapterRange}>{chapterRange}</span>
                  </span>
                }>
                  <div className={childrenStyle}>
                    {row(target, "Ver objetivos de la sección de ritmo", Route)}
                    {beatChapters.map(chapterRow)}
                    {!beatChapters.length && <p className="px-2 py-2 text-xs text-muted-foreground">Aún no hay plan de capítulo</p>}
                  </div>
                </DirectoryBranch>;
              })}
              {!beats.length && <p className="px-2 py-2 text-xs text-muted-foreground">Sección rítmica por planificar</p>}
            </div>
          </DirectoryBranch>;
        })}
        {tree.unassigned.length > 0 && <DirectoryBranch heading={groupHeading(book.planning ? "Capítulos no devueltos" : "Capítulos", FileText, `${tree.unassigned.length}`)}
          reveal={contains(tree.unassigned) ? selectionKey : undefined}>
          <div className={childrenStyle}>{tree.unassigned.map(chapterRow)}</div>
        </DirectoryBranch>}
        {!book.planning && <DirectoryBranch heading={groupHeading("Esquema", Layers)} reveal={selected.kind === "volume" ? selectionKey : undefined}>
          <div className={childrenStyle}>
            {book.materials.volumes.map(volume => row({kind: "volume", id: volume.id}, volume.title, BookMarked))}
            {!book.materials.volumes.length && <p className="px-2 py-2 text-xs text-muted-foreground">Aún no hay esquema</p>}
          </div>
        </DirectoryBranch>}
      </div>
    </section>

    <section aria-label="Información del libro" className="mt-5 space-y-1 border-t border-border/70 pt-3">
      <DirectoryBranch heading={groupHeading("Historias y mundos", Globe2)} reveal={inWorld ? selectionKey : undefined}>
        <div className={childrenStyle}>
          {row({kind: "story"}, "Planificación de la historia", BookOpen)}
          {row({kind: "world"}, "Ambientación del mundo", Globe2)}
          {row({kind: "world_map"}, "Mapa del mundo", Map)}
        </div>
      </DirectoryBranch>
      <DirectoryBranch heading={groupHeading("Presagio y mochila", Package)} reveal={inLedgers ? selectionKey : undefined}>
        <div className={childrenStyle}>
          {row({kind: "foreshadowing"}, "Presagio", ListChecks)}
          {row({kind: "resources"}, "Mochilas y recursos", Package)}
        </div>
      </DirectoryBranch>
      <DirectoryBranch heading={groupHeading("Perfil de personaje", Users, `${characters.length} gente`)} reveal={inCast ? selectionKey : undefined}>
        <div className={childrenStyle}>
          {row({kind: "characters"}, "Reparto de personajes", Users)}
          {row({kind: "character_graph"}, "Diagrama de relación de roles", Network)}
          {row({kind: "character_timeline"}, "Línea de tiempo del personaje", CalendarDays)}
          {characters.length ? <div className="mt-2 border-t border-border/60 pt-2">
            {characters.map(character => <CharacterDirectoryItem key={character.id} character={character}
              active={selected.kind === "character" && selected.id === character.id}
              onSelect={() => onSelect({kind: "character", id: character.id})} />)}
          </div> : <p className="px-2 py-2 text-xs text-muted-foreground">Aún no hay papel</p>}
        </div>
      </DirectoryBranch>
    </section>
  </nav>;
}
