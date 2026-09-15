import { festivalById, festivalGames } from "./festival";
import { courseById, fairCourses, courseMedals, mergeCourse, type CourseRecord, type CourseResult } from "./fair-courses";

export type FairRecord = { best: number; stars: number; visits: number; lastPlayedAt?: string };
export type FairSave = { version: 1; games: Record<string, FairRecord>; courses?:Record<string,CourseRecord> };
export type FairCompletion = { runId: string; gameId: string; stars: number; courseId?:string;elapsedMs?:number;feathers?:number };
export type FairRun = { runId: string; gameId: string; owner: string; courseId?:string };
export const emptyFair = (): FairSave => ({ version: 1, games: {} });
export const FAIR_EVENT = "fair-progress";
const root = "loccao.fair.v2.";
export const fairPrefix = (owner: string) => `${root}${owner}.`;
export function restoreFair(value: unknown): FairSave {
  const raw = value as Partial<FairSave> | null, save = emptyFair();
  if (raw?.version !== 1 || !raw.games) return save;
  for (const game of festivalGames) {
    const record = raw.games[game.id];
    if (!record || !Number.isInteger(record.stars) || record.stars < 1 || record.stars > 3 || !Number.isInteger(record.visits) || record.visits < 1) continue;
    save.games[game.id] = { best: game.rounds * 100 + record.stars * 25, stars: record.stars, visits: Math.min(1000000, record.visits), ...(typeof record.lastPlayedAt === "string" && Number.isFinite(Date.parse(record.lastPlayedAt)) ? { lastPlayedAt: record.lastPlayedAt } : {}) };
  }
  for(const course of fairCourses){
    const record=raw.courses?.[course.id];if(!record)continue;
    if(typeof record.clean!=="boolean"||!Number.isInteger(record.feathers)||record.feathers<0||record.feathers>3||!Number.isInteger(record.visits)||record.visits<1||!Number.isInteger(record.bestMs)||record.bestMs<1||record.bestMs>86400000)continue;
    save.courses??={};save.courses[course.id]={...record,medals:courseMedals(record.clean,record.feathers),visits:Math.min(1000000,record.visits)};
  }
  return save;
}
export function applyFair(save: FairSave, completion: FairCompletion, at: string): FairSave {
  const game = festivalById(completion.gameId);
  if (!game || !Number.isInteger(completion.stars) || completion.stars < 1 || completion.stars > 3) throw new Error("This result is not a completed fair game.");
  if(completion.courseId){const course=courseById(completion.courseId);if(!course||course.gameId!==game.id||!Number.isInteger(completion.elapsedMs)||completion.elapsedMs!<1||completion.elapsedMs!>86400000||!Number.isInteger(completion.feathers??0)||(completion.feathers??0)<0||(completion.feathers??0)>3)throw new Error("This course result could not be saved.");}
  else if(completion.elapsedMs||completion.feathers)throw new Error("This course result needs its course name.");
  const previous = save.games[game.id], stars = Math.max(previous?.stars || 0, completion.stars);
  const next:FairSave={ ...save, version: 1, games: { ...save.games, [game.id]: { best: game.rounds * 100 + stars * 25, stars, visits: (previous?.visits || 0) + 1, lastPlayedAt: at } } };
  if(completion.courseId){const old=save.courses?.[completion.courseId];next.courses={...save.courses,[completion.courseId]:mergeCourse(old,{medals:1,clean:completion.stars===3,feathers:completion.feathers||0,bestMs:completion.elapsedMs!,visits:(old?.visits||0)+1})};}
  return next;
}
/** Responses from different tabs can arrive out of order. Confirmed records only grow. */
export function mergeFair(a: FairSave, b: FairSave): FairSave {
  const result = restoreFair(a);
  for (const [id, next] of Object.entries(restoreFair(b).games)) {
    const old = result.games[id];
    if (!old) { result.games[id] = next; continue; }
    result.games[id] = { best: Math.max(old.best, next.best), stars: Math.max(old.stars, next.stars), visits: Math.max(old.visits, next.visits), lastPlayedAt: (old.lastPlayedAt || "") > (next.lastPlayedAt || "") ? old.lastPlayedAt : next.lastPlayedAt };
  }
  for(const [id,next]of Object.entries(restoreFair(b).courses||{})){result.courses??={};result.courses[id]=mergeCourse(result.courses[id],next);}
  return result;
}
export function parseStored(key: string): unknown {
  const raw = localStorage.getItem(key);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { throw new Error("A saved scrapbook could not be read. It has been kept on this device for recovery."); }
}
// One key per run prevents two tabs overwriting each other's offline queue.
export function queuedFair(owner: string): (FairCompletion & { at: string })[] {
  const prefix = `${fairPrefix(owner)}run.`, entries: (FairCompletion & { at: string })[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key?.startsWith(prefix)) continue;
    const value = parseStored(key) as FairCompletion & { at: string } | null;
    if (!value || key !== prefix + value.runId || !festivalById(value.gameId) || !Number.isInteger(value.stars) || value.stars < 1 || value.stars > 3 || typeof value.at !== "string") throw new Error("A queued memory needs recovery. No saved results have been removed.");
    applyFair(emptyFair(),value,value.at);
    entries.push(value);
  }
  return entries.sort((a, b) => a.at.localeCompare(b.at) || a.runId.localeCompare(b.runId));
}
export function queueFair(run: FairRun, stars: number, result?:CourseResult) {
  const value = { runId: run.runId, gameId: run.gameId, stars, ...(run.courseId?{courseId:run.courseId,elapsedMs:result?.elapsedMs,feathers:result?.feathers||0}:{}), at: new Date().toISOString() };
  applyFair(emptyFair(), value, value.at);
  const key = `${fairPrefix(run.owner)}run.${run.runId}`, old = parseStored(key) as FairCompletion | null;
  if (old && (old.gameId !== value.gameId || old.stars !== value.stars || (old.courseId||"")!==(value.courseId||"") || (old.elapsedMs||0)!==(value.elapsedMs||0) || (old.feathers||0)!==(value.feathers||0))) throw new Error("This run already has a different saved result.");
  if (!old) localStorage.setItem(key, JSON.stringify(value));
}
/** Course unlocks may use completed local runs while account uploads are waiting. */
export function availableCourses(save:FairSave,owner:string){
  let projected=save;
  try{if(owner&&owner!=="guest")for(const entry of queuedFair(owner))projected=applyFair(projected,entry,entry.at);}catch{/* Confirmed courses remain usable when storage is unavailable. */}
  return projected.courses||{};
}
export function guestFair(): FairSave {
  // Preserve the original device scrapbook as the baseline; new runs are a journal.
  let save = restoreFair(parseStored("loccao.friendship-fair.v1"));
  for (const entry of queuedFair("guest")) save = applyFair(save, entry, entry.at);
  return save;
}
