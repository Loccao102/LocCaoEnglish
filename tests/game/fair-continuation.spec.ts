import { test, expect } from "@playwright/test";
import { courseProgress, courseReplayGoal, fairCourses, type CourseRecord } from "../../lib/game/fair-courses";
import { entryCourse, savedFairRuns } from "../../lib/game/fair-continuation";
import { clearFairCheckpoint, writeFairCheckpoint } from "../../lib/game/fair-checkpoints";
import { FestivalSession } from "../../lib/game/festival-session";
import { festivalById } from "../../lib/game/festival";

const record:CourseRecord={medals:2,clean:true,feathers:0,bestMs:45000,visits:1};

test("course recommendations finish the story before returning for missing badges",()=>{
  expect(courseProgress("cloud-hop",{}).next?.id).toBe("cloud-01");
  expect(courseProgress("cloud-hop",{},true).next?.id).toBe("cloud-02");
  expect(courseProgress("cloud-hop",{"cloud-01":record}).next?.id).toBe("cloud-02");
  const completed=Object.fromEntries(fairCourses.map(course=>[course.id,{...record,medals:3,feathers:3}]));
  completed["cloud-03"]={...record};
  expect(courseProgress("cloud-hop",completed)).toMatchObject({completed:6,medals:17,totalMedals:18,next:{id:"cloud-03"}});
  expect(courseReplayGoal(record)).toContain("Find all three feathers");
  expect(courseReplayGoal({...record,clean:false,feathers:3})).toContain("Keep all three hearts");
  completed["cloud-03"]={...record,medals:3,feathers:3};
  expect(courseProgress("cloud-hop",completed).next?.id).toBe("cloud-06");
});

test("resuming finds validated owner checkpoints and locked links cannot select a future course",()=>{
  const entries=new Map<string,string>();
  const previous=Object.getOwnPropertyDescriptor(globalThis,"localStorage");
  Object.defineProperty(globalThis,"localStorage",{configurable:true,value:{getItem:(key:string)=>entries.get(key)||null,setItem:(key:string,value:string)=>entries.set(key,value),removeItem:(key:string)=>entries.delete(key)}});
  try{
    const session=new FestivalSession(festivalById("cloud-hop")!,()=>{},()=>{},"cloud-02");session.start();
    const run={runId:"12345678-1234-4123-8123-123456789012",gameId:"cloud-hop",owner:"guest",courseId:"cloud-02"};
    writeFairCheckpoint(run,session.snapshot()!,{x:-3,z:3.7});
    const saved=savedFairRuns("guest");expect(saved).toHaveLength(1);expect(savedFairRuns("another-account")).toHaveLength(0);
    const records={"cloud-01":record};
    expect(entryCourse("cloud-hop",null,saved,records)).toBe("cloud-02");
    expect(entryCourse("cloud-hop","cloud-06",saved,records)).toBe("cloud-02");
    expect(entryCourse("cloud-hop","cloud-01",saved,records)).toBe("cloud-01");
    expect(entryCourse("cloud-hop","not-a-course",saved,{})).toBe("cloud-01");
    const [key]=entries.keys();const raw=JSON.parse(entries.get(key)!);
    entries.set(key,JSON.stringify({...raw,session:{...raw.session,state:{...raw.session.state,round:99}}}));
    expect(savedFairRuns("guest")).toHaveLength(0);
    entries.set(key,JSON.stringify({...raw,savedAt:Date.now()-8*86400000}));expect(savedFairRuns("guest")).toHaveLength(0);
    clearFairCheckpoint(run);expect(entries.size).toBe(0);
  }finally{if(previous)Object.defineProperty(globalThis,"localStorage",previous);else Reflect.deleteProperty(globalThis,"localStorage");}
});
