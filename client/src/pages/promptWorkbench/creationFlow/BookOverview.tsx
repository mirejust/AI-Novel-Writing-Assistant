import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, GitBranch, LibraryBig, Play, Square } from "lucide-react";
import { relatedAtlasLocation, type AtlasLocation } from "./atlas/atlasTopics";
import { locateFlowStep, stages, type FlowStage } from "./flowDefinition";
import { RegisteredAssetReader } from "./atlas/AssetReader";
import { layoutBookMap } from "./overview/bookMapLayout";
import { relationsFor } from "./atlas/stepPromptRelations";
import { PromptConnections } from "./overview/PromptConnections";
import { BookMapCanvas } from "./overview/BookMapCanvas";
import { TourDesk, useBookTour } from "./overview/BookTour";
import { PromptReader } from "./PromptReader";
import "./overview/bookMap.css";

export function BookOverview({ enter, onOpenCatalog, openAtlas }: {
  enter: (stage: FlowStage) => void;
  onOpenCatalog: (prompt: { id: string; version: string }) => void;
  openAtlas: (location: AtlasLocation) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const layout = useMemo(() => layoutBookMap(stages, expanded), [expanded]);
  const [jump, setJump] = useState<{ scope: string } | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [focused, setFocused] = useState(false);
  const root = useRef<HTMLElement>(null);
  const tourTrigger = useRef<HTMLButtonElement>(null);
  const tour = useBookTour(root);
  const readAt = tour.readAt;
  const entry = locateFlowStep(selected);
  const reference = selected ? layout.prompts.get(selected) : undefined;
  const reading = Boolean(entry || reference);
  const inspecting = expanded && reading && relationsFor(selected).length > 0;
  const read = useCallback((id: string) => {
    const target = locateFlowStep(id);
    if (!target) return;
    readAt(id);
    if (target.optional) setExpanded(true);
    setSelected(id);
  }, [readAt]);

  const readReference = useCallback((id: string) => {
    tour.pause();
    setExpanded(true);
    setSelected(id);
  }, [tour.pause]);

  const locateScope = useCallback((scope: string) => {
    tour.pause();
    setFocused(false);
    setSelected(null);
    setExpanded(true);
    setJump({ scope });
  }, [tour.pause]);
  useEffect(() => {
    if (jump) root.current?.querySelector<HTMLButtonElement>(`[data-ref-scope="${jump.scope}"]`)?.focus({ preventScroll: true });
  }, [jump]);

  function closeReader() {
    setSelected(null);
    setFocused(false);
    if (tour.current) return;
    const attribute = reference ? "data-map-prompt" : "data-step";
    requestAnimationFrame(() => root.current?.querySelector<HTMLButtonElement>(`button[${attribute}="${selected}"]`)?.focus({ preventScroll: true }));
  }
  function toggleBranches() {
    tour.pause();
    if (expanded && (entry?.optional || reference)) {
      setSelected(null);
      setFocused(false);
    }
    setExpanded(!expanded);
  }
  function startTour() {
    setSelected(null);
    setFocused(false);
    tour.toggle();
  }
  function closeTour() {
    tour.end();
    setSelected(null);
    setFocused(false);
    requestAnimationFrame(() => tourTrigger.current?.focus({ preventScroll: true }));
  }
  function openPrompts(location: AtlasLocation) {
    tour.pause();
    openAtlas(location);
  }
  const openScope = useCallback((scope: string) => {
    tour.pause();
    openAtlas({ scope });
  }, [openAtlas, tour.pause]);

  return <section ref={root} className="book-atlas" aria-labelledby="atlas-title">
    <header className="atlas-masthead">
      <div><h2 id="atlas-title">Desde abrir el libro hasta<span>Manuscrito terminado</span></h2>
        <p>{expanded ? "Lea la línea principal a lo largo de las cinco etapas. A la izquierda hay herramientas de creación independientes y puede hacer clic en las indicaciones relevantes en cada etapa." : "Lea la línea principal a lo largo de las cinco etapas y expanda las ramas para ver los pasos auxiliares y las palabras clave relacionadas."}</p></div>
      <div className="atlas-actions">
        <button type="button" ref={tourTrigger} className="atlas-play" onClick={tour.current ? (reading ? closeReader : closeTour) : startTour}>
          {tour.current ? <Square size={12} /> : <Play size={14} fill="currentColor" />}
          {tour.current ? (reading ? "Volver al recorrido" : "Salir del recorrido") : "Reproducir línea principal"}</button>
        <button type="button" className="atlas-branches" aria-pressed={expanded} onClick={toggleBranches}>
          <GitBranch size={15} />{expanded ? "Cerrar sucursal" : "Expandir sucursal"}</button>
        <button type="button" className="atlas-shortcut" onClick={() => read("draft")}>Ver indicaciones de escritura de texto<ArrowRight size={14} /></button>
        <button type="button" className="atlas-shortcut" onClick={() => locateScope("tools")}><LibraryBig size={15} />Herramientas creativas independientes</button>
      </div>
    </header>
    <div className={`book-atlas-spread ${reading ? "reading" : ""} ${focused ? "focused" : ""} ${inspecting ? "inspecting" : ""}`}>
      <div className="book-map-pane">
        <BookMapCanvas layout={layout} selected={selected} touring={reading ? null : tour.current?.step.id ?? null} enter={enter} jump={jump}
          locateScope={locateScope} openScope={openScope} readReference={readReference} read={read} pause={tour.pause} />
        {tour.current && !reading ? <TourDesk tour={tour} read={read} /> : <footer className="book-map-key" aria-label="Leyenda del cableado">
          <span><i />Proceso principal</span>
          {expanded && <span><i className="key-branch" />Rama opcional</span>}
          {expanded && <span><i className="key-reference" />Pasos y indicaciones</span>}
          <span><i className="key-return" />Ciclo capítulo por capítulo, volumen por volumen</span>
          <small>Arrastre y desplácese · Haga clic en los pasos o solicite palabras para rastrear la conexión</small>
        </footer>}
      </div>
      {entry && <div data-stage={entry.stage.id} className="book-map-reader">
        <PromptReader key={entry.step.id} step={entry.step} stageTitle={entry.stage.title} next={entry.next}
          openRelated={() => openPrompts(relatedAtlasLocation(entry.stage.id, entry.step.id))}
          go={read} onOpenCatalog={onOpenCatalog} focused={focused} toggleFocus={() => setFocused(value => !value)} backToMap={closeReader}>
          <PromptConnections id={entry.step.id} open={readReference} />
        </PromptReader>
      </div>}
      {reference && <div data-stage={reference.scope} className="book-map-reader">
        <RegisteredAssetReader key={reference.id} id={reference.id} title={reference.title} topicTitle={reference.topic.title}
          focused={focused} toggleFocus={() => setFocused(value => !value)} backToMap={closeReader} onOpenCatalog={onOpenCatalog}>
          <PromptConnections id={reference.id} open={read} />
        </RegisteredAssetReader>
      </div>}
    </div>
  </section>;
}
