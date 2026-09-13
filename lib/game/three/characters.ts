import * as THREE from "three";
import { companionById } from "../companions";
import { ArtResources, joint, mergeArt } from "./primitives";
import { curve, decorateHead, decorateOutfit } from "./character-details";
import { createExpressions } from "./expressions";
import { expressions, personalityFor, type Expression } from "../personalities";

export type Pose = "idle" | "walk" | "run" | "jump" | "wave" | "celebrate";
export type CompanionRig = {
  root: THREE.Group; mixer: THREE.AnimationMixer; clips: THREE.AnimationClip[];
  actions: Record<Pose, THREE.AnimationAction>; current: Pose;
  express: (expression: Expression) => void;
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
  root.userData = { companionId: friend.id, name: friend.name, artVersion: "chibi-3" };
  const hips = joint(root, "hips", 0,.32,0);
  const body = joint(hips, "bean-body", 0,0,0);
  art.mesh(body, "plush", d.skin, [0,.35,0], [.565,.49,.40]);
  art.mesh(body, "plush", "#FFECC8", [0,.30,.307], [.33,.30,.068]);
  mergeArt(body, art);

  for (const side of [-1,1]) {
    const arm = joint(hips, side < 0 ? "armL" : "armR", side*.52,.59,.025);
    art.mesh(arm, "plush", d.skin, [side*.025,-.11,.055], [.16,.19,.15], [0,0,side*.12]);
    art.mesh(arm, "plush", d.skin, [side*.025,-.235,.096], [.17,.14,.145]);
    art.mesh(arm, "plush", d.skin, [-side*.055,-.193,.17], [.055,.076,.06]);
    mergeArt(arm, art);
    const leg = joint(hips, side < 0 ? "legL" : "legR", side*.225,.035,0);
    art.mesh(leg, "plush", d.skin, [0,-.12,.015], [.11,.13,.108]);
    art.mesh(leg, "plush", "#916C50", [0,-.235,.075], [.165,.105,.22]);
    art.mesh(leg, "plush", "#BA9270", [0,-.215,.214], [.118,.038,.045]);
    mergeArt(leg, art);
  }

  const head = joint(hips, "head", 0,.88,0);
  const face = joint(head, "face-surface", 0,0,0);
  const wide = ["bear","panda","cat","fox","orange","pebble"].includes(d.shape);
  const width = wide ? .70 : d.shape === "rice" ? .61 : .665;
  const height = d.shape === "pebble" ? .56 : d.shape === "drop" ? .64 : .595;
  const shape = art.ownGeometry(art.geometry("plush").clone());
  const vertices = shape.getAttribute("position");
  for (let i=0; i<vertices.count; i++) {
    const y=vertices.getY(i), taper = wide ? 1 : 1-.045*Math.max(0,y);
    vertices.setXYZ(i,vertices.getX(i)*taper, y, vertices.getZ(i)*taper);
  }
  shape.computeVertexNormals();
  const skin = new THREE.Mesh(shape, art.material(d.skin));
  skin.scale.set(width,height,.46); skin.castShadow=true; skin.receiveShadow=false; face.add(skin);
  // A cream face inset gives the avocado a recognisable silhouette without a human nose.
  if(d.shape === "avocado") art.mesh(face,"plush","#F4E2AE",[0,-.045,.335],[.455,.46,.14]);
  if(d.shape === "fox") for(const side of [-1,1]) art.mesh(face,"plush","#FFF0D1",[side*.26,-.16,.31],[.25,.27,.13],[0,0,side*.28]);

  const faceDepth = (x: number,y: number) => .46*Math.sqrt(Math.max(.1,1-(x/width)**2-(y/height)**2));
  for(const side of [-1,1]) {
    if(d.shape === "panda") art.mesh(face,"plush","#75675C",[side*.215,.045,faceDepth(side*.215,.045)-.016],[.145,.18,.035],[0,side*.25,side*.17]);
    art.mesh(face,"plush","#F0A69B",[side*.35,-.13,faceDepth(side*.35,-.13)+.013],[.092,.056,.013],[0,side*.45,0]);
  }
  const emotions=createExpressions(art,head,width,height,personalityFor(id).expression);
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

  // Individual idle rhythms are small enough to keep the face and props readable.
  const manners:Record<string,[number,number,number]>={mam:[.023,.018,.012],nang:[.006,.006,.06],may:[.013,.05,.03],soi:[.006,.005,.05],bep:[.025,.065,.035],bong:[.020,.018,.022],giot:[.008,.015,.055],hat:[.032,.04,.018],com:[-.030,.01,.055],mit:[.007,.025,.07],dao:[.015,.025,.015],dau:[.022,.035,.065],bo:[.004,.013,.038],na:[.019,.024,.020],me:[.012,.018,.045],quyt:[.027,.015,.019],sen:[.004,.028,.015],truc:[.009,.035,.008],gao:[.003,.008,.027],duong:[.016,.035,.012],moca:[.005,.008,.045],tim:[.009,.021,.052],cuon:[.013,.026,.033],bui:[.006,.013,.040]};
  const [idleBob,idleSway,idleTilt]=manners[friend.id]||manners.mam;
  const clips: THREE.AnimationClip[]=[];
  const duration: Record<Pose,number>={idle:friend.id==="gao"?6.2:friend.id==="hat"?2.8:4.2,walk:.70,run:.48,jump:1,wave:1.7,celebrate:1.2};
  for(const pose of Object.keys(duration) as Pose[]) {
    const time=duration[pose],stride=pose === "walk" ? .44 : pose === "run" ? .65 : 0;
    const tracks: THREE.KeyframeTrack[]=[
      new THREE.VectorKeyframeTrack("hips.position",cycle.map(t=>t*time),cycle.flatMap(t=>[0,.32+(stride?Math.abs(Math.sin(t*Math.PI*2))*.035:pose==="celebrate"?Math.abs(Math.sin(t*Math.PI*2))*.11:Math.sin(t*Math.PI*(friend.id==="mam"?4:2))*idleBob),0])),
      qTrack("hips",time,rotations(t=>[pose==="run"?.06:0,0,Math.sin(t)*(stride?stride*.04:pose==="idle"?idleSway:0)])),
      qTrack("legL",time,rotations(t=>[pose==="jump"?-.3:Math.sin(t)*stride,0,0])),
      qTrack("legR",time,rotations(t=>[pose==="jump"?.28:-Math.sin(t)*stride,0,0])),
      qTrack("armL",time,rotations(t=>[pose==="jump"?-.5:-Math.sin(t)*stride*.55,0,pose==="celebrate"?-.85:-.12])),
      qTrack("armR",time,rotations(t=>[pose==="jump"?-.5:Math.sin(t)*stride*.55,pose==="wave"?Math.sin(t*2)*.15:0,pose==="wave"?-2.15+Math.sin(t*2)*.20:pose==="celebrate"?.85:pose==="idle"&&(friend.id==="dao"||friend.id==="bui")?-.55+Math.sin(t)*.20:.12])),
      qTrack("head",time,rotations(t=>[Math.sin(t)*(pose==="idle"?idleTilt:.01),pose==="idle"?Math.sin(t)*idleSway:0,pose==="wave"?-.045:pose==="idle"?Math.sin(t*.5)*idleTilt*.35:0])),
      qTrack("leaves",time,rotations(t=>[Math.sin(t)*.035,0,Math.sin(t)*.025])),
    ];
    for(const eye of expressions.flatMap(({id})=>[`blink-${id}-L`,`blink-${id}-R`])) tracks.push(new THREE.VectorKeyframeTrack(`${eye}.scale`,[0,time*.79,time*.815,time*.84,time],[1,1,1,1,1,1,1,.10,1,1,1,1,1,1,1]));
    clips.push(new THREE.AnimationClip(pose,time,tracks));
  }
  const mixer=new THREE.AnimationMixer(root),actions={} as Record<Pose,THREE.AnimationAction>;
  for(const clip of clips) actions[clip.name as Pose]=mixer.clipAction(clip);
  clips.push(...emotions.clips);
  actions.idle.play();
  let expression: Expression=personalityFor(id).expression;
  const rig: CompanionRig={root,mixer,clips,actions,current:"idle",
    express(value){expression=value;emotions.set(value);},
    face(angle,delta){const difference=Math.atan2(Math.sin(angle-root.rotation.y),Math.cos(angle-root.rotation.y));root.rotation.y+=difference*(1-Math.exp(-14*delta));},
    animate(pose,delta,speed=1){emotions.set(expression);if(pose!==rig.current){actions[rig.current].fadeOut(.16);actions[pose].reset().setEffectiveWeight(1).fadeIn(.16).play();rig.current=pose;}actions[pose].setEffectiveTimeScale(speed);mixer.update(delta);}
  };
  return rig;
}
