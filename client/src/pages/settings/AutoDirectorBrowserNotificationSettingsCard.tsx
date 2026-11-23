import { useEffect, useState } from "react";
import { BellRing } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import {
  AUTO_DIRECTOR_PAUSE_NOTIFICATION_SETTINGS_EVENT,
  type BrowserNotificationPermissionState,
  getBrowserNotificationPermission,
  isAutoDirectorPauseNotificationEnabled,
  requestBrowserNotificationPermission,
  setAutoDirectorPauseNotificationEnabled,
} from "@/lib/autoDirectorPauseNotifications";
import { AUTO_DIRECTOR_MOBILE_CLASSES } from "@/mobile/autoDirector";

function formatPermission(permission: BrowserNotificationPermissionState): string {
  switch (permission) {
    case "granted":
      return "Permitido";
    case "denied":
      return "Bloqueado";
    case "default":
      return "Autorización pendiente";
    case "unsupported":
      return "No compatible";
  }
}

export function AutoDirectorBrowserNotificationSettingsCard(props: {
  onActionResult: (message: string) => void;
}) {
  const { onActionResult } = props;
  const [enabled, setEnabled] = useState(() => isAutoDirectorPauseNotificationEnabled());
  const [permission, setPermission] = useState<BrowserNotificationPermissionState>(() => getBrowserNotificationPermission());

  const refreshState = () => {
    setEnabled(isAutoDirectorPauseNotificationEnabled());
    setPermission(getBrowserNotificationPermission());
  };

  useEffect(() => {
    const handleSettingsChange = () => refreshState();
    window.addEventListener(AUTO_DIRECTOR_PAUSE_NOTIFICATION_SETTINGS_EVENT, handleSettingsChange);
    window.addEventListener("storage", handleSettingsChange);
    return () => {
      window.removeEventListener(AUTO_DIRECTOR_PAUSE_NOTIFICATION_SETTINGS_EVENT, handleSettingsChange);
      window.removeEventListener("storage", handleSettingsChange);
    };
  }, []);

  const handleEnable = async () => {
    let nextPermission = getBrowserNotificationPermission();
    if (nextPermission === "unsupported") {
      setAutoDirectorPauseNotificationEnabled(false);
      refreshState();
      onActionResult("Los navegadores actuales no admiten recordatorios de escritorio.");
      return;
    }
    if (nextPermission === "default") {
      nextPermission = await requestBrowserNotificationPermission();
    }
    if (nextPermission !== "granted") {
      setAutoDirectorPauseNotificationEnabled(false);
      refreshState();
      onActionResult("El navegador no permite notificaciones y no se enviarán alertas de escritorio cuando Auto Director esté en pausa.");
      return;
    }
    setAutoDirectorPauseNotificationEnabled(true);
    refreshState();
    onActionResult("El recordatorio automático de pausa del director está activado.");
  };

  const handleToggle = (checked: boolean) => {
    if (!checked) {
      setAutoDirectorPauseNotificationEnabled(false);
      refreshState();
      onActionResult("El recordatorio automático de pausa del director está desactivado.");
      return;
    }
    void handleEnable();
  };

  const permissionLabel = formatPermission(permission);
  const canRequestPermission = permission === "default";

  return (
    <Card className="min-w-0 overflow-hidden">
      <CardHeader className="space-y-1.5">
        <div className="flex min-w-0 items-start gap-3">
          <BellRing className="mt-1 h-5 w-5 shrink-0 text-primary" />
          <div className="min-w-0 space-y-1.5">
            <CardTitle>Recordatorio automático de pausa del director</CardTitle>
            <CardDescription className={AUTO_DIRECTOR_MOBILE_CLASSES.wrapText}>
              Cuando AutoDirector está esperando confirmación, necesita ser restaurado o está bloqueado por verificación, las notificaciones del navegador le recordarán que regrese al centro de seguimiento.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex min-w-0 items-center justify-between gap-4 rounded-md border bg-muted/10 p-3">
          <div className="min-w-0 space-y-1">
            <div className="text-sm font-medium">Recordatorio de escritorio</div>
            <div className={`${AUTO_DIRECTOR_MOBILE_CLASSES.wrapText} text-xs text-muted-foreground`}>
              Solo afecta al navegador actual en esta computadora.
            </div>
          </div>
          <Switch
            checked={enabled && permission === "granted"}
            onCheckedChange={handleToggle}
            disabled={permission === "unsupported"}
            aria-label="Activar o desactivar los recordatorios automáticos de pausa del director"
          />
        </div>

        <div className="flex min-w-0 flex-col gap-3 rounded-md border bg-background p-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 space-y-1">
            <div className="text-sm font-medium">Permisos de notificación:{permissionLabel}</div>
            <div className={`${AUTO_DIRECTOR_MOBILE_CLASSES.wrapText} text-xs text-muted-foreground`}>
              Si su navegador ha bloqueado las notificaciones, permita que este sitio web envíe notificaciones en la configuración de permisos de la barra de direcciones.
            </div>
          </div>
          {canRequestPermission ? (
            <Button
              type="button"
              variant="outline"
              className={AUTO_DIRECTOR_MOBILE_CLASSES.fullWidthAction}
              onClick={() => void handleEnable()}
            >
              Autorizar notificaciones del navegador
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
