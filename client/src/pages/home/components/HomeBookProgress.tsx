import type {NovelBookProgress} from "@ai-novel/shared/types/director/bookProgress";

export default function HomeBookProgress({progress}: {progress: NovelBookProgress}) {
  const {writtenChapters: written, targetChapters: target} = progress;
  const percent = target ? Math.min(100, Math.floor(written / target * 100)) : null;
  return <section className="mt-7" aria-label="Progreso del texto">
    <div className="mb-3 flex items-center justify-between gap-4">
      <div><div className="text-sm font-semibold">Progreso del texto</div>
        <p className="mt-1 text-xs text-muted-foreground">salvado {written} Zhang Zhengwen{target ? `, el objetivo del libro ${target}` : ", puedes ir al escritorio del director para determinar los objetivos del libro."}.</p></div>
      {percent !== null ? <span className="text-lg font-semibold tabular-nums">{percent}%</span> : null}
    </div>
    {percent !== null ? <div className="h-1.5 overflow-hidden rounded-full bg-muted">
      <div className="h-full bg-primary" style={{width: `${percent}%`}} />
    </div> : null}
    <p className="mt-3 text-xs text-muted-foreground">Visite el escritorio del director para ver reseñas de capítulos, alertas de calidad y alcance creativo de seguimiento.</p>
  </section>;
}
