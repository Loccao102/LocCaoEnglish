import {apiFetch} from "./api";

export type CEFRLevel="A1"|"A2"|"B1"|"B2"|"C1"|"C2";
export type VerifiedLearningActivity="word-link"|"grammar-repair"|"collocation-factory"|"sentence-builder"|"word-graph"|"reading-race"|"story-choice"|"listen-pick"|"dictation";
export type ListeningPlayback={requestId:string;rate:1|0.72;status:"requested"|"completed"|"failed";provider?:"browser-speech-synthesis"|"azure-speech-neural-tts"};
export type ListeningEvidence={events:ListeningPlayback[];source:"client-reported-playback";transcript?:string};
export type ListeningAudio={provider:"browser-speech-synthesis"|"azure-speech-neural-tts";rate:number;text?:string;audioBase64?:string;mimeType?:string};
export type LearningAttempt={
 listening?:ListeningEvidence;
  story?:{runId:string;step:number;history:{scene:string;answer:string;consequence:string;xp:number}[]};
  attemptId:string;activity:VerifiedLearningActivity;pack:string;itemKey:string;cefrLevel:CEFRLevel;
  contentVersion:string;rulesVersion:string;status:string;
  prompt:{word?:string;relation?:string;question?:string;title?:string;passage?:string;options:string[];chunks?:{id:string;text:string}[]};
  mode:"guest"|"account";expiresAt:string;result?:LearningAttemptResult;
};
export type LearningAttemptResult={
 dictation?:{accuracy:number;expectedWords:number;matched:number;missing:number;extra:number;substituted:number;words:{kind:"match"|"missing"|"extra"|"substitute";expected?:string;actual?:string}[]};
 listening?:ListeningEvidence;
  story?:{consequence:string;canContinue:boolean;ending?:string;title?:string;text?:string};
  attemptId:string;status:string;correct:boolean;correctAnswer:string;feedback:string;xpDelta:number;
  newConfidence:number;level:number;reviewAdded:boolean;contentVersion:string;rulesVersion:string;
  actualAnswer:string;progressionApplied:boolean;evidence:"server-objective"|"server-objective-guided-listening"|"server-objective-guided-dictation";
};

const auth=(token:string)=>({Authorization:token?`Bearer ${token}`:""});
export function recordListeningPlayback(attempt:LearningAttempt,event:ListeningPlayback,token:string,signal?:AbortSignal){
 return apiFetch<{attempt:LearningAttempt;audio?:ListeningAudio}>(`/v1/learning/attempts/${encodeURIComponent(attempt.attemptId)}/audio`,{method:"POST",headers:auth(token),signal,body:JSON.stringify({...event,contentVersion:attempt.contentVersion,rulesVersion:attempt.rulesVersion})});
}
export function continueStoryAttempt(parentId:string,token:string){
  return apiFetch<LearningAttempt>(`/v1/learning/attempts/${encodeURIComponent(parentId)}/continue`,{method:"POST",headers:auth(token),body:"{}"});
}
export function startLearningAttempt(input:{requestId:string;activity:VerifiedLearningActivity;cefrLevel:CEFRLevel;pack?:string;excludeItemKeys?:string[]},token=""){
  return apiFetch<LearningAttempt>("/v1/learning/attempts",{method:"POST",headers:auth(token),body:JSON.stringify({
    requestId:input.requestId,activity:input.activity,pack:input.pack||"cefr-core",
    cefrLevel:input.cefrLevel,excludeItemKeys:input.excludeItemKeys||[]
  })});
}
export function startWordLinkAttempt(input:{requestId:string;cefrLevel:CEFRLevel;pack?:string;excludeItemKeys?:string[]}){
  return startLearningAttempt({...input,activity:"word-link"});
}
export function resumeLearningAttempt(attemptId:string,token:string){
  return apiFetch<LearningAttempt>(`/v1/learning/attempts/${encodeURIComponent(attemptId)}`,{headers:auth(token)});
}
export function submitLearningAttempt(attempt:LearningAttempt,answer:string,token:string){
  return apiFetch<LearningAttemptResult>(`/v1/learning/attempts/${encodeURIComponent(attempt.attemptId)}/submit`,{method:"POST",headers:auth(token),body:JSON.stringify({answer,contentVersion:attempt.contentVersion,rulesVersion:attempt.rulesVersion})});
}
