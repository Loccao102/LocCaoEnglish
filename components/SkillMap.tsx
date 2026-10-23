"use client";

import Link from "next/link";
import usePracticeDashboard, { currentSkillPractice } from "./learning/usePracticeDashboard";

const practiceRoutes = [
  { name: "Vocabulary", route: "/games/word-link", activity: "Find word connections", icon: "◇" },
  { name: "Grammar", route: "/games/grammar-repair", activity: "Repair a sentence", icon: "✎" },
  { name: "Reading", route: "/reading", activity: "Read and find the evidence", icon: "▤" },
  { name: "Listening", route: "/listening", activity: "Listen and choose", icon: "♫" },
  { name: "Speaking", route: "/speaking", activity: "Practice a spoken response", icon: "☏" },
  { name: "Dictation", route: "/dictation", activity: "Listen and write", icon: "⌁" },
  { name: "Writing", route: "/ielts/writing", activity: "Open writing feedback history", icon: "✐" },
];

export default function SkillMap() {
  const { data, status, needsSignIn, refresh } = usePracticeDashboard();
  return <section className="panel practice-journal" id="skill-map" aria-label="Skill practice journal">
    <div className="section-heading"><div><span className="eyebrow">YOUR PRACTICE JOURNAL</span><h2>Your recent practice</h2></div>{data && <button className="button ghost" onClick={refresh}>Refresh practice</button>}</div>
    <p className="practice-note">Up to 20 different items per skill, using your latest checked answer to each item. Repeating an item updates its result. These are practice records, not a mastery score or a CEFR level.</p>
    {!data ? <div className="practice-empty" role={status === "error" ? "alert" : "status"}>
      <p>{status === "guest" ? "Sign in to keep a personal journal. Guest practice is separate from your account." : status === "loading" ? "Loading your practice journal…" : needsSignIn ? "Sign in again to load your journal." : "Your practice journal is unavailable. Try loading it again."}</p>
      {(status === "guest" || needsSignIn) && <Link className="button primary" href="/account">{needsSignIn ? "Sign in again" : "Sign in for your practice journal"}</Link>}
      {status === "error" && <button className="button ghost" onClick={refresh}>Retry loading practice</button>}
    </div> : <div className="practice-journal-grid">{practiceRoutes.map(({ name, route, activity, icon }) => {
      const skill = data.skills.find(value => value.name === name);
      const practice = currentSkillPractice(skill?.practice);
      const writing = name === "Writing";
      const hasSamples = practice && practice.sampleCount > 0;
      return <article className={`practice-skill ${hasSamples ? "has-practice" : ""}`} key={name} aria-label={`${name} practice`}>
        <div className="practice-skill-heading"><span className="practice-skill-icon" aria-hidden="true">{icon}</span><h3>{name}</h3></div>
        <strong className="practice-skill-count">{writing ? "Writing has its own feedback history" : !practice ? "Practice summary unavailable" : practice.evidenceKind === "not-supported" ? "Separate feedback history" : hasSamples ? `${practice.correctCount} correct · ${practice.sampleCount} checked` : "No checked practice yet"}</strong>
        <p>{writing ? "Your drafts and writing feedback stay in the Writing Lab. They are not included in this summary." : !practice ? "Your older profile is preserved. A recent practice summary is not available yet." : practice.evidenceKind === "transcript-match" ? "Transcript matches only — this does not assess pronunciation." : "Checked answers from guided practice. Help and answer review may be available."}</p>
        {hasSamples && practice.lastCompletedAt && !writing && <small>Latest check: <time dateTime={practice.lastCompletedAt}>{new Date(practice.lastCompletedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Bangkok" })} · UTC+7</time></small>}
        <Link className="button ghost" href={route}>{activity} →</Link>
      </article>;
    })}</div>}
  </section>;
}
