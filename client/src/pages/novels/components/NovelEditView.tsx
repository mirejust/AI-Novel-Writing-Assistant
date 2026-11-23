import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, RotateCcw, Sparkles } from "lucide-react";
import { useIsMobileViewport } from "@/components/layout/mobile/useIsMobileViewport";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import KnowledgeBindingPanel from "@/components/knowledge/KnowledgeBindingPanel";
import AITakeoverContainer from "@/components/workflow/AITakeoverContainer";
import ChapterManagementTab from "./ChapterManagementTab";
import DirectorFactDebugDialog from "./DirectorFactDebugDialog";
import DirectorStepCalibrationDialog from "./DirectorStepCalibrationDialog";
import NovelCharacterPanel from "./NovelCharacterPanel";
import NovelTaskDrawer from "./NovelTaskDrawer";
import OutlineTab from "./OutlineTab";
import PipelineTab from "./PipelineTab";
import StoryMacroPlanTab from "./StoryMacroPlanTab";
import StructuredOutlineTab from "./StructuredOutlineTab";
import VersionHistoryTab from "./VersionHistoryTab";
import BasicInfoTab from "./BasicInfoTab";
import WorldSetupTab from "./WorldSetupTab";
import { devResetNovelChapters } from "@/api/novel";
import { toast } from "@/components/ui/toast";
import { queryKeys } from "@/api/queryKeys";
import MobileNovelEditView from "../mobile/MobileNovelEditView";
import type { NovelEditViewProps } from "./NovelEditView.types";
import {
  getNovelWorkspaceFlowStepIndex,
  getNovelWorkspaceTabLabel,
  NOVEL_WORKSPACE_FLOW_STEPS,
  normalizeNovelWorkspaceTab,
  tabFromDirectorDisplayStage,
} from "../novelWorkspaceNavigation";
import { StepHero } from "./workspaceShell";
import DirectorVersionControl from "@/components/directorVersion/DirectorVersionControl";

export default function NovelEditView(props: NovelEditViewProps) {
  const isMobileViewport = useIsMobileViewport();

  if (isMobileViewport) {
    return <MobileNovelEditView {...props} />;
  }

  return <DesktopNovelEditView {...props} />;
}

function DesktopNovelEditView(props: NovelEditViewProps) {
  const {
    id,
    activeTab,
    workflowCurrentTab,
    exportControls,
    basicTab,
    worldTab,
    storyMacroTab,
    outlineTab,
    structuredTab,
    chapterTab,
    pipelineTab,
    characterTab,
    takeover,
    taskDrawer,
    directorStepCalibration,
    activeStepTakeoverEntry,
    onSwitchToSimpleMode,
    isSwitchingToSimpleMode = false,
  } = props;

  const [isProjectToolsOpen, setIsProjectToolsOpen] = useState(false);
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);
  const queryClient = useQueryClient();

  const resetChaptersMutation = useMutation({
    mutationFn: () => devResetNovelChapters(id),
    onSuccess: async (result) => {
      toast.success(`Reiniciar ${result.resetCount} El texto del capítulo se puede regenerar.`);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.novels.detail(id) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.novels.chapters(id) }),
      ]);
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Error al restablecer el capítulo, inténtalo de nuevo.");
    },
  });

  const totalChapters = chapterTab.chapters.length;
  const generatedChapters = chapterTab.chapters.filter((item) => Boolean(item.content?.trim())).length;
  const pendingRepairs = pipelineTab.chapterReports.filter(
    (item) => item.overall < pipelineTab.pipelineForm.qualityThreshold,
  ).length;
  const currentModel = pipelineTab.pipelineJob?.payload
    ? (() => {
        try {
          const parsed = JSON.parse(pipelineTab.pipelineJob.payload) as { model?: string };
          return parsed.model ?? "default";
        } catch {
          return "default";
        }
      })()
    : "default";

  const pendingResourceProposalCount = taskDrawer?.resourceProposals?.length ?? 0;
  const taskAttentionLabel = (() => {
    if (pendingResourceProposalCount > 0) {
      return `${pendingResourceProposalCount} recursos`;
    }
    if (!taskDrawer?.task) {
      return null;
    }
    if (taskDrawer.task.pendingManualRecovery) {
      return "Para ser restaurado";
    }
    if (taskDrawer.task.status === "failed") {
      return "Incidencia";
    }
    if (taskDrawer.task.status === "waiting_approval") {
      return "Pendiente de revisión";
    }
    if (taskDrawer.task.status === "running" || taskDrawer.task.status === "queued") {
      return "En curso";
    }
    return "Tareas recientes";
  })();

  const normalizedActiveTab = normalizeNovelWorkspaceTab(activeTab);
  const normalizedWorkflowTab = normalizeNovelWorkspaceTab(workflowCurrentTab ?? activeTab);
  const guidedFlowTab = normalizedActiveTab === "history"
    ? normalizedWorkflowTab === "history"
      ? "basic"
      : normalizedWorkflowTab
    : normalizedActiveTab;
  const novelTitle = basicTab.basicForm.title.trim() || "\u672a\u547d\u540d\u5c0f\u8bf4";
  const directorDisplayState = taskDrawer?.snapshot?.displayState ?? null;
  const currentPageLabel = getNovelWorkspaceTabLabel(normalizedActiveTab);
  const currentStepLabel = directorDisplayState?.stageLabel ?? currentPageLabel;
  const recommendedWorkflowTab = directorDisplayState
    ? tabFromDirectorDisplayStage(directorDisplayState.stageKey)
    : normalizedWorkflowTab;
  const workflowStepLabel = recommendedWorkflowTab
    ? getNovelWorkspaceTabLabel(recommendedWorkflowTab)
    : null;
  const stepIndex = directorDisplayState?.stepIndex ?? getNovelWorkspaceFlowStepIndex(guidedFlowTab);
  const progressLabel = stepIndex >= 0
    ? `\u7b2c ${stepIndex + 1} \u6b65 / \u5171 ${directorDisplayState?.totalSteps ?? NOVEL_WORKSPACE_FLOW_STEPS.length} \u6b65`
    : null;
  const showWorkflowRecommendation = Boolean(
    recommendedWorkflowTab
    && recommendedWorkflowTab !== normalizedActiveTab,
  );
  const isTakeoverLoading = takeover?.mode === "loading";
  const hideTakeoverEntry = takeover?.mode === "running" || takeover?.mode === "waiting";
  const workspaceTone = taskDrawer?.task?.status === "failed"
    ? "danger"
    : taskDrawer?.task?.status === "waiting_approval"
      ? "warning"
      : taskDrawer?.task?.status === "running" || taskDrawer?.task?.status === "queued"
        ? "info"
        : "neutral";

  const renderActivePanel = () => {
    switch (activeTab) {
      case "basic":
        return <BasicInfoTab {...basicTab} />;
      case "world":
        return <WorldSetupTab {...worldTab} />;
      case "outline":
        return <OutlineTab {...outlineTab} />;
      case "story_macro":
        return <StoryMacroPlanTab {...storyMacroTab} />;
      case "structured":
        return <StructuredOutlineTab {...structuredTab} />;
      case "chapter":
        return <ChapterManagementTab {...chapterTab} />;
      case "pipeline":
        return <PipelineTab {...pipelineTab} />;
      case "character":
        return <NovelCharacterPanel {...characterTab} />;
      case "history":
        return <VersionHistoryTab novelId={id} />;
      default:
        return <BasicInfoTab {...basicTab} />;
    }
  };

  return (
    <div className="space-y-5 lg:space-y-6">
      {id ? (
        <StepHero
          tone={workspaceTone}
          eyebrow={(
            <>
              <span className="truncate font-semibold text-foreground">{novelTitle}</span>
              <DirectorVersionControl novelId={id} version="v1"/>
              {progressLabel ? <span>{progressLabel}</span> : null}
              <span>Página actual:{currentPageLabel}</span>
            </>
          )}
          title={currentStepLabel}
          description={showWorkflowRecommendation && workflowStepLabel
            ? `Recomendación de proceso: se recomienda cambiar a "${workflowStepLabel}"Sigue empujando".`
            : "Organice los activos de producción del libro en pasos actuales y entréguelos a un director automatizado de IA para que se haga cargo si es necesario."}
          actions={(
            <>
            {onSwitchToSimpleMode ? (
              <Button type="button" variant="outline" onClick={onSwitchToSimpleMode} disabled={isSwitchingToSimpleMode}>
                {isSwitchingToSimpleMode ? <Loader2 className="animate-spin" /> : <Sparkles />}
                modo fácil
              </Button>
            ) : null}
            {!hideTakeoverEntry ? (
              isTakeoverLoading ? (
                <Button type="button" size="sm" disabled>
                  <Loader2 className="animate-spin" />
                  El director automático de IA asume el control
                </Button>
              ) : activeStepTakeoverEntry
            ) : null}

            <Dialog open={isExportDialogOpen} onOpenChange={setIsExportDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline">Exportar</Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Exportar contenido del proyecto</DialogTitle>
                  <DialogDescription>
                    El paso actual se exportará según el banco de trabajo que esté viendo; el libro completo se puede exportar como activos del proyecto o descargar como texto TXT y archivos ZIP para los capítulos.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 md:grid-cols-2">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Pasos actuales:{currentStepLabel}</CardTitle>
                    </CardHeader>
                    <CardContent className="flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        onClick={() => exportControls.onExportCurrent("markdown")}
                        disabled={!exportControls.canExportCurrentStep || exportControls.isExportingCurrentMarkdown}
                      >
                        {exportControls.isExportingCurrentMarkdown ? "Exportando..." : "Markdown"}
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => exportControls.onExportCurrent("json")}
                        disabled={!exportControls.canExportCurrentStep || exportControls.isExportingCurrentJson}
                      >
                        {exportControls.isExportingCurrentJson ? "Exportando..." : "JSON"}
                      </Button>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Libro completo</CardTitle>
                    </CardHeader>
                    <CardContent className="flex flex-wrap gap-2">
                      <Button
                        onClick={() => exportControls.onExportFull("txt")}
                        disabled={exportControls.isExportingFullTxt}
                      >
                        {exportControls.isExportingFullTxt ? "Exportando..." : "Texto textual"}
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => exportControls.onExportFull("zip")}
                        disabled={exportControls.isExportingFullZip}
                      >
                        {exportControls.isExportingFullZip ? "Exportando..." : "Capítulo por ZIP"}
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => exportControls.onExportFull("markdown")}
                        disabled={exportControls.isExportingFullMarkdown}
                      >
                        {exportControls.isExportingFullMarkdown ? "Exportando..." : "Markdown"}
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => exportControls.onExportFull("json")}
                        disabled={exportControls.isExportingFullJson}
                      >
                        {exportControls.isExportingFullJson ? "Exportando..." : "JSON"}
                      </Button>
                    </CardContent>
                  </Card>
                </div>
              </DialogContent>
            </Dialog>

            <DirectorFactDebugDialog novelId={id} taskId={taskDrawer?.task?.id ?? null} />

            <Dialog open={isProjectToolsOpen} onOpenChange={setIsProjectToolsOpen}>
              <DialogTrigger asChild>
                <Button variant="outline">Herramientas de proyecto</Button>
              </DialogTrigger>
              <DialogContent className="max-h-[90vh] w-[calc(100vw-2rem)] max-w-4xl overflow-auto">
                <DialogHeader>
                  <DialogTitle>Herramientas de proyecto</DialogTitle>
                  <DialogDescription>
                    La información secundaria se almacena aquí. La primera pantalla solo conserva el paso actual y la entrada de recuperación para evitar que el espacio de trabajo principal se llene con información auxiliar del proyecto.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-3 md:grid-cols-2">
                  <Card>
                    <CardHeader>
                      <CardTitle>Progreso del capítulo</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p>{generatedChapters} / {Math.max(totalChapters, 1)} Generado</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader>
                      <CardTitle>Capítulos a reparar</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p>{pendingRepairs}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader>
                      <CardTitle>Modelo actual</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p>{currentModel}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader>
                      <CardTitle>Tareas recientes</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p>{pipelineTab.pipelineJob?.status ?? "idle"}</p>
                    </CardContent>
                  </Card>
                </div>
                <KnowledgeBindingPanel targetType="novel" targetId={id} title="Conocimientos de referencia" />

                {/* 开发工具区 —— 仅在 DEV 环境可见 */}
                {import.meta.env.DEV ? (
                  <Card className="border-dashed border-yellow-500/60 bg-yellow-50/30 dark:bg-yellow-950/10">
                    <CardHeader>
                      <CardTitle className="text-sm text-yellow-700 dark:text-yellow-400">🛠 Herramientas de desarrollo</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <p className="text-xs text-muted-foreground">
                        Después del reinicio, todos los textos de los capítulos, libros de datos, resúmenes e informes de calidad se borrarán y el estado del capítulo volverá a "No planificado". Los datos de la capa de planificación (carácter, esquema, planificación de volumen) permanecen sin cambios.
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-yellow-500/60 text-yellow-700 hover:bg-yellow-100 dark:text-yellow-400 dark:hover:bg-yellow-900/30"
                        disabled={resetChaptersMutation.isPending}
                        onClick={() => {
                          if (window.confirm(`Confirmar para restablecer toda esta novela. ${totalChapters} ¿El texto de un capítulo? Esta operación es irreversible (pero los datos de la instantánea se conservan).`)) {
                            resetChaptersMutation.mutate();
                          }
                        }}
                      >
                        {resetChaptersMutation.isPending
                          ? <><Loader2 className="animate-spin" />Restableciendo…</>
                          : <><RotateCcw />Restablecer todo el texto del capítulo</>}
                      </Button>
                    </CardContent>
                  </Card>
                ) : null}
              </DialogContent>
            </Dialog>

            <Button
              variant={taskDrawer?.task?.status === "failed" ? "destructive" : "secondary"}
              onClick={() => taskDrawer?.onOpenChange(true)}
            >
              Detalles de ejecución
              {taskAttentionLabel ? <Badge variant="secondary">{taskAttentionLabel}</Badge> : null}
            </Button>
            {directorStepCalibration ? <DirectorStepCalibrationDialog {...directorStepCalibration} /> : null}
            </>
          )}
        />
      ) : null}

      <div className="space-y-4 pt-1">
        {takeover ? (
          <AITakeoverContainer
            mode={takeover.mode}
            title={takeover.title}
            description={takeover.description}
            progress={takeover.progress}
            currentAction={takeover.currentAction}
            checkpointLabel={takeover.checkpointLabel}
            taskId={takeover.taskId}
            actions={takeover.actions}
          >
            {renderActivePanel()}
          </AITakeoverContainer>
        ) : (
          renderActivePanel()
        )}
      </div>

      {taskDrawer ? <NovelTaskDrawer {...taskDrawer} /> : null}
    </div>
  );
}
