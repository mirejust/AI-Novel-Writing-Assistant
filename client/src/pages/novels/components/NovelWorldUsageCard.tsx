import { useEffect, useMemo, useState } from "react";
import { Castle, MapPinned, ShieldAlert, SlidersHorizontal } from "lucide-react";
import type { StoryWorldSliceOverrides, StoryWorldSliceView } from "@ai-novel/shared/types/storyWorldSlice";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DetailDisclosure } from "./workspaceShell";

export interface NovelWorldUsageCardProps {
  view?: StoryWorldSliceView | null;
  message: string;
  isRefreshing: boolean;
  isSaving: boolean;
  onRefresh: () => void;
  onSave: (patch: StoryWorldSliceOverrides) => void;
}

export interface NovelWorldUsageDraftState {
  primaryLocationId: string;
  setPrimaryLocationId: (value: string) => void;
  requiredForceIds: string[];
  setRequiredForceIds: (updater: (prev: string[]) => string[]) => void;
  requiredLocationIds: string[];
  setRequiredLocationIds: (updater: (prev: string[]) => string[]) => void;
  requiredRuleIds: string[];
  setRequiredRuleIds: (updater: (prev: string[]) => string[]) => void;
  scopeNote: string;
  setScopeNote: (value: string) => void;
  savePayload: StoryWorldSliceOverrides;
}

function toggleId(ids: string[], id: string, checked: boolean): string[] {
  const set = new Set(ids);
  if (checked) {
    set.add(id);
  } else {
    set.delete(id);
  }
  return Array.from(set);
}

function labelStoryInputSource(source: string | null | undefined): string {
  switch (source) {
    case "explicit":
      return "Esta vez, ideas de historias provenientes de tu entrada manual.";
    case "story_macro":
      return "Ideas de historias del plan macro de la historia.";
    case "novel_description":
      return "De la introducción a la novela.";
    default:
      return "Sin datos";
  }
}

function namesLine(items: Array<{ name: string }>, fallback: string): string {
  if (!items.length) {
    return fallback;
  }
  return items.slice(0, 3).map((item) => item.name).join(" · ");
}

function findPrimaryLocation(view: StoryWorldSliceView | null | undefined, primaryLocationId: string): string {
  if (primaryLocationId === "__none__") {
    return view?.slice?.activeLocations[0]?.name ?? "No especificado";
  }
  return view?.availableLocations.find((item) => item.id === primaryLocationId)?.name ?? "No especificado";
}

function MetricItem(props: { label: string; value: string; detail: string }) {
  return (
    <div className="min-w-0">
      <div className="text-xs text-muted-foreground">{props.label}</div>
      <div className="mt-1 truncate text-sm font-semibold text-foreground">{props.value}</div>
      <div className="mt-1 line-clamp-1 text-xs text-muted-foreground">{props.detail}</div>
    </div>
  );
}

function OverrideGroup({
  icon: Icon,
  title,
  description,
  emptyText,
  items,
  selectedIds,
  onToggle,
}: {
  icon: typeof Castle;
  title: string;
  description: string;
  emptyText: string;
  items: Array<{ id: string; name: string; summary: string }>;
  selectedIds: string[];
  onToggle: (id: string, checked: boolean) => void;
}) {
  return (
    <div className="border-t border-border/60 pt-4">
      <div className="flex items-start gap-2">
        <Icon className="mt-0.5 h-4 w-4 text-primary" aria-hidden="true" />
        <div>
          <div className="text-sm font-medium text-foreground">{title}</div>
          <div className="mt-1 text-xs leading-5 text-muted-foreground">{description}</div>
        </div>
      </div>
      <div className="mt-3 grid gap-2">
        {items.length ? items.map((item) => (
          <label key={item.id} className="flex items-start gap-3 rounded-md bg-muted/20 px-3 py-2 text-sm">
            <input
              type="checkbox"
              checked={selectedIds.includes(item.id)}
              onChange={(event) => onToggle(item.id, event.target.checked)}
              className="mt-1"
            />
            <span>
              <span className="block font-medium text-foreground">{item.name}</span>
              <span className="block leading-6 text-muted-foreground">{item.summary}</span>
            </span>
          </label>
        )) : <div className="text-sm text-muted-foreground">{emptyText}</div>}
      </div>
    </div>
  );
}

export function useNovelWorldUsageDraft(props: NovelWorldUsageCardProps): NovelWorldUsageDraftState {
  const [primaryLocationId, setPrimaryLocationId] = useState<string>("__none__");
  const [requiredForceIds, setRequiredForceIds] = useState<string[]>([]);
  const [requiredLocationIds, setRequiredLocationIds] = useState<string[]>([]);
  const [requiredRuleIds, setRequiredRuleIds] = useState<string[]>([]);
  const [scopeNote, setScopeNote] = useState("");

  useEffect(() => {
    setPrimaryLocationId(props.view?.overrides.primaryLocationId ?? "__none__");
    setRequiredForceIds(props.view?.overrides.requiredForceIds ?? []);
    setRequiredLocationIds(props.view?.overrides.requiredLocationIds ?? []);
    setRequiredRuleIds(props.view?.overrides.requiredRuleIds ?? []);
    setScopeNote(props.view?.overrides.scopeNote ?? "");
  }, [props.view]);

  const savePayload = useMemo<StoryWorldSliceOverrides>(() => ({
    primaryLocationId: primaryLocationId === "__none__" ? null : primaryLocationId,
    requiredForceIds,
    requiredLocationIds,
    requiredRuleIds,
    scopeNote: scopeNote.trim() || null,
  }), [primaryLocationId, requiredForceIds, requiredLocationIds, requiredRuleIds, scopeNote]);

  return {
    primaryLocationId,
    setPrimaryLocationId,
    requiredForceIds,
    setRequiredForceIds,
    requiredLocationIds,
    setRequiredLocationIds,
    requiredRuleIds,
    setRequiredRuleIds,
    scopeNote,
    setScopeNote,
    savePayload,
  };
}

export function NovelWorldUsageSummary(props: NovelWorldUsageCardProps & {
  draft: NovelWorldUsageDraftState;
  onOpenDetails?: () => void;
}) {
  const slice = props.view?.slice ?? null;
  const hasWorld = props.view?.hasWorld ?? false;
  const primaryLocation = findPrimaryLocation(props.view, props.draft.primaryLocationId);
  const boundaryText = props.draft.scopeNote.trim() || slice?.storyScopeBoundary || "Después de ordenar, se generarán los límites de uso de este libro.";
  const canSave = hasWorld && Boolean(props.view);

  return (
    <section id="novel-world-usage" className="rounded-2xl bg-background/80 p-4 shadow-sm ring-1 ring-border/35">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" />
            Alcance de uso de generación de capítulos
          </div>
          <div className="mt-2 text-sm leading-6 text-muted-foreground">
            {slice
              ? "Estas reglas, fuerzas y ubicaciones se priorizan en la generación de personajes, esquemas y capítulos."
              : hasWorld
                ? "Primero, clasifique el alcance mundial que realmente se utilizará en este libro para evitar leer demasiadas configuraciones irrelevantes en la generación de capítulos."
                : "Primero cree o importe el mundo de este libro y luego organice el rango que se leerá."}
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={props.onRefresh} disabled={!hasWorld || props.isRefreshing}>
            {props.isRefreshing ? "Organizando..." : "Organizar el ámbito de uso de este libro."}
          </Button>
          <Button type="button" variant="ghost" onClick={props.onOpenDetails} disabled={!hasWorld}>
            <SlidersHorizontal className="size-4" />
            Ajustar reservas
          </Button>
        </div>
      </div>

      {props.message ? (
        <div className="mt-3 rounded-md bg-muted/25 px-3 py-2 text-sm text-muted-foreground">
          {props.message}
        </div>
      ) : null}

      <div className="mt-4 grid gap-4 md:grid-cols-4">
        <MetricItem label="Escenario principal" value={primaryLocation} detail={props.view?.worldName ?? "Esperando el mundo del libro"} />
        <MetricItem
          label="Fuerzas activas"
          value={`${slice?.activeForces.length ?? 0} un`}
          detail={namesLine(slice?.activeForces ?? [], "Mostrar después de ordenar")}
        />
        <MetricItem
          label="Ubicación de la historia"
          value={`${slice?.activeLocations.length ?? 0} en`}
          detail={namesLine(slice?.activeLocations ?? [], "Mostrar después de ordenar")}
        />
        <MetricItem
          label="Reglas duras"
          value={`${slice?.appliedRules.length ?? 0} Artículo`}
          detail={namesLine(slice?.appliedRules ?? [], "Mostrar después de ordenar")}
        />
      </div>

      <div className="mt-4 flex flex-col gap-3 border-t border-border/50 pt-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0 text-sm leading-6 text-muted-foreground">
          <span className="font-medium text-foreground">Límite:</span>
          <span className="line-clamp-2">{boundaryText}</span>
        </div>
        <Button
          type="button"
          size="sm"
          disabled={!canSave || props.isSaving}
          onClick={() => props.onSave(props.draft.savePayload)}
        >
          {props.isSaving ? "Guardando..." : "Guardar artículos reservados"}
        </Button>
      </div>
    </section>
  );
}

export function NovelWorldUsageDetails(props: NovelWorldUsageCardProps & {
  draft: NovelWorldUsageDraftState;
}) {
  const slice = props.view?.slice ?? null;
  const hasWorld = props.view?.hasWorld ?? false;
  const hasSlice = Boolean(slice);
  const canSave = hasWorld && Boolean(props.view);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="text-lg font-semibold text-foreground">Generar alcance de uso</div>
          <div className="mt-1 text-sm leading-6 text-muted-foreground">
            Esto confirma las reglas, fuerzas y ubicaciones que realmente cargará la generación de capítulos. Puede especificar solo unos pocos elementos que deben conservarse y dejar que el sistema corte el resto según la dirección del libro.
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={props.onRefresh} disabled={!hasWorld || props.isRefreshing}>
            {props.isRefreshing ? "Organizando..." : "Reorganizar el alcance de uso"}
          </Button>
          <Button type="button" onClick={() => props.onSave(props.draft.savePayload)} disabled={!canSave || props.isSaving}>
            {props.isSaving ? "Guardando..." : "Guardar artículos reservados"}
          </Button>
        </div>
      </div>

      {props.message ? (
        <div className="rounded-md bg-muted/25 px-3 py-2 text-sm text-muted-foreground">
          {props.message}
        </div>
      ) : null}

      {!hasWorld ? (
        <div className="rounded-md border border-dashed border-border/70 px-4 py-4 text-sm leading-6 text-muted-foreground">
          Esta novela aún no tiene un mundo de libros. Primero impórtalo de la biblioteca mundial o genera un mundo basado en el tema de este libro, y luego organiza las reglas, fuerzas y ubicaciones que se utilizarán en la historia actual.
        </div>
      ) : null}

      {hasWorld ? (
        <div className="grid gap-4 md:grid-cols-2">
          <MetricItem label="Mundo del libro" value={props.view?.worldName ?? "Mundo sin nombre"} detail="La generación de capítulos lee una copia mundial del libro." />
          <MetricItem label="Fuente de ideas para historias." value={labelStoryInputSource(props.view?.storyInputSource)} detail="El rango de uso se adapta a la dirección actual de la historia." />
        </div>
      ) : null}

      {slice ? (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(360px,0.95fr)]">
          <section className="space-y-5">
            <div>
              <div className="text-sm font-medium text-foreground">Fondo mundial</div>
              <div className="mt-1 text-sm leading-6 text-muted-foreground">{slice.coreWorldFrame || "Sin datos"}</div>
            </div>
            <div>
              <div className="text-sm font-medium text-foreground">Organizaciones que se utilizarán</div>
              <div className="mt-2 text-sm leading-6 text-muted-foreground">
                {namesLine(slice.activeForces, "Sin datos")}
              </div>
            </div>
            <div>
              <div className="text-sm font-medium text-foreground">Ubicaciones que se utilizarán</div>
              <div className="mt-2 text-sm leading-6 text-muted-foreground">
                {namesLine(slice.activeLocations, "Sin datos")}
              </div>
            </div>
            <div>
              <div className="text-sm font-medium text-foreground">Reglas esenciales</div>
              <div className="mt-2 space-y-3">
                {slice.appliedRules.length > 0 ? slice.appliedRules.map((item) => (
                  <div key={item.id} className="border-t border-border/50 pt-3 text-sm">
                    <div className="font-medium text-foreground">{item.name}</div>
                    <div className="mt-1 leading-6 text-muted-foreground">{item.summary}</div>
                  </div>
                )) : <div className="text-sm text-muted-foreground">Sin datos</div>}
              </div>
            </div>
            <div>
              <div className="text-sm font-medium text-foreground">Fuente de estrés</div>
              <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                {slice.pressureSources.length > 0 ? slice.pressureSources.map((item) => (
                  <div key={item}>{item}</div>
                )) : <div>Sin datos</div>}
              </div>
            </div>
            <div>
              <div className="text-sm font-medium text-foreground">Límites que no deben cruzarse</div>
              <div className="mt-1 text-sm leading-6 text-muted-foreground">{slice.storyScopeBoundary || "Sin datos"}</div>
            </div>
          </section>

          <section className="space-y-4 rounded-xl bg-muted/15 p-4">
            <div>
              <div className="text-sm font-medium text-foreground">Reserva manual</div>
              <div className="mt-1 text-sm leading-6 text-muted-foreground">
                Aquí solo se especifica una pequeña cantidad de contenido que debe aparecer o respetarse. No hay necesidad de recargar el mundo entero.
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">Escenario principal</label>
              <Select value={props.draft.primaryLocationId} onValueChange={props.draft.setPrimaryLocationId}>
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder="Por favor seleccione el escenario principal" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Sin especificaciones adicionales</SelectItem>
                  {props.view?.availableLocations.map((item) => (
                    <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <DetailDisclosure title="Organizaciones, lugares y reglas que deben preservarse" description="Adecuado para ubicaciones iniciales, aliados clave, enemigos importantes y el costo de la fuerza que no se puede superar.">
              <div className="space-y-4">
                <OverrideGroup
                  icon={Castle}
                  title="Organizaciones que deben conservarse"
                  description="El origen del protagonista, los principales enemigos y los aliados clave son fuerzas que no pueden pasarse por alto en la etapa inicial."
                  emptyText="Aún no existen organizaciones opcionales en el mundo de este libro."
                  items={props.view?.availableForces ?? []}
                  selectedIds={props.draft.requiredForceIds}
                  onToggle={(id, checked) => props.draft.setRequiredForceIds((prev) => toggleId(prev, id, checked))}
                />
                <OverrideGroup
                  icon={MapPinned}
                  title="Lugares que deben reservarse"
                  description="El punto de partida, el lugar del juicio, el lugar donde estalla el conflicto y el escenario que los lectores necesitan recordar una y otra vez."
                  emptyText="Aún no hay ubicaciones opcionales en el mundo de este libro."
                  items={props.view?.availableLocations ?? []}
                  selectedIds={props.draft.requiredLocationIds}
                  onToggle={(id, checked) => props.draft.setRequiredLocationIds((prev) => toggleId(prev, id, checked))}
                />
                <OverrideGroup
                  icon={ShieldAlert}
                  title="Reglas que se deben seguir"
                  description="El precio del poder, los tabúes identitarios y las fronteras que la trama no puede traspasar."
                  emptyText="Todavía no existen reglas opcionales en el mundo de este libro."
                  items={props.view?.availableRules ?? []}
                  selectedIds={props.draft.requiredRuleIds}
                  onToggle={(id, checked) => props.draft.setRequiredRuleIds((prev) => toggleId(prev, id, checked))}
                />
              </div>
            </DetailDisclosure>

            <div>
              <label className="text-sm font-medium text-foreground" htmlFor="story-world-scope-note">
                Instrucciones sobre los límites para no cruzar la línea en la etapa inicial
              </label>
              <div className="mt-1 text-sm leading-6 text-muted-foreground">
                Puede agregar un límite, como "Mantenga la base urbana realista y no la convierta en una novela de fantasía mejorada".
              </div>
              <textarea
                id="story-world-scope-note"
                value={props.draft.scopeNote}
                onChange={(event) => props.draft.setScopeNote(event.target.value)}
                rows={4}
                className="mt-2 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none ring-offset-background placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
                placeholder="Por ejemplo: conservar el entorno empresarial realista y la opresión del carácter de la obra original, y no introducir un sistema sobrenatural."
              />
            </div>
          </section>
        </div>
      ) : null}

      {hasWorld && !hasSlice ? (
        <div className="rounded-md border border-dashed border-border/70 px-4 py-4 text-sm leading-6 text-muted-foreground">
          El libro aún no ha determinado el alcance del mundo que utilizará la historia actual. Después de hacer clic en "Organizar el alcance de uso de este libro", se generará una versión confirmable de las reglas, fuerzas y alcance de la ubicación en función del mundo del libro y las ideas de la historia.
        </div>
      ) : null}
    </div>
  );
}

export default function NovelWorldUsageCard(props: NovelWorldUsageCardProps) {
  const draft = useNovelWorldUsageDraft(props);

  return (
    <div className="space-y-4">
      <NovelWorldUsageSummary {...props} draft={draft} />
      <DetailDisclosure title="Detalles del alcance de uso" description="Revise y ajuste las limitaciones mundiales que deben preservarse al principio del libro.">
        <NovelWorldUsageDetails {...props} draft={draft} />
      </DetailDisclosure>
    </div>
  );
}
