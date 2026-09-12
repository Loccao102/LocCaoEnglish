"use client";

import Link from "next/link";
import { useState } from "react";
import type { WorldState } from "@/lib/api";
import { villageDecor, villagePlaces, worldArt } from "@/data/village";
import GameArt from "./GameArt";

export default function VillageMap({ worlds, live }: { worlds: WorldState[]; live: boolean }) {
  const [selectedId, setSelectedId] = useState("training");
  const selected = worlds.find(world => world.id === selectedId) ?? worlds[0];
  const guide = villagePlaces.find(place => place.id === selected?.id)?.guide ?? "mam";
  return <section className="village" aria-labelledby="village-title">
    <div className="village-heading"><div><span className="eyebrow">LÀNG NẮNG · SUNLIT VILLAGE</span><h2 id="village-title">A little world. A new word every day.</h2></div><span className="village-season"><i /> A good day to grow</span></div>
    <p className="village-mobile-hint">Swipe across the map to find every world →</p>
    <div className="village-scroll" tabIndex={0} role="region" aria-label="Village map. Scroll horizontally on small screens to explore all destinations.">
      <div className="village-canvas">
        <img className="village-terrain" src="/assets/sunlit-village/village-map.svg" width="1200" height="820" alt="" fetchPriority="high" />
        <span className="village-water-label">THE LITTLE WORD LAGOON</span>
        {villageDecor.map(([id, x, y, size], index) => <GameArt key={`${id}-${index}`} id={id} className="village-decoration" style={{ left: `${x}%`, top: `${y}%`, width: `${size}%` }} />)}
        {worlds.map(world => {
          const place = villagePlaces.find(item => item.id === world.id);
          if (!place) return null;
          const status = live ? world.unlocked ? "open" : "locked" : "preview";
          return <button type="button" key={world.id} className={`village-stop ${status} ${selected?.id === world.id ? "selected" : ""}`}
            style={{ left: `${place.x}%`, top: `${place.y}%` }} onClick={() => setSelectedId(world.id)}
            aria-pressed={selected?.id === world.id} aria-controls="village-destination"
            aria-label={`${world.title}, ${live ? world.unlocked ? `${world.progress}% explored` : `locked: ${world.unlockText}` : "preview"}`}>
            <GameArt id={worldArt(world.id)} className="village-building" />
            <span className="village-place-label"><span className="village-status-icon" aria-hidden="true">{status === "open" ? "●" : status === "locked" ? "◇" : "○"}</span>{world.title}</span>
          </button>;
        })}
      </div>
    </div>
    <div className="village-map-footer"><span>Select a place to plan your next adventure.</span><span className="village-legend">{live ? <><span>● Open</span><span>◇ Locked</span></> : "World preview · progress not connected"}</span></div>
    {selected && <div className="village-destination" id="village-destination" aria-live="polite">
      <GameArt id={guide} className="village-guide" />
      <div className="village-destination-copy"><span className="eyebrow">YOUR NEXT DESTINATION</span><h3>{selected.title}</h3><p>{selected.description}</p>{live && !selected.unlocked && <small className="village-lock-copy">Locked · {selected.unlockText}</small>}{live && selected.unlocked && <small>{selected.progress}% explored</small>}</div>
      {live && selected.unlocked ? <Link className="button primary" href={selected.route}>Explore this world <span aria-hidden="true">↗</span></Link> : live ? <span className="village-locked-note">Keep growing to unlock</span> : <Link className="button ghost" href="/account">Connect your progress →</Link>}
    </div>}
  </section>;
}
