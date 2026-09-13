import * as THREE from "three";
import { ArtResources } from "./primitives";
import { createCompanion } from "./characters";

const cache = new Map<string, Promise<string>>();
let queue: Promise<unknown> = Promise.resolve();
let renderer: THREE.WebGLRenderer | null = null;
let release: ReturnType<typeof setTimeout> | undefined;

export function portraitLights(scene: THREE.Scene) {
  scene.add(new THREE.HemisphereLight("#FFFAEE", "#C4B3AB", 2.1));
  const key = new THREE.DirectionalLight("#FFF3DE", 2.5); key.position.set(-3,5,6); scene.add(key);
  const fill = new THREE.DirectionalLight("#DEEFFF", .8); fill.position.set(4,2,-3); scene.add(fill);
}

/** One short-lived GPU context produces cached portraits of the actual mesh rigs. */
export function characterPortrait(id: string): Promise<string> {
  const existing = cache.get(id); if (existing) return existing;
  const job = queue.catch(() => {}).then(async () => {
    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
    clearTimeout(release);
    const art = new ArtResources();
    try {
      if (!renderer) {
        renderer = new THREE.WebGLRenderer({alpha:true,antialias:true});
        renderer.setSize(256,256); renderer.setPixelRatio(1);
        renderer.outputColorSpace=THREE.SRGBColorSpace;
        renderer.toneMapping=THREE.ACESFilmicToneMapping; renderer.toneMappingExposure=1.04;
      }
      const scene = new THREE.Scene(); portraitLights(scene);
      const rig = createCompanion(art,id); scene.add(rig.root);
      const camera = new THREE.OrthographicCamera(-1.25,1.25,1.30,-1.30,.1,30);
      camera.position.set(2.6,2.8,8);camera.lookAt(0,1.18,0);
      renderer.setClearColor(0,0);renderer.render(scene,camera);
      const image = renderer.domElement.toDataURL("image/png");
      rig.mixer.stopAllAction();rig.mixer.uncacheRoot(rig.root);
      return image;
    } finally {
      art.dispose();
      release=setTimeout(() => {renderer?.dispose();renderer?.forceContextLoss();renderer=null;},1200);
    }
  });
  cache.set(id,job); queue=job;
  void job.catch(() => cache.delete(id));
  return job;
}
