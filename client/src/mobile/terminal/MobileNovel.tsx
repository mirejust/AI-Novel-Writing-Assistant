import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { getNovelDetail } from "@/api/novel";
import { Button } from "@/components/ui/button";
import { MobileChapter } from "./MobileChapter";
import { MobileTaskPanel } from "./MobileTaskPanel";

export function MobileNovel({ novelId, chapterId }: { novelId: string; chapterId?: string }) {
  const navigate = useNavigate();
  const query = useQuery({ queryKey: ["mobileNovel", novelId], queryFn: () => getNovelDetail(novelId), refetchInterval: 10000 });
  const novel = query.data?.data;
  if (!novel) return <section>{query.isError ? <><p role="alert">No pude leer la novela.</p><Button onClick={() => void query.refetch()}>Releer</Button></> : <p role="status">Leyendo novela...</p>}</section>;
  const written = novel.chapters.filter(chapter => Boolean(chapter.content?.trim()));
  const selected = chapterId ? novel.chapters.find(chapter => chapter.id === chapterId) : written[written.length - 1] ?? novel.chapters[0];
  return <section className="space-y-5">
    <Button asChild variant="ghost" size="sm"><Link to="/novels">Volver a la lista de novelas</Link></Button>
    <header className="space-y-2"><h1 className="text-xl font-semibold">{novel.title}</h1><p className="text-sm text-muted-foreground">escrito {written.length} / {novel.estimatedChapterCount ?? novel.chapters.length} Capítulo · Planeado {novel.chapters.length} Cap.</p></header>
    <MobileTaskPanel novelId={novelId} version={novel.directorVersion ?? "v1"} />
    <label className="block space-y-2 text-sm"><span>Lista de capítulos y estado</span><select className="w-full rounded-md border bg-background px-3 py-3 text-base" value={selected?.id ?? ""} onChange={event => navigate(`/novels/${encodeURIComponent(novelId)}/chapters/${encodeURIComponent(event.target.value)}`)}>
      {novel.chapters.map(chapter => <option key={chapter.id} value={chapter.id}>Cap. {chapter.order} capítulo · {chapter.title} · {chapter.content?.trim() ? "Legible" : "Pendiente de generar"}</option>)}
    </select></label>
    {chapterId && !selected ? <p role="alert">No se puede encontrar el capítulo, selecciónelo en la tabla de contenido.</p> : null}
    {selected ? <MobileChapter key={selected.id} novelId={novelId} chapter={selected} /> : <p className="text-sm text-muted-foreground">El plan del capítulo se puede ver aquí después de guardarlo.</p>}
  </section>;
}
