import { randomUUID } from "node:crypto";
import { initialReferenceError, outlineInitialGeneratePrompt, outlineEditProposalPrompt, type SavedInitialOutlineDraft } from "../../../../prompting/prompts/outline/outline.prompts";
import { runOutlineProposalStructuredCall } from "./outlineProposalStructuredCall";
import {
  extractStructuredOutputErrorCategory,
  StructuredOutputError,
} from "../../../../llm/structuredOutput";
import { validateOutlineDocument } from "../domain/outlineDocument";
import { createEmptyOutlineDocument } from "../domain/outlineDocument";
import {
  assertValidOutlineEditOperations,
  mapOutlineApplyFailure,
  type OutlineEditOperation,
} from "../domain/outlineEditOperations";
import { OutlineRepository } from "../infrastructure/OutlineRepository";
import { AppError } from "../../../../middleware/errorHandler";

export function mapOutlineGenerateFailure(error: unknown, kind: "edit" | "initial_generation"): unknown {
  if (error instanceof AppError) return error;
  const category = error instanceof StructuredOutputError
    ? error.category
    : extractStructuredOutputErrorCategory(error instanceof Error ? error.message : String(error ?? ""));
  if (!category) return error;
  const noun = kind === "edit" ? "Sugerencias de modificación" : "sugerencias de esquema";
  switch (category) {
    case "schema_mismatch": {
      const stripped = (error instanceof Error ? error.message : String(error ?? ""))
        .replace(/\[STRUCTURED_OUTPUT:[^\]]+\]\s*/g, "")
        .replace(/\[[^\]]+@v\d+\]\s*/g, "")
        .trim();
      const marker = stripped.lastIndexOf("error:");
      const rawDetail = (marker >= 0 ? stripped.slice(marker + "error:".length) : stripped).replace(/^[-\s]+/, "").trim();
      const detail = rawDetail.replace(/[。]+$/, "");
      return detail
        ? new AppError(`devuelto por el modelo${noun}El formato es incorrecto y la verificación aún falla después de la reparación automática:${detail}. Por favor regenera la propuesta.`, 400)
        : new AppError(`devuelto por el modelo${noun}The format is incorrect and it still fails the verification after automatic repair. Por favor regenera la propuesta.`, 400);
    }
    case "incomplete_json":
    case "malformed_json":
      return new AppError(`devuelto por el modelo${noun}Incompleto, no pasó la verificación. Por favor regenera la propuesta.`, 400);
    case "output_budget_exhausted":
    case "reasoning_budget_exhausted":
      return new AppError(
        kind === "edit"
          ? "This time there is a lot of content to be generated, exceeding the single output limit. Proponga modificaciones en lotes (por ejemplo, modifique los primeros volúmenes primero) o aumente el límite de salida de la ruta del modelo e inténtelo nuevamente."
          : "This time there is a lot of content to be generated, exceeding the single output limit. Primero genere algún contenido (como configurar el volumen y los primeros capítulos) o aumente el límite de salida de la ruta del modelo e inténtelo nuevamente.",
        400,
      );
    case "empty_response":
      return new AppError("El modelo no devolvió contenido, por favor regenera la propuesta.", 400);
    case "thinking_pollution":
      return new AppError(`devuelto por el modelo${noun}El proceso de pensamiento se mezcló y no pasó la prueba. Vuelva a generar la propuesta o desactive Deep Thinking en la configuración del fabricante e inténtelo de nuevo.`, 400);
    case "unsupported_native_json":
      return new AppError("El modelo actual no admite el formato de salida estructurado requerido esta vez. Cambie el modelo e inténtelo de nuevo.", 400);
    case "transport_error":
      return new AppError("Se produjo un error de red al conectarse al servicio modelo. Verifique el servicio del modelo e inténtelo nuevamente.", 502);
    case "model_unavailable":
      return new AppError("El servicio de modelo no está disponible temporalmente, inténtalo de nuevo más tarde.", 502);
    default:
      return error;
  }
}

export class OutlineProposalService {
  constructor(private readonly repository: OutlineRepository) {}
  async generate(projectId: string, request: { kind: "edit" | "initial_generation"; requestText: string; scope?: string }) {
    const current = await this.repository.getCurrent(projectId);
    if (!current || !current.revision) throw new AppError("El elemento del esquema no existe", 404);
    const document = validateOutlineDocument(JSON.parse(current.revision.documentJson));
    const baseVersion = current.project.currentVersion;
    let result: Awaited<ReturnType<typeof runOutlineProposalStructuredCall>>;
    try {
      result = request.kind === "initial_generation"
        ? await runOutlineProposalStructuredCall({ asset: outlineInitialGeneratePrompt, promptInput: { idea: request.requestText, rough: true } })
        : await runOutlineProposalStructuredCall({ asset: outlineEditProposalPrompt, promptInput: { request: request.requestText, baseVersion, document, scope: request.scope ?? "story" } });
    } catch (error) {
      throw mapOutlineGenerateFailure(error, request.kind);
    }
    if (request.kind === "edit") {
      const operations = (result.output as { operations: OutlineEditOperation[] }).operations;
      assertValidOutlineEditOperations(operations, { document });
    }
    const latest = await this.repository.getCurrent(projectId);
    const stale = !latest || latest.project.currentVersion !== baseVersion;
    return this.repository.createProposal({ id: randomUUID(), projectId, baseVersion, kind: request.kind, status: stale ? "stale" : "pending", requestText: request.requestText, proposalJson: JSON.stringify(result.output), promptId: result.meta.invocation.promptId, promptVersion: result.meta.invocation.promptVersion });
  }
  async apply(projectId: string, proposalId: string, operationIds: string[], feedbackAuthorized = false) {
    const proposal = await this.repository.findProposal(projectId, proposalId);
    if (proposal?.kind === "text_feedback" && !feedbackAuthorized) throw new AppError("Adopte las sugerencias una por una de los comentarios del capítulo.", 409);
    if (!proposal || !["pending"].includes(proposal.status)) throw new AppError("Esta propuesta no es aceptable.", 409, "Por favor regenere la propuesta antes de adoptarla.");
    const current = await this.repository.getCurrent(projectId);
    if (!current || current.project.currentVersion !== proposal.baseVersion) throw new AppError("El esquema ha sido actualizado, por favor regenere la propuesta.", 409);
    if (proposal.kind === "chapter_edit" && !operationIds.length) throw new AppError("Seleccione los cambios del programa de estudios que se adoptarán.", 400);
    if (proposal.kind === "volume_edit" && !operationIds.length) throw new AppError("Seleccione los cambios del programa de estudios que se adoptarán.", 400);
    if (proposal.kind === "character_impact" && !operationIds.length) throw new AppError("Seleccione la modificación de vinculación de caracteres que desea adoptar.", 400);
    if (proposal.kind === "edit" && proposal.promptId === "outline.workbench_dialogue" && !operationIds.length) throw new AppError("Seleccione las ediciones que desee adoptar.", 400);
    if (proposal.kind === "initial_generation") {
      const initial = JSON.parse(proposal.proposalJson) as SavedInitialOutlineDraft;
      const referenceError = initialReferenceError(initial);
      if (referenceError) throw new AppError(referenceError, 422);
      const refs = new Map<string, string>();
      for (const item of [...initial.volumes, ...initial.chapters, ...initial.characters, ...initial.payoffs, ...initial.facts]) refs.set(item.clientRef, randomUUID());
      const document = createEmptyOutlineDocument(String(initial.storyFields.title ?? "nuevo esquema"));
      Object.assign(document.story, initial.storyFields);
      document.volumes = initial.volumes.map((x,index)=>({ nodeId: refs.get(x.clientRef)!, title: x.title, summary: x.summary, order: index, planningDepth: x.planningDepth, ...(x.beats && {beats:x.beats}), chapterNodeIds: [] }));
      document.chapters = initial.chapters.map((x,index)=>({ nodeId: refs.get(x.clientRef)!, volumeNodeId: refs.get(x.volumeRef)!, ...(x.beatKey && {beatKey:x.beatKey}), title: x.title, summary: x.summary, order: index, planningDepth: x.planningDepth, characterNodeIds: [], payoffNodeIds: [] }));
      document.volumes.forEach(volume=>volume.chapterNodeIds=document.chapters.filter(chapter=>chapter.volumeNodeId===volume.nodeId).map(chapter=>chapter.nodeId));
      const chaptersById = new Map(document.chapters.map(chapter => [chapter.nodeId, chapter]));
      document.characters = initial.characters.map(person => {
        const nodeId = refs.get(person.clientRef)!;
        const appearanceNodeIds = [...new Set(person.appearanceRefs ?? [])].map(ref => refs.get(ref)!);
        for (const location of appearanceNodeIds) chaptersById.get(location)?.characterNodeIds.push(nodeId);
        return { nodeId, name: person.title, role: person.role, summary: person.summary, appearanceNodeIds };
      });
      document.payoffs = initial.payoffs.map(x=>({ nodeId: refs.get(x.clientRef)!, title: x.title, kind: "other", setupDescription: x.setupDescription ?? x.summary, payoffDescription: x.payoffDescription ?? "", setupChapterNodeIds: [], payoffChapterNodeIds: [], relatedNodeIds: [] }));
      document.facts = initial.facts.map(x=>({ nodeId: refs.get(x.clientRef)!, title: x.title, content: x.content ?? x.summary, scope: { type: "story" }, relatedNodeIds: [], immutable: false }));
      return this.repository.applyInitialProposal(projectId, proposalId, proposal.baseVersion, document);
    }
    const payload = JSON.parse(proposal.proposalJson) as { operations: OutlineEditOperation[] };
    const document = validateOutlineDocument(JSON.parse(current.revision!.documentJson));
    if (proposal.kind === "volume_beats" && operationIds.length > 0 && (new Set(operationIds).size !== payload.operations.length || payload.operations.some(op => !operationIds.includes(op.operationId))))
      throw new AppError("El tablero rítmico debe adoptarse junto con las atribuciones de los capítulos de este volumen.",400);
    const selectedIds = operationIds.length ? operationIds : payload.operations.map((operation) => operation.operationId);
    try {
      assertValidOutlineEditOperations(payload.operations, { document, selectedOperationIds: selectedIds });
      return await this.repository.applyOutlineProposal(
        projectId,
        proposalId,
        proposal.baseVersion,
        new Set(selectedIds),
        document,
        payload.operations,
      );
    } catch (error) {
      mapOutlineApplyFailure(error);
    }
  }
  listPending(projectId: string) { return this.repository.listPendingProposals(projectId); }
  get(projectId: string, proposalId: string) { return this.repository.findProposal(projectId, proposalId); }
  async reject(projectId: string, proposalId: string) {
    const proposal = await this.repository.findProposal(projectId, proposalId);
    if (proposal?.kind === "text_feedback") throw new AppError("Rechace las sugerencias artículo por artículo de los comentarios del capítulo.", 409);
    if (!proposal || proposal.status !== "pending") throw new AppError("Esta propuesta no puede abandonarse.", 409);
    return this.repository.updateProposalStatus(proposalId, "rejected");
  }
}
