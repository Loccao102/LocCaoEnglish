"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Cosmetic, equipCosmetic, getProgression, ProgressionState } from "@/lib/api";

export default function WorldMap(){
  const [state,setState]=useState<ProgressionState|null>(null);
  const [error,setError]=useState("");
  const [equipping,setEquipping]=useState("");
  const load=()=>getProgression().then(setState).catch((e)=>setError(e instanceof Error?e.message:"Progression unavailable"));
  useEffect(()=>{void load()},[]);
  const unlocked=useMemo(()=>state?.worlds.filter(w=>w.unlocked).length??0,[state]);
  async function equip(item:Cosmetic){if(!item.unlocked||item.equipped)return;setEquipping(item.id);try{setState(await equipCosmetic(item.id))}catch(e){setError(e instanceof Error?e.message:"Could not equip reward")}finally{setEquipping("")}}
  if(!state)return <section className="panel progression-loading"><span className="eyebrow">WORLD MAP</span><h1>{error?"Progression is offline":"Opening your map…"}</h1><p>{error||"Reading XP, skill evidence and cleared challenges."}</p></section>;
  const pct=Math.min(100,Math.round(state.xpIntoLevel/state.xpForNext*100));
  return <div className="progression-shell">
    <section className="progression-hero"><div><span className="eyebrow light">PLAYER JOURNEY</span><h1>Level {state.level} · {unlocked}/{state.worlds.length} worlds open</h1><p>Your map opens from actual XP, skill evidence, IELTS attempts and boss clears.</p><div className="level-xp"><span>{state.xpIntoLevel}/{state.xpForNext} XP to next level</span><div className="progress large"><i style={{width:`${pct}%`}}/></div></div></div><div className="hero-level-orb"><strong>{state.level}</strong><small>LEVEL</small></div></section>
    <section className="world-path" aria-label="Learning world map">{state.worlds.map((world,index)=><article key={world.id} className={`world-node ${world.unlocked?"open":"locked"}`}><div className="world-connector"/><div className="world-icon">{world.unlocked?world.icon:"⌁"}</div><div className="world-copy"><div><small>WORLD {String(index+1).padStart(2,"0")}</small><span>{world.unlocked?`${world.progress}% explored`:"LOCKED"}</span></div><h2>{world.title}</h2><p>{world.description}</p><div className="progress"><i style={{width:`${world.progress}%`}}/></div>{world.unlocked?<Link href={world.route} className="button primary">Enter world →</Link>:<div className="unlock-rule">🔒 {world.unlockText}</div>}</div></article>)}</section>
    <section className="progression-grid"><article className="panel"><div className="section-heading"><div><span className="eyebrow">TROPHY ROOM</span><h2>Achievements</h2></div><span className="xp-pill">{state.achievements.filter(a=>a.unlocked).length}/{state.achievements.length}</span></div><div className="achievement-list">{state.achievements.map(a=><div className={`achievement ${a.unlocked?"earned":""}`} key={a.id}><span className="achievement-icon">{a.icon}</span><div><strong>{a.title}</strong><p>{a.description}</p><div className="progress"><i style={{width:`${Math.min(100,a.progress/a.target*100)}%`}}/></div><small>{a.progress}/{a.target}{a.rewardCosmetic?` · reward: ${a.rewardCosmetic}`:""}</small></div><b>{a.unlocked?"✓":""}</b></div>)}</div></article>
      <article className="panel"><div className="section-heading"><div><span className="eyebrow">LOADOUT</span><h2>Rewards you can wear</h2></div></div><div className="inventory-grid">{state.inventory.map(item=><button key={item.id} disabled={!item.unlocked||equipping===item.id} onClick={()=>void equip(item)} className={`cosmetic ${item.unlocked?"unlocked":"locked"} ${item.equipped?"equipped":""}`}><span>{item.slot.toUpperCase()}</span><strong>{item.name}</strong><p>{item.description}</p><small>{item.equipped?"EQUIPPED":item.unlocked?equipping===item.id?"Equipping…":"Equip":"Locked"}</small></button>)}</div></article></section>
    <section className="panel boss-gates"><div className="section-heading"><div><span className="eyebrow">BOSS GATES</span><h2>Proof before the fight</h2></div></div>{state.bosses.map(boss=><div className={`boss-gate ${boss.unlocked?"open":"locked"}`} key={boss.id}><div><strong>{boss.title}</strong><p>{boss.cleared?`Cleared · +${boss.rewardXp} XP`:boss.unlocked?"Gate open. The final mission is ready.":"Create real evidence in every checkpoint to open this boss."}</p></div><div className="boss-checkpoints">{boss.checkpoints.map(c=><span key={c.id} className={c.complete?"complete":""}>{c.complete?"✓":"○"} {c.skill}</span>)}</div>{boss.unlocked?<Link href={boss.route} className="button primary">{boss.cleared?"Replay boss":"Fight boss →"}</Link>:<span className="mode-badge warning">LOCKED</span>}</div>)}</section>
  </div>
}
