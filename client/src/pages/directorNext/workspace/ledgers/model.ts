import type {CharacterResourceLedgerItem} from "@ai-novel/shared/types/characterResource";
import type {WorkspaceBook} from "../model";

export function resolveLedgerChapter(book:Pick<WorkspaceBook,"chapters">,source:{chapterId?:string|null;chapterOrder?:number|null}) {
  if(source.chapterId) return book.chapters.find(chapter=>chapter.id===source.chapterId) ?? null;
  if(typeof source.chapterOrder!=="number") return null;
  const matches=book.chapters.filter(chapter=>chapter.order===source.chapterOrder);
  return matches.length===1 ? matches[0] : null;
}

export function characterResources(items:CharacterResourceLedgerItem[],novelId:string,characterId?:string) {
  return items.filter(item=>item.novelId===novelId && (!characterId || item.holderCharacterId===characterId || item.ownerCharacterId===characterId));
}

export const payoffStatusLabels={setup:"Enterrado",hinted:"Ya se le solicitó",pending_payoff:"para ser cobrado",paid_off:"Cobrado",failed:"Redención fallida",overdue:"Ventana de canje excedida"};
export const resourceStatusLabels={available:"Disponible",hidden:"Ocultar",borrowed:"Préstamo",transferred:"Transferido",lost:"Perdido",consumed:"Consumido",damaged:"Dañado",destroyed:"Destruido",stale:"Estado de verificación pendiente"};
export const resourceFunctionLabels={tool:"Herramienta",clue:"Clave",weapon:"Armas",proof:"Evidencia",key:"Credenciales clave",cost:"Costo",promise:"Presagio",hidden_card:"Carta de triunfo",constraint:"Límite"};
export const resourceEventLabels={introduced:"Primera aparición",acquired:"Conseguir",revealed:"Revelar",used:"Uso",transferred:"Transferir",lost:"Perdido",consumed:"Consumir",damaged:"Dañado",destroyed:"Destruir",recovered:"Recuperar",stale_marked:"Marcar para revisión"};
export function chapterWindow(from?:number|null,to?:number|null) {
  if(from && to) return from===to ? `Cap. ${from}` : `Cap. ${from}—${to}`;
  return from ? `Cap. ${from} Zhang Qi` : to ? `A partir de ${to}` : "No se ha especificado ningún rango de capítulos";
}
