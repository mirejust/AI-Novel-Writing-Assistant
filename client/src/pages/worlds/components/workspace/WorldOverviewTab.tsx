import {
  BookOpen,
  Castle,
  Clock3,
  GitBranch,
  Map,
  MapPinned,
  Network,
  Pencil,
  ShieldAlert,
  Sparkles,
  WandSparkles,
  Workflow,
} from "lucide-react";
import type { WorldStructuredData, WorldVisualizationPayload } from "@ai-novel/shared/types/world";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { featureFlags } from "@/config/featureFlags";
import WorldVisualizationBoard from "../WorldVisualizationBoard";

interface WorldOverviewTabProps {
  summary?: string;
  sections: Array<{ key: string; title: string; content: string }>;
  structure?: WorldStructuredData;
  visualization?: WorldVisualizationPayload;
  onOpenStructure?: () => void;
  onOpenLayers?: () => void;
}

function compactText(value: string | null | undefined, fallback: string, limit = 120) {
  const text = value?.replace(/\s+/g, " ").trim();
  if (!text) {
    return fallback;
  }
  return text.length > limit ? `${text.slice(0, limit)}...` : text;
}

function listText(items: Array<string | null | undefined>, fallback: string, limit = 3) {
  const visible = items.map((item) => compactText(item, "", 96)).filter(Boolean).slice(0, limit);
  return visible.length > 0 ? visible : [fallback];
}

function HandbookBlock({
  icon: Icon,
  title,
  items,
  accent = "default",
}: {
  icon: typeof BookOpen;
  title: string;
  items: string[];
  accent?: "default" | "primary";
}) {
  return (
    <div className={accent === "primary" ? "rounded-2xl bg-primary/[0.055] p-4" : "rounded-2xl bg-muted/20 p-4"}>
      <div className="flex items-center gap-2 text-sm font-medium">
        <Icon className="h-4 w-4 text-primary" aria-hidden="true" />
        {title}
      </div>
      <div className="mt-2 space-y-2 text-sm leading-6 text-muted-foreground">
        {items.map((item) => (
          <div key={item} className="line-clamp-3">
            {item}
          </div>
        ))}
      </div>
    </div>
  );
}

function EmptyHandbookBlock({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof BookOpen;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-border/45 bg-background/70 p-4">
      <div className="flex items-center gap-2 text-sm font-medium">
        <Icon className="h-4 w-4 text-primary" aria-hidden="true" />
        {title}
      </div>
      <div className="mt-2 text-sm leading-6 text-muted-foreground">{description}</div>
    </div>
  );
}

function WorldAssetPreviewBlock({
  icon: Icon,
  title,
  description,
  status,
}: {
  icon: typeof BookOpen;
  title: string;
  description: string;
  status: string;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-border/45 bg-background/70 p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Icon className="h-4 w-4 text-primary" aria-hidden="true" />
          {title}
        </div>
        <Badge variant="secondary" className="border-0 bg-muted/60 font-normal">{status}</Badge>
      </div>
      <div className="mt-2 text-xs leading-5 text-muted-foreground">{description}</div>
    </div>
  );
}

export default function WorldOverviewTab(props: WorldOverviewTabProps) {
  const { summary, sections, structure, visualization, onOpenStructure, onOpenLayers } = props;
  const profile = structure?.profile;
  const hasHandbook = Boolean(structure);
  const worldPromise = compactText(
    profile?.identity || profile?.summary,
    summary ?? "Después de completar el manual mundial, se formará una muestra del mundo que se puede reutilizar en novelas.",
    120,
  );
  const coreRules = listText(
    structure?.rules?.axioms.map((rule) => [rule.name, rule.summary].filter(Boolean).join(":")) ?? [],
    "Ingresa al manual para editar y complementar las reglas que se deben seguir en este mundo.",
  );
  const majorForces = listText(
    [
      ...(structure?.forces ?? []).map((force) => [force.name, force.summary || force.currentObjective].filter(Boolean).join(":")),
      ...(structure?.factions ?? []).map((faction) => [faction.name, faction.position || faction.doctrine].filter(Boolean).join(":")),
    ],
    "Ingresando al manual para editar y complementar las fuerzas y campamentos que impulsarán la trama.",
  );
  const storyLocations = listText(
    structure?.locations.map((location) =>
      [location.name, location.narrativeFunction || location.risk || location.summary].filter(Boolean).join(":"),
    ) ?? [],
    "Ingrese al manual para editar y agregar ubicaciones de historias adecuadas para el inicio, las actualizaciones y las transiciones.",
  );
  const tensions = listText(
    [
      profile?.coreConflict,
      ...(structure?.relations.forceRelations ?? []).map((relation) =>
        [relation.relation, relation.tension || relation.detail].filter(Boolean).join(":"),
      ),
      ...(structure?.rules.sharedConsequences ?? []),
    ],
    "Ingrese al manual para editar y agregar conflictos mundiales que pueden seguir creando presión en la trama.",
  );

  return (
    <section className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">{featureFlags.worldVisEnabled ? "Leyendo el mundo y el mapa." : "Lectura del manual mundial"}</h2>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">Comprenda los compromisos del mundo, los límites de las reglas, las fuerzas principales y las etapas de la historia desde la perspectiva del lector.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="secondary" className="rounded-full" onClick={onOpenStructure}>
              <Pencil className="mr-2 h-4 w-4" aria-hidden="true" />
              Manual de edición
            </Button>
            <Button type="button" size="sm" variant="ghost" className="rounded-full" onClick={onOpenLayers}>
              <WandSparkles className="mr-2 h-4 w-4" aria-hidden="true" />
              construcción de IA
            </Button>
          </div>
        </div>
        {hasHandbook ? (
          <>
            <div className="grid gap-4 lg:grid-cols-[1.4fr_0.8fr]">
              <div className="rounded-3xl bg-muted/20 p-5 sm:p-6">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary" className="border-0 bg-primary/[0.07] font-normal text-primary">Muestra mundial</Badge>
                  {profile?.tone ? <Badge variant="secondary" className="border-0 bg-muted/60 font-normal">{profile.tone}</Badge> : null}
                  {profile?.themes?.slice(0, 4).map((theme) => (
                    <Badge key={theme} variant="secondary" className="border-0 bg-muted/60 font-normal">
                      {theme}
                    </Badge>
                  ))}
                </div>
                <div className="mt-3 text-lg font-semibold leading-7">
                  {worldPromise}
                </div>
                <div className="mt-2 text-sm leading-6 text-muted-foreground">
                  {compactText(profile?.summary, summary ?? "Agregue un resumen del mundo que los creadores puedan comprender rápidamente.", 180)}
                </div>
                <div className="mt-3 text-sm leading-6">
                  {compactText(profile?.coreConflict, "Al complementar el conflicto central, el sistema transformará más fácilmente el mundo en una presión constante para impulsar la trama.", 160)}
                </div>
              </div>

              <div className="rounded-3xl border border-border/35 bg-card/70 p-5">
                <div className="text-sm font-medium">Disponible como muestra mundial</div>
                <div className="mt-3 space-y-2 text-sm leading-6 text-muted-foreground">
                  <div>Límites de identidad de los personajes, afiliaciones de poder y combinaciones de tabúes.</div>
                  <div>Ubicación inicial, rutas de actualización y fuentes de conflicto.</div>
                  <div>Reglas a seguir al escribir.</div>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-x-7 gap-y-2 px-1 text-sm text-muted-foreground">
              <span><strong className="font-semibold tabular-nums text-foreground">{structure?.rules.axioms.length ?? 0}</strong> Reglas básicas</span>
              <span><strong className="font-semibold tabular-nums text-foreground">{(structure?.forces.length ?? 0) + (structure?.factions.length ?? 0)}</strong> Fuerzas y campamentos</span>
              <span><strong className="font-semibold tabular-nums text-foreground">{structure?.locations.length ?? 0}</strong> Ubicación de la historia</span>
              <span><strong className="font-semibold tabular-nums text-foreground">{(structure?.relations.forceRelations.length ?? 0) + (structure?.relations.locationControls.length ?? 0)}</strong> Pistas de relación</span>
            </div>

            <div className="grid gap-3 lg:grid-cols-2">
              <HandbookBlock icon={Sparkles} title="Poder y reglas" items={coreRules} accent="primary" />
              <HandbookBlock icon={Castle} title="Facciones principales" items={majorForces} />
              <HandbookBlock icon={MapPinned} title="Escenario de la historia" items={storyLocations} />
              <HandbookBlock icon={GitBranch} title="Tensión crítica" items={tensions} />
            </div>

            <HandbookBlock
              icon={ShieldAlert}
              title="Cuando utilice este libro, siga las"
              items={[
                compactText(structure?.rules.summary, "Las reglas básicas gobiernan la identidad de los personajes, las fuentes de conflicto y la coherencia del mundo.", 150),
                ...listText(structure?.rules.taboo ?? [], "No se registraron combinaciones prohibidas. Cuando se necesiten restricciones fuertes, se agregarán en la revisión manual.", 2),
              ]}
            />
          </>
        ) : (
          <div className="space-y-4">
            <div className="grid gap-4 lg:grid-cols-[1.35fr_0.85fr]">
              <div className="rounded-3xl bg-muted/20 p-5">
                <Badge variant="secondary" className="border-0 bg-primary/[0.07] font-normal text-primary">El manual mundial está listo para tomar forma</Badge>
                <div className="mt-3 text-lg font-semibold leading-7">
                  {compactText(summary, "Deje que la IA o el editor manual organicen primero el esqueleto del mundo y luego utilícelo como una muestra del mundo reutilizable.", 160)}
                </div>
                <div className="mt-2 text-sm leading-6 text-muted-foreground">
                  El Manual Mundial organizará escenarios dispersos en reglas, fuerzas, ubicaciones y presiones de la trama para facilitar la comprensión y el uso de este libro por parte del autor.
                </div>
              </div>

              <div className="rounded-3xl border border-border/35 bg-card/70 p-5">
                <div className="text-sm font-medium">Sugerir próximos pasos</div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button type="button" size="sm" onClick={onOpenLayers}>
                    <WandSparkles className="mr-2 h-4 w-4" aria-hidden="true" />
                    La IA construye el mundo
                  </Button>
                  <Button type="button" size="sm" variant="outline" onClick={onOpenStructure}>
                    <Pencil className="mr-2 h-4 w-4" aria-hidden="true" />
                    Manual de edición
                  </Button>
                </div>
              </div>
            </div>

            <div className="grid gap-3 lg:grid-cols-2">
              <EmptyHandbookBlock icon={Sparkles} title="Poder y reglas" description="Registre las reglas subyacentes, los costos y las combinaciones de tabúes que no se pueden romper casualmente en el mundo." />
              <EmptyHandbookBlock icon={Castle} title="Facciones principales" description="Organiza las organizaciones, facciones, grupos de interés y fuentes de presión que impulsarán la trama." />
              <EmptyHandbookBlock icon={MapPinned} title="Escenario de la historia" description="Marque los lugares clave donde se producen aperturas, escaladas, conflictos y transiciones." />
              <EmptyHandbookBlock icon={GitBranch} title="Tensión crítica" description="Precipitar conflictos de recursos, conflictos de campamentos y costos de reglas que pueden crear conflictos repetidamente." />
            </div>

            {sections.length > 0 ? (
              <div className="rounded-3xl border border-border/35 p-4">
                <div className="mb-2 text-sm font-medium">Ya tengo un fragmento de conjunto</div>
                <div className="grid gap-3 lg:grid-cols-2">
                  {sections.map((section) => (
                    <div key={section.key} className="rounded-2xl bg-muted/20 p-4 text-sm">
                      <div className="mb-1 font-medium">{section.title}</div>
                      <div className="line-clamp-4 whitespace-pre-wrap text-muted-foreground">{section.content}</div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        )}
        {featureFlags.worldVisEnabled ? (
          <WorldVisualizationBoard payload={visualization} />
        ) : (
          <div className="rounded-3xl border border-border/35 p-5">
            <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <Map className="h-4 w-4 text-primary" aria-hidden="true" />
                  Portal Mundial de Activos
                </div>
                <div className="mt-1 text-sm leading-6 text-muted-foreground">
                  Los mapas y atlas son activos visuales del Manual Mundial y no participan en la cobertura de sincronización automática, ni reemplazan la fuente de las reglas del Manual Mundial.
                </div>
              </div>
              <Badge variant="secondary" className="border-0 bg-muted/60 font-normal">Entrada reservada</Badge>
            </div>
            <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <WorldAssetPreviewBlock
                icon={MapPinned}
                title="Mapa del mundo"
                description="Área de transporte, conexión de ubicación, lugar de la historia y calor del conflicto."
                status={(structure?.locations.length ?? 0) > 0 ? "Organizable" : "Ubicación a llenar"}
              />
              <WorldAssetPreviewBlock
                icon={Network}
                title="Mapa de poder"
                description="Llevando nodos de poder, aliados y enemigos, controla las relaciones y el equilibrio de poder."
                status={(structure?.forces.length ?? 0) + (structure?.factions.length ?? 0) > 0 ? "Organizable" : "Fuerzas por llenar"}
              />
              <WorldAssetPreviewBlock
                icon={Clock3}
                title="Línea de tiempo mundial"
                description="Llevando acontecimientos históricos, cambios de situación y avances mundiales a medida que avanza la novela."
                status={profile?.coreConflict ? "Organizable" : "Tensión a compensar"}
              />
              <WorldAssetPreviewBlock
                icon={Workflow}
                title="Árbol del sistema de energía"
                description="Llevando niveles, recursos, costos, tabúes y rompiendo fronteras."
                status={(structure?.rules.axioms.length ?? 0) > 0 ? "Organizable" : "Reglas a agregar"}
              />
            </div>
          </div>
        )}
    </section>
  );
}
