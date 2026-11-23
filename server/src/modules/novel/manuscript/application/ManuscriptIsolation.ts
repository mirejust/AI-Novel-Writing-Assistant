import { AppError } from "../../../../middleware/errorHandler";
import { readActiveManuscriptChapters } from "./ManuscriptWorkspaceService";

type ManuscriptIsolationDb = {
  manuscriptProject: { findUnique(input: unknown): Promise<{ id: string } | null> };
};

export async function isManuscriptNovel(db: ManuscriptIsolationDb, novelId: string): Promise<boolean> {
  return Boolean(await db.manuscriptProject.findUnique({ where: { novelId }, select: { id: true } }));
}

export async function rejectLegacyManuscriptWrite(db: ManuscriptIsolationDb, novelId: string): Promise<void> {
  if (await isManuscriptNovel(db, novelId)) {
    throw new AppError("Procese los capítulos en el espacio de trabajo de revisión del manuscrito. La entrada de creatividad anterior no sobrescribirá el texto importado.", 409);
  }
}

export async function rejectManuscriptDirectorEntry(db: ManuscriptIsolationDb, novelId: string): Promise<void> {
  if (await isManuscriptNovel(db, novelId)) {
    throw new AppError("Al importar un manuscrito, ajuste los capítulos en el espacio de trabajo de revisión del manuscrito. La creación del director no reescribirá el texto importado.", 409);
  }
}

export async function readEffectiveNovelChapters(db: ManuscriptIsolationDb, novelId: string) {
  return readActiveManuscriptChapters(db as never, novelId);
}

export { readActiveManuscriptChapters };

export async function resolveEffectiveNovelChapters<T>(
  db: ManuscriptIsolationDb,
  novelId: string,
  legacyRead: () => Promise<T>,
): Promise<Awaited<ReturnType<typeof readActiveManuscriptChapters>> | T> {
  const active = await readActiveManuscriptChapters(db as never, novelId);
  return active ?? legacyRead();
}

export function isCurrentSyncMarker(marker: { status: string } | null | undefined): boolean {
  return Boolean(marker && marker.status !== "superseded");
}
