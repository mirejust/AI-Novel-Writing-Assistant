import { useState } from "react";
import type {
  Character,
  CharacterVisibleProfileBatchResult,
  CharacterVisibleProfileSuggestion,
} from "@ai-novel/shared/types/novel";
import AiButton from "@/components/common/AiButton";
import { Button } from "@/components/ui/button";
import { VISIBLE_PROFILE_FIELDS } from "./characterWorkspace.helpers";

interface CharacterVisibleProfileTabProps {
  characters: Character[];
  selectedCharacter: Character;
  selectedCharacterId: string;
  onGenerateVisibleProfile: (userGuidance?: string) => void;
  isGeneratingVisibleProfile: boolean;
  visibleProfileSuggestion?: CharacterVisibleProfileSuggestion | null;
  onApplyVisibleProfile: () => void;
  isApplyingVisibleProfile: boolean;
  onGenerateBatchVisibleProfiles: (userGuidance?: string) => void;
  isGeneratingBatchVisibleProfiles: boolean;
  batchVisibleProfileResult?: CharacterVisibleProfileBatchResult | null;
  onApplyBatchVisibleProfiles: () => void;
  isApplyingBatchVisibleProfiles: boolean;
}

export default function CharacterVisibleProfileTab(props: CharacterVisibleProfileTabProps) {
  const {
    characters,
    selectedCharacter,
    selectedCharacterId,
    onGenerateVisibleProfile,
    isGeneratingVisibleProfile,
    visibleProfileSuggestion,
    onApplyVisibleProfile,
    isApplyingVisibleProfile,
    onGenerateBatchVisibleProfiles,
    isGeneratingBatchVisibleProfiles,
    batchVisibleProfileResult,
    onApplyBatchVisibleProfiles,
    isApplyingBatchVisibleProfiles,
  } = props;
  const [visibleProfileGuidance, setVisibleProfileGuidance] = useState("");
  const hasVisibleProfileSuggestionForSelected = Boolean(
    visibleProfileSuggestion
    && visibleProfileSuggestion.characterId === selectedCharacter.id,
  );
  const applicableVisibleProfileCount = Object.keys(visibleProfileSuggestion?.fields ?? {}).length;
  const batchApplicableCount = batchVisibleProfileResult?.results.filter((item) => item.hasApplicableChanges).length ?? 0;

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-border/70 bg-muted/10 p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="text-sm font-medium">Generación de datos explícitos</div>
            <div className="mt-1 text-xs leading-5 text-muted-foreground">
              Complete los puntos de memoria de apariencia, postura corporal, voz y apariencia para que los lectores puedan identificar más fácilmente al personaje en el texto.
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <AiButton
              size="sm"
              variant="outline"
              onClick={() => onGenerateVisibleProfile(visibleProfileGuidance)}
              disabled={isGeneratingVisibleProfile || !selectedCharacterId}
            >
              {isGeneratingVisibleProfile ? "Generando..." : "La IA completa datos explícitos"}
            </AiButton>
            <AiButton
              size="sm"
              variant="outline"
              onClick={() => onGenerateBatchVisibleProfiles(visibleProfileGuidance)}
              disabled={isGeneratingBatchVisibleProfiles || characters.length === 0}
            >
              {isGeneratingBatchVisibleProfiles ? "Generando..." : "Completar por lotes la información de apariencia del personaje."}
            </AiButton>
          </div>
        </div>
        <textarea
          className="mt-3 min-h-[72px] w-full rounded-md border bg-background p-2 text-sm"
          placeholder="Tendencia de finalización (opcional): por ejemplo, voz más opresiva, un poco enfermiza, más suave, no escribas como una belleza tradicional"
          value={visibleProfileGuidance}
          onChange={(event) => setVisibleProfileGuidance(event.target.value)}
        />
      </section>

      {isGeneratingVisibleProfile ? (
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm text-muted-foreground">
          Trabajando en "{selectedCharacter.name}"Organizar la apariencia, la postura corporal, la voz y los puntos de memoria de la apariencia.
        </div>
      ) : null}

      {hasVisibleProfileSuggestionForSelected && visibleProfileSuggestion ? (
        <section className="rounded-lg border border-primary/30 bg-primary/5 p-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-sm font-medium">
                {applicableVisibleProfileCount > 0
                  ? `Ha sido "${visibleProfileSuggestion.characterName}"generar ${applicableVisibleProfileCount} Los elementos se pueden escribir en datos explícitos.`
                  : `“${visibleProfileSuggestion.characterName}"Actualmente no hay datos explícitos para escribir`}
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                Primero mire las diferencias a continuación, confirme y haga clic en Guardar en tarjeta de personaje.
              </div>
            </div>
            <Button
              size="sm"
              onClick={onApplyVisibleProfile}
              disabled={isApplyingVisibleProfile || applicableVisibleProfileCount === 0}
            >
              {isApplyingVisibleProfile ? "Guardando..." : "Guardar en tarjeta de personaje"}
            </Button>
          </div>
          {visibleProfileSuggestion.warnings.length > 0 ? (
            <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-2 text-xs leading-5 text-amber-900">
              {visibleProfileSuggestion.warnings.map((warning) => (
                <div key={warning}>Recordar:{warning}</div>
              ))}
            </div>
          ) : null}
          <div className="mt-2 grid gap-2 lg:grid-cols-2">
            {VISIBLE_PROFILE_FIELDS.map((field) => {
              const nextValue = visibleProfileSuggestion.fields[field.key];
              const skippedReason = visibleProfileSuggestion.skippedFields[field.key];
              return (
                <div key={field.key} className="rounded-md border bg-background/80 p-2 text-xs leading-5">
                  <div className="font-medium">{field.label}</div>
                  <div className="text-muted-foreground">Actual:{selectedCharacter[field.key] || "Pendiente"}</div>
                  <div>Sugerencia:{nextValue || skippedReason || "Aún no escribo"}</div>
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      {!isGeneratingVisibleProfile && !hasVisibleProfileSuggestionForSelected ? (
        <div className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
          Después de hacer clic en "Datos explícitos de finalización de AI", las diferencias que se guardarán se mostrarán aquí primero; Después de la confirmación, se guardarán en la tarjeta de personaje.
        </div>
      ) : null}

      {batchVisibleProfileResult ? (
        <section className="rounded-lg border border-border/70 p-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm font-medium">Sugerencias masivas:{batchApplicableCount} Los personajes se pueden escribir.</div>
            <Button
              size="sm"
              onClick={onApplyBatchVisibleProfiles}
              disabled={isApplyingBatchVisibleProfiles || batchApplicableCount === 0}
            >
              {isApplyingBatchVisibleProfiles ? "Escribiendo..." : "Escribir resultados por lotes"}
            </Button>
          </div>
          <div className="mt-2 max-h-64 space-y-2 overflow-auto pr-1">
            {batchVisibleProfileResult.results.map((result) => (
              <div key={result.characterId} className="rounded-md border bg-muted/10 p-2 text-xs leading-5">
                <div className="font-medium">{result.characterName}</div>
                <div className="text-muted-foreground">
                  {result.hasApplicableChanges ? `grabable ${Object.keys(result.fields).length} artículo` : "No hay elementos para escribir"}
                </div>
                <div>{VISIBLE_PROFILE_FIELDS.map((field) => result.fields[field.key]).filter(Boolean).join(" / ")}</div>
              </div>
            ))}
            {batchVisibleProfileResult.skippedCharacters.map((item) => (
              <div key={item.characterId} className="rounded-md border border-dashed p-2 text-xs text-muted-foreground">
                {item.characterName}:{item.reason}
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className="grid gap-2 lg:grid-cols-2">
        {VISIBLE_PROFILE_FIELDS.map((field) => (
          <div key={field.key} className="rounded-lg border border-border/70 bg-muted/15 p-3">
            <div className="text-xs font-medium text-muted-foreground">{field.label}</div>
            <div className="mt-1 text-sm leading-6">{selectedCharacter[field.key] || "Pendiente"}</div>
          </div>
        ))}
      </section>
    </div>
  );
}
