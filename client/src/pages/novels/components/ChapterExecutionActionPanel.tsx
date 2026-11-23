import type { SSEFrame } from "@ai-novel/shared/types/api";
import type { ChapterRuntimePackage } from "@ai-novel/shared/types/chapterRuntime";
import type { AuditReport, Chapter, StoryStateSnapshot } from "@ai-novel/shared/types/novel";
import { Link } from "react-router-dom";
import AiButton from "@/components/common/AiButton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import ChapterExecutionStatusFlow from "./ChapterExecutionStatusFlow";
import {
  chapterHasPreparationAssets,
  chapterStatusLabel,
  chapterSuggestedActionLabel,
  PrimaryActionButton,
  type PrimaryAction,
  type ChapterExecutionBackgroundActivity,
  resolveDisplayedChapterStatus,
  resolveChapterExecutionFlow,
} from "./chapterExecution.shared";
import SelectControl from "@/components/common/SelectControl";

interface ChapterExecutionActionPanelProps {
  novelId: string;
  selectedChapter: Chapter | undefined;
  hasCharacters: boolean;
  strategy: {
    runMode: "fast" | "polish";
    wordSize: "short" | "medium" | "long";
    conflictLevel: number;
    pace: "slow" | "balanced" | "fast";
    aiFreedom: "low" | "medium" | "high";
  };
  onStrategyChange: (
    field: "runMode" | "wordSize" | "conflictLevel" | "pace" | "aiFreedom",
    value: string | number,
  ) => void;
  onApplyStrategy: () => void;
  isApplyingStrategy: boolean;
  onGenerateSelectedChapter: () => void;
  onRewriteChapter: () => void;
  onExpandChapter: () => void;
  onCompressChapter: () => void;
  onSummarizeChapter: () => void;
  onGenerateTaskSheet: () => void;
  onGenerateSceneCards: () => void;
  onGenerateChapterPlan: () => void;
  onReplanChapter: () => void;
  onRunFullAudit: () => void;
  onCheckContinuity: () => void;
  onCheckCharacterConsistency: () => void;
  onCheckPacing: () => void;
  onAutoRepair: () => void;
  onStrengthenConflict: () => void;
  onEnhanceEmotion: () => void;
  onUnifyStyle: () => void;
  onAddDialogue: () => void;
  onAddDescription: () => void;
  isGeneratingTaskSheet: boolean;
  isGeneratingSceneCards: boolean;
  isSummarizingChapter: boolean;
  reviewActionKind?: "full_audit" | "continuity" | "character_consistency" | "pacing" | null;
  repairActionKind?: "autoRepair" | "expand" | "compress" | "strengthenConflict" | "enhanceEmotion" | "unifyStyle" | "addDialogue" | "addDescription" | null;
  generationActionKind?: "rewrite" | null;
  isReviewingChapter: boolean;
  isRepairingChapter: boolean;
  isGeneratingChapterPlan: boolean;
  isReplanningChapter: boolean;
  isRunningFullAudit: boolean;
  isStreaming: boolean;
  streamingChapterId?: string | null;
  repairStreamingChapterId?: string | null;
  chapterAuditReports: AuditReport[];
  chapterRuntimePackage?: ChapterRuntimePackage | null;
  latestStateSnapshot?: StoryStateSnapshot | null;
  chapterStateSnapshot?: StoryStateSnapshot | null;
  backgroundSyncActivities?: ChapterExecutionBackgroundActivity[];
  chapterRunStatus?: Extract<SSEFrame, { type: "run_status" }> | null;
  repairRunStatus?: Extract<SSEFrame, { type: "run_status" }> | null;
  manualDirectorHandoff?: {
    enabled: boolean;
    isAccepting: boolean;
    onAccept: () => void;
  };
}

function resolvePrimaryAction(params: {
  novelId: string;
  selectedChapter?: Chapter;
  hasCharacters: boolean;
  isGeneratingChapterPlan: boolean;
  isRunningFullAudit: boolean;
  isSelectedChapterStreaming: boolean;
  isSelectedChapterRepairing: boolean;
  onGenerateChapterPlan: () => void;
  onRunFullAudit: () => void;
  onAutoRepair: () => void;
  onGenerateSelectedChapter: () => void;
}): PrimaryAction {
  const {
    novelId,
    selectedChapter,
    hasCharacters,
    isGeneratingChapterPlan,
    isRunningFullAudit,
    isSelectedChapterStreaming,
    isSelectedChapterRepairing,
    onGenerateChapterPlan,
    onRunFullAudit,
    onAutoRepair,
    onGenerateSelectedChapter,
  } = params;

  if (!selectedChapter) {
    return {
      label: "Por favor seleccione un capítulo primero",
      reason: "Primero seleccione el capítulo que desea avanzar desde el lado izquierdo y luego el sistema sabrá qué hacer a continuación.",
      variant: "default",
      disabled: true,
    };
  }

  if (selectedChapter.chapterStatus === "needs_repair") {
    return {
      label: "Abrir editor de capítulos",
      reason: "Este capítulo ya tiene texto. Incluso si se encuentra un problema en la revisión, no debería bloquear la continuación de la edición; Puede ingresar al editor primero o solucionarlo con un clic a continuación.",
      variant: "default",
      href: `/novels/${novelId}/chapters/${selectedChapter.id}`,
    };
  }

  if (
    (selectedChapter.chapterStatus === "pending_review"
      && selectedChapter.generationState !== "reviewed"
      && selectedChapter.generationState !== "approved")
    || selectedChapter.generationState === "drafted"
  ) {
    return {
      label: isRunningFullAudit ? "Ejecutando revisión completa..." : "Ejecute una revisión completa",
      reason: "El texto principal ha sido publicado. Lo revisaré por completo antes de decidir si repararlo o continuar reescribiéndolo.",
      variant: "default",
      ai: true,
      onClick: onRunFullAudit,
      disabled: isRunningFullAudit,
    };
  }

  if (selectedChapter.chapterStatus === "unplanned" || !chapterHasPreparationAssets(selectedChapter)) {
    return {
      label: isGeneratingChapterPlan ? "Generando plan de ejecución..." : "Generar plan de ejecución primero",
      reason: "Este capítulo todavía carece de objetivos claros y listas de tareas. Es más fácil escribir primero el plan de ejecución.",
      variant: "default",
      ai: true,
      onClick: onGenerateChapterPlan,
      disabled: isGeneratingChapterPlan,
    };
  }

  if (!selectedChapter.content?.trim() || selectedChapter.chapterStatus === "pending_generation") {
    return {
      label: isSelectedChapterStreaming ? "Escribiendo este capítulo..." : "Escribe este capitulo",
      reason: "Basta con preparar la información. Lo más que vale la pena hacer ahora es generar directamente el texto de este capítulo.",
      variant: "default",
      ai: true,
      onClick: onGenerateSelectedChapter,
      disabled: !hasCharacters || isSelectedChapterStreaming,
    };
  }

  return {
    label: "Abrir editor de capítulos",
    reason: "Este capítulo ya tiene texto. Sería más eficiente ingresar directamente al editor para manejar el refinamiento y la recuperación.",
    variant: "default",
    href: `/novels/${novelId}/chapters/${selectedChapter.id}`,
  };
}

export default function ChapterExecutionActionPanel(props: ChapterExecutionActionPanelProps) {
  const {
    novelId,
    selectedChapter,
    hasCharacters,
    strategy,
    onStrategyChange,
    onApplyStrategy,
    isApplyingStrategy,
    onGenerateSelectedChapter,
    onRewriteChapter,
    onExpandChapter,
    onCompressChapter,
    onSummarizeChapter,
    onGenerateTaskSheet,
    onGenerateSceneCards,
    onGenerateChapterPlan,
    onReplanChapter,
    onRunFullAudit,
    onCheckContinuity,
    onCheckCharacterConsistency,
    onCheckPacing,
    onAutoRepair,
    onStrengthenConflict,
    onEnhanceEmotion,
    onUnifyStyle,
    onAddDialogue,
    onAddDescription,
    isGeneratingTaskSheet,
    isGeneratingSceneCards,
    isSummarizingChapter,
    reviewActionKind,
    repairActionKind,
    generationActionKind,
    isReviewingChapter,
    isRepairingChapter,
    isGeneratingChapterPlan,
    isReplanningChapter,
    isRunningFullAudit,
    isStreaming,
    streamingChapterId,
    repairStreamingChapterId,
    chapterAuditReports,
    chapterRuntimePackage,
    latestStateSnapshot,
    chapterStateSnapshot,
    backgroundSyncActivities,
    chapterRunStatus,
    repairRunStatus,
    manualDirectorHandoff,
  } = props;

  const isSelectedChapterStreaming = Boolean(selectedChapter && isStreaming && streamingChapterId === selectedChapter.id);
  const isSelectedChapterRepairing = Boolean(selectedChapter && isRepairingChapter && repairStreamingChapterId === selectedChapter.id);
  const isExecutionContractPending = isGeneratingTaskSheet || isGeneratingSceneCards;
  const runtimePackage = chapterRuntimePackage?.chapterId === selectedChapter?.id ? chapterRuntimePackage : null;
  const displayedStatus = selectedChapter ? resolveDisplayedChapterStatus(selectedChapter) : undefined;

  const selectedChapterLabel = selectedChapter
    ? `Cap.${selectedChapter.order}capitulo ${selectedChapter.title || "Capítulo sin título"}`
    : "Por favor seleccione un capítulo";

  const primaryAction = resolvePrimaryAction({
    novelId,
    selectedChapter: selectedChapter
      ? {
        ...selectedChapter,
        chapterStatus: displayedStatus ?? selectedChapter.chapterStatus,
      }
      : undefined,
    hasCharacters,
    isGeneratingChapterPlan,
    isRunningFullAudit,
    isSelectedChapterStreaming,
    isSelectedChapterRepairing,
    onGenerateChapterPlan,
    onRunFullAudit,
    onAutoRepair,
    onGenerateSelectedChapter,
  });
  const executionFlow = resolveChapterExecutionFlow({
    selectedChapter,
    chapterAuditReports,
    chapterRuntimePackage: runtimePackage,
    chapterStateSnapshot,
    latestStateSnapshot,
    chapterRunStatus,
    repairRunStatus,
    isStreaming,
    streamingChapterId,
    isRepairStreaming: isRepairingChapter,
    repairStreamingChapterId,
    isRunningFullAudit,
    backgroundActivities: backgroundSyncActivities,
  });

  const showQuickEditorAction = Boolean(selectedChapter && primaryAction.label !== "Abrir editor de capítulos");
  const showQuickAuditAction = Boolean(selectedChapter && primaryAction.label !== "Ejecute una revisión completa" && primaryAction.label !== "Ejecutando revisión completa...");
  const showQuickRepairAction = Boolean(
    selectedChapter
      && (
        displayedStatus === "needs_repair"
        || (
          displayedStatus === "pending_review"
          && (selectedChapter.generationState === "reviewed" || selectedChapter.generationState === "approved")
          && chapterAuditReports.length > 0
        )
      )
      && primaryAction.label !== "Solucionar problemas automáticamente"
      && primaryAction.label !== "Reparando automáticamente...",
  );

  return (
    <Card className="self-start overflow-hidden border-border/70 lg:sticky lg:top-4">
      <CardHeader className="gap-3 border-b bg-gradient-to-b from-muted/30 to-background pb-4">
        <div className="space-y-1">
          <CardTitle className="text-base">Mesa de ejecución de IA</CardTitle>
          <p className="text-sm leading-6 text-muted-foreground">
            De forma predeterminada, solo se conserva el paso más recomendado actualmente. Otras acciones todavía están allí, pero se han retirado al área de plegado de abajo para evitar saturar los botones correctos.
          </p>
        </div>
        <div className="rounded-2xl border border-border/70 bg-background/90 p-3">
          <div className="text-xs text-muted-foreground">Objeto de operación actual</div>
          <div className="mt-1 text-sm font-semibold text-foreground">{selectedChapterLabel}</div>
          {selectedChapter ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              <Badge variant="secondary">{chapterStatusLabel(displayedStatus ?? selectedChapter.chapterStatus)}</Badge>
              <Badge variant="outline">{chapterSuggestedActionLabel(selectedChapter)}</Badge>
            </div>
          ) : null}
        </div>
        <ChapterExecutionStatusFlow
          stages={executionFlow.stages}
          currentStageKey={executionFlow.currentStage.key}
          currentStageNote={executionFlow.currentStage.note}
        />
      </CardHeader>

      <CardContent className="space-y-4 pt-4">
        {manualDirectorHandoff?.enabled ? (
          <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
            <div className="text-sm font-semibold text-foreground">Devolver las modificaciones de este capítulo al director automático.</div>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              El texto del capítulo actual ha sido modificado por usted. Después de la confirmación, el director considerará este texto como el resultado actual y continuará avanzando desde los pasos inconclusos.
            </p>
            <Button
              type="button"
              className="mt-3 w-full"
              onClick={manualDirectorHandoff.onAccept}
              disabled={manualDirectorHandoff.isAccepting}
            >
              {manualDirectorHandoff.isAccepting ? "Confirmando..." : "Confirme los cambios en este capítulo y continúe"}
            </Button>
          </div>
        ) : null}
        <div className="rounded-2xl border border-primary/15 bg-primary/5 p-4">
          <div className="text-xs text-muted-foreground">Las acciones más recomendadas en este momento</div>
          <div className="mt-2 text-sm leading-6 text-foreground">{primaryAction.reason}</div>
          <div className="mt-3">
            <PrimaryActionButton action={primaryAction} className="w-full" />
          </div>
          <div className="mt-3 grid gap-2">
            {showQuickEditorAction ? (
              <Button asChild variant="outline" className="w-full">
                <Link to={`/novels/${novelId}/chapters/${selectedChapter!.id}`}>Abrir editor de capítulos</Link>
              </Button>
            ) : null}
            {showQuickAuditAction ? (
              <AiButton className="w-full" variant="outline" onClick={onRunFullAudit} disabled={!selectedChapter || isReviewingChapter}>
                {isRunningFullAudit ? "Ejecutando revisión completa..." : "Ejecute una revisión completa"}
              </AiButton>
            ) : null}
            {showQuickRepairAction ? (
              <AiButton className="w-full" variant="secondary" onClick={onAutoRepair} disabled={!selectedChapter || isSelectedChapterRepairing}>
                {isSelectedChapterRepairing && repairActionKind === "autoRepair" ? "Reparando automáticamente..." : "Solucionar problemas automáticamente"}
              </AiButton>
            ) : null}
          </div>
          <div className="mt-3 text-xs leading-6 text-muted-foreground">
            Si no está seguro de qué pedir, dé prioridad a las acciones recomendadas aquí. A continuación se muestran capacidades complementarias más detalladas.
          </div>
        </div>

        <details className="rounded-2xl border border-border/70 p-4">
          <summary className="cursor-pointer list-none text-sm font-semibold text-foreground">
            Finalización de activos e inspección especial.
          </summary>
          <div className="mt-3 grid gap-2">
            <AiButton size="sm" variant="outline" onClick={onGenerateTaskSheet} disabled={!selectedChapter || isExecutionContractPending}>
              {isGeneratingTaskSheet ? "Generando orden de tareas..." : "Generar orden de tarea"}
            </AiButton>
            <AiButton size="sm" variant="outline" onClick={onGenerateSceneCards} disabled={!selectedChapter || isExecutionContractPending}>
              {isGeneratingSceneCards ? "Generando desmontaje de escena..." : "Generar desmontaje de escena."}
            </AiButton>
            <AiButton size="sm" variant="outline" onClick={onSummarizeChapter} disabled={!selectedChapter || isSummarizingChapter}>
              {isSummarizingChapter ? "Generando resumen..." : "Generar resumen"}
            </AiButton>
            <AiButton size="sm" variant="outline" onClick={onReplanChapter} disabled={!selectedChapter || isReplanningChapter}>
              {isReplanningChapter ? "Ajustando planes de seguimiento..." : "Ajustar el plan para capítulos posteriores."}
            </AiButton>
            <AiButton size="sm" variant="outline" onClick={onCheckContinuity} disabled={!selectedChapter || isReviewingChapter}>
              {isReviewingChapter && reviewActionKind === "continuity" ? "Comprobando continuidad..." : "Comprobar continuidad"}
            </AiButton>
            <AiButton size="sm" variant="outline" onClick={onCheckCharacterConsistency} disabled={!selectedChapter || isReviewingChapter}>
              {isReviewingChapter && reviewActionKind === "character_consistency" ? "Comprobando la coherencia del carácter..." : "Comprobar la coherencia del carácter"}
            </AiButton>
            <AiButton size="sm" variant="outline" onClick={onCheckPacing} disabled={!selectedChapter || isReviewingChapter}>
              {isReviewingChapter && reviewActionKind === "pacing" ? "Comprobando ritmo..." : "Comprobar ritmo"}
            </AiButton>
          </div>
        </details>

        <details className="rounded-2xl border border-border/70 p-4">
          <summary className="cursor-pointer list-none text-sm font-semibold text-foreground">
            Pulir y mejorar
          </summary>
          <div className="mt-3 grid gap-2">
            <AiButton size="sm" variant="outline" onClick={onRewriteChapter} disabled={!hasCharacters || !selectedChapter || isSelectedChapterStreaming}>
              {isSelectedChapterStreaming && generationActionKind === "rewrite" ? "Reescribiendo este capítulo..." : "Reescribe este capítulo"}
            </AiButton>
            <AiButton size="sm" variant="outline" onClick={onExpandChapter} disabled={!selectedChapter || isSelectedChapterRepairing}>
              {isSelectedChapterRepairing && repairActionKind === "expand" ? "Ampliando este capítulo..." : "Ampliar este capítulo"}
            </AiButton>
            <AiButton size="sm" variant="outline" onClick={onCompressChapter} disabled={!selectedChapter || isSelectedChapterRepairing}>
              {isSelectedChapterRepairing && repairActionKind === "compress" ? "Comprimiendo este capítulo..." : "Comprimir este capítulo"}
            </AiButton>
            <AiButton size="sm" variant="outline" onClick={onStrengthenConflict} disabled={!selectedChapter || isSelectedChapterRepairing}>
              {isSelectedChapterRepairing && repairActionKind === "strengthenConflict" ? "El conflicto se intensifica..." : "Intensificar el conflicto"}
            </AiButton>
            <AiButton size="sm" variant="outline" onClick={onEnhanceEmotion} disabled={!selectedChapter || isSelectedChapterRepairing}>
              {isSelectedChapterRepairing && repairActionKind === "enhanceEmotion" ? "Elevando el estado de ánimo..." : "Mejorar el estado de ánimo"}
            </AiButton>
            <AiButton size="sm" variant="outline" onClick={onUnifyStyle} disabled={!selectedChapter || isSelectedChapterRepairing}>
              {isSelectedChapterRepairing && repairActionKind === "unifyStyle" ? "Unificando el estilo de escritura..." : "Unifica el estilo de escritura"}
            </AiButton>
            <AiButton size="sm" variant="outline" onClick={onAddDialogue} disabled={!selectedChapter || isSelectedChapterRepairing}>
              {isSelectedChapterRepairing && repairActionKind === "addDialogue" ? "Agregando conversación..." : "Agregar diálogo"}
            </AiButton>
            <AiButton size="sm" variant="outline" onClick={onAddDescription} disabled={!selectedChapter || isSelectedChapterRepairing}>
              {isSelectedChapterRepairing && repairActionKind === "addDescription" ? "Añadiendo descripción..." : "Agregar descripción"}
            </AiButton>
          </div>
        </details>

        <details className="rounded-2xl border border-border/70 p-4">
          <summary className="cursor-pointer list-none text-sm font-semibold text-foreground">
            Estrategias de escritura avanzadas
          </summary>
          <div className="mt-2 text-xs leading-6 text-muted-foreground">
            En caso de duda, mantenga el valor predeterminado. Sólo haga ajustes manuales si está seguro de que este capítulo necesita un ritmo más rápido, más conflicto o más libertad.
          </div>
          <div className="mt-3 grid gap-3">
            <label htmlFor="chapter-strategy-run-mode" className="space-y-1 text-xs text-muted-foreground">
              <span>Modo de funcionamiento</span>
              <SelectControl
                id="chapter-strategy-run-mode"
                className="w-full rounded-xl border bg-background p-2 text-sm text-foreground"
                value={strategy.runMode}
                onChange={(event) => onStrategyChange("runMode", event.target.value)}
              >
                <option value="fast">Rapido</option>
                <option value="polish">Refinamiento</option>
              </SelectControl>
            </label>
            <label htmlFor="chapter-strategy-word-size" className="space-y-1 text-xs text-muted-foreground">
              <span>Espacio</span>
              <SelectControl
                id="chapter-strategy-word-size"
                className="w-full rounded-xl border bg-background p-2 text-sm text-foreground"
                value={strategy.wordSize}
                onChange={(event) => onStrategyChange("wordSize", event.target.value)}
              >
                <option value="short">Corto</option>
                <option value="medium">Medio</option>
                <option value="long">Largo</option>
              </SelectControl>
            </label>
            <label htmlFor="chapter-strategy-conflict" className="space-y-1 text-xs text-muted-foreground">
              <span>Intensidad del conflicto</span>
              <input
                id="chapter-strategy-conflict"
                className="w-full rounded-xl border bg-background p-2 text-sm text-foreground"
                type="number"
                min={0}
                max={100}
                value={strategy.conflictLevel}
                onChange={(event) => onStrategyChange("conflictLevel", Number(event.target.value || 0))}
              />
            </label>
            <label htmlFor="chapter-strategy-pace" className="space-y-1 text-xs text-muted-foreground">
              <span>Ritmo</span>
              <SelectControl
                id="chapter-strategy-pace"
                className="w-full rounded-xl border bg-background p-2 text-sm text-foreground"
                value={strategy.pace}
                onChange={(event) => onStrategyChange("pace", event.target.value)}
              >
                <option value="slow">Lento</option>
                <option value="balanced">Equilibrado</option>
                <option value="fast">Rápido</option>
              </SelectControl>
            </label>
            <label htmlFor="chapter-strategy-ai-freedom" className="space-y-1 text-xs text-muted-foreground">
              <span>Grados de libertad de la IA</span>
              <SelectControl
                id="chapter-strategy-ai-freedom"
                className="w-full rounded-xl border bg-background p-2 text-sm text-foreground"
                value={strategy.aiFreedom}
                onChange={(event) => onStrategyChange("aiFreedom", event.target.value)}
              >
                <option value="low">Bajo</option>
                <option value="medium">Medio</option>
                <option value="high">Alto</option>
              </SelectControl>
            </label>
            <Button className="w-full" size="sm" onClick={onApplyStrategy} disabled={isApplyingStrategy || !selectedChapter}>
              {isApplyingStrategy ? "Aplicando política..." : "Aplicar estrategia al capítulo actual"}
            </Button>
          </div>
        </details>
      </CardContent>
    </Card>
  );
}
