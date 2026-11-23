import type {DirectorWorldMaterials} from "@ai-novel/shared/types/director/workspace";
import {AssetSection,NamedAsset,SavedFields,SavedList} from "./sections";

export function WorldDetail({world}: {world: DirectorWorldMaterials | null}) {
  if (!world) return <p className="py-5 text-sm leading-7 text-muted-foreground">El escenario mundial de este libro aún no se ha guardado. Aquí se mostrarán las reglas, fuerzas y ubicaciones del mundo.</p>;
  const {structure,storySlice} = world;
  const forces = new Map(structure?.forces.map(item => [item.id,item.name]));
  const factions = new Map(structure?.factions.map(item => [item.id,item.name]));
  const locations = new Map(structure?.locations.map(item => [item.id,item.name]));
  const names = (ids: string[] | undefined, table: Map<string,string>) => ids?.map(id => table.get(id) ?? "Atribución a verificar").join(",");
  const relationCount = (structure?.relations.forceRelations.length ?? 0) + (structure?.relations.locationControls.length ?? 0) + (structure?.relations.locationConnections?.length ?? 0);
  const layers = world.legacyLayers;
  const legacyFields: [string,string|null|undefined][] = layers ? [
    ["Fondo mundial",layers.background],["Entorno geográfico",layers.geography],["Sistema de energía",layers.magicSystem],["Potencia y sistema",layers.politics],
    ["Cultura y vida",layers.cultures],["Carrera",layers.races],["Fe",layers.religions],["Tecnología",layers.technology],
    ["Historia",layers.history],["Economía",layers.economy],["Información de facción",layers.factions],["Conflicto",layers.conflicts],["Información de la regla",layers.axioms],
  ] : [];
  return <div className="divide-y divide-border/40">
    <section className="space-y-4 py-5">
      <p className="text-xs text-muted-foreground">{world.source === "novel" ? "Escenarios exclusivos para este libro." : world.source === "library" ? "Datos mundiales relacionados" : "Datos mundiales guardados"}</p>
      {world.warnings?.map(warning => <p key={warning} role="alert" className="text-sm leading-7 text-destructive">{warning}</p>)}
      <SavedFields lead fields={[["Hoja informativa mundial",world.summary],["Conflicto central",structure?.profile.coreConflict],["Características del mundo",structure?.profile.identity],["Atmósfera de la historia",structure?.profile.tone]]}/>
      <SavedList label="Tema" items={structure?.profile.themes}/>
      <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground" aria-label="Número de datos mundiales">
        <span>reglas básicas {structure?.rules.axioms.length ?? 0}</span><span>acampar {structure?.factions.length ?? 0}</span>
        <span>poder {structure?.forces.length ?? 0}</span><span>ubicación {structure?.locations.length ?? 0}</span>
      </div>
    </section>
    <AssetSection title="Reglas y precios mundiales." count={structure?.rules.axioms.length ?? 0}>
      {structure?.rules.summary ? <p className="whitespace-pre-wrap text-sm leading-7">{structure.rules.summary}</p> : null}
      {structure?.rules.axioms.map(rule => <NamedAsset key={rule.id} name={rule.name}><SavedFields fields={[
        ["Descripción de la regla",rule.summary],["Costo de uso",rule.cost],["Frontera infranqueable",rule.boundary],["Cómo entran en vigor las reglas",rule.enforcement],
      ]}/></NamedAsset>)}
      {!structure?.rules.axioms.length ? <p className="text-sm text-muted-foreground">Las reglas básicas aún no se han guardado.</p> : null}
      <SavedList label="Tabú mundial" items={structure?.rules.taboo}/><SavedList label="Consecuencias comunes" items={structure?.rules.sharedConsequences}/>
    </AssetSection>
    <AssetSection title="Facciones y fuerzas" count={(structure?.factions.length ?? 0)+(structure?.forces.length ?? 0)}>
      {structure?.factions.map(faction => <NamedAsset key={faction.id} name={faction.name}>
        <SavedFields fields={[["Posición de campamento",faction.position],["Creencias y opiniones",faction.doctrine],["Fuerza representativa",names(faction.representativeForceIds,forces)]]}/>
        <SavedList label="Objetivo" items={faction.goals}/><SavedList label="Forma de hacer las cosas" items={faction.methods}/>
      </NamedAsset>)}
      {structure?.forces.map(force => <NamedAsset key={force.id} name={force.name}>
        <SavedFields fields={[["Perfil de fuerza",force.summary],["Pertenecer al campamento",force.factionId ? factions.get(force.factionId) ?? "Atribución a verificar" : null],
          ["Tipo de fuerza",force.type],["Base de fuerza",force.baseOfPower],["Objetivo actual",force.currentObjective],["Presión sobre los personajes",force.pressure],
          ["Función en la historia",force.narrativeRole],["Líder",force.leader],["Ubicación de control",names(force.controlledLocationIds,locations)]]}/>
        <SavedList label="Recursos disponibles" items={force.resources}/>
      </NamedAsset>)}
      {!structure?.factions.length && !structure?.forces.length ? <p className="text-sm text-muted-foreground">El campamento y la fuerza aún no se han salvado.</p> : null}
    </AssetSection>
    <AssetSection title="Ubicación y acceso" count={structure?.locations.length ?? 0}>
      {structure?.locations.map(location => <NamedAsset key={location.id} name={location.name}><SavedFields fields={[
        ["Descripción general de la ubicación",location.summary],["Zona",location.region],["Terreno",location.terrain],["Propósito de la historia",location.narrativeFunction],
        ["Riesgos que enfrentan los personajes",location.risk],["Condiciones de entrada",location.entryConstraint],["Precio de salida",location.exitCost],
        ["Fuerzas de control",names(location.controllingForceIds,forces)],
      ]}/></NamedAsset>)}
      {!structure?.locations.length ? <p className="text-sm text-muted-foreground">La ubicación de la historia aún no se ha guardado.</p> : null}
    </AssetSection>
    <AssetSection title="Relaciones y conflictos" count={relationCount}>
      {structure?.relations.forceRelations.map(relation => <NamedAsset key={relation.id} name={`${forces.get(relation.sourceForceId) ?? "Potencia a verificar"} → ${forces.get(relation.targetForceId) ?? "Potencia a verificar"}`}>
        <SavedFields fields={[["Relación entre las partes",relation.relation],["Tensión del conflicto",relation.tension],["Descripción de la relación",relation.detail]]}/>
      </NamedAsset>)}
      {structure?.relations.locationControls.map(relation => <NamedAsset key={relation.id} name={`${forces.get(relation.forceId) ?? "Potencia a verificar"} · ${locations.get(relation.locationId) ?? "Ubicación a verificar"}`}>
        <SavedFields fields={[["Relación de control",relation.relation],["Descripción de la relación",relation.detail]]}/>
      </NamedAsset>)}
      {structure?.relations.locationConnections?.map(relation => <NamedAsset key={relation.id} name={`${locations.get(relation.sourceLocationId) ?? "Ubicación a verificar"} → ${locations.get(relation.targetLocationId) ?? "Ubicación a verificar"}`}>
        <SavedFields fields={[["Medios de transporte",relation.connectionType],["Distancia",relation.distanceHint],["Propósito de la historia",relation.narrativeUse]]}/>
      </NamedAsset>)}
      {!relationCount ? <p className="text-sm text-muted-foreground">Aún no se han guardado relaciones entre ubicaciones o poderes.</p> : null}
    </AssetSection>
    <AssetSection title="Ámbito de uso de este libro.">
      {storySlice ? <>
        <p className="text-xs leading-6 text-muted-foreground">Ámbito de escritura guardado para ilustrar las reglas, poderes y ubicaciones elegidas para este libro.</p>
        <SavedFields fields={[["Etapa del libro",storySlice.coreWorldFrame],["Gama ampliable",storySlice.storyScopeBoundary]]}/>
        {storySlice.appliedRules.map(rule => <NamedAsset key={rule.id} name={rule.name}><SavedFields fields={[["Reglas",rule.summary],["Influencia en este libro",rule.whyItMatters]]}/></NamedAsset>)}
        {storySlice.activeForces.map(force => <NamedAsset key={force.id} name={force.name}><SavedFields fields={[["La función de este libro.",force.roleInStory],["Método de presión",force.pressure],["Perfil de fuerza",force.summary]]}/></NamedAsset>)}
        {storySlice.activeLocations.map(location => <NamedAsset key={location.id} name={location.name}><SavedFields fields={[["Uso de la trama",location.storyUse],["Riesgo",location.risk],["Descripción general de la ubicación",location.summary]]}/></NamedAsset>)}
        {storySlice.activeElements.map(element => <NamedAsset key={element.id} name={element.label}><SavedFields fields={[["Propósito e instrucciones",element.summary]]}/></NamedAsset>)}
        <SavedList label="Conflictos ampliables" items={storySlice.conflictCandidates}/><SavedList label="Fuente de estrés" items={storySlice.pressureSources}/>
        <SavedList label="Fuente de suspenso" items={storySlice.mysterySources}/><SavedList label="dirección de desarrollo de la historia" items={storySlice.suggestedStoryAxes}/>
        <SavedList label="Eventos aptos para la entrada." items={storySlice.recommendedEntryPoints}/><SavedList label="Combinaciones no disponibles" items={storySlice.forbiddenCombinations}/>
      </> : <p className="text-sm leading-7 text-muted-foreground">El alcance de este libro no se ha salvado. Las configuraciones mundiales existentes se pueden ver arriba.</p>}
    </AssetSection>
    {legacyFields.some(([,value]) => value?.trim()) ? <AssetSection title="Otra información de fondo guardada"><SavedFields fields={legacyFields}/></AssetSection> : null}
  </div>;
}
