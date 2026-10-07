"use client";
import{useMemo,useState}from"react";import{recordAttempt}from"@/lib/api";import{getLearningPack}from"@/data/contentPacks";

type PackProps={pack?:string};
export { default as SentenceBuilder } from "./learning/VerifiedSentenceBuilder";

export function GrammarRepair({pack="default"}:PackProps){const rounds=getLearningPack(pack).grammarRounds;const[i,setI]=useState(0);const[chosen,setChosen]=useState("");const c=rounds[i%rounds.length];const correct=chosen===c.answer;function choose(v:string){if(chosen)return;setChosen(v);recordAttempt({skill:"Grammar",activity:"grammar-repair",itemKey:`${pack}:grammar:${i}`,prompt:c.prompt,answer:c.answer,accuracy:v===c.answer?1:0}).catch(()=>{})}function next(){setI(v=>(v+1)%rounds.length);setChosen("")}return <section className="mini-card"><div className="mini-head"><span className="eyebrow">GRAMMAR REPAIR · {getLearningPack(pack).label}</span><b>{i+1}/{rounds.length}</b></div><h2>{c.prompt}</h2><div className="choice-stack">{c.options.map(v=><button key={v} onClick={()=>choose(v)} className={chosen?v===c.answer?"correct":v===chosen?"wrong":"muted":""}>{v}</button>)}</div>{chosen&&<div className={`mini-feedback-box ${correct?"success":"error"}`}><span>{correct?"✓ Correct repair":"Review this pattern"}</span><strong>{c.answer}</strong><button className="button primary" onClick={next}>Next →</button></div>}</section>}

export { default as CollocationFactory } from "./learning/VerifiedCollocationFactory";

export { default as ReadingRace } from "./learning/VerifiedReadingRace";

export function ListeningPick({pack="default"}:PackProps){const rounds=getLearningPack(pack).listeningRounds;const[i,setI]=useState(0);const[chosen,setChosen]=useState("");const c=rounds[i%rounds.length];function play(){if(!("speechSynthesis" in window))return;window.speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(c.audio);u.lang="en-US";u.rate=.92;window.speechSynthesis.speak(u)}function pick(v:string){if(chosen)return;setChosen(v);recordAttempt({skill:"Listening",activity:"listen-pick",itemKey:`${pack}:listen:${i}`,prompt:c.audio,answer:c.answer,accuracy:v===c.answer?1:0}).catch(()=>{})}return <section className="mini-card listening-game"><div className="mini-head"><span className="eyebrow">LISTEN & PICK · {getLearningPack(pack).label}</span><b>{i+1}/{rounds.length}</b></div><button className="listen-orb" onClick={play}>▶<small>play announcement</small></button><h2>{c.q}</h2><div className="choice-stack">{c.options.map(v=><button key={v} className={chosen?v===c.answer?"correct":v===chosen?"wrong":"muted":""} onClick={()=>pick(v)}>{v}</button>)}</div>{chosen&&<button className="button primary wide" onClick={()=>{setI(v=>(v+1)%rounds.length);setChosen("")}}>Next audio →</button>}</section>}

export { default as StoryChoice } from "./learning/VerifiedStoryChoice";
