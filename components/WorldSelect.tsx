"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { getProgression, WorldState } from "@/lib/api";
import { villagePreview, worldArt } from "@/data/village";
import GameArt from "./GameArt";

export default function WorldSelect() {
  const [worlds, setWorlds] = useState<WorldState[] | null>(null);
  useEffect(() => { getProgression().then(state => setWorlds(state.worlds)).catch(() => {}); }, []);
  return <div className="sunlit-world-select">{(worlds ?? villagePreview).filter(world => world.id !== "training").map(world => {
    const copy = <><GameArt id={worldArt(world.id)} /><div><small>{worlds ? world.unlocked ? `${world.progress}% EXPLORED` : "LOCKED" : "DISCOVER THE VILLAGE"}</small><strong>{world.title}</strong><span>{worlds && !world.unlocked ? world.unlockText : world.description}</span></div><b aria-hidden="true">{worlds && !world.unlocked ? "◇" : "↗"}</b></>;
    return worlds && !world.unlocked ? <div className="sunlit-world-card locked" key={world.id}>{copy}</div> : <Link className="sunlit-world-card" href={worlds ? world.route : "/worlds"} key={world.id}>{copy}</Link>;
  })}</div>;
}
