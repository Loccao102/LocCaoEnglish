import type { FestivalKind } from "./festival";

export const difficulties = ["practice", "adventure", "expert"] as const;
export type Difficulty = typeof difficulties[number];
export const difficultyName:Record<Difficulty,string>={practice:"Practice",adventure:"Adventure",expert:"Challenge"};
export const isDifficulty=(value:unknown):value is Difficulty=>difficulties.includes(value as Difficulty);
export function seedNumber(text:string){let seed=2166136261;for(const char of text)seed=Math.imul(seed^char.charCodeAt(0),16777619)>>>0;seed=Math.imul(seed^(seed>>>16),0x85ebca6b);seed=Math.imul(seed^(seed>>>13),0xc2b2ae35);return (seed^(seed>>>16))>>>0;}
export const expertTeaRequests:Record<string,string>={
  mam:"A gentle garden cup: start with tea, make it creamy, and sweeten it last.",
  may:"A balanced flight cup: start with tea, add the fresh herb, and sweeten it last.",
  soi:"A bold builder's cup: tea first, dairy in the middle, and the fresh herb last.",
  bong:"A gentle reading cup: tea first, sweetness in the middle, and dairy last.",
  nang:"A balanced sunshine cup: tea first, then sweetness, finishing with the fresh herb.",
  truc:"A bold music cup: tea first, the fresh herb in the middle, and dairy last.",
};
export function shuffled<T>(values:readonly T[],seed:number):T[]{
  const result=[...values];
  for(let i=result.length-1;i>0;i--){seed=(Math.imul(seed,1664525)+1013904223)>>>0;const j=seed%(i+1);[result[i],result[j]]=[result[j],result[i]];}
  return result;
}
export type ChallengeState={version:1;level:"adventure"|"expert";seed:number;remaining:number;moves:number;assists:number;step:number;hint:boolean};
export const roundSeconds=(kind:FestivalKind,level:ChallengeState["level"])=>({bubble:[24,16],garden:[45,35],echo:[18,12],tea:[45,30],parcel:[60,45],hop:[0,0],colour:[45,30],bridge:[90,60]}[kind][level==="expert"?1:0]);
export function newChallenge(level:ChallengeState["level"],runId:string):ChallengeState{return {version:1,level,seed:seedNumber(runId),remaining:0,moves:0,assists:0,step:0,hint:false};}
export function validChallenge(value:unknown):value is ChallengeState{
  const c=value as ChallengeState|null;
  return !!c&&c.version===1&&["adventure","expert"].includes(c.level)&&Number.isInteger(c.seed)&&c.seed>=0&&c.seed<=0xffffffff&&
    Number.isFinite(c.remaining)&&c.remaining>=0&&c.remaining<=90&&Number.isInteger(c.moves)&&c.moves>=0&&c.moves<=100&&
    Number.isInteger(c.assists)&&c.assists>=0&&c.assists<=99&&Number.isInteger(c.step)&&c.step>=0&&c.step<=5&&typeof c.hint==="boolean";
}

type WordClue={clue:string;words:string[];answer:number};
const wordClues:WordClue[]=[
  {clue:"The path was narrow: only one friend could pass. Catch the opposite of narrow.",words:["wide","long","steep","short"],answer:0},
  {clue:"Mầm cared for the seedlings each day. Which word means to help something grow?",words:["nurture","notice","gather","borrow"],answer:0},
  {clue:"The café has scarce supplies. Which word means the opposite of scarce?",words:["abundant","valuable","fresh","limited"],answer:0},
  {clue:"Mây postponed the flight. What did Mây do?",words:["delayed it","cancelled it","completed it","repeated it"],answer:0},
  {clue:"Catch the word that fits: We must ___ a decision before sunset.",words:["make","do","take away","give"],answer:0},
  {clue:"A reliable friend keeps their promises. Which word is closest to reliable?",words:["dependable","confident","generous","curious"],answer:0},
  {clue:"The bridge is temporary. What does that tell you?",words:["It will not last forever","It is unsafe","It is unfinished","It is made of wood"],answer:0},
  {clue:"Catch the word that fits: The rain was ___, so we stayed inside.",words:["heavy","large","strongly","high"],answer:0},
  {clue:"Sỏi inspected the bridge before crossing. What did Sỏi do?",words:["examined it closely","crossed it quickly","built it carefully","avoided it entirely"],answer:0},
  {clue:"The two paths are identical. What does identical mean?",words:["exactly the same","close together","equally long","both safe"],answer:0},
  {clue:"Bông reluctantly left the library. How did Bông feel?",words:["unwilling to leave","eager to leave","unable to leave","afraid to enter"],answer:0},
  {clue:"Although it was cloudy, the flight continued. What happened?",words:["They flew despite clouds","Clouds stopped the flight","They waited for sunshine","They flew because of clouds"],answer:0},
];
export function challengeClue(c:ChallengeState,round:number):WordClue{
  const pool=c.level==="expert"?wordClues.slice(4):wordClues;
  const clue=shuffled(pool,c.seed)[round%pool.length],order=shuffled([0,1,2,3],c.seed+round*31+7);
  return {clue:clue.clue,words:order.map(id=>clue.words[id]),answer:order.indexOf(clue.answer)};
}
export function challengeMelody(c:ChallengeState,round:number){
  const count=round+(c.level==="expert"?4:3);
  return Array.from({length:count},(_,i)=>seedNumber(`${c.seed}:${round}:note:${i}`)%4);
}
export const gardenOrder=(c:ChallengeState,round:number)=>({seed:shuffled([0,1,2],c.seed)[round],water:1+seedNumber(`${c.seed}:${round}:water`)%(c.level==="expert"?3:2)});
export const parcelRoute=(c:ChallengeState,round:number)=>shuffled([0,1,2],seedNumber(`${c.seed}:${round}:route`)).slice(0,c.level==="expert"?3:2);
export const parcelClues=["the place that lends stories","the place that bakes bread","the place that shelters growing plants"];
const colours=[
  {name:"lime",recipe:[1,1,2],hex:"#C2C668"},{name:"coral",recipe:[0,0,1],hex:"#DE9D75"},
  {name:"lavender",recipe:[0,2,3],hex:"#C5ADD0"},{name:"peach",recipe:[0,1,3],hex:"#E7BE96"},
  {name:"sea green",recipe:[1,2,2],hex:"#91B8A4"},{name:"rose",recipe:[0,2,0],hex:"#CA91AB"},
];
export function colourOrder(c:ChallengeState,round:number){const colour=shuffled(colours,c.seed)[round];return {...colour,name:c.level==="expert"?`pastel ${colour.name}`:colour.name,recipe:[...colour.recipe,...(c.level==="expert"?[3]:[])]};}
export const challengeDescription:Record<FestivalKind,[string,string]>={
  bubble:["Fresh context clues, shuffled answers and 24 seconds per catch.","Closer meanings, moving bubbles and 16 seconds per catch."],
  garden:["Match the seed, plant it, then water it the requested number of times.","Remember the planting order after it disappears; up to three waterings."],
  echo:["A new 3–7 note melody every round. Replays use assistance stars.","Faster 4–8 note melodies, with 12 seconds to answer."],
  tea:["Visiting friends and narrower steeping bands. Recipe cards use assistance stars.","Read indirect orders, catch a 0.6-second brewing band and serve within 30 seconds."],
  parcel:["Plan a two-stop delivery from place clues for each parcel.","Remember three stops after the route disappears; deliver in order."],
  hop:["Collect at least one feather before the final ring of each trail.","All three feathers are required; stronger wind and moving rings change the route."],
  colour:["Measure three paint drops to match a new shade; duplicate colours matter.","Balance four drops for pastel shades within 30 seconds."],
  bridge:["Shuffled starting rotations and a turn allowance: plan before rotating.","Tighter turn allowances and 60 seconds to connect the banks."],
};
