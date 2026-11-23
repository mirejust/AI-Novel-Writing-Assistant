import type { ReactNode } from "react";
import { AppDialogContent, Dialog, DialogTrigger } from "@/components/ui/dialog";
import { useDesktopUpdater } from "@/lib/desktop";
import DesktopUpdatePanel from "./DesktopUpdatePanel";

interface DesktopUpdateDialogProps {
  trigger: ReactNode;
}

export default function DesktopUpdateDialog({ trigger }: DesktopUpdateDialogProps) {
  const updater = useDesktopUpdater();

  return (
    <Dialog>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <AppDialogContent
        className="max-w-2xl"
        title="Versiones y actualizaciones"
        description="Verifique el estado de la versión de escritorio y descargue e instale la nueva versión después de la confirmación."
      >
        <DesktopUpdatePanel updater={updater} />
      </AppDialogContent>
    </Dialog>
  );
}
