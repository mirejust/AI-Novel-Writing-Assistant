import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, BookOpen, Check, Loader2, Settings2, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { selectNovelProductionExperience } from "@/api/novelWorkflow";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import OnboardingTip from "@/components/onboarding/OnboardingTip";
import { queryKeys } from "@/api/queryKeys";
import { getTaskSourceHref } from "@/lib/novelRoutes";

interface NovelProductionExperienceHandoffProps {
  taskId: string;
  novelId: string;
  novelTitle?: string;
}

export default function NovelProductionExperienceHandoff({
  taskId,
  novelId,
  novelTitle,
}: NovelProductionExperienceHandoffProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: async (experience: "simple" | "professional") => {
      const response = await selectNovelProductionExperience(taskId, experience);
      if (!response.data) {
        throw new Error("La selección del modo de producción no regresa a la posición de salto.");
      }
      return response.data;
    },
    onSuccess: async (response) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["tasks"] }),
        queryClient.invalidateQueries({ queryKey: ["novels", novelId] }),
        queryClient.invalidateQueries({ queryKey: queryKeys.onboarding.firstNovel }),
      ]);
      toast.success(response.experience === "simple"
        ? "Cambiado a Reading Bookshelf, la IA continúa completando todo el libro."
        : "Cambiada al banco de trabajo completo, la IA continúa completando todo el libro.");
      navigate(getTaskSourceHref(response.targetRoute), { replace: true });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "No se pudo seleccionar el método de producción, inténtelo nuevamente."),
  });

  return (
    <section className="mx-auto max-w-5xl space-y-5 px-3 py-6 sm:px-4 lg:px-0">
      <OnboardingTip
        storageKey="production-experience-handoff"
        title="Elija la interfaz de creación que desea utilizar"
        description="Las dos interfaces comparten el mismo conjunto de capacidades de creación, revisión y recuperación; la estantería de lectura se centra más en el texto y la mesa de trabajo completa muestra materiales más creativos."
      />
      <div className="relative overflow-hidden rounded-3xl bg-foreground px-6 py-7 text-background shadow-[0_30px_80px_-50px_hsl(var(--foreground))] sm:px-8 sm:py-9">
        <div className="absolute -right-20 -top-24 h-64 w-64 rounded-full bg-primary/25 blur-3xl" />
        <div className="relative">
          <div className="flex items-center gap-2 text-sm font-medium text-background/70">
            <BookOpen className="h-4 w-4" />
            Preparativos completados antes de escribir.
          </div>
          <h1 className="mt-4 max-w-3xl text-2xl font-semibold tracking-tight sm:text-3xl">
            Elegir"{novelTitle?.trim() || "esta novela"}»interfaz de creación
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-background/70">
            La dirección de la historia, los personajes y la disposición de los capítulos están listos. Después de seleccionar la interfaz, la IA seguirá avanzando en todo el libro; puede cambiar de interfaz en cualquier momento y el progreso de la creación y los permisos de operación permanecen consistentes.
          </p>
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <article className="flex flex-col rounded-3xl border border-primary/30 bg-background p-6 shadow-[0_24px_65px_-50px_hsl(var(--primary))] ring-1 ring-primary/10 sm:p-7">
          <div className="flex items-center justify-between gap-3">
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
              <Sparkles className="h-5 w-5" />
            </span>
            <span className="rounded-full bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground">Recomendado para novatos</span>
          </div>
          <h2 className="mt-5 text-xl font-semibold text-foreground">Estantería de lectura</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">Se da prioridad a mostrar el progreso del capítulo, el texto guardado y los asuntos que requieren atención.</p>
          <ul className="mt-5 flex-1 space-y-3 text-sm text-foreground">
            {["Continuar escribiendo el libro completo.", "Revisión automática, reparación y replanificación necesaria", "Concéntrate en leer el texto guardado"].map((item) => (
              <li key={item} className="flex items-center gap-2.5">
                <Check className="h-4 w-4 shrink-0 text-primary" />
                {item}
              </li>
            ))}
          </ul>
          <Button type="button" className="mt-6 w-full justify-between" disabled={mutation.isPending} onClick={() => mutation.mutate("simple")}>
            {mutation.isPending && mutation.variables === "simple" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            Usa el estante de lectura
            <ArrowRight className="h-4 w-4" />
          </Button>
        </article>
        <article className="flex flex-col rounded-3xl border border-border/80 bg-background p-6 sm:p-7">
          <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
            <Settings2 className="h-5 w-5" />
          </span>
          <h2 className="mt-5 text-xl font-semibold text-foreground">Banco de trabajo completo</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">Muestre materiales creativos completos como planificación, personajes, capítulos y tareas.</p>
          <ul className="mt-5 flex-1 space-y-3 text-sm text-foreground">
            {["Continuar escribiendo el libro completo.", "Ver y ajustar todos los recursos creativos", "Modifique libremente la planificación y el texto del capítulo."].map((item) => (
              <li key={item} className="flex items-center gap-2.5">
                <Check className="h-4 w-4 shrink-0 text-muted-foreground" />
                {item}
              </li>
            ))}
          </ul>
          <Button type="button" variant="outline" className="mt-6 w-full justify-between" disabled={mutation.isPending} onClick={() => mutation.mutate("professional")}>
            {mutation.isPending && mutation.variables === "professional" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Settings2 className="h-4 w-4" />}
            Utilice el banco de trabajo completo
            <ArrowRight className="h-4 w-4" />
          </Button>
        </article>
      </div>
    </section>
  );
}
