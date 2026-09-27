import { bridgePath } from "./bridge-path";
import type { FestivalGame } from "./festival";
import type { Expression } from "./personalities";
import { courseById, type Course } from "./fair-courses";
import { createTeaService, teaGuest, teaIngredients, teaStrengths, validTeaService, type TeaService } from "./tea-service";
import { newChallenge, validChallenge, roundSeconds, challengeClue, challengeMelody, gardenOrder, parcelRoute, parcelClues, colourOrder, shuffled, expertTeaRequests, type ChallengeState } from "./challenge";

export type ArenaObject={id:number;x:number;z:number;label:string;colour:string;shape:"bubble"|"seed"|"bed"|"stone"|"cup"|"house"|"parcel"|"ring"|"paint"|"tile";rotation?:number;ports?:number[]};
export type FairState={phase:"ready"|"play"|"win"|"lose";round:number;hearts:number;score:number;prompt:string;feedback:string;selection:number[];carrying:number|null;lit:number;listening:boolean;emotion:Expression;revision:number;elapsed:number;feathers:number[];tea?:TeaService;challenge?:ChallengeState};
export type FairCheckpoint = {version:1;gameId:string;courseId:string;state:FairState;rotations:number[];wait:number;nextRound:boolean;echoClock:number;echoStep:number;echoAnswer:number;lastHazard:number};
const colours=["#EE947D","#F2CC71","#81B7D6","#FDF4D7"];
const bubbles=[
  {clue:"Catch a word that means a small road.",words:["path","cloud","spoon","bed"],answer:0},
  {clue:"Catch something you can drink.",words:["leaf","tea","book","bell"],answer:1},
  {clue:"Catch the opposite of cold.",words:["slow","quiet","warm","blue"],answer:2},
  {clue:"Catch a word for helping something grow.",words:["close","forget","sleep","nurture"],answer:3},
  {clue:"Catch the opposite of alone.",words:["together","under","empty","late"],answer:0},
];
const seeds=["Sunflower","Bluebell","Rose"],seedColours=["#F6CB66","#8CBADD","#EE9FAC"];
const recipes=[[0,1,2],[0,3,2],[0,1,3]],ingredients=teaIngredients;
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
  state:FairState={phase:"ready",round:0,hearts:3,score:0,prompt:"",feedback:"",selection:[],carrying:null,lit:-1,listening:false,emotion:"happy",revision:0,elapsed:0,feathers:[]};
  readonly course:Course|undefined;
  rotations:number[]=[];
  bridgePath:number[]=[];
  private wait=0;
  private nextRound=false;
  private echoClock=0;
  private echoStep=-1;
  private echoAnswer=0;
  private lastHazard=0;
  constructor(public game:FestivalGame,private changed:(state:FairState)=>void,public tone:(index:number)=>void=()=>{},courseId?:string){this.course=game.kind==="hop"?courseById(courseId||"cloud-01"):undefined;}
  private emit(){this.state={...this.state,challenge:this.state.challenge?{...this.state.challenge}:undefined,selection:[...this.state.selection],tea:this.state.tea?{...this.state.tea,guests:[...this.state.tea.guests]}:undefined,revision:this.state.revision+1};this.changed(this.state);}
  start(teaRunId?:string,challenge?:{level:ChallengeState["level"];runId:string}){this.state={phase:"play",round:0,hearts:3,score:0,prompt:"",feedback:"",selection:[],carrying:null,lit:-1,listening:false,emotion:"happy",revision:0,elapsed:0,feathers:[],tea:this.game.kind==="tea"&&(teaRunId||challenge)?createTeaService(teaRunId||challenge!.runId):undefined,challenge:challenge?newChallenge(challenge.level,challenge.runId):undefined};this.wait=0;this.nextRound=false;this.lastHazard=0;this.bridgePath=[];this.prepare();}
  snapshot():FairCheckpoint|null {
    if(this.state.phase!=="play"&&this.state.phase!=="win")return null;
    return {version:1,gameId:this.game.id,courseId:this.course?.id||"",state:{...this.state,challenge:this.state.challenge?{...this.state.challenge}:undefined,tea:this.state.tea?{...this.state.tea,guests:[...this.state.tea.guests]}:undefined,selection:[...this.state.selection],feathers:[...this.state.feathers]},rotations:[...this.rotations],wait:Math.max(0,this.wait),nextRound:this.nextRound,echoClock:this.echoClock,echoStep:this.echoStep,echoAnswer:this.echoAnswer,lastHazard:this.lastHazard};
  }
  restore(value:unknown):boolean {
    const c=value as FairCheckpoint|null,s=c?.state;
    if(!c||c.version!==1||c.gameId!==this.game.id||c.courseId!==(this.course?.id||"")||!s||!["play","win"].includes(s.phase))return false;
    const integer=(n:number,min:number,max:number)=>Number.isInteger(n)&&n>=min&&n<=max;
    const finite=(n:number,min:number,max:number)=>Number.isFinite(n)&&n>=min&&n<=max;
    const ids=(v:unknown,max:number)=>Array.isArray(v)&&v.every(n=>integer(n,0,max));
    if(!integer(s.round,s.phase==="win"?this.game.rounds:0,s.phase==="win"?this.game.rounds:this.game.rounds-1)||!integer(s.hearts,1,3)||!finite(s.elapsed,0,86400)||!integer(s.score,0,this.game.rounds*100+75)||
      !ids(s.selection,8)||s.selection.length>4||!ids(s.feathers,2)||new Set(s.feathers).size!==s.feathers.length||
      !(s.carrying===null||integer(s.carrying,0,3))||!integer(s.lit,-1,3)||typeof s.listening!=="boolean"||
      typeof s.prompt!=="string"||typeof s.feedback!=="string"||s.prompt.length>400||s.feedback.length>400||
      !["happy","joy","curious","thinking","surprised","sad","sleepy","love"].includes(s.emotion)||
      !ids(c.rotations,3)||c.rotations.length>9||!finite(c.wait,0,3)||typeof c.nextRound!=="boolean"||
      !finite(c.echoClock,-1,86400)||!integer(c.echoStep,-1,8)||!integer(c.echoAnswer,0,8)||!finite(c.lastHazard,0,1.6))return false;
    if(s.challenge!==undefined&&(!validChallenge(s.challenge)||s.challenge.remaining>roundSeconds(this.game.kind,s.challenge.level)||this.game.kind==="tea"&&!s.tea))return false;
    const stars=Math.max(1,s.hearts-Math.min(2,s.challenge?.assists||0));
    if(s.score!==(s.round+Number(c.nextRound))*100+(s.phase==="win"?stars*25:0)||c.nextRound&&c.wait<=0||this.game.kind==="bridge"&&c.rotations.length!==9)return false;
    if(s.tea!==undefined&&(this.game.kind!=="tea"||!validTeaService(s.tea)||s.tea.stage!=="mixing"&&s.selection.length!==3||!ids(s.selection,3)))return false;
    this.state={...s,challenge:s.challenge?{...s.challenge}:undefined,tea:s.tea?{...s.tea,guests:[...s.tea.guests]}:undefined,selection:[...s.selection],feathers:[...s.feathers],revision:0};this.rotations=[...c.rotations];
    this.wait=c.wait;this.nextRound=c.nextRound;this.echoClock=c.echoClock;this.echoStep=c.echoStep;this.echoAnswer=c.echoAnswer;this.lastHazard=c.lastHazard;
    this.bridgePath=this.game.kind==="bridge"&&this.nextRound?bridgePath(this.puzzle.ports,this.rotations,this.puzzle.entry,this.puzzle.exit):[];this.emit();return true;
  }
  private prepare(){
    const s=this.state,g=this.game;s.selection=[];s.carrying=null;s.feedback="";s.emotion="curious";
    if(s.challenge)s.challenge={...s.challenge,remaining:roundSeconds(g.kind,s.challenge.level),moves:0,step:0,hint:false};
    if(g.kind==="bubble")s.prompt=this.bubble.clue;
    if(g.kind==="garden")s.prompt=s.challenge?`Plant a ${seeds[this.garden.seed].toLowerCase()}, water it ${this.garden.water} time${this.garden.water===1?"":"s"}, then return to the bed to check it.`:`Plant a ${seeds[s.round].toLowerCase()} in the empty bed.`;
    if(g.kind==="echo"){s.prompt=`Remember ${this.melody.length} notes, then play them back.`;this.replay(false);}
    if(g.kind==="tea"){
      if(s.tea){s.tea={...s.tea,stage:"mixing",seconds:0,hint:false};s.prompt=s.challenge?.level==="expert"?expertTeaRequests[this.customer!.id]:this.customer!.request;}
      else s.prompt=`Recipe: ${recipes[s.round].map(i=>ingredients[i]).join(" → ")}.`;
    }
    if(g.kind==="parcel")s.prompt=s.challenge?`Collect one parcel. Deliver in order: ${this.deliveryRoute.map(id=>parcelClues[id]).join(" → ")}.`:addresses[s.round].clue;
    if(g.kind==="hop")s.prompt=this.course?.high.includes(s.round)?`Double jump through HIGH ring ${s.round+1} of 6.`:`Jump through ring ${s.round+1} of 6. Avoid the rose puddles!`;
    if(g.kind==="colour")s.prompt=s.challenge?`Mix exactly ${this.paintOrder.recipe.length} drops to make ${this.paintOrder.name}.`:`Mix two paints to make ${mixes[s.round].name}.`;
    if(g.kind==="bridge"){const puzzle=this.puzzle;this.rotations=this.initialRotations;s.prompt=`Connect entrance ${puzzle.entry*3+1} to exit ${puzzle.exit*3+3}. Rotate tiles, then send the boat.`;}
    this.emit();
  }
  objects():ArenaObject[]{
    const s=this.state,r=Math.min(s.round,this.game.rounds-1),spread=(id:number)=>({x:(id-1.5)*2.15,z:-.5});
    switch(this.game.kind){
      case "bubble":return this.bubble.words.map((label,id)=>({id,...this.bubblePoint(id),label,colour:colours[id],shape:"bubble"}));
      case "garden":return [...seeds.map((label,id)=>({id,x:(id-1)*3,z:-2,label,colour:seedColours[id],shape:"seed" as const})),{id:3,x:0,z:2,label:"Garden bed",colour:"#8BAC71",shape:"bed"},...(s.challenge?[{id:4,x:3,z:2,label:"Water",colour:"#81B7D6",shape:"cup" as const}]:[])];
      case "echo":return colours.map((colour,id)=>({id,...spread(id),label:`${id+1} · ${["Dew","Leaf","Rain","Sun"][id]}`,colour,shape:"stone"}));
      case "tea":return ingredients.map((label,id)=>({id,...spread(id),label,colour:["#B88359","#FFF2D7","#E8BA61","#9BC997"][id],shape:"cup"}));
      case "parcel":return [...addresses.map(({place},id)=>({id,x:(id-1)*3.5,z:-2,label:place,colour:colours[id],shape:"house" as const})),{id:3,x:0,z:2.5,label:"Post box",colour:"#D29C76",shape:"parcel"}];
      case "hop":return (this.course?.rings||hopPoints.map(p=>[p.x,p.z])).map((_,id)=>({id,...this.ringPoint(id),label:`${id+1}`,colour:id===r?"#FFE09A":"#BED9D4",shape:"ring"}));
      case "colour":return ["Red","Yellow","Blue","White"].map((label,id)=>({id,...spread(id),label,colour:colours[id],shape:"paint"}));
      case "bridge":return this.puzzle.ports.map((ports,id)=>({id,x:(id%3-1)*1.65,z:(Math.floor(id/3)-1)*1.65,label:`${id+1}`,colour:"#D3B28A",shape:"tile",rotation:(this.rotations[id]??0)*Math.PI/2,ports}));
    }
  }
  get mobile(){return ["bubble","garden","parcel","hop"].includes(this.game.kind);}
  get resultStars(){return Math.max(1,this.state.hearts-Math.min(2,this.state.challenge?.assists||0));}
  get bubble(){return this.state.challenge?challengeClue(this.state.challenge,Math.min(this.state.round,4)):bubbles[Math.min(this.state.round,4)];}
  bubblePoint(id:number){return {x:(id-1.5)*2.15,z:-.5+(this.state.challenge?.level==="expert"?Math.sin(this.state.elapsed*.9+id*1.7)*.65:0)};}
  get garden(){return this.state.challenge?gardenOrder(this.state.challenge,Math.min(this.state.round,2)):{seed:this.state.round,water:0};}
  get melody(){return this.state.challenge?challengeMelody(this.state.challenge,Math.min(this.state.round,4)):sequence.slice(0,this.state.round+2);}
  get noteSeconds(){return this.state.challenge?.level==="expert"?.5:this.state.challenge?.level==="adventure"?.62:.72;}
  get deliveryRoute(){return this.state.challenge?parcelRoute(this.state.challenge,Math.min(this.state.round,2)):[this.state.round];}
  get paintOrder(){return this.state.challenge?colourOrder(this.state.challenge,Math.min(this.state.round,3)):{name:mixes[Math.min(this.state.round,3)].name,recipe:mixes[Math.min(this.state.round,3)].pair,hex:""};}
  get puzzleIndex(){return this.state.challenge?shuffled([0,1,2],this.state.challenge.seed)[Math.min(this.state.round,2)]:Math.min(this.state.round,2);}
  get puzzle(){return puzzles[this.puzzleIndex];}
  get initialRotations(){
    const c=this.state.challenge,p=this.puzzle;if(!c)return [...p.turns];
    const turns=p.turns.map((_,id)=>shuffled([0,1,2,3],c.seed+this.state.round*47+id*19)[0]);
    // A fresh puzzle must not already contain a solved crossing.
    while(bridgePath(p.ports,turns,p.entry,p.exit).length)turns[p.entry*3]=(turns[p.entry*3]+1)%4;
    return turns;
  }
  get turnBudget(){const path=[[3,4,5],[6,3,0,1,2],[0,1,4,3,6,7,8]][this.puzzleIndex];return path.reduce((sum,id)=>sum+(4-this.initialRotations[id])%4,0)+(this.state.challenge?.level==="expert"?2:5);}
  get feathersRequired(){return this.state.challenge?.level==="expert"?3:this.state.challenge?1:0;}
  get brewingBand(){
    if(!this.customer)return undefined;const base=teaStrengths[this.customer.strength],width=this.state.challenge?.level==="expert"?.6:this.state.challenge?1:base.to-base.from,mid=(base.from+base.to)/2;
    return {name:base.name,from:Number((mid-width/2).toFixed(2)),to:Number((mid+width/2).toFixed(2))};
  }
  get visiblePrompt(){
    const c=this.state.challenge;
    if(c?.level==="expert"&&["garden","parcel"].includes(this.game.kind)&&!c.hint&&c.remaining<roundSeconds(this.game.kind,c.level)-7)return "Remember your order. Use Recall order if you need another look.";
    return this.state.prompt;
  }
  assist(){const c=this.state.challenge;if(!this.canAct||!c)return;c.assists=Math.min(99,c.assists+1);c.hint=true;this.emit();}
  get canAct(){return this.state.phase==="play"&&this.wait<=0&&!this.state.listening;}
  get customer(){return teaGuest(this.state.tea,this.state.round);}
  get canChoose(){return this.canAct&&(!this.state.tea||this.state.tea.stage==="mixing");}
  get checkpoint(){return this.state.round?this.ringPoint(Math.min(this.state.round-1,5)):this.course?.spawn||{x:-3,z:3.7};}
  get doubleJump(){return !!this.course&&(this.state.challenge?.level==="expert"||this.course.high.length>0||this.course.drift>0||this.course.wind>0);}
  get puddles(){return this.course?this.course.puddles.map(([x,z])=>({x,z})):hopPuddles;}
  get wind(){return ((this.course?.wind||0)*(this.state.challenge?.level==="expert"?1.5:1)+(this.course&&this.state.challenge?.level==="expert"?.3:0))*Math.sin(this.state.elapsed*.75);}
  ringPoint(id:number){const point=this.course?.rings[id];const base=point?{x:point[0],z:point[1]}:hopPoints[id];const drift=(this.course?.drift||0)+(this.state.challenge?.level==="expert"?.2:0);return {x:base.x+drift*Math.sin(this.state.elapsed*.9+id),z:base.z};}
  ringHeight(id:number){return this.course?.high.includes(id)?1.65:1.05;}
  collectFeather(id:number,height:number){if(!this.canAct||!this.course||!Number.isInteger(id)||!this.course.feathers[id]||height<.2||this.state.feathers.includes(id))return;this.state.feathers.push(id);this.state.feedback=`A sky feather! ${this.state.feathers.length} / 3 found.`;this.tone(3);this.emit();}
  choose(id:number){
    if(!this.canChoose||!Number.isInteger(id)||!this.objects().some(object=>object.id===id))return;const s=this.state;
    if(this.game.kind==="bubble"){if(id===this.bubble.answer){s.selection=[id];this.success();}else this.miss(`That was “${this.bubble.words[id]}”. Read the clue and try again.`);}
    if(this.game.kind==="garden"){
      if(s.challenge){
        const c=s.challenge,order=this.garden;
        if(id<3){if(c.step){s.feedback="This bed is planted. Water it, then check the bed.";this.emit();}else{s.carrying=id;s.feedback=`Carrying a ${seeds[id].toLowerCase()} seed.`;this.emit();}}
        else if(id===4){if(!c.step){s.feedback="Plant your seed before watering.";this.emit();}else{c.step++;s.feedback=`Watered ${c.step-1} time${c.step===2?"":"s"}. Return to the bed when ready.`;if(c.step>4){c.step=0;s.carrying=null;this.miss("Too much water! Replant and remember the requested amount.");}else this.emit();}}
        else if(!c.step){if(s.carrying===order.seed){c.step=1;s.carrying=null;s.feedback="Seed planted. Now fetch the water.";this.emit();}else{s.carrying=null;this.miss("Check the seed in your order before planting.");}}
        else if(c.step-1===order.water)this.success();else{c.step=0;this.miss("That plant needed a different amount of water. Start this bed again.");}
        return;
      }
      if(id<3){s.carrying=id;s.feedback=`Carrying a ${seeds[id].toLowerCase()} seed. Take it to the bed.`;this.emit();}
      else if(s.carrying===null){s.feedback="Pick up a seed first.";this.emit();}
      else if(s.carrying===s.round)this.success();else{s.carrying=null;this.miss(`This bed needs a ${seeds[s.round].toLowerCase()}. Choose that seed next.`);}
    }
    if(this.game.kind==="echo"){
      this.tone(id);s.lit=id;this.echoClock=-.22;
      if(id===this.melody[this.echoAnswer]){this.echoAnswer++;s.feedback=`${this.echoAnswer} / ${this.melody.length} notes`;if(this.echoAnswer===this.melody.length)this.success();else this.emit();}
      else {this.miss("A different note slipped in. Listen once more.");if(s.phase==="play")this.replay(false);}
    }
    if(this.game.kind==="tea"||this.game.kind==="colour"){
      if(s.selection.length<(this.game.kind==="tea"?3:this.paintOrder.recipe.length)){s.selection.push(id);s.feedback=this.game.kind==="tea"?s.selection.map(i=>ingredients[i]).join(" → "):s.selection.map(i=>["Red","Yellow","Blue","White"][i]).join(" + ");this.tone(id);this.emit();}
    }
    if(this.game.kind==="parcel"){
      if(s.challenge){
        const c=s.challenge,route=this.deliveryRoute;
        if(id===3){if(s.carrying===null){s.carrying=s.round;c.step=0;}s.feedback=`Parcel collected · ${c.step} / ${route.length} stops delivered.`;this.emit();}
        else if(s.carrying===null){s.feedback="Collect your parcel first.";this.emit();}
        else if(id===route[c.step]){c.step++;if(c.step===route.length)this.success();else{s.feedback=`Delivery ${c.step} complete. Remember the next stop.`;this.emit();}}
        else this.miss("That is not the next stop. Deliver in the requested order.");
        return;
      }
      if(id===3){s.carrying=s.round;s.feedback=addresses[s.round].clue;this.emit();}
      else if(s.carrying===null){s.feedback="Collect the parcel at the post box first.";this.emit();}
      else if(id===s.round)this.success();else this.miss(`This is the ${addresses[id].place.toLowerCase()}. Your parcel belongs at the ${addresses[s.round].place.toLowerCase()}.`);
    }
    if(this.game.kind==="bridge"){
      if(s.challenge){if(s.challenge.moves>=this.turnBudget){this.rotations=this.initialRotations;s.challenge.moves=0;this.miss("No turns left. The bridge has reset; plan a route before rotating.");return;}s.challenge.moves++;}
      this.rotations[id]=(this.rotations[id]+1)%4;this.tone(id%4);this.emit();
    }
  }
  submit(){
    if(!this.canAct)return;const s=this.state;
    if(this.game.kind==="tea"){
      if(s.selection.length<3){s.feedback="The recipe needs three ingredients.";this.emit();return;}
      if(s.tea){
        if(s.tea.stage!=="ready"){s.feedback="Start steeping, then lift the tea before serving.";this.emit();return;}
        const customer=this.customer!;
        if(!s.selection.every((value,i)=>value===customer.recipe[i])){this.resetTea();this.miss("This is a different recipe. Read your friend's order or open the recipe card.");}
        else if(s.tea.seconds<this.brewingBand!.from||s.tea.seconds>this.brewingBand!.to){this.resetTea();this.miss(`Your friend asked for ${teaStrengths[customer.strength].name.toLowerCase()} tea. Lift the tea inside the marked band.`);}
        else{this.success(2.8);this.state.feedback=customer.thanks;this.emit();}
        return;
      }
      if(s.selection.every((value,i)=>value===recipes[s.round][i]))this.success();else{s.selection=[];this.miss("The layers are out of order. Follow the recipe from left to right.");}
    }
    if(this.game.kind==="colour"){
      const recipe=this.paintOrder;
      if(s.selection.length<recipe.recipe.length){s.feedback=`Choose ${recipe.recipe.length} paint drops first.`;this.emit();return;}
      if([...s.selection].sort().join()===[...recipe.recipe].sort().join())this.success();else{s.selection=[];this.miss(`That mix does not make ${recipe.name}. Check the recipe card if you need help.`);}
    }
    if(this.game.kind==="bridge"){
      const p=this.puzzle,path=bridgePath(p.ports,this.rotations,p.entry,p.exit);
      if(path.length){this.bridgePath=path;this.success(2.8);}else this.miss("The boat found a gap. Line up the wooden paths between neighbouring tiles.");
    }
  }
  private resetTea(){this.state.selection=[];if(this.state.tea)this.state.tea={...this.state.tea,stage:"mixing",seconds:0};}
  clear(){if(!this.canAct)return;this.resetTea();this.state.feedback="A clean start for this recipe.";this.emit();}
  showTeaRecipe(){if(!this.canAct||!this.state.tea)return;if(!this.state.tea.hint&&this.state.challenge&&!this.state.challenge.hint)this.assist();this.state.tea.hint=!this.state.tea.hint;this.emit();}
  brewTea(){
    if(!this.canAct||!this.state.tea)return;const tea=this.state.tea;
    if(tea.stage==="mixing"){
      if(this.state.selection.length!==3)return;
      tea.stage="steeping";this.state.feedback="Watch the band. Lift the tea when it tastes just right.";
    }else if(tea.stage==="steeping"){
      tea.stage="ready";this.state.feedback="Tea lifted. Serve it, or empty the cup and try again.";
    }else return;
    this.emit();
  }
  replay(emit=true){if(this.game.kind!=="echo"||this.state.phase!=="play"||emit&&!this.canAct)return;if(emit&&this.state.challenge)this.assist();this.state.listening=true;this.state.lit=-1;this.echoClock=0;this.echoStep=-1;this.echoAnswer=0;if(emit)this.emit();}
  private success(duration=1.1){this.state.score+=100;this.state.emotion="joy";this.state.feedback=["Lovely!","You did it!","A little more sunshine!"][this.state.round%3];this.wait=duration;this.nextRound=true;this.state.listening=false;this.tone(4);this.emit();}
  private miss(message:string){this.state.hearts--;this.state.emotion="sad";this.state.feedback=message;this.wait=.8;this.nextRound=false;if(this.state.hearts<=0){this.state.phase="lose";this.state.listening=false;}this.emit();}
  tick(dt:number){
    if(this.state.phase!=="play"||!Number.isFinite(dt)||dt<=0)return;this.state.elapsed+=dt;this.lastHazard=Math.max(0,this.lastHazard-dt);
    if(this.wait>0){this.wait-=dt;if(this.wait<=0&&this.nextRound){this.nextRound=false;this.state.round++;if(this.state.round>=this.game.rounds){this.state.phase="win";this.state.score+=this.resultStars*25;this.emit();}else this.prepare();}else if(this.wait<=0){this.state.emotion="curious";this.emit();}return;}
    const challenge=this.state.challenge;
    if(challenge&&this.game.kind!=="hop"&&!this.state.listening){
      const before=Math.ceil(challenge.remaining);challenge.remaining=Math.max(0,challenge.remaining-dt);
      if(challenge.remaining===0){this.prepare();this.miss("Time ran out. This round has reset; plan your next attempt.");return;}
      if(Math.ceil(challenge.remaining)!==before)this.emit();
    }
    if(this.state.tea?.stage==="steeping"){
      const tea=this.state.tea,previous=Math.floor(tea.seconds*10);tea.seconds=Math.min(8,tea.seconds+dt);
      if(tea.seconds===8){tea.stage="ready";this.state.feedback="This cup steeped too long. Empty it to brew again before serving.";this.emit();}
      else if(Math.floor(tea.seconds*10)!==previous)this.emit();
    }
    if(this.game.kind==="echo"){
      this.echoClock+=dt;
      if(this.state.listening){const step=Math.floor(this.echoClock/this.noteSeconds),count=this.melody.length;
        if(step>=count){this.state.listening=false;this.state.lit=-1;this.state.feedback="Your turn!";this.emit();}
        else if(step!==this.echoStep){this.echoStep=step;this.state.lit=this.melody[step];this.tone(this.melody[step]);this.emit();}
        else if(this.echoClock%this.noteSeconds>this.noteSeconds*.64&&this.state.lit!==-1){this.state.lit=-1;this.emit();}
      } else if(this.echoClock>=0&&this.state.lit!==-1){this.state.lit=-1;this.emit();}
    }
  }
  touchRing(id:number,height:number){if(this.canAct&&this.game.kind==="hop"&&id===this.state.round&&height>(this.course?.high.includes(id)?1.05:.25)){
    if(id===5&&this.state.feathers.length<this.feathersRequired){const feedback=`Find ${this.feathersRequired} sky feather${this.feathersRequired===1?"":"s"} before the final ring.`;if(this.state.feedback!==feedback){this.state.feedback=feedback;this.emit();}return;}this.success();
  }}
  hazard(){if(!this.canAct||this.lastHazard>0)return false;this.lastHazard=1.6;this.miss("Splash! Back to your checkpoint. Jump over the rose puddles.");return true;}
}
