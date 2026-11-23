import { MapPinned, Plus } from "lucide-react";
import type { Dispatch, SetStateAction } from "react";
import type { WorldLocation, WorldStructuredData } from "@ai-novel/shared/types/world";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { HandbookField, HandbookTextarea, SectionHeader } from "./HandbookPrimitives";
import { makeId, removeItem, updateItem } from "./handbookEditorUtils";

export default function WorldHandbookLocationSection(props: {
  draftStructure: WorldStructuredData;
  setDraftStructure: Dispatch<SetStateAction<WorldStructuredData | null>>;
}) {
  const { draftStructure, setDraftStructure } = props;

  const addLocation = () => {
    setDraftStructure((prev) =>
      prev
        ? {
          ...prev,
          locations: [
            ...prev.locations,
            {
              id: makeId("location", prev.locations.length),
              name: "",
              terrain: "",
              summary: "",
              narrativeFunction: "",
              risk: "",
              entryConstraint: "",
              exitCost: "",
              controllingForceIds: [],
            },
          ],
        }
        : prev,
    );
  };

  return (
    <section className="rounded-md border p-4">
      <SectionHeader
        icon={MapPinned}
        title="Escenario de la historia"
        description="Convierte el mundo en un lugar donde puedas aterrizar: dónde empezar, dónde mejorar y dónde entrar en conflicto."
        count={draftStructure.locations.length}
      />
      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        {draftStructure.locations.map((location: WorldLocation, index) => (
          <div key={location.id || index} className="rounded-md border bg-muted/20 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-sm font-medium">ubicación {index + 1}</div>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() =>
                  setDraftStructure((prev) =>
                    prev ? { ...prev, locations: removeItem(prev.locations, index) } : prev,
                  )
                }
              >
                Eliminar
              </Button>
            </div>
            <div className="mt-3 grid gap-3">
              <HandbookField title="Topónimo" hint="Los mapas posteriores, las áreas controladas por la fuerza y ​​las ubicaciones de los capítulos girarán en torno a estas ubicaciones.">
                <Input
                  value={location.name}
                  onChange={(event) =>
                    setDraftStructure((prev) =>
                      prev ? { ...prev, locations: updateItem(prev.locations, index, { name: event.target.value }) } : prev,
                    )
                  }
                  placeholder="Campo de hielo norte, Star Market City, puerto de Kuroshio"
                />
              </HandbookField>
              <HandbookField title="Características ambientales" hint="Dale al lugar una sensación de espacio que los lectores recordarán, en lugar de aparecer simplemente como un nombre.">
                <Input
                  value={location.terrain}
                  onChange={(event) =>
                    setDraftStructure((prev) =>
                      prev
                        ? { ...prev, locations: updateItem(prev.locations, index, { terrain: event.target.value }) }
                        : prev,
                    )
                  }
                  placeholder="雪原边境、浮空都市、地下矿脉、海上要塞"
                />
              </HandbookField>
              <HandbookField title="Primera impresión del lector" hint="Describe la imagen, orden, peligro o maravilla del lugar.">
                <HandbookTextarea
                  value={location.summary}
                  onChange={(value) =>
                    setDraftStructure((prev) =>
                      prev ? { ...prev, locations: updateItem(prev.locations, index, { summary: value }) } : prev,
                    )
                  }
                  placeholder="¿Cuál es la primera impresión que produce este lugar en el lector?"
                  minRows={3}
                />
              </HandbookField>
              <HandbookField title="Adecuado para funciones de trama" hint="Ayuda a planificar el capítulo para determinar si es adecuado para el comienzo, la prueba, el punto de inflexión o la batalla decisiva.">
                <Input
                  value={location.narrativeFunction}
                  onChange={(event) =>
                    setDraftStructure((prev) =>
                      prev
                        ? {
                          ...prev,
                          locations: updateItem(prev.locations, index, { narrativeFunction: event.target.value }),
                        }
                        : prev,
                    )
                  }
                  placeholder="Comienzo, prueba, punto de inflexión, batalla decisiva, revelación de la verdad."
                />
              </HandbookField>
              <HandbookField title="Riesgos de entrar aquí" hint="El riesgo se convierte en resistencia a las acciones de los personajes y al conflicto del capítulo.">
                <Input
                  value={location.risk}
                  onChange={(event) =>
                    setDraftStructure((prev) =>
                      prev ? { ...prev, locations: updateItem(prev.locations, index, { risk: event.target.value }) } : prev,
                    )
                  }
                  placeholder="Ser perseguido, recursos agotados, identidad expuesta, reglas invalidadas"
                />
              </HandbookField>
            </div>
          </div>
        ))}
      </div>
      <Button type="button" className="mt-3" variant="outline" onClick={addLocation}>
        <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
        Agregar ubicación de la historia
      </Button>
    </section>
  );
}
