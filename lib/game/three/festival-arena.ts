import * as THREE from "three";
import { FestivalSession, type ArenaObject } from "../festival-session";
import { fairWalkPath } from "../fair-navigation";
import { frameFairCamera, fairLabelHeight } from "./fair-view";
import { ArtResources, mergeArt } from "./primitives";
import { createCompanion, type CompanionRig } from "./characters";
import { portraitLights } from "./portraits";

/** A small independent 3D playfield: articulated player, collisions, jumping and ray picking. */
export class FestivalArena {
  private art=new ArtResources();
  private scene=new THREE.Scene();
  private renderer:THREE.WebGLRenderer;
  private camera=new THREE.OrthographicCamera(-5,5,5,-5,.1,70);
  private labels=document.createElement("div");
  private markers:{element:HTMLElement;point:THREE.Vector3}[]=[];
  private view={width:1,height:1,centerX:0,centerY:0,unitsPerPixel:1};
  private zoom=1;
  private labelMetricsDirty=true;
  private hero:CompanionRig;
  private hostRig:CompanionRig;
  private props:{data:ArenaObject;root:THREE.Group;label:HTMLButtonElement;width:number;height:number}[]=[];
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
  private jumps=0;
  private feathers:THREE.Group[]=[];
  private windRibbon=new THREE.Group();
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
    this.labels.className="fair-label-layer";this.labels.setAttribute("role","group");this.labels.setAttribute("aria-label",session.mobile?"Playfield destinations":"Playfield choices");container.appendChild(this.labels);
    this.scene.background=new THREE.Color("#E0EEE5");portraitLights(this.scene);
    const sun=new THREE.DirectionalLight("#FFF3D5",1.5);sun.position.set(-4,12,6);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);Object.assign(sun.shadow.camera,{left:-8,right:8,top:8,bottom:-8,near:1,far:30});sun.shadow.normalBias=.025;this.scene.add(sun);
    const floor=this.art.mesh(this.decoration,"cylinder",session.game.kind==="bridge"||session.game.kind==="echo"?"#9DC9C6":"#B8CEA0",[0,-.3,0],[6.5,.6,5.2]);floor.receiveShadow=true;
    this.art.mesh(this.decoration,"cylinder","#DFCC9D",[0,-.5,0],[6.65,.45,5.35]);
    for(let i=0;i<24;i++){const angle=i*Math.PI*2/24;this.art.mesh(this.decoration,"plush",i%3===0?session.game.colour:"#98B780",[Math.cos(angle)*6,.17,Math.sin(angle)*4.65],[.20,.22,.20]);}
    if(session.game.kind==="hop")for(const puddle of session.puddles)this.art.mesh(this.decoration,"plush","#BE708C",[puddle.x,.015,puddle.z],[.53,.025,.39]);
    mergeArt(this.decoration,this.art);this.scene.add(this.decoration,this.propRoot);
    if(session.course){
      session.course.feathers.forEach(([x,z],id)=>{
        const feather=new THREE.Group();feather.position.set(x,.7,z);feather.userData.feather=id;
        this.art.mesh(feather,"leaf","#FFFCE1",[0,.1,0],[.23,.43,.08],[0,0,-.35]);
        this.art.mesh(feather,"cylinder","#DAAD4B",[0,0,0],[.035,.65,.035],[0,0,-.35]);
        const halo=new THREE.Mesh(this.art.ownGeometry(new THREE.TorusGeometry(.38,.025,6,24)),this.art.material("#E3BD64"));halo.rotation.x=Math.PI/2;halo.position.y=-.4;feather.add(halo);
        mergeArt(feather,this.art);this.feathers.push(feather);this.scene.add(feather);
      });
      if(session.course.wind){
        this.windRibbon.position.set(4,0,3);this.art.mesh(this.windRibbon,"cylinder","#C6A576",[0,.75,0],[.04,1.5,.04]);
        for(let i=0;i<4;i++)this.art.mesh(this.windRibbon,"box",i%2?"#F4D599":"#F8F5D9",[.14+i*.24,1.35,0],[.26,.17,.035]);this.scene.add(this.windRibbon);
      }
    }
    this.hero=createCompanion(this.art,session.game.host);this.hero.root.scale.setScalar(.9);this.hero.root.position.set(session.game.kind==="hop"?-3:0,0,session.game.kind==="hop"?3.7:3.5);this.scene.add(this.hero.root);
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
    this.hostRig=createCompanion(this.art,helper);this.hostRig.root.scale.setScalar(.8);this.hostRig.root.position.set(-4.8,0,-3.5);this.hostRig.root.rotation.y=.5;this.scene.add(this.hostRig.root);
    for(let i=0;i<6;i++){
      const flower=new THREE.Group();flower.position.set(-3+i*1.2,0,-3.8);this.scene.add(flower);this.completedFlowers.push(flower);
      this.art.mesh(flower,"cylinder","#75A37B",[0,.3,0],[.035,.6,.035]);for(let j=0;j<5;j++){const angle=j*Math.PI*2/5;this.art.mesh(flower,"plush",["#F2C96F","#E9A0A8","#A5B5D8"][i%3],[Math.cos(angle)*.18,.64,Math.sin(angle)*.18],[.17,.09,.17]);}this.art.mesh(flower,"plush","#FFF1C6",[0,.69,0],[.13,.10,.13]);mergeArt(flower,this.art);flower.visible=false;
    }
    this.resize=new ResizeObserver(entries=>{const width=Math.max(1,entries[0].contentRect.width),height=Math.max(1,entries[0].contentRect.height);this.renderer.setSize(width,height);this.view={width,height,...frameFairCamera(this.camera,this.session.game,width,height,this.session)};this.labelMetricsDirty=true;this.updateView();});this.resize.observe(container);
    container.addEventListener("pointerdown",this.click);window.addEventListener("keydown",this.keyDown);window.addEventListener("keyup",this.keyUp);canvas.addEventListener("webglcontextlost",this.lost);
    session.tone=this.tone;this.rebuild();this.frame=requestAnimationFrame(this.draw);
  }
  setZoom(value:number){this.zoom=THREE.MathUtils.clamp(value,1,1.8);this.updateView();}
  private updateView(){
    const {width,height,unitsPerPixel}=this.view;
    const focus=new THREE.Vector3(this.hero.root.position.x,.8,this.hero.root.position.z).applyMatrix4(this.camera.matrixWorldInverse);
    const follow=this.session.mobile?(this.zoom-1)/.8:0;
    const x=THREE.MathUtils.lerp(this.view.centerX,focus.x,follow),y=THREE.MathUtils.lerp(this.view.centerY,focus.y,follow);
    this.camera.left=x-width*unitsPerPixel/(2*this.zoom);this.camera.right=x+width*unitsPerPixel/(2*this.zoom);
    this.camera.top=y+height*unitsPerPixel/(2*this.zoom);this.camera.bottom=y-height*unitsPerPixel/(2*this.zoom);this.camera.updateProjectionMatrix();
    // Measure as a batch only after layout changes, never once per label per frame.
    if(this.labelMetricsDirty){for(const prop of this.props){prop.width=prop.label.offsetWidth||prop.width;prop.height=prop.label.offsetHeight||prop.height;}this.labelMetricsDirty=false;}
    const occupied:{left:number;top:number;width:number;height:number}[]=[];
    for(const prop of this.props){
      const tile=prop.data.shape==="tile";
      const point=new THREE.Vector3(prop.data.x-(tile?.52:0),tile?.18:fairLabelHeight(prop.data.shape)+(prop.data.shape==="ring"&&this.session.course?.high.includes(prop.data.id)?.6:0),prop.data.z+(tile?.52:0)).project(this.camera);
      const x=(point.x+1)*width/2,y=(1-point.y)*height/2;
      prop.label.hidden=!prop.root.visible;
      const left=THREE.MathUtils.clamp(x-prop.width/2,6,Math.max(6,width-prop.width-6));
      const preferred=THREE.MathUtils.clamp(y-prop.height*(tile?.5:1),6,Math.max(6,height-prop.height-6));
      const candidates=[preferred,...occupied.flatMap(box=>[box.top-prop.height-4,box.top+box.height+4])].sort((a,b)=>Math.abs(a-preferred)-Math.abs(b-preferred));
      const top=candidates.find(value=>value>=6&&value+prop.height<=height-6&&occupied.every(box=>left+prop.width+4<=box.left||left>=box.left+box.width+4||value+prop.height+4<=box.top||value>=box.top+box.height+4))??preferred;
      prop.label.style.left=left+prop.width/2+"px";
      prop.label.style.top=top+prop.height*(tile?.5:1)+"px";
      if(prop.root.visible)occupied.push({left,top,width:prop.width,height:prop.height});
      prop.label.disabled=!this.session.canAct;
      prop.label.dataset.offscreen=String(x<16||x>width-16||y<16||y>height-16);
      prop.label.dataset.direction=["→","↘","↓","↙","←","↖","↑","↗"][(Math.round(Math.atan2(y-height/2,x-width/2)/(Math.PI/4))+8)%8];
      prop.label.dataset.active=String(this.session.game.kind==="hop"&&prop.data.id===this.session.state.round);
      prop.label.setAttribute("aria-pressed",String(this.session.state.selection.includes(prop.data.id)||this.session.state.lit===prop.data.id||this.session.state.carrying===prop.data.id));
    }
    for(const marker of this.markers){const point=marker.point.clone().project(this.camera);marker.element.style.left=THREE.MathUtils.clamp((point.x+1)*width/2,48,width-48)+"px";marker.element.style.top=THREE.MathUtils.clamp((1-point.y)*height/2,20,height-20)+"px";}
  }
  private select(id:number){
    if(this.paused||!this.session.canAct)return;this.unlock();
    const prop=this.props.find(item=>item.data.id===id);if(!prop||!prop.root.visible)return;
    if(this.session.mobile){
      this.renderer.domElement.focus({preventScroll:true});this.walkTo({x:prop.data.x,z:prop.data.z,id});
      if(Math.hypot(this.hero.root.position.x-prop.data.x,this.hero.root.position.z-prop.data.z)<1.1&&this.session.game.kind!=="hop"){this.session.choose(id);this.destination=null;}
    }else this.session.choose(id);
  }
  unlock(){if(!this.audio){try{this.audio=new AudioContext();}catch{return;}}if(this.audio.state==="suspended")void this.audio.resume().catch(()=>{});}
  private tone=(index:number)=>{if(!this.sound||!this.audio||this.audio.state!=="running")return;const osc=this.audio.createOscillator(),gain=this.audio.createGain(),time=this.audio.currentTime;osc.type="sine";osc.frequency.value=[330,392,494,587,784][index%5];gain.gain.setValueAtTime(.0001,time);gain.gain.exponentialRampToValueAtTime(.10,time+.015);gain.gain.exponentialRampToValueAtTime(.0001,time+.28);osc.connect(gain);gain.connect(this.audio.destination);osc.start(time);osc.stop(time+.3);osc.onended=()=>{osc.disconnect();gain.disconnect();};};
  setPaused(value:boolean){this.paused=value;this.last=0;this.keys.clear();this.touch={x:0,z:0};this.velocity.set(0,0);this.destination=null;}
  move(x:number,z:number){this.touch={x,z};this.destination=null;this.unlock();}
  jump(){this.unlock();if(this.paused||!this.session.canAct||!this.session.mobile||this.jumping>.01&&(!this.session.doubleJump||this.jumps>=2))return;this.jumps=this.jumping>.01?this.jumps+1:1;this.vy=4.7;this.jumping=Math.max(.001,this.jumping);this.tone(this.jumps===2?4:2);}
  reset(){this.keys.clear();this.touch={x:0,z:0};this.round=-1;this.revision=-1;this.hero.root.position.set(this.session.game.kind==="hop"?-3:0,0,this.session.game.kind==="hop"?3.7:3.5);this.velocity.set(0,0);this.vy=0;this.jumping=0;this.jumps=0;this.destination=null;this.contacts.clear();}
  get playerPosition(){return {x:this.hero.root.position.x,z:this.hero.root.position.z};}
  restorePosition(point:{x:number;z:number}){this.reset();const safe=this.session.game.kind==="hop"?this.session.checkpoint:point;this.hero.root.position.set(THREE.MathUtils.clamp(safe.x,-4.8,4.8),0,THREE.MathUtils.clamp(safe.z,-3.5,3.9));}
  visitFeather(id:number){if(this.paused||!this.session.canAct||!this.feathers[id]?.visible)return;this.renderer.domElement.focus({preventScroll:true});const p=this.feathers[id].position;this.walkTo({x:p.x,z:p.z});}
  private lost=(event:Event)=>{event.preventDefault();this.setPaused(true);this.onError("The 3D connection was interrupted. Reopen this game to reconnect.");};
  private keyDown=(event:KeyboardEvent)=>{
    if(this.paused||event.ctrlKey||event.metaKey||event.altKey||event.target instanceof HTMLElement&&event.target.closest("input,textarea,select"))return;
    const key=event.key.toLowerCase();if(["w","a","s","d","arrowup","arrowdown","arrowleft","arrowright"," "].includes(key)){if(key===" "&&event.target instanceof HTMLButtonElement)return;event.preventDefault();this.keys.add(key);if(key!==" ")this.destination=null;this.unlock();if(key===" "&&!event.repeat)this.jump();}
    if(/^[1-9]$/.test(key)&&!event.repeat&&!this.session.mobile){this.unlock();const id=Number(key)-1;if(this.props.some(prop=>prop.data.id===id))this.session.choose(id);}
  };
  private keyUp=(event:KeyboardEvent)=>this.keys.delete(event.key.toLowerCase());
  private walkTo(goal:{x:number;z:number;id?:number}){
    const path=this.session.game.kind==="hop"?[goal]:fairWalkPath(this.hero.root.position,goal,this.session.objects(),goal.id);
    this.destination=path.length?{...goal,via:path.slice(0,-1)}:null;
  }
  private click=(event:PointerEvent)=>{
    if(event.button!==0||this.paused||!this.session.canAct)return;this.unlock();this.renderer.domElement.focus({preventScroll:true});
    const rect=this.container.getBoundingClientRect(),ray=new THREE.Raycaster();ray.setFromCamera(new THREE.Vector2((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1),this.camera);
    const hit=ray.intersectObjects([...this.props.filter(prop=>prop.root.visible).map(prop=>prop.root),...this.feathers.filter(item=>item.visible)],true)[0];let target:THREE.Object3D|null=hit?.object||null;while(target&&target.userData.choice===undefined&&target.userData.feather===undefined)target=target.parent;
    if(target?.userData.feather!==undefined){this.visitFeather(target.userData.feather as number);return;}
    if(target){this.select(target.userData.choice as number);return;}
    const ground=ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0,1,0),0),new THREE.Vector3());if(ground&&this.session.mobile)this.walkTo({x:THREE.MathUtils.clamp(ground.x,-4.7,4.7),z:THREE.MathUtils.clamp(ground.z,-3.5,3.8)});
  };
  private rebuild(){
    this.successTime=0;
    this.propRoot.clear();this.propsArt.dispose();this.propsArt=new ArtResources();this.props=[];this.labels.replaceChildren();this.labelMetricsDirty=true;this.markers=[];this.contacts.clear();this.destination=null;
    const art=this.propsArt;
    for(const data of this.session.objects()){
      const root=new THREE.Group();root.position.set(data.x,0,data.z);root.userData.choice=data.id;this.propRoot.add(root);
      const button=document.createElement("button");button.type="button";button.className="fair-object-label";button.dataset.choice=String(data.id);button.dataset.shape=data.shape;
      if(data.shape==="tile"){const badge=document.createElement("span");badge.textContent=String(data.id+1);button.appendChild(badge);}else button.textContent=data.label;
      button.setAttribute("aria-label",data.shape==="tile"?"Tile "+(data.id+1)+" ↻":data.shape==="ring"?"Ring "+(data.id+1):data.label);
      if(data.shape==="ring"&&this.session.course?.high.includes(data.id)){button.dataset.high="true";button.setAttribute("aria-label",`Ring ${data.id+1}, high: double jump`);}
      button.onpointerdown=event=>event.stopPropagation();button.onclick=()=>this.select(data.id);
      this.labels.appendChild(button);this.props.push({data,root,label:button,width:40,height:40});
      const geometry=new THREE.Group();root.add(geometry);
      if(data.shape==="bubble"){
        const material=art.ownMaterial(new THREE.MeshPhysicalMaterial({color:data.colour,transparent:true,opacity:.76,roughness:.16,metalness:.06,clearcoat:1}));const ball=new THREE.Mesh(art.geometry("plush"),material);ball.position.y=1.2;ball.scale.setScalar(.67);geometry.add(ball);art.mesh(geometry,"plush","#FFF9E7",[-.18,1.43,.40],[.10,.14,.018]);
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
        const ring=new THREE.Mesh(art.ownGeometry(new THREE.TorusGeometry(.8,.12,10,40)),art.material(data.id===this.session.state.round?"#D9A32F":"#579685"));ring.position.y=this.session.ringHeight(data.id);geometry.add(ring);art.mesh(geometry,"plush","#FCF7E4",[0,.05,0],[.76,.08,.57]);
      } else if(data.shape==="tile"){
        art.mesh(geometry,"box","#5F978B",[0,.03,0],[1.48,.09,1.48]);
        const path=new THREE.Group();path.name="tile-path";geometry.add(path);
        art.mesh(path,"cylinder","#FFDB8F",[0,.12,0],[.28,.12,.28]);
        for(const port of data.ports!){const angle=port*Math.PI/2;art.mesh(path,"box","#FFDB8F",[Math.sin(angle)*.38,.12,-Math.cos(angle)*.38],[port%2?.8:.40,.14,port%2?.40:.8]);}
        path.rotation.y=-(data.rotation||0);mergeArt(path,art);
      }
      if(["seed","cup","paint"].includes(data.shape))geometry.scale.setScalar(1.3);
      if(data.shape!=="tile")mergeArt(geometry,art);
      if(data.shape==="ring"){
        // The empty centre is part of the click target, not a click through to distant ground.
        const target=new THREE.Mesh(art.ownGeometry(new THREE.CircleGeometry(.94,32)),art.ownMaterial(new THREE.MeshBasicMaterial({visible:false,side:THREE.DoubleSide})));
        target.position.y=this.session.ringHeight(data.id);root.add(target);
      }
    }
    // A new round must not immediately collect the replacement object under the player.
    for(const prop of this.props)if(Math.hypot(this.hero.root.position.x-prop.data.x,this.hero.root.position.z-prop.data.z)<=1.18)this.contacts.add(prop.data.id);
    if(this.session.game.kind==="bridge"){
      const match=this.session.state.prompt.match(/entrance (\d).*exit (\d)/);if(match)for(const [index,id] of [Number(match[1])-1,Number(match[2])-1].entries()){
        const arrow=document.createElement("span");arrow.className="fair-bank-marker";arrow.textContent=index?"EXIT →":"START →";this.labels.appendChild(arrow);this.markers.push({element:arrow,point:new THREE.Vector3(index?3.4:-3.4,.5,(Math.floor(id/3)-1)*1.65)});
      }
    }
  }
  private updateMovement(dt:number){
    const state=this.session.state;
    let dx=0,dz=0;
    if(this.session.canAct&&this.session.mobile){
      dx=(Number(this.keys.has("d")||this.keys.has("arrowright"))-Number(this.keys.has("a")||this.keys.has("arrowleft")))+this.touch.x;
      dz=(Number(this.keys.has("s")||this.keys.has("arrowdown"))-Number(this.keys.has("w")||this.keys.has("arrowup")))+this.touch.z;
      if(this.destination){
        if(this.session.course?.drift&&this.destination.id!==undefined){const point=this.session.ringPoint(this.destination.id);this.destination.x=point.x;this.destination.z=point.z;}
        const waypoint=this.destination.via?.[0],target=waypoint||this.destination,distance=Math.hypot(target.x-this.hero.root.position.x,target.z-this.hero.root.position.z);
        if(distance>(!waypoint&&this.destination.id!==undefined&&this.session.game.kind!=="hop"?.8:.12)){dx=(target.x-this.hero.root.position.x)/distance;dz=(target.z-this.hero.root.position.z)/distance;}
        else if(waypoint)this.destination.via!.shift();
        else{if(this.destination.id!==undefined&&this.session.game.kind!=="hop"){this.session.choose(this.destination.id);this.contacts.add(this.destination.id);}this.destination=null;}
      }
    }
    const input=new THREE.Vector2(dx,dz);if(input.length()>1)input.normalize();this.velocity.lerp(input.multiplyScalar(3.1),1-Math.exp(-15*dt));
    const position=this.hero.root.position;position.x=THREE.MathUtils.clamp(position.x+(this.velocity.x+(this.jumping>.05&&this.session.canAct?this.session.wind:0))*dt,-4.8,4.8);position.z=THREE.MathUtils.clamp(position.z+this.velocity.y*dt,-3.5,3.9);
    if(this.jumping>0){this.vy-=11.5*dt;this.jumping=Math.max(0,this.jumping+this.vy*dt);}else this.jumps=0;position.y=this.jumping;
    if(this.velocity.length()>.12)this.hero.face(Math.atan2(this.velocity.x,this.velocity.y),dt);
    for(const prop of this.props){
      if(prop.data.shape==="ring"){const point=this.session.ringPoint(prop.data.id);prop.data.x=point.x;prop.data.z=point.z;prop.root.position.set(point.x,0,point.z);}
      const distance=Math.hypot(position.x-prop.data.x,position.z-prop.data.z);
      if(this.session.game.kind==="hop"){if(distance<.6)this.session.touchRing(prop.data.id,this.jumping);prop.root.visible=prop.data.id>=state.round;prop.root.scale.setScalar(prop.data.id===state.round?1.04:1);}
      else if(this.session.mobile&&state.phase==="play"){
        if(distance>1.18)this.contacts.delete(prop.data.id);
        if(distance<.95&&!this.contacts.has(prop.data.id)&&this.session.canAct&&(!this.destination||this.destination.id===prop.data.id)){this.contacts.add(prop.data.id);this.session.choose(prop.data.id);this.destination=null;}
        // Buildings, beds and the post box have solid feet; interactions happen at their edge.
        if(["house","bed","parcel"].includes(prop.data.shape)&&distance<.65&&distance>.001){position.x=prop.data.x+(position.x-prop.data.x)/distance*.65;position.z=prop.data.z+(position.z-prop.data.z)/distance*.65;}
      }
      if(prop.data.shape==="bubble"){prop.root.position.y=this.reduced.matches?0:Math.sin(this.time*1.5+prop.data.id)*.14;prop.root.visible=!(state.emotion==="joy"&&state.selection.includes(prop.data.id));}
      if(prop.data.shape==="stone"){const lit=state.lit===prop.data.id;prop.root.scale.setScalar(lit?1.18:1);prop.root.position.y=lit?.16:0;}
      if(["cup","paint","seed"].includes(prop.data.shape))prop.root.scale.setScalar(state.selection.includes(prop.data.id)||state.carrying===prop.data.id?1.12:1);
      if(prop.data.shape==="tile"){const path=prop.root.getObjectByName("tile-path");if(path)path.rotation.y=-(this.session.rotations[prop.data.id]??0)*Math.PI/2;}
    }
    for(const [id,feather]of this.feathers.entries()){feather.visible=!state.feathers.includes(id);if(feather.visible&&Math.hypot(position.x-feather.position.x,position.z-feather.position.z)<.65)this.session.collectFeather(id,this.jumping);}
    if(this.session.game.kind==="hop"&&this.jumping<.22&&this.session.puddles.some(p=>Math.hypot(position.x-p.x,(position.z-p.z)*1.25)<.52)&&this.session.hazard()){const checkpoint=this.session.checkpoint;position.set(checkpoint.x,0,checkpoint.z);this.velocity.set(0,0);this.vy=0;this.jumping=0;this.jumps=0;this.destination=null;}
  }
  private draw=(timestamp:number)=>{
    if(this.disposed)return;const elapsed=this.last?Math.min(1,(timestamp-this.last)/1000):0,dt=elapsed;this.last=timestamp;
    if(!this.paused){
      this.time+=elapsed;
      // Small simulation steps keep jumps and collisions consistent when drawing is slow.
      const steps=Math.max(1,Math.ceil(elapsed*60)),step=elapsed/steps;
      for(let i=0;i<steps;i++){
        this.session.tick(step);
        if(this.session.state.round!==this.round){this.round=this.session.state.round;this.rebuild();}
        this.updateMovement(step);
      }
      const state=this.session.state;
      this.windRibbon.rotation.y=this.session.wind>=0?0:Math.PI;
      for(const [id,feather]of this.feathers.entries()){feather.rotation.y=this.time*.7+id;feather.position.y=.7+(this.reduced.matches?0:Math.sin(this.time*2+id)*.1);}
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
      const pose=state.phase==="win"||state.emotion==="joy"?"celebrate":this.jumping>.02?"jump":this.velocity.length()>.2?"walk":"idle";
      this.hero.animate(pose,this.reduced.matches&&pose==="idle"?0:dt);this.hostRig.animate(state.emotion==="joy"?"wave":"idle",this.reduced.matches?0:dt);
    }
    this.updateView();this.renderer.render(this.scene,this.camera);this.frame=requestAnimationFrame(this.draw);
  };
  dispose(){this.disposed=true;cancelAnimationFrame(this.frame);this.resize.disconnect();this.container.removeEventListener("pointerdown",this.click);window.removeEventListener("keydown",this.keyDown);window.removeEventListener("keyup",this.keyUp);this.renderer.domElement.removeEventListener("webglcontextlost",this.lost);for(const rig of [this.hero,this.hostRig]){rig.mixer.stopAllAction();rig.mixer.uncacheRoot(rig.root);}this.session.tone=()=>{};if(this.audio)void this.audio.close().catch(()=>{});this.propsArt.dispose();this.art.dispose();this.renderer.dispose();this.renderer.forceContextLoss();this.renderer.domElement.remove();this.labels.remove();}
}
