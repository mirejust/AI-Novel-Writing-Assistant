import type {
  VisualAssetKind,
  VisualAssetOrigin,
  VisualAssetScopeKind,
  VisualAssetSourceDomain,
} from "@ai-novel/shared/types/visualAsset";

const KIND_LABELS: Record<VisualAssetKind, string> = {
  character: "Imagen de rol",
  cover: "Portada de novela",
  illustration: "Ilustración",
  comic_character_sheet: "Configuración de personajes cómicos",
  comic_character_asset: "Material de personajes de cómic",
  comic_scene: "Escena comica",
  comic_panel: "Guión gráfico cómico",
  drama_character_sheet: "Configuración de personajes de drama corto.",
  drama_shot_keyframe: "Fotogramas clave de sketches",
};

const SOURCE_LABELS: Record<VisualAssetSourceDomain, string> = {
  image_asset: "Creación de imágenes",
  comic: "Creación cómica",
  drama: "Creación de obra corta",
};

const ORIGIN_LABELS: Record<VisualAssetOrigin, string> = {
  generated: "IA generada",
  uploaded: "Subido",
  imported: "Importado",
  unknown: "Fuente por confirmar",
};

const SCOPE_LABELS: Record<VisualAssetScopeKind, string> = {
  global: "Todo funciona",
  novel: "Novela",
  book_analysis: "Análisis de división de libros",
  comic_project: "Proyecto cómico",
  drama_project: "Proyecto de obra corta",
};

export function getVisualAssetKindLabel(kind: VisualAssetKind) {
  return KIND_LABELS[kind];
}

export function getVisualAssetSourceLabel(source: VisualAssetSourceDomain) {
  return SOURCE_LABELS[source];
}

export function getVisualAssetOriginLabel(origin: VisualAssetOrigin) {
  return ORIGIN_LABELS[origin];
}

export function getVisualAssetScopeLabel(kind: VisualAssetScopeKind) {
  return SCOPE_LABELS[kind];
}

export function formatVisualAssetDate(createdAt: string) {
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) {
    return "Fecha no registrada";
  }
  return new Intl.DateTimeFormat("zh-CN", { month: "short", day: "numeric", year: "numeric" }).format(date);
}
