import { Plus, WandSparkles } from "lucide-react";
import type { Dispatch, SetStateAction } from "react";
import type { WorldRule, WorldStructuredData } from "@ai-novel/shared/types/world";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { HandbookField, HandbookTextarea, SectionHeader } from "./HandbookPrimitives";
import { makeId, removeItem, updateItem } from "./handbookEditorUtils";

export default function WorldHandbookRuleSection(props: {
  draftStructure: WorldStructuredData;
  setDraftStructure: Dispatch<SetStateAction<WorldStructuredData | null>>;
}) {
  const { draftStructure, setDraftStructure } = props;

  const addRule = () => {
    setDraftStructure((prev) =>
      prev
        ? {
          ...prev,
          rules: {
            ...prev.rules,
            axioms: [
              ...prev.rules.axioms,
              {
                id: makeId("rule", prev.rules.axioms.length),
                name: "",
                summary: "",
                cost: "",
                boundary: "",
                enforcement: "",
              },
            ],
          },
        }
        : prev,
    );
  };

  return (
    <section className="rounded-md border p-4">
      <SectionHeader
        icon={WandSparkles}
        title="Reglas esenciales"
        description="Estas reglas limitarán las identidades de los personajes, los límites de poder y las fuentes de conflicto, y son los escenarios subyacentes que más deben seguirse al escribir este libro."
        count={draftStructure.rules.axioms.length}
      />
      <div className="mt-4 space-y-3">
        <HandbookField title="Reglas generales" hint="En un párrafo, explique cómo el poder, los recursos, los tabúes y las consecuencias trabajan juntos para limitar el mundo.">
          <HandbookTextarea
            value={draftStructure.rules.summary}
            onChange={(value) =>
              setDraftStructure((prev) => (prev ? { ...prev, rules: { ...prev.rules, summary: value } } : prev))
            }
            placeholder="Por ejemplo: todos los poderes extraordinarios provienen de préstamos centrales estelares. Si se usa más allá del nivel, se excederá la vida útil y será registrada por el Pabellón Tianji."
            minRows={3}
          />
        </HandbookField>
        <div className="grid gap-3 lg:grid-cols-2">
          {draftStructure.rules.axioms.map((rule: WorldRule, index) => (
            <div key={rule.id || index} className="rounded-md border bg-muted/20 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-sm font-medium">regla {index + 1}</div>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    setDraftStructure((prev) =>
                      prev ? { ...prev, rules: { ...prev.rules, axioms: removeItem(prev.rules.axioms, index) } } : prev,
                    )
                  }
                >
                  Eliminar
                </Button>
              </div>
              <div className="mt-3 grid gap-3">
                <HandbookField title="Nombre de la regla" hint="Una frase corta es suficiente para que el autor pueda citarla repetidamente al escribir.">
                  <Input
                    value={rule.name}
                    onChange={(event) =>
                      setDraftStructure((prev) =>
                        prev
                          ? {
                            ...prev,
                            rules: {
                              ...prev.rules,
                              axioms: updateItem(prev.rules.axioms, index, { name: event.target.value }),
                            },
                          }
                          : prev,
                      )
                    }
                    placeholder="Préstamo de núcleo estelar, el linaje es irreversible y no se pueden lanzar hechizos en la ciudad prohibida."
                  />
                </HandbookField>
                <HandbookField title="Significado de la historia" hint="Escribe cómo los personajes, facciones y eventos del capítulo se verán afectados por esta regla.">
                  <HandbookTextarea
                    value={rule.summary}
                    onChange={(value) =>
                      setDraftStructure((prev) =>
                        prev
                          ? {
                            ...prev,
                            rules: { ...prev.rules, axioms: updateItem(prev.rules.axioms, index, { summary: value }) },
                          }
                          : prev,
                      )
                    }
                    placeholder="¿Qué significa esta regla en la historia?"
                    minRows={3}
                  />
                </HandbookField>
                <HandbookField title="Costo" hint="El precio que tienes que pagar por usar, romper o eludir las reglas.">
                  <Input
                    value={rule.cost}
                    onChange={(event) =>
                      setDraftStructure((prev) =>
                        prev
                          ? {
                            ...prev,
                            rules: {
                              ...prev.rules,
                              axioms: updateItem(prev.rules.axioms, index, { cost: event.target.value }),
                            },
                          }
                          : prev,
                      )
                    }
                    placeholder="Esperanza de vida, memoria, identidad, recursos, confianza en el campo..."
                  />
                </HandbookField>
                <HandbookField title="Límites que no se pueden traspasar a voluntad" hint="Evitar que complots posteriores destruyan la credibilidad del mundo para poder resolver el problema.">
                  <Input
                    value={rule.boundary}
                    onChange={(event) =>
                      setDraftStructure((prev) =>
                        prev
                          ? {
                            ...prev,
                            rules: {
                              ...prev.rules,
                              axioms: updateItem(prev.rules.axioms, index, { boundary: event.target.value }),
                            },
                          }
                          : prev,
                      )
                    }
                    placeholder="Nadie puede resucitar sin pagar un precio; Los personajes de bajo nivel no pueden exceder las reglas de sellado."
                  />
                </HandbookField>
              </div>
            </div>
          ))}
        </div>
        <Button type="button" variant="outline" onClick={addRule}>
          <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
          Agregar reglas básicas
        </Button>
      </div>
    </section>
  );
}
