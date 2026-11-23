import type { BasicTabProps } from "./NovelEditView.types";
import NovelWorldManagerCard from "./NovelWorldManagerCard";
import DirectorTakeoverEntryPanel from "./DirectorTakeoverEntryPanel";
import { SectionBlock } from "./workspaceShell";

export default function WorldSetupTab(props: BasicTabProps) {
  return (
    <div className="space-y-5">
      <DirectorTakeoverEntryPanel
        title="Deje que la IA complete la visión del mundo de este libro."
        description="Primero determine las reglas, fuerzas y limitaciones clave del mundo, y luego continúe avanzando con los personajes, la planificación del volumen y la producción de capítulos en torno a la misma visión del mundo."
        entry={props.directorTakeoverEntry}
      />
      <SectionBlock
        title="Preparación de la cosmovisión"
        description="Aquí se mantiene la cosmovisión en la que realmente se utiliza este libro. La IA se basa en estos activos al generar, examinar y validar su visión del mundo."
      >
        <NovelWorldManagerCard
          view={props.novelWorldView}
          syncDiff={props.novelWorldSyncDiff}
          worldOptions={props.worldOptions}
          selectedWorldId={props.basicForm.worldId}
          isLoading={props.isLoadingNovelWorld}
          isImporting={props.isImportingNovelWorld}
          isGenerating={props.isGeneratingNovelWorld}
          isCreatingManual={props.isCreatingManualNovelWorld}
          isSavingToLibrary={props.isSavingNovelWorldToLibrary}
          isLoadingSyncDiff={props.isLoadingNovelWorldSyncDiff}
          isSyncing={props.isSyncingNovelWorld}
          usageView={props.worldSliceView}
          usageMessage={props.worldSliceMessage}
          isRefreshingWorldSlice={props.isRefreshingWorldSlice}
          isSavingWorldSliceOverrides={props.isSavingWorldSliceOverrides}
          onImport={props.onImportNovelWorld}
          onCreateManual={props.onCreateManualNovelWorld}
          onGenerate={props.onGenerateNovelWorld}
          onSaveToLibrary={props.onSaveNovelWorldToLibrary}
          onSync={props.onSyncNovelWorld}
          onRefreshWorldSlice={props.onRefreshWorldSlice}
          onSaveWorldSliceOverrides={props.onSaveWorldSliceOverrides}
        />
      </SectionBlock>
    </div>
  );
}
