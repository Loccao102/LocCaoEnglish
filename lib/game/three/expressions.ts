import * as THREE from "three";
import { expressions, type Expression } from "../personalities";
import { ArtResources, joint, mergeArt } from "./primitives";
import { curve } from "./character-details";

/** Small curved facial meshes follow the face. No photo planes or realistic anatomy. */
export function createExpressions(art: ArtResources, head: THREE.Group, width: number, height: number, initial: Expression = "happy") {
  const groups = {} as Record<Expression,THREE.Group>;
  const depth=(x:number,y:number)=>.46*Math.sqrt(Math.max(.1,1-(x/width)**2-(y/height)**2))+.024;
  const ink=art.ownMaterial(new THREE.MeshBasicMaterial({color:"#4B3531"}));
  const shine=art.ownMaterial(new THREE.MeshBasicMaterial({color:"#FFFCEF"}));
  const dot=(parent:THREE.Group,x:number,y:number,sx:number,sy:number,material:THREE.Material)=>{
    const mesh=new THREE.Mesh(art.geometry("plush"),material);mesh.position.set(x,y,depth(x,y));mesh.scale.set(sx,sy,.022);parent.add(mesh);return mesh;
  };
  for(const {id} of expressions) {
    const group=joint(head,`expression-${id}`,0,0,0);groups[id]=group;
    for(const side of [-1,1]) {
      const x=side*.215,eye=joint(group,`blink-${id}-${side<0?"L":"R"}`,0,0,0);
      if(id==="joy"||id==="sleepy") {
        const y=id==="joy"?.055:.025, lift=id==="joy"?.064:-.025;
        curve(art,eye,[[x-.08,y,depth(x-.08,y)],[x,y+lift,depth(x,y+lift)],[x+.08,y,depth(x+.08,y)]],"#4B3531",.019);
      } else if(id==="love") {
        const heart=new THREE.Shape();heart.moveTo(0,-.075);heart.bezierCurveTo(-.17,.03,-.065,.16,0,.07);heart.bezierCurveTo(.065,.16,.17,.03,0,-.075);
        const mesh=new THREE.Mesh(art.ownGeometry(new THREE.ShapeGeometry(heart,12)),art.ownMaterial(new THREE.MeshBasicMaterial({color:"#CF607B",side:THREE.DoubleSide})));mesh.position.set(x,.04,depth(x,.04)+.018);mesh.rotation.y=side*.22;eye.add(mesh);
      } else {
        const sy=id==="surprised"?.135:id==="thinking"?.082:id==="sad"?.095:.116;
        const pupil=dot(eye,x,.06,.081,sy,ink);pupil.rotation.y=side*.20;
        const glint=dot(eye,x-.023,.092,.024,.027,shine);glint.position.z+=.023;
        const glint2=dot(eye,x+.027,.015,.010,.011,shine);glint2.position.z+=.023;
      }
      const browY=id==="surprised"?.29:id==="sad"?.21:id==="curious"&&side===1?.31:.25;
      curve(art,group,[[x-.06,browY+(id==="sad"?side*.035:0),depth(x-.06,browY)],[x,browY+.015,depth(x,browY+.015)],[x+.065,browY-(id==="sad"?side*.035:0),depth(x+.065,browY)]],"#987452",.012);
      if(id==="sad") dot(group,x+side*.045,-.11,.031,.060,art.material("#A3DBEC"));
    }
    if(id==="surprised") dot(group,0,-.18,.061,.079,ink);
    else if(id==="joy"||id==="love") {
      const smile=dot(group,0,-.185,.118,.069,ink);smile.position.z=.468;
      const tongue=dot(group,0,-.215,.063,.034,art.material("#F6A8A2"));tongue.position.z=.491;
    } else {
      const offset=id==="thinking"?.045:0;
      const mid=id==="sad"?-.14:id==="sleepy"?-.18:id==="thinking"?-.186:-.225;
      curve(art,group,[[offset-.07,-.18,.468],[offset,mid,.480],[offset+.07,-.18,.468]],"#62443A",.014);
    }
    // Only the static mouth and brows merge; blink joints retain their own meshes.
    for(const child of group.children) if(child instanceof THREE.Group)mergeArt(child,art);
    group.scale.setScalar(id===initial?1:0);
  }
  return {
    clips: expressions.map(({id})=>new THREE.AnimationClip(`expression-${id}`,1,expressions.map(other=>new THREE.VectorKeyframeTrack(`expression-${other.id}.scale`,[0,1],Array(6).fill(other.id===id?1:0))))),
    set(id:Expression){for(const emotion of expressions){groups[emotion.id].scale.setScalar(emotion.id===id?1:0);groups[emotion.id].visible=emotion.id===id;}},
  };
}
