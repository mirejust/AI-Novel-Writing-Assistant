import { useId, useState } from "react";
import { ChevronRight } from "lucide-react";
import type { AgentThinkingStep } from "@ai-novel/shared/types/agentConversation/turn";

function usageNote(tokens: number) {
  return `La modelo informó ${tokens} Ficha de pensamiento, no se proporciona ningún texto de pensamiento que se pueda mostrar.`;
}

export function AgentThinking({ steps, running }: { steps?: AgentThinkingStep[]; running: boolean }) {
  const id = useId();
  const [choice, setChoice] = useState<boolean | null>(null);
  if (!steps?.length) return null;
  if (!steps.some(step => step.text.trim())) {
    const tokens = steps.reduce((sum, step) => sum + (step.reasoningTokens ?? 0), 0);
    if (tokens > 0) return <p className="agent-thinking-note">{usageNote(tokens)}</p>;
    if (running) return null;
    return <p className="agent-thinking-note">{steps.every(step => step.enabled === false)
      ? "Esta ronda utiliza la configuración de solicitud para desactivar el pensamiento y el modelo no devuelve el texto del pensamiento."
      : "El modelo no devolvió texto de pensamiento visualizable."}</p>;
  }
  const expanded = choice ?? running;
  return <div className="agent-thinking">
    <button type="button" aria-controls={id} aria-expanded={expanded} onClick={() => setChoice(!expanded)}>
      <ChevronRight size={14} aria-hidden="true" />proceso de pensamiento
    </button>
    <div id={id} hidden={!expanded} className="agent-thinking-content">
      {steps.filter(step => step.text.trim() || step.reasoningTokens).map(step => <div key={step.stage}>
        {steps.length > 1 && <small>{step.stage}</small>}
        <p>{step.text.trim() ? step.text : usageNote(step.reasoningTokens!)}</p>
      </div>)}
    </div>
  </div>;
}
