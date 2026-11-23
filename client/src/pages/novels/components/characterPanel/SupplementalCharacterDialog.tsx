import { useState } from "react";
import type {
  Character,
  CharacterCastRole,
  SupplementalCharacterCandidate,
  SupplementalCharacterGenerationMode,
  SupplementalCharacterGenerationResult,
} from "@ai-novel/shared/types/novel";
import AiButton from "@/components/common/AiButton";
import SelectControl from "@/components/common/SelectControl";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  getCastRoleLabel,
  getCharacterGenderLabel,
  getSupplementalRelationLabel,
  SUPPLEMENTAL_MODE_LABELS,
} from "./characterPanel.labels";
import type { SupplementalCharacterDialogActions } from "./characterPanel.types";

interface SupplementalCharacterDialogProps extends SupplementalCharacterDialogActions {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  characters: Character[];
  selectedCharacterId: string;
  isGeneratingSupplementalCharacters: boolean;
  isApplyingSupplementalCharacter: boolean;
}

export default function SupplementalCharacterDialog(props: SupplementalCharacterDialogProps) {
  const {
    open,
    onOpenChange,
    characters,
    selectedCharacterId,
    onGenerateSupplementalCharacters,
    isGeneratingSupplementalCharacters,
    onApplySupplementalCharacter,
    isApplyingSupplementalCharacter,
  } = props;
  const [supplementalMode, setSupplementalMode] = useState<SupplementalCharacterGenerationMode>("auto");
  const [supplementalAnchorIds, setSupplementalAnchorIds] = useState<string[]>([]);
  const [supplementalTargetRole, setSupplementalTargetRole] = useState<CharacterCastRole | "auto">("auto");
  const [supplementalCount, setSupplementalCount] = useState("");
  const count = supplementalCount.trim() ? Number(supplementalCount) : undefined;
  const invalidCount = count !== undefined && (!Number.isSafeInteger(count) || count < 1);
  const [supplementalPrompt, setSupplementalPrompt] = useState("");
  const [supplementalUseWorldContext, setSupplementalUseWorldContext] = useState(true);
  const [supplementalStatusMessage, setSupplementalStatusMessage] = useState("");
  const [supplementalResult, setSupplementalResult] = useState<SupplementalCharacterGenerationResult | null>(null);

  const handleOpenChange = (nextOpen: boolean) => {
    onOpenChange(nextOpen);
    if (nextOpen && selectedCharacterId && supplementalAnchorIds.length === 0) {
      setSupplementalAnchorIds([selectedCharacterId]);
    }
  };

  const toggleSupplementalAnchor = (characterId: string) => {
    setSupplementalAnchorIds((prev) =>
      prev.includes(characterId)
        ? prev.filter((item) => item !== characterId)
        : [...prev, characterId],
    );
  };

  const handleGenerateSupplementalCharacters = async () => {
    if (invalidCount) return;
    if (supplementalMode === "linked" && characters.length === 0) {
      setSupplementalStatusMessage("Actualmente no hay roles existentes y no se pueden agregar roles en función de las relaciones. Puedes crear un personaje principal primero o usar rellenos independientes en su lugar.");
      return;
    }

    try {
      const response = await onGenerateSupplementalCharacters({
        mode: supplementalMode,
        anchorCharacterIds: supplementalMode === "independent" ? [] : supplementalAnchorIds,
        targetCastRole: supplementalTargetRole,
        count,
        userPrompt: supplementalPrompt.trim() || undefined,
        useWorldContext: supplementalUseWorldContext,
        worldFocusHints: supplementalUseWorldContext
          ? { forceCompliance: true }
          : undefined,
      });
      setSupplementalResult(response.data ?? null);
      setSupplementalStatusMessage(response.message ?? "Se han generado candidatos para el puesto suplementario.");
    } catch (error) {
      setSupplementalStatusMessage(error instanceof Error ? error.message : "Error en la generación de caracteres suplementarios.");
    }
  };

  const handleApplySupplementalCharacter = async (candidate: SupplementalCharacterCandidate) => {
    try {
      const response = await onApplySupplementalCharacter(candidate);
      const createdName = response.data?.character?.name ?? candidate.name;
      const relationCount = response.data?.relationCount ?? 0;
      setSupplementalResult((prev) => prev
        ? {
          ...prev,
          candidates: prev.candidates.filter((item) => item.name !== candidate.name),
        }
        : prev);
      setSupplementalStatusMessage(
        response.message
        ?? `${createdName} Ya agregado a la novela actual.${relationCount > 0 ? `y sincronizar ${relationCount} relación` : ""}.`,
      );
    } catch (error) {
      setSupplementalStatusMessage(error instanceof Error ? error.message : "Error al aplicar el rol suplementario.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="flex max-h-[90vh] w-[calc(100vw-2rem)] max-w-5xl flex-col overflow-hidden p-0">
        <DialogHeader className="shrink-0 px-6 pb-0 pt-6">
          <DialogTitle>Roles complementarios</DialogTitle>
          <DialogDescription>
            Adecuado para complementar oponentes, aliados, factores estresantes o figuras clave de relaciones. La IA combinará la alineación existente para proporcionar candidatos que se puedan crear.
          </DialogDescription>
        </DialogHeader>
        <div className="grid min-h-0 flex-1 gap-4 overflow-y-auto px-6 pb-6 pt-4 xl:grid-cols-[minmax(320px,0.9fr)_minmax(0,1.1fr)] xl:overflow-hidden">
          <div className="space-y-4 rounded-xl border border-border/70 bg-muted/10 p-4 xl:min-h-0 xl:overflow-y-auto">
            <div className="space-y-1">
              <div className="font-medium">Método de llenado</div>
              <div className="text-xs text-muted-foreground">
                Por defecto, corresponde a la IA juzgar; Solo puedes especificarlo manualmente cuando sepas claramente qué tipo de carácter deseas completar.
              </div>
            </div>
            <SelectControl
              className="w-full rounded-md border bg-background p-2 text-sm"
              value={supplementalMode}
              onChange={(event) => setSupplementalMode(event.target.value as SupplementalCharacterGenerationMode)}
            >
              <option value="auto">La IA determina qué puesto de trabajo es más necesario actualmente</option>
              <option value="linked">Derivar roles de relación basados ​​en roles existentes</option>
              <option value="independent">Generar roles relativamente independientes</option>
            </SelectControl>

            {characters.length > 0 && supplementalMode !== "independent" ? (
              <div className="space-y-2">
                <div className="font-medium">Consulte los roles existentes</div>
                <div className="text-xs text-muted-foreground">
                  Opcional; Si no se selecciona, la IA determinará quién debe ocupar el puesto.
                </div>
                <div className="max-h-40 space-y-2 overflow-auto rounded-xl border bg-background/70 p-3">
                  {characters.map((character) => (
                    <label key={character.id} className="flex items-start gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={supplementalAnchorIds.includes(character.id)}
                        onChange={() => toggleSupplementalAnchor(character.id)}
                      />
                      <span>
                        {character.name}
                        <span className="ml-1 text-xs text-muted-foreground">({character.role})</span>
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <div className="font-medium">Funcionalidad de rol deseada</div>
                <SelectControl
                  className="w-full rounded-md border bg-background p-2 text-sm"
                  value={supplementalTargetRole}
                  onChange={(event) => setSupplementalTargetRole(event.target.value as CharacterCastRole | "auto")}
                >
                  <option value="auto">Juicio de IA</option>
                  <option value="protagonist">Protagonista</option>
                  <option value="antagonist">Oponente principal</option>
                  <option value="ally">Alianza</option>
                  <option value="foil">Papel espejo</option>
                  <option value="mentor">Mentor</option>
                  <option value="love_interest">Atracción emocional</option>
                  <option value="pressure_source">Factor estresante</option>
                  <option value="catalyst">Catalizador</option>
                </SelectControl>
              </div>
              <div className="space-y-2">
                <label className="font-medium" htmlFor="supplemental-character-count">Número de candidatos</label>
                <Input id="supplemental-character-count" type="number" min={1} step={1} placeholder="Déjelo en blanco para que la IA lo recomiende según las historias." value={supplementalCount}
                  aria-invalid={invalidCount} aria-describedby={invalidCount ? "supplemental-count-error" : undefined}
                  onChange={event => setSupplementalCount(event.target.value)}/>
                {invalidCount ? <p id="supplemental-count-error" className="text-xs text-destructive">Ingrese un número entero positivo o déjelo en blanco para obtener una recomendación de IA.</p> : null}
              </div>
            </div>

            <div className="space-y-2">
              <div className="font-medium">Instrucciones adicionales</div>
              <textarea
                className="min-h-[140px] w-full rounded-xl border bg-background p-3 text-sm"
                placeholder="Por ejemplo: agregar una persona que pueda seguir presionando al protagonista, pero que no sea un villano puro; o añadiendo un viejo conocido relacionado con la línea materna."
                value={supplementalPrompt}
                onChange={(event) => setSupplementalPrompt(event.target.value)}
              />
            </div>

            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <input
                type="checkbox"
                checked={supplementalUseWorldContext}
                onChange={(event) => setSupplementalUseWorldContext(event.target.checked)}
              />
              Genera un mundo basado en este libro.
            </label>

            <div className="flex flex-wrap gap-2">
              <AiButton
                onClick={handleGenerateSupplementalCharacters}
                disabled={isGeneratingSupplementalCharacters || invalidCount || (supplementalMode === "linked" && characters.length === 0)}
              >
                {isGeneratingSupplementalCharacters ? "Generando..." : "Generar candidatos para roles complementarios"}
              </AiButton>
              <Badge variant="outline">Los roles de relación se cubrirán primero en torno a los roles existentes.</Badge>
            </div>

            {supplementalStatusMessage ? (
              <div className="rounded-xl border border-border/70 bg-background/80 p-3 text-xs text-muted-foreground">
                {supplementalStatusMessage}
              </div>
            ) : null}
          </div>

          <div className="space-y-3 rounded-xl border border-border/70 bg-background p-4 xl:min-h-0 xl:overflow-y-auto">
            <div className="flex flex-wrap items-center gap-2">
              <div className="font-medium">Resultados de los candidatos</div>
              {supplementalResult ? <Badge variant="outline">{supplementalResult.candidates.length} Candidatos</Badge> : null}
              {supplementalResult?.mode ? <Badge variant="outline">Este modo redondo:{SUPPLEMENTAL_MODE_LABELS[supplementalResult.mode]}</Badge> : null}
            </div>
            {supplementalResult?.planningSummary ? (
              <div className="rounded-xl border border-amber-200/60 bg-amber-50/50 p-3 text-xs text-muted-foreground">
                Juicio de IA:{supplementalResult.planningSummary}
              </div>
            ) : null}

            {isGeneratingSupplementalCharacters ? (
              <div className="flex min-h-[320px] items-center justify-center rounded-xl border border-dashed text-sm text-muted-foreground">
                Analizando la red de personajes actual y generando candidatos suplentes...
              </div>
            ) : supplementalResult?.candidates.length ? (
              <div className="space-y-3">
                {supplementalResult.candidates.map((candidate) => (
                  <SupplementalCandidateCard
                    key={candidate.name}
                    candidate={candidate}
                    isApplyingSupplementalCharacter={isApplyingSupplementalCharacter}
                    onApply={() => void handleApplySupplementalCharacter(candidate)}
                  />
                ))}
              </div>
            ) : (
              <div className="flex min-h-[320px] items-center justify-center rounded-xl border border-dashed px-6 text-center text-sm text-muted-foreground">
                Primero explique qué tipo de función desea desempeñar, o deje que la IA juzgue directamente y luego genere candidatos.
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SupplementalCandidateCard(props: {
  candidate: SupplementalCharacterCandidate;
  isApplyingSupplementalCharacter: boolean;
  onApply: () => void;
}) {
  const { candidate, isApplyingSupplementalCharacter, onApply } = props;

  return (
    <div className="rounded-xl border border-border/70 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <div className="font-medium">{candidate.name}</div>
            <Badge variant="outline">{candidate.role}</Badge>
            <Badge variant="secondary">{getCastRoleLabel(candidate.castRole)}</Badge>
            <Badge variant="outline">Género:{getCharacterGenderLabel(candidate.gender)}</Badge>
          </div>
          <div className="text-sm text-muted-foreground">{candidate.summary}</div>
        </div>
        <Button size="sm" onClick={onApply} disabled={isApplyingSupplementalCharacter}>
          {isApplyingSupplementalCharacter ? "Creando..." : "Crea este rol"}
        </Button>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <div className="rounded-xl border border-dashed p-3 text-xs text-muted-foreground">
          <div>Función de historia:{candidate.storyFunction}</div>
          <div>Relación con el protagonista:{candidate.relationToProtagonist || "IA no especificada"}</div>
          <div>Metas externas:{candidate.outerGoal || "Pendiente"}</div>
          <div>Objetivos actuales:{candidate.currentGoal || "Pendiente"}</div>
        </div>
        <div className="rounded-xl border border-dashed p-3 text-xs text-muted-foreground">
          <div>Primera impresión:{candidate.firstImpression || "Pendiente"}</div>
          <div>Miedo central:{candidate.fear || "Pendiente"}</div>
          <div>Falsa creencia:{candidate.misbelief || "Pendiente"}</div>
          <div>Motivo del reemplazo:{candidate.whyNow || "AI Sin explicación adicional"}</div>
        </div>
      </div>

      {candidate.relations.length > 0 ? (
        <div className="mt-3 space-y-2">
          <div className="text-xs font-medium text-muted-foreground">Relaciones sincronizadas recomendadas</div>
          <div className="grid gap-2 sm:grid-cols-2">
            {candidate.relations.map((relation, index) => (
              <div key={`${candidate.name}-${relation.sourceName}-${relation.targetName}-${index}`} className="rounded-xl border border-dashed p-3 text-xs text-muted-foreground">
                <div className="font-medium text-foreground">{getSupplementalRelationLabel(candidate, relation)}</div>
                <div>Relación superficial:{relation.surfaceRelation}</div>
                {relation.hiddenTension ? <div>Tensión oculta:{relation.hiddenTension}</div> : null}
                {relation.conflictSource ? <div>Fuente de conflicto:{relation.conflictSource}</div> : null}
                {relation.nextTurnPoint ? <div>Próximo punto de reversión:{relation.nextTurnPoint}</div> : null}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="mt-3 rounded-xl border border-dashed p-3 text-xs text-muted-foreground">
          Este personaje prefiere desempeñarse de forma independiente y no tiene que escribir una relación de roles.
        </div>
      )}
    </div>
  );
}
