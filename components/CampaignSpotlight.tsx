"use client";

import GameArt from "./GameArt";
import { worldArt } from "@/data/village";
import Link from "next/link";
import { getPlayerProfile, getProgression, type BossState } from "@/lib/api";
import useSignedInToken from "./learning/useSignedInToken";
import useAccountResource from "./learning/useAccountResource";
import ProgressionNotice from "./learning/ProgressionNotice";
import "./learning/vocabulary-unlocks.css";

async function loadCampaign(token: string) {
  const [state, profile] = await Promise.all([getProgression(token), getPlayerProfile(token)]);
  return { state, profile };
}

export default function CampaignSpotlight() {
  const token = useSignedInToken();
  const { data, status, needsSignIn, refresh } = useAccountResource(token, loadCampaign);
  if (!data) return <article className="panel campaign-preview" aria-label="Your campaign">
    <span className="eyebrow">YOUR CAMPAIGN</span><h2>Choose your next challenge.</h2>
    <ProgressionNotice status={status} needsSignIn={needsSignIn} refresh={refresh} signInLabel="Sign in for your campaign" />
    <Link href="/worlds" className="button ghost">Explore the village →</Link>
  </article>;

  const { state, profile } = data;
  const preferred = ["conversation", "travel", "work"].includes(profile.goal) ? profile.goal : null;
  const pool = preferred ? state.bosses.filter(boss => boss.worldId === preferred) : state.bosses;
  const boss = pool.find(item => !item.cleared && item.unlocked) ?? pool.find(item => !item.cleared) ?? state.bosses.find(item => !item.cleared && item.unlocked);
  if (profile.goal === "ielts") return <article className="continue-card" aria-label="Your campaign"><div className="continue-copy"><span className="eyebrow light">YOUR LEARNING GOAL · IELTS</span><h2>Climb the IELTS Tower.</h2><p>Choose a section to practise and review its saved feedback. Your daily checklist is a separate practice habit.</p><div className="mission-meta"><span>▤ 4 sections</span><span>practice feedback</span></div><Link href="/ielts" className="button bright">Enter IELTS Tower →</Link></div><div className="mission-orbit"><GameArt id="ielts-lighthouse" /></div></article>;
  if (!boss) return <article className="continue-card" aria-label="Your campaign"><div className="continue-copy"><span className="eyebrow light">CAMPAIGN COMPLETE</span><h2>Your current districts are clear.</h2><p>Choose a reward to wear or revisit another world.</p><Link href="/progress" className="button bright">View worlds and rewards →</Link></div></article>;
  return <BossSpotlight boss={boss} />;
}

function BossSpotlight({ boss }: { boss: BossState }) {
  const ready = boss.checkpoints.filter(item => item.complete).length;
  const next = boss.checkpoints.find(item => !item.complete);
  return <article className="continue-card" aria-label="Your campaign"><div className="continue-copy">
    <span className="eyebrow light">{boss.unlocked ? "CHAPTER READY" : `${boss.worldId.toUpperCase()} CAMPAIGN`}</span><h2>{boss.title}</h2>
    <p>{boss.unlocked ? "Your saved preparation is ready. Enter the role-play and complete the communication objectives." : `Prepare this chapter: ${ready}/${boss.checkpoints.length} practice checkpoints complete.`}</p>
    <div className="mission-meta"><span>✦ {ready}/{boss.checkpoints.length} checkpoints</span><span>+{boss.rewardXp} personal XP on first clear</span><span>{boss.unlocked ? "NPC ready" : "Preparation needed"}</span></div>
    {boss.unlocked ? <Link href={boss.route} className="button bright">Enter boss fight →</Link> : next ? <Link href={next.route} className="button bright">Prepare {next.skill} →</Link> : <Link href="/progress" className="button bright">View your chapter preparation →</Link>}
  </div><div className="mission-orbit"><GameArt id={worldArt(boss.worldId)} /></div></article>;
}
