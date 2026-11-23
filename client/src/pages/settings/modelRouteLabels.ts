import type { ModelRouteTaskType } from "@ai-novel/shared/types/novel";

export const MODEL_ROUTE_LABELS: Record<ModelRouteTaskType, { title: string; description: string }> = {
  planner: {
    title: "Esquema de planificación",
    description: "Primero comprenda la meta creativa y luego planifique cómo proceder con este período de creación.",
  },
  writer: {
    title: "Redacción principal",
    description: "Genere el texto del capítulo y escriba el contenido del capítulo por completo.",
  },
  review: {
    title: "Revisión general",
    description: "Verifique la trama, el ritmo y el estilo para identificar problemas de calidad en su borrador.",
  },
  light_review: {
    title: "Repaso rápido básico",
    description: "Determine rápidamente si un capítulo se puede avanzar y utilizar para controles de calidad ligeros después del texto principal.",
  },
  critical_review: {
    title: "Revisión estricta",
    description: "Maneja controles de calidad que afectan la continuidad de todo el libro, adecuado para revisiones y reverificaciones de alto riesgo.",
  },
  repair: {
    title: "Correcciones del capítulo",
    description: "Corrija el manuscrito de acuerdo con los problemas de revisión y devuelva el capítulo a un estado en el que pueda avanzar.",
  },
  replan: {
    title: "Replanificación de ventanas",
    description: "Cuando la reparación local no logra converger, se reorganizan los objetivos y conexiones de los capítulos afectados.",
  },
  state_resolution: {
    title: "Análisis de estado",
    description: "Determine si la propuesta de estado del capítulo es creíble y ayude a los directores automáticos a reducir la confirmación manual.",
  },
  summary: {
    title: "Resumen de la trama",
    description: "Organice capítulos largos en revisiones, resúmenes y cambios clave.",
  },
  fact_extraction: {
    title: "Configuración de testimonios",
    description: "Organice entornos, cronogramas y hechos clave para reducir las inconsistencias.",
  },
  chat: {
    title: "Inspiración para acompañar la escritura",
    description: "Tome conversaciones cotidianas y organice los resultados en contenido que pueda entenderse directamente en el momento de la creación.",
  },
};
