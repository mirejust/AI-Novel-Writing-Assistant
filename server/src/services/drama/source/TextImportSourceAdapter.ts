import { runStructuredPrompt } from "../../../prompting/core/promptRunner";
import { dramaTextImportSourcePrompt } from "../../../prompting/prompts/drama/drama.prompts";
import type { SourceContentPort } from "./SourceContentPort";
import type { SourceBundle, SourceRef } from "../contracts/sourceBundle";

export class TextImportSourceAdapter implements SourceContentPort {
  readonly sourceType = "text_import" as const;

  async loadBundle(ref: SourceRef): Promise<SourceBundle> {
    const rawText = ref.rawText?.trim();
    if (!rawText) {
      throw new Error("A la fuente de contenido text_import le falta texto importado.");
    }
    const result = await runStructuredPrompt({
      asset: dramaTextImportSourcePrompt,
      promptInput: {
        title: ref.ref || "Proyecto de sketch de importación de texto",
        rawText,
        targetEpisodes: 80,
      },
      options: { temperature: 0.4 },
    });
    return { ...result.output, rawText };
  }
}

export const textImportSourceAdapter = new TextImportSourceAdapter();
