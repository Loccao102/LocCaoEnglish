"use client";

import Link from "next/link";
import DistrictCampaign, { type CampaignChapterCopy } from "./learning/DistrictCampaign";

const chapterCopy: CampaignChapterCopy = {
  "airport-crisis": {
    n: "01", tag: "AIRPORT", icon: "✈",
    copy: "Miss a flight, understand the gate change and negotiate a rebooking.",
  },
  "hotel-reservation": {
    n: "02", tag: "HOTEL", icon: "◆",
    copy: "A booking disappears at midnight. Use calm, polite English to recover the room.",
  },
  "city-transit": {
    n: "03", tag: "CITY TRANSIT", icon: "◎",
    copy: "The last train is near. Decode platform information and find a route before service ends.",
  },
};

export default function TravelCampaign() {
  return <DistrictCampaign
    worldId="travel"
    eyebrow="WORLD 02 · TRAVEL DISTRICT"
    title="Survive English outside the classroom."
    description="Three connected chapters. Each boss unlocks only after you earn the right evidence, and later chapters require fresh practice after the previous clear."
    chapterCopy={chapterCopy}
    readyLabel="BOSS READY"
    enterLabel="Enter boss →"
    replayLabel="Replay chapter →"
    firstCheckpointRule="Earn all three chapter checkpoints"
    followingCheckpointRule="Clear the previous chapter, then earn fresh checkpoint evidence"
  >
    <section className="panel">
      <div className="section-heading">
        <div><span className="eyebrow">CAMPAIGN REWARDS</span><h2>What survives with you</h2></div>
        <Link href="/worlds" className="text-link">World Map →</Link>
      </div>
      <div className="quest-list">
        <div className="quest"><span className="check">✈</span><span>Airport Wings</span><small>Chapter 1</small></div>
        <div className="quest"><span className="check">◆</span><span>Hotel Diplomat title</span><small>Chapter 2</small></div>
        <div className="quest"><span className="check">◎</span><span>City Navigator Frame</span><small>Chapter 3</small></div>
        <div className="quest"><span className="check">♛</span><span>Passport Aura</span><small>Clear all</small></div>
      </div>
    </section>
  </DistrictCampaign>;
}
