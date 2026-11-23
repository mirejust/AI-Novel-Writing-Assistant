import {useQuery} from "@tanstack/react-query";
import {Link} from "react-router-dom";
import {getOutlineRevision} from "@/api/outlines";
import type {OutlineBookBindingView} from "@ai-novel/shared/types/outlineOpenBook";
import {Button} from "@/components/ui/button";
import {OutlineSetupRecovery} from "./OutlineSetupRecovery";
import {OutlinePreservationDetails} from "./OutlinePreservationDetails";
import {findOutlineNodeTitle,formatOutlineValue,outlineFieldLabels} from "@/pages/outlines/outlineNodes";

export function OutlineBookSource({binding}:{binding:OutlineBookBindingView}) {
  const source=useQuery({queryKey:["outline-revision",binding.projectId,binding.revisionId],queryFn:()=>getOutlineRevision(binding.projectId,binding.revisionId)});
  const differences=binding.sourceDifferences ?? [];
  const kinds={added:"Nuevo",removed:"Eliminar",updated:"Modificar",moved:"Moverse"};
  return <section className="shrink-0 rounded-md bg-muted/30 px-4 py-3 text-sm" aria-label="Fuente del esquema y resumen vinculante">
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2"><p><strong>Crear según el esquema</strong><span className="ml-3 text-muted-foreground">Se corrigió la adopción de la revisión v.{binding.revisionVersion} · {binding.mapping.volumes.length} Volumen · {binding.mapping.chapters.length} Esquema del capítulo · Escribe solo un capítulo a la vez</span></p><Button asChild variant="ghost" size="sm"><Link to={`/outlines/${binding.projectId}`}>Abra el banco de trabajo del esquema fuente</Link></Button></div>
    <p className="mt-1 text-xs leading-6 text-muted-foreground">El contenido completado se conserva y los espacios en blanco se completan según sea necesario; el modelo no se llama al abrir el libro. El esquema independiente y el plan de ejecución del libro se guardan por separado.</p>
    <details className="mt-2"><summary className="cursor-pointer text-xs">Ver programa de estudios adoptado v{binding.revisionVersion} · Preservar detalles y posiciones de capítulos.</summary><div className="mt-3 max-h-72 space-y-4 overflow-y-auto pr-2">
      {source.data ? <OutlinePreservationDetails policy={binding.policy} document={source.data.document}/> : <p className="text-xs text-muted-foreground">{source.isError ? "No se pudo leer la revisión de la fuente; abra el esquema de la fuente para verificarla." : "Leyendo la revisión de la fuente..."}</p>}
      {binding.mapping.volumes.map(volume=><p key={volume.nodeId} className="text-xs">{source.data ? findOutlineNodeTitle(source.data.document,volume.nodeId) : "Dividir en volúmenes"} · {volume.chapterQuota} Capítulo · Capítulo {volume.from}–{volume.to} Cap.</p>)}
    </div></details>
    {binding.currentVersion!==binding.revisionVersion ? <details className="mt-2 text-sm" aria-label="Esquema de la fuente Nuevas diferencias revisadas"><summary className="cursor-pointer font-medium text-warning">El esquema fuente tiene nuevas revisiones v{binding.currentVersion} · Ver {differences.length} Diferencia de artículo</summary><div className="mt-3 max-h-72 space-y-3 overflow-y-auto pr-2"><p className="text-xs leading-6 text-muted-foreground">Este libro todavía está prensado v{binding.revisionVersion} Las diferencias de escritura son solo para visualización y no sincronizarán ni sobrescribirán automáticamente el texto principal.</p>{differences.map((change,index)=>{
      const left=change.before as Record<string,unknown>|undefined,right=change.after as Record<string,unknown>|undefined;
      const before=(change.kind==="moved" ? left?.node : left) as Record<string,unknown>|undefined,after=(change.kind==="moved" ? right?.node : right) as Record<string,unknown>|undefined;
      const title=change.kind==="added" ? String(after?.title ?? after?.name ?? "Nuevo contenido") : source.data ? findOutlineNodeTitle(source.data.document,change.nodeId) : "Contenido creativo relacionado";
      const fields=[...new Set([...Object.keys(before ?? {}),...Object.keys(after ?? {})])].filter(key=>key!=="nodeId" && JSON.stringify(before?.[key])!==JSON.stringify(after?.[key]));
      return <section key={`${change.nodeId}:${index}`} className="border-t border-border/40 pt-2"><h3 className="text-sm font-medium">{kinds[change.kind]} · {title}</h3>{change.kind==="moved" ? <p className="text-xs leading-6 text-muted-foreground">Se han ajustado las posiciones de los nodos; el libro conserva su posición original.</p> : null}{fields.filter(field=>outlineFieldLabels[field]).map(field=><div key={field} className="mt-2 text-xs leading-6"><p className="font-medium">{outlineFieldLabels[field]}</p><p className="text-muted-foreground">Versión adoptada:{formatOutlineValue(before?.[field],field,source.data?.document)}</p><p>Nueva revisión:{formatOutlineValue(after?.[field],field,source.data?.document)}</p></div>)}</section>;
    })}<Button asChild variant="ghost" size="sm"><Link to={`/outlines/${binding.projectId}`}>Ver versión en Outline Workbench</Link></Button></div></details> : null}
    {binding.setupState.error ? <OutlineSetupRecovery binding={binding}/> : null}
  </section>;
}
