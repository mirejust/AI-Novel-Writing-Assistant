export type StepKind = "author" | "ai" | "system" | "destination";
export interface Step {
  id: string;
  title: string;
  kind: StepKind;
  artifact: string;
  input: string;
  output: string;
  templates?: readonly (readonly [key: string, title: string, assetId?: string])[];
  destination?: string;
}
export interface Branch {
  from: string;
  steps: Step[];
  join?: string;
  label: string;
}
export interface FlowStage {
  id: string;
  coverStep: string;
  title: string;
  description: string;
  main: Step[];
  branches?: Branch[];
}
function ai(id: string, title: string, artifact: string, input: string, output: string, key: string, assetId = key): Step {
  return { id, title, artifact, input, output, kind: "ai", templates: [[key, title, assetId]] };
}
function link(id: string, title: string, artifact: string, destination: string, input: string, output: string): Step {
  return { id, title, artifact, kind: "destination", destination, input, output };
}

export const stages: FlowStage[] = [
  {
    id: "opening", coverStep: "directions", title: "Abre el libro y establece la dirección.", description: "Comienza con una historia que quieras escribir y elige una dirección que valga la pena escribir en un libro.",
    main: [
      { id: "idea", title: "Introduzca la idea de la historia", artifact: "Una frase de inspiración para abrir un libro.", kind: "author", input: "Un tema, personaje o escena persistente sobre el que quieras escribir.", output: "La idea de apertura del libro sirve como punto de partida común para ambos conjuntos de direcciones candidatas." },
      ai("directions", "Piensa en dos direcciones", "Dos rutas comparables", "Ideas y escenarios de la historia que el autor desea preservar.", "Dos elecciones que cambiarán el rumbo de todo el libro, cada una a su manera.", "novel.director.direction_pair"),
      ai("candidates", "Ampliar alternativas", "Dos planes completos", "Dos caminos de historia elegidos.", "El protagonista, conflicto central, apertura y seguimiento de avances de cada plan.", "novel.director.candidates"),
      ai("titles", "Desarrollar títulos de libros para los candidatos.", "Títulos de libros alternativos y motivos de recomendación.", "La historia detalla este conjunto de planes y la dirección de otro conjunto en la misma ronda.", "Un conjunto de títulos de libros alternativos, motivos del título y títulos recomendados. El título del libro también se rehace usando este mensaje.", "novel.director.candidate_titles"),
      { id: "choose", title: "Seleccionar plan de apertura de libro", artifact: "Plan de apertura de libros seleccionados.", kind: "author", input: "Candidatos y cambios adoptados para esta ronda.", output: "Un conjunto de planos de historias seleccionados por el autor como punto de partida para un nuevo libro." },
    ],
    branches: [
      { from: "idea", label: "Aún no he decidido qué escribir", join: "directions", steps: [
        { id: "inspiration", title: "Encuentra inspiración para la historia", artifact: "Semillas de historias que se pueden recuperar", kind: "ai", input: "Preferencias de tema o elementos de historia seleccionados.", output: "Se puede traer una frase de inspiración al libro para ingresar.",
          templates: [["novel.director.idea_inspiration", "Genera inspiración directamente"], ["novel.director.idea_constellation_options", "Encuentra elementos de la historia"], ["novel.director.idea_constellation_compose", "Combina elementos seleccionados"]] },
      ] },
      { from: "candidates", label: "Ningún conjunto es adecuado", join: "candidates", steps: [
        ai("new-directions", "Reinventar la dirección", "Una nueva ronda de historias", "La última ronda de planes y lo que esperamos cambiar en esta ronda.", "Las dos direcciones en la nueva ronda ofrecen candidatos para un mayor desarrollo.", "next-direction-pair", "novel.director.direction_pair"),
      ] },
      { from: "titles", label: "Quiero pulir uno de ellos", join: "choose", steps: [
        ai("discuss", "Discutir alternativas", "Sugerencias de modificación adoptables", "Protocolos actuales, historial de discusiones y cuestiones de autor.", "Una explicación del plan o sugerencias de modificaciones que se puedan adoptar caso por caso.", "novel.director.candidate_dialogue"),
      ] },
      { from: "titles", label: "Ajustar solo el título del libro.", join: "choose", steps: [
        ai("retitle", "Rehacer títulos de candidatos", "Título reescrito", "Candidatos actuales, títulos existentes y opiniones de autores sobre títulos.", "Un conjunto de títulos candidatos para la reselección.", "novel.director.candidate_titles"),
      ] },
    ],
  },
  {
    id: "foundation", coverStep: "cast", title: "Construye todo el libro", description: "Determina cómo avanza la historia y en qué mundo pueden moverse los personajes.",
    main: [
      ai("story", "Planificación de la línea principal del libro.", "Contradicciones, giros y recompensas.", "La dirección de la historia elegida y el escenario de apertura del libro.", "Puede respaldar la contradicción central, el método de avance y las recompensas clave de la novela.", "novel.story_macro.decomposition"),
      ai("contract", "Determinar el acuerdo de escritura para todo el libro.", "Acuerdo de creación de libros", "Dirección de apertura del libro, argumento y duración objetivo.", "Expectativas de los lectores, dirección del crecimiento del personaje y límites creativos a lo largo del libro.", "novel.director.book_contract"),
      ai("world", "Preparar la configuración mundial", "Reglas, poderes y lugares", "Tema, argumento principal y convenciones creativas de todo el libro.", "Las reglas, fuerzas y ubicaciones necesarias para generar este libro.", "novel.world.generate_from_theme"),
      { id: "cast", title: "Preparar la alineación de personajes.", artifact: "Alineación de personajes y relaciones.", kind: "ai", input: "Las responsabilidades del personaje y el escenario mundial disponible requerido por la historia.",
        output: "Personajes principales, relaciones y hechos de los personajes que limitan lo que sigue. Si ya tienes una alineación, puedes usarla.",
        templates: [["novel.character.castAuto", "Generar alineación completa"], ["novel.character.castAuto.members", "Generar miembros paso a paso"], ["novel.character.castAuto.relations", "Generar relaciones paso a paso"]] },
    ],
    branches: [{ from: "contract", label: "Heredar o saltar", join: "cast", steps: [
      { id: "reuse-world", title: "Sigue o salta el mundo", artifact: "Mundo seleccionado", kind: "system", input: "El método de preparación mundial seleccionado al abrir el libro.", output: "Utilice datos mundiales existentes u omita la generación mundial según la configuración." },
    ] }, { from: "cast", label: "Discutir persona por persona", steps: [
      ai("cast-discussion", "Hablar de un personaje", "Modificaciones de carácter que pueden adoptarse caso por caso", "La dirección del libro elegida, el personaje actual y las cuestiones del autor.", "Verifique el personaje, el objetivo de la acción o la función de la historia antes de continuar dividiendo el papel.", "novel.director.cast_dialogue"),
    ] }],
  },
  {
    id: "volumes", coverStep: "skeleton", title: "Organizar en volúmenes", description: "Primero organice las historias que se entregarán en cada volumen y luego divida el volumen actual en capítulos consecutivos.",
    main: [
      ai("strategy", "Desarrollar una estrategia de implementación", "Responsabilidades y orden de cada volumen.", "La trama principal del libro, la duración prevista y el elenco de personajes.", "El número de volúmenes del libro, el orden de avance y las responsabilidades de cada volumen.", "novel.volume.strategy"),
      ai("critique", "Verifique la disposición del papel", "Comentarios sobre artículos", "Proyecto de estrategia de división.", "Una crítica de la repetición, la discontinuidad y el ritmo de la recompensa.", "novel.volume.strategy.critique"),
      ai("skeleton", "Generar el esqueleto de cada volumen.", "El esqueleto de la historia de cada volumen.", "Estrategia de división de papel y resultados de evaluación.", "La apertura, presión, clímax de cada volumen y la continuación del siguiente volumen.", "novel.volume.skeleton"),
      ai("beats", "Organizar el ritmo dentro del volumen.", "La sección rítmica clave de este volumen.", "Objetivos, esqueleto y presupuesto del capítulo para el volumen actual.", "Los acontecimientos clave se desarrollan en secuencia y la extensión de sus capítulos.", "novel.volume.beat_sheet"),
      { id: "chapter-list", title: "Dividir en lista de capítulos", artifact: "Nombre del capítulo, acciones y arreglos de apariencia.", kind: "ai", input: "Los objetivos, personajes y continuidad de la sección rítmica actual.", output: "El título, acciones principales y disposición de aparición de cada capítulo. Si los nombres de los mismos volúmenes son demasiado similares, puede cambiarles el nombre.",
        templates: [["novel.volume.chapter_list", "Lista de capítulos divididos"], ["novel.volume.chapter_title_repair", "Ajustar nombres de capítulos similares"]] },
    ],
    branches: [{ from: "skeleton", label: "Ajustar un rollo", join: "beats", steps: [
      ai("volume-discussion", "Discutir el esquema de un volumen.", "Modificaciones del plan de estudios que se pueden adoptar caso por caso", "Borrador editorial del volumen actual, disposición de los volúmenes anteriores y posteriores y preguntas del autor.", "Continúe abriendo capítulos después de comprobar la historia de este volumen, las expectativas de los lectores, el clímax o las pistas para el siguiente volumen.", "novel.director.volume_dialogue"),
    ] }],
  },
  {
    id: "preparation", coverStep: "mission", title: "Prepara este capítulo", description: "Perfeccione la disposición de los capítulos en escenarios que se puedan escribir y luego prepare todos los materiales necesarios para escribir.",
    main: [
      ai("mission", "Refinar las tareas y escenarios en este capítulo.", "Hojas de tareas y tarjetas de escenas.", "Lista de capítulos, sección de ritmo actual y capítulos adyacentes.", "Objetivos del capítulo, límites de la trama, redacción de la lista de tareas y configuración.", "novel.volume.chapter_execution_contract"),
      ai("check-mission", "Verificar la calidad del pedido de tareas", "Evaluación de aplicabilidad", "Tareas de este capítulo, disposición de la escena y resultados del capítulo anterior.", "Si la tarea es ejecutable y dónde se necesitan ajustes.", "novel.volume.chapter_task_sheet_quality"),
      { id: "sync", title: "Requisitos del capítulo de sincronización", artifact: "Requisitos de redacción vinculados a los capítulos.", kind: "system", input: "Tareas y escenas del capítulo preparadas.", output: "Asociar los requisitos de redacción a los capítulos correspondientes y conservar el texto existente." },
      { id: "materials", title: "Reúna materiales de escritura", artifact: "Materiales de escritura para este capítulo.", kind: "system", input: "Las tareas de este capítulo, los datos de los personajes, las reglas mundiales, el progreso previo y las preferencias de escritura.", output: "Escritura de palabras clave Los materiales que se pueden citar esta vez se utilizan en el paso de generación de texto." },
    ],
    branches: [{ from: "check-mission", label: "Ajustar un capítulo", join: "sync", steps: [
      ai("chapter-discussion", "Discutir las tareas y escenarios de un capítulo.", "Cambios de capítulo que pueden adoptarse caso por caso", "Tareas, escenas y ediciones actuales del capítulo seleccionado.", "Después de la confirmación, envíe este lote de requisitos del capítulo a la generación de texto.", "novel.director.chapter_dialogue"),
    ] }],
  },
  {
    id: "writing", coverStep: "finish", title: "Escribir texto", description: "Después de escribir un capítulo, revise y seleccione el manuscrito y lleve los cambios que se hayan producido al siguiente capítulo.",
    main: [
      ai("draft", "Generar un primer borrador de este capítulo.", "Borrador del texto del capítulo completo", "Tareas del capítulo, progreso previo, datos del personaje y requisitos de escritura.", "Un borrador completo del texto del capítulo.", "novel.chapter.writer"),
      ai("review", "Revisa este capítulo", "Revisar comentarios con base en texto original.", "Borrador del capítulo, trabajo escrito y hechos previos.", "Estado de finalización del capítulo y problemas de calidad con la evidencia textual.", "novel.chapter.acceptance_assessment"),
      { id: "save", title: "Seleccionar y guardar texto", artifact: "Borrador seleccionado de este capítulo.", kind: "system", input: "Primer borrador y borrador revisado disponible para revisión.", output: "Versión de texto seleccionada de este capítulo para extraer variaciones de la historia." },
      ai("extract", "Extraer cambios en la historia", "Personajes, hechos y actualizaciones de presagios", "Texto seleccionado y registros de historias existentes.", "Resúmenes de capítulos actualizados, estado de los personajes, hechos y presagios para capítulos posteriores.", "novel.chapter.artifact_delta.extract"),
      { id: "finish", title: "Se genera el texto completo.", artifact: "El texto completo de la novela.", kind: "system", input: "El texto y los resultados del procesamiento de cada capítulo dentro del alcance del libro.", output: "El texto de cada capítulo se ha guardado y la novela completa se puede leer de forma continua." },
    ],
    branches: [
      { from: "review", label: "Necesidad de revisar", join: "save", steps: [
        ai("repair", "Revisión parcial", "Manuscrito parcialmente revisado", "Manuscrito original con requisitos claros de restauración.", "Revise sólo los borradores candidatos con párrafos relevantes.", "novel.review.patch"),
        ai("verify", "Revisar el manuscrito revisado", "Revisar los comentarios sobre el borrador revisado.", "Manuscrito revisado, preguntas de revisión originales y base factual.", "Revisión de los efectos de las modificaciones y conservación de los hechos.", "verify-repair", "novel.chapter.acceptance_assessment"),
      ] },
      { from:"finish",label:"Exportar después de verificar",steps:[
        ai("final-inspection","Reseña completa del libro","Problemas que pueden localizar el texto original.","Texto capítulo por capítulo, convenciones de todo el libro, conexiones entre capítulos adyacentes y pistas de revisión.","Verifique las preguntas y revíselas párrafo por párrafo, y luego exporte el libro completo después de la confirmación.","novel.director.final_inspection"),
      ]},
      { from:"extract",label:"Consulta el texto de este lote.",join:"finish",steps:[
        ai("prose-discussion","Discuta el texto de este capítulo.","Modificar sugerencias párrafo por párrafo","Texto del capítulo seleccionado, requisitos de redacción y manuscrito editado actual.","Después de adoptar y confirmar cada elemento, continúe escribiendo según el rango seleccionado.","novel.director.prose_dialogue"),
      ]},
      { from: "extract", label: "Este volumen aún no está terminado.", steps: [
        link("next-chapter", "Prepárate para el próximo capítulo.", "Tarea de escritura para el próximo capítulo.", "mission", "Progreso después de guardar este capítulo.", "Vuelva a la preparación de este capítulo y perfeccione las tareas y escenarios para el próximo capítulo."),
      ] },
      { from: "extract", label: "Ir al siguiente volumen", steps: [
        link("next-volume", "Programar el próximo rollo", "El ritmo del próximo volumen.", "beats", "Los resultados del volumen anterior y el esqueleto del siguiente volumen.", "Coge el ritmo del volumen y continúa ordenando los capítulos del siguiente volumen."),
      ] },
    ],
  },
];

export function stageSteps(stage: FlowStage) {
  return [...stage.main, ...(stage.branches ?? []).flatMap(branch => branch.steps)];
}

export function locateFlowStep(id: string | null) {
  if (!id) return;
  for (const [index, stage] of stages.entries()) {
    const mainIndex = stage.main.findIndex(step => step.id === id);
    if (mainIndex >= 0) return {
      stage, step: stage.main[mainIndex], optional: false,
      next: stage.main[mainIndex + 1] ?? stages[index + 1]?.main[0],
    };
    for (const branch of stage.branches ?? []) {
      const branchIndex = branch.steps.findIndex(step => step.id === id);
      if (branchIndex >= 0) return {
        stage, step: branch.steps[branchIndex], optional: true,
        next: branch.steps[branchIndex + 1] ?? stage.main.find(step => step.id === branch.join),
      };
    }
  }
}
