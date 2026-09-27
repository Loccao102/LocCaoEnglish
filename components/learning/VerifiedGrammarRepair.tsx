"use client";
import{useEffect,useRef,useState}from"react";
import{CEFRLevel}from"@/lib/learning-attempt";
import useVerifiedLearningRound from"./useVerifiedLearningRound";
import styles from"./VerifiedGrammarRepair.module.css";
const LEVELS:CEFRLevel[]=["A1","A2","B1","B2","C1","C2"];
const campaignLevels:Record<string,CEFRLevel>={"travel-hotel":"B1","conversation-clarity":"B1","work-requirements":"B2","work-deadline":"B2"};
export default function VerifiedGrammarRepair({pack="default"}:{pack?:string}){
 const requested=pack==="default"?"cefr-core":pack,normalizedPack=requested==="cefr-core"||campaignLevels[requested]?requested:"cefr-core",initialLevel=campaignLevels[normalizedPack]||"A1";
 const[level,setLevel]=useState<CEFRLevel>(initialLevel),[round,setRound]=useState(0),[score,setScore]=useState(0);const seen=useRef<string[]>([]),started=useRef(false);const verified=useVerifiedLearningRound("grammar-repair");
 useEffect(()=>{if(started.current)return;started.current=true;void openRound(initialLevel,true)},[]);
 async function openRound(target:CEFRLevel,newRequest:boolean){const next=await verified.open({cefrLevel:target,pack:normalizedPack,excludeItemKeys:seen.current,newRequest});if(next&&!seen.current.includes(next.itemKey))seen.current=[...seen.current,next.itemKey]}
 async function choose(answer:string){const verdict=await verified.submit(answer);if(verdict)setScore(v=>v+verdict.xpDelta)}
 async function retry(){const verdict=await verified.retrySubmit();if(verdict)setScore(v=>v+verdict.xpDelta)}
 function next(){setRound(v=>v+1);void openRound(level,true)}
 function changeLevel(value:string){const nextLevel=value as CEFRLevel;seen.current=[];verified.invalidate();setLevel(nextLevel);setRound(0);setScore(0);void verified.open({cefrLevel:nextLevel,pack:"cefr-core",excludeItemKeys:[],newRequest:true})}
 const{attempt,result,selected,phase,message}=verified,campaign=normalizedPack!=="cefr-core",sceneState=phase==="submitting"?styles.submitting:phase==="feedback"?styles.feedback:"";
 return <section className="mini-card verified-grammar-card"><div className="mini-head"><span className="eyebrow">GRAMMAR REPAIR · {campaign?normalizedPack.replaceAll("-"," ").toUpperCase():"A1 → C2 VERIFIED"}</span><b>Round {round+1}</b></div><div className={`${styles.scene} ${sceneState}`} aria-hidden="true"><div className={styles.orbit}><i/><i/><span>ABC</span></div></div><div className={styles.toolbar}>{!campaign?<label>CEFR <select aria-label="Grammar CEFR level" value={level} disabled={phase==="submitting"} onChange={e=>changeLevel(e.target.value)}>{LEVELS.map(x=><option key={x}>{x}</option>)}</select></label>:<span>{level} campaign practice</span>}<strong>{score} verified XP</strong></div>
 {phase==="loading"&&<p className="mini-feedback">Opening a server-verified grammar challenge…</p>}
 {phase==="load-error"&&<div className="mini-feedback-box error"><span>Could not open this round</span><strong>{message}</strong><button className="button primary" onClick={()=>void openRound(level,false)}>Retry →</button></div>}
 {attempt&&<><h2>{attempt.prompt.question}</h2><div className="choice-stack">{attempt.prompt.options.map(option=>{let state="";if(result)state=option===result.correctAnswer?"correct":option===selected?"wrong":"muted":"";else if(selected===option)state="muted";return <button key={option} disabled={phase!=="active"} onClick={()=>void choose(option)} className={state}>{option}</button>})}</div>
 {phase==="submitting"&&<p className="mini-feedback">Checking the repair on the server…</p>}
 {phase==="submit-error"&&<div className="mini-feedback-box error"><span>Result not confirmed</span><strong>{message}</strong><button className="button primary" onClick={()=>void retry()}>Retry same attempt →</button></div>}
 {result&&phase==="feedback"&&<div className={`mini-feedback-box ${result.correct?"success":"error"}`}><span>{result.correct?"✓ Correct repair":"Review this pattern"}</span><strong>{result.correctAnswer}</strong><p className={styles.note}>{result.feedback}</p><button className="button primary" onClick={next}>Next verified repair →</button></div>}</>}</section>
}
