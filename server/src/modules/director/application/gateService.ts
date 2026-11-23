import {downstreamArtifactTypes, latestArtifact, VersionConflictError} from "../domain";
import type {FactsLoader} from "./factsLoader";
import type {GateResolution, PlanRegistry} from "./ports";

export class GateResolutionError extends Error {
  readonly statusCode = 400;
  constructor(message: string) {super(message); this.name = "GateResolutionError";}
}
/** Prepares pure invalidation policy; repository commits ledger, control and command together. */
export class GateService {
  constructor(private readonly deps: {factsLoader: Pick<FactsLoader, "load">; planRegistry: PlanRegistry}) {}
  async prepare(runId: string, decision: GateResolution["decision"], expectedVersion: number, revision: Pick<GateResolution,"expectedVolumePlanVersionId"|"guidance"|"chapterPlanEdit"|"assetEdit"|"proseReview"> = {}): Promise<GateResolution> {
    if (revision.guidance !== undefined && (decision !== "regenerate" || typeof revision.guidance !== "string" || revision.guidance.length > 6000)) throw new GateResolutionError("Las sugerencias de corrección sólo podrán utilizarse para la regeneración y no podrán exceder las 6000 palabras.");
    if (revision.chapterPlanEdit) {
      const edit = revision.chapterPlanEdit;
      const acceptsOriginal = "chapters" in edit && !edit.chapters.length && Boolean(edit.approveForProse);
      if (decision !== (acceptsOriginal ? "confirm" : "confirm_after_edit")) throw new GateResolutionError("Verifique y envíe esta modificación en la página de confirmación del capítulo.");
    }
    const {contract, control, facts} = await this.deps.factsLoader.load(runId);
    if (control.version !== expectedVersion) throw new VersionConflictError(expectedVersion, control.version);
    if (control.status !== "waiting_gate" || !control.gate?.artifactTypes.length) throw new GateResolutionError("Abra primero la etapa de creación que requiere confirmación.");
    const types = control.gate.artifactTypes;
    if (revision.expectedVolumePlanVersionId && (types.length !== 1 || types[0] !== "volume_strategy" || decision === "regenerate")) {
      throw new GateResolutionError("Verifique la versión seleccionada en la página de confirmación del programa de estudios.");
    }
    if (revision.assetEdit && (decision !== "confirm_after_edit" || types.length !== 1 || types[0] !== revision.assetEdit.type)) {
      throw new GateResolutionError("Guarde los cambios en la alineación de personajes correspondiente o en la página de confirmación de volumen.");
    }
    if (decision === "confirm_after_edit" && !revision.assetEdit && types.some(type => type === "character_cast" || type === "volume_strategy")) {
      throw new GateResolutionError("Primero edite el contenido o seleccione \"Confirmar resultados y continuar\".");
    }
    const plan = this.deps.planRegistry.get(contract.planVersion);
    if (!plan) throw new GateResolutionError("Falta una programación de creación para esta ejecución.");
    if (revision.proseReview && (types.length !== 1 || types[0] !== "chapter_batch_closed" ||
      decision !== (revision.proseReview.chapters.some(chapter => chapter.content !== undefined) ? "confirm_after_edit" : "confirm") ||
      (revision.proseReview.nextRange && plan.steps.at(-1)?.produces !== "chapter_batch_closed"))) {
      throw new GateResolutionError("Consulte los capítulos y el alcance de la continuación en la página de confirmación de texto de este lote.");
    }
    const artifacts = control.gate.artifactTypes.map(type => {
      const step = plan.steps.find(step => step.produces === type && step.gateable);
      const artifact = latestArtifact(facts, type, contract.scope);
      if (!step || (contract.stepIdsInScope && !contract.stepIdsInScope.includes(step.id)) || !artifact
        || (artifact.status === "stale" && !artifact.protectedUserContent)) throw new GateResolutionError("Los activos que deben confirmarse han cambiado; actualice la página de creación.");
      if (decision === "regenerate" && artifact.protectedUserContent) throw new GateResolutionError("Este activo contiene contenido que debe conservarse. Primero vea y guarde los ajustes en la página de activos.");
      return {type, expectedVersion: artifact.version};
    });
    // A combined approval must check the synchronized rows even if an older execution artifact exists.
    const approvesProse = revision.chapterPlanEdit && "chapters" in revision.chapterPlanEdit && revision.chapterPlanEdit.approveForProse;
    const invalidated = decision === "confirm" ? (approvesProse ? ["chapter_execution_contract"] : []) : [...new Set(artifacts.flatMap(artifact => downstreamArtifactTypes(plan, artifact.type)))];
    const invalidateTypes = [...new Set([...invalidated, ...(decision === "regenerate" ? artifacts.map(artifact => artifact.type) : [])])]
      .filter(type => type !== "chapter_draft" && (decision === "regenerate" || !artifacts.some(artifact => artifact.type === type)));
    if (revision.chapterPlanEdit && (artifacts.length !== 1 || artifacts[0].type !== "chapter_task_sheet")) throw new GateResolutionError("Este plan solo se puede editar durante las fases de Misión y Escenario del Capítulo.");
    return {decision, scope: contract.scope, artifacts, invalidateTypes,
      ...(revision.proseReview ? {proseReview:revision.proseReview} : {}),
      ...(revision.expectedVolumePlanVersionId ? {expectedVolumePlanVersionId: revision.expectedVolumePlanVersionId} : {}),
      ...(revision.guidance?.trim() ? {guidance: revision.guidance.trim()} : {}),
      ...(revision.assetEdit ? {assetEdit: revision.assetEdit} : {}),
      ...(revision.chapterPlanEdit ? {chapterPlanEdit: revision.chapterPlanEdit} : {})};
  }
}
