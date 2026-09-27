import {test,expect} from "@playwright/test";
import {festivalGames,festivalById} from "../../lib/game/festival";
import {FestivalSession} from "../../lib/game/festival-session";
import {challengeClue,challengeMelody,newChallenge} from "../../lib/game/challenge";
import {applyFair,emptyFair,mergeFair,restoreFair,queueFair} from "../../lib/game/fair-progress";
import {bridgePath} from "../../lib/game/bridge-path";

function advance(s:FestivalSession,seconds=3){for(let left=seconds;left>1e-6;left-=.05)s.tick(Math.min(.05,left));}
function solve(s:FestivalSession){
  while(s.state.phase==="play"){
    switch(s.game.kind){
      case "bubble":s.choose(s.bubble.answer);break;
      case "garden":s.choose(s.garden.seed);s.choose(3);for(let i=0;i<s.garden.water;i++)s.choose(4);s.choose(3);break;
      case "echo":advance(s,s.noteSeconds*s.melody.length+.1);s.melody.forEach(id=>s.choose(id));break;
      case "tea":s.customer!.recipe.forEach(id=>s.choose(id));s.brewTea();advance(s,(s.brewingBand!.from+s.brewingBand!.to)/2);s.brewTea();s.submit();break;
      case "parcel":s.choose(3);s.deliveryRoute.forEach(id=>s.choose(id));break;
      case "hop":for(let i=0;i<s.feathersRequired;i++)s.collectFeather(i,.6);s.touchRing(s.state.round,2);break;
      case "colour":s.paintOrder.recipe.forEach(id=>s.choose(id));s.submit();break;
      case "bridge":{
        const route=[[3,4,5],[6,3,0,1,2],[0,1,4,3,6,7,8]][s.puzzleIndex];
        for(const id of route)while(s.rotations[id]!==0)s.choose(id);
        s.submit();break;
      }
    }
    expect(s.state.emotion,`${s.game.id} round ${s.state.round}`).toBe("joy");
    const snapshot=JSON.parse(JSON.stringify(s.snapshot()));
    expect(new FestivalSession(s.game,()=>{}).restore(snapshot)).toBe(true);
    advance(s);
  }
}
for(const level of ["adventure","expert"] as const)for(const game of festivalGames)test(`${game.name} ${level}: full solvable run, valid transition checkpoint and isolated score`,()=>{
  const s=new FestivalSession(game,()=>{});s.start(undefined,{level,runId:`${game.id}:${level}`});solve(s);
  expect(s.state.phase).toBe("win");expect(s.state.hearts).toBe(3);expect(s.state.score).toBe(game.rounds*100+75);
});

test("new runs vary answer positions and melodies while checkpoints keep the same challenge",()=>{
  const positions=new Set<number>(),melodies=new Set<string>();
  for(let i=0;i<40;i++){const c=newChallenge("expert",String(i));positions.add(challengeClue(c,0).answer);melodies.add(challengeMelody(c,4).join());}
  expect(positions.size).toBe(4);expect(melodies.size).toBeGreaterThan(30);
  for(const game of festivalGames){const s=new FestivalSession(game,()=>{});s.start(undefined,{level:"expert",runId:"persist"});advance(s,.2);const copy=new FestivalSession(game,()=>{});expect(copy.restore(JSON.parse(JSON.stringify(s.snapshot())))).toBe(true);expect(copy.state).toMatchObject({...s.state,revision:1});expect(copy.objects()).toEqual(s.objects());}
});

test("assistance reduces result stars and survives checkpoints; learning assistance never loses a heart",()=>{
  const s=new FestivalSession(festivalById("colour-studio")!,()=>{});s.start(undefined,{level:"adventure",runId:"assisted"});s.assist();
  expect(s.state.hearts).toBe(3);expect(s.resultStars).toBe(2);
  const copy=new FestivalSession(s.game,()=>{});expect(copy.restore(s.snapshot())).toBe(true);solve(copy);
  expect(copy.state.score).toBe(450);expect(copy.resultStars).toBe(2);
});

test("timeouts cost one heart per round, reset partial work, and cannot reward a loss",()=>{
  const s=new FestivalSession(festivalById("little-garden")!,()=>{});s.start(undefined,{level:"expert",runId:"clock"});s.choose(s.garden.seed);s.choose(3);s.choose(4);
  advance(s,35.1);expect(s.state.hearts).toBe(2);expect(s.state.challenge!.step).toBe(0);expect(s.state.carrying).toBeNull();
  advance(s,75);expect(s.state.phase).toBe("lose");expect(s.state.score).toBe(0);expect(s.snapshot()).toBeNull();
});

test("bridge budgets always permit an authored route, start unsolved and recover the sailing path",()=>{
  for(let seed=0;seed<30;seed++){
    const s=new FestivalSession(festivalById("bridge-builder")!,()=>{});s.start(undefined,{level:"expert",runId:String(seed)});
    expect(bridgePath(s.puzzle.ports,s.rotations,s.puzzle.entry,s.puzzle.exit)).toEqual([]);
    const route=[[3,4,5],[6,3,0,1,2],[0,1,4,3,6,7,8]][s.puzzleIndex];
    for(const id of route)while(s.rotations[id]!==0)s.choose(id);
    expect(s.state.challenge!.moves).toBeLessThanOrEqual(s.turnBudget);s.submit();
    const restored=new FestivalSession(s.game,()=>{});expect(restored.restore(s.snapshot())).toBe(true);expect(restored.bridgePath).toEqual(s.bridgePath);
  }
});

test("final rings require challenge feathers and tea timing is narrower at each level",()=>{
  const hop=new FestivalSession(festivalById("cloud-hop")!,()=>{});hop.start(undefined,{level:"expert",runId:"feathers"});
  for(let ring=0;ring<5;ring++){hop.touchRing(ring,2);advance(hop);}
  hop.touchRing(5,2);expect(hop.state.score).toBe(500);expect(hop.state.feedback).toContain("3 sky feathers");
  const tea=new FestivalSession(festivalById("tea-time")!,()=>{});tea.start("brew");const practice=tea.brewingBand!;
  tea.start("brew",{level:"adventure",runId:"brew"});const adventure=tea.brewingBand!;
  tea.start("brew",{level:"expert",runId:"brew"});const expert=tea.brewingBand!;
  expect(practice.to-practice.from).toBeGreaterThan(adventure.to-adventure.from);expect(expert.to-expert.from).toBeCloseTo(.6);
});

test("difficulty records merge separately and legacy clears do not become expert clears",()=>{
  const old=restoreFair({version:1,games:{"tea-time":{stars:3,visits:9,best:375}}});expect(old.games["tea-time"].levels).toBeUndefined();
  const easy=applyFair(old,{runId:"a",gameId:"tea-time",stars:3},"today"),hard=applyFair(easy,{runId:"b",gameId:"tea-time",stars:1,difficulty:"expert"},"today");
  expect(mergeFair(hard,easy).games["tea-time"].levels).toEqual({practice:{stars:3,visits:1},expert:{stars:1,visits:1}});
  expect(()=>applyFair(emptyFair(),{runId:"x",gameId:"tea-time",stars:3,difficulty:"fake" as never},"today")).toThrow();
  const entries=new Map<string,string>();const previous=Object.getOwnPropertyDescriptor(globalThis,"localStorage");
  Object.defineProperty(globalThis,"localStorage",{configurable:true,value:{getItem:(key:string)=>entries.get(key)||null,setItem:(key:string,value:string)=>entries.set(key,value)}});
  try{const run={owner:"guest",runId:"same",gameId:"tea-time",difficulty:"expert" as const};queueFair(run,2);expect(()=>queueFair({...run,difficulty:"adventure"},2)).toThrow();}
  finally{if(previous)Object.defineProperty(globalThis,"localStorage",previous);else Reflect.deleteProperty(globalThis,"localStorage");}
});
