"use client";

import Link from "next/link";
import { villagePreview, worldArt } from "@/data/village";
import GameArt from "./GameArt";
import useAccountProgression from "./learning/useAccountProgression";
import ProgressionNotice from "./learning/ProgressionNotice";
import { currentVocabularyUnlock, worldStatus } from "./learning/VocabularyUnlock";
import "./learning/vocabulary-unlocks.css";

export default function WorldSelect() {
  const { data, status, needsSignIn, refresh } = useAccountProgression();
  const worlds = data?.worlds;
  return <section className="world-selection-shell" aria-label="World selection">
    {(!worlds || status === "error") && <div className="world-select-notice"><ProgressionNotice status={status} needsSignIn={needsSignIn} refresh={refresh} signInLabel="Sign in for your worlds" /></div>}
    <div className="sunlit-world-select">{(worlds ?? villagePreview).filter(world => world.id !== "training").map(world => {
      const checklist = world.id === "words" ? currentVocabularyUnlock(world.unlock) : null;
      const copy = <><GameArt id={worldArt(world.id)} /><div><small>{worlds ? worldStatus(world) : "DISCOVER THE VILLAGE"}</small><strong>{world.title}</strong><span>{worlds && !world.unlocked ? world.id === "words" && !checklist ? "Unlock details unavailable" : world.unlockText : world.description}</span>{worlds && !world.unlocked && checklist && <span>{Math.min(checklist.correctItems, checklist.targetItems)}/{checklist.targetItems} different items · {Math.min(checklist.activityCount, checklist.targetActivities)}/{checklist.targetActivities} activity</span>}</div><b aria-hidden="true">{worlds && !world.unlocked ? "◇" : "↗"}</b></>;
      return worlds && !world.unlocked ? <article className="sunlit-world-card locked" aria-label={`${world.title} world`} key={world.id}>{copy}</article> : <Link className="sunlit-world-card" aria-label={`${world.title} world`} href={worlds ? world.route : "/worlds"} key={world.id}>{copy}</Link>;
    })}</div>
  </section>;
}
