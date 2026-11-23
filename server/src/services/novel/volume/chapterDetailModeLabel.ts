import type { ChapterDetailMode } from "./volumeModels";

export function formatChapterDetailModeLabel(detailMode: ChapterDetailMode): string {
  if (detailMode === "purpose") {
    return "Objetivo del capítulo";
  }
  if (detailMode === "boundary") {
    return "límite de ejecución";
  }
  return "Hoja de tareas";
}
