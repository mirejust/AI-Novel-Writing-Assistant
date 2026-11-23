import { BookOpen, GitBranch, Settings2, Sparkles } from "lucide-react";
import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import LLMSelector from "@/components/common/LLMSelector";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { AUTO_DIRECTOR_MOBILE_CLASSES } from "@/mobile/autoDirector";
import type { NovelBasicFormState } from "../novelBasicInfo.shared";
import { findDirectorIssuePolicyPreset, type DirectorIssuePolicy } from "@ai-novel/shared/types/directorIssue";
import { AutoDirectorIssuePolicyCard } from "@/pages/settings/AutoDirectorIssuePolicyCard";

interface StageModelRunProps {
  directorVersion: "v1" | "v2";
  availableDirectorVersions: ("v1" | "v2")[];
  onDirectorVersionChange: (version: "v1" | "v2") => void;
  versionLocked?: boolean;
  basicForm: NovelBasicFormState;
  onBasicFormChange: (patch: Partial<NovelBasicFormState>) => void;
  canGenerate: boolean;
  generationDisabledReasons: string[];
  directorVersionsError: boolean;
  onRetryDirectorVersions: () => void;
  isGenerating: boolean;
  onBack: () => void;
  onGenerate: () => void;
  issuePolicy?: DirectorIssuePolicy | null;
  issuePolicyLoading: boolean;
  onIssuePolicyChange: (policy: DirectorIssuePolicy) => void;
}

export default function StageModelRun({
  directorVersion,
  availableDirectorVersions,
  onDirectorVersionChange,
  versionLocked,
  basicForm,
  onBasicFormChange,
  canGenerate,
  generationDisabledReasons,
  directorVersionsError,
  onRetryDirectorVersions,
  isGenerating,
  onBack,
  onGenerate,
  issuePolicy,
  issuePolicyLoading,
  onIssuePolicyChange,
}: StageModelRunProps) {
  const [issuePolicyDialogOpen, setIssuePolicyDialogOpen] = useState(false);
  const issuePolicySummary = issuePolicy
    ? findDirectorIssuePolicyPreset(issuePolicy)?.name ?? "Las reglas para abrir este libro han sido ajustadas."
    : "Usar reglas predeterminadas";

  return (
    <section className="mx-auto w-full max-w-5xl space-y-7 py-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="text-2xl font-semibold tracking-normal text-foreground">Confirmar el modelo y la preparación de producción.</div>
          <div className={`mt-2 max-w-2xl text-sm leading-6 text-muted-foreground ${AUTO_DIRECTOR_MOBILE_CLASSES.wrapText}`}>
            Después de la confirmación, AI le dará dos conjuntos de instrucciones para todo el libro para que pueda compararlas y discutirlas.
          </div>
        </div>
        <div className="rounded-full bg-muted/55 px-3 py-1 text-xs text-muted-foreground">
          Último paso antes de empezar
        </div>
      </div>

      <div className="space-y-6">
        <section className="space-y-2">
          <label htmlFor="opening-director-version" className="block text-sm font-medium">Versión del director</label>
          <select id="opening-director-version" value={directorVersion} disabled={versionLocked || isGenerating}
            onChange={event => onDirectorVersionChange(event.target.value as "v1" | "v2")}
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm sm:max-w-sm">
            {availableDirectorVersions.map(version => <option key={version} value={version}>{version === "v2" ? "Director V2 · Nuevo director" : "Director V1 · Director original"}</option>)}
            {!availableDirectorVersions.includes(directorVersion) ? <option value={directorVersion}>{availableDirectorVersions.length ? `director ${directorVersion.toUpperCase()} · No habilitado` : directorVersionsError ? "La versión del director no se pudo leer." : "Leyendo la versión del director..."}</option> : null}
          </select>
          <p className="text-xs leading-5 text-muted-foreground">{directorVersion === "v2"
            ? "Al seleccionar una dirección, puedes elegir entre preparación automática o confirmación paso a paso."
            : "Elija el proceso creativo utilizado en este libro. La confirmación totalmente automática o paso a paso se puede configurar en el escritorio del director correspondiente."}</p>
          {versionLocked ? <p className="text-xs text-muted-foreground">Puede elegir otra versión después de completar la tarea de apertura del libro actual.</p> : null}
        </section>
        <section className="overflow-hidden rounded-2xl border border-border/70 bg-background shadow-[0_20px_55px_-45px_hsl(var(--foreground)/0.5)]">
          <div className="border-b border-border/60 bg-muted/15 px-5 py-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <GitBranch className="h-4 w-4 text-primary" />
              El director automático avanzará así.
            </div>
          </div>
          <div className="grid gap-px bg-border/60 md:grid-cols-3">
            <div className="bg-background p-5">
              <Sparkles className="h-5 w-5 text-primary" />
              <div className="mt-3 text-sm font-semibold text-foreground">1. Seleccione la dirección del libro.</div>
              <div className="mt-1 text-xs leading-5 text-muted-foreground">La IA genera dos conjuntos distintos de direcciones y tú eliges una.</div>
            </div>
            <div className="bg-background p-5">
              <BookOpen className="h-5 w-5 text-primary" />
              <div className="mt-3 text-sm font-semibold text-foreground">2. Preparar personajes y capítulos.</div>
              <div className="mt-1 text-xs leading-5 text-muted-foreground">{directorVersion === "v2"
                ? "Elija la confirmación paso a paso para adoptar los cambios o conservar el manuscrito original antes de comenzar el siguiente paso."
                : "El sistema completa personajes, estrategias de volumen, división de capítulos y recursos de ejecución de capítulos."}</div>
            </div>
            <div className="bg-background p-5">
              <Settings2 className="h-5 w-5 text-primary" />
              <div className="mt-3 text-sm font-semibold text-foreground">{directorVersion === "v2" ? "3. Elige el capítulo que quieres escribir." : "3. Seleccione el método de producción de texto."}</div>
              <div className="mt-1 text-xs leading-5 text-muted-foreground">{directorVersion === "v2"
                ? "Consulta el alcance del capítulo en el escritorio del director antes de empezar a escribir el texto."
                : "La creación sencilla utiliza IA para escribir el libro completo; La creación profesional entra en el banco de trabajo completo."}</div>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-primary/10 bg-primary/[0.05] px-5 py-3 text-xs">
            <span className="font-medium text-foreground">El texto dejará de esperar tu elección antes de empezar a escribir.</span>
            <span className="text-muted-foreground">El texto del capítulo no se generará por adelantado.</span>
          </div>
        </section>

        <div className="flex flex-col gap-3 pt-1 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <div className="text-sm font-medium text-foreground">Ir a detección y corrección de IA después del texto</div>
            <div className={`text-xs leading-5 text-muted-foreground ${AUTO_DIRECTOR_MOBILE_CLASSES.wrapText}`}>
              Después de activarse, la verificación del capítulo verificará el método de escritura y los riesgos de sabor de la IA; Los problemas que deban corregirse se revisarán parcialmente de acuerdo con esta estrategia creativa y las recomendaciones generales se conservarán como recordatorios de calidad.
            </div>
          </div>
          <Switch
            aria-label="Ir a detección y corrección de IA después del texto"
            checked={basicForm.postGenerationStyleReviewEnabled}
            onCheckedChange={(checked) => onBasicFormChange({ postGenerationStyleReviewEnabled: checked })}
          />
        </div>

        <details className="group rounded-2xl border border-border/70 bg-background px-5 py-4">
          <summary className="cursor-pointer list-none">
            <div className="text-sm font-medium text-foreground">Configuración del modelo</div>
            <div className={`mt-1 text-xs leading-5 text-muted-foreground ${AUTO_DIRECTOR_MOBILE_CLASSES.wrapText}`}>
              Ajuste el modelo, la temperatura y el límite superior de salida utilizado para la apertura de este libro. La planificación estructural recomienda mantener la temperatura entre 0,3 y 0,7ºC.
            </div>
          </summary>
          <div className="mt-4">
            <LLMSelector showParameters />
          </div>
        </details>

        <section className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-background px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-sm font-medium text-foreground">Gestión de problemas de libros</div>
            <div className={`mt-1 text-xs leading-5 text-muted-foreground ${AUTO_DIRECTOR_MOBILE_CLASSES.wrapText}`}>
              {issuePolicyLoading ? "Cargando reglas predeterminadas." : `${issuePolicySummary}; Puedes abrir el libro directamente sin ajustarlo.`}
            </div>
          </div>
          <Button type="button" variant="outline" className="shrink-0" onClick={() => setIssuePolicyDialogOpen(true)}>
            <Settings2 className="mr-2 h-4 w-4" />
            Gestión de problemas de libros
          </Button>
        </section>

        <Dialog open={issuePolicyDialogOpen} onOpenChange={setIssuePolicyDialogOpen}>
          <DialogContent className="max-h-[88vh] max-w-3xl overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Gestión de problemas de libros</DialogTitle>
              <DialogDescription>Antes de abrir el libro, confirme cómo maneja los problemas; puede continuar usando las reglas predeterminadas sin realizar ajustes.</DialogDescription>
            </DialogHeader>
            <AutoDirectorIssuePolicyCard
              policy={issuePolicy}
              isLoading={issuePolicyLoading}
              isSaving={false}
              onSave={(policy) => {
                onIssuePolicyChange(policy);
                setIssuePolicyDialogOpen(false);
              }}
              saveButtonLabel="Aplicar a la tarea de apertura de libros."
            />
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex flex-col gap-2 pt-2 sm:flex-row sm:justify-between">
        <Button type="button" variant="ghost" onClick={onBack}>Regreso al mundo y métodos de escritura.</Button>
        <div className="space-y-2 sm:max-w-md sm:text-right">
          {!canGenerate ? (
            <ul id="direction-generation-disabled-reasons" role="status" className="space-y-1 text-sm text-muted-foreground">
              {generationDisabledReasons.map((reason) => <li key={reason}>{reason}</li>)}
            </ul>
          ) : null}
          {directorVersionsError ? (
            <Button type="button" variant="ghost" size="sm" onClick={onRetryDirectorVersions}>Reintentar leer la versión del director.</Button>
          ) : null}
          <Button type="button" onClick={onGenerate} disabled={!canGenerate}
            aria-describedby={!canGenerate ? "direction-generation-disabled-reasons" : undefined}>
            {isGenerating ? "Generando..." : "Comience a generar direcciones"}
          </Button>
        </div>
      </div>
    </section>
  );
}
