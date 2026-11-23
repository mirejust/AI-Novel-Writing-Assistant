import { readOutlinePayoffPlans } from "./OutlinePayoffPlans";
import { diffOutlineDocuments } from "../../domain/outlineDiff";
import type { PrismaClient, OutlineBookBinding } from "@prisma/client";
import { outlineOpenBookConfirmSchema, outlineOpenBookInputSchema, type OutlineBookBindingView, type OutlineOpenBookPreview } from "@ai-novel/shared/types/outlineOpenBook";
import { mapOutlineBook } from "../domain/mapping";
import { buildOutlineWorkspace } from "../domain/assets";
import { OutlineOpenBookError } from "../domain/errors";
import { NovelCoreCrudService } from "../../../../../services/novel/novelCoreCrudService";
import { persistActiveVolumeWorkspace } from "../../../../../services/novel/volume/volumeWorkspacePersistence";
import { queueRagUpsert } from "../../../../../services/novel/novelCoreSupport";
import { withSqliteRetry } from "../../../../../db/sqliteRetry";

export class OutlineOpenBookService {
  constructor(private readonly db: PrismaClient, private readonly setup: (novelId: string) => Promise<void> = async id => { queueRagUpsert("novel", id); }) {}
  private async source(projectId: string, revisionId: string) {
    const project = await this.db.outlineProject.findUnique({where: {id: projectId}});
    const revision = await this.db.outlineRevision.findFirst({where: {id: revisionId, projectId}});
    if (!project || !revision) throw new OutlineOpenBookError("OUTLINE_REVISION_NOT_FOUND", "No se puede encontrar esta revisión del programa de estudios; seleccione una nueva versión.", 404);
    return {project, revision};
  }
  private mapped(documentJson: string, raw: unknown, projectId: string) {
    const input = outlineOpenBookInputSchema.parse(raw);
    try { return mapOutlineBook(JSON.parse(documentJson), input, `outline-book-${projectId}`); }
    catch (error) { throw new OutlineOpenBookError("OUTLINE_OPEN_INVALID", error instanceof Error ? error.message : "La estructura del esquema no es válida", 422); }
  }
  async preview(projectId: string, raw: unknown): Promise<OutlineOpenBookPreview> {
    const input = outlineOpenBookInputSchema.parse(raw);
    const {project, revision} = await this.source(projectId, input.revisionId);
    if (project.currentVersion !== input.expectedProjectVersion) throw new OutlineOpenBookError("OUTLINE_VERSION_CONFLICT", "Hay nuevas revisiones del programa de estudios. Confirme la versión original e inténtelo de nuevo.");
    const result = this.mapped(revision.documentJson, input, projectId);
    return {revisionId: revision.id, revisionVersion: revision.version, currentVersion: project.currentVersion,
      sourceDocumentHash: result.sourceDocumentHash, requestHash: result.requestHash, mapping: result.mapping,
      policy: result.policy, settings: result.settings, warnings: [...result.warnings, ...(revision.version !== project.currentVersion ? ["Se adoptarán revisiones históricas y no se seguirán automáticamente las nuevas versiones."] : [])],
      counts: {volumes: result.document.volumes.length, chapters: result.document.chapters.length, characters: result.document.characters.length, payoffs: result.document.payoffs.length}};
  }
  async getBinding(projectId: string): Promise<OutlineBookBindingView | null> {
    const binding = await this.db.outlineBookBinding.findUnique({where: {projectId}});
    const project = await this.db.outlineProject.findUnique({where: {id: projectId}});
    if (!project) throw new OutlineOpenBookError("OUTLINE_NOT_FOUND", "El elemento de esquema no existe.", 404);
    if (!binding) {
      if (project.boundNovelId) throw new OutlineOpenBookError("OUTLINE_BINDING_INTEGRITY", "La vinculación de la sinopsis a la novela no está completamente documentada; verifique la fuente.", 409);
      return null;
    }
    const novel = await this.db.novel.findUnique({where: {id: binding.novelId}});
    if (!novel || project.boundNovelId !== novel.id) throw new OutlineOpenBookError("OUTLINE_BINDING_INTEGRITY", "No se puede encontrar la novela encuadernada o la fuente es inconsistente, por lo que no se puede volver a abrir el libro.", 409);
    const planned = await readOutlinePayoffPlans(this.db, novel.id);
    const source = await this.db.outlineRevision.findFirstOrThrow({where: {id: binding.revisionId, projectId}});
    const latest = project.currentRevisionId && project.currentRevisionId !== binding.revisionId ? await this.db.outlineRevision.findFirst({where: {id: project.currentRevisionId, projectId}}) : null;
    return {plannedPayoffs: planned?.plans ?? [], sourceDifferences: latest ? diffOutlineDocuments(JSON.parse(source.documentJson), JSON.parse(latest.documentJson)) : [], bindingId: binding.id, projectId, novelId: novel.id, title: novel.title, revisionId: binding.revisionId,
      revisionVersion: binding.revisionVersion, currentVersion: project.currentVersion, sourceDocumentHash: binding.sourceDocumentHash,
      policyVersion: binding.policyVersion, sourceRoute: `/lab/director/${encodeURIComponent(novel.id)}`,
      mapping: JSON.parse(binding.mappingJson), policy: JSON.parse(binding.policyJson), setupState: JSON.parse(binding.postCreateStateJson)};
  }
  private checkReplay(binding: OutlineBookBinding, key: string, hash: string) {
    if (binding.requestKey !== key) throw new OutlineOpenBookError("OUTLINE_ALREADY_BOUND", "Esta sinopsis está ligada a la novela, por favor continúa con el libro.", 409, {sourceRoute: `/lab/director/${encodeURIComponent(binding.novelId)}`});
    if (binding.requestHash !== hash) throw new OutlineOpenBookError("OUTLINE_OPEN_REQUEST_CONFLICT", "La configuración de apertura del libro para el mismo ID de solicitud es diferente; obtenga una vista previa nuevamente.");
  }
  async confirm(projectId: string, raw: unknown) {
    const input = outlineOpenBookConfirmSchema.parse(raw);
    const {revision} = await this.source(projectId, input.revisionId);
    const result = this.mapped(revision.documentJson, input, projectId);
    if (input.requestHash !== result.requestHash) throw new OutlineOpenBookError("OUTLINE_PREVIEW_STALE", "La configuración de apertura del libro ha cambiado. Vuelva a obtener una vista previa para confirmar.");
    let replayed = false;
    try {
      await withSqliteRetry(() => this.db.$transaction(async tx => {
        const byKey = await tx.outlineBookBinding.findUnique({where: {requestKey: input.idempotencyKey}});
        if (byKey && byKey.projectId !== projectId) throw new OutlineOpenBookError("OUTLINE_OPEN_REQUEST_CONFLICT", "Este ID de solicitud pertenece a otro esquema.");
        const existing = byKey ?? await tx.outlineBookBinding.findUnique({where: {projectId}});
        if (existing) { this.checkReplay(existing, input.idempotencyKey, result.requestHash); replayed = true; return; }
        const project = await tx.outlineProject.findUniqueOrThrow({where: {id: projectId}});
        if (project.boundNovelId) throw new OutlineOpenBookError("OUTLINE_BINDING_INTEGRITY", "La sinopsis ya se registró como fuente de la novela y no se puede volver a abrir.");
        if (project.status !== "active") throw new OutlineOpenBookError("OUTLINE_ARCHIVED", "Restaure el proyecto general antes de abrir el libro.");
        if (project.currentVersion !== input.expectedProjectVersion) throw new OutlineOpenBookError("OUTLINE_VERSION_CONFLICT", "Hay nuevas revisiones del programa de estudios. Confirme la versión original e inténtelo de nuevo.");
        const currentRevision = await tx.outlineRevision.findFirstOrThrow({where: {id: revision.id, projectId}});
        if (currentRevision.documentJson !== revision.documentJson) throw new OutlineOpenBookError("OUTLINE_SOURCE_CHANGED", "La fuente del esquema ha cambiado. Vuelva a obtener una vista previa.");
        const bindingId = `outline-book-${projectId}`, novelId = `outline-novel-${projectId}`, versionId = `outline-volume-${projectId}`;
        const reserved = await tx.outlineProject.updateMany({where: {id: projectId, boundNovelId: null, currentVersion: input.expectedProjectVersion}, data: {boundNovelId: novelId}});
        if (reserved.count !== 1) throw new OutlineOpenBookError("OUTLINE_VERSION_CONFLICT", "El enlace del esquema ha cambiado; vuelva a abrirlo.");
        const story = result.document.story;
        await new NovelCoreCrudService().createNovel({id: novelId, ...result.settings,
          description: story.synopsis || story.premise, targetAudience: story.targetAudience,
          styleTone: story.tone, writingMode: "original", narrativeForm: "long_novel", directorVersion: "v2"}, tx);
        for (const mapped of result.mapping.characters) {
          const c = result.document.characters.find(c => c.nodeId === mapped.nodeId)!;
          await tx.character.create({data: {id: mapped.characterId, novelId, name: c.name, role: c.role || "Sin etiquetar", gender: "unknown", outerGoal: c.goal, secret: c.secret, development: c.arcDirection}});
        }
        for (const mapped of result.mapping.chapters) {
          const c = result.document.chapters.find(c => c.nodeId === mapped.nodeId)!;
          await tx.chapter.create({data: {id: mapped.chapterId, novelId, order: mapped.chapterOrder, title: c.title || `Cap.${mapped.chapterOrder}cap.`, expectation: c.summary, content: "", targetWordCount: result.settings.defaultChapterLength}});
        }
        const workspace = buildOutlineWorkspace(novelId, result.document, result.mapping, result.settings.defaultChapterLength, versionId);
        await tx.volumePlanVersion.create({data: {id: versionId, novelId, version: 1, status: "active", contentJson: JSON.stringify(workspace)}});
        await persistActiveVolumeWorkspace(tx, novelId, workspace, versionId);
        await tx.outlineBookBinding.create({data: {id: bindingId, projectId, revisionId: revision.id, revisionVersion: revision.version,
          novelId, sourceDocumentHash: result.sourceDocumentHash, requestKey: input.idempotencyKey, requestHash: result.requestHash,
          mappingJson: JSON.stringify(result.mapping), policyJson: JSON.stringify(result.policy), postCreateStateJson: JSON.stringify({rag: "pending"})}});
      }), {label: "outline-open-book"});
    } catch (error) {
      if (error && typeof error === "object" && "code" in error && error.code === "P2002") {
        const existing = await this.db.outlineBookBinding.findUnique({where: {projectId}});
        if (!existing) throw error;
        this.checkReplay(existing, input.idempotencyKey, result.requestHash); replayed = true;
      } else throw error;
    }
    let binding = await this.getBinding(projectId);
    if (binding?.setupState.rag === "pending") binding = await this.retrySetup(projectId);
    return {...binding!, replayed};
  }
  async retrySetup(projectId: string, expectedPolicyVersion?: number) {
    const binding = await this.getBinding(projectId);
    if (!binding) throw new OutlineOpenBookError("OUTLINE_BINDING_NOT_FOUND", "Este esquema aún no ha sido publicado.", 404);
    if (expectedPolicyVersion !== undefined && binding.policyVersion !== expectedPolicyVersion) throw new OutlineOpenBookError("OUTLINE_POLICY_CONFLICT", "La política de retención ha cambiado; actualice e inténtelo nuevamente.");
    if (binding.setupState.rag === "queued") return binding;
    let state: OutlineBookBindingView["setupState"];
    try { await this.setup(binding.novelId); state = {rag: "queued"}; }
    catch { state = {rag: "pending", error: "La disposición del índice no está completa, puede intentarlo de nuevo; La novela se ha salvado."}; }
    await this.db.outlineBookBinding.update({where: {id: binding.bindingId}, data: {postCreateStateJson: JSON.stringify(state)}});
    return {...binding, setupState: state};
  }
}
