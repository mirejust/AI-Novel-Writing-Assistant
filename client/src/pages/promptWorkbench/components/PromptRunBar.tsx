import { useState } from "react";
import { Eye, FlaskConical, RotateCcw, Save, ShieldCheck } from "lucide-react";
import type { PromptCatalogItem } from "@/api/promptWorkbench";
import { Button } from "@/components/ui/button";
import { AppDialogContent, Dialog } from "@/components/ui/dialog";
import LLMSelector, { type LLMSelectorValue } from "@/components/common/LLMSelector";
import { cn } from "@/lib/utils";

interface PromptRunBarProps {
  prompt: PromptCatalogItem | null;
  estimatedTokens: number | null;
  dirtyCount: number;
  isPreviewPending: boolean;
  isTestRunPending?: boolean;
  isSavePending: boolean;
  isSaveSuccess: boolean;
  saveError?: string | null;
  saveDisabled: boolean;
  previewDisabled: boolean;
  testRunDisabled?: boolean;
  testLlm: LLMSelectorValue;
  onTestLlmChange: (value: LLMSelectorValue) => void;
  resetDisabled: boolean;
  officialVersionDisabled?: boolean;
  officialVersionLabel?: string;
  saveLabel?: string;
  savePendingLabel?: string;
  onGeneratePreview: () => void;
  onRunTest: () => void;
  onOpenOfficialVersion: () => void;
  onSave: () => void;
  onReset: () => void;
  writingLab?: boolean;
  scopeHint?: string;
  usesSample?: boolean;
}

export function PromptRunBar(props: PromptRunBarProps) {
  const {
    dirtyCount,
    estimatedTokens,
    isPreviewPending,
    isTestRunPending,
    isSavePending,
    isSaveSuccess,
    onGeneratePreview,
    onOpenOfficialVersion,
    onReset,
    onRunTest,
    onSave,
    officialVersionDisabled,
    officialVersionLabel = "Versión oficial",
    previewDisabled,
    prompt,
    resetDisabled,
    saveDisabled,
    saveError,
    saveLabel = "Guardar anulación",
    savePendingLabel = "Guardando...",
    testLlm,
    onTestLlmChange,
    testRunDisabled,
    writingLab = false,
  } = props;
  const maxBudget = prompt?.contextPolicy.maxTokensBudget ?? null;
  const [testDialogOpen, setTestDialogOpen] = useState(false);

  function handleStartTestRun() {
    onRunTest();
    setTestDialogOpen(false);
  }

  return (
    <div className="shrink-0 border-t border-border bg-card/95 px-5 py-3 backdrop-blur">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
          <div aria-live="polite">
            <p className="text-xs text-muted-foreground">{props.scopeHint}</p>
            <p className={cn("mt-1 text-sm", saveError ? "text-destructive" : dirtyCount > 0 ? "text-warning" : "text-muted-foreground")}>
              {saveError ? "Error al guardar" : isSavePending ? "Guardando…" : dirtyCount > 0 ? `${dirtyCount} Modificaciones de elementos a guardar` : isSaveSuccess ? "Guardado exitosamente" : "No hay cambios sin guardar"}
              {estimatedTokens !== null ? <span className="ml-3 text-xs text-muted-foreground" title={`presupuesto contextual ${maxBudget ?? "Ilimitado"}`}>
                Vista previa aprox. {estimatedTokens} tokens</span> : null}
            </p>
          </div>
          {saveError ? <div className="text-xs text-destructive">{saveError}</div> : null}
        </div>

        <div className="flex flex-wrap justify-start gap-2 xl:justify-end">
          <Button
            type="button"
            variant="ghost"
            onClick={onOpenOfficialVersion}
            disabled={officialVersionDisabled}
            className="text-muted-foreground"
          >
            <ShieldCheck className="mr-2 h-4 w-4" />
            {officialVersionLabel}
          </Button>
          {!writingLab ? <Button
            type="button"
            variant="ghost"
            onClick={onGeneratePreview}
            disabled={previewDisabled || isPreviewPending}
            className="text-muted-foreground"
          >
            <Eye className="mr-2 h-4 w-4" />
            {isPreviewPending ? "Vista previa..." : "Vista previa de palabra emergente"}
          </Button> : null}
          <Button
            type="button"
            variant="outline"
            onClick={() => setTestDialogOpen(true)}
            disabled={testRunDisabled || isTestRunPending}
            className="text-foreground shadow-none"
          >
            <FlaskConical className="mr-2 h-4 w-4" />
            {isTestRunPending ? "Intentando escribir..." : writingLab ? "Efecto de escritura de prueba" : "Efecto de prueba"}
          </Button>
          <Button
            type="button"
            onClick={onSave}
            disabled={saveDisabled || isSavePending}
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <Save className="mr-2 h-4 w-4" />
            {isSavePending ? savePendingLabel : saveLabel}
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={onReset}
            disabled={resetDisabled}
            className="text-muted-foreground hover:bg-info/10 hover:text-info"
          >
            <RotateCcw className="mr-2 h-4 w-4" />
            Abandonar cambios
          </Button>
        </div>
      </div>
      <Dialog open={testDialogOpen} onOpenChange={setTestDialogOpen}>
        <AppDialogContent
          title={writingLab ? "Efecto de escritura de prueba" : "Efecto de prueba"}
          description={props.usesSample
            ? "Pruebe los resultados utilizando contenido de muestra y su borrador actual sin cambiar el texto de la novela."
            : "Pruebe el efecto utilizando la novela, el capítulo y el borrador actual seleccionados sin cambiar el texto del capítulo."}
          className="prompt-workbench-theme max-w-2xl"
          bodyClassName="bg-card"
          footer={(
            <>
              <Button type="button" variant="ghost" onClick={() => setTestDialogOpen(false)}>
                Cancelar
              </Button>
              <Button
                type="button"
                onClick={handleStartTestRun}
                disabled={testRunDisabled || isTestRunPending}
                className="bg-primary text-primary-foreground hover:bg-primary/90"
              >
                <FlaskConical className="mr-2 h-4 w-4" />
                {isTestRunPending ? "Intentando escribir..." : writingLab ? "Iniciar la escritura de prueba" : "Empezar a probar"}
              </Button>
            </>
          )}
        >
          <div className="space-y-4">
            <div className="bg-card py-2">
              <LLMSelector
                value={testLlm}
                onChange={onTestLlmChange}
                showBadge={false}
                showParameters
              />
            </div>
            <div className="rounded-md bg-warning/10 px-3 py-2 text-xs leading-relaxed text-warning">
              {writingLab
                ? "La redacción de prueba llamará al modelo real y consumirá créditos. Los resultados solo se utilizan para comparar los efectos de la plantilla y no se guardarán como texto del capítulo."
                : "El resultado de la prueba llamará al modelo real y consumirá créditos; los resultados solo se utilizan para la depuración y no se guardarán como texto del capítulo."}
            </div>
          </div>
        </AppDialogContent>
      </Dialog>
    </div>
  );
}
