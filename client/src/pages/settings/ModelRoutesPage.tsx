import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, CopyCheck, RefreshCw, Save } from "lucide-react";
import type { StructuredFallbackSettings } from "@/api/settings";
import {
  getAPIKeySettings,
  getModelRoutes,
  getModelRouteConnectivity,
  getStructuredFallbackConfig,
  saveModelRoute,
  saveStructuredFallbackConfig,
  testModelRouteConnectivity,
} from "@/api/settings";
import { queryKeys } from "@/api/queryKeys";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import ModelRouteFields from "./ModelRouteFields";
import { MODEL_ROUTE_LABELS } from "./modelRouteLabels";
import {
  buildRouteSavePayload,
  formatConnectivityStatus,
  getPreferredModel,
  getProviderDisplayName,
  isSameRouteDraft,
  parseStructuredRetryCount,
  resolveConnectivityState,
  type ConnectivityState,
  type RouteDraft,
  type RouteSavePayload,
  type StructuredFallbackDraft,
} from "./modelRoutes.utils";
import type { ModelRouteTaskType } from "@ai-novel/shared/types/novel";

function RouteStatusDot({ state }: { state: ConnectivityState }) {
  const colorClass = state === "healthy"
    ? "bg-emerald-500"
    : state === "failed"
      ? "bg-red-500"
      : state === "checking"
        ? "bg-amber-400"
        : "bg-slate-300";

  return <span className={`inline-block h-2.5 w-2.5 rounded-full ${colorClass}`} aria-hidden="true" />;
}

export default function ModelRoutesPage() {
  const queryClient = useQueryClient();
  const [actionResult, setActionResult] = useState("");
  const [routeDrafts, setRouteDrafts] = useState<Record<string, RouteDraft>>({});
  const [bulkDraft, setBulkDraft] = useState<RouteDraft | null>(null);
  const [structuredFallbackDraft, setStructuredFallbackDraft] = useState<StructuredFallbackDraft | null>(null);

  const apiKeySettingsQuery = useQuery({
    queryKey: queryKeys.settings.apiKeys,
    queryFn: getAPIKeySettings,
  });

  const modelRoutesQuery = useQuery({
    queryKey: queryKeys.settings.modelRoutes,
    queryFn: getModelRoutes,
  });

  const modelRouteConnectivityQuery = useQuery({
    queryKey: queryKeys.settings.modelRouteConnectivity,
    queryFn: getModelRouteConnectivity,
    enabled: modelRoutesQuery.isSuccess,
    refetchOnWindowFocus: false,
  });

  const checkConnectivity = useMutation({
    mutationFn: testModelRouteConnectivity,
    onSuccess: async result => {
      await queryClient.cancelQueries({ queryKey: queryKeys.settings.modelRouteConnectivity });
      queryClient.setQueryData(queryKeys.settings.modelRouteConnectivity, result);
    },
  });

  const structuredFallbackQuery = useQuery({
    queryKey: queryKeys.settings.structuredFallback,
    queryFn: getStructuredFallbackConfig,
    refetchOnWindowFocus: false,
  });

  const saveModelRouteMutation = useMutation({
    mutationFn: (payload: RouteSavePayload) => saveModelRoute(payload),
    onSuccess: async () => {
      setActionResult("Una vez guardada, esta tarea utilizará la nueva ruta.");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.settings.modelRoutes }),
        queryClient.invalidateQueries({ queryKey: queryKeys.settings.modelRouteConnectivity }),
      ]);
    },
  });

  const saveAllModelRoutesMutation = useMutation({
    mutationFn: async (payloads: RouteSavePayload[]) => {
      await Promise.all(payloads.map((payload) => saveModelRoute(payload)));
      return payloads.length;
    },
    onSuccess: async (count) => {
      setActionResult(`Guardar completado,${count} Las tareas utilizarán la nueva ruta.`);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.settings.modelRoutes }),
        queryClient.invalidateQueries({ queryKey: queryKeys.settings.modelRouteConnectivity }),
      ]);
    },
  });

  const saveStructuredFallbackMutation = useMutation({
    mutationFn: (payload: Partial<StructuredFallbackSettings>) => saveStructuredFallbackConfig(payload),
    onSuccess: async () => {
      setActionResult("Se guardaron las configuraciones de tolerancia a fallas de llamadas estructuradas.");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.settings.structuredFallback }),
        queryClient.invalidateQueries({ queryKey: queryKeys.settings.modelRouteConnectivity }),
      ]);
    },
  });

  const providerConfigs = useMemo(() => apiKeySettingsQuery.data?.data ?? [], [apiKeySettingsQuery.data?.data]);
  const modelRoutes = modelRoutesQuery.data?.data;
  const modelRouteConnectivity = modelRouteConnectivityQuery.data?.data;
  const structuredFallback = structuredFallbackQuery.data?.data;
  const taskTypes = modelRoutes?.taskTypes ?? [];
  const providerOptions = useMemo(() => providerConfigs.map((item) => item.provider), [providerConfigs]);
  const routeMap = useMemo(() => new Map((modelRoutes?.routes ?? []).map((item) => [item.taskType, item])), [modelRoutes?.routes]);
  const connectivityMap = useMemo(
    () => new Map((modelRouteConnectivity?.statuses ?? []).map((item) => [item.taskType, item])),
    [modelRouteConnectivity?.statuses],
  );
  const connectivitySummary = useMemo(() => {
    const statuses = modelRouteConnectivity?.statuses ?? [];
    return {
      total: statuses.length,
      healthy: statuses.filter((item) => (item.plain?.ok ?? true) && (item.structured?.ok ?? true)).length,
      failed: statuses.filter((item) => (item.plain && !item.plain.ok) || (item.structured && !item.structured.ok)).length,
      testedAt: modelRouteConnectivity?.testedAt ?? "",
    };
  }, [modelRouteConnectivity?.statuses, modelRouteConnectivity?.testedAt]);
  const preferredProviderConfig = useMemo(
    () => providerConfigs.find((item) => item.isConfigured && item.isActive && getPreferredModel(item))
      ?? providerConfigs.find((item) => getPreferredModel(item))
      ?? providerConfigs[0],
    [providerConfigs],
  );
  const defaultProvider = preferredProviderConfig?.provider ?? "deepseek";
  const defaultModel = getPreferredModel(preferredProviderConfig);
  const dirtyTaskTypes = useMemo(
    () => taskTypes.filter((taskType) => {
      const draft = routeDrafts[taskType];
      return draft ? !isSameRouteDraft(draft, routeMap.get(taskType)) : false;
    }),
    [routeDrafts, routeMap, taskTypes],
  );
  const dirtyTaskTypeSet = useMemo(() => new Set(dirtyTaskTypes), [dirtyTaskTypes]);
  const failedTaskTypes = useMemo(
    () => taskTypes.filter((taskType) => resolveConnectivityState(connectivityMap.get(taskType), false) === "failed"),
    [connectivityMap, taskTypes],
  );
  const emptyRouteTaskTypes = useMemo(
    () => taskTypes.filter((taskType) => {
      const route = routeMap.get(taskType);
      return !route?.provider || !route?.model;
    }),
    [routeMap, taskTypes],
  );
  const isSavingRoutes = saveModelRouteMutation.isPending || saveAllModelRoutesMutation.isPending;

  function getRouteDraft(taskType: ModelRouteTaskType): RouteDraft {
    const existing = routeDrafts[taskType];
    if (existing) {
      return existing;
    }
    const route = routeMap.get(taskType);
    return {
      provider: route?.provider ?? "deepseek",
      model: route?.model ?? "",
      temperature: route?.temperature != null ? String(route.temperature) : "0.7",
      maxTokens: route?.maxTokens != null ? String(route.maxTokens) : "",
      requestProtocol: route?.requestProtocol ?? "auto",
      structuredResponseFormat: route?.structuredResponseFormat ?? "auto",
    };
  }

  function getBulkDraft(): RouteDraft {
    if (bulkDraft) {
      return bulkDraft;
    }
    return {
      provider: defaultProvider,
      model: defaultModel,
      temperature: "0.7",
      maxTokens: "",
      requestProtocol: "auto",
      structuredResponseFormat: "auto",
    };
  }

  function patchDraft(taskType: ModelRouteTaskType, patch: Partial<RouteDraft>) {
    const current = getRouteDraft(taskType);
    setRouteDrafts((prev) => ({
      ...prev,
      [taskType]: {
        ...current,
        ...patch,
      },
    }));
  }

  function patchBulkDraft(patch: Partial<RouteDraft>) {
    const current = getBulkDraft();
    setBulkDraft({
      ...current,
      ...patch,
    });
  }

  function applyBulkDraftToRoutes(targetTaskTypes: ModelRouteTaskType[]) {
    if (targetTaskTypes.length === 0) {
      setActionResult("No hay tareas para aplicar.");
      return;
    }
    const draft = getBulkDraft();
    setRouteDrafts((prev) => {
      const next = { ...prev };
      targetTaskTypes.forEach((taskType) => {
        next[taskType] = { ...draft };
      });
      return next;
    });
    setActionResult(`Completar la configuración del modelo ${targetTaskTypes.length} tarea, entrará en vigor después de guardarla.`);
  }

  function getStructuredFallbackDraft(): StructuredFallbackDraft {
    if (structuredFallbackDraft) {
      return structuredFallbackDraft;
    }
    return {
      enabled: structuredFallback?.enabled ?? false,
      provider: structuredFallback?.provider ?? "deepseek",
      model: structuredFallback?.model ?? "deepseek-chat",
      temperature: structuredFallback != null ? String(structuredFallback.temperature) : "0.2",
      maxTokens: structuredFallback?.maxTokens != null ? String(structuredFallback.maxTokens) : "",
      retryCount: structuredFallback != null ? String(structuredFallback.retryCount) : "1",
      requestProtocol: "auto",
      structuredResponseFormat: "auto",
    };
  }

  function patchStructuredFallbackDraft(patch: Partial<StructuredFallbackDraft>) {
    const current = getStructuredFallbackDraft();
    setStructuredFallbackDraft({
      ...current,
      ...patch,
    });
  }

  const fallbackDraft = getStructuredFallbackDraft();
  const routeBulkDraft = getBulkDraft();

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Detección de conexión</CardTitle>
          <CardDescription>La detección enviará diálogos y solicitudes estructuradas al modelo guardado, lo que puede consumir créditos del modelo.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-2 text-sm text-muted-foreground">
            <div className="flex flex-wrap items-center gap-3 text-xs">
              <span role="status" className="inline-flex items-center gap-2">
                <RouteStatusDot
                  state={checkConnectivity.isPending
                    ? "checking"
                    : connectivitySummary.failed > 0
                      ? "failed"
                      : connectivitySummary.total > 0
                        ? "healthy"
                        : "idle"}
                />
                {checkConnectivity.isPending
                  ? "Detectando rutas efectivas..."
                  : connectivitySummary.total > 0
                    ? `Último detectado:${connectivitySummary.total} ruta, salud ${connectivitySummary.healthy},anormal ${connectivitySummary.failed}`
                    : modelRouteConnectivityQuery.isLoading || modelRoutesQuery.isLoading ? "Leyendo los últimos resultados de las pruebas..."
                      : modelRouteConnectivityQuery.isError || modelRoutesQuery.isError ? "Actualmente no hay resultados de pruebas para mostrar." : "La verificación de compatibilidad del modelo aún no se ha realizado"}
              </span>
              {checkConnectivity.isError || modelRouteConnectivityQuery.isError ? <span role="alert" className="text-destructive">
                {checkConnectivity.isError ? "Esta prueba no se ha completado, vuelva a realizar la prueba." : "No se pudo leer el último resultado de la prueba."}
              </span> : null}
              {connectivitySummary.testedAt ? (
                <span>Tiempo de detección:{new Date(connectivitySummary.testedAt).toLocaleString()}</span>
              ) : null}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => checkConnectivity.mutate()}
              disabled={checkConnectivity.isPending || !modelRoutesQuery.isSuccess}
            >
              <RefreshCw className={`h-4 w-4 ${checkConnectivity.isPending ? "animate-spin" : ""}`} />
              {checkConnectivity.isPending ? "Bajo detección…" : "Comprobar conexión"}
            </Button>
            <Button asChild variant="outline">
              <Link to="/settings">
                <ArrowLeft className="h-4 w-4" />
                Volver a la configuración del sistema
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CopyCheck className="h-5 w-5" />
            Aplicar modelos rápidamente
          </CardTitle>
          <CardDescription>
            Primero seleccione un conjunto de modelos y luego complete varias tareas; después de guardarlos juntos, las creaciones posteriores se ejecutarán según la nueva ruta.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <ModelRouteFields
            draft={routeBulkDraft}
            providerConfigs={providerConfigs}
            providerOptions={providerOptions}
            onPatch={patchBulkDraft}
            temperaturePlaceholder="0.7"
            maxTokensPlaceholder="Déjelo en blanco para usar los valores predeterminados del sistema."
            modelEmptyText="Este proveedor de servicios no tiene modelos opcionales."
            manualModelPlaceholder="También puede ingresar el nombre del modelo manualmente"
            showProtocolFields={false}
          />

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-xs text-muted-foreground">
              Tareas a guardar {dirtyTaskTypes.length} ; detectar tareas anómalas {failedTaskTypes.length} ; ruta en blanco {emptyRouteTaskTypes.length} individual.
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => applyBulkDraftToRoutes(taskTypes)}
                disabled={!routeBulkDraft.provider.trim() || !routeBulkDraft.model.trim() || taskTypes.length === 0}
              >
                <CopyCheck className="h-4 w-4" />
                Aplicar a todas las tareas
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => applyBulkDraftToRoutes(failedTaskTypes)}
                disabled={!routeBulkDraft.provider.trim() || !routeBulkDraft.model.trim() || failedTaskTypes.length === 0}
              >
                <CopyCheck className="h-4 w-4" />
                Aplicar a tareas de excepción
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => applyBulkDraftToRoutes(emptyRouteTaskTypes)}
                disabled={!routeBulkDraft.provider.trim() || !routeBulkDraft.model.trim() || emptyRouteTaskTypes.length === 0}
              >
                <CopyCheck className="h-4 w-4" />
                Complete las tareas en blanco
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => saveAllModelRoutesMutation.mutate(
                  dirtyTaskTypes.map((taskType) => buildRouteSavePayload(taskType, getRouteDraft(taskType))),
                )}
                disabled={isSavingRoutes || dirtyTaskTypes.length === 0}
              >
                <Save className="h-4 w-4" />
                {saveAllModelRoutesMutation.isPending ? "Guardando..." : `Guardar todos los cambios${dirtyTaskTypes.length > 0 ? ` (${dirtyTaskTypes.length})` : ""}`}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Tolerancia a fallos de llamadas estructuradas</CardTitle>
          <CardDescription>
            Cuando el servidor está ocupado, se agota el tiempo de espera o se interrumpe la conexión, lo intentará nuevamente según la configuración; si aún falla, puede cambiar al modelo de respaldo.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <label className="flex flex-wrap items-center justify-between gap-3">
            <span className="space-y-1">
              <span className="block font-medium">Número de reintentos de error del lado del servidor</span>
              <span className="block text-sm text-muted-foreground">
                0 significa que no hay reintento; cada reintento reiniciará la llamada del modelo; el valor predeterminado es 1 vez.
              </span>
            </span>
            <span className="flex items-center gap-2">
              <input
                type="number"
                min="0"
                max="3"
                step="1"
                value={fallbackDraft.retryCount}
                onChange={(event) => patchStructuredFallbackDraft({ retryCount: event.target.value })}
                className="h-9 w-20 rounded-md border border-input bg-background px-2 text-sm"
                aria-label="Número de reintentos de error del lado del servidor"
              />
              <span className="text-sm text-muted-foreground">De segunda categoría</span>
            </span>
          </label>

          <div className="flex items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="font-medium">Habilitar modelos alternativos</div>
              <div className="text-sm text-muted-foreground">
                Se cambiará a este conjunto de modelos de respaldo después de que el modelo actual alcance la cantidad de reintentos y aún falle.
              </div>
            </div>
            <Switch
              checked={fallbackDraft.enabled}
              onCheckedChange={(checked) => patchStructuredFallbackDraft({ enabled: checked })}
            />
          </div>

          <ModelRouteFields
            draft={fallbackDraft}
            providerConfigs={providerConfigs}
            providerOptions={providerOptions}
            onPatch={patchStructuredFallbackDraft}
            temperaturePlaceholder="0.2"
            maxTokensPlaceholder="Déjelo en blanco para usar los valores predeterminados del sistema."
            modelEmptyText="Este proveedor de servicios no tiene modelos opcionales."
            manualModelPlaceholder="También puede ingresar el nombre del modelo manualmente"
          />

          <div className="flex items-center justify-end gap-2">
            <Button
              size="sm"
              onClick={() => saveStructuredFallbackMutation.mutate({
                enabled: fallbackDraft.enabled,
                provider: fallbackDraft.provider,
                model: fallbackDraft.model,
                temperature: Number(fallbackDraft.temperature || 0.2),
                maxTokens: fallbackDraft.maxTokens.trim() ? Number(fallbackDraft.maxTokens) : null,
                retryCount: parseStructuredRetryCount(fallbackDraft.retryCount),
              })}
              disabled={saveStructuredFallbackMutation.isPending || !fallbackDraft.provider.trim() || !fallbackDraft.model.trim()}
            >
              {saveStructuredFallbackMutation.isPending ? "Guardando..." : "Guardar la configuración de tolerancia a fallos"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {taskTypes.map((taskType) => {
        const draft = getRouteDraft(taskType);
        const label = MODEL_ROUTE_LABELS[taskType];
        const providerName = getProviderDisplayName(providerConfigs, draft.provider);
        const connectivity = connectivityMap.get(taskType);
        const connectivityState = resolveConnectivityState(
          connectivity,
          checkConnectivity.isPending,
        );
        const isDirty = dirtyTaskTypeSet.has(taskType);
        const matchesTest = connectivity && draft.provider === connectivity.provider && draft.model.trim() === connectivity.model
          && draft.requestProtocol === connectivity.testedProtocol && draft.structuredResponseFormat === connectivity.testedFormat;
        const recommendation = connectivity?.recommendation;
        const justCheckedDefault = checkConnectivity.data?.data?.testedAt === connectivitySummary.testedAt
          && !routeMap.has(taskType) && !isDirty;
        const canUseRecommendation = recommendation && (matchesTest || justCheckedDefault);

        return (
          <Card key={taskType}>
            <CardHeader>
              <CardTitle className="flex flex-wrap items-center gap-2">
                <span>{label.title}</span>
                <span className="inline-flex items-center gap-2 rounded-full border px-2 py-0.5 text-xs font-normal text-muted-foreground">
                  <RouteStatusDot state={connectivityState} />
                  {connectivityState === "healthy"
                    ? "La última prueba fue normal."
                    : connectivityState === "failed"
                      ? "Última anomalía detectada"
                      : connectivityState === "checking"
                        ? "Bajo detección"
                        : "No detectado"}
                </span>
                {isDirty ? <Badge variant="secondary">Ser salvo</Badge> : null}
              </CardTitle>
              <CardDescription>
                {label.description}
                <span className="ml-2 text-xs">Identificación:{taskType}</span>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <ModelRouteFields
                draft={draft}
                providerConfigs={providerConfigs}
                providerOptions={providerOptions}
                onPatch={(patch) => patchDraft(taskType, patch)}
                temperaturePlaceholder="0.7"
                maxTokensPlaceholder="Déjelo en blanco para usar los valores predeterminados del sistema."
                modelEmptyText="Este proveedor de servicios no tiene modelos opcionales."
                manualModelPlaceholder="También puede ingresar el nombre del modelo manualmente"
              />

              <div className="flex items-center justify-between gap-3">
                <div className="space-y-1 text-xs text-muted-foreground">
                  <div>{isDirty ? "Los cambios en el formulario entrarán en vigor después de guardarlos." : `Uso de tareas:${providerName}.`}</div>
                  <div className="flex flex-wrap items-center gap-2">
                    <RouteStatusDot state={connectivityState} />
                    <span>{formatConnectivityStatus(connectivity)}</span>
                  </div>
                  {connectivity?.structured ? (
                    <div>
                      Protocolo de solicitud:{connectivity.structured.requestProtocol ?? connectivity.requestProtocol ?? "Ninguno"}, Estrategia estructurada:{connectivity.structured.strategy ?? "Ninguno"},
                      {connectivity.structured.reasoningForcedOff ? "Cerrará pensando" : "Sigue pensando"},
                      {connectivity.structured.fallbackAvailable ? "Modelos alternativos disponibles" : "Modelo alternativo no habilitado"}
                    </div>
                  ) : null}
                  {connectivity && !matchesTest && !justCheckedDefault ? <div>La última prueba fue para la configuración actual. Puede comprobarlo nuevamente después de guardar los cambios.</div> : null}
                  {canUseRecommendation ? <div className="flex flex-wrap items-center gap-2">
                    <span>Acuerdo propuesto {recommendation.requestProtocol}, formato de salida {recommendation.structuredResponseFormat}.</span>
                    <Button type="button" variant="outline" size="sm" onClick={() => patchDraft(taskType, {
                      provider: connectivity!.provider, model: connectivity!.model, ...recommendation,
                    })}>Complete sugerencias</Button>
                    <span>Entrará en vigor después de hacer clic en "Guardar ruta".</span>
                  </div> : null}
                </div>
                <Button
                  size="sm"
                  onClick={() => saveModelRouteMutation.mutate(buildRouteSavePayload(taskType, draft))}
                  disabled={isSavingRoutes || !draft.provider.trim() || !draft.model.trim()}
                >
                  <Save className="h-4 w-4" />
                  guardar ruta
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}

      {actionResult ? <div className="text-sm text-muted-foreground">{actionResult}</div> : null}
    </div>
  );
}
