import type { Dispatch, SetStateAction } from "react";
import type {
  WorldBindingSupport,
  WorldForceRelation,
  WorldLocationControlRelation,
  WorldStructuredData,
} from "@ai-novel/shared/types/world";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

function updateArrayItem<T>(items: T[], index: number, nextItem: T): T[] {
  return items.map((item, itemIndex) => (itemIndex === index ? nextItem : item));
}

export default function WorldRelationsSection(props: {
  draftStructure: WorldStructuredData;
  draftBindingSupport: WorldBindingSupport;
  setDraftStructure: Dispatch<SetStateAction<WorldStructuredData | null>>;
  forceNameById: Map<string, string>;
  locationNameById: Map<string, string>;
}) {
  const { draftStructure, draftBindingSupport, setDraftStructure, forceNameById, locationNameById } = props;

  return (
    <>
      <div className="rounded-md border p-3 space-y-3">
        <div className="flex items-center justify-between">
          <div className="font-medium">Red de relaciones</div>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                setDraftStructure((prev) =>
                  prev
                    ? {
                      ...prev,
                      relations: {
                        ...prev.relations,
                        forceRelations: [
                          ...prev.relations.forceRelations,
                          {
                            id: `force-relation-${prev.relations.forceRelations.length + 1}`,
                            sourceForceId: "",
                            targetForceId: "",
                            relation: "",
                            tension: "",
                            detail: "",
                          },
                        ],
                      },
                    }
                    : prev,
                )
              }
            >
              Agregar nueva relación de poder
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                setDraftStructure((prev) =>
                  prev
                    ? {
                      ...prev,
                      relations: {
                        ...prev.relations,
                        locationControls: [
                          ...prev.relations.locationControls,
                          {
                            id: `location-control-${prev.relations.locationControls.length + 1}`,
                            forceId: "",
                            locationId: "",
                            relation: "",
                            detail: "",
                          },
                        ],
                      },
                    }
                    : prev,
                )
              }
            >
              Controles de ubicación agregados
            </Button>
          </div>
        </div>
        {draftStructure.relations.forceRelations.map((relation, index) => (
          <div key={relation.id || index} className="rounded-md border p-3 space-y-2">
            <div className="text-xs text-muted-foreground">
              {forceNameById.get(relation.sourceForceId) || relation.sourceForceId || "Fuente de poder"} {"->"}{" "}
              {forceNameById.get(relation.targetForceId) || relation.targetForceId || "Poder objetivo"}
            </div>
            <div className="grid gap-2 md:grid-cols-2">
              <Input
                value={relation.sourceForceId}
                onChange={(event) =>
                  setDraftStructure((prev) =>
                    prev
                      ? {
                        ...prev,
                        relations: {
                          ...prev.relations,
                          forceRelations: updateArrayItem<WorldForceRelation>(prev.relations.forceRelations, index, {
                            ...relation,
                            sourceForceId: event.target.value,
                          }),
                        },
                      }
                      : prev,
                  )
                }
                placeholder="ID de fuerza de origen"
              />
              <Input
                value={relation.targetForceId}
                onChange={(event) =>
                  setDraftStructure((prev) =>
                    prev
                      ? {
                        ...prev,
                        relations: {
                          ...prev.relations,
                          forceRelations: updateArrayItem<WorldForceRelation>(prev.relations.forceRelations, index, {
                            ...relation,
                            targetForceId: event.target.value,
                          }),
                        },
                      }
                      : prev,
                  )
                }
                placeholder="ID de fuerza objetivo"
              />
            </div>
            <div className="grid gap-2 md:grid-cols-2">
              <Input
                value={relation.relation}
                onChange={(event) =>
                  setDraftStructure((prev) =>
                    prev
                      ? {
                        ...prev,
                        relations: {
                          ...prev.relations,
                          forceRelations: updateArrayItem<WorldForceRelation>(prev.relations.forceRelations, index, {
                            ...relation,
                            relation: event.target.value,
                          }),
                        },
                      }
                      : prev,
                  )
                }
                placeholder="Tipo de relación"
              />
              <Input
                value={relation.tension}
                onChange={(event) =>
                  setDraftStructure((prev) =>
                    prev
                      ? {
                        ...prev,
                        relations: {
                          ...prev.relations,
                          forceRelations: updateArrayItem<WorldForceRelation>(prev.relations.forceRelations, index, {
                            ...relation,
                            tension: event.target.value,
                          }),
                        },
                      }
                      : prev,
                  )
                }
                placeholder="Tensión/presión"
              />
            </div>
            <textarea
              className="min-h-[70px] w-full rounded-md border bg-background p-2 text-sm"
              value={relation.detail}
              onChange={(event) =>
                setDraftStructure((prev) =>
                  prev
                    ? {
                      ...prev,
                      relations: {
                        ...prev.relations,
                        forceRelations: updateArrayItem<WorldForceRelation>(prev.relations.forceRelations, index, {
                          ...relation,
                          detail: event.target.value,
                        }),
                      },
                    }
                    : prev,
                )
              }
              placeholder="Descripción de la relación"
            />
          </div>
        ))}
        {draftStructure.relations.locationControls.map((relation, index) => (
          <div key={relation.id || index} className="rounded-md border p-3 space-y-2">
            <div className="text-xs text-muted-foreground">
              {(forceNameById.get(relation.forceId) || relation.forceId || "Poder")} Control{" "}
              {(locationNameById.get(relation.locationId) || relation.locationId || "Ubicación")}
            </div>
            <div className="grid gap-2 md:grid-cols-2">
              <Input
                value={relation.forceId}
                onChange={(event) =>
                  setDraftStructure((prev) =>
                    prev
                      ? {
                        ...prev,
                        relations: {
                          ...prev.relations,
                          locationControls: updateArrayItem<WorldLocationControlRelation>(
                            prev.relations.locationControls,
                            index,
                            { ...relation, forceId: event.target.value },
                          ),
                        },
                      }
                      : prev,
                  )
                }
                placeholder="ID de facción"
              />
              <Input
                value={relation.locationId}
                onChange={(event) =>
                  setDraftStructure((prev) =>
                    prev
                      ? {
                        ...prev,
                        relations: {
                          ...prev.relations,
                          locationControls: updateArrayItem<WorldLocationControlRelation>(
                            prev.relations.locationControls,
                            index,
                            { ...relation, locationId: event.target.value },
                          ),
                        },
                      }
                      : prev,
                  )
                }
                placeholder="ID del lugar"
              />
            </div>
            <Input
              value={relation.relation}
              onChange={(event) =>
                setDraftStructure((prev) =>
                  prev
                    ? {
                      ...prev,
                      relations: {
                        ...prev.relations,
                        locationControls: updateArrayItem<WorldLocationControlRelation>(
                          prev.relations.locationControls,
                          index,
                          { ...relation, relation: event.target.value },
                        ),
                      },
                    }
                    : prev,
                )
              }
              placeholder="Relación de control"
            />
            <textarea
              className="min-h-[70px] w-full rounded-md border bg-background p-2 text-sm"
              value={relation.detail}
              onChange={(event) =>
                setDraftStructure((prev) =>
                  prev
                    ? {
                      ...prev,
                      relations: {
                        ...prev.relations,
                        locationControls: updateArrayItem<WorldLocationControlRelation>(
                          prev.relations.locationControls,
                          index,
                          { ...relation, detail: event.target.value },
                        ),
                      },
                    }
                    : prev,
                )
              }
              placeholder="Ilustrar"
            />
          </div>
        ))}
      </div>

      <div className="rounded-md border p-3 space-y-2">
        <div className="font-medium">Sugerencias para usar novelas</div>
        <div className="text-xs text-muted-foreground">Aquí hay una representación de solo lectura de las direcciones disponibles una vez que la muestra mundial ingresa a la novela.</div>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-md border p-3 text-sm">
            <div className="font-medium">Puntos de entrada recomendados</div>
            <div className="mt-2 whitespace-pre-wrap">
              {draftBindingSupport.recommendedEntryPoints.join("\n") || "Sin datos"}
            </div>
          </div>
          <div className="rounded-md border p-3 text-sm">
            <div className="font-medium">Fuerzas de alta presión</div>
            <div className="mt-2 whitespace-pre-wrap">
              {draftBindingSupport.highPressureForces.join("\n") || "Sin datos"}
            </div>
          </div>
          <div className="rounded-md border p-3 text-sm">
            <div className="font-medium">Conflictos compatibles</div>
            <div className="mt-2 whitespace-pre-wrap">
              {draftBindingSupport.compatibleConflicts.join("\n") || "Sin datos"}
            </div>
          </div>
          <div className="rounded-md border p-3 text-sm">
            <div className="font-medium">Combinación prohibida</div>
            <div className="mt-2 whitespace-pre-wrap">
              {draftBindingSupport.forbiddenCombinations.join("\n") || "Sin datos"}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
