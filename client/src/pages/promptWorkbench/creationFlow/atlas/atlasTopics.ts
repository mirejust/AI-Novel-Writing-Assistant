/** Editorial cross-references. These links describe use, rather than the order of model calls. */
export interface AtlasTopic {
  id: string;
  title: string;
  description: string;
  steps: string[];
  prompts: [id: string, title: string, companionTo?: string[]][];
}
export interface AtlasScope {
  id: string;
  title: string;
  skin: string;
  topics: AtlasTopic[];
}
export interface AtlasLocation { scope: string; topic?: string }

export const atlasScopes: AtlasScope[] = [
  {
    id: "opening", title: "Abre el libro y establece la dirección.", skin: "opening", topics: [
      { id: "ideas", title: "Encuentra inspiración para la historia", description: "Comience con una idea o un conjunto de elementos de la historia y encuentre la dirección en la que puede llevar su libro.", steps: ["idea", "inspiration"],
        prompts: [
          ["novel.director.idea_inspiration", "Generar inspiración para abrir un libro."],
          ["novel.director.idea_constellation_options", "Elige elementos de la historia"],
          ["novel.director.idea_constellation_compose", "Combinando elementos en historias."],
          ["novel.framing.suggest", "Planificar el posicionamiento de la obra.", ["idea"]],
        ] },
      { id: "pitches", title: "Comparar y pulir planes de apertura de libros.", description: "Desarrollar candidatos a partir de dos rutas, nombrar el plan, discutir y adoptar cambios.", steps: ["directions", "new-directions", "candidates", "titles", "discuss", "retitle", "choose"],
        prompts: [
          ["novel.director.direction_pair", "Piensa en dos direcciones"],
          ["novel.director.candidates", "Ampliar alternativas"],
          ["novel.director.candidate_titles", "Elija el título de un libro para el candidato"],
          ["novel.director.candidate_dialogue", "Discutir alternativas"],
          ["novel.director.candidate_patch", "Modificar candidatos", ["discuss"]],
          ["title.generation", "Redactar de forma independiente el título de un libro.", ["titles", "retitle"]],
        ] },
      { id: "position", title: "Materia, lectores y modo de promoción", description: "Elige un tema, una plataforma y una progresión de la historia para el libro que estás imaginando.", steps: [],
        prompts: [
          ["novel.create.resource_recommendation", "Temas coincidentes y modos de promoción.", ["idea"]],
          ["novel.writing_platform.recommend", "Plataforma de escritura recomendada"],
          ["genre.tree.generate", "Clasificar categorías de temas"],
          ["storyMode.tree.generate", "Ordenando el modo historia"],
          ["storyMode.child.generate", "Modo historia subdividida"],
          ["storyMode.expansion.recommend", "Dirección de expansión del modo recomendado"],
        ] },
      { id: "market", title: "Selección de temas de mercado de referencia", description: "Lea las señales de la plataforma en el radar del mercado y refine el informe como referencia al abrir un libro.", steps: [],
        prompts: [
          ["market_radar.platform_digest", "Señales de lista completa de plataformas"],
          ["market_radar.cross_platform_synthesis", "Compara diferentes plataformas"],
          ["market_radar.creative_brief", "Refinando la sesión informativa de apertura", ["idea"]],
        ] },
    ],
  },
  {
    id: "foundation", title: "Construye todo el libro", skin: "foundation", topics: [
      { id: "story-design", title: "Determinar la línea principal del libro.", description: "Establezca un hilo conductor, convenciones creativas y materiales reutilizables en torno a la historia elegida.", steps: ["story", "contract"],
        prompts: [
          ["novel.story_macro.decomposition", "Planificación de la línea principal del libro."],
          ["novel.story_macro.field_regeneration", "Ajustar una configuración en la línea principal", ["story"]],
          ["novel.director.book_contract", "Determinar el acuerdo de escritura para todo el libro."],
          ["novel.creative_carryover.contract", "Organizar las limitaciones creativas para emprender.", ["contract"]],
          ["novel.director.blueprint", "Desarrollar un plan de director", ["story"]],
          ["novel.bible.generate", "Compile un conjunto de configuraciones de libro completo"],
        ] },
      { id: "world-build", title: "Construye el esqueleto del mundo.", description: "A partir del tema del libro o del borrador mundial, organice las reglas, la estructura y los diferentes niveles de configuración.", steps: ["world", "reuse-world"],
        prompts: [
          ["novel.world.generate_from_theme", "Generar un mundo a partir de los temas de este libro."],
          ["world.draft.generate", "Redactando un escenario mundial", ["world"]],
          ["world.skeleton.generate", "Construye el esqueleto del mundo.", ["world"]],
          ["world.structure.generate", "Generar capítulos de estructura mundial.", ["world"]],
          ["world.structure.backfill", "Completa la estructura mundial.", ["world"]],
          ["world.layer.generate", "Expandir un nivel mundial", ["world"]],
          ["world.layer.localize", "Organizar la descripción china de la capa de configuración."],
        ] },
      { id: "world-ideas", title: "Buscando materiales de ambientación mundial", description: "Recopile referencias en el banco de trabajo de cosmovisión y seleccione propiedades, axiomas y conceptos adecuados.", steps: [],
        prompts: [
          ["world.reference.inspiration", "Encuentre inspiración en materiales de referencia"],
          ["world.inspiration.concept_card", "Tarjeta conceptual del mundo de refinación"],
          ["world.inspiration.localize_concept_card", "Traducir tarjetas conceptuales al chino"],
          ["world.import.extract", "Extraer la configuración mundial de los datos", ["world"]],
          ["world.property_options.generate", "Concebir propiedades del mundo"],
          ["world.axioms.suggest", "Axiomas mundiales recomendados", ["world"]],
        ] },
      { id: "world-refine", title: "Profundización y revisión del entorno mundial", description: "Complemente los entornos existentes mediante preguntas y borradores alternativos, y luego compruebe si hay contradicciones internas.", steps: [],
        prompts: [
          ["world.draft.refine", "Refinar el borrador mundial", ["world"]],
          ["world.draft.refine_alternatives", "Comparar alternativas de borrador mundial", ["world"]],
          ["world.deepening.questions", "Solicite detalles de configuración", ["world"]],
          ["world.deepening.integrate_answers", "Integrando el mundo Respuestas complementarias", ["world"]],
          ["world.consistency.check", "Comprobar la coherencia de la configuración mundial", ["world"]],
          ["world.visualization.generate", "Visualiza la configuración mundial"],
        ] },
      { id: "cast-build", title: "Reúne un elenco de personajes.", description: "Genera un elenco completo o crea personajes y relaciones paso a paso según las necesidades del libro.", steps: ["cast"],
        prompts: [
          ["novel.character.castAuto", "Crear alineación automáticamente"],
          ["novel.character.castAuto.members", "Generar miembros de alineación"],
          ["novel.character.castAuto.relations", "Construir relaciones de membresía"],
          ["novel.character.castOptions", "Concebir alineaciones alternativas", ["cast"]],
          ["novel.production.characters", "Prepárate para crear los personajes que necesitas", ["cast"]],
          ["character.base.skeleton", "Construir el esqueleto del personaje", ["cast"]],
          ["character.base.final", "Perfecciona el borrador del personaje.", ["cast"]],
        ] },
      { id: "cast-edit", title: "Completar y corregir la información del personaje.", description: "Analice la configuración de los personajes, complete los caracteres que faltan y verifique la información de los personajes.", steps: ["cast-discussion"],
        prompts: [
          ["novel.director.cast_dialogue", "Discutir los roles actuales"],
          ["novel.character.castAuto.repair", "Arreglar la alineación automática", ["cast"]],
          ["novel.character.castAuto.zhNormalize", "Descripción china de la alineación automática unificada", ["cast"]],
          ["novel.character.castOptions.repair", "Arreglar alineación alternativa", ["cast"]],
          ["novel.character.castOptions.zhNormalize", "Descripción china de la alineación alternativa unificada", ["cast"]],
          ["novel.character.supplemental", "Complementar los roles requeridos", ["cast"]],
          ["novel.character.supplemental.zhNormalize", "Organizar información china sobre caracteres suplementarios.", ["cast"]],
          ["novel.character.visible_profile.complete", "Archivos visibles de rol completo", ["cast"]],
          ["novel.character.worldCheck", "Comprueba los personajes y la configuración del mundo.", ["cast"]],
        ] },
    ],
  },
  {
    id: "volumes", title: "Organizar en volúmenes", skin: "volumes", topics: [
      { id: "volumes-plan", title: "Organizar las responsabilidades y el ritmo de cada volumen.", description: "Desde estrategia de volumen, reseñas y esqueletos de volumen hasta el ritmo y la disposición de los capítulos del volumen actual.", steps: ["strategy", "critique", "skeleton", "volume-discussion", "beats", "chapter-list", "next-volume"],
        prompts: [
          ["novel.volume.strategy", "Desarrollar una estrategia de implementación"],
          ["novel.volume.strategy.critique", "Verifique la disposición del papel"],
          ["novel.volume.skeleton", "Generar el esqueleto de cada volumen."],
          ["novel.volume.summary_emphasis", "Resaltar conflictos y transiciones en el programa de estudios.", ["skeleton"]],
          ["novel.director.volume_dialogue", "Discutir el programa de estudios actual"],
          ["novel.volume.beat_sheet", "Organizar el ritmo dentro del volumen."],
          ["novel.volume.chapter_list", "Lista de capítulos divididos"],
          ["novel.volume.chapter_title_repair", "Ajustar nombres de capítulos similares"],
          ["novel.volume.rebalance.adjacent", "Nivelación de dos volúmenes adyacentes", ["critique"]],
        ] },
      { id: "outline-workspace", title: "Organizar capítulos en el banco de trabajo de esquemas.", description: "Genere, importe o analice un esquema, refine el ritmo por volumen y proponga revisiones.", steps: [],
        prompts: [
          ["outline.initial_generate", "Redactar un esquema"],
          ["outline.import_parse", "Analizar contornos importados"],
          ["outline.workbench_dialogue", "Discusión continua en torno al esquema."],
          ["outline.volume_beats", "Organizar secciones rítmicas para cada volumen.", ["beats"]],
          ["outline.edit_proposal", "Proponer un plan para revisar el esquema."],
          ["outline.volume_review", "Ajustar el contorno del volumen seleccionado"],
          ["outline.chapter_review", "Revisar el esquema del capítulo seleccionado."],
          ["outline.text_feedback", "Devolver los comentarios del capítulo al esquema"],
          ["outline.character_impact", "Evaluar el impacto de los ajustes de carácter en el esquema."],
        ] },
      { id: "planning", title: "Planificación del arco narrativo y la duración.", description: "Estructurar libros completos, arcos narrativos y libros largos en formato breve al planificar o replanificar.", steps: [],
        prompts: [
          ["planner.book.plan", "Planifica todo el libro", ["story"]],
          ["planner.arc.plan", "planificación del arco argumental", ["strategy"]],
          ["planner.replan.window_decision", "Determinar el alcance de la replanificación."],
          ["novel.outline.generate", "Generar esquema narrativo", ["story"]],
          ["novel.structuredOutline.generate", "Generar esquema estructurado"],
          ["novel.structuredOutline.repair", "Arreglar esquema estructurado"],
          ["novel.draft_optimize.selection", "Reescribir parcialmente el borrador del esquema."],
          ["novel.draft_optimize.full", "Borrador del esquema de optimización general"],
          ["novel.compact_book.structure", "Planificar una estructura de libro compacta", ["strategy"]],
        ] },
      { id: "volume-continuity", title: "Personajes y presagios en el volumen.", description: "Al organizar los capítulos, compare la apariencia de los personajes, la dirección de las relaciones y la disposición de los presagios en el esquema.", steps: [],
        prompts: [
          ["novel.character.initial_schedule", "Organizar la primera aparición del personaje.", ["chapter-list"]],
          ["novel.characterDynamics.volumeProjection", "Deduciendo la relación entre los personajes del volumen.", ["chapter-list"]],
          ["novel.payoff_ledger.outline_sync", "Sincronizar el presagio con el contorno.", ["chapter-list"]],
        ] },
    ],
  },
  {
    id: "preparation", title: "Prepara este capítulo", skin: "preparation", topics: [
      { id: "chapter-mission", title: "Refinar las tareas en este capítulo.", description: "Aclare los objetivos, los límites escribibles y la disposición de las escenas de este capítulo y compruebe si se pueden escribir.", steps: ["mission", "check-mission", "chapter-discussion", "sync", "next-chapter"],
        prompts: [
          ["planner.chapter.plan", "Planificando este capítulo", ["mission"]],
          ["novel.volume.chapter_purpose", "Aclarar el propósito del capítulo.", ["mission"]],
          ["novel.volume.chapter_boundary", "Delinear los límites del capítulo", ["mission"]],
          ["novel.volume.chapter_task_sheet", "Crear una lista de tareas del capítulo", ["mission"]],
          ["novel.volume.chapter_execution_contract", "Refinar tareas y escenarios"],
          ["novel.director.chapter_dialogue", "Discutir las tareas y escenarios del capítulo actual."],
          ["novel.volume.chapter_task_sheet_quality", "Orden de las tareas de evaluación"],
          ["novel.beat.generate", "Latidos de la trama del diseño", ["mission"]],
          ["novel.chapterHook.generate", "Próximamente con ganchos de capítulo", ["mission"]],
        ] },
      { id: "scene-material", title: "Preparar personajes y materiales de escena.", description: "Cuando necesites complementar los materiales de la escena, puedes acceder a la configuración del mundo local o explorar las opciones actuales de los personajes.", steps: ["materials"],
        prompts: [
          ["storyWorldSlice.generate", "Extrae las piezas del mundo necesarias para la historia.", ["materials"]],
          ["novel.character.mind.snapshot", "Formar una instantánea psicológica del personaje.", ["materials"]],
          ["novel.character.influence.options", "Explora las opciones de influencia del personaje"],
          ["novel.character.dialogue.turn", "Deduciendo el diálogo entre los personajes de este libro."],
          ["character.conversation.turn", "Tener una conversación con el personaje."],
        ] },
      { id: "style-profile", title: "Preparando cómo escribir este libro.", description: "Extraiga los métodos de escritura del texto principal, los resultados del desmontaje de libros o los resúmenes creativos, y clasifique las restricciones de estilo que se pueden utilizar durante la generación.", steps: [],
        prompts: [
          ["style.profile.extract", "Extraer archivos de estilo del texto"],
          ["style.profile.from_book_analysis", "Extraer métodos de escritura a partir de los resultados de dividir el libro."],
          ["style.profile.from_brief", "Cómo escribir a partir de un resumen", ["materials"]],
          ["style.profile.metadata", "Organizar la información del archivo de estilo"],
          ["style.profile.select_anti_ai", "Seleccione reglas de desacentuación de IA para la escritura"],
          ["style.profile.sanitize_for_generation", "Organizar restricciones de estilo para la generación.", ["materials"]],
          ["style.anti_ai_rule.draft", "Redacción de reglas para la eliminación de cavidades con IA"],
          ["style.recommendation", "Método de escritura recomendado", ["materials"]],
        ] },
    ],
  },
  {
    id: "writing", title: "Escribir texto", skin: "writing", topics: [
      { id: "chapter-text", title: "Redacción y revisión del texto.", description: "Redacte texto, diagnostique problemas, compare reescrituras y vistas previas de continuación en Escritura de capítulos y Editor de capítulos.", steps: ["draft"],
        prompts: [
          ["novel.chapter.writer", "Generar el texto de este capítulo."],
          ["novel.chapter_editor.workspace_diagnosis", "Diagnosticar el capítulo actual"],
          ["novel.chapter_editor.user_intent", "Comprender los requisitos de revisión"],
          ["novel.chapter_editor.rewrite_candidates", "Generar reescrituras de candidatos", ["repair"]],
          ["novel.chapter_editor.continue_preview", "Vista previa del siguiente texto", ["draft"]],
        ] },
      { id: "review", title: "Corrección y edición", description: "Seleccione revisión rápida, revisión de texto completo, revisión parcial o revisión de cierre según el escenario de revisión actual.", steps: ["review", "repair", "verify", "save", "finish","prose-discussion","final-inspection"],
        prompts: [
          ["novel.chapter.acceptance_assessment", "Aceptar capítulos seleccionados"],
          ["novel.director.final_inspection", "Reseña completa del libro"],
          ["novel.director.prose_dialogue", "Discuta el texto de este capítulo."],
          ["audit.chapter.light", "Revisar rápidamente los capítulos", ["review"]],
          ["audit.chapter.full", "Capítulo de revisión completo", ["review"]],
          ["novel.review.chapter", "Revisar el texto del capítulo", ["review"]],
          ["novel.review.patch", "Revisión parcial"],
          ["novel.review.repair", "Editar todo el capitulo", ["repair"]],
          ["novel.continuation.rewrite_similarity", "Reescribe pasajes similares en la continuación.", ["repair"]],
          ["novel.compact_book.ending_audit", "Consulta el final del libro.", ["finish"]],
        ] },
      { id: "chapter-memory", title: "Traiga cambios al futuro", description: "Después de guardar el texto principal, mantenga el resumen, el estado de los personajes, la línea de tiempo y el presagio con respecto al texto original.", steps: ["extract"],
        prompts: [
          ["novel.chapter.artifact_delta.extract", "Extraiga los cambios de la historia en este capítulo."],
          ["novel.chapter.summary", "Generar resúmenes de capítulos", ["extract"]],
          ["novel.timeline.extractor", "Extraer línea de tiempo", ["extract"]],
          ["novel.characterDynamics.chapterExtract", "Extraer cambios en las relaciones de los personajes.", ["extract"]],
          ["novel.character_resource.extract_updates", "Extraer cambios de recursos de rol", ["extract"]],
          ["novel.payoff_ledger.sync", "Actualizar el libro de presagios", ["extract"]],
          ["state.snapshot.extract", "Extraer instantánea del estado de la historia", ["extract"]],
        ] },
      { id: "follow-up", title: "Seguimiento de cuestiones de personajes y directores.", description: "Compruebe si es necesario sincronizar el perfil del personaje y evalúe el impacto posterior si se realizan cambios o se encuentran problemas.", steps: [],
        prompts: [
          ["novel.character.evolve", "Actualizar el crecimiento del personaje.", ["extract"]],
          ["character.sync.classify", "Determinar el método de sincronización de roles."],
          ["novel.director.workspace_analysis", "Espacio de trabajo del director de análisis"],
          ["novel.director.manual_edit_impact", "Evaluar el impacto de las modificaciones manuales."],
          ["director.issue.assessment", "Evaluar los problemas del director."],
          ["director.state_proposal_resolution", "Determinar la propuesta de estado"],
        ] },
    ],
  },
  {
    id: "tools", title: "Herramientas creativas independientes", skin: "opening", topics: [
      { id: "short-stories", title: "Escritura de cuentos cortos", description: "El banco de trabajo de cuentos le permite hacer planes basados en materiales de referencia, escribir párrafo por párrafo y luego leer el texto completo y revisarlo.", steps: [],
        prompts: [
          ["creation.short_story.reference.extract", "Refinar los materiales de referencia para cuentos"],
          ["novel.short_story.plan", "Planificando una historia corta"],
          ["novel.short_story.segment.write", "Genera fragmentos cortos"],
          ["novel.short_story.full.audit", "Revisa el texto completo del cuento."],
          ["novel.short_story.patch.repair", "Cuento parcialmente revisado"],
          ["novel.short_story.revision.impact", "Evaluar el impacto de los cambios en los cuentos"],
        ] },
      { id: "manuscript", title: "Comience con un manuscrito existente", description: "Después de importar el manuscrito original, puede extraer los hechos originales, invertir el esquema, verificar el final y también diagnosticar el capítulo del trabajo actual.", steps: [],
        prompts: [
          ["manuscript.chapter.extract", "Extraer datos del capítulo del manuscrito"],
          ["manuscript.outline.merge", "Resumiendo un esquema del manuscrito original."],
          ["manuscript.outline.verify", "Consulta el esquema del manuscrito."],
          ["manuscript.chapter.diagnose", "Capítulo de trabajo del manuscrito de diagnóstico."],
        ] },
      { id: "reference-books", title: "Desmantelamiento de obras de referencia.", description: "Divida las obras de referencia en capítulos, tome notas de las fuentes y luego genere y pula el informe de desmontaje del libro.", steps: [],
        prompts: [
          ["bookAnalysis.chapter.split", "Dividir capítulos de libros de referencia"],
          ["bookAnalysis.source.note", "Organizar notas fuente"],
          ["bookAnalysis.section.generate", "Redactar un informe sección por sección"],
          ["bookAnalysis.section.optimize", "Optimizar el seccionamiento del informe de desmontaje del libro."],
        ] },
      { id: "reference-cast", title: "Desglosando los personajes del libro de referencia.", description: "Identifique personajes del texto original, cree perfiles y organice evidencia física en todos los capítulos.", steps: [],
        prompts: [
          ["bookAnalysis.character.identify", "Identificar personajes originales."],
          ["bookAnalysis.character.profile", "Organizar archivos de personajes originales."],
          ["bookAnalysis.character.generate", "Generar perfil de referencia"],
          ["bookAnalysis.character.appearance.snapshot", "Extraer una instantánea de la apariencia de una persona."],
          ["bookAnalysis.character.appearance.consolidate", "Resumir la evidencia física"],
          ["bookAnalysis.character.appearance.merge", "Fusionar registros de apariencia"],
        ] },
      { id: "style-lab", title: "Fórmulas de estilo y escritura.", description: "Pruebe su estilo de escritura en la herramienta de escritura, extraiga fórmulas de escritura reutilizables e intente escribirlas o reescribirlas.", steps: [],
        prompts: [
          ["style.detection", "Detectar estilo de texto"],
          ["style.generate", "Generar contenido por estilo"],
          ["style.rewrite", "Adaptarse al estilo"],
          ["writingFormula.extract.stream", "Extraer fórmulas de escritura del texto"],
          ["writingFormula.apply.generate.stream", "Intente escribir usando fórmulas de escritura"],
          ["writingFormula.apply.rewrite.stream", "Reescribir usando fórmulas de escritura"],
        ] },
      { id: "images", title: "Portada e ilustraciones", description: "Prepare un resumen de portada de novela, ilustraciones de personajes y descripciones de texto necesarias para la generación de imágenes.", steps: [],
        prompts: [
          ["image.character.prompt_optimize", "Descripciones de personajes polacos"],
          ["image.generation_prompt.assist", "Ayudar a escribir indicaciones con imágenes."],
          ["image.novel_cover.brief", "Organizar una sesión informativa sobre la portada de la novela."],
          ["image.novel_cover.prompt_optimize", "Consejos para pulir las imágenes de portada"],
        ] },
      { id: "comic", title: "Adaptación cómica", description: "Extraiga la base para la adaptación del texto original y luego prepare episodios cómicos y guiones gráficos.", steps: [],
        prompts: [
          ["comic.factExtraction", "Extraer datos de adaptación del cómic."],
          ["comic.episodeOutline", "Planificación de episodios de cómics"],
          ["comic.panelScript", "Escribir guiones gráficos de cómics"],
        ] },
      { id: "drama-source", title: "Materiales de juego cortos y planificación.", description: "Prepare materiales originales o adaptados, elija la pista de la obra corta y la estrategia creativa, y luego organice los episodios.", steps: [],
        prompts: [
          ["drama.source.original_bundle", "Preparar materiales originales de juego corto."],
          ["drama.source.text_bundle", "Organizar y adaptar material original."],
          ["drama.source.supplement", "Material complementario de juego corto."],
          ["drama.track.recommendation", "Pista dramática corta recomendada"],
          ["drama.strategy", "Desarrollar una estrategia de creación de obras cortas."],
          ["drama.episodeOutline", "Organizar episodios de obras cortas."],
        ] },
      { id: "drama-script", title: "Guión de obra corta y storyboard.", description: "Después de escribir el guión de un solo episodio, puedes comprobar la calidad y el cumplimiento antes de revisar y organizar las tomas.", steps: [],
        prompts: [
          ["drama.episode.script", "Escribe un guión de un solo episodio."],
          ["drama.episode.quality", "Revisar la calidad de un solo episodio"],
          ["drama.episode.compliance", "Lista de verificación establecer reglas"],
          ["drama.episode.repair", "Revisar el guión de un solo episodio."],
          ["drama.storyboard", "Diseñar guiones gráficos cortos de drama."],
          ["drama.video.prompt", "Escribir vídeo para generar palabras rápidas."],
        ] },
      { id: "guidance", title: "Asistente de creación y recuperación de datos.", description: "Los asistentes de creación brindan orientación y respuestas de resultados a pedido, y una base de conocimientos agrega contexto a los fragmentos recuperados.", steps: [],
        prompts: [
          ["creation.intent.interpret", "Comprender las solicitudes de creación"],
          ["planner.intent.parse", "Comprender la intención de planificación del asistente"],
          ["agent.runtime.setup_guidance", "Configuración de creación guiada"],
          ["agent.runtime.setup_ideation", "Inspirar ideas para historias"],
          ["agent.runtime.fallback_answer", "Organizar las respuestas del asistente"],
          ["rag.contextual_chunk.prefix", "Contexto complementario para piezas de conocimiento."],
        ] },
    ],
  },
];

export function relatedAtlasLocation(stageId: string, stepId: string): AtlasLocation {
  for (const scope of atlasScopes) {
    const topic = scope.topics.find(item => item.steps.includes(stepId));
    if (topic) return { scope: scope.id, topic: topic.id };
  }
  return { scope: stageId };
}
