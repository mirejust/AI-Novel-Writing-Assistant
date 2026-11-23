import type { DirectorArtifactRef } from "@ai-novel/shared/types/directorRuntime";
import type { NovelWorkflowStage } from "@ai-novel/shared/types/novelWorkflow";
import { DIRECTOR_PROGRESS, type DirectorProgressItemKey } from "../projections/novelDirectorProgress";

export type DirectorPlanningStage =
  | "story_macro"
  | "book_contract"
  | "world_setup"
  | "character_setup"
  | "volume_strategy"
  | "structured_outline";

export interface DirectorStageNodeAdapter {
  nodeKey: string;
  label: string;
  targetType: DirectorArtifactRef["targetType"];
  reads: string[];
  writes: string[];
  mayModifyUserContent: boolean;
  requiresApprovalByDefault: boolean;
  supportsAutoRetry: boolean;
  waitingState: {
    stage: NovelWorkflowStage;
    itemKey: DirectorProgressItemKey;
    itemLabel: string;
    progress: number;
  };
}

export const DIRECTOR_STAGE_NODE_ADAPTERS: Record<DirectorPlanningStage, DirectorStageNodeAdapter> = {
  story_macro: {
    nodeKey: "story_macro_phase",
    label: "Generar macroplanificación de historias",
    targetType: "novel",
    reads: ["book_seed", "candidate_batch"],
    writes: ["story_macro"],
    mayModifyUserContent: true,
    requiresApprovalByDefault: false,
    supportsAutoRetry: false,
    waitingState: {
      stage: "story_macro",
      itemKey: "story_macro",
      itemLabel: "A la espera de la confirmación del plan macro de la historia.",
      progress: DIRECTOR_PROGRESS.storyMacro,
    },
  },
  book_contract: {
    nodeKey: "book_contract_phase",
    label: "Generar convenciones de creación a nivel de libro.",
    targetType: "novel",
    reads: ["story_macro", "book_seed", "candidate_batch"],
    writes: ["book_contract"],
    mayModifyUserContent: true,
    requiresApprovalByDefault: false,
    supportsAutoRetry: false,
    waitingState: {
      stage: "story_macro",
      itemKey: "book_contract",
      itemLabel: "Esperando confirmación del acuerdo de redacción a nivel de libro",
      progress: DIRECTOR_PROGRESS.bookContract,
    },
  },
  world_setup: {
    nodeKey: "world_setup_phase",
    label: "preparar el mundo del libro",
    targetType: "novel",
    reads: ["story_macro", "book_contract", "book_seed"],
    writes: ["world_skeleton"],
    mayModifyUserContent: true,
    requiresApprovalByDefault: false,
    supportsAutoRetry: false,
    waitingState: {
      stage: "world_setup",
      itemKey: "world_setup",
      itemLabel: "Preparando la cosmovisión de este libro",
      progress: DIRECTOR_PROGRESS.worldSetup,
    },
  },
  character_setup: {
    nodeKey: "character_setup_phase",
    label: "Preparar la alineación de personajes y los activos de los personajes.",
    targetType: "novel",
    reads: ["book_contract", "story_macro"],
    writes: ["character_cast"],
    mayModifyUserContent: true,
    requiresApprovalByDefault: false,
    supportsAutoRetry: false,
    waitingState: {
      stage: "character_setup",
      itemKey: "character_setup",
      itemLabel: "Esperando confirmar el elenco de personajes.",
      progress: DIRECTOR_PROGRESS.characterSetup,
    },
  },
  volume_strategy: {
    nodeKey: "volume_strategy_phase",
    label: "Generar estrategias de implementación y rutas de avance.",
    targetType: "novel",
    reads: ["book_contract", "story_macro", "character_cast"],
    writes: ["volume_strategy"],
    mayModifyUserContent: true,
    requiresApprovalByDefault: false,
    supportsAutoRetry: false,
    waitingState: {
      stage: "volume_strategy",
      itemKey: "volume_strategy",
      itemLabel: "Esperando confirmación de la estrategia de asignación de volumen",
      progress: DIRECTOR_PROGRESS.volumeStrategy,
    },
  },
  structured_outline: {
    nodeKey: "structured_outline_phase",
    label: "Generar lista de tareas del capítulo",
    targetType: "novel",
    reads: ["volume_strategy", "character_cast"],
    writes: ["chapter_task_sheet"],
    mayModifyUserContent: true,
    requiresApprovalByDefault: false,
    supportsAutoRetry: false,
    waitingState: {
      stage: "structured_outline",
      itemKey: "chapter_detail_bundle",
      itemLabel: "Esperando confirmación del orden de las tareas del capítulo",
      progress: DIRECTOR_PROGRESS.chapterDetailStart,
    },
  },
};

export function getDirectorStageNodeAdapter(stage: DirectorPlanningStage): DirectorStageNodeAdapter {
  return DIRECTOR_STAGE_NODE_ADAPTERS[stage];
}
