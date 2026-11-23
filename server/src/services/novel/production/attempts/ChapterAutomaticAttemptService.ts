import { prisma } from "../../../../db/prisma";
import { ChapterContentPersistenceError } from "../../runtime/lifecycle";

type AttemptStore = Pick<typeof prisma.chapterAutomaticAttempt, "findUnique" | "create">;

export class ChapterAutomaticAttemptService {
  constructor(private readonly store: AttemptStore = prisma.chapterAutomaticAttempt) {}

  async used(jobId: string, chapterId: string): Promise<number> {
    try {
      return await this.store.findUnique({ where: { jobId_chapterId: { jobId, chapterId } } }) ? 1 : 0;
    } catch {
      throw new ChapterContentPersistenceError(chapterId, "No se puede leer la cuota de procesamiento automático del capítulo. Verifique la migración y la conexión de la base de datos.");
    }
  }

  async claim(jobId: string, chapterId: string, kind: "quality_repair" | "runtime_retry"): Promise<boolean> {
    try {
      await this.store.create({ data: { jobId, chapterId, kind } });
      return true;
    } catch (error) {
      if (error && typeof error === "object" && "code" in error && error.code === "P2002") {
        return false;
      }
      throw new ChapterContentPersistenceError(chapterId, "No se puede guardar la cuota de procesamiento automático del capítulo, se detuvo la recuperación automática.");
    }
  }
}
