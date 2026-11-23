import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, BookOpenCheck, Bot, Database, MonitorCog, Route } from "lucide-react";
import { Link } from "react-router-dom";
import {
  getAPIKeySettings,
  getModelRoutes,
  getRagSettings,
  getStyleEngineRuntimeSettings,
  getModelRouteConnectivity,
} from "@/api/settings";
import { queryKeys } from "@/api/queryKeys";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import SettingsReadinessCard, { buildSettingsReadinessItems } from "../components/SettingsReadinessCard";
import { SettingsShell } from "../components/SettingsShell";
import { APP_RUNTIME } from "@/lib/constants";

const entries = [
  { to: "/settings/models", title: "Modelos y proveedores", description: "Agregue proveedores de modelos, seleccione modelos y administre conexiones.", icon: Bot },
  { to: "/settings/model-routes", title: "Gestión de rutas de modelos", description: "Seleccione modelos para diferentes tareas de creación y verifique el estado de la conexión.", icon: Route },
  { to: "/settings/director", title: "Director automático", description: "Organice el manejo de problemas, confirme preferencias y métodos de recordatorio.", icon: BookOpenCheck },
  { to: "/settings/knowledge", title: "Base de conocimiento y estilo", description: "Involucrar datos y preferencias de escritura en la creación posterior.", icon: Database },
  { to: "/settings/maintenance", title: "Escritorio y mantenimiento", description: "Vea las actualizaciones y el mantenimiento de datos disponibles para su dispositivo actual.", icon: MonitorCog },
];

export default function SettingsOverviewPage() {
  const providersQuery = useQuery({ queryKey: queryKeys.settings.apiKeys, queryFn: getAPIKeySettings });
  const routesQuery = useQuery({ queryKey: queryKeys.settings.modelRoutes, queryFn: getModelRoutes });
  const connectivityQuery = useQuery({
    queryKey: queryKeys.settings.modelRouteConnectivity,
    queryFn: getModelRouteConnectivity,
    enabled: routesQuery.isSuccess,
    refetchOnWindowFocus: false,
  });
  const ragQuery = useQuery({ queryKey: queryKeys.settings.rag, queryFn: getRagSettings });
  const styleQuery = useQuery({ queryKey: queryKeys.settings.styleEngineRuntime, queryFn: getStyleEngineRuntimeSettings });
  const items = useMemo(() => buildSettingsReadinessItems({
    providers: providersQuery.data?.data ?? [],
    modelRoutes: routesQuery.data?.data,
    modelRouteConnectivity: connectivityQuery.data?.data,
    ragSettings: ragQuery.data?.data,
    styleSettings: styleQuery.data?.data,
    isModelRoutesChecking: routesQuery.isLoading || connectivityQuery.isLoading,
    routeReadFailed: routesQuery.isError || connectivityQuery.isError,
    isStyleSettingsLoaded: styleQuery.isSuccess,
  }), [connectivityQuery.data?.data, connectivityQuery.isLoading, connectivityQuery.isError, routesQuery.isError, routesQuery.isLoading, providersQuery.data?.data, ragQuery.data?.data, routesQuery.data?.data, styleQuery.data?.data, styleQuery.isSuccess]);
  const configuredProvider = providersQuery.data?.data?.find((item) => item.isConfigured && item.isActive);
  const routeCount = routesQuery.data?.data?.routes.filter((route) => route.provider && route.model).length ?? 0;
  const rag = ragQuery.data?.data;

  return (
    <SettingsShell title="Ajustes del sistema" description="Vea el estado de su entorno creativo e ingrese las configuraciones que necesitan ajustes.">
      <SettingsReadinessCard items={items} />
      <div className="grid gap-4 md:grid-cols-2">
        {entries.map(({ to, title, description, icon: Icon }) => {
          const summary = title === "Modelos y proveedores"
            ? configuredProvider ? `${configuredProvider.name} · ${configuredProvider.currentModel || "Ningún modelo seleccionado"}` : "Aún no se han configurado modelos de texto disponibles"
            : title === "Gestión de rutas de modelos"
              ? `${routeCount} Se han configurado rutas de tareas.`
            : title === "Base de conocimiento y estilo"
              ? rag?.enabled ? `La recuperación de datos está habilitada · ${rag.embeddingModel || "No se seleccionó ningún modelo vectorial"}` : "Mejora opcional, que por ahora no afecta al inicio de la creación."
              : title === "Escritorio y mantenimiento"
                ? APP_RUNTIME === "desktop" ? "Puede buscar actualizaciones de escritorio y datos locales antiguos" : "No se requiere mantenimiento de escritorio en la página web."
                : "Establecer preferencias de confirmación, manejo de problemas y métodos de notificación";
          return (
            <Card key={to} className="min-w-0">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base"><Icon className="h-4 w-4" />{title}</CardTitle>
                <CardDescription>{description}</CardDescription>
              </CardHeader>
              <CardContent className="flex items-end justify-between gap-3">
                <p className="text-sm text-muted-foreground">{summary}</p>
                <Button asChild variant="outline" size="sm" className="shrink-0"><Link to={to}>Abierto<ArrowRight className="h-4 w-4" /></Link></Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </SettingsShell>
  );
}
