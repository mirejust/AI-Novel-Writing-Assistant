import {
  STYLE_ENGINE_COMPATIBILITY_FIELDS,
  type AntiAiRule,
  type StyleExtractionPreset,
  type StyleProfile,
  type StyleProfileFeature,
  type StyleRulePatch,
} from "@ai-novel/shared/types/styleEngine";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buildReadableRuleEntries, type RuleSection } from "../writingFormulaRulePresentation";
import { parseJsonInput } from "../writingFormula.utils";
import { isStarterStyleProfile } from "../writingFormulaV2.shared";

interface WritingFormulaEditorState {
  name: string;
  description: string;
  category: string;
  tags: string;
  applicableGenres: string;
  sourceContent: string;
  extractedFeatures: StyleProfileFeature[];
  analysisMarkdown: string;
  narrativeRules: string;
  characterRules: string;
  languageRules: string;
  rhythmRules: string;
  antiAiRuleIds: string[];
}

interface WritingFormulaEditorPanelProps {
  selectedProfile: StyleProfile | null;
  editor: WritingFormulaEditorState;
  antiAiRules: AntiAiRule[];
  savePending: boolean;
  deletePending: boolean;
  reextractPending: boolean;
  onEditorChange: (patch: Partial<WritingFormulaEditorState>) => void;
  onToggleExtractedFeature: (featureId: string, checked: boolean) => void;
  onReextractFeatures: () => void;
  onToggleAntiAiRule: (ruleId: string, checked: boolean) => void;
  onSave: () => void;
  onDelete: () => void;
}

function FieldBlock(props: {
  label: string;
  hint: string;
  children: ReactNode;
}) {
  return (
    <label className="space-y-2">
      <div className="space-y-1">
        <div className="text-sm font-medium text-slate-900">{props.label}</div>
        <div className="text-xs leading-6 text-slate-500">{props.hint}</div>
      </div>
      {props.children}
    </label>
  );
}

const FEATURE_DECISION_META: Record<NonNullable<StyleProfileFeature["selectedDecision"]>, { label: string; className: string }> = {
  keep: {
    label: "Reservar",
    className: "border-emerald-200 bg-emerald-50 text-emerald-700",
  },
  weaken: {
    label: "Debilitar",
    className: "border-amber-200 bg-amber-50 text-amber-700",
  },
  remove: {
    label: "Pelar",
    className: "border-rose-200 bg-rose-50 text-rose-700",
  },
};

const RULE_PATCH_SECTION_LABELS: Record<keyof StyleRulePatch, string> = {
  narrativeRules: "Avance de la trama",
  characterRules: "Expresión de carácter",
  languageRules: "Textura del lenguaje",
  rhythmRules: "Densidad del ritmo",
};

function formatScorePercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function countPresetDecisions(
  preset: StyleExtractionPreset,
): Record<NonNullable<StyleProfileFeature["selectedDecision"]>, number> {
  return preset.decisions.reduce<Record<NonNullable<StyleProfileFeature["selectedDecision"]>, number>>((result, item) => {
    result[item.decision] += 1;
    return result;
  }, {
    keep: 0,
    weaken: 0,
    remove: 0,
  });
}

function listRulePatchSections(patch: StyleRulePatch | undefined): string[] {
  if (!patch) {
    return [];
  }

  return (Object.entries(RULE_PATCH_SECTION_LABELS) as Array<[keyof StyleRulePatch, string]>)
    .filter(([key]) => {
      const section = patch[key];
      return Boolean(section && typeof section === "object" && !Array.isArray(section) && Object.keys(section).length > 0);
    })
    .map(([, label]) => label);
}

function RuleFieldCard(props: {
  title: string;
  hint: string;
  section: RuleSection;
  value: string;
  onChange: (value: string) => void;
}) {
  let parseError = false;
  let parsedRules: Record<string, unknown> = {};
  try {
    const parsed = JSON.parse(props.value);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      parsedRules = parsed as Record<string, unknown>;
    } else {
      parseError = true;
    }
  } catch {
    parsedRules = parseJsonInput(props.value);
    parseError = props.value.trim() !== "" && Object.keys(parsedRules).length === 0 && props.value.trim() !== "{}";
  }

  const entries = buildReadableRuleEntries(props.section, parsedRules);

  return (
    <div className="space-y-2 rounded-2xl border bg-slate-50/70 p-4">
      <div className="space-y-1">
        <div className="text-sm font-medium text-slate-900">{props.title}</div>
        <div className="text-xs leading-6 text-slate-500">{props.hint}</div>
      </div>

      {entries.length > 0 ? (
        <div className="grid gap-2">
          {entries.map((entry) => (
            <div key={`${props.section}-${entry.key}`} className="rounded-xl border bg-white px-3 py-3">
              <div className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">{entry.label}</div>
              <div className="mt-1 text-sm leading-6 text-slate-700">{entry.value}</div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed bg-white px-3 py-3 text-sm leading-6 text-slate-500">
          Esta regla actualmente no tiene campos legibles. Puede confiar primero en la introducción y las reglas anti-IA anteriores y luego expandir el JSON avanzado cuando realmente necesite una compatibilidad detallada.
        </div>
      )}

      <details className="rounded-xl border bg-white">
        <summary className="cursor-pointer list-none px-3 py-3 text-sm font-medium text-slate-700">
          Ver o editar JSON avanzado
        </summary>
        <div className="space-y-3 border-t px-3 py-3">
          <div className="text-xs leading-6 text-slate-500">
            La entrada JSON original se conserva aquí, principalmente por compatibilidad con activos antiguos o ajuste fino de parámetros. En circunstancias normales, basta con mirar los campos legibles de arriba.
          </div>
          {parseError ? (
            <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-6 text-amber-900">
              La estructura JSON actual no se reconoce correctamente. Al guardar, el sistema intentará devolverlo a un objeto vacío. Se recomienda corregir el formato antes de guardar.
            </div>
          ) : null}
          <textarea
            className="min-h-[190px] w-full rounded-xl border bg-slate-50 p-3 font-mono text-xs"
            value={props.value}
            onChange={(event) => props.onChange(event.target.value)}
          />
        </div>
      </details>
    </div>
  );
}

export default function WritingFormulaEditorPanel(props: WritingFormulaEditorPanelProps) {
  const {
    selectedProfile,
    editor,
    antiAiRules,
    savePending,
    deletePending,
    reextractPending,
    onEditorChange,
    onToggleExtractedFeature,
    onReextractFeatures,
    onToggleAntiAiRule,
    onSave,
    onDelete,
  } = props;
  const compatibilityFields = STYLE_ENGINE_COMPATIBILITY_FIELDS.narrativeRules.join(" / ");
  const extractionPresets = selectedProfile?.extractionPresets ?? [];
  const selectedPresetKey = selectedProfile?.selectedExtractionPresetKey ?? null;
  const antiAiRuleByKey = new Map(antiAiRules.map((rule) => [rule.key, rule]));

  return (
    <Card data-writing-formula-editor-panel tabIndex={-1}>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle>Editar escritura actual</CardTitle>
          {selectedProfile ? (
            <Button size="sm" variant="destructive" onClick={onDelete} disabled={deletePending}>
              borrar
            </Button>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {!selectedProfile ? (
          <div className="text-sm text-muted-foreground">Primero regrese a la lista de páginas de métodos de escritura, seleccione un método de escritura y luego ingrese aquí para editar.</div>
        ) : (
          <>
            {isStarterStyleProfile(selectedProfile) ? (
              <div className="rounded-2xl border bg-muted/20 px-4 py-3 text-sm leading-7 text-muted-foreground">
                Este es el método de inicio preestablecido por el sistema para usted. Puedes modificarlo directamente según tu propio proyecto, sin hacer una copia primero y luego editarlo.
              </div>
            ) : null}

            <div className="rounded-2xl border bg-slate-50/70 px-4 py-4 text-sm leading-7 text-slate-700">
              Si no quiere enfrentarse a un montón de campos técnicos al principio, lo más importante es mantener primero estas cuatro áreas: nombre del método de escritura, introducción, temas aplicables y reglas anti-IA. Los siguientes cuatro conjuntos de reglas avanzadas le dan al sistema una capa de control más refinada. Si no estás familiarizado con él, puedes empezar con menos acción.
            </div>

            <div className="space-y-4 rounded-2xl border p-4">
              <div className="space-y-1">
                <div className="text-base font-semibold text-slate-950">Posicionamiento básico</div>
                <div className="text-sm leading-6 text-slate-500">
                  Primero, dejemos claro cómo es este estilo de escritura. Cuando se expande la página de la lista, el contenido aquí se mostrará primero.
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <FieldBlock label="Nombre escrito" hint="Este es el título principal que utilizará para identificar este estilo de escritura en la lista en el futuro. Intente anotar el tema o el sentido de la lectura.">
                  <input
                    data-writing-formula-primary-input
                    className="w-full rounded-md border p-2 text-sm"
                    value={editor.name}
                    onChange={(event) => onEditorChange({ name: event.target.value })}
                  />
                </FieldBlock>
                <FieldBlock label="Clasificación" hint="Se utiliza para archivarte a ti mismo, como transmisiones rápidas urbanas, de fantasía, románticas y apasionadas.">
                  <input
                    className="w-full rounded-md border p-2 text-sm"
                    placeholder="Por ejemplo: pasión urbana"
                    value={editor.category}
                    onChange={(event) => onEditorChange({ category: event.target.value })}
                  />
                </FieldBlock>
              </div>

              <FieldBlock
                label="Introducción de una frase"
                hint="Utilice una oración completa para explicar el sentido de lectura, progresión o expresión de caracteres que este método de escritura pretende producir."
              >
                <textarea
                  className="min-h-[96px] w-full rounded-md border p-2 text-sm"
                  placeholder="Por ejemplo: conflictos intensos, avances rápidos, diálogo directo y emociones explícitas son adecuados para historias de mejora urbana."
                  value={editor.description}
                  onChange={(event) => onEditorChange({ description: event.target.value })}
                />
              </FieldBlock>

              <div className="grid gap-4 md:grid-cols-2">
                <FieldBlock label="Etiqueta" hint="Para su propia búsqueda, simplemente escriba algunas palabras cortas, separadas por comas.">
                  <input
                    className="w-full rounded-md border p-2 text-sm"
                    placeholder="Por ejemplo: escritura genial, ritmo rápido, conflicto fuerte."
                    value={editor.tags}
                    onChange={(event) => onEditorChange({ tags: event.target.value })}
                  />
                </FieldBlock>
                <FieldBlock label="Temas aplicables" hint="Indique al sistema para qué temas o escenas es más adecuado este método de escritura, separados por comas.">
                  <input
                    className="w-full rounded-md border p-2 text-sm"
                    placeholder="Por ejemplo: urbano, apasionado, flujo de actualización."
                    value={editor.applicableGenres}
                    onChange={(event) => onEditorChange({ applicableGenres: event.target.value })}
                  />
                </FieldBlock>
              </div>
            </div>

            {selectedProfile.sourceType === "from_text"
            || selectedProfile.sourceType === "from_knowledge_document"
            || editor.sourceContent.trim() ? (
              <div className="space-y-4 rounded-2xl border p-4">
                <div className="space-y-1">
                  <div className="text-base font-semibold text-slate-950">Base del texto original y características extraídas.</div>
                  <div className="text-sm leading-6 text-slate-500">
                    Esta parte es la "capa de evidencia" de este método de escritura. El método de redacción extraído del texto original o base de conocimientos se basará en este para su posterior revisión y reextracción. Aquí se mostrarán descripciones de funciones, evidencia, puntuaciones, sugerencias preestablecidas y reglas de recomendación.
                  </div>
                </div>

                <FieldBlock
                  label="Muestra de texto original"
                  hint="El texto al que se hizo referencia al extraer este conjunto de escritos se guarda aquí. Cuanto más completa sea la muestra, más fácil será para el sistema extraer características estables."
                >
                  <textarea
                    className="min-h-[160px] w-full rounded-md border p-2 text-sm"
                    placeholder="La muestra de texto original utilizada en la extracción de activos para este conjunto de métodos de escritura."
                    value={editor.sourceContent}
                    onChange={(event) => onEditorChange({ sourceContent: event.target.value })}
                  />
                </FieldBlock>

                <div className="rounded-2xl border p-3">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-medium text-slate-900">Funciones de extracción habilitadas</div>
                      <div className="text-xs leading-6 text-slate-500">
                        Aquí se enumerarán los rasgos estilísticos extraídos del texto original. Marcar la casilla significa continuar manteniendo este método de escritura.
                        {editor.extractedFeatures.length > 0 ? ` total actual ${editor.extractedFeatures.length} artículo.` : ""}
                      </div>
                    </div>
                    {editor.sourceContent.trim() ? (
                      <Button size="sm" variant="outline" onClick={onReextractFeatures} disabled={reextractPending}>
                        {reextractPending ? "Reextrayendo..." : "Volver a extraer características"}
                      </Button>
                    ) : null}
                  </div>

                  {editor.extractedFeatures.length > 0 ? (
                    <div className="space-y-3">
                      <div className="grid gap-2 md:grid-cols-2">
                      {editor.extractedFeatures.map((feature) => (
                        <label key={feature.id} className="flex items-start gap-2 rounded-md border p-3 text-sm">
                          <input
                            type="checkbox"
                            checked={feature.enabled}
                            onChange={(event) => onToggleExtractedFeature(feature.id, event.target.checked)}
                          />
                          <span className="min-w-0 flex-1">
                            <span className="flex flex-wrap items-center gap-2">
                              <span className="font-medium">{feature.label}</span>
                              <span className="text-xs text-muted-foreground">[{feature.group}]</span>
                              {feature.selectedDecision ? (
                                <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${FEATURE_DECISION_META[feature.selectedDecision].className}`}>
                                  {FEATURE_DECISION_META[feature.selectedDecision].label}
                                </span>
                              ) : null}
                            </span>
                            <span className="mt-1 block text-xs leading-6 text-muted-foreground">{feature.description}</span>
                            <span className="mt-1 block text-xs leading-6 text-muted-foreground">Evidencia:{feature.evidence}</span>
                            <span className="mt-2 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                              <span className="rounded-lg bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-600">
                                importancia {formatScorePercent(feature.importance)}
                              </span>
                              <span className="rounded-lg bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-600">
                                Valor de imitación {formatScorePercent(feature.imitationValue)}
                              </span>
                              <span className="rounded-lg bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-600">
                                Movilidad {formatScorePercent(feature.transferability)}
                              </span>
                              <span className="rounded-lg bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-600">
                                Riesgo de huellas dactilares {formatScorePercent(feature.fingerprintRisk)}
                              </span>
                            </span>
                            <span className="mt-2 flex flex-wrap gap-2">
                              {listRulePatchSections(feature.keepRulePatch).length > 0 ? (
                                listRulePatchSections(feature.keepRulePatch).map((label) => (
                                  <span key={`${feature.id}-${label}`} className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] text-slate-600">
                                    {label}regla
                                  </span>
                                ))
                              ) : (
                                <span className="rounded-full border border-dashed border-slate-200 px-2 py-0.5 text-[11px] text-slate-500">
                                  Actualmente solo existen reglas de nivel resumido.
                                </span>
                              )}
                            </span>
                          </span>
                        </label>
                      ))}
                      </div>

                      {extractionPresets.length > 0 ? (
                        <div className="rounded-2xl border bg-slate-50/70 p-3">
                          <div className="space-y-1">
                            <div className="text-sm font-medium text-slate-900">Extraer sugerencias preestablecidas</div>
                            <div className="text-xs leading-6 text-slate-500">
                              Aquí hay tres conjuntos de opciones de retención proporcionadas por el modelo. La selección actualmente guardada en el método de escritura se marcará por separado para facilitarle la evaluación de si necesita cambiar la intensidad de retención.
                            </div>
                          </div>
                          <div className="mt-3 grid gap-3 lg:grid-cols-3">
                            {extractionPresets.map((preset) => {
                              const counts = countPresetDecisions(preset);
                              const isSelected = preset.key === selectedPresetKey;
                              return (
                                <div
                                  key={preset.key}
                                  className={`rounded-xl border bg-white p-3 ${isSelected ? "border-primary ring-1 ring-primary/20" : ""}`}
                                >
                                  <div className="flex items-center justify-between gap-2">
                                    <div className="text-sm font-medium text-slate-900">{preset.label}</div>
                                    {isSelected ? (
                                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                                        Aplicado actualmente
                                      </span>
                                    ) : null}
                                  </div>
                                  <div className="mt-1 text-xs leading-6 text-slate-500">{preset.summary}</div>
                                  <div className="mt-3 flex flex-wrap gap-2">
                                    <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] text-emerald-700">
                                      reservar {counts.keep}
                                    </span>
                                    <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] text-amber-700">
                                      debilitar {counts.weaken}
                                    </span>
                                    <span className="rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[11px] text-rose-700">
                                      despegar {counts.remove}
                                    </span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ) : null}

                      {selectedProfile.extractionAntiAiRuleKeys.length > 0 ? (
                        <div className="rounded-2xl border bg-slate-50/70 p-3">
                          <div className="space-y-1">
                            <div className="text-sm font-medium text-slate-900">Reglas anti-IA sugeridas por el modelo</div>
                            <div className="text-xs leading-6 text-slate-500">
                              Estas son las reglas que se recomienda agrupar durante la fase de extracción. Los encuadernados se marcarán directamente y los no encuadernados seguirán conservando sus nombres sugeridos originales.
                            </div>
                          </div>
                          <div className="mt-3 flex flex-wrap gap-2">
                            {selectedProfile.extractionAntiAiRuleKeys.map((ruleKey) => {
                              const matchedRule = antiAiRuleByKey.get(ruleKey);
                              const isBound = Boolean(matchedRule && editor.antiAiRuleIds.includes(matchedRule.id));
                              return (
                                <span
                                  key={ruleKey}
                                  className={`rounded-full border px-2 py-1 text-xs ${
                                    isBound
                                      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                      : "border-slate-200 bg-white text-slate-600"
                                  }`}
                                >
                                  {matchedRule?.name ?? ruleKey}
                                  {isBound ? " · Atado" : matchedRule ? " · Recomendar sin consolidar" : " · Sugerencia original"}
                                </span>
                              );
                            })}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                      Este método de escritura de texto aún no ha generado entradas de funciones opcionales. Puede hacer clic en "Volver a extraer funciones" para regenerar un grupo de funciones completo a partir de la muestra de texto original.
                    </div>
                  )}
                </div>
              </div>
            ) : null}

            <div className="space-y-4 rounded-2xl border p-4">
              <div className="space-y-1">
                <div className="text-base font-semibold text-slate-950">Borrador de análisis para que el sistema lo vea.</div>
                <div className="text-sm leading-6 text-slate-500">
                  Esta no es una copia para lectores, sino una explicación complementaria para que usted y el sistema la utilicen al revisarla. Puedes escribir sobre por qué conservas este estilo de escritura y cuál es su cualidad más importante.
                </div>
              </div>
              <textarea
                className="min-h-[110px] w-full rounded-md border p-2 text-sm"
                placeholder="Por ejemplo: este estilo de escritura se centra en conservar una fuerte propulsión y un diálogo directo, y no persigue un lirismo delicado."
                value={editor.analysisMarkdown}
                onChange={(event) => onEditorChange({ analysisMarkdown: event.target.value })}
              />
            </div>

            <div className="space-y-4 rounded-2xl border p-4">
              <div className="space-y-1">
                <div className="text-base font-semibold text-slate-950">Bloque de reglas avanzadas</div>
                <div className="text-sm leading-6 text-slate-500">
                  Estos cuatro bloques son la capa de reglas de la máquina que se leerán cuando el sistema se ejecute realmente. Cuando no comprende el significado de un campo, primero puede leer el título y la descripción antes de decidir si desea cambiarlo. Si el campo "Descripción general" se muestra actualmente principalmente, significa que esta extracción proporciona más reglas a nivel de resumen y no hay muchos campos compatibles detallados.
                </div>
              </div>

              <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-6 text-amber-900">
                El campo de compatibilidad se utiliza principalmente para la compatibilidad de activos antiguos y una pequeña cantidad de escenarios experimentales:{compatibilityFields}. Cuando se requiere un control estable del sentido de lectura, se debe dar prioridad al mantenimiento de resúmenes de capas de expresión y reglas anti-IA.
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <RuleFieldCard
                  title="Reglas de avance de la trama"
                  hint="Controla cómo avanza la trama, cómo termina la escena, si hay múltiples perspectivas y si se permiten ganchos hacia atrás."
                  section="narrativeRules"
                  value={editor.narrativeRules}
                  onChange={(value) => onEditorChange({ narrativeRules: value })}
                />
                <RuleFieldCard
                  title="Reglas de expresión de personajes."
                  hint="Controla cómo hablan los personajes, cómo se exponen sus emociones, si son propensos a la introspección y si priorizan mantener la dignidad."
                  section="characterRules"
                  value={editor.characterRules}
                  onChange={(value) => onEditorChange({ characterRules: value })}
                />
                <RuleFieldCard
                  title="Reglas de textura del lenguaje"
                  hint="Controle la aspereza de las oraciones, el grado de habla, los cambios en la estructura de las oraciones y si se permiten oraciones incompletas."
                  section="languageRules"
                  value={editor.languageRules}
                  onChange={(value) => onEditorChange({ languageRules: value })}
                />
                <RuleFieldCard
                  title="Reglas de densidad del ritmo"
                  hint="Controla la velocidad de avance, densidad de párrafos, acción y explicación de quién tiene prioridad."
                  section="rhythmRules"
                  value={editor.rhythmRules}
                  onChange={(value) => onEditorChange({ rhythmRules: value })}
                />
              </div>
            </div>

            <div className="space-y-4 rounded-2xl border p-4">
              <div className="space-y-1">
                <div className="text-base font-semibold text-slate-950">Vincular las reglas anti-IA</div>
                <div className="text-sm leading-6 text-slate-500">
                  Esto determina qué problemas priorizará el sistema para prevenir al detectar y corregir manuscritos. Cuanto más claras estén las reglas, más sentido de dirección habrá al "eliminar el sabor de la IA".
                </div>
              </div>
              <div className="grid gap-2 md:grid-cols-2">
                {antiAiRules.map((rule) => (
                  <label key={rule.id} className="flex items-start gap-2 rounded-md border p-3 text-sm">
                    <input
                      type="checkbox"
                      checked={editor.antiAiRuleIds.includes(rule.id)}
                      onChange={(event) => onToggleAntiAiRule(rule.id, event.target.checked)}
                    />
                    <span>
                      <span className="font-medium">{rule.name}</span>
                      <span className="mt-1 block text-xs leading-6 text-muted-foreground">{rule.description}</span>
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-slate-50/70 px-4 py-3">
              <div className="text-sm leading-6 text-slate-600">
                Después de guardar, los detalles de la expansión, la detección de eliminación de versiones de IA y las pruebas de aplicaciones de este método de escritura leerán la nueva configuración simultáneamente.
              </div>
              <Button onClick={onSave} disabled={savePending || !editor.name.trim()}>
                Guardar estilo de escritura actual
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
