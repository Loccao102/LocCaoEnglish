"use client";
import { difficulties, difficultyName, challengeDescription, type Difficulty } from "@/lib/game/challenge";
import type { FestivalKind } from "@/lib/game/festival";
import type { FairRecord } from "@/lib/game/fair-progress";

export default function FairDifficulty({kind,value,onChange,record}:{kind:FestivalKind;value:Difficulty;onChange:(value:Difficulty)=>void;record?:FairRecord}){
  return <fieldset className="fair-difficulty"><legend>Choose your challenge</legend><div>{difficulties.map(level=><label key={level} data-selected={value===level}><input type="radio" name="fair-difficulty" value={level} checked={value===level} onChange={()=>onChange(level)}/><strong>{difficultyName[level]}</strong><small>{record?.levels?.[level]?`${"★".repeat(record.levels[level]!.stars)} · ${record.levels[level]!.visits} clears`:"Not yet cleared"}</small></label>)}</div><p>{value==="practice"?"Learn the controls at your own pace. Original rounds and free hints.":challengeDescription[kind][value==="expert"?1:0]}</p>{value!=="practice"&&<small>3 hearts. Each assistance costs one result star, down to one star. Pause stops the clock.</small>}</fieldset>;
}
