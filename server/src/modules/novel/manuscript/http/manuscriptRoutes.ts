import {queueManualChapterSync} from "../../../../services/novel/chapterEditor/synchronization/ManualChapterSyncStore";
import {takeManuscriptSnapshot,assertManuscriptSnapshot,readManuscriptState} from "../application/ManuscriptWorkspaceService";
import {validateManuscriptRevisionBase} from "../application/ManuscriptRevisionService";
import { Router, type ErrorRequestHandler } from "express";
import { z } from "zod";
import { AppError } from "../../../../middleware/errorHandler";
import { ManuscriptBaselineService } from "../application/ManuscriptBaselineService";
import { ManuscriptRevisionService } from "../application/ManuscriptRevisionService";
import { ManuscriptStructureService } from "../application/ManuscriptStructureService";
import { ManuscriptTaskService } from "../application/ManuscriptTasks";
import { originalUnitText, ManuscriptWorkspaceService } from "../application/ManuscriptWorkspaceService";
import type { ManuscriptImportRequest, ManuscriptPartitionRequest, ManuscriptSplitRequest, ManuscriptConfirmRequest } from "@ai-novel/shared";
import { prisma } from "../../../../db/prisma";
import { ManuscriptImportService } from "../application/ManuscriptImportService";
import { MAX_RAW_BYTES } from "../domain/source";

const service = new ManuscriptImportService();
const workspaceService = new ManuscriptWorkspaceService();
const key=z.string().min(1).max(160),hash=z.string().min(1).max(128),version=z.number().int().min(0);
const importSchema=z.object({title:z.string().trim().min(1).max(200),narrativeForm:z.enum(["long_novel","short_story"]),pastedText:z.string().optional(),fileBase64:z.string().optional(),fileName:z.string().max(255).optional(),encoding:z.enum(["utf-8","utf-16le","utf-16be","gb18030"]).optional(),requestKey:key}).refine(value=>(value.pastedText!==undefined)!==(value.fileBase64!==undefined),"Elija TXT o pegue el texto completo, no ambos al mismo tiempo.");
const partitionSchema=z.object({expectedSessionVersion:version,sourceHash:hash,units:z.array(z.object({draftId:key,range:z.object({start:z.number().int().nonnegative(),end:z.number().int().positive()}),role:z.enum(["body","toc","front_matter","back_matter","other_reviewed"]),title:z.string().max(200),confidence:z.number().min(0).max(1).optional(),needsReview:z.boolean()})).max(6000)});
export const manuscriptRouter = Router();

manuscriptRouter.post("/imports", async (req, res, next) => {
  try {
    const body = importSchema.parse(req.body);
    const bytes = typeof body.pastedText === "string" ? Buffer.from(body.pastedText, "utf8") : typeof body.fileBase64 === "string" && isCanonicalBase64(body.fileBase64) ? Buffer.from(body.fileBase64, "base64") : null;
    if (!bytes) throw new Error("MANUSCRIPT_SOURCE_INVALID");
    if (bytes.byteLength > MAX_RAW_BYTES) throw new Error("MANUSCRIPT_SIZE_LIMIT");
    res.status(201).json({ success: true, data: await service.create({ bytes, title: body.title, narrativeForm:body.narrativeForm, encoding: body.encoding, fileName: body.fileName, requestKey: body.requestKey }) });
  } catch (error) { next(error); }
});

manuscriptRouter.post("/imports/:sessionId/split", async (req, res, next) => {
  try {
    const body = z.object({expectedSessionVersion:version,sourceHash:hash,mode:z.enum(["rules","manual"])}).parse(req.body);
    res.json({ success: true, data: await service.split(param(req,"sessionId"), body.expectedSessionVersion, body.sourceHash, body.mode) });
  } catch (error) { next(error); }
});

manuscriptRouter.get("/imports/:sessionId", async (req, res, next) => {
  try {
    const data = await service.get(param(req,"sessionId"));
    const from = Number(req.query.from ?? 0);
    const to = Number(req.query.to ?? from);
    if (req.query.from !== undefined || req.query.to !== undefined) {
      const source = await prisma.manuscriptSource.findUnique({ where: { id: data.sourceId }, select: { sourceText: true } });
      if (!source || !Number.isInteger(from) || !Number.isInteger(to) || from < 0 || to < from || to > source.sourceText.length || to - from > 100_000) throw new Error("MANUSCRIPT_RANGE_INVALID");
      res.json({ success: true, data: { ...data, text: source.sourceText.slice(from, to), range: { start: from, end: to } } });
      return;
    }
    res.json({ success: true, data });
  } catch (error) { next(error); }
});

manuscriptRouter.put("/imports/:sessionId/partition", async (req, res, next) => {
  try {
    const body = partitionSchema.parse(req.body);
    res.json({ success: true, data: await service.partition(param(req,"sessionId"), body.expectedSessionVersion, body.sourceHash, body.units) });
  } catch (error) { next(error); }
});

manuscriptRouter.post("/imports/:sessionId/confirm", async (req, res, next) => {
  try {
    const body = z.object({expectedSessionVersion:version,sourceHash:hash,coverageHash:hash,title:z.string().trim().min(1).max(200),requestKey:key}).parse(req.body);
    res.status(201).json({ success: true, data: await service.confirm(param(req,"sessionId"), body.expectedSessionVersion, body.sourceHash, body.coverageHash, body.title, body.requestKey) });
  } catch (error) { next(error); }
});

manuscriptRouter.get("/by-novel/:novelId/workspace", async(req,res,next)=>{try{res.json({success:true,data:await workspaceService.byNovel(param(req,"novelId"),typeof req.query.unitId==="string"?req.query.unitId:undefined)});}catch(error){next(error);}});
manuscriptRouter.get("/:projectId/workspace", async(req,res,next)=>{try{res.json({success:true,data:await workspaceService.get(param(req,"projectId"),typeof req.query.unitId==="string"?req.query.unitId:undefined)});}catch(error){next(error);}});

manuscriptRouter.get("/:projectId/sources/:sourceId/text", async (req, res, next) => {
  try {
    const source = await prisma.manuscriptSource.findFirst({ where: { id: param(req,"sourceId"), projectId: param(req,"projectId") } });
    const from = Number(req.query.from ?? 0); const to = Number(req.query.to ?? source?.charCount);
    if (!source || !Number.isInteger(from) || !Number.isInteger(to) || from < 0 || to < from || to > source.charCount || to - from > 100_000) throw new Error("MANUSCRIPT_RANGE_INVALID");
    res.json({ success: true, data: { sourceId: source.id, sourceHash: source.sourceHash, range: { start: from, end: to }, text: source.sourceText.slice(from, to) } });
  } catch (error) { next(error); }
});

manuscriptRouter.get("/:projectId/sources/:sourceId/download", async (req, res, next) => {
  try {
    const source = await prisma.manuscriptSource.findFirst({ where: { id: param(req,"sourceId"), projectId: param(req,"projectId") } });
    if (!source) throw new Error("MANUSCRIPT_NOT_FOUND");
    res.setHeader("Content-Type", "application/octet-stream");
    res.setHeader("Content-Disposition", `attachment; filename="manuscript.txt"; filename*=UTF-8''${encodeURIComponent(source.originalFileName ?? "manuscript.txt")}`);
    res.send(Buffer.from(source.rawBytes));
  } catch (error) { next(error); }
});

manuscriptRouter.get("/:projectId/chapters/:chapterId/source", async (req, res, next) => {
  try {
    const unit = await prisma.manuscriptUnit.findFirst({ where: { projectId: param(req,"projectId"), chapterId: param(req,"chapterId"), status: "active" }, include: { source: true } });
    if (!unit?.source) throw new Error("MANUSCRIPT_NOT_FOUND");
    const ranges=JSON.parse(unit.sourceRangesJson);
    res.json({ success: true, data: { sourceId: unit.sourceId, ranges, text: originalUnitText(unit.source.sourceText,unit.sourceRangesJson) } });
  } catch (error) { next(error); }
});

manuscriptRouter.get("/:projectId/novel-export", async (req, res, next) => {
  try {
    const project = await prisma.manuscriptProject.findUnique({ where: { id: param(req,"projectId") }, include: { units: { where: { status: "active" }, orderBy: { displayOrder: "asc" } } } });
    if (!project?.novelId) throw new Error("MANUSCRIPT_NOT_FOUND");
    const chapters = await prisma.chapter.findMany({ where: { novelId: project.novelId, id: { in: project.units.map(unit => unit.chapterId).filter((id): id is string => Boolean(id)) } }, orderBy: { order: "asc" } });
    const segments=await prisma.shortStorySegment.findMany({where:{novelId:project.novelId,id:{in:project.units.map(unit=>unit.segmentId).filter((id):id is string=>Boolean(id))}}});
    const text = project.units.map(unit => chapters.find(chapter => chapter.id === unit.chapterId)?.content ?? segments.find(segment=>segment.id===unit.segmentId)?.content ?? "").join("");
    res.type("text/plain; charset=utf-8").send(text);
  } catch (error) { next(error); }
});

function isCanonicalBase64(value: string): boolean { return value.length % 4 === 0 && /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/u.test(value); }


const baselineService=new ManuscriptBaselineService(),revisionService=new ManuscriptRevisionService(),structureService=new ManuscriptStructureService(),tasks=new ManuscriptTaskService();
const modelSchema=z.object({provider:z.string().max(80).optional(),model:z.string().max(160).optional(),temperature:z.number().min(0).max(2).optional(),maxRequests:z.number().int().min(1).max(4000).optional()});
const revisionBaseSchema=z.object({expectedStructureVersion:version,baseUnitRevision:version,baseContentHash:hash,baselineOutlineRevisionId:key.nullable(),baseWorkingOutlineRevisionId:key.nullable(),requestKey:key});
const baselinePreviewSchema=modelSchema.extend({sourceHash:hash,expectedStructureVersion:version,sourceType:z.enum(["author_provided","inferred_from_manuscript"]).optional(),outlineProjectId:key.optional(),outlineRevisionId:key.optional()});
function param(req:import("express").Request,key:string){return z.string().min(1).parse(req.params[key]);}
function command(path:string,run:(projectId:string,req:import("express").Request)=>Promise<unknown>){manuscriptRouter.post(path,async(req,res,next)=>{try{res.json({success:true,data:await run(param(req,"projectId"),req)});}catch(error){next(error);}});}
command("/:projectId/outline-baseline/preview",(id,req)=>baselineService.preview(id,baselinePreviewSchema.extend({requestKey:key}).parse(req.body)));
command("/:projectId/outline-baseline/confirm",(id,req)=>baselineService.confirm(id,z.object({proposalId:key,candidateRevisionId:key,sourceHash:hash,coverageHash:hash,expectedStructureVersion:version,requestKey:key}).parse(req.body)));
manuscriptRouter.get("/:projectId/proposals/:proposalId",async(req,res,next)=>{try{res.json({success:true,data:await workspaceService.proposal(param(req,"projectId"),param(req,"proposalId"))});}catch(error){next(error);}});
command("/:projectId/units/:unitId/diagnoses",(id,req)=>revisionService.diagnose(id,param(req,"unitId"),revisionBaseSchema.merge(modelSchema).parse(req.body)));
command("/:projectId/units/:unitId/revision-previews",(id,req)=>revisionService.rewrite(id,param(req,"unitId"),revisionBaseSchema.merge(modelSchema).extend({operation:z.enum(["polish","expand","compress","emotion","conflict","custom"]),instruction:z.string().max(5000),selection:z.object({from:version,to:version,text:z.string().max(12000)}).optional()}).parse(req.body)));
command("/:projectId/units/:unitId/manual-save",(id,req)=>revisionService.manualSave(id,param(req,"unitId"),revisionBaseSchema.extend({content:z.string().max(3000000)}).parse(req.body)));
command("/:projectId/units/:unitId/restore-original-preview",(id,req)=>revisionService.restore(id,param(req,"unitId"),revisionBaseSchema.parse(req.body)));
command("/:projectId/proposals/:proposalId/apply",async(id,req)=>{const row=await prisma.manuscriptRevisionProposal.findFirst({where:{id:param(req,"proposalId"),projectId:id},select:{kind:true}});if(!row)throw Error("MANUSCRIPT_NOT_FOUND");if(row.kind==="structure")return structureService.apply(id,param(req,"proposalId"),z.object({expectedStructureVersion:version,confirmImpact:z.literal(true),requestKey:key}).strict().parse(req.body));return revisionService.apply(id,param(req,"proposalId"),revisionBaseSchema.extend({candidateId:key}).parse(req.body));});
command("/:projectId/proposals/:proposalId/reject",(id,req)=>revisionService.reject(id,param(req,"proposalId")));
const structureOperationSchema=z.discriminatedUnion("kind",[z.object({kind:z.literal("insert_unit"),afterUnitId:key.nullable().optional(),beforeUnitId:key.nullable().optional(),title:z.string().trim().min(1).max(200),purpose:z.string().max(5000).optional(),content:z.string().max(3000000).optional()}),z.object({kind:z.literal("deactivate_unit"),unitId:key,expectedUnitRevision:version.optional()}),z.object({kind:z.literal("restore_unit"),unitId:key,afterUnitId:key.nullable().optional()}),z.object({kind:z.literal("merge_units"),unitIds:z.array(key).min(2).max(3000),title:z.string().trim().min(1).max(200)})]);
command("/:projectId/structure-previews",(id,req)=>structureService.preview(id,z.object({expectedStructureVersion:version,unitId:key.optional(),operations:z.array(structureOperationSchema).min(1).max(20),requestKey:key}).parse(req.body)));
command("/:projectId/changes/:proposalId/undo",(id,req)=>revisionService.undo(id,param(req,"proposalId"),z.object({expectedStructureVersion:version,expectedAfterHash:hash,requestKey:key}).parse(req.body)));
command("/:projectId/units/:unitId/sync/retry",(id,req)=>prisma.$transaction(async tx=>{const input=revisionBaseSchema.parse(req.body),unitId=param(req,"unitId"),snapshot=await takeManuscriptSnapshot(tx,id,unitId);validateManuscriptRevisionBase(snapshot,input);await assertManuscriptSnapshot(tx,id,snapshot);const s=await readManuscriptState(tx,id,unitId);if(s.unit?.status!=="active")throw Error("UNIT_INACTIVE");await queueManualChapterSync(tx,s.chapter!);return {status:"pending"};}));
command("/:projectId/tasks/:taskId/cancel",(id,req)=>tasks.cancel(id,param(req,"taskId")));
command("/:projectId/tasks/:taskId/retry",(id,req)=>tasks.retry(id,param(req,"taskId"),z.object({maxRequests:z.number().int().min(1).max(4000).optional()}).parse(req.body).maxRequests).then(()=>workspaceService.proposal(id,param(req,"taskId"))));

export const manuscriptErrorHandler:ErrorRequestHandler=(error,req,res,next)=>{
 if(error instanceof z.ZodError||error instanceof AppError)return next(error);
 const code=error instanceof Error?error.message:"";
 const messages:Record<string,string>={MANUSCRIPT_UNIT_INVALID:"El capítulo no pertenece al directorio actual o la ubicación ha cambiado, verifique nuevamente.",MANUSCRIPT_MERGE_NON_ADJACENT:"Sólo se pueden fusionar capítulos adyacentes en el directorio de trabajo actual.",BASELINE_ALREADY_CONFIRMED:"Se ha corregido la línea base del esquema del manuscrito; edite el esquema de trabajo independiente más adelante.",MANUSCRIPT_CHAPTER_TOO_LONG:"Todo el capítulo supera el presupuesto de revisión actual. Seleccione el fragmento en el área de edición para generarlo; el resto del largo capítulo no será cortado ni reescrito.",MANUSCRIPT_CANDIDATE_INVALID:"El candidato no pertenece a esta propuesta, por favor verifique nuevamente.",PARTITION_INVALID_ROLE:"Seleccione un propósito para cada área de texto fuente.",PARTITION_DRAFT_ID_INVALID:"La identificación de la unidad del capítulo se repite; vuelva a identificarla o divídala.",PARTITION_UNIT_INVALID:"Verifique el título del capítulo y el estado de confirmación.",MANUSCRIPT_NOT_FOUND:"No se pudo encontrar el manuscrito original ni el registro de revisión de este libro.",MANUSCRIPT_SOURCE_INVALID:"La fuente original no es válida, seleccione TXT nuevamente o pegue el original completo.",MANUSCRIPT_EMPTY:"El archivo no tiene cuerpo importable.",MANUSCRIPT_SIZE_LIMIT:"El archivo original supera el límite de 20 MiB. Reduzca el tamaño del archivo e inténtelo de nuevo.",MANUSCRIPT_CHARACTER_LIMIT:"El texto original supera el límite superior de 3 millones de caracteres y ninguna parte del texto original se trunca ni se guarda.",MANUSCRIPT_RANGE_INVALID:"El rango de orientación del texto original no es válido. Seleccione nuevamente.",MANUSCRIPT_REQUEST_INVALID:"Por favor verifique el título del trabajo con esta solicitud.",ENCODING_CONFIRM_REQUIRED:"La codificación actual no se puede decodificar completamente; seleccione la codificación correcta; Los caracteres confusos no se guardarán.",PARTITION_INCOMPLETE:"Si hay lagunas, superposiciones, áreas no confirmadas o ningún artículo principal en los capítulos, verifique la cobertura completa.",PARTITION_SURROGATE_SPLIT:"El punto de división está dentro de un personaje completo; muévase a un personaje adyacente.",IMPORT_VERSION_CONFLICT:"La versión capítulo por capítulo del manuscrito ha sido actualizada, léala nuevamente y confírmela.",IMPORT_ALREADY_CONFIRMED:"Se ha creado una copia revisada de este manuscrito; vaya al libro original.",REQUEST_KEY_CONFLICT:"Esta solicitud no coincide con el contenido confirmado anteriormente; verifíquelo nuevamente.",REVISION_BASE_STALE:"Este capítulo, artículo anterior o esquema de trabajo ha sido actualizado. Los candidatos son sólo para comparar, por favor regenerar.",UNIT_INACTIVE:"Este capítulo ha sido desactivado, restáurelo primero desde la revisión de la estructura.",BASELINE_REQUIRED:"Confirme la línea de base del esquema original antes de generar revisiones semánticas.",TASK_CANCELLED:"Esta tarea ha sido cancelada y el texto no se cambiará debido a una llegada tardía.",STRUCTURE_IMPACT_CONFIRM_REQUIRED:"Verifique el impacto de la estructura del capítulo y confírmelo claramente.",MANUSCRIPT_DIRECTOR_BLOCKED:"Las revisiones de manuscritos no activarán AutoDirector. Obtenga una vista previa y adopte capítulo por capítulo en la página de revisión del manuscrito.",MANUSCRIPT_CORE_FACT_CONFIRM_REQUIRED:"Primero proponga y confirme los cambios principales de la trama en el esquema de trabajo, y no se propagarán automáticamente a través de revisiones locales."};
  if(code==="SHORT_STORY_STRUCTURE_UNAVAILABLE")return res.status(409).json({success:false,error:"Los cuentos se pueden revisar sección por sección; seleccione el contenido que desea revisar de la lista de secciones.",code});
  if(messages[code])return res.status(code.includes("NOT_FOUND")?404:["REVISION_BASE_STALE","IMPORT_VERSION_CONFLICT","IMPORT_ALREADY_CONFIRMED","REQUEST_KEY_CONFLICT","UNIT_INACTIVE","TASK_CANCELLED","MANUSCRIPT_DIRECTOR_BLOCKED"].includes(code)?409:422).json({success:false,error:messages[code],code});
 next(error);
};

manuscriptRouter.use(manuscriptErrorHandler);
