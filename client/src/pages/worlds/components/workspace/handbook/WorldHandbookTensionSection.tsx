import { GitBranch } from "lucide-react";
import type { Dispatch, SetStateAction } from "react";
import type { WorldStructuredData } from "@ai-novel/shared/types/world";
import { Button } from "@/components/ui/button";
import { HandbookField, HandbookTextarea, SectionHeader } from "./HandbookPrimitives";
import { listToText, textToList } from "./handbookEditorUtils";

export default function WorldHandbookTensionSection(props: {
  draftStructure: WorldStructuredData;
  setDraftStructure: Dispatch<SetStateAction<WorldStructuredData | null>>;
  onOpenDeepening: () => void;
  onOpenLayers: () => void;
  onOpenAdvanced: () => void;
}) {
  const { draftStructure, setDraftStructure, onOpenDeepening, onOpenLayers, onOpenAdvanced } = props;

  return (
    <section className="rounded-md border p-4">
      <SectionHeader
        icon={GitBranch}
        title="Tensión crítica"
        description="Comprima el entorno mundial en temas que continúen impulsando la trama y evite que el mundo sea solo información de fondo."
      />
      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <HandbookField title="Conflicto central mundial" hint="Conflictos crónicos entre recursos, orden, sistemas de poder u objetivos de facciones.">
          <HandbookTextarea
            value={draftStructure.profile.coreConflict}
            onChange={(value) =>
              setDraftStructure((prev) => (prev ? { ...prev, profile: { ...prev.profile, coreConflict: value } } : prev))
            }
            placeholder="Por ejemplo: agotamiento de recursos, colapso del orden y dos sistemas de poder que son mutuamente excluyentes."
          />
        </HandbookField>
        <HandbookField title="Consecuencias comunes" hint="Línea por línea, escriba los costos a largo plazo de las reglas del mundo.">
          <HandbookTextarea
            value={listToText(draftStructure.rules.sharedConsequences)}
            onChange={(value) =>
              setDraftStructure((prev) =>
                prev ? { ...prev, rules: { ...prev.rules, sharedConsequences: textToList(value) } } : prev,
              )
            }
            placeholder="Cuanto más fuerte es la fuerza, más cerca de la alienación.
Cuanto más prósperas se vuelven las ciudades, más dependen de recursos peligrosos."
          />
        </HandbookField>
        <HandbookField title="Combinaciones tabú" hint="Una línea a la vez, aclara qué antecedentes de personajes, usos de energía o soluciones de trama no pueden aparecer.">
          <HandbookTextarea
            value={listToText(draftStructure.rules.taboo)}
            onChange={(value) =>
              setDraftStructure((prev) => (prev ? { ...prev, rules: { ...prev.rules, taboo: textToList(value) } } : prev))
            }
            placeholder="Los mortales no pueden controlar el núcleo estelar sin coste alguno.
Los espías imperiales no pueden unirse abiertamente al campo alienígena."
          />
        </HandbookField>
        <div className="rounded-md border border-dashed p-3 text-sm leading-6 text-muted-foreground">
          Cuando necesite ajustar las relaciones de poder, los derechos de control de ubicación e importar datos estructurales, ingrese al mantenimiento de campo avanzado. Los autores ordinarios solo necesitan mantener el contenido del manual de esta página.
          <div className="mt-3 flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={onOpenDeepening}>
              Preguntas y respuestas completas
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={onOpenLayers}>
              borrador en capas
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={onOpenAdvanced}>
              Mantenimiento de campo avanzado
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
