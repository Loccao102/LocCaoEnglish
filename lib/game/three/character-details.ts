import * as THREE from "three";
import type { CompanionDesign } from "../companions";
import { ArtResources, joint, mergeArt } from "./primitives";

const teal = "#278F8A", paper = "#FFF1CF", brown = "#795440";
type V3 = [number, number, number];

export function curve(art: ArtResources, parent: THREE.Object3D, points: V3[], color: string, radius = .018) {
  const path = new THREE.CatmullRomCurve3(points.map(point => new THREE.Vector3(...point)));
  const mesh = new THREE.Mesh(art.ownGeometry(new THREE.TubeGeometry(path, 18, radius, 7, false)), art.material(color));
  mesh.castShadow = true; parent.add(mesh); return mesh;
}

function leaf(art: ArtResources, parent: THREE.Object3D, position: V3, tilt: number, size = 1, color = teal) {
  const root = joint(parent, "leaf-blade", ...position); root.rotation.z = tilt; root.scale.setScalar(size);
  art.mesh(root, "plush", "#E5CF84", [0,.19,-.012], [.125,.28,.055]);
  art.mesh(root, "plush", color, [0,.21,.014], [.126,.28,.050]);
  curve(art, root, [[0,-.02,.044],[0,.15,.064],[0,.39,.045]], "#62AF93", .010);
}

function badge(art: ArtResources, parent: THREE.Object3D, x: number, y: number, z: number, color = paper) {
  art.mesh(parent, "plush", color, [x,y,z], [.075,.065,.020]);
  for(const offset of [-.028,0,.028]) art.mesh(parent, "ball", teal, [x+offset,y,z+.020], [.009,.013,.006]);
}

export function decorateHead(art: ArtResources, head: THREE.Group, leaves: THREE.Group, d: CompanionDesign) {
  const detail = joint(head, "head-accessories", 0,0,0);
  if (["bear","panda"].includes(d.shape)) {
    for(const side of [-1,1]) {
      art.mesh(detail,"plush",d.shape === "panda" ? "#6B5B53" : d.skin,[side*.43,.42,-.02],[.20,.20,.12]);
      art.mesh(detail,"plush",d.shape === "panda" ? "#AE9681" : "#E8BCAC",[side*.43,.43,.088],[.115,.115,.025]);
    }
  }
  if (d.shape === "bunny") for(const side of [-1,1]) {
    art.mesh(leaves,"plush",d.skin,[side*.28,.71,-.025],[.16,.40,.115],[0,0,-side*.11]);
    art.mesh(leaves,"plush","#F3BCCB",[side*.28,.73,.076],[.081,.28,.025],[0,0,-side*.11]);
  }
  if (["cat","fox"].includes(d.shape)) for(const side of [-1,1]) {
    art.mesh(detail,"cone",d.skin,[side*.39,.48,-.02],[.22,.48,.17],[0,0,-side*.20]);
    art.mesh(detail,"cone",d.shape === "fox" ? paper : "#F2C2D4",[side*.40,.49,.097],[.12,.28,.03],[0,0,-side*.20]);
  }
  if(d.hat === "sprout") { leaf(art,leaves,[-.04,.59,0],.70,.86); leaf(art,leaves,[.035,.61,0],-.55,1.12); }
  if(d.hat === "leaf") leaf(art,leaves,[0,.59,0],-.48,1.04);
  if(d.hat === "triple") for(const side of [-1,0,1]) leaf(art,leaves,[side*.07,.55,0],side*.64,.64,"#86B683");
  if(d.hat === "curl") curve(art,leaves,[[0,.54,0],[-.06,.77,0],[.08,.96,0],[.27,.91,0],[.24,.75,0],[.13,.78,0]],teal,.077);
  if(d.hat === "crown") for(let i=0;i<5;i++) {const a=i*Math.PI*2/5;leaf(art,leaves,[Math.cos(a)*.12,.48,Math.sin(a)*.11],Math.cos(a)*.85,.65,"#66AD88");}
  if(d.hat === "tuft") for(const side of [-1,0,1]) art.mesh(leaves,"plush",d.coat,[side*.075,.64,0],[.075,.17,.06],[0,0,-side*.5]);
  if(["cap","conductor","aviator","detective"].includes(d.hat)) {
    const color=d.hat === "cap" ? "#EC8D73" : d.coat;
    const dome=new THREE.Mesh(art.ownGeometry(new THREE.SphereGeometry(1,32,16,0,Math.PI*2,0,Math.PI/2)),art.material(color));
    dome.position.set(0,.33,-.025);dome.scale.set(.59,.34,.46);detail.add(dome);
    art.mesh(detail,"plush",color,[0,.34,.36],[.48,.065,.28]);
    art.mesh(detail,"plush",d.accent,[0,.655,-.025],[.046,.043,.047]);
    leaf(art,detail,[0,.42,.427],-.7,.28,"#99C1A0");
    if(d.hat === "aviator") for(const side of [-1,1]) {art.mesh(detail,"plush",brown,[side*.50,.14,-.015],[.13,.29,.17]);art.mesh(detail,"plush",d.accent,[side*.23,.46,.398],[.17,.12,.07]);art.mesh(detail,"plush","#91BDC8",[side*.23,.46,.46],[.13,.078,.02]);}
    if(d.hat === "conductor") art.mesh(detail,"plush",paper,[0,.39,.45],[.095,.060,.025]);
  }
  if(d.hat === "beret") {art.mesh(detail,"plush",d.coat,[.035,.47,-.035],[.62,.21,.46],[0,0,-.16]);art.mesh(detail,"cylinder",d.coat,[.05,.695,-.035],[.033,.12,.033],[0,0,.3]);}
  if(d.hat === "chef") {
    art.mesh(detail,"cylinder",paper,[0,.49,-.05],[.42,.23,.35]);
    for(const side of [-1,0,1]) art.mesh(detail,"plush",paper,[side*.24,.72+(side===0?.10:0),-.05],[.27,.24,.29]);
  }
  if(d.hat === "headphones") {
    const band = new THREE.Mesh(art.ownGeometry(new THREE.TorusGeometry(.59,.045,8,32,Math.PI)),art.material(d.coat));band.position.y=.08;detail.add(band);
    for(const side of [-1,1]) {art.mesh(detail,"plush",d.coat,[side*.59,.09,0],[.13,.21,.22]);art.mesh(detail,"plush",d.accent,[side*.68,.09,.018],[.055,.135,.14]);}
  }
  if(d.hat === "bow") for(const side of [-1,1]) art.mesh(detail,"plush",d.accent,[.35+side*.10,.46,.21],[.13,.082,.049],[0,0,side*.34]);
  if(d.hat === "pom") {art.mesh(detail,"plush",d.coat,[0,.46,-.035],[.58,.23,.46]);art.mesh(detail,"plush",paper,[.06,.75,-.04],[.17,.17,.16]);}
  if(d.hat === "lotus") for(let i=0;i<7;i++){const a=i*Math.PI*2/7;art.mesh(leaves,"plush",i%2?"#F0AFCC":"#F7D0DF",[Math.cos(a)*.22,.61,Math.sin(a)*.18],[.13,.29,.11],[Math.sin(a)*.6,0,-Math.cos(a)*.6]);}
  if(d.hat === "nightcap") {art.mesh(detail,"cone",d.coat,[.12,.72,-.03],[.43,.67,.34],[0,0,-.38]);art.mesh(detail,"plush",paper,[.31,1.05,-.03],[.10,.10,.10]);art.mesh(detail,"plush",d.coat,[0,.49,-.015],[.56,.105,.42]);}
  if(d.hat === "mushroom") {
    const cap=new THREE.Mesh(art.ownGeometry(new THREE.SphereGeometry(1,32,16,0,Math.PI*2,0,Math.PI/2)),art.material(d.coat));cap.position.y=.46;cap.scale.set(.75,.47,.55);detail.add(cap);
    art.mesh(detail,"plush",paper,[0,.45,0],[.74,.055,.54]);
    for(const [x,y,z] of [[-.27,.77,.31],[.20,.83,.25],[.45,.66,.26],[-.46,.60,.24],[0,.88,-.13]])art.mesh(detail,"plush",paper,[x,y,z],[.09,.028,.075],[.5,0,0]);
  }
  mergeArt(detail,art);
  mergeArt(leaves,art);
}

export function decorateOutfit(art: ArtResources, hips: THREE.Group, d: CompanionDesign) {
  const clothes=joint(hips,"outfit",0,0,0);
  if(["apron","overalls","vest"].includes(d.outfit)) {
    art.mesh(clothes,"plush",d.coat,[0,.24,.012],[.525,.33,.40]);
    art.mesh(clothes,"plush",d.coat,[0,.44,.332],[.31,.28,.10]);
    for(const side of [-1,1]) {art.mesh(clothes,"plush",d.coat,[side*.29,.54,.264],[.064,.23,.055],[0,0,-side*.22]);art.mesh(clothes,"plush",d.accent,[side*.29,.42,.372],[.036,.036,.017]);}
    art.mesh(clothes,"plush",d.accent,[0,.17,.408],[.18,.10,.020]);
    badge(art,clothes,0,.18,.433);
  }
  if(d.outfit === "scarf") {
    const scarf = new THREE.Mesh(art.ownGeometry(new THREE.TorusGeometry(.455,.070,10,32)),art.material(d.accent));scarf.rotation.x=Math.PI/2;scarf.position.y=.58;clothes.add(scarf);
    art.mesh(clothes,"plush",d.accent,[0,.48,.357],[.45,.11,.089],[0,0,-.08]);
    art.mesh(clothes,"plush",d.accent,[.38,.34,.255],[.09,.22,.04],[0,0,-.30]);
  }
  if(d.outfit === "bowtie") {for(const side of [-1,1])art.mesh(clothes,"plush",d.coat,[side*.10,.57,.369],[.125,.075,.06],[0,0,side*.28]);art.mesh(clothes,"plush",d.accent,[0,.57,.418],[.045,.043,.025]);}
  if(d.prop === "satchel") {
    curve(art,clothes,[[-.38,.66,.25],[-.2,.52,.41],[.09,.31,.45],[.30,.22,.31]],teal,.047);
    art.mesh(clothes,"plush",teal,[.26,.24,.38],[.23,.22,.10]);badge(art,clothes,.26,.27,.474);
  }
  if(["map","book","scroll","letter","cards","ticket"].includes(d.prop)) {
    const held=joint(clothes,"held-pages",0,.31,.50);held.rotation.x=-.20;
    if(d.prop === "book" || d.prop === "map") {
      for(const side of [-1,1]) {
        art.mesh(held,"box",d.prop === "book"?d.accent:teal,[side*.16,0,0],[.32,.36,.065],[0,side*.28,0]);
        art.mesh(held,"box",paper,[side*.16,.005,.042],[.28,.31,.027],[0,side*.28,0]);
        for(let line=0;line<3;line++) art.mesh(held,"box",d.prop === "map"?"#AAD6BD":"#D0B591",[side*.16,.075-line*.052,.065],[.19,.008,.012],[0,side*.28,0]);
      }
    } else {art.mesh(held,"box",paper,[0,0,0],[.45,.29,.065],[0,0,.09]);badge(art,held,0,0,.043,d.accent);}
  }
  if(["pencil","brush","quill","spoon","lens","microphone","key"].includes(d.prop)) {
    const tool=joint(clothes,"held-tool",-.51,.24,.20);tool.rotation.z=.14;
    art.mesh(tool,"cylinder",d.prop==="pencil"?"#F5C669":brown,[0,.35,0],[.045,.71,.045]);
    if(d.prop === "pencil") {art.mesh(tool,"cone",paper,[0,.80,0],[.046,.20,.046]);art.mesh(tool,"cone","#5C5246",[0,.89,0],[.018,.06,.018]);art.mesh(tool,"cylinder",d.accent,[0,-.04,0],[.049,.15,.049]);}
    if(d.prop === "brush") {art.mesh(tool,"cylinder",paper,[0,.71,0],[.055,.12,.055]);art.mesh(tool,"plush",d.coat,[0,.83,0],[.08,.14,.06]);}
    if(d.prop === "quill") leaf(art,tool,[0,.49,0],-.28,.65,paper);
    if(d.prop === "spoon") art.mesh(tool,"plush",paper,[0,.77,0],[.125,.16,.045]);
    if(d.prop === "microphone") art.mesh(tool,"plush",d.coat,[0,.76,0],[.12,.14,.10]);
    if(d.prop === "lens" || d.prop === "key") {const ring=new THREE.Mesh(art.ownGeometry(new THREE.TorusGeometry(.15,.027,8,24)),art.material(d.prop==="key"?"#EBC779":teal));ring.position.y=.80;tool.add(ring);}
  }
  if(d.prop === "cup") {art.mesh(clothes,"cylinder",paper,[-.43,.43,.29],[.12,.22,.12]);art.mesh(clothes,"cylinder",brown,[-.43,.549,.29],[.097,.008,.097]);const handle=new THREE.Mesh(art.ownGeometry(new THREE.TorusGeometry(.072,.02,7,18)),art.material(paper));handle.position.set(-.56,.44,.29);clothes.add(handle);}
  if(d.prop === "watering") {art.mesh(clothes,"plush",d.accent,[-.50,.28,.21],[.19,.20,.16]);curve(art,clothes,[[-.60,.26,.20],[-.74,.37,.21],[-.79,.46,.21]],d.accent,.055);}
  if(d.prop === "star") {art.mesh(clothes,"plush",d.accent,[0,.26,.46],[.14,.14,.04]);for(let i=0;i<5;i++){const a=i*Math.PI*2/5;art.mesh(clothes,"cone",d.accent,[Math.sin(a)*.14,.26+Math.cos(a)*.14,.46],[.07,.17,.035],[0,0,-a]);}}
  mergeArt(clothes,art);
}
