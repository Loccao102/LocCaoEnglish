"use client";

import { useEffect, useRef, useState } from "react";
import { getAuthToken } from "@/lib/session";
import { recordListeningPlayback, type ListeningPlayback } from "@/lib/learning-attempt";
import { playListeningClip } from "@/lib/listening-audio";
import type useVerifiedLearningRound from "./useVerifiedLearningRound";

export default function useListeningPlayback(round:ReturnType<typeof useVerifiedLearningRound>, options:{partId?:string;maxDurationMs?:number}={}) {
 const {attempt}=round;
 const [phase,setPhase]=useState<"idle"|"loading"|"playing"|"saving">("idle");
 const [message,setMessage]=useState("");
 const [pending,setPending]=useState<ListeningPlayback|null>(null);
 const [warning,setWarning]=useState("");
 const [corrupt,setCorrupt]=useState(false);
 const [provider,setProvider]=useState("");
 const operation=useRef<ListeningPlayback|null>(null), controller=useRef<AbortController|null>(null), generation=useRef(0), busy=useRef(false);
 const storageKey=`loccao.listening-audio.v1.${attempt?.attemptId}`;
 function keep(event:ListeningPlayback|null) {
  operation.current=event;setPending(event);
  try{if(event)localStorage.setItem(storageKey,JSON.stringify(event));else localStorage.removeItem(storageKey);}
  catch{setWarning("Browser storage is unavailable. Keep this tab open to confirm playback.");}
 }
 useEffect(()=>{
  generation.current++;busy.current=false;setPhase("idle");setMessage("");setWarning("");setCorrupt(false);setProvider("");operation.current=null;setPending(null);
  if(attempt?.listening && !attempt.result) {
   try{
    const raw=localStorage.getItem(storageKey);
    if(raw){const saved=JSON.parse(raw) as ListeningPlayback;
     if(!/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(saved.requestId) || ![1,.72].includes(saved.rate) || !["requested","completed","failed"].includes(saved.status) || (saved.status!=="requested" && !["browser-speech-synthesis","azure-speech-neural-tts"].includes(saved.provider||""))) throw new Error();
     if(attempt.activity==="ielts-listening" && (!saved.partId || !attempt.prompt.listeningPaper?.sections.some(part=>part.id===saved.partId) || saved.status==="requested" && saved.provider!==undefined)) throw new Error("invalid audio reference");
     const recorded=attempt.listening?.events.find(e=>e.requestId===saved.requestId);
     if(recorded && (recorded.partId!==saved.partId || recorded.rate!==saved.rate)) throw new Error("invalid audio reference");
     if(recorded?.status==="completed" || recorded?.status==="failed")localStorage.removeItem(storageKey);
     else {operation.current=saved;setPending(saved);setMessage("An audio request is unfinished. Retry it before continuing.");}
    }
   }catch(error){
    if(attempt.activity==="ielts-listening" && !(error instanceof DOMException && ["SecurityError","QuotaExceededError"].includes(error.name))) {
     setCorrupt(true);setWarning("The saved audio request could not be read. Discard this audio reference explicitly to play again; your answer draft and saved playback stay intact.");
    }else setWarning("The local audio reference could not be read. Start playback again; the saved round remains intact.");
   }
  }
  return ()=>{generation.current++;controller.current?.abort();};
 },[attempt?.attemptId]);

 useEffect(()=>{
  const hidden=()=>{if(document.hidden)controller.current?.abort();};
  document.addEventListener("visibilitychange",hidden);
  return ()=>document.removeEventListener("visibilitychange",hidden);
 },[]);

 async function play(rate:1|0.72=1) {
  if(!attempt || round.phase!=="active" || busy.current || corrupt || attempt.activity==="ielts-listening" && document.hidden)return;
  const seq=generation.current, token=getAuthToken(), current=()=>seq===generation.current && token===getAuthToken();
  busy.current=true;const abort=new AbortController();controller.current=abort;setMessage("");
  let event:ListeningPlayback=operation.current || {requestId:crypto.randomUUID(),rate,status:"requested" as const,...(options.partId?{partId:options.partId}:{})};
  keep(event);
  try{
   if(event.status==="requested") {
    setPhase("loading");
    const prepared=await recordListeningPlayback(attempt,event,token,abort.signal);if(!current())return;
    if(!prepared.audio){round.acceptAudioUpdate(prepared.attempt,token);keep(null);return;}
    setProvider(prepared.audio.provider);
    setPhase("playing");
    let status: "completed"|"failed"="completed", playbackMessage="";
    try{await playListeningClip(prepared.audio,abort.signal,options.maxDurationMs);}catch(error){status="failed";playbackMessage=error instanceof Error?error.message:"Audio failed.";}
    if(!current())return;
    event={...event,status,provider:prepared.audio.provider};keep(event);
    if(playbackMessage)setMessage(playbackMessage);
   }
   setPhase("saving");
   // A Stop action aborts media, but still records its failure with a fresh request.
   const saved=await recordListeningPlayback(attempt,event,token);if(!current())return;
   round.acceptAudioUpdate(saved.attempt,token);keep(null);
   if(event.status==="completed")setMessage(attempt.activity==="ielts-listening"?"Part playback saved. You can answer, replay, or continue.":attempt.activity==="dictation"?"Playback finished. Type the sentence you heard.":"Playback finished. Choose the detail you heard.");
  }catch(error){if(current())setMessage(error instanceof Error?error.message:"Could not confirm playback. Retry the same audio request.");}
  finally{if(current()){busy.current=false;setPhase("idle");}}
 }
 return {phase,message,pending,warning,corrupt,provider,play,stop:()=>controller.current?.abort(),discardInvalid:()=>{if(!busy.current && corrupt){setWarning("");keep(null);setCorrupt(false);}}};
}
