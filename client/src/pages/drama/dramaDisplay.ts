import type { DramaSourceType } from "@/api/drama";

export const DRAMA_TRACK_OPTIONS = [
  { value: "counterattack", label: "Contraataque" },
  { value: "rebirth_revenge", label: "Renacimiento para la venganza" },
  { value: "war_god", label: "El regreso del dios de la guerra" },
  { value: "live_in_son", label: "Yerno" },
  { value: "miracle_doctor", label: "Doctor milagroso" },
  { value: "rich_family", label: "Rencores entre familias adineradas" },
  { value: "sweet_love", label: "Dulce mascota" },
  { value: "hidden_identity", label: "Ma Jia Wen" },
] as const;

export const DRAMA_SOURCE_LABELS: Record<DramaSourceType, string> = {
  novel_import: "Importación novedosa",
  original: "Obra corta original",
  text_import: "Importación de texto",
};

export function dramaTrackLabel(track?: string | null): string {
  if (!track) {
    return "Ninguna pista seleccionada";
  }
  return DRAMA_TRACK_OPTIONS.find((option) => option.value === track)?.label ?? track;
}
