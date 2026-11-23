import { useMemo } from "react";
import type { Dispatch, SetStateAction } from "react";
import { Castle, Plus } from "lucide-react";
import type { WorldForce, WorldStructuredData } from "@ai-novel/shared/types/world";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { HandbookField, HandbookTextarea, SectionHeader } from "./HandbookPrimitives";
import { makeId, removeItem, updateItem } from "./handbookEditorUtils";

export default function WorldHandbookForceSection(props: {
  draftStructure: WorldStructuredData;
  setDraftStructure: Dispatch<SetStateAction<WorldStructuredData | null>>;
}) {
  const { draftStructure, setDraftStructure } = props;
  const forceSummary = useMemo(() => {
    const forceNames = draftStructure.forces.map((force) => force.name).filter(Boolean).slice(0, 4);
    return forceNames.length > 0 ? forceNames.join(" / ") : "Después de reponer las fuerzas principales, las identidades de los personajes, los conflictos de campamento y la presión del capítulo serán más estables.";
  }, [draftStructure.forces]);

  const addForce = () => {
    setDraftStructure((prev) =>
      prev
        ? {
          ...prev,
          forces: [
            ...prev.forces,
            {
              id: makeId("force", prev.forces.length),
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
    );
  };

  return (
    <section className="rounded-md border p-4">
      <SectionHeader
        icon={Castle}
        title="Facciones principales"
        description={`Primero, deje que el autor comprenda quién compite por los recursos, quién creará resistencia y de dónde pueden venir los personajes.${forceSummary}`}
        count={draftStructure.forces.length}
      />
      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        {draftStructure.forces.map((force: WorldForce, index) => (
          <div key={force.id || index} className="rounded-md border bg-muted/20 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-sm font-medium">poder {index + 1}</div>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() =>
                  setDraftStructure((prev) => (prev ? { ...prev, forces: removeItem(prev.forces, index) } : prev))
                }
              >
                Eliminar
              </Button>
            </div>
            <div className="mt-3 grid gap-3">
              <HandbookField title="Nombre de la fuerza" hint="Una organización de la que un personaje puede originarse, unirse, traicionar o luchar contra ella.">
                <Input
                  value={force.name}
                  onChange={(event) =>
                    setDraftStructure((prev) =>
                      prev ? { ...prev, forces: updateItem(prev.forces, index, { name: event.target.value }) } : prev,
                    )
                  }
                  placeholder="Corte del Emperador Estelar, Pabellón Tianji, Alianza Demonio Alienígena"
                />
              </HandbookField>
              <HandbookField title="Tipo de fuerza" hint="Ayuda a la IA a determinar su comportamiento y textura.">
                <Input
                  value={force.type}
                  onChange={(event) =>
                    setDraftStructure((prev) =>
                      prev ? { ...prev, forces: updateItem(prev.forces, index, { type: event.target.value }) } : prev,
                    )
                  }
                  placeholder="Dinastías, sectas, empresas, organizaciones clandestinas..."
                />
              </HandbookField>
              <HandbookField title="¿Qué significa en el mundo?" hint="Escriba su posición, recursos y características que los lectores deben recordar.">
                <HandbookTextarea
                  value={force.summary}
                  onChange={(value) =>
                    setDraftStructure((prev) =>
                      prev ? { ...prev, forces: updateItem(prev.forces, index, { summary: value }) } : prev,
                    )
                  }
                  placeholder="¿Qué representa esta fuerza en el mundo?"
                  minRows={3}
                />
              </HandbookField>
              <HandbookField title="Objetivo actual" hint="Los objetivos se traducen en eventos del capítulo y conflictos de personajes.">
                <Input
                  value={force.currentObjective}
                  onChange={(event) =>
                    setDraftStructure((prev) =>
                      prev
                        ? { ...prev, forces: updateItem(prev.forces, index, { currentObjective: event.target.value }) }
                        : prev,
                    )
                  }
                  placeholder="Lucha por las vetas minerales, sella la verdad y encuentra al heredero perdido."
                />
              </HandbookField>
              <HandbookField title="Presión sobre la historia" hint="El protagonista u otras fuerzas se verán obligados a elegir, escapar, comerciar o ir a la guerra.">
                <Input
                  value={force.pressure}
                  onChange={(event) =>
                    setDraftStructure((prev) =>
                      prev ? { ...prev, forces: updateItem(prev.forces, index, { pressure: event.target.value }) } : prev,
                    )
                  }
                  placeholder="Caza al protagonista, controla los recursos, crea la guerra y desencadena una crisis de confianza."
                />
              </HandbookField>
            </div>
          </div>
        ))}
      </div>
      <Button type="button" className="mt-3" variant="outline" onClick={addForce}>
        <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
        Aumentar las fuerzas principales
      </Button>
    </section>
  );
}
