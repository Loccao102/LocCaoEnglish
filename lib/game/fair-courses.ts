import catalog from "@/backend/internal/fair/courses.json";

export type Course = {
  id: string; gameId: string; name: string; chapter: string; story: string; lesson: string;
  feature: string; parMs: number; spawn: { x: number; z: number };
  rings: number[][]; puddles: number[][]; feathers: number[][];
  high: number[]; wind: number; drift: number; reward: string;
};
export type CourseRecord = { medals: number; clean: boolean; feathers: number; bestMs: number; visits: number };
export type CourseResult = { elapsedMs: number; feathers: number };
export const fairCourses = catalog as Course[];
export const courseById = (id?: string) => fairCourses.find(course => course.id === id);
export const coursesFor = (gameId: string) => fairCourses.filter(course => course.gameId === gameId);
export function courseMedals(clean: boolean, feathers: number) { return 1 + Number(clean) + Number(feathers >= 3); }
export function mergeCourse(a: CourseRecord | undefined, b: CourseRecord): CourseRecord {
  const clean = !!a?.clean || b.clean, feathers = Math.max(a?.feathers || 0, b.feathers);
  const times = [a?.bestMs || 0, b.bestMs].filter(time => time > 0);
  return { medals: courseMedals(clean, feathers), clean, feathers, bestMs: times.length ? Math.min(...times) : 0, visits: Math.max(a?.visits || 0, b.visits) };
}
export function courseUnlocked(id: string, records: Record<string, CourseRecord>, legacyCloudCleared = false) {
  const course = courseById(id); if (!course) return false;
  const index = coursesFor(course.gameId).findIndex(item => item.id === id);
  return index === 0 || !!records[coursesFor(course.gameId)[index - 1].id] || index === 1 && legacyCloudCleared;
}
export function courseTime(milliseconds: number) {
  const seconds = Math.floor(milliseconds / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

export function courseProgress(gameId:string, records:Record<string,CourseRecord>, legacyCleared=false) {
  const courses=coursesFor(gameId),available=courses.filter(course=>courseUnlocked(course.id,records,legacyCleared));
  const next=available.find((course,index)=>!records[course.id]&&!(legacyCleared&&index===0))
    ||available.find(course=>(records[course.id]?.medals||0)<3)||available.at(-1);
  return {courses,next,completed:courses.filter(course=>records[course.id]).length,
    medals:courses.reduce((sum,course)=>sum+(records[course.id]?.medals||0),0),totalMedals:courses.length*3};
}

export function courseReplayGoal(record?:CourseRecord) {
  if(!record)return "Finish this trail to reveal the next atlas page.";
  if(!record.clean&&record.feathers<3)return "Try a clean flight, or take a detour to find all three feathers.";
  if(!record.clean)return "Keep all three hearts to earn the last badge.";
  if(record.feathers<3)return "Find all three feathers to earn the last badge.";
  return `All three badges are yours. Your best flight is ${courseTime(record.bestMs)}.`;
}
