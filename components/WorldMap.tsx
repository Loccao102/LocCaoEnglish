"use client";

import Link from "next/link";
import GameArt from "./GameArt";
import VillageMap from "./VillageMap";
import { villagePreview, worldArt } from "@/data/village";
import useAccountProgression from "./learning/useAccountProgression";
import ProgressionNotice from "./learning/ProgressionNotice";
import VocabularyUnlockNote, { currentVocabularyUnlock, vocabularySource, worldStatus } from "./learning/VocabularyUnlock";
import "./learning/vocabulary-unlocks.css";

export default function WorldMap() {
  const { data: state, status, needsSignIn, refresh, equip, equipping, equipmentError, unconfirmed } = useAccountProgression();
  if (!state) return <section className="progression-shell sunlit-worlds" aria-label="Personal progression">
    <header className="sunlit-intro"><div><span className="eyebrow">YOUR LEARNING ADVENTURE</span><h1>Your next word lives here.</h1><p>Follow your curiosity. Find your people. Grow a little English every day.</p></div><GameArt id="mam" className="intro-mam" /></header>
    <ProgressionNotice status={status} needsSignIn={needsSignIn} refresh={refresh} />
    <div className="vocabulary-world-links"><Link className="button ghost" href="/games/word-link">Practise vocabulary →</Link><Link className="button ghost" href="/word-graph">Explore word connections →</Link></div>
    <VillageMap worlds={villagePreview} live={false} />
    <footer className="village-credit"><span>Meet Mầm, Nắng, Mây & Sỏi — your village companions.</span><Link href="/art-studio">Explore the art collection ↗</Link></footer>
  </section>;

  const unlocked = state.worlds.filter(world => world.unlocked).length;
  const pct = Math.min(100, Math.round(state.xpIntoLevel / Math.max(1, state.xpForNext) * 100));
  return <section className="progression-shell sunlit-worlds" aria-label="Personal progression">
    <section className="progression-hero sunlit-progress-hero">
      <div><span className="eyebrow light">PLAYER JOURNEY</span><h1>Level {state.level} · {unlocked}/{state.worlds.length} worlds open</h1><p>Your personal milestones bring together practice, XP, your learning goal and saved chapter clears.</p><div className="level-xp"><span>{state.xpIntoLevel}/{state.xpForNext} personal XP to next level</span><div className="progress large"><i style={{ width: `${pct}%` }} /></div></div></div>
      <GameArt id="mam" className="intro-mam" />
    </section>
    <div className="progression-controls">
      <button className="button ghost" onClick={refresh} disabled={!!equipping || status === "loading"}>{unconfirmed ? "Refresh saved rewards" : "Refresh progress"}</button>
      {status === "loading" && <p role="status">Reading your saved worlds and rewards…</p>}
      {status === "error" && <p role="alert">Your progress could not be refreshed. The last loaded view is shown; try refreshing again.</p>}
      {equipmentError && <p role="alert">{equipmentError}</p>}
    </div>
    <VillageMap worlds={state.worlds} live={true} />
    <details className="village-world-details" open>
      <summary>All world details <span>{state.worlds.length} destinations</span></summary>
      <section className="world-path" aria-label="Learning world map">{state.worlds.map((world, index) => <article key={world.id} aria-label={`${world.title} world`} className={`world-node ${world.unlocked ? "open" : "locked"}`}>
        <GameArt id={worldArt(world.id)} className="world-card-art" />
        <div className="world-copy">
          <div><small>WORLD {String(index + 1).padStart(2, "0")}</small><span>{worldStatus(world)}</span></div>
          <h2>{world.title}</h2><p>{world.description}</p>
          {world.id === "words" ? <VocabularyUnlockNote unlock={world.unlock} unlocked={world.unlocked} world /> : <div className="progress"><i style={{ width: `${world.progress}%` }} /></div>}
          {world.unlocked ? <Link href={world.route} className="button primary">Enter world →</Link> : <div className="unlock-rule">🔒 {world.id === "words" && !currentVocabularyUnlock(world.unlock) ? "Unlock details unavailable" : world.unlockText}</div>}
          {world.id === "words" && !world.unlocked && <div className="vocabulary-world-links"><Link className="button ghost" href="/games/word-link">Practise vocabulary →</Link><Link className="button ghost" href="/word-graph">Explore word connections →</Link></div>}
        </div>
      </article>)}</section>
    </details>
    <section className="progression-grid">
      <article className="panel">
        <div className="section-heading"><div><span className="eyebrow">TROPHY ROOM</span><h2>Achievements</h2></div><GameArt id="sun-medal" className="reward-heading-art" /><span className="xp-pill">{state.achievements.filter(achievement => achievement.unlocked).length}/{state.achievements.length}</span></div>
        <div className="achievement-list">{state.achievements.map(achievement => <article className={`achievement ${achievement.unlocked ? "earned" : ""}`} key={achievement.id} aria-label={`${achievement.title} achievement`}>
          <span className="achievement-icon">{achievement.icon}</span>
          <div><strong>{achievement.title}</strong><p>{achievement.id === "wordsmith" ? "A keepsake for a varied vocabulary practice habit." : achievement.description}</p>
            {achievement.id === "wordsmith" ? <VocabularyUnlockNote unlock={achievement.unlock} unlocked={achievement.unlocked} /> : <><div className="progress"><i style={{ width: `${Math.min(100, achievement.progress / Math.max(1, achievement.target) * 100)}%` }} /></div><small>{achievement.progress}/{achievement.target}</small></>}
          </div><b>{achievement.unlocked ? "✓" : ""}</b>
        </article>)}</div>
      </article>
      <article className="panel">
        <div className="section-heading"><div><span className="eyebrow">LOADOUT</span><h2>Rewards you can wear</h2></div><GameArt id="satchel" className="reward-heading-art" /></div>
        <div className="inventory-grid">{state.inventory.map(item => <button key={item.id} aria-label={item.id === "wordsmith-pin" ? "Equip Wordsmith Pin" : undefined} disabled={!item.unlocked || item.equipped || !!equipping || unconfirmed} onClick={() => void equip(item)} className={`cosmetic ${item.unlocked ? "unlocked" : "locked"} ${item.equipped ? "equipped" : ""}`}>
          <span>{item.slot.toUpperCase()}</span><strong>{item.name}</strong><p>{item.id === "wordsmith-pin" ? "A keepsake from your personal vocabulary journey." : item.description}</p>
          {item.id === "wordsmith-pin" && <span className="vocabulary-unlock-note"><span>{vocabularySource(item.unlock) ?? (currentVocabularyUnlock(item.unlock) && !item.unlocked ? "Guided vocabulary practice milestone" : "Unlock details unavailable")}</span></span>}
          <small>{item.equipped ? "EQUIPPED" : item.unlocked ? equipping === item.id ? "Equipping…" : unconfirmed ? "Refresh saved rewards first" : "Equip" : "Locked"}</small>
        </button>)}</div>
      </article>
    </section>
    <section className="panel boss-gates"><div className="section-heading"><div><span className="eyebrow">BOSS GATES</span><h2>Proof before the fight</h2></div></div>{state.bosses.map(boss => <div className={`boss-gate ${boss.unlocked ? "open" : "locked"}`} key={boss.id}>
      <div><strong>{boss.title}</strong><p>{boss.cleared ? `Cleared · +${boss.rewardXp} XP` : boss.unlocked ? "Gate open. The final mission is ready." : "Complete the saved practice checkpoints to open this chapter."}</p></div>
      <div className="boss-checkpoints">{boss.checkpoints.map(checkpoint => <span key={checkpoint.id} className={checkpoint.complete ? "complete" : ""}>{checkpoint.complete ? "✓" : "○"} {checkpoint.skill}</span>)}</div>
      {boss.unlocked ? <Link href={boss.route} className="button primary">{boss.cleared ? "Replay boss" : "Fight boss →"}</Link> : <span className="mode-badge warning">LOCKED</span>}
    </div>)}</section>
    <footer className="village-credit"><span>Meet Mầm, Nắng, Mây & Sỏi — your village companions.</span><Link href="/art-studio">Explore the art collection ↗</Link></footer>
  </section>;
}
