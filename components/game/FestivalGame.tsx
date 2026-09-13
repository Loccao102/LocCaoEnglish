"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { companionById } from "@/lib/game/companions";
import { type FestivalGame as GameDefinition } from "@/lib/game/festival";
import { FestivalSession, type FairState } from "@/lib/game/festival-session";
import type { FestivalArena } from "@/lib/game/three/festival-arena";
import CompanionPortrait from "./CompanionPortrait";
import {useFairProgress} from "./FairProgressProvider";
import FairSaveStatus from "./FairSaveStatus";
import type {FairRun} from "@/lib/game/fair-progress";
import GameDialog from "./GameDialog";

export default function FestivalGame({game}:{game:GameDefinition}) {
  const progress=useFairProgress(),runRef=useRef<FairRun|null>(null);
  const [saveMessage,setSaveMessage]=useState(""),[saving,setSaving]=useState(false),[saveFailed,setSaveFailed]=useState(false);
  const host=useRef<HTMLDivElement>(null),arena=useRef<FestivalArena|null>(null),session=useRef<FestivalSession|null>(null),recorded=useRef(false);
  const [state,setState]=useState<FairState|null>(null),[ready,setReady]=useState(false),[paused,setPaused]=useState(false),[help,setHelp]=useState(false),[error,setError]=useState(""),[warning,setWarning]=useState(""),[sound,setSound]=useState(true);
  const friend=companionById(game.host);
  useEffect(()=>{
    let cancelled=false,instance:FestivalArena|null=null;const run=new FestivalSession(game,setState);session.current=run;
    void import("@/lib/game/three/festival-arena").then(({FestivalArena})=>{if(cancelled||!host.current)return;instance=new FestivalArena(host.current,run,setError);arena.current=instance;setReady(true);}).catch(()=>{if(!cancelled)setError("The 3D playfield could not open. Enable hardware acceleration and reopen the game.");});
    return()=>{cancelled=true;instance?.dispose();arena.current=null;session.current=null;};
  },[game]);
  const phase=state?.phase||"ready",overlay=paused||help||phase!=="play"||!!error;
  useEffect(()=>{arena.current?.setPaused(paused||help||!!error);},[paused,help,error]);
  useEffect(()=>{if(arena.current)arena.current.sound=sound;},[sound,ready]);
  useEffect(()=>{
    const blur=()=>{if(session.current?.state.phase==="play"){arena.current?.setPaused(true);setPaused(true);}};
    const visibility=()=>{if(document.hidden)blur();};
    const key=(event:KeyboardEvent)=>{if(event.key==="Escape"&&session.current?.state.phase==="play"){event.preventDefault();if(help)setHelp(false);else setPaused(value=>!value);}};
    window.addEventListener("blur",blur);document.addEventListener("visibilitychange",visibility);window.addEventListener("keydown",key);
    return()=>{window.removeEventListener("blur",blur);document.removeEventListener("visibilitychange",visibility);window.removeEventListener("keydown",key);};
  },[help]);
  useEffect(()=>{
    if(state?.phase!=="win"||recorded.current)return;recorded.current=true;
    void saveResult();
  },[state?.phase,game.id]);
  async function saveResult(){
    if(!runRef.current||!session.current)return;
    setSaving(true);setSaveFailed(false);setSaveMessage("Saving your friendship memory…");
    try{setSaveMessage(await progress.complete(runRef.current,session.current.state.hearts));setWarning("");}
    catch(cause){setSaveFailed(true);setSaveMessage("");setWarning(cause instanceof Error?cause.message:"Your memory could not be saved. Keep this game open and retry.");}
    finally{setSaving(false);}
  }
  function start(){try{runRef.current=progress.begin(game.id);}catch(cause){setWarning(cause instanceof Error?cause.message:"Please open your scrapbook first.");return;}recorded.current=false;setWarning("");setSaveMessage("");setSaveFailed(false);setPaused(false);setHelp(false);arena.current?.unlock();arena.current?.reset();session.current?.start();}
  const actions=session.current?.objects()||[];
  return <div className="fair-game" style={{"--fair-colour":game.colour} as React.CSSProperties}>
    <div ref={host} className="fair-canvas" inert={overlay}/>
    <div className="fair-game-ui" inert={overlay}>
      <header className="fair-hud"><Link href="/festival" className="fair-back" aria-label="Leave game and return to the fair">← Fair</Link><div><span>{friend.name}’S LITTLE ADVENTURE</span><h1>{game.name}</h1></div><div className="fair-hearts" aria-label={`${state?.hearts??3} hearts`}>{"♥".repeat(state?.hearts??3)}<small>{state?.score||0} pts</small></div><button onClick={()=>setSound(value=>!value)} aria-label={sound?"Mute sounds":"Enable sounds"} aria-pressed={sound}>♪</button><button onClick={()=>setPaused(true)} aria-label="Pause game">Ⅱ</button></header>
      <div className="fair-objective"><span>ROUND {Math.min((state?.round||0)+1,game.rounds)} / {game.rounds}</span><strong>{state?.prompt||game.description}</strong><div className="fair-progress" aria-hidden="true">{Array.from({length:game.rounds},(_,i)=><i key={i} data-complete={i<(state?.round||0)}/>)}</div></div>
      <div className="fair-feedback" role="status" aria-live="polite">{state?.feedback|| (state?.listening?"Listen and watch the stones…":"Take your time. Your friend is here to help.")}</div>
      <div className="fair-bottom"><button className="fair-help" onClick={()=>setHelp(true)}>? How to play</button>{session.current?.mobile?<><p>WASD / arrows · click to walk{game.kind==="hop"?" · Space to jump":""}</p><div className="fair-dpad" role="group" aria-label="Movement controls">{[{label:"Up",x:0,z:-1,icon:"↑"},{label:"Left",x:-1,z:0,icon:"←"},{label:"Down",x:0,z:1,icon:"↓"},{label:"Right",x:1,z:0,icon:"→"}].map((direction,i)=><button key={direction.label} className={`fair-dir-${i}`} aria-label={`Move ${direction.label.toLowerCase()}`} onPointerDown={event=>{event.preventDefault();event.currentTarget.setPointerCapture(event.pointerId);arena.current?.move(direction.x,direction.z);}} onPointerUp={()=>arena.current?.move(0,0)} onPointerCancel={()=>arena.current?.move(0,0)} onLostPointerCapture={()=>arena.current?.move(0,0)}>{direction.icon}</button>)}</div>{game.kind==="hop"&&<button className="fair-jump" onClick={()=>arena.current?.jump()}>Jump ↟</button>}</>:<div className="fair-choice-bar" role="group" aria-label="Playfield choices">{actions.map(action=><button key={action.id} disabled={!session.current?.canAct} onClick={()=>{arena.current?.unlock();session.current?.choose(action.id);}} aria-pressed={state?.selection.includes(action.id)||state?.lit===action.id}><kbd>{action.id+1}</kbd>{game.kind==="bridge"?`Tile ${action.id+1} ↻`:action.label}</button>)}</div>}
      </div>
      {["tea","colour","bridge","echo"].includes(game.kind)&&<div className="fair-recipe-controls">{game.kind==="echo"?<button onClick={()=>session.current?.replay()} disabled={state?.listening||!session.current?.canAct}>↺ Hear it again</button>:<><button className="fair-submit" onClick={()=>session.current?.submit()} disabled={!session.current?.canAct}>{game.kind==="tea"?"Serve tea →":game.kind==="colour"?"Mix paint →":"Send boat →"}</button>{game.kind!=="bridge"&&<button onClick={()=>session.current?.clear()} disabled={!session.current?.canAct}>{game.kind==="tea"?"Empty cup":"Clear palette"}</button>}</>}</div>}
    </div>
    {phase==="ready"&&!error&&<GameDialog title={game.name} className="fair-dialog"><CompanionPortrait id={game.host}/><p className="fair-trait">WITH {friend.name.toLocaleUpperCase("vi")}</p><p>{game.instructions}</p><p className="game-caption">{game.rounds} rounds · 3 hearts · a friendship memory to collect</p><FairSaveStatus compact/>{warning&&<p role="alert">{warning}</p>}<button className="game-button" disabled={!ready||progress.status!=="ready"} onClick={start}>{ready?"Let’s play →":"Opening the playfield…"}</button><Link href="/festival" className="game-text-button">Back to the fair</Link></GameDialog>}
    {(paused||help)&&phase==="play"&&!error&&<GameDialog title={help?"A little help":"A little breather"} className="fair-dialog"><p>{help?game.instructions:"Your game is paused. Your current round will be waiting here."}</p><button className="game-button" onClick={()=>{setHelp(false);setPaused(false);}}>Resume game →</button><button className="game-button secondary" onClick={start}>Start this game again</button><Link href="/festival" className="game-text-button">Leave this round · return to the fair</Link></GameDialog>}
    {(phase==="win"||phase==="lose")&&!error&&<GameDialog title={phase==="win"?"A memory made together":"Another try, little friend?"} className="fair-dialog"><CompanionPortrait id={game.host}/>{phase==="win"?<><div className="fair-result-stars" aria-label={`${state?.hearts} stars`}>{"★".repeat(state?.hearts||1)}</div><strong>{state?.score} points</strong><p>{game.memory}</p><p className="game-caption" role="status">{saveMessage}</p>{saveFailed&&<button className="game-button secondary" disabled={saving} onClick={()=>void saveResult()}>Retry saving memory</button>}</>:<p>{state?.feedback} {friend.name} is happy to try again with you.</p>}{warning&&<p role="alert">{warning}</p>}<button className="game-button" disabled={saving||saveFailed||progress.status!=="ready"} onClick={start}>Play again →</button>{saveFailed&&!saving&&<button className="game-text-button" disabled={progress.status!=="ready"} onClick={start}>Leave this unsaved result & play again</button>}<Link href="/festival" className="game-button secondary">Open friendship scrapbook</Link><Link href="/journey" className="game-text-button">My journey & friends →</Link></GameDialog>}
    {error&&<GameDialog title="The playfield needs a moment" className="fair-dialog"><p role="alert">{error}</p><Link href="/festival" className="game-button">Back to the fair</Link></GameDialog>}
  </div>;
}
