import {apiFetch} from "./api";

export type CEFRLevel="A1"|"A2"|"B1"|"B2"|"C1"|"C2";
export type VerifiedLearningActivity="word-link"|"grammar-repair";
export type LearningAttempt={
  attemptId:string;activity:VerifiedLearningActivity;pack:string;itemKey:string;cefrLevel:CEFRLevel;
  contentVersion:string;rulesVersion:string;status:string;
  prompt:{word?:string;relation?:string;question?:string;options:string[]};
};
export type LearningAttemptResult={
  attemptId:string;status:string;correct:boolean;correctAnswer:string;feedback:string;xpDelta:number;
  newConfidence:number;level:number;reviewAdded:boolean;contentVersion:string;rulesVersion:string;
};

export function startLearningAttempt(input:{requestId:string;activity:VerifiedLearningActivity;cefrLevel:CEFRLevel;pack?:string;excludeItemKeys?:string[]}){
  return apiFetch<LearningAttempt>("/v1/learning/attempts",{method:"POST",body:JSON.stringify({
    requestId:input.requestId,activity:input.activity,pack:input.pack||"cefr-core",
    cefrLevel:input.cefrLevel,excludeItemKeys:input.excludeItemKeys||[]
  })});
}
export function startWordLinkAttempt(input:{requestId:string;cefrLevel:CEFRLevel;pack?:string;excludeItemKeys?:string[]}){
  return startLearningAttempt({...input,activity:"word-link"});
}
export function submitLearningAttempt(attemptId:string,answer:string){
  return apiFetch<LearningAttemptResult>(`/v1/learning/attempts/${encodeURIComponent(attemptId)}/submit`,{method:"POST",body:JSON.stringify({answer})});
}
