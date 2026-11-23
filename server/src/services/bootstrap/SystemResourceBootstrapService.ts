import type { Prisma } from "@prisma/client";
import { prisma } from "../../db/prisma";
import { BUILT_IN_STORY_MODE_SEEDS, type StoryModeSeedNode } from "../../db/storyModeSeeds";
import {
  DEFAULT_ANTI_AI_RULES,
  DEFAULT_STARTER_STYLE_PROFILES,
  DEFAULT_STYLE_TEMPLATES,
  type DefaultAntiAiRuleDefinition,
  type DefaultStarterStyleProfileDefinition,
  type DefaultTemplateDefinition,
} from "../styleEngine/defaults";
import { serializeJson } from "../styleEngine/helpers";
import { serializeStoryModeProfile } from "../storyMode/storyModeProfile";

export type SystemResourceSeedMode = "missing_only" | "sync_existing";

const STARTER_STYLE_PROFILE_SOURCE_PREFIX = "starter-style-profile:";

interface GenreSeedNode {
  id: string;
  name: string;
  description: string;
  template: string;
  children?: GenreSeedNode[];
}

export interface StyleEngineSeedReport {
  styleTemplatesCreated: number;
  styleTemplatesUpdated: number;
  antiAiRulesCreated: number;
  antiAiRulesUpdated: number;
  styleProfilesCreated: number;
  styleProfilesUpdated: number;
}

export interface SystemResourceBootstrapReport extends StyleEngineSeedReport {
  genresCreated: number;
  genresUpdated: number;
  storyModesCreated: number;
  storyModesUpdated: number;
}

const EMPTY_STYLE_ENGINE_REPORT: StyleEngineSeedReport = {
  styleTemplatesCreated: 0,
  styleTemplatesUpdated: 0,
  antiAiRulesCreated: 0,
  antiAiRulesUpdated: 0,
  styleProfilesCreated: 0,
  styleProfilesUpdated: 0,
};

const EMPTY_BOOTSTRAP_REPORT: SystemResourceBootstrapReport = {
  genresCreated: 0,
  genresUpdated: 0,
  storyModesCreated: 0,
  storyModesUpdated: 0,
  ...EMPTY_STYLE_ENGINE_REPORT,
};

const BUILT_IN_GENRE_SEEDS: GenreSeedNode[] = [
  {
    id: "genre_fantasy_root",
    name: "fantasía",
    description: "Incluyendo fantasía oriental, magia occidental y otros tipos de fantasía.",
    template: "Resalte el conflicto entre el entorno de la cosmovisión y la línea de crecimiento.",
    children: [
      {
        id: "genre_fantasy_eastern",
        name: "fantasía oriental",
        description: "El sistema de cultivo, el poder de la secta y la narrativa de la familia y el país son igualmente importantes.",
        template: "Énfasis en los avances del reino y los juegos de poder.",
      },
      {
        id: "genre_fantasy_western",
        name: "fantasía occidental",
        description: "Elementos clásicos como caballeros, magos, criaturas míticas, etc.",
        template: "Énfasis en misiones aventureras y conflictos épicos.",
      },
      {
        id: "genre_fantasy_xianxia",
        name: "Cultivo inmortal de Xia",
        description: "Toma como temas centrales el sistema de cultivación, el taoísmo, la causa y efecto y la inmortalidad.",
        template: "Enfatiza el camino del cultivo, el costo de causa y efecto y la elección del camino de la secta/inmortal.",
      },
      {
        id: "genre_fantasy_high_martial",
        name: "Alta fantasía de artes marciales.",
        description: "Se enfatizan igualmente el sistema de energía de alta intensidad, el crecimiento del combate y el salto de clase mundial.",
        template: "Énfasis en la mejora del poder, la supresión del combate y el avance del nivel de orden.",
      },
    ],
  },
  {
    id: "genre_urban_root",
    name: "ciudad",
    description: "Tomando las ciudades modernas como escenario principal, enfatiza los conflictos de la vida real y las relaciones de los personajes.",
    template: "Resalta el sentido del ritmo y los detalles orientados a la vida.",
    children: [
      {
        id: "genre_urban_superpower",
        name: "Superpotencia urbana",
        description: "Habilidades sobrenaturales, reglas secretas o profesiones especiales se superponen bajo el marco urbano moderno.",
        template: "Énfasis en la sensación de contraste y espacio para la mejora después de la colisión entre el orden real y la configuración de superpotencia.",
      },
      {
        id: "genre_urban_workplace",
        name: "lugar de trabajo urbano",
        description: "La trama gira en torno al crecimiento profesional, las relaciones organizativas y los intereses reales.",
        template: "Énfasis en la presión del proyecto, el juego en el lugar de trabajo y el cumplimiento de habilidades.",
      },
      {
        id: "genre_urban_life",
        name: "vida urbana",
        description: "Tomando como escenario principal la vida real, las relaciones vecinales, la familia y el funcionamiento diario.",
        template: "Enfatiza el sentido de vida, el pequeño avance y la recuperación o acumulación continua.",
      },
    ],
  },
  {
    id: "genre_history_root",
    name: "historia",
    description: "Tomando como escenario estructuras sociales antiguas o históricas, enfatiza las limitaciones de los tiempos y los cambios en la situación.",
    template: "Resaltar el ambiente de la época, estatus, clase y tendencia general.",
    children: [
      {
        id: "genre_history_alt",
        name: "ficcion historica",
        description: "Tomando prestada la textura histórica y la lógica institucional, pero permitiendo la reconstrucción de fuerzas clave y tendencias de los acontecimientos.",
        template: "Énfasis en la atmósfera de los tiempos, los juegos institucionales y la reescritura del destino.",
      },
      {
        id: "genre_history_power",
        name: "Intrigas judiciales",
        description: "Gira en torno a la situación del gobierno, las facciones, la supervivencia de la burocracia y las decisiones políticas.",
        template: "Énfasis en juegos entre facciones, inversión de situaciones y elecciones de poder con costos claros.",
      },
      {
        id: "genre_history_war",
        name: "Choque de dinastía",
        description: "Continúa girando en torno a la expansión del poder, el avance de la guerra y la reorganización del patrón general.",
        template: "Se pone énfasis en el ritmo de la conquista, la programación de recursos y los cambios territoriales.",
      },
    ],
  },
  {
    id: "genre_scifi_root",
    name: "ciencia ficción",
    description: "La fuerza impulsora central es el cambio tecnológico, el orden futuro, la exploración espacial o la supervivencia apocalíptica.",
    template: "Resalte la configuración técnica, las reglas futuras y los costos de supervivencia.",
    children: [
      {
        id: "genre_scifi_near_future",
        name: "ciencia ficción del futuro cercano",
        description: "Sociedad del futuro próximo, tecnología y conflictos cotidianos basados ​​en la extensión de la realidad.",
        template: "Enfatiza cómo el cambio tecnológico reescribe la vida real, las estructuras institucionales y relacionales.",
      },
      {
        id: "genre_scifi_cyberpunk",
        name: "ciberpunk",
        description: "Coexisten alta tecnología y bajos niveles de vida, monopolio del capital, transformación de cuerpos protésicos y alienación de la identidad.",
        template: "Énfasis en la opresión tecnológica, las divisiones de clases y la resistencia personal.",
      },
      {
        id: "genre_scifi_apocalypse",
        name: "ciencia ficción apocalíptica",
        description: "La catástrofe, la crisis de recursos y la reconstrucción del orden impulsan conjuntamente la selección de personajes.",
        template: "Destaca la presión de la supervivencia, la competencia por los recursos y el establecimiento de un nuevo orden.",
      },
      {
        id: "genre_scifi_space",
        name: "aventura interestelar",
        description: "Avanza en la trama a través de viajes, civilizaciones desconocidas, operaciones de flotas o misiones interestelares.",
        template: "Énfasis en explorar lo desconocido, la colaboración grupal y la colisión de civilizaciones.",
      },
    ],
  },
  {
    id: "genre_suspense_root",
    name: "thriller de suspenso",
    description: "Continúe leyendo impulsado por los misterios, las anomalías, el peligro que se acerca y la recuperación de la verdad.",
    template: "Resalte la progresión de pistas, los detalles inusuales y la acumulación de presión.",
    children: [
      {
        id: "genre_suspense_detective",
        name: "Razonamiento de la investigación criminal",
        description: "Continuar avanzando en torno a la investigación de casos, la cadena de evidencia y la deducción lógica.",
        template: "Enfatizar la estructura del caso, el proceso de investigación y la recuperación del razonamiento.",
      },
      {
        id: "genre_suspense_thriller",
        name: "suspenso",
        description: "El peligro continúa acercándose, tanto con amenazas desconocidas como con opresión psicológica.",
        template: "Destaca los riesgos crecientes, las lagunas de información y los climas opresivos.",
      },
      {
        id: "genre_suspense_weird_rules",
        name: "Historias raras sobre reglas.",
        description: "Organice la historia en torno a reglas, tabúes, lógica inusual y el costo de los errores.",
        template: "Énfasis en la identificación de reglas, pruebas de límites y recuperación de excepciones.",
      },
      {
        id: "genre_suspense_infinite",
        name: "Copias ilimitadas",
        description: "Avanza en la supervivencia y avanza a través de mazmorras, niveles o espacios para bicicletas.",
        template: "Énfasis en los objetivos de las mazmorras, los mecanismos de limpieza, la presión mortal y el escape por etapas.",
      },
    ],
  },
  {
    id: "genre_romance_root",
    name: "romance",
    description: "Las principales fuerzas impulsoras de la lectura son la promoción de relaciones, la realización emocional y el compañerismo del carácter.",
    template: "Resalte los cambios en las relaciones, la atracción emocional y las respuestas escenificadas.",
    children: [
      {
        id: "genre_romance_modern",
        name: "romance moderno",
        description: "Promoción de relaciones, atracción emocional y elecciones realistas en el contexto de la vida moderna.",
        template: "Enfatiza escenarios de vida, malentendidos relacionales y reciclaje emocional.",
      },
      {
        id: "genre_romance_ancient",
        name: "romance antiguo",
        description: "La etiqueta antigua, las limitaciones de identidad y los enredos fatídicos trabajan juntos para desarrollar las relaciones.",
        template: "Énfasis en las restricciones de etiqueta, las diferencias de estatus y las opciones de relación.",
      },
      {
        id: "genre_romance_campus",
        name: "juventud del campus",
        description: "Gira en torno al crecimiento, las relaciones con los compañeros, un enfoque tentativo y una atmósfera juvenil.",
        template: "Énfasis en las preocupaciones sobre el crecimiento, las pruebas de las relaciones y la realización escalonada de los latidos del corazón.",
      },
    ],
  },
  {
    id: "genre_game_root",
    name: "Competencia de juego",
    description: "Continúe avanzando en torno a competencias, sistemas de carrera, crecimiento numérico o tareas sistemáticas.",
    template: "Resaltar las reglas y objetivos, el crecimiento por etapas y el cumplimiento de resultados.",
    children: [
      {
        id: "genre_game_esports",
        name: "deportes electrónicos",
        description: "Las líneas principales son la competición, el rodaje del equipo, el crecimiento del entrenamiento y los avances en el rendimiento.",
        template: "Enfatizar el ritmo del juego, el trabajo en equipo y el desempeño clave del juego.",
      },
      {
        id: "genre_game_online",
        name: "juegos virtuales en línea",
        description: "Gira en torno al sistema de carrera, las mazmorras, las relaciones sindicales y el crecimiento del mundo del juego.",
        template: "Enfatice el crecimiento del sistema, la promoción de copias y la competencia de recursos.",
      },
    ],
  },
];

function mergeBootstrapReport(
  base: SystemResourceBootstrapReport,
  patch: Partial<SystemResourceBootstrapReport>,
): SystemResourceBootstrapReport {
  return {
    genresCreated: base.genresCreated + (patch.genresCreated ?? 0),
    genresUpdated: base.genresUpdated + (patch.genresUpdated ?? 0),
    storyModesCreated: base.storyModesCreated + (patch.storyModesCreated ?? 0),
    storyModesUpdated: base.storyModesUpdated + (patch.storyModesUpdated ?? 0),
    styleTemplatesCreated: base.styleTemplatesCreated + (patch.styleTemplatesCreated ?? 0),
    styleTemplatesUpdated: base.styleTemplatesUpdated + (patch.styleTemplatesUpdated ?? 0),
    antiAiRulesCreated: base.antiAiRulesCreated + (patch.antiAiRulesCreated ?? 0),
    antiAiRulesUpdated: base.antiAiRulesUpdated + (patch.antiAiRulesUpdated ?? 0),
    styleProfilesCreated: base.styleProfilesCreated + (patch.styleProfilesCreated ?? 0),
    styleProfilesUpdated: base.styleProfilesUpdated + (patch.styleProfilesUpdated ?? 0),
  };
}

function mergeStyleEngineReport(
  base: StyleEngineSeedReport,
  patch: Partial<StyleEngineSeedReport>,
): StyleEngineSeedReport {
  return {
    styleTemplatesCreated: base.styleTemplatesCreated + (patch.styleTemplatesCreated ?? 0),
    styleTemplatesUpdated: base.styleTemplatesUpdated + (patch.styleTemplatesUpdated ?? 0),
    antiAiRulesCreated: base.antiAiRulesCreated + (patch.antiAiRulesCreated ?? 0),
    antiAiRulesUpdated: base.antiAiRulesUpdated + (patch.antiAiRulesUpdated ?? 0),
    styleProfilesCreated: base.styleProfilesCreated + (patch.styleProfilesCreated ?? 0),
    styleProfilesUpdated: base.styleProfilesUpdated + (patch.styleProfilesUpdated ?? 0),
  };
}

async function seedGenreNode(
  tx: Prisma.TransactionClient,
  node: GenreSeedNode,
  parentId: string | null,
  mode: SystemResourceSeedMode,
): Promise<Pick<SystemResourceBootstrapReport, "genresCreated" | "genresUpdated">> {
  let report = { genresCreated: 0, genresUpdated: 0 };
  const existing = await tx.novelGenre.findUnique({
    where: { id: node.id },
    select: { id: true },
  });

  if (existing) {
    if (mode === "sync_existing") {
      await tx.novelGenre.update({
        where: { id: node.id },
        data: {
          name: node.name,
          description: node.description,
          template: node.template,
          parentId,
        },
      });
      report = { genresCreated: 0, genresUpdated: 1 };
    }
  } else {
    await tx.novelGenre.create({
      data: {
        id: node.id,
        name: node.name,
        description: node.description,
        template: node.template,
        parentId,
      },
    });
    report = { genresCreated: 1, genresUpdated: 0 };
  }

  for (const child of node.children ?? []) {
    const childReport = await seedGenreNode(tx, child, node.id, mode);
    report = {
      genresCreated: report.genresCreated + childReport.genresCreated,
      genresUpdated: report.genresUpdated + childReport.genresUpdated,
    };
  }

  return report;
}

async function seedStoryModeNode(
  tx: Prisma.TransactionClient,
  node: StoryModeSeedNode["children"][number] | StoryModeSeedNode,
  parentId: string | null,
  mode: SystemResourceSeedMode,
): Promise<Pick<SystemResourceBootstrapReport, "storyModesCreated" | "storyModesUpdated">> {
  let report = { storyModesCreated: 0, storyModesUpdated: 0 };
  const existing = await tx.novelStoryMode.findUnique({
    where: { id: node.id },
    select: { id: true },
  });

  const data = {
    name: node.name,
    description: node.description,
    template: node.template,
    profileJson: serializeStoryModeProfile(node.profile),
    parentId,
  };

  if (existing) {
    if (mode === "sync_existing") {
      await tx.novelStoryMode.update({
        where: { id: node.id },
        data,
      });
      report = { storyModesCreated: 0, storyModesUpdated: 1 };
    }
  } else {
    await tx.novelStoryMode.create({
      data: {
        id: node.id,
        ...data,
      },
    });
    report = { storyModesCreated: 1, storyModesUpdated: 0 };
  }

  if ("children" in node && Array.isArray(node.children)) {
    for (const child of node.children) {
      const childReport = await seedStoryModeNode(tx, child, node.id, mode);
      report = {
        storyModesCreated: report.storyModesCreated + childReport.storyModesCreated,
        storyModesUpdated: report.storyModesUpdated + childReport.storyModesUpdated,
      };
    }
  }

  return report;
}

function buildStyleTemplateWriteData(template: DefaultTemplateDefinition) {
  return {
    name: template.name,
    description: template.description,
    category: template.category,
    tagsJson: serializeJson(template.tags),
    applicableGenresJson: serializeJson(template.applicableGenres),
    analysisMarkdown: template.analysisMarkdown,
    narrativeRulesJson: serializeJson(template.narrativeRules),
    characterRulesJson: serializeJson(template.characterRules),
    languageRulesJson: serializeJson(template.languageRules),
    rhythmRulesJson: serializeJson(template.rhythmRules),
    defaultAntiAiRuleKeysJson: serializeJson(template.defaultAntiAiRuleKeys),
  };
}

function buildAntiAiRuleWriteData(rule: DefaultAntiAiRuleDefinition) {
  return {
    name: rule.name,
    type: rule.type,
    severity: rule.severity,
    description: rule.description,
    detectPatternsJson: serializeJson(rule.detectPatterns),
    rewriteSuggestion: rule.rewriteSuggestion,
    promptInstruction: rule.promptInstruction,
    autoRewrite: rule.autoRewrite,
    enabled: rule.enabled,
    globalBaselineEnabled: rule.globalBaselineEnabled,
  };
}

function buildStarterStyleProfileSourceRef(definition: DefaultStarterStyleProfileDefinition): string {
  return `${STARTER_STYLE_PROFILE_SOURCE_PREFIX}${definition.key}`;
}

function buildStarterStyleProfileWriteData(input: {
  definition: DefaultStarterStyleProfileDefinition;
  template: DefaultTemplateDefinition;
}) {
  return {
    name: input.definition.name,
    description: input.definition.description,
    category: input.template.category,
    tagsJson: serializeJson(input.template.tags),
    applicableGenresJson: serializeJson(input.template.applicableGenres),
    sourceType: "manual",
    sourceRefId: buildStarterStyleProfileSourceRef(input.definition),
    sourceContent: null,
    extractedFeaturesJson: serializeJson([]),
    analysisMarkdown: input.template.analysisMarkdown,
    narrativeRulesJson: serializeJson(input.template.narrativeRules),
    characterRulesJson: serializeJson(input.template.characterRules),
    languageRulesJson: serializeJson(input.template.languageRules),
    rhythmRulesJson: serializeJson(input.template.rhythmRules),
    status: "active",
  };
}

async function seedStarterStyleProfiles(
  tx: Prisma.TransactionClient,
  mode: SystemResourceSeedMode,
): Promise<StyleEngineSeedReport> {
  let report = { ...EMPTY_STYLE_ENGINE_REPORT };
  const totalProfiles = await tx.styleProfile.count();
  if (mode === "missing_only" && totalProfiles > 0) {
    return report;
  }

  for (const definition of DEFAULT_STARTER_STYLE_PROFILES) {
    const template = DEFAULT_STYLE_TEMPLATES.find((item) => item.key === definition.templateKey);
    if (!template) {
      continue;
    }

    const sourceRefId = buildStarterStyleProfileSourceRef(definition);
    const existing = await tx.styleProfile.findFirst({
      where: { sourceRefId },
      select: { id: true },
    });
    const antiAiRules = template.defaultAntiAiRuleKeys.length > 0
      ? await tx.antiAiRule.findMany({
        where: {
          key: {
            in: template.defaultAntiAiRuleKeys,
          },
        },
        select: { id: true },
      })
      : [];

    if (existing) {
      if (mode === "sync_existing") {
        await tx.styleProfile.update({
          where: { id: existing.id },
          data: buildStarterStyleProfileWriteData({ definition, template }),
        });
        await tx.styleProfileAntiAiRule.deleteMany({
          where: { styleProfileId: existing.id },
        });
        if (antiAiRules.length > 0) {
          await tx.styleProfileAntiAiRule.createMany({
            data: antiAiRules.map((rule) => ({
              styleProfileId: existing.id,
              antiAiRuleId: rule.id,
              enabled: true,
            })),
          });
        }
        report = mergeStyleEngineReport(report, { styleProfilesUpdated: 1 });
      }
      continue;
    }

    const created = await tx.styleProfile.create({
      data: {
        ...buildStarterStyleProfileWriteData({ definition, template }),
      },
      select: { id: true },
    });
    if (antiAiRules.length > 0) {
      await tx.styleProfileAntiAiRule.createMany({
        data: antiAiRules.map((rule) => ({
          styleProfileId: created.id,
          antiAiRuleId: rule.id,
          enabled: true,
        })),
      });
    }
    report = mergeStyleEngineReport(report, { styleProfilesCreated: 1 });
  }

  return report;
}

export async function seedStyleEngineStarterData(
  mode: SystemResourceSeedMode = "missing_only",
): Promise<StyleEngineSeedReport> {
  return prisma.$transaction(async (tx) => {
    let report = { ...EMPTY_STYLE_ENGINE_REPORT };

    for (const rule of DEFAULT_ANTI_AI_RULES) {
      const existing = await tx.antiAiRule.findUnique({
        where: { key: rule.key },
        select: { id: true },
      });
      if (existing) {
        if (mode === "sync_existing") {
          await tx.antiAiRule.update({
            where: { key: rule.key },
            data: buildAntiAiRuleWriteData(rule),
          });
          report = mergeStyleEngineReport(report, { antiAiRulesUpdated: 1 });
        }
        continue;
      }

      await tx.antiAiRule.create({
        data: {
          key: rule.key,
          ...buildAntiAiRuleWriteData(rule),
        },
      });
      report = mergeStyleEngineReport(report, { antiAiRulesCreated: 1 });
    }

    for (const template of DEFAULT_STYLE_TEMPLATES) {
      const existing = await tx.styleTemplate.findUnique({
        where: { key: template.key },
        select: { id: true },
      });
      if (existing) {
        if (mode === "sync_existing") {
          await tx.styleTemplate.update({
            where: { key: template.key },
            data: buildStyleTemplateWriteData(template),
          });
          report = mergeStyleEngineReport(report, { styleTemplatesUpdated: 1 });
        }
        continue;
      }

      await tx.styleTemplate.create({
        data: {
          key: template.key,
          ...buildStyleTemplateWriteData(template),
        },
      });
      report = mergeStyleEngineReport(report, { styleTemplatesCreated: 1 });
    }

    report = mergeStyleEngineReport(report, await seedStarterStyleProfiles(tx, mode));

    return report;
  });
}

export async function ensureSystemResourceStarterData(
  options: {
    mode?: SystemResourceSeedMode;
  } = {},
): Promise<SystemResourceBootstrapReport> {
  const mode = options.mode ?? "missing_only";
  let report = { ...EMPTY_BOOTSTRAP_REPORT };

  const genreReport = await prisma.$transaction(async (tx) => {
    let acc = { genresCreated: 0, genresUpdated: 0 };
    for (const root of BUILT_IN_GENRE_SEEDS) {
      const seeded = await seedGenreNode(tx, root, null, mode);
      acc = {
        genresCreated: acc.genresCreated + seeded.genresCreated,
        genresUpdated: acc.genresUpdated + seeded.genresUpdated,
      };
    }
    return acc;
  });
  report = mergeBootstrapReport(report, genreReport);

  const storyModeReport = await prisma.$transaction(async (tx) => {
    let acc = { storyModesCreated: 0, storyModesUpdated: 0 };
    for (const root of BUILT_IN_STORY_MODE_SEEDS) {
      const seeded = await seedStoryModeNode(tx, root, null, mode);
      acc = {
        storyModesCreated: acc.storyModesCreated + seeded.storyModesCreated,
        storyModesUpdated: acc.storyModesUpdated + seeded.storyModesUpdated,
      };
    }
    return acc;
  });
  report = mergeBootstrapReport(report, storyModeReport);

  const styleReport = await seedStyleEngineStarterData(mode);
  report = mergeBootstrapReport(report, styleReport);

  return report;
}

export function hasSystemResourceBootstrapChanges(report: SystemResourceBootstrapReport): boolean {
  return Object.values(report).some((value) => value > 0);
}
