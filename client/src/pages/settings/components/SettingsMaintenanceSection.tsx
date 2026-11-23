import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import DesktopLegacyDataImportCard from "@/components/layout/DesktopLegacyDataImportCard";
import DesktopUpdateCard from "@/components/layout/DesktopUpdateCard";
import { APP_RUNTIME } from "@/lib/constants";
import { AUTO_DIRECTOR_MOBILE_CLASSES } from "@/mobile/autoDirector";

export default function SettingsMaintenanceSection() {
  if (APP_RUNTIME !== "desktop") {
    return (
      <Card className="min-w-0 overflow-hidden">
        <CardHeader>
          <CardTitle>Mantenimiento del sistema</CardTitle>
          <CardDescription className={AUTO_DIRECTOR_MOBILE_CLASSES.wrapText}>
            Actualmente usando la versión web. Las actualizaciones de escritorio y la importación de datos heredados nativos solo están disponibles en la versión de escritorio.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="min-w-0 space-y-4">
      <Card className="min-w-0 overflow-hidden">
        <CardHeader>
          <CardTitle>Mantenimiento del sistema</CardTitle>
          <CardDescription className={AUTO_DIRECTOR_MOBILE_CLASSES.wrapText}>
            Busque actualizaciones de escritorio o importe datos heredados nativos; Estas operaciones no afectarán la configuración de creación actual.
          </CardDescription>
        </CardHeader>
        <CardContent className={`text-sm text-muted-foreground ${AUTO_DIRECTOR_MOBILE_CLASSES.wrapText}`}>
          Cuando no haya requisitos de mantenimiento, puede volver directamente a la configuración de creación anterior.
        </CardContent>
      </Card>
      <DesktopUpdateCard />
      <DesktopLegacyDataImportCard compact />
    </div>
  );
}
