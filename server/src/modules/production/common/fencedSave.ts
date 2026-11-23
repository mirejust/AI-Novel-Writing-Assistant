export interface ContentVersionFence { version: string | number; userEditedAt: string | null }
export class ProtectedProductionContentError extends Error {
  constructor() { super("El texto editado manualmente debe revisarse explícitamente y no puede sobrescribirse mediante producción automática."); this.name = "ProtectedProductionContentError"; }
}
export class ProductionVersionConflictError extends Error {
  constructor() { super("La versión del texto ha cambiado, reconfírmela desde la página de trabajo."); this.name = "ProductionVersionConflictError"; }
}

export async function saveWithFence<T, R>(input: {
  expected: ContentVersionFence;
  value: T;
  purpose: "automatic" | "user_requested";
  fence: () => Promise<void>;
  /** Must check version, edit marker and durable ownership atomically with the write. */
  compareAndSave: (input: { expected: ContentVersionFence; value: T }) => Promise<{ saved: true; value: R } | { saved: false }>;
}): Promise<R> {
  await input.fence();
  if (input.purpose === "automatic" && input.expected.userEditedAt !== null) throw new ProtectedProductionContentError();
  const result = await input.compareAndSave({ expected: input.expected, value: input.value });
  if (!result.saved) throw new ProductionVersionConflictError();
  await input.fence();
  return result.value;
}
