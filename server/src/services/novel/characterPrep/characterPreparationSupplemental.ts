import type {
  Character,
  CharacterGender,
  CharacterCastRole,
  SupplementalCharacterApplyResult,
  SupplementalCharacterCandidate,
  SupplementalCharacterGenerateInput,
  SupplementalCharacterGenerationResult,
} from "@ai-novel/shared/types/novel";
import { prisma } from "../../../db/prisma";
import { runStructuredPrompt } from "../../../prompting/core/promptRunner";
import { buildSupplementalCharacterContextBlocks } from "../../../prompting/prompts/novel/characterPreparation.contextBlocks";
import {
  supplementalCharacterPrompt,
} from "../../../prompting/prompts/novel/characterPreparation.prompts";
import { NovelContextService } from "../NovelContextService";
import { CharacterDynamicsService } from "../dynamics/CharacterDynamicsService";
import {
  supplementalCharacterCandidateSchema,
} from "../../../prompting/prompts/novel/characterPreparation.promptSchemas";
import { buildStoryModePromptBlock, normalizeStoryModeOutput } from "../../storyMode/storyModeProfile";
import { parseCharacterProhibitionsJson } from "../characters/characterHardFacts";
import { WorldContextGateway } from "../worldContext/WorldContextGateway";
import { characterMindService } from "../characterMind/CharacterMindService";

type CharacterRowForOutput = Awaited<ReturnType<typeof prisma.character.create>>;

const SUPPLEMENTAL_MODE_PROMPT_LABELS: Record<NonNullable<SupplementalCharacterGenerateInput["mode"]>, string> = {
  auto: "La IA determina por sí sola el método de llenado más adecuado",
  linked: "Derivar roles de relación en torno a roles existentes",
  independent: "Generar personajes que sean relativamente independientes pero que aún tengan un papel claro en la historia.",
};

const CAST_ROLE_PROMPT_LABELS: Record<CharacterCastRole | "auto", string> = {
  auto: "Dejemos que la IA juzgue por sí misma",
  protagonist: "Protagonista",
  antagonist: "oponente principal",
  ally: "alianza",
  foil: "papel espejo",
  mentor: "Mentor",
  love_interest: "atracción emocional",
  pressure_source: "factor estresante",
  catalyst: "Catalizador",
};

function getCastRolePromptLabel(castRole: string | null | undefined): string {
  if (!castRole) {
    return "No especificado";
  }
  if (castRole in CAST_ROLE_PROMPT_LABELS) {
    return CAST_ROLE_PROMPT_LABELS[castRole as CharacterCastRole | "auto"];
  }
  return castRole;
}

function toOptionalText(value: string | null | undefined): string | null {
  const normalized = value?.trim() ?? "";
  return normalized || null;
}

function serializeCharacter(row: CharacterRowForOutput): Character {
  return {
    id: row.id,
    name: row.name,
    role: row.role,
    gender: row.gender as CharacterGender | null,
    castRole: row.castRole as CharacterCastRole | null,
    storyFunction: row.storyFunction,
    relationToProtagonist: row.relationToProtagonist,
    personality: row.personality,
    background: row.background,
    development: row.development,
    identityLabel: row.identityLabel,
    factionLabel: row.factionLabel,
    stanceLabel: row.stanceLabel,
    powerLevel: row.powerLevel,
    realm: row.realm,
    currentLocation: row.currentLocation,
    availability: row.availability,
    prohibitions: parseCharacterProhibitionsJson(row.prohibitionsJson),
    prohibitionsJson: row.prohibitionsJson,
    outerGoal: row.outerGoal,
    innerNeed: row.innerNeed,
    fear: row.fear,
    wound: row.wound,
    misbelief: row.misbelief,
    secret: row.secret,
    moralLine: row.moralLine,
    firstImpression: row.firstImpression,
    arcStart: row.arcStart,
    arcMidpoint: row.arcMidpoint,
    arcClimax: row.arcClimax,
    arcEnd: row.arcEnd,
    currentState: row.currentState,
    currentGoal: row.currentGoal,
    lastEvolvedAt: row.lastEvolvedAt?.toISOString() ?? null,
    novelId: row.novelId,
    baseCharacterId: row.baseCharacterId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toPromptFallback(value: string | null | undefined, fallback: string): string {
  const normalized = value?.trim();
  return normalized && normalized.length > 0 ? normalized : fallback;
}

export class CharacterPreparationSupplementalService {
  constructor(
    private readonly novelContextService: NovelContextService,
    private readonly characterDynamicsService: CharacterDynamicsService,
    private readonly worldContextGateway = new WorldContextGateway(),
  ) {}

  async generateSupplementalCharacters(
    novelId: string,
    options: SupplementalCharacterGenerateInput = {},
  ): Promise<SupplementalCharacterGenerationResult> {
    const mode = options.mode ?? "auto";
    const novel = await prisma.novel.findUnique({
      where: { id: novelId },
      include: {
        genre: { select: { name: true } },
        bible: {
          select: {
            coreSetting: true,
            mainPromise: true,
            characterArcs: true,
          },
        },
        storyMacroPlan: {
          select: {
            storyInput: true,
            decompositionJson: true,
            constraintEngineJson: true,
          },
        },
        primaryStoryMode: {
          select: {
            id: true,
            name: true,
            description: true,
            template: true,
            parentId: true,
            profileJson: true,
            createdAt: true,
            updatedAt: true,
          },
        },
        secondaryStoryMode: {
          select: {
            id: true,
            name: true,
            description: true,
            template: true,
            parentId: true,
            profileJson: true,
            createdAt: true,
            updatedAt: true,
          },
        },
        characters: {
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            name: true,
            role: true,
            gender: true,
            castRole: true,
            storyFunction: true,
            relationToProtagonist: true,
            personality: true,
            background: true,
            development: true,
            identityLabel: true,
            factionLabel: true,
            stanceLabel: true,
            powerLevel: true,
            realm: true,
            currentLocation: true,
            availability: true,
            prohibitionsJson: true,
            outerGoal: true,
            currentState: true,
            currentGoal: true,
          },
        },
        characterRelations: {
          orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
          include: {
            sourceCharacter: { select: { id: true, name: true } },
            targetCharacter: { select: { id: true, name: true } },
          },
        },
      },
    });

    if (!novel) {
      throw new Error("Novel not found.");
    }

    const anchorIds = Array.from(new Set((options.anchorCharacterIds ?? []).filter(Boolean)));
    const storyInput = novel.storyMacroPlan?.storyInput?.trim() || novel.description?.trim() || "";
    const worldContext = options.useWorldContext === false
      ? null
      : await this.worldContextGateway.getWorldContextBlock(novelId, {
        purpose: "character",
        strength: "normal",
        storyInput,
        provider: options.provider,
        model: options.model,
        temperature: options.temperature,
      });
    const storyModeBlock = buildStoryModePromptBlock({
      primary: novel.primaryStoryMode ? normalizeStoryModeOutput(novel.primaryStoryMode) : null,
      secondary: novel.secondaryStoryMode ? normalizeStoryModeOutput(novel.secondaryStoryMode) : null,
    });
    const anchorCharacters = novel.characters.filter((character) => anchorIds.includes(character.id));
    const relevantRelations = anchorCharacters.length > 0
      ? novel.characterRelations.filter(
        (relation) => anchorIds.includes(relation.sourceCharacterId) || anchorIds.includes(relation.targetCharacterId),
      )
      : novel.characterRelations.slice(0, 12);
    const targetCountText = typeof options.count === "number"
      ? `Debe generarse esta vez. ${options.count} rol de candidato.`
      : "Decida la cantidad de candidatos según las necesidades de la historia del autor y las brechas en la alineación existente, y escriba la cantidad recomendada de candidatos en el recuento recomendado.";
    const contextBlocks = buildSupplementalCharacterContextBlocks({
      projectTitle: novel.title,
      modeLabel: `${mode}(${SUPPLEMENTAL_MODE_PROMPT_LABELS[mode]})`,
      targetRoleLabel: `${options.targetCastRole ?? "auto"}(${getCastRolePromptLabel(options.targetCastRole ?? "auto")})`,
      requestedCountText: targetCountText,
      userPrompt: toPromptFallback(options.userPrompt, "Ninguno"),
      storyInput: toPromptFallback(
        novel.storyMacroPlan?.storyInput?.trim() || novel.description?.trim(),
        "Aún no hay información clara sobre la historia. Haga sus propias inferencias basándose en el tema, el mundo de este libro y los personajes existentes.",
      ),
      genreName: novel.genre?.name ?? "No especificado",
      storyModeBlock,
      styleTone: novel.styleTone ?? "No especificado",
      narrativePov: novel.narrativePov ?? "No especificado",
      pacePreference: novel.pacePreference ?? "No especificado",
      emotionIntensity: novel.emotionIntensity ?? "No especificado",
      corePromise: novel.bible?.mainPromise ?? "Sin datos",
      coreSetting: novel.bible?.coreSetting ?? "Sin datos",
      characterArcs: novel.bible?.characterArcs ?? "Sin datos",
      worldRules: worldContext?.worldRulesText ?? "Sin datos",
      worldStage: worldContext?.worldStageText ?? "El mundo de este libro no ha sido resuelto. Dé prioridad a inferir la etapa del personaje en función de los aportes de la historia y las limitaciones a nivel del libro.",
      worldFocusHints: options.useWorldContext === false ? null : options.worldFocusHints,
      storyDecomposition: novel.storyMacroPlan?.decompositionJson ?? "Sin datos",
      constraintEngine: novel.storyMacroPlan?.constraintEngineJson ?? "Sin datos",
      existingCharactersText: novel.characters.length > 0
        ? novel.characters
          .map((character) => [
            `${character.name} (${character.role})`,
            character.castRole ? `Posición de alineación =${getCastRolePromptLabel(character.castRole)} (${character.castRole})` : "",
            character.storyFunction ? `Función de historia =${character.storyFunction}` : "",
            character.relationToProtagonist ? `Relación con el protagonista =${character.relationToProtagonist}` : "",
            character.personality ? `Carácter =${character.personality}` : "",
            character.background ? `fondo =${character.background}` : "",
            character.development ? `crecimiento =${character.development}` : "",
            character.identityLabel ? `Identidad=${character.identityLabel}` : "",
            character.factionLabel ? `campamento =${character.factionLabel}` : "",
            character.stanceLabel ? `posición =${character.stanceLabel}` : "",
            character.powerLevel ? `Reino =${character.powerLevel}` : "",
            character.realm ? `Capa de reino =${character.realm}` : "",
            character.currentLocation ? `ubicación =${character.currentLocation}` : "",
            character.availability ? `Disponible =${character.availability}` : "",
            character.prohibitionsJson ? `Prohibido =${parseCharacterProhibitionsJson(character.prohibitionsJson).join(" / ")}` : "",
            character.outerGoal ? `objetivos externos =${character.outerGoal}` : "",
            character.currentState ? `estado actual =${character.currentState}` : "",
            character.currentGoal ? `objetivo actual =${character.currentGoal}` : "",
          ].filter(Boolean).join(" | "))
          .join("\n")
        : "Actualmente no hay roles creados.",
      anchorCharactersText: anchorCharacters.length > 0
        ? anchorCharacters
          .map((character) => [
            `${character.name} (${character.role})`,
            character.storyFunction ? `Función de historia =${character.storyFunction}` : "",
            character.relationToProtagonist ? `Relación con el protagonista =${character.relationToProtagonist}` : "",
            character.identityLabel ? `Identidad=${character.identityLabel}` : "",
            character.factionLabel ? `campamento =${character.factionLabel}` : "",
            character.powerLevel ? `Reino =${character.powerLevel}` : "",
            character.currentState ? `estado actual =${character.currentState}` : "",
            character.currentGoal ? `objetivo actual =${character.currentGoal}` : "",
          ].filter(Boolean).join(" | "))
          .join("\n")
        : "Actualmente no hay ningún rol de anclaje seleccionado explícitamente.",
      relationsText: relevantRelations.length > 0
        ? relevantRelations
          .map((relation) => [
            `${relation.sourceCharacter.name} -> ${relation.targetCharacter.name}`,
            `Relación de superficie =${relation.surfaceRelation}`,
            relation.hiddenTension ? `tensión oculta =${relation.hiddenTension}` : "",
            relation.conflictSource ? `Fuente del conflicto =${relation.conflictSource}` : "",
            relation.dynamicLabel ? `etiqueta dinámica =${relation.dynamicLabel}` : "",
            relation.nextTurnPoint ? `El próximo punto de inflexión =${relation.nextTurnPoint}` : "",
          ].filter(Boolean).join(" | "))
          .join("\n")
        : "Ninguno todavía.",
      forbiddenNames: novel.characters.map((character) => character.name),
    });

    const result = await runStructuredPrompt({
      asset: supplementalCharacterPrompt,
      promptInput: {count: options.count},
      contextBlocks,
      options: {
        provider: options.provider,
        model: options.model,
        temperature: options.temperature ?? 0.55,
      },
    });
    const parsed = result.output;

    return {
      mode: parsed.mode,
      recommendedCount: options.count ?? parsed.recommendedCount,
      planningSummary: toOptionalText(parsed.planningSummary),
      candidates: parsed.candidates.map((candidate) => ({
        name: candidate.name,
        role: candidate.role,
        gender: candidate.gender,
        castRole: candidate.castRole,
        summary: candidate.summary,
        storyFunction: candidate.storyFunction,
        relationToProtagonist: toOptionalText(candidate.relationToProtagonist),
        personality: toOptionalText(candidate.personality),
        background: toOptionalText(candidate.background),
        development: toOptionalText(candidate.development),
        identityLabel: toOptionalText(candidate.identityLabel),
        factionLabel: toOptionalText(candidate.factionLabel),
        stanceLabel: toOptionalText(candidate.stanceLabel),
        powerLevel: toOptionalText(candidate.powerLevel),
        realm: toOptionalText(candidate.realm),
        currentLocation: toOptionalText(candidate.currentLocation),
        availability: toOptionalText(candidate.availability),
        prohibitions: candidate.prohibitions,
        outerGoal: toOptionalText(candidate.outerGoal),
        innerNeed: toOptionalText(candidate.innerNeed),
        fear: toOptionalText(candidate.fear),
        wound: toOptionalText(candidate.wound),
        misbelief: toOptionalText(candidate.misbelief),
        secret: toOptionalText(candidate.secret),
        moralLine: toOptionalText(candidate.moralLine),
        firstImpression: toOptionalText(candidate.firstImpression),
        currentState: toOptionalText(candidate.currentState),
        currentGoal: toOptionalText(candidate.currentGoal),
        whyNow: toOptionalText(candidate.whyNow),
        relations: candidate.relations.map((relation) => ({
          sourceName: relation.sourceName,
          targetName: relation.targetName,
          surfaceRelation: relation.surfaceRelation,
          hiddenTension: toOptionalText(relation.hiddenTension),
          conflictSource: toOptionalText(relation.conflictSource),
          dynamicLabel: toOptionalText(relation.dynamicLabel),
          nextTurnPoint: toOptionalText(relation.nextTurnPoint),
        })),
      })),
    };
  }

  async applySupplementalCharacter(
    novelId: string,
    candidate: SupplementalCharacterCandidate,
  ): Promise<SupplementalCharacterApplyResult> {
    const parsedCandidate = supplementalCharacterCandidateSchema.parse(candidate);
    const existingCharacters = await prisma.character.findMany({
      where: { novelId },
      select: { id: true, name: true },
      orderBy: { createdAt: "asc" },
    });

    if (existingCharacters.some((character) => character.name === parsedCandidate.name)) {
      throw new Error(`Role"${parsedCandidate.name}”ya existe, por favor regenera o modifica el nombre antes de crearlo.`);
    }

    const created = await this.novelContextService.createCharacter(novelId, {
      name: parsedCandidate.name,
      role: parsedCandidate.role,
      gender: parsedCandidate.gender,
      castRole: parsedCandidate.castRole,
      storyFunction: parsedCandidate.storyFunction,
      relationToProtagonist: toOptionalText(parsedCandidate.relationToProtagonist) ?? undefined,
      personality: toOptionalText(parsedCandidate.personality) ?? undefined,
      background: toOptionalText(parsedCandidate.background) ?? undefined,
      development: toOptionalText(parsedCandidate.development) ?? undefined,
      identityLabel: toOptionalText(parsedCandidate.identityLabel) ?? undefined,
      factionLabel: toOptionalText(parsedCandidate.factionLabel) ?? undefined,
      stanceLabel: toOptionalText(parsedCandidate.stanceLabel) ?? undefined,
      powerLevel: toOptionalText(parsedCandidate.powerLevel) ?? undefined,
      realm: toOptionalText(parsedCandidate.realm) ?? undefined,
      currentLocation: toOptionalText(parsedCandidate.currentLocation) ?? undefined,
      availability: toOptionalText(parsedCandidate.availability) ?? undefined,
      prohibitions: parsedCandidate.prohibitions,
      outerGoal: toOptionalText(parsedCandidate.outerGoal) ?? undefined,
      innerNeed: toOptionalText(parsedCandidate.innerNeed) ?? undefined,
      fear: toOptionalText(parsedCandidate.fear) ?? undefined,
      wound: toOptionalText(parsedCandidate.wound) ?? undefined,
      misbelief: toOptionalText(parsedCandidate.misbelief) ?? undefined,
      secret: toOptionalText(parsedCandidate.secret) ?? undefined,
      moralLine: toOptionalText(parsedCandidate.moralLine) ?? undefined,
      firstImpression: toOptionalText(parsedCandidate.firstImpression) ?? undefined,
      currentState: toOptionalText(parsedCandidate.currentState) ?? undefined,
      currentGoal: toOptionalText(parsedCandidate.currentGoal) ?? undefined,
    });

    const characterIdByName = new Map(existingCharacters.map((character) => [character.name, character.id]));
    characterIdByName.set(created.name, created.id);

    const seenRelationKeys = new Set<string>();
    let relationCount = 0;
    for (const relation of parsedCandidate.relations) {
      const sourceCharacterId = characterIdByName.get(relation.sourceName);
      const targetCharacterId = characterIdByName.get(relation.targetName);
      if (!sourceCharacterId || !targetCharacterId || sourceCharacterId === targetCharacterId) {
        continue;
      }
      const relationKey = `${sourceCharacterId}:${targetCharacterId}`;
      if (seenRelationKeys.has(relationKey)) {
        continue;
      }
      seenRelationKeys.add(relationKey);
      await prisma.characterRelation.upsert({
        where: {
          novelId_sourceCharacterId_targetCharacterId: {
            novelId,
            sourceCharacterId,
            targetCharacterId,
          },
        },
        create: {
          novelId,
          sourceCharacterId,
          targetCharacterId,
          surfaceRelation: relation.surfaceRelation,
          hiddenTension: toOptionalText(relation.hiddenTension),
          conflictSource: toOptionalText(relation.conflictSource),
          dynamicLabel: toOptionalText(relation.dynamicLabel),
          nextTurnPoint: toOptionalText(relation.nextTurnPoint),
        },
        update: {
          surfaceRelation: relation.surfaceRelation,
          hiddenTension: toOptionalText(relation.hiddenTension),
          conflictSource: toOptionalText(relation.conflictSource),
          dynamicLabel: toOptionalText(relation.dynamicLabel),
          nextTurnPoint: toOptionalText(relation.nextTurnPoint),
        },
      });
      relationCount += 1;
    }

    await this.characterDynamicsService.rebuildDynamics(novelId, {
      sourceType: "supplemental_character_projection",
    }).catch(() => null);

    void characterMindService.bootstrapMindStates(novelId, [created.id]).catch((error) => {
      console.warn("[personaje suplementario] No se pudo completar la línea de pensamiento del personaje", {
        novelId,
        characterId: created.id,
        error,
      });
    });

    return {
      character: serializeCharacter(created),
      relationCount,
    };
  }
}
