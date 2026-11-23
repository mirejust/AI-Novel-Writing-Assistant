import type { PrismaClient } from "@prisma/client";
import { buildBookContractPayoffSources } from "../../../../../services/payoff/sources/bookContractPayoffSources";
import { InvalidProductionRequestError } from "../../../application";
import type { PayoffExtractionDependencies } from "./extraction";

const compact = (value: string | null | undefined) => value?.replace(/\s+/g, " ").trim() || "Ninguno";
function strings(raw: string | null | undefined): string[] {
  if (!raw) return [];
  const value: unknown = JSON.parse(raw);
  if (!Array.isArray(value) || value.some(item => typeof item !== "string")) throw new InvalidProductionRequestError("Invalid structured payoff source");
  return value;
}
/** Read-only relocation of the existing full-ledger prompt inputs. DB failures never become empty state. */
export function createPayoffSourceReader(db: Pick<PrismaClient, "novel" | "chapter" | "volumePlan" | "storyStateSnapshot" | "openConflict" | "auditReport">): PayoffExtractionDependencies["read"] {
  return async context => {
    const { novelId, chapterId, order } = context.run.progress.unit;
    const [novel, chapter, volumes, snapshot, conflicts, reports] = await Promise.all([
      db.novel.findUnique({ where: { id: novelId }, select: { title: true, storyMacroPlan: { select: { decompositionJson: true } },
        bookContract: { select: { chapter3Payoff: true, chapter10Payoff: true, chapter30Payoff: true } } } }),
      db.chapter.findFirst({ where: { id: chapterId, novelId }, select: { order: true } }),
      db.volumePlan.findMany({ where: { novelId }, orderBy: { sortOrder: "asc" }, include: { chapters: { orderBy: { chapterOrder: "asc" },
        select: { chapterOrder: true, title: true, summary: true, payoffRefsJson: true } } } }),
      db.storyStateSnapshot.findFirst({ where: { novelId }, orderBy: { createdAt: "desc" }, include: { sourceChapter: { select: { id: true, order: true, title: true } }, foreshadowStates: true } }),
      db.openConflict.findMany({ where: { novelId, status: "open" }, orderBy: { updatedAt: "desc" }, take: 8 }),
      db.auditReport.findMany({ where: { novelId, auditType: "plot" }, orderBy: { createdAt: "desc" }, take: 4,
        include: { issues: { where: { status: "open" }, orderBy: { createdAt: "desc" } } } }),
    ]);
    if (!novel || !chapter || chapter.order !== order) throw new InvalidProductionRequestError("Payoff source chapter identity changed");
    const active = volumes.find(volume => volume.chapters.some(item => item.chapterOrder === order));
    const macro: { major_payoffs?: unknown } = novel.storyMacroPlan?.decompositionJson ? JSON.parse(novel.storyMacroPlan.decompositionJson) : {};
    const major = Array.isArray(macro.major_payoffs) ? macro.major_payoffs.filter((item): item is string => typeof item === "string" && Boolean(item.trim())) : [];
    return { novelTitle: novel.title, bookContractPayoffs: buildBookContractPayoffSources(novel.bookContract),
      activeVolumeSummary: active ? [`Volumen actual: No.${active.sortOrder}rollo"${active.title}»`, `Resumen del volumen:${compact(active.summary)}`,
        `Pagos abiertos por volumen:${strings(active.openPayoffsJson).join(";") || "Ninguno"}`,
        active.chapters.length ? `Rango de capítulos de volumen:${active.chapters[0].chapterOrder}-${active.chapters.at(-1)!.chapterOrder}` : "Rango de capítulos de volumen: Ninguno"].join("\n")
        : `Actualmente no hay ninguna ventana de volumen activa.${volumes.length ? `Ya tengo volúmenes:${volumes.map(volume => `Cap.${volume.sortOrder}rollo"${volume.title}»`).join(";")}` : ""}`,
      latestChapterContext: [`Número de capítulo actual: Capítulo${order}cap.`, snapshot?.sourceChapter ? `Fuente de la última instantánea de estado: No.${snapshot.sourceChapter.order}capítulo"${snapshot.sourceChapter.title}»` : "Fuente de la última instantánea de estado: Ninguna",
        snapshot?.summary ? `Resumen de instantáneas de estado:${snapshot.summary}` : ""].filter(Boolean).join("\n"),
      majorPayoffsText: major.map((item, index) => `${index + 1}. ${item}`).join("\n") || "Ninguno",
      openPayoffsText: volumes.map(volume => { const values = strings(volume.openPayoffsJson); return values.length ? `[No.${volume.sortOrder}rollo ${volume.title}] ${values.map(compact).join(";")}` : ""; }).filter(Boolean).join("\n\n") || "Ninguno",
      chapterPayoffRefsText: volumes.flatMap(volume => volume.chapters.map(item => { const refs = strings(item.payoffRefsJson);
        return refs.length ? `Cap.${item.chapterOrder}capítulo"${item.title}» | ${refs.map(compact).join(";")}` : ""; })).filter(Boolean).join("\n\n") || "Ninguno",
      foreshadowStatesText: snapshot?.foreshadowStates.map(item => [`título:${item.title}`, `estado:${compact(item.status)}`, item.summary ? `resumen:${item.summary}` : "",
        item.setupChapterId ? `ID de capítulo de configuración:${item.setupChapterId}` : "", item.payoffChapterId ? `ID del capítulo de pago:${item.payoffChapterId}` : ""].filter(Boolean).join(" | ")).join("\n") || "Ninguno",
      payoffConflictsText: conflicts.map(item => [`${item.conflictType}/${item.severity}:${item.title}`, compact(item.summary), item.resolutionHint ? `Sugerencias de reparación:${compact(item.resolutionHint)}` : ""].filter(Boolean).join(" | ")).join("\n") || "Ninguno",
      payoffAuditIssuesText: reports.flatMap(report => report.issues.map(issue => `${issue.code} (${issue.severity}):${compact(issue.description)} | Evidencia:${compact(issue.evidence)}`)).join("\n") || "Ninguno" };
  };
}
