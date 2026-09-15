import { createFairground } from "./fairground";
import * as THREE from "three";
import { zones, type Zone } from "../catalog";
import { discoveries, fieldChests } from "../discoveries";
import { scenery } from "../scenery";
import { insideIsland, shore, type Point } from "../world";
import { ArtResources, colors as C, joint, label, mergeArt, SCALE, worldPoint } from "./primitives";

export type VillageScene = {
  root: THREE.Group;
  fair: ReturnType<typeof createFairground>;
  buildings: { zone: Zone; root: THREE.Group; door: THREE.Group; marker: THREE.Group; sign: THREE.Sprite }[];
  trees: THREE.Group[];
  chests: { id: string; root: THREE.Group; lid: THREE.Group; open: number }[];
  seeds: { id: string; root: THREE.Group; orb: THREE.Group; collected: boolean }[];
  waters: THREE.Mesh[];
  butterflies: THREE.Group[];
};

function roof(art: ArtResources, parent: THREE.Group, width: number, depth: number, height: number, color: string) {
  const rise=.62, span=width/2, slope=Math.atan2(rise,span), length=Math.hypot(span,rise);
  for(const side of [-1,1]){
    art.mesh(parent,"box",C.cream,[side*width/4,height+rise/2-.06,0],[length+.12,.15,depth+.22],[0,0,-side*slope]);
    art.mesh(parent,"box",color,[side*width/4,height+rise/2+.04,0],[length+.22,.13,depth+.40],[0,0,-side*slope]);
    for(const offset of [-.037,0,.037])art.mesh(parent,"box",C.edge,[side*width/4,height+rise/2-.09+offset,depth/2+.121],[length+.08,.008,.015],[0,0,-side*slope]);
  }
  art.mesh(parent,"cylinder",C.honey,[0,height+rise+.05,0],[.05,depth+.40,.05],[Math.PI/2,0,0]);
}
function windowArt(art: ArtResources, parent: THREE.Group, x: number, y: number, z: number, width=.43, height=.47) {
  art.mesh(parent,"box",C.wood,[x,y,z],[width+.10,height+.10,.065]);
  art.mesh(parent,"box","#82b8ac",[x,y,z+.04],[width,height,.025]);
  art.mesh(parent,"box",C.cream,[x,y,z+.065],[.035,height,.02]);
  art.mesh(parent,"box",C.cream,[x,y,z+.065],[width,.035,.02]);
  art.mesh(parent,"box",C.cream,[x-width*.19,y+height*.24,z+.067],[width*.22,.025,.012],[0,0,.5]);
  art.mesh(parent,"box",C.edge,[x,y-height/2-.07,z+.04],[width+.18,.09,.18]);
}
function sun(art: ArtResources, parent: THREE.Group, x: number, y: number, z: number, radius=.16) {
  art.mesh(parent,"ball",C.honey,[x,y,z],[radius,radius,.065]);
  for(let i=0;i<8;i++){const angle=i*Math.PI/4;art.mesh(parent,"box",C.honey,[x+Math.cos(angle)*radius*1.5,y+Math.sin(angle)*radius*1.5,z],[radius*.42,.038,.04],[0,0,angle]);}
}
function createBuilding(art: ArtResources, zone: Zone) {
  const root = new THREE.Group();root.name=zone.building;root.position.copy(worldPoint(zone.x,zone.y-22));root.userData={zoneId:zone.id};
  const solid = new THREE.Group();root.add(solid);
  const roofColor = zone.id==="conversation"?C.coral:zone.id==="work"?C.honey:zone.id==="arena"?"#859db0":C.teal;
  const width=2.45,depth=1.40,height=1.38;
  art.mesh(solid,"box",C.edge,[0,.06,0],[width+.15,.12,depth+.16]);
  if(zone.id==="ielts"){
    art.mesh(solid,"cylinder",C.cream,[0,1.40,0],[.61,2.8,.61]);
    for(const y of [.2,1.0,2.02])art.mesh(solid,"cylinder",C.teal,[0,y,0],[.623,.18,.623]);
    art.mesh(solid,"cylinder",C.wood,[0,2.84,0],[.83,.12,.83]);
    art.mesh(solid,"cylinder","#c3dcc5",[0,3.14,0],[.49,.57,.49]);
    art.mesh(solid,"ball",C.honey,[0,3.16,0],[.17,.23,.17]);
    for(let i=0;i<8;i++){const a=i*Math.PI/4;art.mesh(solid,"cylinder",C.teal,[Math.cos(a)*.53,3.15,Math.sin(a)*.53],[.025,.65,.025]);art.mesh(solid,"cylinder",C.cream,[Math.cos(a)*.76,3.03,Math.sin(a)*.76],[.022,.38,.022]);}
    const rail=new THREE.Mesh(art.ownGeometry(new THREE.TorusGeometry(.76,.025,6,24)),art.material(C.cream));rail.rotation.x=Math.PI/2;rail.position.y=3.2;solid.add(rail);
    art.mesh(solid,"cone",C.teal,[0,3.68,0],[.83,.59,.83]);
    art.mesh(solid,"ball",C.honey,[0,4.02,0],[.10,.12,.10]);
    windowArt(art,solid,0,1.73,.61,.26,.48);
  } else if(zone.id==="arena") {
    for(let i=0;i<3;i++)art.mesh(solid,"box",i%2?"#d8c9a4":C.cream,[0,.10+i*.10,-.25-i*.19],[2.35,.2+i*.2,.68]);
    for(const side of [-1,1]){art.mesh(solid,"cylinder",C.cream,[side*1.03,.82,.25],[.18,1.64,.18]);art.mesh(solid,"box",C.edge,[side*1.03,1.55,.25],[.48,.14,.48]);}
    art.mesh(solid,"box",roofColor,[0,1.73,.25],[2.65,.25,.6]);sun(art,solid,0,1.75,.58,.13);
    for(const side of [-1,1])art.mesh(solid,"box",C.coral,[side*.81,1.03,.27],[.25,.80,.04]);
  } else if(zone.id==="words") {
    art.mesh(solid,"box","#bed6ab",[0,.67,0],[width,1.25,depth]);
    for(const x of [-1.18,-.60,0,.60,1.18])art.mesh(solid,"box",C.teal,[x,.7,.73],[.055,1.4,.075]);
    for(const y of [.2,.7,1.3])art.mesh(solid,"box",C.teal,[0,y,.735],[width,.055,.075]);
    roof(art,solid,width,depth,height,"#84b8a2");
    for(const x of [-.75,.72]){art.mesh(solid,"cylinder",C.coral,[x,.22,.82],[.18,.32,.18]);art.mesh(solid,"ball",C.green,[x,.58,.82],[.25,.33,.20]);}
    sun(art,solid,0,1.40,.79,.12);
  } else {
    art.mesh(solid,"box",zone.id==="work"?"#e7d6b9":C.cream,[0,height/2,0],[width,height,depth]);
    art.mesh(solid,"box",C.edge,[0,.21,.71],[width,.13,.03]);
    for(const x of [-width/2+.04,width/2-.04])art.mesh(solid,"box",C.wood,[x,.70,.73],[.095,1.38,.045]);
    roof(art,solid,width,depth,height,roofColor);
    for(const x of [-.77,.77])windowArt(art,solid,x,.81,.715);
    if(zone.id==="training"){
      art.mesh(solid,"box",C.cream,[0,1.90,0],[.56,.67,.60]);
      art.mesh(solid,"box",C.darkWood,[0,1.96,.31],[.26,.29,.018]);
      art.mesh(solid,"ball",C.honey,[0,1.94,.36],[.12,.13,.09]);
      art.mesh(solid,"cone",C.teal,[0,2.41,0],[.46,.4,.46],[0,Math.PI/4,0]);
      sun(art,solid,0,1.30,.76,.10);
    }
    if(zone.id==="conversation"){
      for(let i=0;i<9;i++)art.mesh(solid,"box",i%2?C.cream:C.coral,[-1.05+i*.26,1.29,1.0],[.265,.08,.69],[.22,0,0]);
      for(const x of [-1.17,1.17])art.mesh(solid,"cylinder",C.wood,[x,.69,1.24],[.028,1.38,.028]);
    }
    if(zone.id==="travel"){
      art.mesh(solid,"cylinder",C.wood,[0,1.65,.49],[.30,.07,.30],[Math.PI/2,0,0]);
      art.mesh(solid,"cylinder",C.cream,[0,1.65,.535],[.25,.03,.25],[Math.PI/2,0,0]);
      art.mesh(solid,"box",C.ink,[0,1.71,.56],[.024,.15,.02]);art.mesh(solid,"box",C.ink,[.06,1.64,.56],[.15,.024,.02]);
      for(const side of [-1,1])art.mesh(solid,"box",C.teal,[side*.92,.1,-1.25],[.06,.08,1.0]);
    }
    if(zone.id==="work"){
      for(let i=0;i<3;i++){art.mesh(solid,"cylinder",[C.coral,C.teal,C.honey][i],[.62+i*.16,1.94,-.3],[.08,.87+i*.14,.08]);art.mesh(solid,"cone",C.cream,[.62+i*.16,2.46+i*.07,-.3],[.08,.2,.08]);}
    }
  }
  const front=zone.id==="ielts"?.62:.75;
  art.mesh(solid,"box",C.darkWood,[0,.52,front],[.57,1.03,.035]);
  art.mesh(solid,"box",C.edge,[0,.035,front+.20],[.86,.07,.43]);
  mergeArt(solid,art);
  const door=joint(root,"door",-.25,0,front+.025);
  art.mesh(door,"box",C.teal,[.25,.49,0],[.49,.96,.055]);
  art.mesh(door,"ball",C.honey,[.40,.45,.055],[.035,.035,.025]);
  const sign=label(art,zone.name,3.35);sign.position.set(0,zone.id==="ielts"?4.35:2.8,0);root.add(sign);
  const marker=joint(root,"chapter-marker",0,.025,depth/2+1.25);
  const ring=new THREE.Mesh(art.ownGeometry(new THREE.RingGeometry(.43,.49,32)),art.ownMaterial(new THREE.MeshBasicMaterial({color:C.honey,side:THREE.DoubleSide,transparent:true,opacity:.6,depthWrite:false})));ring.rotation.x=-Math.PI/2;marker.add(ring);
  return {zone,root,door,marker,sign};
}

function tree(art: ArtResources, x: number, y: number, size: number, variant: number) {
  const root=new THREE.Group();root.name="bubble-tree";root.position.copy(worldPoint(x,y));root.scale.setScalar(size);root.rotation.y=variant;
  art.mesh(root,"cylinder",C.wood,[0,.52,0],[.13,1.04,.13]);
  art.mesh(root,"cylinder",C.wood,[-.16,.83,0],[.065,.55,.065],[0,0,.55]);
  const canopy=joint(root,"canopy",0,.83,0);
  const shade=["#85ac65","#94b772","#6d9c62"][variant%3];
  art.mesh(canopy,"ball",shade,[0,.64,0],[.69,.69,.64]);
  art.mesh(canopy,"ball",shade,[-.45,.28,.03],[.45,.45,.45]);
  art.mesh(canopy,"ball","#a4c480",[.34,.55,.19],[.47,.51,.44]);
  for(let i=0;i<3;i++)art.mesh(canopy,"ball",C.honey,[-.32+i*.31,.57+(i%2)*.20,.52],[.065,.075,.065]);
  mergeArt(canopy,art);return root;
}
function flower(art: ArtResources, parent: THREE.Group, x: number, z: number, color: string, size: number) {
  art.mesh(parent,"cylinder",C.green,[x,size*.7,z],[size*.035,size*1.4,size*.035]);
  for(let i=0;i<5;i++){const a=i*Math.PI*2/5;art.mesh(parent,"ball",color,[x+Math.cos(a)*size*.28,size*1.45,z+Math.sin(a)*size*.28],[size*.21,size*.09,size*.21]);}
  art.mesh(parent,"ball",C.honey,[x,size*1.49,z],[size*.13,size*.10,size*.13]);
}
function bridge(art: ArtResources, parent: THREE.Group) {
  const root=new THREE.Group();root.position.copy(worldPoint(632,410));parent.add(root);
  for(let i=0;i<18;i++)art.mesh(root,"box",i%2?"#b19066":"#c3a27a",[-2.10+i*.247,.08,0],[.23,.16,.70]);
  for(const side of [-1,1]){
    art.mesh(root,"box",C.wood,[0,.63,side*.39],[4.48,.075,.075]);
    for(let i=0;i<6;i++)art.mesh(root,"box",C.wood,[-2.08+i*.835,.36,side*.39],[.08,.73,.08]);
  }
}
function road(art: ArtResources, parent: THREE.Group, points: Point[], width: number, color: string, y: number, closed=true) {
  const curve=new THREE.CatmullRomCurve3(points.map(p=>worldPoint(p.x,p.y)),closed,"centripetal");
  const positions:number[]=[],indices:number[]=[],samples=closed?180:36;
  for(let i=0;i<=samples;i++){
    const p=curve.getPoint(i/samples),t=curve.getTangent(i/samples),n=new THREE.Vector3(-t.z,0,t.x).normalize().multiplyScalar(width/2);
    positions.push(p.x+n.x,y,p.z+n.z,p.x-n.x,y,p.z-n.z);
    if(i<samples){const k=i*2;indices.push(k,k+2,k+1,k+1,k+2,k+3);}
  }
  const geometry=art.ownGeometry(new THREE.BufferGeometry());geometry.setAttribute("position",new THREE.Float32BufferAttribute(positions,3));geometry.setIndex(indices);geometry.computeVertexNormals();
  const mesh=new THREE.Mesh(geometry,art.material(color));mesh.receiveShadow=true;parent.add(mesh);
}

export function createVillage(art: ArtResources): VillageScene {
  const root=new THREE.Group();root.name="sunlit-village";
  const island=new THREE.Shape();shore.forEach((p,i)=>{const v=worldPoint(p.x,p.y);if(i===0)island.moveTo(v.x,-v.z);else island.lineTo(v.x,-v.z);});island.closePath();
  const lagoon=new THREE.Path(),center=worldPoint(632,410);lagoon.absellipse(center.x,-center.z,72/SCALE,35/SCALE,0,Math.PI*2,true);island.holes.push(lagoon);
  const landGeo=art.ownGeometry(new THREE.ExtrudeGeometry(island,{depth:.64,bevelEnabled:false,curveSegments:24}));landGeo.rotateX(-Math.PI/2);landGeo.translate(0,-.64,0);
  const land=new THREE.Mesh(landGeo,[art.material(C.grass),art.material(C.cliff)]);land.receiveShadow=true;land.castShadow=true;root.add(land);
  const beach=new THREE.Mesh(landGeo,[art.material(C.sand),art.material(C.edge)]);beach.scale.set(1.045,.5,1.045);beach.position.y=-.19;beach.receiveShadow=true;root.add(beach);
  const bottom=new THREE.Mesh(art.ownGeometry(new THREE.CircleGeometry(1,48)),art.material("#70aaa0"));bottom.rotation.x=-Math.PI/2;bottom.position.set(center.x,-.14,center.z);bottom.scale.set(1.80,.875,1);root.add(bottom);
  const waterMaterial=art.ownMaterial(new THREE.MeshStandardMaterial({color:C.water,roughness:.36,metalness:.1,transparent:true,opacity:.88}));
  const sea=new THREE.Mesh(art.ownGeometry(new THREE.PlaneGeometry(160,160,28,28)),waterMaterial);sea.rotation.x=-Math.PI/2;sea.position.y=-.53;root.add(sea);
  const pond=new THREE.Mesh(art.ownGeometry(new THREE.CircleGeometry(1,48)),waterMaterial);pond.rotation.x=-Math.PI/2;pond.position.set(center.x,-.075,center.z);pond.scale.set(1.79,.87,1);root.add(pond);
  const route:Point[]=[[246,540],[311,465],[390,390],[470,309],[629,304],[748,232],[856,223],[978,355],[877,516],[749,594],[637,616],[490,556],[356,605]].map(([x,y])=>({x,y}));
  road(art,root,route,1.28,C.edge,.01);road(art,root,route,1.13,C.path,.018);
  road(art,root,[{x:405,y:421},{x:481,y:410},{x:545,y:410}],.70,C.path,.020,false);
  road(art,root,[{x:720,y:410},{x:795,y:413},{x:858,y:453}],.70,C.path,.020,false);
  const staticArt=new THREE.Group();root.add(staticArt);bridge(art,staticArt);
  for(const zone of zones){const p=worldPoint(zone.npcX,zone.npcY);art.mesh(staticArt,"cylinder",C.edge,[p.x,.012,p.z],[.73,.03,.73]);art.mesh(staticArt,"cylinder",C.path,[p.x,.031,p.z],[.67,.028,.67]);}

  const trees:THREE.Group[]=[];
  for(const [index,item] of scenery.filter(item=>item.id==="bubble-tree").entries()){const model=tree(art,item.x,item.y,item.size/110,index);root.add(model);trees.push(model);}
  // Perimeter trees frame the island; these positions are outside the playable shoreline.
  for(const [i,p] of shore.entries()){if(i%2===0)continue;const dx=p.x-600,dy=p.y-410;const model=tree(art,p.x+dx*.018,p.y+dy*.018,.8+(i%3)*.08,i);root.add(model);trees.push(model);}
  for(let i=0;i<90;i++){
    const p={x:175+(i*137%820),y:160+(i*89%480)};if(!insideIsland(p)||zones.some(z=>Math.hypot(z.x-p.x,z.y-p.y)<96)||Math.hypot((p.x-632)/1.8,(p.y-410)/.9)<60)continue;
    const v=worldPoint(p.x,p.y);flower(art,staticArt,v.x,v.z,[C.cream,C.coral,"#c0aec5"][i%3],.14+(i%3)*.025);
  }
  for(const item of scenery.filter(item=>item.id!=="bubble-tree"&&item.id!=="chest-closed")){
    const p=worldPoint(item.x,item.y),small=new THREE.Group();small.position.copy(p);staticArt.add(small);
    if(item.id==="flower-bush"){art.mesh(small,"ball",C.green,[0,.20,0],[.42,.29,.28]);for(let i=0;i<5;i++)flower(art,small,(i-2)*.13,.14+(i%2)*.12,i%2?C.coral:C.cream,.18);}
    else if(item.id==="sun-lamp"){art.mesh(small,"cylinder",C.teal,[0,.66,0],[.045,1.32,.045]);art.mesh(small,"ball",C.cream,[0,1.37,0],[.16,.20,.16]);art.mesh(small,"cone",C.teal,[0,1.59,0],[.23,.17,.23]);}
    else if(item.id==="bench"){for(const side of [-1,1])art.mesh(small,"box",C.teal,[side*.34,.20,0],[.07,.40,.35]);art.mesh(small,"box",C.wood,[0,.43,0],[1,.10,.39]);art.mesh(small,"box",C.wood,[0,.75,-.13],[1,.31,.07]);}
    else if(item.id==="mailbox"||item.id==="signpost"){art.mesh(small,"box",C.wood,[0,.36,0],[.08,.72,.09]);art.mesh(small,"box",item.id==="mailbox"?C.teal:C.cream,[0,.80,0],[.45,.33,.22]);sun(art,small,0,.80,.13,.065);}
    else if(item.id==="pebble-pair"){art.mesh(small,"rock","#a5b1a1",[0,.13,0],[.33,.19,.22]);art.mesh(small,"rock","#b6bca8",[.30,.08,.10],[.17,.12,.18]);}
    else if(item.id==="leaf-planter"){art.mesh(small,"cylinder",C.coral,[0,.19,0],[.23,.38,.23]);art.mesh(small,"leaf",C.green,[0,.49,0],[.23,.33,.19]);}
    else {art.mesh(small,"box",C.coral,[0,.07,0],[.32,.12,.23]);art.mesh(small,"box",C.cream,[.025,.15,0],[.28,.07,.23],[0,.13,0]);}
  }
  for(const x of [562,702]){const p=worldPoint(x,580);art.mesh(staticArt,"cylinder",C.wood,[p.x,.30,p.z],[.06,.6,.06]);art.mesh(staticArt,"cylinder",C.edge,[p.x,.62,p.z],[.39,.08,.39]);art.mesh(staticArt,"cylinder",C.cream,[p.x,.70,p.z],[.07,.1,.07]);}
  mergeArt(staticArt,art);
  const buildings=zones.map(zone=>createBuilding(art,zone));for(const building of buildings)root.add(building.root);
  const chests=fieldChests.map(data=>{
    const chest=new THREE.Group();chest.name=data.id;chest.position.copy(worldPoint(data.x,data.y));chest.userData={chestId:data.id};
    art.mesh(chest,"box",C.wood,[0,.19,0],[.57,.36,.40]);art.mesh(chest,"box",C.honey,[0,.13,.215],[.10,.21,.035]);
    for(const side of [-1,1])art.mesh(chest,"box",C.honey,[side*.21,.2,.217],[.046,.34,.025]);
    const lid=joint(chest,"lid",0,.35,-.19);art.mesh(lid,"ball",C.wood,[0,.015,.19],[.295,.14,.21]);for(const side of [-1,1])art.mesh(lid,"box",C.honey,[side*.21,.10,.19],[.047,.04,.39]);
    root.add(chest);return{id:data.id,root:chest,lid,open:0};
  });
  const seeds=discoveries.map(data=>{
    const seed=new THREE.Group();seed.name=data.id;seed.position.copy(worldPoint(data.x,data.y));seed.userData={seedId:data.id};
    const orb=joint(seed,"word-seed",0,.55,0);art.mesh(orb,"ball",C.honey,[0,0,0],[.15,.21,.13]);art.mesh(orb,"leaf",C.green,[.10,.18,0],[.11,.15,.035],[0,0,-.7]);
    const halo=new THREE.Mesh(art.ownGeometry(new THREE.TorusGeometry(.26,.017,5,24)),art.material(C.cream));halo.rotation.x=.4;orb.add(halo);
    root.add(seed);return{id:data.id,root:seed,orb,collected:false};
  });
  const butterflies:THREE.Group[]=[];
  for(let i=0;i<7;i++){const b=new THREE.Group();b.position.copy(worldPoint(365+i*75,325+(i%3)*80));b.position.y=.7;for(const side of [-1,1]){const wing=art.mesh(b,"leaf",i%2?C.coral:C.cream,[side*.055,0,0],[.075,.02,.06]);wing.name=side<0?"wingL":"wingR";}root.add(b);butterflies.push(b);}
  const fair=createFairground(art);root.add(fair.root);
  return {root,buildings,trees,chests,seeds,waters:[sea,pond],butterflies,fair};
}
