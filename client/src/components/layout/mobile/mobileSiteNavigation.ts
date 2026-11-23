export type MobilePrimaryNavKey = "home" | "novels" | "creation" | "tasks" | "more";

export interface MobileNavItem {
  key: string;
  label: string;
  to: string;
  group: MobilePrimaryNavKey;
}

export interface MobileNavGroup {
  title: string;
  items: MobileNavItem[];
}

export interface MobileRoutePattern {
  key: string;
  pattern: RegExp;
  title: string;
  group: MobilePrimaryNavKey;
}

export const MOBILE_ROUTE_PATTERNS: MobileRoutePattern[] = [
  { key: "home", pattern: /^\/$/, title: "Pagina de inicio", group: "home" },
  { key: "help", pattern: /^\/help\/?$/, title: "Asistente de creación", group: "more" },
  { key: "novels", pattern: /^\/novels\/?$/, title: "Novela", group: "novels" },
  { key: "novel-create", pattern: /^\/novels\/create\/?$/, title: "Crear una novela", group: "novels" },
  { key: "novel-preview", pattern: /^\/novels\/[^/]+\/preview\/?$/, title: "Vista previa de la novela", group: "novels" },
  { key: "novel-edit", pattern: /^\/novels\/[^/]+\/edit\/?$/, title: "Nuevo espacio de trabajo", group: "novels" },
  { key: "chapter-edit", pattern: /^\/novels\/[^/]+\/chapters\/[^/]+\/?$/, title: "Texto del capítulo", group: "novels" },
  { key: "drama", pattern: /^\/drama\/?$/, title: "Sketch satírico", group: "creation" },
  { key: "creative-hub", pattern: /^\/creative-hub\/?$/, title: "Centro creativo", group: "creation" },
  { key: "chat-legacy", pattern: /^\/chat-legacy\/?$/, title: "Versión antigua del chat.", group: "creation" },
  { key: "book-analysis", pattern: /^\/book-analysis\/?$/, title: "Abre el libro", group: "creation" },
  { key: "market-radar", pattern: /^\/market-radar\/?$/, title: "Radar de temas candentes", group: "creation" },
  { key: "tasks", pattern: /^\/tasks\/?$/, title: "Tarea", group: "tasks" },
  { key: "auto-director-follow-ups", pattern: /^\/auto-director\/follow-ups\/?$/, title: "Seguimiento del director", group: "tasks" },
  { key: "knowledge", pattern: /^\/knowledge\/?$/, title: "Base de conocimientos", group: "more" },
  { key: "genres", pattern: /^\/genres\/?$/, title: "Base temática", group: "more" },
  { key: "story-modes", pattern: /^\/story-modes\/?$/, title: "Modo de empuje", group: "more" },
  { key: "titles", pattern: /^\/titles\/?$/, title: "Taller de titulo", group: "more" },
  { key: "prompt-workbench", pattern: /^\/prompt-workbench\/?$/, title: "Gestión rápida de palabras", group: "more" },
  { key: "settings-models", pattern: /^\/settings\/models\/?$/, title: "Modelos y proveedores", group: "more" },
  { key: "model-routes", pattern: /^\/settings\/model-routes\/?$/, title: "Gestión de rutas de modelos", group: "more" },
  { key: "settings-director", pattern: /^\/settings\/director\/?$/, title: "Configuración del director automático", group: "more" },
  { key: "settings-knowledge", pattern: /^\/settings\/knowledge\/?$/, title: "Base de conocimiento y estilo", group: "more" },
  { key: "settings-maintenance", pattern: /^\/settings\/maintenance\/?$/, title: "Escritorio y mantenimiento", group: "more" },
  { key: "settings", pattern: /^\/settings\/?$/, title: "Ajustes del sistema", group: "more" },
  { key: "worlds", pattern: /^\/worlds\/?$/, title: "Biblioteca mundial de muestras", group: "more" },
  { key: "world-generator", pattern: /^\/worlds\/generator\/?$/, title: "Crear una muestra mundial", group: "more" },
  { key: "world-workspace", pattern: /^\/worlds\/[^/]+\/workspace\/?$/, title: "Manual mundial", group: "more" },
  { key: "style-engine", pattern: /^\/style-engine\/?$/, title: "Motor de escritura", group: "more" },
  { key: "anti-ai-rules", pattern: /^\/anti-ai-rules\/?$/, title: "Reglas anti-IA", group: "more" },
  { key: "base-characters", pattern: /^\/base-characters\/?$/, title: "Rol básico", group: "more" },
];

const primaryNavItems: MobileNavItem[] = [
  { key: "home", label: "Pagina de inicio", to: "/", group: "home" },
  { key: "novels", label: "Novela", to: "/novels", group: "novels" },
  { key: "creation", label: "Crear", to: "/creative-hub", group: "creation" },
  { key: "tasks", label: "Tarea", to: "/tasks", group: "more" },
  { key: "more", label: "Más", to: "", group: "more" },
];

const moreNavGroups: MobileNavGroup[] = [
  {
    title: "Asistencia creativa",
    items: [
      { key: "help", label: "Asistente de creación", to: "/help", group: "more" },
      { key: "drama", label: "Banco de trabajo de drama corto", to: "/drama", group: "creation" },
      { key: "book-analysis", label: "Abre el libro", to: "/book-analysis", group: "creation" },
      { key: "market-radar", label: "Radar de temas candentes", to: "/market-radar", group: "creation" },
      { key: "chat-legacy", label: "Versión antigua del chat.", to: "/chat-legacy", group: "creation" },
    ],
  },
  {
    title: "Biblioteca de activos",
    items: [
      { key: "knowledge", label: "Base de conocimientos", to: "/knowledge", group: "more" },
      { key: "genres", label: "Base temática", to: "/genres", group: "more" },
      { key: "story-modes", label: "Modo de empuje", to: "/story-modes", group: "more" },
      { key: "titles", label: "Taller de titulo", to: "/titles", group: "more" },
      { key: "style-engine", label: "Motor de escritura", to: "/style-engine", group: "more" },
      { key: "anti-ai-rules", label: "Reglas anti-IA", to: "/anti-ai-rules", group: "more" },
      { key: "base-characters", label: "Rol básico", to: "/base-characters", group: "more" },
    ],
  },
  {
    title: "Mundo y sistema",
    items: [
      { key: "tasks", label: "Registro de operación", to: "/tasks", group: "more" },
      { key: "auto-director-follow-ups", label: "Seguimiento del director", to: "/auto-director/follow-ups", group: "more" },
      { key: "worlds", label: "Biblioteca mundial de muestras", to: "/worlds", group: "more" },
      { key: "world-generator", label: "Crear una muestra mundial", to: "/worlds/generator", group: "more" },
      { key: "prompt-workbench", label: "Gestión rápida de palabras", to: "/prompt-workbench", group: "more" },
      { key: "settings", label: "Ajustes del sistema", to: "/settings", group: "more" },
    ],
  },
];

export function getMobilePrimaryNavItems(): MobileNavItem[] {
  return primaryNavItems;
}

export function getMobileMoreNavGroups(): MobileNavGroup[] {
  return moreNavGroups;
}

export function getMobileRoutePattern(pathname: string): MobileRoutePattern | undefined {
  return MOBILE_ROUTE_PATTERNS.find((route) => route.pattern.test(pathname));
}

export function getMobilePageTitle(pathname: string): string {
  return getMobileRoutePattern(pathname)?.title ?? "Más funciones";
}

export function getMobileNavGroupForPath(pathname: string): MobilePrimaryNavKey {
  return getMobileRoutePattern(pathname)?.group ?? "more";
}

export function getMobileRouteClassName(pathname: string): string {
  return `mobile-route-${getMobileRoutePattern(pathname)?.key ?? "more"}`;
}
