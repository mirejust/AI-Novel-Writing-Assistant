import { Info } from "lucide-react";

export function ComicImageGenerationNotice() {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-100">
      <Info className="mt-0.5 h-4 w-4 shrink-0" />
      <p className="leading-5">
        Consejo temporal: la generación de imágenes de cómics solo admite gpt-image-2. Seleccione el servicio de imágenes que ha configurado el modelo antes de generar el borrador del diseño de personajes o el diagrama de cuadrícula.
      </p>
    </div>
  );
}
