import type { OutlineDocument } from "@ai-novel/shared/types/outline";
import type { OutlineConversationResult, OutlineConversationTurn } from "@ai-novel/shared/types/agentConversation/outline";
import { apiClient } from "@/api/client";
import { AgentConversation, type AgentConversationAdapter } from "@/components/agentConversation/AgentConversation";

const inline = { errorPresentation: "inline" } as const;
const labels: Record<string, string> = { pending: "Pendiente de confirmación", superseded: "Hay propuestas de seguimiento.", applied: "Adoptado", partially_applied: "Parcialmente adoptado", rejected: "Abandonado", stale: "El plan de estudios ha sido revisado." };
function proposalStatus(result: OutlineConversationResult, version: number) {
  if (result.status === "pending" && result.baseVersion !== version) return "El plan de estudios ha sido revisado.";
  const label = labels[result.status] ?? "Terminó";
  return result.adoptedVersion && ["applied", "partially_applied"].includes(result.status)
    ? `${label}por v${result.adoptedVersion}` : label;
}
const welcomeIdea = { title: "¿Con qué idea comienza la historia?", body: "Una persona, un accidente o incluso una imagen bastarán. Podemos hablar primero sobre la dirección y luego esbozar juntos la primera versión.",
  starters: [{ label: "Solo tengo una foto", text: "Tenía una imagen y quería comenzar una historia a partir de ella. ¿Puedes hacerme una pregunta primero?" },
    { label: "Encuentra una dirección de historia conmigo", text: "Aún no he decidido qué escribir. Por favor, dame dos direcciones de historia diferentes y déjame elegir una para continuar la conversación." }] };
const welcomeEdit = { title: "¿Cómo le gustaría ajustar todo el libro?", body: "Pueden ordenar juntos la línea principal, las relaciones de los personajes y la disposición de los capítulos. También puedes decirme qué parcelas quieres conservar.",
  starters: [{ label: "Vea si el capítulo inicial puede captar a los lectores.", text: "Lea el capítulo inicial y dígame qué es más atractivo y qué se puede cambiar. Hablemos primero de ideas." },
    { label: "Clasificando la colocación y el reciclaje de presagios.", text: "Ayúdame a ordenar los presagios del esquema que aún no se han recuperado y a proponer ajustes que se puedan aplicar a capítulos específicos." }] };

interface Props {
  projectId: string; version: number; document: OutlineDocument; starting: boolean; dirty: boolean;
  value: string; onChange: (value: string) => void; onSent: (turnId: string) => void; onOpenResult: (id: string) => void;
}
export function OutlineConversation({ projectId, version, document, starting, dirty, value, onChange, onSent, onOpenResult }: Props) {
  const queryKey = ["agent-conversation", "outline-workbench", projectId];
  const url = `/outlines/${projectId}/conversation`;
  const adapter: AgentConversationAdapter<OutlineConversationResult> = {
    streamUrl: turnId => apiClient.getUri({url: url + "/turns/" + encodeURIComponent(turnId) + "/stream"}),
    queryKey, load: async () => (await apiClient.get(url, inline)).data.data as OutlineConversationTurn[],
    send: async input => { const response = await apiClient.post(url + "/turns", { ...input, baseVersion: version }, inline); onSent(response.data.data.turnId); },
    interrupt: turnId => apiClient.post(url + "/interrupt", { turnId }, inline),
  };
  const idea = starting || !(document.story.premise || document.story.synopsis || document.chapters.length || document.volumes.length || document.characters.length || document.payoffs.length || document.facts.length);
  return <div className="outline-conversation-host">
    <AgentConversation adapter={adapter} confirmationHint="Escriba el esquema después de su confirmación." title="Asistente de esquema" context={`Esquema completo · Revisado v${version}`} welcome={idea ? welcomeIdea : welcomeEdit}
      inputLabel="Enviar un mensaje al Asistente de esquema" placeholder={idea ? "Anota la persona, imagen o línea que te viene a la cabeza..." : "¿Cómo le gustaría ajustar todo el contorno? ¿Qué puntos de la trama quieres conservar?"}
      followUpPlaceholder="¿Qué disposiciones desea conservar o ajustar en esta propuesta?"
      initialAction="Enviar al Asistente de esquema" followUpAction={(result, n) => result.draftSummary ? `Continuar discutiendo "${result.draftSummary.title}»` : `continuar la discusión ${n} propuesta redonda`} versionLabel={v => `Esquema v${v}`}
      maxLength={6000} disabled={dirty} value={value} onChange={onChange}
      canContinue={result => ["pending", "applied", "partially_applied"].includes(result.status)}
      describeResult={result => proposalStatus(result, version)}
      draftPreview={({ draftSummary: d }) => d && ({
        title: d.title, counts: `${d.volumeCount} rollo · ${d.chapterCount} Capítulo · ${d.characterCount} persona`,
      })}
      followUpTopic={(result, number) => result.draftSummary ? `Discutiendo "${result.draftSummary.title}»`
        : result.kind === "edit" ? `Discutiendo "${document.story.title}»Sugerencias de modificación` : `Discutiendo el ${number} primer borrador`}
      onOpenResult={onOpenResult} />
  </div>;
}
