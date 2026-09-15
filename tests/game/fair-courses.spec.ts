import { test, expect } from "@playwright/test";
import { FestivalSession } from "../../lib/game/festival-session";
import { festivalById, festivalGames } from "../../lib/game/festival";
import { fairCourses, courseUnlocked } from "../../lib/game/fair-courses";
import { applyFair, availableCourses, emptyFair, mergeFair, queueFair, queuedFair, restoreFair } from "../../lib/game/fair-progress";

const tick=(session:FestivalSession,seconds=1.2)=>{for(let i=0;i<seconds*60;i++)session.tick(1/60);};

test("six courses introduce distinct routes, double jumps, wind and drifting targets",()=>{
  let save=emptyFair();
  for(const [index,course]of fairCourses.entries()){
    expect(courseUnlocked(course.id,save.courses||{})).toBe(true);
    if(fairCourses[index+1])expect(courseUnlocked(fairCourses[index+1].id,save.courses||{})).toBe(false);
    const session=new FestivalSession(festivalById("cloud-hop")!,()=>{},()=>{},course.id);session.start();
    expect(session.course?.id).toBe(course.id);expect(course.rings).toHaveLength(6);
    const before=session.ringPoint(0);tick(session,.5);
    expect(session.ringPoint(0).x!==before.x).toBe(course.drift>0);
    expect(session.wind!==0).toBe(course.wind>0);
    for(let ring=0;ring<6;ring++){
      session.touchRing(ring,0);expect(session.state.round).toBe(ring);
      if(course.high.includes(ring)){session.touchRing(ring,.9);expect(session.state.score).toBe(ring*100);}
      session.touchRing(ring,1.5);tick(session);
    }
    expect(session.state.phase).toBe("win");expect(session.state.score).toBe(675);
    save=applyFair(save,{runId:course.id,gameId:"cloud-hop",courseId:course.id,stars:3,elapsedMs:40000,feathers:0},"2026-09-16T00:00:00Z");
  }
  expect(Object.keys(save.courses!)).toHaveLength(6);
  expect(new Set(fairCourses.map(course=>JSON.stringify(course.rings))).size).toBeGreaterThan(2);
});

test("feathers require an airborne active player and cannot be collected twice",()=>{
  const session=new FestivalSession(festivalById("cloud-hop")!,()=>{});session.start();
  session.collectFeather(0,0);session.collectFeather(99,1);expect(session.state.feathers).toEqual([]);
  session.collectFeather(0,.8);session.collectFeather(0,.8);expect(session.state.feathers).toEqual([0]);
  session.hazard();session.collectFeather(1,.8);expect(session.state.feathers).toEqual([0]);
  tick(session);session.collectFeather(1,.8);expect(session.state.feathers).toEqual([0,1]);
  session.start();expect(session.state.feathers).toEqual([]);
});

test("separate replays preserve clean and exploration badges, fastest time and old saves",()=>{
  const first=applyFair(emptyFair(),{runId:"a",gameId:"cloud-hop",courseId:"cloud-01",stars:3,elapsedMs:45000,feathers:0},"2026-09-16T00:00:00Z");
  const next=applyFair(first,{runId:"b",gameId:"cloud-hop",courseId:"cloud-01",stars:1,elapsedMs:65000,feathers:3},"2026-09-16T01:00:00Z");
  expect(next.courses!["cloud-01"]).toEqual({medals:3,clean:true,feathers:3,bestMs:45000,visits:2});
  expect(mergeFair(next,first)).toEqual(next);expect(restoreFair(JSON.parse(JSON.stringify(next)))).toEqual(next);
  expect(courseUnlocked("cloud-02",{},true)).toBe(true);expect(courseUnlocked("cloud-03",{},true)).toBe(false);
  expect(()=>applyFair(first,{runId:"bad",gameId:"tea-time",courseId:"cloud-01",stars:3,elapsedMs:10,feathers:0},"now")).toThrow();
});

test("all games restore a JSON checkpoint and reject another game or malformed state",()=>{
  for(const game of festivalGames){
    const first=new FestivalSession(game,()=>{});first.start();tick(first,.3);
    if(game.kind==="tea"||game.kind==="colour")first.choose(0);
    if(game.kind==="bridge")first.choose(4);
    const snapshot=JSON.parse(JSON.stringify(first.snapshot()));
    const second=new FestivalSession(game,()=>{});expect(second.restore(snapshot),game.id).toBe(true);
    expect(second.state).toMatchObject({round:first.state.round,selection:first.state.selection,hearts:first.state.hearts,elapsed:first.state.elapsed});
    expect(second.rotations).toEqual(first.rotations);
    tick(first);tick(second);expect(second.state).toMatchObject({round:first.state.round,lit:first.state.lit,listening:first.state.listening});
    expect(second.restore({...snapshot,gameId:"wrong"})).toBe(false);
    expect(second.restore({...snapshot,state:{...snapshot.state,round:999}})).toBe(false);
  }
});

test("a checkpoint across a round transition or unsaved win keeps exact result details",()=>{
  const first=new FestivalSession(festivalById("cloud-hop")!,()=>{});first.start();
  for(let ring=0;ring<5;ring++){first.touchRing(ring,.8);tick(first);}
  first.collectFeather(0,.8);first.touchRing(5,.8);tick(first,.3);
  const second=new FestivalSession(first.game,()=>{});expect(second.restore(first.snapshot())).toBe(true);
  tick(first);tick(second);expect(second.state.phase).toBe("win");expect(second.state.elapsed).toBe(first.state.elapsed);
  const result=new FestivalSession(first.game,()=>{});expect(result.restore(JSON.parse(JSON.stringify(second.snapshot())))).toBe(true);
  tick(result,10);expect(result.state.elapsed).toBe(second.state.elapsed);expect(result.state.feathers).toEqual([0]);
});

test("queued course results unlock locally, keep exact metadata and stay with their owner",()=>{
  const entries=new Map<string,string>();
  const previous=Object.getOwnPropertyDescriptor(globalThis,"localStorage");
  Object.defineProperty(globalThis,"localStorage",{configurable:true,value:{get length(){return entries.size;},key:(index:number)=>[...entries.keys()][index],getItem:(key:string)=>entries.get(key)||null,setItem:(key:string,value:string)=>entries.set(key,value)}});
  try{
    const run={runId:"12345678-1234-4123-8123-123456789012",owner:"sky-explorer",gameId:"cloud-hop",courseId:"cloud-01"};
    queueFair(run,3,{elapsedMs:42000,feathers:2});queueFair(run,3,{elapsedMs:42000,feathers:2});
    expect(queuedFair(run.owner)).toHaveLength(1);
    expect(queuedFair(run.owner)[0]).toMatchObject({courseId:"cloud-01",elapsedMs:42000,feathers:2,stars:3});
    expect(courseUnlocked("cloud-02",availableCourses(emptyFair(),run.owner))).toBe(true);
    expect(courseUnlocked("cloud-02",availableCourses(emptyFair(),"someone-else"))).toBe(false);
    expect(()=>queueFair(run,3,{elapsedMs:41000,feathers:2})).toThrow();
    expect(()=>queueFair(run,3,{elapsedMs:42000,feathers:3})).toThrow();
  }finally{if(previous)Object.defineProperty(globalThis,"localStorage",previous);else Reflect.deleteProperty(globalThis,"localStorage");}
});
