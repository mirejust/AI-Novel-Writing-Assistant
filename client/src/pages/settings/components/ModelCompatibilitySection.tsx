import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { APIKeyStatus } from "@/api/settings";
import { apiClient } from "@/api/client";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";

interface CapabilityResult {
  profile: { structuredModes: string[]; failedModes: string[]; thinkingToggle: { supported: boolean; control: string; effort: boolean }; source: string; probedAt?: string; maxOutputTokens?: number };
  status: { state: string; checkedAt?: string; message?: string };
  autoProbe: boolean;
}
export default function ModelCompatibilitySection({ provider }: { provider: APIKeyStatus }) {
  const queryClient = useQueryClient();
  const [error, setError] = useState("");
  const [mode, setMode] = useState("");
  const [control, setControl] = useState("");
  const [outputLimit, setOutputLimit] = useState<string | null>(null);
  const key = ["model-compat", provider.provider, provider.currentModel, provider.currentBaseURL];
  const url = `/settings/model-compat/${provider.provider}`;
  const query = useQuery({ queryKey: key, queryFn: async () => (await apiClient.get<{ data: CapabilityResult }>(url)).data.data,
    enabled: provider.isConfigured, refetchInterval: (query) => query.state.data?.status.state === "running" ? 1500 : false });
  const probe = useMutation({ mutationFn: () => apiClient.post(url + "/probe", { model: provider.currentModel, baseURL: provider.currentBaseURL, allowNetwork: true }),
    onSuccess: () => { setError(""); void queryClient.invalidateQueries({ queryKey: key }); }, onError: () => setError("No se puede iniciar la detección. Verifique la conexión e inténtelo nuevamente.") });
  const consent = useMutation({ mutationFn: (autoProbe: boolean) => apiClient.put(url, { autoProbe }),
    onSuccess: () => { setError(""); void queryClient.invalidateQueries({ queryKey: key }); }, onError: () => setError("No se pudo guardar la configuración de detección. Inténtelo de nuevo.") });
  const override = useMutation({ mutationFn: () => {
    const profile = query.data!.profile;
    const selectedMode = mode || profile.structuredModes[0];
    const selectedControl = control || profile.thinkingToggle.control;
    const ordered = ["json_schema", "json_object", "tool_calling", "prompt_only"];
    return apiClient.put(url, { override: { ...profile, source: "user_override", failedModes: [],
      structuredModes: ordered.slice(ordered.indexOf(selectedMode)),
      thinkingToggle: { ...profile.thinkingToggle, supported: selectedControl !== "none", control: selectedControl } } });
  }, onSuccess: () => { setError(""); void queryClient.invalidateQueries({ queryKey: key }); }, onError: () => setError("No se pudo guardar la capacidad especificada, inténtelo de nuevo.") });
  const data = query.data;
  const saveOutputLimit = useMutation({ mutationFn: () => apiClient.put(url, {
    override: { ...data!.profile, source: "user_override", maxOutputTokens: (outputLimit ?? data!.profile.maxOutputTokens ?? "") === "" ? undefined : Number(outputLimit ?? data!.profile.maxOutputTokens) },
  }), onSuccess: () => { setError(""); setOutputLimit(null); void queryClient.invalidateQueries({ queryKey: key }); },
    onError: () => setError("No se pudo guardar el límite superior de salida. Inténtelo de nuevo.") });
  const labels: Record<string, string> = { json_schema: "JSON estricto", json_object: "JSON", tool_calling: "Llamada de herramienta", prompt_only: "Restricciones de solicitud JSON" };
  return <section className="space-y-2 border-t pt-3 text-sm">
    <div className="font-medium">Compatibilidad del modelo</div>
    {data ? <form className="space-y-2" onSubmit={(event) => { event.preventDefault(); saveOutputLimit.mutate(); }}>
      <label className="flex flex-wrap items-center gap-2">Límite superior de salida del modelo actual (Token)
        <Input type="number" min={1} max={1048576} step={1} className="w-40" placeholder="Usar presupuesto de tarea"
          value={outputLimit ?? data.profile.maxOutputTokens ?? ""} onChange={(event) => setOutputLimit(event.target.value)} />
      </label>
      <p className="text-xs text-muted-foreground">para {provider.currentModel} Establezca una cuota de salida única, adecuada para texto y generación estructurada; déjelo en blanco para utilizar el presupuesto de la tarea. Los modelos de conmutación se pueden configurar individualmente.</p>
      <Button size="sm" variant="outline" type="submit" disabled={saveOutputLimit.isPending}>Guardar límite superior de salida</Button>
    </form> : null}
    <p className="text-xs text-muted-foreground">La detección envía una pequeña cantidad de solicitudes pagas para ayudar a seleccionar los métodos de salida disponibles y los cambios de pensamiento.</p>
    <label className="flex items-center gap-2"><Switch checked={data?.autoProbe ?? false} disabled={!data || consent.isPending} onCheckedChange={(value) => consent.mutate(value)} />Detección automática al guardar o cambiar de modelo</label>
    <Button size="sm" variant="outline" disabled={!provider.isConfigured || probe.isPending || data?.status.state === "running"} onClick={() => probe.mutate()}>{data?.status.state === "running" ? "Detectando…" : "Redetectar"}</Button>
    {data ? <div className="space-y-1 text-xs text-muted-foreground" role="status">
      <div>{data.status.message ?? "La compatibilidad del modelo se puede detectar manualmente."} {data.status.checkedAt ? new Date(data.status.checkedAt).toLocaleString() : ""}</div>
      <div>Modo de salida:{data.profile.structuredModes.filter((mode) => !data.profile.failedModes.includes(mode)).map((mode) => labels[mode]).join(" → ")}</div>
      <div>Pensamientos finales:{data.profile.thinkingToggle.supported ? "Apoyo" : "Soporte no confirmado"}{data.profile.probedAt ? ` · Último resultado ${new Date(data.profile.probedAt).toLocaleString()}` : " · Utilizar capacidades predeterminadas"}</div>
    </div> : null}
    {provider.kind === "custom" && data ? <details className="text-xs">
      <summary className="cursor-pointer">Especificar capacidades de servicio personalizadas</summary>
      <div className="mt-2 space-y-2">
        <label className="flex items-center gap-2">Modo de salida prioritario<select className="rounded border bg-background p-1" value={mode || data.profile.structuredModes[0]} onChange={(event) => setMode(event.target.value)}>{Object.entries(labels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label className="flex items-center gap-2">Piense en los parámetros de control<select className="rounded border bg-background p-1" value={control || data.profile.thinkingToggle.control} onChange={(event) => setControl(event.target.value)}>{["none", "thinking", "thinking_boolean", "enable_thinking", "reasoning_effort"].map((value) => <option key={value} value={value}>{value === "none" ? "No especificado" : value}</option>)}</select></label>
        <Button size="sm" variant="outline" disabled={override.isPending} onClick={() => override.mutate()}>Guardar capacidades especificadas</Button>
        <p className="text-muted-foreground">Las capacidades especificadas tienen prioridad sobre los resultados de la detección y son adecuadas para conexiones en las que el proveedor de servicios proporciona descripciones claras de los parámetros.</p>
      </div>
    </details> : null}
    {query.isError || error ? <p role="alert" className="text-xs text-destructive">{error || "No se pudo leer la información de compatibilidad."}</p> : null}
  </section>;
}
