import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  DIRECTOR_CREATE_LINK,
  MANUAL_CREATE_LINK,
  PRIMARY_CREATE_LABEL,
  REFERENCE_CREATE_LABEL,
  REFERENCE_CREATE_LINK,
  SHORT_STORY_CREATE_LINK,
} from "./novelListViewModel";

export function NovelListEmptyState(props: {
  hasAnyNovel: boolean;
}) {
  return (
    <section className="py-12 text-center">
      <h2 className="text-xl font-semibold tracking-normal">
        {props.hasAnyNovel ? "No hay novelas que coincidan con los criterios de filtro." : "Aún no hay proyectos novedosos"}
      </h2>
      <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-muted-foreground">
        {props.hasAnyNovel
          ? "Puede alternar los filtros anteriores o crear un nuevo proyecto novedoso."
          : "Al usarlo por primera vez, se recomienda dejar que el director automático de IA organice primero la dirección, los personajes, la visión del mundo y la preparación del capítulo."}
      </p>
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        <Button asChild>
          <Link to={DIRECTOR_CREATE_LINK}>{PRIMARY_CREATE_LABEL}</Link>
        </Button>
        <Button asChild variant="secondary">
          <Link to={REFERENCE_CREATE_LINK}>{REFERENCE_CREATE_LABEL}</Link>
        </Button>
        {SHORT_STORY_CREATE_LINK ? (
          <Button asChild variant="outline">
            <Link to={SHORT_STORY_CREATE_LINK}>Crear historias cortas</Link>
          </Button>
        ) : null}
        <Button asChild variant="outline">
          <Link to={MANUAL_CREATE_LINK}>Crear una novela manualmente</Link>
        </Button>
      </div>
    </section>
  );
}
