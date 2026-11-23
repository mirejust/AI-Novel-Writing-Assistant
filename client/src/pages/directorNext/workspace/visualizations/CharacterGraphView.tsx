import {useMemo, useState} from "react";
import {useQuery} from "@tanstack/react-query";
import {getCharacterRelations} from "@/api/novel";
import {getCharacterDynamicsOverview} from "@/api/novelCharacterDynamics";
import {queryKeys} from "@/api/queryKeys";
import {CharacterRelationshipGraphPanel, buildRelationshipGraphModel, type RelationshipGraphMode} from "@/pages/novels/components/characterWorkspace/relationshipGraph";
import type {WorkspaceBook} from "../model";

export function CharacterGraphView({book, preview=false, onOpenCharacter}: {book:WorkspaceBook; preview?:boolean; onOpenCharacter:(id:string)=>void}) {
  const novelId = book.novel.id;
  const [mode, setMode] = useState<RelationshipGraphMode>("all");
  const [selectedId, setSelectedId] = useState("");
  const relations = useQuery({queryKey:queryKeys.novels.characterRelations(novelId),
    queryFn:async()=>{
      const response = await getCharacterRelations(novelId);
      if (!response.success || !Array.isArray(response.data)) throw new Error("Los datos relacionados con este libro no se pudieron leer.");
      return response;
    }, enabled:!preview && Boolean(novelId),
    staleTime:5_000, refetchInterval:15_000});
  const dynamics = useQuery({queryKey:queryKeys.novels.characterDynamicsOverview(novelId),
    queryFn:async()=>{
      const response = await getCharacterDynamicsOverview(novelId);
      if (!response.success || !Array.isArray(response.data?.relations)) throw new Error("La relación dinámica de este libro no se pudo leer.");
      return response;
    }, enabled:!preview && Boolean(novelId),
    staleTime:5_000, refetchInterval:15_000});
  const selected = book.materials.characters.find(character=>character.id===selectedId)?.id ?? "";
  const model = useMemo(()=>buildRelationshipGraphModel({characters:book.materials.characters,
    staticRelations:preview ? [] : relations.data?.data ?? [],
    dynamicRelations:preview ? [] : dynamics.data?.data?.relations ?? [],
    selectedCharacterId:selected,mode}),[book.materials.characters, relations.data, dynamics.data, preview, selected, mode]);
  const error = relations.error ?? dynamics.error;
  return <div className="min-w-0 space-y-4 px-2 sm:px-6">
    <div>
      <h2 className="text-2xl font-semibold">Diagrama de relación de roles</h2>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">Consulte la relación y las últimas etapas de desarrollo de la preservación de este libro. Haz clic en un personaje o conexión para ver los detalles y filtrar por personaje actual, relación de alta tensión o etapa dinámica. La imagen muestra la información más reciente del libro y puede incluir tramas posteriores.</p>
    </div>
    {error ? <div role="alert" className="space-y-2 text-sm text-destructive">
      <p>No se pudieron leer las relaciones de roles. Es posible que falten datos de relación en el gráfico.{error instanceof Error ? error.message : ""}</p>
      <button type="button" className="text-primary hover:underline" onClick={()=>{void relations.refetch(); void dynamics.refetch();}}>Releer la relación</button>
    </div> : null}
    {selected ? <button type="button" className="text-sm text-primary hover:underline focus-visible:underline" onClick={()=>onOpenCharacter(selected)}>Ver perfil de personaje</button> : null}
    <CharacterRelationshipGraphPanel novelId={preview ? null : novelId} model={model} mode={mode} onModeChange={setMode}
      selectedCharacterId={selected} onSelectedCharacterChange={setSelectedId}
      isLoading={!preview && (relations.isLoading || dynamics.isLoading)}/>
  </div>;
}
