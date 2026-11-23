interface WorldInjectionHintProps {
  worldInjectionSummary: string | null;
}

export default function WorldInjectionHint({ worldInjectionSummary }: WorldInjectionHintProps) {
  if (!worldInjectionSummary) {
    return (
      <div className="rounded-md bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
        En ausencia de un mundo de libros utilizable, el proceso de generación se basará primero en la información básica de la novela.
      </div>
    );
  }

  return (
    <details className="group rounded-md bg-muted/40 px-3 py-2 text-xs">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-medium">
        <span>El mundo del libro ha sido utilizado para esta generación.</span>
        <span className="text-muted-foreground group-open:hidden">Comprobar los detalles</span>
        <span className="hidden text-muted-foreground group-open:inline">Contraer detalles</span>
      </summary>
      <pre className="mt-3 max-h-48 overflow-auto whitespace-pre-wrap border-t pt-3 text-muted-foreground">
        {worldInjectionSummary}
      </pre>
    </details>
  );
}
