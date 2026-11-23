import type { NovelWorldAssetSummary, WorldAssetType } from "@ai-novel/shared/types/novelWorld";

export interface WorldAssetRow {
  id: string;
  assetType: WorldAssetType;
  title: string;
  description: string | null;
  status: string;
  thumbnailUrl: string | null;
  version: number;
  renderDataJson: string | null;
  updatedAt: Date | string;
}

const WORLD_ASSET_BLUEPRINTS: Array<{
  assetType: WorldAssetType;
  title: string;
  description: string;
}> = [
  {
    assetType: "map",
    title: "mapa del mundo",
    description: "Organice áreas, rutas, áreas controladas por energía y ubicaciones de historias.",
  },
  {
    assetType: "faction_diagram",
    title: "mapa de poder",
    description: "Presenta relaciones de alianza, hostilidad, vasallaje y competencia.",
  },
  {
    assetType: "timeline",
    title: "línea de tiempo mundial",
    description: "Llevando acontecimientos históricos, situaciones actuales y cambios posteriores.",
  },
  {
    assetType: "character_network",
    title: "red de roles",
    description: "Conecte roles, afiliaciones a campamentos, cambios de posición y tensiones en las relaciones.",
  },
  {
    assetType: "power_system_tree",
    title: "Árbol del sistema de energía",
    description: "Niveles de depósito, recursos, costos y límites tabú.",
  },
];

export function serializeNovelWorldAssetRows(rows: WorldAssetRow[]): NovelWorldAssetSummary[] {
  const rowByType = new Map<WorldAssetType, WorldAssetRow>();
  for (const row of rows) {
    const existing = rowByType.get(row.assetType);
    if (!existing || compareAssetFreshness(row, existing) > 0) {
      rowByType.set(row.assetType, row);
    }
  }
  return WORLD_ASSET_BLUEPRINTS.map((blueprint) => {
    const row = rowByType.get(blueprint.assetType);
    return {
      id: row?.id ?? null,
      assetType: blueprint.assetType,
      title: row?.title ?? blueprint.title,
      description: row?.description ?? blueprint.description,
      status: row?.status ?? "placeholder",
      thumbnailUrl: row?.thumbnailUrl ?? null,
      version: row?.version ?? null,
      updatedAt: row?.updatedAt ? new Date(row.updatedAt).toISOString() : null,
      hasRenderData: Boolean(row?.renderDataJson?.trim()),
    };
  });
}

function compareAssetFreshness(left: WorldAssetRow, right: WorldAssetRow): number {
  const leftTime = new Date(left.updatedAt).getTime();
  const rightTime = new Date(right.updatedAt).getTime();
  const normalizedLeftTime = Number.isFinite(leftTime) ? leftTime : 0;
  const normalizedRightTime = Number.isFinite(rightTime) ? rightTime : 0;
  if (normalizedLeftTime !== normalizedRightTime) {
    return normalizedLeftTime - normalizedRightTime;
  }
  return left.version - right.version;
}
