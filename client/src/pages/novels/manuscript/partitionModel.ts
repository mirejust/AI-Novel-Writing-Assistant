import type { ManuscriptPartitionUnit } from "@ai-novel/shared/types/manuscript";

export const manuscriptRoleLabels = {body:"Artículo principal",toc:"Área de directorio · Guardar archivos adjuntos",front_matter:"Prefacio · Mantener la afiliación",back_matter:"Posdata · Mantener adjunto",other_reviewed:"Otros · Conservar afiliación"} as const;
/** Move a shared edge, preserving the partition on both sides. Server verifies source coordinates. */
export function moveManuscriptBoundary(units:ManuscriptPartitionUnit[], draftId:string, start:number):ManuscriptPartitionUnit[] {
  const index=units.findIndex(item=>item.draftId===draftId);
  if(index<=0 || !Number.isInteger(start) || start<=units[index-1].range.start || start>=units[index].range.end) throw new Error("El punto de división debe estar entre el punto inicial del área anterior y el punto final de esta área.");
  return units.map((unit,i)=>i===index-1?{...unit,range:{...unit.range,end:start}}:i===index?{...unit,range:{...unit.range,start}}:unit);
}
export function splitManuscriptUnit(units:ManuscriptPartitionUnit[], draftId:string, offset:number, newId:string):ManuscriptPartitionUnit[] {
  const unit=units.find(item=>item.draftId===draftId);
  if(!unit || !Number.isInteger(offset) || offset<=unit.range.start || offset>=unit.range.end) throw new Error("Seleccione un punto de división dentro del área actual.");
  return units.flatMap(item=>item.draftId!==draftId?[item]:[{...item,range:{...item.range,end:offset},needsReview:true},{...item,draftId:newId,title:"Capítulo por nombrar",range:{start:offset,end:item.range.end},needsReview:true}]);
}
export function mergeManuscriptPrevious(units:ManuscriptPartitionUnit[],draftId:string):ManuscriptPartitionUnit[] {
  const index=units.findIndex(item=>item.draftId===draftId);
  if(index<=0) throw new Error("La primera región no tiene ninguna región anterior con la que fusionarse.");
  return units.filter((_,i)=>i!==index).map((item,i)=>i===index-1?{...item,range:{start:item.range.start,end:units[index].range.end},needsReview:true}:item);
}
export function manuscriptPageItems<T>(items:T[],page:number,pageSize=40):T[] {
  return items.slice(Math.max(0,page)*pageSize,(Math.max(0,page)+1)*pageSize);
}
