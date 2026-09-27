import {apiFetch} from "./api";

export type CEFRLevel="A1"|"A2"|"B1"|"B2"|"C1"|"C2";
export type LearningAttempt={
  attemptId:string;
  activity:string;
  itemKey:string;
  cefrLevel:CEFRLevel;
  contentVersion:string;
  rulesVersion:string;
  status:string;
  prompt:{word:string;relation:string;options:string[]};
};
export type LearningAttemptResult={
  attemptId:string;
  status:string;
  correct:boolean;
  correctAnswer:string;
  feedback:string;
  xpDelta:number;
  newConfidence:number;
  level:number;
  reviewAdded:boolean;
  contentVersion:string;
  rulesVersion:string;
};

export function startWordLinkAttempt(input:{requestId:string;cefrLevel:CEFRLevel;excludeItemKeys?:string[]}){
  return apiFetch<LearningAttempt>("/v1/learning/attempts",{
    method:"POST",
    body:JSON.stringify({requestId:input.requestId,activity:"word-link",cefrLevel:input.cefrLevel,excludeItemKeys:input.excludeItemKeys||[]})
  });
}

export function submitLearningAttempt(attemptId:string,answer:string){
  return apiFetch<LearningAttemptResult>(`/v1/learning/attempts/${encodeURIComponent(attemptId)}/submit`,{
    method:"POST",
    body:JSON.stringify({answer})
  });
}
