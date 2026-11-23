import { useEffect, useRef, useState } from "react";
import { Download, RefreshCw, RotateCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  checkForDesktopUpdates,
  copyDesktopLogPath,
  openDesktopLogsDirectory,
  restartDesktopApp,
  quitAndInstallDesktopUpdate,
  bundleDesktopLogs,
  type DesktopBootstrapSnapshot,
  type DesktopUpdaterSnapshot,
  useDesktopUpdater,
} from "@/lib/desktop";
import { cn } from "@/lib/utils";
import DesktopBrandMark from "./DesktopBrandMark";

interface DesktopBootstrapShellProps {
  snapshot: DesktopBootstrapSnapshot;
  overlay?: boolean;
}

function resolveStateLabel(snapshot: DesktopBootstrapSnapshot): string {
  switch (snapshot.state) {
    case "launching":
      return "En preparación";
    case "starting-server":
      return "Iniciar el motor local";
    case "loading-ui":
      return "Cargar espacio de trabajo";
    case "ready":
      return "Listo";
    case "error":
      return "Inicio bloqueado";
    default:
      return snapshot.state;
  }
}

function resolveStageLabel(snapshot: DesktopBootstrapSnapshot): string {
  switch (snapshot.stage) {
    case "launching":
      return "Listo para comenzar";
    case "app-ready":
      return "La aplicación está lista";
    case "splash-shown":
      return "Se muestra la página de inicio";
    case "server-starting":
      return "Inicio del servicio local";
    case "server-healthy":
      return "El servicio local está listo";
    case "renderer-ready":
      return "La interfaz está lista";
    case "main-window-shown":
      return "Se muestra la ventana principal";
    case "error":
      return "El inicio falló";
    default:
      return snapshot.stage;
  }
}

function resolveProgressHint(snapshot: DesktopBootstrapSnapshot): string {
  switch (snapshot.state) {
    case "launching":
      return "Preparación de recursos de inicio y tiempo de ejecución del escritorio.";
    case "starting-server":
      return "La versión de escritorio debe iniciar primero el servicio local y luego ingresar al espacio de trabajo principal.";
    case "loading-ui":
      return "El servicio local ya está disponible y se está incorporando al banco de trabajo principal.";
    case "ready":
      return "Se ha completado el inicio del enlace.";
    case "error":
      return "Si encuentra un problema durante el proceso de inicio, se recomienda verificar los registros e intentarlo nuevamente.";
    default:
      return snapshot.detail;
  }
}

function resolveUpdaterStatusLabel(status: DesktopUpdaterSnapshot["status"]): string {
  switch (status) {
    case "disabled":
      return "No disponible";
    case "idle":
      return "Para ser revisado";
    case "checking":
      return "Comprobando";
    case "update-available":
      return "Descubre actualizaciones";
    case "downloading":
      return "Descargando";
    case "downloaded":
      return "Para ser instalado";
    case "not-available":
      return "No se requiere actualización";
    case "error":
      return "Verificación fallida";
    default:
      return status;
  }
}

function resolveUpdaterHint(updater: DesktopUpdaterSnapshot, bootstrapState: DesktopBootstrapSnapshot["state"]): string {
  if (!updater.isSupported) {
    if (updater.isPortable) {
      return "La versión portátil necesita descargar el paquete de instalación de la nueva versión y reemplazarlo manualmente.";
    }

    if (!updater.isPackaged) {
      return "La ejecución de desarrollo no se conectará al canal de actualización de lanzamiento y la versión de instalación empaquetada verificará automáticamente la versión de escritorio.";
    }

    return updater.message;
  }

  switch (updater.status) {
    case "idle":
      return bootstrapState === "error"
        ? "Cuando se bloquea el inicio, se comprobará simultáneamente la versión de escritorio para instalar primero las correcciones disponibles."
        : "La versión de escritorio se verificará antes de ingresar al espacio de trabajo y aquí se le preguntará si hay una versión disponible.";
    case "checking":
      return "Durante la verificación de la versión, se le pedirá que descargue cuando haya una versión disponible.";
    case "update-available":
      return `Versión de escritorio ${updater.availableVersion ?? "Nueva versión"} Disponible, se recomienda descargar primero el paquete de actualización.`;
    case "downloading":
      return "El paquete de actualización se está descargando, mantenga la aplicación abierta.";
    case "downloaded":
      return "El paquete de actualización se descargó y la instalación se completa después de reiniciar la aplicación.";
    case "not-available":
      return "Las versiones instaladas de forma nativa se mantienen sincronizadas con los canales de lanzamiento.";
    case "error":
      return updater.message || "La verificación de la versión falló, puedes volver a intentarlo más tarde.";
    default:
      return updater.message;
  }
}

function formatSnapshotTime(value: string): string {
  if (!value) {
    return "-";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString("zh-CN", {
    hour12: false,
  });
}

function DesktopBootstrapUpdatePanel({ snapshot }: { snapshot: DesktopBootstrapSnapshot }) {
  const updater = useDesktopUpdater();
  const didRequestStartupCheckRef = useRef(false);
  const [isBusy, setIsBusy] = useState(false);
  const isPromptingUpdate = updater.status === "update-available" || updater.status === "downloaded";
  const isCheckingOrDownloading = updater.status === "checking" || updater.status === "downloading";
  const showDownloadButton = updater.status === "update-available";
  const showInstallButton = updater.status === "downloaded";
  const showCheckButton = updater.isSupported && !showDownloadButton && !showInstallButton && updater.status !== "downloading";

  useEffect(() => {
    if (didRequestStartupCheckRef.current || !updater.isSupported) {
      return;
    }

    if (updater.lastCheckedAt || updater.status !== "idle") {
      return;
    }

    if (snapshot.state !== "launching" && snapshot.state !== "starting-server" && snapshot.state !== "error") {
      return;
    }

    didRequestStartupCheckRef.current = true;
    void checkForDesktopUpdates().catch(() => {
      didRequestStartupCheckRef.current = false;
    });
  }, [snapshot.state, updater.isSupported, updater.lastCheckedAt, updater.status]);

  const runUpdaterAction = async (action: "check" | "install") => {
    setIsBusy(true);
    try {
      if (action === "install") {
        await quitAndInstallDesktopUpdate();
      } else {
        await checkForDesktopUpdates();
      }
    } catch (error) {
      console.error("[desktop] updater action failed.", error);
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <div
      className={cn(
        "rounded-3xl border p-5",
        isPromptingUpdate
          ? "border-warning/45 bg-warning/10"
          : "border-border/60 bg-background/55",
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">Verificación de versión</div>
        <Badge
          variant="outline"
          className={cn(
            "border-border bg-muted/60 text-foreground",
            isPromptingUpdate ? "border-warning/50 bg-warning/10 text-warning" : null,
          )}
        >
          {resolveUpdaterStatusLabel(updater.status)}
        </Badge>
      </div>

      <div className="mt-3 grid gap-2 text-sm text-muted-foreground">
        <div className="flex items-center justify-between gap-3">
          <span>Versión nativa</span>
          <span className="font-medium text-foreground">{updater.currentVersion}</span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span>Versiones disponibles</span>
          <span className="font-medium text-foreground">{updater.availableVersion ?? "-"}</span>
        </div>
        <div className="flex items-center justify-between gap-3 text-muted-foreground">
          <span>Comprobar la hora</span>
          <span className="font-medium text-foreground">{formatSnapshotTime(updater.lastCheckedAt ?? "")}</span>
        </div>
      </div>

      <div className="mt-3 rounded-xl border border-border/60 bg-muted/35 px-4 py-3 text-sm leading-6 text-muted-foreground">
        {resolveUpdaterHint(updater, snapshot.state)}
        {typeof updater.progressPercent === "number" ? ` Descargar progreso ${Math.round(updater.progressPercent)}%.` : ""}
      </div>

      <div className="mt-4 flex flex-wrap gap-3">
        {showCheckButton ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="border-border bg-background text-foreground hover:bg-muted"
            disabled={isBusy || updater.status === "checking"}
            onClick={() => void runUpdaterAction("check")}
          >
            <RefreshCw className={cn("h-4 w-4", updater.status === "checking" ? "animate-spin" : null)} aria-hidden="true" />
            {updater.status === "checking" ? "Comprobando" : updater.status === "error" || updater.status === "not-available" ? "Volver a comprobar" : "Buscar actualizaciones"}
          </Button>
        ) : null}
        {showDownloadButton ? (
          <Button
            type="button"
            size="sm"
            className="bg-warning text-warning-foreground hover:bg-warning/90"
            disabled={isBusy || isCheckingOrDownloading}
            onClick={() => void runUpdaterAction("check")}
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            Descargar actualizaciones
          </Button>
        ) : null}
        {showInstallButton ? (
          <Button
            type="button"
            size="sm"
            className="bg-primary text-primary-foreground hover:bg-primary/90"
            disabled={isBusy || !updater.canInstall}
            onClick={() => void runUpdaterAction("install")}
          >
            <RotateCw className="h-4 w-4" aria-hidden="true" />
            Reiniciar la instalación
          </Button>
        ) : null}
      </div>
    </div>
  );
}

export default function DesktopBootstrapShell({ snapshot, overlay = false }: DesktopBootstrapShellProps) {
  const surfaceClassName = overlay
    ? "bg-background/88 backdrop-blur-xl"
    : "bg-[radial-gradient(circle_at_18%_18%,hsl(var(--info)/0.22),transparent_34%),radial-gradient(circle_at_88%_82%,hsl(var(--primary)/0.18),transparent_38%),hsl(var(--background))]";

  return (
    <div className={cn("fixed inset-0 z-[90] flex items-center justify-center overflow-y-auto px-5 py-6 sm:px-8", surfaceClassName)}>
      <div className="relative w-full max-w-5xl overflow-hidden rounded-[32px] border border-border/70 bg-card/88 text-card-foreground shadow-[0_32px_120px_-48px_hsl(var(--foreground)/0.55)] backdrop-blur-2xl">
        <div className="pointer-events-none absolute -right-24 -top-28 h-80 w-80 rounded-full bg-info/15 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 left-1/3 h-72 w-72 rounded-full bg-primary/10 blur-3xl" />
        <div className="relative grid gap-0 lg:grid-cols-[minmax(0,1.2fr)_minmax(300px,0.8fr)]">
          <section className="flex min-h-[420px] flex-col justify-between border-b border-border/60 px-7 py-8 sm:px-10 sm:py-10 lg:border-b-0 lg:border-r">
            <div>
              <div className="flex items-start justify-between gap-6">
                <div className="flex items-center gap-4">
                  <div className="rounded-[24px] bg-primary/10 p-2 ring-1 ring-primary/20"><DesktopBrandMark className="h-16 w-16" /></div>
                  <div>
                    <div className="text-xs font-medium uppercase tracking-[0.24em] text-info">BIZ NOVEL STUDIO</div>
                    <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">Banco de trabajo de creación de novelas de IA</h1>
                  </div>
                </div>
                <Badge variant="outline" className="hidden border-info/30 bg-info/10 text-info sm:inline-flex">Versión de escritorio · {resolveStageLabel(snapshot)}</Badge>
              </div>

              <div className="mt-20 max-w-xl">
                <div className="flex items-center gap-2 text-sm font-medium text-info"><span className="h-2 w-2 animate-pulse rounded-full bg-info" />{resolveStateLabel(snapshot)}</div>
                <h2 className="mt-4 text-4xl font-semibold leading-tight tracking-[-0.04em] sm:text-5xl">{snapshot.title}</h2>
                <p className="mt-5 max-w-lg text-sm leading-7 text-muted-foreground">{snapshot.detail}</p>
              </div>
            </div>

            <div className="mt-12 space-y-3">
              <div className="flex items-center justify-between text-xs text-muted-foreground"><span>Conectándote con tu espacio creativo</span><span>{resolveStageLabel(snapshot)}</span></div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                {snapshot.state === "error" ? <span className="block h-full w-full rounded-full bg-destructive" /> : <span className="block h-full w-1/2 animate-[desktop-shell-progress_1.4s_ease-in-out_infinite] rounded-full bg-[linear-gradient(90deg,hsl(var(--info)),hsl(var(--primary)))]" />}
              </div>
              <p className="text-xs leading-5 text-muted-foreground">La página de inicio solo aparece brevemente cuando se preparan los servicios locales y se ingresará automáticamente cuando el espacio de trabajo esté listo.</p>
            </div>
          </section>

          <section className="space-y-4 bg-muted/20 px-7 py-8 sm:px-8 sm:py-10">
            <div className="rounded-2xl border border-border/60 bg-background/55 p-5">
              <div className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">Estado de inicio</div>
              <div className="mt-4 space-y-3 text-sm">
                <div className="flex items-center justify-between gap-3"><span className="text-muted-foreground">Etapa actual</span><span className="font-medium">{resolveStateLabel(snapshot)}</span></div>
                <div className="rounded-xl border border-border/60 bg-muted/35 px-3.5 py-3 text-sm leading-6 text-muted-foreground">{resolveProgressHint(snapshot)}</div>
                <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground"><span>Últimas actualizaciones</span><span>{formatSnapshotTime(snapshot.updatedAt)}</span></div>
              </div>
            </div>

            <DesktopBootstrapUpdatePanel snapshot={snapshot} />

            <details className="group rounded-2xl border border-border/60 bg-background/45 p-5">
              <summary className="cursor-pointer list-none text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">Registros y solución de problemas <span className="float-right transition-transform group-open:rotate-180">⌄</span></summary>
              <div className="mt-4 text-sm leading-6 text-muted-foreground">Si el inicio se bloquea o el servicio local se cierra antes de tiempo, puede abrir el directorio de registro para localizar el problema.</div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button variant="secondary" size="sm" onClick={() => void bundleDesktopLogs()}>Descargar paquete de registro reciente</Button>
                <Button variant="outline" size="sm" onClick={() => void openDesktopLogsDirectory()}>Abrir directorio de registro</Button>
                <Button variant="outline" size="sm" onClick={() => void copyDesktopLogPath()}>Copiar ruta de registro</Button>
                {snapshot.state === "error" && snapshot.canRetry ? <Button size="sm" onClick={() => void restartDesktopApp()}>Reanudar</Button> : null}
              </div>
            </details>
          </section>
        </div>
      </div>
    </div>
  );
}
