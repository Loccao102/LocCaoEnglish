"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getDashboard, type Dashboard } from "@/lib/api";
import { zones, quests } from "@/lib/game/catalog";
import { companionById } from "@/lib/game/companions";
import { festivalGames } from "@/lib/game/festival";
import { friendships } from "@/lib/game/journey";
import { personalityFor } from "@/lib/game/personalities";
import { nextQuest, pageCount, questOpen } from "@/lib/game/progress";
import { useAdventure } from "./useAdventure";
import { useFairProgress } from "./FairProgressProvider";
import FairSaveStatus from "./FairSaveStatus";
import CompanionPortrait from "./CompanionPortrait";

export default function PlayerJourney() {
  const adventure = useAdventure(), fair = useFairProgress();
  const [selected, setSelected] = useState("mam"), [message, setMessage] = useState(""), [learning, setLearning] = useState<Dashboard | null>(null), [learningError, setLearningError] = useState("");
  const ready = adventure.status === "ready", connected = ready && fair.status === "ready" && adventure.identity === fair.owner;
  useEffect(() => {
    let active = true; setLearning(null); setLearningError("");
    if (ready && adventure.identity !== "guest") void getDashboard().then(data => { if (active && data.user.id === adventure.identity) setLearning(data); }).catch(() => { if (active) setLearningError("Your learning summary could not connect. Your village and fair saves are shown separately below."); });
    return () => { active = false; };
  }, [ready, adventure.identity]);
  const next = nextQuest(adventure.save), current = companionById(adventure.save.character);
  const friends = friendships(adventure.save, connected ? fair.save : { version: 1, games: {} }), active = friends.find(item => item.friend.id === selected)!;
  const personality = personalityFor(selected), stamps = Object.values(fair.save.games).filter(record => record.stars > 0).length;
  const nextFair = festivalGames.find(game => !fair.save.games[game.id]?.stars) || festivalGames.find(game => fair.save.games[game.id]?.stars < 3) || festivalGames[0];
  const earned = adventure.save.owned.includes(selected), affordable = earned || adventure.save.coins >= active.friend.cost;
  async function equip() {
    setMessage("");
    try { await adventure.act({ kind: "equip", character: selected }); setMessage(`${active.friend.name} is ready to travel with you.`); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Your companion could not be saved. Please retry."); }
  }
  return <div className="journey page-wrap">
    <header className="journey-heading"><div><p className="eyebrow">YOUR SUNLIT VILLAGE STORY</p><h1>A little further.<br/><em>A little closer.</em></h1><p>Seven chapters to explore. Twenty-four friends to grow with.<br/>Every page and every memory belongs in your story.</p></div><div className="journey-traveller"><CompanionPortrait id={current.id}/><span>TRAVELLING WITH</span><strong>{current.name}</strong><Link href="/play" className="button primary">Continue adventure →</Link></div></header>
    <FairSaveStatus/>
    {adventure.status === "error" && <div className="journey-notice" role="alert"><p>{adventure.error}</p><button className="button ghost" onClick={() => void adventure.load()}>Retry adventure</button><Link href="/account">Open account →</Link></div>}
    {adventure.storageWarning && <p role="status">{adventure.storageWarning}</p>}
    <section className="journey-stats" aria-label="Journey progress">{[
      { count: ready ? `${pageCount(adventure.save)} / 7` : "—", label: "Sun Pages restored" },
      { count: fair.status === "ready" ? `${stamps} / 8` : "—", label: "Fair memories" },
      { count: connected ? `${friends.filter(item => item.hearts === 3).length} / 24` : "—", label: "Close friends" },
      { count: ready ? adventure.save.coins : "—", label: "Sun coins to spend" },
    ].map(item => <div key={item.label}><strong>{item.count}</strong><span>{item.label}</span></div>)}</section>

    <section className="journey-next" aria-label="Suggested next adventures"><div className="journey-next-copy"><span className="eyebrow">A SMALL PLAN FOR TODAY</span><h2>Follow your curiosity.</h2><p>Pick up your story, make a new memory, or spend a few minutes on your English.</p></div><div className="journey-next-links">
      <Link href="/play" onClick={() => { if (ready && next) adventure.updateMeta({ tracked: next.id, started: true }); }}><span>01 · YOUR STORY</span><strong>{ready ? next?.title || "All seven pages are home" : "Open the village"}</strong><small>{next ? "Continue your current chapter" : "Revisit a friend or improve your stars"} →</small></Link>
      <Link href={`/festival/${nextFair.id}`}><span>02 · A FRIENDSHIP MEMORY</span><strong>{nextFair.name}</strong><small>Play with {companionById(nextFair.host).name} →</small></Link>
      <Link href={learning?.dueReviews ? "/review" : "/camp"}><span>03 · A LITTLE ENGLISH</span><strong>{learning?.dueReviews ? `${learning.dueReviews} words to revisit` : "Your learning journal"}</strong><small>{learning ? `${learning.user.xp} account XP · find your next lesson` : "Lessons, practice and skill progress"} →</small></Link>
    </div></section>
    {learningError && <p role="status">{learningError}</p>}

    <section className="journey-chapters" aria-label="Story chapters"><div className="journey-section-title"><div><span className="eyebrow">THE BOOK OF SUN PAGES</span><h2>Seven places. One shared story.</h2></div><span>{ready ? Object.keys(adventure.save.completed).length : "—"} / {quests.length} quests</span></div><div className="journey-chapter-list">{zones.map(zone => {
      const done = ready && zone.quests.every(quest => adventure.save.completed[quest.id]), open = ready && questOpen(adventure.save, zone.quests[0]);
      return <article key={zone.id} className={done ? "complete" : open ? "current" : "locked"}><span className="journey-chapter-number">{done ? "✿" : `0${zone.chapter}`}</span><div><small>{zone.guide}’S CHAPTER</small><h3>{zone.name}</h3><p>{zone.quests.map(quest => `${adventure.save.completed[quest.id] ? "✓" : "○"} ${quest.title}`).join(" · ")}</p></div>{open ? <Link href="/play" onClick={() => adventure.updateMeta({ tracked: (zone.quests.find(quest => !adventure.save.completed[quest.id]) || zone.quests[0]).id, started: true })}>{done ? "Visit again" : "Continue"} →</Link> : <span>{ready ? "Previous chapter first" : "Connecting…"}</span>}</article>;
    })}</div></section>

    <section className="journey-friends" aria-label="Friendship collection"><div className="journey-section-title"><div><span className="eyebrow">TWENTY-FOUR LITTLE WORLDS</span><h2>Friendship grows through play.</h2></div><Link href="/characters">Explore models & expressions →</Link></div><div className="journey-friend-layout"><div className="journey-friend-grid" role="group" aria-label="Choose a friend">{friends.map(item => <button key={item.friend.id} aria-pressed={selected === item.friend.id} onClick={() => { setSelected(item.friend.id); setMessage(""); }}><CompanionPortrait id={item.friend.id}/><strong>{item.friend.name}</strong><span aria-label={connected ? `${item.hearts} of 3 friendship hearts` : "Friendship progress is connecting"}>{connected ? "♥".repeat(item.hearts) + "♡".repeat(3 - item.hearts) : "···"}</span></button>)}</div><article className="journey-friend-story" style={{ "--friend-tint": active.friend.design.skin } as React.CSSProperties}><CompanionPortrait id={selected}/><span className="eyebrow">{personality.trait}</span><h3>{active.friend.name}</h3><p className="journey-friend-title">{connected ? active.title : "A friendship waiting to grow"}</p><p>{personality.story}</p><ul>{active.milestones.map(milestone => <li key={milestone.label} data-complete={connected && milestone.complete}><span>{connected && milestone.complete ? "♥" : "♡"}</span><Link href={milestone.href}>{milestone.label}</Link></li>)}</ul>{connected && active.hearts === 3 ? <blockquote><span>A DREAM SHARED WITH YOU</span>{personality.dream}</blockquote> : <p className="journey-dream-hint">Make all three memories to add {active.friend.name}’s dream to your journal.</p>}<Link className="button ghost" href={active.friend.route}>Learn with {active.friend.name} →</Link><button className="button primary" disabled={!ready || adventure.busy || !affordable || current.id === selected} onClick={() => void equip()}>{current.id === selected ? "Your travelling companion" : !affordable ? `Needs ${active.friend.cost} sun coins` : earned || active.friend.cost === 0 ? `Travel with ${active.friend.name}` : `Unlock & travel · ${active.friend.cost} coins`}</button>{message && <p role="status">{message}</p>}</article></div></section>
    <footer className="journey-footer"><p>Chapter quests earn Sun Pages, XP and sun coins. Fair games collect personal memories and friendship hearts. {adventure.identity === "guest" ? "Your guest story stays on this device." : "Your account keeps these together when the server is connected."}</p><Link href="/games">Explore all 20 games & learning activities →</Link></footer>
  </div>;
}
