import ModelRoutesPage from "../ModelRoutesPage";
import { SettingsShell } from "../components/SettingsShell";

export default function ModelRoutesSettingsPage() {
  return (
    <SettingsShell title="Gestión de rutas de modelos" description="Seleccione modelos para diferentes tareas de creación y configure modelos de respaldo de salida estructurados.">
      <ModelRoutesPage />
    </SettingsShell>
  );
}
