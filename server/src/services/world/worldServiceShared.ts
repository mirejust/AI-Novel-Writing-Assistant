import type { LLMProvider } from "@ai-novel/shared/types/llm";
import type {
  WorldLayerKey,
  WorldStructuredData,
  WorldStructureSectionKey,
} from "@ai-novel/shared/types/world";
import type {
  WorldOptionRefinementLevel,
  WorldReferenceMode,
} from "@ai-novel/shared/types/worldWizard";
import { WORLD_LAYER_ORDER } from "./worldTemplates";
import { normalizeWorldStructuredData } from "./worldStructure";

export const LAYER_STATUSES = ["pending", "generated", "confirmed", "stale"] as const;
export type LayerStatus = (typeof LAYER_STATUSES)[number];
export type RefineMode = "replace" | "alternatives";

export const WORLD_TEXT_FIELDS = [
  "description",
  "background",
  "geography",
  "cultures",
  "magicSystem",
  "politics",
  "races",
  "religions",
  "technology",
  "conflicts",
  "history",
  "economy",
  "factions",
] as const;
export type WorldTextField = (typeof WORLD_TEXT_FIELDS)[number];

const WORLD_TEXT_FIELD_SET = new Set<WorldTextField>(WORLD_TEXT_FIELDS);

const DEEPENING_LAYER_PRIMARY_FIELD: Record<WorldLayerKey, WorldTextField> = {
  foundation: "background",
  power: "magicSystem",
  society: "politics",
  culture: "cultures",
  history: "history",
  conflict: "conflicts",
};

const DEEPENING_TARGET_LAYER_ALIASES: Record<string, WorldLayerKey> = {
  foundation: "foundation",
  "基础": "foundation",
  "基础层": "foundation",
  "世界基础": "foundation",
  power: "power",
  "力量": "power",
  "力量层": "power",
  "能力体系": "power",
  society: "society",
  "社会": "society",
  "社会层": "society",
  "政治": "society",
  culture: "culture",
  "文化": "culture",
  "文化层": "culture",
  history: "history",
  "历史": "history",
  "历史层": "history",
  conflict: "conflict",
  "冲突": "conflict",
  "冲突层": "conflict",
};

const DEEPENING_TARGET_FIELD_ALIASES: Record<string, WorldTextField> = {
  description: "description",
  summary: "description",
  overview: "description",
  "世界概述": "description",
  "世界总览": "description",
  "概述": "description",
  "设定概述": "description",
  background: "background",
  "背景": "background",
  "基础背景": "background",
  "世界背景": "background",
  "故事背景": "background",
  "时代背景": "background",
  "起始背景": "background",
  "开局背景": "background",
  "角色定位": "background",
  "人物定位": "background",
  "身份定位": "background",
  "主角身份": "background",
  "时间地点": "background",
  "时间与地点": "background",
  "起始时间地点": "background",
  geography: "geography",
  location: "geography",
  "地理": "geography",
  "地理环境": "geography",
  "地理格局": "geography",
  "地图": "geography",
  "区域": "geography",
  "场景地点": "geography",
  cultures: "cultures",
  culture: "cultures",
  "文化": "cultures",
  "文化习俗": "cultures",
  "风俗": "cultures",
  "习俗": "cultures",
  "社会风貌": "cultures",
  magicsystem: "magicSystem",
  powersystem: "magicSystem",
  power: "magicSystem",
  "力量体系": "magicSystem",
  "能力体系": "magicSystem",
  "超凡体系": "magicSystem",
  politics: "politics",
  "政治": "politics",
  "政治结构": "politics",
  "社会结构": "politics",
  "权力结构": "politics",
  "阵营关系": "politics",
  "势力格局": "politics",
  races: "races",
  race: "races",
  "种族": "races",
  "族群": "races",
  religions: "religions",
  religion: "religions",
  "宗教": "religions",
  "信仰": "religions",
  technology: "technology",
  tech: "technology",
  "科技": "technology",
  "技术体系": "technology",
  conflicts: "conflicts",
  conflict: "conflicts",
  "冲突": "conflicts",
  "核心冲突": "conflicts",
  "首要冲突": "conflicts",
  "当前冲突": "conflicts",
  history: "history",
  "历史": "history",
  "历史事件": "history",
  "关键历史": "history",
  economy: "economy",
  "经济": "economy",
  "经济系统": "economy",
  "资源流通": "economy",
  factions: "factions",
  faction: "factions",
  organization: "factions",
  organizations: "factions",
  "势力": "factions",
  "势力关系": "factions",
  "组织势力": "factions",
  "主要势力": "factions",
};

export type LayerStateMap = Record<
  WorldLayerKey,
  {
    key: WorldLayerKey;
    status: LayerStatus;
    updatedAt: string;
  }
>;

export interface CreateWorldInput {
  name: string;
  description?: string;
  worldType?: string;
  templateKey?: string;
  axioms?: string;
  background?: string;
  geography?: string;
  cultures?: string;
  magicSystem?: string;
  politics?: string;
  races?: string;
  religions?: string;
  technology?: string;
  conflicts?: string;
  history?: string;
  economy?: string;
  factions?: string;
  selectedDimensions?: string;
  selectedElements?: string;
  knowledgeDocumentIds?: string[];
  structure?: unknown;
  bindingSupport?: unknown;
}

export interface WorldGenerateInput {
  name: string;
  description: string;
  worldType: string;
  complexity: "simple" | "standard" | "detailed";
  dimensions: {
    geography: boolean;
    culture: boolean;
    magicSystem: boolean;
    technology: boolean;
    history: boolean;
  };
  provider?: LLMProvider;
  model?: string;
}

export interface RefineWorldInput {
  attribute: WorldTextField;
  currentValue: string;
  refinementLevel: "light" | "deep";
  mode?: RefineMode;
  alternativesCount?: number;
  provider?: LLMProvider;
  model?: string;
}

export interface InspirationInput {
  input?: string;
  mode?: "free" | "reference" | "random";
  worldType?: string;
  knowledgeDocumentIds?: string[];
  referenceMode?: WorldReferenceMode;
  preserveElements?: string[];
  allowedChanges?: string[];
  forbiddenElements?: string[];
  refinementLevel?: WorldOptionRefinementLevel;
  optionsCount?: number;
  provider?: LLMProvider;
  model?: string;
}

export interface LayerGenerateInput {
  provider?: LLMProvider;
  model?: string;
  temperature?: number;
}

export interface LayerUpdateInput {
  content: string;
}

export interface DeepeningAnswerInput {
  questionId: string;
  answer: string;
}

export interface ImportWorldInput {
  format: "json" | "markdown" | "text";
  content: string;
  name?: string;
  provider?: LLMProvider;
  model?: string;
}

export interface LibraryUseInput {
  worldId?: string;
  targetField?: WorldTextField;
  targetCollection?: "forces" | "locations";
}

export interface StructureBackfillInput {
  provider?: LLMProvider;
  model?: string;
}

export interface StructureGenerateInput extends StructureBackfillInput {
  section: WorldStructureSectionKey;
  structure?: unknown;
  bindingSupport?: unknown;
}

export interface StructureUpdateInput {
  structure: unknown;
  bindingSupport?: unknown;
}

export function cleanJsonText(source: string): string {
  return source.replace(/```json|```/gi, "").trim();
}

export function extractJSONObject(source: string): string {
  const text = cleanJsonText(source);
  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  if (first === -1 || last === -1 || first >= last) {
    throw new Error("Invalid JSON object.");
  }
  return text.slice(first, last + 1);
}

export function extractJSONArray(source: string): string {
  const text = cleanJsonText(source);
  const first = text.indexOf("[");
  const last = text.lastIndexOf("]");
  if (first === -1 || last === -1 || first >= last) {
    throw new Error("Invalid JSON array.");
  }
  return text.slice(first, last + 1);
}

export function safeParseJSON<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) {
    return fallback;
  }
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function nowISO(): string {
  return new Date().toISOString();
}

export function uniqueKnowledgeDocumentIds(ids: string[] | undefined): string[] {
  if (!ids || ids.length === 0) {
    return [];
  }
  return Array.from(new Set(ids.map((item) => item.trim()).filter(Boolean)));
}

export function normalizeLayerStates(raw: string | null | undefined): LayerStateMap {
  const fallback = WORLD_LAYER_ORDER.reduce((acc, key) => {
    acc[key] = { key, status: "pending", updatedAt: nowISO() };
    return acc;
  }, {} as LayerStateMap);
  const parsed = safeParseJSON<Partial<LayerStateMap>>(raw, {});

  for (const key of WORLD_LAYER_ORDER) {
    const existing = parsed[key];
    fallback[key] = {
      key,
      status: LAYER_STATUSES.includes(existing?.status as LayerStatus)
        ? (existing?.status as LayerStatus)
        : "pending",
      updatedAt: existing?.updatedAt ?? fallback[key].updatedAt,
    };
  }
  return fallback;
}

export function markDownstreamStale(states: LayerStateMap, fromLayer: WorldLayerKey): LayerStateMap {
  const index = WORLD_LAYER_ORDER.indexOf(fromLayer);
  if (index < 0) {
    return states;
  }
  for (let i = index + 1; i < WORLD_LAYER_ORDER.length; i += 1) {
    const key = WORLD_LAYER_ORDER[i];
    if (states[key].status === "generated" || states[key].status === "confirmed") {
      states[key] = { ...states[key], status: "stale", updatedAt: nowISO() };
    }
  }
  return states;
}

export function buildFieldDiff(
  older: Partial<Record<WorldTextField, string | null>>,
  newer: Partial<Record<WorldTextField, string | null>>,
): Array<{ field: WorldTextField; before: string | null; after: string | null }> {
  const changes: Array<{ field: WorldTextField; before: string | null; after: string | null }> = [];
  for (const field of WORLD_TEXT_FIELDS) {
    const before = older[field] ?? null;
    const after = newer[field] ?? null;
    if ((before ?? "") !== (after ?? "")) {
      changes.push({ field, before, after });
    }
  }
  return changes;
}

export function buildWorldStructurePromptSource(world: {
  name: string;
  worldType?: string | null;
  description?: string | null;
  axioms?: string | null;
  background?: string | null;
  geography?: string | null;
  cultures?: string | null;
  magicSystem?: string | null;
  politics?: string | null;
  races?: string | null;
  religions?: string | null;
  technology?: string | null;
  conflicts?: string | null;
  history?: string | null;
  economy?: string | null;
  factions?: string | null;
}): string {
  return [
    `Nombre mundial:${world.name}`,
    `Tipo de mundo:${world.worldType ?? "custom"}`,
    `Resumen mundial:${world.description ?? "Ninguno"}`,
    `Reglas/Axiomas:${world.axioms ?? "Ninguno"}`,
    `fondo:${world.background ?? "Ninguno"}`,
    `geografía:${world.geography ?? "Ninguno"}`,
    `cultura:${world.cultures ?? "Ninguno"}`,
    `Sistema de energía:${world.magicSystem ?? "Ninguno"}`,
    `política:${world.politics ?? "Ninguno"}`,
    `Carrera:${world.races ?? "Ninguno"}`,
    `religión:${world.religions ?? "Ninguno"}`,
    `ciencia y tecnología:${world.technology ?? "Ninguno"}`,
    `conflicto:${world.conflicts ?? "Ninguno"}`,
    `historia:${world.history ?? "Ninguno"}`,
    `economía:${world.economy ?? "Ninguno"}`,
    `fuerza:${world.factions ?? "Ninguno"}`,
  ].join("\n\n");
}

export function buildStructureSectionInstructions(section: WorldStructureSectionKey): string {
  switch (section) {
    case "profile":
      return `Solo se generan objetos JSON, la estructura es:
{
  "resumen": "...",
  "identidad": "...",
  "tono": "...",
  "temas": ["..."],
  "coreConflict": "..."
}`;
    case "rules":
      return `Solo se generan objetos JSON, la estructura es:
{
  "resumen": "...",
  "axiomas": [{"id":"regla-1","nombre":"...","summary":"...","costo":"...","límite":"...","aplicación":"..."}],
  "tabú": ["..."],
  "consecuencias compartidas": ["..."]
}`;
    case "factions":
      return `Solo se generan objetos JSON, la estructura es:
{
  "facciones": [{"id":"facción-1","nombre":"...","posición":"...","doctrina":"...","objetivos":["..."],"métodos":["..."],"representativeForceIds":["force-1"]}],
  "forces": [{"id":"force-1","name":"...","type":"...","factionId":"faction-1","summary":"...","baseOfPower":"...","currentObjective":"...","presión":"...","leader":"...","narrativeRole":"..."}]
}
Restricciones adicionales:
1. Una facción es un campo, posición, línea o alineamiento mundial abstracto, no una regla de la industria, un mecanismo de presión social o una ley interpersonal.
2. Fuerza se refiere a una organización, círculo, departamento, empresa, red o institución específica. Debe ser un sujeto de acción que pueda ejercer presión, participar en conflictos y establecer relaciones con los lugares.
3. Los mecanismos de clase mundial como las “fuentes de presión social”, las “reglas operativas de la industria” y las “reglas predeterminadas de las redes interpersonales” deberían ubicarse en reglas, no en facciones/fuerzas.`;
    case "locations":
      return `Solo genera una matriz JSON, la estructura del elemento es:
[{"id":"ubicación-1","nombre":"...","terreno":"...","summary":"...","narrativeFunction":"...","riesgo":"...","entryConstraint":"...","exitCost":"...","controllingForceIds":["force-1"]}]`;
    case "relations":
      return `Solo se generan objetos JSON, la estructura es:
{
  "forceRelations": [{"id":"force-relation-1","sourceForceId":"force-1","targetForceId":"force-2","relation":"...","tension":"...","detalle":"..."}],
  "locationControls": [{"id":"ubicación-control-1","forceId":"force-1","locationId":"ubicación-1","relation":"...","detalle":"..."}]
}`;
    default:
      return "Solo genera JSON válido.";
  }
}

export function mergeWorldStructureSection(
  current: WorldStructuredData,
  section: WorldStructureSectionKey,
  raw: unknown,
): WorldStructuredData {
  switch (section) {
    case "profile":
      return normalizeWorldStructuredData({
        ...current,
        profile: raw,
      }, current);
    case "rules":
      return normalizeWorldStructuredData({
        ...current,
        rules: raw,
      }, current);
    case "factions": {
      const record = raw && typeof raw === "object" && !Array.isArray(raw)
        ? (raw as Record<string, unknown>)
        : {};
      return normalizeWorldStructuredData({
        ...current,
        factions: record.factions ?? current.factions,
        forces: record.forces ?? current.forces,
      }, current);
    }
    case "locations":
      return normalizeWorldStructuredData({
        ...current,
        locations: raw,
      }, current);
    case "relations":
      return normalizeWorldStructuredData({
        ...current,
        relations: raw,
      }, current);
    default:
      return current;
  }
}

export function normalizeAxiomList(raw: unknown): string[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  const normalized = raw
    .map((item) => {
      if (typeof item === "string") {
        return item.trim();
      }
      if (item && typeof item === "object") {
        const record = item as Record<string, unknown>;
        const candidate = record.text ?? record.content ?? record.axiom ?? record.rule ?? record.value;
        if (typeof candidate === "string") {
          return candidate.trim();
        }
      }
      return "";
    })
    .filter(Boolean);
  return Array.from(new Set(normalized)).slice(0, 5);
}

export function normalizeQuickOptionList(raw: unknown): string[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  const normalized = raw
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean);
  return Array.from(new Set(normalized)).slice(0, 4);
}

function normalizeAliasKey(raw: string): string {
  return raw.trim().toLowerCase().replace(/[\s_\-:/\\|（）()【】\[\]·、，,。.!?？：:]/g, "");
}

export function normalizeDeepeningTargetLayer(raw: unknown): WorldLayerKey | null {
  if (typeof raw !== "string") {
    return null;
  }
  const normalized = normalizeAliasKey(raw);
  return DEEPENING_TARGET_LAYER_ALIASES[normalized] ?? null;
}

export function normalizeDeepeningTargetField(
  raw: unknown,
  targetLayer?: WorldLayerKey | null,
  questionText?: string | null,
): WorldTextField | null {
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (WORLD_TEXT_FIELD_SET.has(trimmed as WorldTextField)) {
      return trimmed as WorldTextField;
    }
    const alias = DEEPENING_TARGET_FIELD_ALIASES[normalizeAliasKey(trimmed)];
    if (alias) {
      return alias;
    }
  }

  const question = questionText?.trim() ?? "";
  if (question) {
    const questionField = DEEPENING_TARGET_FIELD_ALIASES[normalizeAliasKey(question)];
    if (questionField) {
      return questionField;
    }
    if (/冲突|敌对|威胁|危机/i.test(question)) {
      return "conflicts";
    }
    if (/时间|历史|起源|前史|事件/i.test(question)) {
      return targetLayer === "foundation" ? "background" : "history";
    }
    if (/地点|地理|区域|地图|场景/i.test(question)) {
      return "geography";
    }
    if (/势力|阵营|权力|统治|政治/i.test(question)) {
      return "politics";
    }
    if (/力量|能力|超凡|魔法|技术/i.test(question)) {
      return /技术/i.test(question) ? "technology" : "magicSystem";
    }
    if (/文化|习俗|信仰|宗教/i.test(question)) {
      return /宗教|信仰/i.test(question) ? "religions" : "cultures";
    }
    if (/种族|族群/i.test(question)) {
      return "races";
    }
    if (/经济|资源|贸易/i.test(question)) {
      return "economy";
    }
    if (/角色|人物|身份|主角/i.test(question)) {
      return "background";
    }
  }

  if (targetLayer) {
    return DEEPENING_LAYER_PRIMARY_FIELD[targetLayer];
  }
  return null;
}
