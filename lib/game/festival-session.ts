import type { FestivalGame } from "./festival";
import type { Expression } from "./personalities";

export type ArenaObject={id:number;x:number;z:number;label:string;colour:string;shape:"bubble"|"seed"|"bed"|"stone"|"cup"|"house"|"parcel"|"ring"|"paint"|"tile";rotation?:number;ports?:number[]};
export type FairState={phase:"ready"|"play"|"win"|"lose";round:number;hearts:number;score:number;prompt:string;feedback:string;selection:number[];carrying:number|null;lit:number;listening:boolean;emotion:Expression;revision:number;elapsed:number};
const colours=["#EE947D","#F2CC71","#81B7D6","#FDF4D7"];
const bubbles=[
  {clue:"Catch a word that means a small road.",words:["path","cloud","spoon","bed"],answer:0},
  {clue:"Catch something you can drink.",words:["leaf","tea","book","bell"],answer:1},
  {clue:"Catch the opposite of cold.",words:["slow","quiet","warm","blue"],answer:2},
  {clue:"Catch a word for helping something grow.",words:["close","forget","sleep","nurture"],answer:3},
  {clue:"Catch the opposite of alone.",words:["together","under","empty","late"],answer:0},
];
const seeds=["Sunflower","Bluebell","Rose"],seedColours=["#F6CB66","#8CBADD","#EE9FAC"];
const recipes=[[0,1,2],[0,3,2],[0,1,3]],ingredients=["Tea","Milk","Honey","Mint"];
const addresses=[{place:"Library",clue:"Deliver this book to the library."},{place:"Bakery",clue:"Deliver this flour to the bakery."},{place:"Greenhouse",clue:"Deliver these seeds to the greenhouse."}];
const mixes=[{name:"orange",pair:[0,1]},{name:"green",pair:[1,2]},{name:"purple",pair:[0,2]},{name:"pink",pair:[0,3]}];
const sequence=[0,2,1,3,0,1,2];
// N/E/S/W = 0/1/2/3. Solved paths have a reciprocal connection at every edge.
const puzzles=[
  {entry:1,exit:1,ports:[[0,1],[0,2],[1,2],[1,3],[1,3],[1,3],[0,1],[0,2],[0,3]],turns:[1,1,2,1,1,1,2,0,2]},
  {entry:2,exit:0,ports:[[1,2],[1,3],[1,3],[0,2],[0,1],[0,2],[0,3],[0,2],[0,1]],turns:[1,1,1,1,2,1,1,1,2]},
  {entry:0,exit:2,ports:[[1,3],[2,3],[0,1],[1,2],[0,3],[0,2],[0,1],[1,3],[1,3]],turns:[1,1,2,2,1,1,1,1,1]},
];
export const hopPoints=[{x:-3,z:1},{x:-3,z:-1.5},{x:0,z:-2.8},{x:3,z:-1.5},{x:3,z:1},{x:0,z:2.5}];
export const hopPuddles=[{x:-3,z:2.2},{x:-3,z:-.1},{x:-1.45,z:-2.2},{x:1.6,z:-2.2},{x:3,z:-.15},{x:1.5,z:1.8}];

/** One session owns progression and input gates; React and the 3D view share it. */
export class FestivalSession {
  state:FairState={phase:"ready",round:0,hearts:3,score:0,prompt:"",feedback:"",selection:[],carrying:null,lit:-1,listening:false,emotion:"happy",revision:0,elapsed:0};
  rotations:number[]=[];
  bridgePath:number[]=[];
  private wait=0;
  private nextRound=false;
  private echoClock=0;
  private echoStep=-1;
  private echoAnswer=0;
  private lastHazard=0;
  constructor(public game:FestivalGame,private changed:(state:FairState)=>void,public tone:(index:number)=>void=()=>{}){}
  private emit(){this.state={...this.state,selection:[...this.state.selection],revision:this.state.revision+1};this.changed(this.state);}
  start(){this.state={phase:"play",round:0,hearts:3,score:0,prompt:"",feedback:"",selection:[],carrying:null,lit:-1,listening:false,emotion:"happy",revision:0,elapsed:0};this.wait=0;this.nextRound=false;this.prepare();}
  private prepare(){
    const s=this.state,g=this.game;s.selection=[];s.carrying=null;s.feedback="";s.emotion="curious";
    if(g.kind==="bubble")s.prompt=bubbles[s.round].clue;
    if(g.kind==="garden")s.prompt=`Plant a ${seeds[s.round].toLowerCase()} in the empty bed.`;
    if(g.kind==="echo"){s.prompt=`Remember ${s.round+2} notes, then play them back.`;this.replay(false);}
    if(g.kind==="tea")s.prompt=`Recipe: ${recipes[s.round].map(i=>ingredients[i]).join(" → ")}.`;
    if(g.kind==="parcel")s.prompt=addresses[s.round].clue;
    if(g.kind==="hop")s.prompt=`Jump through ring ${s.round+1} of 6. Avoid the rose puddles!`;
    if(g.kind==="colour")s.prompt=`Mix two paints to make ${mixes[s.round].name}.`;
    if(g.kind==="bridge"){const puzzle=puzzles[s.round];this.rotations=[...puzzle.turns];s.prompt=`Connect entrance ${puzzle.entry*3+1} to exit ${puzzle.exit*3+3}. Rotate tiles, then send the boat.`;}
    this.emit();
  }
  objects():ArenaObject[]{
    const s=this.state,r=Math.min(s.round,this.game.rounds-1),spread=(id:number)=>({x:(id-1.5)*2.15,z:-.5});
    switch(this.game.kind){
      case "bubble":return bubbles[r].words.map((label,id)=>({id,...spread(id),label,colour:colours[id],shape:"bubble"}));
      case "garden":return [...seeds.map((label,id)=>({id,x:(id-1)*3,z:-2,label,colour:seedColours[id],shape:"seed" as const})),{id:3,x:0,z:2,label:"Garden bed",colour:"#8BAC71",shape:"bed"}];
      case "echo":return colours.map((colour,id)=>({id,...spread(id),label:`${id+1} · ${["Dew","Leaf","Rain","Sun"][id]}`,colour,shape:"stone"}));
      case "tea":return ingredients.map((label,id)=>({id,...spread(id),label,colour:["#B88359","#FFF2D7","#E8BA61","#9BC997"][id],shape:"cup"}));
      case "parcel":return [...addresses.map(({place},id)=>({id,x:(id-1)*3.5,z:-2,label:place,colour:colours[id],shape:"house" as const})),{id:3,x:0,z:2.5,label:"Post box",colour:"#D29C76",shape:"parcel"}];
      case "hop":return hopPoints.map((p,id)=>({id,...p,label:`${id+1}`,colour:id===r?"#FFE09A":"#BED9D4",shape:"ring"}));
      case "colour":return ["Red","Yellow","Blue","White"].map((label,id)=>({id,...spread(id),label,colour:colours[id],shape:"paint"}));
      case "bridge":return puzzles[r].ports.map((ports,id)=>({id,x:(id%3-1)*1.65,z:(Math.floor(id/3)-1)*1.65,label:`${id+1}`,colour:"#D3B28A",shape:"tile",rotation:(this.rotations[id]??0)*Math.PI/2,ports}));
    }
  }
  get mobile(){return ["bubble","garden","parcel","hop"].includes(this.game.kind);}
  get canAct(){return this.state.phase==="play"&&this.wait<=0&&!this.state.listening;}
  get checkpoint(){return this.state.round?hopPoints[Math.min(this.state.round-1,5)]:{x:-3,z:3.7};}
  choose(id:number){
    if(!this.canAct)return;const s=this.state;
    if(this.game.kind==="bubble"){if(id===bubbles[s.round].answer){s.selection=[id];this.success();}else this.miss(`That was “${bubbles[s.round].words[id]}”. Read the clue and try again.`);}
    if(this.game.kind==="garden"){
      if(id<3){s.carrying=id;s.feedback=`Carrying a ${seeds[id].toLowerCase()} seed. Take it to the bed.`;this.emit();}
      else if(s.carrying===null){s.feedback="Pick up a seed first.";this.emit();}
      else if(s.carrying===s.round)this.success();else{s.carrying=null;this.miss(`This bed needs a ${seeds[s.round].toLowerCase()}. Choose that seed next.`);}
    }
    if(this.game.kind==="echo"){
      this.tone(id);s.lit=id;this.echoClock=-.22;
      if(id===sequence[this.echoAnswer]){this.echoAnswer++;s.feedback=`${this.echoAnswer} / ${s.round+2} notes`;if(this.echoAnswer===s.round+2)this.success();else this.emit();}
      else {this.miss("A different note slipped in. Listen once more.");if(s.phase==="play")this.replay();}
    }
    if(this.game.kind==="tea"||this.game.kind==="colour"){
      if(s.selection.length<(this.game.kind==="tea"?3:2)){s.selection.push(id);s.feedback=this.game.kind==="tea"?s.selection.map(i=>ingredients[i]).join(" → "):s.selection.map(i=>["Red","Yellow","Blue","White"][i]).join(" + ");this.tone(id);this.emit();}
    }
    if(this.game.kind==="parcel"){
      if(id===3){s.carrying=s.round;s.feedback=addresses[s.round].clue;this.emit();}
      else if(s.carrying===null){s.feedback="Collect the parcel at the post box first.";this.emit();}
      else if(id===s.round)this.success();else this.miss(`This is the ${addresses[id].place.toLowerCase()}. Your parcel belongs at the ${addresses[s.round].place.toLowerCase()}.`);
    }
    if(this.game.kind==="bridge"){this.rotations[id]=(this.rotations[id]+1)%4;this.tone(id%4);this.emit();}
  }
  submit(){
    if(!this.canAct)return;const s=this.state;
    if(this.game.kind==="tea"){
      if(s.selection.length<3){s.feedback="The recipe needs three ingredients.";this.emit();return;}
      if(s.selection.every((value,i)=>value===recipes[s.round][i]))this.success();else{s.selection=[];this.miss("The layers are out of order. Follow the recipe from left to right.");}
    }
    if(this.game.kind==="colour"){
      if(s.selection.length<2){s.feedback="Choose two paints first.";this.emit();return;}
      if([...s.selection].sort().join()===mixes[s.round].pair.join())this.success();else{s.selection=[];this.miss(`That mix does not make ${mixes[s.round].name}. Check the colour recipe in How to play.`);}
    }
    if(this.game.kind==="bridge"){
      const p=puzzles[s.round],ports=p.ports.map((values,i)=>values.map(value=>(value+this.rotations[i])%4));
      const start=p.entry*3,goal=p.exit*3+2,seen=new Set<number>(),came=new Map<number,number>(),queue=ports[start].includes(3)?[start]:[];
      while(queue.length){const at=queue.shift()!;if(seen.has(at))continue;seen.add(at);for(const dir of ports[at]){const row=Math.floor(at/3)+[-1,0,1,0][dir],col=at%3+[0,1,0,-1][dir];if(row<0||row>2||col<0||col>2)continue;const next=row*3+col;if(ports[next].includes((dir+2)%4)&&!seen.has(next)&&!came.has(next)){came.set(next,at);queue.push(next);}}}
      if(seen.has(goal)&&ports[goal].includes(1)){this.bridgePath=[goal];let at=goal;while(at!==start){at=came.get(at)!;this.bridgePath.unshift(at);}this.success(2.8);}else this.miss("The boat found a gap. Line up the wooden paths between neighbouring tiles.");
    }
  }
  clear(){if(!this.canAct)return;this.state.selection=[];this.state.feedback="A clean start for this recipe.";this.emit();}
  replay(emit=true){if(this.game.kind!=="echo"||this.state.phase!=="play")return;this.state.listening=true;this.state.lit=-1;this.echoClock=0;this.echoStep=-1;this.echoAnswer=0;if(emit)this.emit();}
  private success(duration=1.1){this.state.score+=100;this.state.emotion="joy";this.state.feedback=["Lovely!","You did it!","A little more sunshine!"][this.state.round%3];this.wait=duration;this.nextRound=true;this.state.listening=false;this.tone(4);this.emit();}
  private miss(message:string){this.state.hearts--;this.state.emotion="sad";this.state.feedback=message;this.wait=.8;this.nextRound=false;if(this.state.hearts<=0){this.state.phase="lose";this.state.listening=false;}this.emit();}
  tick(dt:number){
    if(this.state.phase!=="play")return;this.state.elapsed+=dt;this.lastHazard=Math.max(0,this.lastHazard-dt);
    if(this.wait>0){this.wait-=dt;if(this.wait<=0&&this.nextRound){this.nextRound=false;this.state.round++;if(this.state.round>=this.game.rounds){this.state.phase="win";this.state.score+=this.state.hearts*25;this.emit();}else this.prepare();}else if(this.wait<=0){this.state.emotion="curious";this.emit();}return;}
    if(this.game.kind==="echo"){
      this.echoClock+=dt;
      if(this.state.listening){const step=Math.floor(this.echoClock/.72),count=this.state.round+2;
        if(step>=count){this.state.listening=false;this.state.lit=-1;this.state.feedback="Your turn!";this.emit();}
        else if(step!==this.echoStep){this.echoStep=step;this.state.lit=sequence[step];this.tone(sequence[step]);this.emit();}
        else if(this.echoClock% .72>.46&&this.state.lit!==-1){this.state.lit=-1;this.emit();}
      } else if(this.echoClock>=0&&this.state.lit!==-1){this.state.lit=-1;this.emit();}
    }
  }
  touchRing(id:number,height:number){if(this.canAct&&this.game.kind==="hop"&&id===this.state.round&&height>.25)this.success();}
  hazard(){if(!this.canAct||this.lastHazard>0)return false;this.lastHazard=1.6;this.miss("Splash! Back to your checkpoint. Jump over the rose puddles.");return true;}
}
