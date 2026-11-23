import { definePlan } from "../domain";

/** Only asset producers belong here; chapter audit and state sync remain inside the production pipeline. */
export const directorProductionPlan = definePlan({
  version: "director-next-production-v1",
  externalArtifacts: ["novel_seed", "chapter_draft"],
  steps: [
    { id: "story_macro", label: "Generar macroplanificación de historias", requires: ["novel_seed"], produces: "story_macro", needs: ["structured_output"], gateable: false, overwrites: ["story_macro"] },
    { id: "book_contract", label: "Generar convenciones de creación a nivel de libro.", requires: ["novel_seed", "story_macro"], produces: "book_contract", needs: ["structured_output"], gateable: false, overwrites: ["book_contract"] },
    { id: "world_setup", label: "preparar el mundo del libro", requires: ["novel_seed", "story_macro", "book_contract"], produces: "world_skeleton", needs: ["structured_output"], gateable: false, overwrites: ["world_skeleton"] },
    { id: "character_setup", label: "Preparar la alineación de personajes y los activos de los personajes.", requires: ["story_macro", "book_contract", "world_skeleton"], produces: "character_cast", needs: ["structured_output"], gateable: true, overwrites: ["character_cast"] },
    { id: "volume_strategy", label: "Generar estrategias de implementación y rutas de avance.", requires: ["story_macro", "book_contract", "character_cast"], produces: "volume_strategy", needs: ["structured_output"], gateable: true, overwrites: ["volume_strategy"] },
    { id: "volume_beat_sheet", label: "Generar tablero de ritmo de volumen objetivo", requires: ["volume_strategy", "character_cast"], produces: "volume_beat_sheet", needs: ["structured_output"], gateable: false, overwrites: ["chapter_task_sheet"], preservesInChapterRange: ["volume_beat_sheet", "chapter_task_sheet"] },
    { id: "volume_chapter_list", label: "Generar volumen y lista de capítulos.", requires: ["volume_strategy", "character_cast", "volume_beat_sheet"], produces: "volume_chapter_list", needs: ["structured_output"], gateable: false, overwrites: ["chapter_task_sheet"], preservesInChapterRange: ["volume_chapter_list", "chapter_task_sheet"] },
    { id: "chapter_detail_bundle", label: "Refinar las órdenes de tareas de los capítulos y los recursos de ejecución", requires: ["volume_chapter_list"], produces: "chapter_task_sheet", needs: ["structured_output"], gateable: true, overwrites: ["chapter_task_sheet"] },
    { id: "execution_contract_sync", label: "Contrato de Ejecución de Capítulo Síncrono", requires: ["chapter_task_sheet"], produces: "chapter_execution_contract", needs: [], gateable: true, overwrites: [] },
    { id: "chapter_batch", label: "Ejecutar lote de generación de capítulos", requires: ["chapter_execution_contract"], produces: "chapter_batch_closed", needs: [], gateable: true, overwrites: ["chapter_draft"] },
  ],
});
