import type {
  AuditReport,
  Chapter,
  ReplanRecommendation,
  ReplanResult,
  StoryPlan,
  StoryStateSnapshot,
} from "@ai-novel/shared/types/novel";
import type { SSEFrame } from "@ai-novel/shared/types/api";
import type { ChapterRuntimePackage } from "@ai-novel/shared/types/chapterRuntime";
import {
  readChapterQualityDebtDetails,
  type ChapterQualityDebtDetails,
  type ChapterQualityDebtSource,
} from "@ai-novel/shared/types/chapterQualityLoop";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import StreamOutput from "@/components/common/StreamOutput";
import {
  ChapterRuntimeAuditCard,
  ChapterRuntimeContextCard,
  ChapterRuntimeLengthCard,
} from "../ChapterRuntimePanels";
import {
  hasText,
  parseChapterScenePlanForDisplay,
  type AssetTabKey,
  MetricBadge,
} from "../chapterExecution.shared";

interface ChapterExecutionReferencePanelProps {
  selectedChapter?: Chapter;
  assetTab: AssetTabKey;
  onAssetTabChange: (tab: AssetTabKey) => void;
  chapterPlan?: StoryPlan | null;
  latestStateSnapshot?: StoryStateSnapshot | null;
  chapterAuditReports: AuditReport[];
  replanRecommendation?: ReplanRecommendation | null;
  onReplanChapter: () => void;
  isReplanningChapter: boolean;
  lastReplanResult?: ReplanResult | null;
  chapterQualityReport?: {
    coherence: number;
    repetition: number;
    pacing: number;
    voice: number;
    engagement: number;
    overall: number;
    issues?: string | null;
  };
  chapterRuntimePackage?: ChapterRuntimePackage | null;
  reviewResult: {
    issues?: Array<{ category: string; fixSuggestion: string }>;
  } | null;
  openAuditIssues: Array<{ id: string; auditType: string; fixSuggestion: string }>;
  repairStreamContent: string;
  isRepairStreaming: boolean;
  repairStreamingChapterId?: string | null;
  repairStreamingChapterLabel?: string | null;
  repairRunStatus?: Extract<SSEFrame, { type: "run_status" }> | null;
  onAbortRepair: () => void;
}

function PanelHintCard(props: { title: string; content: string }) {
  return (
    <div className="rounded-xl border border-border/70 bg-background/90 p-3">
      <div className="text-xs text-muted-foreground">{props.title}</div>
      <div className="mt-2 text-sm leading-6 text-foreground">{props.content}</div>
    </div>
  );
}

function ReferenceNotice(props: { title: string; description: string }) {
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50/90 p-3 text-sm text-amber-900">
      <div className="font-medium">{props.title}</div>
      <div className="mt-1 leading-6 text-amber-800">{props.description}</div>
    </div>
  );
}

const QUALITY_DEBT_SOURCE_LABELS: Record<ChapterQualityDebtSource, string> = {
  manual_review: "Revisión manual",
  pipeline_review: "Revisión de texto de IA",
  repair_recheck: "Revisión después de la corrección de IA",
};

function formatQualityDebtAttempts(details: ChapterQualityDebtDetails): string {
  if (details.repairAttemptsUsed === null) {
    return `No se ha registrado el número de veces · Actualmente el más ${details.repairAttemptsAllowed} veces`;
  }
  if (details.repairAttemptsAllowed === 0) {
    return `${details.repairAttemptsUsed} veces · La reparación automática no está habilitada esta vez`;
  }
  return `${details.repairAttemptsUsed}/${details.repairAttemptsAllowed} veces`;
}

function formatQualityDebtTime(value: string | null): string {
  if (!value) return "Tiempo no registrado";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Tiempo no registrado"
    : date.toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function ChapterExecutionReferencePanel(props: ChapterExecutionReferencePanelProps) {
  const {
    selectedChapter,
    assetTab,
    onAssetTabChange,
    chapterPlan,
    latestStateSnapshot,
    chapterAuditReports,
    replanRecommendation,
    onReplanChapter,
    isReplanningChapter,
    lastReplanResult,
    chapterQualityReport,
    chapterRuntimePackage,
    reviewResult,
    openAuditIssues,
    repairStreamContent,
    isRepairStreaming,
    repairStreamingChapterId,
    repairStreamingChapterLabel,
    repairRunStatus,
    onAbortRepair,
  } = props;

  if (!selectedChapter) {
    return (
      <div className="rounded-2xl border border-dashed border-border/70 bg-background p-4 text-sm leading-6 text-muted-foreground">
        Después de seleccionar un capítulo, aquí se mostrarán órdenes de tareas, desmontajes de escenas, comentarios de calidad, registros de reparación e información de diagnóstico.
      </div>
    );
  }

  const runtimePackage = chapterRuntimePackage?.chapterId === selectedChapter.id ? chapterRuntimePackage : null;
  const chapterObjective = chapterPlan?.objective ?? selectedChapter.expectation ?? "Aún no hay un objetivo claro para este capítulo, por lo que se recomienda elaborar primero el plan del capítulo.";
  const scenePlan = parseChapterScenePlanForDisplay(selectedChapter);
  const isSelectedChapterRepairStreaming = isRepairStreaming && repairStreamingChapterId === selectedChapter.id;
  const isSelectedChapterRepairFinalizing = isSelectedChapterRepairStreaming && repairRunStatus?.phase === "finalizing";
  const visibleRepairStreamContent = repairStreamingChapterId === selectedChapter.id ? repairStreamContent : "";
  const hasVisibleRepairOutput = hasText(visibleRepairStreamContent);
  const repairingOtherChapter = isRepairStreaming && repairStreamingChapterId && repairStreamingChapterId !== selectedChapter.id;
  const detailTab = assetTab === "content" ? "taskSheet" : assetTab;
  const qualityDebt = readChapterQualityDebtDetails(selectedChapter.riskFlags);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border/70 bg-background p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-base font-semibold text-foreground">Diagnóstico de datos</div>
            <div className="mt-1 text-sm leading-6 text-muted-foreground">
              Vea las tareas, la calidad y la base de reparación de este capítulo, que no ocupa el área principal de lectura del texto.
            </div>
          </div>
          <Badge variant="outline" className="shrink-0">Cap.{selectedChapter.order}Cap.</Badge>
        </div>
      </div>

      {qualityDebt ? (
        <div className="rounded-2xl bg-amber-50/80 p-4 text-sm text-amber-950">
          <div className="font-semibold">Artículos de calidad que se reciclarán en este capítulo.</div>
          <div className="mt-2 leading-6 text-amber-900/85">{qualityDebt.reason}</div>
          <div className="mt-3 grid gap-2 text-xs text-amber-900/75 sm:grid-cols-2">
            <span>Fuente:{qualityDebt.source ? QUALITY_DEBT_SOURCE_LABELS[qualityDebt.source] : "Registros históricos de calidad"}</span>
            <span>Reparación automática:{formatQualityDebtAttempts(qualityDebt)}</span>
            <span>Tiempo de grabación:{formatQualityDebtTime(qualityDebt.evaluatedAt)}</span>
          </div>
          {qualityDebt.issueCodes.length > 0 ? (
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              <span className="mr-1 text-xs text-amber-900/70">Signo de interrogación</span>
              {qualityDebt.issueCodes.map((code) => <Badge key={code} variant="secondary">{code}</Badge>)}
            </div>
          ) : null}
          <Button asChild size="sm" variant="outline" className="mt-3 bg-background text-foreground">
            <Link to={`/novels/${selectedChapter.novelId}/edit?stage=pipeline&chapterId=${encodeURIComponent(selectedChapter.id)}`}>
              Ingrese a la reparación de calidad
            </Link>
          </Button>
        </div>
      ) : null}

      <Tabs value={detailTab} onValueChange={(value) => onAssetTabChange(value as AssetTabKey)}>
        <TabsList className="grid h-auto w-full grid-cols-2 gap-1 rounded-2xl bg-muted/50 p-1.5">
          <TabsTrigger value="taskSheet" className="rounded-xl text-xs">Hoja de tareas</TabsTrigger>
          <TabsTrigger value="sceneCards" className="rounded-xl text-xs">Escena</TabsTrigger>
          <TabsTrigger value="quality" className="rounded-xl text-xs">Calidad</TabsTrigger>
          <TabsTrigger value="repair" className="rounded-xl text-xs">Reparación</TabsTrigger>
          <TabsTrigger value="content" className="col-span-2 rounded-xl text-xs">Diagnóstico contextual</TabsTrigger>
        </TabsList>

        <TabsContent value="taskSheet" className="space-y-3">
          <div className="rounded-2xl border bg-muted/20 p-4">
            <div className="text-xs text-muted-foreground">Hoja de tareas para este capítulo.</div>
            <div className="mt-3 whitespace-pre-wrap text-sm leading-7">
              {selectedChapter.taskSheet?.trim() || "Aún no hay órdenes de tareas. Puede dejar que la IA genere la lista de tareas primero y luego regresar y continuar escribiendo el capítulo."}
            </div>
          </div>
          <PanelHintCard title="Objetivo del capítulo" content={chapterObjective} />
          <PanelHintCard title="Último estado" content={latestStateSnapshot?.summary || "Aún no hay ningún resumen de estado disponible."} />
          <ChapterRuntimeContextCard
            runtimePackage={runtimePackage}
            chapterPlan={chapterPlan}
            stateSnapshot={latestStateSnapshot}
          />
        </TabsContent>

        <TabsContent value="sceneCards" className="space-y-3">
          <ChapterRuntimeLengthCard runtimePackage={runtimePackage} />
          {scenePlan ? (
            <div className="space-y-3">
              <div className="rounded-2xl border bg-muted/20 p-4">
                <div className="text-xs text-muted-foreground">contrato de presupuesto de escena</div>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <MetricBadge label="Objetivo del capítulo" value={`${scenePlan.targetWordCount} palabras`} />
                  <MetricBadge label="Número de escenas" value={String(scenePlan.scenes.length)} />
                </div>
              </div>
              {scenePlan.scenes.map((scene, index) => (
                <div key={scene.key} className="rounded-2xl border bg-background p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">escena {index + 1}</Badge>
                    <Badge variant="secondary">{scene.targetWordCount} Palabras</Badge>
                  </div>
                  <div className="mt-3 text-sm font-semibold text-foreground">{scene.title}</div>
                  <div className="mt-2 text-sm leading-6 text-muted-foreground">{scene.purpose}</div>
                  <div className="mt-3 space-y-2">
                    <PanelHintCard title="Debe avanzar" content={scene.mustAdvance.join(";") || "Ninguno"} />
                    <PanelHintCard title="Debe ser retenido" content={scene.mustPreserve.join(";") || "Ninguno"} />
                    <PanelHintCard title="Estado inicial" content={scene.entryState} />
                    <PanelHintCard title="Estado final" content={scene.exitState} />
                  </div>
                  {scene.forbiddenExpansion.length > 0 ? (
                    <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50/70 p-3 text-sm leading-6 text-amber-900">
                      Prohibida la ampliación:{scene.forbiddenExpansion.join(";")}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border bg-muted/20 p-4">
              <div className="text-xs text-muted-foreground">Desmontaje de escena</div>
              <div className="mt-3 whitespace-pre-wrap text-sm leading-7">
                {selectedChapter.sceneCards?.trim()
                  ? "La versión actual es una versión antigua del texto de desmontaje de la escena. Se recomienda regenerar el contrato de ejecución del capítulo."
                  : "Aún no hay un desglose de la escena."}
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="quality" className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <MetricBadge label="En general" value={String(chapterQualityReport?.overall ?? selectedChapter.qualityScore ?? "-")} />
            <MetricBadge label="Coherencia" value={String(chapterQualityReport?.coherence ?? "-")} />
            <MetricBadge label="Repetibilidad" value={String(chapterQualityReport?.repetition ?? "-")} />
            <MetricBadge label="Ritmo" value={String(chapterQualityReport?.pacing ?? selectedChapter.pacingScore ?? "-")} />
            <MetricBadge label="Estilo de escritura" value={String(chapterQualityReport?.voice ?? "-")} />
            <MetricBadge label="Atracción" value={String(chapterQualityReport?.engagement ?? "-")} />
          </div>

          <div className="rounded-2xl border p-4 text-sm">
            <div className="font-semibold text-foreground">Problemas de revisión recientes</div>
            {reviewResult?.issues?.length ? (
              <div className="mt-3 space-y-2 text-xs text-muted-foreground">
                {reviewResult.issues.slice(0, 5).map((item, index) => (
                  <div key={`${item.category}-${index}`} className="rounded-xl border p-3">
                    <div className="font-medium text-foreground">{item.category}</div>
                    <div className="mt-1 leading-6">{item.fixSuggestion}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-3 text-xs leading-6 text-muted-foreground">Actualmente no hay problemas de revisión recientes.</div>
            )}
          </div>

          <div className="rounded-2xl border p-4 text-sm">
            <div className="font-semibold text-foreground">Preguntas de auditoría estructuradas</div>
            {openAuditIssues.length > 0 ? (
              <div className="mt-3 space-y-2 text-xs text-muted-foreground">
                {openAuditIssues.slice(0, 6).map((item) => (
                  <div key={item.id} className="rounded-xl border p-3">
                    <div className="font-medium text-foreground">{item.auditType}</div>
                    <div className="mt-1 leading-6">{item.fixSuggestion}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-3 text-xs leading-6 text-muted-foreground">Actualmente no hay preguntas de auditoría estructuradas.</div>
            )}
          </div>

          <ChapterRuntimeAuditCard
            runtimePackage={runtimePackage}
            auditReports={chapterAuditReports}
            replanRecommendation={replanRecommendation}
            onReplan={onReplanChapter}
            isReplanning={isReplanningChapter}
            lastReplanResult={lastReplanResult}
          />
        </TabsContent>

        <TabsContent value="repair" className="space-y-3">
          {repairingOtherChapter ? (
            <ReferenceNotice
              title="Hay otros capítulos en reparación en segundo plano."
              description={`${repairStreamingChapterLabel ?? "Otro capitulo"} Aún en reparación. El capítulo actual no mostrará el flujo de reparación de ese capítulo. Puedes seguir viéndolo volviendo al capítulo correspondiente.`}
            />
          ) : null}

          {(isSelectedChapterRepairStreaming || hasVisibleRepairOutput) ? (
            <StreamOutput
              title="Salida de solución de problemas"
              emptyText={isSelectedChapterRepairFinalizing
                ? (repairRunStatus?.message ?? "El texto de reparación se ha generado y el sistema lo está guardando y revisando.")
                : "Esperando resultado de corrección..."}
              content={visibleRepairStreamContent}
              isStreaming={isSelectedChapterRepairStreaming}
              onAbort={isSelectedChapterRepairFinalizing ? undefined : onAbortRepair}
            />
          ) : null}

          <div className="rounded-2xl border bg-muted/20 p-4">
            <div className="text-xs text-muted-foreground">Registro de reparación</div>
            <div className="mt-3 max-h-[420px] overflow-y-auto whitespace-pre-wrap text-sm leading-7">
              {selectedChapter.repairHistory?.trim() || "Aún no hay registro de reparación."}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="content" className="space-y-3">
          <ChapterRuntimeContextCard
            runtimePackage={null}
            chapterPlan={chapterPlan}
            stateSnapshot={latestStateSnapshot}
          />
          <ChapterRuntimeAuditCard
            runtimePackage={null}
            auditReports={chapterAuditReports}
            replanRecommendation={replanRecommendation}
            onReplan={onReplanChapter}
            isReplanning={isReplanningChapter}
            lastReplanResult={lastReplanResult}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
