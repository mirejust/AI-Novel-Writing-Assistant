import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { Chapter } from "@ai-novel/shared/types/novel";
import { updateNovelChapter } from "@/api/novel";
import { useChapterDraft } from "@/pages/novels/components/chapterEditor/document";
import { Button } from "@/components/ui/button";

export function MobileChapter({ novelId, chapter }: { novelId: string; chapter: Chapter }) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const queryClient = useQueryClient();
  const draft = useChapterDraft({ novelId, chapter, busy: saving });
  async function save() {
    setSaving(true); setError("");
    const content = draft.contentDraft;
    try {
      const response = await updateNovelChapter(novelId, chapter.id, { content, expectedUpdatedAt: draft.savedUpdatedAt, expectedContent: draft.savedContent });
      if (!response.data) throw new Error("No se pudo guardar el texto, inténtelo nuevamente.");
      draft.acknowledgeSave(content, response.data);
      await queryClient.invalidateQueries({ queryKey: ["mobileNovel", novelId] });
      setEditing(false);
    } catch (error) { setError(error instanceof Error ? error.message : "No se pudo guardar el texto, inténtelo nuevamente."); }
    finally { setSaving(false); }
  }
  return <article className="space-y-4 border-t pt-5">
    <h2 className="text-lg font-semibold">Cap. {chapter.order} capítulo · {chapter.title}</h2>
    <p className="text-xs text-muted-foreground">{chapter.content?.trim() ? `${chapter.content.length} palabras` : "Texto a generar"}</p>
    {draft.restored || draft.isDirty ? <p role="status" className="text-sm text-muted-foreground">Hay modificaciones de texto no guardadas en esta máquina. Puede hacer clic en "Corrección de texto pequeño" para continuar editando.</p> : null}
    {draft.storageError ? <p role="alert" className="text-sm text-destructive">El borrador nativo no logró salvarse. Mantenga la página abierta y guarde el texto.</p> : null}
    {draft.hasExternalChange ? <div role="alert" className="space-y-2 text-sm text-destructive"><p>El texto guardado ha cambiado, verifique las modificaciones y cargue el nuevo texto.</p><Button variant="outline" onClick={() => { if (window.confirm("Cargar el nuevo texto reemplazará las modificaciones no guardadas en esta máquina. ¿Quieres continuar?")) draft.loadSavedVersion(); }}>Cargar texto guardado</Button></div> : null}
    {editing ? <>
      <textarea aria-label="Texto del capítulo" className="min-h-[60dvh] w-full rounded-md border bg-background p-3 text-base leading-8 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" value={draft.contentDraft} disabled={saving} onChange={event => draft.setContentDraft(event.target.value)} />
      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
      <div className="sticky bottom-20 flex gap-3 bg-background py-3"><Button onClick={() => void save()} disabled={saving || !draft.isDirty || draft.hasExternalChange}>{saving ? "Guardando…" : "Guardar texto"}</Button><Button variant="ghost" disabled={saving} onClick={() => setEditing(false)}>Volver a la lectura</Button></div>
    </> : <><div className="whitespace-pre-wrap break-words text-base leading-8">{chapter.content || "AI guarda el texto y puede leerlo aquí."}</div><Button variant="outline" onClick={() => setEditing(true)}>Corrección de texto menor</Button></>}
  </article>;
}
