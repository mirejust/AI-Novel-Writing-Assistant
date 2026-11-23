import type { ShortStoryReferenceView } from "@ai-novel/shared/types/shortStoryReference";
import { Link } from "react-router-dom";

export function ShortStoryReferenceSummary({ reference, confirmed = true }: { reference: ShortStoryReferenceView; confirmed?: boolean }) {
  return (
    <section className="rounded-xl bg-muted/35 p-4 text-sm leading-6" aria-label="Referencia corta">
      <div className="font-medium">Novela de referencia:<Link className="text-primary underline-offset-4 hover:underline" to={`/book-analysis/${reference.analysisId}`}>{reference.sourceTitle}</Link></div>
      <p className="mt-1 text-xs text-muted-foreground">Versión del documento {reference.documentVersionNumber} · Aprovechar la estructura, el ritmo y la escritura para crear nuevas historias.</p>
      <p className="mt-2">{reference.goal}</p>
      {reference.sourceState !== "available" ? <p className="mt-2 text-amber-700 dark:text-amber-400">
        {confirmed
          ? reference.sourceState === "updated" ? "Hay contenido nuevo en el análisis de referencias. La base de referencia se guarda al confirmar el uso de la obra." : "La fuente de referencia no está disponible actualmente. La base de referencia para la conservación al confirmar la conservación de la obra."
          : reference.sourceState === "updated" ? "Hay contenido nuevo en el análisis de referencia, léalo nuevamente y verifique la dirección." : "La fuente de referencia no está disponible actualmente; seleccione una novela de referencia disponible."}
      </p> : null}
      <details className="mt-3 text-muted-foreground">
        <summary className="cursor-pointer">Ver contenido prestado y restricciones originales</summary>
        {[
          ["Estructura", reference.structureLessons], ["Ritmo", reference.pacingLessons],
          ["Método de escritura", reference.styleLessons], ["Retiro al final", reference.endingLessons], ["Restricciones de originalidad", reference.originalityConstraints],
        ].map(([label, items]) => <div className="mt-3" key={String(label)}>
          <div className="font-medium text-foreground">{label}</div>
          <ul className="list-disc pl-5">{(items as string[]).map((item, index) => <li key={index}>{item}</li>)}</ul>
        </div>)}
        {reference.endingEvidence === "not_available" ? <p className="mt-2">La conclusión seleccionada no proporciona la base para un final completo, y la creación preparará un nuevo final completo.</p> : null}
      </details>
    </section>
  );
}
