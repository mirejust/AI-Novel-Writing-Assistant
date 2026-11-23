import type { ChapterEditorCursorOperation, ChapterEditorDiagnosticCard, ChapterEditorOperation, ChapterEditorRevisionScope } from "@ai-novel/shared/types/novel";
import { Button } from "@/components/ui/button";
import CursorAIToolbar from "../CursorAIToolbar";
import SelectionAIToolbar from "../SelectionAIToolbar";

export type ChapterEditorActionContext = "diagnostic" | "selection" | "cursor" | "chapter";

export interface ChapterEditorActionsProps {
  actionContext: ChapterEditorActionContext;
  selectedDiagnosticCard: ChapterEditorDiagnosticCard | null;
  cursorTargetDescription: string;
  selectionTargetDescription: string;
  revisionScope: ChapterEditorRevisionScope;
  revisionInstruction: string;
  canRunSelectionRevision: boolean;
  isGenerating: boolean;
  onInstructionChange: (next: string) => void;
  onScopeChange: (scope: ChapterEditorRevisionScope) => void;
  onRunSelectedDiagnostic: () => void;
  onRunFreeform: () => void;
  onRunCursorOperation: (operation: ChapterEditorCursorOperation) => void;
  onRunSelectionOperation: (operation: ChapterEditorOperation) => void;
}

export default function ChapterEditorActions(props: ChapterEditorActionsProps) {
  const { actionContext: context, selectedDiagnosticCard: card, isGenerating } = props;
  const title = context === "diagnostic" ? "Solucionar este problema" : context === "cursor" ? "Continuar escribiendo en el cursor"
    : context === "selection" ? "Modificar clip seleccionado" : "Modificación de texto";
  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-base font-medium">{title}</h3>
        <Button size="sm" variant="ghost" disabled={isGenerating} onClick={() => props.onScopeChange(props.revisionScope === "chapter" ? "selection" : "chapter")}>
          {props.revisionScope === "chapter" ? "Fragmento de retorno" : "Modificar todo el capítulo."}
        </Button>
      </div>
      {context === "diagnostic" && card ? (
        <div className="space-y-3 text-sm leading-6">
          <div className="font-medium">{card.title} <span className="ml-2 text-xs font-normal text-muted-foreground">{card.paragraphLabel || "Capítulo completo"}</span></div>
          <div><div className="text-xs text-muted-foreground">donde esta el problema</div><p>{card.problemSummary}</p></div>
          <div><div className="text-xs text-muted-foreground">Afecta la lectura</div><p>{card.whyItMatters}</p></div>
          <div><div className="text-xs text-muted-foreground">Prepárate para cambiar así</div><p>{card.repairApproach || card.repairGoal || "Generar un plan de revisión basado en este tema, conservando los hechos argumentales y la continuidad."}</p></div>
          {card.repairGoal ? <p className="text-muted-foreground">Objetivo:{card.repairGoal}</p> : null}
          {card.mustPreserve?.length ? <div className="rounded-lg bg-muted/30 p-3"><div className="text-xs text-muted-foreground">Guarda estos</div><ul className="mt-1 list-inside list-disc">{card.mustPreserve.map((item, index) => <li key={index}>{item}</li>)}</ul></div> : null}
        </div>
      ) : context === "cursor" ? (
        <CursorAIToolbar visible targetLabel={props.cursorTargetDescription} disabled={isGenerating} onRunOperation={props.onRunCursorOperation} />
      ) : context === "selection" ? (
        <SelectionAIToolbar visible targetLabel={props.selectionTargetDescription} disabled={isGenerating} onRunOperation={props.onRunSelectionOperation} />
      ) : (
        <p className="text-sm leading-6 text-muted-foreground">{props.revisionScope === "chapter" ? "Alcance de la modificación: texto completo del capítulo. Después de la generación, compare los candidatos antes de decidir si los adopta." : "Haga clic con el cursor en el texto o seleccione un fragmento, o puede optar por modificar todo el capítulo."}</p>
      )}
      <div className="space-y-3 border-t border-border/50 pt-4">
        <label htmlFor="chapter-editor-instruction" className="text-sm font-medium">Requisitos suplementarios{context === "diagnostic" || context === "cursor" ? "(opcional)" : ""}</label>
        <textarea id="chapter-editor-instruction" aria-label="Requisitos suplementarios" maxLength={800} className="min-h-[100px] w-full resize-y rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/30"
          placeholder="Por ejemplo: conservar el tono comedido de los personajes y reducir las descripciones repetitivas." value={props.revisionInstruction} onChange={(event) => props.onInstructionChange(event.target.value)} />
        <div className="flex justify-end">
          {context === "diagnostic" ? <Button size="sm" disabled={isGenerating || !card} onClick={props.onRunSelectedDiagnostic}>Generar plan de revisión</Button>
            : context === "cursor" ? <Button size="sm" disabled={isGenerating || !props.revisionInstruction.trim()} onClick={() => props.onRunCursorOperation("continue")}>Continuar según sea necesario</Button>
              : <Button size="sm" disabled={isGenerating || !props.revisionInstruction.trim() || (props.revisionScope === "selection" && !props.canRunSelectionRevision)} onClick={props.onRunFreeform}>Modificar según sea necesario</Button>}
        </div>
      </div>
    </div>
  );
}
