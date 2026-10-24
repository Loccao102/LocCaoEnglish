"use client";

import Link from "next/link";
import GameArt from "./GameArt";
import { getMe, getPlayerProfile, getProgression } from "@/lib/api";
import useSignedInToken from "./learning/useSignedInToken";
import useAccountResource from "./learning/useAccountResource";
import ProgressionNotice from "./learning/ProgressionNotice";
import VocabularyUnlockNote, { vocabularySource } from "./learning/VocabularyUnlock";
import "./learning/vocabulary-unlocks.css";

async function loadPlayerCard(token: string) {
  const [me, profile, progress] = await Promise.all([getMe(token), getPlayerProfile(token), getProgression(token)]);
  return { me, profile, progress };
}

export default function PlayerProfilePanel() {
  const token = useSignedInToken();
  const { data, status, needsSignIn, refresh } = useAccountResource(token, loadPlayerCard);
  if (!data) return <section className="panel profile-game-card" aria-label="Account rewards">
    <span className="eyebrow">PLAYER PROFILE</span><h2>Your saved character and rewards</h2>
    <ProgressionNotice status={status} needsSignIn={needsSignIn} refresh={refresh} signInLabel="Sign in to see your rewards" />
  </section>;

  const { me, profile, progress } = data;
  const equipped = progress.inventory.filter(item => item.equipped);
  const pct = Math.min(100, Math.round(progress.xpIntoLevel / Math.max(1, progress.xpForNext) * 100));
  return <section className="player-profile-layout" aria-label="Account rewards">
    <section className="profile-hero-card">
      <GameArt id={profile.goal === "travel" ? "may" : profile.goal === "work" ? "soi" : profile.goal === "conversation" ? "nang" : "mam"} className="profile-avatar-xl" label={`${me.user.displayName}’s village companion`} />
      <div className="profile-identity"><span className="eyebrow light">PLAYER CARD</span><h1>{me.user.displayName}</h1><p>Level {progress.level} · {me.user.xp.toLocaleString()} personal XP · 🔥 {me.user.streak} day streak</p><div className="progress large"><i style={{ width: `${pct}%` }} /></div><small>{progress.xpIntoLevel}/{progress.xpForNext} XP to level {progress.level + 1}</small></div>
      <div className="profile-build"><small>LEARNING GOAL</small><strong>{profile.goal.toUpperCase()}</strong><span>{profile.cefrLevel} · {profile.dailyMinutes} min/day</span>{profile.goal === "ielts" && <span>Target {profile.targetBand.toFixed(1)}</span>}</div>
    </section>
    <div className="progression-controls"><button className="button ghost" onClick={refresh}>Refresh saved rewards</button></div>
    <section className="profile-grid">
      <article className="panel">
        <div className="section-heading"><div><span className="eyebrow">LOADOUT</span><h2>Equipped rewards</h2></div><Link href="/progress" className="text-link">Change loadout →</Link></div>
        {equipped.length === 0 ? <div className="empty-reward"><strong>No trophies equipped yet.</strong><p>Explore your personal milestones and choose a reward to wear.</p></div> : <div className="equipped-list">{equipped.map(item => <div className="equipped-item" key={item.id}>
          <span>{item.slot}</span><strong>{item.name}</strong><p>{item.id === "wordsmith-pin" ? "A keepsake from your personal vocabulary journey." : item.description}</p>
          {item.id === "wordsmith-pin" && <p className="vocabulary-unlock-note">{vocabularySource(item.unlock) ?? "Unlock details unavailable"}</p>}
        </div>)}</div>}
      </article>
      <article className="panel">
        <div className="section-heading"><div><span className="eyebrow">ACHIEVEMENTS</span><h2>{progress.achievements.filter(achievement => achievement.unlocked).length}/{progress.achievements.length} earned</h2></div></div>
        <div className="profile-achievements">{progress.achievements.map(achievement => <article className={achievement.unlocked ? "earned" : ""} key={achievement.id} aria-label={`${achievement.title} achievement`}>
          <span>{achievement.icon}</span><div><strong>{achievement.title}</strong><small>{achievement.unlocked ? "Unlocked" : achievement.id === "wordsmith" ? "Vocabulary practice milestone" : `${achievement.progress}/${achievement.target}`}</small>
            {achievement.id === "wordsmith" && <VocabularyUnlockNote unlock={achievement.unlock} unlocked={achievement.unlocked} />}
          </div>
        </article>)}</div>
      </article>
    </section>
    <section className="panel profile-actions"><div><span className="eyebrow">YOUR LEARNING GOAL</span><h2>Choose your next direction.</h2><p>Your goal and daily time guide your practice suggestions.</p></div><Link href="/onboarding" className="button primary">Update learning goal →</Link></section>
  </section>;
}
