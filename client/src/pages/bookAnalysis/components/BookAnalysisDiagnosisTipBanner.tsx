import { Badge } from "@/components/ui/badge";

interface BookAnalysisDiagnosisTipBannerProps {
  documentTitle: string;
}

export default function BookAnalysisDiagnosisTipBanner({ documentTitle }: BookAnalysisDiagnosisTipBannerProps) {
  return (
    <div className="rounded-md border border-primary/20 bg-primary/5 p-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="secondary">Modo de diagnóstico</Badge>
        <span className="font-medium">{documentTitle}</span>
      </div>
      <div className="mt-2 leading-6 text-muted-foreground">
        En este caso, utilice el marco de apertura del libro para comprobar su manuscrito, centrándose en si el ritmo, los personajes, los temas, los presagios y los puntos de venta comerciales son claros; las conclusiones se utilizan para emitir juicios sobre las revisiones y el texto de la novela original no se modificará.
      </div>
    </div>
  );
}
