import type { LucideIcon } from "lucide-react";
import {
  BookOpenCheck,
  CircleAlert,
  Database,
  LoaderCircle,
  RefreshCw,
  SearchCheck,
  Upload,
} from "lucide-react";
import {
  AssetLibraryHeader,
  AssetLibraryRecommendation,
  type AssetLibraryTone,
} from "@/components/assetLibrary";
import OpenInCreativeHubButton from "@/components/creativeHub/OpenInCreativeHubButton";
import { Button } from "@/components/ui/button";

type RecommendationAction = "clear_filters" | "open_documents" | "open_ops" | "retry" | "upload";

interface RecommendationState {
  action: RecommendationAction;
  description: string;
  icon: LucideIcon;
  title: string;
  tone: AssetLibraryTone;
}

interface KnowledgeLibraryOverviewProps {
  activeJobCount: number;
  enabledCount: number;
  failedIndexDocumentCount: number;
  failedJobCount: number;
  hasFilters: boolean;
  isError: boolean;
  isLoading: boolean;
  searchableDocumentCount: number;
  selectedDocumentId?: string;
  visibleDocumentCount: number;
  onClearFilters: () => void;
  onOpenDocuments: () => void;
  onOpenOps: () => void;
  onRetry: () => void;
  onUpload: () => void;
}

function getRecommendation(props: KnowledgeLibraryOverviewProps): RecommendationState {
  if (props.isError) {
    return {
      action: "retry",
      description: "La lista de datos no se puede leer en este momento. La recarga no modificará los datos existentes ni las tareas de indexación.",
      icon: CircleAlert,
      title: "Recargar datos de conocimiento",
      tone: "danger",
    };
  }
  if (props.isLoading) {
    return {
      action: "open_documents",
      description: "El estado de los datos y los resultados del índice se están ordenando y el siguiente paso ejecutable se dará una vez que se complete la carga.",
      icon: LoaderCircle,
      title: "Leer información de conocimientos",
      tone: "neutral",
    };
  }
  if (props.activeJobCount > 0) {
    return {
      action: "open_ops",
      description: `${props.activeJobCount} Se está ejecutando una tarea de indexación y se puede ver el progreso; al crear se dará prioridad a los datos que hayan sido indexados.`,
      icon: RefreshCw,
      title: "Ver el progreso de la sincronización de datos",
      tone: "info",
    };
  }
  if (props.failedIndexDocumentCount > 0 || props.failedJobCount > 0) {
    return {
      action: "open_ops",
      description: "Algunos datos aún no han sido indexados. Primero verifique la causa del error y reconstruya el índice. Otros datos disponibles aún pueden seguir participando en la creación.",
      icon: CircleAlert,
      title: "Procesar indexación de datos sin terminar",
      tone: "warning",
    };
  }
  if (props.visibleDocumentCount === 0 && props.hasFilters) {
    return {
      action: "clear_filters",
      description: "No hay resultados coincidentes para los criterios de búsqueda o estado actuales. Borre el filtro para volver a la lista de información completa.",
      icon: SearchCheck,
      title: "Ver otros materiales de conocimiento",
      tone: "neutral",
    };
  }
  if (props.visibleDocumentCount === 0) {
    return {
      action: "upload",
      description: "Cargue un documento TXT y el sistema creará un índice para usarlo en la apertura, planificación y creación de texto de libros.",
      icon: Upload,
      title: "Primero agrega un material creativo.",
      tone: "info",
    };
  }
  if (props.searchableDocumentCount === 0) {
    return {
      action: "open_documents",
      description: "Aún no hay materiales habilitados e indexados en la lista. Seleccione un dato para habilitar o reconstruir el índice antes de que pueda usarse para la creación.",
      icon: Database,
      title: "Preparar un documento con capacidad de búsqueda",
      tone: "warning",
    };
  }
  return {
    action: "open_documents",
    description: `${props.searchableDocumentCount} Se puede incluir un dato en la búsqueda. Puede ver versiones, probar retiradas o seleccionar materiales para seguir creando.`,
    icon: BookOpenCheck,
    title: "Selecciona datos para seguir creando",
    tone: "success",
  };
}

export default function KnowledgeLibraryOverview(props: KnowledgeLibraryOverviewProps) {
  const recommendation = getRecommendation(props);
  const documentStatusUnavailable = props.isLoading || props.isError;

  const recommendationAction = (() => {
    switch (recommendation.action) {
      case "upload":
        return (
          <Button type="button" size="sm" onClick={props.onUpload}>
            <Upload className="h-4 w-4" />
            Subir información
          </Button>
        );
      case "retry":
        return (
          <Button type="button" size="sm" variant="outline" onClick={props.onRetry}>
            <RefreshCw className="h-4 w-4" />
            recargar
          </Button>
        );
      case "clear_filters":
        return (
          <Button type="button" size="sm" variant="outline" onClick={props.onClearFilters}>
            Limpiar filtros
          </Button>
        );
      case "open_ops":
        return (
          <Button type="button" size="sm" variant="outline" onClick={props.onOpenOps}>
            Ver estado del índice
          </Button>
        );
      default:
        if (props.isLoading) {
          return (
            <Button type="button" size="sm" variant="outline" disabled>
              Cargando
            </Button>
          );
        }
        return (
          <Button type="button" size="sm" variant="outline" onClick={props.onOpenDocuments}>
            Ver perfil
          </Button>
        );
    }
  })();

  return (
    <>
      <AssetLibraryHeader
        icon={Database}
        context="Activos de Creación · Conocimiento y Recuperación"
        title="Base de datos de conocimientos"
        description="Administre de forma centralizada materiales creativos reutilizables, confirme el estado del índice y luego incorpore contenido confiable a la apertura, planificación y creación de textos de libros."
        actions={(
          <>
            <Button type="button" onClick={props.onUpload}>
              <Upload className="h-4 w-4" />
              Subir información
            </Button>
            <OpenInCreativeHubButton
              bindings={{ knowledgeDocumentIds: props.selectedDocumentId ? [props.selectedDocumentId] : [] }}
              label="Enviar al centro creativo"
            />
          </>
        )}
      />

      <section aria-label="estado de los datos de conocimiento" className="flex flex-wrap items-center gap-x-6 gap-y-3 rounded-2xl bg-muted/25 px-5 py-3">
        {[
          { label: props.hasFilters ? "Filtrar resultados" : "Toda la información", value: documentStatusUnavailable ? "—" : props.visibleDocumentCount, dot: "bg-muted-foreground/45" },
          { label: "Activado", value: documentStatusUnavailable ? "—" : props.enabledCount, dot: "bg-success" },
          { label: "Buscable", value: documentStatusUnavailable ? "—" : props.searchableDocumentCount, dot: "bg-success" },
          { label: "Sincronizando", value: props.activeJobCount, dot: props.failedJobCount > 0 ? "bg-destructive" : "bg-info" },
        ].map((item) => (
          <div key={item.label} className="flex items-center gap-2 text-sm">
            <span className={`h-2 w-2 rounded-full ${item.dot}`} aria-hidden="true" />
            <span className="text-muted-foreground">{item.label}</span>
            <span className="font-semibold tabular-nums text-foreground">{item.value}</span>
          </div>
        ))}
        {props.failedJobCount > 0 ? (
          <span className="text-xs text-destructive">{props.failedJobCount} las tareas de indexación deben procesarse</span>
        ) : null}
      </section>

      {recommendation.tone !== "success" ? (
        <AssetLibraryRecommendation
          icon={recommendation.icon}
          title={recommendation.title}
          description={recommendation.description}
          tone={recommendation.tone}
          action={recommendationAction}
        />
      ) : null}
    </>
  );
}
