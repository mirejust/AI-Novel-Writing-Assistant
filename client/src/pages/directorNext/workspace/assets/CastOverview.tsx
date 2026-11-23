import type { Selection, WorkspaceBook } from "../model";
import { ChevronRight } from "lucide-react";
import { SavedFields } from "./sections";

export function CastOverview({book, onSelect}: {book: WorkspaceBook; onSelect?: (selection: Selection) => void}) {
  return <div className="divide-y divide-border/40">
    {book.materials.characters.map(person => <section key={person.id} className="py-5">
      <h3 className="mb-3 text-xl font-semibold">{onSelect
        ? <button type="button" className="inline-flex max-w-full items-center gap-1 rounded-sm text-left hover:underline focus-visible:underline" aria-label={`Ver perfiles de personajes:${person.name}`} onClick={() => onSelect({kind:"character",id:person.id})}><span className="min-w-0 break-words">{person.name}</span><ChevronRight aria-hidden className="size-4 shrink-0 text-muted-foreground"/></button>
        : person.name}</h3>
      <SavedFields lead fields={[["Función en la historia",person.storyFunction],["Identidad de rol",person.role],["Objetivo de acción",person.currentGoal],["Configuración de personajes",person.personality]]}/>
    </section>)}
    {!book.materials.characters.length ? <p className="py-5 text-sm text-muted-foreground">Después de guardar la alineación de personajes, puedes ver la identidad, la motivación y el camino de crecimiento de cada persona.</p> : null}
  </div>;
}
