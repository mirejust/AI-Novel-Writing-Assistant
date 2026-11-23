import {useMemo, useState, type CSSProperties} from "react";
import {useQuery} from "@tanstack/react-query";
import {ChartNoAxesGantt, ChevronLeft, ChevronRight, CircleDashed, History, MessageCircle, Moon, UsersRound} from "lucide-react";
import type {DirectorNovelCharacterAppearances} from "@ai-novel/shared/types/director/characterAppearances";
import {getDirectorNovelCharacterAppearances} from "@/api/directorNext";
import {Button} from "@/components/ui/button";
import {InitialScheduleAction} from "./InitialScheduleAction";
import type {Selection, WorkspaceBook} from "../model";
import {appearanceDestination, appearanceLabels, appearanceTimelinePage, projectCastAppearanceRows, type AppearanceRow} from "./appearanceModel";
import "./castTimeline.css";

const eventIcons = {mention: MessageCircle, flashback: History, dream: Moon};
const otherKinds = ["mention", "flashback", "dream"] as const;
const emptyChapters: DirectorNovelCharacterAppearances["chapters"] = [];
const coverageText = {
  unwritten: {label: "Texto pendiente", short: "por escribir"},
  untracked: {label: "El texto no ha sido verificado.", short: "Por verificar"},
  recorded: {label: "El texto ha sido revisado.", short: "Aprobado"},
};

function coverageRuns(rows: AppearanceRow[]) {
  const runs: {coverage: AppearanceRow["coverage"]; first: number; last: number; length: number}[] = [];
  for (const row of rows) {
    const run = runs.at(-1);
    if (run && run.coverage === row.coverage && run.last + 1 === row.chapterOrder) {
      run.last = row.chapterOrder;
      run.length++;
    } else {
      runs.push({coverage: row.coverage, first: row.chapterOrder, last: row.chapterOrder, length: 1});
    }
  }
  return runs;
}

function isPresent(row?: AppearanceRow) {
  return row?.events.some(event => event.kind === "present") ?? false;
}

function AppearanceCell({row, previous, next, name, onSelect}: {
  row: AppearanceRow; previous?: AppearanceRow; next?: AppearanceRow; name: string; onSelect: (selection: Selection)=>void;
}) {
  const planLabel = row.planned ? "Planea aparecer" : row.chapterId === null && !row.planSource ? "Calendario de apariciones que se generará"
    : row.planSource ? "No está prevista ninguna comparecencia in situ" : "Aún no hay arreglos de apariencia claros";
  const events = row.events.map(event => `${appearanceLabels[event.kind]}:${event.summary}`);
  const coverageLabel = row.coverage === "untracked" ? "Sin marcar, incapaz de determinar si está ausente" : row.coverage === "unwritten" ? "Texto pendiente" : "";
  const label = `${name} · No. ${row.chapterOrder} Capítulo · ${row.chapterTitle}:${[planLabel, ...events, coverageLabel || (events.length ? "" : "Sin registro de comparecencia")].filter(Boolean).join(";")}`;
  const before = previous?.chapterOrder === row.chapterOrder - 1 ? previous : undefined;
  const after = next?.chapterOrder === row.chapterOrder + 1 ? next : undefined;
  return <button type="button" onClick={()=>onSelect(appearanceDestination(row))} title={label} aria-label={label}
    className="cast-cell">
    <span aria-hidden="true" className="cast-track">
      {row.planned && <span className="cast-bar cast-plan" data-start={!before?.planned} data-end={!after?.planned}/>}
    </span>
    <span aria-hidden="true" className="cast-track">
      {isPresent(row) && <span data-appearance-kind="present" className="cast-bar cast-actual" data-start={!isPresent(before)} data-end={!isPresent(after)}/>}
      {row.coverage === "recorded" && !row.events.length && <span className="cast-no-record"/>}
    </span>
    <span aria-hidden="true" className="cast-event-marks">
      {otherKinds.map(kind => {
        if (!row.events.some(event => event.kind === kind)) return null;
        const Icon = eventIcons[kind];
        return <Icon key={kind} data-appearance-kind={kind}/>;
      })}
    </span>
  </button>;
}

export function CastTimelineChart({book, chapters, onSelect}: {
  book: WorkspaceBook; chapters: DirectorNovelCharacterAppearances["chapters"]; onSelect: (selection: Selection)=>void;
}) {
  const [requestedPage, setRequestedPage] = useState<number | null>(null);
  const axis = useMemo(()=>projectCastAppearanceRows(chapters, null, book.planning), [chapters, book.planning]);
  const cast = useMemo(()=>book.materials.characters.map(character=>({character,
    rows: projectCastAppearanceRows(chapters, character.id, book.planning),
  })), [chapters, book.materials.characters, book.planning]);
  const window = appearanceTimelinePage(axis, "latest", requestedPage);
  if (!cast.length) return <p className="text-sm text-muted-foreground">Actualmente no hay personajes en este libro. Después de guardar la información del personaje, puedes ver el calendario de apariciones aquí.</p>;
  if (!axis.length) return <p className="text-sm text-muted-foreground">Aún no hay un plan de capítulos para este libro. Una vez guardado el plan del capítulo, se mostrará la línea de tiempo de aparición de cada personaje.</p>;
  const start = window.page * 24;
  const range = `Cap. ${window.rows[0].chapterOrder}—${window.rows[window.rows.length-1].chapterOrder}`;
  const pending = axis.filter(row=>row.chapterId === null && !row.planSource).length;
  const unknown = axis.filter(row=>row.coverage === "untracked").length;
  const visibleKinds = otherKinds.filter(kind => window.rows.some(row => row.events.some(event => event.kind === kind)));
  return <figure className="cast-timeline min-w-0 space-y-3" aria-label="Todos los roles aparecen en el diagrama de Gantt.">
    <figcaption className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
      <div className="flex items-center gap-2 text-sm font-medium">
        <UsersRound aria-hidden="true" className="size-4 text-muted-foreground"/>
        <span>{cast.length} personaje · {axis.length} Cap.</span>
      </div>
      <div className="inline-flex items-center gap-1 rounded-lg bg-muted p-1 text-xs">
        {window.pageCount > 1 && <Button variant="ghost" size="icon" className="size-8" aria-label="Párrafo anterior" title="Párrafo anterior" disabled={window.page===0} onClick={()=>setRequestedPage(window.page-1)}><ChevronLeft className="size-4"/></Button>}
        <span aria-live="polite" className="px-2 py-1.5 font-medium tabular-nums">{range}</span>
        {window.pageCount > 1 && <Button variant="ghost" size="icon" className="size-8" aria-label="Siguiente párrafo" title="Siguiente párrafo" disabled={window.page===window.pageCount-1} onClick={()=>setRequestedPage(window.page+1)}><ChevronRight className="size-4"/></Button>}
      </div>
    </figcaption>
    <div key={window.page} role="region" aria-label={`Eje del capítulo con todos los miembros apareciendo,${range}`} tabIndex={0}
      className="cast-scroll max-h-[65dvh] overflow-auto overscroll-contain rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      <table className="cast-grid" style={{"--cast-columns": window.rows.length} as CSSProperties} aria-label="Comparación de personajes y apariciones de capítulos.">
        <colgroup><col className="cast-name-column"/><col span={window.rows.length}/></colgroup>
        <thead className="sticky top-0 z-20">
          <tr>
            <th scope="col" rowSpan={2} className="cast-axis-name">Role <span className="block text-xs font-normal opacity-75">Capítulo →</span></th>
            {window.rows.map(row => <th key={row.chapterOrder} scope="col" className="cast-tick"
              title={`Cap. ${row.chapterOrder} Capítulo · ${row.chapterTitle}${row.chapterId === null && !row.planSource ? " · Calendario de apariciones a generar" : ""}`}>
              {row.chapterOrder}{row.chapterId === null && !row.planSource && <CircleDashed className="ml-0.5 inline size-2.5" aria-label="Calendario de apariciones que se generará"/>}
            </th>)}
          </tr>
          <tr>{coverageRuns(window.rows).map(run => {
            const {label, short} = coverageText[run.coverage];
            const description = `Cap. ${run.first}${run.first === run.last ? "" : `—${run.last}`} Capítulo · ${label}`;
            return <td key={run.first} colSpan={run.length} className="cast-coverage" data-coverage={run.coverage} title={description} aria-label={description}>
              <span>{run.length < 3 ? short : label}</span>
            </td>;
          })}</tr>
        </thead>
        <tbody>{cast.map(({character, rows}) => {
          const visible = rows.slice(start, start + window.rows.length);
          const identity = character.role?.trim() || character.identityLabel?.trim();
          return <tr key={character.id}>
            <th scope="row" className="cast-name">
              <button type="button" title={[character.name, identity].filter(Boolean).join(" · ")} onClick={()=>onSelect({kind:"character",id:character.id})}>
                <span className="flex min-w-0 items-center gap-1.5">
                  <span className="truncate font-semibold">{character.name}</span>
                  {character.castRole === "protagonist" && <span className="shrink-0 rounded bg-info/10 px-1 text-[10px] font-medium text-info">Protagonista</span>}
                </span>
                {identity && <span className="block truncate text-xs font-normal text-muted-foreground">{identity}</span>}
              </button>
            </th>
            {visible.map((row, index) => <td key={appearanceDestination(row).id}>
              <AppearanceCell row={row} previous={visible[index-1]} next={visible[index+1]} name={character.name} onSelect={onSelect}/>
            </td>)}
          </tr>;
        })}</tbody>
      </table>
    </div>
    <div className="cast-legend" aria-label="Leyenda">
      <span><i aria-hidden="true" className="cast-plan"/>Planea aparecer</span>
      <span><i aria-hidden="true" className="cast-actual"/>Apariencia real</span>
      {visibleKinds.map(kind => {
        const Icon = eventIcons[kind];
        return <span key={kind}><Icon aria-hidden="true"/>{appearanceLabels[kind]}</span>;
      })}
      {window.rows.some(row => row.chapterId === null && !row.planSource) && <span><CircleDashed aria-hidden="true"/>Horario a generar</span>}
      {window.rows.some(row => row.coverage === "recorded") && <span><i aria-hidden="true" className="cast-no-record"/>Sin registro de comparecencia</span>}
    </div>
    {pending > 0 && <p className="text-xs leading-5 text-muted-foreground">{pending} El capítulo aún tiene que generar el cronograma de aparición de los personajes, y los registros reales se agregarán después de guardar y organizar el texto.</p>}
    {unknown > 0 && <p className="text-xs leading-5 text-muted-foreground">{unknown} Zhang aún no ha verificado el registro de apariencia del texto actual y no puede juzgar la ausencia del personaje basándose en esto.</p>}
  </figure>;
}

export function CastTimeline({book, onSelect, preview=false}: {book: WorkspaceBook; onSelect: (selection: Selection)=>void; preview?: boolean}) {
  const query = useQuery({queryKey:["director-character-appearances",book.novel.id,"overview"],
    queryFn:()=>getDirectorNovelCharacterAppearances(book.novel.id), enabled:!preview, retry:false, refetchInterval:10000});
  return <div className="min-w-0 space-y-5 px-2 pb-10 sm:px-6">
    <header className="flex items-start gap-3">
      <ChartNoAxesGantt aria-hidden="true" className="mt-1 size-6 shrink-0 text-info"/>
      <div><h2 className="text-2xl font-semibold leading-tight">Línea de tiempo del personaje</h2>
        <p className="mt-1.5 text-sm leading-6 text-muted-foreground">Haga clic en el personaje para ver la información, haga clic en la cuadrícula del capítulo para ver la base de apariencia o el plan del capítulo.</p>
      </div>
    </header>
    <InitialScheduleAction book={book} preview={preview}/>
    {query.isError ? <p role="alert" className="text-sm text-destructive">No se pudo leer el registro de apariencia.<Button variant="ghost" size="sm" onClick={()=>void query.refetch()}>Releer</Button></p>
      : query.isLoading && !preview ? <p className="text-sm text-muted-foreground">Leyendo todos los registros de asistencia...</p>
      : <CastTimelineChart key={book.novel.id} book={book} chapters={query.data?.data?.chapters ?? emptyChapters} onSelect={onSelect}/>}
  </div>;
}
