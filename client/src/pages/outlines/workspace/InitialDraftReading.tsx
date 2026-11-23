import { BeatList } from "./volumeRhythm/BeatList";
import { useState } from "react";
import type { OutlineInitialProposalPayload } from "@/api/outlines";

export function InitialDraftReading({ payload }: { payload: OutlineInitialProposalPayload }) {
  const [location, setLocation] = useState("");
  const { storyFields, chapters, volumes, characters } = payload;
  const locations = [...volumes, ...chapters];
  function showLocation(ref: string) {
    setLocation(ref);
    const element = window.document.getElementById("draft-location-" + ref);
    element?.closest("details")?.setAttribute("open", "");
    element?.focus();
  }
  return <div className="outline-draft-reading">
    <h2>{storyFields.title}</h2><p className="outline-reading-counts">{volumes.length} Volumen · {chapters.length} capítulo · {characters.length} Persona</p>
    <section className="outline-passage"><h3>Ideas de historias</h3><p>{storyFields.premise || storyFields.synopsis}</p></section>
    {storyFields.synopsis && storyFields.synopsis !== storyFields.premise && <section className="outline-passage"><h3>Resumen de la historia</h3><p>{storyFields.synopsis}</p></section>}
    {!!volumes.length && <section className="outline-passage"><h3>Disposición del capítulo</h3>{volumes.map(volume => {
      const inVolume = chapters.filter(ch => ch.volumeRef === volume.clientRef);
      return <div className="outline-volume" key={volume.clientRef} id={"draft-location-" + volume.clientRef} tabIndex={-1}>
        <h4>{volume.title}</h4><p>{volume.summary}</p>
        {volume.beats && <BeatList beats={volume.beats} chapters={inVolume}/>}
        <details><summary>Controlar {inVolume.length} Cap.</summary>{inVolume.map(ch => <div className="outline-chapter" tabIndex={-1}
          id={"draft-location-" + ch.clientRef} data-selected={location === ch.clientRef} key={ch.clientRef}><h4>{ch.title}</h4><p>{ch.summary}</p></div>)}</details>
      </div>;
    })}</section>}
    {!!characters.length && <section className="outline-passage"><h3>Personajes y apariciones</h3>{characters.map(person =>
      <div className="outline-volume" key={person.clientRef}><h4>{person.title}</h4>{person.role && <small>{person.role}</small>}<p>{person.summary}</p>
        {!!person.appearanceRefs?.length && <div>Apareció en {person.appearanceRefs.map(ref => <button key={ref} className="outline-reading-link" onClick={() => showLocation(ref)}>{locations.find(item => item.clientRef === ref)?.title ?? "No se encontró ninguna ubicación"}</button>)}</div>}
      </div>)}</section>}
    {!!(payload.payoffs.length || payload.facts.length || storyFields.endingDirection || storyFields.theme || storyFields.tone) &&
      <details className="outline-volume"><summary>Final, presagio y escenario.</summary>
        {[["Dirección final", storyFields.endingDirection], ["Tema", storyFields.theme], ["Fundamental", storyFields.tone]].map(([label,value]) => value && <p key={label}><b>{label}</b>　{value}</p>)}
        {[...payload.payoffs, ...payload.facts].map(item => <section key={item.clientRef}><h4>{item.title}</h4><p>{item.content || item.summary}</p>
          {item.setupDescription && <p>{item.setupDescription}</p>}{item.payoffDescription && <p>{item.payoffDescription}</p>}</section>)}
      </details>}
  </div>;
}
