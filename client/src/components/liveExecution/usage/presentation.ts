export function formatCacheTokens(value: number | null | undefined, phase: string, status?: string): string {
    if (status === "invalid")
        return "Estadísticas no disponibles";
    if (status === "reported" && typeof value === "number" && Number.isSafeInteger(value) && value >= 0)
        return value.toLocaleString();
    if (!["completed", "failed", "cancelled"].includes(phase))
        return "Calculando";
    return status === undefined ? "Sin registro" : "No disponible";
}
