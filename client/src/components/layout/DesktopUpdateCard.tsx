import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { APP_RUNTIME } from "@/lib/constants";
import { useDesktopUpdater } from "@/lib/desktop";
import DesktopUpdatePanel from "./DesktopUpdatePanel";

export default function DesktopUpdateCard() {
  const updater = useDesktopUpdater();

  if (APP_RUNTIME !== "desktop") {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Actualizaciones de la versión de escritorio</CardTitle>
        <CardDescription>Para ver el estado detallado de la versión, también puede hacer clic directamente en el número de versión en la parte superior del espacio de trabajo para abrir rápidamente el panel de actualización.</CardDescription>
      </CardHeader>
      <CardContent>
        <DesktopUpdatePanel updater={updater} />
      </CardContent>
    </Card>
  );
}
