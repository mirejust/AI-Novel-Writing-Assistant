import type { BasicTabProps } from "./NovelEditView.types";
import NovelBasicInfoForm from "./NovelBasicInfoForm";
import NovelStyleRecommendationCard from "./NovelStyleRecommendationCard";
import { BookFramingQuickFillButton } from "./basicInfoForm/BookFramingQuickFillButton";
import NovelCreateTitleQuickFill from "./titleWorkshop/NovelCreateTitleQuickFill";
import DirectorTakeoverEntryPanel from "./DirectorTakeoverEntryPanel";
import { NovelCoverCard } from "./cover/NovelCoverCard";
import { DetailDisclosure, SectionBlock } from "./workspaceShell";
import DirectorVersionControl from "@/components/directorVersion/DirectorVersionControl";

export default function BasicInfoTab(props: BasicTabProps) {
  return (
    <div className="space-y-5">
      <SectionBlock title="Versión del director" description="Elija el proceso responsable de la creación del libro; cada versión se ejecuta y se restaura de forma independiente."><DirectorVersionControl novelId={props.novelId}/></SectionBlock>
      <DirectorTakeoverEntryPanel
        title="Deje que la IA se haga cargo del proyecto actual"
        description="Si la información básica está completa, puede continuar automáticamente desde el paso seleccionado y elegir continuar con el progreso existente o volver a ejecutar el paso actual."
        entry={props.directorTakeoverEntry}
      />
      <SectionBlock
        title="posicionamiento a nivel de libro"
        description="Primero confirme para quién es el libro, qué atrae a los lectores y qué se debe cumplir en las primeras etapas, y luego deje que el mundo, los personajes y los capítulos posteriores giren en torno al mismo conjunto de promesas."
      >
        <NovelBasicInfoForm
          basicForm={props.basicForm}
          genreOptions={props.genreOptions}
          storyModeOptions={props.storyModeOptions}
          worldOptions={props.worldOptions}
          sourceNovelOptions={props.sourceNovelOptions}
          sourceKnowledgeOptions={props.sourceKnowledgeOptions}
          sourceNovelBookAnalysisOptions={props.sourceNovelBookAnalysisOptions}
          isLoadingSourceNovelBookAnalyses={props.isLoadingSourceNovelBookAnalyses}
          availableBookAnalysisSections={props.availableBookAnalysisSections}
          onFormChange={props.onFormChange}
          onSubmit={props.onSave}
          isSubmitting={props.isSaving}
          submitLabel="Guardar información básica"
          titleQuickFill={(
            <NovelCreateTitleQuickFill
              basicForm={props.basicForm}
              onApplyTitle={(title) => props.onFormChange({ title })}
            />
          )}
          framingQuickFill={(
            <BookFramingQuickFillButton
              basicForm={props.basicForm}
              genreOptions={props.genreOptions}
              onApplySuggestion={props.onFormChange}
            />
          )}
          coverSection={(
            <NovelCoverCard
              novelId={props.novelId}
              basicForm={props.basicForm}
              genreOptions={props.genreOptions}
              storyModeOptions={props.storyModeOptions}
              worldOptions={props.worldOptions}
              worldSliceView={props.worldSliceView}
            />
          )}
          projectQuickStart={props.projectQuickStart}
        />
      </SectionBlock>

      <DetailDisclosure
        title="Sugerencias de escritura"
        description="Identifique el tono narrativo, la densidad expresiva y las referencias estilísticas del libro para ayudar a mantener la unidad en los capítulos siguientes."
        meta="Referencia de escritura"
      >
        <NovelStyleRecommendationCard novelId={props.novelId} />
      </DetailDisclosure>

    </div>
  );
}
