import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface WritingFormulaBookStyleFlowProps {
  novelId: string;
  novelTitle?: string;
  onOpenAdvanced: () => void;
  onOpenCreate: () => void;
}

export default function WritingFormulaBookStyleFlow(props: WritingFormulaBookStyleFlowProps) {
  const {
    novelId,
    novelTitle,
    onOpenAdvanced,
    onOpenCreate,
  } = props;
  const novelRoute = novelId ? `/novels/${novelId}/edit` : "/novels";

  return (
    <Card className="border-slate-200/80 bg-white/90 shadow-[0_20px_60px_rgba(15,23,42,0.06)]">
      <CardHeader>
        <CardTitle>Establezca el método de escritura predeterminado a nivel de libro a partir de la información básica de la novela.</CardTitle>
        <div className="text-sm leading-7 text-muted-foreground">
          El motor de escritura es responsable de crear, probar y organizar los recursos de escritura. ¿Qué método de escritura predeterminado debería utilizarse para la novela actual? Vuelva a la información básica de la novela para confirmar y luego ingrese al proceso de texto y director posterior.
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
          <div className="space-y-4 rounded-2xl border bg-slate-50/70 p-4">
            <div className="text-sm font-medium text-slate-900">¿Dónde debo ingresar ahora?</div>
            <div className="rounded-2xl border bg-white p-4 text-sm leading-7 text-slate-700">
              {novelId
                ? `Novela actual${novelTitle ? `«${novelTitle}»` : ""}El "método de escritura predeterminado" se ha colocado en la página de información básica de la novela.`
                : "Primero vaya a la página de información básica de una determinada novela y confirme allí el método de escritura predeterminado del nivel del libro."}
            </div>
            <div className="rounded-2xl border bg-slate-950 p-4 text-white">
              <div className="text-sm font-medium">¿De qué son responsables las dos entradas?</div>
              <div className="mt-3 space-y-2 text-sm leading-7 text-slate-200">
                <div>Página de novela: seleccione el método de escritura predeterminado para la novela actual, active recomendaciones, compare candidatos y decida cuándo incorporar al director automático.</div>
                <div>Motor de escritura: sigue siendo responsable de organizar los activos de escritura, la redacción de pruebas, la eliminación del sabor de IA y la gestión de reglas.</div>
              </div>
            </div>
          </div>

          <div className="space-y-4 rounded-2xl border bg-white p-4">
            <div className="text-sm font-medium text-slate-900">Siguiente</div>
            <div className="rounded-2xl border bg-slate-50/70 p-4 text-sm leading-7 text-slate-700">
              Primero vaya a la página de la novela para confirmar el método de escritura predeterminado de este libro. Si no hay un método de escritura adecuado en la biblioteca de activos actual, regrese al motor de métodos de escritura para crear u organizar activos.
            </div>
            <div className="flex flex-wrap gap-3">
              <Button asChild type="button">
                <Link to={novelRoute}>Vaya a la página de la novela para configurar el método de escritura predeterminado</Link>
              </Button>
              <Button type="button" variant="outline" onClick={onOpenAdvanced}>
                Editar escritura actual
              </Button>
              <Button type="button" variant="outline" onClick={onOpenCreate}>
                Crea un nuevo estilo de escritura
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
