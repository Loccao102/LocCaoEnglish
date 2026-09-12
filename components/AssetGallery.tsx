"use client";
import { useState } from "react";
import GameArt, { gameAssets } from "./GameArt";
const categories = [["all", "Everything"], ["characters", "Companions"], ["buildings", "Buildings"], ["props", "Objects & nature"], ["paths", "Paths"], ["maps", "Map"], ["identity", "Emblem"]];
export default function AssetGallery() {
  const [category, setCategory] = useState("all");
  const visible = gameAssets.filter(asset => category === "all" || asset.category === category);
  return <><div className="art-filters" role="group" aria-label="Filter art collection">{categories.map(([id, name]) => <button type="button" key={id} aria-pressed={category === id} onClick={() => setCategory(id)}>{name}</button>)}</div><p className="art-count" role="status">{visible.length} assets · {category === "all" ? "The complete village collection" : categories.find(item => item[0] === category)?.[1]}</p><div className="art-gallery">{visible.map(asset => <article className={`art-tile ${asset.category}`} key={asset.id}><div className="art-tile-preview"><GameArt id={asset.id} label={asset.name} /></div><div className="art-tile-copy"><small>{asset.category}</small><h2>{asset.name}</h2><p>{asset.description}</p><a href={asset.src} download>{asset.columns > 1 ? "Download atlas" : "Download SVG"} <span aria-hidden="true">↓</span></a></div></article>)}</div></>;
}
