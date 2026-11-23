import { prisma } from "../../db/prisma";
import { runStructuredPrompt } from "../../prompting/core/promptRunner";
import { dramaRepairPrompt } from "../../prompting/prompts/drama/drama.prompts";
import { dramaContextAssembler } from "./DramaContextAssembler";
import { safeJsonParse } from "./utils/json";
import type { DramaLLMOptions } from "./DramaStrategyService";

export class DramaRepairService {
  async repairEpisode(projectId: string, episodeOrder: number, instruction?: string, options: DramaLLMOptions = {}) {
    const context = await dramaContextAssembler.buildEpisodeContext(projectId, episodeOrder);
    if (!context.episode.content?.trim()) {
      throw new Error(`Cap. ${episodeOrder} El script no se ha generado para el conjunto y no se puede reparar.`);
    }
    const quality = safeJsonParse<{ repairPlan?: { instruction?: string } }>(context.episode.qualityFlags, {});
    const repairInstruction = instruction?.trim()
      || quality.repairPlan?.instruction
      || "Corrija los ganchos, los puntos estancados, la duración, los hechos consistentes o los personajes consistentes en el guión y conserve los objetivos de la trama de este episodio.";
    const result = await runStructuredPrompt({
      asset: dramaRepairPrompt,
      promptInput: {
        content: context.episode.content,
        episodeJson: context.episodeJson,
        repairInstruction,
      },
      options: {
        provider: options.provider,
        model: options.model,
        temperature: options.temperature ?? 0.45,
      },
    });
    const output = result.output;
    await prisma.dramaEpisode.update({
      where: { id: context.episode.id },
      data: {
        content: output.content,
        durationSec: output.durationSec,
        status: "scripted",
        qualityFlags: null,
      },
    });
    return output;
  }
}

export const dramaRepairService = new DramaRepairService();
