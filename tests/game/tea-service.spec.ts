import { test, expect } from "@playwright/test";
import { festivalById } from "../../lib/game/festival";
import { FestivalSession } from "../../lib/game/festival-session";
import { createTeaService, teaGuests, teaStrengths, teaStrength } from "../../lib/game/tea-service";

const session=()=>new FestivalSession(festivalById("tea-time")!,()=>{});
function advance(game:FestivalSession,seconds:number){for(let left=seconds;left>1e-6;left-=.05)game.tick(Math.min(.05,left));}
function fill(game:FestivalSession){game.customer!.recipe.forEach(id=>game.choose(id));}
function brew(game:FestivalSession){game.brewTea();const band=teaStrengths[game.customer!.strength];advance(game,(band.from+band.to)/2);game.brewTea();}

test("café queues are repeatable per run, varied between runs, and contain three distinct known friends",()=>{
  const queues=Array.from({length:40},(_,i)=>createTeaService(`visit-${i}`).guests);
  expect(new Set(queues.map(queue=>queue.join())).size).toBeGreaterThan(10);
  expect(new Set(queues.flat()).size).toBe(teaGuests.length);
  for(let i=0;i<queues.length;i++){expect(queues[i]).toEqual(createTeaService(`visit-${i}`).guests);expect(new Set(queues[i]).size).toBe(3);}
});

test("three guest orders require both their recipe and the chosen steeping band; restart can return to practice",()=>{
  const game=session();game.start("shift-one");
  for(let round=0;round<3;round++){
    const guest=game.customer!;expect(game.state.prompt).toBe(guest.request);fill(game);
    game.submit();expect(game.state.score).toBe(round*100);expect(game.state.hearts).toBe(3);
    brew(game);const seconds=game.state.tea!.seconds;advance(game,5);expect(game.state.tea!.seconds).toBe(seconds);
    game.submit();game.submit();expect(game.state.score).toBe((round+1)*100);expect(game.state.feedback).toBe(guest.thanks);
    advance(game,3);
  }
  expect(game.state.phase).toBe("win");expect(game.state.score).toBe(375);
  expect(game.restore(JSON.parse(JSON.stringify(game.snapshot())))).toBe(true);
  game.start();expect(game.state.tea).toBeUndefined();expect(game.state.prompt).toContain("Recipe:");
});

test("brewing locks ingredients; oversteeping and emptying are free until the cup is served",()=>{
  const game=session();game.start("shift-two");fill(game);game.brewTea();
  const selection=[...game.state.selection];game.choose(3);expect(game.state.selection).toEqual(selection);
  advance(game,9);expect(game.state.tea).toMatchObject({stage:"ready",seconds:8});expect(game.state.hearts).toBe(3);
  game.clear();expect(game.state.tea).toMatchObject({stage:"mixing",seconds:0});
  fill(game);game.brewTea();game.brewTea();game.submit();game.submit();expect(game.state.hearts).toBe(2);expect(game.state.selection).toEqual([]);
  advance(game,1);[3,3,3].forEach(id=>game.choose(id));brew(game);game.submit();expect(game.state.hearts).toBe(1);
  expect(game.state.feedback).toContain("different recipe");
});

test("checkpoint restores the queue, partial cup and exact brew time without counting time away",()=>{
  const original=session();original.start("shift-three");original.choose(0);original.showTeaRecipe();
  let saved=JSON.parse(JSON.stringify(original.snapshot())),restored=session();
  expect(restored.restore(saved)).toBe(true);expect(restored.state.selection).toEqual([0]);expect(restored.state.tea).toEqual(original.state.tea);
  original.clear();fill(original);original.brewTea();advance(original,1.1);
  saved=JSON.parse(JSON.stringify(original.snapshot()));restored=session();expect(restored.restore(saved)).toBe(true);
  expect(restored.state.tea!.seconds).toBeCloseTo(1.1);expect(restored.state.tea!.stage).toBe("steeping");
  advance(restored,.5);expect(restored.state.tea!.seconds).toBeCloseTo(1.6);expect(original.state.tea!.seconds).toBeCloseTo(1.1);
  const frozen=restored.snapshot()!;advance(restored,.5);expect(frozen.state.tea!.seconds).toBeCloseTo(1.6);
});

test("invalid café checkpoints are rejected; legacy recipes still restore",()=>{
  const game=session();game.start("invalid");const saved=game.snapshot()!;
  for(const tea of [{...saved.state.tea,guests:["mam","mam","soi"]},{...saved.state.tea,seconds:-1},{...saved.state.tea,seconds:1},{...saved.state.tea,stage:"steeping"},{...saved.state.tea,stage:"unknown"}]){
    expect(session().restore({...saved,state:{...saved.state,tea}})).toBe(false);
  }
  game.start();game.choose(0);expect(session().restore(JSON.parse(JSON.stringify(game.snapshot())))).toBe(true);
  for(const [i,band]of teaStrengths.entries()){expect(teaStrength(band.from)).toBe(i);expect(teaStrength(band.to)).toBe(i);}
  expect(teaStrength(0)).toBe(-1);expect(teaStrength(8)).toBe(-1);
});
