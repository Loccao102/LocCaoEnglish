import * as THREE from "three";
import type { WorldController } from "@/components/game/useWorldController";
import { zones, type Zone } from "../catalog";
import { discoveries, fieldChests, type Discovery, type FieldChest } from "../discoveries";
import { onBridge, type Point } from "../world";
import { type AdventureSave, questOpen } from "../progress";
import { ArtResources, colors as C, label, mapPoint, worldPoint } from "./primitives";
import { createCompanion, type CompanionRig, type Pose } from "./characters";
import { createVillage } from "./environment";
import { VillageAudio } from "./audio";

export type RenderState = { world: WorldController; save: AdventureSave; enabled: boolean; paused: boolean; title: boolean; activeZone: Zone | null; fieldNotes: string[]; sound: boolean; };
export type RenderEvents = { state: () => RenderState; onCollect: (word: Discovery) => void; onChest: (chest: FieldChest) => void; onNearbyChest: (chest: FieldChest | null) => void; onError: (message: string) => void; };
type Particle = { position: THREE.Vector3; velocity: THREE.Vector3; life: number; max: number; size: number; };

/** One WebGL scene, one simulation/render loop, deterministic mesh assets. */
export class VillageRenderer {
  private art = new ArtResources();
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(43,1,.1,180);
  private village: ReturnType<typeof createVillage>;
  private player: CompanionRig;
  private character: string;
  private guides: { zone: Zone; rig: CompanionRig; marker: THREE.Sprite; position: THREE.Vector3 }[] = [];
  private audio = new VillageAudio();
  private resize: ResizeObserver;
  private frame = 0;
  private disposed = false;
  private previous = 0;
  private time = 0;
  private yaw = .30;
  private zoom = 1;
  private target = new THREE.Vector3();
  private raycaster = new THREE.Raycaster();
  private pointer = new THREE.Vector2();
  private plane = new THREE.Plane(new THREE.Vector3(0,1,0),0);
  private drag: { x: number; y: number; distance: number; orbit: boolean; id: number } | null = null;
  private pendingChest = "";
  private nearbyChest = "";
  private stepDistance = 0;
  private lastPosition: Point;
  private lastHeight = 0;
  private pickupIds = new Set<string>();
  private particles: Particle[] = [];
  private particleMesh: THREE.InstancedMesh;
  private dummy = new THREE.Object3D();
  private aimRing: THREE.Mesh;
  private aimUntil = 0;
  private sun = new THREE.DirectionalLight("#fff0d0",3.1);
  private width = 1;
  private height = 1;
  private celebration = 0;
  private motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
  private reducedMotion = this.motionPreference.matches;

  constructor(private host: HTMLDivElement, private events: RenderEvents) {
    const state=events.state();this.character=state.save.character;this.lastPosition={...state.world.position.current};
    this.renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:"high-performance"});
    this.village=createVillage(this.art);this.player=createCompanion(this.art,this.character);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,window.innerWidth<700?1.35:1.75));
    this.renderer.outputColorSpace=THREE.SRGBColorSpace;this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.18;
    this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;
    this.renderer.domElement.setAttribute("aria-label","3D Sunlit Village. Move with WASD or arrows, hold Shift to run, press Space to jump and E to interact.");
    this.renderer.domElement.setAttribute("role","img");this.renderer.domElement.tabIndex=0;
    host.appendChild(this.renderer.domElement);
    this.scene.background=new THREE.Color("#b4d7c7");this.scene.fog=new THREE.Fog("#b4d7c7",32,85);
    this.scene.add(new THREE.HemisphereLight("#f9f3dc","#758c65",2.0));
    this.sun.position.set(-10,18,8);this.sun.castShadow=true;this.sun.shadow.mapSize.setScalar(window.innerWidth<700?1024:2048);
    Object.assign(this.sun.shadow.camera,{left:-17,right:17,top:17,bottom:-17,near:1,far:60});this.sun.shadow.bias=-.0004;this.sun.shadow.normalBias=.035;
    this.scene.add(this.sun,this.sun.target,this.village.root,this.player.root);
    this.target.copy(worldPoint(540,390));this.camera.position.copy(this.target).add(new THREE.Vector3(7,24,29));this.camera.lookAt(this.target);
    for(const zone of zones){const rig=createCompanion(this.art,zone.portrait);rig.root.scale.setScalar(.88);const position=worldPoint(zone.npcX,zone.npcY);rig.root.position.copy(position);rig.root.userData={zoneId:zone.id};
      const marker=label(this.art,zone.guide,1.15);marker.position.y=2.02;rig.root.add(marker);this.scene.add(rig.root);this.guides.push({zone,rig,marker,position});}
    this.particleMesh=new THREE.InstancedMesh(this.art.geometry("rock"),this.art.material(C.cream),96);this.particleMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);this.particleMesh.frustumCulled=false;this.scene.add(this.particleMesh);
    for(let i=0;i<96;i++){this.particles.push({position:new THREE.Vector3(),velocity:new THREE.Vector3(),life:0,max:1,size:0});this.dummy.scale.setScalar(0);this.dummy.updateMatrix();this.particleMesh.setMatrixAt(i,this.dummy.matrix);}
    this.aimRing=new THREE.Mesh(this.art.ownGeometry(new THREE.RingGeometry(.24,.29,24)),this.art.ownMaterial(new THREE.MeshBasicMaterial({color:C.cream,transparent:true,opacity:.9,side:THREE.DoubleSide,depthWrite:false})));this.aimRing.rotation.x=-Math.PI/2;this.aimRing.visible=false;this.scene.add(this.aimRing);
    this.resize=new ResizeObserver(entries=>{const rect=entries[0].contentRect;this.width=Math.max(1,rect.width);this.height=Math.max(1,rect.height);this.renderer.setSize(this.width,this.height);this.camera.aspect=this.width/this.height;this.camera.updateProjectionMatrix();});this.resize.observe(host);
    host.addEventListener("pointerdown",this.pointerDown);host.addEventListener("pointermove",this.pointerMove);host.addEventListener("pointerup",this.pointerUp);host.addEventListener("pointercancel",this.pointerCancel);host.addEventListener("contextmenu",this.contextMenu);host.addEventListener("wheel",this.wheel,{passive:false});
    window.addEventListener("keydown",this.keyDown);this.renderer.domElement.addEventListener("webglcontextlost",this.contextLost);
    this.motionPreference.addEventListener("change",this.preferenceChanged);
    this.frame=requestAnimationFrame(this.draw);
  }

  private contextLost=(event: Event)=>{event.preventDefault();cancelAnimationFrame(this.frame);this.events.onError("The 3D graphics connection was interrupted. Reload the world to reconnect.");};
  private preferenceChanged=(event: MediaQueryListEvent)=>{this.reducedMotion=event.matches;};
  private contextMenu=(event: Event)=>event.preventDefault();
  private pointerCancel=()=>{this.drag=null;};
  private pointerDown=(event: PointerEvent)=>{
    if(!this.events.state().enabled)return;this.audio.unlock();this.drag={x:event.clientX,y:event.clientY,distance:0,orbit:event.button===2||event.button===1,id:event.pointerId};
    this.host.setPointerCapture(event.pointerId);
  };
  private pointerMove=(event: PointerEvent)=>{
    if(!this.drag||event.pointerId!==this.drag.id||!this.events.state().enabled)return;
    const dx=event.clientX-this.drag.x,dy=event.clientY-this.drag.y;this.drag.distance+=Math.hypot(dx,dy);
    if(this.drag.orbit)this.yaw-=dx*.006;
    this.drag.x=event.clientX;this.drag.y=event.clientY;
  };
  private pointerUp=(event: PointerEvent)=>{
    const drag=this.drag;this.drag=null;
    if(this.host.hasPointerCapture(event.pointerId))this.host.releasePointerCapture(event.pointerId);
    if(!drag||drag.orbit||drag.distance>8||!this.events.state().enabled)return;
    const rect=this.host.getBoundingClientRect();this.pointer.set((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1);this.raycaster.setFromCamera(this.pointer,this.camera);
    const roots=[...this.guides.map(g=>g.rig.root),...this.village.buildings.map(b=>b.root),...this.village.chests.map(c=>c.root),...this.village.seeds.filter(s=>!s.collected).map(s=>s.root)];
    const hits=this.raycaster.intersectObjects(roots,true);
    for(const hit of hits){let node:THREE.Object3D|null=hit.object;while(node&&!node.userData.zoneId&&!node.userData.chestId&&!node.userData.seedId)node=node.parent;if(!node)continue;
      if(node.userData.zoneId){const zone=zones.find(z=>z.id===node!.userData.zoneId);if(zone)this.events.state().world.walkTo({x:zone.npcX,y:zone.npcY},zone);return;}
      if(node.userData.chestId){this.inspect(node.userData.chestId);return;}
      if(node.userData.seedId){const seed=discoveries.find(d=>d.id===node!.userData.seedId);if(seed)this.walk({x:seed.x,y:seed.y});return;}
    }
    const ground=this.raycaster.ray.intersectPlane(this.plane,new THREE.Vector3());if(ground)this.walk(mapPoint(ground));
  };
  private wheel=(event: WheelEvent)=>{if(!this.events.state().enabled)return;event.preventDefault();this.zoom=THREE.MathUtils.clamp(this.zoom+event.deltaY*.00065,.70,1.50);};
  private keyDown=(event: KeyboardEvent)=>{
    const state=this.events.state();if(!state.enabled||event.ctrlKey||event.metaKey||event.altKey||(event.target instanceof HTMLElement&&event.target.closest("input,textarea,select")))return;
    this.audio.unlock();
    if(event.key.toLowerCase()==="e"&&!state.world.nearby&&this.nearbyChest&&!event.repeat){event.preventDefault();this.inspect(this.nearbyChest);}
    if(event.key.toLowerCase()==="r"){this.yaw=.30;this.zoom=1;}
  };
  private walk(point: Point){this.pendingChest="";this.events.state().world.walkTo(point);this.aimRing.position.copy(worldPoint(point.x,point.y));this.aimRing.position.y=.05;this.aimUntil=this.time+1.2;}
  rotate(direction: number){this.yaw+=direction*Math.PI/4;}
  changeZoom(direction: number){this.zoom=THREE.MathUtils.clamp(this.zoom+direction*.15,.70,1.50);}
  celebrate(){this.celebration=2.4;this.burst(this.player.root.position,28);this.audio.pickup();}
  inspect(id: string){
    const chest=fieldChests.find(c=>c.id===id),state=this.events.state();if(!chest||!state.enabled)return;
    const pos=state.world.position.current;
    if(Math.hypot(pos.x-chest.x,pos.y-chest.y)>48){this.pendingChest=id;state.world.walkTo({x:chest.x,y:chest.y+29});return;}
    state.world.stop();state.world.motion.current.wave=1.2;this.pendingChest="";
    const model=this.village.chests.find(c=>c.id===id);if(model){model.open=1;this.burst(model.root.position,16);}
    this.audio.open();this.events.onChest(chest);
  }
  private burst(position: THREE.Vector3,count: number,dust=false){
    if(this.reducedMotion)return;
    let made=0;for(const p of this.particles){if(p.life>0)continue;p.position.copy(position);p.position.y+=dust?.05:.6;p.velocity.set((Math.random()-.5)*(dust?.4:1.6),dust?.3:1.3+Math.random(),(Math.random()-.5)*(dust?.4:1.6));p.max=p.life=dust?.32:.65+Math.random()*.4;p.size=dust?.038:.045+Math.random()*.035;if(++made>=count)break;}
  }
  private draw=(timestamp: number)=>{
    if(this.disposed)return;
    const state=this.events.state(),dt=this.previous?Math.min(.06,(timestamp-this.previous)/1000):0;this.previous=timestamp;
    const delta=state.paused?0:dt;this.time+=delta;this.audio.enabled=state.sound;state.world.cameraYaw.current=this.yaw;
    const ambientTime=this.reducedMotion?0:this.time;
    this.celebration=Math.max(0,this.celebration-delta);
    state.world.step(delta);
    const pos=state.world.position.current,motion=state.world.motion.current;
    if(state.save.character!==this.character){this.scene.remove(this.player.root);this.player.mixer.stopAllAction();this.player.mixer.uncacheRoot(this.player.root);this.character=state.save.character;this.player=createCompanion(this.art,this.character);this.scene.add(this.player.root);}
    this.player.root.position.copy(worldPoint(pos.x,pos.y));this.player.root.position.y=motion.height+(onBridge(pos)?.15:0);
    this.player.face(motion.heading,delta);
    const pose:Pose=motion.height>.02?"jump":motion.speed>160?"run":motion.speed>5?"walk":this.celebration>0?"celebrate":motion.wave>0?"wave":"idle";
    this.player.animate(pose,this.reducedMotion&&pose==="idle"?0:delta,pose==="walk"?THREE.MathUtils.clamp(motion.speed/130,.3,1.5):pose==="run"?motion.speed/215:1);
    const squash=motion.landed>0?1-Math.sin(motion.landed/.18*Math.PI)*.12:1;this.player.root.scale.set(1/Math.sqrt(squash),squash,1/Math.sqrt(squash));
    if(motion.height>this.lastHeight&&this.lastHeight===0)this.audio.jump();this.lastHeight=motion.height;
    if(state.enabled){this.stepDistance+=Math.hypot(pos.x-this.lastPosition.x,pos.y-this.lastPosition.y);if(this.stepDistance>24&&motion.height<.03){this.audio.step();this.burst(this.player.root.position,2,true);this.stepDistance=0;}}
    this.lastPosition={...pos};
    for(const [index,guide] of this.guides.entries()){
      const distance=Math.hypot(guide.zone.npcX-pos.x,guide.zone.npcY-pos.y),near=distance<95;
      const wander=near||this.reducedMotion?0:Math.sin(this.time*.35+index)*.17;
      guide.rig.root.position.copy(guide.position);guide.rig.root.position.x+=wander;
      guide.rig.face(near?Math.atan2(pos.x-guide.zone.npcX,pos.y-guide.zone.npcY):Math.sin(this.time*.35+index+.3)>.0?Math.PI/2:-Math.PI/2,delta);
      guide.rig.animate(this.reducedMotion?"idle":near?(Math.floor(this.time/3.5)%2===0?"wave":"idle"):"walk",this.reducedMotion?0:delta,near?1:.27);
      guide.marker.visible=distance<180||state.title;
      guide.marker.material.opacity=near?1:.82;
    }
    for(const building of this.village.buildings){
      const distance=Math.hypot(building.zone.x-pos.x,building.zone.y-pos.y),opened=questOpen(state.save,building.zone.quests[0]);
      const angle=opened&&distance<112?-.85*Math.PI:0;building.door.rotation.y+=(angle-building.door.rotation.y)*(1-Math.exp(-7*delta));
      building.sign.visible=state.title||distance<210;building.marker.visible=state.activeZone?.id===building.zone.id;
      building.marker.scale.setScalar(1+Math.sin(ambientTime*2.2)*.08);
    }
    const noteIds=new Set(state.fieldNotes);
    for(const seed of this.village.seeds){
      const data=discoveries.find(d=>d.id===seed.id)!;seed.collected=noteIds.has(seed.id)||this.pickupIds.has(seed.id);seed.root.visible=!seed.collected;
      seed.orb.position.y=.59+Math.sin(ambientTime*2.4+data.x)*.095;seed.orb.rotation.y=ambientTime*.8;
      if(state.enabled&&!seed.collected&&Math.hypot(pos.x-data.x,pos.y-data.y)<22){seed.collected=true;seed.root.visible=false;this.pickupIds.add(seed.id);this.burst(seed.root.position,18);this.audio.pickup();this.events.onCollect(data);}
    }
    let nearest:FieldChest|null=null;
    for(const chest of this.village.chests){const data=fieldChests.find(c=>c.id===chest.id)!;chest.lid.rotation.x+=(-chest.open*Math.PI*.62-chest.lid.rotation.x)*(1-Math.exp(-8*delta));if(Math.hypot(pos.x-data.x,pos.y-data.y)<48)nearest=data;}
    if(this.nearbyChest!==(nearest?.id||"")){this.nearbyChest=nearest?.id||"";this.events.onNearbyChest(nearest);}
    if(state.enabled&&this.pendingChest&&this.pendingChest===nearest?.id)this.inspect(this.pendingChest);
    for(const [i,tree] of this.village.trees.entries()){const canopy=tree.getObjectByName("canopy");if(canopy)canopy.rotation.z=Math.sin(ambientTime*.75+i)*.026;}
    for(const [i,butterfly] of this.village.butterflies.entries()){butterfly.position.y=.8+Math.sin(ambientTime+i)*.19;butterfly.rotation.y=ambientTime*.28+i;butterfly.children[0].rotation.z=Math.sin(ambientTime*14+i)*.8;butterfly.children[1].rotation.z=-Math.sin(ambientTime*14+i)*.8;}
    this.village.waters[0].position.y=-.53+Math.sin(ambientTime*.55)*.025;
    for(let i=0;i<this.particles.length;i++){const p=this.particles[i];if(p.life>0){p.life-=delta;p.velocity.y-=2*delta;p.position.addScaledVector(p.velocity,delta);this.dummy.position.copy(p.position);this.dummy.scale.setScalar(p.size*Math.max(0,p.life/p.max));}else this.dummy.scale.setScalar(0);this.dummy.updateMatrix();this.particleMesh.setMatrixAt(i,this.dummy.matrix);}this.particleMesh.instanceMatrix.needsUpdate=true;
    this.aimRing.visible=state.enabled&&this.time<this.aimUntil;this.aimRing.scale.setScalar(1+Math.sin(ambientTime*5)*.12);
    const desired=state.title?worldPoint(575,405):worldPoint(pos.x,pos.y);desired.y=state.title?0:.45;
    this.target.lerp(desired,this.reducedMotion?1:1-Math.exp(-(state.title?1.5:7)*dt));
    const distance=state.title?27:this.width<700?10.8*this.zoom:12.0*this.zoom, cameraHeight=state.title?23:distance*.96;
    const angle=state.title?.3+Math.sin(ambientTime*.055)*.14:this.yaw;
    const nextCamera=this.target.clone().add(new THREE.Vector3(Math.sin(angle)*distance,cameraHeight,Math.cos(angle)*distance));
    this.camera.position.lerp(nextCamera,this.reducedMotion?1:1-Math.exp(-6*dt));this.camera.lookAt(this.target);
    this.sun.target.position.copy(this.target);this.sun.position.copy(this.target).add(new THREE.Vector3(-10,18,8));
    this.renderer.render(this.scene,this.camera);this.frame=requestAnimationFrame(this.draw);
  };
  dispose(){
    this.disposed=true;cancelAnimationFrame(this.frame);this.resize.disconnect();
    this.motionPreference.removeEventListener("change",this.preferenceChanged);
    this.host.removeEventListener("pointerdown",this.pointerDown);this.host.removeEventListener("pointermove",this.pointerMove);this.host.removeEventListener("pointerup",this.pointerUp);this.host.removeEventListener("pointercancel",this.pointerCancel);this.host.removeEventListener("contextmenu",this.contextMenu);this.host.removeEventListener("wheel",this.wheel);window.removeEventListener("keydown",this.keyDown);this.renderer.domElement.removeEventListener("webglcontextlost",this.contextLost);
    for(const rig of [this.player,...this.guides.map(g=>g.rig)]){rig.mixer.stopAllAction();rig.mixer.uncacheRoot(rig.root);}
    this.particleMesh.dispose();this.sun.shadow.dispose();this.audio.dispose();this.art.dispose();this.renderer.dispose();this.renderer.domElement.remove();
  }
}
