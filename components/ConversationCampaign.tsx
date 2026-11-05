"use client";

import Link from "next/link";
import DistrictCampaign, { type CampaignChapterCopy } from "./learning/DistrictCampaign";

const chapterCopy: CampaignChapterCopy = {
  "cafe-connection": {
    n: "01", tag: "CAFE", icon: "☕",
    copy: "Meet someone new, introduce yourself and keep the exchange alive.",
  },
  "weekend-plans": {
    n: "02", tag: "MAKE PLANS", icon: "⌁",
    copy: "Move from small talk to a real suggestion with time and place.",
  },
  "repair-misunderstanding": {
    n: "03", tag: "CLARITY", icon: "↔",
    copy: "Recover when meaning breaks: clarify, rephrase and confirm.",
  },
};

export default function ConversationCampaign() {
  return <DistrictCampaign
    worldId="conversation"
    eyebrow="WORLD 03 · CONVERSATION DISTRICT"
    title="Learn to stay in the conversation."
    description="Not scripted answer drills. Each chapter asks you to create, sustain and repair a real social exchange."
    chapterCopy={chapterCopy}
    readyLabel="ROLE-PLAY READY"
    enterLabel="Enter role-play →"
    replayLabel="Replay →"
    firstCheckpointRule="Earn all three social checkpoints"
    followingCheckpointRule="Clear the previous chapter, then earn fresh evidence"
  >
    <section className="panel">
      <div className="section-heading">
        <div><span className="eyebrow">DISTRICT REWARDS</span><h2>Social proof you can wear</h2></div>
        <Link href="/worlds" className="text-link">World Map →</Link>
      </div>
      <div className="quest-list">
        <div className="quest"><span className="check">☕</span><span>Social Spark badge</span><small>Chapter 1</small></div>
        <div className="quest"><span className="check">⌁</span><span>Plan Maker title</span><small>Chapter 2</small></div>
        <div className="quest"><span className="check">↔</span><span>Clarity Aura</span><small>Chapter 3</small></div>
        <div className="quest"><span className="check">♛</span><span>Conversation Frame</span><small>Mastery</small></div>
      </div>
    </section>
  </DistrictCampaign>;
}
