import * as THREE from "three";
import { festivalGames, festivalShore } from "../festival";
import { ArtResources, label, mergeArt, worldPoint } from "./primitives";

export function createFairground(art:ArtResources){
  const root=new THREE.Group();root.name="friendship-fair";
  const outline=new THREE.Shape();festivalShore.forEach((point,i)=>{const p=worldPoint(point.x,point.y);if(i===0)outline.moveTo(p.x,-p.z);else outline.lineTo(p.x,-p.z);});outline.closePath();
  const geometry=art.ownGeometry(new THREE.ExtrudeGeometry(outline,{depth:.65,bevelEnabled:false}));geometry.rotateX(-Math.PI/2);geometry.translate(0,-.65,0);
  const land=new THREE.Mesh(geometry,[art.material("#B7CF8D"),art.material("#B5A17D")]);land.receiveShadow=true;land.castShadow=true;root.add(land);
  const staticArt=new THREE.Group();root.add(staticArt);
  // The promenade joins the old shoreline at y=678 and the fair at y=742.
  for(let i=0;i<23;i++){const p=worldPoint(620,665+i*4.2);art.mesh(staticArt,"box",i%2?"#CEAE7D":"#D8BC8D",[p.x,.08,p.z],[1.08,.16,.10]);}
  for(const side of [-1,1])for(let i=0;i<6;i++){const p=worldPoint(620+side*23,667+i*18);art.mesh(staticArt,"cylinder","#9E8668",[p.x,.45,p.z],[.045,.9,.045]);}
  for(const side of [-1,1]){const p=worldPoint(620+side*23,712);art.mesh(staticArt,"box","#B49A76",[p.x,.81,p.z],[.055,.07,2.42]);}
  const gate=worldPoint(620,754);
  for(const side of [-1,1]){art.mesh(staticArt,"cylinder","#E7D4A5",[gate.x+side*1.08,.94,gate.z],[.10,1.88,.10]);art.mesh(staticArt,"plush","#EAA5A6",[gate.x+side*1.08,2.04,gate.z],[.24,.25,.21]);}
  art.mesh(staticArt,"plush","#EEDCA8",[gate.x,1.95,gate.z],[1.30,.29,.15]);
  const sign=label(art,"FRIENDSHIP FAIR",3.0);sign.position.set(gate.x,2.12,gate.z+.12);root.add(sign);
  const centre=worldPoint(610,924);art.mesh(staticArt,"cylinder","#E6D2A6",[centre.x,.015,centre.z],[2.15,.03,1.45]);
  art.mesh(staticArt,"cylinder","#FBEDC7",[centre.x,.036,centre.z],[1.99,.025,1.30]);
  art.mesh(staticArt,"plush","#EDBF75",[centre.x,.48,centre.z],[.59,.53,.50]);
  for(let i=0;i<8;i++){const angle=i*Math.PI/4;art.mesh(staticArt,"plush","#F5D294",[centre.x+Math.sin(angle)*.6,.52,centre.z+Math.cos(angle)*.6],[.21,.12,.21]);}
  for(let i=0;i<50;i++){
    const angle=i*Math.PI*2/50,x=610+Math.cos(angle)*355,y=926+Math.sin(angle)*140,p=worldPoint(x,y);
    if(festivalGames.some(game=>Math.hypot(game.x-x,game.y-y)<62))continue;
    art.mesh(staticArt,"plush",i%3?"#8CAC77":"#E8B9BB",[p.x,.16,p.z],[.18,.20,.18]);
  }
  const stalls=festivalGames.map(game=>{
    const stall=new THREE.Group();stall.name=`fair-${game.id}`;stall.userData={festivalId:game.id};stall.position.copy(worldPoint(game.x,game.y-18));root.add(stall);
    const solid=new THREE.Group();stall.add(solid);
    art.mesh(solid,"box","#F0D7AB",[0,.23,0],[1.8,.45,1.05]);
    art.mesh(solid,"box","#FFEFCD",[0,.54,0],[1.98,.15,1.2]);
    for(const side of [-1,1])art.mesh(solid,"cylinder","#DDC399",[side*.88,1.0,-.37],[.055,1.95,.055]);
    art.mesh(solid,"plush",game.colour,[0,1.81,-.13],[1.13,.40,.87]);
    for(let i=0;i<5;i++)art.mesh(solid,"plush",i%2?"#FFF0CC":game.colour,[-.82+i*.41,1.58,.53],[.24,.16,.09]);
    if(game.kind==="bubble")for(let i=0;i<3;i++)art.mesh(solid,"plush",["#B5DDE0","#F1CF9D","#E6B9D3"][i],[-.46+i*.44,.95+(i%2)*.19,.15],[.24,.26,.24]);
    if(game.kind==="garden")for(let i=0;i<3;i++){art.mesh(solid,"cylinder","#D6997C",[-.5+i*.5,.74,.1],[.16,.26,.16]);art.mesh(solid,"leaf","#81AC79",[-.5+i*.5,1.02,.1],[.19,.25,.11]);}
    if(game.kind==="tea"||game.kind==="colour")for(let i=0;i<3;i++){art.mesh(solid,"cylinder","#FFF3DA",[-.48+i*.48,.77,.15],[.15,.30,.15]);art.mesh(solid,"cylinder",["#D89381","#EAC77B","#95B6D5"][i],[-.48+i*.48,.928,.15],[.12,.018,.12]);}
    if(game.kind==="echo")for(let i=0;i<4;i++)art.mesh(solid,"plush",["#DDA09B","#EFD291","#91C0C2","#C4B9D9"][i],[-.6+i*.4,.70,.15],[.16,.09,.23]);
    if(game.kind==="parcel")for(let i=0;i<3;i++)art.mesh(solid,"box",["#E6BD8B","#F4D7A8","#D9AF83"][i],[-.47+i*.45,.78+(i%2)*.13,.10],[.38,.34+(i%2)*.25,.32]);
    if(game.kind==="hop"){const ring=new THREE.Mesh(art.ownGeometry(new THREE.TorusGeometry(.34,.065,8,24)),art.material("#F8DA8C"));ring.position.set(0,1.01,.23);solid.add(ring);}
    if(game.kind==="bridge")for(let i=0;i<5;i++)art.mesh(solid,"box","#AE8D65",[-.45+i*.23,.72+Math.sin(i*Math.PI/4)*.18,.1],[.22,.07,.55]);
    mergeArt(solid,art);
    const name=label(art,game.name,2.75);name.position.set(0,2.44,0);stall.add(name);
    return {game,root:stall,sign:name};
  });
  mergeArt(staticArt,art);return {root,stalls};
}
