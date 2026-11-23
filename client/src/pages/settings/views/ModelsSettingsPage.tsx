import { InvocationHistorySection } from "../models/InvocationHistorySection";
import { WorldGenerationTimeoutSection } from "../models/WorldGenerationTimeoutSection";
import SettingsPage from "../SettingsPage";
import { SettingsShell } from "../components/SettingsShell";

export default function ModelsSettingsPage() {
  return (
    <SettingsShell title="Modelos y proveedores" description="Agregue y administre proveedores de modelos y modelos disponibles para su creación.">
      <SettingsPage />
      <WorldGenerationTimeoutSection />
      <InvocationHistorySection />
    </SettingsShell>
  );
}
