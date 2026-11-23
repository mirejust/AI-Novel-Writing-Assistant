import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight, Check, Copy, FileText, RefreshCw } from "lucide-react";
import { getCreationFlowTemplate } from "@/api/promptWorkbench";
import { Button } from "@/components/ui/button";

export type OpenCatalog = (prompt: { id: string; version: string }) => void;
export function PromptText({ templateKey, onOpenCatalog }: { templateKey: string; onOpenCatalog: OpenCatalog }) {
  const query = useQuery({
    queryKey: ["prompt-workbench", "creation-flow-template", templateKey],
    queryFn: () => getCreationFlowTemplate(templateKey), staleTime: 5 * 60 * 1000,
  });
  const [copyStatus, setCopyStatus] = useState<"idle" | "done" | "failed">("idle");
  if (query.isPending) return <p className="reader-status" role="status">Leyendo la palabra clave completa...</p>;
  if (query.isError) return <div className="reader-status" role="alert">
    <p>No se pudo leer la palabra rápida.</p><Button size="sm" variant="ghost" onClick={() => void query.refetch()}><RefreshCw size={14} />Releer</Button>
  </div>;
  const { messages, version } = query.data;
  const roleName = (role: string) => ({ system: "Comandos del sistema", human: "Entrada de tarea", user: "Entrada de tarea", ai: "Mensaje modelo", assistant: "Mensaje modelo" })[role] ?? role;
  async function copy() {
    try {
      await navigator.clipboard.writeText(messages.map(m => `[${roleName(m.role)}]\\n${m.content}`).join("\n\n"));
      setCopyStatus("done");
    } catch { setCopyStatus("failed"); }
  }
  return <>
    <div className="reader-section-title"><h3>Palabra de aviso completa</h3><span className="reader-version">{version}</span>
      <button type="button" className="reader-copy" onClick={() => void copy()} aria-live="polite">
        {copyStatus === "done" ? <Check size={14} /> : <Copy size={14} />}{copyStatus === "done" ? "Copiado" : "Copiar texto completo"}
      </button>
    </div>
    {copyStatus === "failed" && <p className="reader-status" role="status">La copia falló, puede seleccionar el texto original a continuación para copiarlo manualmente.</p>}
    <p className="reader-note">La plantilla oficial se amplía según las condiciones del ejemplo. Los materiales completados durante la creación se encuentran en los &lt;corchetes angulares&gt;.
      <button type="button" onClick={() => onOpenCatalog({ id: query.data.id, version })}>Abrir en directorio<ArrowUpRight size={12} /></button>
    </p>
    {messages.map((message, index) => <section className="reader-message" key={index}>
      <h4><FileText size={14} aria-hidden />{roleName(message.role)}<span>{String(index + 1).padStart(2, "0")}</span></h4>
      <div className="reader-prose">{message.content.split(/(〈[^〈〉\r\n]+〉|【[^【】\r\n]+】)/gu).map((part, i) =>
        part.startsWith("«") && part.endsWith("»") ? <mark key={i}>{part}</mark>
          : part.startsWith("[") && part.endsWith("]") ? <strong key={i}>{part}</strong> : part)}</div>
    </section>)}
  </>;
}
