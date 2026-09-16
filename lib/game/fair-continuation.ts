import { festivalGames } from "./festival";
import { FestivalSession } from "./festival-session";
import { readFairCheckpoint, type SavedFairRun } from "./fair-checkpoints";
import { courseById, courseProgress, coursesFor, courseUnlocked, type CourseRecord } from "./fair-courses";

export function savedFairRuns(owner:string):SavedFairRun[] {
  if(!owner)return [];
  return festivalGames.flatMap(game=>{
    const ids=coursesFor(game.id).map(course=>course.id);
    return (ids.length?ids:[""]).flatMap(id=>{
      const saved=readFairCheckpoint(owner,game.id,id);
      return saved&&new FestivalSession(game,()=>{},()=>{},id||undefined).restore(saved.session)?[saved]:[];
    });
  }).sort((a,b)=>b.savedAt-a.savedAt||a.run.gameId.localeCompare(b.run.gameId));
}

/** An explicit, unlocked link wins; otherwise recover the latest run before suggesting a new goal. */
export function entryCourse(gameId:string,requested:string|null,runs:SavedFairRun[],records:Record<string,CourseRecord>,legacyCleared=false) {
  const allowed=(id?:string)=>!!id&&courseById(id)?.gameId===gameId&&courseUnlocked(id,records,legacyCleared);
  if(requested&&allowed(requested))return requested;
  const saved=runs.find(item=>item.run.gameId===gameId&&allowed(item.run.courseId));
  return saved?.run.courseId||courseProgress(gameId,records,legacyCleared).next?.id;
}

export function fairRunHref(run:{gameId:string;courseId?:string}) {
  return `/festival/${encodeURIComponent(run.gameId)}${run.courseId?`?course=${encodeURIComponent(run.courseId)}`:""}`;
}
