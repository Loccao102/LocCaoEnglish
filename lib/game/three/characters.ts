import * as THREE from "three";
import { ArtResources, colors, joint } from "./primitives";

export type Pose = "idle" | "walk" | "run" | "jump" | "wave" | "celebrate";
export type CompanionRig = { root: THREE.Group; mixer: THREE.AnimationMixer; clips: THREE.AnimationClip[]; actions: Record<Pose, THREE.AnimationAction>; current: Pose; face: (angle: number, delta: number) => void; animate: (pose: Pose, delta: number, speed?: number) => void; };
const palettes: Record<string,{ skin: string; coat: string; accent: string; shoes: string }> = {
  mam: { skin: "#e2dfb3", coat: "#548b67", accent: "#edba59", shoes: "#776141" },
  nang: { skin: "#efcf80", coat: "#e6ac52", accent: "#e27d63", shoes: "#806548" },
  may: { skin: "#eae2c8", coat: "#6fa4a7", accent: "#e1a569", shoes: "#536e71" },
  soi: { skin: "#a8b6ad", coat: "#d49071", accent: "#688c71", shoes: "#666950" },
};
const cycle = [0,.125,.25,.375,.5,.625,.75,.875,1];
const qTrack = (name: string, duration: number, values: [number,number,number][]) => new THREE.QuaternionKeyframeTrack(`${name}.quaternion`,cycle.map(t=>t*duration),values.flatMap(value=>new THREE.Quaternion().setFromEuler(new THREE.Euler(...value)).toArray()));
const rotations = (fn: (phase: number) => [number,number,number]) => cycle.map(t => fn(t*Math.PI*2));

/** Original rigid-joint mesh character. No billboard or raster frames are used. */
export function createCompanion(art: ArtResources, id: string): CompanionRig {
  const palette = palettes[id] || palettes.mam;
  const root = new THREE.Group(); root.name = `${id}-companion`;
  const hips = joint(root,"hips",0,.62,0);
  art.mesh(hips,"ball",palette.coat,[0,.08,0],[.36,.43,.27]);
  art.mesh(hips,"ball",palette.skin,[0,.10,.24],[.22,.24,.055]);
  for (const side of [-1,1]) {
    const arm = joint(hips,side<0?"armL":"armR",side*.37,.3,0);
    art.mesh(arm,"ball",palette.coat,[side*.025,-.12,0],[.12,.21,.125]);
    art.mesh(arm,"ball",palette.skin,[side*.035,-.30,.015],[.112,.13,.105]);
    const leg = joint(hips,side<0?"legL":"legR",side*.17,-.20,0);
    art.mesh(leg,"ball",palette.skin,[0,-.16,0],[.105,.20,.108]);
    art.mesh(leg,"ball",palette.shoes,[0,-.34,.07],[.14,.09,.21]);
  }
  const head = joint(hips,"head",0,.69,0);
  art.mesh(head,"ball",palette.skin,[0,0,0],[.47,.43,.39]);
  art.mesh(head,"ball",colors.cream,[0,-.085,.34],[.31,.18,.065]);
  for (const side of [-1,1]) {
    const eye = art.mesh(head,"ball",colors.ink,[side*.16,.045,.362],[.046,.065,.035]); eye.name = side<0?"eyeL":"eyeR";
    art.mesh(head,"ball","#fff7de",[side*.16-.012,.065,.391],[.013,.018,.008]);
    art.mesh(head,"ball","#e6ad8b",[side*.28,-.095,.324],[.062,.031,.012]);
  }
  const smileCurve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(-.065,-.11,.407),new THREE.Vector3(0,-.16,.43),new THREE.Vector3(.065,-.11,.407));
  head.add(new THREE.Mesh(art.ownGeometry(new THREE.TubeGeometry(smileCurve,8,.012,6,false)),art.material(colors.ink)));
  art.mesh(head,"cylinder",colors.wood,[0,.44,0],[.035,.20,.035],[0,0,-.2]);
  const leaves = joint(head,"leaves",0,.49,0);
  art.mesh(leaves,"leaf",id==="nang"?"#dfa243":"#729e63",[-.12,.08,0],[.10,.25,.055],[.15,0,.75]);
  art.mesh(leaves,"leaf","#9cb96d",[.13,.10,0],[.11,.28,.055],[-.2,0,-.7]);
  const collar = new THREE.Mesh(art.ownGeometry(new THREE.TorusGeometry(.245,.047,8,24)),art.material(palette.accent));
  collar.rotation.x=Math.PI/2;collar.position.y=.42;hips.add(collar);
  art.mesh(hips,"box",palette.accent,[.19,.27,.25],[.12,.26,.055],[0,0,-.25]);
  art.mesh(hips,"ball",colors.wood,[0,.12,-.285],[.24,.27,.115]);
  art.mesh(hips,"box",palette.accent,[0,.20,-.391],[.25,.095,.025]);
  art.mesh(hips,"ball",colors.honey,[0,.10,-.4],[.035,.043,.016]);
  if (id === "may") {
    art.mesh(head,"ball",palette.coat,[0,.29,-.03],[.48,.20,.40]);
    art.mesh(head,"ball",palette.coat,[0,.27,.30],[.43,.045,.25]);
  }
  if (id === "nang") {
    for(let i=0;i<6;i++){const angle=i*Math.PI/3;art.mesh(head,"ball",colors.cream,[.36+Math.cos(angle)*.085,.23+Math.sin(angle)*.085,.22],[.063,.063,.027]);}
    art.mesh(head,"ball",colors.honey,[.36,.23,.25],[.055,.055,.03]);
  }
  if (id === "soi") {
    art.mesh(hips,"box",palette.accent,[0,.06,.28],[.35,.40,.027]);
    art.mesh(hips,"box",colors.cream,[.11,.13,.305],[.08,.13,.02],[0,0,-.13]);
  }

  const clips: THREE.AnimationClip[]=[];
  const duration: Record<Pose,number>={idle:3.6,walk:.8,run:.5,jump:1,wave:1.5,celebrate:1};
  for (const pose of Object.keys(duration) as Pose[]) {
    const time=duration[pose], stride=pose==="walk"?.64:pose==="run"?1.0:0;
    const tracks: THREE.KeyframeTrack[]=[
      new THREE.VectorKeyframeTrack("hips.position",cycle.map(t=>t*time),cycle.flatMap(t=>[0,.62+(stride?Math.abs(Math.sin(t*Math.PI*2))*(pose==="run"?.075:.035):pose==="celebrate"?Math.abs(Math.sin(t*Math.PI*2))*.19:Math.sin(t*Math.PI*2)*.014),0])),
      qTrack("hips",time,rotations(t=>[pose==="run"?.12:0,Math.sin(t)*(stride*.05),Math.sin(t)*stride*.055])),
      qTrack("legL",time,rotations(t=>[pose==="jump"?-.55:Math.sin(t)*stride,0,0])),
      qTrack("legR",time,rotations(t=>[pose==="jump"?.50:-Math.sin(t)*stride,0,0])),
      qTrack("armL",time,rotations(t=>[pose==="jump"?-.8:-Math.sin(t)*stride*.7,0,pose==="celebrate"?-.9:-.10])),
      qTrack("armR",time,rotations(t=>[pose==="jump"?-.8:Math.sin(t)*stride*.7,pose==="wave"?Math.sin(t*2)*.28:0,pose==="wave"?-2.35+Math.sin(t*2)*.3:pose==="celebrate"?1.05:.10])),
      qTrack("head",time,rotations(t=>[Math.sin(t)*.025,pose==="idle"?Math.sin(t)*.09:0,pose==="wave"?-.10:0])),
      qTrack("leaves",time,rotations(t=>[Math.sin(t)*.10,0,Math.sin(t)*.08])),
    ];
    for(const eye of ["eyeL","eyeR"])tracks.push(new THREE.VectorKeyframeTrack(`${eye}.scale`,[0,time*.77,time*.80,time*.83,time],[.046,.065,.035,.046,.065,.035,.046,.008,.035,.046,.065,.035,.046,.065,.035]));
    clips.push(new THREE.AnimationClip(pose,time,tracks));
  }
  const mixer=new THREE.AnimationMixer(root),actions={} as Record<Pose,THREE.AnimationAction>;
  for(const clip of clips)actions[clip.name as Pose]=mixer.clipAction(clip);
  actions.idle.play();
  const rig: CompanionRig={root,mixer,clips,actions,current:"idle",face(angle,delta){const difference=Math.atan2(Math.sin(angle-root.rotation.y),Math.cos(angle-root.rotation.y));root.rotation.y+=difference*(1-Math.exp(-14*delta));},animate(pose,delta,speed=1){if(pose!==rig.current){actions[rig.current].fadeOut(.16);actions[pose].reset().setEffectiveWeight(1).fadeIn(.16).play();rig.current=pose;}actions[pose].setEffectiveTimeScale(speed);mixer.update(delta);}};
  return rig;
}
