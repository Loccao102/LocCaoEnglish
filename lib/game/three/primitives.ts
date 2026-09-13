import * as THREE from "three";
import { mergeGeometries, mergeVertices } from "three/addons/utils/BufferGeometryUtils.js";

export const SCALE = 40;
export const worldPoint = (x: number, y: number) => new THREE.Vector3((x-600)/SCALE, 0, (y-410)/SCALE);
export const mapPoint = (point: THREE.Vector3) => ({ x: point.x*SCALE+600, y: point.z*SCALE+410 });
export const colors = { grass: "#9fc579", darkGrass: "#79a467", sand: "#ead8a3", path: "#f8e8be", edge: "#d7bd88", cliff: "#a69270", water: "#72bcb9", teal: "#367f78", ink: "#284940", cream: "#fff1d1", honey: "#e5b44f", coral: "#d8886f", wood: "#957257", darkWood: "#69513c", green: "#699451" };

/** Owns resources for one scene, including meshes removed during runtime. */
export class ArtResources {
  private geometries = new Map<string, THREE.BufferGeometry>();
  private materials = new Map<string, THREE.MeshStandardMaterial>();
  readonly textures = new Set<THREE.Texture>();
  readonly extraGeometry = new Set<THREE.BufferGeometry>();
  readonly extraMaterials = new Set<THREE.Material>();
  geometry(kind: string) {
    if (!this.geometries.has(kind)) {
      const geometry = kind === "plush" ? new THREE.SphereGeometry(1,32,24) : kind === "ball" ? new THREE.SphereGeometry(1, 16, 12) : kind === "rock" ? new THREE.IcosahedronGeometry(1, 1) : kind === "cylinder" ? new THREE.CylinderGeometry(1,1,1,16) : kind === "cone" ? new THREE.ConeGeometry(1,1,16) : kind === "leaf" ? new THREE.SphereGeometry(1,12,8) : new THREE.BoxGeometry(1,1,1);
      this.geometries.set(kind, geometry);
    }
    return this.geometries.get(kind)!;
  }
  material(color: string, emissive = false) {
    const key = `${color}:${emissive}`;
    if (!this.materials.has(key)) this.materials.set(key, new THREE.MeshStandardMaterial({ color, roughness: .88, metalness: 0, ...(emissive ? { emissive: color, emissiveIntensity: .45 } : {}) }));
    return this.materials.get(key)!;
  }
  mesh(parent: THREE.Object3D, kind: string, color: string, position: [number,number,number], scale: [number,number,number], rotation?: [number,number,number]) {
    const mesh = new THREE.Mesh(this.geometry(kind), this.material(color));
    mesh.position.set(...position); mesh.scale.set(...scale); if (rotation) mesh.rotation.set(...rotation);
    mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh;
  }
  ownGeometry<T extends THREE.BufferGeometry>(geometry: T): T { this.extraGeometry.add(geometry); return geometry; }
  ownMaterial<T extends THREE.Material>(material: T): T { this.extraMaterials.add(material); return material; }
  dispose() {
    for (const geometry of [...this.geometries.values(), ...this.extraGeometry]) geometry.dispose();
    for (const material of [...this.materials.values(), ...this.extraMaterials]) material.dispose();
    for (const texture of this.textures) texture.dispose();
    this.geometries.clear(); this.materials.clear(); this.extraGeometry.clear(); this.extraMaterials.clear(); this.textures.clear();
  }
}

export function joint(parent: THREE.Object3D, name: string, x: number, y: number, z: number) {
  const group = new THREE.Group(); group.name = name; group.position.set(x,y,z); parent.add(group); return group;
}

/** Collapse static art by material while preserving the owning interaction group. */
export function mergeArt(group: THREE.Group, art: ArtResources) {
  group.updateMatrixWorld(true);
  const inverse = new THREE.Matrix4().copy(group.matrixWorld).invert();
  const buckets = new Map<THREE.Material, THREE.BufferGeometry[]>();
  group.traverse(node => {
    if (!(node instanceof THREE.Mesh) || Array.isArray(node.material)) return;
    const source = node.geometry.clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(inverse,node.matrixWorld));
    const geometry = source.index ? source.toNonIndexed() : source;
    if (source !== geometry) source.dispose();
    if (!buckets.has(node.material)) buckets.set(node.material, []);
    buckets.get(node.material)!.push(geometry);
  });
  group.clear();
  for (const [material, geometries] of buckets) {
    const merged = mergeGeometries(geometries, false);
    if (merged) {
      const indexed = mergeVertices(merged, .00001); merged.dispose();
      const mesh = new THREE.Mesh(art.ownGeometry(indexed),material); mesh.castShadow = true; mesh.receiveShadow = true; group.add(mesh);
    }
    for (const geometry of geometries) geometry.dispose();
  }
}

export function label(art: ArtResources, text: string, width = 2.8, foreground = "#365c4c", background = "#fff7dd") {
  if (typeof document === "undefined") { const sprite = new THREE.Sprite(art.ownMaterial(new THREE.SpriteMaterial())); sprite.visible = false; return sprite; }
  const canvas = document.createElement("canvas"); canvas.width = 768; canvas.height = 128;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = background; ctx.beginPath(); ctx.roundRect(8,12,752,104,30); ctx.fill();
  ctx.strokeStyle = "#d7d6b0"; ctx.lineWidth = 4; ctx.stroke();
  ctx.fillStyle = foreground; ctx.font = "600 36px 'Trebuchet MS', sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(text,384,67,700);
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; art.textures.add(texture);
  const material = art.ownMaterial(new THREE.SpriteMaterial({ map: texture, depthTest: false, transparent: true }));
  const sprite = new THREE.Sprite(material); sprite.scale.set(width,width/6,1); sprite.renderOrder = 20; return sprite;
}
