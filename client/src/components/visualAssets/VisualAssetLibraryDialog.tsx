import { Dialog, AppDialogContent } from "@/components/ui/dialog";
import { VisualAssetLibrary } from "./VisualAssetLibrary";
import type { VisualAssetLibraryDialogProps } from "./visualAssetLibrary.types";

export function VisualAssetLibraryDialog({
  open,
  onOpenChange,
  onCloseAutoFocus,
  selectionMode = "browse",
  ...libraryProps
}: VisualAssetLibraryDialogProps) {
  const isPicker = selectionMode !== "browse";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <AppDialogContent
        onCloseAutoFocus={onCloseAutoFocus}
        title={isPicker ? "Elige materiales visuales" : "Biblioteca de recursos visuales"}
        description={isPicker ? "Seleccione entre los materiales existentes y recupere la creación actual después de la confirmación." : "Vea y organice los materiales ilustrados en su trabajo."}
        className="h-[min(88dvh,900px)] w-[min(90vw,1440px)] max-w-none"
        bodyClassName="overflow-hidden p-0"
      >
        <VisualAssetLibrary {...libraryProps} selectionMode={selectionMode} />
      </AppDialogContent>
    </Dialog>
  );
}
