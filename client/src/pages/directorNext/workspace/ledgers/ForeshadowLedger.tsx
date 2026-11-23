import {useState} from "react";
import type {PayoffLedgerItem} from "@ai-novel/shared/types/payoffLedger";
import type {Selection,WorkspaceBook} from "../model";
import {chapterWindow,payoffStatusLabels} from "./model";
import {SavedSources,SourceChapter} from "./SavedSources";

export function ForeshadowLedger({book,items,onSelect}:{book:WorkspaceBook;items:PayoffLedgerItem[];onSelect:(selection:Selection)=>void}) {
  const [status,setStatus]=useState("all");
  const saved=items.filter(item=>item.novelId===book.novel.id);
  const filtered=saved.filter(item=>status==="all" || item.currentStatus===status);
  const plans=book.outlineBinding?.plannedPayoffs ?? [];
  return <>
    {plans.length ? <section className="mb-6 space-y-3" aria-label="Plan de presagio del esquema."><h3 className="text-base font-semibold">Planificar desde el esquema · {plans.length} Artículo</h3><p className="text-xs leading-6 text-muted-foreground">El plan no incluye cantidades reales enterradas, vencidas o cobradas; sólo la evidencia textual puede asociarse con el libro mayor real.</p><div className="divide-y divide-border/40">{plans.map(plan=><section key={plan.nodeId} className="space-y-2 py-4"><div className="flex flex-wrap items-center justify-between gap-2"><h4 className="text-sm font-medium">{plan.title}</h4><span className="text-xs text-muted-foreground">{plan.state==="linked" ? "Plan · Evidencia de texto vinculado" : "Plan · No se encontró evidencia textual"}</span></div><p className="text-sm leading-7">Enterrado:{plan.setupDescription || "Pendiente"}</p><p className="text-sm leading-7">Reciclar:{plan.payoffDescription || "Pendiente"}</p><p className="text-xs leading-6 text-muted-foreground">Planea enterrar:{plan.setupChapterOrders.length ? plan.setupChapterOrders.map(order=>`Cap. ${order}`).join(",") : "Por arreglar"} · Reciclaje planificado:{plan.payoffChapterOrders.length ? plan.payoffChapterOrders.map(order=>`Cap. ${order}`).join(",") : "Por arreglar"}</p></section>)}</div></section> : null}
    {plans.length ? <h3 className="mb-3 text-base font-semibold">Libro mayor de texto real</h3> : null}
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
      <p className="text-sm text-muted-foreground">total {saved.length} Artículo · Cobrado {saved.filter(item=>item.currentStatus==="paid_off").length} Artículo</p>
      <label className="flex items-center gap-2 text-sm">Estado<select className="rounded-md border border-input bg-background px-3 py-2" value={status} onChange={event=>setStatus(event.target.value)}><option value="all">Todo el estado</option>{Object.entries(payoffStatusLabels).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
    </div>
    {!filtered.length ? <p className="py-10 text-sm leading-7 text-muted-foreground">{saved.length ? "En este estado no hay ningún presagio." : "Actualmente no hay registros de presagios guardados. El reabastecimiento de recursos del plan o capítulo se puede ver aquí después de guardarlo."}</p> : null}
    <div className="divide-y divide-border/40">{filtered.map(item=><section key={item.id} className="space-y-3 py-5">
      <div className="flex flex-wrap items-start justify-between gap-2"><h3 className="text-base font-semibold">{item.title}</h3><span className="text-xs text-muted-foreground">{payoffStatusLabels[item.currentStatus] ?? "Estado no reconocido"}</span></div>
      <p className="whitespace-pre-wrap text-sm leading-7">{item.summary}</p>
      <p className="text-xs text-muted-foreground">Ventana de canje:{chapterWindow(item.targetStartChapterOrder,item.targetEndChapterOrder)}</p>
      {item.statusReason ? <p className="whitespace-pre-wrap text-sm leading-7 text-foreground/80">{item.statusReason}</p> : null}
      <div className="flex flex-wrap gap-x-4 gap-y-2"><SourceChapter book={book} source={{chapterId:item.setupChapterId,chapterOrder:item.firstSeenChapterOrder}} label="Enterrar" onSelect={onSelect}/><SourceChapter book={book} source={{chapterId:item.payoffChapterId}} label="Retirar dinero" onSelect={onSelect}/><SourceChapter book={book} source={{chapterId:item.lastTouchedChapterId,chapterOrder:item.lastTouchedChapterOrder}} label="Cambios recientes" onSelect={onSelect}/></div>
      {item.riskSignals.length ? <ul className="space-y-1 text-sm leading-6 text-warning">{item.riskSignals.map((risk,index)=><li key={index}>{risk.summary}{risk.stale ? "(Recordatorio histórico)" : ""}</li>)}</ul> : null}
      <details className="pt-1"><summary className="cursor-pointer text-xs text-muted-foreground">Ver evidencia y fuentes de preservación</summary><div className="pt-4"><SavedSources book={book} evidence={item.evidence} sources={item.sourceRefs} onSelect={onSelect}/></div></details>
    </section>)}</div>
  </>;
}
