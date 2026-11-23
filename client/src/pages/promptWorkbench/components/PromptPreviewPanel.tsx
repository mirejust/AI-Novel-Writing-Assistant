import { LockKeyhole } from "lucide-react";
import type { PromptPreviewResult, PromptTestRunResult } from "@/api/promptWorkbench";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MESSAGE_ROLE_LABELS } from "../promptWorkbenchLabels";

function JsonBlock({ value }: { value: unknown }) {
  return (
    <pre className="max-h-52 overflow-auto rounded-md bg-slate-950 p-3 text-xs leading-relaxed text-slate-100">
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}

export function PromptTestRunResultPanel(props: {
  result: PromptTestRunResult | null;
  isPending?: boolean;
  error?: string | null;
  streamOutput?: string;
}) {
  const { error, isPending, result, streamOutput = "" } = props;
  if (isPending) {
    return (
      <div className="rounded-md border border-amber-200 bg-amber-50/75 p-4 text-sm text-amber-900">
        <div>{streamOutput ? "Mostrando continuamente contenido de devolución de modelos." : "Llamar al modelo usando el borrador actual, esperando que regrese el primer párrafo."}</div>
        {streamOutput ? (
          <pre className="mt-3 max-h-[420px] overflow-auto whitespace-pre-wrap rounded-md bg-slate-950 p-3 text-xs leading-relaxed text-slate-100">
            {streamOutput}
          </pre>
        ) : null}
      </div>
    );
  }
  if (error) {
    return (
      <div className="rounded-md border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
        {error}
      </div>
    );
  }
  if (!result) {
    return null;
  }

  const usage = result.meta.tokenUsage;

  return (
    <div className="space-y-3 rounded-md border border-[#d8e2de] bg-white p-4 shadow-[0_8px_24px_rgba(20,54,48,0.06)]">
      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="text-sm font-semibold text-[#25443f]">Salida de prueba del modelo</div>
          <div className="mt-1 text-xs text-muted-foreground">
            {result.meta.provider ?? "enrutamiento rápido de palabras"} / {result.meta.model ?? "Modelo predeterminado"} · {result.meta.latencyMs}ms
          </div>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          <Badge variant="outline">{result.outputType === "structured" ? "Estructurado" : "Texto"}</Badge>
          {usage ? (
            <Badge variant="outline">
              Token {usage.totalTokens ?? "--"}
              {usage.inputTokens != null || usage.outputTokens != null
                ? `(${usage.inputTokens ?? "--"} / ${usage.outputTokens ?? "--"})`
                : ""}
            </Badge>
          ) : null}
          {result.meta.repairUsed ? (
            <Badge variant="outline">corrección JSON {result.meta.repairAttempts ?? 0} De segunda categoría</Badge>
          ) : null}
        </div>
      </div>
      <pre className="max-h-[420px] overflow-auto whitespace-pre-wrap rounded-md bg-slate-950 p-3 text-xs leading-relaxed text-slate-100">
        {result.outputText}
      </pre>
      {result.diagnostics.notes.length > 0 ? (
        <div className="rounded-md bg-[#f8fbfa] px-3 py-2 text-xs text-muted-foreground">
          {result.diagnostics.notes.join(" ")}
        </div>
      ) : null}
    </div>
  );
}

export function PromptPreviewPanel(props: {
  preview: PromptPreviewResult | null;
  testRun?: PromptTestRunResult | null;
  testRunPending?: boolean;
  testRunError?: string | null;
  testRunStreamOutput?: string;
}) {
  const { preview, testRun = null, testRunError = null, testRunPending = false, testRunStreamOutput = "" } = props;
  if (!preview) {
    return (
      <div className="space-y-3">
        <PromptTestRunResultPanel result={testRun} isPending={testRunPending} error={testRunError} streamOutput={testRunStreamOutput} />
        <div className="rounded-md border border-dashed border-[#cbdad6] bg-white/70 p-5 text-sm text-muted-foreground">
          Después de hacer clic en "Generar vista previa" en la parte inferior, podrá ver los mensajes finales, la selección de contexto y los resultados del diagnóstico.
        </div>
      </div>
    );
  }

  const defaultTab = preview.messages[0]
    ? `${preview.messages[0].role}-0`
    : "diagnostics";

  return (
    <div className="space-y-4">
      <PromptTestRunResultPanel result={testRun} isPending={testRunPending} error={testRunError} streamOutput={testRunStreamOutput} />

      <div className="grid overflow-hidden rounded-md border border-[#d8e2de] bg-white md:grid-cols-4 md:divide-x md:divide-[#d8e2de]">
        <div className="bg-[#f8fbfa] p-3">
          <div className="text-xs text-muted-foreground">Entrada</div>
          <div className="mt-1 truncate text-sm font-semibold text-[#25443f]">{preview.diagnostics.entrypoint}</div>
        </div>
        <div className="bg-[#fbfdfb] p-3">
          <div className="text-xs text-muted-foreground">Token de estimación</div>
          <div className="mt-1 text-sm font-semibold text-[#0f766e]">{preview.context.estimatedInputTokens}</div>
        </div>
        <div className="bg-[#f4f7ff] p-3">
          <div className="text-xs text-muted-foreground">Inyectado</div>
          <div className="mt-1 text-sm font-semibold text-[#344d7a]">{preview.context.selectedBlockIds.length}</div>
        </div>
        <div className="bg-[#fff7e8] p-3">
          <div className="text-xs text-muted-foreground">Elemento faltante</div>
          <div className="mt-1 text-sm font-semibold text-[#7a5620]">{preview.diagnostics.missingRequiredGroups.length}</div>
        </div>
      </div>

      {preview.diagnostics.notes.length > 0 ? (
        <div className="rounded-md border border-amber-200/80 bg-amber-50/70 px-3 py-2 text-sm text-amber-900">
          {preview.diagnostics.notes.join(" ")}
        </div>
      ) : null}

      <Tabs key={`${preview.prompt.key}:${preview.context.estimatedInputTokens}`} defaultValue={defaultTab}>
        <TabsList className="max-w-full overflow-x-auto">
          {preview.messages.map((message, index) => (
            <TabsTrigger key={`${message.role}-${index}`} value={`${message.role}-${index}`}>
              {MESSAGE_ROLE_LABELS[message.role] ?? message.role}
            </TabsTrigger>
          ))}
          <TabsTrigger value="diagnostics">Diagnóstico</TabsTrigger>
        </TabsList>

        {preview.messages.map((message, index) => (
          <TabsContent key={`${message.role}-${index}`} value={`${message.role}-${index}`}>
            <div className="overflow-hidden rounded-md border border-[#d8e2de] bg-white shadow-[0_8px_24px_rgba(20,54,48,0.06)]">
              <div className="flex items-center justify-between gap-3 border-b border-[#dce8e4] bg-[#f8fbfa] px-3 py-2">
                <div className="flex items-center gap-2 text-xs font-semibold text-[#52606d]">
                  <LockKeyhole className="h-3.5 w-3.5" />
                  {MESSAGE_ROLE_LABELS[message.role] ?? message.role}
                </div>
                <Badge variant="outline" className="border-[#cbdad6] bg-white text-[#52606d]">Solo lectura</Badge>
              </div>
              <pre className="max-h-[520px] overflow-auto whitespace-pre-wrap p-4 text-xs leading-relaxed text-[#1f2937]">
                {message.content}
              </pre>
            </div>
          </TabsContent>
        ))}

        <TabsContent value="diagnostics">
          <JsonBlock
            value={{
              selectedBlockIds: preview.context.selectedBlockIds,
              droppedBlockIds: preview.context.droppedBlockIds,
              summarizedBlockIds: preview.context.summarizedBlockIds,
              missingRequiredGroups: preview.diagnostics.missingRequiredGroups,
              resolverErrors: preview.diagnostics.resolverErrors,
              tracePreview: preview.diagnostics.tracePreview,
            }}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
