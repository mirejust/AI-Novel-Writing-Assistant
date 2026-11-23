import {useState} from "react";
import type {CharacterAppearance} from "@ai-novel/shared/types/director/characterAppearances";
import {Button} from "@/components/ui/button";
import {appearanceDestination, appearanceLabels, appearanceTimelinePage, type AppearanceBoundary, type AppearanceRow, type AppearanceDestination} from "./appearanceModel";

const symbols = {present: "●", mention: "△", flashback: "◆", dream: "☾"};
const eventKinds: CharacterAppearance["kind"][] = ["present", "mention", "flashback", "dream"];
const nodeClass = "relative h-8 w-9 bg-background p-0 text-lg";

function ChapterNode({row, label, symbol, onSelect, active = false}: {
  row: AppearanceRow; label: string; symbol: string; onSelect: (target:AppearanceDestination)=>void; active?: boolean;
}) {
  const description = `Cap. ${row.chapterOrder} Capítulo · ${row.chapterTitle}:${label}`;
  return <Button type="button" variant="ghost" size="sm"
    className={`${nodeClass} ${active ? "font-bold text-primary" : "text-muted-foreground"}`}
    aria-label={description} title={description} onClick={()=>onSelect(appearanceDestination(row))}>
    <span aria-hidden="true">{symbol}</span>
  </Button>;
}

export function AppearanceTimeline({rows, boundary, onSelect, reviewOrders}: {
  rows: AppearanceRow[]; boundary: AppearanceBoundary; onSelect: (target:AppearanceDestination)=>void;
  reviewOrders?: ReadonlySet<number>;
}) {
  const [requestedPage, setRequestedPage] = useState<number | null>(null);
  const window = appearanceTimelinePage(rows, boundary, requestedPage);
  if (!window.rows.length) return null;
  const range = `Cap. ${window.rows[0].chapterOrder}—${window.rows[window.rows.length-1].chapterOrder}`;
  return <figure className="min-w-0 max-w-full space-y-3" aria-label="Diagrama de apariencia del personaje.">
    <figcaption className="flex flex-wrap items-center justify-between gap-2">
      <h4 className="font-medium">Diagrama de apariencia</h4>
      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        {window.pageCount > 1 ? <Button type="button" variant="ghost" size="sm" aria-label="Ver el capítulo anterior"
          disabled={window.page===0} onClick={()=>setRequestedPage(window.page-1)}>Párrafo anterior</Button> : null}
        <span aria-live="polite">{range}</span>
        {window.pageCount > 1 ? <Button type="button" variant="ghost" size="sm" aria-label="Ver el siguiente capítulo"
          disabled={window.page===window.pageCount-1} onClick={()=>setRequestedPage(window.page+1)}>Siguiente párrafo</Button> : null}
      </div>
    </figcaption>
    <p className="text-xs text-muted-foreground">Ver en orden de capítulos, haga clic en el símbolo para abrir el capítulo correspondiente; desplácese horizontalmente para ver los capítulos restantes de este párrafo.</p>
    <div className="max-w-full overflow-x-auto overscroll-x-contain rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      role="region" aria-label={`Eje del capítulo de apariencia,${range}`} tabIndex={0}>
      <table className="w-full border-collapse text-center text-xs" aria-label="Comparación de apariencias en planta y texto.">
        <thead><tr>
          <th scope="col" className="sticky left-0 z-10 min-w-16 bg-background px-2 py-2 text-left font-normal text-muted-foreground">Capítulos</th>
          {window.rows.map(row=><th key={appearanceDestination(row).id} scope="col" className="min-w-12 px-1 py-2 font-normal text-muted-foreground">{row.chapterOrder}</th>)}
        </tr></thead>
        <tbody>{["planned", "actual"].map(lane=><tr key={lane}>
          <th scope="row" className="sticky left-0 z-10 bg-background px-2 py-3 text-left align-top font-medium">{lane==="planned" ? "Planea aparecer" : "Registro de texto"}</th>
          {window.rows.map(row=><td key={appearanceDestination(row).id} className="relative px-1 py-3 align-top">
            <span aria-hidden="true" className="absolute inset-x-0 top-7 h-px bg-border/70"/>
            <div className="relative flex flex-col items-center gap-1">
              {lane==="planned" ? row.chapterId === null && !row.planSource
                ? <ChapterNode row={row} label="Se generará el cronograma de apariciones, consulte el plan del capítulo." symbol="◌" onSelect={onSelect}/>
                : row.planned ? <ChapterNode row={row} label={reviewOrders?.has(row.chapterOrder) ? "Aspecto previsto, pendiente de verificación" : "Planea aparecer"} symbol={reviewOrders?.has(row.chapterOrder) ? "!" : "○"} onSelect={onSelect}/>
                  : <span className="relative inline-flex h-8 items-center bg-background px-2 text-muted-foreground" aria-label="Aún no hay arreglos de apariencia claros">—</span>
                : <>
                  {eventKinds.filter(kind=>row.events.some(event=>event.kind===kind)).map(kind=><ChapterNode key={kind} row={row}
                    label={`${appearanceLabels[kind]}:${row.events.find(event=>event.kind===kind)!.summary}`} symbol={symbols[kind]} active={kind==="present"} onSelect={onSelect}/>)}
                  {row.coverage!=="recorded" ? <ChapterNode row={row} label={row.coverage==="untracked" ? "Sin marcar, incapaz de determinar si está ausente" : "Texto pendiente"}
                    symbol={row.coverage==="untracked" ? "?" : "…"} onSelect={onSelect}/>
                    : !row.events.length ? <span className="relative inline-flex h-8 items-center bg-background px-2 text-muted-foreground" aria-label="Comprobado, apariencia no registrada.">—</span> : null}
                </>}
            </div>
          </td>)}
        </tr>)}</tbody>
      </table>
    </div>
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground" aria-label="Leyenda esquemática">
      <span>○ Apariencia planificada</span>
      {window.rows.some(row => reviewOrders?.has(row.chapterOrder)) ? <span>! Por verificar</span> : null}
      {eventKinds.map(kind=><span key={kind}>{symbols[kind]} {appearanceLabels[kind]}</span>)}
      <span>◌ Se generará el cronograma de comparecencia.</span><span>? No comprobado</span><span>… Texto a escribir</span><span>— Sin registro correspondiente</span>
    </div>
  </figure>;
}
