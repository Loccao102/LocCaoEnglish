"use client";

import { useEffect, useState } from "react";
import { Dashboard, getDashboard } from "@/lib/api";

export default function LiveSnapshot() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [live, setLive] = useState(false);

  useEffect(() => {
    getDashboard().then((value) => { setData(value); setLive(true); }).catch(() => setLive(false));
  }, []);

  if (!data) {
    return (
      <section className="live-snapshot offline">
        <div>
          <span className="eyebrow">PLAYER PROFILE</span>
          <h2>{live ? "Loading your save…" : "Offline training mode"}</h2>
          <p>Start the Go API to load persisted XP, streaks, weak skills and review quests.</p>
        </div>
        <span className="mode-badge warning">LOCAL</span>
      </section>
    );
  }

  const targets = [...data.skills].sort((a, b) => a.confidence - b.confidence).slice(0, 3);

  return (
    <section className="live-snapshot">
      <div className="snapshot-person">
        <span className="avatar large">{data.user.displayName.slice(0, 2).toUpperCase()}</span>
        <div>
          <span className="eyebrow">PLAYER PROFILE</span>
          <h2>{data.user.displayName}</h2>
          <p>{data.user.xp.toLocaleString()} XP · 🔥 {data.user.streak} day streak · {data.dueReviews} recovery quests ready</p>
        </div>
      </div>

      <div className="snapshot-skills">
        {targets.map((skill) => (
          <div key={skill.name}>
            <span><strong>{skill.name}</strong><b>{Math.round(skill.confidence * 100)}%</b></span>
            <div className="progress"><i style={{ width: `${skill.confidence * 100}%` }} /></div>
          </div>
        ))}
        <small>These are your next training targets.</small>
      </div>

      <div className="snapshot-band">
        <small>IELTS TOWER</small>
        <strong>{data.ieltsBand.toFixed(1)}</strong>
        <span>target {data.targetBand.toFixed(1)}</span>
      </div>
    </section>
  );
}
