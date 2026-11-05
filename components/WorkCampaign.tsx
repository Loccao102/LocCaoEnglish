"use client";

import Link from "next/link";
import DistrictCampaign, { type CampaignChapterCopy } from "./learning/DistrictCampaign";

const chapterCopy: CampaignChapterCopy = {
  "daily-standup": {
    n: "01", tag: "STAND-UP", icon: "▣",
    copy: "Compress progress, next action and blockers into a useful team update.",
  },
  "requirement-clarity": {
    n: "02", tag: "REQUIREMENTS", icon: "?",
    copy: "Expose ambiguity before it becomes rework, then confirm what success means.",
  },
  "deadline-negotiation": {
    n: "03", tag: "DELIVERY", icon: "⌛",
    copy: "Make constraints and trade-offs visible, then propose a workable option.",
  },
};

export default function WorkCampaign() {
  return <DistrictCampaign
    worldId="work"
    eyebrow="WORLD 04 · WORK DISTRICT"
    title="English that survives a real team."
    description="Three communication problems developers actually face: update the team, clarify ambiguity and negotiate delivery."
    chapterCopy={chapterCopy}
    readyLabel="SIMULATION READY"
    enterLabel="Enter simulation →"
    replayLabel="Replay →"
    firstCheckpointRule="Earn all three professional checkpoints"
    followingCheckpointRule="Clear the previous chapter, then earn fresh evidence"
  >
    <section className="panel">
      <div className="section-heading">
        <div><span className="eyebrow">DISTRICT REWARDS</span><h2>Professional build</h2></div>
        <Link href="/worlds" className="text-link">World Map →</Link>
      </div>
      <div className="quest-list">
        <div className="quest"><span className="check">▣</span><span>Stand-up Ready badge</span><small>Chapter 1</small></div>
        <div className="quest"><span className="check">?</span><span>Requirement Detective title</span><small>Chapter 2</small></div>
        <div className="quest"><span className="check">⌛</span><span>Delivery Aura</span><small>Chapter 3</small></div>
        <div className="quest"><span className="check">♛</span><span>Professional Frame</span><small>Mastery</small></div>
      </div>
    </section>
  </DistrictCampaign>;
}
