import type { FairRun } from "./fair-progress";
import type { FairCheckpoint } from "./festival-session";

export const FAIR_CHECKPOINT_EVENT="fair-checkpoint-change";
export const fairCheckpointPrefix=(owner:string)=>`loccao.fair.checkpoint.v1.${owner}.`;

export type SavedFairRun = { version:1; run:FairRun; session:FairCheckpoint; position:{x:number;z:number}; savedAt:number };
const key = (owner:string,gameId:string,courseId="") => `${fairCheckpointPrefix(owner)}${gameId}.${courseId||"classic"}`;
export function readFairCheckpoint(owner:string,gameId:string,courseId=""):SavedFairRun|null {
  try {
    const saved=JSON.parse(localStorage.getItem(key(owner,gameId,courseId))||"null") as SavedFairRun|null;
    if(!saved||saved.version!==1||saved.run.owner!==owner||saved.run.gameId!==gameId||(saved.run.courseId||"")!==courseId||
      !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(saved.run.runId)||
      !Number.isFinite(saved.savedAt)||Date.now()-saved.savedAt>7*86400000||saved.savedAt>Date.now()+60000||
      !Number.isFinite(saved.position.x)||!Number.isFinite(saved.position.z))return null;
    return saved;
  }catch{return null;}
}
export function writeFairCheckpoint(run:FairRun,session:FairCheckpoint,position:{x:number;z:number}) {
  localStorage.setItem(key(run.owner,run.gameId,run.courseId),JSON.stringify({version:1,run,session,position,savedAt:Date.now()} satisfies SavedFairRun));
  if(typeof window!=="undefined")window.dispatchEvent(new Event(FAIR_CHECKPOINT_EVENT));
}
export function clearFairCheckpoint(run:FairRun){localStorage.removeItem(key(run.owner,run.gameId,run.courseId));if(typeof window!=="undefined")window.dispatchEvent(new Event(FAIR_CHECKPOINT_EVENT));}
