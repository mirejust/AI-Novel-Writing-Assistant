import type { APIKeyStatus } from "@/api/settings";
import {DEFAULT_MODEL_OUTPUT_TOKENS} from "@ai-novel/shared/types/llm";
import SearchableSelect from "@/components/common/SearchableSelect";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  getModelOptions,
  getPreferredModel,
  getProviderConfig,
  getProviderDisplayName,
  getStructuredResponseFormatOptions,
  type RouteDraft,
} from "./modelRoutes.utils";
import type {
  ModelRouteRequestProtocol,
  ModelRouteStructuredResponseFormat,
} from "@ai-novel/shared/types/novel";

interface ModelRouteFieldsProps {
  draft: RouteDraft;
  providerConfigs: APIKeyStatus[];
  providerOptions: string[];
  onPatch: (patch: Partial<RouteDraft>) => void;
  temperaturePlaceholder: string;
  maxTokensPlaceholder: string;
  modelEmptyText: string;
  manualModelPlaceholder: string;
  showProtocolFields?: boolean;
}

export default function ModelRouteFields({
  draft,
  providerConfigs,
  providerOptions,
  onPatch,
  temperaturePlaceholder,
  maxTokensPlaceholder,
  modelEmptyText,
  manualModelPlaceholder,
  showProtocolFields = true,
}: ModelRouteFieldsProps) {
  const modelOptions = getModelOptions(providerConfigs, draft.provider, draft.model);

  return (
    <div className={`grid gap-3 ${showProtocolFields ? "md:grid-cols-6" : "md:grid-cols-4"}`}>
      <div className="space-y-1">
        <div className="text-xs text-muted-foreground">Proveedor de servicios</div>
        <Select
          value={draft.provider}
          onValueChange={(value) => {
            const nextModel = getPreferredModel(getProviderConfig(providerConfigs, value));
            onPatch({
              provider: value,
              model: nextModel || draft.model,
            });
          }}
        >
          <SelectTrigger aria-label="Proveedor de servicios">
            <SelectValue placeholder="Elija un proveedor de servicios" />
          </SelectTrigger>
          <SelectContent>
            {providerOptions.map((provider) => (
              <SelectItem key={provider} value={provider}>
                {getProviderDisplayName(providerConfigs, provider)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1">
        <div className="text-xs text-muted-foreground">Modelo</div>
        <SearchableSelect
          value={draft.model || undefined}
          onValueChange={(value) => onPatch({ model: value })}
          options={modelOptions.map((model) => ({ value: model }))}
          placeholder="Seleccionar modelo"
          searchPlaceholder="Modelo de búsqueda"
          emptyText={modelEmptyText}
        />
        <Input
          value={draft.model}
          aria-label="Complete manualmente el nombre del modelo"
          placeholder={manualModelPlaceholder}
          onChange={(event) => onPatch({ model: event.target.value })}
        />
      </div>

      <div className="space-y-1">
        <div className="text-xs text-muted-foreground">Temperatura</div>
        <Input
          value={draft.temperature}
          aria-label="Temperatura"
          placeholder={temperaturePlaceholder}
          onChange={(event) => onPatch({ temperature: event.target.value })}
        />
      </div>

      <div className="space-y-1">
        <div className="text-xs text-muted-foreground">Longitud máxima de salida</div>
        <Input
          value={draft.maxTokens}
          type="number"
          min={1}
          step={1}
          aria-label="Tokens de salida máxima única"
          placeholder={maxTokensPlaceholder}
          onChange={(event) => onPatch({ maxTokens: event.target.value })}
        />
        <p className="text-xs text-muted-foreground">Asignado automáticamente cuando se deja en blanco, generalmente de {DEFAULT_MODEL_OUTPUT_TOKENS.toLocaleString("zh-CN")} A partir de fichas.</p>
      </div>

      {showProtocolFields ? (
        <div className="space-y-1">
          <div className="text-xs text-muted-foreground">Protocolo de solicitud</div>
          <Select
            value={draft.requestProtocol}
            onValueChange={(value) => {
              const nextProtocol = value as ModelRouteRequestProtocol;
              onPatch({
                requestProtocol: nextProtocol,
                ...(nextProtocol === "anthropic"
                  ? { structuredResponseFormat: "prompt_json" as ModelRouteStructuredResponseFormat }
                  : {}),
              });
            }}
          >
            <SelectTrigger aria-label="Protocolo de solicitud">
              <SelectValue placeholder="Selección automática" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="auto">Selección automática</SelectItem>
              <SelectItem value="openai_compatible">Compatible con OpenAI</SelectItem>
              <SelectItem value="anthropic">Anthropic</SelectItem>
            </SelectContent>
          </Select>
        </div>
      ) : null}

      {showProtocolFields ? (
        <div className="space-y-1">
          <div className="text-xs text-muted-foreground">Formato estructurado</div>
          <Select
            value={draft.structuredResponseFormat}
            onValueChange={(value) => onPatch({
              structuredResponseFormat: value as ModelRouteStructuredResponseFormat,
            })}
          >
            <SelectTrigger aria-label="Formato estructurado">
              <SelectValue placeholder="Selección automática" />
            </SelectTrigger>
            <SelectContent>
              {getStructuredResponseFormatOptions(draft.requestProtocol).map((format) => (
                <SelectItem key={format} value={format}>
                  {format === "auto" ? "Selección automática" : format === "tool_calling" ? "Llamada de herramienta" : format}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}
    </div>
  );
}
