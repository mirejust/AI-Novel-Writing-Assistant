import { useState, type Dispatch, type SetStateAction } from "react";
import { AlertTriangle, BookOpen, Castle, GitBranch, MapPinned, Pencil, Save, ScrollText, WandSparkles } from "lucide-react";
import type {
  WorldBindingSupport,
  WorldStructuredData,
  WorldStructureSectionKey,
} from "@ai-novel/shared/types/world";
import type { WorldStructurePayload } from "@/api/world";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  HandbookField,
  HandbookPreviewCard,
  HandbookPreviewLine,
  HandbookTextarea,
} from "./handbook/HandbookPrimitives";
import WorldHandbookForceSection from "./handbook/WorldHandbookForceSection";
import WorldHandbookLocationSection from "./handbook/WorldHandbookLocationSection";
import WorldHandbookRuleSection from "./handbook/WorldHandbookRuleSection";
import WorldHandbookTensionSection from "./handbook/WorldHandbookTensionSection";

type EditableHandbookSection = "profile" | "rules" | "forces" | "locations" | "relations";

function compactText(value: string | null | undefined, fallback: string, limit = 120): string {
  const text = value?.replace(/\s+/g, " ").trim();
  if (!text) {
    return fallback;
  }
  return text.length > limit ? `${text.slice(0, limit)}...` : text;
}

function joinPreview(items: Array<string | null | undefined>, fallback: string): string {
  const text = items
    .map((item) => item?.replace(/\s+/g, " ").trim())
    .filter((item): item is string => Boolean(item))
    .slice(0, 3)
    .join(" / ");
  return text || fallback;
}

export default function WorldHandbookEditor(props: {
  initialPayload?: WorldStructurePayload;
  draft: Pick<WorldStructurePayload, "structure" | "bindingSupport"> | null;
  setDraft: Dispatch<SetStateAction<Pick<WorldStructurePayload, "structure" | "bindingSupport"> | null>>;
  savePending: boolean;
  backfillPending: boolean;
  generatePending: boolean;
  onSave: (structure: WorldStructuredData, bindingSupport: WorldBindingSupport) => Promise<void>;
  onBackfill: () => Promise<{ structure: WorldStructuredData; bindingSupport: WorldBindingSupport } | undefined>;
  onGenerate: (
    section: WorldStructureSectionKey,
    structure: WorldStructuredData,
    bindingSupport: WorldBindingSupport,
  ) => Promise<{ structure: WorldStructuredData; bindingSupport: WorldBindingSupport } | undefined>;
  onOpenDeepening: () => void;
  onOpenLayers: () => void;
  onOpenOverview: () => void;
  onOpenAdvanced: () => void;
}) {
  const {
    initialPayload, draft, setDraft,
    savePending,
    backfillPending,
    generatePending,
    onSave,
    onBackfill,
    onGenerate,
    onOpenDeepening,
    onOpenLayers,
    onOpenOverview,
    onOpenAdvanced,
  } = props;
  const draftStructure = draft?.structure ?? initialPayload?.structure;
  const draftBindingSupport = draft?.bindingSupport ?? initialPayload?.bindingSupport;
  const setDraftStructure: Dispatch<SetStateAction<WorldStructuredData | null>> = update => {
    setDraft(current => {
      const base = current ?? initialPayload;
      if (!base) return current;
      const structure = typeof update === "function" ? update(base.structure) : update;
      return structure ? { structure, bindingSupport: base.bindingSupport } : current;
    });
  };
  const [actionError, setActionError] = useState("");
  const [activeAiSection, setActiveAiSection] = useState<WorldStructureSectionKey>("profile");
  const [editingSection, setEditingSection] = useState<EditableHandbookSection | null>(null);

  if (!draftStructure || !draftBindingSupport) {
    return (
      <section className="flex min-h-56 flex-col items-center justify-center rounded-3xl bg-muted/20 px-6 text-center">
          {actionError ? <p role="alert" className="text-sm text-destructive">{actionError}</p> : null}
          <BookOpen className="h-6 w-6 text-muted-foreground/60" aria-hidden="true" />
          <div className="mt-3 font-medium">Leyendo el manual mundial</div>
          <div className="mt-1 text-sm leading-6 text-muted-foreground">Si es necesario, puedes dejar que AI organice las configuraciones existentes en un manual completo.</div>
          <Button
            className="mt-4 rounded-full"
            variant="outline"
            onClick={async () => {
              setActionError("");
              try {
                const result = await onBackfill();
                if (result) setDraft(result);
              } catch {
                setActionError("El acuerdo falló, inténtelo de nuevo.");
              }
            }}
            disabled={backfillPending}
          >
            {backfillPending ? "Organizando..." : "Deje que la IA resuelva el manual mundial"}
          </Button>
      </section>
    );
  }

  const saveDraft = async () => {
    setActionError("");
    try {
      await onSave(draftStructure, draftBindingSupport);
    } catch {
      setActionError("El manual no se pudo guardar. Las modificaciones se han conservado y se pueden guardar de nuevo.");
    }
  };

  const generateSection = async () => {
    setActionError("");
    try {
      const result = await onGenerate(activeAiSection, draftStructure, draftBindingSupport);
      if (result) setDraft(result);
    } catch {
      setActionError("Error de generación, el contenido del manual se ha conservado. Vuelva a intentarlo.");
    }
  };

  return (
    <fieldset disabled={savePending || generatePending} className="min-w-0 space-y-6">
        {actionError ? <p role="alert" className="text-sm text-destructive">{actionError}</p> : null}
        {draft ? <p role="status" className="text-sm text-muted-foreground">El manual tiene cambios sin guardar. Después de cambiar de etiqueta, puede regresar y continuar editando.</p> : null}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">Manual de organización del mundo</h2>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
              Primero confirme la impresión y las contradicciones centrales del mundo en los lectores, y luego organice las reglas, fuerzas, ubicaciones y tensiones del conflicto según sea necesario.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="ghost" className="rounded-full" onClick={onOpenOverview}>
              <BookOpen className="mr-2 h-4 w-4" aria-hidden="true" />
              ver manual
            </Button>
            <Button type="button" size="sm" className="rounded-full" onClick={saveDraft} disabled={savePending}>
              <Save className="mr-2 h-4 w-4" aria-hidden="true" />
              {savePending ? "Guardando..." : "Guardar manual"}
            </Button>
          </div>
        </div>
        <div className="rounded-3xl bg-muted/20 p-5 sm:p-6">
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary" className="border-0 bg-primary/[0.07] font-normal text-primary">Impresión mundial</Badge>
            {draftStructure.profile.tone ? <Badge variant="secondary" className="border-0 bg-muted/60 font-normal">{draftStructure.profile.tone}</Badge> : null}
            {draftStructure.profile.themes.slice(0, 4).map((theme) => (
              <Badge key={theme} variant="secondary" className="border-0 bg-muted/60 font-normal">
                {theme}
              </Badge>
            ))}
          </div>
          <div className="mt-4 grid gap-3 lg:grid-cols-[0.75fr_1.25fr]">
            <HandbookPreviewLine
              label="Impresión del mundo en una frase."
              value={draftStructure.profile.identity}
              fallback="Agregue una oración de impresión mundial para que el autor conozca el tema, el sentido de la época y las maravillas centrales de un vistazo."
            />
            <HandbookPreviewLine
              label="La primera mirada del lector"
              value={draftStructure.profile.summary}
              fallback="Complementa el primer vistazo, orden, peligro o maravilla del mundo."
            />
            <HandbookPreviewLine
              label="Temperamento de lectura"
              value={draftStructure.profile.tone || draftStructure.profile.themes.join(",")}
              fallback="Complemente el temperamento de lectura, como actualizaciones apasionadas, epopeyas oscuras, aventuras alegres o luchas de poder."
            />
            <HandbookPreviewLine
              label="Conflictos que siguen impulsando la trama"
              value={draftStructure.profile.coreConflict}
              fallback="Se agregó un problema que crea repetidamente selección de personajes, conflicto de facciones y eventos de capítulo."
            />
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="ghost" className="rounded-full" onClick={() => setEditingSection("profile")}>
              <Pencil className="mr-2 h-4 w-4" aria-hidden="true" />
              Organizar el resumen mundial
            </Button>
          </div>
          {editingSection === "profile" ? (
            <div className="mt-4 grid gap-3 lg:grid-cols-[0.8fr_1.4fr]">
            <div className="space-y-3">
              <HandbookField title="Impresión del mundo en una frase." hint="Permita que el autor y la IA conozcan el género, la era y las maravillas principales del mundo de un vistazo.">
                <Input
                  value={draftStructure.profile.identity}
                  onChange={(event) =>
                    setDraftStructure((prev) =>
                      prev ? { ...prev, profile: { ...prev.profile, identity: event.target.value } } : prev,
                    )
                  }
                  placeholder="Por ejemplo: la dinastía Xianxia con núcleos estelares agotados"
                />
              </HandbookField>
              <HandbookField title="Temperamento de lectura" hint="Decide si la historia será oscura, apasionada, alegre, maquiavélica o aventurera.">
                <Input
                  value={draftStructure.profile.tone}
                  onChange={(event) =>
                    setDraftStructure((prev) =>
                      prev ? { ...prev, profile: { ...prev.profile, tone: event.target.value } } : prev,
                    )
                  }
                  placeholder="Epopeya oscura, aventura ligera, lucha por el poder..."
                />
              </HandbookField>
              <HandbookField title="Palabras clave del tema" hint="Sepárelos con puntos para ayudar a mantener la misma dirección temática para personajes, ubicaciones y conflictos posteriores.">
                <Input
                  value={draftStructure.profile.themes.join(",")}
                  onChange={(event) =>
                    setDraftStructure((prev) =>
                      prev
                        ? {
                          ...prev,
                          profile: {
                            ...prev.profile,
                            themes: event.target.value.split(/[、,，]/).map((item) => item.trim()).filter(Boolean),
                          },
                        }
                        : prev,
                    )
                  }
                  placeholder="Venganza, cambio de dinastía, despertar del poder."
                />
              </HandbookField>
            </div>
            <div className="space-y-3">
              <HandbookField title="El mundo ofrece a los lectores el primer vistazo" hint="Escríbalo en párrafos cortos que el autor pueda volver a contar directamente. No es necesario dividirlo en campos geográficos, culturales e históricos.">
                <HandbookTextarea
                  value={draftStructure.profile.summary}
                  onChange={(value) =>
                    setDraftStructure((prev) => (prev ? { ...prev, profile: { ...prev.profile, summary: value } } : prev))
                  }
                  placeholder="Utilice un párrafo para que el autor sepa cómo es el mundo y dónde comenzará la historia."
                />
              </HandbookField>
              <HandbookField title="Conflictos que pueden seguir impulsando la trama" hint="Esta no es una introducción a los antecedentes, sino una pregunta recurrente sobre las acciones de los personajes, los conflictos de poder y los eventos del capítulo.">
                <HandbookTextarea
                  value={draftStructure.profile.coreConflict}
                  onChange={(value) =>
                    setDraftStructure((prev) =>
                      prev ? { ...prev, profile: { ...prev.profile, coreConflict: value } } : prev,
                    )
                  }
                  placeholder="Por ejemplo: el agotamiento del núcleo estelar hace que los practicantes compitan por la duración de la vida, la corte quiere sellar la verdad y los monstruos alienígenas de la frontera aprovechan la oportunidad para invadir."
                  minRows={3}
                />
              </HandbookField>
            </div>
            </div>
          ) : null}
        </div>

        <div className="rounded-2xl border border-border/35 bg-card/70 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-sm font-medium">Organización asistida por IA</div>
              <div className="mt-1 text-sm leading-6 text-muted-foreground">
                Deje que la IA complete un bloque manual basado en el contenido existente; puede continuar reescribiendo y luego guardando.
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {[
                { key: "profile", label: "Resumen del mundo" },
                { key: "rules", label: "Reglas" },
                { key: "factions", label: "Poder" },
                { key: "locations", label: "Ubicación" },
                { key: "relations", label: "Tensión" },
              ].map((item) => (
                <Button
                  key={item.key}
                  type="button"
                  size="sm"
                  variant={activeAiSection === item.key ? "default" : "ghost"}
                  className="rounded-full"
                  onClick={() => setActiveAiSection(item.key as WorldStructureSectionKey)}
                >
                  {item.label}
                </Button>
              ))}
              <Button type="button" size="sm" variant="secondary" className="rounded-full" onClick={generateSection} disabled={generatePending}>
                <WandSparkles className="mr-2 h-4 w-4" aria-hidden="true" />
                {generatePending ? "Completando..." : "Completa el bloque seleccionado"}
              </Button>
            </div>
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          <HandbookPreviewCard
            icon={ScrollText}
            title="Reglas esenciales"
            description={`${draftStructure.rules.axioms.length} Las reglas limitan el poder, los recursos, los tabúes y los costos.`}
            action={
              <Button type="button" size="sm" variant="outline" onClick={() => setEditingSection("rules")}>
                organizar reglas
              </Button>
            }
          >
            <div className="space-y-3">
              <HandbookPreviewLine
                label="Reglas generales"
                value={draftStructure.rules.summary}
                fallback="Complementa las reglas estrictas sobre cómo funciona el mundo para evitar que las habilidades de los personajes y las soluciones de la trama se salgan de control."
              />
              <HandbookPreviewLine
                label="Regla representativa"
                value={joinPreview(
                  draftStructure.rules.axioms.map((rule) => [rule.name, rule.summary].filter(Boolean).join(":")),
                  "Agregue 2 o 3 reglas básicas adicionales que deben seguirse.",
                )}
                fallback="Agregue 2 o 3 reglas básicas adicionales que deben seguirse."
              />
            </div>
          </HandbookPreviewCard>

          <HandbookPreviewCard
            icon={Castle}
            title="Facciones principales"
            description={`${draftStructure.forces.length} Cada fuerza determina la afiliación de los personajes, la presión del campamento y la competencia por los recursos.`}
            action={
              <Button type="button" size="sm" variant="outline" onClick={() => setEditingSection("forces")}>
                organizar fuerzas
              </Button>
            }
          >
            <div className="space-y-3">
              <HandbookPreviewLine
                label="Fuerzas activas"
                value={joinPreview(
                  draftStructure.forces.map((force) => [force.name, force.currentObjective].filter(Boolean).join(":")),
                  "Una vez que se complementen las fuerzas principales, las identidades de los personajes y los conflictos de los campos se volverán más claros.",
                )}
                fallback="Una vez que se complementen las fuerzas principales, las identidades de los personajes y los conflictos de los campos se volverán más claros."
              />
              <HandbookPreviewLine
                label="Presión de la historia"
                value={joinPreview(
                  draftStructure.forces.map((force) => force.pressure),
                  "La presión que fuerzas suplementarias ejercen sobre el protagonista y el orden mundial.",
                )}
                fallback="La presión que fuerzas suplementarias ejercen sobre el protagonista y el orden mundial."
              />
            </div>
          </HandbookPreviewCard>

          <HandbookPreviewCard
            icon={MapPinned}
            title="Escenario de la historia"
            description={`${draftStructure.locations.length} Cada ubicación alberga aperturas, mejoras, transiciones, batallas finales y recursos de mapas.`}
            action={
              <Button type="button" size="sm" variant="outline" onClick={() => setEditingSection("locations")}>
                organizar el lugar
              </Button>
            }
          >
            <div className="space-y-3">
              <HandbookPreviewLine
                label="Ubicaciones disponibles"
                value={joinPreview(
                  draftStructure.locations.map((location) =>
                    [location.name, location.narrativeFunction || location.terrain].filter(Boolean).join(":"),
                  ),
                  "Lugar de inicio complementario, lugar de juicio, lugar de conflicto o lugar de verdad.",
                )}
                fallback="Lugar de inicio complementario, lugar de juicio, lugar de conflicto o lugar de verdad."
              />
              <HandbookPreviewLine
                label="Riesgo de entrada"
                value={joinPreview(
                  draftStructure.locations.map((location) => location.risk),
                  "Complemente la resistencia, los costos o los riesgos de identidad asociados con el ingreso a una ubicación.",
                )}
                fallback="Complemente la resistencia, los costos o los riesgos de identidad asociados con el ingreso a una ubicación."
              />
            </div>
          </HandbookPreviewCard>

          <HandbookPreviewCard
            icon={GitBranch}
            title="Tensión del conflicto"
            description="Documentar las relaciones de poder, los controles de ubicación, las consecuencias compartidas y las combinaciones de tabúes ayuda a que el mundo siga siendo escribible."
            action={
              <Button type="button" size="sm" variant="outline" onClick={() => setEditingSection("relations")}>
                tensión de acabado
              </Button>
            }
          >
            <div className="space-y-3">
              <HandbookPreviewLine
                label="Relaciones de poder"
                value={joinPreview(
                  draftStructure.relations.forceRelations.map((relation) =>
                    [relation.relation, relation.tension || relation.detail].filter(Boolean).join(":"),
                  ),
                  "Complementar a quién es aliado, hostil, competidor o explotador de quién.",
                )}
                fallback="Complementar a quién es aliado, hostil, competidor o explotador de quién."
              />
              <HandbookPreviewLine
                label="Consecuencias comunes"
                value={joinPreview(
                  draftStructure.rules.sharedConsequences,
                  "Complemente las consecuencias de romper las reglas o intensificar los conflictos que afectarán la situación general.",
                )}
                fallback="Complemente las consecuencias de romper las reglas o intensificar los conflictos que afectarán la situación general."
              />
            </div>
          </HandbookPreviewCard>
        </div>

        {editingSection ? (
          <div className="rounded-2xl bg-primary/[0.055] p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <AlertTriangle className="h-4 w-4 text-primary" aria-hidden="true" />
                Los bloques seleccionados se están ordenando y la descripción general del manual anterior se actualizará después de guardarlos.
              </div>
              <Button type="button" size="sm" variant="ghost" className="rounded-full" onClick={() => setEditingSection(null)}>
                Colapso
              </Button>
            </div>
          </div>
        ) : null}

        {editingSection === "rules" ? (
          <WorldHandbookRuleSection draftStructure={draftStructure} setDraftStructure={setDraftStructure} />
        ) : null}
        {editingSection === "forces" ? (
          <WorldHandbookForceSection draftStructure={draftStructure} setDraftStructure={setDraftStructure} />
        ) : null}
        {editingSection === "locations" ? (
          <WorldHandbookLocationSection draftStructure={draftStructure} setDraftStructure={setDraftStructure} />
        ) : null}
        {editingSection === "relations" ? (
          <WorldHandbookTensionSection
            draftStructure={draftStructure}
            setDraftStructure={setDraftStructure}
            onOpenDeepening={onOpenDeepening}
            onOpenLayers={onOpenLayers}
            onOpenAdvanced={onOpenAdvanced}
          />
        ) : null}
    </fieldset>
  );
}
