import type { Character } from "@ai-novel/shared/types/novel";
import type { CharacterResourceLedgerItem } from "@ai-novel/shared/types/characterResource";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  getResourceDisplayMode,
  getResourceFunctionLabel,
  getResourceStatusLabel,
} from "./characterWorkspace.helpers";

interface CharacterResourceTabProps {
  selectedCharacter: Character;
  selectedCharacterResources: CharacterResourceLedgerItem[];
  pendingCharacterResourceCount: number;
  onBackfillCharacterResources?: () => void;
  isBackfillingCharacterResources: boolean;
}

export default function CharacterResourceTab(props: CharacterResourceTabProps) {
  const {
    selectedCharacter,
    selectedCharacterResources,
    pendingCharacterResourceCount,
    onBackfillCharacterResources,
    isBackfillingCharacterResources,
  } = props;
  const resourceDisplayMode = getResourceDisplayMode(selectedCharacter);
  const displayedResources = selectedCharacterResources
    .filter(resourceDisplayMode.shouldShowResource)
    .slice(0, resourceDisplayMode.limit);

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-border/70 bg-muted/10 p-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-sm font-medium">Recursos clave</div>
            <div className="mt-1 text-xs leading-5 text-muted-foreground">{resourceDisplayMode.helper}</div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => onBackfillCharacterResources?.()}
              disabled={isBackfillingCharacterResources || !onBackfillCharacterResources}
            >
              {isBackfillingCharacterResources ? "Relleno..." : "Rellenar capítulos recientes"}
            </Button>
            <Badge variant="outline">{resourceDisplayMode.label}</Badge>
            {pendingCharacterResourceCount > 0 ? (
              <Badge variant="secondary">{pendingCharacterResourceCount} Cambios de recursos pendientes de confirmación</Badge>
            ) : null}
          </div>
        </div>
      </section>

      {displayedResources.length > 0 ? (
        <div className="grid gap-2 lg:grid-cols-2">
          {displayedResources.map((resource) => (
            <div key={resource.id} className="rounded-lg border border-border/70 bg-background p-3">
              <div className="flex flex-wrap items-center gap-2">
                <div className="font-medium">{resource.name}</div>
                <Badge variant={resource.status === "available" || resource.status === "borrowed" ? "default" : "outline"}>
                  {getResourceStatusLabel(resource.status)}
                </Badge>
                <Badge variant="secondary">{getResourceFunctionLabel(resource.narrativeFunction)}</Badge>
              </div>
              <div className="mt-1 text-xs leading-5 text-muted-foreground">{resource.summary}</div>
              <div className="mt-2 grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
                <div>Titular:{resource.holderCharacterName || selectedCharacter.name}</div>
                <div>Información del lector:{resource.readerKnows ? "Informado" : "No revelado"}</div>
                {resource.expectedUseEndChapterOrder ? (
                  <div>Ventana de uso: No.{resource.expectedUseStartChapterOrder ?? "?"}Capítulo a Capítulo{resource.expectedUseEndChapterOrder}Cap.</div>
                ) : null}
                {resource.constraints.length > 0 ? (
                  <div>Límite:{resource.constraints.slice(0, 2).join(" / ")}</div>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
          Los accesorios clave, las pistas, las credenciales de identidad o las cartas de triunfo se depositarán aquí una vez escrito el capítulo; Los personajes temporales solo retienen recursos que afectarán a los capítulos posteriores.
        </div>
      )}
    </div>
  );
}
