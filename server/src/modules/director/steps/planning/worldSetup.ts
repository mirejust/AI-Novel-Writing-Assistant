import type { StepContext, StepHandler } from "../../application";

export interface WorldSetupStepInput<Provider extends string = string> {
  storyInput: string;
  storyMacroContext: string;
  bookContractContext: string;
  provider?: Provider;
  model?: string;
  temperature?: number;
  openingOnly: boolean;
  worldMode?: "generate" | "reuse" | "skip";
}

export interface WorldSetupStepDependencies<Provider extends string> {
  worldService: {
    hasActiveWorld(novelId: string): Promise<boolean>;
    generateWorldFromNovelTheme(novelId: string, options: Omit<WorldSetupStepInput<Provider>, "storyInput"> & { saveToLibrary: false }): Promise<unknown>;
    getWorldContextBlock(novelId: string, options: Pick<WorldSetupStepInput<Provider>, "storyInput" | "provider" | "model" | "temperature"> & {purpose: "character"; forceRefresh: false}): Promise<{rawSlice: unknown} | null>;
  };
  inputProvider: (context: StepContext) => Promise<WorldSetupStepInput<Provider>>;
  contentHash: (content: unknown) => string;
}

export function createWorldSetupStepHandler<Provider extends string>(dependencies: WorldSetupStepDependencies<Provider>): StepHandler {
  return async context => {
    const input = await dependencies.inputProvider(context);
    if (!input.storyInput.trim() || !input.storyMacroContext.trim() || !input.bookContractContext.trim()) {
      throw new Error("La preparación mundial carece de ideas para historias, grandes planes para historias o convenciones de escritura a nivel de libro.");
    }
    const novelId = context.contract.novelId;
    if (input.worldMode === "skip") {
      return {artifact: {scope: context.contract.scope, status: "confirmed", protectedUserContent: true,
        contentRef: `world_skeleton:${novelId}:disabled`,
        contentHash: dependencies.contentHash({novelId, worldMode: "skip"})}};
    }
    const existing = await dependencies.worldService.hasActiveWorld(novelId);
    if (!existing && input.worldMode === "reuse") throw new Error("Este libro carece de un escenario mundial reutilizable.");
    if (!existing) {
      await dependencies.worldService.generateWorldFromNovelTheme(novelId, {
        saveToLibrary: false,
        provider: input.provider,
        model: input.model,
        temperature: input.temperature,
        storyMacroContext: input.storyMacroContext,
        bookContractContext: input.bookContractContext,
        openingOnly: input.openingOnly,
      });
    }
    const block = await dependencies.worldService.getWorldContextBlock(novelId, {
      purpose: "character",
      forceRefresh: false,
      storyInput: input.storyInput,
      provider: input.provider,
      model: input.model,
      temperature: input.temperature,
    });
    if (!block) throw new Error("El contexto mundial de este libro no se salva y la preparación mundial no se puede completar.");
    return {
      artifact: {
        scope: context.contract.scope,
        status: existing ? "confirmed" : "draft",
        // The gateway does not expose authorship. Never label an existing world as safe to overwrite.
        protectedUserContent: existing,
        contentRef: `world_skeleton:${novelId}`,
        contentHash: dependencies.contentHash(block.rawSlice),
      },
    };
  };
}
