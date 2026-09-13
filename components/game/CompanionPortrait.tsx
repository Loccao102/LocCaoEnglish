"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { companionById } from "@/lib/game/companions";

export default function CompanionPortrait({ id, className = "", label, style }: {
  id: string; className?: string; label?: string; style?: CSSProperties;
}) {
  const friend=companionById(id),[portrait,setPortrait]=useState<{id:string;src:string}|null>(null);
  useEffect(() => {
    let cancelled=false;
    void import("@/lib/game/three/portraits").then(module=>module.characterPortrait(id)).then(src=>{
      if(!cancelled)setPortrait({id,src});
    }).catch(()=>{});
    return()=>{cancelled=true;};
  },[id]);
  return <span className={`game-art companion-portrait ${className}`} style={style} role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true} data-companion={id}>
    {portrait?.id===id ? <img src={portrait.src} alt="" draggable={false}/> : <span className="portrait-loading" style={{background:friend.design.skin}}>{friend.name.slice(0,1)}</span>}
  </span>;
}
