import type { SimpleCreationShelfProjection } from "@ai-novel/shared/types/novel";
import { useState, type ReactNode } from "react";
import { BookMarked, Boxes, ChevronDown, Globe2, Sparkles, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface SimpleCreationMaterialsPanelProps {
  materials: SimpleCreationShelfProjection["materials"];
}

function ResourceCard(props: {
  icon: typeof Sparkles;
  title: string;
  meta: string;
  children: ReactNode;
}) {
  const Icon = props.icon;
  return (
    <article className="rounded-2xl border border-border/70 bg-background p-4">
      <div className="flex items-start justify-between gap-3">
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Icon className="h-4 w-4" />
        </span>
        <Badge variant="secondary">{props.meta}</Badge>
      </div>
      <h3 className="mt-3 text-sm font-semibold text-foreground">{props.title}</h3>
      <div className="mt-2 text-sm leading-6 text-muted-foreground">{props.children}</div>
    </article>
  );
}

export default function SimpleCreationMaterialsPanel({
  materials,
}: SimpleCreationMaterialsPanelProps) {
  const sellingPoint = materials.story.coreSellingPoint
    || materials.description
    || "La IA está dando forma a la dirección de todo el libro.";
  const readingPromise = materials.story.readingPromise
    || materials.story.protagonistFantasy;
  const [showAllCharacters, setShowAllCharacters] = useState(false);
  const displayedCharacters = showAllCharacters ? materials.characters : materials.characters.slice(0, 6);
  const displayedVolumes = materials.volumes.slice(0, 5);

  return (
    <details
      className="group overflow-hidden rounded-2xl border border-border bg-muted/[0.12]"
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4">
        <div className="flex min-w-0 items-start gap-3">
          <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-foreground text-background">
            <Boxes className="h-4 w-4" />
          </span>
          <div>
            <div className="font-medium text-foreground">Recursos creativos preparados por IA</div>
            <div className="mt-1 text-xs leading-5 text-muted-foreground">
              Vista de solo lectura de los compromisos de la historia, el mundo, los personajes y los resultados del volumen; AI seguirá utilizando estos recursos para mantener la coherencia de los capítulos siguientes.
            </div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <div className="hidden flex-wrap gap-2 text-xs sm:flex">
            <Badge variant="outline">{materials.characterCount} Role</Badge>
            <Badge variant="outline">{materials.volumeCount} Planificación de volumen</Badge>
          </div>
          <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-180" />
        </div>
      </summary>

      <div className="grid gap-3 border-t border-border/60 p-4 md:grid-cols-2 xl:grid-cols-4">
        <ResourceCard icon={Sparkles} title="Dirección del libro" meta="Promesa de la historia">
          <p className="text-foreground">{sellingPoint}</p>
          {readingPromise ? <p className="mt-2">{readingPromise}</p> : null}
          {materials.story.first30ChapterPromise ? (
            <p className="mt-2">Redención anticipada:{materials.story.first30ChapterPromise}</p>
          ) : null}
        </ResourceCard>

        <ResourceCard
          icon={Globe2}
          title="Mundo de la historia"
          meta={materials.world ? "Listo para completar" : "En preparación"}
        >
          {materials.world ? (
            <>
              <p className="font-medium text-foreground">{materials.world.name}</p>
              <p className="mt-1">{materials.world.summary || "Las reglas mundiales básicas se han incorporado a la producción del capítulo."}</p>
            </>
          ) : (
            <p>Aquí se mostrará un resumen de las reglas mundiales cuando se complete.</p>
          )}
        </ResourceCard>

        <ResourceCard icon={Users} title="Reparto de personajes" meta={`${materials.characterCount} Poco`}>
          {materials.characters.length > 0 ? (
            <div className="space-y-2">
              {displayedCharacters.map((character) => (
                <div key={character.id}>
                  <span className="font-medium text-foreground">{character.name}</span>
                  <span> · {character.storyFunction || character.role}</span>
                  {character.currentGoal ? <div className="text-xs leading-5">Objetivos actuales:{character.currentGoal}</div> : null}
                </div>
              ))}
              {materials.characters.length > 6 ? (
                <button type="button" aria-expanded={showAllCharacters} className="text-sm font-medium text-primary hover:underline" onClick={() => setShowAllCharacters(value => !value)}>
                  {showAllCharacters ? "Contraer lista de roles" : `Ver todo ${materials.characters.length} role`}
                </button>
              ) : null}
            </div>
          ) : (
            <p>La alineación de personajes se mostrará aquí cuando esté lista.</p>
          )}
        </ResourceCard>

        <ResourceCard icon={BookMarked} title="Ruta del carrete" meta={`${materials.volumeCount} volumen`}>
          {materials.volumes.length > 0 ? (
            <div className="space-y-2">
              {displayedVolumes.map((volume) => (
                <div key={volume.id}>
                  <span className="font-medium text-foreground">Cap. {volume.order} Volumen · {volume.title}</span>
                  <div className="text-xs leading-5">
                    {volume.chapterCount} Cap.{volume.mainPromise ? ` · ${volume.mainPromise}` : ""}
                  </div>
                </div>
              ))}
              {materials.volumeCount > displayedVolumes.length ? <div className="text-xs">Los volúmenes restantes se han incorporado a la producción de todo el libro.</div> : null}
            </div>
          ) : (
            <p>Las estrategias de volumen y las rutas de los capítulos se mostrarán aquí cuando se completen.</p>
          )}
        </ResourceCard>
      </div>
    </details>
  );
}
