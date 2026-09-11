import { apiFetch, ProgressionState } from "@/lib/api";

export type BossEvaluation={bossId:string;stage:number;score:number;complete:boolean;completed:string[];missing:string[]};
export function evaluateBoss(id:string,messages:string[]){return apiFetch<BossEvaluation>(`/v1/player/bosses/${encodeURIComponent(id)}/evaluate`,{method:"POST",body:JSON.stringify({messages})})}
export function claimBoss(id:string,messages:string[]){return apiFetch<ProgressionState>(`/v1/player/bosses/${encodeURIComponent(id)}/complete`,{method:"POST",body:JSON.stringify({score:100,messages})})}
