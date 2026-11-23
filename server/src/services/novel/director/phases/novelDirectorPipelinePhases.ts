import { DirectorTaskStateWriter } from "../state";
import { splitDirectorTaskState } from "../state/DirectorStateReader";
import type { VolumePlanDocument } from "@ai-novel/shared/types/novel";
import type { DirectorConfirmRequest } from "@ai-novel/shared/types/novelDirector";
import { buildCharacterCastBlockedMessage } from "../../characterPrep/characterCastQuality";
import type { VolumeGenerationPhaseEvent } from "../../volume/volumeModels";
import { buildNovelEditResumeTarget } from "../../workflow/novelWorkflow.shared";
import {
  buildDirectorSessionState,
  buildStoryInput,
  normalizeDirectorRunMode,
  toBookSpec,
} from "../runtime/novelDirectorHelpers";
import {
  DIRECTOR_PROGRESS,
  type DirectorProgressItemKey,
} from "../projections/novelDirectorProgress";
import {
  normalizeDirectorAutoApprovalConfig,
  shouldAutoApproveDirectorCheckpoint,
} from "@ai-novel/shared/types/autoDirectorApproval";
import { recordAutoDirectorAutoApproval } from "../../../task/autoDirectorFollowUps/autoDirectorAutoApprovalAudit";
import { runDirectorTrackedStep } from "../projections/directorProgressTracker";
import type { DirectorPhaseCallbacks, DirectorPhaseDependencies } from "./novelDirectorPhaseTypes";
export { runDirectorStructuredOutlinePhase } from "./novelDirectorStructuredOutlinePhase";

export type DirectorCharacterSetupPhaseResult =
  | {
      status: "already_applied";
      optionId: string;
      title: string;
    }
  | {
      status: "waiting_review";
      optionId: string;
      title: string;
      checkpointType: "character_setup_required";
      reason: string;
    }
  | {
      status: "applied";
      optionId: string;
      title: string;
    }
  | {
      status: "applied_waiting_review";
      optionId: string;
      title: string;
      checkpointType: "character_setup_required";
      reason: string;
    };

function buildVolumeStrategyPhaseUpdate(event: VolumeGenerationPhaseEvent): {
  itemKey: DirectorProgressItemKey;
  itemLabel: string;
  progress: number;
} | null {
  if (event.scope === "strategy") {
    return {
      itemKey: "volume_strategy",
      itemLabel: event.phase === "load_context" ? "Contexto de la estrategia de volumen de recopilación" : "Estrategia de generación de volumen",
      progress: DIRECTOR_PROGRESS.volumeStrategy,
    };
  }
  if (event.scope === "strategy_critique") {
    return {
      itemKey: "volume_strategy",
      itemLabel: event.phase === "load_context" ? "Contexto de revisión de la estrategia de volumen de recopilación" : "Estrategia de volumen bajo revisión",
      progress: DIRECTOR_PROGRESS.volumeStrategyCritique,
    };
  }
  if (event.scope === "skeleton") {
    return {
      itemKey: "volume_skeleton",
      itemLabel: event.phase === "load_context" ? "Organizar el contexto del esqueleto de volumen" : "Generando esqueleto de volumen",
      progress: DIRECTOR_PROGRESS.volumeSkeleton,
    };
  }
  return null;
}

export async function runDirectorCharacterSetupPhase(input: {
  taskId: string;
  novelId: string;
  request: DirectorConfirmRequest;
  dependencies: DirectorPhaseDependencies;
  callbacks: DirectorPhaseCallbacks;
}): Promise<DirectorCharacterSetupPhaseResult> {
  const { taskId, novelId, request, dependencies, callbacks } = input;
  const directorSession = buildDirectorSessionState({
    runMode: request.runMode,
    phase: "character_setup",
    isBackgroundRunning: true,
  });
  const resumeTarget = buildNovelEditResumeTarget({
    novelId,
    taskId,
    stage: "character",
  });
  await new DirectorTaskStateWriter(dependencies.workflowService).initializeTask({
    workflowTaskId: taskId,
    novelId,
    lane: "auto_director",
    title: request.candidate.workingTitle,
    directorState: callbacks.buildDirectorSeedPayload(request, novelId, {
      directorSession,
      resumeTarget,
    }),
  });
  const storyInput = buildStoryInput(request, toBookSpec(request.candidate, request.idea, request.estimatedChapterCount));
  const reusableOption = await dependencies.characterPreparationService.findReusableCharacterCastOption?.(novelId) ?? null;
  const targetOption = reusableOption ?? await runDirectorTrackedStep({
    taskId,
    stage: "character_setup",
    itemKey: "character_setup",
    itemLabel: "Generando elenco de personajes.",
    progress: DIRECTOR_PROGRESS.characterSetup,
    callbacks,
    run: async () => dependencies.characterPreparationService.generateAutoCharacterCastOption(novelId, {
      provider: request.provider,
      model: request.model,
      temperature: request.temperature,
      storyInput,
      novelId,
      taskId,
      stage: "character_setup",
      itemKey: "character_setup",
      entrypoint: "auto_director",
    }),
  });
  if (reusableOption) {
    await callbacks.markDirectorTaskRunning(
      taskId,
      "character_setup",
      "character_cast_apply",
      targetOption.status === "applied"
        ? `Reutiliza el elenco de personajes que se pueden usar directamente "${targetOption.title}»`
        : `Reutilizar la alineación de personajes candidatos "${targetOption.title}»`,
      DIRECTOR_PROGRESS.characterSetupReady,
    );
  }
  if (targetOption.status === "applied") {
    return {
      status: "already_applied",
      optionId: targetOption.id,
      title: targetOption.title,
    };
  }
  const assessment = dependencies.characterPreparationService.assessCharacterCastOptions([targetOption], storyInput);
  if (assessment.autoApplicableOptionId !== targetOption.id) {
    const blockedSession = buildDirectorSessionState({
      runMode: request.runMode,
      phase: "character_setup",
      isBackgroundRunning: false,
    });
    const reason = [
      "Se han generado los candidatos a la alineación de personajes, pero el control de calidad automático actual no ha pasado y no se puede aplicar automáticamente de forma directa.",
      buildCharacterCastBlockedMessage(assessment),
    ].join("\n");
    const directorTaskData = callbacks.buildDirectorSeedPayload(request, novelId, {
      directorSession: blockedSession,
      resumeTarget,
    });
    const stateWriter = new DirectorTaskStateWriter(dependencies.workflowService);
    await stateWriter.updateDirectorRunStateFromTaskData(taskId, directorTaskData);
    await stateWriter.persistCheckpoint(taskId, {
      stage: "character_setup",
      checkpointType: "character_setup_required",
      checkpointSummary: reason,
      itemLabel: "Esperando la preparación del rol de revisión",
      progress: DIRECTOR_PROGRESS.characterSetup,
    });
    return {
      status: "waiting_review",
      optionId: targetOption.id,
      title: targetOption.title,
      checkpointType: "character_setup_required",
      reason,
    };
  }
  await runDirectorTrackedStep({
    taskId,
    stage: "character_setup",
    itemKey: "character_cast_apply",
    itemLabel: `Aplicando alineación de personajes"${targetOption.title}»`,
    progress: DIRECTOR_PROGRESS.characterSetupReady,
    callbacks,
    run: async () => {
      await dependencies.characterPreparationService.applyCharacterCastOption(novelId, targetOption.id, {
        postApplyMode: request.startupPreparation?.backgroundEnrichment === "after_first_draft"
          ? "deferred"
          : "sync",
        visibleProfileGeneration: {
          provider: request.provider,
          model: request.model,
          temperature: request.temperature,
        },
      });
    },
  });

  if (normalizeDirectorRunMode(request.runMode) !== "stage_review") {
    return {
      status: "applied",
      optionId: targetOption.id,
      title: targetOption.title,
    };
  }
  if (shouldAutoApproveDirectorCheckpoint(
    normalizeDirectorAutoApprovalConfig(request.autoApproval),
    "character_setup_required",
  )) {
    await recordAutoDirectorAutoApproval({
      taskId,
      novelId,
      novelTitle: request.candidate.workingTitle,
      checkpointType: "character_setup_required",
      checkpointSummary: `Se ha generado y aplicado la preparación del personaje”${targetOption.title}».`,
      stage: "character_setup",
    });
    return {
      status: "applied",
      optionId: targetOption.id,
      title: targetOption.title,
    };
  }

  const pausedSession = buildDirectorSessionState({
    runMode: request.runMode,
    phase: "character_setup",
    isBackgroundRunning: false,
  });
  const reason = `Se ha generado y aplicado la preparación del personaje”${targetOption.title}". Se recomienda verificar los personajes principales, las relaciones y los objetivos actuales antes de continuar con la dirección automática.`;
  const stateWriter = new DirectorTaskStateWriter(dependencies.workflowService);
  const nextState = splitDirectorTaskState(callbacks.buildDirectorSeedPayload(request, novelId, {
    directorSession: pausedSession,
    resumeTarget,
  }));
  await stateWriter.updateDirectorRunState(taskId, {
    directorSession: nextState.run.directorSession,
  });
  await stateWriter.persistCheckpoint(taskId, {
    stage: "character_setup",
    checkpointType: "character_setup_required",
    checkpointSummary: reason,
    itemLabel: "Esperando la preparación del rol de revisión",
    progress: DIRECTOR_PROGRESS.characterSetupReady,
  });
  return {
    status: "applied_waiting_review",
    optionId: targetOption.id,
    title: targetOption.title,
    checkpointType: "character_setup_required",
    reason,
  };
}

export async function runDirectorVolumeStrategyPhase(input: {
  taskId: string;
  novelId: string;
  request: DirectorConfirmRequest;
  dependencies: DirectorPhaseDependencies;
  callbacks: DirectorPhaseCallbacks;
}): Promise<VolumePlanDocument | null> {
  const { taskId, novelId, request, dependencies, callbacks } = input;
  const directorSession = buildDirectorSessionState({
    runMode: request.runMode,
    phase: "volume_strategy",
    isBackgroundRunning: true,
  });
  const resumeTarget = buildNovelEditResumeTarget({
    novelId,
    taskId,
    stage: "outline",
  });
  await new DirectorTaskStateWriter(dependencies.workflowService).initializeTask({
    workflowTaskId: taskId,
    novelId,
    lane: "auto_director",
    title: request.candidate.workingTitle,
    directorState: callbacks.buildDirectorSeedPayload(request, novelId, {
      directorSession,
      resumeTarget,
    }),
  });
  let workspace = await runDirectorTrackedStep({
    taskId,
    stage: "volume_strategy",
    itemKey: "volume_strategy",
    itemLabel: "Estrategia de generación de volumen",
    progress: DIRECTOR_PROGRESS.volumeStrategy,
    callbacks,
    run: async ({ updateStatus, signal }) => dependencies.volumeService.generateVolumes(novelId, {
      provider: request.provider,
      model: request.model,
      temperature: request.temperature,
      scope: "strategy",
      respectExistingVolumeCount: false,
      taskId,
      entrypoint: "auto_director",
      estimatedChapterCount: request.estimatedChapterCount ?? toBookSpec(request.candidate, request.idea, request.estimatedChapterCount).targetChapterCount,
      userPreferredVolumeCount: request.userPreferredVolumeCount,
      signal,
      onPhaseStart: async (event) => {
        const update = buildVolumeStrategyPhaseUpdate(event);
        if (!update) {
          return;
        }
        await updateStatus(update);
      },
    }),
  });
  workspace = await runDirectorTrackedStep({
    taskId,
    stage: "volume_strategy",
    itemKey: "volume_strategy",
    itemLabel: "Estrategia de volumen bajo revisión",
    progress: DIRECTOR_PROGRESS.volumeStrategyCritique,
    callbacks,
    run: async ({ updateStatus, signal }) => dependencies.volumeService.generateVolumes(novelId, {
      provider: request.provider,
      model: request.model,
      temperature: request.temperature,
      scope: "strategy_critique",
      taskId,
      entrypoint: "auto_director",
      estimatedChapterCount: request.estimatedChapterCount ?? toBookSpec(request.candidate, request.idea, request.estimatedChapterCount).targetChapterCount,
      userPreferredVolumeCount: request.userPreferredVolumeCount,
      draftWorkspace: workspace,
      signal,
      onPhaseStart: async (event) => {
        const update = buildVolumeStrategyPhaseUpdate(event);
        if (!update) {
          return;
        }
        await updateStatus(update);
      },
    }),
  });
  workspace = await runDirectorTrackedStep({
    taskId,
    stage: "volume_strategy",
    itemKey: "volume_skeleton",
    itemLabel: "Generando esqueleto de volumen",
    progress: DIRECTOR_PROGRESS.volumeSkeleton,
    callbacks,
    run: async ({ updateStatus, signal }) => dependencies.volumeService.generateVolumes(novelId, {
      provider: request.provider,
      model: request.model,
      temperature: request.temperature,
      scope: "skeleton",
      taskId,
      entrypoint: "auto_director",
      estimatedChapterCount: request.estimatedChapterCount ?? toBookSpec(request.candidate, request.idea, request.estimatedChapterCount).targetChapterCount,
      userPreferredVolumeCount: request.userPreferredVolumeCount,
      draftWorkspace: workspace,
      signal,
      onPhaseStart: async (event) => {
        const update = buildVolumeStrategyPhaseUpdate(event);
        if (!update) {
          return;
        }
        await updateStatus(update);
      },
    }),
  });
  const persistedStrategyWorkspace = await dependencies.volumeService.updateVolumes(novelId, workspace);

  if (normalizeDirectorRunMode(request.runMode) !== "stage_review") {
    return persistedStrategyWorkspace;
  }
  if (shouldAutoApproveDirectorCheckpoint(
    normalizeDirectorAutoApprovalConfig(request.autoApproval),
    "volume_strategy_ready",
  )) {
    await recordAutoDirectorAutoApproval({
      taskId,
      novelId,
      novelTitle: request.candidate.workingTitle,
      checkpointType: "volume_strategy_ready",
      checkpointSummary: `Se han generado la estrategia de volumen y el esqueleto de volumen, un total de ${persistedStrategyWorkspace.volumes.length} rollo.`,
      stage: "volume_strategy",
    });
    return persistedStrategyWorkspace;
  }

  const pausedSession = buildDirectorSessionState({
    runMode: request.runMode,
    phase: "volume_strategy",
    isBackgroundRunning: false,
  });
  const directorTaskData = callbacks.buildDirectorSeedPayload(request, novelId, {
    directorSession: pausedSession,
    resumeTarget,
  });
  const stateWriter = new DirectorTaskStateWriter(dependencies.workflowService);
  await stateWriter.updateDirectorRunStateFromTaskData(taskId, directorTaskData);
  await stateWriter.persistCheckpoint(taskId, {
    stage: "volume_strategy",
    checkpointType: "volume_strategy_ready",
    checkpointSummary: `Se han generado la estrategia de volumen y el esqueleto de volumen, un total de ${persistedStrategyWorkspace.volumes.length} rollo. Después de confirmar que es correcto, continúa con el ritmo y capítulos del Volumen 1.`,
    itemLabel: "En espera de revisión Estrategia de volumen/Esqueleto de volumen",
    progress: DIRECTOR_PROGRESS.volumeStrategyReady,
  });
  return null;
}
