import SettingsMaintenanceSection from "../components/SettingsMaintenanceSection";
import { SettingsShell } from "../components/SettingsShell";

export default function MaintenanceSettingsPage() {
  return (
    <SettingsShell title="Escritorio y mantenimiento" description="Vea actualizaciones, importaciones y mantenimiento relacionados con su entorno actual.">
      <SettingsMaintenanceSection />
    </SettingsShell>
  );
}
