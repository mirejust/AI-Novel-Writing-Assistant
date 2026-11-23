import { randomUUID } from "node:crypto";
import { AppError } from "../../../../middleware/errorHandler";
import { outlineVolumeBeatsPrompt } from "../../../../prompting/prompts/outline/volumeBeats.prompt";
import { validateOutlineDocument } from "../domain/outlineDocument";
import { OutlineRepository } from "../infrastructure/OutlineRepository";
import { runOutlineProposalStructuredCall } from "./outlineProposalStructuredCall";

export async function generateVolumeBeatProposal(repository: OutlineRepository, projectId: string, volumeId: string, baseVersion: number, targetChapterCount: number) {
  const source = await repository.getCurrent(projectId);
  if (!source?.revision || source.project.status !== "active") throw new AppError("No se encontró ningún esquema editable.",404);
  if (source.project.currentVersion !== baseVersion) throw new AppError("Abra el esquema más reciente antes de planificar este volumen.",409);
  const document = validateOutlineDocument(JSON.parse(source.revision.documentJson));
  const volume = document.volumes.find(v => v.nodeId === volumeId);
  if (!volume) throw new AppError("No se encuentra el volumen a planificar.",404);
  const chapters = document.chapters.filter(c => c.volumeNodeId === volumeId).sort((a,b) => a.order-b.order);
  if (chapters.length > targetChapterCount) throw new AppError("Se espera que la extensión no sea menor que el número de capítulos de este volumen.",422);
  const result = await runOutlineProposalStructuredCall({asset:outlineVolumeBeatsPrompt, promptInput:{story:document.story, volume, chapters, targetChapterCount}});
  const update = (nodeId: string, fields: Record<string,unknown>, reason: string) => ({
    operationId:nodeId, kind:"update_fields", nodeId, fields, reason, affectedNodeIds:[nodeId], dependsOn:[], risks:[],
  });
  const operations = [update(volumeId, {beats:result.output.beats}, "Disponer el avance y cumplimiento de este volumen."),
    ...result.output.assignments.map(a => update(a.chapterId, {beatKey:a.beatKey}, "Relaciona este capítulo con la sección rítmica que emprende."))];
  return repository.transaction(async tx => {
    const current = await tx.outlineProject.findUnique({where:{id:projectId}});
    if (current?.currentVersion !== baseVersion || current.status !== "active") throw new AppError("Hay una nueva versión del esquema durante el período de producción; vuelva a planificar de acuerdo con el borrador actual.",409);
    return tx.outlineProposal.create({data:{id:randomUUID(), projectId, baseVersion, kind:"volume_beats", status:"pending",
      requestText:`«${volume.title}"El ritmo y la disposición de los capítulos de`, proposalJson:JSON.stringify({volumeId, operations}),
      promptId:outlineVolumeBeatsPrompt.id, promptVersion:outlineVolumeBeatsPrompt.version}});
  });
}
