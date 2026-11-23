import type { StoryConflictLayers } from "@ai-novel/shared/types/storyMacro";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { StoryMacroTabProps } from "./NovelEditView.types";
import {
  ENGINE_TEXT_FIELDS,
  FieldActions,
  listToText,
} from "./StoryMacroPlanTab.shared";
import DirectorTakeoverEntryPanel from "./DirectorTakeoverEntryPanel";
import { DetailDisclosure } from "./workspaceShell";
import StoryEngineStudio from "./storyMacroPlan/StoryEngineStudio";
import StoryMacroEditableField from "./storyMacroPlan/StoryMacroEditableField";

const EMPTY_CONFLICT_LAYERS: StoryConflictLayers = {
  external: "",
  internal: "",
  relational: "",
};

export default function StoryMacroPlanTab(props: StoryMacroTabProps) {
  const expansion = props.expansion ?? {
    expanded_premise: "",
    protagonist_core: "",
    conflict_engine: "",
    conflict_layers: EMPTY_CONFLICT_LAYERS,
    mystery_box: "",
    emotional_line: "",
    setpiece_seeds: [],
    tone_reference: "",
  };

  return (
    <div className="space-y-4">
      <DirectorTakeoverEntryPanel
        title="Tomar el relevo de la planificación macro de la historia"
        description="La IA primero determinará si el contrato de libro/macro de historia ya está disponible y luego decidirá si continúa completando el contenido que falta o vuelve a ejecutar el paso actual según su elección."
        entry={props.directorTakeoverEntry}
      />
      <StoryEngineStudio tab={props} />

      <DetailDisclosure
        title="Story Engine y restricciones avanzadas"
        description="Se trata de elementos de diagnóstico y edición del motor de historias más granulares. Está contraído de forma predeterminada para evitar que los principiantes se sientan abrumados por una gran cantidad de campos cuando aún no han decidido una dirección."
      >
        <div className="space-y-4">
          {props.expansion ? (
            <Card>
              <CardHeader>
                <CardTitle>Prototipo de motor de historia</CardTitle>
                <CardDescription>
                  Defina aquí por qué la historia puede seguir escribiéndose: cómo queda atrapado el protagonista, cómo se intensifica el conflicto y cómo lo desconocido impulsa al lector a continuar leyendo.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 xl:grid-cols-2">
                  {ENGINE_TEXT_FIELDS.map((item) => {
                    const value = expansion[item.field as keyof typeof expansion];
                    return (
                      <StoryMacroEditableField
                        key={item.field}
                        label={item.label}
                        value={typeof value === "string" ? value : ""}
                        onChange={(value) => props.onFieldChange(item.field, value)}
                        placeholder={item.placeholder}
                        className="bg-muted/10 p-4"
                        actions={
                          <FieldActions
                            field={item.field}
                            lockedFields={props.lockedFields}
                            regeneratingField={props.regeneratingField}
                            storyInput={props.storyInput}
                            onToggleLock={props.onToggleLock}
                            onRegenerateField={props.onRegenerateField}
                          />
                        }
                      />
                    );
                  })}
                </div>

                <div className="space-y-2 bg-muted/10 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-sm font-medium text-foreground">Capa de conflicto</div>
                    <FieldActions
                      field="conflict_layers"
                      lockedFields={props.lockedFields}
                      regeneratingField={props.regeneratingField}
                      storyInput={props.storyInput}
                      onToggleLock={props.onToggleLock}
                      onRegenerateField={props.onRegenerateField}
                    />
                  </div>
                  <div className="grid gap-4 xl:grid-cols-3">
                    <StoryMacroEditableField
                      label="Opresión externa"
                      value={expansion.conflict_layers.external}
                      onChange={(value) => props.onFieldChange("conflict_layers", {
                        ...expansion.conflict_layers,
                        external: value,
                      })}
                      placeholder="Cómo los sistemas externos, las amenazas o las circunstancias continúan oprimiendo al protagonista."
                    />
                    <StoryMacroEditableField
                      label="Colapso interno"
                      value={expansion.conflict_layers.internal}
                      onChange={(value) => props.onFieldChange("conflict_layers", {
                        ...expansion.conflict_layers,
                        internal: value,
                      })}
                      placeholder="Cómo los miedos, deseos o errores de juicio internos del protagonista vuelven en su contra."
                    />
                    <StoryMacroEditableField
                      label="Estrés en la relación"
                      value={expansion.conflict_layers.relational}
                      onChange={(value) => props.onFieldChange("conflict_layers", {
                        ...expansion.conflict_layers,
                        relational: value,
                      })}
                      placeholder="Cómo las relaciones críticas crean costos de elección y tensión emocional."
                    />
                  </div>
                </div>

                <StoryMacroEditableField
                  label="semillas de escena de alta tensión"
                  value={listToText(expansion.setpiece_seeds)}
                  onChange={(value) => props.onFieldChange(
                    "setpiece_seeds",
                    value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean),
                  )}
                  placeholder="Una escena de alta tensión por línea."
                  list
                  className="bg-muted/10 p-4"
                  actions={
                    <FieldActions
                      field="setpiece_seeds"
                      lockedFields={props.lockedFields}
                      regeneratingField={props.regeneratingField}
                      storyInput={props.storyInput}
                      onToggleLock={props.onToggleLock}
                      onRegenerateField={props.onRegenerateField}
                    />
                  }
                />
              </CardContent>
            </Card>
          ) : null}

          {props.issues.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>Conflictos y lagunas de información</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {props.issues.map((issue, index) => (
                  <div key={`${issue.type}-${issue.field}-${index}`} className="rounded-lg border border-amber-300/60 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                    <div className="font-medium">{issue.type === "conflict" ? "Conflicto de entrada" : "Información insuficiente"}</div>
                    <div className="mt-1">{issue.message}</div>
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle>Restricciones duras</CardTitle>
              <CardDescription>
                Las reglas aquí servirán como límites estrictos para que la generación siguiente evite que la historia se disperse más adelante.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <StoryMacroEditableField
                label="Reglas narrativas"
                value={listToText(props.constraints)}
                onChange={(value) => props.onFieldChange(
                  "constraints",
                  value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean),
                )}
                placeholder="Una regla narrativa por línea que debe seguirse."
                list
                actions={
                  <FieldActions
                    field="constraints"
                    lockedFields={props.lockedFields}
                    regeneratingField={props.regeneratingField}
                    storyInput={props.storyInput}
                    onToggleLock={props.onToggleLock}
                    onRegenerateField={props.onRegenerateField}
                  />
                }
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Motor de restricción</CardTitle>
              <CardDescription>
                Lo que se guarda actualmente es la fuente de reglas que pueden consumir directamente los personajes posteriores, las líneas principales y la planificación de capítulos.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {props.constraintEngine ? (
                <>
                  <div className="space-y-2 rounded-xl border border-border/70 p-4">
                    <div className="text-sm font-medium text-foreground">Premisa de la historia</div>
                    <div className="text-sm leading-7 text-muted-foreground">{props.constraintEngine.premise}</div>
                  </div>
                  <div className="grid gap-4 xl:grid-cols-2">
                    <div className="space-y-2 rounded-xl border border-border/70 p-4">
                      <div className="text-sm font-medium text-foreground">Núcleo desconocido</div>
                      <div className="text-sm text-muted-foreground">{props.constraintEngine.mystery_box}</div>
                    </div>
                    <div className="space-y-2 rounded-xl border border-border/70 p-4">
                      <div className="text-sm font-medium text-foreground">Eje del conflicto</div>
                      <div className="text-sm text-muted-foreground">{props.constraintEngine.conflict_axis}</div>
                    </div>
                    <div className="space-y-2 rounded-xl border border-border/70 p-4">
                      <div className="text-sm font-medium text-foreground">Ranura de papel de presión</div>
                      <div className="space-y-2 text-sm text-muted-foreground">
                        {props.constraintEngine.pressure_roles.map((item) => (
                          <div key={item}>{item}</div>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-2 rounded-xl border border-border/70 p-4">
                      <div className="text-sm font-medium text-foreground">Nodo de crecimiento</div>
                      <div className="space-y-2 text-sm text-muted-foreground">
                        {props.constraintEngine.growth_path.map((item) => (
                          <div key={item}>{item}</div>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-2 rounded-xl border border-border/70 p-4">
                      <div className="text-sm font-medium text-foreground">Modelo de escenario</div>
                      <div className="space-y-2 text-sm text-muted-foreground">
                        {props.constraintEngine.phase_model.map((phase) => (
                          <div key={phase.name}>
                            <span className="font-medium text-foreground">{phase.name}</span>
                            {" · "}
                            {phase.goal}
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-2 rounded-xl border border-border/70 p-4">
                      <div className="text-sm font-medium text-foreground">lista de restricciones estrictas</div>
                      <div className="space-y-2 text-sm text-muted-foreground">
                        {props.constraintEngine.hard_constraints.map((item) => (
                          <div key={item}>{item}</div>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-2 rounded-xl border border-border/70 p-4 xl:col-span-2">
                      <div className="text-sm font-medium text-foreground">Canjear nodo</div>
                      <div className="space-y-2 text-sm text-muted-foreground">
                        {props.constraintEngine.turning_points.map((item) => (
                          <div key={`${item.phase}-${item.title}`}>
                            <span className="font-medium text-foreground">{item.phase}</span>
                            {" · "}
                            {item.summary}
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-2 rounded-xl border border-border/70 p-4">
                      <div className="text-sm font-medium text-foreground">El final debe suceder</div>
                      <div className="space-y-2 text-sm text-muted-foreground">
                        {props.constraintEngine.ending_constraints.must_have.map((item) => (
                          <div key={item}>{item}</div>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-2 rounded-xl border border-border/70 p-4">
                      <div className="text-sm font-medium text-foreground">Hay que evitar el final</div>
                      <div className="space-y-2 text-sm text-muted-foreground">
                        {props.constraintEngine.ending_constraints.must_not_have.map((item) => (
                          <div key={item}>{item}</div>
                        ))}
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <div className="rounded-xl border border-dashed border-border/70 px-4 py-6 text-sm text-muted-foreground">
                  Aún no existe un motor de restricciones. Primero complete el desmontaje del motor de la historia y luego haga clic en "Construir motor de restricciones".
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Estado de la historia</CardTitle>
              <CardDescription>
                Guarde la etapa actual y la situación del protagonista para reutilizarlas fácilmente cuando avance en capítulos posteriores.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 xl:grid-cols-[160px_160px_minmax(0,1fr)_auto]">
              <div className="space-y-2">
                <div className="text-sm font-medium text-foreground">Etapa actual</div>
                <Input
                  type="number"
                  value={props.state.currentPhase}
                  onChange={(event) => props.onStateChange("currentPhase", Number(event.target.value))}
                  min={0}
                />
              </div>
              <div className="space-y-2">
                <div className="text-sm font-medium text-foreground">Cronograma</div>
                <Input
                  type="number"
                  value={props.state.progress}
                  onChange={(event) => props.onStateChange("progress", Number(event.target.value))}
                  min={0}
                  max={100}
                />
              </div>
              <StoryMacroEditableField
                label="La situación actual del protagonista."
                value={props.state.protagonistState}
                onChange={(value) => props.onStateChange("protagonistState", value)}
                placeholder="Por ejemplo: sigo negando la verdad, pero no puedo salir."
              />
              <div className="flex items-end">
                <Button variant="outline" onClick={props.onSaveState} disabled={props.isSavingState}>
                  {props.isSavingState ? "Guardando..." : "Guardar estado"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </DetailDisclosure>
    </div>
  );
}
