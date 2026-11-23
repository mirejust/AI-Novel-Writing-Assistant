import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getWorldGenerationTimeoutSettings,
  saveWorldGenerationTimeoutSettings,
} from "@/api/settings";
import { queryKeys } from "@/api/queryKeys";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const MS_PER_MINUTE = 60_000;

function toMinutes(value: number | undefined, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }
  return Math.round(value / MS_PER_MINUTE);
}

export function WorldGenerationTimeoutSection() {
  const queryClient = useQueryClient();
  const [minutes, setMinutes] = useState("2");
  const [feedback, setFeedback] = useState("");
  const settingsQuery = useQuery({
    queryKey: queryKeys.settings.worldGenerationTimeout,
    queryFn: getWorldGenerationTimeoutSettings,
  });
  const settings = settingsQuery.data?.data;
  const minMinutes = toMinutes(settings?.minTimeoutMs, 2);
  const maxMinutes = toMinutes(settings?.maxTimeoutMs, 10);
  const parsedMinutes = Number(minutes);
  const isValidTimeout = Number.isInteger(parsedMinutes)
    && parsedMinutes >= minMinutes
    && parsedMinutes <= maxMinutes;

  useEffect(() => {
    if (settings) {
      setMinutes(String(toMinutes(settings.timeoutMs, minMinutes)));
    }
  }, [settings, minMinutes]);

  const saveMutation = useMutation({
    mutationFn: (nextMinutes: number) => saveWorldGenerationTimeoutSettings({
      timeoutMs: nextMinutes * MS_PER_MINUTE,
    }),
    onSuccess: async (response) => {
      setFeedback(response.message ?? "El tiempo de espera para la generación de la visión del mundo se guarda con éxito.");
      await queryClient.invalidateQueries({ queryKey: queryKeys.settings.worldGenerationTimeout });
    },
    onError: (error) => {
      setFeedback(error instanceof Error ? error.message : "No se pudo guardar el tiempo de espera de generación de la visión del mundo.");
    },
  });

  return (
    <section className="space-y-3" aria-labelledby="world-generation-timeout-title">
      <div className="space-y-1">
        <h2 id="world-generation-timeout-title" className="text-base font-medium">La espera más larga para una sola generación</h2>
        <p className="text-sm text-muted-foreground">
          Cuando el modelo local es lento, puede aumentar la espera única para la generación de la visión mundial. El modelo en la nube se puede mantener durante 2 minutos. Después de guardar, espere este momento para la próxima generación de visión del mundo. El sistema puede volver a intentarlo automáticamente después de una falla.
        </p>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <label className="space-y-1 text-sm">
          <span>Tiempo de espera (minutos)</span>
          <Input
            type="number"
            min={minMinutes}
            max={maxMinutes}
            step={1}
            value={minutes}
            className="w-28"
            onChange={(event) => {
              setFeedback("");
              setMinutes(event.target.value);
            }}
          />
        </label>
        <Button
          type="button"
          onClick={() => saveMutation.mutate(parsedMinutes)}
          disabled={settingsQuery.isLoading || saveMutation.isPending || !isValidTimeout}
        >
          {saveMutation.isPending ? "Guardando..." : "Guardar"}
        </Button>
      </div>
      {!isValidTimeout ? (
        <p className="text-sm text-amber-700">Por favor ingresa {minMinutes} llegar {maxMinutes} Un número entero entre minutos.</p>
      ) : (
        <p className="text-sm text-muted-foreground">Se puede configurar {minMinutes} llegar {maxMinutes} minuto.</p>
      )}
      {feedback ? <p className="text-sm text-muted-foreground">{feedback}</p> : null}
    </section>
  );
}
