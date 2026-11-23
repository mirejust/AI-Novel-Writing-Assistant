import { useState } from "react";
import AutoDirectorSettingsSection from "../AutoDirectorSettingsSection";
import SettingsActionResult from "../SettingsActionResult";
import { SettingsShell } from "../components/SettingsShell";

export default function DirectorSettingsPage() {
  const [message, setMessage] = useState("");
  return (
    <SettingsShell title="Director automático" description="Configure el manejo de problemas, la confirmación automática y los recordatorios de creación; Después de iniciar cada libro, conservará sus propias reglas de ejecución de acuerdo con la configuración en ese momento.">
      <AutoDirectorSettingsSection onActionResult={setMessage} collapseAdvanced />
      <SettingsActionResult message={message} />
    </SettingsShell>
  );
}
