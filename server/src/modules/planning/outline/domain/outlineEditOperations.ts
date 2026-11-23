import { outlineDocumentSchema } from "./outlineDocument";
import { AppError } from "../../../../middleware/errorHandler";

export type OutlineEditOperation = {
  operationId: string;
  kind: string;
  nodeType?: string;
  nodeId?: string;
  clientRef?: string;
  parentNodeId?: string;
  fields?: Record<string, unknown>;
  dependsOn: string[];
  reason?: string;
  affectedNodeIds?: string[];
  risks?: string[];
};

export type OutlineEditDocumentView = {
  story?: { nodeId: string };
  volumes: Array<{ nodeId: string }>;
  chapters: Array<{ nodeId: string; volumeNodeId: string }>;
  characters?: Array<{ nodeId: string }>;
  payoffs?: Array<{ nodeId: string }>;
  facts?: Array<{ nodeId: string }>;
};

const storyChanges = outlineDocumentSchema.shape.story.omit({ nodeId: true }).partial().strict();

function recoverable(message: string, details?: unknown): AppError {
  return new AppError(message, 400, details);
}

function assertUniqueOperationIds(operations: OutlineEditOperation[]): void {
  const seen = new Set<string>();
  for (const operation of operations) {
    if (!operation.operationId?.trim()) {
      throw recoverable("A la acción de propuesta le falta un número de acción válido; vuelva a generar la propuesta.");
    }
    if (seen.has(operation.operationId)) {
      throw recoverable(`Hay números de operación duplicados en la propuesta"${operation.operationId}”, por favor regenerar la propuesta.`);
    }
    seen.add(operation.operationId);
  }
}

function assertDependsOnAreOperationIds(operations: OutlineEditOperation[]): void {
  const operationIds = new Set(operations.map((operation) => operation.operationId));
  for (const operation of operations) {
    for (const dependencyId of operation.dependsOn ?? []) {
      if (!operationIds.has(dependencyId)) {
        throw recoverable(
          `funcionar"${operation.operationId}"La dependencia debe ser otros números de operación en la misma propuesta, y los números de nodo como volumen/capítulo no se pueden completar". Por favor regenera la propuesta.`,
          { operationId: operation.operationId, dependencyId },
        );
      }
      if (dependencyId === operation.operationId) {
        throw recoverable(`funcionar"${operation.operationId}"No puedes confiar en ti mismo, por favor regenera la propuesta".`);
      }
    }
  }
}

function assertNoDependencyCycles(operations: OutlineEditOperation[]): void {
  const byId = new Map(operations.map((operation) => [operation.operationId, operation]));
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visit = (operationId: string, stack: string[]) => {
    if (visited.has(operationId)) return;
    if (visiting.has(operationId)) {
      throw recoverable(`Las dependencias de operación de la propuesta forman un ciclo (${[...stack, operationId].join(" → ")}), por favor regenera la propuesta.`);
    }
    visiting.add(operationId);
    for (const dependencyId of byId.get(operationId)?.dependsOn ?? []) {
      visit(dependencyId, [...stack, operationId]);
    }
    visiting.delete(operationId);
    visited.add(operationId);
  };
  for (const operation of operations) visit(operation.operationId, []);
}

function volumeRefsInProposal(operations: OutlineEditOperation[]): Set<string> {
  const refs = new Set<string>();
  for (const operation of operations) {
    if (operation.kind === "add_node" && operation.nodeType === "volume" && operation.clientRef?.trim()) {
      refs.add(operation.clientRef.trim());
    }
  }
  return refs;
}

function existingNodeIds(document: OutlineEditDocumentView | undefined): Set<string> {
  const ids = new Set<string>();
  if (!document) return ids;
  for (const volume of document.volumes) ids.add(volume.nodeId);
  for (const chapter of document.chapters) ids.add(chapter.nodeId);
  for (const character of document.characters ?? []) ids.add(character.nodeId);
  for (const payoff of document.payoffs ?? []) ids.add(payoff.nodeId);
  for (const fact of document.facts ?? []) ids.add(fact.nodeId);
  return ids;
}

function existingVolumeIds(document: OutlineEditDocumentView | undefined): Set<string> {
  return new Set((document?.volumes ?? []).map((volume) => volume.nodeId));
}

/** Structural checks after AI generation and again before apply. Never silently drops deps or invents volume ownership. */
export function assertValidOutlineEditOperations(
  operations: OutlineEditOperation[],
  options: { document?: OutlineEditDocumentView; selectedOperationIds?: string[] } = {},
): void {
  if (!Array.isArray(operations) || operations.length < 1) {
    throw recoverable("No hay acciones adoptables en la propuesta. Por favor regenera la propuesta.");
  }
  assertUniqueOperationIds(operations);
  assertDependsOnAreOperationIds(operations);
  assertNoDependencyCycles(operations);

  const selected = new Set(
    options.selectedOperationIds?.length
      ? options.selectedOperationIds
      : operations.map((operation) => operation.operationId),
  );
  if (selected.size < 1) {
    throw recoverable("Seleccione al menos una acción antes de adoptarla.");
  }
  for (const operationId of selected) {
    if (!operations.some((operation) => operation.operationId === operationId)) {
      throw recoverable(`Operación seleccionada "${operationId}”no está en la propuesta actual.`);
    }
  }
  for (const operation of operations.filter((item) => selected.has(item.operationId))) {
    for (const dependencyId of operation.dependsOn ?? []) {
      if (!selected.has(dependencyId)) {
        throw recoverable(
          `Operación seleccionada "${operation.operationId}"También depende de operaciones no controladas"${dependencyId}". Verifique también las dependencias o regenere la propuesta.`,
          { operationId: operation.operationId, dependencyId },
        );
      }
    }
  }

  const selectedOps = operations.filter((operation) => selected.has(operation.operationId));
  const volumeClientRefs = volumeRefsInProposal(selectedOps);
  const volumeIds = existingVolumeIds(options.document);
  const nodeIds = existingNodeIds(options.document);

  for (const operation of selectedOps) {
    if (operation.kind === "add_node" && operation.nodeType === "chapter") {
      const volumeNodeId = typeof operation.fields?.volumeNodeId === "string"
        ? operation.fields.volumeNodeId.trim()
        : "";
      if (!volumeNodeId) {
        throw recoverable(
          "Los nuevos capítulos deben especificar el volumen al que pertenecen (fields.volumeNodeId). No se limite a cambiar la lista de capítulos del volumen para expresar los nuevos capítulos, regenere la propuesta.",
          { operationId: operation.operationId },
        );
      }
      if (!volumeIds.has(volumeNodeId) && !volumeClientRefs.has(volumeNodeId)) {
        throw recoverable(
          `El volumen al que pertenece el nuevo capítulo"${volumeNodeId}" no existe ni es un número temporal para el nuevo volumen de esta propuesta. Regenere la propuesta.`,
          { operationId: operation.operationId, volumeNodeId },
        );
      }
      if (!operation.clientRef?.trim()) {
        throw recoverable(`Agregar operación de capítulo "${operation.operationId}"Falta el número temporal clientRef, vuelva a generar la propuesta".`);
      }
    }

    if (operation.kind === "update_fields") {
      if (!operation.nodeId?.trim()) {
        throw recoverable(`Operación de actualización "${operation.operationId}"Falta el nodo de destino. Regenere la propuesta".`);
      }
      if (operation.nodeId === options.document?.story?.nodeId) {
        if (!operation.fields || !Object.keys(operation.fields).length || !storyChanges.safeParse(operation.fields).success) {
          throw recoverable("La propuesta general contiene campos que no se pueden editar. Por favor regenera la propuesta.");
        }
      } else if (options.document && !nodeIds.has(operation.nodeId) && !volumeClientRefs.has(operation.nodeId)) {
        // allow update only on existing nodes at apply-time; generation may still emit updates for existing ids
        throw recoverable(`El nodo a actualizar no existe, actualice el esquema y regenere la propuesta.`, { operationId: operation.operationId, nodeId: operation.nodeId });
      }
      if (operation.fields && Object.prototype.hasOwnProperty.call(operation.fields, "chapterNodeIds")) {
        throw recoverable(
          "Los capítulos no se pueden agregar ni ajustar modificando directamente la lista de capítulos del volumen. Utilice la operación \"Agregar capítulo\" o \"Mover capítulo\" y vuelva a generar la propuesta.",
          { operationId: operation.operationId },
        );
      }
    }

    if (operation.kind === "remove_node" || operation.kind === "move_node") {
      if (!operation.nodeId?.trim()) {
        throw recoverable(`funcionar"${operation.operationId}"Falta el nodo de destino. Regenere la propuesta".`);
      }
      if (options.document && !nodeIds.has(operation.nodeId)) {
        throw recoverable(`El nodo de destino no existe. Actualice el esquema y vuelva a generar la propuesta.`, { operationId: operation.operationId, nodeId: operation.nodeId });
      }
    }
    if (operation.kind === "move_node") {
      const parent = operation.parentNodeId?.trim() ?? "";
      if (!parent) {
        throw recoverable(`Operación de mover capítulo "${operation.operationId}"Se debe especificar el volumen objetivo; vuelva a generar la propuesta.`);
      }
      if (options.document && !volumeIds.has(parent) && !volumeClientRefs.has(parent)) {
        throw recoverable(`El volumen objetivo para mover el capítulo no existe, vuelva a generar la propuesta.`, { operationId: operation.operationId, parentNodeId: parent });
      }
    }
  }
}

export function mapOutlineApplyFailure(error: unknown): never {
  if (error instanceof AppError) throw error;
  const message = error instanceof Error ? error.message : String(error);
  if (message === "A la operación seleccionada le falta una dependencia") {
    throw recoverable("A la operación seleccionada también le faltan dependencias. Verifique todas las operaciones dependientes antes de adoptar o regenerar la propuesta.");
  }
  if (message === "El nodo de destino de la propuesta no existe" || message === "Actualmente solo se admiten capítulos móviles") {
    throw recoverable("El nodo al que apunta la propuesta ya no existe o el tipo no coincide. Actualice el esquema y regenere la propuesta.");
  }
  if (message.includes("El ID del nodo del esquema debe ser único") || message.includes("El esquema se refiere a un nodo que no existe.")) {
    throw recoverable("El esquema adoptado tiene referencias incompletas o números de nodos contradictorios. Por favor regenera la propuesta.");
  }
  if (message.startsWith("OUTLINE_")) {
    throw new AppError("El esquema ha sido actualizado, por favor regenere la propuesta.", 409);
  }
  throw error;
}
