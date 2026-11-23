import { useMemo, useState } from "react";
import { AlertTriangle, ShieldAlert } from "lucide-react";
import type { PendingReviewAutoPromotionSettings } from "@/api/settings";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AppDialogContent,
  Dialog,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { AUTO_DIRECTOR_MOBILE_CLASSES } from "@/mobile/autoDirector";

function formatBaseline(value: string | null | undefined): string {
  if (!value) {
    return "No creado";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString();
}

export function AutoDirectorPendingReviewAutoPromotionCard(props: {
  settings?: PendingReviewAutoPromotionSettings | null;
  isLoading: boolean;
  isSaving: boolean;
  onEnable: (payload: { acknowledgedRisks: boolean; confirmationText: string }) => void;
  onDisable: () => void;
}) {
  const {
    settings,
    isLoading,
    isSaving,
    onEnable,
    onDisable,
  } = props;
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [acknowledgedRisks, setAcknowledgedRisks] = useState(false);
  const [confirmationText, setConfirmationText] = useState("");
  const enabled = Boolean(settings?.enabled);
  const acknowledgementText = settings?.acknowledgementText ?? "Entiendo los riesgos de la liberación automática";
  const baselineLabel = useMemo(() => formatBaseline(settings?.baselineAt), [settings?.baselineAt]);
  const canConfirm = acknowledgedRisks && confirmationText.trim() === acknowledgementText && !isSaving;

  const resetDialog = () => {
    setAcknowledgedRisks(false);
    setConfirmationText("");
  };

  return (
    <>
      <Card className="min-w-0 overflow-hidden border-amber-300 bg-amber-50/35">
        <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
          <div className="min-w-0 space-y-1.5">
            <CardTitle className="flex flex-wrap items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-amber-700" aria-hidden="true" />
              Liberación automática pendiente de estado de confirmación
            </CardTitle>
            <CardDescription className={AUTO_DIRECTOR_MOBILE_CLASSES.wrapText}>
              Después de la activación, solo se procesarán las propuestas de relación de roles y conocimiento de la información generadas después del tiempo de referencia, hace más de 14 días, y sin encontrar conflictos no resueltos.
            </CardDescription>
          </div>
          <Switch
            checked={enabled}
            disabled={isLoading || isSaving}
            aria-label={enabled ? "Desactivar la liberación automática en estado de confirmación pendiente" : "Habilitar la liberación automática en estado pendiente de confirmación"}
            onCheckedChange={(checked) => {
              if (checked) {
                setConfirmOpen(true);
                return;
              }
              onDisable();
            }}
          />
        </CardHeader>
        <CardContent className="space-y-4">
          {enabled ? (
            <div className={`flex min-w-0 items-start gap-2 rounded-md border border-amber-300 bg-amber-100/80 px-3 py-2 text-sm text-amber-950 ${AUTO_DIRECTOR_MOBILE_CLASSES.wrapText}`}>
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <div>
                La liberación automática está activada. Las propuestas elegibles se presentarán de acuerdo con la historia oficial; si es necesario revertirlos, es necesario verificarlos manualmente en función de los registros de seguimiento.
              </div>
            </div>
          ) : null}

          <div className="grid min-w-0 gap-3 text-sm md:grid-cols-3">
            <div className="rounded-md border bg-background/80 p-3">
              <div className="text-xs text-muted-foreground">Estado del interruptor</div>
              <div className="mt-1 font-medium">{enabled ? "Apertura" : "Cerrar"}</div>
            </div>
            <div className="rounded-md border bg-background/80 p-3 md:col-span-2">
              <div className="text-xs text-muted-foreground">Tiempo base efectivo</div>
              <div className={`mt-1 font-medium ${AUTO_DIRECTOR_MOBILE_CLASSES.wrapText}`}>{baselineLabel}</div>
            </div>
          </div>

          <div className={`rounded-md border bg-background/70 p-3 text-sm text-muted-foreground ${AUTO_DIRECTOR_MOBILE_CLASSES.wrapText}`}>
            Las propuestas que estén en stock aún por confirmar no se incluirán en el rango de publicación automática. Cuando una propuesta se encuentra con un conflicto no resuelto, permanecerá pendiente de confirmación y esperará a que se procese manualmente.
          </div>
        </CardContent>
      </Card>

      <Dialog
        open={confirmOpen}
        onOpenChange={(open) => {
          setConfirmOpen(open);
          if (!open) {
            resetDialog();
          }
        }}
      >
        <AppDialogContent
          title="Habilitar la liberación automática en estado pendiente de confirmación"
          description="Este escenario presentará relaciones pendientes cualificadas y propuestas cognitivas como hechos históricos oficiales."
          footer={(
            <>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setConfirmOpen(false);
                  resetDialog();
                }}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                disabled={!canConfirm}
                onClick={() => {
                  onEnable({
                    acknowledgedRisks,
                    confirmationText: confirmationText.trim(),
                  });
                  setConfirmOpen(false);
                  resetDialog();
                }}
              >
                {isSaving ? "Guardando..." : "Confirmar para abrir"}
              </Button>
            </>
          )}
        >
          <div className="space-y-4">
            <div className={`rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-950 ${AUTO_DIRECTOR_MOBILE_CLASSES.wrapText}`}>
              Una vez activado, el sistema solo procesará las propuestas generadas después del tiempo base efectivo; Las propuestas existentes que aún no se han confirmado no entrarán en el rango de publicación automática. Las propuestas que cumplan con las condiciones se presentarán como hechos oficiales y no serán revocadas automáticamente por el sistema.
            </div>

            <label className="flex min-w-0 items-start gap-3 rounded-md border p-3 text-sm">
              <input
                type="checkbox"
                className="mt-1"
                checked={acknowledgedRisks}
                onChange={(event) => setAcknowledgedRisks(event.target.checked)}
              />
              <span className={AUTO_DIRECTOR_MOBILE_CLASSES.wrapText}>
                Entiendo que esta capacidad envía automáticamente los cambios de estado para su confirmación y registra cada acción a través de un Rastreo del Director.
              </span>
            </label>

            <div className="space-y-2">
              <div className="text-sm font-medium">Introduzca el texto de confirmación</div>
              <Input
                value={confirmationText}
                onChange={(event) => setConfirmationText(event.target.value)}
                placeholder={acknowledgementText}
              />
              <div className={`text-xs text-muted-foreground ${AUTO_DIRECTOR_MOBILE_CLASSES.wrapText}`}>
                Por favor ingrese:{acknowledgementText}
              </div>
            </div>
          </div>
        </AppDialogContent>
      </Dialog>
    </>
  );
}
