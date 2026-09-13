import * as THREE from "three";
import { companionById } from "../companions";
import { ArtResources, joint, mergeArt } from "./primitives";
import { curve, decorateHead, decorateOutfit } from "./character-details";

export type Pose = "idle" | "walk" | "run" | "jump" | "wave" | "celebrate";
export type CompanionRig = {
  root: THREE.Group; mixer: THREE.AnimationMixer; clips: THREE.AnimationClip[];
  actions: Record<Pose, THREE.AnimationAction>; current: Pose;
  face: (angle: number, delta: number) => void;
  animate: (pose: Pose, delta: number, speed?: number) => void;
};
const cycle = [0,.125,.25,.375,.5,.625,.75,.875,1];
const qTrack = (name: string, duration: number, values: [number,number,number][]) => new THREE.QuaternionKeyframeTrack(
  `${name}.quaternion`, cycle.map(t => t*duration), values.flatMap(value => new THREE.Quaternion().setFromEuler(new THREE.Euler(...value)).toArray())
);
const rotations = (fn: (phase: number) => [number,number,number]) => cycle.map(t => fn(t*Math.PI*2));

/** The reference art's soft bean silhouette: overlapping head/body, no neck, tiny limbs. */
export function createCompanion(art: ArtResources, id: string): CompanionRig {
  const friend = companionById(id), d = friend.design;
  const root = new THREE.Group(); root.name = `${friend.id}-companion`;
  root.userData = { companionId: friend.id, name: friend.name, artVersion: "chibi-2" };
  const hips = joint(root, "hips", 0,.32,0);
  const body = joint(hips, "bean-body", 0,0,0);
  art.mesh(body, "plush", d.skin, [0,.35,0], [.525,.49,.365]);
  art.mesh(body, "plush", "#FFECC8", [0,.30,.307], [.33,.30,.068]);
  mergeArt(body, art);

  for (const side of [-1,1]) {
    const arm = joint(hips, side < 0 ? "armL" : "armR", side*.48,.61,.025);
    art.mesh(arm, "plush", d.skin, [side*.025,-.11,.055], [.145,.215,.13], [0,0,side*.12]);
    art.mesh(arm, "plush", d.skin, [side*.025,-.235,.096], [.148,.13,.125]);
    art.mesh(arm, "plush", d.skin, [-side*.055,-.193,.17], [.055,.076,.06]);
    mergeArt(arm, art);
    const leg = joint(hips, side < 0 ? "legL" : "legR", side*.225,.035,0);
    art.mesh(leg, "plush", d.skin, [0,-.12,.015], [.11,.13,.108]);
    art.mesh(leg, "plush", "#916C50", [0,-.235,.075], [.165,.105,.22]);
    art.mesh(leg, "plush", "#BA9270", [0,-.215,.214], [.118,.038,.045]);
    mergeArt(leg, art);
  }

  const head = joint(hips, "head", 0,.94,0);
  const face = joint(head, "face-surface", 0,0,0);
  const wide = ["bear","panda","cat","fox","orange","pebble"].includes(d.shape);
  const width = wide ? .625 : d.shape === "rice" ? .55 : .59;
  const height = d.shape === "pebble" ? .57 : d.shape === "drop" ? .69 : .635;
  const shape = art.ownGeometry(art.geometry("plush").clone());
  const vertices = shape.getAttribute("position");
  for (let i=0; i<vertices.count; i++) {
    const y=vertices.getY(i), taper = wide ? 1 : 1-.12*Math.max(0,y);
    vertices.setXYZ(i,vertices.getX(i)*taper, y, vertices.getZ(i)*taper);
  }
  shape.computeVertexNormals();
  const skin = new THREE.Mesh(shape, art.material(d.skin));
  skin.scale.set(width,height,.435); skin.castShadow=true; skin.receiveShadow=false; face.add(skin);
  // A cream face inset gives the avocado a recognisable silhouette without a human nose.
  if(d.shape === "avocado") art.mesh(face,"plush","#F4E2AE",[0,-.045,.298],[.455,.46,.145]);
  if(d.shape === "fox") for(const side of [-1,1]) art.mesh(face,"plush","#FFF0D1",[side*.26,-.16,.27],[.25,.27,.13],[0,0,side*.28]);

  const ink = art.ownMaterial(new THREE.MeshBasicMaterial({color:"#3D302A"}));
  const shine = art.ownMaterial(new THREE.MeshBasicMaterial({color:"#FFFCED"}));
  const blush = art.ownMaterial(new THREE.MeshBasicMaterial({color:"#EE9E92"}));
  const faceDepth = (x: number,y: number) => .435*Math.sqrt(Math.max(.1,1-(x/width)**2-(y/height)**2));
  for (const side of [-1,1]) {
    const x=side*.205, y=.065, z=faceDepth(x,y)+.012;
    if(d.shape === "panda") art.mesh(face,"plush","#75675C",[x,y-.015,z-.012],[.145,.18,.035],[0,side*.25,side*.17]);
    const eye = joint(head,side < 0 ? "eyeL" : "eyeR",x,y,z+.012);
    eye.rotation.y=side*.24;
    const pupil=new THREE.Mesh(art.geometry("plush"),ink);pupil.scale.set(.087,.119,.025);eye.add(pupil);
    const glow=new THREE.Mesh(art.geometry("ball"),shine);glow.position.set(-.022,.046,.025);glow.scale.set(.026,.030,.008);eye.add(glow);
    const twinkle=new THREE.Mesh(art.geometry("ball"),shine);twinkle.position.set(.028,-.050,.025);twinkle.scale.set(.011,.012,.006);eye.add(twinkle);
    const cheek=new THREE.Mesh(art.geometry("plush"),blush);cheek.position.set(side*.335,-.13,faceDepth(side*.335,-.13)+.012);cheek.scale.set(.083,.052,.009);cheek.rotation.y=side*.5;face.add(cheek);
    curve(art,face,[[side*.15,.267,faceDepth(side*.15,.267)+.015],[side*.205,.283,faceDepth(side*.205,.283)+.017],[side*.26,.25,faceDepth(side*.26,.25)+.015]],"#94704E",.015);
  }
  if(["nang","na","moca","gao"].includes(friend.id)) {
    curve(art,face,[[-.078,-.15,.439],[0,-.191,.451],[.078,-.15,.439]],"#704C38",.013);
  } else {
    const mouthShape=new THREE.Shape();
    mouthShape.moveTo(-.105,-.137);mouthShape.quadraticCurveTo(0,-.16,.105,-.137);
    mouthShape.quadraticCurveTo(.097,-.282,0,-.288);mouthShape.quadraticCurveTo(-.097,-.282,-.105,-.137);
    const mouth=new THREE.Mesh(art.ownGeometry(new THREE.ShapeGeometry(mouthShape,16)),art.ownMaterial(new THREE.MeshBasicMaterial({color:"#7C4036",side:THREE.DoubleSide})));
    mouth.position.z=.443;face.add(mouth);
    const tongue=new THREE.Mesh(art.geometry("plush"),art.ownMaterial(new THREE.MeshBasicMaterial({color:"#EF9C87"})));
    tongue.position.set(0,-.247,.449);tongue.scale.set(.062,.032,.005);face.add(tongue);
  }
  if(d.shape === "chick") art.mesh(face,"plush","#E9A865",[0,-.085,.463],[.075,.044,.046]);
  if(d.shape === "berry") for(const [x,y] of [[-.38,.20],[.37,.21],[-.25,.43],[.23,.44]]) art.mesh(face,"plush","#FFE2AB",[x,y,faceDepth(x,y)+.013],[.016,.033,.008],[0,0,-.15]);
  if(friend.id === "soi") for(const [x,y,r] of [[-.34,.29,.038],[.31,.33,.031],[.41,.06,.037]]) art.mesh(face,"plush","#DD806C",[x,y,faceDepth(x,y)+.012],[r,r*1.22,.008]);
  mergeArt(face, art);
  // Eyes and catchlights blink together, avoiding floating white dots.
  if(friend.id === "nang" || friend.id === "mit") {
    const glasses=joint(head,"round-glasses",0,0,0);
    for(const side of [-1,1]) {
      const ring=new THREE.Mesh(art.ownGeometry(new THREE.TorusGeometry(.158,.016,8,32)),art.material("#298D8A"));
      ring.position.set(side*.211,.067,.498);ring.scale.y=1.08;glasses.add(ring);
      curve(art,glasses,[[side*.36,.09,.48],[side*.47,.08,.31],[side*.53,.035,.10]],"#298D8A",.015);
    }
    curve(art,glasses,[[-.053,.068,.50],[0,.103,.512],[.053,.068,.50]],"#298D8A",.015);
    mergeArt(glasses,art);
  }
  const leaves=joint(head,"leaves",0,0,0);
  decorateHead(art,head,leaves,d);
  decorateOutfit(art,hips,d);

  const clips: THREE.AnimationClip[]=[];
  const duration: Record<Pose,number>={idle:4.2,walk:.70,run:.48,jump:1,wave:1.7,celebrate:1.2};
  for(const pose of Object.keys(duration) as Pose[]) {
    const time=duration[pose],stride=pose === "walk" ? .44 : pose === "run" ? .65 : 0;
    const tracks: THREE.KeyframeTrack[]=[
      new THREE.VectorKeyframeTrack("hips.position",cycle.map(t=>t*time),cycle.flatMap(t=>[0,.32+(stride?Math.abs(Math.sin(t*Math.PI*2))*.035:pose==="celebrate"?Math.abs(Math.sin(t*Math.PI*2))*.11:Math.sin(t*Math.PI*2)*.008),0])),
      qTrack("hips",time,rotations(t=>[pose==="run"?.06:0,0,Math.sin(t)*stride*.04])),
      qTrack("legL",time,rotations(t=>[pose==="jump"?-.3:Math.sin(t)*stride,0,0])),
      qTrack("legR",time,rotations(t=>[pose==="jump"?.28:-Math.sin(t)*stride,0,0])),
      qTrack("armL",time,rotations(t=>[pose==="jump"?-.5:-Math.sin(t)*stride*.55,0,pose==="celebrate"?-.85:-.12])),
      qTrack("armR",time,rotations(t=>[pose==="jump"?-.5:Math.sin(t)*stride*.55,pose==="wave"?Math.sin(t*2)*.15:0,pose==="wave"?-2.15+Math.sin(t*2)*.20:pose==="celebrate"?.85:.12])),
      qTrack("head",time,rotations(t=>[Math.sin(t)*.01,pose==="idle"?Math.sin(t)*.022:0,pose==="wave"?-.045:0])),
      qTrack("leaves",time,rotations(t=>[Math.sin(t)*.035,0,Math.sin(t)*.025])),
    ];
    for(const eye of ["eyeL","eyeR"]) tracks.push(new THREE.VectorKeyframeTrack(`${eye}.scale`,[0,time*.79,time*.815,time*.84,time],[1,1,1,1,1,1,1,.10,1,1,1,1,1,1,1]));
    clips.push(new THREE.AnimationClip(pose,time,tracks));
  }
  const mixer=new THREE.AnimationMixer(root),actions={} as Record<Pose,THREE.AnimationAction>;
  for(const clip of clips) actions[clip.name as Pose]=mixer.clipAction(clip);
  actions.idle.play();
  const rig: CompanionRig={root,mixer,clips,actions,current:"idle",
    face(angle,delta){const difference=Math.atan2(Math.sin(angle-root.rotation.y),Math.cos(angle-root.rotation.y));root.rotation.y+=difference*(1-Math.exp(-14*delta));},
    animate(pose,delta,speed=1){if(pose!==rig.current){actions[rig.current].fadeOut(.16);actions[pose].reset().setEffectiveWeight(1).fadeIn(.16).play();rig.current=pose;}actions[pose].setEffectiveTimeScale(speed);mixer.update(delta);}
  };
  return rig;
}
