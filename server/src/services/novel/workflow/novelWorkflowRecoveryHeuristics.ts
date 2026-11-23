export function isHistoricalAutoDirectorRecoveryNotNeededFailure(input: {
  lane?: string | null;
  status?: string | null;
  checkpointType?: string | null;
  lastError?: string | null;
}): boolean {
  if (input.lane !== "auto_director" || input.status !== "failed" || !input.checkpointType) {
    return false;
  }
  const message = input.lastError?.trim() ?? "";
  return message.includes("El producto del actual director está completo.") && message.includes("No es necesario continuar con la dirección automática");
}

export function isHistoricalAutoDirectorFront10RecoveryUnsupportedFailure(input: {
  lane?: string | null;
  status?: string | null;
  lastError?: string | null;
}): boolean {
  if (input.lane !== "auto_director" || input.status !== "failed") {
    return false;
  }
  const message = input.lastError?.trim() ?? "";
  return message.includes("La recuperación falla después del reinicio del servicio")
    && message.includes("El punto de control actual no admite la dirección automática continua");
}

export function isAutoDirectorRecoveryInProgress(input: {
  status?: string | null;
  lastError?: string | null;
}): boolean {
  if (input.status !== "queued" && input.status !== "running") {
    return false;
  }
  const message = input.lastError?.trim() ?? "";
  return message.includes("Reinicio del servicio")
    && message.includes("Tratando de restaurar");
}
