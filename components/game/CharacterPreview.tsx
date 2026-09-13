"use client";

import { useEffect, useRef, useState } from "react";
import type { Pose } from "@/lib/game/three/characters";
import type { ModelPreview } from "@/lib/game/three/model-preview";

export default function CharacterPreview({ id }: { id: string }) {
  const host=useRef<HTMLDivElement>(null),model=useRef<ModelPreview|null>(null);
  const [pose,setPose]=useState<Pose>("idle"),[error,setError]=useState(false);
  useEffect(()=>{
    let cancelled=false;let instance:ModelPreview|null=null;setError(false);setPose("idle");
    void import("@/lib/game/three/model-preview").then(({ModelPreview})=>{
      if(cancelled||!host.current)return;instance=new ModelPreview(host.current,id);model.current=instance;
    }).catch(()=>{if(!cancelled)setError(true);});
    return()=>{cancelled=true;instance?.dispose();model.current=null;};
  },[id]);
  return <div className="character-preview"><div ref={host} className="character-preview-canvas"/>{error&&<p className="preview-error" role="status">Enable browser hardware acceleration to see this friend in 3D.</p>}<div className="character-turn"><button aria-label="Turn character left" onClick={()=>model.current?.turn(-1)}>↶</button><span>Drag to turn</span><button aria-label="Turn character right" onClick={()=>model.current?.turn(1)}>↷</button></div><div className="character-poses" role="group" aria-label="Preview animations">{(["idle","walk","run","jump","wave","celebrate"] as Pose[]).map(action=><button key={action} aria-pressed={pose===action} onClick={()=>{setPose(action);model.current?.setPose(action);}}>{action}</button>)}</div></div>;
}
