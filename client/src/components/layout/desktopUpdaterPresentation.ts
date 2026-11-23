import type { DesktopUpdaterSnapshot } from "@/lib/desktop";

export function formatDesktopVersion(version: string): string {
  const trimmed = version.trim();
  if (!trimmed || trimmed === "0.0.0") {
    return "v0.0.0";
  }
  return trimmed.startsWith("v") ? trimmed : `v${trimmed}`;
}

export function getDesktopUpdaterStatusLabel(status: DesktopUpdaterSnapshot["status"]): string {
  switch (status) {
    case "disabled":
      return "Aún no disponible";
    case "idle":
      return "Esperando inspección";
    case "checking":
      return "Comprobando";
    case "update-available":
      return "Nueva versión encontrada";
    case "downloading":
      return "Descargando";
    case "downloaded":
      return "Esperando que se reinicie la instalación";
    case "not-available":
      return "Versión más nueva";
    case "error":
      return "Verificación fallida";
    default:
      return status;
  }
}

export function getDesktopUpdaterHint(updater: DesktopUpdaterSnapshot): string {
  if (!updater.isSupported) {
    if (updater.isPortable) {
      return "La versión portátil necesita descargar el paquete de instalación de la nueva versión y reemplazarlo manualmente. Los datos creativos existentes no se verán afectados.";
    }
    if (!updater.isPackaged) {
      return "El entorno de desarrollo no descargará el paquete de instalación y la versión de instalación oficial puede verificar e instalar actualizaciones aquí.";
    }
    return "Este paquete de instalación no puede conectarse temporalmente al servicio de actualización de versiones.";
  }

  switch (updater.status) {
    case "idle":
      return "Puede buscar actualizaciones de la versión de escritorio en cualquier momento. Después de descubrir una nueva versión, depende de usted confirmar la descarga y reiniciar la instalación.";
    case "checking":
      return "Conectándose al servicio de actualización de versión, espere.";
    case "update-available":
      return `${formatDesktopVersion(updater.availableVersion ?? "Nueva versión")} Disponible, puede continuar usando la aplicación mientras la descarga.`;
    case "downloading":
      return "El paquete de actualización se está descargando en segundo plano; mantenga la aplicación abierta.";
    case "downloaded":
      return "El paquete de actualización está listo. Se instalará automáticamente después de reiniciar la aplicación. Guarde primero los datos no guardados.";
    case "not-available":
      return "El paquete de instalación actual es compatible con la última versión de este canal de actualización.";
    case "error":
      return "No se pudo completar la verificación de la versión. Confirme la conexión de red e inténtelo nuevamente.";
    default:
      return "Puede consultar el estado de la versión de escritorio aquí.";
  }
}

export function getDesktopInstallModeLabel(updater: DesktopUpdaterSnapshot): string {
  if (updater.isPortable) {
    return "Versión portátil";
  }
  if (!updater.isPackaged) {
    return "Entorno de desarrollo";
  }
  return "Versión de instalación";
}

export function getDesktopChannelLabel(channel: string): string {
  return channel === "beta" ? "Canal de prueba" : channel === "latest" ? "Canal estable" : `${channel} pasillo`;
}
