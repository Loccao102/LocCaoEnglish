import Link from "next/link";
import AssetGallery from "@/components/AssetGallery";
import CompanionPortrait from "@/components/game/CompanionPortrait";
import models from "@/public/assets/sunlit-3d/manifest.json";

export default function ArtStudioPage() {
  return <div className="page-wrap art-studio">
    <header className="art-studio-header">
      <div><Link className="text-link" href="/play">← Back to the village</Link><p className="eyebrow">LOCCAO ENGLISH · ORIGINAL ART COLLECTION</p><h1>A village with<br />a voice of its own.</h1><p>Meet the little companions, page-roof houses and sunlit paths that bring Làng Nắng to life.</p><div className="art-downloads"><a className="button primary" href="/assets/sunlit-3d-pack.zip" download>Download 3D collection ↓</a><a className="button ghost" href="/assets/sunlit-village-pack.zip" download>Download illustration pack ↓</a><a className="button ghost" href="/assets/sunlit-village/village-illustrated.svg" download>Download illustrated map ↓</a></div></div>
      <div className="art-companions" aria-hidden="true"><CompanionPortrait id="mam" /><CompanionPortrait id="nang" /><CompanionPortrait id="may" /><CompanionPortrait id="soi" /></div>
    </header>
    <section className="model-collection" aria-labelledby="model-title">
      <div className="model-intro"><div><p className="eyebrow">FROM OUR LITTLE WORLD</p><h2 id="model-title">A world you can walk around.</h2><p>Twenty-four round chibi companions, seven chapter landmarks, eight fair pavilions and two connected islands. These are the models used to build the 3D adventure.</p></div><Link className="button primary" href="/characters">Meet all 24 friends →</Link></div>
      <div className="model-download-grid">{models.assets.map(model => <a key={model.id} href={model.src} download><span className="model-file">{model.animations.length ? "ANIMATED CHARACTER" : model.id === "village" ? "COMPLETE WORLD" : "WORLD ASSET"}</span><strong>{model.id.replaceAll("-", " ")}</strong><span>{model.animations.length ? "6 body animations · 8 expressions" : "Reusable 3D model"}</span><small>GLB · {model.bytes > 1048576 ? `${(model.bytes / 1048576).toFixed(1)} MB` : `${Math.round(model.bytes / 1024)} KB`} <b aria-hidden="true">↓</b></small></a>)}</div>
      <p className="model-note">Companions include six body animations, eight facial expressions and articulated joints. The world file contains the scenery; movement, quests and interactions live in the game. <a href="/assets/sunlit-3d/PROVENANCE.md">3D provenance & reuse notes</a> · <a href="/assets/sunlit-3d/manifest.json" download>Model manifest</a></p>
    </section>
    <div className="art-palette" aria-label="Village palette">{[["Lagoon", "#258F86"], ["Leaf", "#B7DFB0"], ["Honey", "#F4C45E"], ["Coral", "#E88772"], ["Paper", "#FFF5D8"], ["Ink", "#234F48"]].map(([name, color]) => <div key={name}><i style={{ background: color }} /><span>{name}<small>{color}</small></span></div>)}</div>
    <AssetGallery />
    <footer className="art-provenance"><h2>Made for this little world</h2><p>The 3D models were authored in this repository with original mesh geometry, colours and animations. The illustration collection was generated with original art direction using OpenAI ImageGen; editable SVG sources supply its paths, terrain and emblem. No third-party game art or franchise references were used.</p><p>The illustrations supply portraits, maps, the learning journal and rewards. The playable world uses 3D geometry for its characters, buildings, terrain and objects. Both collections are saved with source and provenance notes.</p><a className="text-link" href="/assets/sunlit-village/PROVENANCE.md">Illustration provenance & usage notes →</a></footer>
  </div>;
}

