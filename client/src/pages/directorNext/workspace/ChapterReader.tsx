import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import type { WorkspaceBook, WorkspaceChapter } from "./model";
import type { DirectorGenerationSnapshot } from "@ai-novel/shared/types/director/generation";
import {ReadingDisplaySettings, readingTextStyle, type ReadingDisplayPreferences} from "./reading";

export function ChapterReader({ chapter, characters, onCharacter, onChapter, chapters, generation = null, followGeneration = false, readingDisplay, onReadingDisplayChange, onEdit }: {
  chapter: WorkspaceChapter; characters: WorkspaceBook["materials"]["characters"];
  onCharacter: (id: string) => void; onChapter: (id: string) => void; chapters: WorkspaceChapter[];
  generation?: DirectorGenerationSnapshot | null; followGeneration?: boolean;
  readingDisplay: ReadingDisplayPreferences; onReadingDisplayChange: (next: ReadingDisplayPreferences) => void;
  onEdit?: (chapterId: string) => void;
}) {
  // Keep the opened edition while polling. Updating prose is an explicit reader action.
  const [edition, setEdition] = useState(chapter);
  useEffect(() => { if (followGeneration) setEdition(chapter); }, [chapter, followGeneration]);
  const live = followGeneration && generation?.chapterId === chapter.id ? generation : null;
  const content = live?.content ?? edition.content;
  const changed = !followGeneration && (edition.updatedAt !== chapter.updatedAt || edition.content !== chapter.content);
  const tail = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (live?.state !== "writing" || !tail.current) return;
    const viewport = tail.current.closest<HTMLElement>("[data-chapter-scroll-viewport]");
    if (!viewport) return;
    // Follow only within the reader; scrollIntoView also moves outer page containers.
    viewport.scrollTop += Math.max(0, tail.current.getBoundingClientRect().bottom - viewport.getBoundingClientRect().bottom);
  }, [live?.executionId, live?.revision]);
  const index = chapters.findIndex(row => row.id === chapter.id);
  return <article className="mx-auto max-w-[42rem] px-2 pb-10 sm:px-6" aria-label="Texto del capítulo">
    <div className="mb-9 space-y-3 border-b border-border/50 pb-6">
      <p className="text-xs tracking-widest text-muted-foreground">Cap. {edition.order} capítulo · {(live ? live.content.replace(/\s/g, "").length : edition.wordCount).toLocaleString()} Palabras</p>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="min-w-0 text-2xl font-semibold tracking-wide">{edition.title}</h2>
        <div className="flex items-center gap-2">
          {onEdit ? <Button size="sm" variant="outline" onClick={() => onEdit(chapter.id)}>Editar texto</Button> : null}
          <ReadingDisplaySettings preferences={readingDisplay} onChange={onReadingDisplayChange} previewText={content}/>
        </div>
      </div>
      {live ? <p role="status" className="text-xs text-muted-foreground">{live.state === "writing" ? "Generando texto · Vista previa en tiempo real" : live.state === "checking" ? "La generación del texto se completa, se verifica y se guarda." : live.state === "saved" ? "El texto ha sido guardado." : "La generación ha sido interrumpida, verifique las indicaciones de procesamiento en el escritorio del director. El texto quedará sujeto a la versión conservada."}</p> : null}
      {changed ? <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground" role="status">Este capítulo tiene contenido recién guardado.<Button size="sm" variant="outline" onClick={() => setEdition(chapter)}>Ver contenido nuevo</Button></div> : null}
      {chapter.qualityDebt ? <div className="space-y-1 bg-muted/40 px-3 py-2 text-sm" role="status">
        <p className="font-medium">El texto ha sido guardado y aún quedan asuntos por revisar</p>
        <p className="text-muted-foreground">{chapter.qualityDebt.reason}</p>
        <p className="text-xs text-muted-foreground">Puede ver las preguntas en "Editar texto" y usar IA para verificar o revisar el texto, y puede continuar creando capítulos posteriores.</p>
      </div> : null}
      <div className="flex flex-wrap items-center gap-1.5"><span className="mr-2 text-xs text-muted-foreground">Ver roles rápidamente</span>{characters.map(character => <Button key={character.id} size="sm" variant="ghost" onClick={() => onCharacter(character.id)}>{character.name}</Button>)}{characters.length === 0 ? <span className="text-xs text-muted-foreground">Aún no hay información del personaje</span> : null}</div>
    </div>
    {content?.trim() ? <div className="space-y-6 leading-[2.15] tracking-wide text-foreground/90" style={readingTextStyle(readingDisplay)}>{content.split(/\n\s*\n/).filter(Boolean).map((paragraph, index) => <p key={index} className="whitespace-pre-wrap break-words">{paragraph}</p>)}{live?.state === "writing" ? <span aria-hidden="true" className="inline-block h-5 w-1 animate-pulse bg-primary"/> : null}</div>
      : live?.state === "writing" ? <p className="py-16 text-center text-sm text-muted-foreground">Preparando salida de texto...</p>
      : <div className="py-16 text-center"><p className="text-lg font-medium">Este capítulo está esperando ser escrito.</p><p className="mt-3 text-sm text-muted-foreground">El texto ha sido guardado y puede leerse aquí. Primero puedes consultar el plan de la historia y la información de los personajes.</p></div>}
    <div ref={tail}/>
    <footer className="mt-12 flex justify-between gap-3 border-t border-border/50 pt-5">
      <Button variant="ghost" disabled={index <= 0} onClick={() => onChapter(chapters[index - 1].id)}>Capitulo anterior</Button>
      <Button variant="ghost" disabled={index < 0 || index >= chapters.length - 1} onClick={() => onChapter(chapters[index + 1].id)}>Próximo capítulo</Button>
    </footer>
  </article>;
}
