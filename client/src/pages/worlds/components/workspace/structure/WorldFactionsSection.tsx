import type { Dispatch, SetStateAction } from "react";
import type { WorldFaction, WorldForce, WorldStructuredData } from "@ai-novel/shared/types/world";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

function updateArrayItem<T>(items: T[], index: number, nextItem: T): T[] {
  return items.map((item, itemIndex) => (itemIndex === index ? nextItem : item));
}

function parseTextList(value: string): string[] {
  return value
    .split(/[\n,，;；、]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export default function WorldFactionsSection(props: {
  draftStructure: WorldStructuredData;
  setDraftStructure: Dispatch<SetStateAction<WorldStructuredData | null>>;
  factionNameById: Map<string, string>;
  forceNameById: Map<string, string>;
}) {
  const { draftStructure, setDraftStructure, factionNameById, forceNameById } = props;

  return (
    <div className="rounded-md border p-3 space-y-3">
      <div className="flex items-center justify-between">
        <div className="font-medium">Facciones y fuerzas</div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              setDraftStructure((prev) =>
                prev
                  ? {
                    ...prev,
                    factions: [
                      ...prev.factions,
                      {
                        id: `faction-${prev.factions.length + 1}`,
                        name: "",
                        position: "",
                        doctrine: "",
                        goals: [],
                        methods: [],
                        representativeForceIds: [],
                      },
                    ],
                  }
                  : prev,
              )
            }
          >
            Agregar nuevo campamento
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              setDraftStructure((prev) =>
                prev
                  ? {
                    ...prev,
                    forces: [
                      ...prev.forces,
                      {
                        id: `force-${prev.forces.length + 1}`,
                        name: "",
                        type: "",
                        factionId: null,
                        summary: "",
                        baseOfPower: "",
                        currentObjective: "",
                        pressure: "",
                        leader: null,
                        narrativeRole: "",
                      },
                    ],
                  }
                  : prev,
              )
            }
          >
            Nuevas fuerzas
          </Button>
        </div>
      </div>
      <div className="rounded-md border border-dashed p-3 text-xs text-muted-foreground space-y-1">
        <div>Campamento = postura abstracta, línea o alineación mundial; poder = organización, círculo, red o institución específica.</div>
        <div>Las reglas predeterminadas de clase mundial, como el "Mecanismo de presión social", las "Reglas de operación de la industria" y las "Leyes de redes interpersonales", deben escribirse primero en el "Centro de reglas" y no deben incluirse en tarjetas de campamento.</div>
        <div>
          ID de facción actual:{
            draftStructure.factions.length > 0
              ? draftStructure.factions.map((item) => `${item.id}(${item.name || "Sin nombre"})`).join(",")
              : "Sin datos"
          }
        </div>
        <div>
          ID de fuerza actual:{
            draftStructure.forces.length > 0
              ? draftStructure.forces.map((item) => `${item.id}(${item.name || "Sin nombre"})`).join(",")
              : "Sin datos"
          }
        </div>
      </div>
      <div className="space-y-3">
        {draftStructure.factions.map((faction, index) => (
          <div key={faction.id || index} className="rounded-md border p-3 space-y-2">
            <div className="text-xs text-muted-foreground">
              Las tarjetas de facción describen alineamientos abstractos, no empresas, departamentos o redes específicas.
            </div>
            <Input
              value={faction.name}
              onChange={(event) =>
                setDraftStructure((prev) =>
                  prev
                    ? {
                      ...prev,
                      factions: updateArrayItem<WorldFaction>(prev.factions, index, {
                        ...faction,
                        name: event.target.value,
                      }),
                    }
                    : prev,
                )
              }
              placeholder="Nombre del campo, por ejemplo: Estabilidad dentro del sistema / Facción que busca ganancias en el mercado / Facción pragmática de la red de relaciones"
            />
            <Input
              value={faction.position}
              onChange={(event) =>
                setDraftStructure((prev) =>
                  prev
                    ? {
                      ...prev,
                      factions: updateArrayItem<WorldFaction>(prev.factions, index, {
                        ...faction,
                        position: event.target.value,
                      }),
                    }
                    : prev,
                )
              }
              placeholder="Posición / Equipo Mundial"
            />
            <textarea
              className="min-h-[80px] w-full rounded-md border bg-background p-2 text-sm"
              value={faction.doctrine}
              onChange={(event) =>
                setDraftStructure((prev) =>
                  prev
                    ? {
                      ...prev,
                      factions: updateArrayItem<WorldFaction>(prev.factions, index, {
                        ...faction,
                        doctrine: event.target.value,
                      }),
                    }
                    : prev,
                )
              }
              placeholder="Filosofía / credo / propuesta de facción"
            />
            <div className="grid gap-2 md:grid-cols-2">
              <Input
                value={faction.goals.join(",")}
                onChange={(event) =>
                  setDraftStructure((prev) =>
                    prev
                      ? {
                        ...prev,
                        factions: updateArrayItem<WorldFaction>(prev.factions, index, {
                          ...faction,
                          goals: parseTextList(event.target.value),
                        }),
                      }
                      : prev,
                  )
                }
                placeholder="Metas a largo plazo, separadas por comas o comas"
              />
              <Input
                value={faction.methods.join(",")}
                onChange={(event) =>
                  setDraftStructure((prev) =>
                    prev
                      ? {
                        ...prev,
                        factions: updateArrayItem<WorldFaction>(prev.factions, index, {
                          ...faction,
                          methods: parseTextList(event.target.value),
                        }),
                      }
                      : prev,
                  )
                }
                placeholder="Medios de uso común, use comas o comas para separar"
              />
            </div>
            <Input
              value={faction.representativeForceIds.join(",")}
              onChange={(event) =>
                setDraftStructure((prev) =>
                  prev
                    ? {
                      ...prev,
                      factions: updateArrayItem<WorldFaction>(prev.factions, index, {
                        ...faction,
                        representativeForceIds: parseTextList(event.target.value),
                      }),
                    }
                    : prev,
                )
              }
              placeholder="Representa el ID de la facción, separado por comas o comas"
            />
            {faction.representativeForceIds.length > 0 ? (
              <div className="text-xs text-muted-foreground">
                Fuerzas representativas:{faction.representativeForceIds.map((id) => forceNameById.get(id) || id).join(",")}
              </div>
            ) : null}
          </div>
        ))}
        {draftStructure.forces.map((force, index) => (
          <div key={force.id || index} className="rounded-md border p-3 space-y-2">
            <div className="text-xs text-muted-foreground">
              La carta de poder describe una organización o círculo específico que puede ejercer presión, ocupar un lugar y participar en una red de relaciones.
            </div>
            <div className="grid gap-2 md:grid-cols-3">
              <Input
                value={force.name}
                onChange={(event) =>
                  setDraftStructure((prev) =>
                    prev
                      ? {
                        ...prev,
                        forces: updateArrayItem<WorldForce>(prev.forces, index, {
                          ...force,
                          name: event.target.value,
                        }),
                      }
                      : prev,
                  )
                }
                placeholder="Nombres poderosos, como: Gestión de empresas de publicidad / Cadena de agencias de vivienda / Red de círculos empresariales locales."
              />
              <Input
                value={force.type}
                onChange={(event) =>
                  setDraftStructure((prev) =>
                    prev
                      ? {
                        ...prev,
                        forces: updateArrayItem<WorldForce>(prev.forces, index, {
                          ...force,
                          type: event.target.value,
                        }),
                      }
                      : prev,
                  )
                }
                placeholder="Tipo de poder, como por ejemplo: empresa/departamento/red intermediaria/círculo empresarial"
              />
              <Input
                value={force.factionId ?? ""}
                onChange={(event) =>
                  setDraftStructure((prev) =>
                    prev
                      ? {
                        ...prev,
                        forces: updateArrayItem<WorldForce>(prev.forces, index, {
                          ...force,
                          factionId: event.target.value || null,
                        }),
                      }
                      : prev,
                  )
                }
                placeholder="ID de facción (puede estar vacío)"
              />
            </div>
            {force.factionId ? (
              <div className="text-xs text-muted-foreground">
                Pertenecen al campamento:{factionNameById.get(force.factionId) || force.factionId}
              </div>
            ) : null}
            <textarea
              className="min-h-[80px] w-full rounded-md border bg-background p-2 text-sm"
              value={force.summary}
              onChange={(event) =>
                setDraftStructure((prev) =>
                  prev
                    ? {
                      ...prev,
                      forces: updateArrayItem<WorldForce>(prev.forces, index, {
                        ...force,
                        summary: event.target.value,
                      }),
                    }
                    : prev,
                )
              }
              placeholder="Panorama de fuerzas/identidad externa/papel en el mundo"
            />
            <div className="grid gap-2 md:grid-cols-2">
              <Input
                value={force.baseOfPower}
                onChange={(event) =>
                  setDraftStructure((prev) =>
                    prev
                      ? {
                        ...prev,
                        forces: updateArrayItem<WorldForce>(prev.forces, index, {
                          ...force,
                          baseOfPower: event.target.value,
                        }),
                      }
                      : prev,
                  )
                }
                placeholder="Base de poder/Fuente de recursos/Manos de control"
              />
              <Input
                value={force.currentObjective}
                onChange={(event) =>
                  setDraftStructure((prev) =>
                    prev
                      ? {
                        ...prev,
                        forces: updateArrayItem<WorldForce>(prev.forces, index, {
                          ...force,
                          currentObjective: event.target.value,
                        }),
                      }
                      : prev,
                  )
                }
                placeholder="Metas actuales/lo que quieres avanzar ahora"
              />
            </div>
            <div className="grid gap-2 md:grid-cols-2">
              <Input
                value={force.leader ?? ""}
                onChange={(event) =>
                  setDraftStructure((prev) =>
                    prev
                      ? {
                        ...prev,
                        forces: updateArrayItem<WorldForce>(prev.forces, index, {
                          ...force,
                          leader: event.target.value || null,
                        }),
                      }
                      : prev,
                  )
                }
                placeholder="Líder/Persona clave (opcional)"
              />
              <Input
                value={force.pressure}
                onChange={(event) =>
                  setDraftStructure((prev) =>
                    prev
                      ? {
                        ...prev,
                        forces: updateArrayItem<WorldForce>(prev.forces, index, {
                          ...force,
                          pressure: event.target.value,
                        }),
                      }
                      : prev,
                  )
                }
                placeholder="Formas de aplicar presión / Fuentes de presión / Cómo se fuerza al personaje"
              />
            </div>
            <div className="grid gap-2 md:grid-cols-1">
              <Input
                value={force.narrativeRole}
                onChange={(event) =>
                  setDraftStructure((prev) =>
                    prev
                      ? {
                        ...prev,
                        forces: updateArrayItem<WorldForce>(prev.forces, index, {
                          ...force,
                          narrativeRole: event.target.value,
                        }),
                      }
                      : prev,
                  )
                }
                placeholder="Roles narrativos, tales como: fuente de opresión/inductor/guardián/zona de amortiguamiento"
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
