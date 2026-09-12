import type { CSSProperties } from "react";
import manifest from "@/public/assets/sunlit-village/manifest.json";

export const gameAssets = manifest.assets;
export type GameAsset = (typeof gameAssets)[number];
const byId = new Map(gameAssets.map(asset => [asset.id, asset]));

/** Atlas coordinates live in one manifest; no bitmap slicing or runtime canvas needed. */
export default function GameArt({ id, className = "", label, style }: {
  id: string; className?: string; label?: string; style?: CSSProperties;
}) {
  const asset = byId.get(id);
  if (!asset) return null;
  return <span className={`game-art ${className}`} role={label ? "img" : undefined}
    aria-label={label} aria-hidden={label ? undefined : true} data-asset={id}
    style={{ backgroundImage: `url("${asset.src}")`,
      backgroundSize: `${asset.columns * 100}% ${asset.rows * 100}%`,
      backgroundPosition: `${asset.columns > 1 ? asset.column / (asset.columns - 1) * 100 : 0}% ${asset.rows > 1 ? asset.row / (asset.rows - 1) * 100 : 0}%`, ...style }} />;
}
