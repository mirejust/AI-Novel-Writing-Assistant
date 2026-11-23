import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { getNovelList } from "@/api/novel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function MobileShelf() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const query = useQuery({ queryKey: ["mobileShelf", page, search], queryFn: () => getNovelList({ page, limit: 20, search }), refetchInterval: 10000 });
  const data = query.data?.data;
  return <section className="space-y-4">
    <h1 className="text-xl font-semibold">Mi novela</h1>
    <p className="text-sm text-muted-foreground">Comprueba tu progreso, lee un capítulo o continúa con el libro. La apertura del libro y la planificación de datos deben completarse en la computadora.</p>
    <Input aria-label="Buscar novelas" placeholder="Buscar novelas" value={search} onChange={event => { setSearch(event.target.value); setPage(1); }} />
    {query.isError ? <p role="alert">No pude leer la novela.<Button variant="ghost" onClick={() => void query.refetch()}>Releer</Button></p> : null}
    {query.isPending ? <p role="status">Leyendo novela...</p> : null}
    <div className="divide-y">{data?.items.map(novel => <Link className="block space-y-2 py-4" key={novel.id} to={`/novels/${encodeURIComponent(novel.id)}/edit`}>
      <h2 className="font-medium">{novel.title}</h2>
      <p className="text-sm text-muted-foreground">escrito {novel.bookProgress?.writtenChapters ?? 0} / {novel.bookProgress?.targetChapters ?? novel.estimatedChapterCount ?? novel._count.chapters} Capítulo · Planeado {novel._count.chapters} Cap.</p>
      {novel.latestAutoDirectorTask?.currentItemLabel ? <p className="text-sm">{novel.latestAutoDirectorTask.currentItemLabel}</p> : null}
    </Link>)}</div>
    {data && data.total === 0 ? <p className="py-6 text-sm text-muted-foreground">Aún no hay novela. Continúe desde aquí después de crearlo en la computadora.</p> : null}
    {data && data.totalPages > 1 ? <div className="flex items-center justify-between"><Button variant="outline" disabled={page === 1} onClick={() => setPage(page - 1)}>Pagina anterior</Button><span className="text-sm">{page} / {data.totalPages}</span><Button variant="outline" disabled={page >= data.totalPages} onClick={() => setPage(page + 1)}>Página siguiente</Button></div> : null}
  </section>;
}
