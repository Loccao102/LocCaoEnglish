"use client";
import {useEffect,useRef,useState} from "react";
import {
  CEFRLevel,
  LearningAttempt,
  LearningAttemptResult,
  startWordLinkAttempt,
  submitLearningAttempt
} from "@/lib/learning-attempt";

const LEVELS:CEFRLevel[]=["A1","A2","B1","B2","C1","C2"];
const ROUNDS=5;
type Phase="loading"|"active"|"submitting"|"feedback"|"load-error"|"submit-error";

export default function WordLinkGame(){
  const[level,setLevel]=useState<CEFRLevel>("A1");
  const[challenge,setChallenge]=useState<string|null>(null);
  const[pack,setPack]=useState("cefr-core");
  const[attempt,setAttempt]=useState<LearningAttempt|null>(null);
  const[result,setResult]=useState<LearningAttemptResult|null>(null);
  const[phase,setPhase]=useState<Phase>("loading");
  const[round,setRound]=useState(0);
  const[selected,setSelected]=useState<string|null>(null);
  const[score,setScore]=useState(0);
  const[streak,setStreak]=useState(0);
  const[message,setMessage]=useState("");
  const pendingStartId=useRef("");
  const seenKeys=useRef<string[]>([]);
  const requestSeq=useRef(0);
  const started=useRef(false);
  const packRef=useRef("cefr-core");

  useEffect(()=>{
    if(started.current)return;
    started.current=true;
    const query=new URLSearchParams(window.location.search);
    setChallenge(query.get("challenge"));
    const requestedPack=query.get("pack")==="travel-airport"?"travel-airport":"cefr-core";
    const initialLevel:CEFRLevel=requestedPack==="travel-airport"?"B1":"A1";
    packRef.current=requestedPack;
    setPack(requestedPack);
    setLevel(initialLevel);
    void openRound(initialLevel,true);
  },[]);

  async function openRound(targetLevel:CEFRLevel,newRequest:boolean){
    const seq=++requestSeq.current;
    if(newRequest)pendingStartId.current="";
    const requestId=pendingStartId.current||crypto.randomUUID();
    pendingStartId.current=requestId;
    setAttempt(null);
    setResult(null);
    setSelected(null);
    setMessage("");
    setPhase("loading");
    try{
      const next=await startWordLinkAttempt({requestId,cefrLevel:targetLevel,pack:packRef.current,excludeItemKeys:seenKeys.current});
      if(seq!==requestSeq.current)return;
      pendingStartId.current="";
      if(!seenKeys.current.includes(next.itemKey))seenKeys.current=[...seenKeys.current,next.itemKey];
      setAttempt(next);
      setPhase("active");
    }catch(error){
      if(seq!==requestSeq.current)return;
      setMessage(error instanceof Error?error.message:"Could not open the next verified round.");
      setPhase("load-error");
    }
  }

  async function submit(option:string){
    if(!attempt||phase==="submitting"||phase==="feedback")return;
    setSelected(option);
    setPhase("submitting");
    setMessage("");
    try{
      const verdict=await submitLearningAttempt(attempt.attemptId,option);
      setResult(verdict);
      setScore(value=>value+verdict.xpDelta);
      setStreak(value=>verdict.correct?value+1:0);
      setPhase("feedback");
    }catch(error){
      setMessage(error instanceof Error?error.message:"Your answer could not be verified.");
      setPhase("submit-error");
    }
  }

  async function retrySubmit(){
    if(selected)await submit(selected);
  }

  function next(){
    if(round>=ROUNDS-1){
      setRound(0);
      setScore(0);
      setStreak(0);
      seenKeys.current=[];
    }else{
      setRound(value=>value+1);
    }
    void openRound(level,true);
  }

  function changeLevel(value:string){
    const nextLevel=value as CEFRLevel;
    requestSeq.current++;
    pendingStartId.current="";
    seenKeys.current=[];
    packRef.current="cefr-core";
    setPack("cefr-core");
    setLevel(nextLevel);
    setRound(0);
    setScore(0);
    setStreak(0);
    void openRound(nextLevel,true);
  }

  const progress=((round+(phase==="feedback"?1:0))/ROUNDS)*100;
  const completed=round===ROUNDS-1&&phase==="feedback";

  return <div className="play-shell">
    {challenge&&<div className="challenge-banner">VERIFIED PRACTICE DUEL · leaderboard submission stays disabled until competitive scoring also uses server-owned results.</div>}
    <div className="play-top">
      <div>
        <span className="eyebrow">WORD LINK · {pack==="travel-airport"?"TRAVEL · AIRPORT":"SERVER-VERIFIED"}</span>
        <strong>Round {round+1}/{ROUNDS}</strong>
      </div>
      <label className="mode-badge">CEFR&nbsp;
        <select aria-label="CEFR level" value={level} disabled={phase==="submitting"} onChange={event=>changeLevel(event.target.value)}>
          {LEVELS.map(item=><option key={item} value={item}>{item}</option>)}
        </select>
      </label>
      <div className="play-score"><span>🔥 {streak}</span><b>{score} verified XP</b></div>
    </div>
    <div className="progress large"><i style={{width:`${progress}%`}}/></div>

    {phase==="loading"&&<section className="word-game-card"><p className="prompt-label">Opening a {level} round…</p></section>}
    {phase==="load-error"&&<section className="word-game-card"><div className="feedback-box error"><div><strong>Round could not load</strong><p>{message}</p></div><button className="button primary" onClick={()=>void openRound(level,false)}>Retry same request →</button></div></section>}

    {attempt&&<section className="word-game-card">
      <p className="prompt-label">{attempt.cefrLevel} · {attempt.prompt.relation}</p>
      <div className="word-link-arena">
        <div className="core-word"><small>CORE WORD</small><strong>{attempt.prompt.word}</strong><span>choose the best connection</span></div>
        <div className="option-grid">
          {attempt.prompt.options.map(option=>{
            let state="";
            if(result)state=option===result.correctAnswer?"correct":option===selected?"wrong":"muted";
            else if(selected===option)state="muted";
            return <button key={option} disabled={phase!=="active"} className={`word-option ${state}`} onClick={()=>void submit(option)}><span className="link-dot">•</span>{option}</button>;
          })}
        </div>
      </div>

      {phase==="submitting"&&<div className="feedback-box"><div><strong>Checking on the server…</strong><p>Your browser does not decide the score.</p></div></div>}
      {phase==="submit-error"&&<div className="feedback-box error"><div><strong>Answer not confirmed yet</strong><p>{message} Retrying uses the same attempt, so it cannot award XP twice.</p></div><button className="button primary" onClick={()=>void retrySubmit()}>Retry verification →</button></div>}
      {result&&phase==="feedback"&&<div className={`feedback-box ${result.correct?"success":"error"}`}>
        <div>
          <strong>{result.correct?"Connection verified ✓":`Not quite — ${result.correctAnswer}`}</strong>
          <p>{result.feedback} {result.reviewAdded&&"This item was added to your adaptive review queue."} Result saved with {result.rulesVersion}.</p>
        </div>
        <button className="button primary" onClick={next}>{completed?"Play another set":"Next verified link →"}</button>
      </div>}
    </section>}
  </div>;
}
