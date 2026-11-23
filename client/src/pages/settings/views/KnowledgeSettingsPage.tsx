import { useQuery } from "@tanstack/react-query";
import { Database, ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";
import { getRagSettings } from "@/api/settings";
import { queryKeys } from "@/api/queryKeys";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import StyleEngineRuntimeSettingsCard from "../components/StyleEngineRuntimeSettingsCard";
import { SettingsShell } from "../components/SettingsShell";

export default function KnowledgeSettingsPage() {
  const ragQuery = useQuery({ queryKey: queryKeys.settings.rag, queryFn: getRagSettings });
  const rag = ragQuery.data?.data;
  return (
    <SettingsShell title="Base de conocimiento y estilo" description="Estas mejoras ayudarán a la IA a comprender su información y su estilo de escritura, sin afectar su capacidad para comenzar a crear en primer lugar.">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Database className="h-4 w-4" />Búsqueda de base de conocimientos</CardTitle>
          <CardDescription>
            {ragQuery.isLoading ? "Leyendo el estado de recuperación..." : rag?.enabled ? `La recuperación de datos está habilitada y actualmente en uso. ${rag.embeddingModel || "Modelo vectorial predeterminado"}.` : "La recuperación de datos no está habilitada, pero la apertura de libros y la producción de capítulos aún pueden realizarse con normalidad."}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">Los modelos vectoriales, direcciones de bases de datos, parámetros de indexación y recuperación se mantienen en la misma página de configuración de búsqueda.</p>
          <Button asChild variant="outline"><Link to="/knowledge?tab=settings">Recuperación de configuración<ExternalLink className="h-4 w-4" /></Link></Button>
        </CardContent>
      </Card>
      <StyleEngineRuntimeSettingsCard />
    </SettingsShell>
  );
}
