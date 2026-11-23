import type { WorldLayerKey, WorldTemplate } from "@ai-novel/shared/types/world";

export const WORLD_LAYER_ORDER: WorldLayerKey[] = [
  "foundation",
  "power",
  "society",
  "culture",
  "history",
  "conflict",
];

export const LAYER_FIELD_MAP: Record<
  WorldLayerKey,
  Array<
    | "background"
    | "geography"
    | "magicSystem"
    | "technology"
    | "races"
    | "politics"
    | "factions"
    | "cultures"
    | "religions"
    | "economy"
    | "history"
    | "conflicts"
    | "description"
  >
> = {
  foundation: ["background", "geography"],
  power: ["magicSystem", "technology"],
  society: ["races", "politics", "factions"],
  culture: ["cultures", "religions", "economy"],
  history: ["history"],
  conflict: ["conflicts", "description"],
};

export const WORLD_TEMPLATES: WorldTemplate[] = [
  {
    key: "xuanhuan_eastern",
    name: "fantasía oriental",
    description: "Con el sistema de cultivo, el poder de la secta y las leyes del cielo y la tierra como núcleo.",
    worldType: "fantasía oriental",
    requiredLayers: ["foundation", "power", "society", "history", "conflict"],
    optionalLayers: ["culture"],
    classicElements: ["secta", "reino secreto", "Avance del reino", "Tesoros del cielo y de la tierra.", "dinastía/familia"],
    pitfalls: ["No tengas demasiados reinos", "El coste de la energía debe quedar claro.", "Los límites del poder de las sectas deben ser claros"],
  },
  {
    key: "xianxia",
    name: "Xi'anxia",
    description: "Enfatiza los límites entre inmortales y mortales, el sistema de ascensión y las reglas del cielo.",
    worldType: "Xi'anxia",
    requiredLayers: ["foundation", "power", "society", "history", "conflict"],
    optionalLayers: ["culture"],
    classicElements: ["remontarse", "Cueva Cielo Paraíso", "causa y efecto", "Superando la tribulación", "puerta de hadas"],
    pitfalls: ["Las reglas del cielo no pueden contradecirse", "El camino de la ascensión debe ser de circuito cerrado."],
  },
  {
    key: "urban_superpower",
    name: "Superpotencia urbana",
    description: "Habilidades extraordinarias y organizaciones encubiertas en la sociedad moderna.",
    worldType: "Superpotencia urbana",
    requiredLayers: ["foundation", "power", "society", "conflict"],
    optionalLayers: ["culture", "history"],
    classicElements: ["Nivel de potencia", "organización del servicio secreto", "fuerzas subterráneas", "reglas urbanas"],
    pitfalls: ["El conflicto entre la sociedad sobrenatural y la real debe ser explicable."],
  },
  {
    key: "scifi",
    name: "ciencia ficción",
    description: "Destaca el árbol tecnológico, la estructura social y el choque de civilizaciones.",
    worldType: "ciencia ficción",
    requiredLayers: ["foundation", "power", "society", "history", "conflict"],
    optionalLayers: ["culture"],
    classicElements: ["AI", "política interestelar", "tecnología de salto", "alianza corporativa", "colonia"],
    pitfalls: ["El nivel de ciencia y tecnología debe ser consistente.", "Los límites tecnológicos clave deben ser claros"],
  },
  {
    key: "western_fantasy",
    name: "fantasía occidental",
    description: "Multirazas, sistemas multimitos y narrativas de aventuras.",
    worldType: "fantasía occidental",
    requiredLayers: ["foundation", "power", "society", "history", "conflict"],
    optionalLayers: ["culture"],
    classicElements: ["Duende", "dragón", "Alianza del Reino", "colega", "objeto sagrado"],
    pitfalls: ["La raza establece diferencias al servicio del conflicto"],
  },
  {
    key: "post_apocalypse",
    name: "páramo apocalíptico",
    description: "El sistema de orden y variación de supervivencia bajo recursos escasos.",
    worldType: "páramo apocalíptico",
    requiredLayers: ["foundation", "power", "society", "conflict"],
    optionalLayers: ["history", "culture"],
    classicElements: ["refugio", "persona contagiada", "basurero", "Puntos de recursos", "Organización del desierto"],
    pitfalls: ["El ciclo de recursos de supervivencia debe ser operable."],
  },
  {
    key: "historical_alt",
    name: "ficcion historica",
    description: "El nuevo patrón político y civilizacional desencadenado por puntos de desvío históricos.",
    worldType: "ficcion historica",
    requiredLayers: ["foundation", "society", "history", "conflict"],
    optionalLayers: ["culture", "power"],
    classicElements: ["evento de deflexión", "nuevo régimen", "Restos del antiguo orden", "Controversia histórica"],
    pitfalls: ["La cadena lógica antes y después del punto de desviación debe ser deducible."],
  },
  {
    key: "cyberpunk",
    name: "ciberpunk",
    description: "Gobierno corporativo, transformación cibernética y espacio digital.",
    worldType: "ciberpunk",
    requiredLayers: ["foundation", "power", "society", "conflict"],
    optionalLayers: ["history", "culture"],
    classicElements: ["empresa gigante", "cuerpo protésico", "hacker", "bloque inferior", "soberanía de datos"],
    pitfalls: ["Es necesario establecer al mismo tiempo el dividendo tecnológico y la opresión de clases."],
  },
  {
    key: "custom",
    name: "Personalizar",
    description: "Combine dimensiones libremente para adaptarse a las necesidades personalizadas de la visión del mundo.",
    worldType: "Personalizar",
    requiredLayers: ["foundation", "conflict"],
    optionalLayers: ["power", "society", "culture", "history"],
    classicElements: [],
    pitfalls: ["Defina primero los axiomas centrales y luego amplíe los detalles."],
  },
];

export function getTemplateByKey(templateKey: string | null | undefined): WorldTemplate {
  return WORLD_TEMPLATES.find((item) => item.key === templateKey) ?? WORLD_TEMPLATES[WORLD_TEMPLATES.length - 1];
}
