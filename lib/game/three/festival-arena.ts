import * as THREE from "three";
import { FestivalSession, hopPuddles, type ArenaObject } from "../festival-session";
import { ArtResources, label, mergeArt } from "./primitives";
import { createCompanion, type CompanionRig } from "./characters";
import { portraitLights } from "./portraits";

/** A small independent 3D playfield: articulated player, collisions, jumping and ray picking. */
export class FestivalArena {
  private art=new ArtResources();
  private scene=new THREE.Scene();
  private renderer:THREE.WebGLRenderer;
  private camera=new THREE.PerspectiveCamera(43,1,.1,70);
  private hero:CompanionRig;
  private hostRig:CompanionRig;
  private props:{data:ArenaObject;root:THREE.Group}[]=[];
  private propsArt=new ArtResources();
  private propRoot=new THREE.Group();
  private decoration=new THREE.Group();
  private resize:ResizeObserver;
  private keys=new Set<string>();
  private touch={x:0,z:0};
  private destination:{x:number;z:number;id?:number;via?:{x:number;z:number}[]}|null=null;
  private contacts=new Set<number>();
  private velocity=new THREE.Vector2();
  private vy=0;
  private jumping=0;
  private last=0;
  private time=0;
  private frame=0;
  private round=-1;
  private revision=-1;
  private paused=false;
  private disposed=false;
  private completedFlowers:THREE.Group[]=[];
  private carried=new THREE.Group();
  private recipeCup=new THREE.Group();
  private layers:THREE.Mesh[]=[];
  private painted:THREE.Mesh[]=[];
  private seedling=new THREE.Group();
  private boat=new THREE.Group();
  private successTime=0;
  private reduced=window.matchMedia("(prefers-reduced-motion: reduce)");
  private audio:AudioContext|null=null;
  sound=true;
  constructor(private container:HTMLDivElement,public session:FestivalSession,private onError:(message:string)=>void){
    this.renderer=new THREE.WebGLRenderer({antialias:true,alpha:false});
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.6));this.renderer.outputColorSpace=THREE.SRGBColorSpace;
    this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.08;
    const gl=this.renderer.getContext(),debug=gl.getExtension("WEBGL_debug_renderer_info");
    const software=debug&&/swiftshader|llvmpipe|software/i.test(String(gl.getParameter(debug.UNMASKED_RENDERER_WEBGL)));
    if(software)this.renderer.setPixelRatio(1);
    this.renderer.shadowMap.enabled=!software;this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;
    const canvas=this.renderer.domElement;canvas.tabIndex=0;canvas.setAttribute("role","img");canvas.setAttribute("aria-label",`${session.game.name}: interactive 3D playfield. Keyboard and touch controls are below.`);container.appendChild(canvas);
    this.scene.background=new THREE.Color("#E0EEE5");portraitLights(this.scene);
    const sun=new THREE.DirectionalLight("#FFF3D5",1.5);sun.position.set(-4,12,6);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);Object.assign(sun.shadow.camera,{left:-8,right:8,top:8,bottom:-8,near:1,far:30});sun.shadow.normalBias=.025;this.scene.add(sun);
    const floor=this.art.mesh(this.decoration,"cylinder",session.game.kind==="bridge"||session.game.kind==="echo"?"#9DC9C6":"#B8CEA0",[0,-.3,0],[6.5,.6,5.2]);floor.receiveShadow=true;
    this.art.mesh(this.decoration,"cylinder","#DFCC9D",[0,-.5,0],[6.65,.45,5.35]);
    for(let i=0;i<24;i++){const angle=i*Math.PI*2/24;this.art.mesh(this.decoration,"plush",i%3===0?session.game.colour:"#98B780",[Math.cos(angle)*6,.17,Math.sin(angle)*4.65],[.20,.22,.20]);}
    if(session.game.kind==="hop")for(const puddle of hopPuddles)this.art.mesh(this.decoration,"plush","#DDA8AA",[puddle.x,.015,puddle.z],[.53,.025,.39]);
    mergeArt(this.decoration,this.art);this.scene.add(this.decoration,this.propRoot);
    this.hero=createCompanion(this.art,session.game.host);this.hero.root.scale.setScalar(.62);this.hero.root.position.set(session.game.kind==="hop"?-3:0,0,session.game.kind==="hop"?3.7:3.5);this.scene.add(this.hero.root);
    this.carried.position.set(0,.73,.65);this.hero.root.add(this.carried);
    this.art.mesh(this.carried,session.game.kind==="parcel"?"box":"plush","#F2D28B",[0,0,0],[.40,.31,.31]);
    this.art.mesh(this.carried,"box","#FFF4CD",[0,0,.17],[.06,.32,.04]);mergeArt(this.carried,this.art);this.carried.visible=false;
    if(session.game.kind==="tea"){
      this.recipeCup.position.set(0,0,1.4);this.scene.add(this.recipeCup);
      this.art.mesh(this.recipeCup,"cylinder","#F8EDCD",[0,.12,0],[.84,.12,.84]);
      for(let i=0;i<3;i++)this.layers.push(this.art.mesh(this.recipeCup,"cylinder","#FFFFFF",[0,.25+i*.2,0],[.53,.18,.53]));
      const handle=new THREE.Mesh(this.art.ownGeometry(new THREE.TorusGeometry(.27,.07,8,24)),this.art.material("#F7EAD0"));handle.position.set(.57,.45,0);this.recipeCup.add(handle);
    }
    if(session.game.kind==="colour"){
      const sculpture=new THREE.Group();sculpture.position.set(0,0,1.45);this.scene.add(sculpture);
      this.art.mesh(sculpture,"cylinder","#F5E8C6",[0,.10,0],[.86,.20,.76]);this.art.mesh(sculpture,"cylinder","#89AB85",[0,.64,0],[.065,1.10,.065]);
      for(let i=0;i<6;i++){const angle=i*Math.PI/3;this.painted.push(this.art.mesh(sculpture,"plush","#FEF9E9",[Math.cos(angle)*.36,1.23+Math.sin(angle)*.36,0],[.28,.28,.13]));}
      this.art.mesh(sculpture,"plush","#EBC778",[0,1.23,.16],[.20,.20,.13]);
    }
    if(session.game.kind==="garden"){
      this.seedling.position.set(0,.28,2);this.scene.add(this.seedling);
      this.art.mesh(this.seedling,"cylinder","#78A06E",[0,.36,0],[.04,.72,.04]);
      for(let i=0;i<5;i++){const angle=i*Math.PI*2/5;this.painted.push(this.art.mesh(this.seedling,"plush","#F0C96F",[Math.cos(angle)*.2,.80,Math.sin(angle)*.2],[.18,.095,.18]));}
      this.art.mesh(this.seedling,"plush","#FDF3C8",[0,.85,0],[.12,.10,.12]);this.seedling.scale.setScalar(0);
    }
    if(session.game.kind==="bridge"){
      this.scene.add(this.boat);this.art.mesh(this.boat,"plush","#EEBA80",[0,0,0],[.33,.17,.22]);this.art.mesh(this.boat,"box","#C08D64",[0,.30,0],[.025,.5,.025]);this.art.mesh(this.boat,"box","#FFEDC4",[.10,.35,0],[.20,.28,.025]);mergeArt(this.boat,this.art);this.boat.visible=false;
    }
    const helper={bubble:"nang",garden:"bui",echo:"hat",tea:"bep",parcel:"dao",hop:"me",colour:"tim",bridge:"na"}[session.game.kind];
    this.hostRig=createCompanion(this.art,helper);this.hostRig.root.scale.setScalar(.65);this.hostRig.root.position.set(-4.8,0,-3.5);this.hostRig.root.rotation.y=.5;this.scene.add(this.hostRig.root);
    for(let i=0;i<6;i++){
      const flower=new THREE.Group();flower.position.set(-3+i*1.2,0,-3.8);this.scene.add(flower);this.completedFlowers.push(flower);
      this.art.mesh(flower,"cylinder","#75A37B",[0,.3,0],[.035,.6,.035]);for(let j=0;j<5;j++){const angle=j*Math.PI*2/5;this.art.mesh(flower,"plush",["#F2C96F","#E9A0A8","#A5B5D8"][i%3],[Math.cos(angle)*.18,.64,Math.sin(angle)*.18],[.17,.09,.17]);}this.art.mesh(flower,"plush","#FFF1C6",[0,.69,0],[.13,.10,.13]);mergeArt(flower,this.art);flower.visible=false;
    }
    this.resize=new ResizeObserver(entries=>{const {width,height}=entries[0].contentRect;this.renderer.setSize(Math.max(1,width),Math.max(1,height));this.camera.aspect=Math.max(1,width)/Math.max(1,height);const distance=this.camera.aspect<1?18:13.8;this.camera.position.set(0,distance*.85,distance*.88);this.camera.lookAt(0,0,0);this.camera.updateProjectionMatrix();});this.resize.observe(container);
    container.addEventListener("pointerdown",this.click);window.addEventListener("keydown",this.keyDown);window.addEventListener("keyup",this.keyUp);canvas.addEventListener("webglcontextlost",this.lost);
    session.tone=this.tone;this.rebuild();this.frame=requestAnimationFrame(this.draw);
  }
  unlock(){if(!this.audio){try{this.audio=new AudioContext();}catch{return;}}if(this.audio.state==="suspended")void this.audio.resume().catch(()=>{});}
  private tone=(index:number)=>{if(!this.sound||!this.audio||this.audio.state!=="running")return;const osc=this.audio.createOscillator(),gain=this.audio.createGain(),time=this.audio.currentTime;osc.type="sine";osc.frequency.value=[330,392,494,587,784][index%5];gain.gain.setValueAtTime(.0001,time);gain.gain.exponentialRampToValueAtTime(.10,time+.015);gain.gain.exponentialRampToValueAtTime(.0001,time+.28);osc.connect(gain);gain.connect(this.audio.destination);osc.start(time);osc.stop(time+.3);osc.onended=()=>{osc.disconnect();gain.disconnect();};};
  setPaused(value:boolean){this.paused=value;this.last=0;this.keys.clear();this.touch={x:0,z:0};this.velocity.set(0,0);this.destination=null;}
  move(x:number,z:number){this.touch={x,z};this.destination=null;this.unlock();}
  jump(){this.unlock();if(this.paused||!this.session.canAct||this.jumping>.01||!this.session.mobile)return;this.vy=4.7;this.jumping=.001;this.tone(2);}
  reset(){this.round=-1;this.hero.root.position.set(this.session.game.kind==="hop"?-3:0,0,this.session.game.kind==="hop"?3.7:3.5);this.velocity.set(0,0);this.vy=0;this.jumping=0;this.destination=null;this.contacts.clear();}
  private lost=(event:Event)=>{event.preventDefault();this.setPaused(true);this.onError("The 3D connection was interrupted. Reopen this game to reconnect.");};
  private keyDown=(event:KeyboardEvent)=>{
    if(this.paused||event.ctrlKey||event.metaKey||event.altKey||event.target instanceof HTMLElement&&event.target.closest("input,textarea,select"))return;
    const key=event.key.toLowerCase();if(["w","a","s","d","arrowup","arrowdown","arrowleft","arrowright"," "].includes(key)){if(key===" "&&event.target instanceof HTMLButtonElement)return;event.preventDefault();this.keys.add(key);this.destination=null;this.unlock();if(key===" "&&!event.repeat)this.jump();}
    if(/^[1-9]$/.test(key)&&!event.repeat&&!this.session.mobile){this.unlock();const id=Number(key)-1;if(this.props.some(prop=>prop.data.id===id))this.session.choose(id);}
  };
  private keyUp=(event:KeyboardEvent)=>this.keys.delete(event.key.toLowerCase());
  private click=(event:PointerEvent)=>{
    if(event.button!==0||this.paused||!this.session.canAct)return;this.unlock();this.renderer.domElement.focus({preventScroll:true});
    const rect=this.container.getBoundingClientRect(),ray=new THREE.Raycaster();ray.setFromCamera(new THREE.Vector2((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1),this.camera);
    const hit=ray.intersectObjects(this.props.map(prop=>prop.root),true)[0];let target:THREE.Object3D|null=hit?.object||null;while(target&&target.userData.choice===undefined)target=target.parent;
    if(target){const id=target.userData.choice as number,prop=this.props.find(item=>item.data.id===id)!;
      if(this.session.mobile){this.destination={x:prop.data.x,z:prop.data.z,id,...(this.session.game.kind==="bubble"?{via:[{x:this.hero.root.position.x,z:1.15},{x:prop.data.x,z:1.15}]}:{})};if(Math.hypot(this.hero.root.position.x-prop.data.x,this.hero.root.position.z-prop.data.z)<1.1&&this.session.game.kind!=="hop"){this.session.choose(id);this.destination=null;}}
      else this.session.choose(id);return;
    }
    const ground=ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0,1,0),0),new THREE.Vector3());if(ground&&this.session.mobile)this.destination={x:THREE.MathUtils.clamp(ground.x,-4.7,4.7),z:THREE.MathUtils.clamp(ground.z,-3.7,3.8)};
  };
  private rebuild(){
    this.successTime=0;
    this.propRoot.clear();this.propsArt.dispose();this.propsArt=new ArtResources();this.props=[];this.contacts.clear();this.destination=null;
    const art=this.propsArt;
    for(const data of this.session.objects()){
      const root=new THREE.Group();root.position.set(data.x,0,data.z);root.userData.choice=data.id;this.propRoot.add(root);this.props.push({data,root});
      const geometry=new THREE.Group();root.add(geometry);
      if(data.shape==="bubble"){
        const material=art.ownMaterial(new THREE.MeshPhysicalMaterial({color:data.colour,transparent:true,opacity:.76,roughness:.16,metalness:.06,clearcoat:1}));const ball=new THREE.Mesh(art.geometry("plush"),material);ball.position.y=1.2;ball.scale.setScalar(.57);geometry.add(ball);art.mesh(geometry,"plush","#FFF9E7",[-.18,1.43,.40],[.10,.14,.018]);
      } else if(data.shape==="seed"||data.shape==="paint"||data.shape==="cup"){
        art.mesh(geometry,"cylinder","#FFF2DC",[0,.34,0],[.42,.64,.42]);art.mesh(geometry,"cylinder",data.colour,[0,.67,0],[.34,.04,.34]);
        if(data.shape==="seed"){art.mesh(geometry,"plush",data.colour,[0,.78,0],[.16,.20,.14]);art.mesh(geometry,"leaf","#74AA82",[.12,.99,0],[.20,.10,.07],[0,0,.5]);}
      } else if(data.shape==="bed"){
        art.mesh(geometry,"box","#A07959",[0,.12,0],[1.9,.25,1.25]);art.mesh(geometry,"box","#856C51",[0,.26,0],[1.62,.05,1]);for(const side of [-1,1])art.mesh(geometry,"box","#D0AC7B",[side*.93,.25,0],[.10,.25,1.4]);
      } else if(data.shape==="stone")art.mesh(geometry,"plush",data.colour,[0,.23,0],[.78,.34,.65]);
      else if(data.shape==="house"){
        art.mesh(geometry,"box","#FFF0D0",[0,.65,0],[1.6,1.3,1.15]);art.mesh(geometry,"plush",data.colour,[0,1.37,0],[1.02,.39,.80]);art.mesh(geometry,"box",data.colour,[0,.38,.59],[.45,.76,.045]);for(const side of [-1,1])art.mesh(geometry,"box","#B2D4D4",[side*.51,.81,.59],[.32,.35,.05]);
      } else if(data.shape==="parcel"){
        art.mesh(geometry,"cylinder","#A58666",[0,.38,0],[.07,.76,.07]);art.mesh(geometry,"plush","#83B9AE",[0,.9,0],[.55,.37,.36]);art.mesh(geometry,"box","#EED3A6",[0,.31,.43],[.43,.42,.4]);art.mesh(geometry,"box","#FFF7DC",[0,.31,.64],[.06,.43,.018]);
      } else if(data.shape==="ring"){
        const ring=new THREE.Mesh(art.ownGeometry(new THREE.TorusGeometry(.63,.085,8,32)),art.material(data.colour));ring.position.y=1.05;geometry.add(ring);art.mesh(geometry,"plush","#FCF7E4",[0,.05,0],[.76,.08,.57]);
      } else if(data.shape==="tile"){
        art.mesh(geometry,"box","#91AF9F",[0,.03,0],[1.48,.09,1.48]);
        const path=new THREE.Group();path.name="tile-path";geometry.add(path);
        art.mesh(path,"cylinder",data.colour,[0,.12,0],[.28,.12,.28]);
        for(const port of data.ports!){const angle=port*Math.PI/2;art.mesh(path,"box",data.colour,[Math.sin(angle)*.38,.12,-Math.cos(angle)*.38],[port%2?.8:.40,.14,port%2?.40:.8]);}
        path.rotation.y=-(data.rotation||0);mergeArt(path,art);
      }
      if(data.shape!=="tile")mergeArt(geometry,art);
      const sign=label(art,data.label,data.shape==="house"?2.5:1.8,"#365c4c","#fff7dd",96);sign.position.y=data.shape==="bubble"?2.04:data.shape==="house"?2.15:data.shape==="ring"?2:1.35;root.add(sign);
    }
    // A new round must not immediately collect the replacement object under the player.
    for(const prop of this.props)if(Math.hypot(this.hero.root.position.x-prop.data.x,this.hero.root.position.z-prop.data.z)<=1.18)this.contacts.add(prop.data.id);
    if(this.session.game.kind==="bridge"){
      const match=this.session.state.prompt.match(/entrance (\d).*exit (\d)/);if(match)for(const [index,id] of [Number(match[1])-1,Number(match[2])-1].entries()){
        const arrow=label(art,index?"EXIT →":"START →",1.75);arrow.position.set(index?3.4:-3.4,.5,(Math.floor(id/3)-1)*1.65);this.propRoot.add(arrow);
      }
    }
  }
  private draw=(timestamp:number)=>{
    if(this.disposed)return;const elapsed=this.last?Math.min(1,(timestamp-this.last)/1000):0,dt=Math.min(.1,elapsed);this.last=timestamp;
    if(!this.paused){this.time+=elapsed;this.session.tick(elapsed);const state=this.session.state;
      if(state.round!==this.round){this.round=state.round;this.rebuild();}
      if(state.revision!==this.revision){this.revision=state.revision;this.hero.express(state.emotion);this.hostRig.express(state.emotion==="sad"?"love":state.emotion);for(const [i,flower]of this.completedFlowers.entries())flower.visible=i<state.round;}
      this.carried.visible=state.carrying!==null&&state.emotion!=="joy";
      if(state.emotion==="joy")this.successTime+=elapsed;else this.successTime=0;
      for(const [i,layer]of this.layers.entries()){layer.visible=i<state.selection.length;if(layer.visible)layer.material=this.art.material(["#B88359","#FFF2D7","#E8BA61","#9BC997"][state.selection[i]]);}
      if(this.session.game.kind==="colour"){
        const pair=[...state.selection].sort().join(),mix=({"0,1":"#EAB06F","1,2":"#8EB590","0,2":"#AC96C8","0,3":"#E9ADBC"} as Record<string,string>)[pair]|| (state.selection.length===1?["#EE947D","#F2CC71","#81B7D6","#FDF4D7"][state.selection[0]]:state.selection.length?"#B9A58E":"#FEF9E9");
        for(const petal of this.painted)petal.material=this.art.material(mix);
      }
      if(this.session.game.kind==="garden"){this.seedling.scale.setScalar(state.emotion==="joy"?Math.min(1,this.successTime*2):0);for(const petal of this.painted)petal.material=this.art.material(["#F6CB66","#8CBADD","#EE9FAC"][Math.min(state.round,2)]);}
      if(this.session.game.kind==="bridge"){
        this.boat.visible=state.emotion==="joy"&&this.session.bridgePath.length>0;
        if(this.boat.visible){const path=this.session.bridgePath.map(id=>new THREE.Vector3((id%3-1)*1.65,.4,(Math.floor(id/3)-1)*1.65)),amount=Math.min(.999,this.successTime/2.6)*(path.length-1),from=Math.floor(amount);this.boat.position.copy(path[from]).lerp(path[Math.min(from+1,path.length-1)],amount-from);}
      }
      let dx=0,dz=0;
      if(this.session.canAct&&this.session.mobile){
        dx=(Number(this.keys.has("d")||this.keys.has("arrowright"))-Number(this.keys.has("a")||this.keys.has("arrowleft")))+this.touch.x;
        dz=(Number(this.keys.has("s")||this.keys.has("arrowdown"))-Number(this.keys.has("w")||this.keys.has("arrowup")))+this.touch.z;
        if(this.destination){
          const waypoint=this.destination.via?.[0],target=waypoint||this.destination,distance=Math.hypot(target.x-this.hero.root.position.x,target.z-this.hero.root.position.z);
          if(distance>(!waypoint&&this.destination.id!==undefined&&this.session.game.kind!=="hop"?.8:.12)){dx=(target.x-this.hero.root.position.x)/distance;dz=(target.z-this.hero.root.position.z)/distance;}
          else if(waypoint)this.destination.via!.shift();
          else{if(this.destination.id!==undefined&&this.session.game.kind!=="hop"){this.session.choose(this.destination.id);this.contacts.add(this.destination.id);}this.destination=null;}
        }
      }
      const input=new THREE.Vector2(dx,dz);if(input.length()>1)input.normalize();this.velocity.lerp(input.multiplyScalar(3.1),1-Math.exp(-15*dt));
      const position=this.hero.root.position;position.x=THREE.MathUtils.clamp(position.x+this.velocity.x*dt,-4.8,4.8);position.z=THREE.MathUtils.clamp(position.z+this.velocity.y*dt,-3.5,3.9);
      if(this.jumping>0){this.vy-=11.5*dt;this.jumping=Math.max(0,this.jumping+this.vy*dt);}position.y=this.jumping;
      if(this.velocity.length()>.12)this.hero.face(Math.atan2(this.velocity.x,this.velocity.y),dt);
      for(const prop of this.props){const distance=Math.hypot(position.x-prop.data.x,position.z-prop.data.z);
        if(this.session.game.kind==="hop"){if(distance<.6)this.session.touchRing(prop.data.id,this.jumping);prop.root.visible=prop.data.id>=state.round;prop.root.scale.setScalar(prop.data.id===state.round?1: .75);}
        else if(this.session.mobile&&state.phase==="play"){
          if(distance>1.18)this.contacts.delete(prop.data.id);
          if(distance<.95&&!this.contacts.has(prop.data.id)&&this.session.canAct){this.contacts.add(prop.data.id);this.session.choose(prop.data.id);this.destination=null;}
          // Buildings, beds and the post box have solid feet; interactions happen at their edge.
          if(["house","bed","parcel"].includes(prop.data.shape)&&distance<.65&&distance>.001){position.x=prop.data.x+(position.x-prop.data.x)/distance*.65;position.z=prop.data.z+(position.z-prop.data.z)/distance*.65;}
        }
        if(prop.data.shape==="bubble"){prop.root.position.y=this.reduced.matches?0:Math.sin(this.time*1.5+prop.data.id)*.14;prop.root.visible=!(state.emotion==="joy"&&state.selection.includes(prop.data.id));}
        if(prop.data.shape==="stone"){const lit=state.lit===prop.data.id;prop.root.scale.setScalar(lit?1.18:1);prop.root.position.y=lit?.16:0;}
        if(["cup","paint","seed"].includes(prop.data.shape))prop.root.scale.setScalar(state.selection.includes(prop.data.id)||state.carrying===prop.data.id?1.12:1);
        if(prop.data.shape==="tile"){const path=prop.root.getObjectByName("tile-path");if(path)path.rotation.y=-(this.session.rotations[prop.data.id]??0)*Math.PI/2;}
      }
      if(this.session.game.kind==="hop"&&this.jumping<.22&&hopPuddles.some(p=>Math.hypot(position.x-p.x,(position.z-p.z)*1.25)<.52)&&this.session.hazard()){const checkpoint=this.session.checkpoint;position.set(checkpoint.x,0,checkpoint.z);this.velocity.set(0,0);this.destination=null;}
      const pose=state.phase==="win"||state.emotion==="joy"?"celebrate":this.jumping>.02?"jump":this.velocity.length()>.2?"walk":"idle";
      this.hero.animate(pose,this.reduced.matches&&pose==="idle"?0:dt);this.hostRig.animate(state.emotion==="joy"?"wave":"idle",this.reduced.matches?0:dt);
    }
    this.renderer.render(this.scene,this.camera);this.frame=requestAnimationFrame(this.draw);
  };
  dispose(){this.disposed=true;cancelAnimationFrame(this.frame);this.resize.disconnect();this.container.removeEventListener("pointerdown",this.click);window.removeEventListener("keydown",this.keyDown);window.removeEventListener("keyup",this.keyUp);this.renderer.domElement.removeEventListener("webglcontextlost",this.lost);for(const rig of [this.hero,this.hostRig]){rig.mixer.stopAllAction();rig.mixer.uncacheRoot(rig.root);}this.session.tone=()=>{};if(this.audio)void this.audio.close().catch(()=>{});this.propsArt.dispose();this.art.dispose();this.renderer.dispose();this.renderer.forceContextLoss();this.renderer.domElement.remove();}
}
