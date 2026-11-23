import type { DirectorVersion } from "@ai-novel/shared/types/director/version";

export function getDirectionGenerationDisabledReasons(input: {
  idea: string;
  directorVersion: DirectorVersion;
  availableVersions: readonly DirectorVersion[];
  versionsLoading: boolean;
  versionsError: boolean;
  isGenerating: boolean;
  requireCreativeCarryoverAdopted: boolean;
  creativeCarryoverAdopted: boolean;
}): string[] {
  const reasons: string[] = [];
  if (!input.idea.trim()) {
    reasons.push("Vuelva al paso 1 para completar su idea de libro único.");
  }
  if (input.versionsLoading) {
    reasons.push("Cargando versiones de director disponibles, espere.");
  } else if (input.versionsError) {
    reasons.push("No se pudo leer la versión del director disponible. Inténtelo de nuevo.");
  } else if (!input.availableVersions.includes(input.directorVersion)) {
    reasons.push("La versión del director seleccionado no está disponible, seleccione una versión disponible.");
  }
  if (input.isGenerating) {
    reasons.push("Se está generando toda la dirección del libro, espere a que se complete esta generación.");
  }
  if (input.requireCreativeCarryoverAdopted && !input.creativeCarryoverAdopted) {
    reasons.push("Abra el plan creativo y utilice el plan recomendado.");
  }
  return reasons;
}
