import { Link } from "react-router-dom";
import { ArrowRight, CheckCircle2, CircleAlert, CircleDashed, Loader2 } from "lucide-react";
import type {
  APIKeyStatus,
  ModelRouteConnectivityResponse,
  ModelRoutesResponse,
  RagSettingsStatus,
  StyleEngineRuntimeSettingsStatus,
} from "@/api/settings";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AUTO_DIRECTOR_MOBILE_CLASSES } from "@/mobile/autoDirector";

export type SettingsReadinessItem = {
  key: "model" | "routes" | "rag" | "style";
  title: string;
  description: string;
  state: "ready" | "warning" | "optional" | "checking" | "untested";
};

function getReadinessIcon(state: SettingsReadinessItem["state"]) {
  if (state === "ready") {
    return <CheckCircle2 className="h-4 w-4 text-emerald-600" />;
  }
  if (state === "checking") {
    return <Loader2 className="h-4 w-4 animate-spin text-amber-600" />;
  }
  if (state === "optional" || state === "untested") {
    return <CircleDashed className="h-4 w-4 text-sky-600" />;
  }
  return <CircleAlert className="h-4 w-4 text-amber-600" />;
}

function getReadinessBadge(state: SettingsReadinessItem["state"]) {
  switch (state) {
    case "ready":
      return "Disponible";
    case "untested":
      return "Aún no probado";
    case "checking":
      return "Comprobando";
    case "optional":
      return "Mejoras opcionales";
    case "warning":
      return "Requiere atención";
  }
}

export function buildSettingsReadinessItems(input: {
  providers: APIKeyStatus[];
  ragSettings?: RagSettingsStatus | null;
  styleSettings?: StyleEngineRuntimeSettingsStatus | null;
  modelRoutes?: ModelRoutesResponse | null;
  modelRouteConnectivity?: ModelRouteConnectivityResponse | null;
  isModelRoutesChecking: boolean;
  routeReadFailed: boolean;
  isStyleSettingsLoaded: boolean;
}): SettingsReadinessItem[] {
  const {
    providers,
    ragSettings,
    styleSettings,
    modelRoutes,
    modelRouteConnectivity,
    isModelRoutesChecking,
    isStyleSettingsLoaded,
  } = input;
  const runnableProviders = providers.filter((item) => item.isConfigured && item.isActive && item.currentModel);
  const currentRagProvider = ragSettings?.providers.find((item) => item.provider === ragSettings.embeddingProvider);
  const routeStatuses = modelRouteConnectivity?.statuses ?? [];
  const failedRouteCount = routeStatuses.filter(
    (item) => (item.plain && !item.plain.ok) || (item.structured && !item.structured.ok),
  ).length;
  const hasRoutes = (modelRoutes?.routes ?? []).length > 0;
  const styleTimeout = styleSettings?.styleExtractionTimeoutMs;
  const styleReady = Boolean(styleSettings)
    && typeof styleTimeout === "number"
    && styleTimeout >= styleSettings!.minStyleExtractionTimeoutMs
    && styleTimeout <= styleSettings!.maxStyleExtractionTimeoutMs;

  return [
    {
      key: "model",
      title: "Modelo de texto",
      state: runnableProviders.length > 0 ? "ready" : "warning",
      description: runnableProviders.length > 0
        ? `Ya disponible ${runnableProviders[0].name} Generar texto y planos.`
        : "Primero configure un modelo disponible y luego podrá comenzar a abrir el libro y generar capítulos.",
    },
    {
      key: "routes",
      title: "Enrutamiento del modelo",
      state: input.routeReadFailed ? "warning" : isModelRoutesChecking ? "checking" : !routeStatuses.length ? "untested" : failedRouteCount ? "warning" : "ready",
      description: input.routeReadFailed ? "No se pudo leer la ruta del modelo o el último resultado de la detección; vaya a la página de ruta del modelo para verificar."
        : isModelRoutesChecking ? "Cargando la configuración del modelo y los últimos resultados de detección."
        : !modelRouteConnectivity ? `${hasRoutes ? "Modelo de tarea configurado." : "Las tareas de creación utilizan la ruta predeterminada."}Puede verificar la conexión yendo a la página de enrutamiento del modelo.`
        : `Detectado por última vez el ${new Date(modelRouteConnectivity.testedAt).toLocaleString()},${failedRouteCount ? `${failedRouteCount} Excepción de ruta` : "La conexión de enrutamiento es normal"}.`,
    },
    {
      key: "rag",
      title: "Mejora de la base de conocimientos",
      state: ragSettings?.enabled && currentRagProvider?.isConfigured && currentRagProvider?.isActive ? "ready" : "optional",
      description: ragSettings?.enabled && currentRagProvider?.isConfigured && currentRagProvider?.isActive
        ? "La búsqueda en la base de conocimientos está habilitada para ayudar a que la redacción extensa mantenga los datos y la configuración continuos."
        : "Puedes empezar a crear sin configuración; permitiendo ajustes mejorados, datos y recuperación de contexto.",
    },
    {
      key: "style",
      title: "Motor de escritura",
      state: !isStyleSettingsLoaded ? "checking" : styleReady ? "ready" : "warning",
      description: styleReady
        ? "El tiempo de espera para la extracción del estilo de escritura está dentro del rango disponible y se puede utilizar para aprender estilos de escritura de muestra."
        : "Confirme que el tiempo de espera para la extracción del método de escritura esté dentro del rango disponible.",
    },
  ];
}

export default function SettingsReadinessCard(props: {
  items: SettingsReadinessItem[];
}) {
  const { items } = props;
  const modelItem = items.find((item) => item.key === "model");
  const routesItem = items.find((item) => item.key === "routes");
  const hasModel = modelItem?.state === "ready";
  const hasHealthyRoutes = routesItem?.state === "ready" || routesItem?.state === "untested";
  const blockingCount = items.filter((item) => item.key !== "rag" && item.state === "warning").length;
  const canStart = hasModel && hasHealthyRoutes && blockingCount === 0;
  const primaryAction = !hasModel
    ? { label: "Configurar modelo de cuerpo", to: "/settings/models" }
    : !hasHealthyRoutes
      ? { label: "Comprobar ruta del modelo", to: "/settings/model-routes" }
      : { label: "Empieza a crear una novela.", to: "/novels/create" };

  return (
    <Card className="min-w-0 overflow-hidden border-primary/20 bg-primary/5">
      <CardHeader className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 space-y-1">
          <CardTitle>Verificación de disponibilidad de autoría</CardTitle>
          <CardDescription className={AUTO_DIRECTOR_MOBILE_CLASSES.wrapText}>
            Primero confirmar si están disponibles los modelos y rutas necesarios para empezar a escribir novelas; la base de conocimientos es una mejora y se puede agregar más adelante.
          </CardDescription>
        </div>
        <Button asChild className={AUTO_DIRECTOR_MOBILE_CLASSES.fullWidthAction}>
          <Link to={primaryAction.to}>
            {primaryAction.label}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid min-w-0 gap-3 md:grid-cols-2 xl:grid-cols-4">
          {items.map((item) => (
            <div key={item.key} className="min-w-0 rounded-md border bg-background/80 p-3">
              <div className="mb-2 flex min-w-0 items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  {getReadinessIcon(item.state)}
                  <div className="min-w-0 font-medium">{item.title}</div>
                </div>
                <Badge variant={item.state === "ready" ? "default" : "outline"}>
                  {getReadinessBadge(item.state)}
                </Badge>
              </div>
              <div className={`text-xs leading-5 text-muted-foreground ${AUTO_DIRECTOR_MOBILE_CLASSES.wrapText}`}>
                {item.description}
              </div>
            </div>
          ))}
        </div>
        <div className={`text-sm ${canStart ? "text-emerald-700" : "text-muted-foreground"} ${AUTO_DIRECTOR_MOBILE_CLASSES.wrapText}`}>
          {canStart
            ? "Puede comenzar a crear o puede ir primero a la página de enrutamiento del modelo para verificar la conexión."
            : "Será más estable trabajar primero en elementos marcados como \"necesita trabajo\" y luego pasar a la producción automática de director o capítulo cuando esté terminado."}
        </div>
      </CardContent>
    </Card>
  );
}
