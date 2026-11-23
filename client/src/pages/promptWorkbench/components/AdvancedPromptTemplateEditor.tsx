import { useEffect, useState } from "react";
import type { PromptPreviewResult, PromptTestRunResult, PromptTemplateVersionView } from "@/api/promptWorkbench";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { usePromptTemplateEditor } from "../hooks/usePromptTemplateEditor";
import { labelTemplateToken, type PromptTemplateTokenKind } from "../templateTokenEditor";
import { PromptTestRunResultPanel } from "./PromptPreviewPanel";
import { VisualTemplateEditor, type TemplateRole } from "./VisualTemplateEditor";

type TemplateState = ReturnType<typeof usePromptTemplateEditor>;

function formatDiagnosticKeys(keys: string[], kind: Extract<PromptTemplateTokenKind, "context" | "input" | "slot">) {
  return keys.map((key) => labelTemplateToken({ kind, key })).join(",") || "Ninguno";
}

function VersionRow(props: {
  version: PromptTemplateVersionView;
  activeVersionId?: string | null;
  disabled?: boolean;
  onLoad: (version: PromptTemplateVersionView) => void;
  onActivate: (versionId: string) => void;
}) {
  const active = props.activeVersionId === props.version.id;
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border py-3">
      <div>
        <span className="text-sm font-medium">Versión {props.version.versionNo}{active ? " · En uso" : ""}</span>
        <span className="ml-3 text-xs text-muted-foreground">{new Date(props.version.createdAt).toLocaleString()}</span>
        {props.version.notes ? <p className="mt-1 text-sm text-muted-foreground">{props.version.notes}</p> : null}
      </div>
      <div className="flex gap-2">
        <Button variant="ghost" size="sm" disabled={props.disabled} onClick={() => props.onLoad(props.version)}>Cargar edición</Button>
        <Button variant="outline" size="sm" disabled={props.disabled || active} onClick={() => props.onActivate(props.version.id)}>Aplicar esta versión</Button>
      </div>
    </div>
  );
}

export function AdvancedPromptTemplateEditor(props: {
  templateState: TemplateState;
  preview: PromptPreviewResult | null;
  testRun?: PromptTestRunResult | null;
  testRunPending?: boolean;
  testRunError?: string | null;
  testRunStreamOutput?: string;
  disabled?: boolean;
  showTestResult?: boolean;
}) {
  const { templateState: state, preview } = props;
  const [role, setRole] = useState<TemplateRole>("system");
  const [tokenMenuRole, setTokenMenuRole] = useState<TemplateRole | null>(null);
  const [tokenQuery, setTokenQuery] = useState("");
  useEffect(() => state.setFocusedRole(role), [role, state.setFocusedRole]);
  const diagnostics = preview?.diagnostics.template?.diagnostics;
  const busy = props.disabled || state.saveMutation.isPending || state.restoreMutation.isPending || state.activateMutation.isPending;

  if (state.overrideQuery.isError) return (
    <div role="alert" className="rounded-md bg-destructive/10 p-4 text-sm">
      <p>Error al leer la plantilla, inténtelo de nuevo.</p>
      <Button variant="outline" className="mt-2" onClick={() => void state.overrideQuery.refetch()}>Releer</Button>
    </div>
  );
  if (!state.isReady) return <p role="status" className="py-6 text-sm text-muted-foreground">Leyendo la plantilla completa…</p>;

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div className="rounded-md bg-muted/40 px-4 py-3 text-sm">
        <p className="font-medium">{state.canPersist
          ? (state.view?.mode === "custom" ? "Este libro utiliza plantillas personalizadas." : "Este libro utiliza plantillas oficiales.")
          : "Comience a editar desde la plantilla oficial."}</p>
        <p className="mt-1 leading-relaxed text-muted-foreground">
          Se da prioridad al ajuste de los requisitos de expresión en "Reglas de redacción"; "Tareas y Materiales" es responsable de las tareas del capítulo y las referencias previas. Mantenga etiquetas de referencia para permitir que la IA obtenga la información necesaria.
          {!state.canPersist ? " El borrador solo se conserva en la página actual y se aplicará después de hacer clic en \"Guardar en Novela\"." : " Después de guardarlo, se utilizará para la generación posterior de este libro sin cambiar el texto existente."}
        </p>
      </div>
      <Tabs value={role} onValueChange={(value) => { setRole(value as TemplateRole); setTokenMenuRole(null); state.setFocusedRole(value as TemplateRole); }}>
        <TabsList>
          <TabsTrigger value="system">Reglas de escritura · Ajustes importantes</TabsTrigger>
          <TabsTrigger value="human">Tareas e información</TabsTrigger>
        </TabsList>
      </Tabs>
      <VisualTemplateEditor
        key={role}
        role={role}
        label={role === "system" ? "Reglas de escritura (sistema)" : "Tareas e Información (Usuario)"}
        value={role === "system" ? state.systemContent : state.humanContent}
        disabled={busy}
        textareaRef={role === "system" ? state.systemRef : state.humanRef}
        tokenItems={state.references?.items ?? []}
        tokenMenuRole={tokenMenuRole}
        tokenQuery={tokenQuery}
        references={state.references}
        onTokenQueryChange={setTokenQuery}
        onOpenTokenMenu={(nextRole) => { state.setFocusedRole(nextRole); setTokenQuery(""); setTokenMenuRole(nextRole); }}
        onCloseTokenMenu={() => setTokenMenuRole(null)}
        onFocusRole={state.setFocusedRole}
        onInsertToken={state.insertToken}
        onChange={role === "system" ? state.setSystemContent : state.setHumanContent}
      />
      {state.referenceQuery.isError ? <div role="alert" className="text-sm text-destructive">
        No se pudo leer la lista de referencia de datos, pero el contenido de la plantilla aún se puede editar.
        <Button variant="ghost" size="sm" onClick={() => void state.referenceQuery.refetch()}>Reintentar lista de referencias</Button>
      </div> : null}
      <div>
        <label className="text-sm font-medium" htmlFor="prompt-template-notes">Comentarios de versión (opcional)</label>
        <Input id="prompt-template-notes" value={state.notes} onChange={(event) => state.setNotes(event.target.value)}
          maxLength={2000} placeholder="Por ejemplo: diálogos más cortos y menos explicaciones narrativas." className="mt-2 shadow-none" disabled={busy} />
      </div>
      {props.showTestResult !== false ? <PromptTestRunResultPanel result={props.testRun ?? null}
        isPending={props.testRunPending} error={props.testRunError} streamOutput={props.testRunStreamOutput} /> : null}
      {preview ? (
        <details open className="border-t border-border pt-4">
          <summary className="cursor-pointer text-sm font-medium">Vista previa de contenido e inspección de datos</summary>
          {diagnostics ? <div className="mt-3 space-y-1 text-xs text-muted-foreground">
            <p>Información citada:{formatDiagnosticKeys(diagnostics.referencedContextGroups, "context")}</p>
            <p>Datos requeridos para autocompletar:{formatDiagnosticKeys(diagnostics.fallbackRequiredGroups, "context")}</p>
            <p>Variables de tarea:{formatDiagnosticKeys(diagnostics.referencedInputFields, "input")}</p>
            <p>Configuraciones comunes:{formatDiagnosticKeys(diagnostics.referencedSlotKeys, "slot")}</p>
            {diagnostics.unknownTokens.length ? <p className="text-destructive">Referencia no reconocida:{diagnostics.unknownTokens.join(",")}</p> : null}
          </div> : null}
          {preview.messages.map((message, index) => <div key={index} className="mt-3 rounded-md bg-muted/40 p-3">
            <div className="mb-2 text-xs font-medium">{message.role}</div>
            <pre className="max-h-80 overflow-auto whitespace-pre-wrap text-xs leading-relaxed">{message.content}</pre>
          </div>)}
        </details>
      ) : null}
      {state.canPersist ? <details className="border-t border-border pt-4">
        <summary className="cursor-pointer text-sm font-medium">Historial de versiones de este libro · {state.view?.versions.length ?? 0} Versiones</summary>
        {state.view?.versions.length ? state.view.versions.map((version) => <VersionRow key={version.id}
          version={version} activeVersionId={state.view?.activeVersionId} disabled={busy}
          onLoad={state.loadVersionToDraft} onActivate={(id) => state.activateMutation.mutate(id)} />)
          : <p className="pt-3 text-sm text-muted-foreground">Después de guardar la plantilla, puede recuperar versiones históricas aquí.</p>}
      </details> : null}
    </div>
  );
}
