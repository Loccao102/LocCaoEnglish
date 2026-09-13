import * as THREE from "three";
import { ArtResources } from "./primitives";
import { createCompanion, type CompanionRig, type Pose } from "./characters";
import { portraitLights } from "./portraits";

export class ModelPreview {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(32,1,.1,40);
  private art = new ArtResources();
  private rig: CompanionRig;
  private resize: ResizeObserver;
  private frame=0;
  private last=0;
  private angle=.25;
  private pointer: {id:number;x:number}|null=null;
  private pose: Pose="idle";
  private reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
  constructor(private host: HTMLDivElement,id: string) {
    this.renderer=new THREE.WebGLRenderer({alpha:true,antialias:true});
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.6));
    this.renderer.outputColorSpace=THREE.SRGBColorSpace;
    this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.04;
    this.renderer.domElement.setAttribute("role","img");this.renderer.domElement.setAttribute("aria-label","Animated 3D companion. Drag to turn the model.");
    host.appendChild(this.renderer.domElement);portraitLights(this.scene);
    this.rig=createCompanion(this.art,id);this.scene.add(this.rig.root);
    this.camera.position.set(0,2.05,5.55);this.camera.lookAt(0,1.16,0);
    this.resize=new ResizeObserver(entries=>{const {width,height}=entries[0].contentRect;this.renderer.setSize(Math.max(1,width),Math.max(1,height));this.camera.aspect=Math.max(1,width)/Math.max(1,height);this.camera.updateProjectionMatrix();});this.resize.observe(host);
    host.addEventListener("pointerdown",this.down);host.addEventListener("pointermove",this.move);host.addEventListener("pointerup",this.up);host.addEventListener("pointercancel",this.up);
    this.frame=requestAnimationFrame(this.draw);
  }
  private down=(event: PointerEvent)=>{if(event.button!==0)return;this.pointer={id:event.pointerId,x:event.clientX};this.host.setPointerCapture(event.pointerId);};
  private move=(event: PointerEvent)=>{if(!this.pointer||this.pointer.id!==event.pointerId)return;this.angle+=(event.clientX-this.pointer.x)*.012;this.pointer.x=event.clientX;};
  private up=(event: PointerEvent)=>{if(this.host.hasPointerCapture(event.pointerId))this.host.releasePointerCapture(event.pointerId);this.pointer=null;};
  turn(direction: number){this.angle+=direction*Math.PI/4;}
  setPose(pose: Pose){this.pose=pose;}
  private draw=(timestamp: number)=>{
    const dt=this.last?Math.min(.05,(timestamp-this.last)/1000):0;this.last=timestamp;
    this.rig.root.rotation.y=this.angle;
    this.rig.animate(this.pose,this.reduced.matches&&this.pose==="idle"?0:dt);
    this.renderer.render(this.scene,this.camera);this.frame=requestAnimationFrame(this.draw);
  };
  dispose(){cancelAnimationFrame(this.frame);this.resize.disconnect();this.host.removeEventListener("pointerdown",this.down);this.host.removeEventListener("pointermove",this.move);this.host.removeEventListener("pointerup",this.up);this.host.removeEventListener("pointercancel",this.up);this.rig.mixer.stopAllAction();this.rig.mixer.uncacheRoot(this.rig.root);this.art.dispose();this.renderer.dispose();this.renderer.forceContextLoss();this.renderer.domElement.remove();}
}
