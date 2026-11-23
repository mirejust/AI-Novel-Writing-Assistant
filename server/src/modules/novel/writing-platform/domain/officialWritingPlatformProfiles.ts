import type {
  WritingPlatform,
  WritingPlatformProfileDefinition,
} from "@ai-novel/shared/types/writingPlatform";

export const OFFICIAL_WRITING_PLATFORM_PROFILES: Record<WritingPlatform, WritingPlatformProfileDefinition> = {
  fanqie_free: {
    platform: "fanqie_free",
    label: "Artículos web sin tomate",
    summary: "Entrada rápida, párrafos cortos, alto conflicto y recompensas de etapa claras, adecuadas para lectura continua en dispositivos móviles.",
    supportedNarrativeForms: ["long_novel", "short_story"],
    officialVersion: 1,
    guidance: {
      long_novel: {
        positioning: "Dirigidos a los lectores móviles masivos, utilizamos deseos claros, situaciones sólidas y retornos estables para generar lecturas de seguimiento.",
        planning: "Proporcionar excepciones o conflictos lo antes posible al principio; cada capítulo avanza metas, resistencias, ganancias y pérdidas; Los nodos de etapa deben tener recompensas visibles.",
        drafting: "El lenguaje es directo y fluido, y los párrafos constan principalmente de una a cuatro oraciones; Se reducen las explicaciones lentas y se enfatizan las acciones, las elecciones, los diálogos y la tracción al final del capítulo.",
        auditing: "Concéntrese en verificar la velocidad de entrada al principio, la iniciativa del protagonista, el incremento de información efectiva, la densidad de conflicto/recompensa y la sensación de lectura de párrafos móviles.",
        repairing: "Priorizar la compresión de explicaciones y tautologías, complementar las acciones del protagonista, los cambios de situación y las recompensas percibidas, sin cambiar los hechos establecidos.",
      },
      short_story: {
        positioning: "Comprima la experiencia web completa en una sola lectura: apertura rápida, causa y efecto sólidos, actualizaciones continuas y final claro.",
        planning: "Las primeras quinientas palabras entran en presión; cada segmento interno tiene un giro o una ganancia o una pérdida; el final cumple plenamente la promesa central.",
        drafting: "Sigue leyendo párrafos cortos y conversaciones naturales en tu teléfono móvil, continúa generando nueva información, resistencias, elecciones y recompensas, y prohíbe esquemas.",
        auditing: "Compruebe si el texto completo se parece a una novela completa en línea en lugar de a un boceto literario, especialmente el gancho inicial, la densidad de progresión y el cumplimiento final.",
        repairing: "Mejore parcialmente los eventos y causas, elimine letras vacías y explicaciones largas, y conserve el contenido editado manualmente y el final completo.",
      },
    },
  },
  qidian_male: {
    platform: "qidian_male",
    label: "canal masculino qidian",
    summary: "Los objetivos de crecimiento son claros, las capacidades, los recursos y las situaciones continúan cambiando, y las actualizaciones y los presagios se realizan y estabilizan.",
    supportedNarrativeForms: ["long_novel"],
    officialVersion: 1,
    guidance: {
      long_novel: {
        positioning: "Construye un motor de historia a largo plazo en torno al crecimiento del protagonista y la exploración mundial, de modo que cada etapa tenga nuevos objetivos y nuevos límites.",
        planning: "Aclarar la escala de crecimiento de habilidades, recursos, identidad o poder; el desafío se actualiza paso a paso; El presagio se cumple de manera ordenada según la semilla, el tacto y la recompensa.",
        drafting: "Prestar atención a la lógica de la acción, la credibilidad de las reglas y el proceso de resolución de problemas; Los mejores puntos provienen de avances después de la acumulación, no de ser aplastados sin ninguna preparación.",
        auditing: "Verifique los cambios de crecimiento neto, la coherencia de las reglas, las cuentas de recursos, las actualizaciones de desafíos, las responsabilidades presagiadas y las preguntas de puesta al día al final del capítulo.",
        repairing: "Priorice la finalización de las causas del crecimiento, los costos y los procesos estratégicos, corrija el poder de combate o los conflictos de reglas, y no agregue capacidades básicas de la nada.",
      },
    },
  },
  jinjiang_female: {
    platform: "jinjiang_female",
    label: "canal femenino de jinjiang",
    summary: "Las relaciones de los personajes y la causa y efecto emocional son claras, las voces de los personajes son distintas y el estado de la relación continúa cambiando.",
    supportedNarrativeForms: ["long_novel"],
    officialVersion: 1,
    guidance: {
      long_novel: {
        positioning: "Los personajes distintivos, la tensión en las relaciones y las recompensas emocionales impulsan la lectura, al tiempo que garantizan que los acontecimientos externos sigan avanzando.",
        planning: "Cada capítulo aclara claramente los deseos, malentendidos o diferencias de posición de los personajes; Los cambios en las relaciones deben ser desencadenados por eventos y elecciones para evitar que se produzcan.",
        drafting: "Mantener las diferencias en las voces de los personajes y utilizar acciones, subtexto y detalles específicos para presentar emociones; No reemplace la interacción con largos párrafos de resumen interno.",
        auditing: "Examina las motivaciones de los personajes, la causa y efecto emocional, los cambios netos en las relaciones, las voces de los personajes, el sentido de los límites y la progresión externa de la trama.",
        repairing: "Complementa la cadena de eventos que conducen a cambios en las emociones y las relaciones, reduce los malentendidos forzados y el juicio del autor, y conserva la dignidad de los personajes y los hechos establecidos.",
      },
    },
  },
  zhihu_story: {
    platform: "zhihu_story",
    label: "Cuentos cortos de Zhihu.",
    summary: "Interrupción de alto concepto, brecha de información, revelación continua y, finalmente, un final completo y prolongado.",
    supportedNarrativeForms: ["short_story"],
    officialVersion: 1,
    guidance: {
      short_story: {
        positioning: "Capte lectores con un concepto elevado comunicable y una situación sólida, y respalde la lectura de una sola vez con respuestas de verdad, elección o relación.",
        planning: "Las anomalías y las preguntas centrales se entregan directamente al principio; las revelaciones continuas se organizan según lagunas de información; Las pistas anteriores deben reciclarse para revertirlas en las etapas intermedia y posterior.",
        drafting: "La narrativa debe ser clara y sobria, y la primera persona o perspectiva cercana al protagonista debe tener un tono realista; cada párrafo debe servir para avanzar, revelar o intensificar las emociones.",
        auditing: "Compruebe si los conceptos elevados se establecen rápidamente, si la información se revela capa por capa, si la inversión es justa, si las emociones tienen causa y efecto y si el final responde a las preguntas centrales.",
        repairing: "Priorizar el orden de la información y la recuperación de los presagios, borrar misterios y discusiones vacías, y no terminar bruscamente fingiendo sobras.",
      },
    },
  },
};

export const WRITING_PLATFORM_VALUES = Object.keys(OFFICIAL_WRITING_PLATFORM_PROFILES) as WritingPlatform[];

export function supportsWritingPlatformForm(platform: WritingPlatform, form: "short_story" | "long_novel"): boolean {
  return OFFICIAL_WRITING_PLATFORM_PROFILES[platform].supportedNarrativeForms.includes(form);
}

