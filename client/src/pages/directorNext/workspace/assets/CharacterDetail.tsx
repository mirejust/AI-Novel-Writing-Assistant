import type {DirectorCharacterMaterials} from "@ai-novel/shared/types/director/workspace";
import {Button} from "@/components/ui/button";
import {AssetSection,SavedFields} from "./sections";

export function CharacterDetail({character, onCharacter, onResources, canAdjust = false}: {character: DirectorCharacterMaterials; onCharacter: (id:string)=>void;onResources?:(id:string)=>void;canAdjust?:boolean}) {
  return <div className="divide-y divide-border/40">
    <section className="space-y-4 py-4"><SavedFields lead fields={[["Función en la historia",character.storyFunction],["Identidad de rol",character.role],["Relación con el protagonista",character.relationToProtagonist],["Etiqueta de identidad",character.identityLabel],["Pertenecer al campamento",character.factionLabel],["Postura",character.stanceLabel],["Configuración de personajes",character.personality]]}/>
      <div className="flex flex-wrap gap-2"><Button onClick={()=>onCharacter(character.id)}>{canAdjust ? "Ver y ajustar roles" : "Ver historial de cambios"}</Button>{onResources ? <Button variant="ghost" onClick={()=>onResources(character.id)}>Ver mochilas y recursos</Button> : null}</div><p className="text-xs leading-6 text-muted-foreground">El archivo muestra la configuración guardada; el historial de cambios se puede ver leyendo el capítulo.</p>
    </section>
    <AssetSection title="Experiencia y motivación para la acción." open><SavedFields fields={[["Experiencia de personaje",character.background],["lo que quieres lograr",character.outerGoal],["¿Qué necesita realmente el corazón?",character.innerNeed],["Miedo",character.fear],["Trauma pasado",character.wound],["Falsa creencia",character.misbelief],["Un resultado final que no se puede cruzar",character.moralLine]]}/></AssetSection>
    <AssetSection title="Apariencia y expresión"><SavedFields fields={[["Primera impresion",character.firstImpression],["Apariencia",character.appearance],["Postura corporal",character.physique],["Ropa",character.attireStyle],["Detalles icónicos",character.signatureDetail],["Forma de hablar",character.voiceTexture],["Temperamento y presencia",character.presenceImpression],["Fuerza",character.powerLevel],["Reino",character.realm]]}/></AssetSection>
    <AssetSection title="Secretos y crecimiento posterior (puede involucrar artículos posteriores)"><SavedFields fields={[["Secretos ocultos",character.secret],["Dirección de crecimiento",character.development],["Punto de partida",character.arcStart],["Punto de inflexión",character.arcMidpoint],["Elección crítica",character.arcClimax],["Punto final del crecimiento",character.arcEnd]]}/></AssetSection>
  </div>;
}
