import { validateOutlineDocument, type OutlineDocument } from "./outlineDocument";

const editableCollections = ["volumes", "chapters", "characters", "payoffs", "facts"] as const;

function assertSameNodeIds(original: OutlineDocument, edited: OutlineDocument) {
  if (original.story.nodeId !== edited.story.nodeId) throw new Error("La confirmación de importación no puede reemplazar la ID del nodo maestro");
  for (const collection of editableCollections) {
    const originalIds = original[collection].map(node => node.nodeId);
    const editedIds = new Set(edited[collection].map(node => node.nodeId));
    if (originalIds.length !== editedIds.size || originalIds.some(nodeId => !editedIds.has(nodeId))) {
      throw new Error("La confirmación de importación solo puede ajustar los nodos analizados y no puede agregar, eliminar nodos ni reemplazar ID de nodos.");
    }
  }
}

function unique(ids: string[]) {
  return [...new Set(ids)];
}

function assertTargets(ids: string[], allowed: Set<string>, label: string) {
  for (const nodeId of ids) if (!allowed.has(nodeId)) throw new Error(`${label}Contiene una referencia de nodo no válida`);
}

export function applyOutlineImportEdits(originalInput: unknown, editedInput: unknown): OutlineDocument {
  const original = validateOutlineDocument(originalInput);
  const edited = validateOutlineDocument(editedInput);
  assertSameNodeIds(original, edited);

  const volumes: OutlineDocument["volumes"] = original.volumes.map(volume => ({
    ...volume,
    title: edited.volumes.find(item => item.nodeId === volume.nodeId)!.title,
    chapterNodeIds: [],
  }));
  const chapters = original.chapters.map(chapter => {
    const next = edited.chapters.find(item => item.nodeId === chapter.nodeId)!;
    return {
      ...chapter,
      title: next.title,
      volumeNodeId: next.volumeNodeId,
      ...(next.volumeNodeId !== chapter.volumeNodeId && {beatKey: undefined}),
      characterNodeIds: unique(next.characterNodeIds),
      payoffNodeIds: unique(next.payoffNodeIds),
    };
  });
  const characters = original.characters.map(character => {
    const next = edited.characters.find(item => item.nodeId === character.nodeId)!;
    return { ...character, name: next.name, appearanceNodeIds: unique(next.appearanceNodeIds) };
  });
  const payoffs = original.payoffs.map(payoff => {
    const next = edited.payoffs.find(item => item.nodeId === payoff.nodeId)!;
    return {
      ...payoff,
      title: next.title,
      setupChapterNodeIds: unique(next.setupChapterNodeIds),
      payoffChapterNodeIds: unique(next.payoffChapterNodeIds),
      relatedNodeIds: unique(next.relatedNodeIds),
    };
  });
  const facts = original.facts.map(fact => {
    const next = edited.facts.find(item => item.nodeId === fact.nodeId)!;
    return {
      ...fact,
      title: next.title,
      scope: { ...next.scope },
      relatedNodeIds: unique(next.relatedNodeIds),
    };
  });

  const volumeIds = new Set(volumes.map(node => node.nodeId));
  const chapterIds = new Set(chapters.map(node => node.nodeId));
  const characterIds = new Set(characters.map(node => node.nodeId));
  const payoffIds = new Set(payoffs.map(node => node.nodeId));
  const allNodeIds = new Set([
    original.story.nodeId,
    ...volumeIds,
    ...chapterIds,
    ...characterIds,
    ...payoffIds,
    ...facts.map(node => node.nodeId),
  ]);
  for (const chapter of chapters) {
    if (!volumeIds.has(chapter.volumeNodeId)) throw new Error("Los capítulos deben pertenecer a un volumen analizado.");
    assertTargets(chapter.characterNodeIds, characterIds, "Personajes del capítulo");
    assertTargets(chapter.payoffNodeIds, payoffIds, "Capítulo presagio");
  }
  for (const character of characters) assertTargets(character.appearanceNodeIds, new Set([...volumeIds, ...chapterIds]), "Ubicación de la aparición del personaje.");
  for (const payoff of payoffs) {
    assertTargets(payoff.setupChapterNodeIds, chapterIds, "Capítulo de presagios");
    assertTargets(payoff.payoffChapterNodeIds, chapterIds, "Capítulo de reciclaje que presagia");
    assertTargets(payoff.relatedNodeIds, allNodeIds, "Presagio de nodos asociados");
  }
  for (const fact of facts) {
    assertTargets(fact.relatedNodeIds, allNodeIds, "Establecer nodos asociados");
    if (fact.scope.type === "volume" && (!fact.scope.nodeId || !volumeIds.has(fact.scope.nodeId))) throw new Error("El rango de volumen establecido fijo no es válido");
    if (fact.scope.type === "chapter" && (!fact.scope.nodeId || !chapterIds.has(fact.scope.nodeId))) throw new Error("El rango de capítulos fijo no es válido");
    if (fact.scope.type === "story") delete fact.scope.nodeId;
  }

  for (const volume of volumes) {
    volume.chapterNodeIds = chapters.filter(chapter => chapter.volumeNodeId === volume.nodeId).map(chapter => chapter.nodeId);
  }
  return validateOutlineDocument({
    ...original,
    story: { ...original.story, title: edited.story.title },
    volumes,
    chapters,
    characters,
    payoffs,
    facts,
  });
}
