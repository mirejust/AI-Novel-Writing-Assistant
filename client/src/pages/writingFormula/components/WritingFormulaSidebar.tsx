import { useMemo, useState } from "react";
import type { AntiAiRule, StyleProfile, StyleTemplate } from "@ai-novel/shared/types/styleEngine";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getStyleProfileOriginLabel, isStarterStyleProfile } from "../writingFormulaV2.shared";
import WritingFormulaRulesPanel from "./WritingFormulaRulesPanel";

export interface WritingFormulaCreateFormState {
  manualName: string;
  briefName: string;
  briefCategory: string;
  briefPrompt: string;
  extractName: string;
  extractCategory: string;
  extractSourceText: string;
}

interface WritingFormulaSidebarProps {
  createForm: WritingFormulaCreateFormState;
  onCreateFormChange: (patch: Partial<WritingFormulaCreateFormState>) => void;
  onCreateManual: () => void;
  onCreateFromBrief: () => void;
  onExtractFromText: () => void;
  onCreateFromTemplate: (templateId: string) => void;
  createManualPending: boolean;
  createFromBriefPending: boolean;
  extractFromTextPending: boolean;
  createFromTemplatePending: boolean;
  templates: StyleTemplate[];
  antiAiRules: AntiAiRule[];
  profiles: StyleProfile[];
  selectedProfileId: string;
  onSelectProfile: (profileId: string) => void;
  onToggleRule: (rule: AntiAiRule, enabled: boolean) => void;
}

export default function WritingFormulaSidebar(props: WritingFormulaSidebarProps) {
  const {
    createForm,
    onCreateFormChange,
    onCreateManual,
    onCreateFromBrief,
    onExtractFromText,
    onCreateFromTemplate,
    createManualPending,
    createFromBriefPending,
    extractFromTextPending,
    createFromTemplatePending,
    templates,
    antiAiRules,
    profiles,
    selectedProfileId,
    onSelectProfile,
    onToggleRule,
  } = props;
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [activeCreateTab, setActiveCreateTab] = useState("quick_start");

  const { starterProfiles, customProfiles } = useMemo(() => {
    const starters = profiles.filter((profile) => isStarterStyleProfile(profile));
    const custom = profiles.filter((profile) => !isStarterStyleProfile(profile));
    return {
      starterProfiles: starters,
      customProfiles: custom,
    };
  }, [profiles]);

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 overflow-y-auto xl:pr-1">
      <Card>
        <CardHeader>
          <CardTitle>Elija primero un método de escritura y luego ajústelo</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="text-sm leading-6 text-muted-foreground">
            Al usarlo por primera vez, no es necesario comprender primero todos los campos de las reglas. Primero, elija un conjunto de métodos de escritura preestablecidos que mejor se adapten a la sensación de lo que desea escribir, y luego ingrese y cambie el nombre, las etiquetas y las reglas. Será mucho más suave.
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border bg-muted/20 p-3">
              <div className="text-xs font-medium text-muted-foreground">Recursos de escritura directamente editables</div>
              <div className="mt-1 text-2xl font-semibold text-foreground">{profiles.length}</div>
              <div className="mt-1 text-xs text-muted-foreground">
                que preestablecido {starterProfiles.length} Conjunto, adecuado para copiar ideas directamente y luego cambiarlas.
              </div>
            </div>
            <div className="rounded-lg border bg-muted/20 p-3">
              <div className="text-xs font-medium text-muted-foreground">Plantillas integradas</div>
              <div className="mt-1 text-2xl font-semibold text-foreground">{templates.length}</div>
              <div className="mt-1 text-xs text-muted-foreground">
                Adecuado para crear rápidamente un nuevo estilo de escritura sin empezar desde cero.
              </div>
            </div>
          </div>
          <Button className="w-full" onClick={() => setCreateDialogOpen(true)}>
            Crear un método de escritura nuevo o importarlo
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Cambiar el método de escritura actual</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-xs leading-6 text-muted-foreground">
            Este es responsable de cambiar el objeto de edición en la ventana emergente. Vea la lista completa de activos en la página de inicio.
          </div>

          {customProfiles.length > 0 ? (
            <div className="space-y-2">
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">La forma en que lo creaste</div>
              {customProfiles.map((profile) => (
                <button
                  key={profile.id}
                  type="button"
                  className={`w-full rounded-lg border px-3 py-2 text-left transition ${
                    profile.id === selectedProfileId ? "border-primary bg-primary/5" : "hover:border-primary/40"
                  }`}
                  onClick={() => onSelectProfile(profile.id)}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate font-medium text-foreground">{profile.name}</div>
                    </div>
                    <Badge variant="secondary" className="shrink-0">
                      {getStyleProfileOriginLabel(profile)}
                    </Badge>
                  </div>
                </button>
              ))}
            </div>
          ) : null}

          {starterProfiles.length > 0 ? (
            <div className="space-y-2">
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Método de escritura inicial preestablecido</div>
              {starterProfiles.map((profile) => (
                <button
                  key={profile.id}
                  type="button"
                  className={`w-full rounded-lg border px-3 py-2 text-left transition ${
                    profile.id === selectedProfileId ? "border-primary bg-primary/5" : "hover:border-primary/40"
                  }`}
                  onClick={() => onSelectProfile(profile.id)}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate font-medium text-foreground">{profile.name}</div>
                    </div>
                    <Badge variant="outline" className="shrink-0">Preestablecido</Badge>
                  </div>
                </button>
              ))}
            </div>
          ) : null}

          {profiles.length === 0 ? (
            <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
              Actualmente no hay activos de escritura. Haga clic en "Método de escritura nuevo o importado" arriba para comenzar rápidamente con una plantilla, que es la forma más sencilla.
            </div>
          ) : null}
        </CardContent>
      </Card>

      <WritingFormulaRulesPanel antiAiRules={antiAiRules} onToggleRule={onToggleRule} />

      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle>Crear un método de escritura nuevo o importarlo</DialogTitle>
            <DialogDescription>
              Se recomienda iniciar la generación de oraciones en "Inicio rápido" o "En blanco/AI". Cuando tenga a mano un texto de muestra estable, utilice "Extraer del texto".
            </DialogDescription>
          </DialogHeader>

          <Tabs value={activeCreateTab} onValueChange={setActiveCreateTab} className="space-y-4">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="quick_start">Inicio rápido</TabsTrigger>
              <TabsTrigger value="blank">En blanco/AI</TabsTrigger>
              <TabsTrigger value="extract">Extracto del texto</TabsTrigger>
            </TabsList>

            <TabsContent value="quick_start" className="space-y-4">
              <div className="rounded-lg border bg-muted/20 p-4 text-sm leading-6 text-muted-foreground">
                A la izquierda hay varios conjuntos de métodos de escritura iniciales que se pueden modificar directamente. Cuando desee crear un nuevo conjunto, le ahorrará más trabajo generarlo rápidamente a partir de una plantilla y luego ajustarlo según el proyecto.
              </div>
              <div className="grid max-h-[58vh] gap-3 overflow-y-auto pr-1 md:grid-cols-2">
                {templates.map((template) => (
                  <div key={template.id} className="rounded-lg border p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-base font-semibold text-foreground">{template.name}</div>
                        <div className="mt-1 text-xs text-muted-foreground">{template.category}</div>
                      </div>
                      <Badge variant="outline">Plantilla</Badge>
                    </div>
                    <div className="mt-3 text-sm leading-6 text-muted-foreground">{template.description}</div>
                    {template.tags.length > 0 ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {template.tags.slice(0, 4).map((tag) => (
                          <Badge key={`${template.id}-${tag}`} variant="secondary">{tag}</Badge>
                        ))}
                      </div>
                    ) : null}
                    {template.applicableGenres.length > 0 ? (
                      <div className="mt-3 text-xs text-muted-foreground">
                        Adecuado para:{template.applicableGenres.join(" / ")}
                      </div>
                    ) : null}
                    <Button
                      size="sm"
                      className="mt-4 w-full"
                      onClick={() => onCreateFromTemplate(template.id)}
                      disabled={createFromTemplatePending}
                    >
                      {createFromTemplatePending ? "Creando..." : "Basado en este conjunto de noticias rápidas"}
                    </Button>
                  </div>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="blank" className="space-y-4">
              <div className="rounded-lg border bg-muted/20 p-4 text-sm leading-6 text-muted-foreground">
                Hay dos formas sencillas de comenzar: si sabe que desea mantener un conjunto de reglas, cree espacios en blanco manualmente; Si sólo sabes "cómo quieres escribirlo", simplemente escribe una oración y deja que la IA construya el esqueleto.
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-lg border p-4">
                  <div className="mb-3">
                    <div className="text-sm font-medium text-foreground">Creación manual de espacios en blanco</div>
                    <div className="mt-1 text-xs leading-5 text-muted-foreground">
                      Es adecuado para usted que sabe qué reglas de estilo desea mantener y solo desea construir primero un caparazón vacío y luego llenarlo lentamente.
                    </div>
                  </div>
                  <div className="space-y-3">
                    <input
                      className="w-full rounded-md border p-2 text-sm"
                      placeholder="Por ejemplo: mi método de escritura de relaciones urbanas de canal femenino"
                      value={createForm.manualName}
                      onChange={(event) => onCreateFormChange({ manualName: event.target.value })}
                    />
                    <Button
                      className="w-full"
                      onClick={onCreateManual}
                      disabled={!createForm.manualName.trim() || createManualPending}
                    >
                      {createManualPending ? "Creando..." : "Crear escritura en blanco"}
                    </Button>
                  </div>
                </div>

                <div className="rounded-lg border p-4">
                  <div className="mb-3">
                    <div className="text-sm font-medium text-foreground">La IA me ayuda a construir un set primero</div>
                    <div className="mt-1 text-xs leading-5 text-muted-foreground">
                      Cuando no desee estudiar primero los campos de reglas, describa directamente la sensación de lectura, el temperamento o la dirección de referencia que desee, y la IA generará primero un conjunto de métodos de escritura editables.
                    </div>
                  </div>
                  <div className="space-y-3">
                    <input
                      className="w-full rounded-md border p-2 text-sm"
                      placeholder="Nombre del método de escritura (opcional, déjelo en blanco y deje que AI lo recoja)"
                      value={createForm.briefName}
                      onChange={(event) => onCreateFormChange({ briefName: event.target.value })}
                    />
                    <input
                      className="w-full rounded-md border p-2 text-sm"
                      placeholder="Clasificación (opcional)"
                      value={createForm.briefCategory}
                      onChange={(event) => onCreateFormChange({ briefCategory: event.target.value })}
                    />
                    <textarea
                      className="min-h-[180px] w-full rounded-md border p-2 text-sm"
                      placeholder="Por ejemplo: similar al método de escritura de &quot;El Mesías Distante&quot;, la moderación general, un fuerte sentido del pensamiento, diálogos agudos, menos sopa de pollo, fricción más realista."
                      value={createForm.briefPrompt}
                      onChange={(event) => onCreateFormChange({ briefPrompt: event.target.value })}
                    />
                    <Button
                      className="w-full"
                      onClick={onCreateFromBrief}
                      disabled={!createForm.briefPrompt.trim() || createFromBriefPending}
                    >
                      {createFromBriefPending ? "Generación de IA..." : "La IA genera un conjunto de métodos de escritura"}
                    </Button>
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="extract" className="space-y-4">
              <div className="rounded-lg border bg-muted/20 p-4 text-sm leading-6 text-muted-foreground">
                Es adecuado para usted que tiene un texto de referencia estable en la mano y desea que el sistema extraiga características primero y luego ingrese a la edición. Cuando no hay muestras listas para usar, se recomienda comenzar con plantillas o IA.
              </div>
              <div className="rounded-lg border p-4">
                <div className="space-y-3">
                  <input
                    className="w-full rounded-md border p-2 text-sm"
                    placeholder="Nombre escrito"
                    value={createForm.extractName}
                    onChange={(event) => onCreateFormChange({ extractName: event.target.value })}
                  />
                  <input
                    className="w-full rounded-md border p-2 text-sm"
                    placeholder="Clasificación (opcional)"
                    value={createForm.extractCategory}
                    onChange={(event) => onCreateFormChange({ extractCategory: event.target.value })}
                  />
                  <textarea
                    className="min-h-[220px] w-full rounded-md border p-2 text-sm"
                    placeholder="Pegar texto de referencia"
                    value={createForm.extractSourceText}
                    onChange={(event) => onCreateFormChange({ extractSourceText: event.target.value })}
                  />
                  <Button
                    className="w-full"
                    onClick={onExtractFromText}
                    disabled={!createForm.extractName.trim() || !createForm.extractSourceText.trim() || extractFromTextPending}
                  >
                    {extractFromTextPending ? "Extrayendo..." : "La IA extrae características y crea"}
                  </Button>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </div>
  );
}
