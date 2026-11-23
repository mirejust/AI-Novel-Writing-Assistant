import { relationsFor } from "../atlas/stepPromptRelations";

export function PromptConnections({ id, open }: { id: string; open: (id: string) => void }) {
  const links = relationsFor(id);
  if (!links.length) return null;
  const fromStep = links[0].stepId === id;
  return <dl className="map-reader-connections" aria-label="Conexiones en la imagen.">
    {(["uses", "companion"] as const).map(kind => {
      const group = links.filter(link => link.kind === kind);
      if (!group.length) return null;
      const label = fromStep ? (kind === "uses" ? "Utilice este paso" : "Herramientas de apoyo") : (kind === "uses" ? "Pasos de uso" : "Pasos de cooperación");
      return <div key={kind} data-kind={kind}><dt>{label}</dt><dd>
        {group.map(link => <button key={link.stepId + link.promptId} type="button" onClick={() => open(fromStep ? link.promptId : link.stepId)}>
          {fromStep ? link.promptTitle : link.stepTitle}</button>)}
      </dd></div>;
    })}
  </dl>;
}
