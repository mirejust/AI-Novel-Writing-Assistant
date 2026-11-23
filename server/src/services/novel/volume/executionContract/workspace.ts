import type { Prisma } from "@prisma/client";
import type { VolumePlanDocument } from "@ai-novel/shared/types/novel";
import { normalizeVolumeWorkspaceDocument } from "../volumeWorkspaceDocument";

/** Existing ensure/get paths may hydrate missing rows. Preparation must never do that implicitly. */
export async function readExecutionContractWorkspace(
  db: Pick<Prisma.TransactionClient, "volumePlan" | "volumePlanVersion">,
  novelId: string,
): Promise<VolumePlanDocument> {
  const [rows, version] = await Promise.all([
    db.volumePlan.findMany({ where: { novelId }, select: { id: true } }),
    db.volumePlanVersion.findFirst({ where: { novelId, status: "active" }, orderBy: { version: "desc" } }),
  ]);
  if (!rows.length || !version) throw new Error("Regrese a la página de origen para completar la planificación del volumen y la sincronización de capítulos, y luego genere el texto principal.");
  const document = normalizeVolumeWorkspaceDocument(novelId, version.contentJson, { source: "volume", activeVersionId: version.id });
  if (!document.volumes.length || document.volumes.some(volume => !rows.some(row => row.id === volume.id))) {
    throw new Error("La fuente de planificación del volumen no coincide con el registro del capítulo. Regrese a la página de origen para completar la sincronización.");
  }
  return document;
}
