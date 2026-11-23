import { WorkspaceColumns } from "@/components/layout/resizableWorkspace";
import { GitBranch, LibraryBig } from "lucide-react";
import CreationFlow from "./creationFlow/CreationFlow";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { getNovelChapters } from "@/api/novel/chapters";
import { queryKeys } from "@/api/queryKeys";
import type { PromptCatalogItem } from "@/api/promptWorkbench";
import type { LLMSelectorValue } from "@/components/common/LLMSelector";
import { Button } from "@/components/ui/button";
import { AppDialogContent, Dialog } from "@/components/ui/dialog";
import SelectControl from "@/components/common/SelectControl";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { useLLMStore } from "@/store/llmStore";
import { AdvancedPromptTemplateEditor } from "./components/AdvancedPromptTemplateEditor";
import { PromptBodyEditor } from "./components/PromptBodyEditor";
import { PromptCatalogSidebar } from "./components/PromptCatalogSidebar";
import { ContextInjectionPanel } from "./components/ContextInjectionPanel";
import { PromptEditorShell } from "./components/PromptEditorShell";
import { PromptRunBar } from "./components/PromptRunBar";
import { PromptTestRunResultPanel } from "./components/PromptPreviewPanel";
import { usePromptCatalog } from "./hooks/usePromptCatalog";
import { usePromptDraftSlots } from "./hooks/usePromptDraftSlots";
import { usePromptPreview } from "./hooks/usePromptPreview";
import { usePromptTemplateEditor } from "./hooks/usePromptTemplateEditor";
import { WritingPlatformProfileManager } from "./components/WritingPlatformProfileManager";

type PromptEditMode = "slots" | "advanced";

export default function PromptWorkbenchPage() {
  const [params] = useSearchParams();
  const [view, setView] = useState<"flow" | "catalog">("flow");
  const [visitedCatalog, setVisitedCatalog] = useState(false);
  const [requestedPrompt, setRequestedPrompt] = useState<{ id: string; version: string }>();
  if (params.get("experience") === "writing") return <PromptCatalogWorkspace />;
  function openCatalog(prompt?: { id: string; version: string }) {
    if (prompt) setRequestedPrompt(prompt);
    setVisitedCatalog(true);
    setView("catalog");
  }
  return <div className="prompt-management">
    <header className="prompt-management-bar">
      <h1>Gestión rápida de palabras</h1>
      <nav className="prompt-view-switch" aria-label="Vista rápida de administración de palabras">
        <button type="button" aria-pressed={view === "flow"} onClick={() => setView("flow")}><GitBranch size={15} />Proceso creativo</button>
        <button type="button" aria-pressed={view === "catalog"} onClick={() => openCatalog()}><LibraryBig size={15} />Todas las palabras rápidas</button>
      </nav>
    </header>
    <div className="management-view" hidden={view !== "flow"}><CreationFlow onOpenCatalog={openCatalog} /></div>
    {visitedCatalog && <div className="management-view" hidden={view !== "catalog"}>
      <PromptCatalogWorkspace requestedPrompt={requestedPrompt} />
    </div>}
  </div>;
}

function PromptCatalogWorkspace({ requestedPrompt }: { requestedPrompt?: { id: string; version: string } }) {
  const [searchParams] = useSearchParams();
  const writingLab = searchParams.get("experience") === "writing";
  const requestedNovelId = searchParams.get("novelId")?.trim() ?? "";
  const requestedChapterId = searchParams.get("chapterId")?.trim() ?? "";
  const writingLabSetupRef = useRef(false);
  const [keyword, setKeyword] = useState(() => writingLab ? "novel.chapter.writer" : "");
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  useEffect(() => {
    if (requestedPrompt) {
      setKeyword(requestedPrompt.id);
      setSelectedKey(`${requestedPrompt.id}@${requestedPrompt.version}`);
    }
  }, [requestedPrompt]);
  const [entrypoint, setEntrypoint] = useState("manual_test");
  const [selectedContextBlockId, setSelectedContextBlockId] = useState<string | null>(null);
  const [immersiveMode, setImmersiveMode] = useState(false);
  const [selectedChapterId, setSelectedChapterId] = useState("");
  const [editMode, setEditMode] = useState<PromptEditMode>(() => writingLab ? "advanced" : "slots");
  const [platformManagerOpen, setPlatformManagerOpen] = useState(false);
  const [showContext, setShowContext] = useState(writingLab);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [saveTargetNovelId, setSaveTargetNovelId] = useState("");
  const globalLlmProvider = useLLMStore((state) => state.provider);
  const globalLlmModel = useLLMStore((state) => state.model);
  const globalLlmTemperature = useLLMStore((state) => state.temperature);
  const globalLlmMaxTokens = useLLMStore((state) => state.maxTokens);
  const [testLlm, setTestLlm] = useState<LLMSelectorValue>(() => ({
    provider: globalLlmProvider,
    model: globalLlmModel,
    temperature: globalLlmTemperature,
    maxTokens: globalLlmMaxTokens,
  }));

  const catalog = usePromptCatalog(keyword);
  const prompts = catalog.prompts;
  const selectedPrompt = useMemo(() => {
    if (prompts.length === 0) {
      return null;
    }
    if (writingLab) {
      return prompts.find((item) => item.id === "novel.chapter.writer") ?? prompts[0] ?? null;
    }
    return prompts.find((item) => item.key === selectedKey) ?? prompts[0] ?? null;
  }, [prompts, selectedKey, writingLab]);

  const slotState = usePromptDraftSlots(selectedPrompt);
  const activeNovel = useMemo(
    () => slotState.novels.find((novel) => novel.id === slotState.activeNovelId) ?? null,
    [slotState.activeNovelId, slotState.novels],
  );
  const chaptersQuery = useQuery({
    queryKey: queryKeys.novels.chapters(slotState.activeNovelId || "none"),
    queryFn: () => getNovelChapters(slotState.activeNovelId),
    enabled: Boolean(slotState.scope === "novel" && slotState.activeNovelId),
    staleTime: 30_000,
  });
  const chapters = chaptersQuery.data?.data ?? [];
  const selectedChapter = useMemo(
    () => chapters.find((chapter) => chapter.id === selectedChapterId) ?? null,
    [chapters, selectedChapterId],
  );
  const advancedTemplateSupported = Boolean(selectedPrompt?.capabilities.supportsAdvancedTemplate);
  const advancedTemplateEnabled = advancedTemplateSupported;
  const templateState = usePromptTemplateEditor({
    prompt: selectedPrompt,
    novelId: slotState.scope === "novel" ? slotState.activeNovelId : "",
    chapterId: selectedChapterId,
    entrypoint,
    enabled: advancedTemplateEnabled,
  });
  const activeEditMode: PromptEditMode = editMode === "advanced" && advancedTemplateSupported ? "advanced" : "slots";
  const previewState = usePromptPreview({
    prompt: selectedPrompt,
    entrypoint,
    novelId: slotState.scope === "novel" && slotState.activeNovelId ? slotState.activeNovelId : undefined,
    chapterId: slotState.scope === "novel" && selectedChapterId ? selectedChapterId : undefined,
    previewNovel: activeNovel,
    previewChapter: selectedChapter,
    slotOverrides: slotState.drafts,
    templateDraft: activeEditMode === "advanced" && advancedTemplateEnabled ? templateState.draftTemplate ?? undefined : undefined,
  });
  const preview = previewState.preview;
  const testRunError = previewState.testRunError;

  useEffect(() => {
    setSelectedContextBlockId(null);
  }, [preview?.prompt.key, selectedPrompt?.key]);

  useEffect(() => {
    setSelectedChapterId("");
  }, [slotState.activeNovelId]);

  useEffect(() => {
    if (!writingLab || writingLabSetupRef.current) {
      return;
    }
    if (slotState.scope !== "novel") {
      slotState.setScope("novel");
      return;
    }
    if (requestedNovelId && slotState.selectedNovelId !== requestedNovelId) {
      slotState.setSelectedNovelId(requestedNovelId);
      return;
    }
    if (requestedChapterId) {
      setSelectedChapterId(requestedChapterId);
    }
    writingLabSetupRef.current = true;
  }, [
    requestedChapterId,
    requestedNovelId,
    slotState.scope,
    slotState.selectedNovelId,
    slotState.setScope,
    slotState.setSelectedNovelId,
    writingLab,
  ]);

  useEffect(() => {
    if (slotState.scope !== "novel" || !slotState.activeNovelId || chapters.length === 0) {
      return;
    }
    if (selectedChapterId && chapters.some((chapter) => chapter.id === selectedChapterId)) {
      return;
    }
    const defaultChapter = chapters.find((chapter) => chapter.content?.trim()) ?? chapters[0];
    setSelectedChapterId(defaultChapter?.id ?? "");
  }, [chapters, selectedChapterId, slotState.activeNovelId, slotState.scope]);

  useEffect(() => {
    if (!immersiveMode) {
      return;
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setImmersiveMode(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [immersiveMode]);

  useEffect(() => {
    if (!advancedTemplateSupported && editMode === "advanced") {
      setEditMode("slots");
    }
  }, [advancedTemplateSupported, editMode]);

  useEffect(() => {
    if (testLlm.provider || !globalLlmProvider) {
      return;
    }
    setTestLlm({
      provider: globalLlmProvider,
      model: globalLlmModel,
      temperature: globalLlmTemperature,
      maxTokens: globalLlmMaxTokens,
    });
  }, [
    globalLlmMaxTokens,
    globalLlmModel,
    globalLlmProvider,
    globalLlmTemperature,
    testLlm.provider,
  ]);

  function handleRunTest() {
    previewState.generateTestRun({
      ...(testLlm.provider ? { provider: testLlm.provider } : {}),
      ...(testLlm.model ? { model: testLlm.model } : {}),
      ...(testLlm.temperature !== undefined ? { temperature: testLlm.temperature } : {}),
      ...(testLlm.maxTokens !== undefined ? { maxTokens: testLlm.maxTokens } : {}),
    });
  }

  function handleSelectPrompt(prompt: PromptCatalogItem) {
    setSelectedKey(prompt.key);
    setSelectedContextBlockId(null);
  }

  const saveDisabled = !selectedPrompt?.slotSupported
    || slotState.isNovelScopeDisabled
    || !slotState.hasDirtyDrafts
    || slotState.saveMutation.isPending;
  const templateSaveError = templateState.saveMutation.error instanceof Error
    ? templateState.saveMutation.error.message
    : templateState.restoreMutation.error instanceof Error
      ? templateState.restoreMutation.error.message
      : templateState.activateMutation.error instanceof Error
        ? templateState.activateMutation.error.message
        : null;
  const isAdvancedMode = activeEditMode === "advanced";
  const effectiveDirtyCount = isAdvancedMode ? (templateState.isDirty ? 1 : 0) : slotState.dirtySlotKeys.length;
  const effectiveSavePending = isAdvancedMode ? templateState.saveMutation.isPending : slotState.saveMutation.isPending;
  const effectiveSaveSuccess = isAdvancedMode ? templateState.saveMutation.isSuccess : slotState.saveMutation.isSuccess;
  const effectiveSaveError = isAdvancedMode ? templateSaveError : slotState.saveError;
  const templateBusy = templateState.saveMutation.isPending
    || templateState.restoreMutation.isPending
    || templateState.activateMutation.isPending;
  const effectiveSaveDisabled = isAdvancedMode
    ? !templateState.isReady || (!templateState.isDirty && templateState.canPersist) || templateBusy
    : saveDisabled;
  const effectiveResetDisabled = isAdvancedMode ? !templateState.isDirty || templateBusy : !slotState.hasDirtyDrafts;
  const effectiveOfficialDisabled = isAdvancedMode
    ? !templateState.canPersist || templateState.view?.mode !== "custom" || templateBusy
    : !selectedPrompt?.slotSupported || slotState.isNovelScopeDisabled;

  return (
    <WorkspaceColumns layoutId="prompt-workbench" gap={0} minCenter={440}
      left={!immersiveMode && !writingLab ? { label: "Ajustar el ancho de la lista de palabras emergentes", initial: "260px", min: 160 } : undefined}
      className={cn(
        "prompt-workbench-theme flex h-full min-h-0 overflow-hidden bg-background text-foreground lg:workspace-split",
        immersiveMode && "fixed inset-0 z-50 h-screen bg-background",
      )}
    >
      {!immersiveMode && !writingLab ? (
        <div className="flex h-full min-h-0 w-[260px] shrink-0 overflow-hidden lg:w-auto">
          <PromptCatalogSidebar
            keyword={keyword}
            onKeywordChange={setKeyword}
            prompts={prompts}
            selectedKey={selectedPrompt?.key ?? null}
            isLoading={catalog.query.isLoading}
            isFetching={catalog.query.isFetching}
            onSelect={handleSelectPrompt}
            onRefresh={() => void catalog.refetch()}
            onManagePlatforms={() => setPlatformManagerOpen(true)}
          />
        </div>
      ) : null}

      <main className="h-full min-h-0 min-w-0 flex-1 overflow-hidden">
        {selectedPrompt ? (
          <PromptEditorShell
            prompt={selectedPrompt}
            simplified={writingLab}
            advanced={isAdvancedMode}
            heading={writingLab ? "Laboratorio de efectos de texto" : undefined}
            immersive={immersiveMode}
            onImmersiveChange={setImmersiveMode}
            entrypoint={entrypoint}
            onEntrypointChange={setEntrypoint}
            scope={slotState.scope}
            onScopeChange={slotState.setScope}
            selectedNovelId={slotState.selectedNovelId}
            onNovelChange={slotState.setSelectedNovelId}
            novels={slotState.novels}
            selectedChapterId={selectedChapterId}
            onChapterChange={setSelectedChapterId}
            chapters={chapters.map((chapter) => ({
              id: chapter.id,
              title: chapter.title,
              order: chapter.order,
              hasContent: Boolean(chapter.content?.trim()),
            }))}
            bodyPanel={
              <div className="space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border pb-4">
                  <div>
                    <Tabs value={activeEditMode} onValueChange={(value) => setEditMode(value as PromptEditMode)}>
                      <TabsList>
                        <TabsTrigger value="slots">Ajustes de uso común</TabsTrigger>
                        {advancedTemplateSupported ? <TabsTrigger value="advanced">Plantilla completa</TabsTrigger> : null}
                      </TabsList>
                    </Tabs>
                    <p className="mt-2 text-sm text-muted-foreground">{isAdvancedMode
                      ? "Edite directamente instrucciones completas, adecuadas para escritura que requiera una personalización profunda."
                      : "Comience con los ajustes principales; cambie sólo lo que necesite y la configuración predeterminada funcionará."}</p>
                  </div>
                  {isAdvancedMode ? <Button variant="ghost" size="sm" aria-expanded={showContext}
                    onClick={() => setShowContext((value) => !value)}>{showContext ? "Cerrar cita de datos" : "Ver citas"}</Button> : null}
                </div>
                {!isAdvancedMode && slotState.isNovelScopeDisabled ? (
                  <div className="rounded-md bg-muted/[0.35] px-4 py-3 text-sm text-muted-foreground">
                    Seleccione una novela para establecer los requisitos para este libro individualmente o cambie a "Todas las novelas" para ajustar los requisitos predeterminados.
                  </div>
                ) : null}
                {previewState.previewMutation.isError ? <p role="alert" className="text-sm text-destructive">
                  {previewState.previewMutation.error instanceof Error ? previewState.previewMutation.error.message : "La vista previa falló, inténtelo de nuevo."}
                </p> : null}
                {isAdvancedMode ? (
                  <AdvancedPromptTemplateEditor
                    templateState={templateState}
                    preview={preview}
                    testRun={previewState.testRun}
                    testRunPending={previewState.isTestRunPending}
                    testRunError={testRunError}
                    testRunStreamOutput={previewState.testRunStreamOutput}
                    disabled={!advancedTemplateEnabled}
                    showTestResult={!writingLab || !showContext}
                  />
                ) : (
                  <PromptBodyEditor
                    prompt={selectedPrompt}
                    immersive={immersiveMode}
                    preview={preview}
                    testRun={previewState.testRun}
                    testRunPending={previewState.isTestRunPending}
                    testRunError={testRunError}
                    testRunStreamOutput={previewState.testRunStreamOutput}
                    sections={slotState.sections}
                    reconcile={slotState.reconcile}
                    reconcileMap={slotState.reconcileMap}
                    showReconcile={slotState.showReconcile}
                    reconcileLoading={slotState.reconcileQuery.isFetching}
                    reconcilePending={slotState.reconcilePending}
                    disabled={
                      slotState.isNovelScopeDisabled
                      || slotState.saveMutation.isPending
                      || slotState.resetMutation.isPending
                    }
                    onSlotChange={slotState.changeSlotDraft}
                    onSlotReset={slotState.resetSlot}
                    onApplyOfficialSlots={slotState.adoptSlotsByKey}
                    onKeepSlots={slotState.keepSlotsByKey}
                    onContextSelect={setSelectedContextBlockId}
                  />
                )}
              </div>
            }
            contextPanel={isAdvancedMode && showContext ? (
              <div className="flex h-full min-h-0 flex-col">
                {writingLab && (previewState.testRun || previewState.testRunMutation.isPending || testRunError) ? (
                  <div className="max-h-[56%] shrink-0 overflow-y-auto border-b border-border p-3">
                    <PromptTestRunResultPanel
                      result={previewState.testRun}
                      isPending={previewState.isTestRunPending}
                      error={testRunError}
                      streamOutput={previewState.testRunStreamOutput}
                    />
                  </div>
                ) : null}
                <div className="min-h-0 flex-1">
                  <ContextInjectionPanel
                    preview={preview}
                    selectedBlockId={selectedContextBlockId}
                    onSelectBlock={setSelectedContextBlockId}
                    referenceCatalog={templateState.references}
                    onInsertToken={templateState.insertToken}
                  />
                </div>
              </div>
            ) : undefined}
            runBar={
              <PromptRunBar
                prompt={selectedPrompt}
                estimatedTokens={preview?.context.estimatedInputTokens ?? null}
                dirtyCount={effectiveDirtyCount}
                isPreviewPending={previewState.previewMutation.isPending}
                isTestRunPending={previewState.isTestRunPending}
                isSavePending={effectiveSavePending}
                isSaveSuccess={effectiveSaveSuccess}
                saveError={effectiveSaveError}
                saveDisabled={effectiveSaveDisabled}
                previewDisabled={!selectedPrompt || previewState.previewMutation.isPending || (isAdvancedMode && !templateState.isReady)}
                testRunDisabled={!selectedPrompt || previewState.isTestRunPending || (isAdvancedMode && !templateState.isReady)}
                testLlm={testLlm}
                onTestLlmChange={setTestLlm}
                resetDisabled={effectiveResetDisabled}
                officialVersionDisabled={effectiveOfficialDisabled}
                officialVersionLabel={isAdvancedMode ? "Restaurar plantilla oficial" : "Versión oficial"}
                saveLabel={isAdvancedMode ? (templateState.canPersist ? "Guardar plantilla de libro" : "Guardar en novela") : "Guardar configuración"}
                scopeHint={isAdvancedMode
                  ? (templateState.canPersist ? `Aplicar a "${activeNovel?.title || "Novela seleccionada"}»` : "Borrador de plantilla · Aún no aplicado a la novela")
                  : slotState.scope === "global" ? "Requisito predeterminado para todas las novelas" : `Sólo se aplica a${activeNovel?.title || "Por favor seleccione una novela"}»`}
                usesSample={!slotState.activeNovelId}
                onGeneratePreview={previewState.generatePreview}
                onRunTest={handleRunTest}
                onOpenOfficialVersion={
                  isAdvancedMode
                    ? () => templateState.restoreMutation.mutate()
                    : slotState.openOfficialVersionPanel
                }
                onSave={
                  isAdvancedMode
                    ? () => {
                      if (templateState.canPersist) templateState.saveMutation.mutate(undefined);
                      else { setSaveTargetNovelId(slotState.selectedNovelId); setSaveDialogOpen(true); }
                    }
                    : slotState.saveDrafts
                }
                onReset={isAdvancedMode ? templateState.resetDraft : slotState.resetDrafts}
                writingLab={writingLab}
              />
            }
          />
        ) : (
          <div className="flex h-full items-center justify-center p-8">
            <div className="rounded-md border border-dashed bg-background/80 p-6 text-sm text-muted-foreground">
              Seleccione una palabra rápida.
            </div>
          </div>
        )}
      </main>
      <Dialog open={saveDialogOpen} onOpenChange={(open) => { if (!templateState.saveMutation.isPending) setSaveDialogOpen(open); }}>
        <AppDialogContent title="Aplicar plantilla a la novela" description="Guardar como una nueva versión de la novela seleccionada para la generación posterior; el texto de los capítulos existentes permanece intacto."
          footer={<>
            <Button variant="ghost" disabled={templateState.saveMutation.isPending} onClick={() => setSaveDialogOpen(false)}>Cancelar</Button>
            <Button disabled={!saveTargetNovelId || templateState.saveMutation.isPending} onClick={() => {
              templateState.saveMutation.mutate(saveTargetNovelId, { onSuccess: () => {
                setSaveDialogOpen(false);
                slotState.setScope("novel");
                slotState.setSelectedNovelId(saveTargetNovelId);
              } });
            }}>{templateState.saveMutation.isPending ? "Guardando…" : "Guardar y aplicar"}</Button>
          </>}>
          <SelectControl value={saveTargetNovelId} onChange={(event) => setSaveTargetNovelId(event.target.value)}
            aria-label="Guarde la novela de destino de la plantilla." disabled={templateState.saveMutation.isPending}
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
            <option value="">Seleccionar novela</option>
            {slotState.novels.map((novel) => <option key={novel.id} value={novel.id}>{novel.title || novel.id}</option>)}
          </SelectControl>
          {slotState.novelsQuery.isLoading ? <p className="mt-3 text-sm text-muted-foreground">Leyendo lista de novelas...</p>
            : slotState.novelsQuery.isError ? <p role="alert" className="mt-3 text-sm text-destructive">No se pudo leer la lista de novelas.
              <Button variant="ghost" onClick={() => void slotState.novelsQuery.refetch()}>Reintentar</Button></p>
            : slotState.novels.length === 0 ? <p className="mt-3 text-sm text-muted-foreground">Las plantillas se pueden aplicar una vez creada la novela y los borradores se pueden seguir editando y obteniendo una vista previa.</p> : null}
          {templateSaveError ? <p role="alert" className="mt-3 text-sm text-destructive">{templateSaveError}</p> : null}
        </AppDialogContent>
      </Dialog>
      <WritingPlatformProfileManager open={platformManagerOpen} onOpenChange={setPlatformManagerOpen} />
    </WorkspaceColumns>
  );
}
