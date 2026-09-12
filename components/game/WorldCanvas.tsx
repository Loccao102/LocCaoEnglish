"use client";

import { useEffect, useRef, useState, type MutableRefObject } from "react";
import type { VillageRenderer, RenderState } from "@/lib/game/three/renderer";
import type { Discovery, FieldChest } from "@/lib/game/discoveries";

export default function WorldCanvas({ state, api, onCollect, onChest, onNearbyChest, onReady }: {
  state: RenderState; api: MutableRefObject<VillageRenderer | null>; onCollect: (word: Discovery) => void;
  onChest: (chest: FieldChest) => void; onNearbyChest: (chest: FieldChest | null) => void; onReady: (ready: boolean) => void;
}) {
  const host=useRef<HTMLDivElement>(null),latest=useRef({state,onCollect,onChest,onNearbyChest,onReady});
  latest.current={state,onCollect,onChest,onNearbyChest,onReady};
  const [error,setError]=useState(""),[loading,setLoading]=useState(true),[revision,setRevision]=useState(0);
  useEffect(()=>{
    let cancelled=false,instance:VillageRenderer|null=null;setLoading(true);setError("");latest.current.onReady(false);
    void import("@/lib/game/three/renderer").then(({VillageRenderer})=>{
      if(cancelled||!host.current)return;
      instance=new VillageRenderer(host.current,{state:()=>latest.current.state,onCollect:word=>latest.current.onCollect(word),onChest:chest=>latest.current.onChest(chest),onNearbyChest:chest=>latest.current.onNearbyChest(chest),onError:message=>{setError(message);latest.current.onReady(false);}});
      api.current=instance;setLoading(false);latest.current.onReady(true);
    }).catch(()=>{if(!cancelled){setLoading(false);setError("The 3D world could not open. Enable hardware acceleration in your browser, then reload the world.");latest.current.onReady(false);}});
    return()=>{cancelled=true;instance?.dispose();api.current=null;};
  },[api,revision]);
  return <><div ref={host} className="world-canvas"/>{loading&&<div className="world-render-status" role="status">Building the little world…</div>}{error&&<div className="world-render-error" role="alert"><strong>The village needs its 3D view.</strong><p>{error}</p><button className="game-button" onClick={()=>setRevision(value=>value+1)}>Reload world</button></div>}</>;
}
