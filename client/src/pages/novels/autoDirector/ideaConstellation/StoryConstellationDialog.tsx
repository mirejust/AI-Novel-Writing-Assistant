import { useEffect, useRef, useState } from "react";
import type {
  DirectorIdeaConstellationOption, DirectorIdeaConstellationSelection,
} from "@ai-novel/shared/types/novelDirector";
import { ArrowRight, Bookmark, Check, ChevronDown, Loader2, RotateCcw, SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AppDialogContent, Dialog } from "@/components/ui/dialog";
import {
  IDEA_CONSTELLATION_CATEGORY_LABELS,
  selectRotatingFoundationOptions, toggleIdeaConstellationSelection, toIdeaConstellationSelection,
  type FoundationConstellationOption,
} from "./ideaConstellationState";
import StoryStarChart from "./StoryStarChart";
import "./storyAtlas.css";

interface StoryConstellationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  options: DirectorIdeaConstellationOption[];
  genreOptions: FoundationConstellationOption[];
  storyModeOptions: FoundationConstellationOption[];
  selectedGenreId: string;
  selectedStoryModeId: string;
  isUpdatingFoundation: boolean;
  isGenerating: boolean;
  isComposing: boolean;
  onGenerate: () => void;
  onSelectGenre: (genreId: string) => Promise<boolean>;
  onSelectStoryMode: (storyModeId: string) => Promise<boolean>;
  onCompose: (selected: DirectorIdeaConstellationSelection[]) => Promise<string>;
  onUseIdea: (idea: string) => void;
}

function DirectionField({ label, choices, value, disabled, onChange }: {
  label: string; choices: FoundationConstellationOption[]; value: string; disabled: boolean;
  onChange: (id: string) => Promise<boolean>;
}) {
  const choice = choices.find((item) => item.id === value);
  return (
    <label className="atlas-direction">
      <span>{label}</span>
      <span className="atlas-select">
        <select value={value} disabled={disabled || !choices.length} title={choice?.hint}
          onChange={(event) => void onChange(event.target.value)}>
          <option value="">Emparejamiento automático de IA</option>
          {choices.map((item) => <option key={item.id} value={item.id} title={item.hint}>{item.label}</option>)}
        </select>
        <ChevronDown size={15} aria-hidden="true" />
      </span>
    </label>
  );
}

export default function StoryConstellationDialog({
  open, onOpenChange, options, genreOptions, storyModeOptions, selectedGenreId, selectedStoryModeId,
  isUpdatingFoundation, isGenerating, isComposing, onGenerate, onSelectGenre, onSelectStoryMode, onCompose, onUseIdea,
}: StoryConstellationDialogProps) {
  const [selected, setSelected] = useState<DirectorIdeaConstellationSelection[]>([]);
  const [inspectedId, setInspectedId] = useState("");
  const [foundationPage, setFoundationPage] = useState(0);
  const [menu, setMenu] = useState<"directions" | "saved" | null>(null);
  const [compositionConflict, setCompositionConflict] = useState("");
  const titleRef = useRef<HTMLHeadingElement>(null);
  const preferencesRef = useRef<HTMLButtonElement>(null);
  const savedRef = useRef<HTMLButtonElement>(null);
  const busy = isGenerating || isComposing || isUpdatingFoundation;
  const visible = options.find((item) => item.id === inspectedId)
    ?? options.find((item) => item.relevance === "high") ?? options[0];
  const savedInCategory = selected.find((item) => item.category === visible?.category);
  const isSaved = Boolean(visible && savedInCategory?.id === visible.id);

  useEffect(() => {
    setSelected([]);
    setInspectedId("");
    setMenu(null);
  }, [options]);

  useEffect(() => { setCompositionConflict(""); }, [selected, selectedGenreId, selectedStoryModeId]);

  function closeDialog(next: boolean) {
    if (isComposing && !next) return;
    setMenu(null);
    onOpenChange(next);
  }

  async function compose() {
    if (!visible || busy) return;
    setCompositionConflict("");
    const inspirations = selected.length ? selected : [toIdeaConstellationSelection(visible)];
    try {
      const idea = (await onCompose(inspirations)).trim();
      if (idea) {
        onUseIdea(idea);
        setMenu(null);
        onOpenChange(false);
      }
    } catch (error) {
      if (error instanceof Error && "status" in error && error.status === 422) {
        setCompositionConflict(error.message);
      }
    }
  }

  return (
    <Dialog open={open} onOpenChange={closeDialog}>
      <AppDialogContent title="Gráfico de estrellas de la historia" description="Haga clic en una estrella, lea su inspiración y luego decida si desea usarla para abrir un libro."
        className="story-atlas" headerClassName="sr-only" bodyClassName="atlas-body"
        onOpenAutoFocus={(event) => { event.preventDefault(); titleRef.current?.focus(); }}
        onEscapeKeyDown={(event) => {
          if (menu) {
            event.preventDefault();
            (menu === "directions" ? preferencesRef : savedRef).current?.focus();
            setMenu(null);
          }
        }}>
        <div className="sky-workspace">
          <header className="sky-top">
            <div><h2 ref={titleRef} tabIndex={-1}>Gráfico de estrellas de la historia</h2><p>Cada estrella es una inspiración. Haga clic en uno y vea qué sucede.</p></div>
            <div className="sky-tools">
              <div className="sky-menu-wrap" onBlur={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget)) setMenu((value) => value === "directions" ? null : value);
              }}>
                <button className="sky-tool" type="button" ref={preferencesRef} aria-expanded={menu === "directions"}
                  onClick={() => setMenu(menu === "directions" ? null : "directions")}>
                  <SlidersHorizontal size={15} />Preferencias creativas
                </button>
                {menu === "directions" && <div className="sky-menu sky-directions">
                  <DirectionField label="Tipo de historia" choices={selectRotatingFoundationOptions(genreOptions, foundationPage, selectedGenreId, 8)}
                    value={selectedGenreId} disabled={busy} onChange={onSelectGenre} />
                  <DirectionField label="Método de propulsión" choices={selectRotatingFoundationOptions(storyModeOptions, foundationPage, selectedStoryModeId, 8)}
                    value={selectedStoryModeId} disabled={busy} onChange={onSelectStoryMode} />
                </div>}
              </div>
              <button className="sky-tool" type="button" disabled={busy} onClick={() => { setFoundationPage((page) => page + 1); onGenerate(); }}>
                {isGenerating ? <Loader2 size={15} className="motion-safe:animate-spin" /> : <RotateCcw size={15} />}Cambiar un grupo
              </button>
            </div>
          </header>

          {!isGenerating && visible ? (
            <StoryStarChart options={options} inspectedId={visible.id} selected={selected} disabled={isComposing}
              onInspect={(id) => { setInspectedId(id); setMenu(null); if (!selected.length) setCompositionConflict(""); }} />
          ) : (
            <div className="sky-message" role="status">
              {isGenerating && <Loader2 className="motion-safe:animate-spin" size={22} />}
              <h3>{isGenerating ? "Buscando inspiración…" : "Este cielo estrellado no tiene inspiración por el momento."}</h3>
              <p>{isGenerating ? "La IA combina tus ideas y preferencias creativas." : "Puede intentarlo nuevamente utilizando sus preferencias de creación actuales."}</p>
              {!isGenerating && <button className="sky-tool" onClick={onGenerate}>Regenerar</button>}
            </div>
          )}

          {!isGenerating && visible && (
            <section className="sky-inspector" aria-label="Ver inspiración">
              <div className="sky-inspiration" aria-live="polite" aria-atomic="true">
                <span className="sky-category">{IDEA_CONSTELLATION_CATEGORY_LABELS[visible.category]}</span>
                <h3>{visible.label}</h3><p>{visible.hint}</p>
                {compositionConflict && <p className="sky-conflict" role="alert">{compositionConflict}</p>}
              </div>
              <button className="sky-bookmark" type="button" disabled={busy} aria-pressed={isSaved}
                onClick={() => setSelected((previous) => toggleIdeaConstellationSelection(previous, visible))}>
                {isSaved ? <Check size={16} /> : <Bookmark size={16} />}
                {isSaved ? "Cancelar aceptación" : savedInCategory ? `Reemplazar seleccionado${IDEA_CONSTELLATION_CATEGORY_LABELS[visible.category]}` : "Toma esta estrella"}
              </button>
            </section>
          )}
          <footer className="sky-bottom">
            <div className="sky-menu-wrap" onBlur={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget)) setMenu((value) => value === "saved" ? null : value);
            }}>
              <button className="sky-tool sky-saved" ref={savedRef} type="button" disabled={!selected.length}
                aria-expanded={menu === "saved"} onClick={() => setMenu(menu === "saved" ? null : "saved")}>
                <Bookmark size={15} />Recibió {selected.length} Estrellas{selected.length > 0 && <ChevronDown size={14} />}
              </button>
              {menu === "saved" && selected.length > 0 && <ul className="sky-menu sky-saved-list" aria-label="Inspiración recibida">
                {selected.map((item) => <li key={item.id}>
                  <button type="button" onClick={() => { setInspectedId(item.id); setMenu(null); savedRef.current?.focus(); }}>{item.label}</button>
                  <button type="button" aria-label={`Eliminar${item.label}`} disabled={busy}
                    onClick={() => { setSelected((items) => items.filter((choice) => choice.id !== item.id)); if (selected.length === 1) setMenu(null); }}>
                    <X size={15} />
                  </button>
                </li>)}
              </ul>}
            </div>
            <div className="sky-actions">
              <button type="button" className="sky-tool sky-return" onClick={() => closeDialog(false)} disabled={isComposing}>Volver</button>
              <Button size="sm" type="button" onClick={() => void compose()} disabled={busy || !visible} className="sky-primary">
                {isComposing ? "Pensando en ello..." : selected.length ? `Usar seleccionado ${selected.length} Libro abierto de estrellas` : "Abre un libro de esta estrella."}
                {isComposing ? <Loader2 size={15} className="motion-safe:animate-spin" /> : <ArrowRight size={15} />}
              </Button>
            </div>
          </footer>
        </div>
      </AppDialogContent>
    </Dialog>
  );
}
