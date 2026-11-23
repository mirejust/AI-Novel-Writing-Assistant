import { Input } from "@/components/ui/input";

interface ProviderRequestLimitFieldsProps {
  concurrencyLimit: string;
  requestIntervalMs: string;
  onChange: (value: {
    concurrencyLimit?: string;
    requestIntervalMs?: string;
  }) => void;
}

export default function ProviderRequestLimitFields({
  concurrencyLimit,
  requestIntervalMs,
  onChange,
}: ProviderRequestLimitFieldsProps) {
  return (
    <div className="grid gap-3 rounded-md border bg-muted/20 p-3 sm:grid-cols-2">
      <div className="space-y-1">
        <div className="text-xs text-muted-foreground">El límite superior de concurrencia del mismo modelo.</div>
        <Input
          type="number"
          min={0}
          step={1}
          value={concurrencyLimit}
          placeholder="0"
          onChange={(event) => onChange({ concurrencyLimit: event.target.value })}
        />
        <div className="break-words text-xs text-muted-foreground [overflow-wrap:anywhere]">
          0 significa sin límite. Cuando las solicitudes del mismo proveedor y modelo superen el límite superior, se pondrán en cola para su ejecución.
        </div>
      </div>
      <div className="space-y-1">
        <div className="text-xs text-muted-foreground">Intervalo de solicitud del mismo modelo (milisegundos)</div>
        <Input
          type="number"
          min={0}
          step={100}
          value={requestIntervalMs}
          placeholder="0"
          onChange={(event) => onChange({ requestIntervalMs: event.target.value })}
        />
        <div className="break-words text-xs text-muted-foreground [overflow-wrap:anywhere]">
          0 significa sin límite. Se utiliza para controlar la velocidad de iniciaciones consecutivas del mismo proveedor y modelo.
        </div>
      </div>
    </div>
  );
}

export function ProviderRequestLimitSummary({
  concurrencyLimit,
  requestIntervalMs,
}: {
  concurrencyLimit: number;
  requestIntervalMs: number;
}) {
  return (
    <div className="mb-2 break-words text-xs text-muted-foreground [overflow-wrap:anywhere]">
      Límite de solicitudes: concurrencia {concurrencyLimit || "sin limite"} · Intervalo {requestIntervalMs ? `${requestIntervalMs}ms` : "sin limite"}
    </div>
  );
}
