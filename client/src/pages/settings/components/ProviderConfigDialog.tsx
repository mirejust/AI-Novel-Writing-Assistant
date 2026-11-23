import type { Dispatch, SetStateAction } from "react";
import { Bot, Image, KeyRound, Link2, SlidersHorizontal } from "lucide-react";
import type { APIKeyStatus } from "@/api/settings";
import type { ProviderAuthMode } from "@ai-novel/shared/types/llm";
import SearchableSelect from "@/components/common/SearchableSelect";
import { Button } from "@/components/ui/button";
import { AppDialogContent, Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import ProviderRequestLimitFields from "./ProviderRequestLimitFields";

export interface ProviderFormState {
  displayName: string;
  key: string;
  model: string;
  imageModel: string;
  baseURL: string;
  authMode: ProviderAuthMode;
  concurrencyLimit: string;
  requestIntervalMs: string;
}

interface ProviderConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isCreatingCustomProvider: boolean;
  isCustomDialog: boolean;
  editingConfig?: APIKeyStatus;
  form: ProviderFormState;
  setForm: Dispatch<SetStateAction<ProviderFormState>>;
  selectableModels: string[];
  previewModelsResult: string;
  isPreviewingModels: boolean;
  onClearPreviewModels: () => void;
  onPreviewModels: () => void;
  onSubmit: () => void;
  submitDisabled: boolean;
  submitLabel: string;
  onTest: () => void;
  testDisabled: boolean;
  testResult: string;
  onDeleteCustomProvider: () => void;
  deleteDisabled: boolean;
  deleteLabel: string;
}

export default function ProviderConfigDialog({
  open,
  onOpenChange,
  isCreatingCustomProvider,
  isCustomDialog,
  editingConfig,
  form,
  setForm,
  selectableModels,
  previewModelsResult,
  isPreviewingModels,
  onClearPreviewModels,
  onPreviewModels,
  onSubmit,
  submitDisabled,
  submitLabel,
  onTest,
  testDisabled,
  testResult,
  onDeleteCustomProvider,
  deleteDisabled,
  deleteLabel,
}: ProviderConfigDialogProps) {
  const primaryModelLabel = isCreatingCustomProvider ? "Modelo predeterminado (opcional)" : isCustomDialog ? "Modelo predeterminado" : "Nombre del modelo";
  const canSelectListedModels = selectableModels.length > 0;
  const imageModelOptions = editingConfig?.imageModels ?? [];
  const canSelectImageModels = imageModelOptions.length > 0;
  const modelGuidance = editingConfig?.provider === "deepseek"
    ? "Se recomienda utilizar DeepSeek Flash, que tiene en cuenta la calidad y la velocidad de respuesta de los artículos largos chinos; También puedes elegir otros modelos disponibles."
    : isCreatingCustomProvider
      ? "Después de obtener la lista de modelos, el primer modelo disponible se completará automáticamente; cuando la interfaz no devuelve la lista, se puede completar manualmente."
      : editingConfig?.kind === "custom" && !canSelectListedModels
        ? "Puede hacer clic en \"Actualizar modelo\" en la tarjeta del fabricante para obtener la lista, o puede completar manualmente el modelo predeterminado."
        : "Si no hay ningún modelo de destino en la lista, puede ingresarlo manualmente.";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <AppDialogContent
        className="max-w-lg"
        title={isCreatingCustomProvider ? "Agregar fabricante personalizado" : isCustomDialog ? "Editar fabricante personalizado" : "Proveedor del modelo de configuración"}
        footer={(
          <>
            <Button className="w-full sm:w-auto" onClick={onSubmit} disabled={submitDisabled}>
              {submitLabel}
            </Button>

            <Button
              variant="secondary"
              className="w-full sm:w-auto"
              onClick={onTest}
              disabled={testDisabled}
            >
              conexión de prueba
            </Button>

            {editingConfig?.kind === "custom" ? (
              <Button
                variant="destructive"
                className="w-full sm:w-auto"
                onClick={onDeleteCustomProvider}
                disabled={deleteDisabled}
              >
                {deleteLabel}
              </Button>
            ) : null}
          </>
        )}
        footerClassName="gap-2"
      >
        <div className="space-y-5">
          {isCustomDialog ? (
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground">Nombre del proveedor</div>
              <Input
                value={form.displayName}
                placeholder="Por ejemplo: mi pasarela de modelos"
                onChange={(event) => setForm((prev) => ({ ...prev, displayName: event.target.value }))}
              />
            </div>
          ) : null}

          {(isCustomDialog || editingConfig?.requiresApiKey === false) ? (
            <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              La clave API se puede dejar en blanco; Después de completar la dirección API, puede obtener la lista de modelos y el sistema seleccionará un modelo predeterminado.
            </div>
          ) : null}

          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground"><KeyRound className="h-3.5 w-3.5" /> API Key</div>
            <Input
              type="password"
              value={form.key}
              placeholder={editingConfig?.isConfigured ? "Déjelo en blanco para usar la clave API guardada" : "Introduce la API Key"}
              onChange={(event) => {
                setForm((prev) => ({ ...prev, key: event.target.value }));
                if (isCreatingCustomProvider) {
                  onClearPreviewModels();
                }
              }}
            />
          </div>

          {isCustomDialog ? (
            <div className="space-y-1">
              <div className="text-xs font-medium text-muted-foreground">Método de autenticación</div>
              <SearchableSelect
                value={form.authMode}
                onValueChange={(value) => setForm((prev) => ({
                  ...prev,
                  authMode: value as ProviderAuthMode,
                }))}
                options={[
                  { value: "bearer", label: "Authorization: Bearer" },
                  { value: "x-api-key", label: "x-api-key" },
                  { value: "none", label: "No se requiere autenticación" },
                ]}
                placeholder="Seleccione el método de autenticación"
              />
              <div className="text-xs text-muted-foreground">
                Seleccionar mediante documentación de interfaz de terceros; la mayoría de las interfaces compatibles con OpenAI utilizan Autorización: Portador.
              </div>
            </div>
          ) : null}

          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground"><Link2 className="h-3.5 w-3.5" /> Dirección de la API</div>
            <Input
              value={form.baseURL}
              placeholder={editingConfig?.defaultBaseURL ?? "https://api.example.com/v1"}
              onChange={(event) => {
                setForm((prev) => ({
                  ...prev,
                  baseURL: event.target.value,
                  model: isCreatingCustomProvider ? "" : prev.model,
                }));
                if (isCreatingCustomProvider) {
                  onClearPreviewModels();
                }
              }}
            />
            <div className="text-xs text-muted-foreground">
              {isCreatingCustomProvider
                ? "Complete la dirección API compatible con OpenAI, que generalmente termina en /v1; una dirección local común de Ollama es http://127.0.0.1:11434/v1."
                : "Déjelo en blanco para utilizar la dirección predeterminada; una dirección local común de Ollama es http://127.0.0.1:11434/v1."}
            </div>
          </div>

          {isCreatingCustomProvider ? (
            <div className="space-y-2">
              <Button
                type="button"
                variant="secondary"
                className="w-full sm:w-auto"
                onClick={onPreviewModels}
                disabled={isPreviewingModels || !form.baseURL.trim()}
              >
                {isPreviewingModels ? "Conseguir..." : "Obtener lista de modelos"}
              </Button>
              {previewModelsResult ? (
                <div className="break-words text-xs text-muted-foreground [overflow-wrap:anywhere]">
                  {previewModelsResult}
                </div>
              ) : null}
            </div>
          ) : null}

          {canSelectListedModels ? (
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground">Modelos disponibles</div>
              <SearchableSelect
                value={form.model}
                onValueChange={(value) => setForm((prev) => ({ ...prev, model: value }))}
                options={selectableModels.map((model) => ({ value: model }))}
                placeholder="Seleccionar modelo"
                searchPlaceholder="Modelo de búsqueda"
                emptyText="Ningún modelo disponible"
              />
            </div>
          ) : null}

          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground"><Bot className="h-3.5 w-3.5" /> {primaryModelLabel}</div>
            <div className="text-xs text-muted-foreground">{modelGuidance}</div>
          </div>
          <Input
            value={form.model}
            placeholder="También puede ingresar directamente el nombre del modelo manualmente"
            onChange={(event) => setForm((prev) => ({ ...prev, model: event.target.value }))}
          />

          <div className="space-y-3 rounded-xl border bg-muted/20 p-4">
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground"><Image className="h-3.5 w-3.5" /> Modelo de imagen (opcional)</div>
              <div className="text-xs text-muted-foreground">
                Después de completarlo, se puede seleccionar este fabricante para la generación de imágenes de personajes; dejarlo en blanco solo se usará para modelos de texto.
              </div>
            </div>
            {canSelectImageModels ? (
              <div className="space-y-1">
                <SearchableSelect
                  value={form.imageModel}
                  onValueChange={(value) => setForm((prev) => ({ ...prev, imageModel: value }))}
                  options={imageModelOptions.map((model) => ({ value: model }))}
                  placeholder="Seleccionar modelo de imagen"
                  searchPlaceholder="Buscar modelos de imagen"
                  emptyText="No hay modelo de imagen disponible"
                />
              </div>
            ) : null}
            <Input
              value={form.imageModel}
              placeholder={editingConfig?.defaultImageModel ?? "Ingrese el nombre del modelo de imagen"}
              onChange={(event) => setForm((prev) => ({ ...prev, imageModel: event.target.value }))}
            />
            <div className="text-xs text-muted-foreground">
              La generación de imágenes llamará a la interfaz de imágenes compatible con OpenAI de este proveedor.
            </div>
          </div>

          <div className="rounded-xl border border-dashed bg-muted/10 p-4">
            <div className="mb-3 flex items-center gap-1.5 text-xs font-medium text-muted-foreground"><SlidersHorizontal className="h-3.5 w-3.5" /> Límites de solicitud</div>
            <ProviderRequestLimitFields
              concurrencyLimit={form.concurrencyLimit}
              requestIntervalMs={form.requestIntervalMs}
              onChange={(value) => setForm((prev) => ({ ...prev, ...value }))}
            />
          </div>

          {testResult ? <div className="break-words text-sm text-muted-foreground [overflow-wrap:anywhere]">{testResult}</div> : null}
        </div>
      </AppDialogContent>
    </Dialog>
  );
}
