"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Dashboard, getDashboard } from "@/lib/api";
import { AUTH_EVENT, getAuthToken } from "@/lib/session";

export default function LiveSnapshot() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let generation = 0;
    const refresh = () => {
      const current = ++generation, token = getAuthToken();
      setData(null); setLoading(true);
      getDashboard().then(value => {
        if (current === generation && token === getAuthToken()) setData(value);
      }).catch(() => {}).finally(() => {
        if (current === generation && token === getAuthToken()) setLoading(false);
      });
    };
    const storage = (event: StorageEvent) => {
      if (event.key === "loccao_token" || event.key === null) refresh();
    };
    refresh();
    window.addEventListener(AUTH_EVENT, refresh);
    window.addEventListener("storage", storage);
    return () => {
      generation++;
      window.removeEventListener(AUTH_EVENT, refresh);
      window.removeEventListener("storage", storage);
    };
  }, [reload]);

  if (!data) {
    return (
      <section className="live-snapshot offline">
        <div>
          <span className="eyebrow">PLAYER PROFILE</span>
          <h2>{loading ? "Loading your progress…" : "Your progress is unavailable"}</h2>
          <p>{loading ? "Your saved practice will appear here." : "Check your connection and try loading it again."}</p>
          {!loading && <button className="button" onClick={() => setReload(value => value + 1)}>Retry loading progress</button>}
        </div>
        <span className="mode-badge warning">{loading ? "LOADING" : "UNAVAILABLE"}</span>
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
        <small>IELTS PRACTICE</small>
        <strong>{data.ieltsBand?.toFixed(1) ?? "—"}</strong>
        <span>{data.ieltsBand == null ? "No overall estimate yet" : "Overall practice estimate"}</span>
        {data.targetBand != null && <span>target {data.targetBand.toFixed(1)}</span>}
        <Link href="/ielts">View practice history →</Link>
      </div>
    </section>
  );
}
