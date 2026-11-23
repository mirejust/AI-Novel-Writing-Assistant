import type { NovelWorkspaceTab } from "../novelWorkspaceNavigation";
import type { NovelEditViewProps } from "../components/NovelEditView.types";

export interface MobileSaveState {
  visible: boolean;
  label: string;
  savingLabel: string;
  isSaving: boolean;
  onSave: () => void;
}

export function getMobileNovelWorkspaceStatusText(input: {
  activeLabel: string;
  workflowLabel: string;
}): string {
  if (input.activeLabel === input.workflowLabel) {
    return `Pasos actuales:${input.activeLabel}`;
  }

  return `Pasos actuales:${input.activeLabel} · Recomendación de proceso:${input.workflowLabel}`;
}

export function getMobileNovelSaveState(
  tab: NovelWorkspaceTab,
  props: NovelEditViewProps,
): MobileSaveState {
  switch (tab) {
    case "basic":
      return {
        visible: true,
        label: "Guardar información básica",
        savingLabel: "Guardando...",
        isSaving: props.basicTab.isSaving,
        onSave: props.basicTab.onSave,
      };
    case "story_macro":
      return {
        visible: true,
        label: "Guardar plan de historia",
        savingLabel: "Guardando...",
        isSaving: props.storyMacroTab.isSaving,
        onSave: props.storyMacroTab.onSaveEdits,
      };
    case "world":
      return {
        visible: false,
        label: "",
        savingLabel: "",
        isSaving: false,
        onSave: () => undefined,
      };
    case "character":
      return {
        visible: true,
        label: "Guardar personaje",
        savingLabel: "Guardando...",
        isSaving: props.characterTab.isSavingCharacter,
        onSave: props.characterTab.onSaveCharacter,
      };
    case "outline":
      return {
        visible: true,
        label: "Guardar espacio de trabajo de volumen",
        savingLabel: "Guardando...",
        isSaving: props.outlineTab.isSaving,
        onSave: props.outlineTab.onSave,
      };
    case "structured":
      return {
        visible: true,
        label: "Guardar el sello",
        savingLabel: "Guardando...",
        isSaving: props.structuredTab.isSaving,
        onSave: props.structuredTab.onSave,
      };
    default:
      return {
        visible: false,
        label: "",
        savingLabel: "",
        isSaving: false,
        onSave: () => undefined,
      };
  }
}
