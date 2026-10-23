"use client";

import Link from "next/link";
import usePracticeDashboard, { currentSkillPractice } from "./learning/usePracticeDashboard";

export default function LiveSnapshot() {
  const { data, status, needsSignIn, refresh } = usePracticeDashboard();

  if (!data) return <section className="live-snapshot offline practice-snapshot" aria-label="Player practice snapshot">
    <div role={status === "error" ? "alert" : "status"}>
      <span className="eyebrow">PLAYER PROFILE</span>
      <h2>{status === "guest" ? "Your practice starts here" : status === "loading" ? "Loading your progress…" : "Your progress is unavailable"}</h2>
      <p>{status === "guest" ? "Sign in to see your saved practice. Guest rounds stay separate." : status === "loading" ? "Your saved practice will appear here." : needsSignIn ? "Sign in again to load your saved practice." : "Check your connection and try loading it again."}</p>
      {(status === "guest" || needsSignIn) && <Link className="button ghost" href="/account">{needsSignIn ? "Sign in again" : "Sign in to see your progress"}</Link>}
      {status === "error" && <button className="button ghost" onClick={refresh}>Retry loading progress</button>}
    </div>
  </section>;

  const summaries = data.skills.map(skill => currentSkillPractice(skill.practice));
  const supported = summaries.filter(summary => summary && summary.evidenceKind !== "not-supported");
  const practiced = supported.filter(summary => summary && summary.sampleCount > 0).length;

  return <section className="live-snapshot practice-snapshot" aria-label="Player practice snapshot">
    <div className="snapshot-person">
      <span className="avatar large">{data.user.displayName.slice(0, 2).toUpperCase()}</span>
      <div>
        <span className="eyebrow">PLAYER PROFILE</span>
        <h2>{data.user.displayName}</h2>
        <p>{data.user.xp.toLocaleString()} personal XP · 🔥 {data.user.streak} day streak · {data.dueReviews} recovery items ready</p>
      </div>
    </div>
    <div className="snapshot-skills snapshot-practice">
      <strong>{supported.length === 0 ? "Practice summary unavailable" : practiced === 0 ? "No checked practice yet" : `${practiced} ${practiced === 1 ? "skill has" : "skills have"} recent practice`}</strong>
      <p>{supported.length === 0 ? "Your saved profile is available. Recent practice needs an updated summary." : "Your journal shows the latest checked work, with a separate record for each skill."}</p>
      <Link className="text-link" href="#skill-map">Open your practice journal ↓</Link>
    </div>
    <div className="snapshot-band">
      <small>IELTS PRACTICE</small>
      <strong>{data.ieltsBand?.toFixed(1) ?? "—"}</strong>
      <span>{data.ieltsBand == null ? "No overall estimate yet" : "Overall practice estimate"}</span>
      {data.targetBand != null && <span>target {data.targetBand.toFixed(1)}</span>}
      <Link href="/ielts">View practice history →</Link>
    </div>
  </section>;
}
