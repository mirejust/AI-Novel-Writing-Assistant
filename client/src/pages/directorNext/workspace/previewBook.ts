import type { CharacterTimeline } from "@ai-novel/shared/types/novel";
import type { WorkspaceBook } from "./model";

export const previewBook: WorkspaceBook = {
  novel: { id: "preview", title: "Ciudad movil", creationExperience: "simple", estimatedChapterCount: 30 },
  materials: {
    description: "Lin Du, un portero que ha perdido la memoria, tiene que vigilar una ciudad que se mueve cada amanecer. Debe identificar a las personas cerca de la puerta de la ciudad y poco a poco descubre que esta ciudad está relacionada con su pasado.",
    characterCount: 3, volumeCount: 1, openQualityDebtCount: 0,
    story: {
      coreSellingPoint: "Una ciudad en movimiento, un guardián con amnesia y el precio que pagas cada vez que abres la puerta.",
      readingPromise: "Siga a Lin Du para identificar a los visitantes y descubrir la verdad sobre el movimiento de la ciudad a través de opciones.",
      first30ChapterPromise: "Desde custodiar la primera puerta hasta perseguir activamente el origen de la ciudad.",
      protagonistFantasy: "Un hombre olvidado, confiando en su propio juicio, se convirtió en la confianza de toda la ciudad.",
    },
    world: { name: "Mistfield y la ciudad en movimiento", summary: "Fuera de la ciudad hay una llanura brumosa sin caminos fijos. La ciudad se mueve al amanecer, y las campanas marcan la hora de abrir la puerta; Los viajeros que tengan la marca de la ciudad vieja pueden solicitar ingresar a la ciudad." },
    characters: [
      { id: "lin", name: "Lindo", role: "Protagonista", storyFunction: "Utilice la elección del guardián para conectar los secretos dentro y fuera de la ciudad.", currentGoal: "Descubra el origen de la antigua marca de la ciudad.", personality: "Cauteloso, sensible y dispuesto a asumir responsabilidades bajo presión." },
      { id: "shen", name: "Shen Zhi", role: "Compañeros de viaje", storyFunction: "Traer pistas sobre Wuyuan también obligó a Lin Du a reexaminar las reglas para abrir la puerta.", currentGoal: "Buscando hermano desaparecido", personality: "Sencillo, orientado a la acción y no pierde la confianza fácilmente." },
      { id: "elder", name: "Viejo, torre del reloj", role: "Guía", storyFunction: "Mantén las reglas de la ciudad y conoce el pasado perdido de Lin Du.", currentGoal: null, personality: "Silencioso y comedido." },
    ],
    volumes: [{ id: "v1", order: 1, title: "Volumen 1 · Visitantes en la niebla", summary: "La llegada de un extraño viajero rompe la rutina diaria del portero. Lin Du tomó su primera decisión entre defender la ciudad y buscar su memoria.", mainPromise: "Descubre la conexión entre el sello de la ciudad vieja y sus guardianes.", chapterCount: 3 }],
  },
  chapters: [
    { id: "c1", order: 1, title: "Ciudad en movimiento", status: "completed", wordCount: 328, updatedAt: "2026-10-02T08:00:00Z", qualityDebt: null,
      content: "Cuando Lin Du se despertó, el suelo bajo sus pies temblaba ligeramente. \\n\\nLa torre del reloj fuera de la ventana se inclinó hacia un lado y luego volvió lentamente a su posición original. La ciudad se está moviendo. La gente en la calle guardaba la ropa para secarla como de costumbre, y la mujer que vendía pan usaba cuñas de madera para arreglar la estufa, como si fuera una mañana cualquiera. \\n\\nSolo que no recuerda dónde está esto. \\n\\n Había un trozo de papel amarillento sobre la mesa, y la última línea estaba trazada con fuerza: No abras la puerta hasta que suene el timbre. \\n\\n Lin Du tocó la llave en su cintura. El metal estaba frío, pero sentía una familiar sensación de hormigueo en la palma de mi mano. Se oyeron tres golpes delante de la puerta de la ciudad. Levantó la cabeza y vio a una persona parada en la niebla. \\n\\nEl hombre levantó su mano derecha. El dorso de la mano está impreso con el mismo patrón que la llave." },
    { id: "c2", order: 2, title: "Viajeros afuera de la puerta", status: "completed", wordCount: 245, updatedAt: "2026-10-02T08:10:00Z", qualityDebt: null,
      content: "\"Mi nombre es Shen Zhi\". La persona que estaba afuera de la puerta dijo: \"No estoy aquí para esconderme de la niebla\". \\n\\n Lin Du la miró a través de la estrecha ventana de la puerta. Tenía las mangas deshilachadas y los bordes de los zapatos manchados de barro gris, pero siempre tenía la mano derecha levantada, como si supiera que él reconocería la marca. \\n\\n \"Entonces ¿qué estás haciendo aquí?\" \\n\\n \"Buscamos a alguien. Alguien que vino a esta ciudad hace tres años.\" \\n\\nEl primer sonido provino del campanario. Lin Du se dio la vuelta y vio al anciano en el techo mirando hacia aquí. No negó con la cabeza ni asintió, simplemente puso su mano en la cuerda de la campana. \\n\\n Lin Du insertó la llave en el ojo de la cerradura. \\n\\n “Después de entrar”, dijo, “primero dime de dónde sacaste esta marca”." },
    { id: "c3", order: 3, title: "Después de la campana", status: "waiting_writing", wordCount: 0, content: null, updatedAt: "2026-10-02T08:10:00Z", qualityDebt: null },
  ],
};

export const previewCharacterHistory: Record<string, CharacterTimeline[]> = {
  lin: [
    { id: "h1", novelId: "preview", characterId: "lin", chapterId: "c1", chapterOrder: 1, title: "Asumir las tareas de control de acceso", content: "Después de despertar, perdió la memoria y confió en las reglas del papel para proteger la puerta de la ciudad; se sentía familiarizado con la marca de la llave.", source: "chapter", createdAt: "2026-10-02T08:00:00Z", updatedAt: "2026-10-02T08:00:00Z" },
    { id: "h2", novelId: "preview", characterId: "lin", chapterId: "c2", chapterOrder: 2, title: "Del estado de alerta a la investigación activa", content: "Se decidió dejar que Shen Zhi entrara a la ciudad y pedirle que explicara el origen de la marca. El objetivo de la operación pasa de vigilar a investigar la conexión entre uno mismo y la marca.", source: "chapter", createdAt: "2026-10-02T08:10:00Z", updatedAt: "2026-10-02T08:10:00Z" },
  ],
  shen: [{ id: "h3", novelId: "preview", characterId: "shen", chapterId: "c2", chapterOrder: 2, title: "Ingresa a la ciudad móvil", content: "Le explicó a Lin Du su propósito de encontrar a la persona desaparecida y se le permitió ingresar a la ciudad según la marca en el dorso de su mano.", source: "chapter", createdAt: "2026-10-02T08:10:00Z", updatedAt: "2026-10-02T08:10:00Z" }],
  elder: [],
};
