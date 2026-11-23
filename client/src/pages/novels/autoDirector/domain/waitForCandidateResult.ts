import type { DirectorCommandResultResponse } from "@ai-novel/shared/types/directorRuntime";

export async function waitForCandidateResult<T extends {batch: unknown}>(
  read: () => Promise<{data?: DirectorCommandResultResponse<T> | null}>,
  signal: AbortSignal,
  wait: () => Promise<void> = () => new Promise(resolve => setTimeout(resolve, 2000)),
): Promise<T> {
  for (;;) {
    signal.throwIfAborted();
    let command: DirectorCommandResultResponse<T> | null | undefined;
    try {
      command = (await read()).data;
    } catch (error) {
      signal.throwIfAborted();
      // A failed status read says nothing about the accepted command. Poll again on transport errors.
      const status = (error as {status?: number})?.status;
      if (!(error instanceof Error) || !("status" in error) ||
          (status && status < 500 && status !== 408 && status !== 429)) throw error;
      await wait();
      continue;
    }
    signal.throwIfAborted();
    if (!command) throw new Error("Esta operación de apertura de libro no fue encontrada. Vuelva a abrir la página de apertura del libro para comprobar el progreso.");
    switch (command.status) {
      case "failed":
      case "cancelled":
      case "stale":
        throw new Error(command.errorMessage || "Esta vez la operación de apertura del libro se ha detenido. Consulte los detalles en la página de apertura del libro.");
      case "succeeded":
        if (command.result?.batch) return command.result;
        throw new Error("La operación de apertura del libro ha finalizado y no se han devuelto ninguna solución candidata. Vuelva a abrir la página de apertura del libro para ver los resultados.");
      case "queued":
      case "leased":
      case "running":
        await wait();
        break;
      default:
        throw new Error("No se puede reconocer el progreso de apertura del libro, vuelva a abrir la página de apertura del libro.");
    }
  }
}
