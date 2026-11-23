import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  CircleAlert,
  KeyRound,
  Loader2,
  PlugZap,
  ServerCog,
  Sparkles,
} from "lucide-react";
import type {
  CompleteQuickSetupRequest,
  QuickSetupProviderOption,
  QuickSetupStatus,
} from "@ai-novel/shared/types/onboarding";
import type { LLMProvider } from "@ai-novel/shared/types/llm";
import { completeQuickSetup } from "@/api/onboarding";
import { previewCustomProviderModels } from "@/api/settings";
import { queryKeys } from "@/api/queryKeys";
import { AppDialogContent, Dialog } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useLLMStore } from "@/store/llmStore";
import {
  shouldInitializeProviderSelection,
  shouldShowFirstNovelHandoff,
} from "./creationSetupState";

interface QuickSetupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  status: QuickSetupStatus | null;
  loading: boolean;
  error: boolean;
  onRetry: () => void;
  forceConfiguration?: boolean;
}

interface SetupForm {
  providerKind: "builtin" | "custom";
  provider: LLMProvider | "";
  customProviderName: string;
  apiKey: string;
  baseURL: string;
  model: string;
}

const EMPTY_FORM: SetupForm = {
  providerKind: "builtin",
  provider: "",
  customProviderName: "",
  apiKey: "",
  baseURL: "",
  model: "",
};

function providerDescription(provider: QuickSetupProviderOption): string {
  if (provider.id === "deepseek") return "Recomendado: DeepSeek, buena calidad en novelas largas y respuesta rápida";
  if (provider.id === "ollama") return "Usa un modelo local, sin API Key";
  if (provider.id === "openai") return "Adecuado para planificación general, redacción y tareas estructuradas";
  return provider.configured ? "Ya está configurado: puedes comprobarlo y usarlo como predeterminado global" : "Tras configurarlo, servirá para toda la cadena de producción de la novela";
}

export default function QuickSetupDialog(props: QuickSetupDialogProps) {
  const queryClient = useQueryClient();
  const llmStore = useLLMStore();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [form, setForm] = useState<SetupForm>(EMPTY_FORM);
  const [customModels, setCustomModels] = useState<string[]>([]);
  const [customModelsMessage, setCustomModelsMessage] = useState("");
  const [showAllProviderChoices, setShowAllProviderChoices] = useState(false);

  useEffect(() => {
    if (props.open && props.forceConfiguration) {
      setStep(1);
    }
  }, [props.forceConfiguration, props.open]);

  const selectedProvider = useMemo(
    () => props.status?.providers.find((provider) => provider.id === form.provider) ?? null,
    [form.provider, props.status?.providers],
  );
  const recommendedProvider = useMemo(
    () => props.status?.providers.find((provider) => provider.id === props.status?.selectedProvider)
      ?? props.status?.providers.find((provider) => provider.id === "deepseek")
      ?? props.status?.providers[0]
      ?? null,
    [props.status?.providers, props.status?.selectedProvider],
  );
  const preferredProvider = selectedProvider ?? recommendedProvider;
  const providerChoices: QuickSetupProviderOption[] = showAllProviderChoices
    ? props.status?.providers ?? []
    : preferredProvider ? [preferredProvider] : [];
  const modelOptions = form.providerKind === "custom"
    ? customModels
    : selectedProvider?.models ?? [];

  useEffect(() => {
    if (!shouldInitializeProviderSelection({
      open: props.open,
      statusAvailable: Boolean(props.status),
      providerKind: form.providerKind,
      provider: form.provider,
    })) {
      return;
    }
    if (!props.status) return;
    const preferred = props.status.providers.find(
      (provider) => provider.id === props.status?.selectedProvider,
    ) ?? props.status.providers.find((provider) => provider.id === "deepseek")
      ?? props.status.providers[0];
    if (!preferred) return;
    setForm({
      providerKind: preferred.kind,
      provider: preferred.id,
      customProviderName: preferred.kind === "custom" ? preferred.name : "",
      apiKey: "",
      baseURL: preferred.currentBaseURL || preferred.defaultBaseURL,
      model: preferred.currentModel || preferred.defaultModel,
    });
  }, [form.provider, form.providerKind, props.open, props.status]);

  const completeMutation = useMutation({
    mutationFn: (payload: CompleteQuickSetupRequest) => completeQuickSetup(payload),
    onSuccess: async (response) => {
      if (response.data) {
        llmStore.setSelection({
          provider: response.data.provider,
          model: response.data.model,
        });
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.settings.quickSetup }),
        queryClient.invalidateQueries({ queryKey: queryKeys.settings.apiKeys }),
        queryClient.invalidateQueries({ queryKey: queryKeys.settings.llmSelection }),
        queryClient.invalidateQueries({ queryKey: queryKeys.settings.modelRoutes }),
        queryClient.invalidateQueries({ queryKey: queryKeys.settings.modelRouteConnectivity }),
        queryClient.invalidateQueries({ queryKey: queryKeys.onboarding.firstNovel }),
      ]);
    },
  });

  const previewMutation = useMutation({
    mutationFn: () => previewCustomProviderModels({
      key: form.apiKey.trim() || undefined,
      baseURL: form.baseURL.trim(),
    }),
    onSuccess: (response) => {
      const models = response.data?.models ?? [];
      setCustomModels(models);
      setCustomModelsMessage(models.length > 0 ? `aparecer ${models.length} modelos disponibles.` : "La interfaz no devolvió una lista de modelos; puedes escribir el nombre a mano.");
      setForm((current) => ({ ...current, model: current.model.trim() || models[0] || "" }));
    },
    onError: (error) => {
      setCustomModels([]);
      setCustomModelsMessage(error instanceof Error ? error.message : "No se pudo obtener la lista de modelos; puedes escribir el nombre a mano.");
    },
  });

  const chooseProvider = (provider: QuickSetupProviderOption) => {
    setForm({
      providerKind: provider.kind,
      provider: provider.id,
      customProviderName: provider.kind === "custom" ? provider.name : "",
      apiKey: "",
      baseURL: provider.currentBaseURL || provider.defaultBaseURL,
      model: provider.currentModel || provider.defaultModel,
    });
    setCustomModels([]);
    setCustomModelsMessage("");
  };

  const chooseCustom = (continueToConnection = false) => {
    setForm({
      providerKind: "custom",
      provider: "",
      customProviderName: "",
      apiKey: "",
      baseURL: "",
      model: "",
    });
    setCustomModels([]);
    setCustomModelsMessage("");
    setShowAllProviderChoices(false);
    if (continueToConnection) {
      setStep(2);
    }
  };

  const canContinueProvider = form.providerKind === "custom" || Boolean(form.provider);
  const requiresApiKey = form.providerKind === "builtin" && selectedProvider?.requiresApiKey !== false;
  const hasSavedKey = selectedProvider?.configured === true;
  const canSubmit = Boolean(
    form.model.trim()
    && form.baseURL.trim()
    && (form.providerKind === "builtin" ? form.provider : form.customProviderName.trim())
    && (!requiresApiKey || form.apiKey.trim() || hasSavedKey),
  );
  const showFirstNovelHandoff = shouldShowFirstNovelHandoff({
    configurationSucceeded: completeMutation.isSuccess,
    forceConfiguration: props.forceConfiguration === true,
  });

  const submit = () => {
    setStep(3);
    completeMutation.mutate({
      providerKind: form.providerKind,
      ...(form.provider ? { provider: form.provider } : {}),
      ...(form.providerKind === "custom" ? { customProviderName: form.customProviderName.trim() } : {}),
      ...(form.apiKey.trim() ? { apiKey: form.apiKey.trim() } : {}),
      baseURL: form.baseURL.trim(),
      model: form.model.trim(),
    });
  };

  const footer = props.loading || props.error || (props.status?.readyForCreation && !props.forceConfiguration)
    ? null
    : step === 1
      ? (
          <Button onClick={() => setStep(2)} disabled={!canContinueProvider}>
            Complete la información de conexión <ArrowRight className="h-4 w-4" />
          </Button>
        )
      : step === 2
        ? (
            <>
              <Button variant="ghost" onClick={() => setStep(1)}><ArrowLeft className="h-4 w-4" /> Volver a la selección</Button>
              <Button onClick={submit} disabled={!canSubmit}>Detectar y completar la configuración <PlugZap className="h-4 w-4" /></Button>
            </>
          )
        : completeMutation.isSuccess
          ? (
              showFirstNovelHandoff
                ? (
                    <>
                      <Button variant="outline" asChild><Link to="/help">Ver la guía de creación</Link></Button>
                      <Button asChild><Link to="/novels/auto-director">Comienza tu primera novela con una frase. <ArrowRight className="h-4 w-4" /></Link></Button>
                    </>
                  )
                : (
                    <>
                      <Button variant="outline" asChild><Link to="/settings">Ver ajustes avanzados</Link></Button>
                      <Button onClick={() => props.onOpenChange(false)}>Empezar a crear <Sparkles className="h-4 w-4" /></Button>
                    </>
                  )
            )
          : completeMutation.isError
            ? (
                <Button variant="outline" onClick={() => setStep(2)}><ArrowLeft className="h-4 w-4" /> Modificar configuración</Button>
              )
            : null;

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <AppDialogContent
        className="max-w-3xl"
        title="Pon en marcha el entorno de creación con IA"
        description="Configura un solo modelo de texto y el sistema preparará automáticamente las tareas de planificación, redacción, revisión y corrección."
        footer={footer}
        footerClassName="gap-2"
      >
        <div className="mb-6 grid grid-cols-3 gap-2">
          {[
            { index: 1, label: "Elegir proveedor" },
            { index: 2, label: "Conectar modelo" },
            { index: 3, label: "Comprobación finalizada" },
          ].map((item) => (
            <div key={item.index} className={cn(
              "rounded-lg border px-3 py-2 text-xs",
              step === item.index ? "border-primary bg-primary/5 text-primary" : step > item.index ? "border-emerald-300 bg-emerald-50 text-emerald-800" : "text-muted-foreground",
            )}>
              <div className="flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-full border text-[11px]">
                  {step > item.index ? <Check className="h-3 w-3" /> : item.index}
                </span>
                {item.label}
              </div>
            </div>
          ))}
        </div>

        {props.loading ? (
          <div className="flex min-h-56 items-center justify-center text-sm text-muted-foreground">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Comprobando el entorno de creación
          </div>
        ) : props.error ? (
          <div className="flex min-h-56 flex-col items-center justify-center gap-4 text-center">
            <CircleAlert className="h-9 w-9 text-amber-600" />
            <div>
              <div className="font-semibold">No se puede leer la configuración del modelo por ahora</div>
              <div className="mt-1 text-sm text-muted-foreground">Tras recargar, el sistema volverá a comprobar si puedes empezar a crear.</div>
            </div>
            <Button variant="outline" onClick={props.onRetry}>Recargar</Button>
          </div>
        ) : props.status?.readyForCreation && !props.forceConfiguration && !completeMutation.isSuccess ? (
          <div className="flex min-h-56 flex-col items-center justify-center gap-4 text-center">
            <CheckCircle2 className="h-10 w-10 text-emerald-600" />
            <div>
              <div className="text-lg font-semibold">El entorno de creación está listo</div>
              <div className="mt-2 text-sm text-muted-foreground">
                {props.status.selectedProvider} · {props.status.selectedModel},{props.status.routeCoverage.total} Todas las tareas principales están listas.
              </div>
            </div>
            <Button onClick={() => props.onOpenChange(false)}>Seguir creando</Button>
          </div>
        ) : step === 1 ? (
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold">{showAllProviderChoices ? "Elige un proveedor integrado" : "Empieza con la opción recomendada"}</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {showAllProviderChoices
                  ? "Elige un proveedor y después introduce los datos de conexión."
                  : "Configura un modelo de texto para empezar; elige otros proveedores cuando los necesites."}
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {providerChoices.map((provider) => (
                <button
                  key={provider.id}
                  type="button"
                  className={cn(
                    "rounded-xl border p-4 text-left transition hover:border-primary/50 hover:bg-primary/5",
                    form.provider === provider.id && "border-primary bg-primary/5 ring-1 ring-primary/20",
                  )}
                  onClick={() => chooseProvider(provider)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold">{provider.name}</div>
                      <div className="mt-1 text-xs leading-5 text-muted-foreground">{providerDescription(provider)}</div>
                    </div>
                    {form.provider === provider.id
                      ? <Badge>Seleccionado</Badge>
                      : provider.configured ? <Badge variant="outline">Ya configurado</Badge> : null}
                  </div>
                <div className="mt-3 text-xs text-muted-foreground">Modelo recomendado:{provider.currentModel || provider.defaultModel}</div>
              </button>
              ))}
              {!showAllProviderChoices ? (
                <button
                  type="button"
                  className="rounded-xl border border-dashed p-4 text-left transition hover:border-primary/50 hover:bg-primary/5"
                  onClick={() => setShowAllProviderChoices(true)}
                >
                  <div className="flex items-center gap-2 font-semibold"><PlugZap className="h-4 w-4" /> Ver todos los proveedores integrados</div>
                  <div className="mt-2 text-xs leading-5 text-muted-foreground">Elige el proveedor con el que ya tienes cuenta y continúa con los datos de conexión.</div>
                </button>
              ) : null}
              <button
                type="button"
                className={cn(
                  "rounded-xl border border-dashed p-4 text-left transition hover:border-primary/50 hover:bg-primary/5",
                  form.providerKind === "custom" && !form.provider && "border-primary bg-primary/5 ring-1 ring-primary/20",
                )}
                onClick={() => chooseCustom(true)}
              >
                <div className="flex items-center gap-2 font-semibold"><ServerCog className="h-4 w-4" /> Agregar proveedores externos <ArrowRight className="h-4 w-4" /></div>
                <div className="mt-2 text-xs leading-5 text-muted-foreground">Crea una configuración de proveedor independiente para servicios intermediarios, pasarelas locales o interfaces compatibles con OpenAI.</div>
              </button>
            </div>
            {showAllProviderChoices ? (
              <Button type="button" variant="ghost" size="sm" onClick={() => setShowAllProviderChoices(false)}>
                <ArrowLeft className="h-4 w-4" /> Volver al plan recomendado
              </Button>
            ) : null}
          </div>
        ) : step === 2 ? (
          <div className="space-y-5">
            <div>
              <h3 className="font-semibold">{form.providerKind === "custom" ? "Añadir proveedor externo" : `conectar ${selectedProvider?.name ?? "Proveedor de modelos"}`}</h3>
              <p className="mt-1 text-sm text-muted-foreground">La API Key solo se guarda en el almacén de claves local o del servidor y no se muestra en el resultado.</p>
              {form.providerKind === "custom" ? (
                <p className="mt-1 text-xs text-muted-foreground">El nombre del proveedor, la dirección de la API y el modelo se guardan como una configuración aparte, sin sobrescribir los proveedores integrados.</p>
              ) : null}
            </div>
            {form.providerKind === "custom" ? (
              <label className="block space-y-1.5">
                <span className="text-sm font-medium">Nombre del proveedor</span>
                <Input value={form.customProviderName} placeholder="Por ejemplo: mi pasarela de modelos" onChange={(event) => setForm((current) => ({ ...current, customProviderName: event.target.value }))} />
              </label>
            ) : null}
            <label className="block space-y-1.5">
              <span className="flex items-center gap-2 text-sm font-medium"><KeyRound className="h-4 w-4" /> API Key {requiresApiKey ? "" : "(opcional)"}</span>
              <Input
                type="password"
                autoComplete="off"
                value={form.apiKey}
                placeholder={hasSavedKey ? "Déjalo vacío para seguir usando la clave guardada" : requiresApiKey ? "Introduce la API Key" : "Puedes dejarlo vacío para servicios locales"}
                onChange={(event) => setForm((current) => ({ ...current, apiKey: event.target.value }))}
              />
            </label>
            <label className="block space-y-1.5">
              <span className="text-sm font-medium">Dirección de la API</span>
              <Input value={form.baseURL} placeholder="https://api.example.com/v1" onChange={(event) => setForm((current) => ({ ...current, baseURL: event.target.value }))} />
            </label>
            {form.providerKind === "custom" ? (
              <div className="flex flex-wrap items-center gap-3">
                <Button type="button" variant="outline" size="sm" onClick={() => previewMutation.mutate()} disabled={!form.baseURL.trim() || previewMutation.isPending}>
                  {previewMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ServerCog className="h-4 w-4" />}
                  Obtener lista de modelos
                </Button>
                {customModelsMessage ? <span className="text-xs text-muted-foreground">{customModelsMessage}</span> : null}
              </div>
            ) : null}
            {modelOptions.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {modelOptions.slice(0, 8).map((model) => (
                  <button
                    key={model}
                    type="button"
                    className={cn("rounded-full border px-3 py-1.5 text-xs", form.model === model && "border-primary bg-primary/10 text-primary")}
                    onClick={() => setForm((current) => ({ ...current, model }))}
                  >
                    {model}
                  </button>
                ))}
              </div>
            ) : null}
            <label className="block space-y-1.5">
              <span className="text-sm font-medium">Modelo de texto</span>
              <Input value={form.model} placeholder="Elige un modelo arriba o escribe su nombre" onChange={(event) => setForm((current) => ({ ...current, model: event.target.value }))} />
            </label>
            <div className="rounded-lg border bg-muted/20 p-3 text-xs leading-5 text-muted-foreground">
              Una vez completado, este modelo sirve como valor inicial predeterminado para tareas centrales como planificar, escribir, revisar, arreglar, replanificar y resumir.
            </div>
          </div>
        ) : (
          <div className="flex min-h-64 flex-col items-center justify-center gap-4 text-center">
            {completeMutation.isPending ? (
              <>
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
                  <Loader2 className="h-7 w-7 animate-spin text-primary" />
                </div>
                <div>
                  <div className="text-lg font-semibold">Comprobando texto normal y salida estructurada</div>
                  <div className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">Cuando la comprobación pase, el sistema preparará todas las tareas creativas esenciales sin configurar cada ruta.</div>
                </div>
              </>
            ) : completeMutation.isSuccess ? (
              <>
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100">
                  <CheckCircle2 className="h-8 w-8 text-emerald-700" />
                </div>
                <div>
                  <div className="text-lg font-semibold">Entorno de creación configurado</div>
                  <div className="mt-2 text-sm text-muted-foreground">{completeMutation.data.data?.model} Ya disponible para toda la cadena de producción de novelas.</div>
                </div>
                {showFirstNovelHandoff ? (
                  <div className="w-full max-w-xl rounded-2xl border border-primary/15 bg-primary/[0.035] p-5 text-left shadow-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="text-sm font-semibold text-primary">Empezar la primera novela</div>
                      <Link to="/settings" className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">Configurar más modelos</Link>
                    </div>
                    <h3 className="mt-2 text-xl font-semibold tracking-tight">Empieza con una idea que quieras escribir</h3>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">Dígale a la IA lo que quiere escribir y primero le sugerirá posibles direcciones; Una vez elegido, continúa preparando la historia, el mundo, los personajes y el primer capítulo.</p>
                    <div className="mt-4 grid gap-2 sm:grid-cols-3">
                      {["Cuenta la idea", "Elige el rumbo", "Lee el primer capítulo"].map((label, index) => (
                        <div key={label} className="rounded-xl border bg-background/80 px-3 py-2.5 text-sm font-medium">
                          <span className="mr-2 text-primary">{index + 1}</span>{label}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </>
            ) : (
              <>
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-amber-100">
                  <CircleAlert className="h-8 w-8 text-amber-700" />
                </div>
                <div>
                  <div className="text-lg font-semibold">La comprobación del modelo no ha pasado</div>
                  <div className="mt-2 max-w-lg text-sm leading-6 text-destructive">
                    {completeMutation.error instanceof Error ? completeMutation.error.message : "Revisa la API Key, la dirección y el nombre del modelo, y vuelve a intentarlo."}
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </AppDialogContent>
    </Dialog>
  );
}
