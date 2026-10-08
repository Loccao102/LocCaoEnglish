"use client";

import { useEffect, useRef, useState } from "react";
import { getAuthToken } from "@/lib/session";
import { recordListeningPlayback, type ListeningPlayback } from "@/lib/learning-attempt";
import { playListeningClip } from "@/lib/listening-audio";
import type useVerifiedLearningRound from "./useVerifiedLearningRound";

export default function useListeningPlayback(round:ReturnType<typeof useVerifiedLearningRound>) {
 const {attempt}=round;
 const [phase,setPhase]=useState<"idle"|"loading"|"playing"|"saving">("idle");
 const [message,setMessage]=useState("");
 const [pending,setPending]=useState<ListeningPlayback|null>(null);
 const [warning,setWarning]=useState("");
 const operation=useRef<ListeningPlayback|null>(null), controller=useRef<AbortController|null>(null), generation=useRef(0), busy=useRef(false);
 const storageKey=`loccao.listening-audio.v1.${attempt?.attemptId}`;
 function keep(event:ListeningPlayback|null) {
  operation.current=event;setPending(event);
  try{if(event)localStorage.setItem(storageKey,JSON.stringify(event));else localStorage.removeItem(storageKey);}
  catch{setWarning("Browser storage is unavailable. Keep this tab open to confirm playback.");}
 }
 useEffect(()=>{
  generation.current++;busy.current=false;setPhase("idle");setMessage("");setWarning("");operation.current=null;setPending(null);
  if(attempt && !attempt.result) {
   try{
    const raw=localStorage.getItem(storageKey);
    if(raw){const saved=JSON.parse(raw) as ListeningPlayback;
     if(!/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(saved.requestId) || ![1,.72].includes(saved.rate) || !["requested","completed","failed"].includes(saved.status) || (saved.status!=="requested" && !["browser-speech-synthesis","azure-speech-neural-tts"].includes(saved.provider||""))) throw new Error();
     const recorded=attempt.listening?.events.find(e=>e.requestId===saved.requestId);
     if(recorded?.status==="completed" || recorded?.status==="failed")localStorage.removeItem(storageKey);
     else {operation.current=saved;setPending(saved);setMessage("An audio request is unfinished. Retry it before continuing.");}
    }
   }catch{setWarning("The local audio reference could not be read. Start playback again; the saved round remains intact.");}
  }
  return ()=>{generation.current++;controller.current?.abort();};
 },[attempt?.attemptId]);

 async function play(rate:1|0.72=1) {
  if(!attempt || round.phase!=="active" || busy.current)return;
  const seq=generation.current, token=getAuthToken(), current=()=>seq===generation.current && token===getAuthToken();
  busy.current=true;const abort=new AbortController();controller.current=abort;setMessage("");
  let event=operation.current || {requestId:crypto.randomUUID(),rate,status:"requested" as const};
  keep(event);
  try{
   if(event.status==="requested") {
    setPhase("loading");
    const prepared=await recordListeningPlayback(attempt,event,token,abort.signal);if(!current())return;
    if(!prepared.audio){round.acceptAudioUpdate(prepared.attempt,token);keep(null);return;}
    setPhase("playing");
    let status: "completed"|"failed"="completed", playbackMessage="";
    try{await playListeningClip(prepared.audio,abort.signal);}catch(error){status="failed";playbackMessage=error instanceof Error?error.message:"Audio failed.";}
    if(!current())return;
    event={...event,status,provider:prepared.audio.provider};keep(event);
    if(playbackMessage)setMessage(playbackMessage);
   }
   setPhase("saving");
   // A Stop action aborts media, but still records its failure with a fresh request.
   const saved=await recordListeningPlayback(attempt,event,token);if(!current())return;
   round.acceptAudioUpdate(saved.attempt,token);keep(null);
   if(event.status==="completed")setMessage("Playback finished. Choose the detail you heard.");
  }catch(error){if(current())setMessage(error instanceof Error?error.message:"Could not confirm playback. Retry the same audio request.");}
  finally{if(current()){busy.current=false;setPhase("idle");}}
 }
 return {phase,message,pending,warning,play,stop:()=>controller.current?.abort()};
}
