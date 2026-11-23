import { runStructuredPrompt } from "../../../prompting/core/promptRunner";
import { dramaOriginalSourcePrompt } from "../../../prompting/prompts/drama/drama.prompts";
import type { SourceContentPort } from "./SourceContentPort";
import type { SourceBundle, SourceRef } from "../contracts/sourceBundle";

export class OriginalSourceAdapter implements SourceContentPort {
  readonly sourceType = "original" as const;

  async loadBundle(ref: SourceRef): Promise<SourceBundle> {
    const inspiration = ref.inspiration?.trim() || ref.rawText?.trim();
    if (!inspiration) {
      throw new Error("La fuente del contenido original carece de inspiración o aportaciones sobre el tema.");
    }
    const result = await runStructuredPrompt({
      asset: dramaOriginalSourcePrompt,
      promptInput: {
        title: ref.ref || "Proyecto de drama corto original.",
        inspiration,
        targetEpisodes: 80,
      },
      options: { temperature: 0.7 },
    });
    return result.output;
  }
}

export const originalSourceAdapter = new OriginalSourceAdapter();
