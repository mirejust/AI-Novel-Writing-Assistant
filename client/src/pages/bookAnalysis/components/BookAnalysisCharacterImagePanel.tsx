import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { BookAnalysisCharacter } from "@ai-novel/shared/types/bookAnalysisCharacter";
import type { ImageAsset } from "@ai-novel/shared/types/image";
import {
  deleteBookAnalysisCharacterImage,
  generateBookAnalysisCharacterImage,
  listBookAnalysisCharacterImages,
  prepareBookAnalysisCharacterImage,
  promoteBookAnalysisCharacter,
  setPrimaryBookAnalysisCharacterImage,
} from "@/api/bookAnalysis";
import { getImageTask, resolveImageAssetUrl } from "@/api/images";
import { queryKeys } from "@/api/queryKeys";
import { ImageGenerationConfirmDialog } from "@/components/image/ImageGenerationConfirmDialog";
import { useImageGenerationFlow } from "@/components/image/useImageGenerationFlow";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AppDialogContent, Dialog } from "@/components/ui/dialog";
import { toast } from "@/components/ui/toast";
import { TaskRecordActions } from "@/components/taskQueue/TaskRecordActions";

const IMAGE_STATUS_TEXT: Record<string, string> = {
  queued: "En cola",
  running: "Generando",
  succeeded: "Generado exitosamente",
  failed: "Error de generación",
  cancelled: "Cancelado",
};

interface BookAnalysisCharacterImagePanelProps {
  analysisId: string;
  character: BookAnalysisCharacter;
  disabled: boolean;
}

export default function BookAnalysisCharacterImagePanel({
  analysisId,
  character,
  disabled,
}: BookAnalysisCharacterImagePanelProps) {
  const queryClient = useQueryClient();
  const flow = useImageGenerationFlow();
  const [activeTaskId, setActiveTaskId] = useState("");
  const [promoteOpen, setPromoteOpen] = useState(false);
  const [includePrimaryImage, setIncludePrimaryImage] = useState(true);

  const assetsQuery = useQuery({
    queryKey: queryKeys.images.assets("book_analysis_character", character.id),
    queryFn: () => listBookAnalysisCharacterImages(analysisId, character.id),
  });
  const assets = assetsQuery.data?.data ?? [];
  const primaryAsset = useMemo(() => assets.find((item) => item.isPrimary) ?? assets[0] ?? null, [assets]);

  const taskQuery = useQuery({
    queryKey: queryKeys.images.task(activeTaskId || "none"),
    queryFn: () => getImageTask(activeTaskId),
    enabled: Boolean(activeTaskId),
    refetchInterval: (query) => {
      const status = query.state.data?.data?.status;
      return status === "queued" || status === "running" ? 1500 : false;
    },
  });

  useEffect(() => {
    const task = taskQuery.data?.data;
    if (!task || !activeTaskId) {
      return;
    }
    if (task.status === "queued" || task.status === "running") {
      return;
    }
    void queryClient.invalidateQueries({ queryKey: queryKeys.images.assets("book_analysis_character", character.id) });
    setActiveTaskId("");
  }, [activeTaskId, character.id, queryClient, taskQuery.data?.data]);

  const setPrimaryMutation = useMutation({
    mutationFn: (assetId: string) => setPrimaryBookAnalysisCharacterImage(analysisId, character.id, assetId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.images.assets("book_analysis_character", character.id) });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (asset: ImageAsset) => deleteBookAnalysisCharacterImage(analysisId, character.id, asset.id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.images.assets("book_analysis_character", character.id) });
    },
  });

  const promoteMutation = useMutation({
    mutationFn: () => promoteBookAnalysisCharacter(analysisId, character.id, { includePrimaryImage }),
    onSuccess: async (response) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.baseCharacters.all });
      setPromoteOpen(false);
      toast.success(response.data?.baseCharacter.name ? `Agregado a la biblioteca de personajes:${response.data.baseCharacter.name}` : "Agregado a la biblioteca de personajes.");
    },
  });

  const startGenerate = () => {
    void flow.start({
      prepare: async () => (await prepareBookAnalysisCharacterImage(analysisId, character.id)).data!,
      generate: async (overrides) => {
        const response = await generateBookAnalysisCharacterImage(analysisId, character.id, {
          count: 2,
          stylePreset: "Diagrama de configuración de personajes realista.",
          overrides,
        });
        if (response.data?.id) {
          setActiveTaskId(response.data.id);
        }
        return response;
      },
    });
  };

  const activeTask = taskQuery.data?.data;

  return (
    <div className="mt-5 space-y-4 border-t border-border/35 pt-4">
      <ImageGenerationConfirmDialog {...flow.dialogProps} />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium">Imágenes</span>
          <span className="text-xs text-muted-foreground">{assets.length} Abierto</span>
          {primaryAsset ? <Badge variant="secondary" className="border-0 font-normal">La imagen principal ha sido configurada.</Badge> : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" className="rounded-full" onClick={startGenerate} disabled={disabled || Boolean(activeTaskId)}>
            Generar diagrama de imagen
          </Button>
          <Button size="sm" variant="ghost" className="rounded-full" onClick={() => setPromoteOpen(true)} disabled={disabled || promoteMutation.isPending}>
            Agregar a la biblioteca de personajes
          </Button>
        </div>
      </div>

      {activeTask ? (
        <div className="rounded-xl bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
          Tareas actuales:{IMAGE_STATUS_TEXT[activeTask.status] ?? activeTask.status}
          <TaskRecordActions kind="image_generation" id={activeTask.id} status={activeTask.status} title="Generación de imágenes de personajes." allowStop allowDelete={false} />
          {activeTask.error ? <span className="ml-2 text-destructive">{activeTask.error}</span> : null}
        </div>
      ) : null}

      {assetsQuery.isLoading ? <div className="text-xs text-muted-foreground">Cargando imagen imagen.</div> : null}
      {!assetsQuery.isLoading && assets.length === 0 ? (
        <div className="text-xs text-muted-foreground">Puedes generar un mapa de imagen de personaje y luego decidir si agregarlo a la biblioteca de personajes.</div>
      ) : null}
      {assets.length > 0 ? (
        <div className="grid gap-2 sm:grid-cols-2">
          {assets.map((asset) => (
            <div key={asset.id} className="space-y-2 overflow-hidden rounded-xl bg-muted/20 p-2">
              <img
                src={resolveImageAssetUrl(asset.url)}
                alt={`${character.name}-Mapa de imagen`}
                className="aspect-square w-full rounded-lg object-cover"
                loading="lazy"
              />
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs text-muted-foreground">{asset.isPrimary ? "Imagen principal" : "Imagen del candidato"}</span>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    className="rounded-full"
                    onClick={() => setPrimaryMutation.mutate(asset.id)}
                    disabled={asset.isPrimary || setPrimaryMutation.isPending}
                  >
                    Establecer imagen principal
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="rounded-full text-muted-foreground hover:text-destructive"
                    onClick={() => {
                      if (window.confirm("¿Estás seguro de que deseas eliminar esta imagen?")) {
                        deleteMutation.mutate(asset);
                      }
                    }}
                    disabled={deleteMutation.isPending && deleteMutation.variables?.id === asset.id}
                  >
                    borrar
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      <Dialog open={promoteOpen} onOpenChange={setPromoteOpen}>
        <AppDialogContent
          title={`Agregar a la biblioteca de personajes:${character.name}`}
          bodyClassName="space-y-3"
          footer={(
            <>
              <Button type="button" variant="outline" onClick={() => setPromoteOpen(false)} disabled={promoteMutation.isPending}>
                Cancelar
              </Button>
              <Button type="button" onClick={() => promoteMutation.mutate()} disabled={promoteMutation.isPending}>
                {promoteMutation.isPending ? "Unirse..." : "Confirmar para unirse"}
              </Button>
            </>
          )}
        >
          <div className="text-sm text-muted-foreground">
            El campo de carácter del personaje se copiará a la biblioteca de caracteres; la evidencia de apertura del libro y los registros de la escena aún se conservarán en el archivo de apertura del libro.
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={includePrimaryImage}
              onChange={(event) => setIncludePrimaryImage(event.target.checked)}
            />
            <span>Al mismo tiempo, agrega la imagen principal a la biblioteca de personajes.</span>
          </label>
          {promoteMutation.error ? (
            <div className="text-sm text-destructive">
              {promoteMutation.error instanceof Error ? promoteMutation.error.message : "No se pudo unir a la biblioteca de personajes."}
            </div>
          ) : null}
        </AppDialogContent>
      </Dialog>
    </div>
  );
}
