import {useMemo} from "react";
import {WorldVisualizationBoard} from "@/pages/worlds/components/visualization";
import type {WorkspaceBook} from "../model";
import {projectSavedWorldVisualization} from "./worldProjection";

export function WorldMapView({book, onOpenWorld}: {book:WorkspaceBook; onOpenWorld:()=>void}) {
  const world = book.materials.world;
  const payload = useMemo(()=>projectSavedWorldVisualization(world),[world]);
  return <div className="min-w-0 space-y-4 px-2 sm:px-6">
    <div>
      <p className="mb-2 text-xs text-muted-foreground">{world?.name ?? "Mundo del libro"}</p>
      <h2 className="text-2xl font-semibold">Mapa del mundo</h2>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">Ver ubicaciones, rutas y afiliaciones. Arrastra o amplía el mapa para verlo en pantalla completa; Las ubicaciones sin coordenadas establecidas se organizan de acuerdo con el diseño esquemático.</p>
    </div>
    {world?.warnings?.map((warning,index)=><p key={index} role="alert" className="text-sm text-destructive">{warning}</p>)}
    {!payload?.geographyMap.nodes.length ? <p className="py-3 text-sm text-muted-foreground">Aún no hay datos de ubicación mapeables para este libro. El contenido guardado se puede ver desde la configuración mundial.</p> : null}
    <button type="button" className="text-sm text-primary hover:underline focus-visible:underline" onClick={onOpenWorld}>Ver configuración mundial</button>
    {payload ? <WorldVisualizationBoard payload={payload} initialMode="geography"/> : null}
  </div>;
}
