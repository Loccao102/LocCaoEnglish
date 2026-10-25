"use client";

import Link from "next/link";
import GameArt from "./GameArt";
import { getAuthToken } from "@/lib/session";
import type { ProfileFields } from "@/lib/profile-settings";
import useSignedInToken from "./learning/useSignedInToken";
import useProfileSettings from "./learning/useProfileSettings";
import "./profile-settings.css";

const goals = [
  { id: "conversation", title: "Speak comfortably", copy: "Everyday conversation and confidence." },
  { id: "ielts", title: "Climb IELTS", copy: "Build all four skills toward a target band." },
  { id: "travel", title: "Travel without panic", copy: "Airports, hotels, transport and real situations." },
  { id: "work", title: "Use English at work", copy: "Stand-ups, requirements, delivery and collaboration." },
] as const;
const interests = ["travel", "technology", "work", "daily-life", "movies", "gaming", "education", "business"];

export default function PlayerOnboarding() {
  const token = useSignedInToken();
  if (token === null || token !== getAuthToken()) return <section className="panel" role="status">Loading your learning goal settings…</section>;
  return <ProfileSettingsEditor key={token} token={token} />;
}

function SettingsSummary({ fields }: { fields: ProfileFields }) {
  return <p>{goals.find(goal => goal.id === fields.goal)?.title} · {fields.dailyMinutes} min/day · {fields.cefrLevel} · target {fields.targetBand.toFixed(1)}<br />Interests: {fields.interests.join(", ") || "none selected"}</p>;
}

function ProfileSettingsEditor({ token }: { token: string }) {
  const settings = useProfileSettings(token);
  const form = settings.fields;
  const pending = ["loading", "saving", "refreshing"].includes(settings.phase);
  const recovery = ["uncertain", "choice", "error"].includes(settings.phase);
  const notice = <section className="panel profile-settings-notice" aria-label="Settings status">
    <p role={recovery ? "alert" : "status"}>{settings.message || "Loading your learning goal settings…"}</p>
    {settings.storageWarning && <p role="alert">{settings.storageWarning}</p>}
    {settings.needsSignIn && <Link className="button ghost" href="/account">Sign in again</Link>}
    {(recovery || settings.phase === "refreshing") && <button className="button ghost" disabled={pending} onClick={() => void settings.refresh()}>{settings.phase === "refreshing" ? "Refreshing saved settings…" : "Refresh saved settings"}</button>}
    {settings.phase === "choice" && settings.saved && settings.attempted && <>
      <section aria-label="Saved settings"><strong>Saved account settings</strong><SettingsSummary fields={settings.saved} /></section>
      <section aria-label="My changes"><strong>Your attempted changes</strong><SettingsSummary fields={settings.attempted} /></section>
      <div className="practice-actions"><button className="button ghost" onClick={settings.useSaved}>Use saved settings</button><button className="button primary" onClick={settings.reviewChanges}>Review my changes</button></div>
    </>}
  </section>;

  if (!settings.owner) return notice;
  function toggleInterest(value: string) {
    settings.edit({ interests: form.interests.includes(value) ? form.interests.filter(item => item !== value) : [...form.interests, value].slice(0, 8) });
  }
  return <section className="profile-settings" aria-label="Learning goal settings">
    {notice}
    <div className="writing-layout">
      <section className="writing-workspace">
        <div className="task-box"><span>{settings.guest ? "DEVICE SETTINGS · GUEST" : "ACCOUNT SETTINGS"}</span><h2>What are you building English for?</h2><p>Choose a goal and a daily commitment. A starting practice level helps select exercises; it is not a certified level.</p></div>
        <fieldset disabled={settings.disabled} className="profile-settings-fields">
          <legend className="sr-only">Your learning preferences</legend>
          <div className="choice-stack">{goals.map(goal => <button type="button" aria-pressed={form.goal === goal.id} key={goal.id} className={form.goal === goal.id ? "correct" : ""} onClick={() => settings.edit({ goal: goal.id })}><strong>{goal.title}</strong><small>{goal.copy}</small></button>)}</div>
          <div className="panel"><label>Starting practice level<select aria-label="Starting practice level" value={form.cefrLevel} onChange={event => settings.edit({ cefrLevel: event.target.value as ProfileFields["cefrLevel"] })}>{["A1", "A2", "B1", "B2", "C1", "C2"].map(level => <option key={level}>{level}</option>)}</select></label></div>
          <div className="panel"><span className="eyebrow">DAILY PRACTICE</span><h3>{form.dailyMinutes} minutes/day</h3><div className="practice-actions">{[10, 15, 20, 30, 45, 60].map(minutes => <button type="button" key={minutes} aria-pressed={form.dailyMinutes === minutes} className={`button ${form.dailyMinutes === minutes ? "primary" : "ghost"}`} onClick={() => settings.edit({ dailyMinutes: minutes })}>{minutes}m</button>)}</div></div>
          {form.goal === "ielts" && <div className="panel"><span className="eyebrow">TARGET BAND</span><div className="practice-actions">{[5.5, 6, 6.5, 7, 7.5, 8].map(band => <button type="button" key={band} aria-pressed={form.targetBand === band} className={`button ${form.targetBand === band ? "primary" : "ghost"}`} onClick={() => settings.edit({ targetBand: band })}>{band.toFixed(1)}</button>)}</div></div>}
          <div className="panel"><span className="eyebrow">INTERESTS</span><p className="muted">Choose topics you enjoy practising.</p><div className="practice-actions">{interests.map(value => <button type="button" key={value} aria-pressed={form.interests.includes(value)} className={`button ${form.interests.includes(value) ? "primary" : "ghost"}`} onClick={() => toggleInterest(value)}>{value}</button>)}</div></div>
          <button className="button primary" onClick={() => void settings.save()}>{settings.phase === "saving" ? "Saving settings…" : settings.guest ? "Save on this device" : "Save player build"}</button>
        </fieldset>
        {settings.confirmed && settings.phase === "ready" && <div className="practice-actions"><Link href="/placement" className="button primary">Run Prologue calibration →</Link><Link href="/camp" className="button ghost">Continue to camp →</Link></div>}
        {settings.guest && <section className="panel" aria-label="Earlier device settings"><p>Earlier settings have no account owner. You can review them for this guest device profile.</p><button className="button ghost" disabled={settings.disabled} onClick={settings.reviewLegacy}>Review earlier device settings</button>{settings.legacyMessage && <p role="status">{settings.legacyMessage}</p>}{settings.legacy && <><SettingsSummary fields={settings.legacy} /><button className="button ghost" disabled={settings.disabled} onClick={settings.useLegacy}>Use earlier device settings</button></>}</section>}
      </section>
      <aside className="score-panel"><GameArt id={form.goal === "travel" ? "may" : form.goal === "work" ? "soi" : form.goal === "conversation" ? "nang" : "mam"} className="onboarding-guide" /><div><span className="eyebrow">YOUR LEARNING GOAL</span><h2>{goals.find(goal => goal.id === form.goal)?.title}</h2></div><SettingsSummary fields={form} /><p className="muted">Placement offers a starting practice suggestion. It awards no XP and does not change skill confidence or checked-practice rank.</p><small>{settings.guest ? "Guest · this device only" : "Personal account settings"}</small></aside>
    </div>
  </section>;
}
