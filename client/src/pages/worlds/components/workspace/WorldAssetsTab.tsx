import { useState, type Dispatch, type SetStateAction } from "react";
import { GitCompareArrows, GitFork, Map, Network, Workflow } from "lucide-react";
import type { World, WorldSnapshot } from "@ai-novel/shared/types/world";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import KnowledgeBindingPanel from "@/components/knowledge/KnowledgeBindingPanel";
import SelectControl from "@/components/common/SelectControl";

interface WorldLibraryItem {
  id: string;
  name: string;
  description?: string | null;
  category: string;
  worldType?: string | null;
  usageCount: number;
  sourceWorldId?: string | null;
}

interface WorldAssetsTabProps {
  worldId: string;
  world?: World;
  selectedLayerPrimaryField: "background" | "magicSystem" | "politics" | "cultures" | "history" | "conflicts";
  libraryKeyword: string;
  setLibraryKeyword: Dispatch<SetStateAction<string>>;
  libraryCategory: string;
  setLibraryCategory: Dispatch<SetStateAction<string>>;
  publishName: string;
  setPublishName: Dispatch<SetStateAction<string>>;
  publishCategory: string;
  setPublishCategory: Dispatch<SetStateAction<string>>;
  publishDescription: string;
  setPublishDescription: Dispatch<SetStateAction<string>>;
  snapshotLabel: string;
  setSnapshotLabel: Dispatch<SetStateAction<string>>;
  diffFrom: string;
  setDiffFrom: Dispatch<SetStateAction<string>>;
  diffTo: string;
  setDiffTo: Dispatch<SetStateAction<string>>;
  importFormat: "json" | "markdown" | "text";
  setImportFormat: Dispatch<SetStateAction<"json" | "markdown" | "text">>;
  importContent: string;
  setImportContent: Dispatch<SetStateAction<string>>;
  libraryItems: WorldLibraryItem[];
  snapshots: WorldSnapshot[];
  diffChanges: Array<{ field: string; before: string | null; after: string | null }>;
  createSnapshotPending: boolean;
  publishPending: boolean;
  importPending: boolean;
  onRefreshLibrary: () => void;
  onInjectLibraryField: (libraryId: string) => void;
  onInjectLibraryStructure: (libraryId: string, targetCollection: "forces" | "locations") => void;
  onPublishLibrary: () => void;
  onCreateSnapshot: () => void;
  onRestoreSnapshot: (snapshotId: string) => void;
  onDiffSnapshots: () => void;
  onExport: (format: "markdown" | "json") => Promise<void>;
  onImport: () => void;
}

type AssetTool = "visualAssets" | "references" | "library" | "snapshots" | "export" | "import";

const WORLD_ASSET_PRESETS = [
  {
    icon: Map,
    title: "Mapa del mundo",
    description: "Utilice áreas, caminos, fronteras y ubicaciones de la historia para explicar cómo se mueven los personajes y dónde estalla el conflicto.",
    readiness: "Primero conforma el escenario de la historia, la ubicación de los riesgos y las áreas de control de energía.",
  },
  {
    icon: Network,
    title: "Mapa de poder",
    description: "Organice las relaciones de fuerzas, campamentos, aliados, enemigos y vasallos en una red de relaciones visuales.",
    readiness: "Primero, compense las fuerzas principales, los objetivos actuales y la presión mutua.",
  },
  {
    icon: GitFork,
    title: "Línea de tiempo mundial",
    description: "Registre eventos importantes, desastres, cambios de dinastía y cambios de situación para mantener el progreso del mundo encaminado.",
    readiness: "Primero, cubra los conflictos centrales, las consecuencias comunes y los nodos históricos clave.",
  },
  {
    icon: GitCompareArrows,
    title: "Red de roles",
    description: "Conecta personajes con fuerzas, ubicaciones, recursos y relaciones tabú para reducir la deriva del escenario.",
    readiness: "Primero compensa la afiliación de los personajes, la presión del campamento y las ubicaciones clave.",
  },
  {
    icon: Workflow,
    title: "Árbol del sistema de energía",
    description: "Organice las fuentes de poder, las rutas de mejora, los costos y los límites tabú en una estructura jerárquica.",
    readiness: "Primero, compensar las reglas básicas, los costos y los límites inquebrantables.",
  },
];

function AssetToolButton({
  label,
  description,
  selected,
  onClick,
}: {
  label: string;
  description: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={[
        "shrink-0 rounded-full px-4 py-2 text-sm transition-colors",
        selected ? "bg-background font-medium text-foreground shadow-sm" : "text-muted-foreground hover:bg-background/60 hover:text-foreground",
      ].join(" ")}
      onClick={onClick}
      title={description}
    >
      {label}
    </button>
  );
}

export default function WorldAssetsTab(props: WorldAssetsTabProps) {
  const [activeTool, setActiveTool] = useState<AssetTool>("visualAssets");
  const {
    selectedLayerPrimaryField,
    libraryKeyword,
    setLibraryKeyword,
    libraryCategory,
    setLibraryCategory,
    publishName,
    setPublishName,
    publishCategory,
    setPublishCategory,
    publishDescription,
    setPublishDescription,
    snapshotLabel,
    setSnapshotLabel,
    diffFrom,
    setDiffFrom,
    diffTo,
    setDiffTo,
    importFormat,
    setImportFormat,
    importContent,
    setImportContent,
    libraryItems,
    snapshots,
    diffChanges,
    createSnapshotPending,
    publishPending,
    importPending,
    onRefreshLibrary,
    onInjectLibraryField,
    onInjectLibraryStructure,
    onPublishLibrary,
    onCreateSnapshot,
    onRestoreSnapshot,
    onDiffSnapshots,
    onExport,
    onImport,
  } = props;

  return (
    <section className="space-y-6">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Datos y versiones mundiales.</h2>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">Aquí también se puede acceder a la gestión de materiales de referencia, materiales reutilizables, copias de seguridad de versiones, importación y exportación, y capacidades de mapas y atlas.</p>
        </div>

        <div className="flex gap-1 overflow-x-auto rounded-full bg-muted/30 p-1">
          <AssetToolButton
            label="Mapas y atlas"
            description="Reserva de entrada de activos mundiales."
            selected={activeTool === "visualAssets"}
            onClick={() => setActiveTool("visualAssets")}
          />
          <AssetToolButton
            label="Referencias"
            description="Relacionar datos que respalden la configuración mundial."
            selected={activeTool === "references"}
            onClick={() => setActiveTool("references")}
          />
          <AssetToolButton
            label="Materiales del mundo"
            description="Reutilizar ubicaciones, fuerzas, recursos y otros contenidos que puedan depositarse."
            selected={activeTool === "library"}
            onClick={() => setActiveTool("library")}
          />
          <AssetToolButton
            label="Instantánea de la versión"
            description="Guarde la versión y compare las diferencias entre las dos configuraciones."
            selected={activeTool === "snapshots"}
            onClick={() => setActiveTool("snapshots")}
          />
          <AssetToolButton
            label="Exportar copia de seguridad"
            description="Copie Markdown o JSON."
            selected={activeTool === "export"}
            onClick={() => setActiveTool("export")}
          />
          <AssetToolButton
            label="Importar texto"
            description="Crea mundos a partir de texto, Markdown o JSON."
            selected={activeTool === "import"}
            onClick={() => setActiveTool("import")}
          />
        </div>

        {activeTool === "visualAssets" ? (
          <div className="rounded-3xl border border-border/35 bg-card/70 p-5">
            <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <div className="font-medium">Planificación de activos mundiales</div>
                <div className="mt-1 text-sm leading-6 text-muted-foreground">
                  Mapas, mapas de poder, líneas de tiempo y árboles de sistemas se extienden desde el Manual Mundial. Primero, clasifique las reglas, fuerzas, ubicaciones y tensiones, y luego genere recursos visuales.
                </div>
              </div>
              <Badge variant="secondary" className="border-0 bg-muted/60 font-normal">Capacidad reservada</Badge>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {WORLD_ASSET_PRESETS.map((asset) => {
                const Icon = asset.icon;
                return (
                  <div key={asset.title} className="rounded-2xl bg-muted/20 p-4">
                    <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                      <Icon className="h-4 w-4 text-primary" aria-hidden="true" />
                      {asset.title}
                    </div>
                    <div className="mt-2 text-xs leading-5 text-muted-foreground">{asset.description}</div>
                    <div className="mt-3 rounded-xl bg-background/70 p-3 text-xs leading-5 text-muted-foreground">
                      {asset.readiness}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}

        {activeTool === "references" ? (
          <div className="rounded-3xl border border-border/35 bg-card/70 p-5">
            <div className="mb-3 font-medium">Referencias</div>
            <KnowledgeBindingPanel targetType="world" targetId={props.worldId} title="Referencias" />
          </div>
        ) : null}

        {activeTool === "library" ? (
          <div className="space-y-4 rounded-3xl border border-border/35 bg-card/70 p-5">
            <div className="font-medium">Materiales del mundo</div>
            <div className="grid gap-2 md:grid-cols-3">
              <Input
                placeholder="Palabras clave"
                value={libraryKeyword}
                onChange={(event) => setLibraryKeyword(event.target.value)}
              />
              <SelectControl
                className="w-full rounded-md border bg-background p-2 text-sm"
                value={libraryCategory}
                onChange={(event) => setLibraryCategory(event.target.value)}
              >
                <option value="all">Todas las categorias</option>
                <option value="terrain">Geografía y accidentes geográficos</option>
                <option value="race">Carrera</option>
                <option value="power_system">Sistema de energía</option>
                <option value="organization">Poder organizacional</option>
                <option value="resource">Recursos</option>
                <option value="event">Evento</option>
                <option value="artifact">Accesorios y maravillas</option>
                <option value="custom">Personalizar</option>
              </SelectControl>
              <Button variant="outline" onClick={onRefreshLibrary}>
                refrescar
              </Button>
            </div>
            <div className="space-y-3 rounded-2xl bg-muted/20 p-4">
              <div className="text-xs font-semibold text-muted-foreground">
                Guardar la configuración actual como material mundial
              </div>
              <div className="grid gap-2 md:grid-cols-3">
                <Input
                  placeholder="Nombre del material"
                  value={publishName}
                  onChange={(event) => setPublishName(event.target.value)}
                />
                <SelectControl
                  className="w-full rounded-md border bg-background p-2 text-sm"
                  value={publishCategory}
                  onChange={(event) => setPublishCategory(event.target.value)}
                >
                  <option value="custom">Personalizar</option>
                  <option value="terrain">Geografía y accidentes geográficos</option>
                  <option value="race">Carrera</option>
                  <option value="power_system">Sistema de energía</option>
                  <option value="organization">Poder organizacional</option>
                  <option value="resource">Recursos</option>
                  <option value="event">Evento</option>
                  <option value="artifact">Accesorios y maravillas</option>
                </SelectControl>
                <Button onClick={onPublishLibrary} disabled={publishPending}>
                  {publishPending ? "Guardando..." : "Guardar metraje"}
                </Button>
              </div>
              <textarea
                className="min-h-[80px] w-full rounded-md border bg-background p-2 text-sm"
                value={publishDescription}
                onChange={(event) => setPublishDescription(event.target.value)}
                placeholder="Descripción opcional (por defecto, el contenido jerárquico actual cuando se deja en blanco)"
              />
            </div>
            {libraryItems.map((item) => (
              <div key={item.id} className="space-y-3 rounded-2xl border border-border/35 p-4 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div>{item.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {item.category} /Número de usos={item.usageCount}
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" onClick={() => onInjectLibraryField(item.id)}>
                    Unir la capa actual ({selectedLayerPrimaryField})
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => onInjectLibraryStructure(item.id, "forces")}>
                    Únete al manual de la fuerza
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => onInjectLibraryStructure(item.id, "locations")}>
                    Únase al libro de ubicaciones
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : null}

        {activeTool === "snapshots" ? (
          <div className="space-y-4 rounded-3xl border border-border/35 bg-card/70 p-5">
          <div className="font-medium">Instantánea de la versión</div>
          <div className="flex gap-2">
            <Input
              placeholder="Etiqueta de instantánea (opcional)"
              value={snapshotLabel}
              onChange={(event) => setSnapshotLabel(event.target.value)}
            />
            <Button onClick={onCreateSnapshot} disabled={createSnapshotPending}>
              Crear instantánea
            </Button>
          </div>
          {snapshots.map((snapshot) => (
            <div key={snapshot.id} className="flex items-center justify-between rounded-2xl bg-muted/20 p-3 text-sm">
              <div>
                {snapshot.label ?? snapshot.id.slice(0, 8)} / {new Date(snapshot.createdAt).toLocaleString()}
              </div>
              <Button size="sm" variant="outline" onClick={() => onRestoreSnapshot(snapshot.id)}>
                recuperar
              </Button>
            </div>
          ))}
          <div className="grid gap-2 md:grid-cols-3">
            <SelectControl
              className="w-full rounded-md border bg-background p-2 text-sm"
              value={diffFrom}
              onChange={(event) => setDiffFrom(event.target.value)}
            >
              <option value="">Instantánea inicial</option>
              {snapshots.map((snapshot) => (
                <option key={`from-${snapshot.id}`} value={snapshot.id}>
                  {snapshot.label ?? snapshot.id.slice(0, 8)}
                </option>
              ))}
            </SelectControl>
            <SelectControl
              className="w-full rounded-md border bg-background p-2 text-sm"
              value={diffTo}
              onChange={(event) => setDiffTo(event.target.value)}
            >
              <option value="">Instantánea de destino</option>
              {snapshots.map((snapshot) => (
                <option key={`to-${snapshot.id}`} value={snapshot.id}>
                  {snapshot.label ?? snapshot.id.slice(0, 8)}
                </option>
              ))}
            </SelectControl>
            <Button onClick={onDiffSnapshots} disabled={!diffFrom || !diffTo}>
              Compara las diferencias
            </Button>
          </div>
          {diffChanges.map((change) => (
            <div key={change.field} className="rounded-2xl bg-muted/20 p-3 text-xs">
              {change.field}: {change.before ?? "Vacío"} {"->"} {change.after ?? "Vacío"}
            </div>
          ))}
          </div>
        ) : null}

        {activeTool === "export" ? (
          <div className="space-y-3 rounded-3xl border border-border/35 bg-card/70 p-5">
          <div className="font-medium">Exportar copia de seguridad</div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => void onExport("markdown")}>
              Exportar Markdown (copiar al portapapeles)
            </Button>
            <Button variant="secondary" onClick={() => void onExport("json")}>
              Exportar JSON (copiar al portapapeles)
            </Button>
          </div>
          </div>
        ) : null}

        {activeTool === "import" ? (
          <div className="space-y-3 rounded-3xl border border-border/35 bg-card/70 p-5">
          <div className="font-medium">Importar texto</div>
          <SelectControl
            className="w-full rounded-md border bg-background p-2 text-sm"
            value={importFormat}
            onChange={(event) => setImportFormat(event.target.value as "json" | "markdown" | "text")}
          >
            <option value="text">Texto plano</option>
            <option value="markdown">Markdown</option>
            <option value="json">JSON</option>
          </SelectControl>
          <textarea
            className="min-h-[160px] w-full rounded-md border bg-background p-2 text-sm"
            value={importContent}
            onChange={(event) => setImportContent(event.target.value)}
            placeholder="Por favor pegue el contenido que desea importar"
          />
          <Button onClick={onImport} disabled={importPending || !importContent.trim()}>
            {importPending ? "Importador..." : "Importar como nuevo mundo"}
          </Button>
          </div>
        ) : null}
    </section>
  );
}
