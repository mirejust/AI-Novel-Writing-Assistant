import type {DirectorWorkspaceMaterials} from "@ai-novel/shared/types/director/workspace";
import {AssetSection,SavedFields,SavedList} from "./sections";

export function StoryDetail({materials}: {materials: DirectorWorkspaceMaterials}) {
  const {story} = materials;
  return <div className="divide-y divide-border/40">
    <section className="py-4"><SavedFields lead fields={[["Aspectos destacados principales",story.coreSellingPoint],["Introducción a la historia",materials.description],["los lectores esperan",story.readingPromise],["La experiencia que trae el protagonista.",story.protagonistFantasy],["Dirección de apertura",story.first30ChapterPromise]]}/></section>
    <AssetSection title="Expectativas de etapa y ruta de crecimiento."><SavedFields fields={[["¿Qué intentan ofrecer los primeros 3 capítulos?",story.chapter3Payoff],["¿Qué intentan ofrecer los primeros 10 capítulos?",story.chapter10Payoff],["¿Qué intentan ofrecer los primeros 30 capítulos?",story.chapter30Payoff],["Cómo se intensifica el conflicto",story.escalationLadder],["Cómo avanzar en relaciones importantes",story.relationshipMainline]]}/></AssetSection>
    <AssetSection title="Límites creativos"><SavedList label="Límites que deben respetarse" items={story.absoluteRedLines}/>{!story.absoluteRedLines?.length ? <p className="text-sm text-muted-foreground">El límite de creación no se ha guardado.</p> : null}</AssetSection>
  </div>;
}
