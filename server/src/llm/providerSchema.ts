import { z } from "zod";

export const llmProviderSchema = z.string().trim().min(1, "El proveedor no puede estar vacío.");
