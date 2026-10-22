import {apiFetch, type DailyRun} from './api';
export type DailyReceipt={date:string;rulesVersion:string;rewardXp:number;claimedAt:string;legacy:boolean;plan?:{date:string;rulesVersion:string;quests:DailyRun['quests'];createdAt:string};evidence:{questId:string;activity:string;attemptId:string}[]};
export type DailyClaimInput={date:string;rulesVersion:string};
const auth=(token:string)=>({Authorization:`Bearer ${token}`});
export function fetchDaily(token:string){return apiFetch<DailyRun>('/v1/player/daily',{headers:auth(token)});}
export function fetchDailyReceipt(day:string,token:string){return apiFetch<DailyReceipt>(`/v1/player/daily/claims/${encodeURIComponent(day)}`,{headers:auth(token)});}
export function submitDailyClaim(input:DailyClaimInput,token:string){return apiFetch<DailyRun>('/v1/player/daily/claim',{method:'POST',headers:auth(token),body:JSON.stringify(input)});}
