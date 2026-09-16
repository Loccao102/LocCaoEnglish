"use client";

import { useEffect, useState } from "react";
import { FAIR_CHECKPOINT_EVENT, fairCheckpointPrefix, type SavedFairRun } from "@/lib/game/fair-checkpoints";
import { savedFairRuns } from "@/lib/game/fair-continuation";
import { useFairProgress } from "./FairProgressProvider";

export function useFairCheckpoints() {
  const {owner,status}=useFairProgress();
  const [view,setView]=useState<{owner:string;runs:SavedFairRun[]}>({owner:"",runs:[]});
  useEffect(()=>{
    if(status!=="ready"||!owner)return;
    const refresh=()=>setView({owner,runs:savedFairRuns(owner)});
    const storage=(event:StorageEvent)=>{if(event.key===null||event.key.startsWith(fairCheckpointPrefix(owner)))refresh();};
    refresh();window.addEventListener("storage",storage);window.addEventListener(FAIR_CHECKPOINT_EVENT,refresh);
    return()=>{window.removeEventListener("storage",storage);window.removeEventListener(FAIR_CHECKPOINT_EVENT,refresh);};
  },[owner,status]);
  return status==="ready"&&view.owner===owner?view.runs:[];
}
