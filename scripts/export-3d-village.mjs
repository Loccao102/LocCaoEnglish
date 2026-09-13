// Export the same procedural meshes and animation clips consumed by the game.
// Only generated exports and temporary transpiled modules are written.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { deflateRawSync } from 'node:zlib';
import ts from 'typescript';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';

const root=resolve('.'),cache=resolve('.cache/export-3d'),output=resolve('public/assets/sunlit-3d');
mkdirSync(output,{recursive:true});
const modules=['lib/game/catalog.ts','lib/game/companions.ts','lib/game/personalities.ts','lib/game/festival.ts','lib/game/three/expressions.ts','lib/game/three/fairground.ts','lib/game/world.ts','lib/game/scenery.ts','lib/game/discoveries.ts','lib/game/three/primitives.ts','lib/game/three/character-details.ts','lib/game/three/characters.ts','lib/game/three/environment.ts'];
for(const file of modules){
  let source=readFileSync(file,'utf8');
  if(file.endsWith('/catalog.ts'))source=source.replace('import raw from "@/backend/internal/adventure/catalog.json";',`const raw = ${readFileSync('backend/internal/adventure/catalog.json','utf8')};`);
  const compiled=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText.replace(/from (["'])(\.\.?\/[^"']+)\1/g,(_,quote,path)=>`from ${quote}${path}.mjs${quote}`);
  const target=resolve(cache,file.replace(/\.ts$/,'.mjs'));mkdirSync(dirname(target),{recursive:true});writeFileSync(target,compiled);
}
// GLTFExporter uses FileReader only to turn its binary Blob into an ArrayBuffer.
globalThis.FileReader=class{
  result=null;onloadend=null;onerror=null;
  readAsArrayBuffer(blob){blob.arrayBuffer().then(result=>{this.result=result;this.onloadend?.({target:this});}).catch(error=>this.onerror?.(error));}
  readAsDataURL(blob){blob.arrayBuffer().then(result=>{this.result=`data:${blob.type};base64,${Buffer.from(result).toString('base64')}`;this.onloadend?.({target:this});}).catch(error=>this.onerror?.(error));}
};
const {ArtResources}=await import(pathToFileURL(resolve(cache,'lib/game/three/primitives.mjs')));
const {createCompanion}=await import(pathToFileURL(resolve(cache,'lib/game/three/characters.mjs')));
const {createVillage}=await import(pathToFileURL(resolve(cache,'lib/game/three/environment.mjs')));
const exporter=new GLTFExporter(),assets=[];
async function save(id,object,animations=[]){
  object.updateMatrixWorld(true);
  const result=await exporter.parseAsync(object,{binary:true,animations,onlyVisible:true});
  if(!(result instanceof ArrayBuffer))throw new Error(`No binary output for ${id}`);
  const bytes=Buffer.from(result);writeFileSync(resolve(output,`${id}.glb`),bytes);
  assets.push({id,src:`/assets/sunlit-3d/${id}.glb`,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),animations:animations.map(clip=>clip.name)});
  console.log(`Exported ${id}.glb (${Math.round(bytes.length/1024)} KiB)`);
}
const catalog=JSON.parse(readFileSync('backend/internal/adventure/catalog.json','utf8'));
const {personalityFor,expressions}=await import(pathToFileURL(resolve(cache,'lib/game/personalities.mjs')));
const {festivalGames}=await import(pathToFileURL(resolve(cache,'lib/game/festival.mjs')));
writeFileSync(resolve(output,'character-bible.json'),JSON.stringify({version:3,expressions,characters:catalog.companions.map(friend=>({...friend,personality:personalityFor(friend.id)}))},null,2)+'\n');
writeFileSync(resolve(output,'fair-games.json'),JSON.stringify({version:1,games:festivalGames},null,2)+'\n');
for(const {id} of catalog.companions){const art=new ArtResources(),rig=createCompanion(art,id);await save(id,rig.root,rig.clips);art.dispose();}
const art=new ArtResources(),village=createVillage(art);await save('village',village.root);
async function moduleAsset(id,model){const clone=model.clone(true);clone.position.set(0,0,0);clone.rotation.set(0,0,0);clone.scale.set(1,1,1);await save(id,clone);}
await save('friendship-fair',village.fair.root);
for(const stall of village.fair.stalls)await moduleAsset(`fair-${stall.game.id}`,stall.root);
for(const building of village.buildings)await moduleAsset(building.zone.building,building.root);
await moduleAsset('bubble-tree',village.trees[0]);
await moduleAsset('field-chest',village.chests[0].root);
await moduleAsset('word-seed',village.seeds[0].root);
await moduleAsset('butterfly',village.butterflies[0]);
art.dispose();
writeFileSync(resolve(output,'manifest.json'),JSON.stringify({name:'Sunlit Village 3D',version:'3.0.0',format:'glTF 2.0 binary',source:'Original procedural mesh art in lib/game/three. Chibi proportions and colours follow the project-owned Sunlit Village illustration reference. No third-party game art or image textures.',characterRig:'24 distinct chibi companions, each with rigid articulated joints and six body animation clips and eight facial expression clips; front is +Z, up is +Y, feet at Y=0.',runtime:'The game constructs these same models from source. GLB files are reusable exports, not runtime download dependencies.',assets},null,2)+'\n');

// Portable deterministic ZIP, using Node's built-in DEFLATE and standard ZIP headers.
function crc32(bytes){let crc=0xffffffff;for(const byte of bytes){crc^=byte;for(let bit=0;bit<8;bit++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}return(crc^0xffffffff)>>>0;}
const entries=[...assets.map(asset=>`${asset.id}.glb`),'manifest.json','PROVENANCE.md','character-bible.json','fair-games.json'];
const local=[],central=[];let offset=0;
for(const filename of entries){
  const name=Buffer.from(`sunlit-3d/${filename}`),data=readFileSync(resolve(output,filename)),compressed=deflateRawSync(data),crc=crc32(data);
  const header=Buffer.alloc(30);header.writeUInt32LE(0x04034b50,0);header.writeUInt16LE(20,4);header.writeUInt16LE(8,8);header.writeUInt16LE(33,12);header.writeUInt32LE(crc,14);header.writeUInt32LE(compressed.length,18);header.writeUInt32LE(data.length,22);header.writeUInt16LE(name.length,26);
  local.push(header,name,compressed);
  const directory=Buffer.alloc(46);directory.writeUInt32LE(0x02014b50,0);directory.writeUInt16LE(20,4);directory.writeUInt16LE(20,6);directory.writeUInt16LE(8,10);directory.writeUInt16LE(33,14);directory.writeUInt32LE(crc,16);directory.writeUInt32LE(compressed.length,20);directory.writeUInt32LE(data.length,24);directory.writeUInt16LE(name.length,28);directory.writeUInt32LE(offset,42);central.push(directory,name);offset+=header.length+name.length+compressed.length;
}
const directory=Buffer.concat(central),end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50,0);end.writeUInt16LE(entries.length,8);end.writeUInt16LE(entries.length,10);end.writeUInt32LE(directory.length,12);end.writeUInt32LE(offset,16);
const archive=Buffer.concat([...local,directory,end]);writeFileSync(resolve(root,'public/assets/sunlit-3d-pack.zip'),archive);console.log(`Exported complete 3D pack (${Math.round(archive.length/1024)} KiB)`);
