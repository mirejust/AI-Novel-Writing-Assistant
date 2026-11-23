import { Palette, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SettingsShell } from "../components/SettingsShell";
import { useTheme } from "@/components/theme/ThemeProvider";

const palettes = [
  { value: "ink", label: "Piedra de tinta", description: "El sobrio color gris azulado es adecuado para la creación diaria." },
  { value: "paper", label: "Papel caliente", description: "Color blanquecino suave, adecuado para lectura y edición de capítulos." },
  { value: "night", label: "Vuelo nocturno", description: "Índigo oscuro y turquesa, adecuados para la ejecución de IA y visualización de registros." },
] as const;

export default function AppearanceSettingsPage() {
  const { mode, palette, density, setMode, setPalette, setDensity, reset } = useTheme();
  return (
    <SettingsShell title="Apariencia y temas" description="Elija colores de interfaz y densidad de visualización que se adapten a largas horas de creación.">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><Palette className="h-4 w-4" />Apariencia de la interfaz</CardTitle>
          <CardDescription>El tema solo se guarda en el dispositivo actual y no afectará el contenido novedoso ni el estado de la tarea.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <label className="block space-y-2 text-sm font-medium">
            <span>Modo de visualización</span>
            <Select value={mode} onValueChange={(value) => setMode(value as typeof mode)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="system">Seguir el sistema</SelectItem>
                <SelectItem value="light">Claro</SelectItem>
                <SelectItem value="dark">Oscuro</SelectItem>
              </SelectContent>
            </Select>
          </label>
          <label className="block space-y-2 text-sm font-medium">
            <span>Estilo del tema</span>
            <Select value={palette} onValueChange={(value) => setPalette(value as typeof palette)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {palettes.map((item) => <SelectItem key={item.value} value={item.value}>{item.label} · {item.description}</SelectItem>)}
              </SelectContent>
            </Select>
          </label>
          <label className="block space-y-2 text-sm font-medium">
            <span>Densidad de interfaz</span>
            <Select value={density} onValueChange={(value) => setDensity(value as typeof density)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="comfortable">Cómodo</SelectItem>
                <SelectItem value="compact">Compacto</SelectItem>
              </SelectContent>
            </Select>
          </label>
          <div className="flex justify-end">
            <Button type="button" variant="outline" onClick={reset}><RotateCcw className="mr-2 h-4 w-4" />Restaurar tema predeterminado</Button>
          </div>
        </CardContent>
      </Card>
    </SettingsShell>
  );
}
