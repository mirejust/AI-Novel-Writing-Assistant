import { prisma } from "../../db/prisma";
import { runStructuredPrompt } from "../../prompting/core/promptRunner";
import {
  dramaQualityPrompt,
  type DramaQualityOutput,
} from "../../prompting/prompts/drama/drama.prompts";
import { dramaContextAssembler } from "./DramaContextAssembler";
import {
  describeDramaPaywallPlan,
  resolveDramaPaywallPlan,
} from "./engine/paywallPlanPolicy";
import {
  dramaComplianceService,
  mergeComplianceIntoQuality,
} from "./DramaComplianceService";
import { rhythmEngine } from "./engine/rhythmEngine";
import type { DramaLLMOptions } from "./DramaStrategyService";

interface EpisodeRhythmLite {
  order: number;
  title: string;
  cliffhanger?: string | null;
  emotionNet?: number | null;
  isPaywall?: boolean;
}

type DramaQualityFlag = DramaQualityOutput["flags"][number];

function buildEpisodeRhythmDigest(episodes: EpisodeRhythmLite[], focusOrder: number): string {
  return episodes
    .filter((episode) => episode.order >= focusOrder - 3 && episode.order <= focusOrder + 3)
    .map((episode) => [
      `Cap.${episode.order}colocar"${episode.title}»`,
      episode.isPaywall ? "pagar puntos de tarjeta" : "conjunto ordinario",
      `Patrimonio neto emocional:${episode.emotionNet ?? "Por determinar"}`,
      `final:${episode.cliffhanger ?? "Por determinar"}`,
    ].join(" | "))
    .join("\n") || "Actualmente no hay ritmos de episodios adyacentes.";
}

function addRepairInstruction(existing: DramaQualityOutput["repairPlan"], flags: DramaQualityFlag[]): DramaQualityOutput["repairPlan"] {
  if (existing) {
    return existing;
  }
  return {
    mode: "patch",
    instruction: flags.map((flag) => flag.suggestion).join(";"),
  };
}

export function applyPaywallQualityRules(
  output: DramaQualityOutput,
  input: {
    episode: EpisodeRhythmLite;
    episodes: EpisodeRhythmLite[];
    strategyJson?: string | null;
    targetEpisodes: number;
  },
): DramaQualityOutput {
  const plan = resolveDramaPaywallPlan(input.strategyJson, input.targetEpisodes);
  const flags: DramaQualityFlag[] = [];
  const isPaywallEpisode = input.episode.isPaywall
    || rhythmEngine.isPaywallEpisode(input.episode.order, input.targetEpisodes, plan);

  if (input.episode.order === plan.firstPaywallAt - 1) {
    const freeStageEpisodes = input.episodes.filter((episode) =>
      episode.order < plan.firstPaywallAt && typeof episode.emotionNet === "number"
    );
    const minEmotionNet = freeStageEpisodes.length
      ? Math.min(...freeStageEpisodes.map((episode) => episode.emotionNet as number))
      : null;
    if (minEmotionNet !== null && typeof input.episode.emotionNet === "number" && input.episode.emotionNet > minEmotionNet) {
      flags.push({
        severity: "high",
        code: "pre_paywall_buildup_not_lowest",
        evidence: `Cap. ${input.episode.order} El valor emocional neto del conjunto es ${input.episode.emotionNet}, no hay punto mínimo en el período previo al pago inicial ${minEmotionNet}.`,
        suggestion: `numero uno ${input.episode.order} El final del episodio se cambia a una presión más fuerte, un malentendido o una crisis, de modo que el tercer capítulo ${plan.firstPaywallAt} La acumulación de puntos de tarjetas pagas tiene mayor espacio de liberación.`,
      });
    }
  }

  if (isPaywallEpisode && output.score.paywall < plan.cliffhangerStrengthThreshold) {
    flags.push({
      severity: "high",
      code: "paywall_cliffhanger_below_plan",
      evidence: `Calificación de puntos de la tarjeta de pago ${output.score.paywall} por debajo del umbral del plan ${plan.cliffhangerStrengthThreshold}.`,
      suggestion: "Refuerce la revelación de identidad, la escalada de la crisis o la promesa de contraataque al final del episodio para brindarles a los usuarios una razón clara para seguir pagando para ver el siguiente episodio.",
    });
  }

  if (!flags.length) {
    return output;
  }

  const status = output.status === "blocked" ? "blocked" : "repairable";
  return {
    ...output,
    status,
    flags: output.flags.concat(flags),
    repairPlan: status === "repairable" ? addRepairInstruction(output.repairPlan, flags) : output.repairPlan,
  };
}

export class DramaQualityGate {
  async reviewEpisode(projectId: string, episodeOrder: number, options: DramaLLMOptions = {}) {
    const context = await dramaContextAssembler.buildEpisodeContext(projectId, episodeOrder);
    if (!context.episode.content?.trim()) {
      throw new Error(`Cap. ${episodeOrder} El script no se ha generado para el conjunto y no se puede ejecutar la puerta de calidad.`);
    }
    const paywallPlan = resolveDramaPaywallPlan(context.strategyJson, context.project.targetEpisodes);
    const result = await runStructuredPrompt({
      asset: dramaQualityPrompt,
      promptInput: {
        episodeJson: context.episodeJson,
        content: context.episode.content,
        factsDigest: context.factsDigest,
        charactersDigest: context.charactersDigest,
        strategyJson: context.strategyJson,
        paywallPlanDigest: describeDramaPaywallPlan(paywallPlan),
        episodeRhythmDigest: buildEpisodeRhythmDigest(context.project.episodes, episodeOrder),
      },
      options: {
        provider: options.provider,
        model: options.model,
        temperature: options.temperature ?? 0.2,
      },
    });
    const qualityOutput = applyPaywallQualityRules(result.output, {
      episode: context.episode,
      episodes: context.project.episodes,
      strategyJson: context.strategyJson,
      targetEpisodes: context.project.targetEpisodes,
    });
    const compliance = await dramaComplianceService.checkEpisodeContext(context, options);
    const output = mergeComplianceIntoQuality(qualityOutput, compliance);
    const status = output.status === "approved" ? "approved"
      : output.status === "repairable" || output.status === "blocked" ? "needs_repair"
        : "reviewed";
    await prisma.dramaEpisode.update({
      where: { id: context.episode.id },
      data: {
        status,
        qualityFlags: JSON.stringify(output),
      },
    });
    return output;
  }
}

export const dramaQualityGate = new DramaQualityGate();
