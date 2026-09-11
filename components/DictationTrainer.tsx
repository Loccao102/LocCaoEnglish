"use client";

import { useMemo, useState } from "react";
import { recordAttempt } from "@/lib/api";
import { playLearningAudio } from "@/lib/tts";

const lines = ["Would you like to have a cup of coffee?","I've been trying to cut down on caffeine lately.","The flight has been delayed due to severe weather conditions.","Although public transport is convenient, it can become overcrowded during rush hour.","Governments should allocate more resources to improve access to higher education."];
const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9' ]/g, "").replace(/\s+/g, " ").trim();
function compare(expectedText:string,actualText:string){const expected=normalize(expectedText).split(" ");const actual=normalize(actualText).split(" ");let matched=0;expected.forEach((word,i)=>{if(actual[i]===word)matched+=1});return Math.round(matched/expected.length*100)}

export default function DictationTrainer() {
  const [index,setIndex]=useState(0);const [answer,setAnswer]=useState("");const [checked,setChecked]=useState(false);const [sync,setSync]=useState("");const [audioProvider,setAudioProvider]=useState("");const [playing,setPlaying]=useState(false);const current=lines[index];const accuracy=useMemo(()=>checked?compare(current,answer):0,[answer,checked,current]);
  async function speak(rate=.9){setPlaying(true);try{setAudioProvider(await playLearningAudio(current,rate))}catch{setAudioProvider("audio unavailable")}finally{setPlaying(false)}}
  function check(){const value=compare(current,answer);setChecked(true);setSync("saving…");recordAttempt({skill:"Dictation",activity:"dictation",itemKey:`dictation:${index}:${current.slice(0,24)}`,prompt:current,answer:current,accuracy:value/100}).then(()=>setSync("synced")).catch(()=>setSync("offline"))}
  function next(){setIndex((v)=>(v+1)%lines.length);setAnswer("");setChecked(false);setSync("");setAudioProvider("")}
  return <section className="trainer-card"><div className="trainer-toolbar"><span className="level-chip">Level {index+1}</span><span>{index+1} / {lines.length}</span></div><div className="audio-orb"><button disabled={playing} onClick={()=>void speak()} aria-label="Play sentence">▶</button><div><strong>Listen to the sentence</strong><small>{audioProvider?`Audio: ${audioProvider}`:"Neural TTS when configured · browser fallback otherwise"}</small></div><button className="speed-button" disabled={playing} onClick={()=>void speak(.68)}>0.68×</button></div><label className="answer-label" htmlFor="dictation-answer">Type exactly what you hear</label><textarea id="dictation-answer" className="practice-textarea short" value={answer} onChange={(e)=>{setAnswer(e.target.value);setChecked(false)}} placeholder="Start typing here…" />{!checked?<button className="button primary wide" onClick={check} disabled={!answer.trim()}>Check answer</button>:<div className={`dictation-result ${accuracy>=80?"success":"error"}`}><div className="accuracy-ring"><strong>{accuracy}%</strong><small>accuracy</small></div><div><strong>{accuracy===100?"Perfect dictation.":accuracy>=80?"Very close.":"Added to your review queue."}</strong><p>{current} · {sync}</p></div><button className="button primary" onClick={next}>Next →</button></div>}</section>;
}
