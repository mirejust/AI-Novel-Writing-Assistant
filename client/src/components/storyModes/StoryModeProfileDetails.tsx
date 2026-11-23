import { BookOpen, CircleGauge, Workflow } from "lucide-react";
import type { NovelStoryMode } from "@ai-novel/shared/types/storyMode";
import { cn } from "@/lib/utils";

const conflictCeilingLabel = {
  low: "Baja intensidad",
  medium: "Intensidad media",
  high: "Alta resistencia",
} as const;

function ContractList({ title, items, emptyText }: { title: string; items: string[]; emptyText: string }) {
  return (
    <div>
      <div className="text-xs font-medium text-muted-foreground">{title}</div>
      {items.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {items.map((item) => (
            <span key={item} className="rounded-md border border-border/70 bg-muted/20 px-2 py-1 text-xs text-foreground">
              {item}
            </span>
          ))}
        </div>
      ) : (
        <div className="mt-2 text-sm text-muted-foreground">{emptyText}</div>
      )}
    </div>
  );
}

export default function StoryModeProfileDetails({
  node,
  eyebrow = "Modo de empuje",
  className,
  titleId,
}: {
  node: Pick<NovelStoryMode, "name" | "description" | "template" | "profile">;
  eyebrow?: string;
  className?: string;
  titleId?: string;
}) {
  const { profile } = node;

  return (
    <div className={cn("max-w-4xl", className)}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-xs font-medium tracking-[0.16em] text-muted-foreground">{eyebrow}</div>
          <h2 id={titleId} className="mt-2 text-2xl font-semibold tracking-tight text-foreground">{node.name}</h2>
        </div>
        <div className="flex items-center gap-2 rounded-md border border-border/70 px-3 py-2 text-xs text-muted-foreground">
          <CircleGauge className="h-4 w-4" aria-hidden="true" />
          Límite de conflicto:{conflictCeilingLabel[profile.conflictCeiling]}
        </div>
      </div>

      <p className="mt-4 text-sm leading-7 text-muted-foreground">
        {node.description?.trim() || profile.coreDrive}
      </p>

      <div className="mt-6 grid gap-px overflow-hidden rounded-md border border-border/70 bg-border/70 md:grid-cols-2">
        <div className="bg-background p-4">
          <Workflow className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <div className="mt-3 text-xs font-medium text-muted-foreground">Controlador central</div>
          <div className="mt-1 text-sm leading-6 text-foreground">{profile.coreDrive}</div>
        </div>
        <div className="bg-background p-4">
          <BookOpen className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <div className="mt-3 text-xs font-medium text-muted-foreground">Comentarios de los lectores</div>
          <div className="mt-1 text-sm leading-6 text-foreground">{profile.readerReward}</div>
        </div>
        <div className="bg-background p-4">
          <div className="text-xs font-medium text-muted-foreground">Unidad de avance del capítulo</div>
          <div className="mt-1 text-sm leading-6 text-foreground">{profile.chapterUnit}</div>
        </div>
        <div className="bg-background p-4">
          <div className="text-xs font-medium text-muted-foreground">Regreso al escenario</div>
          <div className="mt-1 text-sm leading-6 text-foreground">{profile.volumeReward}</div>
        </div>
      </div>

      <div className="mt-7 grid gap-6 md:grid-cols-2">
        <ContractList title="Unidad de propulsión" items={profile.progressionUnits} emptyText="Unidad de propulsión aún no definida" />
        <ContractList title="Conflicto adecuado" items={profile.allowedConflictForms} emptyText="Aún no se han definido conflictos adecuados" />
        <ContractList title="Señales que deben aparecer" items={profile.mandatorySignals} emptyText="Señal requerida aún no definida" />
        <ContractList title="Señales para evitar" items={profile.antiSignals} emptyText="Las señales de evitación aún no se han definido" />
      </div>

      <div className="mt-7 border-l-2 border-foreground/20 pl-4">
        <div className="text-sm font-semibold text-foreground">Solución</div>
        <p className="mt-2 text-sm leading-7 text-muted-foreground">{profile.resolutionStyle}</p>
        {profile.forbiddenConflictForms.length > 0 ? (
          <p className="mt-3 text-xs leading-6 text-muted-foreground">
            No apto para:{profile.forbiddenConflictForms.join(",")}
          </p>
        ) : null}
      </div>

      {node.template?.trim() ? (
        <div className="mt-7 border-t border-border/70 pt-6">
          <div className="text-sm font-semibold text-foreground">Suplemento de uso de IA</div>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-muted-foreground">{node.template}</p>
        </div>
      ) : null}
    </div>
  );
}
