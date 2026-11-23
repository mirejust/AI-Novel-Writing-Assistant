import ModelCompatibilitySection from "./ModelCompatibilitySection";
import { useState } from "react";
import { Bot, ChevronDown, Image, RefreshCw, RotateCcw, Trash2, WalletCards, X } from "lucide-react";
import type { LLMProvider, ReasoningEffort } from "@ai-novel/shared/types/llm";
import type { APIKeyStatus, ProviderBalanceStatus } from "@/api/settings";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { AUTO_DIRECTOR_MOBILE_CLASSES } from "@/mobile/autoDirector";
import { ProviderRequestLimitSummary } from "./ProviderRequestLimitFields";
import { formatBalanceAmount, formatBalanceTime } from "../settingsFormatters";

export interface ProviderCardViewModel {
  provider: APIKeyStatus;
  balance?: ProviderBalanceStatus;
  isBalanceLoading: boolean;
  isBalanceRefreshing: boolean;
  canRefreshBalance: boolean;
  isReasoningUpdating: boolean;
  isTesting: boolean;
  testResult?: string;
}

function getBalanceSummary(input: {
  provider: APIKeyStatus;
  balance?: ProviderBalanceStatus;
  isBalanceLoading: boolean;
}) {
  const { provider, balance, isBalanceLoading } = input;
  if (provider.kind === "custom") {
    return "Los fabricantes personalizados no están conectados actualmente a la consulta de saldo.";
  }
  if (isBalanceLoading) {
    return "Consultando saldo...";
  }
  if (balance?.status === "available") {
    return `balance ${formatBalanceAmount(balance.availableBalance, balance.currency)}`;
  }
  return balance?.error ?? balance?.message ?? (provider.isConfigured ? "La información del saldo no está disponible actualmente." : "Primero configure la clave API.");
}

export default function ProviderStatusCard(props: {
  item: ProviderCardViewModel;
  onOpenConfig: (provider: LLMProvider) => void;
  onTest: (provider: APIKeyStatus) => void;
  onRefreshModels: (provider: LLMProvider) => void;
  onRefreshBalance: (provider: LLMProvider) => void;
  onSetReasoning: (provider: LLMProvider, reasoningEnabled: boolean, reasoningEffort?: ReasoningEffort) => void;
  onSetHiddenModels: (provider: LLMProvider, hiddenModels: string[], message: string) => void;
  onRemove: () => void;
  isRemoving: boolean;
  isRefreshingModels: boolean;
}) {
  const {
    item,
    onOpenConfig,
    onTest,
    onRefreshModels,
    onRefreshBalance,
    onSetReasoning,
    onSetHiddenModels,
    onRemove,
    isRemoving,
    isRefreshingModels,
  } = props;
  const { provider, balance } = item;
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [modelsOpen, setModelsOpen] = useState(false);
  const imageModelLabel = provider.supportsImageGeneration
    ? provider.currentImageModel || provider.defaultImageModel || "Sin configurar"
    : "La generación de imágenes no es compatible";
  const visibleModels = modelsOpen ? provider.models : provider.models.slice(0, 8);
  const canUseProvider = provider.isConfigured && provider.isActive && Boolean(provider.currentModel);
  const testDisabledReason = provider.isConfigured ? "" : "Después de configurar la clave API, puede probar la conexión.";
  const refreshDisabledReason = provider.isConfigured ? "" : "Después de configurar la clave API, puede actualizar la lista de modelos.";

  return (
    <div
      className={cn(
        "min-w-0 rounded-xl border bg-card p-4 shadow-sm transition-all hover:shadow-md",
        canUseProvider ? "border-primary/25 hover:border-primary/45" : "border-border",
      )}
    >
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <div className={`font-semibold ${AUTO_DIRECTOR_MOBILE_CLASSES.wrapText}`}>{provider.name}</div>
            {provider.kind === "custom" ? <Badge variant="outline">Personalizar</Badge> : null}
          </div>
          <div className={`text-xs text-muted-foreground ${AUTO_DIRECTOR_MOBILE_CLASSES.wrapText}`}>
            {canUseProvider ? "Puede utilizarse para tareas creativas." : "Después de completar la configuración, se puede utilizar para tareas creativas."}
          </div>
        </div>
        <Badge
          variant={canUseProvider ? "default" : "outline"}
          className={canUseProvider ? "bg-emerald-600 text-white hover:bg-emerald-600" : ""}
        >
          {canUseProvider ? "Disponible" : provider.isConfigured ? "Configurado" : "No configurado"}
        </Badge>
      </div>

      <div className="mb-3 grid min-w-0 gap-2 text-sm md:grid-cols-2">
        <div className="min-w-0 rounded-lg border bg-muted/25 p-3">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><Bot className="h-3.5 w-3.5" /> Modelo de texto</div>
          <div className={`mt-1 font-medium ${AUTO_DIRECTOR_MOBILE_CLASSES.wrapText}`}>
            {provider.currentModel || "-"}
          </div>
        </div>
        <div className="min-w-0 rounded-lg border bg-muted/25 p-3">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><Image className="h-3.5 w-3.5" /> Modelo de imagen</div>
          <div className={`mt-1 font-medium ${AUTO_DIRECTOR_MOBILE_CLASSES.wrapText}`}>
            {imageModelLabel}
          </div>
        </div>
      </div>

      <div className={`mb-3 flex items-center gap-2 rounded-lg bg-muted/35 px-3 py-2.5 text-sm text-muted-foreground ${AUTO_DIRECTOR_MOBILE_CLASSES.wrapText}`}>
        <WalletCards className="h-4 w-4 shrink-0 text-primary" />
        {getBalanceSummary({
          provider,
          balance,
          isBalanceLoading: item.isBalanceLoading,
        })}
      </div>

      {item.testResult ? (
        <div className={`mb-3 rounded-md border bg-background/70 p-3 text-sm text-muted-foreground ${AUTO_DIRECTOR_MOBILE_CLASSES.wrapText}`}>
          {item.testResult}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={() => onOpenConfig(provider.provider)}>
          {provider.kind === "custom" ? "Administrar conexiones" : "Configurar conexión"}
        </Button>
        <Button
          size="sm"
          variant="outline"
          title={testDisabledReason}
          onClick={() => onTest(provider)}
          disabled={!provider.isConfigured || item.isTesting}
        >
          {item.isTesting ? "Pruebas..." : "Conexión de prueba"}
        </Button>
      </div>

      <ModelCompatibilitySection key={`${provider.provider}:${provider.currentModel}:${provider.currentBaseURL}`} provider={provider} />

      <div className="mt-3 border-t pt-3">
        <button
          type="button"
          className="flex w-full items-center justify-between gap-2 text-left text-sm font-medium text-primary"
          aria-expanded={advancedOpen}
          onClick={() => setAdvancedOpen((prev) => !prev)}
        >
          <span>Detalles avanzados y mantenimiento.</span>
          <ChevronDown className={cn("h-4 w-4 transition-transform duration-200", advancedOpen ? "rotate-180" : "")} />
        </button>
      </div>

      {advancedOpen ? (
        <div className="mt-3 space-y-3">
          <div className="flex flex-wrap gap-2 border-b pb-3">
            <Button
              size="sm"
              variant="outline"
              title={refreshDisabledReason}
              onClick={() => onRefreshModels(provider.provider)}
              disabled={!provider.isConfigured || isRefreshingModels}
            >
              <RefreshCw className="h-3.5 w-3.5" /> {isRefreshingModels ? "Refrescante..." : "Actualizar modelo"}
            </Button>
            {provider.kind === "builtin" ? (
              <Button
                size="sm"
                variant="outline"
                title={item.canRefreshBalance ? "" : "Actualmente, los fabricantes no pueden actualizar el saldo directamente."}
                onClick={() => onRefreshBalance(provider.provider)}
                disabled={!item.canRefreshBalance || item.isBalanceRefreshing}
              >
                <WalletCards className="h-3.5 w-3.5" /> {item.isBalanceRefreshing ? "El saldo se está actualizando..." : "Actualizar saldo"}
              </Button>
            ) : null}
            <Button
              size="sm"
              variant="ghost"
              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={onRemove}
              disabled={isRemoving}
            >
              <Trash2 className="h-3.5 w-3.5" /> {isRemoving ? "Eliminando..." : provider.kind === "builtin" ? "Eliminar de la lista" : "Eliminar"}
            </Button>
          </div>
          <div className={`text-xs text-muted-foreground ${AUTO_DIRECTOR_MOBILE_CLASSES.wrapText}`}>
            Dirección API:{provider.currentBaseURL || "-"}
          </div>
          <ProviderRequestLimitSummary
            concurrencyLimit={provider.concurrencyLimit}
            requestIntervalMs={provider.requestIntervalMs}
          />
          <div className="flex flex-col gap-3 bg-background/60 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0 space-y-1">
              <div className="text-xs font-medium text-muted-foreground">Función de pensamiento</div>
              <div className={`text-xs text-muted-foreground ${AUTO_DIRECTOR_MOBILE_CLASSES.wrapText}`}>
                {provider.reasoningEnabled
                  ? "La solicitud de creación permite el pensamiento modelo; El contenido de pensamiento devuelto por el fabricante se mostrará en la transmisión en vivo de IA."
                  : "La petición de creación requerirá desconectar el pensamiento; el contenido de pensamiento aún devuelto por el fabricante permanecerá en la transmisión en vivo de IA."}
              </div>
            </div>
            {provider.supportsReasoningEffort ? (
              <select
                className="h-9 shrink-0 rounded-md border border-input bg-background px-3 text-sm"
                aria-label="Profundidad de pensamiento"
                disabled={item.isReasoningUpdating}
                value={provider.reasoningEnabled ? provider.reasoningEffort ?? "high" : "off"}
                onChange={(event) => {
                  const value = event.target.value;
                  if (value === "off") {
                    onSetReasoning(provider.provider, false);
                    return;
                  }
                  onSetReasoning(provider.provider, true, value as ReasoningEffort);
                }}
              >
                <option value="off">Cerrar</option>
                <option value="low">Bajo</option>
                <option value="high">Alto</option>
                <option value="max">Máximo</option>
              </select>
            ) : (
              <div className="flex shrink-0 items-center gap-2">
                <span className="text-xs text-muted-foreground">{provider.reasoningEnabled ? "Ya encendido" : "Cerrado"}</span>
              <Switch
                checked={provider.reasoningEnabled}
                disabled={item.isReasoningUpdating}
                  onCheckedChange={(checked) => onSetReasoning(provider.provider, checked)}
              />
              </div>
            )}
          </div>

          <div className="rounded-md border border-dashed bg-background/60 p-3">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <div className="text-xs font-medium text-muted-foreground">Detalles del saldo</div>
              {balance?.status === "available" ? (
                <Badge variant="outline">Actualizado recientemente {formatBalanceTime(balance.fetchedAt)}</Badge>
              ) : null}
            </div>
            {provider.kind === "custom" ? (
              <div className={`text-sm text-muted-foreground ${AUTO_DIRECTOR_MOBILE_CLASSES.wrapText}`}>
                Los fabricantes personalizados compatibles con OpenAI no están conectados actualmente a la consulta de saldo.
              </div>
            ) : balance?.status === "available" ? (
              <div className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
                {balance.cashBalance !== null ? <div>Saldo de caja:{formatBalanceAmount(balance.cashBalance, balance.currency)}</div> : null}
                {balance.voucherBalance !== null ? <div>Saldo del bono:{formatBalanceAmount(balance.voucherBalance, balance.currency)}</div> : null}
                {balance.chargeBalance !== null ? <div>Saldo de recarga:{formatBalanceAmount(balance.chargeBalance, balance.currency)}</div> : null}
                {balance.toppedUpBalance !== null ? <div>Recarga acumulada:{formatBalanceAmount(balance.toppedUpBalance, balance.currency)}</div> : null}
                {balance.grantedBalance !== null ? <div>Monto del regalo:{formatBalanceAmount(balance.grantedBalance, balance.currency)}</div> : null}
              </div>
            ) : (
              <div className={`text-sm text-muted-foreground ${AUTO_DIRECTOR_MOBILE_CLASSES.wrapText}`}>
                {balance?.error ?? balance?.message ?? (provider.isConfigured ? "La información del saldo no está disponible actualmente." : "Primero configure la clave API.")}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex min-w-0 flex-wrap gap-1">
              {visibleModels.map((model) => (
                <Badge
                  key={model}
                  variant={model === provider.currentModel ? "default" : "outline"}
                  className={model === provider.currentModel
                    ? "max-w-full whitespace-normal break-words bg-primary text-left [overflow-wrap:anywhere]"
                    : "max-w-full whitespace-normal break-words text-left [overflow-wrap:anywhere]"}
                >
                  <span>{model}</span>
                  <button
                    type="button"
                    className="ml-1 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full hover:bg-background/30 disabled:cursor-not-allowed disabled:opacity-45"
                    aria-label={`modelo oculto ${model}`}
                    title={model === provider.currentModel ? "El modelo está actualmente en uso, cámbielo primero y luego ocultelo." : `esconder ${model}`}
                    disabled={model === provider.currentModel || item.isReasoningUpdating}
                    onClick={() => onSetHiddenModels(
                      provider.provider,
                      [...provider.hiddenModels, model],
                      `Modelo oculto ${model}.`,
                    )}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
            {provider.models.length > 8 ? (
              <button
                type="button"
                className="text-xs font-medium text-primary transition-opacity hover:opacity-80"
                onClick={() => setModelsOpen((prev) => !prev)}
              >
                {modelsOpen ? "Contraer lista de modelos" : `Expandir todo ${provider.models.length} modelos`}
              </button>
            ) : null}
          </div>
          {provider.hiddenModels.length ? (
            <div className="space-y-2 border-t pt-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-xs font-medium text-muted-foreground">Modelo oculto</div>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={item.isReasoningUpdating}
                  onClick={() => onSetHiddenModels(provider.provider, [], "Todos los modelos ocultos han sido restaurados.")}
                >
                  <RotateCcw className="h-3.5 w-3.5" /> Restaurar todo
                </Button>
              </div>
              <div className="flex min-w-0 flex-wrap gap-1">
                {provider.hiddenModels.map((model) => (
                  <button
                    key={model}
                    type="button"
                    className="inline-flex max-w-full items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground disabled:opacity-50"
                    disabled={item.isReasoningUpdating}
                    onClick={() => onSetHiddenModels(
                      provider.provider,
                      provider.hiddenModels.filter((itemModel) => itemModel !== model),
                      `Modelo restaurado ${model}.`,
                    )}
                  >
                    <RotateCcw className="h-3 w-3 shrink-0" />
                    <span className="break-all">{model}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
