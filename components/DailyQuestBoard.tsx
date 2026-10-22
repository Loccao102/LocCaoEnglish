"use client";

import Link from "next/link";
import GameArt from "./GameArt";
import useSignedInToken from "./learning/useSignedInToken";
import useDailyPractice from "./learning/useDailyPractice";
import styles from "./DailyQuestBoard.module.css";

export default function DailyQuestBoard(){
 const token=useSignedInToken();
 if(token===null)return <article className="panel quest-card"><h2>Loading daily practice…</h2></article>;
 if(!token)return <article className={`panel quest-card ${styles.board}`} aria-label="Daily practice"><h2>Your daily practice chest</h2><p>Sign in for a saved daily checklist and personal reward. Guest practice stays separate.</p><Link className="button primary" href="/account">Sign in for daily practice</Link></article>;
 return <AccountDaily key={token} token={token}/>;
}
function AccountDaily({token}:{token:string}){
 const state=useDailyPractice(token),run=state.run;
 const pct=run?.total?Math.round(run.completed/run.total*100):0;
 return <article className={`panel quest-card daily-chain ${styles.board}`} aria-label="Daily practice">
  <div className="section-heading"><div><span className="eyebrow">SAVED DAILY PRACTICE{run?` · ${run.date} · UTC+7`:""}</span><h2>{!run?"Loading your saved plan…":run.claimed?"Chest claimed":run.claimable?"Reward chest unlocked":`${run.completed}/${run.total} activities finished`}</h2></div>
   <GameArt id={run?.claimed||run?.claimable?"chest-open":"chest-closed"} className="daily-reward-art" label={`Daily chest · ${run?.claimed?"claimed":run?.claimable?"ready":"locked"}`}/></div>
  {run&&<>
   <p>Today's checklist stays fixed. Finish one checked round in each activity today; valid mistakes count as practice too.</p>
   <div className="progress large"><i style={{width:`${pct}%`}}/></div>
   <div className="quest-list">{run.quests.map((q,i)=><Link href={q.route} className={`quest daily-quest ${q.complete?"done":""}`} key={q.id}><span className="check">{q.complete?"✓":i+1}</span><span><strong>{q.title}</strong><small>{q.skill}</small></span><small>{q.complete?"Finished today":"One round"}</small></Link>)}</div>
   <p>Personal chest: +{run.chestXp} XP once per day. Activity XP follows its own rules. Chest XP is excluded from checked-practice rank.</p>
   {run.claimed?<div className="daily-chest claimed"><strong>{run.receipt?.legacy?"Earlier personal reward retained · original evidence unavailable":"Reward banked"}</strong></div>:<button className="button primary wide" disabled={!run.claimable||state.busy||!!state.pending||state.corrupt} onClick={()=>void state.claim()}>Open daily chest · +{run.chestXp} XP</button>}
  </>}
  <div className={styles.actions}>
   {state.needsSignIn&&<Link className="button primary" href="/account">Sign in again</Link>}
   <button className="button ghost" disabled={state.busy} onClick={()=>void state.refresh()}>Refresh saved status</button>
   {state.pending&&<button className="button primary" disabled={state.busy||state.corrupt} onClick={()=>void state.claim()}>Retry saved claim · {state.pending.date}</button>}
   {(state.pending||state.corrupt)&&<button className="button ghost" disabled={state.busy} onClick={state.leave}>Leave local claim reference</button>}
  </div>
  {state.busy&&<p role="status">Checking your saved daily record…</p>}
  {state.recovered&&<p role="status">Confirmed reward for {state.recovered.date}: {state.recovered.rewardXp} personal XP.{state.recovered.legacy?" Earlier evidence is unavailable.":""}</p>}
  {state.warning&&<p role="status">{state.warning}</p>}{state.error&&<p role="alert">{state.error}</p>}
 </article>;
}
