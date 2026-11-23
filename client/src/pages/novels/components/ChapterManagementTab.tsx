import { WorkspaceColumns } from "@/components/layout/resizableWorkspace";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { buildReplanRecommendationFromAuditReports } from "../chapterPlanning.shared";
import type { ChapterTabViewProps } from "./NovelEditView.types";
import WorldInjectionHint from "./WorldInjectionHint";
import ChapterExecutionActionPanel from "./ChapterExecutionActionPanel";
import ChapterExecutionInsightsSidebar from "./chapterInsights";
import ChapterExecutionReferencePanel from "./chapterInsights/ChapterExecutionReferencePanel";
import ChapterExecutionQueueCard from "./ChapterExecutionQueueCard";
import ChapterExecutionResultPanel from "./ChapterExecutionResultPanel";
import {
  chapterMatchesQueueFilter,
  type AssetTabKey,
  type QueueFilterKey,
} from "./chapterExecution.shared";
import DirectorTakeoverEntryPanel from "./DirectorTakeoverEntryPanel";

export default function ChapterManagementTab(props: ChapterTabViewProps) {
  const {
    novelId,
    worldInjectionSummary,
    hasCharacters,
    chapters,
    selectedChapterId,
    selectedChapter,
    onSelectChapter,
    onGoToCharacterTab,
    onCreateChapter,
    isCreatingChapter,
    onRemoveChapter,
    removingChapterId,
    chapterOperationMessage,
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
    reviewResult,
    replanRecommendation,
    lastReplanResult,
    chapterPlan,
    latestStateSnapshot,
    chapterStateSnapshot,
    chapterTimeline,
    isLoadingChapterTimeline,
    chapterResourceContext,
    isLoadingChapterResourceContext,
    resourceWorkflowMode = "manual",
    pendingCharacterResourceProposals = [],
    onExtractChapterResources,
    isExtractingChapterResources = false,
    onConfirmCharacterResourceProposal,
    onRejectCharacterResourceProposal,
    confirmingCharacterResourceProposalId = "",
    rejectingCharacterResourceProposalId = "",
    chapterAuditReports,
    manualDirectorHandoff,
    backgroundSyncActivities,
    isGeneratingChapterPlan,
    isReplanningChapter,
    isRunningFullAudit,
    chapterQualityReport,
    chapterRuntimePackage,
    repairStreamContent,
    isRepairStreaming,
    repairStreamingChapterId,
    repairStreamingChapterLabel,
    repairRunStatus,
    onAbortRepair,
    streamContent,
    isStreaming,
    streamingChapterId,
    streamingChapterLabel,
    chapterRunStatus,
    onAbortStream,
    directorTakeoverEntry,
  } = props;

  const [assetTab, setAssetTab] = useState<AssetTabKey>("content");
  const [queueFilter, setQueueFilter] = useState<QueueFilterKey>("all");
  const [rightRailTab, setRightRailTab] = useState<"insights" | "reference" | "agent">("insights");

  const openAuditIssues = useMemo(
    () => chapterAuditReports.flatMap((report) => report.issues.filter((issue) => issue.status === "open").map((issue) => ({
      ...issue,
      auditType: report.auditType,
    }))),
    [chapterAuditReports],
  );
  const activeReplanRecommendation = useMemo(
    () => replanRecommendation ?? buildReplanRecommendationFromAuditReports(chapterAuditReports),
    [chapterAuditReports, replanRecommendation],
  );

  const filteredChapters = useMemo(
    () => chapters.filter((chapter) => chapterMatchesQueueFilter(chapter, queueFilter)),
    [chapters, queueFilter],
  );

  const queueFilters = useMemo(
    () => ([
      { key: "all", label: "Todo" },
      { key: "setup", label: "Estar preparado" },
      { key: "draft", label: "por escribir" },
      { key: "review", label: "para ser reparado" },
      { key: "completed", label: "Completado" },
    ] as const).map((item) => ({
      ...item,
      count: chapters.filter((chapter) => chapterMatchesQueueFilter(chapter, item.key)).length,
    })),
    [chapters],
  );

  return (
    <div className="space-y-4">
      <DirectorTakeoverEntryPanel
        title="Asumir el control de la ejecución del capítulo"
        description="La IA primero determinará si hay lotes, puntos de control o rangos de capítulos ejecutables actualmente activos y luego decidirá si restaurar el lote actual o abrir un nuevo lote según su elección."
        entry={directorTakeoverEntry}
      />
      <Card className="overflow-visible border-0 bg-transparent shadow-none">
      <CardHeader className="gap-3 rounded-2xl bg-muted/20 px-5 py-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
          <div className="space-y-1">
            <CardTitle>Ejecución del capítulo</CardTitle>
            <div className="text-sm leading-6 text-muted-foreground">
              Convierta este lugar en el verdadero banco de trabajo principal: el lado izquierdo es solo para cortar capítulos, el medio es el texto completo y el lado derecho está dedicado a las acciones y estrategias de la IA.
            </div>
          </div>
          <Button onClick={onCreateChapter} disabled={isCreatingChapter}>
            {isCreatingChapter ? "Creando..." : "Crear nuevo capítulo"}
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 px-0 pt-5">
        <WorldInjectionHint worldInjectionSummary={worldInjectionSummary} />

        {chapterOperationMessage ? (
          <div className="rounded-2xl bg-muted/20 px-4 py-3 text-xs leading-6 text-muted-foreground">
            {chapterOperationMessage}
          </div>
        ) : null}

        {!hasCharacters ? (
          <div className="flex flex-col gap-3 rounded-2xl bg-amber-50 p-4 text-sm text-amber-900 md:flex-row md:items-center md:justify-between">
            <span>Agregue al menos 1 carácter antes de generar el contenido del capítulo. Esto facilita que la IA identifique jugadores, cambios en las relaciones y la continuación de la trama.</span>
            <Button size="sm" variant="outline" onClick={onGoToCharacterTab}>Ir a gestión de roles</Button>
          </div>
        ) : null}

        <WorkspaceColumns layoutId="chapter-execution" className="flex flex-col gap-4 xl:h-[calc(100dvh-8rem)] xl:items-stretch xl:workspace-split"
          left={{ label: "Ajustar el ancho de la cola de capítulos", initial: "300px", min: 176 }}
          right={{ label: "Ajustar los datos del capítulo y el ancho de la tabla de ejecución", initial: "332px", min: 248 }}>
          <div className="h-full min-h-0">
            <ChapterExecutionQueueCard
              chapters={filteredChapters}
              selectedChapterId={selectedChapterId}
              queueFilter={queueFilter}
              queueFilters={queueFilters}
              streamingChapterId={streamingChapterId}
              streamingPhase={streamingChapterId ? (chapterRunStatus?.phase ?? "streaming") : null}
              repairStreamingChapterId={repairStreamingChapterId}
              onQueueFilterChange={setQueueFilter}
              onSelectChapter={onSelectChapter}
              onRemoveChapter={onRemoveChapter}
              removingChapterId={removingChapterId}
            />
          </div>

          <div className="min-h-0 min-w-0 h-full">
            <ChapterExecutionResultPanel
              selectedChapter={selectedChapter}
              onOpenReferencePanel={(tab) => {
                setAssetTab(tab);
                setRightRailTab("reference");
              }}
              chapterPlan={chapterPlan}
              streamContent={streamContent}
              isStreaming={isStreaming}
              streamingChapterId={streamingChapterId}
              streamingChapterLabel={streamingChapterLabel}
              chapterRunStatus={chapterRunStatus}
              onAbortStream={onAbortStream}
              onRunFullAudit={onRunFullAudit}
              isRunningFullAudit={isRunningFullAudit}
              onAutoRepair={onAutoRepair}
              isRepairStreaming={isRepairStreaming}
              repairStreamingChapterId={repairStreamingChapterId}
            />
          </div>

          <div className="h-full min-h-0 xl:sticky xl:top-4">
            <Tabs
              value={rightRailTab}
              onValueChange={(value) => {
                const nextTab = value as "insights" | "reference" | "agent";
                if (nextTab === "reference" && assetTab === "content") {
                  setAssetTab("taskSheet");
                }
                setRightRailTab(nextTab);
              }}
              className="flex h-full min-h-0 flex-col"
            >
              <TabsList className="grid h-auto w-full shrink-0 grid-cols-3 rounded-xl bg-muted/50 p-1.5">
                <TabsTrigger value="insights" className="rounded-lg px-3 py-2 text-sm">Barra dinámica</TabsTrigger>
                <TabsTrigger value="reference" className="rounded-lg px-3 py-2 text-sm">Diagnóstico de datos</TabsTrigger>
                <TabsTrigger value="agent" className="rounded-lg px-3 py-2 text-sm">Mesa de ejecución de IA</TabsTrigger>
              </TabsList>
              <TabsContent value="insights" className="mt-3 min-h-0 flex-1">
                <ChapterExecutionInsightsSidebar
                  selectedChapter={selectedChapter}
                  chapterTimeline={chapterTimeline}
                  isLoadingChapterTimeline={isLoadingChapterTimeline}
                  latestStateSnapshot={latestStateSnapshot}
                  chapterStateSnapshot={chapterStateSnapshot}
                  chapterRuntimePackage={chapterRuntimePackage}
                  chapterPlan={chapterPlan}
                  chapterQualityReport={chapterQualityReport}
                  reviewResult={reviewResult}
                  openAuditIssues={openAuditIssues}
                  chapterResourceContext={chapterResourceContext}
                  isLoadingChapterResourceContext={isLoadingChapterResourceContext}
                  resourceWorkflowMode={resourceWorkflowMode}
                  pendingCharacterResourceProposals={pendingCharacterResourceProposals}
                  onExtractChapterResources={onExtractChapterResources}
                  isExtractingChapterResources={isExtractingChapterResources}
                  onConfirmCharacterResourceProposal={onConfirmCharacterResourceProposal}
                  onRejectCharacterResourceProposal={onRejectCharacterResourceProposal}
                  confirmingCharacterResourceProposalId={confirmingCharacterResourceProposalId}
                  rejectingCharacterResourceProposalId={rejectingCharacterResourceProposalId}
                />
              </TabsContent>
              <TabsContent value="reference" className="mt-3 min-h-0 flex-1 overflow-y-auto pr-1">
                <ChapterExecutionReferencePanel
                  selectedChapter={selectedChapter}
                  assetTab={assetTab}
                  onAssetTabChange={setAssetTab}
                  chapterPlan={chapterPlan}
                  latestStateSnapshot={latestStateSnapshot}
                  chapterAuditReports={chapterAuditReports}
                  replanRecommendation={activeReplanRecommendation}
                  onReplanChapter={onReplanChapter}
                  isReplanningChapter={isReplanningChapter}
                  lastReplanResult={lastReplanResult}
                  chapterQualityReport={chapterQualityReport}
                  chapterRuntimePackage={chapterRuntimePackage}
                  reviewResult={reviewResult}
                  openAuditIssues={openAuditIssues}
                  repairStreamContent={repairStreamContent}
                  isRepairStreaming={isRepairStreaming}
                  repairStreamingChapterId={repairStreamingChapterId}
                  repairStreamingChapterLabel={repairStreamingChapterLabel}
                  repairRunStatus={repairRunStatus}
                  onAbortRepair={onAbortRepair}
                />
              </TabsContent>
              <TabsContent value="agent" className="mt-3 min-h-0 flex-1 overflow-y-auto pr-1">
                <ChapterExecutionActionPanel
                  novelId={novelId}
                  selectedChapter={selectedChapter}
                  hasCharacters={hasCharacters}
                  strategy={strategy}
                  onStrategyChange={onStrategyChange}
                  onApplyStrategy={onApplyStrategy}
                  isApplyingStrategy={isApplyingStrategy}
                  onGenerateSelectedChapter={onGenerateSelectedChapter}
                  onRewriteChapter={onRewriteChapter}
                  onExpandChapter={onExpandChapter}
                  onCompressChapter={onCompressChapter}
                  onSummarizeChapter={onSummarizeChapter}
                  onGenerateTaskSheet={onGenerateTaskSheet}
                  onGenerateSceneCards={onGenerateSceneCards}
                  onGenerateChapterPlan={onGenerateChapterPlan}
                  onReplanChapter={onReplanChapter}
                  onRunFullAudit={onRunFullAudit}
                  onCheckContinuity={onCheckContinuity}
                  onCheckCharacterConsistency={onCheckCharacterConsistency}
                  onCheckPacing={onCheckPacing}
                  onAutoRepair={onAutoRepair}
                  onStrengthenConflict={onStrengthenConflict}
                  onEnhanceEmotion={onEnhanceEmotion}
                  onUnifyStyle={onUnifyStyle}
                  onAddDialogue={onAddDialogue}
                  onAddDescription={onAddDescription}
                  isGeneratingTaskSheet={isGeneratingTaskSheet}
                  isGeneratingSceneCards={isGeneratingSceneCards}
                  isSummarizingChapter={isSummarizingChapter}
                  reviewActionKind={reviewActionKind}
                  repairActionKind={repairActionKind}
                  generationActionKind={generationActionKind}
                  isReviewingChapter={isReviewingChapter}
                  isRepairingChapter={isRepairingChapter}
                  isGeneratingChapterPlan={isGeneratingChapterPlan}
                  isReplanningChapter={isReplanningChapter}
                  isRunningFullAudit={isRunningFullAudit}
                  isStreaming={isStreaming}
                  streamingChapterId={streamingChapterId}
                  chapterAuditReports={chapterAuditReports}
                  manualDirectorHandoff={manualDirectorHandoff}
                  chapterRuntimePackage={chapterRuntimePackage}
                  latestStateSnapshot={latestStateSnapshot}
                  chapterStateSnapshot={chapterStateSnapshot}
                  backgroundSyncActivities={backgroundSyncActivities}
                  chapterRunStatus={chapterRunStatus}
                  repairRunStatus={repairRunStatus}
                  repairStreamingChapterId={repairStreamingChapterId}
                />
              </TabsContent>
            </Tabs>
          </div>
        </WorkspaceColumns>
      </CardContent>
      </Card>
    </div>
  );
}
