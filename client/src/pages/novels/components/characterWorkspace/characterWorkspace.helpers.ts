import type { Character, CharacterVisibleProfileField } from "@ai-novel/shared/types/novel";
import type { CharacterResourceLedgerItem } from "@ai-novel/shared/types/characterResource";
import { isProtagonistCharacter } from "../characterAssetWorkspace.helpers";

export const VISIBLE_PROFILE_FIELDS: Array<{
  key: CharacterVisibleProfileField;
  label: string;
  placeholder: string;
}> = [
  { key: "appearance", label: "Punto de memoria de apariencia", placeholder: "Cejas, peinado, expresiones faciales y otros rasgos faciales que los lectores pueden recordar." },
  { key: "physique", label: "Base del cuerpo", placeholder: "Edad, forma corporal, postura, base de condición física." },
  { key: "attireStyle", label: "Desgaste común", placeholder: "Uso diario, apariencia de estatus, rastros de clase u ocupación." },
  { key: "signatureDetail", label: "Detalles del logotipo", placeholder: "Fichas, acciones, minihábitos, olores o detalles recurrentes" },
  { key: "voiceTexture", label: "Tono de voz", placeholder: "Voz, ritmo del habla, patrones de oraciones y tono." },
  { key: "presenceImpression", label: "Primera impresión", placeholder: "El sentimiento intuitivo que se da a los lectores cuando aparecen por primera vez o con regularidad." },
];

export function getSecretStatus(selectedCharacter?: Character): string {
  if (!selectedCharacter) {
    return "Sin datos";
  }
  if (selectedCharacter.secret?.trim()) {
    return "Hay un secreto claro";
  }
  const runtimeSignal = `${selectedCharacter.currentState ?? ""} ${selectedCharacter.currentGoal ?? ""}`;
  return /秘密|隐瞒|卧底|伪装/.test(runtimeSignal) ? "Se ha ocultado información clave." : "Ningún secreto explícito todavía";
}

export function getEmotionSignal(selectedCharacter?: Character): string {
  const runtimeSignal = `${selectedCharacter?.currentState ?? ""} ${selectedCharacter?.currentGoal ?? ""}`;
  if (/愤|怒|焦虑|崩溃|绝望/.test(runtimeSignal)) {
    return "Alta presión";
  }
  if (/平静|稳|冷静|从容/.test(runtimeSignal)) {
    return "Suave";
  }
  return "para ser visto";
}

export function getResourceDisplayMode(character?: Character): {
  label: string;
  helper: string;
  limit: number;
  shouldShowResource: (item: CharacterResourceLedgerItem) => boolean;
} {
  const roleText = `${character?.role ?? ""} ${character?.castRole ?? ""}`;
  if (isProtagonistCharacter(character)) {
    return {
      label: "Recursos completos del protagonista.",
      helper: "El protagonista mostrará completamente los accesorios, las pistas, las credenciales de identidad, las cartas de triunfo y el estado de consumo. En los capítulos siguientes se dará prioridad a la referencia a estos límites de actuación.",
      limit: 10,
      shouldShowResource: () => true,
    };
  }
  if (/临时|路人|客串|一次性/.test(roleText)) {
    return {
      label: "Recursos de roles temporales",
      helper: "Los personajes temporales solo muestran recursos que se reutilizarán en los capítulos, afectarán los conflictos, vincularán presagios o serán quitados por el protagonista.",
      limit: 5,
      shouldShowResource: (item) => (
        item.narrativeFunction === "promise"
        || item.narrativeFunction === "hidden_card"
        || item.expectedUseEndChapterOrder != null
        || item.status === "transferred"
      ),
    };
  }
  return {
    label: "Recursos clave para roles a largo plazo",
    helper: "Los personajes a largo plazo priorizan los recursos que cambian las opciones de acción, los riesgos en las relaciones, el conocimiento del lector o los presagios.",
    limit: 6,
    shouldShowResource: (item) => item.status !== "stale",
  };
}

export function getResourceStatusLabel(status: CharacterResourceLedgerItem["status"]): string {
  const labels: Record<CharacterResourceLedgerItem["status"], string> = {
    available: "Disponible",
    hidden: "Ocultar",
    borrowed: "Pedir prestado",
    transferred: "Transferir",
    lost: "Perdido",
    consumed: "Consumido",
    damaged: "Dañado",
    destroyed: "Destruir",
    stale: "Desvanecerse",
  };
  return labels[status] ?? status;
}

export function getResourceFunctionLabel(value: CharacterResourceLedgerItem["narrativeFunction"]): string {
  const labels: Record<CharacterResourceLedgerItem["narrativeFunction"], string> = {
    tool: "Herramienta",
    clue: "Clave",
    weapon: "Armas",
    proof: "Evidencia",
    key: "Clave",
    cost: "Costo",
    promise: "Presagio",
    hidden_card: "Carta de triunfo",
    constraint: "Límite",
  };
  return labels[value] ?? value;
}
