import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileUp, Plus, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { OutlineDocument } from "@ai-novel/shared/types/outline";
import { Button } from "@/components/ui/button";
import {
  confirmOutlineImport, createOutline, listOutlines, previewOutlineImport,
  type OutlineImportPreview as OutlineImportPreviewData,
} from "@/api/outlines";
import { OutlineImportPreview } from "./OutlineImportPreview";
import { OutlineLibrary, OutlineSamplePage } from "./library/OutlineLibrary";
import "./library/outlineLibrary.css";

export default function OutlineListPage() {
  const navigate = useNavigate();
  const client = useQueryClient();
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState("");
  const [preview, setPreview] = useState<OutlineImportPreviewData | null>(null);
  const query = useQuery({ queryKey: ["outlines"], queryFn: listOutlines });
  const create = useMutation({
    mutationFn: (mode: "idea" | "blank") => createOutline(mode === "idea" ? "Nueva sinopsis" : "Esquema sin nombre"),
    onSuccess: async (result, mode) => {
      await client.invalidateQueries({ queryKey: ["outlines"] });
      navigate(`/outlines/${result.project.id}${mode === "idea" ? "?start=idea" : ""}`);
    },
  });
  const parse = useMutation({
    mutationFn: () => previewOutlineImport({
      title: "Esquema importado", text: importText, format: /^\s*#/m.test(importText) ? "markdown" : "text",
    }),
    onSuccess: setPreview,
  });
  const confirm = useMutation({
    mutationFn: (document: OutlineDocument) => confirmOutlineImport(preview!.token, document),
    onSuccess: async result => {
      setPreview(null);
      await client.invalidateQueries({ queryKey: ["outlines"] });
      navigate(`/outlines/${result.project.id}`);
    },
  });
  const projects = query.data ?? [];
  const empty = query.isSuccess && projects.length === 0;
  const actions = <div className="outline-library-actions">
    <Button onClick={() => create.mutate("idea")} disabled={create.isPending}><Sparkles size={16} />Empezar con una idea</Button>
    <Button variant="outline" onClick={() => create.mutate("blank")} disabled={create.isPending}><Plus size={16} />Esquema en blanco</Button>
    <Button variant="ghost" aria-expanded={importOpen} aria-controls="outline-import" onClick={() => setImportOpen(open => !open)}><FileUp size={16} />Importar esquema</Button>
  </div>;
  return <div className="outline-catalog">
    <header className="outline-catalog-heading">
      <div><h1>Banco de trabajo de esquema</h1>
        {!empty && <p>Comience con una idea de historia y organice los capítulos, los personajes y los presagios libro por libro.</p>}</div>
      {!empty && actions}
    </header>
    {empty && <section aria-labelledby="outline-empty-heading" className="outline-library-empty">
      <div className="outline-empty-copy">
        <h2 id="outline-empty-heading">Escribe tu primer esquema</h2>
        <p>¿Quién es el protagonista? ¿Qué problemas encontraste? Comienza con una frase y trabaja con la IA para organizar la historia en volúmenes y capítulos.</p>
        {actions}
      </div>
      <OutlineSamplePage />
    </section>}
    {create.isError && <p role="alert" className="mb-4 text-sm text-destructive">{create.error.message}</p>}

    <section hidden={!importOpen} id="outline-import" aria-label="Importar esquema" className="mb-8 space-y-3 rounded-lg bg-muted/40 p-4 sm:p-5">
      <label className="block space-y-2"><span className="text-sm font-medium">Pegar esquema Markdown o TXT</span>
        <textarea aria-label="Texto de esquema para importar" rows={4} className="block w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          placeholder="Después de pegar, puede verificar el nivel del capítulo y las referencias de los personajes." value={importText} disabled={parse.isPending || confirm.isPending}
          onChange={event => { setImportText(event.target.value); setPreview(null); parse.reset(); }} />
      </label>
      <Button variant="outline" disabled={!importText.trim() || parse.isPending || confirm.isPending} onClick={() => parse.mutate()}>
        {parse.isPending ? "Analizando…" : "Analizar y obtener vista previa"}
      </Button>
      {parse.isError && <p role="alert" className="text-sm text-destructive">{parse.error.message}</p>}
      {preview && <OutlineImportPreview key={preview.token} preview={preview} isConfirming={confirm.isPending}
        error={confirm.error} onConfirm={document => confirm.mutate(document)} />}
    </section>

    {query.isLoading && <p role="status" className="py-6 text-sm text-muted-foreground">Esquema de lectura…</p>}
    {query.isError && <p role="alert" className="py-6 text-sm text-destructive">Error al leer la lista de esquemas.<Button size="sm" variant="ghost" onClick={() => void query.refetch()}>Reintentar</Button></p>}
    {projects.length > 0 && <OutlineLibrary projects={projects} />}
  </div>;
}
