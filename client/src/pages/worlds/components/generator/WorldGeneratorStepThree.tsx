import type { WorldSkeletonGenerationPayload } from "@ai-novel/shared/types/worldWizard";
import { Button } from "@/components/ui/button";

interface WorldGeneratorStepThreeProps {
  skeleton: WorldSkeletonGenerationPayload;
  savePending: boolean;
  onBackToScale: () => void;
  onSave: () => void;
}

function SectionList(props: { title: string; items: string[]; emptyText: string }) {
  const { title, items, emptyText } = props;
  return (
    <div className="rounded-md border p-4">
      <div className="text-sm font-semibold">{title}</div>
      <div className="mt-3 space-y-2 text-sm">
        {items.length > 0 ? items.map((item, index) => (
          <div key={`${title}-${index}`} className="rounded border bg-muted/20 p-2">
            {item}
          </div>
        )) : <div className="text-xs text-muted-foreground">{emptyText}</div>}
      </div>
    </div>
  );
}

export default function WorldGeneratorStepThree(props: WorldGeneratorStepThreeProps) {
  const { skeleton, savePending, onBackToScale, onSave } = props;
  const structure = skeleton.structuredData;
  const forceNameById = new Map(structure.forces.map((item) => [item.id, item.name]));
  const locationNameById = new Map(structure.locations.map((item) => [item.id, item.name]));

  return (
    <div className="space-y-4">
      <div className="rounded-md border bg-background p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-base font-semibold">{skeleton.concept.name}</div>
            <div className="mt-1 text-sm text-muted-foreground">{skeleton.concept.oneSentence}</div>
          </div>
          <div className="rounded-md border px-3 py-2 text-xs text-muted-foreground">
            Lo completo {Math.round(skeleton.assessment.completenessScore)} / 100
          </div>
        </div>
        <div className="mt-3 grid gap-2 md:grid-cols-3">
          <div className="rounded border p-2 text-xs">
            <div className="text-muted-foreground">Sentido de la lectura</div>
            <div className="mt-1 font-medium">{skeleton.concept.readerImpression}</div>
          </div>
          <div className="rounded border p-2 text-xs">
            <div className="text-muted-foreground">Tipo promesa</div>
            <div className="mt-1 font-medium">{skeleton.concept.genrePromise}</div>
          </div>
          <div className="rounded border p-2 text-xs">
            <div className="text-muted-foreground">Estado de libro abierto</div>
            <div className="mt-1 font-medium">{skeleton.assessment.readyForNovelUse ? "Acceso al manual mundial" : "Se recomienda llenar los espacios primero."}</div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <SectionList
          title="Reglas esenciales"
          emptyText="Aún no hay reglas básicas"
          items={structure.rules.axioms.map((item) =>
            [item.name, item.summary, item.cost && `Costo:${item.cost}`, item.boundary && `Límite:${item.boundary}`]
              .filter(Boolean)
              .join(" | "),
          )}
        />
        <SectionList
          title="Facciones principales"
          emptyText="Aún no hay energía"
          items={structure.forces.map((item) =>
            [
              item.name,
              item.type,
              item.role,
              item.currentObjective && `Objetivo:${item.currentObjective}`,
              item.pressure && `Presión:${item.pressure}`,
            ].filter(Boolean).join(" | "),
          )}
        />
        <SectionList
          title="Ubicaciones clave"
          emptyText="Aún no hay ubicación"
          items={structure.locations.map((item) =>
            [
              item.name,
              item.type,
              item.directionHint,
              item.terrain,
              item.riskLevel ? `riesgo ${item.riskLevel}` : item.risk,
              item.storyRelevance || item.narrativeFunction,
            ].filter(Boolean).join(" | "),
          )}
        />
        <SectionList
          title="Relaciones de poder"
          emptyText="Aún no hay relación de poder"
          items={structure.relations.forceRelations.map((item) =>
            [
              forceNameById.get(item.sourceForceId) ?? item.sourceForceId,
              item.relation,
              forceNameById.get(item.targetForceId) ?? item.targetForceId,
              item.tension,
              item.detail,
            ].filter(Boolean).join(" | "),
          )}
        />
        <SectionList
          title="Relación geográfica"
          emptyText="Aún no hay relación geográfica"
          items={(structure.relations.locationConnections ?? []).map((item) =>
            [
              locationNameById.get(item.sourceLocationId) ?? item.sourceLocationId,
              item.connectionType,
              locationNameById.get(item.targetLocationId) ?? item.targetLocationId,
              item.distanceHint,
              item.narrativeUse,
            ].filter(Boolean).join(" | "),
          )}
        />
        <SectionList
          title="Entrada de la historia"
          emptyText="Aún no hay entrada a la historia"
          items={skeleton.storyEntrySuggestions.map((item) =>
            [item.title, item.description, item.firstConflict].filter(Boolean).join(" | "),
          )}
        />
      </div>

      {skeleton.assessment.missingParts.length > 0 ? (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
          <div className="font-semibold">Diagnóstico de integridad</div>
          <div className="mt-2 space-y-1">
            {skeleton.assessment.missingParts.map((item, index) => (
              <div key={`${item.area}-${index}`}>
                {item.issue}:{item.suggestedAction}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" onClick={onBackToScale}>
          Volver a cambiar tamaño
        </Button>
        <Button onClick={onSave} disabled={savePending}>
          {savePending ? "Salvando el mundo..." : "Guarda e ingresa al manual mundial."}
        </Button>
      </div>
    </div>
  );
}
