"use client";
import{useRef,useState}from"react";
import{CEFRLevel,LearningAttempt,LearningAttemptResult,VerifiedLearningActivity,startLearningAttempt,submitLearningAttempt}from"@/lib/learning-attempt";
export type VerifiedRoundPhase="idle"|"loading"|"active"|"submitting"|"feedback"|"load-error"|"submit-error";
export default function useVerifiedLearningRound(activity:VerifiedLearningActivity){
 const[attempt,setAttempt]=useState<LearningAttempt|null>(null),[result,setResult]=useState<LearningAttemptResult|null>(null),[selected,setSelected]=useState<string|null>(null),[phase,setPhase]=useState<VerifiedRoundPhase>("idle"),[message,setMessage]=useState("");
 const pendingRequest=useRef(""),sequence=useRef(0);
 async function open(input:{cefrLevel:CEFRLevel;pack?:string;excludeItemKeys?:string[];newRequest?:boolean}){
  const seq=++sequence.current;if(input.newRequest!==false)pendingRequest.current="";
  const requestId=pendingRequest.current||crypto.randomUUID();pendingRequest.current=requestId;
  setAttempt(null);setResult(null);setSelected(null);setMessage("");setPhase("loading");
  try{const next=await startLearningAttempt({requestId,activity,cefrLevel:input.cefrLevel,pack:input.pack,excludeItemKeys:input.excludeItemKeys});if(seq!==sequence.current)return null;pendingRequest.current="";setAttempt(next);setPhase("active");return next}
  catch(error){if(seq!==sequence.current)return null;setMessage(error instanceof Error?error.message:"Could not open the verified round.");setPhase("load-error");return null}
 }
 async function submit(answer:string){if(!attempt||phase!=="active")return null;setSelected(answer);setMessage("");setPhase("submitting");try{const verdict=await submitLearningAttempt(attempt.attemptId,answer);setResult(verdict);setPhase("feedback");return verdict}catch(error){setMessage(error instanceof Error?error.message:"Your answer could not be verified.");setPhase("submit-error");return null}}
 async function retrySubmit(){if(!attempt||!selected||phase!=="submit-error")return null;setMessage("");setPhase("submitting");try{const verdict=await submitLearningAttempt(attempt.attemptId,selected);setResult(verdict);setPhase("feedback");return verdict}catch(error){setMessage(error instanceof Error?error.message:"Your answer could not be verified.");setPhase("submit-error");return null}}
 function invalidate(){sequence.current++;pendingRequest.current="";setAttempt(null);setResult(null);setSelected(null);setMessage("");setPhase("idle")}
 return{attempt,result,selected,phase,message,open,submit,retrySubmit,invalidate};
}
