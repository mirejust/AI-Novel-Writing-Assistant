import type {
  WorldReferenceSeedBundle,
  WorldReferenceSeedSelection,
} from "@ai-novel/shared/types/worldWizard";
import { Button } from "@/components/ui/button";

type GroupKey = keyof WorldReferenceSeedBundle;

const GROUP_META: Record<
  GroupKey,
  {
    title: string;
    description: string;
    selectionKey: keyof WorldReferenceSeedSelection;
  }
> = {
  rules: {
    title: "Reglas originales",
    description: "Este mundo funciona de forma predeterminada y la generación automática posterior se referirá a estas reglas subyacentes.",
    selectionKey: "ruleIds",
  },
  factions: {
    title: "Posición de campamento",
    description: "Quién está de qué lado, en qué cree, qué quiere promover. Adecuado para conservar la dirección general de la obra original.",
    selectionKey: "factionIds",
  },
  forces: {
    title: "Organización y poder",
    description: "Empresas, departamentos, pandillas y redes específicas son organizaciones que pueden participar directamente.",
    selectionKey: "forceIds",
  },
  locations: {
    title: "Lugares y escenas",
    description: "Escenarios que se pueden utilizar directamente en ciudades, barrios, empresas, residencias, etc.",
    selectionKey: "locationIds",
  },
};

function summarizeSeed(group: GroupKey, item: Record<string, unknown>): string {
  if (group === "rules") {
    return [item.summary, item.boundary, item.enforcement].filter(Boolean).join(" | ");
  }
  if (group === "factions") {
    return [item.position, item.doctrine].filter(Boolean).join(" | ");
  }
  if (group === "forces") {
    return [item.type, item.summary, item.pressure].filter(Boolean).join(" | ");
  }
  return [item.terrain, item.summary, item.narrativeFunction].filter(Boolean).join(" | ");
}

export default function WorldReferenceSeedSelector(props: {
  seeds: WorldReferenceSeedBundle;
  selectedIds: WorldReferenceSeedSelection;
  onToggle: (group: GroupKey, id: string, checked: boolean) => void;
  onToggleAll: (group: GroupKey, checked: boolean) => void;
}) {
  const { seeds, selectedIds, onToggle, onToggleAll } = props;

  const visibleGroups = (Object.keys(GROUP_META) as GroupKey[]).filter((group) => seeds[group].length > 0);
  if (visibleGroups.length === 0) {
    return (
      <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
        Esta vez, no se han extraído de forma estable organizaciones, ubicaciones o reglas de las obras de referencia que puedan utilizarse directamente. Continuarán generándose de acuerdo con su dirección de transformación más adelante.
      </div>
    );
  }

  return (
    <div className="rounded-md border p-3 text-sm space-y-4">
      <div className="space-y-1">
        <div className="font-medium">Utilice directamente la configuración original</div>
        <div className="text-xs text-muted-foreground">
          El sistema extraerá un lote de configuraciones heredables de las obras de referencia y las verificará de forma predeterminada. Conservarlos puede reducir significativamente el llenado manual posterior.
        </div>
      </div>

      {visibleGroups.map((group) => {
        const items = seeds[group];
        const selectionKey = GROUP_META[group].selectionKey;
        const currentSelectedIds = selectedIds[selectionKey];
        const allSelected = items.length > 0 && items.every((item) => currentSelectedIds.includes(item.id));
        return (
          <div key={group} className="rounded-md border p-3 space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="space-y-1">
                <div className="font-medium">{GROUP_META[group].title}</div>
                <div className="text-xs text-muted-foreground">{GROUP_META[group].description}</div>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => onToggleAll(group, !allSelected)}
              >
                {allSelected ? "Cancelar todo" : "Mantener todo"}
              </Button>
            </div>

            <div className="space-y-2">
              {items.map((item) => {
                const checked = currentSelectedIds.includes(item.id);
                const summary = summarizeSeed(group, item as Record<string, unknown>);
                return (
                  <label key={item.id} className="flex items-start gap-3 rounded-md border p-3">
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={checked}
                      onChange={(event) => onToggle(group, item.id, event.target.checked)}
                    />
                    <div className="space-y-1">
                      <div className="font-medium">{item.name}</div>
                      {summary ? (
                        <div className="text-xs text-muted-foreground">{summary}</div>
                      ) : (
                        <div className="text-xs text-muted-foreground">Configuraciones identificadas del original que se pueden heredar directamente.</div>
                      )}
                    </div>
                  </label>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
