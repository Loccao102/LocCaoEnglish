"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { companions } from "@/lib/game/catalog";
import { companionById } from "@/lib/game/companions";
import { personalityFor } from "@/lib/game/personalities";
import CharacterPreview from "./CharacterPreview";
import CompanionCollection from "./CompanionCollection";

export default function CharacterShowcase() {
  const [selected,setSelected]=useState("mam");
  const feature=useRef<HTMLElement>(null);
  function select(id: string) { setSelected(id); feature.current?.scrollIntoView({block:"start",behavior:window.matchMedia("(prefers-reduced-motion: reduce)").matches?"instant":"smooth"}); }
  const friend=companionById(selected), personality=personalityFor(selected);
  return <div className="character-studio page-wrap"><header className="character-studio-heading"><div><p className="eyebrow">THE FRIENDS OF SUNLIT VILLAGE</p><h1>Little friends.<br/>Big imaginations.</h1><p>{companions.length} chibi companions, each with a little story and a place to help you learn.</p></div><Link className="button ghost" href="/play">Back to the adventure →</Link></header><section ref={feature} className="character-feature" aria-label="Selected companion" style={{"--friend-tint":friend.design.skin} as React.CSSProperties}><CharacterPreview key={friend.id} id={friend.id}/><div className="character-story"><span className="eyebrow">{friend.family}</span><h2>{friend.name}</h2><p className="character-role">{friend.role}</p><p className="character-trait">{personality.trait}</p><p>{personality.story}</p><dl className="character-personality"><div><dt>Little superpower</dt><dd>{personality.talent}</dd></div><div><dt>Favourite thing</dt><dd>{personality.favourite}</dd></div><div><dt>Big dream</dt><dd>{personality.dream}</dd></div><div><dt>You’ll notice</dt><dd>{personality.habit}</dd></div></dl><blockquote>“{friend.greeting}”</blockquote><Link className="button primary" href={friend.route}>Meet {friend.name} in {friend.activity} →</Link><a className="character-model-link" href={`/assets/sunlit-3d/${friend.id}.glb`} download>Download this animated model ↓</a><p className="character-bag-hint">Choose your travelling companion in the adventure’s Bag. {friend.cost ? `Unlock with ${friend.cost} sun coins.` : "This friend is free to travel with."}</p></div></section><CompanionCollection selected={selected} onSelect={select}/><footer className="character-studio-footer"><p>Every preview is rendered from the same 3D model used in the village. Six body animations, eight facial expressions and a personality of their own.</p><Link className="button primary" href="/festival">Visit the Friendship Fair →</Link><a className="character-model-link" href="/assets/sunlit-3d/character-bible.json" download>Download character stories ↓</a><a className="button ghost" href="/assets/sunlit-3d-pack.zip" download>Download the complete 3D collection ↓</a></footer></div>;
}

