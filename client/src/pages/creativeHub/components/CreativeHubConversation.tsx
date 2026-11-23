import {
  AssistantRuntimeProvider,
  ComposerPrimitive,
  ThreadPrimitive,
  type AssistantRuntime,
} from "@assistant-ui/react";
import type { FailureDiagnostic } from "@ai-novel/shared/types/agent";
import type { CreativeHubInterrupt } from "@ai-novel/shared/types/creativeHub";
import { RefreshCw } from "lucide-react";
import { WorkspaceStateNotice } from "@/components/workspace";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CreativeHubInlineControlsProvider } from "./CreativeHubInlineControlsContext";
import {
  CreativeHubAssistantMessage,
  CreativeHubEditComposer,
  CreativeHubUserMessage,
} from "./CreativeHubMessagePrimitives";

interface CreativeHubConversationProps {
  runtime: AssistantRuntime;
  onQuickAction?: (prompt: string) => void;
  interrupt?: CreativeHubInterrupt;
  approvalNote?: string;
  onApprovalNoteChange?: (value: string) => void;
  onResolveInterrupt?: (action: "approve" | "reject") => void;
  approvalPending?: boolean;
  diagnostics?: FailureDiagnostic;
  loading?: boolean;
  errorMessage?: string;
  onRetry?: () => void;
  actionDisabled?: boolean;
}

export default function CreativeHubConversation({
  runtime,
  onQuickAction,
  interrupt,
  approvalNote,
  onApprovalNoteChange,
  onResolveInterrupt,
  approvalPending = false,
  diagnostics,
  loading = false,
  errorMessage = "",
  onRetry,
  actionDisabled = false,
}: CreativeHubConversationProps) {
  return (
    <CreativeHubInlineControlsProvider
      value={{
        interrupt,
        approvalNote: approvalNote ?? "",
        approvalPending,
        actionDisabled,
        diagnostics,
        onApprovalNoteChange,
        onResolveInterrupt,
        onQuickAction: actionDisabled ? undefined : onQuickAction,
      }}
    >
      <AssistantRuntimeProvider runtime={runtime}>
        <Card className="flex h-full min-h-0 flex-col overflow-hidden rounded-lg shadow-none">
          <CardHeader>
            <CardTitle className="text-base">Registro de promoción de creación.</CardTitle>
          </CardHeader>
          <CardContent className="flex min-h-0 flex-1 flex-col">
            {loading ? (
              <WorkspaceStateNotice
                loading
                tone="info"
                title="Leyendo el hilo actual"
                description="Los mensajes del hilo anterior no se mostrarán hasta que se complete la carga."
              />
            ) : errorMessage ? (
              <WorkspaceStateNotice
                tone="danger"
                title="El hilo actual no se pudo cargar"
                description={`${errorMessage} Las novelas guardadas y otros hilos no se verán afectados.`}
                action={onRetry ? (
                  <Button type="button" size="sm" variant="outline" onClick={onRetry}>
                    <RefreshCw className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                    recargar
                  </Button>
                ) : null}
              />
            ) : (
              <ThreadPrimitive.Root className="flex min-h-0 flex-1 flex-col space-y-4">
                <ThreadPrimitive.Viewport
                  className="min-h-0 flex-1 space-y-4 overflow-y-auto rounded-md border border-border/70 bg-muted/20 p-4"
                  aria-live="polite"
                >
                  <ThreadPrimitive.Empty>
                    <div className="mx-auto mt-8 max-w-xl rounded-md border border-dashed border-border px-5 py-8 text-center">
                      <h3 className="text-base font-semibold tracking-normal text-foreground">Ver el estado actual de la novela</h3>
                      <p className="mt-2 text-sm leading-6 text-muted-foreground">
                        Utilice el portal anterior para verificar el progreso, diagnosticar problemas o conocer el siguiente paso; También puede describir directamente lo que desea consultar.
                      </p>
                    </div>
                  </ThreadPrimitive.Empty>
                  <ThreadPrimitive.Messages
                    components={{
                      UserMessage: CreativeHubUserMessage,
                      AssistantMessage: CreativeHubAssistantMessage,
                      EditComposer: CreativeHubEditComposer,
                    }}
                  />
                </ThreadPrimitive.Viewport>
                <ComposerPrimitive.Root className="rounded-md border border-border bg-background p-3">
                  <ComposerPrimitive.Input
                    className="min-h-[110px] w-full resize-none rounded-md border border-input bg-muted/20 p-3 text-base text-foreground outline-none transition focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60 md:text-sm"
                    placeholder="Pregunte sobre el progreso novedoso, el motivo del fracaso, el registro de ejecución o la entrada del siguiente paso; Ingrese para enviar, Mayús+Intro para cambiar de línea."
                    submitMode="enter"
                    disabled={actionDisabled}
                    aria-label="Consulta de estado o problema de diagnóstico."
                  />
                  <div className="mt-3 flex gap-2">
                    <ComposerPrimitive.Send asChild>
                      <Button type="button" size="sm" disabled={actionDisabled}>Enviar</Button>
                    </ComposerPrimitive.Send>
                    <ComposerPrimitive.Cancel asChild>
                      <Button type="button" size="sm" variant="outline">Detener</Button>
                    </ComposerPrimitive.Cancel>
                  </div>
                </ComposerPrimitive.Root>
              </ThreadPrimitive.Root>
            )}
          </CardContent>
        </Card>
      </AssistantRuntimeProvider>
    </CreativeHubInlineControlsProvider>
  );
}
