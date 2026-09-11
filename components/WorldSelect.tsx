"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getProgression, WorldState } from "@/lib/api";

export default function WorldSelect(){
  const[worlds,setWorlds]=useState<WorldState[]>([]);
  useEffect(()=>{getProgression().then(state=>setWorlds(state.worlds.filter(world=>world.id!=="training"))).catch(()=>{})},[]);
  if(!worlds.length)return <div className="quick-games"><Link className="quick-game" href="/worlds"><span>◫</span><div><small>WORLD MAP</small><strong>Load your worlds</strong><small>Open the live progression map.</small></div><b>→</b></Link></div>;
  return <div className="quick-games">{worlds.map(world=>world.unlocked?<Link className="quick-game" href={world.route} key={world.id}><span>{world.icon}</span><div><small>{world.progress}% EXPLORED</small><strong>{world.title}</strong><small>{world.description}</small></div><b>→</b></Link>:<div className="quick-game world-locked" key={world.id}><span>⌁</span><div><small>LOCKED</small><strong>{world.title}</strong><small>{world.unlockText}</small></div><b>🔒</b></div>)}</div>;
}
