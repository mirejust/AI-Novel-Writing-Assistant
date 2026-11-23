import {useQuery} from "@tanstack/react-query";
import {getDirectorLedgers} from "@/api/directorNext";
import {Button} from "@/components/ui/button";
import type {Selection,WorkspaceBook} from "../model";
import {ForeshadowLedger} from "./ForeshadowLedger";
import {ResourceLedger} from "./ResourceLedger";

export function LedgerView({book,selection,onSelect,preview=false}:{book:WorkspaceBook;selection:Selection;onSelect:(selection:Selection)=>void;preview?:boolean}) {
  const novelId=book.novel.id;
  const query=useQuery({queryKey:["directorWorkspaceLedgers",novelId],queryFn:async()=>{
    const response=await getDirectorLedgers(novelId);
    if(!response.success || !response.data || response.data.novelId!==novelId) throw new Error("No pude leer los presagios y los recursos de este libro.");
    return response;
  },enabled:!preview,retry:false,refetchInterval:10000});
  const data=query.data?.data?.novelId===novelId ? query.data.data : null;
  const unreadable=query.isError || Boolean(query.data && (!query.data.success || !data));
  const characterId=selection.kind==="character_resources" ? selection.id : undefined;
  const name=characterId ? book.materials.characters.find(character=>character.id===characterId)?.name : null;
  const foreshadowing=selection.kind==="foreshadowing";
  return <article className="min-w-0 break-words px-2 pb-10 [container-type:inline-size] sm:px-6" aria-label={foreshadowing ? "Presagio de este libro." : "Mochilas y recursos"}>
    <p className="mb-3 text-xs text-muted-foreground">Información sobre este libro · Último estado de guardado de todo el libro</p>
    <h2 className="mb-3 text-2xl font-semibold">{foreshadowing ? "Presagio" : name ? `${name} · Mochilas y Recursos` : "Mochilas y recursos"}</h2>
    <p className="mb-6 text-xs leading-6 text-muted-foreground">Contiene registros guardados a lo largo del libro, que pueden revelar tramas posteriores; no representa el estado de los capítulos en el momento de la lectura.</p>
    {unreadable ? <div role="alert" className="mb-5 space-y-2 bg-destructive/5 p-3"><p className="text-sm text-destructive">El presagio y la lectura de recursos fallaron.{data ? "Aún se puede ver el último registro leído." : ""}</p><Button size="sm" variant="ghost" disabled={preview} onClick={()=>void query.refetch()}>Releer</Button></div> : null}
    {data?.warnings.length ? <ul role="status" className="mb-5 space-y-1 text-xs leading-6 text-warning">{data.warnings.map((warning,index)=><li key={index}>{warning}</li>)}</ul> : null}
    {data ? foreshadowing ? <ForeshadowLedger book={book} items={data.payoffs} onSelect={onSelect}/> : <ResourceLedger book={book} data={data} characterId={characterId} onSelect={onSelect}/>
      : preview ? <p className="py-10 text-sm text-muted-foreground">Este ejemplo no proporciona registros de presagios ni de recursos.</p>
      : query.isLoading ? <p className="py-10 text-sm text-muted-foreground">Cargando presagios y recursos guardados...</p> : null}
  </article>;
}
