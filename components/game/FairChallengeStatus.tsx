"use client";
import { difficultyName } from "@/lib/game/challenge";
import type { FairState, FestivalSession } from "@/lib/game/festival-session";
import styles from "./ColourMixGuide.module.css";

export default function FairChallengeStatus({state,session}:{state:FairState;session:FestivalSession}){
  const c=state.challenge;if(!c)return null;const kind=session.game.kind;
  const hint=["garden","parcel","colour"].includes(kind);
  const recipe=kind==="colour"&&c.hint?session.paintOrder.recipe:[];
  const parts=["Red","Yellow","Blue","White"].map((name,id)=>({name,count:recipe.filter(paint=>paint===id).length})).filter(part=>part.count>0);
  return <div className={`fair-challenge-status ${styles.status}`} aria-label="Challenge rules">
    <span><b>{difficultyName[c.level]}</b>{kind!=="hop"&&` · ${Math.ceil(c.remaining)}s`}</span>
    <span>{c.assists?`${c.assists} assistance · up to ${session.resultStars}★`:"Unassisted"}</span>
    {kind==="bridge"&&<span>{c.moves} / {session.turnBudget} turns</span>}
    {kind==="hop"&&<span>Need {session.feathersRequired} feathers to finish</span>}
    {kind==="garden"&&c.step>0&&<span>Planted · {c.step-1} waterings</span>}
    {kind==="parcel"&&<span>{c.step} / {session.deliveryRoute.length} stops</span>}
    {hint&&<button onClick={()=>session.assist()} disabled={!session.canAct||c.hint}>{c.hint?"Hint opened":kind==="colour"?"Recipe (−1★)":"Recall order (−1★)"}</button>}
    {kind==="colour"&&c.hint&&<p className={styles.recipe} aria-label="Target paint recipe">{parts.map(part=>`${part.count} ${part.name}`).join(" + ")} · {recipe.length} drops</p>}
  </div>;
}
