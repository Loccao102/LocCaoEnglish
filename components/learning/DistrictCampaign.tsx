"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { getProgression } from "@/lib/api";
import useAccountResource from "./useAccountResource";
import useSignedInToken from "./useSignedInToken";
import PersonalReadNotice, { PersonalReadRefresh } from "./PersonalReadNotice";
import styles from "./PersonalReadNotice.module.css";

export type CampaignChapterCopy = Record<string, {
  n: string;
  tag: string;
  copy: string;
  icon: string;
}>;

type DistrictCampaignProps = {
  worldId: "travel" | "conversation" | "work";
  eyebrow: string;
  title: string;
  description: string;
  chapterCopy: CampaignChapterCopy;
  readyLabel: string;
  enterLabel: string;
  replayLabel: string;
  firstCheckpointRule: string;
  followingCheckpointRule: string;
  children: ReactNode;
};

export default function DistrictCampaign({
  worldId, eyebrow, title, description, chapterCopy, readyLabel, enterLabel,
  replayLabel, firstCheckpointRule, followingCheckpointRule, children,
}: DistrictCampaignProps) {
  const token = useSignedInToken();
  // Refresh removes personal action states until the latest owner-bound read succeeds.
  const resource = useAccountResource(token, getProgression);
  const state = resource.status === "ready" ? resource.data : null;
  const bosses = state?.bosses.filter(boss => boss.worldId === worldId) ?? [];
  const cleared = bosses.filter(boss => boss.cleared).length;
  const percent = bosses.length ? Math.round(cleared / bosses.length * 100) : 0;

  return <div className="progression-shell">
    <section className="progression-hero">
      <div>
        <span className="eyebrow light">{eyebrow}</span>
        <h1>{title}</h1>
        <p>{description}</p>
        {state && <div className="level-xp">
          <span>{cleared}/{bosses.length} chapters cleared</span>
          <div className="progress large"><i style={{ width: `${percent}%` }} /></div>
        </div>}
      </div>
      {state && <div className="hero-level-orb"><strong>{percent}</strong><small>% CLEAR</small></div>}
    </section>

    <section className={styles.campaignRead} aria-label="Personal campaign progress">
      {resource.status !== "ready" && <PersonalReadNotice kind="campaign" {...resource} />}
      {token && <PersonalReadRefresh kind="campaign" refresh={resource.refresh} />}
    </section>

    <section className="world-path" aria-label="District chapters">
      {state ? bosses.map((boss, index) => {
        const meta = chapterCopy[boss.id] ?? {
          n: String(index + 1).padStart(2, "0"), tag: "MISSION", copy: "District mission", icon: "◆",
        };
        const completed = boss.checkpoints.filter(checkpoint => checkpoint.complete).length;
        return <article className={`world-node ${boss.unlocked || boss.cleared ? "open" : "locked"}`} key={boss.id}>
          <div className="world-icon">{boss.cleared ? "✓" : meta.icon}</div>
          <div className="world-copy">
            <div>
              <small>CHAPTER {meta.n} · {meta.tag}</small>
              <span>{boss.cleared ? "CLEARED" : boss.unlocked ? readyLabel : `${completed}/${boss.checkpoints.length} CHECKPOINTS`}</span>
            </div>
            <h2>{boss.title}</h2>
            <p>{meta.copy}</p>
            <div className="boss-checkpoints">{boss.checkpoints.map(checkpoint =>
              <span key={checkpoint.id} className={checkpoint.complete ? "complete" : ""}>
                {checkpoint.complete ? "✓" : "○"} {checkpoint.skill}
              </span>,
            )}</div>
            {boss.cleared
              ? <Link href={boss.route} className="button ghost">{replayLabel}</Link>
              : boss.unlocked
                ? <Link href={boss.route} className="button primary">{enterLabel}</Link>
                : <div className="unlock-rule">🔒 {index === 0 ? firstCheckpointRule : followingCheckpointRule}</div>}
          </div>
        </article>;
      }) : Object.entries(chapterCopy).map(([id, meta]) => <article className="world-node" key={id}>
        <div className="world-icon">{meta.icon}</div>
        <div className="world-copy">
          <div><small>CHAPTER {meta.n} · {meta.tag}</small></div>
          <h2>{meta.tag}</h2>
          <p>{meta.copy}</p>
        </div>
      </article>)}
    </section>
    {children}
  </div>;
}
